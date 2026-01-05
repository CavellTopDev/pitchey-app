import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NDAWorkflow } from '../nda-workflow';

// ============================================================================
// Type Definitions for Testing
// ============================================================================

interface NDAParams {
  requesterId: string;
  requesterType: 'investor' | 'production' | 'partner';
  requesterEmail: string;
  requesterName: string;
  creatorId: string;
  pitchId: string;
  templateId: string;
  customTerms?: Record<string, any>;
  durationMonths?: number;
  territorialRestrictions?: string[];
}

interface MockEnv {
  HYPERDRIVE: { connectionString: string };
  WORKFLOW_INSTANCE_ID: string;
  NOTIFICATION_QUEUE: { send: any };
  NDA_TEMPLATES: { get: any };
  DOCUMENTS: { put: any };
  [key: string]: any;
}

// ============================================================================
// Mock Setup
// ============================================================================

const mockDb = vi.fn();
const mockNeon = vi.fn(() => mockDb);

// Mock @neondatabase/serverless
vi.mock('@neondatabase/serverless', () => ({
  neon: mockNeon
}));

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'nda-mock-uuid-123')
  }
});

const mockEnv: MockEnv = {
  HYPERDRIVE: {
    connectionString: 'postgresql://test@localhost/test'
  },
  WORKFLOW_INSTANCE_ID: 'nda-workflow-123',
  NOTIFICATION_QUEUE: {
    send: vi.fn()
  },
  NDA_TEMPLATES: {
    get: vi.fn()
  },
  DOCUMENTS: {
    put: vi.fn()
  }
};

