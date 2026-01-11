import { lazy, Suspense, ComponentType } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

// Retry mechanism for failed dynamic imports
const retry = (fn: () => Promise<any>, retriesLeft = 5, interval = 1000): Promise<any> => {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error) => {
        setTimeout(() => {
          if (retriesLeft === 1) {
            reject(error)
            return
          }
          retry(fn, retriesLeft - 1, interval).then(resolve, reject)
        }, interval)
      })
  })
}

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
)

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
    <h2 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h2>
    <p className="text-sm text-gray-600 mb-4">{error?.message || 'Failed to load component'}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
    >
      Try again
    </button>
  </div>
)

// Enhanced lazy loading with retry logic
export function lazyLoadWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() => retry(importFn))
}

// Wrapper component with error boundary and suspense
export function LazyComponent({ 
  component: Component, 
  fallback = <LoadingFallback />,
  ...props 
}: {
  component: React.LazyExoticComponent<ComponentType<any>>
  fallback?: React.ReactNode
  [key: string]: any
}) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  )
}

// Preload component for better UX
export function preloadComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>
): void {
  importFn()
}

// Intersection observer for lazy loading on scroll
export function lazyLoadOnScroll<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: IntersectionObserverInit
): React.LazyExoticComponent<T> {
  let Component: React.LazyExoticComponent<T> | null = null
  
  return lazy(() => {
    if (!Component) {
      return new Promise((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              Component = lazyLoadWithRetry(importFn)
              observer.disconnect()
              resolve(retry(importFn))
            }
          })
        }, options)
        
        // Start observing when component is about to mount
        setTimeout(() => {
          const target = document.querySelector('[data-lazy-load]')
          if (target) {
            observer.observe(target)
          } else {
            resolve(retry(importFn))
          }
        }, 0)
      })
    }
    return retry(importFn)
  })
}

// Route-based code splitting helper
export const routeLazyLoad = {
  // Creator routes
  CreatorDashboard: lazyLoadWithRetry(() => import('@/pages/CreatorDashboard')),
  CreatorProfile: lazyLoadWithRetry(() => import('@/pages/CreatorProfile')),
  CreatePitch: lazyLoadWithRetry(() => import('@/pages/CreatePitch')),
  CreatorAnalytics: lazyLoadWithRetry(() => import('@/pages/CreatorAnalyticsPage')),
  CreatorNDAManagement: lazyLoadWithRetry(() => import('@/pages/CreatorNDAManagement')),
  
  // Investor routes
  InvestorDashboard: lazyLoadWithRetry(() => import('@/pages/InvestorDashboard')),
  InvestorPortfolio: lazyLoadWithRetry(() => import('@/pages/investor/InvestorPortfolio')),
  InvestorAnalytics: lazyLoadWithRetry(() => import('@/pages/investor/InvestorAnalytics')),
  InvestorWatchlist: lazyLoadWithRetry(() => import('@/pages/investor/InvestorWatchlist')),
  
  // Production routes
  ProductionDashboard: lazyLoadWithRetry(() => import('@/pages/ProductionDashboard')),
  ProductionProjects: lazyLoadWithRetry(() => import('@/pages/production/ProductionProjects')),
  ProductionAnalytics: lazyLoadWithRetry(() => import('@/pages/ProductionAnalyticsPage')),
  ProductionPipeline: lazyLoadWithRetry(() => import('@/pages/production/ProductionPipeline')),
  
  // Shared routes
  Homepage: lazyLoadWithRetry(() => import('@/pages/Homepage')),
  Marketplace: lazyLoadWithRetry(() => import('@/pages/MarketplaceEnhanced')),
  PitchDetail: lazyLoadWithRetry(() => import('@/pages/PitchDetail')),
  Messages: lazyLoadWithRetry(() => import('@/pages/Messages')),
  Settings: lazyLoadWithRetry(() => import('@/pages/Settings')),
  Profile: lazyLoadWithRetry(() => import('@/pages/Profile')),
  SearchPage: lazyLoadWithRetry(() => import('@/pages/SearchPage')),
  AdvancedSearch: lazyLoadWithRetry(() => import('@/pages/AdvancedSearch')),
  
  // Heavy components
  BrowseTopRated: lazyLoadWithRetry(() => import('@/pages/BrowseTopRated')),
  BrowseGenres: lazyLoadWithRetry(() => import('@/pages/BrowseGenres')),
  Billing: lazyLoadWithRetry(() => import('@/pages/Billing')),
  TeamManagement: lazyLoadWithRetry(() => import('@/pages/TeamManagement')),
}

// Prefetch critical routes
export function prefetchCriticalRoutes() {
  // Prefetch common routes users are likely to visit
  const criticalRoutes = [
    () => import('@/pages/Homepage'),
    () => import('@/pages/MarketplaceEnhanced'),
    () => import('@/pages/PitchDetail')
  ]
  
  // Use requestIdleCallback for non-blocking prefetch
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      criticalRoutes.forEach(route => {
        route().catch(() => {
          // Silently fail prefetch
        })
      })
    })
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      criticalRoutes.forEach(route => {
        route().catch(() => {
          // Silently fail prefetch
        })
      })
    }, 2000)
  }
}