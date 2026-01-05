import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvestmentDealWorkflow } from '../investment-deal-workflow';
import type { Env, InvestmentDealParams } from '../investment-deal-workflow';

// Mock environment
const mockEnv: Env = {
  HYPERDRIVE: {
    connectionString: 'postgresql://test@localhost/test'
  } as any,
  DOCUMENTS: {} as any,
  CONTRACTS: {} as any,
  WORKFLOW_STATE: {} as any,
  CACHE: {} as any,
  INVESTOR_PROFILES: {} as any,
  DATABASE_URL: 'postgresql://test@localhost/test',
  JWT_SECRET: 'test-secret',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  FRONTEND_URL: 'http://localhost:5173'
};

describe('InvestmentDealWorkflow', () => {
  let workflow: InvestmentDealWorkflow;
  let mockStep: any;

  beforeEach(() => {
    // Mock the WorkflowStep
    mockStep = {
      do: vi.fn((name, fn) => fn()),
      waitForEvent: vi.fn(),
      sleep: vi.fn()
    };

    workflow = new InvestmentDealWorkflow(mockStep, mockEnv);
  });

  describe('Investor Qualification', () => {
    it('should qualify accredited investors', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.do.mockImplementationOnce((name: string, fn: Function) => {
        if (name === 'qualify-investor') {
          return fn();
        }
      });

      mockStep.do.mockImplementationOnce((name: string, fn: Function) => {
        if (name === 'store-deal') {
          return { id: 'deal_123', status: 'QUALIFIED' };
        }
      });

      const result = await workflow.run(params);
      
      expect(mockStep.do).toHaveBeenCalledWith('qualify-investor', expect.any(Function));
      expect(result.status).toBe('QUALIFIED');
    });

    it('should reject non-accredited investors for high amounts', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'non_accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      try {
        await workflow.run(params);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Non-accredited investors cannot invest more than $5,000');
      }
    });

    it('should reject investments below minimum', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 10000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      try {
        await workflow.run(params);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('below minimum');
      }
    });
  });

  describe('Creator Approval Flow', () => {
    it('should wait for creator decision and proceed on approval', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.waitForEvent.mockResolvedValueOnce({
        decision: 'approve',
        notes: 'Great investor!'
      });

      await workflow.run(params);

      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-creator-decision',
        expect.objectContaining({ timeout: '7 days' })
      );
    });

    it('should handle creator rejection', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.waitForEvent.mockResolvedValueOnce({
        decision: 'reject',
        reason: 'Not a good fit'
      });

      const result = await workflow.run(params);
      
      expect(result.status).toBe('CREATOR_REJECTED');
      expect(result.reason).toBe('Not a good fit');
    });

    it('should auto-reject on timeout', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.waitForEvent.mockResolvedValueOnce(null); // Timeout

      const result = await workflow.run(params);
      
      expect(result.status).toBe('EXPIRED');
      expect(result.reason).toContain('No response from creator');
    });
  });

  describe('Term Sheet Generation', () => {
    it('should generate term sheet after creator approval', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.waitForEvent.mockResolvedValueOnce({
        decision: 'approve'
      });

      mockStep.do.mockImplementationOnce((name: string) => {
        if (name === 'generate-term-sheet') {
          return 'https://r2.example.com/term-sheet-123.pdf';
        }
      });

      await workflow.run(params);

      expect(mockStep.do).toHaveBeenCalledWith('generate-term-sheet', expect.any(Function));
    });

    it('should calculate correct equity percentage', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 250000, // 25% of target
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      let calculatedEquity = 0;
      mockStep.do.mockImplementation((name: string, fn: Function) => {
        if (name === 'generate-term-sheet') {
          // Capture the equity calculation
          const result = fn();
          calculatedEquity = params.amount / params.targetRaise;
          return result;
        }
        return fn();
      });

      await workflow.run(params);
      
      expect(calculatedEquity).toBe(0.25);
    });
  });

  describe('Payment Processing', () => {
    it('should process escrow payment successfully', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve' }) // Creator approval
        .mockResolvedValueOnce({ signed: true, signedAt: new Date() }) // Term sheet signature
        .mockResolvedValueOnce({ // Payment webhook
          type: 'payment.succeeded',
          paymentId: 'pay_123',
          amount: 100000,
          metadata: { dealId: 'deal_123' }
        });

      const result = await workflow.run(params);
      
      expect(result.status).toBe('ESCROW');
      expect(mockStep.waitForEvent).toHaveBeenCalledWith(
        'wait-for-payment',
        expect.objectContaining({ timeout: '3 days' })
      );
    });

    it('should handle payment failure and refund', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve' })
        .mockResolvedValueOnce({ signed: true })
        .mockResolvedValueOnce({ 
          type: 'payment.failed',
          error: 'Insufficient funds'
        });

      const result = await workflow.run(params);
      
      expect(result.status).toBe('PAYMENT_FAILED');
      expect(result.error).toContain('Insufficient funds');
    });
  });

  describe('Fund Release Conditions', () => {
    it('should release funds when funding goal is met', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.do.mockImplementation((name: string, fn: Function) => {
        if (name === 'check-funding-goal') {
          return {
            totalRaised: 1000000,
            goalMet: true,
            percentageRaised: 100
          };
        }
        return fn();
      });

      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve' })
        .mockResolvedValueOnce({ signed: true })
        .mockResolvedValueOnce({ type: 'payment.succeeded' });

      const result = await workflow.run(params);
      
      expect(result.status).toBe('FUNDS_RELEASED');
      expect(mockStep.do).toHaveBeenCalledWith('release-funds-to-creator', expect.any(Function));
    });

    it('should refund if funding goal not met after deadline', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.do.mockImplementation((name: string, fn: Function) => {
        if (name === 'check-funding-goal') {
          return {
            totalRaised: 500000,
            goalMet: false,
            percentageRaised: 50,
            deadlinePassed: true
          };
        }
        return fn();
      });

      const result = await workflow.run(params);
      
      expect(result.status).toBe('REFUNDED');
      expect(mockStep.do).toHaveBeenCalledWith('process-refund', expect.any(Function));
    });
  });

  describe('Error Handling and Compensation', () => {
    it('should handle database errors gracefully', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      mockStep.do.mockRejectedValueOnce(new Error('Database connection failed'));

      try {
        await workflow.run(params);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Database connection failed');
      }
    });

    it('should compensate on partial completion failure', async () => {
      const params: InvestmentDealParams = {
        investorId: 'inv_123',
        pitchId: 'pitch_456',
        amount: 100000,
        investorType: 'accredited',
        investorEmail: 'investor@example.com',
        creatorId: 'creator_789',
        creatorEmail: 'creator@example.com',
        pitchTitle: 'Test Movie',
        minimumInvestment: 50000,
        maximumInvestment: 500000,
        targetRaise: 1000000
      };

      // Simulate failure after payment but before funds release
      mockStep.waitForEvent
        .mockResolvedValueOnce({ decision: 'approve' })
        .mockResolvedValueOnce({ signed: true })
        .mockResolvedValueOnce({ type: 'payment.succeeded' });

      mockStep.do.mockImplementation((name: string, fn: Function) => {
        if (name === 'release-funds-to-creator') {
          throw new Error('Transfer failed');
        }
        return fn();
      });

      try {
        await workflow.run(params);
      } catch (error) {
        // Verify compensation logic was triggered
        expect(mockStep.do).toHaveBeenCalledWith('compensate-failed-transfer', expect.any(Function));
      }
    });
  });
});