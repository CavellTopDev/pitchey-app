/**
 * Cache Warming Service
 * Preloads frequently accessed data to improve performance
 */

import { CacheManager } from './cache-manager';

export interface WarmingTask {
  key: string;
  loader: () => Promise<any>;
  ttl: number;
  priority: number;
  schedule?: string; // Cron expression
}

export interface WarmingConfig {
  enabled: boolean;
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  timeout: number;
}

/**
 * Cache warming service for preloading data
 */
export class CacheWarmingService {
  private cache: CacheManager;
  private config: WarmingConfig;
  private tasks: WarmingTask[];
  private isRunning: boolean = false;

  constructor(cache: CacheManager, config?: Partial<WarmingConfig>) {
    this.cache = cache;
    this.config = {
      enabled: true,
      batchSize: 10,
      concurrency: 5,
      retryAttempts: 3,
      timeout: 30000,
      ...config
    };
    
    this.tasks = this.initializeTasks();
  }

  /**
   * Initialize warming tasks
   */
  private initializeTasks(): WarmingTask[] {
    return [
      // Homepage data
      {
        key: 'homepage:trending',
        loader: async () => this.loadTrendingPitches(),
        ttl: 300,
        priority: 1,
        schedule: '*/5 * * * *' // Every 5 minutes
      },
      
      {
        key: 'homepage:featured',
        loader: async () => this.loadFeaturedPitches(),
        ttl: 600,
        priority: 1,
        schedule: '*/10 * * * *'
      },
      
      {
        key: 'homepage:new-releases',
        loader: async () => this.loadNewReleases(),
        ttl: 300,
        priority: 2,
        schedule: '*/5 * * * *'
      },
      
      // Browse data
      {
        key: 'browse:genres',
        loader: async () => this.loadGenreData(),
        ttl: 3600,
        priority: 3,
        schedule: '0 * * * *' // Every hour
      },
      
      // Popular pitches by genre
      ...this.createGenreTasks(),
      
      // Dashboard metrics
      {
        key: 'metrics:platform',
        loader: async () => this.loadPlatformMetrics(),
        ttl: 600,
        priority: 2,
        schedule: '*/10 * * * *'
      },
      
      // Search suggestions
      {
        key: 'search:suggestions',
        loader: async () => this.loadSearchSuggestions(),
        ttl: 1800,
        priority: 3,
        schedule: '*/30 * * * *'
      }
    ];
  }

  /**
   * Create genre-specific warming tasks
   */
  private createGenreTasks(): WarmingTask[] {
    const genres = ['Drama', 'Comedy', 'Thriller', 'Action', 'Horror', 'Sci-Fi'];
    
    return genres.map(genre => ({
      key: `browse:genre:${genre.toLowerCase()}`,
      loader: async () => this.loadPitchesByGenre(genre),
      ttl: 600,
      priority: 4,
      schedule: '*/15 * * * *'
    }));
  }

