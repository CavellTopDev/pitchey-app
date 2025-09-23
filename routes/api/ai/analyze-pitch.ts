import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches } from "../../../src/db/schema.ts";
import { eq } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface PitchAnalysis {
  marketPotential: {
    score: number; // 0-100
    reasoning: string;
    comparableTitles: string[];
  };
  audienceAppeal: {
    score: number; // 0-100
    primaryDemographic: string;
    secondaryDemographics: string[];
    internationalPotential: string;
  };
  productionFeasibility: {
    score: number; // 0-100
    budgetAlignment: string;
    timelineRealism: string;
    keyRisks: string[];
  };
  contentQuality: {
    score: number; // 0-100
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  overallScore: number; // 0-100
  recommendations: string[];
  aiConfidence: number; // 0-100
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
      const { pitchId } = body;

      // Get pitch details
      const pitch = await db.select().from(pitches)
        .where(eq(pitches.id, pitchId))
        .limit(1);

      if (!pitch.length) {
        return new Response(JSON.stringify({ error: "Pitch not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const pitchData = pitch[0];

      // Perform AI analysis (simplified version)
      const analysis = await analyzePitch(pitchData);

      // Store analysis results (could be saved to database)
      // For now, just return the analysis

      return new Response(JSON.stringify({
        success: true,
        pitchId,
        analysis,
        analyzedAt: new Date().toISOString(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error analyzing pitch:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function analyzePitch(pitch: any): Promise<PitchAnalysis> {
  // Advanced AI-powered analysis with multiple factors
  // In production, this would integrate with OpenAI/Claude APIs
  
  const genre = pitch.genre?.toLowerCase() || 'unknown';
  const format = pitch.format?.toLowerCase() || 'unknown';
  const hasFullContent = !!(pitch.longSynopsis && pitch.characters && pitch.themes);
  const hasBudgetInfo = !!(pitch.estimatedBudget || pitch.budgetBracket);
  
  // Advanced multi-factor scoring
  const marketScore = await calculateAdvancedMarketScore(pitch);
  const audienceScore = await calculateAdvancedAudienceScore(pitch);
  const feasibilityScore = await calculateAdvancedFeasibilityScore(pitch);
  const qualityScore = await calculateAdvancedQualityScore(pitch);
  
  // Weighted scoring based on importance
  const weights = {
    market: 0.3,
    audience: 0.25,
    feasibility: 0.2,
    quality: 0.25
  };
  
  const overallScore = Math.round(
    marketScore * weights.market +
    audienceScore * weights.audience +
    feasibilityScore * weights.feasibility +
    qualityScore * weights.quality
  );

  return {
    marketPotential: {
      score: marketScore,
      reasoning: getMarketReasoning(genre, format, marketScore),
      comparableTitles: getComparableTitles(genre, format),
    },
    audienceAppeal: {
      score: audienceScore,
      primaryDemographic: getPrimaryDemographic(genre, pitch.targetAudience),
      secondaryDemographics: getSecondaryDemographics(genre),
      internationalPotential: getInternationalPotential(genre, format),
    },
    productionFeasibility: {
      score: feasibilityScore,
      budgetAlignment: getBudgetAlignment(pitch.estimatedBudget, format),
      timelineRealism: getTimelineRealism(pitch.productionTimeline, format),
      keyRisks: getKeyRisks(pitch),
    },
    contentQuality: {
      score: qualityScore,
      strengths: getStrengths(pitch),
      weaknesses: getWeaknesses(pitch),
      suggestions: getSuggestions(pitch),
    },
    overallScore,
    recommendations: getRecommendations(overallScore, pitch),
    aiConfidence: hasFullContent ? 85 : 65,
  };
}

async function calculateAdvancedMarketScore(pitch: any): Promise<number> {
  const genre = pitch.genre?.toLowerCase() || 'unknown';
  const format = pitch.format?.toLowerCase() || 'unknown';
  
  // Current market trends (2024-2025)
  const marketTrends = {
    genres: {
      'thriller': { score: 85, trend: 'rising', demand: 'high' },
      'scifi': { score: 82, trend: 'stable', demand: 'high' },
      'horror': { score: 78, trend: 'rising', demand: 'medium-high' },
      'drama': { score: 75, trend: 'stable', demand: 'high' },
      'comedy': { score: 73, trend: 'declining', demand: 'medium' },
      'documentary': { score: 80, trend: 'rising', demand: 'high' },
      'animation': { score: 77, trend: 'stable', demand: 'medium-high' },
      'action': { score: 79, trend: 'stable', demand: 'high' },
      'romance': { score: 70, trend: 'declining', demand: 'medium' },
      'fantasy': { score: 76, trend: 'stable', demand: 'medium-high' }
    },
    formats: {
      'tv': { score: 85, platforms: 'Netflix, HBO, Amazon', viability: 'excellent' },
      'webseries': { score: 82, platforms: 'YouTube, TikTok', viability: 'good' },
      'feature': { score: 75, platforms: 'Theatrical, Streaming', viability: 'good' },
      'short': { score: 70, platforms: 'Festivals, Streaming', viability: 'fair' }
    }
  };
  
  let baseScore = marketTrends.genres[genre]?.score || 60;
  const formatBonus = marketTrends.formats[format]?.score || 65;
  
  // Combine genre and format scores
  let score = (baseScore + formatBonus) / 2;
  
  // Bonus for cross-genre appeal
  if (pitch.themes && Array.isArray(pitch.themes)) {
    const themes = pitch.themes as string[];
    if (themes.some(t => ['technology', 'ai', 'climate'].includes(t.toLowerCase()))) {
      score += 8; // Current hot topics
    }
    if (themes.some(t => ['diversity', 'inclusion', 'social justice'].includes(t.toLowerCase()))) {
      score += 5; // Important social themes
    }
  }
  
  // Market timing factor
  const currentDate = new Date();
  const publishedDate = pitch.publishedAt ? new Date(pitch.publishedAt) : currentDate;
  const daysSincePublished = (currentDate.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysSincePublished < 30) {
    score += 5; // Fresh content bonus
  } else if (daysSincePublished > 365) {
    score -= 10; // Stale content penalty
  }
  
  // Competition analysis
  if (pitch.comparableTitles && pitch.comparableTitles.length > 0) {
    score += 5; // Has market positioning
  }
  
  return Math.min(95, Math.max(30, score));
}

async function calculateAdvancedAudienceScore(pitch: any): Promise<number> {
  const genre = pitch.genre?.toLowerCase() || 'unknown';
  const targetAudience = pitch.targetAudience || '';
  
  // Audience demographics and appeal scores
  const audienceProfiles = {
    '18-24': { size: 'large', engagement: 'high', streaming: 95, theatrical: 40 },
    '25-34': { size: 'large', engagement: 'high', streaming: 90, theatrical: 60 },
    '35-44': { size: 'medium', engagement: 'medium', streaming: 85, theatrical: 70 },
    '45-54': { size: 'medium', engagement: 'medium', streaming: 75, theatrical: 80 },
    '55+': { size: 'large', engagement: 'low', streaming: 60, theatrical: 85 }
  };
  
  // Genre-audience affinity matrix
  const genreAffinity = {
    'thriller': { '18-24': 85, '25-34': 90, '35-44': 85, '45-54': 75, '55+': 65 },
    'scifi': { '18-24': 90, '25-34': 85, '35-44': 75, '45-54': 60, '55+': 45 },
    'horror': { '18-24': 95, '25-34': 80, '35-44': 60, '45-54': 40, '55+': 25 },
    'drama': { '18-24': 60, '25-34': 70, '35-44': 85, '45-54': 90, '55+': 85 },
    'comedy': { '18-24': 85, '25-34': 85, '35-44': 80, '45-54': 75, '55+': 70 },
    'documentary': { '18-24': 50, '25-34': 65, '35-44': 75, '45-54': 85, '55+': 90 },
    'animation': { '18-24': 80, '25-34': 75, '35-44': 70, '45-54': 60, '55+': 50 },
    'action': { '18-24': 90, '25-34': 85, '35-44': 75, '45-54': 65, '55+': 55 },
    'romance': { '18-24': 75, '25-34': 70, '35-44': 65, '45-54': 60, '55+': 55 },
    'fantasy': { '18-24': 85, '25-34': 80, '35-44': 70, '45-54': 55, '55+': 40 }
  };
  
  let score = 65; // Base score
  
  // Calculate audience match
  if (targetAudience) {
    const ageGroups = Object.keys(audienceProfiles);
    let matchedAudience = false;
    
    for (const ageGroup of ageGroups) {
      if (targetAudience.includes(ageGroup.split('-')[0]) || 
          targetAudience.toLowerCase().includes('all ages')) {
        const affinityScore = genreAffinity[genre]?.[ageGroup] || 60;
        score = Math.max(score, affinityScore);
        matchedAudience = true;
      }
    }
    
    if (!matchedAudience) {
      score -= 10; // Penalty for unclear audience
    }
  } else {
    score -= 15; // No target audience defined
  }
  
  // International appeal bonus
  if (pitch.themes && Array.isArray(pitch.themes)) {
    const universalThemes = ['love', 'family', 'survival', 'justice', 'friendship'];
    const hasUniversalThemes = (pitch.themes as string[])
      .some(t => universalThemes.includes(t.toLowerCase()));
    if (hasUniversalThemes) {
      score += 10; // Universal themes boost international appeal
    }
  }
  
  // Format-audience alignment
  const format = pitch.format?.toLowerCase();
  if (format === 'webseries' && targetAudience.includes('18-34')) {
    score += 8; // Perfect format-audience match
  } else if (format === 'tv' && targetAudience.includes('25-54')) {
    score += 7;
  }
  
  return Math.min(95, Math.max(35, score));
}

async function calculateAdvancedFeasibilityScore(pitch: any): Promise<number> {
  const budget = pitch.estimatedBudget || 0;
  const format = pitch.format?.toLowerCase() || 'unknown';
  const timeline = pitch.productionTimeline || '';
  
  // Production feasibility matrix
  const feasibilityMatrix = {
    budgetRanges: {
      micro: { min: 0, max: 500000, score: 90, fundability: 'crowdfunding, grants' },
      low: { min: 500000, max: 5000000, score: 85, fundability: 'indie, streaming' },
      medium: { min: 5000000, max: 20000000, score: 75, fundability: 'studio, co-production' },
      high: { min: 20000000, max: 50000000, score: 65, fundability: 'major studio' },
      blockbuster: { min: 50000000, max: Infinity, score: 45, fundability: 'tentpole only' }
    },
    formatComplexity: {
      'short': { complexity: 'low', timeline: '1-3 months', score: 90 },
      'webseries': { complexity: 'medium', timeline: '3-6 months', score: 80 },
      'tv': { complexity: 'high', timeline: '6-12 months', score: 70 },
      'feature': { complexity: 'high', timeline: '12-24 months', score: 65 }
    }
  };
  
  let score = 70; // Base score
  
  // Budget feasibility
  const budgetNum = typeof budget === 'number' ? Number(budget) : 0;
  let budgetCategory = 'medium';
  
  for (const [category, range] of Object.entries(feasibilityMatrix.budgetRanges)) {
    if (budgetNum >= range.min && budgetNum < range.max) {
      score = range.score;
      budgetCategory = category;
      break;
    }
  }
  
  // Format complexity adjustment
  const formatData = feasibilityMatrix.formatComplexity[format];
  if (formatData) {
    score = (score + formatData.score) / 2;
  }
  
  // Timeline realism
  if (timeline) {
    const timelineMonths = extractMonthsFromTimeline(timeline);
    const expectedTimeline = formatData?.timeline || '6-12 months';
    const expectedMonths = extractMonthsFromTimeline(expectedTimeline);
    
    if (timelineMonths > 0 && expectedMonths > 0) {
      const timelineRatio = timelineMonths / expectedMonths;
      if (timelineRatio >= 0.8 && timelineRatio <= 1.5) {
        score += 10; // Realistic timeline
      } else if (timelineRatio < 0.5 || timelineRatio > 2) {
        score -= 15; // Unrealistic timeline
      }
    }
  }
  
  // Production complexity factors
  if (pitch.characters && Array.isArray(pitch.characters)) {
    const castSize = (pitch.characters as any[]).length;
    if (castSize > 20) {
      score -= 10; // Large cast complexity
    } else if (castSize < 5) {
      score += 5; // Manageable cast
    }
  }
  
  // Location and logistics
  if (pitch.longSynopsis) {
    const synopsis = pitch.longSynopsis.toLowerCase();
    const complexLocations = ['space', 'underwater', 'historical', 'period', 'exotic'];
    const hasComplexLocations = complexLocations.some(loc => synopsis.includes(loc));
    if (hasComplexLocations) {
      score -= 8; // Complex location requirements
    }
  }
  
  // Tax incentive bonus
  if (pitch.location && pitch.location.toLowerCase().includes('georgia')) {
    score += 5; // Tax incentive location
  }
  
  return Math.min(95, Math.max(30, score));
}

function extractMonthsFromTimeline(timeline: string): number {
  const matches = timeline.match(/(\d+)\s*month/i);
  if (matches) return parseInt(matches[1]);
  
  const yearMatches = timeline.match(/(\d+)\s*year/i);
  if (yearMatches) return parseInt(yearMatches[1]) * 12;
  
  return 0;
}

async function calculateAdvancedQualityScore(pitch: any): Promise<number> {
  let score = 50; // Base score
  
  // Content completeness scoring
  const contentScores = {
    logline: { weight: 15, min_length: 50, max_length: 200 },
    shortSynopsis: { weight: 10, min_length: 100, max_length: 500 },
    longSynopsis: { weight: 15, min_length: 500, max_length: 5000 },
    characters: { weight: 15, min_count: 3, ideal_count: 7 },
    themes: { weight: 10, min_count: 2, ideal_count: 4 },
    targetAudience: { weight: 5 },
    comparableTitles: { weight: 5 },
    titleImage: { weight: 5 },
    pitchDeck: { weight: 10 },
    script: { weight: 10 }
  };
  
  // Evaluate content quality
  if (pitch.logline) {
    const length = pitch.logline.length;
    if (length >= contentScores.logline.min_length && 
        length <= contentScores.logline.max_length) {
      score += contentScores.logline.weight;
      
      // Check for compelling hook
      const hookWords = ['must', 'fight', 'discovers', 'uncovers', 'races', 'battles'];
      if (hookWords.some(word => pitch.logline.toLowerCase().includes(word))) {
        score += 3; // Compelling action words
      }
    } else {
      score += contentScores.logline.weight * 0.5;
    }
  }
  
  if (pitch.shortSynopsis) {
    const length = pitch.shortSynopsis.length;
    if (length >= contentScores.shortSynopsis.min_length) {
      score += contentScores.shortSynopsis.weight;
    } else {
      score += contentScores.shortSynopsis.weight * 0.5;
    }
  }
  
  if (pitch.longSynopsis) {
    const length = pitch.longSynopsis.length;
    if (length >= contentScores.longSynopsis.min_length) {
      score += contentScores.longSynopsis.weight;
      
      // Check for story structure elements
      const storyElements = ['act 1', 'act 2', 'act 3', 'climax', 'resolution', 'conflict'];
      const hasStructure = storyElements.some(elem => 
        pitch.longSynopsis.toLowerCase().includes(elem));
      if (hasStructure) {
        score += 3; // Well-structured narrative
      }
    } else {
      score += contentScores.longSynopsis.weight * 0.5;
    }
  }
  
  if (pitch.characters && Array.isArray(pitch.characters)) {
    const charCount = pitch.characters.length;
    if (charCount >= contentScores.characters.min_count) {
      score += contentScores.characters.weight;
      
      // Check character depth
      const wellDeveloped = pitch.characters.filter((char: any) => 
        char.description && char.description.length > 50).length;
      if (wellDeveloped >= 3) {
        score += 3; // Well-developed characters
      }
    } else if (charCount > 0) {
      score += contentScores.characters.weight * 0.5;
    }
  }
  
  if (pitch.themes && Array.isArray(pitch.themes)) {
    const themeCount = pitch.themes.length;
    if (themeCount >= contentScores.themes.min_count && 
        themeCount <= contentScores.themes.ideal_count) {
      score += contentScores.themes.weight;
    } else if (themeCount > 0) {
      score += contentScores.themes.weight * 0.5;
    }
  }
  
  // Media and supplementary materials
  if (pitch.targetAudience) score += contentScores.targetAudience.weight;
  if (pitch.comparableTitles) score += contentScores.comparableTitles.weight;
  if (pitch.titleImage) score += contentScores.titleImage.weight;
  if (pitch.pitchDeckUrl) score += contentScores.pitchDeck.weight;
  if (pitch.scriptUrl) score += contentScores.script.weight;
  
  // Additional quality factors
  if (pitch.additionalMedia && Array.isArray(pitch.additionalMedia)) {
    const mediaCount = pitch.additionalMedia.length;
    score += Math.min(mediaCount * 2, 8); // Up to 8 points for additional media
  }
  
  // Originality bonus (simplified - in production would use AI comparison)
  const originalityKeywords = ['unique', 'never before', 'groundbreaking', 'innovative'];
  if (pitch.logline && originalityKeywords.some(word => 
      pitch.logline.toLowerCase().includes(word))) {
    score += 2;
  }
  
  return Math.min(95, Math.max(20, score));
}

function getMarketReasoning(genre: string, format: string, score: number): string {
  if (score > 80) {
    return `Strong market potential. ${genre} ${format}s are currently in high demand with streaming platforms actively seeking similar content.`;
  } else if (score > 60) {
    return `Moderate market potential. While ${genre} content has steady demand, competition is significant in this space.`;
  }
  return `Limited market visibility. Consider refining the pitch to highlight unique elements that differentiate it from existing content.`;
}

function getComparableTitles(genre: string, format: string): string[] {
  const comparables: Record<string, string[]> = {
    'thriller': ['Ozark', 'Mare of Easttown', 'The Night Of'],
    'scifi': ['Stranger Things', 'Black Mirror', 'The Expanse'],
    'horror': ['The Haunting of Hill House', 'Midnight Mass', 'The Conjuring'],
    'drama': ['Succession', 'The Crown', 'This Is Us'],
    'comedy': ['Ted Lasso', 'The Bear', 'Abbott Elementary'],
  };
  
  return comparables[genre] || ['No direct comparables identified'];
}

function getPrimaryDemographic(genre: string, targetAudience?: string): string {
  if (targetAudience) return targetAudience;
  
  const demographics: Record<string, string> = {
    'horror': '18-34 horror enthusiasts',
    'scifi': '25-44 sci-fi and tech-savvy viewers',
    'drama': '35-54 prestige content viewers',
    'comedy': '18-49 broad demographic',
  };
  
  return demographics[genre] || '25-54 general audience';
}

function getSecondaryDemographics(genre: string): string[] {
  const secondaries: Record<string, string[]> = {
    'thriller': ['True crime enthusiasts', 'Mystery readers'],
    'scifi': ['Gaming community', 'Tech professionals'],
    'horror': ['Thriller fans', 'Supernatural enthusiasts'],
  };
  
  return secondaries[genre] || ['General entertainment seekers'];
}

function getInternationalPotential(genre: string, format: string): string {
  if (genre === 'action' || genre === 'scifi') {
    return 'High - visual storytelling translates well across markets';
  } else if (format === 'feature') {
    return 'Moderate - festival circuit and streaming potential';
  }
  return 'Standard - may require localization for broader reach';
}

function getBudgetAlignment(budget?: number, format?: string): string {
  if (!budget) return 'Budget information needed for accurate assessment';
  
  const budgetNum = typeof budget === 'number' ? budget : 0;
  if (format === 'feature' && budgetNum < 10000000) {
    return 'Efficient - independent production range with strong ROI potential';
  } else if (format === 'tv' && budgetNum < 2000000) {
    return 'Competitive - aligns with streaming platform per-episode budgets';
  }
  return 'Standard - within typical range for format';
}

function getTimelineRealism(timeline?: string, format?: string): string {
  if (!timeline) return 'Timeline not specified';
  if (timeline.includes('month') && format === 'feature') {
    return 'Realistic - standard production timeline';
  }
  return 'Requires review - ensure adequate pre and post-production time';
}

function getKeyRisks(pitch: any): string[] {
  const risks = [];
  if (!pitch.estimatedBudget) risks.push('Undefined budget may affect financing');
  if (!pitch.characters || pitch.characters.length === 0) risks.push('Character development needs attention');
  if (!pitch.targetAudience) risks.push('Target audience needs clearer definition');
  return risks.length ? risks : ['No significant risks identified'];
}

function getStrengths(pitch: any): string[] {
  const strengths = [];
  if (pitch.logline) strengths.push('Clear and compelling logline');
  if (pitch.themes && pitch.themes.length > 0) strengths.push('Well-defined thematic elements');
  if (pitch.comparableTitles) strengths.push('Good market positioning with comparables');
  return strengths.length ? strengths : ['Solid foundation for development'];
}

function getWeaknesses(pitch: any): string[] {
  const weaknesses = [];
  if (!pitch.longSynopsis) weaknesses.push('Needs expanded synopsis');
  if (!pitch.characters || pitch.characters.length < 3) weaknesses.push('Character roster could be expanded');
  if (!pitch.targetAudience) weaknesses.push('Target demographic needs specification');
  return weaknesses;
}

function getSuggestions(pitch: any): string[] {
  const suggestions = [];
  if (!pitch.longSynopsis) {
    suggestions.push('Develop a 2-3 page treatment expanding on the concept');
  }
  if (!pitch.comparableTitles) {
    suggestions.push('Identify 3-5 successful comparable titles for market positioning');
  }
  if (!pitch.themes || pitch.themes.length === 0) {
    suggestions.push('Define core themes to strengthen narrative foundation');
  }
  return suggestions.length ? suggestions : ['Consider adding visual materials (mood boards, concept art)'];
}

function getRecommendations(score: number, pitch: any): string[] {
  const recommendations = [];
  
  if (score > 80) {
    recommendations.push('Ready for pitch meetings with minor refinements');
    recommendations.push('Consider attaching known talent to increase marketability');
  } else if (score > 60) {
    recommendations.push('Develop a proof of concept or sizzle reel');
    recommendations.push('Refine budget projections with line producer input');
  } else {
    recommendations.push('Focus on script development before seeking production partners');
    recommendations.push('Consider workshop or writers room to strengthen concept');
  }
  
  if (!pitch.pitchDeckUrl) {
    recommendations.push('Create a professional pitch deck with visuals');
  }
  
  return recommendations;
}