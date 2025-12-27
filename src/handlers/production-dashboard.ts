/**
 * Production Dashboard Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';

export async function productionDashboardHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  
  // Always return valid data structure
  const defaultData = {
    activeProjects: 0,
    totalInvested: 0,
    inProduction: 0,
    completed: 0,
    recentProjects: [],
    productionStages: {
      development: 0,
      preProduction: 0,
      production: 0,
      postProduction: 0,
      distribution: 0
    },
    analytics: {
      averageBudget: 0,
      averageROI: 0,
      successRate: 0
    }
  };
  
  if (!sql) {
    console.log('Database unavailable, returning default production data');
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
    // Get company ID from auth (hardcoded for demo)
    const companyId = 3; // TODO: Get from session/JWT
    
    // Simple queries for free tier
    const projectStats = await sql`
      SELECT 
        COUNT(DISTINCT p.id) as total_projects,
        COUNT(*) FILTER (WHERE p.status = 'in_production') as in_production,
        COUNT(*) FILTER (WHERE p.status = 'completed' OR p.status = 'released') as completed,
        COALESCE(SUM(p.budget), 0) as total_invested,
        COALESCE(AVG(p.budget), 0) as avg_budget
      FROM pitches p
      WHERE p.production_company_id = ${companyId} 
         OR p.id IN (
           SELECT pitch_id FROM investments 
           WHERE investor_id = ${companyId}
         )
    `.catch(() => [{
      total_projects: 0,
      in_production: 0,
      completed: 0,
      total_invested: 0,
      avg_budget: 0
    }]);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        activeProjects: Number(projectStats[0]?.total_projects) || 0,
        totalInvested: Number(projectStats[0]?.total_invested) || 0,
        inProduction: Number(projectStats[0]?.in_production) || 0,
        completed: Number(projectStats[0]?.completed) || 0,
        recentProjects: [],
        productionStages: {
          development: 0,
          preProduction: 0,
          production: Number(projectStats[0]?.in_production) || 0,
          postProduction: 0,
          distribution: Number(projectStats[0]?.completed) || 0
        },
        analytics: {
          averageBudget: Number(projectStats[0]?.avg_budget) || 0,
          averageROI: 0,
          successRate: 0
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
    console.error('Production dashboard query error:', error);
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