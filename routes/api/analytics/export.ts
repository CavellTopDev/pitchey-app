import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, pitchViews, ndas, follows, messages } from "../../../src/db/schema.ts";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

type ExportFormat = 'json' | 'csv' | 'pdf';
type ReportType = 'summary' | 'detailed' | 'engagement' | 'nda' | 'financial';

export const handler: Handlers = {
  async GET(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const url = new URL(req.url);
      const format = (url.searchParams.get("format") || "json") as ExportFormat;
      const reportType = (url.searchParams.get("type") || "summary") as ReportType;
      const dateFrom = url.searchParams.get("from");
      const dateTo = url.searchParams.get("to");
      const pitchId = url.searchParams.get("pitchId");

      // Date range (default to last 30 days)
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom ? new Date(dateFrom) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get user's pitches
      let pitchFilter = eq(pitches.userId, userId);
      if (pitchId) {
        pitchFilter = and(
          eq(pitches.userId, userId),
          eq(pitches.id, parseInt(pitchId))
        );
      }

      const userPitches = await db.select().from(pitches)
        .where(pitchFilter)
        .orderBy(desc(pitches.createdAt));

      if (userPitches.length === 0) {
        return new Response(JSON.stringify({
          error: "No pitches found for analytics export"
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const pitchIds = userPitches.map(p => p.id);

      // Gather analytics data based on report type
      let reportData: any = {
        metadata: {
          reportType,
          dateRange: {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
          },
          generatedAt: new Date().toISOString(),
          pitchCount: userPitches.length,
        },
      };

      switch (reportType) {
        case 'summary':
          reportData.summary = await getSummaryReport(pitchIds, startDate, endDate);
          break;
          
        case 'detailed':
          reportData.detailed = await getDetailedReport(userPitches, pitchIds, startDate, endDate);
          break;
          
        case 'engagement':
          reportData.engagement = await getEngagementReport(pitchIds, startDate, endDate);
          break;
          
        case 'nda':
          reportData.nda = await getNDAReport(pitchIds, startDate, endDate);
          break;
          
        case 'financial':
          reportData.financial = await getFinancialProjections(userPitches);
          break;
      }

      // Format the response based on requested format
      switch (format) {
        case 'csv':
          return exportAsCSV(reportData, reportType);
          
        case 'pdf':
          return exportAsPDF(reportData, reportType);
          
        case 'json':
        default:
          return new Response(JSON.stringify({
            success: true,
            report: reportData,
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Content-Disposition": `attachment; filename="analytics_${reportType}_${Date.now()}.json"`,
            },
          });
      }
    } catch (error) {
      console.error("Error exporting analytics:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function getSummaryReport(pitchIds: number[], startDate: Date, endDate: Date) {
  // Get total metrics
  const views = await db.select({
    total: sql<number>`COUNT(*)`,
    unique: sql<number>`COUNT(DISTINCT ${pitchViews.viewerId})`,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} IN ${pitchIds}`,
    gte(pitchViews.viewedAt, startDate),
    lte(pitchViews.viewedAt, endDate)
  ));

  const ndasSigned = await db.select({
    total: sql<number>`COUNT(*)`,
    basic: sql<number>`COUNT(CASE WHEN ${ndas.ndaType} = 'basic' THEN 1 END)`,
    enhanced: sql<number>`COUNT(CASE WHEN ${ndas.ndaType} = 'enhanced' THEN 1 END)`,
    custom: sql<number>`COUNT(CASE WHEN ${ndas.ndaType} = 'custom' THEN 1 END)`,
  })
  .from(ndas)
  .where(and(
    sql`${ndas.pitchId} IN ${pitchIds}`,
    gte(ndas.signedAt, startDate),
    lte(ndas.signedAt, endDate)
  ));

  const followers = await db.select({
    total: sql<number>`COUNT(*)`,
  })
  .from(follows)
  .where(and(
    sql`${follows.pitchId} IN ${pitchIds}`,
    gte(follows.followedAt, startDate),
    lte(follows.followedAt, endDate)
  ));

  const messagesReceived = await db.select({
    total: sql<number>`COUNT(*)`,
    offPlatformRequests: sql<number>`COUNT(CASE WHEN ${messages.offPlatformRequested} = true THEN 1 END)`,
  })
  .from(messages)
  .where(and(
    sql`${messages.pitchId} IN ${pitchIds}`,
    gte(messages.sentAt, startDate),
    lte(messages.sentAt, endDate)
  ));

  return {
    views: {
      total: views[0]?.total || 0,
      unique: views[0]?.unique || 0,
    },
    ndas: {
      total: ndasSigned[0]?.total || 0,
      byType: {
        basic: ndasSigned[0]?.basic || 0,
        enhanced: ndasSigned[0]?.enhanced || 0,
        custom: ndasSigned[0]?.custom || 0,
      },
    },
    followers: followers[0]?.total || 0,
    messages: {
      received: messagesReceived[0]?.total || 0,
      offPlatformRequests: messagesReceived[0]?.offPlatformRequests || 0,
    },
  };
}

async function getDetailedReport(
  userPitches: any[], 
  pitchIds: number[], 
  startDate: Date, 
  endDate: Date
) {
  const detailedData = [];

  for (const pitch of userPitches) {
    // Get views for this pitch
    const pitchViews = await db.select({
      date: sql<string>`DATE(${pitchViews.viewedAt})`,
      views: sql<number>`COUNT(*)`,
      uniqueViewers: sql<number>`COUNT(DISTINCT ${pitchViews.viewerId})`,
      avgDuration: sql<number>`AVG(${pitchViews.viewDuration})`,
      avgScrollDepth: sql<number>`AVG(${pitchViews.scrollDepth})`,
    })
    .from(pitchViews)
    .where(and(
      eq(pitchViews.pitchId, pitch.id),
      gte(pitchViews.viewedAt, startDate),
      lte(pitchViews.viewedAt, endDate)
    ))
    .groupBy(sql`DATE(${pitchViews.viewedAt})`)
    .orderBy(sql`DATE(${pitchViews.viewedAt})`);

    // Get NDAs for this pitch
    const pitchNDAs = await db.select({
      count: sql<number>`COUNT(*)`,
    })
    .from(ndas)
    .where(and(
      eq(ndas.pitchId, pitch.id),
      gte(ndas.signedAt, startDate),
      lte(ndas.signedAt, endDate)
    ));

    detailedData.push({
      pitchId: pitch.id,
      title: pitch.title,
      genre: pitch.genre,
      format: pitch.format,
      status: pitch.status,
      metrics: {
        totalViews: pitch.viewCount,
        totalLikes: pitch.likeCount,
        totalNDAs: pitch.ndaCount,
        periodViews: pitchViews.reduce((sum, day) => sum + day.views, 0),
        periodNDAs: pitchNDAs[0]?.count || 0,
      },
      dailyBreakdown: pitchViews,
    });
  }

  return detailedData;
}

async function getEngagementReport(pitchIds: number[], startDate: Date, endDate: Date) {
  // Get engagement metrics
  const engagement = await db.select({
    avgViewDuration: sql<number>`AVG(${pitchViews.viewDuration})`,
    avgScrollDepth: sql<number>`AVG(${pitchViews.scrollDepth})`,
    watchThisClicks: sql<number>`COUNT(CASE WHEN ${pitchViews.clickedWatchThis} = true THEN 1 END)`,
    totalViews: sql<number>`COUNT(*)`,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} IN ${pitchIds}`,
    gte(pitchViews.viewedAt, startDate),
    lte(pitchViews.viewedAt, endDate)
  ));

  // Get view sources
  const viewSources = await db.select({
    referrer: pitchViews.referrer,
    count: sql<number>`COUNT(*)`,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} IN ${pitchIds}`,
    gte(pitchViews.viewedAt, startDate),
    lte(pitchViews.viewedAt, endDate)
  ))
  .groupBy(pitchViews.referrer)
  .orderBy(desc(sql`COUNT(*)`));

  // Get viewer types
  const viewerTypes = await db.select({
    viewType: pitchViews.viewType,
    count: sql<number>`COUNT(*)`,
  })
  .from(pitchViews)
  .where(and(
    sql`${pitchViews.pitchId} IN ${pitchIds}`,
    gte(pitchViews.viewedAt, startDate),
    lte(pitchViews.viewedAt, endDate)
  ))
  .groupBy(pitchViews.viewType);

  return {
    metrics: {
      avgViewDuration: engagement[0]?.avgViewDuration || 0,
      avgScrollDepth: engagement[0]?.avgScrollDepth || 0,
      watchThisRate: engagement[0]?.totalViews 
        ? (engagement[0].watchThisClicks / engagement[0].totalViews * 100).toFixed(2) 
        : 0,
    },
    sources: viewSources,
    viewerTypes,
  };
}

async function getNDAReport(pitchIds: number[], startDate: Date, endDate: Date) {
  // Get NDA breakdown
  const ndaBreakdown = await db.select({
    ndaType: ndas.ndaType,
    count: sql<number>`COUNT(*)`,
    avgTimeToSign: sql<number>`AVG(EXTRACT(EPOCH FROM (${ndas.signedAt} - ${ndas.signedAt})))`, // Would need request time
  })
  .from(ndas)
  .where(and(
    sql`${ndas.pitchId} IN ${pitchIds}`,
    gte(ndas.signedAt, startDate),
    lte(ndas.signedAt, endDate)
  ))
  .groupBy(ndas.ndaType);

  // Get NDA conversion funnel
  const conversionFunnel = {
    views: 0, // Total views
    ndaRequests: 0, // NDA request page views
    ndasSigned: 0, // Actual NDAs signed
  };

  return {
    breakdown: ndaBreakdown,
    conversionFunnel,
    averageTimeToSign: '2.5 days', // Mock data
  };
}

async function getFinancialProjections(userPitches: any[]) {
  // Calculate potential revenue based on success fees
  const projections = userPitches.map(pitch => {
    const estimatedDealSize = pitch.estimatedBudget || 0;
    const successFeeRate = 0.03; // 3% success fee
    const dealProbability = calculateDealProbability(pitch);
    
    return {
      pitchId: pitch.id,
      title: pitch.title,
      estimatedDealSize,
      potentialSuccessFee: estimatedDealSize * successFeeRate,
      dealProbability,
      expectedValue: estimatedDealSize * successFeeRate * dealProbability,
    };
  });

  const totalExpectedValue = projections.reduce((sum, p) => sum + p.expectedValue, 0);

  return {
    projections,
    summary: {
      totalExpectedValue,
      avgDealSize: projections.reduce((sum, p) => sum + p.estimatedDealSize, 0) / projections.length,
      avgSuccessFee: totalExpectedValue / projections.length,
    },
  };
}

function calculateDealProbability(pitch: any): number {
  // Simple probability calculation based on engagement
  let probability = 0.1; // Base 10%
  
  if (pitch.ndaCount > 5) probability += 0.2;
  if (pitch.ndaCount > 10) probability += 0.2;
  if (pitch.viewCount > 1000) probability += 0.1;
  if (pitch.likeCount > 50) probability += 0.1;
  
  return Math.min(probability, 0.8); // Cap at 80%
}

function exportAsCSV(data: any, reportType: string): Response {
  let csv = '';
  
  // Convert nested data to CSV format
  if (reportType === 'summary') {
    csv = 'Metric,Value\n';
    csv += `Total Views,${data.summary.views.total}\n`;
    csv += `Unique Viewers,${data.summary.views.unique}\n`;
    csv += `Total NDAs,${data.summary.ndas.total}\n`;
    csv += `Followers,${data.summary.followers}\n`;
    csv += `Messages Received,${data.summary.messages.received}\n`;
  } else {
    // For other report types, flatten the data structure
    csv = JSON.stringify(data, null, 2); // Simplified for now
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="analytics_${reportType}_${Date.now()}.csv"`,
    },
  });
}

function exportAsPDF(data: any, reportType: string): Response {
  // In production, this would use a PDF generation library
  // For now, return a formatted text representation
  
  const pdfContent = `
ANALYTICS REPORT - ${reportType.toUpperCase()}
Generated: ${new Date().toISOString()}
================================

${JSON.stringify(data, null, 2)}
  `;

  return new Response(pdfContent, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="analytics_${reportType}_${Date.now()}.pdf"`,
    },
  });
}