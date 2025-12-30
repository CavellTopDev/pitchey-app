/**
 * Performance Metrics Service
 * Fetches real-time metrics from the backend monitoring endpoints
 */

import { API_URL } from '@/config';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';

export interface MetricData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface PerformanceMetrics {
  responseTime: {
    current: number;
    p50: number;
    p95: number;
    p99: number;
    trend: MetricData[];
  };
  throughput: {
    current: number;
    rps: number;
    trend: MetricData[];
  };
  errorRate: {
    current: number;
    rate4xx: number;
    rate5xx: number;
    trend: MetricData[];
  };
  database: {
    queryTime: number;
    connections: number;
    slowQueries: number;
    trend: MetricData[];
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
    memory: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIn: number;
    networkOut: number;
  };
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: string;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: HealthStatus;
    redis: HealthStatus;
    storage: HealthStatus;
    cache: HealthStatus;
  };
  timestamp: string;
}

class MetricsService {
  private baseUrl = `${API_URL}/api`;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5000; // 5 seconds cache
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheKey = 'performance_metrics';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error('Failed to fetch performance metrics');
      }

      const data = await response.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const cacheKey = 'system_health';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });

      const data = await response.json();
      
      const health: SystemHealth = {
        overall: data.status === 'ready' ? 'healthy' : 
                 data.status === 'degraded' ? 'degraded' : 'unhealthy',
        services: {
          database: data.checks?.database || { service: 'database', status: 'unhealthy', latency: 'N/A' },
          redis: data.checks?.redis || { service: 'redis', status: 'unhealthy', latency: 'N/A' },
          storage: data.checks?.storage || { service: 'storage', status: 'unhealthy', latency: 'N/A' },
          cache: data.checks?.cache || { service: 'cache', status: 'unhealthy', latency: 'N/A' }
        },
        timestamp: data.timestamp || new Date().toISOString()
      };

      this.setCache(cacheKey, health);
      return health;
    } catch (error) {
      console.error('Error fetching system health:', error);
      return {
        overall: 'unhealthy',
        services: {
          database: { service: 'database', status: 'unhealthy', latency: 'N/A', error: 'Connection failed' },
          redis: { service: 'redis', status: 'unhealthy', latency: 'N/A', error: 'Connection failed' },
          storage: { service: 'storage', status: 'unhealthy', latency: 'N/A', error: 'Connection failed' },
          cache: { service: 'cache', status: 'unhealthy', latency: 'N/A', error: 'Connection failed' }
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get historical metrics for a specific time range
   */
  async getHistoricalMetrics(
    metric: string,
    timeRange: '1h' | '6h' | '24h' | '7d' | '30d'
  ): Promise<MetricData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/metrics/history?metric=${metric}&range=${timeRange}`, {
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch historical metrics');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching historical metrics:', error);
      return [];
    }
  }

  /**
   * Get real-time metrics for specific endpoints
   */
  async getEndpointMetrics(endpoint: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/metrics/endpoint?path=${encodeURIComponent(endpoint)}`, {
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch endpoint metrics');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching endpoint metrics:', error);
      return null;
    }
  }

  /**
   * Get database performance metrics
   */
  async getDatabaseMetrics(): Promise<any> {
    try {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error('Failed to fetch database metrics');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching database metrics:', error);
      return null;
    }
  }

  /**
   * Get cache performance metrics
   */
  async getCacheMetrics(): Promise<any> {
    try {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error('Failed to fetch cache metrics');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching cache metrics:', error);
      return null;
    }
  }

  /**
   * Connect to WebSocket for real-time metrics
   */
  connectWebSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = API_URL.replace('http', 'ws').replace('https', 'wss');
    this.ws = new WebSocket(`${wsUrl}/ws/metrics`);

    this.ws.onopen = () => {
      console.log('Connected to metrics WebSocket');
      this.ws?.send(JSON.stringify({ type: 'subscribe', metrics: ['all'] }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting in 5s...');
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  /**
   * Subscribe to real-time metric updates
   */
  subscribe(metric: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(metric)) {
      this.listeners.set(metric, new Set());
    }
    
    this.listeners.get(metric)!.add(callback);
    
    // Connect WebSocket if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connectWebSocket();
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(metric);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(metric);
        }
      }
    };
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(data: any): void {
    if (data.type === 'metric_update') {
      const listeners = this.listeners.get(data.metric);
      if (listeners) {
        listeners.forEach(callback => callback(data.value));
      }

      // Update cache
      if (data.metric === 'performance') {
        this.setCache('performance_metrics', data.value);
      } else if (data.metric === 'health') {
        this.setCache('system_health', data.value);
      }
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Get cached data if still valid
   */
  private getCached(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache data
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get default metrics when API is unavailable
   */
  private getDefaultMetrics(): PerformanceMetrics {
    return {
      responseTime: {
        current: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        trend: []
      },
      throughput: {
        current: 0,
        rps: 0,
        trend: []
      },
      errorRate: {
        current: 0,
        rate4xx: 0,
        rate5xx: 0,
        trend: []
      },
      database: {
        queryTime: 0,
        connections: 0,
        slowQueries: 0,
        trend: []
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictions: 0,
        memory: 0
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIn: 0,
        networkOut: 0
      }
    };
  }

  /**
   * Export metrics data as CSV
   */
  async exportMetricsCSV(timeRange: string): Promise<Blob> {
    const metrics = await this.getHistoricalMetrics('all', timeRange as any);
    
    const csv = [
      'Timestamp,Metric,Value',
      ...metrics.map(m => `${m.timestamp},${m.label},${m.value}`)
    ].join('\n');

    return new Blob([csv], { type: 'text/csv' });
  }

  /**
   * Get alert thresholds
   */
  async getAlertThresholds(): Promise<any> {
    try {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (!response.ok) {
        throw new Error('Failed to fetch alert thresholds');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching alert thresholds:', error);
      return {};
    }
  }

  /**
   * Update alert thresholds
   */
  async updateAlertThresholds(thresholds: any): Promise<boolean> {
    try {
    const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thresholds),
      credentials: 'include' // Send cookies for Better Auth session
    });

      return response.ok;
    } catch (error) {
      console.error('Error updating alert thresholds:', error);
      return false;
    }
  }
}

// Export singleton instance
export const metricsService = new MetricsService();

// Export hooks for React components
export function useMetrics() {
  return metricsService;
}