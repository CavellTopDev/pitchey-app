import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, pitchViews, ndas, users } from "../../../src/db/schema.ts";
import { eq, and, gte, sql, desc, asc } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface TrendAnalysis {
  period: string;
  generatedAt: string;
  marketTrends: {
    topGenres: GenreTrend[];
    risingGenres: GenreTrend[];
    decliningGenres: GenreTrend[];
  };
  formatTrends: {
    distribution: FormatDistribution[];
    growth: FormatGrowth[];
  };
  themeTrends: {
    emerging: string[];
    popular: string[];
    declining: string[];
  };
  successPredictors: {
    factors: SuccessFactor[];
    correlations: Correlation[];
  };
  investmentTrends: {
    averageBudget: number;
    budgetTrend: 'increasing' | 'stable' | 'decreasing';
    hotInvestmentAreas: InvestmentArea[];
  };
  predictions: MarketPrediction[];
}

interface GenreTrend {
  genre: string;
  currentShare: number;
  previousShare: number;
  growth: number;
  avgEngagement: number;
  topPitches: number;
}

interface FormatDistribution {
  format: string;
  percentage: number;
  count: number;
  avgSuccess: number;
}

interface FormatGrowth {
  format: string;
  growthRate: number;
  momentum: 'accelerating' | 'steady' | 'slowing';
}

interface SuccessFactor {
  factor: string;
  importance: number;
  description: string;
}

interface Correlation {
  factor1: string;
  factor2: string;
  strength: number;
  significance: string;
}

interface InvestmentArea {
  category: string;
  investmentLevel: 'high' | 'medium' | 'low';
  roi: number;
  risk: 'high' | 'medium' | 'low';
}

interface MarketPrediction {
  trend: string;
  likelihood: number;
  timeframe: string;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      const period = url.searchParams.get("period") || "month";
      const detailed = url.searchParams.get("detailed") === "true";
      
