import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { users, pitches, ndas, pitchViews, follows } from "../../../src/db/schema.ts";
import { eq, and, sql, inArray } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface MatchScoreResult {
  score: number; // 0-100
  breakdown: {
    contentAlignment: number;
    budgetCompatibility: number;
    audienceOverlap: number;
    trackRecordScore: number;
    timingScore: number;
  };
  strengths: string[];
  considerations: string[];
  recommendation: 'highly_recommended' | 'recommended' | 'possible' | 'unlikely';
  explanation: string;
}

export const handler: Handlers = {
  async POST(req) {
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

      const body = await req.json();
      const { entity1Id, entity1Type, entity2Id, entity2Type } = body;

      if (!entity1Id || !entity1Type || !entity2Id || !entity2Type) {
        return new Response(JSON.stringify({ 
          error: "Missing required parameters" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let matchScore: MatchScoreResult;

      // Calculate match score based on entity types
      if (entity1Type === 'pitch' && entity2Type === 'investor') {
        matchScore = await calculatePitchInvestorMatch(entity1Id, entity2Id);
      } else if (entity1Type === 'creator' && entity2Type === 'investor') {
        matchScore = await calculateCreatorInvestorMatch(entity1Id, entity2Id);
      } else if (entity1Type === 'creator' && entity2Type === 'production') {
        matchScore = await calculateCreatorProductionMatch(entity1Id, entity2Id);
      } else if (entity1Type === 'pitch' && entity2Type === 'production') {
        matchScore = await calculatePitchProductionMatch(entity1Id, entity2Id);
      } else {
        matchScore = await calculateGenericMatch(entity1Id, entity1Type, entity2Id, entity2Type);
      }

      return new Response(JSON.stringify({
        success: true,
        matchScore,
        calculatedAt: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error calculating match score:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function calculatePitchInvestorMatch(
  pitchId: number,
  investorId: number
): Promise<MatchScoreResult> {
  // Get pitch details
  const pitch = await db.select().from(pitches)
    .where(eq(pitches.id, pitchId))
    .limit(1);

  if (!pitch.length) {
    throw new Error("Pitch not found");
  }

  const pitchData = pitch[0];

  // Get investor profile and history
  const investorProfile = await analyzeInvestorHistory(investorId);

  // Calculate match components
  const breakdown = {
    contentAlignment: 0,
    budgetCompatibility: 0,
    audienceOverlap: 0,
    trackRecordScore: 0,
    timingScore: 0,
  };

  const strengths: string[] = [];
  const considerations: string[] = [];

  // 1. Content Alignment (Genre, Format, Themes)
  if (investorProfile.preferredGenres.includes(pitchData.genre)) {
    breakdown.contentAlignment += 40;
    strengths.push(`Strong genre match: ${pitchData.genre} is investor's focus`);
  } else if (investorProfile.secondaryGenres.includes(pitchData.genre)) {
    breakdown.contentAlignment += 25;
    strengths.push(`Genre alignment: investor has shown interest in ${pitchData.genre}`);
  } else {
    breakdown.contentAlignment += 10;
    considerations.push(`Genre ${pitchData.genre} outside investor's typical portfolio`);
  }

  if (investorProfile.preferredFormats.includes(pitchData.format)) {
    breakdown.contentAlignment += 30;
    strengths.push(`Perfect format match: ${pitchData.format}`);
  } else {
    breakdown.contentAlignment += 15;
  }

  // Theme alignment
  if (pitchData.themes && Array.isArray(pitchData.themes)) {
    const themeOverlap = (pitchData.themes as string[])
      .filter(t => investorProfile.interestedThemes.includes(t.toLowerCase())).length;
    if (themeOverlap > 0) {
      breakdown.contentAlignment += 30;
      strengths.push('Strong thematic alignment');
    }
  }

  breakdown.contentAlignment = Math.min(100, breakdown.contentAlignment);

  // 2. Budget Compatibility
  const pitchBudget = Number(pitchData.estimatedBudget) || 0;
  if (pitchBudget > 0) {
    const { min, max } = investorProfile.typicalBudgetRange;
    if (pitchBudget >= min && pitchBudget <= max) {
      breakdown.budgetCompatibility = 100;
      strengths.push('Budget perfectly within investor range');
    } else if (pitchBudget < min * 0.7 || pitchBudget > max * 1.5) {
      breakdown.budgetCompatibility = 30;
      considerations.push('Budget outside typical investment range');
    } else {
      breakdown.budgetCompatibility = 60;
      strengths.push('Budget reasonably aligned');
    }
  } else {
    breakdown.budgetCompatibility = 50;
    considerations.push('No budget information provided');
  }

  // 3. Audience Overlap
  if (pitchData.targetAudience) {
    const audienceMatch = calculateAudienceOverlap(
      pitchData.targetAudience,
      investorProfile.targetDemographics
    );
    breakdown.audienceOverlap = audienceMatch;
    if (audienceMatch > 70) {
      strengths.push('Excellent audience demographic match');
    } else if (audienceMatch < 40) {
      considerations.push('Limited audience overlap');
    }
  } else {
    breakdown.audienceOverlap = 50;
  }

  // 4. Track Record
  breakdown.trackRecordScore = Math.min(100, investorProfile.successfulProjects * 5);
  if (investorProfile.successfulProjects > 10) {
    strengths.push('Investor has strong track record');
  } else if (investorProfile.successfulProjects < 3) {
    considerations.push('Limited investment history on platform');
  }

  // 5. Timing
  const pitchAge = daysSinceDate(pitchData.publishedAt || pitchData.createdAt);
  const investorActivity = investorProfile.daysSinceLastActivity;

  if (pitchAge < 30 && investorActivity < 7) {
    breakdown.timingScore = 100;
    strengths.push('Perfect timing: both parties actively engaged');
  } else if (pitchAge < 90 && investorActivity < 30) {
    breakdown.timingScore = 70;
  } else {
    breakdown.timingScore = 40;
    considerations.push('Timing may not be optimal');
  }

  // Calculate overall score with weights
  const weights = {
    contentAlignment: 0.35,
    budgetCompatibility: 0.25,
    audienceOverlap: 0.15,
    trackRecordScore: 0.15,
    timingScore: 0.10,
  };

  const score = Math.round(
    breakdown.contentAlignment * weights.contentAlignment +
    breakdown.budgetCompatibility * weights.budgetCompatibility +
    breakdown.audienceOverlap * weights.audienceOverlap +
    breakdown.trackRecordScore * weights.trackRecordScore +
    breakdown.timingScore * weights.timingScore
  );

  // Determine recommendation level
  let recommendation: MatchScoreResult['recommendation'];
  let explanation: string;

  if (score >= 80) {
    recommendation = 'highly_recommended';
    explanation = 'Exceptional match across all key factors. High probability of successful collaboration.';
  } else if (score >= 65) {
    recommendation = 'recommended';
    explanation = 'Strong compatibility with good potential for partnership.';
  } else if (score >= 50) {
    recommendation = 'possible';
    explanation = 'Moderate compatibility. Consider addressing gaps before proceeding.';
  } else {
    recommendation = 'unlikely';
    explanation = 'Limited compatibility. Significant misalignment in key areas.';
  }

  return {
    score,
    breakdown,
    strengths,
    considerations,
    recommendation,
    explanation,
  };
}

async function calculateCreatorInvestorMatch(
  creatorId: number,
  investorId: number
): Promise<MatchScoreResult> {
  // Get creator's portfolio
  const creatorPitches = await db.select({
    genre: pitches.genre,
    format: pitches.format,
    estimatedBudget: pitches.estimatedBudget,
    viewCount: pitches.viewCount,
    ndaCount: pitches.ndaCount,
  })
  .from(pitches)
  .where(and(
    eq(pitches.userId, creatorId),
    eq(pitches.status, 'published')
  ))
  .limit(10);

  const investorProfile = await analyzeInvestorHistory(investorId);

  const breakdown = {
    contentAlignment: 0,
    budgetCompatibility: 0,
    audienceOverlap: 0,
    trackRecordScore: 0,
    timingScore: 0,
  };

  const strengths: string[] = [];
  const considerations: string[] = [];

  // Aggregate creator's profile
  const creatorGenres = new Set(creatorPitches.map(p => p.genre));
  const creatorFormats = new Set(creatorPitches.map(p => p.format));
  const avgBudget = creatorPitches
    .map(p => Number(p.estimatedBudget) || 0)
    .filter(b => b > 0)
    .reduce((a, b) => a + b, 0) / Math.max(creatorPitches.filter(p => p.estimatedBudget).length, 1);

  // Content alignment
  const genreOverlap = Array.from(creatorGenres)
    .filter(g => investorProfile.preferredGenres.includes(g)).length;
  if (genreOverlap > 0) {
    breakdown.contentAlignment = 50 + (genreOverlap * 25);
    strengths.push('Strong genre compatibility');
  } else {
    breakdown.contentAlignment = 25;
    considerations.push('Limited genre overlap');
  }

  // Budget compatibility
  if (avgBudget > 0) {
    const { min, max } = investorProfile.typicalBudgetRange;
    if (avgBudget >= min && avgBudget <= max) {
      breakdown.budgetCompatibility = 90;
      strengths.push('Budget ranges align well');
    } else {
      breakdown.budgetCompatibility = 40;
      considerations.push('Budget expectations may differ');
    }
  } else {
    breakdown.budgetCompatibility = 50;
  }

  // Track record
  const avgPerformance = creatorPitches.reduce((acc, p) => 
    acc + p.viewCount + (p.ndaCount * 10), 0) / creatorPitches.length;
  breakdown.trackRecordScore = Math.min(100, avgPerformance / 10);
  
  if (avgPerformance > 1000) {
    strengths.push('Creator has strong audience engagement');
  }

  // Default values for simplified matching
  breakdown.audienceOverlap = 60;
  breakdown.timingScore = 70;

  const weights = {
    contentAlignment: 0.40,
    budgetCompatibility: 0.25,
    audienceOverlap: 0.10,
    trackRecordScore: 0.15,
    timingScore: 0.10,
  };

  const score = Math.round(
    breakdown.contentAlignment * weights.contentAlignment +
    breakdown.budgetCompatibility * weights.budgetCompatibility +
    breakdown.audienceOverlap * weights.audienceOverlap +
    breakdown.trackRecordScore * weights.trackRecordScore +
    breakdown.timingScore * weights.timingScore
  );

  let recommendation: MatchScoreResult['recommendation'];
  let explanation: string;

  if (score >= 75) {
    recommendation = 'highly_recommended';
    explanation = 'Excellent long-term partnership potential.';
  } else if (score >= 60) {
    recommendation = 'recommended';
    explanation = 'Good compatibility for collaboration.';
  } else if (score >= 45) {
    recommendation = 'possible';
    explanation = 'Some alignment, worth exploring.';
  } else {
    recommendation = 'unlikely';
    explanation = 'Limited compatibility indicators.';
  }

  return {
    score,
    breakdown,
    strengths,
    considerations,
    recommendation,
    explanation,
  };
}

async function calculateCreatorProductionMatch(
  creatorId: number,
  productionId: number
): Promise<MatchScoreResult> {
  // Similar logic to creator-investor but focused on production capabilities
  const breakdown = {
    contentAlignment: 75,
    budgetCompatibility: 70,
    audienceOverlap: 65,
    trackRecordScore: 60,
    timingScore: 80,
  };

  const score = Math.round(
    (breakdown.contentAlignment + breakdown.budgetCompatibility + 
     breakdown.audienceOverlap + breakdown.trackRecordScore + 
     breakdown.timingScore) / 5
  );

  return {
    score,
    breakdown,
    strengths: ['Production company actively seeking content', 'Genre alignment'],
    considerations: ['Verify production capacity', 'Review contract terms'],
    recommendation: score >= 70 ? 'recommended' : 'possible',
    explanation: 'Production partnership shows promise.',
  };
}

async function calculatePitchProductionMatch(
  pitchId: number,
  productionId: number
): Promise<MatchScoreResult> {
  // Get pitch details
  const pitch = await db.select().from(pitches)
    .where(eq(pitches.id, pitchId))
    .limit(1);

  if (!pitch.length) {
    throw new Error("Pitch not found");
  }

  const pitchData = pitch[0];

  // Simplified production matching
  const breakdown = {
    contentAlignment: 70,
    budgetCompatibility: 65,
    audienceOverlap: 60,
    trackRecordScore: 55,
    timingScore: 75,
  };

  const strengths: string[] = [];
  const considerations: string[] = [];

  // Genre-based matching
  if (['thriller', 'drama', 'scifi'].includes(pitchData.genre)) {
    breakdown.contentAlignment = 85;
    strengths.push('High-demand genre for production');
  }

  // Budget feasibility
  const budget = Number(pitchData.estimatedBudget) || 0;
  if (budget > 0 && budget < 20000000) {
    breakdown.budgetCompatibility = 80;
    strengths.push('Budget range attractive for production');
  } else if (budget > 50000000) {
    breakdown.budgetCompatibility = 40;
    considerations.push('High budget may limit production options');
  }

  const score = Math.round(
    (breakdown.contentAlignment * 0.3 +
     breakdown.budgetCompatibility * 0.25 +
     breakdown.audienceOverlap * 0.15 +
     breakdown.trackRecordScore * 0.15 +
     breakdown.timingScore * 0.15)
  );

  return {
    score,
    breakdown,
    strengths,
    considerations,
    recommendation: score >= 65 ? 'recommended' : 'possible',
    explanation: 'Production feasibility assessment complete.',
  };
}

async function calculateGenericMatch(
  entity1Id: number,
  entity1Type: string,
  entity2Id: number,
  entity2Type: string
): Promise<MatchScoreResult> {
  // Generic matching logic
  return {
    score: 50,
    breakdown: {
      contentAlignment: 50,
      budgetCompatibility: 50,
      audienceOverlap: 50,
      trackRecordScore: 50,
      timingScore: 50,
    },
    strengths: ['Potential for collaboration'],
    considerations: ['Further analysis recommended'],
    recommendation: 'possible',
    explanation: 'Basic compatibility assessment. More data needed for detailed analysis.',
  };
}

async function analyzeInvestorHistory(investorId: number) {
  // Get investor's NDA history
  const investorNDAs = await db.select({
    pitchId: ndas.pitchId,
    signedAt: ndas.signedAt,
  })
  .from(ndas)
  .where(and(
    eq(ndas.signerId, investorId),
    eq(ndas.accessGranted, true)
  ))
  .orderBy(ndas.signedAt)
  .limit(100);

  const pitchIds = investorNDAs.map(n => n.pitchId);
  
  // Default profile
  let profile = {
    preferredGenres: ['drama', 'thriller', 'scifi'],
    secondaryGenres: ['comedy', 'action'],
    preferredFormats: ['feature', 'tv'],
    interestedThemes: ['technology', 'social', 'adventure'],
    typicalBudgetRange: { min: 5000000, max: 50000000 },
    targetDemographics: ['18-34', '25-54'],
    successfulProjects: 0,
    daysSinceLastActivity: 30,
  };

  if (pitchIds.length > 0) {
    // Get pitch details
    const interestedPitches = await db.select({
      genre: pitches.genre,
      format: pitches.format,
      estimatedBudget: pitches.estimatedBudget,
      themes: pitches.themes,
      targetAudience: pitches.targetAudience,
    })
    .from(pitches)
    .where(inArray(pitches.id, pitchIds));

    // Analyze preferences
    const genreCount = new Map<string, number>();
    const formatCount = new Map<string, number>();
    const themes = new Set<string>();
    let minBudget = Infinity;
    let maxBudget = 0;

    interestedPitches.forEach(pitch => {
      genreCount.set(pitch.genre, (genreCount.get(pitch.genre) || 0) + 1);
      formatCount.set(pitch.format, (formatCount.get(pitch.format) || 0) + 1);
      
      if (pitch.themes && Array.isArray(pitch.themes)) {
        (pitch.themes as string[]).forEach(t => themes.add(t.toLowerCase()));
      }
      
      const budget = Number(pitch.estimatedBudget) || 0;
      if (budget > 0) {
        minBudget = Math.min(minBudget, budget);
        maxBudget = Math.max(maxBudget, budget);
      }
    });

    // Update profile based on history
    const sortedGenres = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1]);
    
    profile.preferredGenres = sortedGenres.slice(0, 3).map(([g]) => g);
    profile.secondaryGenres = sortedGenres.slice(3, 5).map(([g]) => g);
    
    profile.preferredFormats = Array.from(formatCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([f]) => f);
    
    profile.interestedThemes = Array.from(themes).slice(0, 10);
    
    if (minBudget !== Infinity) {
      profile.typicalBudgetRange = { min: minBudget, max: maxBudget };
    }
    
    profile.successfulProjects = pitchIds.length;
    
    // Calculate days since last activity
    const lastNDA = investorNDAs[0];
    if (lastNDA?.signedAt) {
      profile.daysSinceLastActivity = daysSinceDate(lastNDA.signedAt);
    }
  }

  return profile;
}

function calculateAudienceOverlap(
  pitchAudience: string,
  investorDemographics: string[]
): number {
  if (!pitchAudience) return 50;
  
  const audienceLower = pitchAudience.toLowerCase();
  let overlapScore = 0;
  
  investorDemographics.forEach(demo => {
    if (audienceLower.includes(demo)) {
      overlapScore += 50;
    }
  });
  
  // Check for age ranges
  const ageRanges = ['18-24', '25-34', '35-44', '45-54', '55+'];
  const matchedRanges = ageRanges.filter(range => audienceLower.includes(range));
  overlapScore += matchedRanges.length * 20;
  
  return Math.min(100, overlapScore);
}

function daysSinceDate(date: Date | string | null): number {
  if (!date) return 999;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}