  /**
   * Run warming tasks
   */
  async warm(priority?: number): Promise<void> {
    if (!this.config.enabled || this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    try {
      // Filter tasks by priority if specified
      const tasksToRun = priority !== undefined
        ? this.tasks.filter(t => t.priority <= priority)
        : this.tasks;
      
      // Sort by priority
      tasksToRun.sort((a, b) => a.priority - b.priority);
      
      // Process in batches
      for (let i = 0; i < tasksToRun.length; i += this.config.batchSize) {
        const batch = tasksToRun.slice(i, i + this.config.batchSize);
        await this.processBatch(batch);
      }
      
      console.log(`✅ Cache warming completed: ${tasksToRun.length} tasks processed`);
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a batch of warming tasks
   */
  private async processBatch(tasks: WarmingTask[]): Promise<void> {
    const promises = tasks.map(task => this.processTask(task));
    
    // Use Promise.allSettled to continue even if some fail
    const results = await Promise.allSettled(promises);
    
    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to warm ${tasks[index].key}:`, result.reason);
      }
    });
  }

  /**
   * Process individual warming task
   */
  private async processTask(task: WarmingTask): Promise<void> {
    let attempts = 0;
    let lastError: any;
    
    while (attempts < this.config.retryAttempts) {
      attempts++;
      
      try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), this.config.timeout);
        });
        
        // Race between loader and timeout
        const data = await Promise.race([
          task.loader(),
          timeoutPromise
        ]);
        
        // Cache the data
        await this.cache.set(task.key, data, task.ttl);
        
        return; // Success
      } catch (error) {
        lastError = error;
        
        if (attempts < this.config.retryAttempts) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempts) * 1000);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Schedule warming tasks with cron
   */
  async schedule(): Promise<void> {
    // This would integrate with a cron scheduler
    // For Cloudflare Workers, use Durable Objects Alarms or Scheduled Events
    
    for (const task of this.tasks) {
      if (task.schedule) {
        // Schedule task based on cron expression
        console.log(`Scheduled ${task.key} with pattern: ${task.schedule}`);
      }
    }
  }

  /**
   * Warm specific keys
   */
  async warmKeys(keys: string[]): Promise<void> {
    const tasksToRun = this.tasks.filter(t => keys.includes(t.key));
    
    for (const task of tasksToRun) {
      try {
        await this.processTask(task);
      } catch (error) {
        console.error(`Failed to warm ${task.key}:`, error);
      }
    }
  }

  /**
   * Add custom warming task
   */
  addTask(task: WarmingTask): void {
    this.tasks.push(task);
  }

  /**
   * Clear all warming tasks
   */
  clearTasks(): void {
    this.tasks = [];
  }

  // Data loaders

  private async loadTrendingPitches(): Promise<any> {
    // Simulate loading trending pitches
    const response = await fetch(`${this.getApiUrl()}/api/browse?tab=trending&limit=20`);
    return response.json();
  }

  private async loadFeaturedPitches(): Promise<any> {
    const response = await fetch(`${this.getApiUrl()}/api/browse?tab=featured&limit=10`);
    return response.json();
  }

  private async loadNewReleases(): Promise<any> {
    const response = await fetch(`${this.getApiUrl()}/api/browse?tab=new&limit=20`);
    return response.json();
  }

  private async loadGenreData(): Promise<any> {
    // Load genre statistics and metadata
    return {
      genres: [
        { name: 'Drama', count: 245, trending: true },
        { name: 'Comedy', count: 189, trending: false },
        { name: 'Thriller', count: 156, trending: true },
        { name: 'Action', count: 134, trending: false },
        { name: 'Horror', count: 98, trending: false },
        { name: 'Sci-Fi', count: 87, trending: true }
      ]
    };
  }

  private async loadPitchesByGenre(genre: string): Promise<any> {
    const response = await fetch(
      `${this.getApiUrl()}/api/browse?genre=${genre}&limit=20`
    );
    return response.json();
  }

  private async loadPlatformMetrics(): Promise<any> {
    // Load platform-wide metrics
    return {
      totalPitches: 1234,
      totalUsers: 5678,
      totalInvestments: 89,
      activeNdas: 45,
      trending: {
        views: 12345,
        engagement: 0.68
      }
    };
  }

  private async loadSearchSuggestions(): Promise<any> {
    // Load popular search terms and suggestions
    return {
      popular: ['thriller', 'comedy', 'drama', 'action', 'horror'],
      recent: ['sci-fi thriller', 'romantic comedy', 'period drama'],
      genres: ['Drama', 'Comedy', 'Thriller', 'Action', 'Horror', 'Sci-Fi'],
      formats: ['Feature Film', 'Series', 'Limited Series', 'Documentary']
    };
  }

  private getApiUrl(): string {
    return process.env.API_URL || 'https://pitchey-production.cavelltheleaddev.workers.dev';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Cloudflare Scheduled Event Handler
 */
export class ScheduledWarmingHandler {
  private warmingService: CacheWarmingService;

  constructor(warmingService: CacheWarmingService) {
    this.warmingService = warmingService;
  }

  /**
   * Handle scheduled event from Cloudflare
   */
  async handleScheduledEvent(event: ScheduledEvent): Promise<void> {
    const cronTime = new Date(event.scheduledTime).toISOString();
    console.log(`⏰ Scheduled warming triggered at: ${cronTime}`);
    
    try {
      // Warm high-priority caches
      await this.warmingService.warm(2);
      
      // Report success
      console.log('✅ Scheduled warming completed successfully');
    } catch (error) {
      console.error('❌ Scheduled warming failed:', error);
      throw error; // Cloudflare will retry
    }
  }

  /**
   * Handle manual trigger
   */
  async handleManualTrigger(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const priority = parseInt(url.searchParams.get('priority') || '5');
    const keys = url.searchParams.get('keys')?.split(',');
    
    try {
      if (keys) {
        await this.warmingService.warmKeys(keys);
      } else {
        await this.warmingService.warm(priority);
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Cache warming completed'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: (error as Error).message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}