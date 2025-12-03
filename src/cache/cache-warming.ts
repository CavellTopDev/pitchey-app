/**
 * Cache Warming and Predictive Pre-fetching Service
 * Implements intelligent cache population strategies
 */

import { EnhancedKVCache } from './worker-kv-cache';
import { AdvancedCacheService } from './advanced-cache-service';

export interface WarmingStrategy {
  name: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  schedule?: string; // Cron expression
  keys?: string[];
  keyGenerator?: () => Promise<string[]>;
  fetcher: (key: string) => Promise<any>;
  ttl?: number;
  batchSize?: number;
  delayMs?: number;
}

export interface PrefetchRule {
  pattern: RegExp;
  predictor: (key: string) => string[];
  probability?: number; // 0-1, likelihood to prefetch
}

export class CacheWarmingService {
  private strategies: Map<string, WarmingStrategy> = new Map();
  private prefetchRules: PrefetchRule[] = [];
  private warmingInProgress: Set<string> = new Set();
  private accessPatterns: Map<string, string[]> = new Map();
  private kvCache?: EnhancedKVCache;
  private browserCache?: AdvancedCacheService;
  
  constructor(options?: {
    kvCache?: EnhancedKVCache;
    browserCache?: AdvancedCacheService;
  }) {
    this.kvCache = options?.kvCache;
    this.browserCache = options?.browserCache;
    
    // Initialize default strategies
    this.initializeDefaultStrategies();
    
    // Start pattern learning
    this.startPatternLearning();
  }
  
  private initializeDefaultStrategies() {
    // Critical data - warm on startup
    this.addStrategy({
      name: 'critical-config',
      priority: 'critical',
      keys: [
        '/api/config',
        '/api/user/profile',
        '/api/subscription-status',
      ],
      fetcher: async (key) => {
        const response = await fetch(key);
        return response.json();
      },
      ttl: 3600, // 1 hour
    });
    
    // Popular content - warm periodically
    this.addStrategy({
      name: 'popular-pitches',
      priority: 'high',
      schedule: '0 */15 * * *', // Every 15 minutes
      keyGenerator: async () => {
        // Get trending pitch IDs
        const response = await fetch('/api/pitches/trending');
        const pitches = await response.json();
        return pitches.map(p => `/api/pitches/${p.id}`);
      },
      fetcher: async (key) => {
        const response = await fetch(key);
        return response.json();
      },
      ttl: 900, // 15 minutes
      batchSize: 5,
    });
    
    // User-specific data - warm on login
    this.addStrategy({
      name: 'user-data',
      priority: 'normal',
      keyGenerator: async () => {
        const userId = await this.getCurrentUserId();
        if (!userId) return [];
        
        return [
          `/api/user/${userId}/dashboard`,
          `/api/user/${userId}/notifications`,
          `/api/user/${userId}/pitches`,
          `/api/user/${userId}/investments`,
        ];
      },
      fetcher: async (key) => {
        const response = await fetch(key, {
          credentials: 'include',
        });
        return response.json();
      },
      ttl: 1800, // 30 minutes
    });
    
    // Static assets - warm on deploy
    this.addStrategy({
      name: 'static-assets',
      priority: 'low',
      keys: [
        '/assets/css/main.css',
        '/assets/js/app.js',
        '/assets/fonts/main.woff2',
      ],
      fetcher: async (key) => {
        const response = await fetch(key);
        return response.blob();
      },
      ttl: 86400, // 24 hours
    });
  }
  
  // Add warming strategy
  addStrategy(strategy: WarmingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    
    // Schedule if cron expression provided
    if (strategy.schedule) {
      this.scheduleStrategy(strategy);
    }
  }
  
  // Remove warming strategy
  removeStrategy(name: string): void {
    this.strategies.delete(name);
  }
  