describe('NDAWorkflow', () => {
  let workflow: NDAWorkflow;
  let mockStep: any;
  let mockEvent: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the WorkflowStep
    mockStep = {
      do: vi.fn().mockImplementation((name, fn, options) => {
        try {
          return fn();
        } catch (error) {
          if (options?.retries) {
            // Simulate retry logic
            return fn();
          }
          throw error;
        }
      }),
      waitForEvent: vi.fn(),
      sleep: vi.fn()
    };

    // Mock WorkflowEvent
    mockEvent = {
      params: {
        requesterId: 'investor_123',
        requesterType: 'investor',
        requesterEmail: 'investor@example.com',
        requesterName: 'Test Investor',
        creatorId: 'creator_456',
        pitchId: 'pitch_789',
        templateId: 'standard_nda_v1',
        durationMonths: 24
      } as NDAParams
    };

    workflow = new NDAWorkflow();
    (workflow as any).env = mockEnv;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('NDA Record Creation', () => {
    it('should create NDA record when no existing NDA exists', async () => {
      // Mock no existing NDA
      mockDb.mockResolvedValueOnce([]); // existing NDA check
      mockDb.mockResolvedValueOnce(undefined); // create NDA

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('create-nda-record', expect.any(Function));
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, status, expiration_date'),
        [mockEvent.params.requesterId, mockEvent.params.pitchId]
      );
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ndas'),
        expect.arrayContaining([
          'nda-mock-uuid-123',
          'nda-workflow-123',
          'investor_123',
          'investor',
          'creator_456',
          'pitch_789',
          'standard_nda_v1',
          'DRAFT',
          24
        ])
      );
    });

    it('should throw error when active NDA already exists', async () => {
      // Mock existing active NDA
      mockDb.mockResolvedValueOnce([{
        id: 'existing-nda-123',
        status: 'ACTIVE',
        expiration_date: new Date(Date.now() + 86400000).toISOString() // 1 day from now
      }]);

      await expect(workflow.run(mockEvent, mockStep)).rejects.toThrow('Active NDA already exists: existing-nda-123');
    });

    it('should allow new NDA when previous one is expired', async () => {
      // Mock expired NDA
      mockDb
        .mockResolvedValueOnce([{
          id: 'expired-nda-123',
          status: 'EXPIRED',
          expiration_date: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        }])
        .mockResolvedValueOnce(undefined); // create new NDA

      await workflow.run(mockEvent, mockStep);

      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ndas'),
        expect.any(Array)
      );
    });

    it('should use default duration when not specified', async () => {
      const eventWithoutDuration = {
        params: { ...mockEvent.params }
      };
      delete eventWithoutDuration.params.durationMonths;

      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined); // create NDA

      await workflow.run(eventWithoutDuration, mockStep);

      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ndas'),
        expect.arrayContaining([24]) // default 24 months
      );
    });
  });

  describe('Risk Assessment Engine', () => {
    beforeEach(() => {
      // Default setup for risk assessment tests
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined); // create NDA
    });

    it('should assess low risk for verified user with standard template', async () => {
      mockDb.mockResolvedValueOnce([{ // user verification check
        email_verified: true,
        phone_verified: true,
        identity_verified: true,
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
        trust_score: 85
      }]);

      mockDb.mockResolvedValueOnce([]); // no prior NDAs

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard',
        clauses: ['confidentiality', 'non-disclosure', 'term_limit']
      });

      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('assess-risk', expect.any(Function), {
        retries: {
          limit: 2,
          backoff: 'linear',
          delay: 1000
        }
      });
    });

    it('should assess high risk for unverified user with custom terms', async () => {
      const highRiskEvent = {
        params: {
          ...mockEvent.params,
          customTerms: {
            specialClause: 'Custom confidentiality terms',
            additionalRequirements: 'Multiple additional clauses',
            extendedScope: 'Broader than standard',
            customPenalties: 'Non-standard penalty structure'
          },
          durationMonths: 48, // 4 years - longer than standard
          territorialRestrictions: ['US', 'Canada', 'UK', 'Australia', 'New Zealand', 'EU']
        }
      };

      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined); // create NDA

      mockDb.mockResolvedValueOnce([{ // unverified user
        email_verified: false,
        phone_verified: false,
        identity_verified: false,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        trust_score: 25
      }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'custom',
        complexity: 'high'
      });

      mockDb.mockResolvedValueOnce([]); // no prior NDAs
      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment

      await workflow.run(highRiskEvent, mockStep);

      // Should trigger legal review
      expect(mockStep.do).toHaveBeenCalledWith('request-legal-review', expect.any(Function));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_legal_review_required',
          recipientId: 'legal-team',
          data: expect.objectContaining({
            riskScore: expect.any(Number),
            reviewReason: expect.any(String)
          })
        })
      );
    });

    it('should assess high risk for user with NDA breach history', async () => {
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined); // create NDA

      mockDb.mockResolvedValueOnce([{ // verified user but...
        email_verified: true,
        phone_verified: true,
        identity_verified: true,
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        trust_score: 70
      }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard'
      });

      mockDb.mockResolvedValueOnce([{ // prior NDA history with breach
        total: 3,
        breached: 1,
        disputed: 0
      }]);

      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('request-legal-review', expect.any(Function));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_legal_review_required',
          data: expect.objectContaining({
            reviewReason: 'Prior NDA breach'
          })
        })
      );
    });

    it('should assess medium risk for partially verified user', async () => {
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined); // create NDA

      mockDb.mockResolvedValueOnce([{ // partially verified user
        email_verified: true,
        phone_verified: false,
        identity_verified: true,
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
        trust_score: 60
      }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard'
      });

      mockDb.mockResolvedValueOnce([{ // clean prior history
        total: 2,
        breached: 0,
        disputed: 0
      }]);

      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment

      await workflow.run(mockEvent, mockStep);

      // Should trigger creator review for medium risk
      expect(mockStep.do).toHaveBeenCalledWith('request-creator-review', expect.any(Function));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_creator_review_required',
          recipientId: mockEvent.params.creatorId
        })
      );
    });

    it('should handle user not found scenario', async () => {
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined); // create NDA

      mockDb.mockResolvedValueOnce([]); // user not found

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard'
      });

      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('request-legal-review', expect.any(Function));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewReason: 'Requester not found in database'
          })
        })
      );
    });
  });

  describe('Legal Review Process', () => {
    beforeEach(() => {
      // Setup high-risk scenario that triggers legal review
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined) // create NDA
        .mockResolvedValueOnce([{ // high-risk user
          email_verified: false,
          phone_verified: false,
          identity_verified: false,
          created_at: new Date().toISOString(),
          trust_score: 10
        }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'custom'
      });

      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment
    });

    it('should handle legal review approval', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          decision: 'approve',
          reviewerId: 'legal_reviewer_123',
          notes: 'Standard terms acceptable despite risk factors'
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update NDA status

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-legal-review',
        { timeout: '48 hours' }
      );

      expect(mockStep.do).toHaveBeenCalledWith('generate-nda-document', expect.any(Function));
    });

    it('should handle legal review rejection', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          decision: 'reject',
          reviewerId: 'legal_reviewer_123',
          notes: 'Too many risk factors, terms not acceptable'
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update NDA status to rejected

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NDA rejected by legal review');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_rejected',
          recipientId: mockEvent.params.requesterId,
          data: expect.objectContaining({
            reason: 'Too many risk factors, terms not acceptable'
          })
        })
      );
    });

    it('should handle legal review modifications', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          decision: 'modify',
          reviewerId: 'legal_reviewer_123',
          notes: 'Approved with modifications',
          modifiedTerms: {
            durationMonths: 12, // Reduced from 24
            additionalClause: 'Legal department added clause'
          }
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update NDA status

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('generate-nda-document', expect.any(Function));
      // Modified terms should be applied
      expect(mockEvent.params.customTerms).toEqual(
        expect.objectContaining({
          durationMonths: 12,
          additionalClause: 'Legal department added clause'
        })
      );
    });

    it('should handle legal review timeout', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce(null); // timeout

      mockDb.mockResolvedValueOnce(undefined); // update NDA status to rejected

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NDA rejected by legal review');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_rejected',
          data: expect.objectContaining({
            reason: 'Legal review did not approve'
          })
        })
      );
    });
  });

  describe('Creator Review Process', () => {
    beforeEach(() => {
      // Setup medium-risk scenario that triggers creator review
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined) // create NDA
        .mockResolvedValueOnce([{ // medium-risk user
          email_verified: true,
          phone_verified: false,
          identity_verified: true,
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          trust_score: 55
        }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard'
      });

      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment
    });

    it('should handle creator approval', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          decision: 'approve',
          message: 'Investor looks legitimate'
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update NDA status

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-creator-nda-review',
        { timeout: '72 hours' }
      );

      expect(mockStep.do).toHaveBeenCalledWith('generate-nda-document', expect.any(Function));
    });

    it('should handle creator rejection', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          decision: 'reject',
          message: 'Not comfortable with this requester'
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update NDA status to rejected

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NDA rejected by creator');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_rejected',
          recipientId: mockEvent.params.requesterId,
          data: expect.objectContaining({
            reason: 'Not comfortable with this requester'
          })
        })
      );
    });

    it('should handle creator review timeout', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce(null); // timeout

      mockDb.mockResolvedValueOnce(undefined); // update NDA status to rejected

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NDA rejected by creator');
    });
  });

  describe('Document Generation and Signature Process', () => {
    beforeEach(() => {
      // Setup low-risk scenario that auto-approves
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined) // create NDA
        .mockResolvedValueOnce([{ // low-risk user
          email_verified: true,
          phone_verified: true,
          identity_verified: true,
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          trust_score: 85
        }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard',
        clauses: ['confidentiality', 'non-disclosure']
      });

      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce(undefined); // update NDA with risk assessment
    });

    it('should generate NDA document successfully', async () => {
      // Mock getUserName call
      mockDb.mockResolvedValueOnce([{
        name: 'Creator Name',
        email: 'creator@example.com'
      }]);

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('generate-nda-document', expect.any(Function));
      expect(mockEnv.DOCUMENTS.put).toHaveBeenCalledWith(
        'ndas/nda-mock-uuid-123/agreement.json',
        expect.stringContaining('nda-mock-uuid-123')
      );
    });

    it('should send for electronic signature', async () => {
      mockDb
        .mockResolvedValueOnce([{ name: 'Creator Name' }]) // getUserName
        .mockResolvedValueOnce(undefined) // update NDA status to PENDING
        .mockResolvedValueOnce(undefined) // update with envelope ID
        .mockResolvedValueOnce([{ title: 'Test Pitch Title' }]); // getPitchTitle

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('send-for-signature', expect.any(Function));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_signature_requested',
          recipientId: mockEvent.params.requesterId,
          data: expect.objectContaining({
            envelopeId: 'envelope_nda-mock-uuid-123',
            signingDeadline: expect.any(String)
          })
        })
      );
    });

    it('should handle successful signature', async () => {
      mockDb
        .mockResolvedValueOnce([{ name: 'Creator Name' }]) // getUserName
        .mockResolvedValueOnce(undefined) // update to PENDING
        .mockResolvedValueOnce(undefined) // update with envelope ID
        .mockResolvedValueOnce([{ title: 'Test Pitch' }]); // getPitchTitle

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          envelopeId: 'envelope_nda-mock-uuid-123',
          status: 'completed',
          signedAt: new Date().toISOString()
        }
      });

      mockDb
        .mockResolvedValueOnce(undefined) // update to SIGNED
        .mockResolvedValueOnce(undefined) // update to ACTIVE
        .mockResolvedValueOnce(undefined); // grant pitch access

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-signature',
        { timeout: '7 days' }
      );

      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pitch_access'),
        expect.arrayContaining([
          'nda-mock-uuid-123',
          mockEvent.params.requesterId,
          mockEvent.params.pitchId,
          'nda_protected',
          'nda',
          'nda-mock-uuid-123'
        ])
      );
    });

    it('should handle signature decline', async () => {
      mockDb
        .mockResolvedValueOnce([{ name: 'Creator Name' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ title: 'Test Pitch' }]);

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          envelopeId: 'envelope_nda-mock-uuid-123',
          status: 'declined',
          declinedReason: 'Terms not acceptable'
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update to DECLINED

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NDA not executed');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_declined',
          recipientId: mockEvent.params.creatorId,
          data: expect.objectContaining({
            reason: 'Terms not acceptable'
          })
        })
      );
    });

    it('should handle signature timeout', async () => {
      mockDb
        .mockResolvedValueOnce([{ name: 'Creator Name' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ title: 'Test Pitch' }]);

      mockStep.waitForEvent.mockResolvedValueOnce(null); // signature timeout

      mockDb.mockResolvedValueOnce(undefined); // update to EXPIRED

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('NDA signature timeout');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_expired',
          recipientId: mockEvent.params.requesterId,
          data: expect.objectContaining({
            reason: 'Signature deadline missed'
          })
        })
      );
    });

    it('should handle document viewed but not signed', async () => {
      mockDb
        .mockResolvedValueOnce([{ name: 'Creator Name' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ title: 'Test Pitch' }]);

      mockStep.waitForEvent
        .mockResolvedValueOnce({
          payload: {
            envelopeId: 'envelope_nda-mock-uuid-123',
            status: 'delivered' // Viewed but not signed
          }
        })
        .mockResolvedValueOnce({
          payload: {
            envelopeId: 'envelope_nda-mock-uuid-123',
            status: 'completed',
            signedAt: new Date().toISOString()
          }
        });

      mockDb
        .mockResolvedValueOnce(undefined) // update to VIEWED
        .mockResolvedValueOnce(undefined) // update to SIGNED
        .mockResolvedValueOnce(undefined) // update to ACTIVE
        .mockResolvedValueOnce(undefined); // grant access

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-final-signature',
        { timeout: '5 days' }
      );

      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_reminder',
          recipientId: mockEvent.params.requesterId,
          data: expect.objectContaining({
            daysRemaining: 5
          })
        })
      );
    });
  });

  describe('NDA Activation and Monitoring', () => {
    beforeEach(() => {
      // Setup complete successful flow to activation
      mockDb
        .mockResolvedValueOnce([]) // no existing NDA
        .mockResolvedValueOnce(undefined) // create NDA
        .mockResolvedValueOnce([{ // low-risk user
          email_verified: true,
          phone_verified: true,
          identity_verified: true,
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          trust_score: 85
        }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard'
      });

      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce(undefined); // risk assessment update
    });

    it('should activate NDA and grant access', async () => {
      mockDb
        .mockResolvedValueOnce([{ name: 'Creator Name' }])
        .mockResolvedValueOnce(undefined) // update to PENDING
        .mockResolvedValueOnce(undefined) // envelope update
        .mockResolvedValueOnce([{ title: 'Test Pitch' }]);

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          status: 'completed',
          signedAt: new Date().toISOString()
        }
      });

      mockDb
        .mockResolvedValueOnce(undefined) // update to SIGNED
        .mockResolvedValueOnce(undefined) // update to ACTIVE
        .mockResolvedValueOnce(undefined); // grant access

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(true);
      expect(result.ndaId).toBe('nda-mock-uuid-123');
      expect(result.approvalMethod).toBe('auto_approved');
      expect(result.riskLevel).toBe('low');

      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_executed',
          recipientId: mockEvent.params.requesterId,
          data: expect.objectContaining({
            accessGranted: true
          })
        })
      );

      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_executed',
          recipientId: mockEvent.params.creatorId
        })
      );
    });

    it('should schedule expiration monitoring', async () => {
      mockDb
        .mockResolvedValueOnce([{ name: 'Creator Name' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ title: 'Test Pitch' }]);

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: { status: 'completed', signedAt: new Date().toISOString() }
      });

      mockDb
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('schedule-expiration-monitoring', expect.any(Function));
      
      // Should schedule reminder and expiration
      expect(mockStep.sleep).toHaveBeenCalledWith(
        'wait-for-expiration-reminder',
        expect.any(Number)
      );
      expect(mockStep.sleep).toHaveBeenCalledWith(
        'wait-for-expiration',
        expect.any(Number)
      );

      expect(result.durationMonths).toBe(24);
    });

    it('should handle immediate expiration for short-term NDAs', async () => {
      const shortTermEvent = {
        params: {
          ...mockEvent.params,
          durationMonths: 1 // 1 month NDA
        }
      };

      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{
          email_verified: true,
          phone_verified: true,
          identity_verified: true,
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          trust_score: 85
        }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({ type: 'standard' });

      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ name: 'Creator Name' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ title: 'Test Pitch' }]);

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: { status: 'completed', signedAt: new Date().toISOString() }
      });

      mockDb
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await workflow.run(shortTermEvent, mockStep);

      expect(result.success).toBe(true);
      expect(result.durationMonths).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures with retries', async () => {
      mockDb.mockRejectedValueOnce(new Error('Database connection failed'));

      // First call fails, second succeeds (simulating retry)
      mockStep.do.mockImplementationOnce((name, fn, options) => {
        try {
          return fn();
        } catch (error) {
          if (options?.retries && name === 'assess-risk') {
            // Simulate retry success
            mockDb.mockResolvedValueOnce([]);
            return fn();
          }
          throw error;
        }
      });

      await expect(workflow.run(mockEvent, mockStep)).rejects.toThrow();
    });

    it('should handle missing template gracefully', async () => {
      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{
          email_verified: true,
          phone_verified: true,
          identity_verified: true,
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          trust_score: 85
        }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce(null); // Template not found

      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce(undefined);

      await workflow.run(mockEvent, mockStep);

      // Should trigger legal review due to unknown template
      expect(mockStep.do).toHaveBeenCalledWith('request-legal-review', expect.any(Function));
    });

    it('should handle notification service failures gracefully', async () => {
      mockEnv.NOTIFICATION_QUEUE.send.mockRejectedValue(new Error('Notification service down'));

      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined);

      // Workflow should continue despite notification failure
      await expect(workflow.run(mockEvent, mockStep)).resolves.toBeDefined();
    });

    it('should handle concurrent NDA requests for same pitch/requester', async () => {
      const duplicateEvent = { ...mockEvent };

      // First request creates NDA
      mockDb
        .mockResolvedValueOnce([]) // no existing
        .mockResolvedValueOnce(undefined); // create

      // Second request sees existing NDA
      mockDb.mockResolvedValueOnce([{
        id: 'existing-123',
        status: 'PENDING',
        expiration_date: new Date(Date.now() + 86400000).toISOString()
      }]);

      const workflow1 = new NDAWorkflow();
      (workflow1 as any).env = mockEnv;

      const workflow2 = new NDAWorkflow();
      (workflow2 as any).env = mockEnv;

      // First should succeed
      await workflow1.run(mockEvent, mockStep);

      // Second should fail
      await expect(workflow2.run(duplicateEvent, mockStep)).rejects.toThrow('Active NDA already exists');
    });
  });

  describe('Helper Methods', () => {
    it('should update NDA status and cache', async () => {
      const workflow = new NDAWorkflow();
      (workflow as any).env = {
        ...mockEnv,
        DEAL_CACHE: { put: vi.fn() }
      };

      await (workflow as any).updateNDAStatus('nda-123', 'ACTIVE');

      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ndas'),
        ['ACTIVE', 'nda-123']
      );

      expect((workflow as any).env.DEAL_CACHE.put).toHaveBeenCalledWith(
        'nda:nda-123:status',
        'ACTIVE',
        { expirationTtl: 3600 }
      );
    });

    it('should get user name with fallback', async () => {
      const workflow = new NDAWorkflow();
      (workflow as any).env = mockEnv;

      mockDb.mockResolvedValueOnce([{
        name: 'John Doe',
        email: 'john@example.com'
      }]);

      const name = await (workflow as any).getUserName('user-123');
      expect(name).toBe('John Doe');

      // Test fallback to email
      mockDb.mockResolvedValueOnce([{
        name: null,
        email: 'jane@example.com'
      }]);

      const emailName = await (workflow as any).getUserName('user-456');
      expect(emailName).toBe('jane@example.com');

      // Test unknown user
      mockDb.mockResolvedValueOnce([]);

      const unknownName = await (workflow as any).getUserName('unknown');
      expect(unknownName).toBe('Unknown User');
    });

    it('should get pitch title with fallback', async () => {
      const workflow = new NDAWorkflow();
      (workflow as any).env = mockEnv;

      mockDb.mockResolvedValueOnce([{
        title: 'Amazing Movie Pitch'
      }]);

      const title = await (workflow as any).getPitchTitle('pitch-123');
      expect(title).toBe('Amazing Movie Pitch');

      // Test unknown pitch
      mockDb.mockResolvedValueOnce([]);

      const unknownTitle = await (workflow as any).getPitchTitle('unknown');
      expect(unknownTitle).toBe('Unknown Pitch');
    });
  });

  describe('Complex Risk Scenarios', () => {
    it('should handle complex custom terms evaluation', async () => {
      const complexEvent = {
        params: {
          ...mockEvent.params,
          customTerms: {
            nonStandardConfidentiality: 'Extended scope',
            customPenalties: 'Liquidated damages clause',
            territorialExpansion: 'Worldwide rights',
            durationOverride: 'Perpetual confidentiality',
            specialProvisions: 'Multiple custom clauses'
          },
          territorialRestrictions: [
            'United States', 'Canada', 'Mexico', 'United Kingdom',
            'France', 'Germany', 'Italy', 'Spain', 'Australia',
            'Japan', 'South Korea', 'Brazil', 'India'
          ],
          durationMonths: 60 // 5 years
        }
      };

      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{
          email_verified: true,
          phone_verified: true,
          identity_verified: false, // Missing identity verification
          created_at: new Date().toISOString(), // Brand new account
          trust_score: 40
        }]);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'custom',
        complexity: 'very_high'
      });

      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce(undefined);

      await workflow.run(complexEvent, mockStep);

      // Should definitely trigger legal review
      expect(mockStep.do).toHaveBeenCalledWith('request-legal-review', expect.any(Function));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_legal_review_required',
          data: expect.objectContaining({
            riskScore: expect.any(Number),
            reviewReason: expect.stringContaining('custom')
          })
        })
      );
    });

    it('should properly calculate risk scores across all factors', async () => {
      const testCases = [
        {
          name: 'Perfect low-risk scenario',
          user: {
            email_verified: true,
            phone_verified: true,
            identity_verified: true,
            created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
            trust_score: 95
          },
          template: { type: 'standard' },
          customTerms: {},
          duration: 24,
          territorial: [],
          priorHistory: { total: 5, breached: 0, disputed: 0 },
          expectedLevel: 'low'
        },
        {
          name: 'High-risk scenario',
          user: {
            email_verified: false,
            phone_verified: false,
            identity_verified: false,
            created_at: new Date().toISOString(), // Brand new
            trust_score: 15
          },
          template: { type: 'custom' },
          customTerms: { a: 1, b: 2, c: 3, d: 4 }, // 4 custom terms
          duration: 48,
          territorial: ['US', 'UK', 'EU', 'Asia', 'Australia', 'Canada'],
          priorHistory: { total: 2, breached: 1, disputed: 1 },
          expectedLevel: 'high'
        }
      ];

      for (const testCase of testCases) {
        mockDb
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce([testCase.user]);

        mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce(testCase.template);

        mockDb
          .mockResolvedValueOnce([testCase.priorHistory])
          .mockResolvedValueOnce(undefined);

        const eventForTest = {
          params: {
            ...mockEvent.params,
            customTerms: testCase.customTerms,
            durationMonths: testCase.duration,
            territorialRestrictions: testCase.territorial
          }
        };

        await workflow.run(eventForTest, mockStep);

        if (testCase.expectedLevel === 'high') {
          expect(mockStep.do).toHaveBeenCalledWith('request-legal-review', expect.any(Function));
        }

        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockStep.do.mockImplementation((name, fn) => fn());
      }
    });
  });
});