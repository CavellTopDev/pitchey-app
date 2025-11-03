/**
 * Performance Monitoring Utilities
 * 
 * Features:
 * - Web Vitals monitoring (LCP, FID, CLS, FCP, TTFB)
 * - Custom performance marks and measures
 * - Resource timing analysis
 * - Bundle size tracking
 */

// Web Vitals types
export interface Metric {
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  entries: PerformanceEntry[]
  id: string
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'prerender'
}

// Performance thresholds based on Web Vitals
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
}

/**
 * Get rating for a metric value
 */
export const getRating = (
  metricName: keyof typeof PERFORMANCE_THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' => {
  const threshold = PERFORMANCE_THRESHOLDS[metricName]
  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

/**
 * Report Web Vitals to analytics or monitoring service
 */
export const reportWebVitals = (metric: Metric) => {
  // Log to console in development
  if (import.meta.env.DEV) {
    const color = metric.rating === 'good' ? 'green' : 
                  metric.rating === 'needs-improvement' ? 'orange' : 'red'
    console.log(
      `%c[${metric.name}] ${metric.value.toFixed(2)}ms (${metric.rating})`,
      `color: ${color}; font-weight: bold`
    )
  }

  // Send to analytics (replace with your analytics service)
  if (window.gtag) {
    window.gtag('event', metric.name, {
      event_category: 'Web Vitals',
      event_label: metric.id,
      value: Math.round(metric.value),
      metric_rating: metric.rating,
      navigation_type: metric.navigationType,
      non_interaction: true,
    })
  }

  // Send to custom monitoring endpoint
  if (import.meta.env.PROD) {
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {
      // Silently fail metrics reporting
    })
  }
}

/**
 * Initialize Web Vitals monitoring
 */
export const initWebVitals = async () => {
  if ('web-vitals' in window) return

  try {
    const { onLCP, onFID, onCLS, onFCP, onTTFB, onINP } = await import('web-vitals')
    
    onLCP(reportWebVitals)
    onFID(reportWebVitals)
    onCLS(reportWebVitals)
    onFCP(reportWebVitals)
    onTTFB(reportWebVitals)
    onINP(reportWebVitals)
  } catch (error) {
    console.warn('Failed to load web-vitals:', error)
  }
}

/**
 * Custom performance marking
 */
export const performanceMark = (markName: string) => {
  if (performance && performance.mark) {
    performance.mark(markName)
  }
}

/**
 * Measure performance between marks
 */
export const performanceMeasure = (
  measureName: string,
  startMark: string,
  endMark?: string
) => {
  if (performance && performance.measure) {
    try {
      performance.measure(measureName, startMark, endMark)
      const entries = performance.getEntriesByName(measureName)
      const lastEntry = entries[entries.length - 1]
      
      if (lastEntry && import.meta.env.DEV) {
        console.log(`[Performance] ${measureName}: ${lastEntry.duration.toFixed(2)}ms`)
      }
      
      return lastEntry?.duration
    } catch (error) {
      console.warn('Performance measure failed:', error)
    }
  }
  return null
}

/**
 * Monitor resource loading performance
 */
export const getResourceTimings = () => {
  if (!performance || !performance.getEntriesByType) return []
  
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  
  return resources.map(resource => ({
    name: resource.name,
    type: resource.initiatorType,
    duration: resource.duration,
    transferSize: resource.transferSize || 0,
    encodedBodySize: resource.encodedBodySize || 0,
    decodedBodySize: resource.decodedBodySize || 0,
    isCache: resource.transferSize === 0 && resource.decodedBodySize > 0,
  }))
}

/**
 * Get bundle size information
 */
export const getBundleStats = () => {
  const resources = getResourceTimings()
  
  const jsResources = resources.filter(r => r.name.includes('.js'))
  const cssResources = resources.filter(r => r.name.includes('.css'))
  const imageResources = resources.filter(r => 
    ['img', 'image'].includes(r.type) || 
    r.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
  )
  
  const totalSize = resources.reduce((acc, r) => acc + r.transferSize, 0)
  const jsSize = jsResources.reduce((acc, r) => acc + r.transferSize, 0)
  const cssSize = cssResources.reduce((acc, r) => acc + r.transferSize, 0)
  const imageSize = imageResources.reduce((acc, r) => acc + r.transferSize, 0)
  
  return {
    totalSize,
    jsSize,
    cssSize,
    imageSize,
    jsCount: jsResources.length,
    cssCount: cssResources.length,
    imageCount: imageResources.length,
    totalCount: resources.length,
    cacheHitRate: resources.filter(r => r.isCache).length / resources.length,
  }
}

/**
 * Monitor long tasks (blocking the main thread)
 */
export const monitorLongTasks = (callback: (duration: number) => void) => {
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Long tasks are those blocking the main thread for 50ms or more
          if (entry.duration > 50) {
            callback(entry.duration)
            
            if (import.meta.env.DEV) {
              console.warn(`[Long Task] Duration: ${entry.duration.toFixed(2)}ms`)
            }
          }
        }
      })
      
      observer.observe({ entryTypes: ['longtask'] })
      return observer
    } catch (error) {
      console.warn('Long task monitoring not supported:', error)
    }
  }
  return null
}

/**
 * Prefetch critical resources
 */
export const prefetchResources = (urls: string[]) => {
  urls.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    link.as = url.endsWith('.js') ? 'script' : 
              url.endsWith('.css') ? 'style' : 
              url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' : 'fetch'
    document.head.appendChild(link)
  })
}

/**
 * Preload critical resources
 */
export const preloadResources = (resources: Array<{ url: string; as: string }>) => {
  resources.forEach(({ url, as }) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = url
    link.as = as
    if (as === 'font') {
      link.crossOrigin = 'anonymous'
    }
    document.head.appendChild(link)
  })
}

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitoring = () => {
  // Mark navigation start
  performanceMark('app-init')
  
  // Initialize Web Vitals
  initWebVitals()
  
  // Monitor long tasks
  monitorLongTasks((duration) => {
    // Report long tasks to analytics
    if (window.gtag) {
      window.gtag('event', 'long_task', {
        event_category: 'Performance',
        value: Math.round(duration),
        non_interaction: true,
      })
    }
  })
  
  // Log bundle stats after load
  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const stats = getBundleStats()
        console.log('[Bundle Stats]', {
          ...stats,
          totalSize: `${(stats.totalSize / 1024).toFixed(2)} KB`,
          jsSize: `${(stats.jsSize / 1024).toFixed(2)} KB`,
          cssSize: `${(stats.cssSize / 1024).toFixed(2)} KB`,
          imageSize: `${(stats.imageSize / 1024).toFixed(2)} KB`,
          cacheHitRate: `${(stats.cacheHitRate * 100).toFixed(2)}%`,
        })
      }, 1000)
    })
  }
}

// Export for use in window object
if (import.meta.env.DEV) {
  window.performanceUtils = {
    getResourceTimings,
    getBundleStats,
    performanceMark,
    performanceMeasure,
  }
}

// Declare global types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    performanceUtils?: {
      getResourceTimings: typeof getResourceTimings
      getBundleStats: typeof getBundleStats
      performanceMark: typeof performanceMark
      performanceMeasure: typeof performanceMeasure
    }
  }
}

export default {
  initPerformanceMonitoring,
  reportWebVitals,
  performanceMark,
  performanceMeasure,
  getResourceTimings,
  getBundleStats,
  monitorLongTasks,
  prefetchResources,
  preloadResources,
}