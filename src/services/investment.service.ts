import { db } from "../db/client.ts";
import { pitches, users } from "../db/schema.ts";
import { eq, and, desc, sql, gte, lte } from "npm:drizzle-orm";
import { NotificationService } from "./notification.service.ts";

// Since investments table isn't in schema yet, we'll define the interface
export interface Investment {
  id: number;
  investorId: number;
  pitchId: number;
  amount: number;
  percentage?: number;
  investmentType: "equity" | "debt" | "revenue_share";
  status: "pending" | "active" | "completed" | "cancelled";
  terms?: Record<string, any>;
  investedAt: Date;
  updatedAt: Date;
}

export interface CreateInvestmentData {
  investorId: number;
  pitchId: number;
  amount: number;
  percentage?: number;
  investmentType?: "equity" | "debt" | "revenue_share";
  terms?: Record<string, any>;
}

export class InvestmentService {
  // Create a new investment
  static async createInvestment(data: CreateInvestmentData) {
    try {
      // For now, we'll simulate investment creation
      // In production, this would insert into the investments table
      const investment: Investment = {
        id: Date.now(), // Temporary ID generation
        investorId: data.investorId,
        pitchId: data.pitchId,
        amount: data.amount,
        percentage: data.percentage,
        investmentType: data.investmentType || "equity",
        status: "pending",
        terms: data.terms || {},
        investedAt: new Date(),
        updatedAt: new Date(),
      };

      // Get pitch creator for notification
      const pitch = await db.query.pitches.findFirst({
        where: eq(pitches.id, data.pitchId),
        columns: {
          userId: true,
          title: true,
        },
      });

      if (pitch) {
        // Notify the pitch creator
        await NotificationService.notifyNewInvestment(
          pitch.userId,
          data.investorId,
          data.pitchId,
          data.amount
        );
      }

      return {
        success: true,
        investment,
      };
    } catch (error) {
      console.error("Error creating investment:", error);
      return { success: false, error: error.message };
    }
  }

  // Get investor's portfolio
  static async getInvestorPortfolio(investorId: number) {
    try {
      // For now, return empty portfolio
      // In production, this would query the investments table
      const portfolio = {
        totalInvested: 0,
        currentValue: 0,
        totalReturn: 0,
        returnPercentage: 0,
        activeInvestments: 0,
        completedInvestments: 0,
        investments: [],
      };

      return {
        success: true,
        portfolio,
      };
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      return {
        success: false,
        error: error.message,
        portfolio: null,
      };
    }
  }

  // Get investment details
  static async getInvestment(investmentId: number, userId: number) {
    try {
      // For now, return null
      // In production, this would query the investments table
      return {
        success: false,
        error: "Investment not found",
        investment: null,
      };
    } catch (error) {
      console.error("Error fetching investment:", error);
      return {
        success: false,
        error: error.message,
        investment: null,
      };
    }
  }

  // Get investments for a specific pitch
  static async getPitchInvestments(pitchId: number) {
    try {
      // For now, return empty array
      // In production, this would query the investments table
      return {
        success: true,
        investments: [],
        total: 0,
        totalAmount: 0,
      };
    } catch (error) {
      console.error("Error fetching pitch investments:", error);
      return {
        success: false,
        error: error.message,
        investments: [],
        total: 0,
        totalAmount: 0,
      };
    }
  }

  // Calculate portfolio metrics
  static async calculatePortfolioMetrics(investorId: number) {
    try {
      // For now, return default metrics
      // In production, this would calculate from actual investments
      const metrics = {
        totalInvested: 0,
        currentValue: 0,
        realizedGains: 0,
        unrealizedGains: 0,
        roi: 0,
        irr: 0,
        diversification: {
          byGenre: {},
          byStage: {},
          byRisk: {},
        },
        performance: {
          bestPerforming: null,
          worstPerforming: null,
          averageReturn: 0,
        },
      };

      return {
        success: true,
        metrics,
      };
    } catch (error) {
      console.error("Error calculating portfolio metrics:", error);
      return {
        success: false,
        error: error.message,
        metrics: null,
      };
    }
  }

  // Get investment opportunities (recommended pitches)
  static async getInvestmentOpportunities(investorId: number, preferences?: any) {
    try {
      // Get pitches that match investor preferences
      const opportunitiesResult = await db
        .select({
          pitch: pitches,
          creator: {
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(pitches)
        .leftJoin(users, eq(pitches.userId, users.id))
        .where(eq(pitches.status, "published"))
        .orderBy(
          desc(pitches.ratingAverage),
          desc(pitches.viewCount)
        )
        .limit(10);

      const opportunities = opportunitiesResult.map(row => ({
        ...row.pitch,
        creator: row.creator,
      }));

      return {
        success: true,
        opportunities,
      };
    } catch (error) {
      console.error("Error fetching investment opportunities:", error);
      return {
        success: false,
        error: error.message,
        opportunities: [],
      };
    }
  }

  // Track investment performance over time
  static async trackPerformance(investmentId: number, currentValue: number) {
    try {
      // For now, just log the update
      // In production, this would update the investment record
      console.log(`Investment ${investmentId} updated to value: ${currentValue}`);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Error tracking performance:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate investment report
  static async generateInvestmentReport(investorId: number, startDate?: Date, endDate?: Date) {
    try {
      const report = {
        period: {
          start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: endDate || new Date(),
        },
        summary: {
          totalInvested: 0,
          totalReturns: 0,
          netProfit: 0,
          roi: 0,
        },
        investments: [],
        recommendations: [
          "Diversify your portfolio across different genres",
          "Consider investing in early-stage projects for higher potential returns",
          "Review and rebalance your portfolio quarterly",
        ],
      };

      return {
        success: true,
        report,
      };
    } catch (error) {
      console.error("Error generating investment report:", error);
      return {
        success: false,
        error: error.message,
        report: null,
      };
    }
  }

  // Withdraw investment (if allowed by terms)
  static async withdrawInvestment(investmentId: number, investorId: number) {
    try {
      // Check if withdrawal is allowed
      // For now, return error
      return {
        success: false,
        error: "Investment withdrawal not available at this time",
      };
    } catch (error) {
      console.error("Error withdrawing investment:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get investment statistics for dashboard
  static async getInvestmentStats(userId: number, userType: string) {
    try {
      if (userType === "investor") {
        // Get investor stats
        const portfolio = await this.getInvestorPortfolio(userId);
        return {
          success: true,
          stats: {
            totalInvested: portfolio.portfolio?.totalInvested || 0,
            activeInvestments: portfolio.portfolio?.activeInvestments || 0,
            totalReturn: portfolio.portfolio?.totalReturn || 0,
            returnPercentage: portfolio.portfolio?.returnPercentage || 0,
          },
        };
      } else if (userType === "creator") {
        // Get creator's received investments
        const userPitches = await db.query.pitches.findMany({
          where: eq(pitches.userId, userId),
          columns: {
            id: true,
          },
        });

        const pitchIds = userPitches.map(p => p.id);
        
        // For now, return zeros
        // In production, would query investments table
        return {
          success: true,
          stats: {
            totalRaised: 0,
            activeInvestors: 0,
            averageInvestment: 0,
            fundingProgress: 0,
          },
        };
      }

      return {
        success: true,
        stats: {},
      };
    } catch (error) {
      console.error("Error fetching investment stats:", error);
      return {
        success: false,
        error: error.message,
        stats: {},
      };
    }
  }
}