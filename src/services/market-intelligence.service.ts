/**
 * Market Intelligence Service
 * Real-time aggregation of entertainment news, trends, and investment opportunities
 * Simulates Crawl4AI-style data aggregation with TypeScript for edge deployment
 */

import { 
  MarketIntelligence,
  TrendAnalysis,
  InvestmentOpportunity,
  BoxOfficeTrend,
  MarketIntelligenceRequest,
  MarketIntelligenceResponse,
  IntelligenceDashboard
} from '../types/intelligence.types';
import { createDatabase } from '../db/raw-sql-connection';
import { getCacheService, CacheKeys, CacheTTL } from './intelligence-cache.service';
import { Env } from '../types/worker-types';

export class MarketIntelligenceService {
  private db: any;
  private cache: any;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.db = createDatabase(env);
    this.cache = getCacheService(env);
  }

  /**
   * Gather comprehensive market intelligence
   */
  async gatherIntelligence(request?: MarketIntelligenceRequest): Promise<MarketIntelligenceResponse> {
    try {
      const cacheKey = this.buildRequestCacheKey(request);
      
      // Check cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          totalCount: cached.intelligence?.length || 0,
          cached: true,
          lastUpdated: cached.lastUpdated || new Date().toISOString()
        };
      }

      // Gather fresh intelligence
      const intelligence = await this.aggregateMarketNews(request);
      const trends = await this.analyzeTrends(request);
      const opportunities = await this.identifyOpportunities(request);
      const boxOfficeTrends = await this.getBoxOfficeTrends();

      const data = {
        intelligence,
        trends,
        opportunities,
        boxOfficeTrends,
        lastUpdated: new Date().toISOString()
      };

      // Cache the results
      await this.cache.set(cacheKey, data, CacheTTL.MARKET_INTELLIGENCE);

      return {
        success: true,
        data,
        totalCount: intelligence.length,
        cached: false,
        lastUpdated: data.lastUpdated
      };

    } catch (error) {
      console.error('Market intelligence gathering failed:', error);
      return {
        success: false,
        data: {
          intelligence: [],
          trends: [],
          opportunities: [],
          boxOfficeTrends: { weekendTotal: 0, topPerformers: [], surprises: [], disappointments: [] }
        },
        totalCount: 0,
        cached: false,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get real-time intelligence dashboard data
   */
  async getIntelligenceDashboard(): Promise<IntelligenceDashboard> {
    try {
      const cacheKey = 'dashboard:intelligence';
      
      // Check cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Gather dashboard data
      const [marketNews, opportunities, trends, competitive] = await Promise.all([
        this.getMarketNewsMetrics(),
        this.getOpportunityMetrics(),
        this.getTrendMetrics(),
        this.getCompetitiveMetrics()
      ]);

      const dashboard: IntelligenceDashboard = {
        marketNews,
        opportunities,
        trends,
        competitive
      };

      // Cache for 5 minutes
      await this.cache.set(cacheKey, dashboard, 300);

      return dashboard;

    } catch (error) {
      console.error('Dashboard generation failed:', error);
      return this.getDefaultDashboard();
    }
  }

  /**
   * Aggregate market news from multiple sources
   */
  private async aggregateMarketNews(request?: MarketIntelligenceRequest): Promise<MarketIntelligence[]> {
    // Simulate news aggregation from industry sources
    const sources = [
      'Variety',
      'Hollywood Reporter',
      'Deadline',
      'The Wrap',
      'Entertainment Weekly',
      'Box Office Mojo'
    ];

    const newsItems: MarketIntelligence[] = [];

    // Generate realistic industry news based on current trends
    const newsTemplates = this.getNewsTemplates();
    
    for (let i = 0; i < 20; i++) {
      const template = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
      const source = sources[Math.floor(Math.random() * sources.length)];
      
      const newsItem: MarketIntelligence = {
        id: crypto.randomUUID(),
        intelligenceType: 'news',
        title: template.title,
        content: template.content,
        summary: template.summary,
        sourceName: source,
        category: template.category,
        tags: template.tags,
        genreRelevance: template.genreRelevance,
        relevanceScore: this.calculateRelevanceScore(template, request),
        impactScore: template.impactScore,
        urgencyLevel: template.urgencyLevel,
        publishedDate: this.randomRecentDate().toISOString(),
        extractedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // Filter by request criteria
      if (this.matchesRequest(newsItem, request)) {
        newsItems.push(newsItem);
      }
    }

    // Sort by relevance and publish date
    newsItems.sort((a, b) => {
      const relevanceDiff = b.relevanceScore - a.relevanceScore;
      if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
      
      const aDate = new Date(a.publishedDate || a.createdAt);
      const bDate = new Date(b.publishedDate || b.createdAt);
      return bDate.getTime() - aDate.getTime();
    });

    // Store in database
    await this.storeMarketIntelligence(newsItems);

    return newsItems.slice(0, request?.limit || 50);
  }

  /**
   * Analyze current industry trends
   */
  private async analyzeTrends(request?: MarketIntelligenceRequest): Promise<TrendAnalysis[]> {
    const cacheKey = 'trends:analysis';
    
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const trends: TrendAnalysis[] = [
      {
        id: crypto.randomUUID(),
        trendType: 'genre',
        trendName: 'Horror',
        trendDirection: 'rising',
        trendStrength: 85,
        momentumScore: 78,
        recentSuccesses: 12,
        recentFailures: 3,
        averagePerformance: 45000000,
        marketShare: 8.5,
        projectedDirection: 'rising',
        confidenceInterval: 0.85,
        factorsDrivingTrend: [
          'Low production costs with high ROI',
          'Strong streaming platform demand',
          'International market growth',
          'Year-round release viability'
        ],
        historicalData: this.generateHistoricalData('horror'),
        analysisPeriodStart: '2024-01-01',
        analysisPeriodEnd: '2024-12-31',
        dataSources: ['Box Office Mojo', 'The Numbers', 'Variety'],
        methodology: 'Box office analysis with streaming data correlation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        trendType: 'format',
        trendName: 'Limited Series',
        trendDirection: 'rising',
        trendStrength: 92,
        momentumScore: 88,
        recentSuccesses: 18,
        recentFailures: 2,
        averagePerformance: 85000000,
        marketShare: 15.7,
        projectedDirection: 'rising',
        confidenceInterval: 0.91,
        factorsDrivingTrend: [
          'Streaming wars driving content demand',
          'Creator preference for contained narratives',
          'Audience appetite for premium content',
          'International co-production opportunities'
        ],
        historicalData: this.generateHistoricalData('series'),
        analysisPeriodStart: '2024-01-01',
        analysisPeriodEnd: '2024-12-31',
        dataSources: ['Nielsen', 'Parrot Analytics', 'Variety'],
        methodology: 'Streaming viewership analysis with production volume tracking',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        trendType: 'budget_range',
        trendName: 'Micro Budget (<$1M)',
        trendDirection: 'rising',
        trendStrength: 75,
        momentumScore: 82,
        recentSuccesses: 25,
        recentFailures: 8,
        averagePerformance: 2500000,
        marketShare: 5.2,
        projectedDirection: 'rising',
        confidenceInterval: 0.77,
        factorsDrivingTrend: [
          'Digital distribution accessibility',
          'Social media marketing efficiency',
          'Remote production capabilities',
          'Streaming platform acquisition interest'
        ],
        historicalData: this.generateHistoricalData('micro_budget'),
        analysisPeriodStart: '2024-01-01',
        analysisPeriodEnd: '2024-12-31',
        dataSources: ['Film Independent', 'The Numbers', 'IndieWire'],
        methodology: 'Independent film performance analysis with ROI calculations',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        trendType: 'technology',
        trendName: 'AI in Production',
        trendDirection: 'rising',
        trendStrength: 68,
        momentumScore: 95,
        recentSuccesses: 8,
        recentFailures: 1,
        averagePerformance: 0, // Technology trend, not revenue-based
        marketShare: 2.1,
        projectedDirection: 'rising',
        confidenceInterval: 0.89,
        factorsDrivingTrend: [
          'Cost reduction in VFX and post-production',
          'Script analysis and development tools',
          'Automated content creation capabilities',
          'Industry adoption accelerating'
        ],
        historicalData: this.generateHistoricalData('ai_tech'),
        analysisPeriodStart: '2024-01-01',
        analysisPeriodEnd: '2024-12-31',
        dataSources: ['Hollywood Reporter', 'Variety', 'Tech Crunch'],
        methodology: 'Technology adoption tracking with industry survey data',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Cache trends for 2 hours
    await this.cache.set(cacheKey, trends, CacheTTL.TREND_ANALYSIS);
    
    // Store in database
    await this.storeTrends(trends);

    return trends;
  }

  /**
   * Identify investment opportunities from market analysis
   */
  private async identifyOpportunities(request?: MarketIntelligenceRequest): Promise<InvestmentOpportunity[]> {
    const opportunities: InvestmentOpportunity[] = [
      {
        id: crypto.randomUUID(),
        opportunityType: 'genre_opportunity',
        title: 'Horror Genre Investment Window',
        description: 'Horror films showing sustained 85% trend strength with exceptional ROI potential. Market analysis indicates continued growth through 2025.',
        opportunitySource: 'Market Trend Analysis',
        opportunityScore: 88,
        riskLevel: 'medium',
        timeSensitivity: 'short_term',
        estimatedInvestmentMin: 500000,
        estimatedInvestmentMax: 5000000,
        estimatedRoiMin: 150,
        estimatedRoiMax: 400,
        paybackPeriodMonths: 18,
        recommendedAction: 'Prioritize horror project acquisitions in Q1 2025',
        nextSteps: [
          'Review horror scripts in development pipeline',
          'Contact established horror producers for partnerships',
          'Assess micro-budget horror opportunities',
          'Schedule market timing analysis for optimal release windows'
        ],
        keyContacts: [
          { name: 'Jason Blum', role: 'Producer', contact: 'Blumhouse Productions' },
          { name: 'A24 Development', role: 'Studio', contact: 'A24 Films' }
        ],
        status: 'new',
        alertLevel: 'high',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        opportunityType: 'new_production',
        title: 'Award-Winning Director Seeking Co-Production',
        description: 'Established director with three festival wins seeking $8M for psychological thriller. A-list actor attached with strong international pre-sales interest.',
        opportunitySource: 'Industry Network',
        opportunityScore: 82,
        riskLevel: 'low',
        timeSensitivity: 'immediate',
        estimatedInvestmentMin: 8000000,
        estimatedInvestmentMax: 12000000,
        estimatedRoiMin: 120,
        estimatedRoiMax: 250,
        paybackPeriodMonths: 24,
        recommendedAction: 'Schedule immediate meeting with production team',
        nextSteps: [
          'Review complete project package and financials',
          'Verify attached talent commitments',
          'Assess distribution strategy and pre-sales',
          'Due diligence on production company track record'
        ],
        keyContacts: [
          { name: 'Sarah Chen', role: 'Producer', contact: 'chen@stellarfilms.com' },
          { name: 'Michael Torres', role: 'Sales Agent', contact: 'torres@internationalsales.com' }
        ],
        status: 'investigating',
        alertLevel: 'urgent',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        opportunityType: 'market_gap',
        title: 'Streaming Platform Content Gap',
        description: 'Major streaming platform actively seeking diverse content for 2025 slate. Specific interest in sci-fi concepts and international co-productions.',
        opportunitySource: 'Platform Intelligence',
        opportunityScore: 75,
        riskLevel: 'medium',
        timeSensitivity: 'medium_term',
        estimatedInvestmentMin: 2000000,
        estimatedInvestmentMax: 15000000,
        estimatedRoiMin: 100,
        estimatedRoiMax: 180,
        paybackPeriodMonths: 36,
        recommendedAction: 'Develop pitch package for streaming originals',
        nextSteps: [
          'Research platform content strategy and gaps',
          'Identify sci-fi projects in development pipeline',
          'Explore international co-production opportunities',
          'Prepare content portfolio for platform meetings'
        ],
        keyContacts: [
          { name: 'Netflix Original Content', role: 'Platform', contact: 'originals@netflix.com' },
          { name: 'Amazon Studios', role: 'Platform', contact: 'development@amazon.com' }
        ],
        status: 'new',
        alertLevel: 'medium',
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        opportunityType: 'talent_availability',
        title: 'Emmy-Winning Showrunner Seeking New Project',
        description: 'High-profile showrunner recently completed successful limited series, actively seeking next project. Proven track record in premium content.',
        opportunitySource: 'Industry Intelligence',
        opportunityScore: 90,
        riskLevel: 'low',
        timeSensitivity: 'immediate',
        estimatedInvestmentMin: 10000000,
        estimatedInvestmentMax: 25000000,
        estimatedRoiMin: 140,
        estimatedRoiMax: 300,
        paybackPeriodMonths: 30,
        recommendedAction: 'Immediate outreach for project collaboration',
        nextSteps: [
          'Contact talent representation for availability',
          'Review showrunner previous project performance',
          'Prepare project concepts for consideration',
          'Schedule creative meeting within 48 hours'
        ],
        keyContacts: [
          { name: 'CAA Talent', role: 'Agency', contact: 'talent@caa.com' },
          { name: 'UTA', role: 'Agency', contact: 'tv@unitedtalent.com' }
        ],
        status: 'new',
        alertLevel: 'urgent',
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Store in database
    await this.storeOpportunities(opportunities);

    return opportunities;
  }

  /**
   * Get current box office trends
   */
  private async getBoxOfficeTrends(): Promise<BoxOfficeTrend> {
    const cacheKey = CacheKeys.BOX_OFFICE_TRENDS();
    
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // Simulate current box office data
    const trends: BoxOfficeTrend = {
      weekendTotal: 125750000,
      topPerformers: [
        {
          title: 'Scream VII',
          gross: 35200000,
          weeks: 1,
          changeFromLastWeek: 0
        },
        {
          title: 'Avatar 3',
          gross: 28900000,
          weeks: 3,
          changeFromLastWeek: -15.2
        },
        {
          title: 'Fast & Furious 11',
          gross: 22100000,
          weeks: 2,
          changeFromLastWeek: -32.1
        },
        {
          title: 'The Batman Part II',
          gross: 18600000,
          weeks: 4,
          changeFromLastWeek: -8.7
        },
        {
          title: 'Spider-Verse 3',
          gross: 15400000,
          weeks: 5,
          changeFromLastWeek: -12.3
        }
      ],
      surprises: [
        {
          title: 'Indie Horror Phenomenon',
          expectedGross: 3000000,
          actualGross: 12500000,
          surpriseFactor: 316.7
        }
      ],
      disappointments: [
        {
          title: 'Big Budget Action Sequel',
          expectedGross: 45000000,
          actualGross: 18200000,
          disappointmentFactor: -59.6
        }
      ]
    };

    // Cache for 1 hour
    await this.cache.set(cacheKey, trends, CacheTTL.BOX_OFFICE_DATA);

    return trends;
  }

  // Dashboard metric methods
  private async getMarketNewsMetrics() {
    const recentNews = await this.getRecentNews(7); // Last 7 days
    const topStories = recentNews
      .filter(n => n.relevanceScore > 0.7)
      .slice(0, 5);

    return {
      count: recentNews.length,
      avgRelevance: recentNews.reduce((sum, n) => sum + n.relevanceScore, 0) / recentNews.length || 0,
      latestUpdate: new Date().toISOString(),
      topStories
    };
  }

  private async getOpportunityMetrics() {
    const recentOpportunities = await this.getActiveOpportunities();
    const highPriority = recentOpportunities
      .filter(o => o.opportunityScore >= 80 && o.alertLevel === 'urgent')
      .slice(0, 5);

    return {
      count: recentOpportunities.length,
      avgScore: recentOpportunities.reduce((sum, o) => sum + o.opportunityScore, 0) / recentOpportunities.length || 0,
      latestUpdate: new Date().toISOString(),
      highPriority
    };
  }

  private async getTrendMetrics() {
    const trends = await this.analyzeTrends();
    const rising = trends.filter(t => t.trendDirection === 'rising');
    const falling = trends.filter(t => t.trendDirection === 'falling');

    return {
      count: trends.length,
      avgStrength: trends.reduce((sum, t) => sum + t.trendStrength, 0) / trends.length || 0,
      latestUpdate: new Date().toISOString(),
      rising: rising.slice(0, 3),
      falling: falling.slice(0, 3)
    };
  }

  private async getCompetitiveMetrics() {
    return {
      analysisDate: new Date().toISOString(),
      competitorCount: 4, // Slated, Stage32, SeedSpark, FilmHub
      recommendations: [
        'Focus on AI-powered matching algorithms',
        'Implement competitive pricing strategy',
        'Expand into micro-budget film financing',
        'Strengthen international market presence'
      ],
      marketGaps: [
        'AI-integrated pitch analysis',
        'Blockchain-based smart contracts',
        'Real-time market intelligence',
        'Automated legal document generation'
      ]
    };
  }

  // Utility methods
  private getNewsTemplates() {
    return [
      {
        title: 'Major Studio Announces $200M Investment in Horror Franchise',
        content: 'Leading entertainment conglomerate reveals plans for comprehensive horror universe...',
        summary: 'Studio commits significant resources to horror content development',
        category: 'investment' as const,
        tags: ['horror', 'franchise', 'studio', 'investment'],
        genreRelevance: ['horror', 'thriller'],
        impactScore: 9,
        urgencyLevel: 'high' as const
      },
      {
        title: 'Streaming Platform Orders 15 Limited Series for 2025 Slate',
        content: 'Major streaming service significantly expands original content production...',
        summary: 'Platform increases investment in premium limited series format',
        category: 'production' as const,
        tags: ['streaming', 'series', 'original content', 'production'],
        genreRelevance: ['drama', 'thriller', 'sci-fi'],
        impactScore: 8,
        urgencyLevel: 'medium' as const
      },
      {
        title: 'International Co-Production Tax Incentives Expanded',
        content: 'Multiple countries announce enhanced financial incentives for film collaboration...',
        summary: 'Government support for international film production increases',
        category: 'regulation' as const,
        tags: ['tax incentives', 'international', 'co-production', 'government'],
        genreRelevance: ['all'],
        impactScore: 7,
        urgencyLevel: 'medium' as const
      },
      {
        title: 'AI Technology Disrupts Traditional VFX Pipeline',
        content: 'Revolutionary artificial intelligence tools reduce post-production costs by 60%...',
        summary: 'AI advances significantly impact film production economics',
        category: 'technology' as const,
        tags: ['AI', 'VFX', 'technology', 'cost reduction'],
        genreRelevance: ['action', 'sci-fi', 'fantasy'],
        impactScore: 8,
        urgencyLevel: 'high' as const
      },
      {
        title: 'Independent Film Distribution Platform Launches',
        content: 'New digital platform promises direct-to-consumer film distribution...',
        summary: 'Alternative distribution model emerges for independent filmmakers',
        category: 'distribution' as const,
        tags: ['distribution', 'independent', 'platform', 'digital'],
        genreRelevance: ['drama', 'documentary', 'comedy'],
        impactScore: 6,
        urgencyLevel: 'low' as const
      }
    ];
  }

  private calculateRelevanceScore(template: any, request?: MarketIntelligenceRequest): number {
    let score = 0.5; // Base relevance

    // Genre relevance boost
    if (request?.genres) {
      const hasRelevantGenre = request.genres.some(g => 
        template.genreRelevance.includes(g) || template.genreRelevance.includes('all')
      );
      if (hasRelevantGenre) score += 0.3;
    }

    // Category relevance boost
    if (request?.categories?.includes(template.category)) {
      score += 0.2;
    }

    // Impact score influence
    score += (template.impactScore / 10) * 0.3;

    return Math.min(1.0, score);
  }

  private matchesRequest(item: MarketIntelligence, request?: MarketIntelligenceRequest): boolean {
    if (!request) return true;

    // Type filter
    if (request.types && !request.types.includes(item.intelligenceType)) {
      return false;
    }

    // Genre filter
    if (request.genres && request.genres.length > 0) {
      const hasRelevantGenre = request.genres.some(g => 
        item.genreRelevance.includes(g)
      );
      if (!hasRelevantGenre) return false;
    }

    // Category filter
    if (request.categories && !request.categories.includes(item.category)) {
      return false;
    }

    // Relevance score filter
    if (request.minRelevanceScore && item.relevanceScore < request.minRelevanceScore) {
      return false;
    }

    // Time range filter
    if (request.timeRange) {
      const publishedDate = new Date(item.publishedDate || item.createdAt);
      const start = new Date(request.timeRange.start);
      const end = new Date(request.timeRange.end);
      
      if (publishedDate < start || publishedDate > end) {
        return false;
      }
    }

    return true;
  }

  private generateHistoricalData(type: string): Array<{ month: string; performance: number; volume: number }> {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return months.map(month => {
      let performance: number;
      let volume: number;

      switch (type) {
        case 'horror':
          performance = 40000000 + Math.random() * 20000000;
          volume = 8 + Math.floor(Math.random() * 6);
          break;
        case 'series':
          performance = 75000000 + Math.random() * 30000000;
          volume = 12 + Math.floor(Math.random() * 8);
          break;
        case 'micro_budget':
          performance = 2000000 + Math.random() * 1500000;
          volume = 20 + Math.floor(Math.random() * 15);
          break;
        default:
          performance = 50000000 + Math.random() * 25000000;
          volume = 10 + Math.floor(Math.random() * 8);
      }

      return { month, performance: Math.round(performance), volume };
    });
  }

  private randomRecentDate(): Date {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const randomTime = sevenDaysAgo + Math.random() * (now - sevenDaysAgo);
    return new Date(randomTime);
  }

  private buildRequestCacheKey(request?: MarketIntelligenceRequest): string {
    if (!request) return 'market_intelligence:default';
    
    const keyParts = [
      'market_intelligence',
      request.types?.join(',') || 'all',
      request.genres?.join(',') || 'all',
      request.categories?.join(',') || 'all',
      request.limit || 50,
      request.minRelevanceScore || 0
    ];

    return keyParts.join(':');
  }

  private getDefaultDashboard(): IntelligenceDashboard {
    return {
      marketNews: {
        count: 0,
        avgRelevance: 0,
        latestUpdate: new Date().toISOString(),
        topStories: []
      },
      opportunities: {
        count: 0,
        avgScore: 0,
        latestUpdate: new Date().toISOString(),
        highPriority: []
      },
      trends: {
        count: 0,
        avgStrength: 0,
        latestUpdate: new Date().toISOString(),
        rising: [],
        falling: []
      },
      competitive: {
        analysisDate: new Date().toISOString(),
        competitorCount: 0,
        recommendations: [],
        marketGaps: []
      }
    };
  }

  // Database storage methods
  private async storeMarketIntelligence(intelligence: MarketIntelligence[]): Promise<void> {
    try {
      for (const item of intelligence) {
        await this.db.execute(`
          INSERT INTO market_intelligence (
            id, intelligence_type, title, content, summary, source_name,
            category, tags, genre_relevance, relevance_score, impact_score,
            urgency_level, published_date, extracted_at, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING
        `, [
          item.id,
          item.intelligenceType,
          item.title,
          item.content,
          item.summary,
          item.sourceName,
          item.category,
          item.tags,
          item.genreRelevance,
          item.relevanceScore,
          item.impactScore,
          item.urgencyLevel,
          item.publishedDate,
          item.extractedAt,
          JSON.stringify(item.metadata || {})
        ]);
      }
    } catch (error) {
      console.error('Failed to store market intelligence:', error);
    }
  }

  private async storeTrends(trends: TrendAnalysis[]): Promise<void> {
    try {
      for (const trend of trends) {
        await this.db.execute(`
          INSERT INTO trend_analysis (
            id, trend_type, trend_name, trend_direction, trend_strength,
            momentum_score, recent_successes, recent_failures, average_performance,
            market_share, projected_direction, confidence_interval,
            factors_driving_trend, historical_data, analysis_period_start,
            analysis_period_end, data_sources, methodology
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (trend_type, trend_name, analysis_period_end) 
          DO UPDATE SET 
            trend_direction = $4,
            trend_strength = $5,
            momentum_score = $6,
            updated_at = NOW()
        `, [
          trend.id,
          trend.trendType,
          trend.trendName,
          trend.trendDirection,
          trend.trendStrength,
          trend.momentumScore,
          trend.recentSuccesses,
          trend.recentFailures,
          trend.averagePerformance,
          trend.marketShare,
          trend.projectedDirection,
          trend.confidenceInterval,
          trend.factorsDrivingTrend,
          JSON.stringify(trend.historicalData),
          trend.analysisPeriodStart,
          trend.analysisPeriodEnd,
          trend.dataSources,
          trend.methodology
        ]);
      }
    } catch (error) {
      console.error('Failed to store trends:', error);
    }
  }

  private async storeOpportunities(opportunities: InvestmentOpportunity[]): Promise<void> {
    try {
      for (const opp of opportunities) {
        await this.db.execute(`
          INSERT INTO investment_opportunities (
            id, opportunity_type, title, description, opportunity_source,
            opportunity_score, risk_level, time_sensitivity, estimated_investment_min,
            estimated_investment_max, estimated_roi_min, estimated_roi_max,
            payback_period_months, recommended_action, next_steps,
            key_contacts, status, alert_level, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          ON CONFLICT (id) DO NOTHING
        `, [
          opp.id,
          opp.opportunityType,
          opp.title,
          opp.description,
          opp.opportunitySource,
          opp.opportunityScore,
          opp.riskLevel,
          opp.timeSensitivity,
          opp.estimatedInvestmentMin,
          opp.estimatedInvestmentMax,
          opp.estimatedRoiMin,
          opp.estimatedRoiMax,
          opp.paybackPeriodMonths,
          opp.recommendedAction,
          JSON.stringify(opp.nextSteps),
          JSON.stringify(opp.keyContacts),
          opp.status,
          opp.alertLevel,
          opp.expiresAt
        ]);
      }
    } catch (error) {
      console.error('Failed to store opportunities:', error);
    }
  }

  private async getRecentNews(days: number = 7): Promise<MarketIntelligence[]> {
    try {
      const result = await this.db.execute(`
        SELECT * FROM market_intelligence 
        WHERE intelligence_type = 'news'
        AND published_date >= NOW() - INTERVAL '${days} days'
        ORDER BY relevance_score DESC, published_date DESC
        LIMIT 50
      `);

      return result.map((row: any) => ({
        id: row.id,
        intelligenceType: row.intelligence_type,
        title: row.title,
        content: row.content,
        summary: row.summary,
        sourceName: row.source_name,
        category: row.category,
        tags: row.tags,
        genreRelevance: row.genre_relevance,
        relevanceScore: row.relevance_score,
        impactScore: row.impact_score,
        urgencyLevel: row.urgency_level,
        publishedDate: row.published_date,
        extractedAt: row.extracted_at,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Failed to get recent news:', error);
      return [];
    }
  }

  private async getActiveOpportunities(): Promise<InvestmentOpportunity[]> {
    try {
      const result = await this.db.execute(`
        SELECT * FROM investment_opportunities 
        WHERE status IN ('new', 'investigating')
        AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY opportunity_score DESC, created_at DESC
        LIMIT 20
      `);

      return result.map((row: any) => ({
        id: row.id,
        opportunityType: row.opportunity_type,
        title: row.title,
        description: row.description,
        opportunitySource: row.opportunity_source,
        opportunityScore: row.opportunity_score,
        riskLevel: row.risk_level,
        timeSensitivity: row.time_sensitivity,
        estimatedInvestmentMin: row.estimated_investment_min,
        estimatedInvestmentMax: row.estimated_investment_max,
        estimatedRoiMin: row.estimated_roi_min,
        estimatedRoiMax: row.estimated_roi_max,
        paybackPeriodMonths: row.payback_period_months,
        recommendedAction: row.recommended_action,
        nextSteps: row.next_steps,
        keyContacts: row.key_contacts,
        status: row.status,
        alertLevel: row.alert_level,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Failed to get active opportunities:', error);
      return [];
    }
  }
}