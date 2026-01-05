import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InvestmentDealWorkflow } from '../investment-deal-workflow';
import { ProductionDealWorkflow } from '../production-deal-cf-workflow';
import { NDAWorkflow } from '../nda-workflow';

// ============================================================================
// Integration Test Setup - Testing Complete Workflow Lifecycles
// ============================================================================

const mockDb = vi.fn();
const mockNeon = vi.fn(() => mockDb);

vi.mock('@neondatabase/serverless', () => ({
  neon: mockNeon
}));

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`)
  }
});

// Shared mock environment for all workflows
const createMockEnv = () => ({
  HYPERDRIVE: { connectionString: 'postgresql://test@localhost/test' },
  WORKFLOW_INSTANCE_ID: `workflow-${Date.now()}`,
  NOTIFICATION_QUEUE: { send: vi.fn() },
  DOCUMENTS: { put: vi.fn(), get: vi.fn() },
  CONTRACTS: { put: vi.fn(), get: vi.fn() },
  NDA_TEMPLATES: { get: vi.fn() },
  STRIPE_SECRET_KEY: 'sk_test_123',
  DEAL_CACHE: { put: vi.fn(), get: vi.fn() }
});

describe('Workflow Integration Tests', () => {
  let mockStep: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockStep = {
      do: vi.fn().mockImplementation((name, fn) => fn()),
      waitForEvent: vi.fn(),
      sleep: vi.fn()
    };

    mockEnv = createMockEnv();
    mockDb.mockResolvedValue(undefined); // Default successful DB operation
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete Investment Deal Lifecycle', () => {
    it('should complete full investment workflow from qualification to fund release', async () => {
      // ========================================================================
      // Setup: Investment Deal Parameters
      // ========================================================================
      const investmentEvent = {
        params: {
          investorId: 'investor_integration_test',
          pitchId: 'pitch_integration_test',
          amount: 250000,
          investorType: 'accredited',
          investorEmail: 'investor@integration.test',
          creatorId: 'creator_integration_test',
          creatorEmail: 'creator@integration.test',
          pitchTitle: 'Integration Test Movie',
          minimumInvestment: 50000,
          maximumInvestment: 500000,
          targetRaise: 1000000
        }
      };

      // ========================================================================
      // Mock Workflow Event Sequence
      // ========================================================================
      mockStep.waitForEvent
        .mockResolvedValueOnce({ // Creator approval
          decision: 'approve',
          notes: 'Great investor profile'
        })
        .mockResolvedValueOnce({ // Term sheet signature
          signed: true,
          signedAt: new Date().toISOString(),
          signedDocumentKey: 'term-sheets/signed.pdf'
        })
        .mockResolvedValueOnce({ // Payment webhook
          type: 'payment.succeeded',
          paymentId: 'pay_integration_test',
          amount: 250000,
          metadata: { dealId: 'deal_integration_test' }
        });

      // Mock funding goal check
      mockStep.do.mockImplementation((name, fn) => {
        if (name === 'check-funding-goal') {
          return {
            totalRaised: 1000000,
            goalMet: true,
            percentageRaised: 100,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          };
        }
        return fn();
      });

      // ========================================================================
      // Execute Workflow
      // ========================================================================
      const workflow = new InvestmentDealWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(investmentEvent, mockStep);

      // ========================================================================
      // Verify Complete Lifecycle
      // ========================================================================
      expect(result.success).toBe(true);
      expect(result.status).toBe('FUNDS_RELEASED');
      expect(result.amount).toBe(250000);

      // Verify all workflow steps were executed
      const expectedSteps = [
        'qualify-investor',
        'store-deal',
        'notify-creator',
        'generate-term-sheet',
        'process-payment-intent',
        'check-funding-goal',
        'release-funds-to-creator',
        'finalize-investment'
      ];

      expectedSteps.forEach(step => {
        expect(mockStep.do).toHaveBeenCalledWith(step, expect.any(Function));
      });

      // Verify notifications were sent at key stages
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'creator_approval_request'
        })
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'term_sheet_ready'
        })
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'investment_completed'
        })
      );
    });

    it('should handle investment workflow with partial funding and deadline extension', async () => {
      const investmentEvent = {
        params: {
          investorId: 'investor_partial',
          pitchId: 'pitch_partial',
          amount: 100000,
          investorType: 'accredited',
          investorEmail: 'investor@partial.test',
          creatorId: 'creator_partial',
          creatorEmail: 'creator@partial.test',
          pitchTitle: 'Partial Funding Test',
          minimumInvestment: 50000,
          maximumInvestment: 300000,
          targetRaise: 1000000
        }
      };

      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve' })
        .mockResolvedValueOnce({ signed: true, signedAt: new Date().toISOString() })
        .mockResolvedValueOnce({ type: 'payment.succeeded', amount: 100000 });

      // Mock partial funding scenario
      mockStep.do.mockImplementation((name, fn) => {
        if (name === 'check-funding-goal') {
          return {
            totalRaised: 600000,
            goalMet: false,
            percentageRaised: 60,
            deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days remaining
          };
        }
        if (name === 'check-deadline-extension') {
          return { extensionGranted: true, newDeadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) };
        }
        return fn();
      });

      const workflow = new InvestmentDealWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(investmentEvent, mockStep);

      expect(result.success).toBe(true);
      expect(result.status).toBe('ESCROW'); // Funds held in escrow
      
      // Should trigger deadline extension process
      expect(mockStep.do).toHaveBeenCalledWith('check-deadline-extension', expect.any(Function));
    });
  });

  describe('Complete Production Deal Lifecycle', () => {
    it('should complete full production workflow from interest to production start', async () => {
      // ========================================================================
      // Setup: Production Deal Parameters
      // ========================================================================
      const productionEvent = {
        params: {
          productionCompanyId: 'prod_integration_test',
          productionCompanyUserId: 'prod_user_integration',
          pitchId: 'pitch_production_test',
          creatorId: 'creator_production_test',
          interestType: 'option' as const,
          message: 'Very interested in optioning this project',
          proposedBudget: 2000000,
          proposedTimeline: '18 months'
        }
      };

      // ========================================================================
      // Mock Database Responses
      // ========================================================================
      mockDb
        .mockResolvedValueOnce([]) // No existing exclusivity
        .mockResolvedValueOnce(undefined) // Create deal
        .mockResolvedValueOnce([{ // Verified production company
          company_name: 'Test Productions Inc',
          verification_status: 'verified',
          production_history: 8,
          budget_range: '1M-10M',
          active_projects_count: 4
        }])
        .mockResolvedValue(undefined); // All other DB operations

      // ========================================================================
      // Mock Event Sequence
      // ========================================================================
      mockStep.waitForEvent
        .mockResolvedValueOnce({ // Creator interest response
          payload: {
            decision: 'interested',
            preferredMeetingTimes: ['2024-02-15T10:00:00Z'],
            message: 'Looks like a great fit'
          }
        })
        .mockResolvedValueOnce({ // Meeting outcome
          payload: {
            outcome: 'proceed',
            notes: 'Excellent meeting, aligned on vision'
          }
        })
        .mockResolvedValueOnce({ // Proposal submission
          payload: {
            proposalDocumentKey: 'proposals/integration-test/proposal.pdf',
            terms: {
              budget: 2500000,
              timeline: '20 months',
              rightsStructure: 'Option with first-look deal',
              distributionTerms: 'Theatrical + Streaming',
              backendPoints: 7.5
            },
            submittedAt: new Date().toISOString()
          }
        })
        .mockResolvedValueOnce({ // Proposal response
          payload: {
            decision: 'accept',
            message: 'Terms look great'
          }
        })
        .mockResolvedValueOnce({ // Contract signing
          payload: {
            signedDocumentKey: 'contracts/integration-test/signed.pdf',
            signedAt: new Date().toISOString()
          }
        });

      // ========================================================================
      // Execute Workflow
      // ========================================================================
      const workflow = new ProductionDealWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(productionEvent, mockStep);

      // ========================================================================
      // Verify Complete Lifecycle
      // ========================================================================
      expect(result.success).toBe(true);
      expect(result.finalTerms).toEqual(
        expect.objectContaining({
          budget: 2500000,
          timeline: '20 months',
          rightsStructure: 'Option with first-look deal'
        })
      );

      // Verify key workflow steps
      const expectedSteps = [
        'create-production-deal',
        'verify-production-company',
        'process-creator-response',
        'process-meeting-outcome',
        'notify-creator-of-proposal',
        'negotiate-terms',
        'generate-contract',
        'activate-production'
      ];

      expectedSteps.forEach(step => {
        expect(mockStep.do).toHaveBeenCalledWith(step, expect.any(Function));
      });

      // Verify exclusivity was granted
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('exclusivity_granted_at = NOW()'),
        expect.any(Array)
      );

      // Verify production activation
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pitches'),
        expect.arrayContaining(['prod_integration_test', 'pitch_production_test'])
      );
    });

    it('should handle production workflow with counter-negotiation', async () => {
      const productionEvent = {
        params: {
          productionCompanyId: 'prod_negotiation',
          productionCompanyUserId: 'prod_user_negotiation',
          pitchId: 'pitch_negotiation',
          creatorId: 'creator_negotiation',
          interestType: 'purchase' as const,
          proposedBudget: 1000000
        }
      };

      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 2 }])
        .mockResolvedValue(undefined);

      mockStep.waitForEvent
        .mockResolvedValueOnce({ payload: { decision: 'interested' } })
        .mockResolvedValueOnce({ payload: { outcome: 'proceed' } })
        .mockResolvedValueOnce({
          payload: {
            proposalDocumentKey: 'test.pdf',
            terms: { budget: 1000000, timeline: '12 months' }
          }
        })
        .mockResolvedValueOnce({ // Counter proposal
          payload: {
            decision: 'counter',
            counterTerms: { budget: 1500000, timeline: '18 months' },
            message: 'Need higher budget and more time'
          }
        })
        .mockResolvedValueOnce({ // Production company accepts counter
          payload: { accepted: true }
        })
        .mockResolvedValueOnce({
          payload: { signedDocumentKey: 'signed.pdf', signedAt: new Date().toISOString() }
        });

      const workflow = new ProductionDealWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(productionEvent, mockStep);

      expect(result.success).toBe(true);
      expect(result.finalTerms).toEqual(
        expect.objectContaining({
          budget: 1500000,
          timeline: '18 months'
        })
      );

      // Verify counter-negotiation steps
      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-counter-response',
        { timeout: '3 days' }
      );
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'counter_proposal'
        })
      );
    });
  });

  describe('Complete NDA Lifecycle', () => {
    it('should complete full NDA workflow from auto-approval to activation', async () => {
      // ========================================================================
      // Setup: Low-Risk NDA Parameters (Auto-Approved)
      // ========================================================================
      const ndaEvent = {
        params: {
          requesterId: 'requester_auto_approved',
          requesterType: 'investor' as const,
          requesterEmail: 'verified@investor.test',
          requesterName: 'Verified Investor LLC',
          creatorId: 'creator_nda_test',
          pitchId: 'pitch_nda_test',
          templateId: 'standard_nda_v2',
          durationMonths: 24
        }
      };

      // ========================================================================
      // Mock Database Responses for Low-Risk Assessment
      // ========================================================================
      mockDb
        .mockResolvedValueOnce([]) // No existing NDA
        .mockResolvedValueOnce(undefined) // Create NDA
        .mockResolvedValueOnce([{ // Highly verified user
          email_verified: true,
          phone_verified: true,
          identity_verified: true,
          created_at: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 2 years old
          trust_score: 92
        }])
        .mockResolvedValueOnce([]) // No prior NDA issues
        .mockResolvedValueOnce(undefined) // Update risk assessment
        .mockResolvedValueOnce([{ name: 'Test Creator', email: 'creator@test.com' }]) // getUserName
        .mockResolvedValueOnce(undefined) // Update to PENDING
        .mockResolvedValueOnce(undefined) // Update envelope ID
        .mockResolvedValueOnce([{ title: 'Test Pitch Title' }]) // getPitchTitle
        .mockResolvedValueOnce(undefined) // Update to SIGNED
        .mockResolvedValueOnce(undefined) // Update to ACTIVE
        .mockResolvedValueOnce(undefined); // Grant pitch access

      // Mock template
      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'standard',
        clauses: ['confidentiality', 'non-disclosure', 'term_limit'],
        complexity: 'low'
      });

      // ========================================================================
      // Mock Event Sequence - Direct to Signature (Auto-Approved)
      // ========================================================================
      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: {
          envelopeId: 'envelope_auto_approved',
          status: 'completed',
          signedAt: new Date().toISOString()
        }
      });

      // ========================================================================
      // Execute Workflow
      // ========================================================================
      const workflow = new NDAWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(ndaEvent, mockStep);

      // ========================================================================
      // Verify Auto-Approved Lifecycle
      // ========================================================================
      expect(result.success).toBe(true);
      expect(result.riskLevel).toBe('low');
      expect(result.approvalMethod).toBe('auto_approved');
      expect(result.durationMonths).toBe(24);

      // Verify risk assessment was performed
      expect(mockStep.do).toHaveBeenCalledWith('assess-risk', expect.any(Function), {
        retries: { limit: 2, backoff: 'linear', delay: 1000 }
      });

      // Verify no manual review was required
      expect(mockStep.do).not.toHaveBeenCalledWith('request-legal-review', expect.any(Function));
      expect(mockStep.do).not.toHaveBeenCalledWith('request-creator-review', expect.any(Function));

      // Verify document generation and signature
      expect(mockStep.do).toHaveBeenCalledWith('generate-nda-document', expect.any(Function));
      expect(mockStep.do).toHaveBeenCalledWith('send-for-signature', expect.any(Function));
      expect(mockStep.do).toHaveBeenCalledWith('activate-nda', expect.any(Function));

      // Verify access was granted
      expect(mockDb).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pitch_access'),
        expect.arrayContaining([
          'requester_auto_approved',
          'pitch_nda_test',
          'nda_protected'
        ])
      );

      // Verify expiration monitoring setup
      expect(mockStep.do).toHaveBeenCalledWith('schedule-expiration-monitoring', expect.any(Function));
    });

    it('should complete NDA workflow with legal review approval', async () => {
      // ========================================================================
      // Setup: High-Risk NDA Parameters (Requires Legal Review)
      // ========================================================================
      const ndaEvent = {
        params: {
          requesterId: 'requester_high_risk',
          requesterType: 'production' as const,
          requesterEmail: 'newuser@startup.com',
          requesterName: 'New Production Startup',
          creatorId: 'creator_legal_review',
          pitchId: 'pitch_legal_review',
          templateId: 'custom_nda_complex',
          customTerms: {
            extendedScope: 'Broader confidentiality requirements',
            customPenalties: 'Enhanced liquidated damages',
            additionalRestrictions: 'Multiple custom clauses'
          },
          durationMonths: 48,
          territorialRestrictions: ['Worldwide']
        }
      };

      // ========================================================================
      // Mock High-Risk Assessment
      // ========================================================================
      mockDb
        .mockResolvedValueOnce([]) // No existing NDA
        .mockResolvedValueOnce(undefined) // Create NDA
        .mockResolvedValueOnce([{ // High-risk user
          email_verified: true,
          phone_verified: false,
          identity_verified: false,
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days old
          trust_score: 35
        }])
        .mockResolvedValueOnce([]) // No prior history
        .mockResolvedValueOnce(undefined) // Update risk assessment
        .mockResolvedValueOnce(undefined) // Update to legal review
        .mockResolvedValueOnce([{ name: 'Creator Legal', email: 'creator@legal.com' }])
        .mockResolvedValueOnce(undefined) // Update to PENDING
        .mockResolvedValueOnce(undefined) // Update envelope ID
        .mockResolvedValueOnce([{ title: 'Legal Review Pitch' }])
        .mockResolvedValueOnce(undefined) // Update to SIGNED
        .mockResolvedValueOnce(undefined) // Update to ACTIVE
        .mockResolvedValueOnce(undefined); // Grant access

      // Mock complex template
      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({
        type: 'custom',
        complexity: 'very_high',
        requiresReview: true
      });

      // ========================================================================
      // Mock Event Sequence with Legal Review
      // ========================================================================
      mockStep.waitForEvent
        .mockResolvedValueOnce({ // Legal review approval
          payload: {
            decision: 'approve',
            reviewerId: 'legal_reviewer_integration',
            notes: 'Approved after review, acceptable risk'
          }
        })
        .mockResolvedValueOnce({ // Signature completion
          payload: {
            envelopeId: 'envelope_legal_approved',
            status: 'completed',
            signedAt: new Date().toISOString()
          }
        });

      // ========================================================================
      // Execute Workflow
      // ========================================================================
      const workflow = new NDAWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(ndaEvent, mockStep);

      // ========================================================================
      // Verify Legal Review Lifecycle
      // ========================================================================
      expect(result.success).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.approvalMethod).toBe('legal_approved');

      // Verify legal review was triggered
      expect(mockStep.do).toHaveBeenCalledWith('request-legal-review', expect.any(Function));
      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-legal-review',
        { timeout: '48 hours' }
      );

      // Verify legal team notification
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
  });

  describe('Cross-Workflow Integration Scenarios', () => {
    it('should handle NDA workflow triggering investment workflow', async () => {
      // ========================================================================
      // Phase 1: Complete NDA Workflow
      // ========================================================================
      const ndaEvent = {
        params: {
          requesterId: 'investor_cross_integration',
          requesterType: 'investor' as const,
          requesterEmail: 'investor@cross.test',
          requesterName: 'Cross Integration Investor',
          creatorId: 'creator_cross_test',
          pitchId: 'pitch_cross_test',
          templateId: 'standard_nda_v1',
          durationMonths: 24
        }
      };

      // Setup NDA workflow
      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{
          email_verified: true,
          phone_verified: true,
          identity_verified: true,
          created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          trust_score: 88
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ name: 'Cross Creator' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ title: 'Cross Test Pitch' }])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({ type: 'standard' });

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: { status: 'completed', signedAt: new Date().toISOString() }
      });

      const ndaWorkflow = new NDAWorkflow();
      (ndaWorkflow as any).env = mockEnv;

      const ndaResult = await ndaWorkflow.run(ndaEvent, mockStep);

      expect(ndaResult.success).toBe(true);

      // ========================================================================
      // Phase 2: Investment Workflow After NDA Access Granted
      // ========================================================================
      
      // Reset mocks for investment workflow
      vi.clearAllMocks();
      mockStep = {
        do: vi.fn().mockImplementation((name, fn) => fn()),
        waitForEvent: vi.fn(),
        sleep: vi.fn()
      };

      const investmentEvent = {
        params: {
          investorId: 'investor_cross_integration', // Same investor
          pitchId: 'pitch_cross_test', // Same pitch
          amount: 150000,
          investorType: 'accredited',
          investorEmail: 'investor@cross.test',
          creatorId: 'creator_cross_test',
          creatorEmail: 'creator@cross.test',
          pitchTitle: 'Cross Integration Test',
          minimumInvestment: 25000,
          maximumInvestment: 300000,
          targetRaise: 500000,
          ndaId: ndaResult.ndaId // Reference to completed NDA
        }
      };

      // Mock investment workflow events
      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve', notes: 'Already vetted through NDA process' })
        .mockResolvedValueOnce({ signed: true, signedAt: new Date().toISOString() })
        .mockResolvedValueOnce({ type: 'payment.succeeded', amount: 150000 });

      mockStep.do.mockImplementation((name, fn) => {
        if (name === 'check-funding-goal') {
          return { totalRaised: 500000, goalMet: true, percentageRaised: 100 };
        }
        if (name === 'verify-nda-access') {
          return { hasValidNDA: true, ndaId: ndaResult.ndaId };
        }
        return fn();
      });

      const investmentWorkflow = new InvestmentDealWorkflow();
      (investmentWorkflow as any).env = mockEnv;

      const investmentResult = await investmentWorkflow.run(investmentEvent, mockStep);

      expect(investmentResult.success).toBe(true);
      expect(investmentResult.status).toBe('FUNDS_RELEASED');

      // Verify NDA verification step was called
      expect(mockStep.do).toHaveBeenCalledWith('verify-nda-access', expect.any(Function));
    });

    it('should handle production deal with required NDA completion', async () => {
      // ========================================================================
      // Production company expresses interest but needs NDA first
      // ========================================================================
      const productionEvent = {
        params: {
          productionCompanyId: 'prod_nda_required',
          productionCompanyUserId: 'prod_user_nda',
          pitchId: 'pitch_nda_required',
          creatorId: 'creator_nda_required',
          interestType: 'option' as const,
          message: 'Interested but need to review confidential materials first'
        }
      };

      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 2 }]);

      // Production workflow should detect missing NDA
      mockStep.do.mockImplementation((name, fn) => {
        if (name === 'verify-nda-requirement') {
          return { requiresNDA: true, hasValidNDA: false };
        }
        return fn();
      });

      const productionWorkflow = new ProductionDealWorkflow();
      (productionWorkflow as any).env = mockEnv;

      // Should pause and require NDA completion first
      const productionResult = await productionWorkflow.run(productionEvent, mockStep);

      expect(mockStep.do).toHaveBeenCalledWith('verify-nda-requirement', expect.any(Function));
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'nda_required_before_access',
          recipientId: 'prod_user_nda'
        })
      );
    });
  });

  describe('Error Recovery and Compensation Scenarios', () => {
    it('should handle partial completion with compensation in investment workflow', async () => {
      const investmentEvent = {
        params: {
          investorId: 'investor_compensation',
          pitchId: 'pitch_compensation',
          amount: 200000,
          investorType: 'accredited',
          investorEmail: 'investor@compensation.test',
          creatorId: 'creator_compensation',
          creatorEmail: 'creator@compensation.test',
          pitchTitle: 'Compensation Test',
          minimumInvestment: 50000,
          maximumInvestment: 500000,
          targetRaise: 1000000
        }
      };

      // Mock successful flow until fund release fails
      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve' })
        .mockResolvedValueOnce({ signed: true, signedAt: new Date().toISOString() })
        .mockResolvedValueOnce({ type: 'payment.succeeded', amount: 200000 });

      mockStep.do.mockImplementation((name, fn) => {
        if (name === 'check-funding-goal') {
          return { totalRaised: 1000000, goalMet: true };
        }
        if (name === 'release-funds-to-creator') {
          throw new Error('Bank transfer failed - insufficient funds');
        }
        if (name === 'compensate-failed-transfer') {
          return { compensationId: 'comp_123', refundInitiated: true };
        }
        return fn();
      });

      const workflow = new InvestmentDealWorkflow();
      (workflow as any).env = mockEnv;

      await expect(workflow.run(investmentEvent, mockStep)).rejects.toThrow('Bank transfer failed');

      // Verify compensation was triggered
      expect(mockStep.do).toHaveBeenCalledWith('compensate-failed-transfer', expect.any(Function));
    });

    it('should handle timeout recovery in production workflow', async () => {
      const productionEvent = {
        params: {
          productionCompanyId: 'prod_timeout',
          productionCompanyUserId: 'prod_user_timeout',
          pitchId: 'pitch_timeout',
          creatorId: 'creator_timeout',
          interestType: 'purchase' as const
        }
      };

      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ verification_status: 'verified', active_projects_count: 1 }])
        .mockResolvedValueOnce([{
          production_company_user_id: 'prod_user_timeout',
          creator_id: 'creator_timeout'
        }]);

      // Mock creator response timeout
      mockStep.waitForEvent.mockResolvedValueOnce(null); // Timeout

      const workflow = new ProductionDealWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(productionEvent, mockStep);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Creator timeout');

      // Verify timeout handling
      expect(mockEnv.NOTIFICATION_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deal_timeout',
          data: expect.objectContaining({
            reason: 'Creator did not respond to interest'
          })
        })
      );
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle multiple concurrent workflow instances', async () => {
      const workflows = [];
      const events = [];

      // Create 5 concurrent investment workflows
      for (let i = 0; i < 5; i++) {
        const event = {
          params: {
            investorId: `investor_concurrent_${i}`,
            pitchId: `pitch_concurrent_${i}`,
            amount: 100000 + (i * 10000),
            investorType: 'accredited',
            investorEmail: `investor${i}@concurrent.test`,
            creatorId: `creator_concurrent_${i}`,
            creatorEmail: `creator${i}@concurrent.test`,
            pitchTitle: `Concurrent Test ${i}`,
            minimumInvestment: 50000,
            maximumInvestment: 300000,
            targetRaise: 500000
          }
        };

        const workflow = new InvestmentDealWorkflow();
        (workflow as any).env = { ...mockEnv, WORKFLOW_INSTANCE_ID: `workflow_${i}` };

        const mockStepInstance = {
          do: vi.fn().mockImplementation((name, fn) => {
            if (name === 'check-funding-goal') {
              return { totalRaised: 500000, goalMet: true };
            }
            return fn();
          }),
          waitForEvent: vi.fn()
            .mockResolvedValueOnce({ decision: 'approve' })
            .mockResolvedValueOnce({ signed: true, signedAt: new Date().toISOString() })
            .mockResolvedValueOnce({ type: 'payment.succeeded', amount: event.params.amount }),
          sleep: vi.fn()
        };

        workflows.push({ workflow, step: mockStepInstance, event });
      }

      // Execute all workflows concurrently
      const results = await Promise.all(
        workflows.map(({ workflow, step, event }) => workflow.run(event, step))
      );

      // Verify all workflows completed successfully
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.status).toBe('FUNDS_RELEASED');
        expect(result.amount).toBe(100000 + (index * 10000));
      });

      // Verify each workflow maintained its own state
      expect(new Set(results.map(r => r.dealId)).size).toBe(5); // All unique deal IDs
    });

    it('should handle workflow retry scenarios', async () => {
      const ndaEvent = {
        params: {
          requesterId: 'requester_retry',
          requesterType: 'investor' as const,
          requesterEmail: 'investor@retry.test',
          requesterName: 'Retry Test Investor',
          creatorId: 'creator_retry',
          pitchId: 'pitch_retry',
          templateId: 'standard_nda_v1'
        }
      };

      // Mock database failure on first attempt, success on retry
      let attemptCount = 0;
      mockDb.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Connection timeout');
        }
        return Promise.resolve(undefined);
      });

      // Reset for successful operations
      mockDb
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          email_verified: true,
          phone_verified: true,
          identity_verified: true,
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          trust_score: 85
        }])
        .mockResolvedValueOnce([])
        .mockResolvedValue(undefined);

      mockEnv.NDA_TEMPLATES.get.mockResolvedValueOnce({ type: 'standard' });

      mockStep.waitForEvent.mockResolvedValueOnce({
        payload: { status: 'completed', signedAt: new Date().toISOString() }
      });

      const workflow = new NDAWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(ndaEvent, mockStep);

      expect(result.success).toBe(true);
      // Verify retry mechanism worked
      expect(attemptCount).toBeGreaterThan(2);
    });
  });

  describe('Data Consistency and State Management', () => {
    it('should maintain consistent state across workflow transitions', async () => {
      const investmentEvent = {
        params: {
          investorId: 'investor_state_test',
          pitchId: 'pitch_state_test',
          amount: 150000,
          investorType: 'accredited',
          investorEmail: 'state@test.com',
          creatorId: 'creator_state_test',
          creatorEmail: 'creator@state.test',
          pitchTitle: 'State Consistency Test',
          minimumInvestment: 50000,
          maximumInvestment: 500000,
          targetRaise: 750000
        }
      };

      // Track state transitions
      const stateTransitions: string[] = [];

      mockStep.do.mockImplementation((name, fn) => {
        stateTransitions.push(name);
        
        if (name === 'store-deal') {
          return { id: 'deal_state_test', status: 'QUALIFIED' };
        }
        if (name === 'check-funding-goal') {
          return { totalRaised: 750000, goalMet: true };
        }
        
        return fn();
      });

      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve' })
        .mockResolvedValueOnce({ signed: true, signedAt: new Date().toISOString() })
        .mockResolvedValueOnce({ type: 'payment.succeeded', amount: 150000 });

      const workflow = new InvestmentDealWorkflow();
      (workflow as any).env = mockEnv;

      const result = await workflow.run(investmentEvent, mockStep);

      expect(result.success).toBe(true);

      // Verify expected state transition sequence
      const expectedTransitions = [
        'qualify-investor',
        'store-deal',
        'notify-creator',
        'generate-term-sheet',
        'process-payment-intent',
        'check-funding-goal',
        'release-funds-to-creator',
        'finalize-investment'
      ];

      expectedTransitions.forEach(transition => {
        expect(stateTransitions).toContain(transition);
      });

      // Verify transitions occurred in logical order
      expect(stateTransitions.indexOf('qualify-investor')).toBeLessThan(
        stateTransitions.indexOf('store-deal')
      );
      expect(stateTransitions.indexOf('store-deal')).toBeLessThan(
        stateTransitions.indexOf('notify-creator')
      );
      expect(stateTransitions.indexOf('process-payment-intent')).toBeLessThan(
        stateTransitions.indexOf('release-funds-to-creator')
      );
    });
  });
});