/**
 * Platform Optimization Service
 * Handles performance optimization, caching, and resource management
 */

import { LRUCache } from 'lru-cache';

interface OptimizationConfig {
  enableCaching: boolean;
  enableLazyLoading: boolean;
  enableCompression: boolean;
  enablePrefetching: boolean;
  cacheSize: number;
  cacheTTL: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  size: number;
}

interface ResourceHint {
  url: string;
  type: 'prefetch' | 'preload' | 'preconnect' | 'dns-prefetch';
  as?: string;
}

class OptimizationService {
  private config: OptimizationConfig;
  private cache: LRUCache<string, CacheEntry>;
  private pendingRequests: Map<string, Promise<any>>;
  private imageObserver?: IntersectionObserver;
  private resourceHints: Set<string>;
  private compressionWorker?: Worker;

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = {
      enableCaching: true,
      enableLazyLoading: true,
      enableCompression: true,
      enablePrefetching: true,
      cacheSize: 50 * 1024 * 1024, // 50MB
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      ...config,
    };

    this.cache = new LRUCache<string, CacheEntry>({
      max: this.config.cacheSize,
      ttl: this.config.cacheTTL,
      sizeCalculation: (entry) => entry.size,
      dispose: (entry) => {
        // Clean up when cache entry is removed
        if (entry.data instanceof Blob) {
          URL.revokeObjectURL(URL.createObjectURL(entry.data));
        }
      },
    });

    this.pendingRequests = new Map();
    this.resourceHints = new Set();

