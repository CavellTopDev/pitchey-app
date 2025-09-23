import { Handlers } from "$fresh/server.ts";
import { db } from "../../../src/db/client.ts";
import { pitches, users } from "../../../src/db/schema.ts";
import { eq, and, or, sql, ilike, gte } from "drizzle-orm";
import { verifyToken } from "../../../utils/auth.ts";

interface SearchResult {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  titleImage?: string;
  creator: {
    id: number;
    username: string;
    companyName?: string;
  };
  relevanceScore: number;
  matchedFields: string[];
  snippet: string;
}

interface SearchQuery {
  query: string;
  filters?: {
    genres?: string[];
    formats?: string[];
    budgetMin?: number;
    budgetMax?: number;
    dateRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  };
  searchMode?: 'semantic' | 'keyword' | 'hybrid';
  limit?: number;
  offset?: number;
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      
      // Allow public search with limited results
      const isAuthenticated = token ? await verifyToken(token) : null;
      
      const body: SearchQuery = await req.json();
      const { query, filters, searchMode = 'hybrid', limit = 20, offset = 0 } = body;

      if (!query || query.trim().length < 2) {
        return new Response(JSON.stringify({ 
          error: "Query must be at least 2 characters" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Parse the natural language query
      const parsedQuery = await parseNaturalLanguageQuery(query);
      
      // Perform search based on mode
      let results: SearchResult[];
      
      if (searchMode === 'semantic') {
        results = await performSemanticSearch(parsedQuery, filters, limit, offset);
      } else if (searchMode === 'keyword') {
        results = await performKeywordSearch(parsedQuery, filters, limit, offset);
      } else {
        // Hybrid approach - combine both methods
        const [semanticResults, keywordResults] = await Promise.all([
          performSemanticSearch(parsedQuery, filters, limit * 2, offset),
          performKeywordSearch(parsedQuery, filters, limit * 2, offset)
        ]);
        
        results = mergeAndRankResults(semanticResults, keywordResults, limit);
      }

      // Apply authentication-based filtering
      if (!isAuthenticated) {
        results = results.slice(0, 10); // Limit results for non-authenticated users
      }

      // Get related suggestions
      const suggestions = await generateSearchSuggestions(query, results);

      return new Response(JSON.stringify({
        success: true,
        query: query,
        parsedQuery,
        results,
        totalResults: results.length,
        suggestions,
        searchMode,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error in semantic search:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function parseNaturalLanguageQuery(query: string) {
  const queryLower = query.toLowerCase();
  
  // Extract intent and entities
  const parsed = {
    originalQuery: query,
    intent: detectIntent(queryLower),
    entities: {
      genres: extractGenres(queryLower),
      formats: extractFormats(queryLower),
      themes: extractThemes(queryLower),
      budget: extractBudget(queryLower),
      temporal: extractTemporal(queryLower),
      keywords: extractKeywords(queryLower),
    },
    concepts: extractConcepts(queryLower),
  };

  return parsed;
}

function detectIntent(query: string): string {
  const intents = {
    find: ['find', 'search', 'looking for', 'show me', 'get me'],
    similar: ['similar to', 'like', 'reminds me of', 'in the style of'],
    trending: ['trending', 'popular', 'hot', 'top', 'best'],
    recent: ['recent', 'new', 'latest', 'fresh'],
    specific: ['about', 'featuring', 'with', 'starring'],
  };

  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => query.includes(keyword))) {
      return intent;
    }
  }

  return 'general';
}

function extractGenres(query: string): string[] {
  const genres = [
    'drama', 'comedy', 'thriller', 'horror', 'scifi', 'sci-fi', 'science fiction',
    'fantasy', 'documentary', 'animation', 'action', 'romance', 'mystery',
    'crime', 'adventure', 'musical', 'western', 'war', 'biographical', 'historical'
  ];

  const found: string[] = [];
  genres.forEach(genre => {
    if (query.includes(genre)) {
      // Normalize genre names
      if (genre === 'sci-fi' || genre === 'science fiction') {
        found.push('scifi');
      } else {
        found.push(genre);
      }
    }
  });

  return [...new Set(found)];
}

function extractFormats(query: string): string[] {
  const formats = {
    'feature': ['feature', 'movie', 'film'],
    'tv': ['tv', 'television', 'series', 'show'],
    'short': ['short', 'short film'],
    'webseries': ['web series', 'webseries', 'digital series', 'online series'],
  };

  const found: string[] = [];
  for (const [format, keywords] of Object.entries(formats)) {
    if (keywords.some(keyword => query.includes(keyword))) {
      found.push(format);
    }
  }

  return found;
}

function extractThemes(query: string): string[] {
  const themes = [
    'love', 'revenge', 'redemption', 'survival', 'family', 'friendship',
    'betrayal', 'justice', 'power', 'corruption', 'identity', 'loss',
    'hope', 'fear', 'sacrifice', 'freedom', 'technology', 'ai', 'artificial intelligence',
    'climate', 'environment', 'war', 'peace', 'social justice', 'inequality',
    'mental health', 'addiction', 'coming of age', 'dystopian', 'utopian',
    'time travel', 'parallel universe', 'zombie', 'vampire', 'superhero'
  ];

  const found: string[] = [];
  themes.forEach(theme => {
    if (query.includes(theme)) {
      found.push(theme);
    }
  });

  return found;
}

function extractBudget(query: string): { min?: number; max?: number } | null {
  const budgetPatterns = [
    /under\s+\$?([\d,]+)k?m?/i,
    /less\s+than\s+\$?([\d,]+)k?m?/i,
    /over\s+\$?([\d,]+)k?m?/i,
    /more\s+than\s+\$?([\d,]+)k?m?/i,
    /between\s+\$?([\d,]+)k?m?\s+and\s+\$?([\d,]+)k?m?/i,
    /\$?([\d,]+)k?m?\s+to\s+\$?([\d,]+)k?m?/i,
    /low\s+budget/i,
    /micro\s+budget/i,
    /big\s+budget/i,
    /blockbuster/i,
  ];

  for (const pattern of budgetPatterns) {
    const match = query.match(pattern);
    if (match) {
      if (pattern.source.includes('under') || pattern.source.includes('less')) {
        return { max: parseBudgetValue(match[1]) };
      } else if (pattern.source.includes('over') || pattern.source.includes('more')) {
        return { min: parseBudgetValue(match[1]) };
      } else if (pattern.source.includes('between') || pattern.source.includes('to')) {
        return { 
          min: parseBudgetValue(match[1]), 
          max: parseBudgetValue(match[2]) 
        };
      } else if (query.includes('low budget') || query.includes('micro budget')) {
        return { max: 5000000 };
      } else if (query.includes('big budget') || query.includes('blockbuster')) {
        return { min: 50000000 };
      }
    }
  }

  return null;
}

function parseBudgetValue(value: string): number {
  const cleaned = value.replace(/,/g, '');
  let num = parseFloat(cleaned);
  
  if (value.includes('k')) {
    num *= 1000;
  } else if (value.includes('m')) {
    num *= 1000000;
  }
  
  return num;
}

function extractTemporal(query: string): string | null {
  if (query.includes('this week') || query.includes('past week')) return 'week';
  if (query.includes('this month') || query.includes('past month')) return 'month';
  if (query.includes('this quarter') || query.includes('past quarter')) return 'quarter';
  if (query.includes('this year') || query.includes('past year')) return 'year';
  if (query.includes('recent') || query.includes('new') || query.includes('latest')) return 'month';
  return null;
}

function extractKeywords(query: string): string[] {
  // Remove common words and extract meaningful keywords
  const stopWords = new Set([
    'find', 'search', 'show', 'me', 'looking', 'for', 'about', 'with',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'from',
    'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'that', 'this', 'these', 'those', 'some', 'any', 'all', 'no', 'not',
    'i', 'you', 'we', 'they', 'he', 'she', 'it', 'my', 'your', 'our', 'their'
  ]);

  const words = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)];
}

function extractConcepts(query: string): string[] {
  const concepts: string[] = [];
  
  // Extract high-level concepts from query
  const conceptMap = {
    'psychological': ['mind', 'psychological', 'mental', 'psycho'],
    'romantic': ['love', 'romance', 'romantic', 'relationship'],
    'futuristic': ['future', 'futuristic', '2050', '2100', 'space'],
    'historical': ['historical', 'period', 'history', 'past', 'ancient'],
    'supernatural': ['supernatural', 'ghost', 'paranormal', 'haunted'],
    'technological': ['tech', 'technology', 'ai', 'robot', 'cyber'],
    'environmental': ['environment', 'climate', 'nature', 'ecological'],
    'political': ['political', 'politics', 'government', 'election'],
    'medical': ['medical', 'doctor', 'hospital', 'disease', 'pandemic'],
    'legal': ['legal', 'lawyer', 'court', 'justice', 'trial'],
  };

  for (const [concept, keywords] of Object.entries(conceptMap)) {
    if (keywords.some(keyword => query.includes(keyword))) {
      concepts.push(concept);
    }
  }

  return concepts;
}

async function performSemanticSearch(
  parsedQuery: any,
  filters: any,
  limit: number,
  offset: number
): Promise<SearchResult[]> {
  // Build semantic search conditions
  const conditions = [];
  
  // Base condition - published pitches
  conditions.push(eq(pitches.status, 'published'));

  // Apply filters
  if (filters?.genres?.length) {
    conditions.push(sql`${pitches.genre} = ANY(${filters.genres})`);
  }
  
  if (filters?.formats?.length) {
    conditions.push(sql`${pitches.format} = ANY(${filters.formats})`);
  }
  
  if (filters?.budgetMin) {
    conditions.push(gte(pitches.estimatedBudget, filters.budgetMin));
  }
  
  if (filters?.budgetMax) {
    conditions.push(sql`${pitches.estimatedBudget} <= ${filters.budgetMax}`);
  }
  
  if (filters?.dateRange) {
    const dateLimit = getDateLimit(filters.dateRange);
    conditions.push(gte(pitches.publishedAt, dateLimit));
  }

  // Semantic matching based on concepts and themes
  const semanticConditions = [];
  
  if (parsedQuery.entities.themes.length > 0) {
    semanticConditions.push(
      sql`${pitches.themes}::jsonb @> ${JSON.stringify(parsedQuery.entities.themes)}::jsonb`
    );
  }

  if (parsedQuery.entities.keywords.length > 0) {
    const keywordConditions = parsedQuery.entities.keywords.map((keyword: string) =>
      or(
        ilike(pitches.title, `%${keyword}%`),
        ilike(pitches.logline, `%${keyword}%`),
        ilike(pitches.shortSynopsis, `%${keyword}%`)
      )
    );
    if (keywordConditions.length > 0) {
      semanticConditions.push(or(...keywordConditions));
    }
  }

  // Combine conditions
  const finalConditions = semanticConditions.length > 0 
    ? and(...conditions, or(...semanticConditions))
    : and(...conditions);

  // Execute search with relevance scoring
  const results = await db.select({
    id: pitches.id,
    title: pitches.title,
    logline: pitches.logline,
    genre: pitches.genre,
    format: pitches.format,
    shortSynopsis: pitches.shortSynopsis,
    titleImage: pitches.titleImage,
    themes: pitches.themes,
    viewCount: pitches.viewCount,
    ndaCount: pitches.ndaCount,
    creator: {
      id: users.id,
      username: users.username,
      companyName: users.companyName,
    },
  })
  .from(pitches)
  .innerJoin(users, eq(pitches.userId, users.id))
  .where(finalConditions)
  .orderBy(desc(sql`
    (CASE WHEN ${pitches.title} ILIKE '%${parsedQuery.originalQuery}%' THEN 10 ELSE 0 END) +
    (CASE WHEN ${pitches.logline} ILIKE '%${parsedQuery.originalQuery}%' THEN 8 ELSE 0 END) +
    (CASE WHEN ${pitches.shortSynopsis} ILIKE '%${parsedQuery.originalQuery}%' THEN 5 ELSE 0 END) +
    ${pitches.viewCount} / 1000 +
    ${pitches.ndaCount} * 2
  `))
  .limit(limit)
  .offset(offset);

  // Calculate relevance scores and format results
  return results.map(result => {
    const relevanceScore = calculateSemanticRelevance(result, parsedQuery);
    const matchedFields = getMatchedFields(result, parsedQuery);
    const snippet = generateSnippet(result, parsedQuery.entities.keywords);

    return {
      id: result.id,
      title: result.title,
      logline: result.logline,
      genre: result.genre,
      format: result.format,
      shortSynopsis: result.shortSynopsis,
      titleImage: result.titleImage,
      creator: result.creator,
      relevanceScore,
      matchedFields,
      snippet,
    };
  });
}

async function performKeywordSearch(
  parsedQuery: any,
  filters: any,
  limit: number,
  offset: number
): Promise<SearchResult[]> {
  const conditions = [];
  
  // Base condition
  conditions.push(eq(pitches.status, 'published'));

  // Keyword matching
  if (parsedQuery.entities.keywords.length > 0) {
    const keywordConditions = parsedQuery.entities.keywords.map((keyword: string) =>
      or(
        ilike(pitches.title, `%${keyword}%`),
        ilike(pitches.logline, `%${keyword}%`),
        ilike(pitches.shortSynopsis, `%${keyword}%`),
        ilike(pitches.longSynopsis, `%${keyword}%`)
      )
    );
    conditions.push(or(...keywordConditions));
  }

  // Apply filters
  if (filters?.genres?.length) {
    conditions.push(sql`${pitches.genre} = ANY(${filters.genres})`);
  }
  
  if (filters?.formats?.length) {
    conditions.push(sql`${pitches.format} = ANY(${filters.formats})`);
  }

  const results = await db.select({
    id: pitches.id,
    title: pitches.title,
    logline: pitches.logline,
    genre: pitches.genre,
    format: pitches.format,
    shortSynopsis: pitches.shortSynopsis,
    titleImage: pitches.titleImage,
    creator: {
      id: users.id,
      username: users.username,
      companyName: users.companyName,
    },
  })
  .from(pitches)
  .innerJoin(users, eq(pitches.userId, users.id))
  .where(and(...conditions))
  .limit(limit)
  .offset(offset);

  return results.map(result => ({
    id: result.id,
    title: result.title,
    logline: result.logline,
    genre: result.genre,
    format: result.format,
    shortSynopsis: result.shortSynopsis,
    titleImage: result.titleImage,
    creator: result.creator,
    relevanceScore: calculateKeywordRelevance(result, parsedQuery.entities.keywords),
    matchedFields: getMatchedFields(result, parsedQuery),
    snippet: generateSnippet(result, parsedQuery.entities.keywords),
  }));
}

function calculateSemanticRelevance(pitch: any, parsedQuery: any): number {
  let score = 50; // Base score

  // Title match
  if (pitch.title.toLowerCase().includes(parsedQuery.originalQuery.toLowerCase())) {
    score += 30;
  }

  // Genre match
  if (parsedQuery.entities.genres.includes(pitch.genre)) {
    score += 15;
  }

  // Format match
  if (parsedQuery.entities.formats.includes(pitch.format)) {
    score += 10;
  }

  // Theme overlap
  if (pitch.themes && Array.isArray(pitch.themes)) {
    const themeOverlap = (pitch.themes as string[])
      .filter(t => parsedQuery.entities.themes.includes(t.toLowerCase())).length;
    score += themeOverlap * 5;
  }

  // Concept matching
  parsedQuery.concepts.forEach((concept: string) => {
    if (pitch.logline?.toLowerCase().includes(concept) || 
        pitch.shortSynopsis?.toLowerCase().includes(concept)) {
      score += 8;
    }
  });

  return Math.min(100, score);
}

function calculateKeywordRelevance(pitch: any, keywords: string[]): number {
  let score = 0;
  const titleLower = pitch.title.toLowerCase();
  const loglineLower = pitch.logline?.toLowerCase() || '';
  const synopsisLower = pitch.shortSynopsis?.toLowerCase() || '';

  keywords.forEach(keyword => {
    if (titleLower.includes(keyword)) score += 30;
    if (loglineLower.includes(keyword)) score += 20;
    if (synopsisLower.includes(keyword)) score += 10;
  });

  return Math.min(100, score);
}

function getMatchedFields(pitch: any, parsedQuery: any): string[] {
  const matched = [];
  const query = parsedQuery.originalQuery.toLowerCase();

  if (pitch.title.toLowerCase().includes(query)) matched.push('title');
  if (pitch.logline?.toLowerCase().includes(query)) matched.push('logline');
  if (pitch.shortSynopsis?.toLowerCase().includes(query)) matched.push('synopsis');
  if (parsedQuery.entities.genres.includes(pitch.genre)) matched.push('genre');
  if (parsedQuery.entities.formats.includes(pitch.format)) matched.push('format');

  return matched;
}

function generateSnippet(pitch: any, keywords: string[]): string {
  // Try to find the best snippet containing keywords
  const text = pitch.shortSynopsis || pitch.logline || '';
  if (!text) return '';

  const textLower = text.toLowerCase();
  let bestStart = 0;
  let bestScore = 0;

  // Find the best 150-character window containing most keywords
  for (let i = 0; i < text.length - 150; i += 10) {
    const window = textLower.substring(i, i + 150);
    let score = 0;
    keywords.forEach(keyword => {
      if (window.includes(keyword)) score++;
    });
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  let snippet = text.substring(bestStart, bestStart + 150);
  if (bestStart > 0) snippet = '...' + snippet;
  if (bestStart + 150 < text.length) snippet += '...';

  // Highlight keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`(${keyword})`, 'gi');
    snippet = snippet.replace(regex, '**$1**');
  });

  return snippet;
}

function mergeAndRankResults(
  semanticResults: SearchResult[],
  keywordResults: SearchResult[],
  limit: number
): SearchResult[] {
  const merged = new Map<number, SearchResult>();
  
  // Add semantic results with boost
  semanticResults.forEach(result => {
    merged.set(result.id, {
      ...result,
      relevanceScore: result.relevanceScore * 1.2, // Boost semantic matches
    });
  });

  // Merge keyword results
  keywordResults.forEach(result => {
    if (merged.has(result.id)) {
      // Average the scores if already present
      const existing = merged.get(result.id)!;
      existing.relevanceScore = (existing.relevanceScore + result.relevanceScore) / 2;
      existing.matchedFields = [...new Set([...existing.matchedFields, ...result.matchedFields])];
    } else {
      merged.set(result.id, result);
    }
  });

  // Sort by relevance and return top results
  return Array.from(merged.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

async function generateSearchSuggestions(
  query: string,
  results: SearchResult[]
): Promise<string[]> {
  const suggestions: string[] = [];
  
  // Genre-based suggestions
  const genres = new Set(results.map(r => r.genre));
  if (genres.size > 0) {
    suggestions.push(`More ${Array.from(genres)[0]} content`);
  }

  // Similar search suggestions
  const queryWords = query.toLowerCase().split(' ');
  const relatedSearches = {
    'thriller': ['suspense movies', 'mystery films', 'crime dramas'],
    'comedy': ['romantic comedies', 'dark comedy', 'sitcoms'],
    'drama': ['character studies', 'emotional journeys', 'family dramas'],
    'scifi': ['space adventures', 'dystopian futures', 'time travel'],
    'horror': ['psychological thrillers', 'supernatural horror', 'monster movies'],
  };

  for (const [key, values] of Object.entries(relatedSearches)) {
    if (queryWords.includes(key)) {
      suggestions.push(...values.slice(0, 2));
      break;
    }
  }

  // Add trending suggestions
  if (results.length < 5) {
    suggestions.push('Trending this week', 'New releases');
  }

  return suggestions.slice(0, 5);
}

function getDateLimit(range: string): Date {
  const now = new Date();
  switch (range) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0); // All time
  }
}