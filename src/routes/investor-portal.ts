/**
 * Investor Portal API Routes
 * Comprehensive endpoints for financial management, analytics, and portfolio tracking
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createDatabase } from '../db/raw-sql-connection';
import { authMiddleware } from '../middleware/auth';
import { ApiResponseBuilder } from '../utils/api-response';

// Validation schemas
const TransactionFilterSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  type: z.enum(['all', 'deposit', 'withdrawal', 'investment', 'return', 'fee']).optional().default('all'),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

const BudgetAllocationSchema = z.object({
  category: z.string().min(1),
  allocated_amount: z.number().positive(),
  period: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly')
});

export function createInvestorPortalRoutes(db: ReturnType<typeof createDatabase>) {
  const app = new Hono();

  // Apply auth middleware to all routes
  app.use('*', authMiddleware);

  // ============================
  // FINANCIAL OVERVIEW ENDPOINTS
  // ============================

  // Get financial summary
  app.get('/financial/summary', async (c) => {
    try {
      const userId = c.get('userId');
      
      const summary = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN type = 'investment' THEN amount ELSE 0 END), 0) as total_investments,
          COALESCE(SUM(CASE WHEN type = 'return' THEN amount ELSE 0 END), 0) as total_returns,
          COALESCE(SUM(CASE 
            WHEN type IN ('deposit', 'return', 'refund') THEN amount 
            WHEN type IN ('investment', 'withdrawal', 'fee') THEN -amount 
            ELSE 0 
          END), 0) as current_balance,
          COALESCE(SUM(CASE 
            WHEN type = 'return' AND created_at >= NOW() - INTERVAL '1 year' THEN amount 
            ELSE 0 
          END), 0) as ytd_returns
        FROM financial_transactions
        WHERE user_id = $1 AND status = 'completed'
      `, [userId]);

      const pendingDeals = await db.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(proposed_amount), 0) as total_amount
        FROM investment_deals
        WHERE investor_id = $1 AND status IN ('negotiating', 'pending', 'due_diligence')
      `, [userId]);

      return c.json(ApiResponseBuilder.success({
        available_funds: summary.rows[0]?.current_balance || 0,
        allocated_funds: summary.rows[0]?.total_investments || 0,
        total_returns: summary.rows[0]?.total_returns || 0,
        ytd_returns: summary.rows[0]?.ytd_returns || 0,
        ytd_growth: summary.rows[0]?.total_investments > 0 
          ? ((summary.rows[0]?.ytd_returns / summary.rows[0]?.total_investments) * 100).toFixed(2) + '%'
          : '0%',
        pending_deals: {
          count: pendingDeals.rows[0]?.count || 0,
          amount: pendingDeals.rows[0]?.total_amount || 0
        }
      }));
    } catch (error) {
      console.error('Financial summary error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch financial summary'), 500);
    }
  });

  // Get recent transactions for overview
  app.get('/financial/recent-transactions', async (c) => {
    try {
      const userId = c.get('userId');
      const limit = c.req.query('limit') || '5';
      
      const transactions = await db.query(`
        SELECT 
          ft.*,
          p.title as pitch_title
        FROM financial_transactions ft
        LEFT JOIN pitches p ON ft.reference_type = 'pitch' AND ft.reference_id = p.id
        WHERE ft.user_id = $1
        ORDER BY ft.created_at DESC
        LIMIT $2
      `, [userId, parseInt(limit)]);

      return c.json(ApiResponseBuilder.success(transactions.rows));
    } catch (error) {
      console.error('Recent transactions error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch recent transactions'), 500);
    }
  });

  // ============================
  // TRANSACTION HISTORY ENDPOINTS
  // ============================

  // Get full transaction history with filters
  app.get('/transactions', async (c) => {
    try {
      const userId = c.get('userId');
      const filters = TransactionFilterSchema.parse(c.req.query());
      
      const page = parseInt(filters.page);
      const limit = parseInt(filters.limit);
      const offset = (page - 1) * limit;
      
      let whereConditions = ['user_id = $1'];
      let params: any[] = [userId];
      let paramIndex = 2;

      if (filters.type !== 'all') {
        whereConditions.push(`type = $${paramIndex}`);
        params.push(filters.type);
        paramIndex++;
      }

      if (filters.search) {
        whereConditions.push(`description ILIKE $${paramIndex}`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (filters.startDate) {
        whereConditions.push(`created_at >= $${paramIndex}`);
        params.push(filters.startDate);
        paramIndex++;
      }

      if (filters.endDate) {
        whereConditions.push(`created_at <= $${paramIndex}`);
        params.push(filters.endDate);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count for pagination
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM financial_transactions WHERE ${whereClause}`,
        params
      );

      // Get paginated results
      params.push(limit, offset);
      const transactions = await db.query(`
        SELECT 
          ft.*,
          p.title as pitch_title
        FROM financial_transactions ft
        LEFT JOIN pitches p ON ft.reference_type = 'pitch' AND ft.reference_id = p.id
        WHERE ${whereClause}
        ORDER BY ft.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, params);

      return c.json(ApiResponseBuilder.success({
        transactions: transactions.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        }
      }));
    } catch (error) {
      console.error('Transactions error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch transactions'), 500);
    }
  });

  // Get transaction statistics
  app.get('/transactions/stats', async (c) => {
    try {
      const userId = c.get('userId');
      
      const stats = await db.query(`
        SELECT 
          type,
          COUNT(*) as count,
          SUM(amount) as total
        FROM financial_transactions
        WHERE user_id = $1 AND status = 'completed'
        GROUP BY type
      `, [userId]);

      const monthlyStats = await db.query(`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          SUM(CASE WHEN type IN ('deposit', 'return') THEN amount ELSE 0 END) as inflow,
          SUM(CASE WHEN type IN ('investment', 'withdrawal', 'fee') THEN amount ELSE 0 END) as outflow
        FROM financial_transactions
        WHERE user_id = $1 AND status = 'completed' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
      `, [userId]);

      return c.json(ApiResponseBuilder.success({
        byType: stats.rows,
        monthly: monthlyStats.rows
      }));
    } catch (error) {
      console.error('Transaction stats error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch transaction statistics'), 500);
    }
  });

  // ============================
  // BUDGET ALLOCATION ENDPOINTS
  // ============================

  // Get budget allocations
  app.get('/budget/allocations', async (c) => {
    try {
      const userId = c.get('userId');
      
      const allocations = await db.query(`
        SELECT 
          ba.*,
          COALESCE(SUM(i.amount), 0) as spent,
          ba.allocated_amount - COALESCE(SUM(i.amount), 0) as remaining,
          CASE 
            WHEN ba.allocated_amount > 0 
            THEN ROUND((COALESCE(SUM(i.amount), 0) / ba.allocated_amount * 100)::numeric, 2)
            ELSE 0 
          END as usage_percentage
        FROM budget_allocations ba
        LEFT JOIN investments i ON i.category = ba.category 
          AND i.user_id = ba.user_id
          AND i.created_at BETWEEN ba.period_start AND ba.period_end
        WHERE ba.user_id = $1 
          AND ba.period_end >= CURRENT_DATE
        GROUP BY ba.id
        ORDER BY ba.category
      `, [userId]);

      return c.json(ApiResponseBuilder.success(allocations.rows));
    } catch (error) {
      console.error('Budget allocations error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch budget allocations'), 500);
    }
  });

  // Create or update budget allocation
  app.post('/budget/allocations', async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const data = BudgetAllocationSchema.parse(body);
      
      // Calculate period dates based on period type
      let periodStart, periodEnd;
      const now = new Date();
      
      switch (data.period) {
        case 'monthly':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarterly':
          const quarter = Math.floor(now.getMonth() / 3);
          periodStart = new Date(now.getFullYear(), quarter * 3, 1);
          periodEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0);
          break;
        case 'yearly':
          periodStart = new Date(now.getFullYear(), 0, 1);
          periodEnd = new Date(now.getFullYear(), 11, 31);
          break;
      }

      const result = await db.query(`
        INSERT INTO budget_allocations (user_id, category, allocated_amount, period_start, period_end)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, category, period_start)
        DO UPDATE SET 
          allocated_amount = EXCLUDED.allocated_amount,
          updated_at = NOW()
        RETURNING *
      `, [userId, data.category, data.allocated_amount, periodStart, periodEnd]);

      return c.json(ApiResponseBuilder.success(result.rows[0]));
    } catch (error) {
      console.error('Create budget error:', error);
      return c.json(ApiResponseBuilder.error('Failed to create budget allocation'), 500);
    }
  });

  // ============================
  // TAX DOCUMENTS ENDPOINTS
  // ============================

  // Get tax documents
  app.get('/tax/documents', async (c) => {
    try {
      const userId = c.get('userId');
      const year = c.req.query('year');
      const type = c.req.query('type');
      
      let whereConditions = ['user_id = $1'];
      let params: any[] = [userId];
      let paramIndex = 2;

      if (year) {
        whereConditions.push(`tax_year = $${paramIndex}`);
        params.push(parseInt(year));
        paramIndex++;
      }

      if (type && type !== 'all') {
        whereConditions.push(`document_type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }

      const documents = await db.query(`
        SELECT * FROM tax_documents
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY tax_year DESC, created_at DESC
      `, params);

      return c.json(ApiResponseBuilder.success(documents.rows));
    } catch (error) {
      console.error('Tax documents error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch tax documents'), 500);
    }
  });

  // ============================
  // PORTFOLIO MANAGEMENT ENDPOINTS
  // ============================

  // Get pending deals
  app.get('/deals/pending', async (c) => {
    try {
      const userId = c.get('userId');
      
      const deals = await db.query(`
        SELECT 
          d.*,
          p.title,
          p.genre,
          p.budget_range,
          p.logline,
          u.name as creator_name,
          u.email as creator_email
        FROM investment_deals d
        JOIN pitches p ON d.pitch_id = p.id
        JOIN users u ON p.creator_id = u.id
        WHERE d.investor_id = $1
          AND d.status IN ('negotiating', 'pending', 'due_diligence')
        ORDER BY d.updated_at DESC
      `, [userId]);

      return c.json(ApiResponseBuilder.success(deals.rows));
    } catch (error) {
      console.error('Pending deals error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch pending deals'), 500);
    }
  });

  // Get completed projects
  app.get('/projects/completed', async (c) => {
    try {
      const userId = c.get('userId');
      
      const projects = await db.query(`
        SELECT 
          cp.*,
          p.title,
          p.genre,
          p.logline,
          i.amount as investment_amount,
          cp.final_return,
          CASE 
            WHEN i.amount > 0 
            THEN ROUND(((cp.final_return - i.amount) / i.amount * 100)::numeric, 2)
            ELSE 0 
          END as roi
        FROM completed_projects cp
        JOIN investments i ON cp.investment_id = i.id
        JOIN pitches p ON i.pitch_id = p.id
        WHERE i.user_id = $1
        ORDER BY cp.completion_date DESC
      `, [userId]);

      return c.json(ApiResponseBuilder.success(projects.rows));
    } catch (error) {
      console.error('Completed projects error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch completed projects'), 500);
    }
  });

  // Get all investments
  app.get('/investments/all', async (c) => {
    try {
      const userId = c.get('userId');
      const status = c.req.query('status') || 'all';
      const genre = c.req.query('genre') || 'all';
      const sort = c.req.query('sort') || 'date';
      
      let whereConditions = ['i.user_id = $1'];
      let params: any[] = [userId];
      let paramIndex = 2;

      if (status !== 'all') {
        whereConditions.push(`p.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (genre !== 'all') {
        whereConditions.push(`p.genre = $${paramIndex}`);
        params.push(genre);
        paramIndex++;
      }

      let orderBy = 'i.created_at DESC';
      if (sort === 'amount') orderBy = 'i.amount DESC';
      if (sort === 'roi') orderBy = 'ip.roi DESC NULLS LAST';

      const investments = await db.query(`
        SELECT 
          i.*,
          p.title,
          p.genre,
          p.status as project_status,
          p.logline,
          COALESCE(ip.roi, 0) as current_roi,
          COALESCE(ip.current_value, i.amount) as current_value
        FROM investments i
        JOIN pitches p ON i.pitch_id = p.id
        LEFT JOIN investment_performance ip ON i.id = ip.investment_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${orderBy}
      `, params);

      return c.json(ApiResponseBuilder.success(investments.rows));
    } catch (error) {
      console.error('All investments error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch investments'), 500);
    }
  });

  // ============================
  // ANALYTICS ENDPOINTS
  // ============================

  // Get ROI summary
  app.get('/analytics/roi/summary', async (c) => {
    try {
      const userId = c.get('userId');
      
      const summary = await db.query(`
        SELECT 
          COUNT(*) as total_investments,
          AVG(roi) as average_roi,
          MAX(roi) as best_roi,
          MIN(roi) as worst_roi,
          SUM(CASE WHEN roi > 0 THEN 1 ELSE 0 END) as profitable_count,
          SUM(CASE WHEN roi < 0 THEN 1 ELSE 0 END) as loss_count
        FROM investment_performance
        WHERE user_id = $1
      `, [userId]);

      return c.json(ApiResponseBuilder.success(summary.rows[0]));
    } catch (error) {
      console.error('ROI summary error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch ROI summary'), 500);
    }
  });

  // Get ROI by category
  app.get('/analytics/roi/by-category', async (c) => {
    try {
      const userId = c.get('userId');
      
      const categoryROI = await db.query(`
        SELECT 
          category,
          AVG(roi) as avg_roi,
          COUNT(*) as investment_count,
          SUM(current_value - initial_investment) as total_profit
        FROM investment_performance
        WHERE user_id = $1 AND category IS NOT NULL
        GROUP BY category
        ORDER BY avg_roi DESC
      `, [userId]);

      return c.json(ApiResponseBuilder.success(categoryROI.rows));
    } catch (error) {
      console.error('ROI by category error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch ROI by category'), 500);
    }
  });

  // Get ROI timeline
  app.get('/analytics/roi/timeline', async (c) => {
    try {
      const userId = c.get('userId');
      const period = c.req.query('period') || '6m';
      
      let interval = '6 months';
      if (period === '1y') interval = '1 year';
      if (period === '3m') interval = '3 months';
      if (period === '1m') interval = '1 month';

      const timeline = await db.query(`
        SELECT 
          DATE_TRUNC('month', performance_date) as month,
          AVG(roi) as avg_roi,
          SUM(current_value) as total_value,
          SUM(initial_investment) as total_invested
        FROM investment_performance
        WHERE user_id = $1 AND performance_date >= NOW() - INTERVAL '${interval}'
        GROUP BY DATE_TRUNC('month', performance_date)
        ORDER BY month ASC
      `, [userId]);

      return c.json(ApiResponseBuilder.success(timeline.rows));
    } catch (error) {
      console.error('ROI timeline error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch ROI timeline'), 500);
    }
  });

  // Get market trends
  app.get('/analytics/market/trends', async (c) => {
    try {
      const trends = await db.query(`
        SELECT 
          genre,
          AVG(avg_roi) as avg_roi,
          SUM(total_projects) as total_projects,
          AVG(avg_budget) as avg_budget,
          AVG(success_rate) as success_rate,
          trend
        FROM market_data
        WHERE data_date >= NOW() - INTERVAL '30 days'
        GROUP BY genre, trend
        ORDER BY avg_roi DESC
      `);

      return c.json(ApiResponseBuilder.success(trends.rows));
    } catch (error) {
      console.error('Market trends error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch market trends'), 500);
    }
  });

  // Get risk assessment
  app.get('/analytics/risk/portfolio', async (c) => {
    try {
      const userId = c.get('userId');
      
      const riskAnalysis = await db.query(`
        SELECT 
          AVG(risk_score) as portfolio_risk_score,
          COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_count,
          COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_risk_count,
          COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk_count,
          SUM(amount_at_risk) as total_at_risk
        FROM investment_risk_analysis
        WHERE user_id = $1
      `, [userId]);

      const riskByCategory = await db.query(`
        SELECT 
          i.category,
          AVG(ira.risk_score) as avg_risk,
          COUNT(*) as count
        FROM investment_risk_analysis ira
        JOIN investments i ON ira.investment_id = i.id
        WHERE ira.user_id = $1 AND i.category IS NOT NULL
        GROUP BY i.category
      `, [userId]);

      return c.json(ApiResponseBuilder.success({
        portfolio: riskAnalysis.rows[0],
        byCategory: riskByCategory.rows
      }));
    } catch (error) {
      console.error('Risk assessment error:', error);
      return c.json(ApiResponseBuilder.error('Failed to fetch risk assessment'), 500);
    }
  });

  return app;
}