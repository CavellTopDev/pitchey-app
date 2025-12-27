/**
 * Production Dashboard Handler
 * Comprehensive production company features matching investor portal quality
 */

import { neon } from '@neondatabase/serverless';
import type { Env } from '../types';
import * as pitchQueries from '../db/queries/pitches';
import * as userQueries from '../db/queries/users';
import * as investmentQueries from '../db/queries/investments';
import * as analyticsQueries from '../db/queries/analytics';
import * as documentQueries from '../db/queries/documents';
import * as notificationQueries from '../db/queries/notifications';
import { corsHeaders } from '../utils/cors';
import { verifyAuth } from '../utils/auth';

// Main Production Dashboard - Overview
export async function productionDashboardHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const sql = neon(env.DATABASE_URL);
    
    // Get active projects in pipeline
    const activeProjects = await sql`
      SELECT 
        COUNT(DISTINCT pp.id) as total_projects,
        COUNT(CASE WHEN pp.stage = 'pre_production' THEN 1 END) as pre_production,
        COUNT(CASE WHEN pp.stage = 'production' THEN 1 END) as in_production,
        COUNT(CASE WHEN pp.stage = 'post_production' THEN 1 END) as post_production,
        SUM(pp.budget_allocated) as total_budget_allocated,
        AVG(pp.completion_percentage) as avg_completion
      FROM production_pipeline pp
      WHERE pp.production_company_id = ${user.id}
        AND pp.status = 'active'
    `;

    // Get talent pool stats
    const talentStats = await sql`
      SELECT 
        COUNT(DISTINCT talent_id) as total_talent,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'contracted' THEN 1 END) as contracted,
        AVG(rating) as avg_rating
      FROM production_talent
      WHERE production_company_id = ${user.id}
    `;

    // Get upcoming deadlines
    const upcomingDeadlines = await sql`
      SELECT 
        pp.title,
        pp.stage,
        pp.next_milestone,
        pp.milestone_date,
        EXTRACT(DAY FROM pp.milestone_date - NOW()) as days_until
      FROM production_pipeline pp
      WHERE pp.production_company_id = ${user.id}
        AND pp.status = 'active'
        AND pp.milestone_date > NOW()
      ORDER BY pp.milestone_date ASC
      LIMIT 5
    `;

    // Get budget overview
    const budgetOverview = await sql`
      SELECT 
        SUM(budget_allocated) as total_allocated,
        SUM(budget_spent) as total_spent,
        SUM(budget_remaining) as total_remaining,
        AVG(CASE WHEN budget_allocated > 0 
          THEN (budget_spent / budget_allocated) * 100 
          ELSE 0 END) as avg_budget_utilization
      FROM production_pipeline
      WHERE production_company_id = ${user.id}
        AND status IN ('active', 'completed')
    `;

    // Get recent crew assignments
    const recentAssignments = await sql`
      SELECT 
        ca.id,
        ca.crew_member_name,
        ca.role,
        ca.department,
        pp.title as project_title,
        ca.assigned_date
      FROM crew_assignments ca
      JOIN production_pipeline pp ON ca.project_id = pp.id
      WHERE pp.production_company_id = ${user.id}
      ORDER BY ca.assigned_date DESC
      LIMIT 10
    `;

    // Get location scouting updates
    const locationUpdates = await sql`
      SELECT 
        ls.id,
        ls.location_name,
        ls.location_type,
        ls.status,
        pp.title as project_title,
        ls.scouted_date
      FROM location_scouts ls
      JOIN production_pipeline pp ON ls.project_id = pp.id
      WHERE pp.production_company_id = ${user.id}
        AND ls.scouted_date > NOW() - INTERVAL '7 days'
      ORDER BY ls.scouted_date DESC
      LIMIT 5
    `;

    return new Response(JSON.stringify({
      success: true,
      dashboard: {
        activeProjects: activeProjects[0],
        talentStats: talentStats[0],
        upcomingDeadlines,
        budgetOverview: budgetOverview[0],
        recentAssignments,
        locationUpdates
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Production dashboard error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch production dashboard' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Talent Discovery System
export async function productionTalentHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);
    
    // Search parameters
    const searchTerm = url.searchParams.get('search') || '';
    const role = url.searchParams.get('role');
    const availability = url.searchParams.get('availability');
    const minRating = parseFloat(url.searchParams.get('min_rating') || '0');
    const genre = url.searchParams.get('genre');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build dynamic query
    let whereConditions = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (searchTerm) {
      whereConditions.push(`(
        LOWER(u.username) LIKE LOWER($${paramIndex}) OR 
        LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(u.bio) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    if (role) {
      whereConditions.push(`td.primary_role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (availability) {
      whereConditions.push(`td.availability_status = $${paramIndex}`);
      params.push(availability);
      paramIndex++;
    }

    if (minRating > 0) {
      whereConditions.push(`td.average_rating >= $${paramIndex}`);
      params.push(minRating);
      paramIndex++;
    }

    if (genre) {
      whereConditions.push(`td.preferred_genres @> ARRAY[$${paramIndex}]`);
      params.push(genre);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Discover talent
    const talentQuery = `
      SELECT DISTINCT
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_image,
        u.bio,
        u.location,
        td.primary_role,
        td.secondary_roles,
        td.years_experience,
        td.average_rating,
        td.total_projects,
        td.availability_status,
        td.daily_rate,
        td.preferred_genres,
        td.skills,
        td.awards,
        td.imdb_profile,
        td.demo_reel_url,
        ARRAY_AGG(DISTINCT p.title) FILTER (WHERE p.id IS NOT NULL) as recent_projects,
        COUNT(DISTINCT pr.id) as recommendations_count
      FROM users u
      LEFT JOIN talent_discovery td ON u.id = td.user_id
      LEFT JOIN pitches p ON u.id = p.creator_id AND p.status = 'published'
      LEFT JOIN production_recommendations pr ON u.id = pr.talent_id
      WHERE u.user_type = 'creator' 
        AND u.is_active = true
        AND ${whereClause}
      GROUP BY 
        u.id, u.username, u.first_name, u.last_name, u.profile_image, 
        u.bio, u.location, td.primary_role, td.secondary_roles,
        td.years_experience, td.average_rating, td.total_projects,
        td.availability_status, td.daily_rate, td.preferred_genres,
        td.skills, td.awards, td.imdb_profile, td.demo_reel_url
      ORDER BY 
        td.average_rating DESC NULLS LAST,
        td.total_projects DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    const talent = await sql(talentQuery, params);

    // Get talent categories for filters
    const categories = await sql`
      SELECT DISTINCT 
        primary_role as role,
        COUNT(*) as count
      FROM talent_discovery
      GROUP BY primary_role
      ORDER BY count DESC
    `;

    return new Response(JSON.stringify({
      success: true,
      talent,
      categories,
      pagination: {
        limit,
        offset,
        hasMore: talent.length === limit
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Talent discovery error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to discover talent' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Pipeline Management
export async function productionPipelineHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);
    
    if (request.method === 'GET') {
      // Get pipeline projects
      const stage = url.searchParams.get('stage');
      const status = url.searchParams.get('status') || 'active';
      
      let whereConditions = [`pp.production_company_id = $1`, `pp.status = $2`];
      const params: any[] = [user.id, status];
      
      if (stage) {
        whereConditions.push(`pp.stage = $3`);
        params.push(stage);
      }
      
      const pipeline = await sql(`
        SELECT 
          pp.*,
          p.title as pitch_title,
          p.genre as pitch_genre,
          p.logline,
          u.username as creator_username,
          COUNT(DISTINCT ca.id) as crew_count,
          COUNT(DISTINCT ls.id) as location_count,
          SUM(be.amount) as total_expenses
        FROM production_pipeline pp
        JOIN pitches p ON pp.pitch_id = p.id
        JOIN users u ON p.creator_id = u.id
        LEFT JOIN crew_assignments ca ON pp.id = ca.project_id
        LEFT JOIN location_scouts ls ON pp.id = ls.project_id
        LEFT JOIN budget_expenses be ON pp.id = be.project_id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY pp.id, p.title, p.genre, p.logline, u.username
        ORDER BY pp.priority DESC, pp.start_date ASC
      `, params);
      
      return new Response(JSON.stringify({
        success: true,
        pipeline
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'POST') {
      // Add project to pipeline
      const body = await request.json();
      const {
        pitch_id,
        stage = 'development',
        priority = 'medium',
        budget_allocated,
        start_date,
        target_completion_date,
        notes
      } = body;
      
      const project = await sql`
        INSERT INTO production_pipeline (
          production_company_id, pitch_id, stage, status, priority,
          budget_allocated, budget_spent, budget_remaining,
          start_date, target_completion_date, 
          completion_percentage, notes, created_at
        ) VALUES (
          ${user.id}, ${pitch_id}, ${stage}, 'active', ${priority},
          ${budget_allocated}, 0, ${budget_allocated},
          ${start_date}, ${target_completion_date},
          0, ${notes}, NOW()
        )
        RETURNING *
      `;
      
      // Create notification for creator
      await notificationQueries.createNotification(sql, {
        user_id: (await pitchQueries.getPitchById(sql, pitch_id))!.creator_id,
        type: 'project_greenlit',
        title: 'Your pitch has been greenlit!',
        message: 'A production company has added your pitch to their pipeline',
        related_pitch_id: pitch_id,
        related_user_id: user.id,
        priority: 'high'
      });
      
      return new Response(JSON.stringify({
        success: true,
        project: project[0]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'PUT') {
      // Update pipeline project
      const projectId = url.pathname.split('/').pop();
      const body = await request.json();
      
      const updateFields = [];
      const params = [];
      let paramIndex = 1;
      
      Object.entries(body).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          updateFields.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      });
      
      params.push(projectId, user.id);
      
      const updated = await sql(`
        UPDATE production_pipeline 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex} AND production_company_id = $${paramIndex + 1}
        RETURNING *
      `, params);
      
      return new Response(JSON.stringify({
        success: true,
        project: updated[0]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Pipeline management error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to manage pipeline' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Budget Management System
export async function productionBudgetHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);
    const projectId = url.searchParams.get('project_id');
    
    if (!projectId) {
      return new Response('Project ID required', { status: 400, headers: corsHeaders });
    }
    
    // Verify project ownership
    const projectCheck = await sql`
      SELECT id FROM production_pipeline 
      WHERE id = ${projectId} AND production_company_id = ${user.id}
    `;
    
    if (projectCheck.length === 0) {
      return new Response('Project not found', { status: 404, headers: corsHeaders });
    }
    
    if (request.method === 'GET') {
      // Get budget breakdown
      const budgetSummary = await sql`
        SELECT 
          pp.budget_allocated,
          pp.budget_spent,
          pp.budget_remaining,
          pp.contingency_percentage,
          pp.contingency_used
        FROM production_pipeline pp
        WHERE pp.id = ${projectId}
      `;
      
      // Get expenses by category
      const expensesByCategory = await sql`
        SELECT 
          category,
          SUM(amount) as total,
          COUNT(*) as transaction_count,
          MAX(expense_date) as last_expense
        FROM budget_expenses
        WHERE project_id = ${projectId}
        GROUP BY category
        ORDER BY total DESC
      `;
      
      // Get recent transactions
      const recentTransactions = await sql`
        SELECT 
          id,
          category,
          subcategory,
          description,
          amount,
          expense_date,
          vendor,
          invoice_number,
          approved_by,
          receipt_url
        FROM budget_expenses
        WHERE project_id = ${projectId}
        ORDER BY expense_date DESC
        LIMIT 50
      `;
      
      // Get budget alerts
      const budgetAlerts = await sql`
        SELECT 
          category,
          allocated_amount,
          spent_amount,
          (spent_amount / NULLIF(allocated_amount, 0)) * 100 as usage_percentage,
          CASE 
            WHEN spent_amount >= allocated_amount THEN 'over_budget'
            WHEN spent_amount >= allocated_amount * 0.9 THEN 'warning'
            WHEN spent_amount >= allocated_amount * 0.75 THEN 'caution'
            ELSE 'normal'
          END as alert_level
        FROM budget_categories
        WHERE project_id = ${projectId}
        ORDER BY usage_percentage DESC
      `;
      
      // Get burn rate analysis
      const burnRate = await sql`
        SELECT 
          DATE_TRUNC('week', expense_date) as week,
          SUM(amount) as weekly_spend,
          AVG(SUM(amount)) OVER (ORDER BY DATE_TRUNC('week', expense_date) 
            ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) as moving_avg
        FROM budget_expenses
        WHERE project_id = ${projectId}
          AND expense_date >= NOW() - INTERVAL '12 weeks'
        GROUP BY week
        ORDER BY week DESC
      `;
      
      return new Response(JSON.stringify({
        success: true,
        budget: {
          summary: budgetSummary[0],
          byCategory: expensesByCategory,
          recentTransactions,
          alerts: budgetAlerts,
          burnRate
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'POST') {
      // Add new expense
      const body = await request.json();
      const {
        category,
        subcategory,
        description,
        amount,
        expense_date,
        vendor,
        invoice_number,
        receipt_url
      } = body;
      
      // Add expense and update budget
      const expense = await sql`
        INSERT INTO budget_expenses (
          project_id, category, subcategory, description,
          amount, expense_date, vendor, invoice_number,
          receipt_url, approved_by, created_at
        ) VALUES (
          ${projectId}, ${category}, ${subcategory}, ${description},
          ${amount}, ${expense_date}, ${vendor}, ${invoice_number},
          ${receipt_url}, ${user.id}, NOW()
        )
        RETURNING *
      `;
      
      // Update project budget
      await sql`
        UPDATE production_pipeline 
        SET 
          budget_spent = budget_spent + ${amount},
          budget_remaining = budget_allocated - (budget_spent + ${amount}),
          updated_at = NOW()
        WHERE id = ${projectId}
      `;
      
      return new Response(JSON.stringify({
        success: true,
        expense: expense[0]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Budget management error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to manage budget' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Shooting Schedule Management
export async function productionScheduleHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);
    const projectId = url.searchParams.get('project_id');
    
    if (!projectId) {
      return new Response('Project ID required', { status: 400, headers: corsHeaders });
    }
    
    if (request.method === 'GET') {
      // Get shooting schedule
      const schedule = await sql`
        SELECT 
          ss.*,
          ls.location_name,
          ls.location_address,
          ls.location_type,
          COUNT(DISTINCT cs.scene_number) as scene_count,
          STRING_AGG(DISTINCT cs.scene_description, ', ') as scenes
        FROM shooting_schedule ss
        LEFT JOIN location_scouts ls ON ss.location_id = ls.id
        LEFT JOIN call_sheets cs ON ss.id = cs.schedule_id
        WHERE ss.project_id = ${projectId}
        GROUP BY ss.id, ls.location_name, ls.location_address, ls.location_type
        ORDER BY ss.shoot_date, ss.call_time
      `;
      
      // Get daily breakdown
      const dailyBreakdown = await sql`
        SELECT 
          shoot_date,
          COUNT(DISTINCT id) as total_setups,
          MIN(call_time) as first_call,
          MAX(wrap_time) as last_wrap,
          SUM(EXTRACT(EPOCH FROM (wrap_time - call_time)) / 3600) as total_hours,
          COUNT(DISTINCT location_id) as location_changes,
          SUM(crew_count) as total_crew_needed
        FROM shooting_schedule
        WHERE project_id = ${projectId}
          AND shoot_date >= CURRENT_DATE
        GROUP BY shoot_date
        ORDER BY shoot_date
        LIMIT 30
      `;
      
      // Get equipment requirements
      const equipment = await sql`
        SELECT 
          er.equipment_type,
          er.equipment_name,
          er.quantity,
          er.rental_company,
          er.daily_rate,
          ss.shoot_date,
          er.status
        FROM equipment_requirements er
        JOIN shooting_schedule ss ON er.schedule_id = ss.id
        WHERE ss.project_id = ${projectId}
          AND ss.shoot_date >= CURRENT_DATE
        ORDER BY ss.shoot_date, er.equipment_type
      `;
      
      // Get weather considerations
      const weatherAlerts = await sql`
        SELECT 
          ss.shoot_date,
          ss.weather_backup_plan,
          ls.location_name,
          ls.weather_dependent,
          wf.forecast_date,
          wf.conditions,
          wf.temperature,
          wf.precipitation_chance
        FROM shooting_schedule ss
        JOIN location_scouts ls ON ss.location_id = ls.id
        LEFT JOIN weather_forecasts wf ON ls.id = wf.location_id 
          AND wf.forecast_date = ss.shoot_date
        WHERE ss.project_id = ${projectId}
          AND ls.weather_dependent = true
          AND ss.shoot_date >= CURRENT_DATE
        ORDER BY ss.shoot_date
      `;
      
      return new Response(JSON.stringify({
        success: true,
        schedule: {
          detailed: schedule,
          daily: dailyBreakdown,
          equipment,
          weatherAlerts
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'POST') {
      // Create shooting day
      const body = await request.json();
      const {
        shoot_date,
        call_time,
        wrap_time,
        location_id,
        scene_numbers,
        crew_count,
        equipment_list,
        special_requirements,
        weather_backup_plan
      } = body;
      
      const shootDay = await sql`
        INSERT INTO shooting_schedule (
          project_id, shoot_date, call_time, wrap_time,
          location_id, scene_numbers, crew_count,
          equipment_list, special_requirements,
          weather_backup_plan, status, created_at
        ) VALUES (
          ${projectId}, ${shoot_date}, ${call_time}, ${wrap_time},
          ${location_id}, ${scene_numbers}, ${crew_count},
          ${equipment_list}::jsonb, ${special_requirements},
          ${weather_backup_plan}, 'scheduled', NOW()
        )
        RETURNING *
      `;
      
      // Auto-generate call sheets for key crew
      await sql`
        INSERT INTO call_sheets (
          schedule_id, crew_member_id, call_time,
          scene_number, scene_description, created_at
        )
        SELECT 
          ${shootDay[0].id}, ca.crew_member_id, ${call_time},
          unnest(${scene_numbers}::text[]), 'TBD', NOW()
        FROM crew_assignments ca
        WHERE ca.project_id = ${projectId}
          AND ca.is_key_crew = true
      `;
      
      return new Response(JSON.stringify({
        success: true,
        shootDay: shootDay[0]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Schedule management error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to manage schedule' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Location Scouting System
export async function productionLocationsHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);
    const projectId = url.searchParams.get('project_id');
    
    if (request.method === 'GET') {
      // Get scouted locations
      let whereConditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (projectId) {
        whereConditions.push(`ls.project_id = $${paramIndex}`);
        params.push(projectId);
        paramIndex++;
      }
      
      whereConditions.push(`ls.production_company_id = $${paramIndex}`);
      params.push(user.id);
      
      const locations = await sql(`
        SELECT 
          ls.*,
          pp.title as project_title,
          COUNT(DISTINCT lp.id) as photo_count,
          COUNT(DISTINCT ss.id) as scheduled_shoots,
          AVG(lr.rating) as avg_rating
        FROM location_scouts ls
        LEFT JOIN production_pipeline pp ON ls.project_id = pp.id
        LEFT JOIN location_photos lp ON ls.id = lp.location_id
        LEFT JOIN shooting_schedule ss ON ls.id = ss.location_id
        LEFT JOIN location_ratings lr ON ls.id = lr.location_id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ls.id, pp.title
        ORDER BY ls.scouted_date DESC
      `, params);
      
      // Get location categories
      const categories = await sql`
        SELECT 
          location_type,
          COUNT(*) as count,
          AVG(daily_rate) as avg_daily_rate
        FROM location_scouts
        WHERE production_company_id = ${user.id}
        GROUP BY location_type
        ORDER BY count DESC
      `;
      
      return new Response(JSON.stringify({
        success: true,
        locations,
        categories
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'POST') {
      // Add scouted location
      const body = await request.json();
      const {
        project_id,
        location_name,
        location_type,
        location_address,
        coordinates,
        description,
        capacity,
        daily_rate,
        availability,
        parking_info,
        power_availability,
        sound_considerations,
        lighting_conditions,
        weather_dependent,
        permits_required,
        contact_info,
        photos
      } = body;
      
      const location = await sql`
        INSERT INTO location_scouts (
          project_id, production_company_id, location_name,
          location_type, location_address, coordinates,
          description, capacity, daily_rate, availability,
          parking_info, power_availability, sound_considerations,
          lighting_conditions, weather_dependent, permits_required,
          contact_info, status, scouted_date, scouted_by
        ) VALUES (
          ${project_id}, ${user.id}, ${location_name},
          ${location_type}, ${location_address}, ${coordinates}::jsonb,
          ${description}, ${capacity}, ${daily_rate}, ${availability}::jsonb,
          ${parking_info}, ${power_availability}, ${sound_considerations},
          ${lighting_conditions}, ${weather_dependent}, ${permits_required}::jsonb,
          ${contact_info}::jsonb, 'approved', NOW(), ${user.id}
        )
        RETURNING *
      `;
      
      // Add photos if provided
      if (photos && photos.length > 0) {
        const photoValues = photos.map((photo: any, i: number) => {
          const base = i * 5;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, NOW())`;
        }).join(', ');
        
        const photoParams = photos.flatMap((photo: any) => [
          location[0].id,
          photo.url,
          photo.caption,
          photo.is_primary || false
        ]);
        
        await sql(`
          INSERT INTO location_photos (
            location_id, photo_url, caption, is_primary, uploaded_at
          ) VALUES ${photoValues}
        `, photoParams);
      }
      
      return new Response(JSON.stringify({
        success: true,
        location: location[0]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Location scouting error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to manage locations' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Crew Assembly Management
export async function productionCrewHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);
    const projectId = url.searchParams.get('project_id');
    
    if (request.method === 'GET') {
      if (projectId) {
        // Get project crew
        const crew = await sql`
          SELECT 
            ca.*,
            cm.full_name,
            cm.email,
            cm.phone,
            cm.emergency_contact,
            cm.union_affiliations,
            cm.daily_rate,
            cm.equipment_owned,
            cm.availability_status,
            cm.imdb_profile,
            COUNT(DISTINCT cs.id) as call_sheets_count,
            SUM(cs.hours_worked) as total_hours_worked
          FROM crew_assignments ca
          JOIN crew_members cm ON ca.crew_member_id = cm.id
          LEFT JOIN call_sheets cs ON ca.id = cs.assignment_id
          WHERE ca.project_id = ${projectId}
          GROUP BY ca.id, cm.full_name, cm.email, cm.phone, 
            cm.emergency_contact, cm.union_affiliations, cm.daily_rate,
            cm.equipment_owned, cm.availability_status, cm.imdb_profile
          ORDER BY ca.department, ca.is_key_crew DESC, ca.role
        `;
        
        // Get department breakdown
        const departments = await sql`
          SELECT 
            department,
            COUNT(*) as crew_count,
            SUM(daily_rate) as daily_cost,
            COUNT(CASE WHEN is_key_crew THEN 1 END) as key_crew_count
          FROM crew_assignments ca
          JOIN crew_members cm ON ca.crew_member_id = cm.id
          WHERE ca.project_id = ${projectId}
          GROUP BY department
          ORDER BY department
        `;
        
        return new Response(JSON.stringify({
          success: true,
          crew,
          departments
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Get available crew database
        const availableCrew = await sql`
          SELECT 
            cm.*,
            ARRAY_AGG(DISTINCT cr.role) as previous_roles,
            COUNT(DISTINCT cr.project_id) as projects_count,
            AVG(cr.rating) as avg_rating,
            MAX(cr.end_date) as last_worked
          FROM crew_members cm
          LEFT JOIN crew_roles cr ON cm.id = cr.crew_member_id
          WHERE cm.availability_status = 'available'
            AND cm.is_active = true
          GROUP BY cm.id
          ORDER BY avg_rating DESC NULLS LAST, projects_count DESC
        `;
        
        return new Response(JSON.stringify({
          success: true,
          availableCrew
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (request.method === 'POST') {
      // Assign crew member to project
      const body = await request.json();
      const {
        project_id,
        crew_member_id,
        role,
        department,
        start_date,
        end_date,
        daily_rate,
        is_key_crew
      } = body;
      
      // Create or get crew member
      let crewMemberId = crew_member_id;
      if (!crewMemberId && body.new_crew_member) {
        const newMember = body.new_crew_member;
        const created = await sql`
          INSERT INTO crew_members (
            full_name, email, phone, role_specialization,
            department, years_experience, daily_rate,
            union_affiliations, availability_status,
            created_at
          ) VALUES (
            ${newMember.full_name}, ${newMember.email}, ${newMember.phone},
            ${newMember.role_specialization}, ${newMember.department},
            ${newMember.years_experience}, ${newMember.daily_rate},
            ${newMember.union_affiliations}::jsonb, 'contracted',
            NOW()
          )
          RETURNING id
        `;
        crewMemberId = created[0].id;
      }
      
      // Assign to project
      const assignment = await sql`
        INSERT INTO crew_assignments (
          project_id, crew_member_id, role, department,
          start_date, end_date, daily_rate, is_key_crew,
          status, assigned_by, assigned_date
        ) VALUES (
          ${project_id}, ${crewMemberId}, ${role}, ${department},
          ${start_date}, ${end_date}, ${daily_rate}, ${is_key_crew},
          'confirmed', ${user.id}, NOW()
        )
        ON CONFLICT (project_id, crew_member_id, role) 
        DO UPDATE SET
          department = EXCLUDED.department,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          daily_rate = EXCLUDED.daily_rate,
          is_key_crew = EXCLUDED.is_key_crew,
          status = EXCLUDED.status
        RETURNING *
      `;
      
      // Update crew member availability
      await sql`
        UPDATE crew_members 
        SET availability_status = 'contracted'
        WHERE id = ${crewMemberId}
      `;
      
      return new Response(JSON.stringify({
        success: true,
        assignment: assignment[0]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Crew management error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to manage crew' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Production Analytics
export async function productionAnalyticsHandler(request: Request, env: Env) {
  try {
    const user = await verifyAuth(request, env);
    if (!user || user.user_type !== 'production') {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const sql = neon(env.DATABASE_URL);
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || '30d';
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (timeframe === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (timeframe === '90d') {
      startDate.setDate(startDate.getDate() - 90);
    } else if (timeframe === '1y') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    // Production metrics
    const productionMetrics = await sql`
      SELECT 
        COUNT(DISTINCT pp.id) as total_projects,
        COUNT(DISTINCT CASE WHEN pp.status = 'completed' THEN pp.id END) as completed_projects,
        COUNT(DISTINCT CASE WHEN pp.status = 'active' THEN pp.id END) as active_projects,
        AVG(EXTRACT(DAY FROM pp.actual_completion_date - pp.start_date)) as avg_production_days,
        AVG(pp.completion_percentage) as avg_completion_rate,
        SUM(pp.budget_allocated) as total_budget,
        SUM(pp.budget_spent) as total_spent,
        AVG(CASE WHEN pp.budget_allocated > 0 
          THEN (pp.budget_spent / pp.budget_allocated) * 100 
          ELSE 0 END) as budget_efficiency
      FROM production_pipeline pp
      WHERE pp.production_company_id = ${user.id}
        AND pp.created_at >= ${startDate}
    `;
    
    // Genre performance
    const genrePerformance = await sql`
      SELECT 
        p.genre,
        COUNT(DISTINCT pp.id) as project_count,
        AVG(pp.completion_percentage) as avg_completion,
        AVG(pp.roi_percentage) as avg_roi,
        SUM(pp.budget_spent) as total_investment
      FROM production_pipeline pp
      JOIN pitches p ON pp.pitch_id = p.id
      WHERE pp.production_company_id = ${user.id}
        AND pp.created_at >= ${startDate}
      GROUP BY p.genre
      ORDER BY project_count DESC
    `;
    
    // Timeline adherence
    const timelineAdherence = await sql`
      SELECT 
        pp.stage,
        COUNT(*) as projects,
        AVG(
          CASE 
            WHEN pp.actual_completion_date IS NOT NULL 
            THEN EXTRACT(DAY FROM pp.actual_completion_date - pp.target_completion_date)
            ELSE EXTRACT(DAY FROM NOW() - pp.target_completion_date)
          END
        ) as avg_days_variance,
        COUNT(CASE 
          WHEN pp.actual_completion_date <= pp.target_completion_date 
          OR (pp.actual_completion_date IS NULL AND NOW() <= pp.target_completion_date)
          THEN 1 
        END) * 100.0 / COUNT(*) as on_time_percentage
      FROM production_pipeline pp
      WHERE pp.production_company_id = ${user.id}
        AND pp.created_at >= ${startDate}
      GROUP BY pp.stage
    `;
    
    // Crew utilization
    const crewUtilization = await sql`
      SELECT 
        ca.department,
        COUNT(DISTINCT ca.crew_member_id) as total_crew,
        AVG(ca.daily_rate) as avg_daily_rate,
        SUM(cs.hours_worked) as total_hours,
        AVG(cs.hours_worked / NULLIF(
          EXTRACT(DAY FROM ca.end_date - ca.start_date) * 8, 0
        ) * 100) as utilization_rate
      FROM crew_assignments ca
      LEFT JOIN call_sheets cs ON ca.id = cs.assignment_id
      JOIN production_pipeline pp ON ca.project_id = pp.id
      WHERE pp.production_company_id = ${user.id}
        AND ca.start_date >= ${startDate}
      GROUP BY ca.department
      ORDER BY total_crew DESC
    `;
    
    // Location costs
    const locationCosts = await sql`
      SELECT 
        ls.location_type,
        COUNT(DISTINCT ls.id) as location_count,
        AVG(ls.daily_rate) as avg_daily_rate,
        SUM(ls.daily_rate * ss.shoot_days) as total_cost,
        AVG(lr.rating) as avg_satisfaction
      FROM location_scouts ls
      LEFT JOIN (
        SELECT location_id, COUNT(*) as shoot_days
        FROM shooting_schedule
        GROUP BY location_id
      ) ss ON ls.id = ss.location_id
      LEFT JOIN location_ratings lr ON ls.id = lr.location_id
      WHERE ls.production_company_id = ${user.id}
        AND ls.scouted_date >= ${startDate}
      GROUP BY ls.location_type
      ORDER BY total_cost DESC
    `;
    
    // Success metrics
    const successMetrics = await sql`
      SELECT 
        COUNT(DISTINCT CASE WHEN pp.roi_percentage > 0 THEN pp.id END) as profitable_projects,
        COUNT(DISTINCT CASE WHEN pp.awards_received > 0 THEN pp.id END) as award_winning,
        AVG(pp.audience_score) as avg_audience_score,
        AVG(pp.critic_score) as avg_critic_score,
        SUM(pp.box_office_revenue) as total_revenue,
        AVG(pp.roi_percentage) as avg_roi
      FROM production_pipeline pp
      WHERE pp.production_company_id = ${user.id}
        AND pp.status = 'completed'
        AND pp.actual_completion_date >= ${startDate}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      analytics: {
        productionMetrics: productionMetrics[0],
        genrePerformance,
        timelineAdherence,
        crewUtilization,
        locationCosts,
        successMetrics: successMetrics[0],
        timeframe
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Production analytics error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch production analytics' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}