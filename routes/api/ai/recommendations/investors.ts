import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { users, pitches, ndas, pitchViews } from "../../../../src/db/schema.ts";
import { eq, and, ne, desc, sql, inArray, gte, lte } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

interface InvestorMatch {
  investorId: number;
  username: string;
  companyName?: string;
  profileImage?: string;
  investmentProfile: {
    preferredGenres: string[];
    preferredFormats: string[];
    budgetRange: {
      min: number;
      max: number;
    };
    activeDeals: number;
    totalInvestments: number;
  };
  matchScore: number;
  matchReasons: string[];
  compatibilityFactors: {
    genreAlignment: number;
    budgetAlignment: number;
    formatAlignment: number;
    timingAlignment: number;
  };
}

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      const pitchId = url.searchParams.get("pitchId");
      const limit = parseInt(url.searchParams.get("limit") || "10");
      
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

      let recommendations: InvestorMatch[] = [];

      if (pitchId) {
        // Get specific pitch details for matching
        const pitch = await db.select().from(pitches)
          .where(eq(pitches.id, parseInt(pitchId)))
          .limit(1);

        if (pitch.length === 0) {
          return new Response(JSON.stringify({ error: "Pitch not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        recommendations = await matchInvestorsForPitch(pitch[0], userId, limit);
      } else {
        // General investor recommendations for a creator
        recommendations = await recommendInvestorsForCreator(userId, limit);
      }

      return new Response(JSON.stringify({
        success: true,
        recommendations,
        totalMatches: recommendations.length,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error generating investor recommendations:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function matchInvestorsForPitch(
  pitch: any,
  creatorId: number,
  limit: number
): Promise<InvestorMatch[]> {
  // Get active investors
  const investors = await db.select({
    id: users.id,
    username: users.username,
    companyName: users.companyName,
    profileImage: users.profileImage,
  })
  .from(users)
  .where(and(
    eq(users.userType, 'investor'),
    eq(users.isActive, true),
    ne(users.id, creatorId)
  ))
  .limit(limit * 3); // Get more for scoring

  const scoredInvestors: InvestorMatch[] = [];

  for (const investor of investors) {
    // Analyze investor's historical preferences
    const investorProfile = await analyzeInvestorProfile(investor.id);
    
    // Calculate match score
    const matchResult = calculateInvestorPitchMatch(pitch, investorProfile);
    
    scoredInvestors.push({
      investorId: investor.id,
      username: investor.username,
      companyName: investor.companyName,
      profileImage: investor.profileImage,
      investmentProfile: investorProfile,
      matchScore: matchResult.score,
      matchReasons: matchResult.reasons,
      compatibilityFactors: matchResult.factors,
    });
  }

  // Sort by match score
  scoredInvestors.sort((a, b) => b.matchScore - a.matchScore);
  return scoredInvestors.slice(0, limit);
}

async function recommendInvestorsForCreator(
  creatorId: number,
  limit: number
): Promise<InvestorMatch[]> {
  // Get creator's pitches
  const creatorPitches = await db.select({
    id: pitches.id,
    genre: pitches.genre,
    format: pitches.format,
    estimatedBudget: pitches.estimatedBudget,
    themes: pitches.themes,
  })
  .from(pitches)
  .where(and(
    eq(pitches.userId, creatorId),
    eq(pitches.status, 'published')
  ))
  .limit(10);

  if (creatorPitches.length === 0) {
    // Return top investors if creator has no pitches
    return getTopInvestors(limit);
  }

  // Aggregate creator's content profile
  const creatorProfile = {
    genres: new Set<string>(),
    formats: new Set<string>(),
    budgetRange: { min: Infinity, max: 0 },
    themes: new Set<string>(),
  };

  creatorPitches.forEach(pitch => {
    creatorProfile.genres.add(pitch.genre);
    creatorProfile.formats.add(pitch.format);
    
    const budget = Number(pitch.estimatedBudget) || 0;
    if (budget > 0) {
      creatorProfile.budgetRange.min = Math.min(creatorProfile.budgetRange.min, budget);
      creatorProfile.budgetRange.max = Math.max(creatorProfile.budgetRange.max, budget);
    }
    
    if (pitch.themes && Array.isArray(pitch.themes)) {
      (pitch.themes as string[]).forEach(theme => creatorProfile.themes.add(theme));
    }
  });

  // Get active investors
  const investors = await db.select({
    id: users.id,
    username: users.username,
    companyName: users.companyName,
    profileImage: users.profileImage,
  })
  .from(users)
  .where(and(
    eq(users.userType, 'investor'),
    eq(users.isActive, true),
    ne(users.id, creatorId)
  ))
  .limit(limit * 3);

  const scoredInvestors: InvestorMatch[] = [];

  for (const investor of investors) {
    const investorProfile = await analyzeInvestorProfile(investor.id);
    
    // Calculate compatibility
    let matchScore = 50;
    const matchReasons: string[] = [];
    const factors = {
      genreAlignment: 0,
      budgetAlignment: 0,
      formatAlignment: 0,
      timingAlignment: 50,
    };

    // Genre alignment
    const genreOverlap = investorProfile.preferredGenres.filter(g => 
      creatorProfile.genres.has(g)
    ).length;
    if (genreOverlap > 0) {
      factors.genreAlignment = (genreOverlap / investorProfile.preferredGenres.length) * 100;
      matchScore += factors.genreAlignment * 0.3;
      matchReasons.push(`Interested in ${Array.from(creatorProfile.genres).join(', ')}`);
    }

    // Format alignment
    const formatOverlap = investorProfile.preferredFormats.filter(f => 
      creatorProfile.formats.has(f)
    ).length;
    if (formatOverlap > 0) {
      factors.formatAlignment = (formatOverlap / investorProfile.preferredFormats.length) * 100;
      matchScore += factors.formatAlignment * 0.2;
      matchReasons.push('Invests in your content formats');
    }

    // Budget alignment
    if (creatorProfile.budgetRange.min !== Infinity) {
      const creatorAvg = (creatorProfile.budgetRange.min + creatorProfile.budgetRange.max) / 2;
      const investorAvg = (investorProfile.budgetRange.min + investorProfile.budgetRange.max) / 2;
      
      if (creatorAvg >= investorProfile.budgetRange.min && 
          creatorAvg <= investorProfile.budgetRange.max) {
        factors.budgetAlignment = 100;
        matchScore += 20;
        matchReasons.push('Budget range matches perfectly');
      } else {
        const diff = Math.abs(creatorAvg - investorAvg);
        factors.budgetAlignment = Math.max(0, 100 - (diff / investorAvg) * 100);
        matchScore += factors.budgetAlignment * 0.2;
      }
    }

    // Activity level
    if (investorProfile.activeDeals > 0) {
      matchScore += 10;
      matchReasons.push('Currently active investor');
    }

    if (matchReasons.length === 0) {
      matchReasons.push('Potential investor match');
    }

    scoredInvestors.push({
      investorId: investor.id,
      username: investor.username,
      companyName: investor.companyName,
      profileImage: investor.profileImage,
      investmentProfile: investorProfile,
      matchScore: Math.min(100, matchScore),
      matchReasons,
      compatibilityFactors: factors,
    });
  }

  scoredInvestors.sort((a, b) => b.matchScore - a.matchScore);
  return scoredInvestors.slice(0, limit);
}

async function analyzeInvestorProfile(investorId: number) {
  // Get investor's NDA history to understand preferences
  const investorNDAs = await db.select({
    pitchId: ndas.pitchId,
  })
  .from(ndas)
  .where(and(
    eq(ndas.signerId, investorId),
    eq(ndas.accessGranted, true)
  ))
  .limit(50);

  const pitchIds = investorNDAs.map(n => n.pitchId);
  
  let preferredGenres: string[] = [];
  let preferredFormats: string[] = [];
  let budgetRange = { min: 10000000, max: 50000000 }; // Default range
  let activeDeals = 0;

  if (pitchIds.length > 0) {
    // Get details of pitches they've shown interest in
    const interestedPitches = await db.select({
      genre: pitches.genre,
      format: pitches.format,
      estimatedBudget: pitches.estimatedBudget,
    })
    .from(pitches)
    .where(inArray(pitches.id, pitchIds));

    // Analyze preferences
    const genreCount = new Map<string, number>();
    const formatCount = new Map<string, number>();
    let minBudget = Infinity;
    let maxBudget = 0;

    interestedPitches.forEach(pitch => {
      genreCount.set(pitch.genre, (genreCount.get(pitch.genre) || 0) + 1);
      formatCount.set(pitch.format, (formatCount.get(pitch.format) || 0) + 1);
      
      const budget = Number(pitch.estimatedBudget) || 0;
      if (budget > 0) {
        minBudget = Math.min(minBudget, budget);
        maxBudget = Math.max(maxBudget, budget);
      }
    });

    preferredGenres = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    preferredFormats = Array.from(formatCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([format]) => format);

    if (minBudget !== Infinity) {
      budgetRange = {
        min: minBudget,
        max: maxBudget,
      };
    }

    // Count recent activity
    const recentNDAs = investorNDAs.filter(nda => {
      // Assuming NDAs were signed recently (would need timestamp in real implementation)
      return true; // Placeholder
    });
    activeDeals = Math.min(recentNDAs.length, 5);
  } else {
    // Default preferences for new investors
    preferredGenres = ['drama', 'thriller', 'scifi'];
    preferredFormats = ['feature', 'tv'];
  }

  return {
    preferredGenres,
    preferredFormats,
    budgetRange,
    activeDeals,
    totalInvestments: pitchIds.length,
  };
}

function calculateInvestorPitchMatch(pitch: any, investorProfile: any) {
  let score = 50; // Base score
  const reasons: string[] = [];
  const factors = {
    genreAlignment: 0,
    budgetAlignment: 0,
    formatAlignment: 0,
    timingAlignment: 50,
  };

  // Genre match
  if (investorProfile.preferredGenres.includes(pitch.genre)) {
    factors.genreAlignment = 100;
    score += 25;
    reasons.push(`Actively invests in ${pitch.genre} projects`);
  } else {
    factors.genreAlignment = 30; // Some openness to new genres
    score += 5;
  }

  // Format match
  if (investorProfile.preferredFormats.includes(pitch.format)) {
    factors.formatAlignment = 100;
    score += 20;
    reasons.push(`Seeks ${pitch.format} content`);
  } else {
    factors.formatAlignment = 40;
    score += 5;
  }

  // Budget alignment
  const pitchBudget = Number(pitch.estimatedBudget) || 0;
  if (pitchBudget > 0) {
    if (pitchBudget >= investorProfile.budgetRange.min && 
        pitchBudget <= investorProfile.budgetRange.max) {
      factors.budgetAlignment = 100;
      score += 20;
      reasons.push('Budget within investor range');
    } else if (pitchBudget < investorProfile.budgetRange.min * 0.5) {
      factors.budgetAlignment = 30;
      score -= 10;
    } else if (pitchBudget > investorProfile.budgetRange.max * 2) {
      factors.budgetAlignment = 20;
      score -= 15;
    } else {
      factors.budgetAlignment = 60;
      score += 5;
    }
  }

  // Theme alignment
  if (pitch.themes && Array.isArray(pitch.themes)) {
    const themes = pitch.themes as string[];
    const trendingThemes = ['ai', 'climate', 'social justice', 'technology'];
    const hasHotThemes = themes.some(t => trendingThemes.includes(t.toLowerCase()));
    if (hasHotThemes) {
      score += 10;
      reasons.push('Features trending themes');
    }
  }

  // Activity bonus
  if (investorProfile.activeDeals > 0) {
    factors.timingAlignment = 80;
    score += 5;
    reasons.push('Currently making investments');
  }

  // Track record
  if (investorProfile.totalInvestments > 10) {
    score += 5;
    reasons.push('Experienced investor');
  }

  if (reasons.length === 0) {
    reasons.push('Potential investor');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons,
    factors,
  };
}

async function getTopInvestors(limit: number): Promise<InvestorMatch[]> {
  // Get most active investors
  const topInvestors = await db.select({
    id: users.id,
    username: users.username,
    companyName: users.companyName,
    profileImage: users.profileImage,
    ndaCount: sql<number>`COUNT(${ndas.id})`,
  })
  .from(users)
  .leftJoin(ndas, eq(ndas.signerId, users.id))
  .where(eq(users.userType, 'investor'))
  .groupBy(users.id, users.username, users.companyName, users.profileImage)
  .orderBy(desc(sql`COUNT(${ndas.id})`))
  .limit(limit);

  return topInvestors.map(investor => ({
    investorId: investor.id,
    username: investor.username,
    companyName: investor.companyName,
    profileImage: investor.profileImage,
    investmentProfile: {
      preferredGenres: ['drama', 'thriller', 'scifi'],
      preferredFormats: ['feature', 'tv'],
      budgetRange: { min: 5000000, max: 50000000 },
      activeDeals: Math.min(Number(investor.ndaCount) || 0, 10),
      totalInvestments: Number(investor.ndaCount) || 0,
    },
    matchScore: 50 + Math.min(Number(investor.ndaCount) || 0, 30),
    matchReasons: ['Active investor on platform'],
    compatibilityFactors: {
      genreAlignment: 50,
      budgetAlignment: 50,
      formatAlignment: 50,
      timingAlignment: 70,
    },
  }));
}