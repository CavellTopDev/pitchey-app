import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProductionDealWorkflow } from '../production-deal-cf-workflow';

// ============================================================================
// Type Definitions for Testing
// ============================================================================

interface ProductionDealParams {
  productionCompanyId: string;
  productionCompanyUserId: string;
  pitchId: string;
  creatorId: string;
  interestType: 'option' | 'purchase' | 'co_production' | 'distribution';
  message?: string;
  proposedBudget?: number;
  proposedTimeline?: string;
  ndaId?: string;
}

interface MockEnv {
  HYPERDRIVE: { connectionString: string };
  WORKFLOW_INSTANCE_ID: string;
  NOTIFICATION_QUEUE: {
    send: any;
  };
  DOCUMENTS: {
    put: any;
    get: any;
  };
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
    randomUUID: vi.fn(() => 'mock-uuid-123')
  }
});

const mockEnv: MockEnv = {
  HYPERDRIVE: {
    connectionString: 'postgresql://test@localhost/test'
  },
  WORKFLOW_INSTANCE_ID: 'workflow-123',
  NOTIFICATION_QUEUE: {
    send: vi.fn()
  },
  DOCUMENTS: {
    put: vi.fn(),
    get: vi.fn()
  }
};

describe('ProductionDealWorkflow', () => {
  let workflow: ProductionDealWorkflow;
  let mockStep: any;
  let mockEvent: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the WorkflowStep
    mockStep = {
      do: vi.fn().mockImplementation((name, fn) => fn()),
      waitForEvent: vi.fn(),
      sleep: vi.fn()
    };

    // Mock WorkflowEvent
    mockEvent = {
      params: {
        productionCompanyId: 'prod_123',
        productionCompanyUserId: 'user_456',
        pitchId: 'pitch_789',
        creatorId: 'creator_111',
        interestType: 'option',
        message: 'Interested in optioning this project',
        proposedBudget: 500000,
        proposedTimeline: '12 months'
      } as ProductionDealParams
    };

    workflow = new ProductionDealWorkflow();
    // Set environment on the workflow instance
    (workflow as any).env = mockEnv;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Deal Creation and Exclusivity Handling', () => {
    it('should create production deal record without exclusivity conflicts', async () => {
      // Mock no existing exclusivity
      mockDb.mockResolvedValueOnce([]); // exclusivity check
      mockDb.mockResolvedValueOnce(undefined); // create deal

      const result = await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('create-production-deal', expect.any(Function));
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, production_company_id, exclusivity_expires_at'),
        [mockEvent.params.pitchId]
      );
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO production_deals'),
        expect.arrayContaining([
          'mock-uuid-123',
          'workflow-123',
          'prod_123',
          'user_456',
          'creator_111',
          'pitch_789',
          'option',
          'INTEREST'
        ])
      );
    });

    it('should handle existing exclusivity and waitlist new deal', async () => {
      // Mock existing exclusivity
      mockDb.mockResolvedValueOnce([{
        id: 'existing-deal',
        production_company_id: 'other_prod',
        exclusivity_expires_at: new Date(Date.now() + 86400000).toISOString() // 1 day from now
      }]);
      mockDb.mockResolvedValueOnce(undefined); // create deal
      mockDb.mockResolvedValueOnce(undefined); // update status after wait

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('create-production-deal', expect.any(Function));
      expect(mockStep.sleep).toHaveBeenCalledWith('wait-for-exclusivity', expect.any(Number));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_interest',
          data: expect.objectContaining({
            isWaitlisted: true,
            currentExclusiveCompany: 'other_prod'
          })
        })
      );
    });

    it('should handle expired exclusivity immediately', async () => {
      // Mock expired exclusivity
      mockDb.mockResolvedValueOnce([{
        id: 'existing-deal',
        production_company_id: 'other_prod',
        exclusivity_expires_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }]);
      mockDb.mockResolvedValueOnce(undefined); // create deal

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.sleep).not.toHaveBeenCalled();
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_interest',
          data: expect.objectContaining({
            isWaitlisted: false
          })
        })
      );
    });
  });

  describe('Production Company Verification', () => {
    it('should verify production company successfully', async () => {
      mockDb
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce(undefined) // create deal
        .mockResolvedValueOnce([{ // company verification
          company_name: 'Test Productions',
          verification_status: 'verified',
          production_history: 5,
          budget_range: '1M-10M',
          active_projects_count: 3
        }]);

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('verify-production-company', expect.any(Function));
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockEvent.params.productionCompanyId]
      );
    });

    it('should reject unverified production company', async () => {
      mockDb
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce(undefined) // create deal
        .mockResolvedValueOnce([{ // unverified company
          company_name: 'Test Productions',
          verification_status: 'pending',
          production_history: 0,
          budget_range: 'unknown',
          active_projects_count: 0
        }])
        .mockResolvedValueOnce(undefined); // update deal status

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('verification failed');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'verification_failed',
          recipientId: mockEvent.params.productionCompanyUserId
        })
      );
    });

    it('should reject company at capacity', async () => {
      mockDb
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce(undefined) // create deal
        .mockResolvedValueOnce([{ // company at capacity
          company_name: 'Busy Productions',
          verification_status: 'verified',
          production_history: 10,
          budget_range: '10M+',
          active_projects_count: 10
        }])
        .mockResolvedValueOnce(undefined); // update deal status

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('verification failed');
    });

    it('should handle company not found', async () => {
      mockDb
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce(undefined) // create deal
        .mockResolvedValueOnce([]); // company not found

      await expect(workflow.run(mockEvent, mockStep)).rejects.toThrow('Production company not found');
    });
  });

  describe('Creator Interest Response Flow', () => {
    beforeEach(() => {
      // Setup successful verification by default
      mockDb
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce(undefined) // create deal
        .mockResolvedValueOnce([{ // verified company
          company_name: 'Test Productions',
          verification_status: 'verified',
          production_history: 5,
          budget_range: '1M-10M',
          active_projects_count: 3
        }]);
    });

    it('should handle creator interest approval', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          decision: 'interested',
          preferredMeetingTimes: ['2024-01-15T10:00:00Z', '2024-01-16T14:00:00Z'],
          message: 'Looks promising'
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update deal status

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-creator-interest-response',
        { timeout: '5 days' }
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'meeting_scheduled',
          recipientId: mockEvent.params.productionCompanyUserId,
          data: expect.objectContaining({
            proposedTimes: ['2024-01-15T10:00:00Z', '2024-01-16T14:00:00Z'],
            meetingLink: expect.stringContaining('meetings/')
          })
        })
      );
    });

    it('should handle creator rejection', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          decision: 'not_interested',
          message: 'Not a good fit for this project'
        }
      });

      mockDb.mockResolvedValueOnce(undefined); // update deal status

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('did not proceed to meeting');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'interest_declined',
          recipientId: mockEvent.params.productionCompanyUserId,
          data: expect.objectContaining({
            message: 'Not a good fit for this project'
          })
        })
      );
    });

    it('should handle creator waitlist decision with later activation', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({
          payload: {
            decision: 'waitlist',
            message: 'Will consider after current project'
          }
        })
        .mockResolvedValueOnce({
          payload: {
            activate: true
          }
        });

      mockDb
        .mockResolvedValueOnce(undefined) // update to waitlist
        .mockResolvedValueOnce(undefined); // update to meeting scheduled

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-waitlist-activation',
        { timeout: '30 days' }
      );
    });

    it('should handle creator response timeout', async () => {
      mockStep.waitForEvent.mockResolvedValueOnce(null); // timeout

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Creator timeout');
    });

    it('should handle waitlist timeout', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({
          payload: { decision: 'waitlist' }
        })
        .mockResolvedValueOnce(null); // waitlist timeout

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('did not proceed to meeting');
    });
  });

  describe('Meeting and Evaluation Process', () => {
    beforeEach(() => {
      // Setup successful flow to meeting stage
      mockDb
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce(undefined) // create deal
        .mockResolvedValueOnce([{ // verified company
          verification_status: 'verified',
          active_projects_count: 3
        }])
        .mockResolvedValueOnce(undefined); // update to meeting scheduled

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: { decision: 'interested' }
      });
    });

    it('should proceed after successful meeting', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } }) // creator interest
        .mockResolvedValueOnce({
          payload: {
            outcome: 'proceed',
            notes: 'Great chemistry, excited to move forward'
          }
        });

      mockDb.mockResolvedValueOnce(undefined); // update status

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-meeting-outcome',
        { timeout: '7 days' }
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal_requested',
          recipientId: mockEvent.params.productionCompanyUserId,
          data: expect.objectContaining({
            deadline: expect.any(String)
          })
        })
      );
    });

    it('should handle meeting pass decision', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({
          payload: {
            outcome: 'pass',
            notes: 'Creative differences'
          }
        });

      mockDb.mockResolvedValueOnce(undefined); // update status

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('did not proceed to proposal');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_passed',
          recipientId: mockEvent.params.creatorId,
          data: expect.objectContaining({
            notes: 'Creative differences'
          })
        })
      );
    });

    it('should handle follow-up meeting requirement', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({
          payload: {
            outcome: 'need_more_info',
            nextMeetingDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
            notes: 'Need to discuss budget in more detail'
          }
        })
        .mockResolvedValueOnce({
          payload: {
            outcome: 'proceed',
            notes: 'Budget concerns addressed'
          }
        });

      mockDb.mockResolvedValueOnce(undefined); // update status

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.sleep).toHaveBeenCalledWith(
        'wait-for-follow-up-meeting',
        expect.any(Number)
      );
      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-follow-up-meeting-outcome',
        { timeout: '7 days' }
      );
    });

    it('should handle meeting timeout', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce(null); // meeting timeout

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Meeting timeout');
    });
  });

  describe('Proposal Submission and Review', () => {
    beforeEach(() => {
      // Setup successful flow to proposal stage
      mockDb
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce(undefined) // create deal
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 3 }])
        .mockResolvedValueOnce(undefined) // update to meeting scheduled
        .mockResolvedValueOnce(undefined); // update to awaiting proposal

      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } });
    });

    it('should process valid proposal submission', async () => {
      const proposalData = {
        proposalDocumentKey: 'proposals/deal-123/document.pdf',
        terms: {
          budget: 2000000,
          timeline: '18 months',
          rightsStructure: 'Option with first-look deal',
          distributionTerms: 'Theatrical + Streaming',
          backendPoints: 5
        },
        submittedAt: new Date().toISOString()
      };

      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ payload: proposalData });

      mockDb
        .mockResolvedValueOnce(undefined) // update to proposal submitted
        .mockResolvedValueOnce(undefined); // grant exclusivity

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-proposal-submission',
        { timeout: '14 days' }
      );
      expect(mockEnv.DOCUMENTS.put).toHaveBeenCalledWith(
        'proposals/mock-uuid-123/proposal.json',
        JSON.stringify(proposalData)
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal_ready_for_review',
          recipientId: mockEvent.params.creatorId,
          data: expect.objectContaining({
            proposalKey: proposalData.proposalDocumentKey,
            terms: proposalData.terms
          })
        })
      );
    });

    it('should handle proposal timeout', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce(null); // proposal timeout

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Proposal timeout');
    });

    it('should handle proposal rejection', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            proposalDocumentKey: 'test.pdf',
            terms: { budget: 1000000 }
          }
        })
        .mockResolvedValueOnce({
          payload: {
            decision: 'reject',
            message: 'Budget too low for scope'
          }
        });

      mockDb
        .mockResolvedValueOnce(undefined) // update to proposal submitted
        .mockResolvedValueOnce(undefined) // grant exclusivity
        .mockResolvedValueOnce(undefined) // update to rejected
        .mockResolvedValueOnce(undefined); // release exclusivity

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Negotiation failed');
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal_rejected',
          data: expect.objectContaining({
            message: 'Budget too low for scope'
          })
        })
      );
    });

    it('should handle counter proposal negotiation', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            proposalDocumentKey: 'test.pdf',
            terms: { budget: 1000000, timeline: '12 months' }
          }
        })
        .mockResolvedValueOnce({
          payload: {
            decision: 'counter',
            counterTerms: { budget: 1500000, timeline: '18 months' },
            message: 'Need more budget and time'
          }
        })
        .mockResolvedValueOnce({
          payload: { accepted: true }
        });

      mockDb
        .mockResolvedValueOnce(undefined) // update to proposal submitted
        .mockResolvedValueOnce(undefined) // grant exclusivity
        .mockResolvedValueOnce(undefined) // update to negotiation
        .mockResolvedValueOnce(undefined); // update to terms agreed

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-counter-response',
        { timeout: '3 days' }
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'counter_proposal',
          data: expect.objectContaining({
            counterTerms: { budget: 1500000, timeline: '18 months' }
          })
        })
      );
    });
  });

  describe('Contract Generation and Execution', () => {
    beforeEach(() => {
      // Setup successful flow to contract stage
      const successfulFlow = [
        [], // no exclusivity
        undefined, // create deal
        [{ verification_status: 'verified', active_projects_count: 3 }], // verify company
        undefined, // update to meeting scheduled
        undefined, // update to awaiting proposal
        undefined, // update to proposal submitted
        undefined, // grant exclusivity
        undefined // update to terms agreed
      ];
      
      mockDb
        .mockResolvedValueOnce(successfulFlow[0])
        .mockResolvedValueOnce(successfulFlow[1])
        .mockResolvedValueOnce(successfulFlow[2])
        .mockResolvedValueOnce(successfulFlow[3])
        .mockResolvedValueOnce(successfulFlow[4])
        .mockResolvedValueOnce(successfulFlow[5])
        .mockResolvedValueOnce(successfulFlow[6])
        .mockResolvedValueOnce(successfulFlow[7]);

      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            proposalDocumentKey: 'test.pdf',
            terms: { budget: 1000000, timeline: '12 months' }
          }
        })
        .mockResolvedValueOnce({ payload: { decision: 'accept' } });
    });

    it('should generate contract successfully', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            terms: { budget: 1000000, timeline: '12 months' }
          }
        })
        .mockResolvedValueOnce({ payload: { decision: 'accept' } })
        .mockResolvedValueOnce({
          payload: {
            signedDocumentKey: 'contracts/deal-123/signed.pdf',
            signedAt: new Date().toISOString()
          }
        });

      mockDb.mockResolvedValueOnce(undefined); // update to contract drafting

      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('generate-contract', expect.any(Function));
      expect(mockEnv.DOCUMENTS.put).toHaveBeenCalledWith(
        'contracts/mock-uuid-123/production-agreement.json',
        expect.stringContaining('mock-uuid-123')
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'contract_ready',
          recipientId: mockEvent.params.productionCompanyUserId
        })
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'contract_ready',
          recipientId: mockEvent.params.creatorId
        })
      );
    });

    it('should handle contract signing timeout', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            terms: { budget: 1000000 }
          }
        })
        .mockResolvedValueOnce({ payload: { decision: 'accept' } })
        .mockResolvedValueOnce(null); // contract timeout

      mockDb
        .mockResolvedValueOnce(undefined) // update to contract drafting
        .mockResolvedValueOnce(undefined) // update to expired
        .mockResolvedValueOnce(undefined); // release exclusivity

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Contract not signed in time');
    });
  });

  describe('Production Activation and Monitoring', () => {
    beforeEach(() => {
      // Setup successful flow to production activation
      mockDb
        .mockResolvedValue(undefined) // default response for all DB operations
        .mockResolvedValueOnce([]) // no exclusivity
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 3 }]); // verify company

      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            terms: { budget: 1000000, timeline: '12 months' }
          }
        })
        .mockResolvedValueOnce({ payload: { decision: 'accept' } })
        .mockResolvedValueOnce({
          payload: {
            signedDocumentKey: 'contracts/deal-123/signed.pdf',
            signedAt: new Date().toISOString()
          }
        });
    });

    it('should activate production successfully', async () => {
      await workflow.run(mockEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('activate-production', expect.any(Function));
      
      // Verify pitch update
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pitches'),
        [mockEvent.params.productionCompanyId, mockEvent.params.pitchId]
      );
      
      // Verify production tracking creation
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO production_tracking'),
        expect.arrayContaining([
          'mock-uuid-123',
          'mock-uuid-123', // deal ID
          mockEvent.params.pitchId,
          mockEvent.params.productionCompanyId,
          'pre_production'
        ])
      );

      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_started',
          recipientId: mockEvent.params.creatorId
        })
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_activated',
          recipientId: mockEvent.params.productionCompanyUserId
        })
      );
    });

    it('should handle production completion', async () => {
      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            terms: { budget: 1000000 }
          }
        })
        .mockResolvedValueOnce({ payload: { decision: 'accept' } })
        .mockResolvedValueOnce({
          payload: {
            signedDocumentKey: 'contracts/deal-123/signed.pdf',
            signedAt: new Date().toISOString()
          }
        })
        .mockResolvedValueOnce({
          payload: {
            completedAt: new Date().toISOString()
          }
        });

      const result = await workflow.run(mockEvent, mockStep);

      expect(result.success).toBe(true);
      expect(result.dealId).toBe('mock-uuid-123');
      expect(result.completedAt).toBeDefined();
      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-production-complete',
        { timeout: '365 days' }
      );
    });
  });

  describe('Helper Methods and Error Handling', () => {
    it('should update deal status correctly', async () => {
      const workflow = new ProductionDealWorkflow();
      (workflow as any).env = mockEnv;
      
      await (workflow as any).updateDealStatus('deal-123', 'IN_PROGRESS');

      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE production_deals'),
        ['IN_PROGRESS', 'deal-123']
      );
    });

    it('should handle timeout notifications', async () => {
      const workflow = new ProductionDealWorkflow();
      (workflow as any).env = mockEnv;
      
      mockDb.mockResolvedValueOnce([{
        production_company_user_id: 'user_456',
        creator_id: 'creator_111'
      }]);

      await (workflow as any).handleTimeout('deal-123', 'Test timeout');

      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledTimes(2);
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deal_timeout',
          recipientId: 'user_456',
          data: { dealId: 'deal-123', reason: 'Test timeout' }
        })
      );
    });

    it('should release exclusivity and notify waitlisted companies', async () => {
      const workflow = new ProductionDealWorkflow();
      (workflow as any).env = mockEnv;
      
      mockDb
        .mockResolvedValueOnce(undefined) // release exclusivity
        .mockResolvedValueOnce([{ pitch_id: 'pitch_789' }]) // get pitch
        .mockResolvedValueOnce([{ // get waitlisted
          id: 'waitlisted-deal',
          production_company_user_id: 'waitlisted_user'
        }])
        .mockResolvedValueOnce(undefined); // update waitlisted status

      await (workflow as any).releaseExclusivity('deal-123');

      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waitlist_activated',
          recipientId: 'waitlisted_user'
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockDb.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(workflow.run(mockEvent, mockStep)).rejects.toThrow('Database connection failed');
    });

    it('should handle notification queue failures', async () => {
      mockEnv.NOTIFICATION_QUEUE.send.mockRejectedValueOnce(new Error('Queue service unavailable'));
      mockDb.mockResolvedValue(undefined);

      // Should still proceed despite notification failure
      await expect(workflow.run(mockEvent, mockStep)).resolves.toBeDefined();
    });
  });

  describe('Concurrent Workflow Scenarios', () => {
    it('should handle multiple companies expressing interest simultaneously', async () => {
      const event1 = {
        params: { ...mockEvent.params, productionCompanyId: 'prod_1', productionCompanyUserId: 'user_1' }
      };
      const event2 = {
        params: { ...mockEvent.params, productionCompanyId: 'prod_2', productionCompanyUserId: 'user_2' }
      };

      // First company gets exclusivity
      mockDb
        .mockResolvedValueOnce([]) // no initial exclusivity for company 1
        .mockResolvedValueOnce(undefined) // create deal 1
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 3 }])
        .mockResolvedValueOnce([{ // company 2 sees existing exclusivity
          id: 'deal_1',
          production_company_id: 'prod_1',
          exclusivity_expires_at: new Date(Date.now() + 86400000).toISOString()
        }])
        .mockResolvedValueOnce(undefined); // create deal 2 (waitlisted)

      const workflow1 = new ProductionDealWorkflow();
      (workflow1 as any).env = mockEnv;
      
      const workflow2 = new ProductionDealWorkflow();
      (workflow2 as any).env = mockEnv;

      await workflow1.run(event1, mockStep);
      await workflow2.run(event2, mockStep);

      // Verify second company was notified about waitlist
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_interest',
          data: expect.objectContaining({
            isWaitlisted: true,
            currentExclusiveCompany: 'prod_1'
          })
        })
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long timelines', async () => {
      const longTimelineEvent = {
        params: {
          ...mockEvent.params,
          proposedTimeline: '60 months' // 5 years
        }
      };

      mockDb
        .mockResolvedValue(undefined)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 3 }]);

      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({ 
          payload: { 
            terms: { budget: 10000000, timeline: '60 months' }
          }
        })
        .mockResolvedValueOnce({ payload: { decision: 'accept' } })
        .mockResolvedValueOnce({
          payload: { signedDocumentKey: 'test.pdf', signedAt: new Date().toISOString() }
        });

      const result = await workflow.run(longTimelineEvent, mockStep);

      expect(result.success).toBe(true);
      expect(result.finalTerms.timeline).toBe('60 months');
    });

    it('should handle minimum budget scenarios', async () => {
      const lowBudgetEvent = {
        params: {
          ...mockEvent.params,
          proposedBudget: 50000 // Very low budget
        }
      };

      mockDb
        .mockResolvedValue(undefined)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 3 }]);

      await workflow.run(lowBudgetEvent, mockStep);

      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_interest',
          data: expect.objectContaining({
            proposedBudget: 50000
          })
        })
      );
    });

    it('should handle missing optional parameters', async () => {
      const minimalEvent = {
        params: {
          productionCompanyId: 'prod_123',
          productionCompanyUserId: 'user_456',
          pitchId: 'pitch_789',
          creatorId: 'creator_111',
          interestType: 'option' as const
          // No message, budget, or timeline
        }
      };

      mockDb
        .mockResolvedValue(undefined)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 3 }]);

      const result = await workflow.run(minimalEvent, mockStep);

      expect(result).toBeDefined();
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'production_interest',
          data: expect.objectContaining({
            productionCompanyId: 'prod_123',
            pitchId: 'pitch_789',
            interestType: 'option'
          })
        })
      );
    });
  });
});