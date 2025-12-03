// Component Variants System for A/B Testing
import React, { ReactNode, ReactElement, cloneElement } from 'react';
import { useExperiment, useVariant, useExperimentTracking } from '../../hooks/useABTesting';

// Types
interface VariantProps {
  variantId: string;
  children: ReactNode;
}

interface ExperimentProps {
  experimentId: number;
  children: ReactElement<VariantProps>[];
  fallback?: ReactNode;
  autoTrack?: boolean;
  trackingProperties?: Record<string, any>;
  onVariantSelected?: (variantId: string, variantConfig: Record<string, any>) => void;
}

interface ConditionalVariantProps {
  condition: boolean;
  children: ReactNode;
}

// Variant component to wrap variant content
export function Variant({ variantId, children }: VariantProps) {
  return <>{children}</>;
}

// Conditional variant component
export function ConditionalVariant({ condition, children }: ConditionalVariantProps) {
  if (!condition) return null;
  return <>{children}</>;
}

// Main experiment component that renders the appropriate variant
export function Experiment({
  experimentId,
  children,
  fallback = null,
  autoTrack = true,
  trackingProperties,
  onVariantSelected,
}: ExperimentProps) {
  const { assignment, variantId, variantConfig, loading, error, track } = useExperiment(
    experimentId,
    {
      autoTrackPageView: autoTrack,
      trackingProperties,
    }
  );

  // Call callback when variant is selected
  React.useEffect(() => {
    if (assignment && onVariantSelected) {
      onVariantSelected(variantId!, variantConfig!);
    }
  }, [assignment, variantId, variantConfig, onVariantSelected]);

  // Show loading state or fallback
  if (loading) {
    return <>{fallback}</>;
  }

  // Show fallback on error
  if (error) {
    console.error('A/B Testing Error:', error);
    return <>{fallback}</>;
  }

  // If not in experiment, show fallback
  if (!assignment || !variantId) {
    return <>{fallback}</>;
  }

  // Find and render the matching variant
  const variantToRender = React.Children.find(children, (child) => {
    return React.isValidElement<VariantProps>(child) && child.props.variantId === variantId;
  });

  if (!variantToRender) {
    console.warn(`Variant "${variantId}" not found for experiment ${experimentId}`);
    return <>{fallback}</>;
  }

  // Clone element to add tracking props if needed
  const enhancedVariant = cloneElement(variantToRender, {
    ...variantToRender.props,
    // Add tracking function to variant props if the children can use it
    __experimentTracker: track,
  });

  return enhancedVariant;
}

// Higher-order component for A/B testing
export function withExperiment<P extends object>(
  experimentId: number,
  variants: Record<string, React.ComponentType<P>>,
  options: {
    fallbackComponent?: React.ComponentType<P>;
    autoTrack?: boolean;
    trackingProperties?: Record<string, any>;
  } = {}
) {
  return function ExperimentWrapper(props: P) {
    const { assignment, variantId, loading, error } = useExperiment(experimentId, {
      autoTrackPageView: options.autoTrack,
      trackingProperties: options.trackingProperties,
    });

    // Show fallback during loading
    if (loading && options.fallbackComponent) {
      const FallbackComponent = options.fallbackComponent;
      return <FallbackComponent {...props} />;
    }

    // Show fallback on error
    if (error && options.fallbackComponent) {
      console.error('A/B Testing Error:', error);
      const FallbackComponent = options.fallbackComponent;
      return <FallbackComponent {...props} />;
    }

    // If not in experiment or variant not found, show fallback
    if (!assignment || !variantId || !variants[variantId]) {
      if (options.fallbackComponent) {
        const FallbackComponent = options.fallbackComponent;
        return <FallbackComponent {...props} />;
      }
      
      // Use first variant as fallback
      const firstVariantKey = Object.keys(variants)[0];
      if (firstVariantKey) {
        const FirstVariant = variants[firstVariantKey];
        return <FirstVariant {...props} />;
      }
      
      return null;
    }

    // Render the selected variant
    const VariantComponent = variants[variantId];
    return <VariantComponent {...props} />;
  };
}

// Hook-based variant selector
export function useVariantComponent<T extends Record<string, React.ComponentType<any>>>(
  experimentId: number,
  variants: T
): {
  VariantComponent: React.ComponentType<any> | null;
  variantId: string | null;
  loading: boolean;
  error: string | null;
} {
  const { assignment, variantId, loading, error } = useExperiment(experimentId);

  const VariantComponent = (variantId && variants[variantId]) || null;

  return {
    VariantComponent,
    variantId,
    loading,
    error,
  };
}

// Component for value-based variants
interface ValueVariantProps<T> {
  experimentId: number;
  configKey: string;
  defaultValue: T;
  children: (value: T, variantId: string | null) => ReactNode;
}

export function ValueVariant<T>({
  experimentId,
  configKey,
  defaultValue,
  children,
}: ValueVariantProps<T>) {
  const { value, variantId, loading, error } = useVariant(experimentId, configKey, defaultValue);

  if (loading) return null;
  if (error) {
    console.error('Value Variant Error:', error);
    return <>{children(defaultValue, null)}</>;
  }

  return <>{children(value, variantId)}</>;
}

