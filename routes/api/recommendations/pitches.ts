import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, users, pitchViews, ndas, follows } from "../../../src/db/schema.ts";
import { eq, and, ne, desc, sql, inArray, gte } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface RecommendationScore {
  pitchId: number;
  score: number;
  reasons: string[];
}

export const handler: Handlers = {
  async GET(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        // Return popular pitches for non-authenticated users
        return getPopularRecommendations();
      }

      const userId = await verifyToken(token);
      if (!userId) {
        return getPopularRecommendations();
      }

      // Get user's viewing history
      const viewHistory = await db.select({
        pitchId: pitchViews.pitchId,
        viewCount: sql<number>`COUNT(*)`,
      })
      .from(pitchViews)
      .where(eq(pitchViews.viewerId, userId))
      .groupBy(pitchViews.pitchId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(20);

      if (viewHistory.length === 0) {
        // New user - return popular pitches
        return getPopularRecommendations();
      }

      // Get genres and formats from viewed pitches
      const viewedPitchIds = viewHistory.map(v => v.pitchId);
      const viewedPitches = await db.select({
        genre: pitches.genre,
        format: pitches.format,
        themes: pitches.themes,
      })
      .from(pitches)
      .where(inArray(pitches.id, viewedPitchIds));

      // Calculate genre and format preferences
      const genreCount = new Map<string, number>();
      const formatCount = new Map<string, number>();
      const themeSet = new Set<string>();

      viewedPitches.forEach(pitch => {
        genreCount.set(pitch.genre, (genreCount.get(pitch.genre) || 0) + 1);
        formatCount.set(pitch.format, (formatCount.get(pitch.format) || 0) + 1);
        if (pitch.themes && Array.isArray(pitch.themes)) {
          (pitch.themes as string[]).forEach(theme => themeSet.add(theme));
        }
      });

      // Get top genres and formats
      const topGenres = Array.from(genreCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre);

      const topFormats = Array.from(formatCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([format]) => format);

      const topThemes = Array.from(themeSet).slice(0, 5);

      // Get followed creators
      const followedCreators = await db.select({
        creatorId: follows.creatorId,
      })
      .from(follows)
      .where(and(
        eq(follows.followerId, userId),
        sql`${follows.creatorId} IS NOT NULL`
      ));

      const creatorIds = followedCreators.map(f => f.creatorId).filter(Boolean) as number[];

      // Get pitches the user has NDA access to
      const userNDAs = await db.select({
        pitchId: ndas.pitchId,
      })
      .from(ndas)
      .where(and(
        eq(ndas.signerId, userId),
        eq(ndas.accessGranted, true)
      ));

      const ndaPitchIds = userNDAs.map(n => n.pitchId);

      // Build recommendation query
      const recommendations: RecommendationScore[] = [];

      // 1. Similar genre/format pitches
      if (topGenres.length > 0 || topFormats.length > 0) {
        const similarPitches = await db.select({
          id: pitches.id,
          title: pitches.title,
          logline: pitches.logline,
          genre: pitches.genre,
          format: pitches.format,
          themes: pitches.themes,
          viewCount: pitches.viewCount,
          likeCount: pitches.likeCount,
          ndaCount: pitches.ndaCount,
          createdAt: pitches.createdAt,
          creator: {
            id: users.id,
            username: users.username,
            userType: users.userType,
            companyName: users.companyName,
          },
        })
        .from(pitches)
        .innerJoin(users, eq(pitches.userId, users.id))
        .where(and(
          eq(pitches.status, 'published'),
          ne(pitches.userId, userId), // Not user's own pitches
          sql`${pitches.id} NOT IN ${viewedPitchIds.length ? viewedPitchIds : [0]}`, // Not already viewed
          sql`${pitches.id} NOT IN ${ndaPitchIds.length ? ndaPitchIds : [0]}`, // Not already have NDA
          sql`(
            ${topGenres.length ? sql`${pitches.genre} IN ${topGenres}` : sql`1=1`}
            OR ${topFormats.length ? sql`${pitches.format} IN ${topFormats}` : sql`1=1`}
          )`
        ))
        .orderBy(desc(sql`${pitches.viewCount} + ${pitches.likeCount} * 2 + ${pitches.ndaCount} * 3`))
        .limit(20);

        similarPitches.forEach(pitch => {
          let score = 50;
          const reasons: string[] = [];

          if (topGenres.includes(pitch.genre)) {
            score += 20;
            reasons.push(`Matches your interest in ${pitch.genre}`);
          }
          if (topFormats.includes(pitch.format)) {
            score += 15;
            reasons.push(`${pitch.format} format you enjoy`);
          }

          // Check theme overlap
          if (pitch.themes && Array.isArray(pitch.themes)) {
            const pitchThemes = pitch.themes as string[];
            const themeOverlap = pitchThemes.filter(t => topThemes.includes(t));
            if (themeOverlap.length > 0) {
              score += themeOverlap.length * 5;
              reasons.push(`Similar themes: ${themeOverlap.join(', ')}`);
            }
          }

          // Popularity bonus
          if (pitch.viewCount > 1000) {
            score += 10;
            reasons.push('Trending pitch');
          }
          if (pitch.ndaCount > 10) {
            score += 5;
            reasons.push('High industry interest');
          }

          recommendations.push({
            pitchId: pitch.id,
            score,
            reasons,
          });
        });
      }

      // 2. Pitches from followed creators
      if (creatorIds.length > 0) {
        const creatorPitches = await db.select({
          id: pitches.id,
          title: pitches.title,
          userId: pitches.userId,
        })
        .from(pitches)
        .where(and(
          eq(pitches.status, 'published'),
          inArray(pitches.userId, creatorIds),
          sql`${pitches.id} NOT IN ${viewedPitchIds.length ? viewedPitchIds : [0]}`
        ))
        .limit(10);

        creatorPitches.forEach(pitch => {
          const existing = recommendations.find(r => r.pitchId === pitch.id);
          if (existing) {
            existing.score += 15;
            existing.reasons.push('From creator you follow');
          } else {
            recommendations.push({
              pitchId: pitch.id,
              score: 65,
              reasons: ['From creator you follow'],
            });
          }
        });
      }

      // 3. Collaborative filtering - pitches viewed by users with similar taste
      const similarUsers = await db.select({
        viewerId: pitchViews.viewerId,
        overlapCount: sql<number>`COUNT(DISTINCT ${pitchViews.pitchId})`,
      })
      .from(pitchViews)
      .where(and(
        inArray(pitchViews.pitchId, viewedPitchIds),
        ne(pitchViews.viewerId, userId)
      ))
      .groupBy(pitchViews.viewerId)
      .having(sql`COUNT(DISTINCT ${pitchViews.pitchId}) >= 3`)
      .orderBy(desc(sql`COUNT(DISTINCT ${pitchViews.pitchId})`))
      .limit(10);

      if (similarUsers.length > 0) {
        const similarUserIds = similarUsers.map(u => u.viewerId).filter(Boolean) as number[];
        
        const collaborativePitches = await db.select({
          pitchId: pitchViews.pitchId,
          viewerCount: sql<number>`COUNT(DISTINCT ${pitchViews.viewerId})`,
        })
        .from(pitchViews)
        .where(and(
          inArray(pitchViews.viewerId, similarUserIds),
          sql`${pitchViews.pitchId} NOT IN ${viewedPitchIds.length ? viewedPitchIds : [0]}`
        ))
        .groupBy(pitchViews.pitchId)
        .having(sql`COUNT(DISTINCT ${pitchViews.viewerId}) >= 2`)
        .orderBy(desc(sql`COUNT(DISTINCT ${pitchViews.viewerId})`))
        .limit(10);

        for (const collab of collaborativePitches) {
          const existing = recommendations.find(r => r.pitchId === collab.pitchId);
          const scoreBonus = Math.min(collab.viewerCount * 3, 20);
          
          if (existing) {
            existing.score += scoreBonus;
            existing.reasons.push('Viewed by users with similar taste');
          } else {
            recommendations.push({
              pitchId: collab.pitchId,
              score: 40 + scoreBonus,
              reasons: ['Popular with users who share your interests'],
            });
          }
        }
      }

      // Sort recommendations by score
      recommendations.sort((a, b) => b.score - a.score);

      // Get full pitch details for top recommendations
      const topRecommendationIds = recommendations.slice(0, 12).map(r => r.pitchId);
      
      const recommendedPitches = await db.select({
        id: pitches.id,
        title: pitches.title,
        logline: pitches.logline,
        genre: pitches.genre,
        format: pitches.format,
        shortSynopsis: pitches.shortSynopsis,
        titleImage: pitches.titleImage,
        viewCount: pitches.viewCount,
        likeCount: pitches.likeCount,
        ndaCount: pitches.ndaCount,
        createdAt: pitches.createdAt,
        creator: {
          id: users.id,
          username: users.username,
          userType: users.userType,
          companyName: users.companyName,
        },
      })
      .from(pitches)
      .innerJoin(users, eq(pitches.userId, users.id))
      .where(inArray(pitches.id, topRecommendationIds));

      // Map recommendations with full details
      const finalRecommendations = recommendations
        .slice(0, 12)
        .map(rec => {
          const pitch = recommendedPitches.find(p => p.id === rec.pitchId);
          return pitch ? {
            ...pitch,
            recommendationScore: rec.score,
            recommendationReasons: rec.reasons,
          } : null;
        })
        .filter(Boolean);

      return new Response(JSON.stringify({
        success: true,
        recommendations: finalRecommendations,
        preferences: {
          topGenres,
          topFormats,
          topThemes: Array.from(topThemes).slice(0, 5),
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function getPopularRecommendations() {
  // Return trending pitches for non-authenticated or new users
  const popularPitches = await db.select({
    id: pitches.id,
    title: pitches.title,
    logline: pitches.logline,
    genre: pitches.genre,
    format: pitches.format,
    shortSynopsis: pitches.shortSynopsis,
    titleImage: pitches.titleImage,
    viewCount: pitches.viewCount,
    likeCount: pitches.likeCount,
    ndaCount: pitches.ndaCount,
    createdAt: pitches.createdAt,
    creator: {
      id: users.id,
      username: users.username,
      userType: users.userType,
      companyName: users.companyName,
    },
  })
  .from(pitches)
  .innerJoin(users, eq(pitches.userId, users.id))
  .where(and(
    eq(pitches.status, 'published'),
    gte(pitches.publishedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
  ))
  .orderBy(desc(sql`${pitches.viewCount} + ${pitches.likeCount} * 2 + ${pitches.ndaCount} * 3`))
  .limit(12);

  const recommendations = popularPitches.map(pitch => ({
    ...pitch,
    recommendationScore: 50 + Math.min(pitch.viewCount / 100, 30),
    recommendationReasons: ['Trending this month', 'Popular with the community'],
  }));

  return new Response(JSON.stringify({
    success: true,
    recommendations,
    preferences: {
      topGenres: [],
      topFormats: [],
      topThemes: [],
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}