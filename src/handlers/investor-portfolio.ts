// Phase 2: Investor Portfolio Handlers
// Comprehensive investment tracking and portfolio management

import { sql } from '../db/client';

export class InvestorPortfolioHandler {
  constructor(private db: any) {}

  // Get portfolio summary
  async getPortfolioSummary(userId: number) {
    try {
      // Get or create portfolio summary
      let summary = await this.db.query(
        `SELECT * FROM portfolio_summaries WHERE investor_id = $1`,
        [userId]
      );

      if (summary.length === 0) {
        // Create default summary if not exists
        await this.db.query(
          `INSERT INTO portfolio_summaries (investor_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [userId]
        );
        summary = await this.db.query(
          `SELECT * FROM portfolio_summaries WHERE investor_id = $1`,
          [userId]
        );
      }

      // Get recent investments
      const recentInvestments = await this.db.query(
        `SELECT i.*, p.title as pitch_title, p.genre
         FROM investments i
         JOIN pitches p ON i.pitch_id = p.id
         WHERE i.investor_id = $1
         ORDER BY i.invested_at DESC
         LIMIT 5`,
        [userId]
      );

      // Get investment distribution
      const distribution = await this.db.query(
        `SELECT 
          p.genre, 
          COUNT(*) as count, 
          SUM(i.amount) as total_amount
         FROM investments i
         JOIN pitches p ON i.pitch_id = p.id
         WHERE i.investor_id = $1 AND i.status = 'active'
         GROUP BY p.genre`,
        [userId]
      );

      return {
        success: true,
        data: {
          summary: summary[0],
          recentInvestments,
          distribution
        }
      };
    } catch (error) {
      console.error('Portfolio summary error:', error);
      return { success: false, error: 'Failed to fetch portfolio summary' };
    }
  }

  // Get portfolio performance metrics
  async getPortfolioPerformance(userId: number) {
    try {
      const performance = await this.db.query(
        `SELECT 
          DATE_TRUNC('month', invested_at) as month,
          SUM(amount) as invested,
          SUM(CASE WHEN roi > 0 THEN amount * (roi/100) ELSE 0 END) as returns,
          AVG(roi) as avg_roi
         FROM investments
         WHERE investor_id = $1
         GROUP BY DATE_TRUNC('month', invested_at)
         ORDER BY month DESC
         LIMIT 12`,
        [userId]
      );

      const totals = await this.db.query(
        `SELECT 
          SUM(amount) as total_invested,
          SUM(CASE WHEN roi > 0 THEN amount * (roi/100) ELSE 0 END) as total_returns,
          AVG(roi) as overall_roi,
          COUNT(DISTINCT pitch_id) as unique_investments
         FROM investments
         WHERE investor_id = $1`,
        [userId]
      );

      return {
        success: true,
        data: {
          monthlyPerformance: performance,
          totals: totals[0] || {
            total_invested: 0,
            total_returns: 0,
            overall_roi: 0,
            unique_investments: 0
          }
        }
      };
    } catch (error) {
      console.error('Portfolio performance error:', error);
      return { success: false, error: 'Failed to fetch portfolio performance' };
    }
  }

  // Get all investments
  async getInvestments(userId: number) {
    try {
      const investments = await this.db.query(
        `SELECT 
          i.*,
          p.title as pitch_title,
          p.genre,
          p.status as pitch_status,
          u.first_name || ' ' || u.last_name as creator_name
         FROM investments i
         JOIN pitches p ON i.pitch_id = p.id
         LEFT JOIN users u ON p.user_id = u.id
         WHERE i.investor_id = $1
         ORDER BY i.invested_at DESC`,
        [userId]
      );

      return {
        success: true,
        data: { investments }
      };
    } catch (error) {
      console.error('Get investments error:', error);
      return { success: false, error: 'Failed to fetch investments' };
    }
  }

  // Get single investment details
  async getInvestmentById(userId: number, investmentId: number) {
    try {
      const investment = await this.db.query(
        `SELECT 
          i.*,
          p.title as pitch_title,
          p.genre,
          p.logline,
          p.status as pitch_status,
          u.first_name || ' ' || u.last_name as creator_name,
          u.email as creator_email
         FROM investments i
         JOIN pitches p ON i.pitch_id = p.id
         LEFT JOIN users u ON p.user_id = u.id
         WHERE i.id = $1 AND i.investor_id = $2`,
        [investmentId, userId]
      );

      if (investment.length === 0) {
        return { success: false, error: 'Investment not found' };
      }

      // Get related transactions
      const transactions = await this.db.query(
        `SELECT * FROM investment_transactions 
         WHERE investment_id = $1 
         ORDER BY transaction_date DESC`,
        [investmentId]
      );

      return {
        success: true,
        data: {
          investment: investment[0],
          transactions
        }
      };
    } catch (error) {
      console.error('Get investment error:', error);
      return { success: false, error: 'Failed to fetch investment details' };
    }
  }

  // Create new investment
  async createInvestment(userId: number, data: any) {
    try {
      const { pitch_id, amount, investment_type, equity_percentage, terms, notes } = data;

      // Verify pitch exists
      const pitch = await this.db.query(
        `SELECT * FROM pitches WHERE id = $1 AND status = 'published'`,
        [pitch_id]
      );

      if (pitch.length === 0) {
        return { success: false, error: 'Pitch not found or not available' };
      }

      // Create investment
      const investment = await this.db.query(
        `INSERT INTO investments 
         (investor_id, pitch_id, amount, investment_type, equity_percentage, terms, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, pitch_id, amount, investment_type, equity_percentage, terms, notes]
      );

      // Update portfolio summary
      await this.db.query(
        `UPDATE portfolio_summaries 
         SET total_invested = total_invested + $1,
             active_investments = active_investments + 1,
             last_investment_date = NOW(),
             updated_at = NOW()
         WHERE investor_id = $2`,
        [amount, userId]
      );

      // Create transaction record
      await this.db.query(
        `INSERT INTO investment_transactions
         (investment_id, investor_id, transaction_type, amount, description)
         VALUES ($1, $2, 'investment', $3, $4)`,
        [investment[0].id, userId, amount, `Initial investment in pitch ${pitch_id}`]
      );

      return {
        success: true,
        data: { investment: investment[0] }
      };
    } catch (error) {
      console.error('Create investment error:', error);
      return { success: false, error: 'Failed to create investment' };
    }
  }

  // Update investment
  async updateInvestment(userId: number, investmentId: number, data: any) {
    try {
      const { status, roi, notes } = data;

      const investment = await this.db.query(
        `UPDATE investments 
         SET status = COALESCE($1, status),
             roi = COALESCE($2, roi),
             notes = COALESCE($3, notes),
             completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
         WHERE id = $4 AND investor_id = $5
         RETURNING *`,
        [status, roi, notes, investmentId, userId]
      );

      if (investment.length === 0) {
        return { success: false, error: 'Investment not found' };
      }

      return {
        success: true,
        data: { investment: investment[0] }
      };
    } catch (error) {
      console.error('Update investment error:', error);
      return { success: false, error: 'Failed to update investment' };
    }
  }

  // Delete investment
  async deleteInvestment(userId: number, investmentId: number) {
    try {
      const investment = await this.db.query(
        `DELETE FROM investments 
         WHERE id = $1 AND investor_id = $2 AND status = 'pending'
         RETURNING *`,
        [investmentId, userId]
      );

      if (investment.length === 0) {
        return { success: false, error: 'Investment not found or cannot be deleted' };
      }

      return {
        success: true,
        data: { message: 'Investment deleted successfully' }
      };
    } catch (error) {
      console.error('Delete investment error:', error);
      return { success: false, error: 'Failed to delete investment' };
    }
  }

  // Get watchlist
  async getWatchlist(userId: number) {
    try {
      const watchlist = await this.db.query(
        `SELECT 
          w.*,
          p.title,
          p.genre,
          p.logline,
          p.status as pitch_status,
          u.first_name || ' ' || u.last_name as creator_name
         FROM investor_watchlist w
         JOIN pitches p ON w.pitch_id = p.id
         LEFT JOIN users u ON p.user_id = u.id
         WHERE w.investor_id = $1
         ORDER BY w.priority DESC, w.added_at DESC`,
        [userId]
      );

      return {
        success: true,
        data: { watchlist }
      };
    } catch (error) {
      console.error('Get watchlist error:', error);
      return { success: false, error: 'Failed to fetch watchlist' };
    }
  }

  // Add to watchlist
  async addToWatchlist(userId: number, data: any) {
    try {
      const { pitch_id, priority = 'medium', notes, target_amount } = data;

      const item = await this.db.query(
        `INSERT INTO investor_watchlist 
         (investor_id, pitch_id, priority, notes, target_amount)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (investor_id, pitch_id) 
         DO UPDATE SET 
           priority = $3,
           notes = $4,
           target_amount = $5
         RETURNING *`,
        [userId, pitch_id, priority, notes, target_amount]
      );

      return {
        success: true,
        data: { watchlistItem: item[0] }
      };
    } catch (error) {
      console.error('Add to watchlist error:', error);
      return { success: false, error: 'Failed to add to watchlist' };
    }
  }

  // Remove from watchlist
  async removeFromWatchlist(userId: number, itemId: number) {
    try {
      const result = await this.db.query(
        `DELETE FROM investor_watchlist 
         WHERE id = $1 AND investor_id = $2
         RETURNING *`,
        [itemId, userId]
      );

      if (result.length === 0) {
        return { success: false, error: 'Watchlist item not found' };
      }

      return {
        success: true,
        data: { message: 'Removed from watchlist' }
      };
    } catch (error) {
      console.error('Remove from watchlist error:', error);
      return { success: false, error: 'Failed to remove from watchlist' };
    }
  }

  // Get investment activity
  async getActivity(userId: number) {
    try {
      const activity = await this.db.query(
        `SELECT 
          'investment' as type,
          i.id,
          i.amount,
          i.invested_at as timestamp,
          p.title as related_title,
          'Invested in ' || p.title as description
         FROM investments i
         JOIN pitches p ON i.pitch_id = p.id
         WHERE i.investor_id = $1
         
         UNION ALL
         
         SELECT 
          'transaction' as type,
          t.id,
          t.amount,
          t.transaction_date as timestamp,
          '' as related_title,
          t.description
         FROM investment_transactions t
         WHERE t.investor_id = $1
         
         ORDER BY timestamp DESC
         LIMIT 50`,
        [userId]
      );

      return {
        success: true,
        data: { activity }
      };
    } catch (error) {
      console.error('Get activity error:', error);
      return { success: false, error: 'Failed to fetch activity' };
    }
  }

  // Get transactions
  async getTransactions(userId: number) {
    try {
      const transactions = await this.db.query(
        `SELECT 
          t.*,
          i.pitch_id,
          p.title as pitch_title
         FROM investment_transactions t
         LEFT JOIN investments i ON t.investment_id = i.id
         LEFT JOIN pitches p ON i.pitch_id = p.id
         WHERE t.investor_id = $1
         ORDER BY t.transaction_date DESC`,
        [userId]
      );

      return {
        success: true,
        data: { transactions }
      };
    } catch (error) {
      console.error('Get transactions error:', error);
      return { success: false, error: 'Failed to fetch transactions' };
    }
  }

  // Get investment analytics
  async getAnalytics(userId: number) {
    try {
      const analytics = await this.db.query(
        `SELECT * FROM investment_analytics 
         WHERE investor_id = $1 
         ORDER BY period_end DESC 
         LIMIT 12`,
        [userId]
      );

      // Calculate current period analytics if needed
      const currentPeriod = await this.db.query(
        `SELECT 
          COUNT(*) as total_investments,
          SUM(amount) as total_invested,
          AVG(amount) as avg_investment,
          MAX(amount) as max_investment,
          MIN(amount) as min_investment,
          AVG(roi) as avg_roi
         FROM investments
         WHERE investor_id = $1 
           AND invested_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [userId]
      );

      return {
        success: true,
        data: {
          historical: analytics,
          current: currentPeriod[0]
        }
      };
    } catch (error) {
      console.error('Get analytics error:', error);
      return { success: false, error: 'Failed to fetch analytics' };
    }
  }

  // Get investment recommendations
  async getRecommendations(userId: number) {
    try {
      const recommendations = await this.db.query(
        `SELECT 
          r.*,
          p.title,
          p.genre,
          p.logline,
          p.budget_range,
          u.first_name || ' ' || u.last_name as creator_name
         FROM investment_recommendations r
         JOIN pitches p ON r.pitch_id = p.id
         LEFT JOIN users u ON p.user_id = u.id
         WHERE r.investor_id = $1 
           AND (r.expires_at IS NULL OR r.expires_at > NOW())
           AND r.invested = FALSE
         ORDER BY r.recommendation_score DESC
         LIMIT 20`,
        [userId]
      );

      if (recommendations.length === 0) {
        // Generate basic recommendations based on genre preferences
        const genrePreferences = await this.db.query(
          `SELECT p.genre, COUNT(*) as count
           FROM investments i
           JOIN pitches p ON i.pitch_id = p.id
           WHERE i.investor_id = $1
           GROUP BY p.genre
           ORDER BY count DESC
           LIMIT 3`,
          [userId]
        );

        const topGenres = genrePreferences.map((g: any) => g.genre);
        
        const newRecommendations = await this.db.query(
          `SELECT 
            p.id as pitch_id,
            p.title,
            p.genre,
            p.logline,
            p.budget_range,
            u.first_name || ' ' || u.last_name as creator_name,
            CASE 
              WHEN p.genre = ANY($2) THEN 80
              ELSE 60
            END as recommendation_score,
            'genre_match' as recommendation_type
           FROM pitches p
           LEFT JOIN users u ON p.user_id = u.id
           WHERE p.status = 'published'
             AND p.id NOT IN (
               SELECT pitch_id FROM investments WHERE investor_id = $1
             )
           ORDER BY p.created_at DESC
           LIMIT 10`,
          [userId, topGenres]
        );

        return {
          success: true,
          data: { recommendations: newRecommendations }
        };
      }

      return {
        success: true,
        data: { recommendations }
      };
    } catch (error) {
      console.error('Get recommendations error:', error);
      return { success: false, error: 'Failed to fetch recommendations' };
    }
  }

  // Get risk assessment
  async getRiskAssessment(userId: number, pitchId?: number) {
    try {
      let query;
      let params;

      if (pitchId) {
        // Risk assessment for specific pitch
        query = `
          SELECT * FROM risk_assessments 
          WHERE investor_id = $1 AND pitch_id = $2
          ORDER BY assessment_date DESC
          LIMIT 1
        `;
        params = [userId, pitchId];
      } else {
        // Overall portfolio risk assessment
        query = `
          SELECT * FROM risk_assessments 
          WHERE investor_id = $1 AND pitch_id IS NULL
          ORDER BY assessment_date DESC
          LIMIT 1
        `;
        params = [userId];
      }

      let assessment = await this.db.query(query, params);

      if (assessment.length === 0 && !pitchId) {
        // Generate basic portfolio risk assessment
        const portfolioRisk = await this.db.query(
          `SELECT 
            COUNT(DISTINCT p.genre) as genre_diversity,
            COUNT(DISTINCT i.investment_type) as type_diversity,
            AVG(i.amount) as avg_investment,
            STDDEV(i.amount) as investment_variance
           FROM investments i
           JOIN pitches p ON i.pitch_id = p.id
           WHERE i.investor_id = $1 AND i.status = 'active'`,
          [userId]
        );

        const riskData = portfolioRisk[0];
        const diversificationScore = Math.min(100, (riskData.genre_diversity || 0) * 20);
        const riskScore = Math.max(1, 100 - diversificationScore);

        assessment = [{
          risk_score: riskScore,
          risk_level: riskScore < 30 ? 'low' : riskScore < 60 ? 'medium' : 'high',
          risk_factors: {
            diversification: 100 - diversificationScore,
            concentration: riskData.investment_variance ? 20 : 0,
            market: 15
          },
          recommendations: [
            diversificationScore < 60 ? 'Increase genre diversification' : null,
            'Regular portfolio rebalancing',
            'Monitor market trends'
          ].filter(Boolean),
          confidence_level: 75
        }];
      }

      return {
        success: true,
        data: { assessment: assessment[0] || null }
      };
    } catch (error) {
      console.error('Get risk assessment error:', error);
      return { success: false, error: 'Failed to fetch risk assessment' };
    }
  }
}