import { ViewTrackingServiceSimple } from "./src/services/view-tracking-simple.service.ts";

async function testSimpleService() {
  console.log("Testing ViewTrackingServiceSimple for pitch #63...\n");
  
  try {
    // Get demographics
    console.log("1. Getting demographics...");
    const demographics = await ViewTrackingServiceSimple.getViewDemographics(63);
    console.log("Demographics:", demographics);
    
    // Get unique views
    console.log("\n2. Getting unique views...");
    const uniqueViews = await ViewTrackingServiceSimple.getUniqueViewCount(63);
    console.log("Unique views:", uniqueViews);
    
    // Get views by date
    console.log("\n3. Getting views by date...");
    const viewsByDate = await ViewTrackingServiceSimple.getViewsByDate(63, 30);
    console.log("Views by date:", viewsByDate);
    
    console.log("\n✅ All queries completed successfully!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testSimpleService();