  // Execute warming strategy
  async warmStrategy(name: string): Promise<void> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Strategy ${name} not found`);
    }
    
    // Check if already warming
    if (this.warmingInProgress.has(name)) {
      console.log(`Strategy ${name} already in progress`);
      return;
    }
    
    this.warmingInProgress.add(name);
    
    try {
      // Get keys to warm
      const keys = strategy.keys || (await strategy.keyGenerator?.()) || [];
      
      if (keys.length === 0) {
        console.log(`No keys to warm for strategy ${name}`);
        return;
      }
      
      console.log(`Warming ${keys.length} keys for strategy ${name}`);
      
      // Warm in batches
      const batchSize = strategy.batchSize || 10;
      const delayMs = strategy.delayMs || 100;
      
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (key) => {
            try {
              const value = await strategy.fetcher(key);
              
              // Cache in appropriate layer
              if (this.kvCache && strategy.priority !== 'low') {
                await this.kvCache.set(key, value, { ttl: strategy.ttl });
              }
              
              if (this.browserCache && strategy.priority !== 'critical') {
                await this.browserCache.set(key, value, { 
                  ttl: strategy.ttl ? strategy.ttl * 1000 : undefined 
                });
              }
              
              console.log(`Warmed: ${key}`);
            } catch (error) {
              console.error(`Failed to warm ${key}:`, error);
            }
          })
        );
        
        // Delay between batches
        if (i + batchSize < keys.length && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      console.log(`Strategy ${name} completed`);
    } finally {
      this.warmingInProgress.delete(name);
    }
  }
  
  // Warm all strategies by priority
  async warmAll(): Promise<void> {
    const sortedStrategies = Array.from(this.strategies.values()).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    for (const strategy of sortedStrategies) {
      await this.warmStrategy(strategy.name);
    }
  }
  
  // Warm critical strategies only
  async warmCritical(): Promise<void> {
    const criticalStrategies = Array.from(this.strategies.values())
      .filter(s => s.priority === 'critical');
    
    await Promise.all(
      criticalStrategies.map(s => this.warmStrategy(s.name))
    );
  }
  
  // Add prefetch rule
  addPrefetchRule(rule: PrefetchRule): void {
    this.prefetchRules.push(rule);
  }
  
  // Predictive prefetch based on current access
  async predictivePrefetch(currentKey: string): Promise<void> {
    // Check prefetch rules
    for (const rule of this.prefetchRules) {
      if (rule.pattern.test(currentKey)) {
        // Check probability
        if (rule.probability && Math.random() > rule.probability) {
          continue;
        }
        
        const predictedKeys = rule.predictor(currentKey);
        
        // Prefetch in background
        setTimeout(() => {
          this.prefetchKeys(predictedKeys).catch(console.error);
        }, 0);
        
        break;
      }
    }
    
    // Learn access patterns
    this.recordAccessPattern(currentKey);
    
    // Predict based on learned patterns
    const learnedPredictions = this.predictFromPatterns(currentKey);
    if (learnedPredictions.length > 0) {
      setTimeout(() => {
        this.prefetchKeys(learnedPredictions).catch(console.error);
      }, 100);
    }
  }
  
  // Prefetch specific keys
  private async prefetchKeys(keys: string[]): Promise<void> {
    const MAX_PREFETCH = 5;
    const keysToFetch = keys.slice(0, MAX_PREFETCH);
    
    console.log(`Prefetching ${keysToFetch.length} keys`);
    
    await Promise.all(
      keysToFetch.map(async (key) => {
        try {
          // Check if already cached
          if (this.browserCache) {
            const cached = await this.browserCache.get(key);
            if (cached) return;
          }
          
          // Fetch and cache
          const response = await fetch(key);
          const data = await response.json();
          
          if (this.browserCache) {
            await this.browserCache.set(key, data, {
              ttl: 300000, // 5 minutes for prefetched data
              layers: ['l2_memory'], // Don't pollute hot cache
            });
          }
        } catch (error) {
          // Silently fail for prefetch
          console.debug(`Prefetch failed for ${key}:`, error);
        }
      })
    );
  }
  
  // Pattern learning
  private startPatternLearning(): void {
    // Clean old patterns periodically
    setInterval(() => {
      const now = Date.now();
      const maxAge = 3600000; // 1 hour
      
      for (const [key, patterns] of this.accessPatterns) {
        // Keep only recent patterns
        const recentPatterns = patterns.filter(p => {
          const timestamp = parseInt(p.split('|')[1] || '0');
          return now - timestamp < maxAge;
        });
        
        if (recentPatterns.length === 0) {
          this.accessPatterns.delete(key);
        } else {
          this.accessPatterns.set(key, recentPatterns);
        }
      }
    }, 300000); // Every 5 minutes
  }
  
  private recordAccessPattern(key: string): void {
    const timestamp = Date.now();
    const pattern = `${key}|${timestamp}`;
    
    // Get previous access
    const lastAccess = this.getLastAccess();
    if (lastAccess) {
      if (!this.accessPatterns.has(lastAccess)) {
        this.accessPatterns.set(lastAccess, []);
      }
      this.accessPatterns.get(lastAccess)!.push(pattern);
      
      // Limit pattern history
      const patterns = this.accessPatterns.get(lastAccess)!;
      if (patterns.length > 10) {
        patterns.shift();
      }
    }
    
    // Store current access
    this.setLastAccess(key);
  }
  
  private predictFromPatterns(currentKey: string): string[] {
    const patterns = this.accessPatterns.get(currentKey) || [];
    const predictions: Map<string, number> = new Map();
    
    // Count frequency of next accesses
    for (const pattern of patterns) {
      const nextKey = pattern.split('|')[0];
      predictions.set(nextKey, (predictions.get(nextKey) || 0) + 1);
    }
    
    // Sort by frequency and return top predictions
    return Array.from(predictions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key);
  }
  
  // Helper methods
  private scheduleStrategy(strategy: WarmingStrategy): void {
    // This would integrate with a cron scheduler
    // For now, using simple interval for demonstration
    const interval = this.parseSchedule(strategy.schedule!);
    
    setInterval(() => {
      this.warmStrategy(strategy.name).catch(console.error);
    }, interval);
  }
  
  private parseSchedule(schedule: string): number {
    // Simple parser for demonstration
    // In production, use a proper cron parser
    if (schedule.includes('*/15')) return 15 * 60 * 1000; // 15 minutes
    if (schedule.includes('*/30')) return 30 * 60 * 1000; // 30 minutes
    if (schedule.includes('0 *')) return 60 * 60 * 1000; // 1 hour
    return 60 * 60 * 1000; // Default to 1 hour
  }
  
  private async getCurrentUserId(): Promise<string | null> {
    // Get from auth context or storage
    try {
      const auth = localStorage.getItem('auth');
      if (auth) {
        const { userId } = JSON.parse(auth);
        return userId;
      }
    } catch {}
    return null;
  }
  
  private lastAccess: string | null = null;
  
  private getLastAccess(): string | null {
    return this.lastAccess;
  }
  
  private setLastAccess(key: string): void {
    this.lastAccess = key;
  }
}

// Default prefetch rules
export const defaultPrefetchRules: PrefetchRule[] = [
  // Pitch detail -> Related pitches
  {
    pattern: /^\/api\/pitches\/(\d+)$/,
    predictor: (key) => {
      const id = key.match(/(\d+)$/)?.[1];
      return [
        `/api/pitches/${id}/related`,
        `/api/pitches/${id}/characters`,
        `/api/pitches/${id}/media`,
      ];
    },
    probability: 0.8,
  },
  
  // User profile -> User pitches
  {
    pattern: /^\/api\/users\/(\d+)$/,
    predictor: (key) => {
      const id = key.match(/(\d+)$/)?.[1];
      return [
        `/api/users/${id}/pitches`,
        `/api/users/${id}/portfolio`,
      ];
    },
    probability: 0.7,
  },
  
  // Browse -> Pagination
  {
    pattern: /^\/api\/browse\?.*page=(\d+)/,
    predictor: (key) => {
      const currentPage = parseInt(key.match(/page=(\d+)/)?.[1] || '1');
      const nextPage = currentPage + 1;
      const prevPage = Math.max(1, currentPage - 1);
      
      return [
        key.replace(`page=${currentPage}`, `page=${nextPage}`),
        key.replace(`page=${currentPage}`, `page=${prevPage}`),
      ];
    },
    probability: 0.6,
  },
  
  // Dashboard -> Metrics
  {
    pattern: /^\/api\/dashboard$/,
    predictor: () => [
      '/api/dashboard/metrics',
      '/api/dashboard/recent-activity',
      '/api/dashboard/notifications',
    ],
    probability: 0.9,
  },
];

// Export singleton instance
export const cacheWarming = new CacheWarmingService();