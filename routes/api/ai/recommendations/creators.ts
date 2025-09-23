import { Handlers } from "$fresh/server.ts";
import { db } from "../../../../src/db/client.ts";
import { users, pitches, follows, pitchViews, ndas } from "../../../../src/db/schema.ts";
import { eq, and, ne, desc, sql, inArray, gte, or } from "drizzle-orm";
import { verifyToken } from "../../../../utils/auth.ts";

interface CreatorRecommendation {
  creatorId: number;
  username: string;
  companyName?: string;
  bio?: string;
  profileImage?: string;
  stats: {
    totalPitches: number;
    avgViews: number;
    avgNDAs: number;
    successRate: number;
  };
  recentPitches: Array<{
    id: number;
    title: string;
    genre: string;
    viewCount: number;
  }>;
  matchScore: number;
  matchReasons: string[];
}

export const handler: Handlers = {
  async GET(req) {
    try {
      const url = new URL(req.url);
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      const limit = parseInt(url.searchParams.get("limit") || "12");
      
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

      // Get user preferences based on viewing history
      const userPreferences = await analyzeUserPreferences(userId);
      
      // Get already followed creators to exclude
      const followedCreators = await db.select({
        creatorId: follows.creatorId,
      })
      .from(follows)
      .where(and(
        eq(follows.followerId, userId),
        sql`${follows.creatorId} IS NOT NULL`
      ));

      const followedIds = followedCreators.map(f => f.creatorId).filter(Boolean) as number[];

      // Score and rank creators
      const recommendations = await generateCreatorRecommendations(
        userId,
        userPreferences,
        followedIds,
        limit
      );

      return new Response(JSON.stringify({
        success: true,
        recommendations,
        preferences: userPreferences,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error generating creator recommendations:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function analyzeUserPreferences(userId: number) {
  // Analyze viewing patterns
  const viewedPitches = await db.select({
    genre: pitches.genre,
    format: pitches.format,
    themes: pitches.themes,
    creatorId: pitches.userId,
  })
  .from(pitchViews)
  .innerJoin(pitches, eq(pitchViews.pitchId, pitches.id))
  .where(eq(pitchViews.viewerId, userId))
  .limit(100);

  // Calculate genre preferences
  const genreFrequency = new Map<string, number>();
  const formatFrequency = new Map<string, number>();
  const themeSet = new Set<string>();
  const viewedCreators = new Set<number>();

  viewedPitches.forEach(p => {
    genreFrequency.set(p.genre, (genreFrequency.get(p.genre) || 0) + 1);
    formatFrequency.set(p.format, (formatFrequency.get(p.format) || 0) + 1);
    if (p.themes && Array.isArray(p.themes)) {
      (p.themes as string[]).forEach(theme => themeSet.add(theme));
    }
    viewedCreators.add(p.creatorId);
  });

  // Get NDA history for quality signal
  const ndaHistory = await db.select({
    pitchId: ndas.pitchId,
  })
  .from(ndas)
  .where(eq(ndas.signerId, userId));

  return {
    topGenres: Array.from(genreFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre),
    topFormats: Array.from(formatFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([format]) => format),
    topThemes: Array.from(themeSet).slice(0, 5),
    viewedCreators: Array.from(viewedCreators),
    ndaCount: ndaHistory.length,
  };
}

async function generateCreatorRecommendations(
  userId: number,
  preferences: any,
  excludeIds: number[],
  limit: number
): Promise<CreatorRecommendation[]> {
  // Get active creators with recent pitches
  const activeCreators = await db.select({
    id: users.id,
    username: users.username,
    companyName: users.companyName,
    bio: users.bio,
    profileImage: users.profileImage,
    pitchCount: sql<number>`COUNT(DISTINCT ${pitches.id})`,
    avgViews: sql<number>`AVG(${pitches.viewCount})`,
    avgNDAs: sql<number>`AVG(${pitches.ndaCount})`,
    totalViews: sql<number>`SUM(${pitches.viewCount})`,
    totalNDAs: sql<number>`SUM(${pitches.ndaCount})`,
  })
  .from(users)
  .innerJoin(pitches, eq(users.id, pitches.userId))
  .where(and(
    eq(users.userType, 'creator'),
    eq(pitches.status, 'published'),
    ne(users.id, userId),
    excludeIds.length > 0 ? sql`${users.id} NOT IN ${excludeIds}` : sql`1=1`,
    gte(pitches.publishedAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) // Active in last 90 days
  ))
  .groupBy(users.id, users.username, users.companyName, users.bio, users.profileImage)
  .having(sql`COUNT(DISTINCT ${pitches.id}) >= 1`)
  .orderBy(desc(sql`SUM(${pitches.viewCount}) + SUM(${pitches.ndaCount}) * 10`))
  .limit(limit * 3); // Get more to filter

  // Score each creator
  const scoredCreators: CreatorRecommendation[] = [];

  for (const creator of activeCreators) {
    // Get creator's recent pitches
    const recentPitches = await db.select({
      id: pitches.id,
      title: pitches.title,
      genre: pitches.genre,
      format: pitches.format,
      themes: pitches.themes,
      viewCount: pitches.viewCount,
      ndaCount: pitches.ndaCount,
    })
    .from(pitches)
    .where(and(
      eq(pitches.userId, creator.id),
      eq(pitches.status, 'published')
    ))
    .orderBy(desc(pitches.publishedAt))
    .limit(5);

    // Calculate match score
    let matchScore = 50; // Base score
    const matchReasons: string[] = [];

    // Genre alignment
    const genreMatch = recentPitches.filter(p => 
      preferences.topGenres.includes(p.genre)
    ).length;
    if (genreMatch > 0) {
      matchScore += genreMatch * 10;
      const matchedGenres = [...new Set(recentPitches
        .filter(p => preferences.topGenres.includes(p.genre))
        .map(p => p.genre))];
      matchReasons.push(`Creates ${matchedGenres.join(', ')} content you enjoy`);
    }

    // Format alignment
    const formatMatch = recentPitches.filter(p => 
      preferences.topFormats.includes(p.format)
    ).length;
    if (formatMatch > 0) {
      matchScore += formatMatch * 8;
      matchReasons.push('Produces in your preferred formats');
    }

    // Theme alignment
    let themeMatches = 0;
    recentPitches.forEach(pitch => {
      if (pitch.themes && Array.isArray(pitch.themes)) {
        const pitchThemes = pitch.themes as string[];
        themeMatches += pitchThemes.filter(t => 
          preferences.topThemes.includes(t)
        ).length;
      }
    });
    if (themeMatches > 0) {
      matchScore += Math.min(themeMatches * 3, 15);
      matchReasons.push('Similar thematic interests');
    }

    // Quality metrics
    const avgViews = Number(creator.avgViews) || 0;
    const avgNDAs = Number(creator.avgNDAs) || 0;
    const successRate = avgNDAs > 0 ? (avgNDAs / Math.max(avgViews, 1)) * 100 : 0;

    if (avgViews > 1000) {
      matchScore += 10;
      matchReasons.push('Highly viewed content');
    }
    if (avgNDAs > 10) {
      matchScore += 15;
      matchReasons.push('Strong industry interest');
    }
    if (successRate > 5) {
      matchScore += 10;
      matchReasons.push('High conversion rate');
    }

    // Consistency bonus
    const pitchCount = Number(creator.pitchCount) || 0;
    if (pitchCount >= 3) {
      matchScore += 8;
      matchReasons.push('Consistent content creator');
    }

    // Collaborative filtering - creators viewed by similar users
    const similarViewers = await db.select({
      viewerId: pitchViews.viewerId,
    })
    .from(pitchViews)
    .innerJoin(pitches, eq(pitchViews.pitchId, pitches.id))
    .where(and(
      eq(pitches.userId, creator.id),
      ne(pitchViews.viewerId, userId)
    ))
    .limit(20);

    if (similarViewers.length > 5) {
      // Check if these viewers have similar taste
      const overlapScore = await calculateViewerOverlap(
        userId,
        similarViewers.map(v => v.viewerId).filter(Boolean) as number[]
      );
      if (overlapScore > 0.3) {
        matchScore += 12;
        matchReasons.push('Popular with users who share your taste');
      }
    }

    // Default reason if no specific matches
    if (matchReasons.length === 0) {
      if (avgViews > 500) {
        matchReasons.push('Trending creator');
      } else {
        matchReasons.push('Emerging talent');
      }
    }

    scoredCreators.push({
      creatorId: creator.id,
      username: creator.username,
      companyName: creator.companyName,
      bio: creator.bio,
      profileImage: creator.profileImage,
      stats: {
        totalPitches: pitchCount,
        avgViews: Math.round(avgViews),
        avgNDAs: Math.round(avgNDAs),
        successRate: Math.round(successRate * 10) / 10,
      },
      recentPitches: recentPitches.slice(0, 3).map(p => ({
        id: p.id,
        title: p.title,
        genre: p.genre,
        viewCount: p.viewCount,
      })),
      matchScore: Math.min(100, matchScore),
      matchReasons,
    });
  }

  // Sort by match score and return top recommendations
  scoredCreators.sort((a, b) => b.matchScore - a.matchScore);
  return scoredCreators.slice(0, limit);
}

async function calculateViewerOverlap(
  userId: number,
  otherViewerIds: number[]
): Promise<number> {
  if (otherViewerIds.length === 0) return 0;

  // Get pitches viewed by the user
  const userViews = await db.select({
    pitchId: pitchViews.pitchId,
  })
  .from(pitchViews)
  .where(eq(pitchViews.viewerId, userId))
  .limit(50);

  const userPitchIds = new Set(userViews.map(v => v.pitchId));

  // Get pitches viewed by similar users
  const otherViews = await db.select({
    pitchId: pitchViews.pitchId,
    viewerId: pitchViews.viewerId,
  })
  .from(pitchViews)
  .where(inArray(pitchViews.viewerId, otherViewerIds))
  .limit(200);

  // Calculate overlap
  let overlapCount = 0;
  const viewerPitches = new Map<number, Set<number>>();

  otherViews.forEach(view => {
    if (!viewerPitches.has(view.viewerId!)) {
      viewerPitches.set(view.viewerId!, new Set());
    }
    viewerPitches.get(view.viewerId!)!.add(view.pitchId);
  });

  viewerPitches.forEach(pitchSet => {
    const overlap = Array.from(pitchSet).filter(pid => userPitchIds.has(pid)).length;
    if (overlap >= 3) {
      overlapCount++;
    }
  });

  return overlapCount / Math.max(otherViewerIds.length, 1);
}