// Component for feature flag-based rendering
interface FeatureFlagProps<T> {
  flagKey: string;
  defaultValue: T;
  children: (value: T) => ReactNode;
  fallback?: ReactNode;
}

export function FeatureFlag<T>({
  flagKey,
  defaultValue,
  children,
  fallback = null,
}: FeatureFlagProps<T>) {
  const { value, loading, error } = useVariant(0, flagKey, defaultValue); // Using experiment ID 0 for feature flags

  if (loading) return <>{fallback}</>;
  if (error) {
    console.error('Feature Flag Error:', error);
    return <>{children(defaultValue)}</>;
  }

  return <>{children(value)}</>;
}

// Advanced experiment component with multiple metrics tracking
interface AdvancedExperimentProps extends ExperimentProps {
  metrics?: {
    [eventType: string]: {
      selector?: string;
      eventValue?: number;
      properties?: Record<string, any>;
    };
  };
  trackClicks?: boolean;
  trackHovers?: boolean;
  trackScrollDepth?: boolean;
}

export function AdvancedExperiment({
  experimentId,
  children,
  fallback = null,
  autoTrack = true,
  trackingProperties,
  onVariantSelected,
  metrics = {},
  trackClicks = false,
  trackHovers = false,
  trackScrollDepth = false,
}: AdvancedExperimentProps) {
  const { assignment, variantId, variantConfig, loading, error, track } = useExperiment(
    experimentId,
    {
      autoTrackPageView: autoTrack,
      trackingProperties,
    }
  );

  const { trackClick } = useExperimentTracking();

  // Set up automatic tracking
  React.useEffect(() => {
    if (!assignment || !variantId) return;

    const container = React.useRef<HTMLDivElement>(null);

    // Track clicks
    if (trackClicks) {
      const handleClick = (event: Event) => {
        const target = event.target as HTMLElement;
        trackClick(assignment.experimentId, variantId, target.id, target.textContent || '');
      };

      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }

    // Track hovers
    if (trackHovers) {
      const handleMouseOver = (event: Event) => {
        const target = event.target as HTMLElement;
        track('hover', {
          elementId: target.id,
          elementText: target.textContent || '',
        });
      };

      document.addEventListener('mouseover', handleMouseOver);
      return () => document.removeEventListener('mouseover', handleMouseOver);
    }

    // Track scroll depth
    if (trackScrollDepth) {
      let maxScrollDepth = 0;
      const handleScroll = () => {
        const scrollDepth = Math.round(
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
        );
        
        if (scrollDepth > maxScrollDepth && scrollDepth % 25 === 0) {
          maxScrollDepth = scrollDepth;
          track('scroll', {
            properties: { scrollDepth },
          });
        }
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [assignment, variantId, track, trackClick, trackClicks, trackHovers, trackScrollDepth]);

  // Set up custom metrics tracking
  React.useEffect(() => {
    if (!assignment || !variantId || Object.keys(metrics).length === 0) return;

    const trackMetric = (eventType: string, metricConfig: any) => {
      track(eventType, {
        eventValue: metricConfig.eventValue,
        properties: metricConfig.properties,
      });
    };

    // Set up event listeners for custom metrics
    const eventListeners: Array<() => void> = [];

    Object.entries(metrics).forEach(([eventType, metricConfig]) => {
      if (metricConfig.selector) {
        const elements = document.querySelectorAll(metricConfig.selector);
        elements.forEach((element) => {
          const handler = () => trackMetric(eventType, metricConfig);
          element.addEventListener('click', handler);
          eventListeners.push(() => element.removeEventListener('click', handler));
        });
      }
    });

    return () => {
      eventListeners.forEach(cleanup => cleanup());
    };
  }, [assignment, variantId, track, metrics]);

  // Call callback when variant is selected
  React.useEffect(() => {
    if (assignment && onVariantSelected) {
      onVariantSelected(variantId!, variantConfig!);
    }
  }, [assignment, variantId, variantConfig, onVariantSelected]);

  // Show loading state or fallback
  if (loading) {
    return <>{fallback}</>;
  }

  // Show fallback on error
  if (error) {
    console.error('A/B Testing Error:', error);
    return <>{fallback}</>;
  }

  // If not in experiment, show fallback
  if (!assignment || !variantId) {
    return <>{fallback}</>;
  }

  // Find and render the matching variant
  const variantToRender = React.Children.find(children, (child) => {
    return React.isValidElement<VariantProps>(child) && child.props.variantId === variantId;
  });

  if (!variantToRender) {
    console.warn(`Variant "${variantId}" not found for experiment ${experimentId}`);
    return <>{fallback}</>;
  }

  // Clone element to add tracking props if needed
  const enhancedVariant = cloneElement(variantToRender, {
    ...variantToRender.props,
    __experimentTracker: track,
  });

  return enhancedVariant;
}