    this.initializeLazyLoading();
    this.initializeCompression();
    this.setupServiceWorker();
  }

  // ========== Caching Methods ==========
  
  async cacheFetch(url: string, options?: RequestInit): Promise<Response> {
    if (!this.config.enableCaching) {
      return fetch(url, options);
    }

    const cacheKey = this.getCacheKey(url, options);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return new Response(cached, { 
        headers: { 'X-Cache': 'HIT' } 
      });
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    // Make the request
    const requestPromise = fetch(url, options).then(async (response) => {
      if (response.ok) {
        const clone = response.clone();
        const data = await clone.blob();
        this.addToCache(cacheKey, data);
      }
      this.pendingRequests.delete(cacheKey);
      return response;
    });

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  private getCacheKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  private getFromCache(key: string): any {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < entry.ttl) {
      return entry.data;
    }
    return null;
  }

  private addToCache(key: string, data: any): void {
    const size = this.calculateSize(data);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
      size,
    };
    this.cache.set(key, entry);
  }

  private calculateSize(data: any): number {
    if (data instanceof Blob) {
      return data.size;
    }
    if (typeof data === 'string') {
      return new Blob([data]).size;
    }
    return JSON.stringify(data).length;
  }

  public clearCache(pattern?: string): void {
    if (pattern) {
      // Clear specific pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all
      this.cache.clear();
    }
  }

  // ========== Lazy Loading ==========
  
  private initializeLazyLoading(): void {
    if (!this.config.enableLazyLoading) return;

    // Create intersection observer for images
    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          if (src) {
            this.loadImage(img, src);
            this.imageObserver?.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px',
      threshold: 0.01,
    });
  }

  public lazyLoadImage(element: HTMLImageElement): void {
    if (this.imageObserver && element.dataset.src) {
      this.imageObserver.observe(element);
    }
  }

  private async loadImage(img: HTMLImageElement, src: string): Promise<void> {
    try {
      // Add loading animation
      img.classList.add('loading');
      
      // Prefetch if enabled
      if (this.config.enablePrefetching) {
        await this.prefetchResource(src);
      }
      
      // Load image
      const response = await this.cacheFetch(src);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      img.src = objectUrl;
      img.onload = () => {
        img.classList.remove('loading');
        img.classList.add('loaded');
        // Clean up object URL after image loads
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      };
    } catch (error) {
      console.error('Failed to lazy load image:', error);
      img.classList.remove('loading');
      img.classList.add('error');
    }
  }

  // ========== Compression ==========
  
  private initializeCompression(): void {
    if (!this.config.enableCompression) return;

    // Initialize compression worker if available
    if (typeof Worker !== 'undefined') {
      // Note: Worker code would be in separate file
      // this.compressionWorker = new Worker('/workers/compression.js');
    }
  }

  public async compressData(data: any): Promise<ArrayBuffer> {
    if (!this.config.enableCompression) {
      return data;
    }

    // Use native compression if available
    if ('CompressionStream' in window) {
      const stream = new Response(data).body;
      if (!stream) throw new Error('No stream available');
      
      const compressedStream = stream.pipeThrough(
        new (window as any).CompressionStream('gzip')
      );
      const response = new Response(compressedStream);
      return response.arrayBuffer();
    }

    // Fallback to worker or no compression
    return data;
  }

  public async decompressData(data: ArrayBuffer): Promise<any> {
    if (!this.config.enableCompression) {
      return data;
    }

    // Use native decompression if available
    if ('DecompressionStream' in window) {
      const stream = new Response(data).body;
      if (!stream) throw new Error('No stream available');
      
      const decompressedStream = stream.pipeThrough(
        new (window as any).DecompressionStream('gzip')
      );
      const response = new Response(decompressedStream);
      return response.arrayBuffer();
    }

    return data;
  }

  // ========== Prefetching ==========
  
  public prefetchResource(url: string, type?: string): void {
    if (!this.config.enablePrefetching) return;
    
    // Avoid duplicate prefetches
    if (this.resourceHints.has(url)) return;
    
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    if (type) {
      link.as = type;
    }
    document.head.appendChild(link);
    this.resourceHints.add(url);
  }

  public preloadResource(url: string, type: string): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = type;
    document.head.appendChild(link);
    this.resourceHints.add(url);
  }

  public preconnect(origin: string): void {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
    this.resourceHints.add(origin);
  }

  public dnsPrefetch(origin: string): void {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = origin;
    document.head.appendChild(link);
    this.resourceHints.add(origin);
  }

  // ========== Service Worker ==========
  
  private async setupServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration.scope);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('New service worker activated');
                // Notify user of update
                this.notifyUpdate();
              }
            });
          }
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  private notifyUpdate(): void {
    // Notify user that an update is available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('App Updated', {
        body: 'A new version is available. Please refresh.',
        icon: '/icon-192.png',
      });
    }
  }

  // ========== Bundle Optimization ==========
  
  public async loadChunk(chunkName: string): Promise<any> {
    // Dynamic import for code splitting
    switch (chunkName) {
      case 'analytics':
        return import('../analytics/analytics.module');
      case 'admin':
        return import('../admin/admin.module');
      case 'video':
        return import('../video/video.module');
      default:
        throw new Error(`Unknown chunk: ${chunkName}`);
    }
  }

  public preloadChunks(chunks: string[]): void {
    chunks.forEach((chunk) => {
      // Preload chunks that might be needed soon
      this.loadChunk(chunk).catch(console.error);
    });
  }

  // ========== Image Optimization ==========
  
  public getOptimizedImageUrl(
    url: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'avif' | 'jpg';
    } = {}
  ): string {
    // If using Cloudflare Images or similar service
    const params = new URLSearchParams();
    
    if (options.width) params.append('w', options.width.toString());
    if (options.height) params.append('h', options.height.toString());
    if (options.quality) params.append('q', options.quality.toString());
    if (options.format) params.append('f', options.format);
    
    return `${url}?${params.toString()}`;
  }

  public generateSrcSet(
    baseUrl: string,
    widths: number[] = [320, 640, 960, 1280, 1920]
  ): string {
    return widths
      .map((w) => `${this.getOptimizedImageUrl(baseUrl, { width: w })} ${w}w`)
      .join(', ');
  }

  // ========== Performance Budget ==========
  
  public checkPerformanceBudget(): {
    passed: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    
    // Check bundle size
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const totalScriptSize = scripts.reduce((sum, script) => {
      // This would need actual size checking
      return sum + 100000; // Placeholder
    }, 0);
    
    if (totalScriptSize > 500000) { // 500KB budget
      violations.push(`JavaScript bundle size exceeds budget: ${totalScriptSize / 1000}KB`);
    }
    
    // Check image sizes
    const images = Array.from(document.querySelectorAll('img'));
    images.forEach((img) => {
      if (img.naturalWidth > 2000) {
        violations.push(`Image too large: ${img.src}`);
      }
    });
    
    // Check number of requests
    const resources = performance.getEntriesByType('resource');
    if (resources.length > 100) {
      violations.push(`Too many requests: ${resources.length}`);
    }
    
    return {
      passed: violations.length === 0,
      violations,
    };
  }

  // ========== Memory Management ==========
  
  public releaseMemory(): void {
    // Clear caches
    this.cache.clear();
    
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Revoke object URLs
    const images = Array.from(document.querySelectorAll('img[src^="blob:"]'));
    images.forEach((img) => {
      URL.revokeObjectURL(img.src);
    });
    
    // Run garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
  }

  public getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }

  // ========== Cleanup ==========
  
  public destroy(): void {
    // Disconnect observers
    this.imageObserver?.disconnect();
    
    // Clear cache
    this.cache.clear();
    
    // Terminate worker
    this.compressionWorker?.terminate();
    
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Remove resource hints
    this.resourceHints.forEach((url) => {
      const links = document.querySelectorAll(`link[href="${url}"]`);
      links.forEach((link) => link.remove());
    });
    this.resourceHints.clear();
  }
}

// Singleton instance
let optimizationService: OptimizationService | null = null;

export function initializeOptimization(config?: Partial<OptimizationConfig>): OptimizationService {
  if (!optimizationService) {
    optimizationService = new OptimizationService(config);
  }
  return optimizationService;
}

export function getOptimizationService(): OptimizationService | null {
  return optimizationService;
}

export default OptimizationService;