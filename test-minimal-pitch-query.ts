// Test minimal pitch query using SQL to bypass schema issues temporarily
import { db } from "./src/db/client.ts";
import { sql } from "drizzle-orm";

async function testMinimalPitchQuery() {
  console.log("🔧 Creating temporary solution with SQL queries...");
  
  try {
    // Get public pitches using direct SQL
    const publicPitches = await db.execute(sql`
      SELECT 
        p.id,
        p.title,
        p.logline,
        p.genre,
        p.format,
        p.format_category,
        p.format_subtype,
        p.custom_format,
        p.estimated_budget,
        p.status,
        p.user_id,
        p.view_count,
        p.like_count,
        p.nda_count,
        p.short_synopsis,
        p.require_nda,
        p.production_stage,
        p.seeking_investment,
        p.created_at,
        p.updated_at,
        p.published_at,
        u.id as creator_id,
        u.username as creator_username,
        u.company_name as creator_company_name,
        u.user_type as creator_user_type
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.published_at DESC
      LIMIT 5
    `);
    
    console.log(`✅ Found ${publicPitches.rows.length} published pitches`);
    
    if (publicPitches.rows.length > 0) {
      console.log("Sample pitch:", JSON.stringify(publicPitches.rows[0], null, 2));
      
      // Format the results like the service should
      const formatted = publicPitches.rows.map(p => ({
        id: p.id,
        title: p.title,
        logline: p.logline,
        genre: p.genre,
        format: p.format,
        formatCategory: p.format_category,
        formatSubtype: p.format_subtype,
        customFormat: p.custom_format,
        estimatedBudget: p.estimated_budget,
        status: p.status,
        userId: p.user_id,
        viewCount: p.view_count || 0,
        likeCount: p.like_count || 0,
        ndaCount: p.nda_count || 0,
        shortSynopsis: p.short_synopsis,
        requireNDA: p.require_nda || false,
        productionStage: p.production_stage || 'concept',
        seekingInvestment: p.seeking_investment !== null ? p.seeking_investment : false,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        publishedAt: p.published_at,
        creator: {
          id: p.creator_id,
          username: p.creator_username,
          companyName: p.creator_company_name,
          userType: p.creator_user_type
        }
      }));
      
      console.log("\n📋 API Response format:");
      console.log(JSON.stringify({
        success: true,
        pitches: formatted,
        message: "Pitches retrieved successfully"
      }, null, 2));
    }
    
  } catch (error) {
    console.error("❌ Error in minimal test:", error);
  }
  
  process.exit(0);
}

testMinimalPitchQuery();