import { ViewTrackingService } from "./src/services/view-tracking.service.ts";

async function testService() {
  console.log("Testing ViewTrackingService for pitch #63...\n");
  
  try {
    // Get demographics
    const demographics = await ViewTrackingService.getViewDemographics(63);
    console.log("Demographics:", demographics);
    
    // Get unique views
    const uniqueViews = await ViewTrackingService.getUniqueViewCount(63);
    console.log("Unique views:", uniqueViews);
    
    // Get views by date
    const viewsByDate = await ViewTrackingService.getViewsByDate(63, 30);
    console.log("Views by date:", viewsByDate);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testService();