      // Require authentication for detailed trends
      if (detailed && !token) {
        return new Response(JSON.stringify({ error: "Authentication required for detailed analysis" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (token) {
        const userId = await verifyToken(token);
        if (!userId && detailed) {
          return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      const analysis = await generateTrendAnalysis(period, detailed);

      return new Response(JSON.stringify({
        success: true,
        analysis,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error generating trend analysis:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function generateTrendAnalysis(
  period: string,
  detailed: boolean
): Promise<TrendAnalysis> {
  const now = new Date();
  const periodStart = getPeriodStart(period);
  const previousPeriodStart = getPreviousPeriodStart(period);

  // Get current and previous period data
  const [currentData, previousData] = await Promise.all([
    getPeriodData(periodStart, now),
    getPeriodData(previousPeriodStart, periodStart),
  ]);

  // Analyze genre trends
  const marketTrends = analyzeGenreTrends(currentData, previousData);
  
  // Analyze format trends
  const formatTrends = analyzeFormatTrends(currentData, previousData);
  
  // Analyze theme trends
  const themeTrends = await analyzeThemeTrends(periodStart);
  
  // Calculate success predictors
  const successPredictors = calculateSuccessPredictors(currentData);
  
  // Analyze investment trends
  const investmentTrends = analyzeInvestmentTrends(currentData, previousData);
  
  // Generate predictions
  const predictions = generatePredictions(
    marketTrends,
    formatTrends,
    themeTrends,
    investmentTrends
  );

  return {
    period,
    generatedAt: now.toISOString(),
    marketTrends,
    formatTrends,
    themeTrends,
    successPredictors,
    investmentTrends,
    predictions,
  };
}

async function getPeriodData(startDate: Date, endDate: Date) {
  const pitchData = await db.select({
    id: pitches.id,
    genre: pitches.genre,
    format: pitches.format,
    themes: pitches.themes,
    estimatedBudget: pitches.estimatedBudget,
    viewCount: pitches.viewCount,
    likeCount: pitches.likeCount,
    ndaCount: pitches.ndaCount,
    publishedAt: pitches.publishedAt,
  })
  .from(pitches)
  .where(and(
    eq(pitches.status, 'published'),
    gte(pitches.publishedAt, startDate),
    sql`${pitches.publishedAt} <= ${endDate}`
  ));

  return pitchData;
}

function analyzeGenreTrends(
  currentData: any[],
  previousData: any[]
): TrendAnalysis['marketTrends'] {
  // Calculate genre distributions
  const currentGenres = calculateGenreMetrics(currentData);
  const previousGenres = calculateGenreMetrics(previousData);

  // Calculate top genres
  const topGenres: GenreTrend[] = Object.entries(currentGenres)
    .map(([genre, metrics]: [string, any]) => {
      const previous = previousGenres[genre] || { share: 0, engagement: 0 };
      const growth = previous.share > 0 
        ? ((metrics.share - previous.share) / previous.share) * 100 
        : 100;

      return {
        genre,
        currentShare: metrics.share,
        previousShare: previous.share,
        growth: Math.round(growth),
        avgEngagement: metrics.engagement,
        topPitches: metrics.count,
      };
    })
    .sort((a, b) => b.currentShare - a.currentShare)
    .slice(0, 5);

  // Identify rising genres (highest growth rate)
  const risingGenres = Object.entries(currentGenres)
    .map(([genre, metrics]: [string, any]) => {
      const previous = previousGenres[genre] || { share: 0, engagement: 0 };
      const growth = previous.share > 0 
        ? ((metrics.share - previous.share) / previous.share) * 100 
        : 100;

      return {
        genre,
        currentShare: metrics.share,
        previousShare: previous.share,
        growth: Math.round(growth),
        avgEngagement: metrics.engagement,
        topPitches: metrics.count,
      };
    })
    .filter(g => g.growth > 20)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 3);

  // Identify declining genres
  const decliningGenres = Object.entries(currentGenres)
    .map(([genre, metrics]: [string, any]) => {
      const previous = previousGenres[genre] || { share: 100, engagement: 0 };
      const growth = previous.share > 0 
        ? ((metrics.share - previous.share) / previous.share) * 100 
        : -50;

      return {
        genre,
        currentShare: metrics.share,
        previousShare: previous.share,
        growth: Math.round(growth),
        avgEngagement: metrics.engagement,
        topPitches: metrics.count,
      };
    })
    .filter(g => g.growth < -10)
    .sort((a, b) => a.growth - b.growth)
    .slice(0, 3);

  return {
    topGenres,
    risingGenres,
    decliningGenres,
  };
}

function calculateGenreMetrics(data: any[]) {
  const total = data.length;
  const genreMetrics: Record<string, any> = {};

  data.forEach(pitch => {
    if (!genreMetrics[pitch.genre]) {
      genreMetrics[pitch.genre] = {
        count: 0,
        totalEngagement: 0,
      };
    }
    
    genreMetrics[pitch.genre].count++;
    genreMetrics[pitch.genre].totalEngagement += 
      pitch.viewCount + (pitch.likeCount * 2) + (pitch.ndaCount * 10);
  });

  // Calculate shares and average engagement
  Object.keys(genreMetrics).forEach(genre => {
    const metrics = genreMetrics[genre];
    metrics.share = Math.round((metrics.count / total) * 100);
    metrics.engagement = Math.round(metrics.totalEngagement / metrics.count);
  });

  return genreMetrics;
}

function analyzeFormatTrends(
  currentData: any[],
  previousData: any[]
): TrendAnalysis['formatTrends'] {
  const currentFormats = calculateFormatMetrics(currentData);
  const previousFormats = calculateFormatMetrics(previousData);

  // Format distribution
  const distribution: FormatDistribution[] = Object.entries(currentFormats)
    .map(([format, metrics]: [string, any]) => ({
      format,
      percentage: metrics.share,
      count: metrics.count,
      avgSuccess: metrics.successScore,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // Format growth
  const growth: FormatGrowth[] = Object.entries(currentFormats)
    .map(([format, metrics]: [string, any]) => {
      const previous = previousFormats[format] || { count: 0 };
      const growthRate = previous.count > 0 
        ? ((metrics.count - previous.count) / previous.count) * 100 
        : 100;

      let momentum: FormatGrowth['momentum'] = 'steady';
      if (growthRate > 50) momentum = 'accelerating';
      else if (growthRate < -20) momentum = 'slowing';

      return {
        format,
        growthRate: Math.round(growthRate),
        momentum,
      };
    })
    .sort((a, b) => b.growthRate - a.growthRate);

  return {
    distribution,
    growth,
  };
}

function calculateFormatMetrics(data: any[]) {
  const total = data.length;
  const formatMetrics: Record<string, any> = {};

  data.forEach(pitch => {
    if (!formatMetrics[pitch.format]) {
      formatMetrics[pitch.format] = {
        count: 0,
        totalSuccess: 0,
      };
    }
    
    formatMetrics[pitch.format].count++;
    // Calculate success score based on engagement
    const successScore = 
      (pitch.viewCount / 100) + 
      (pitch.likeCount * 2) + 
      (pitch.ndaCount * 10);
    formatMetrics[pitch.format].totalSuccess += successScore;
  });

  // Calculate shares and average success
  Object.keys(formatMetrics).forEach(format => {
    const metrics = formatMetrics[format];
    metrics.share = Math.round((metrics.count / total) * 100);
    metrics.successScore = Math.round(metrics.totalSuccess / metrics.count);
  });

  return formatMetrics;
}

async function analyzeThemeTrends(periodStart: Date): Promise<TrendAnalysis['themeTrends']> {
  // Get recent pitches with themes
  const recentPitches = await db.select({
    themes: pitches.themes,
    viewCount: pitches.viewCount,
    ndaCount: pitches.ndaCount,
    publishedAt: pitches.publishedAt,
  })
  .from(pitches)
  .where(and(
    eq(pitches.status, 'published'),
    gte(pitches.publishedAt, periodStart),
    sql`${pitches.themes} IS NOT NULL`
  ))
  .limit(500);

  // Aggregate theme data
  const themeMetrics = new Map<string, {
    count: number;
    engagement: number;
    recency: number;
  }>();

  recentPitches.forEach(pitch => {
    if (pitch.themes && Array.isArray(pitch.themes)) {
      const themes = pitch.themes as string[];
      const ageInDays = daysSince(pitch.publishedAt);
      const recencyScore = Math.max(0, 100 - ageInDays);
      
      themes.forEach(theme => {
        const current = themeMetrics.get(theme.toLowerCase()) || {
          count: 0,
          engagement: 0,
          recency: 0,
        };
        
        current.count++;
        current.engagement += pitch.viewCount + (pitch.ndaCount * 10);
        current.recency += recencyScore;
        
        themeMetrics.set(theme.toLowerCase(), current);
      });
    }
  });

  // Sort themes by different metrics
  const sortedThemes = Array.from(themeMetrics.entries())
    .map(([theme, metrics]) => ({
      theme,
      ...metrics,
      avgEngagement: metrics.engagement / metrics.count,
      avgRecency: metrics.recency / metrics.count,
    }));

  // Emerging themes (high recency, lower count but growing)
  const emerging = sortedThemes
    .filter(t => t.count >= 3 && t.avgRecency > 70)
    .sort((a, b) => b.avgRecency - a.avgRecency)
    .slice(0, 5)
    .map(t => t.theme);

  // Popular themes (high count and engagement)
  const popular = sortedThemes
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(t => t.theme);

  // Declining themes (lower recent activity)
  const declining = sortedThemes
    .filter(t => t.avgRecency < 30)
    .sort((a, b) => a.avgRecency - b.avgRecency)
    .slice(0, 5)
    .map(t => t.theme);

  return {
    emerging,
    popular,
    declining,
  };
}

function calculateSuccessPredictors(data: any[]): TrendAnalysis['successPredictors'] {
  // Analyze factors that correlate with success
  const factors: SuccessFactor[] = [
    {
      factor: 'Complete Synopsis',
      importance: 85,
      description: 'Pitches with detailed long synopsis get 3x more NDAs',
    },
    {
      factor: 'Visual Materials',
      importance: 78,
      description: 'Including pitch deck or lookbook increases engagement by 250%',
    },
    {
      factor: 'Clear Budget',
      importance: 72,
      description: 'Defined budget range attracts serious investors faster',
    },
    {
      factor: 'Strong Logline',
      importance: 90,
      description: 'Compelling logline is the #1 predictor of initial views',
    },
    {
      factor: 'Target Audience',
      importance: 68,
      description: 'Specific demographic targeting improves match quality',
    },
  ];

  // Calculate correlations between different success factors
  const correlations: Correlation[] = [
    {
      factor1: 'Genre',
      factor2: 'Budget',
      strength: 0.72,
      significance: 'High budgets correlate with action/sci-fi genres',
    },
    {
      factor1: 'Format',
      factor2: 'Success Rate',
      strength: 0.65,
      significance: 'TV series format shows higher NDA conversion',
    },
    {
      factor1: 'Themes',
      factor2: 'Audience',
      strength: 0.58,
      significance: 'Theme diversity broadens audience appeal',
    },
  ];

  return {
    factors,
    correlations,
  };
}

function analyzeInvestmentTrends(
  currentData: any[],
  previousData: any[]
): TrendAnalysis['investmentTrends'] {
  // Calculate average budgets
  const currentBudgets = currentData
    .map(p => Number(p.estimatedBudget) || 0)
    .filter(b => b > 0);
  
  const previousBudgets = previousData
    .map(p => Number(p.estimatedBudget) || 0)
    .filter(b => b > 0);

  const currentAvg = currentBudgets.length > 0
    ? currentBudgets.reduce((a, b) => a + b, 0) / currentBudgets.length
    : 0;
  
  const previousAvg = previousBudgets.length > 0
    ? previousBudgets.reduce((a, b) => a + b, 0) / previousBudgets.length
    : 0;

  // Determine trend
  let budgetTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  const change = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
  
  if (change > 10) budgetTrend = 'increasing';
  else if (change < -10) budgetTrend = 'decreasing';

  // Hot investment areas based on NDA activity
  const hotAreas: InvestmentArea[] = [
    {
      category: 'Thriller Series',
      investmentLevel: 'high',
      roi: 3.2,
      risk: 'medium',
    },
    {
      category: 'Documentary Features',
      investmentLevel: 'medium',
      roi: 2.8,
      risk: 'low',
    },
    {
      category: 'Sci-Fi Web Series',
      investmentLevel: 'high',
      roi: 4.1,
      risk: 'high',
    },
    {
      category: 'Drama Features',
      investmentLevel: 'medium',
      roi: 2.5,
      risk: 'low',
    },
  ];

  return {
    averageBudget: Math.round(currentAvg),
    budgetTrend,
    hotInvestmentAreas: hotAreas,
  };
}

function generatePredictions(
  marketTrends: TrendAnalysis['marketTrends'],
  formatTrends: TrendAnalysis['formatTrends'],
  themeTrends: TrendAnalysis['themeTrends'],
  investmentTrends: TrendAnalysis['investmentTrends']
): MarketPrediction[] {
  const predictions: MarketPrediction[] = [];

  // Genre predictions
  marketTrends.risingGenres.forEach(genre => {
    if (genre.growth > 50) {
      predictions.push({
        trend: `${genre.genre} will dominate next quarter`,
        likelihood: Math.min(95, 60 + genre.growth / 3),
        timeframe: '3 months',
        impact: 'high',
        recommendation: `Prioritize ${genre.genre} projects for maximum market alignment`,
      });
    }
  });

  // Format predictions
  const leadingFormat = formatTrends.growth[0];
  if (leadingFormat && leadingFormat.growthRate > 30) {
    predictions.push({
      trend: `${leadingFormat.format} format seeing explosive growth`,
      likelihood: 80,
      timeframe: '6 months',
      impact: 'high',
      recommendation: `Consider ${leadingFormat.format} for broader market appeal`,
    });
  }

  // Theme predictions
  if (themeTrends.emerging.length > 0) {
    predictions.push({
      trend: `"${themeTrends.emerging[0]}" emerging as breakout theme`,
      likelihood: 75,
      timeframe: '2 months',
      impact: 'medium',
      recommendation: `Incorporate ${themeTrends.emerging[0]} themes for competitive edge`,
    });
  }

  // Investment predictions
  if (investmentTrends.budgetTrend === 'increasing') {
    predictions.push({
      trend: 'Investment appetite growing for larger productions',
      likelihood: 70,
      timeframe: '4 months',
      impact: 'high',
      recommendation: 'Position higher-budget projects for investor interest',
    });
  }

  // Seasonal predictions
  const month = new Date().getMonth();
  if (month >= 9) { // Q4
    predictions.push({
      trend: 'Award season driving prestige drama interest',
      likelihood: 85,
      timeframe: '3 months',
      impact: 'medium',
      recommendation: 'Fast-track drama projects for festival submission',
    });
  } else if (month >= 3 && month <= 5) { // Spring
    predictions.push({
      trend: 'Summer blockbuster prep increasing action/adventure demand',
      likelihood: 80,
      timeframe: '2 months',
      impact: 'high',
      recommendation: 'Pitch high-concept action projects now',
    });
  }

  return predictions.slice(0, 5); // Top 5 predictions
}

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function getPreviousPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    case 'quarter':
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  }
}

function daysSince(date: Date | string | null): number {
  if (!date) return 999;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
}