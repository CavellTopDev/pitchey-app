// Debug script to test the pitch service directly
import { db } from "./src/db/client.ts";
import { pitches, users } from "./src/db/schema.ts";
import { eq, desc } from "drizzle-orm";

async function debugPitchService() {
  console.log("🔍 Testing pitch service query directly...");
  
  try {
    // First, let's see what raw data exists in the database
    console.log("\n1. Checking raw pitches data:");
    const rawPitches = await db
      .select()
      .from(pitches)
      .limit(3);
    
    console.log("Raw pitches count:", rawPitches.length);
    if (rawPitches.length > 0) {
      console.log("First pitch structure:", JSON.stringify(rawPitches[0], null, 2));
    }

    // Now test the exact query from the service
    console.log("\n2. Testing the service query:");
    const results = await db
      .select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        formatCategory: pitches.formatCategory,
        formatSubtype: pitches.formatSubtype,
        customFormat: pitches.customFormat,
        estimatedBudget: pitches.estimatedBudget,
        status: pitches.status,
        userId: pitches.userId,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        ndaCount: pitches.ndaCount,
        shortSynopsis: pitches.shortSynopsis,
        requireNda: pitches.requireNda,
        productionStage: pitches.productionStage,
        seekingInvestment: pitches.seekingInvestment,
        createdAt: pitches.createdAt,
        updatedAt: pitches.updatedAt,
        publishedAt: pitches.publishedAt,
        // User join for proper creator info
        creatorId: users.id,
        creatorUsername: users.username,
        creatorCompanyName: users.companyName,
        creatorUserType: users.userType
      })
      .from(pitches)
      .leftJoin(users, eq(pitches.userId, users.id))
      .where(eq(pitches.status, "published"))
      .orderBy(desc(pitches.publishedAt))
      .limit(3);

    console.log("Service query results count:", results.length);
    if (results.length > 0) {
      console.log("First result structure:", JSON.stringify(results[0], null, 2));
    }

    // Test the mapping logic
    console.log("\n3. Testing formatted mapping:");
    const formatted = results.map(p => ({
      id: p.id,
      title: p.title,
      logline: p.logline,
      genre: p.genre,
      format: p.format,
      formatCategory: p.formatCategory,
      formatSubtype: p.formatSubtype,
      customFormat: p.customFormat,
      estimatedBudget: p.estimatedBudget,
      status: p.status,
      userId: p.userId,
      viewCount: p.viewCount || 0,
      likeCount: p.likeCount || 0,
      ndaCount: p.ndaCount || 0,
      shortSynopsis: p.shortSynopsis,
      requireNDA: p.requireNda || false,
      productionStage: p.productionStage || 'concept',
      seekingInvestment: p.seekingInvestment !== null ? p.seekingInvestment : false,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      publishedAt: p.publishedAt,
      creator: {
        id: p.creatorId,
        username: p.creatorUsername,
        companyName: p.creatorCompanyName,
        userType: p.creatorUserType
      }
    }));
    
    console.log("Formatted results count:", formatted.length);
    if (formatted.length > 0) {
      console.log("First formatted result:", JSON.stringify(formatted[0], null, 2));
    }

    console.log("\n4. API Response simulation:");
    const apiResponse = {
      success: true,
      pitches: formatted,
      message: "Pitches retrieved successfully",
      cached: false
    };
    
    console.log("Final API response structure:", JSON.stringify(apiResponse, null, 2));
    
  } catch (error) {
    console.error("❌ Error in debug script:", error);
  }
  
  process.exit(0);
}

debugPitchService();