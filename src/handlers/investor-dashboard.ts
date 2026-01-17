/**
 * Investor Dashboard Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getUserId } from '../utils/auth-extract';

export async function investorDashboardHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);

  // Get user ID from authentication
  const authenticatedUserId = await getUserId(request, env);
  
  // Always return valid data structure
  const defaultData = {
    totalInvestments: 0,
    portfolioValue: 0,
    activeNDAs: 0,
    savedPitches: 0,
    recentActivity: [],
    investmentBreakdown: {
      preProduction: 0,
      production: 0,
      postProduction: 0,
      released: 0
    },
    analytics: {
      weeklyROI: 0,
      monthlyROI: 0,
      averageInvestment: 0
    }
  };
  
  if (!sql) {
    console.log('Database unavailable, returning default investor data');
    return new Response(JSON.stringify({
      success: true,
      data: defaultData
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
  
  try {
    // Get user ID from auth
    const userId = authenticatedUserId ? Number(authenticatedUserId) : 2;
    
    // Simple queries for free tier
    const [investmentStats, ndaStats, savedStats] = await Promise.all([
      sql`
        SELECT 
          COUNT(DISTINCT i.id) as total_investments,
          COALESCE(SUM(i.amount), 0) as portfolio_value,
          COALESCE(AVG(i.amount), 0) as avg_investment
        FROM investments i
        WHERE i.investor_id = ${userId}
      `,
      sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active' OR status = 'signed') as active_ndas
        FROM ndas
        WHERE requester_id = ${userId}
      `,
      sql`
        SELECT 
          COUNT(*) as saved_count
        FROM saved_pitches
        WHERE user_id = ${userId}
      `.catch(() => [{ saved_count: 0 }]) // Handle if table doesn't exist
    ]);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        totalInvestments: Number(investmentStats[0]?.total_investments) || 0,
        portfolioValue: Number(investmentStats[0]?.portfolio_value) || 0,
        activeNDAs: Number(ndaStats[0]?.active_ndas) || 0,
        savedPitches: Number(savedStats[0]?.saved_count) || 0,
        recentActivity: [],
        investmentBreakdown: {
          preProduction: 0,
          production: 0,
          postProduction: 0,
          released: 0
        },
        analytics: {
          weeklyROI: 0,
          monthlyROI: 0,
          averageInvestment: Number(investmentStats[0]?.avg_investment) || 0
        }
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Investor dashboard query error:', error);
    return new Response(JSON.stringify({
      success: true,
      data: defaultData
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
}