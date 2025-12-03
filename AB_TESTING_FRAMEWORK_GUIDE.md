# Pitchey A/B Testing Framework - Complete Implementation Guide

## Overview

The Pitchey A/B Testing Framework is a comprehensive, production-ready system that enables data-driven feature rollouts and experimentation. It provides everything needed to run statistically rigorous experiments with minimal engineering involvement.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start Guide](#quick-start-guide)
3. [Frontend Implementation](#frontend-implementation)
4. [Backend API Reference](#backend-api-reference)
5. [Admin Dashboard](#admin-dashboard)
6. [Statistical Analysis](#statistical-analysis)
7. [Best Practices](#best-practices)
8. [Examples & Use Cases](#examples--use-cases)
9. [Troubleshooting](#troubleshooting)

## Architecture Overview

### Components

1. **Database Layer**
   - `experiments`: Store experiment configurations
   - `user_experiment_assignments`: Track user bucketing
   - `experiment_events`: Capture user interactions
   - `experiment_results`: Cache statistical analysis
   - `experiment_audit_log`: Track all changes
   - `ab_feature_flags`: Feature flag management

2. **Backend Services**
   - `ABTestingService`: Core experiment logic
   - REST API endpoints for experiment management
   - Statistical analysis engine
   - User bucketing with deterministic hashing

3. **Frontend Components**
   - React hooks (`useExperiment`, `useVariant`, `useFeatureFlag`)
   - Component variants system
   - Automatic event tracking
   - Admin dashboard

4. **Analytics & Statistics**
   - Real-time statistical significance calculation
   - Bayesian and frequentist analysis
   - Power analysis and sample size calculators
   - Multi-variant testing support

## Quick Start Guide

### 1. Installation

The framework is already integrated into the Pitchey platform. No additional installation required.

### 2. Create Your First Experiment

#### Step 1: Define the Experiment

```javascript
import { useExperiment, Experiment, Variant } from '../components/ABTesting/ExperimentVariant';

function HomePage() {
  return (
    <Experiment
      experimentId={1}
      fallback={<DefaultHomepage />}
      autoTrack={true}
    >
      <Variant variantId="control">
        <DefaultHomepage />
      </Variant>
      <Variant variantId="new_design">
        <NewHomepage />
      </Variant>
    </Experiment>
  );
}
```

#### Step 2: Set Up the Experiment via Admin

1. Access Admin Dashboard (`/admin/ab-testing`)
2. Click "New Experiment"
3. Configure experiment settings:
   - Name: "Homepage Redesign"
   - Primary Metric: "conversion_rate"
   - Traffic Allocation: 10%
   - Variants: control (50%), new_design (50%)

#### Step 3: Start the Experiment

```javascript
// Via admin dashboard or API
fetch('/api/experiments/1/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 3. Track Events

```javascript
import { useExperimentTracking } from '../hooks/useABTesting';

function SignupButton() {
  const { trackConversion } = useExperimentTracking();
  
  const handleSignup = async () => {
    // Track conversion
    await trackConversion(1, 'new_design', 1, { 
      source: 'homepage',
      user_type: 'visitor' 
    });
    
    // Regular signup logic
    await signupUser();
  };

  return <button onClick={handleSignup}>Sign Up</button>;
}
```

## Frontend Implementation

### React Hooks

#### useExperiment

The primary hook for getting experiment assignments and tracking events.

```javascript
import { useExperiment } from '../hooks/useABTesting';

function ProductCard() {
  const { 
    assignment, 
    variantId, 
    variantConfig, 
    isActive, 
    loading, 
    error, 
    track 
  } = useExperiment(2, {
    autoTrackPageView: true,
    trackingProperties: { page: 'product_listing' }
  });

  if (loading) return <ProductCardSkeleton />;
  if (error || !isActive) return <DefaultProductCard />;

  const buttonColor = variantConfig.buttonColor || 'blue';
  
  const handleAddToCart = async () => {
    await track('add_to_cart', {
      eventValue: 29.99,
      properties: { product_id: '123' }
    });
  };

  return (
    <div className="product-card">
      <h3>Product Name</h3>
      <button 
        style={{ backgroundColor: buttonColor }}
        onClick={handleAddToCart}
      >
        Add to Cart
      </button>
    </div>
  );
}
```

#### useVariant

Get specific variant configuration values.

```javascript
import { useVariant } from '../hooks/useABTesting';

function PricingSection() {
  const { value: showDiscount, loading } = useVariant(
    3, // experimentId
    'showDiscount', // configKey
    false // defaultValue
  );

  if (loading) return <PricingSectionSkeleton />;

  return (
    <div className="pricing">
      <h2>Pricing Plans</h2>
      {showDiscount && (
        <div className="discount-banner">
          🎉 20% off all plans this month!
        </div>
      )}
      <PricingCards />
    </div>
  );
}
```

#### useFeatureFlag

Simple feature flag management.

```javascript
import { useFeatureFlag } from '../hooks/useABTesting';

function Navigation() {
  const { value: showNewMenu } = useFeatureFlag('new_navigation_menu', false);

  return (
    <nav>
      {showNewMenu ? <NewNavigationMenu /> : <OldNavigationMenu />}
    </nav>
  );
}
```

### Component Variants System

#### Basic Experiment Component

```javascript
import { Experiment, Variant } from '../components/ABTesting/ExperimentVariant';

function CheckoutFlow() {
  return (
    <Experiment experimentId={4} fallback={<OneStepCheckout />}>
      <Variant variantId="one_step">
        <OneStepCheckout />
      </Variant>
      <Variant variantId="two_step">
        <TwoStepCheckout />
      </Variant>
      <Variant variantId="three_step">
        <ThreeStepCheckout />
      </Variant>
    </Experiment>
  );
}
```

#### Higher-Order Component

```javascript
import { withExperiment } from '../components/ABTesting/ExperimentVariant';

const ButtonA = ({ text, onClick }) => (
  <button className="btn-primary" onClick={onClick}>{text}</button>
);

const ButtonB = ({ text, onClick }) => (
  <button className="btn-secondary rounded-full" onClick={onClick}>{text}</button>
);

const ExperimentalButton = withExperiment(
  5, // experimentId
  {
    control: ButtonA,
    variant_b: ButtonB
  },
  {
    fallbackComponent: ButtonA,
    autoTrack: true
  }
);

// Usage
function CallToAction() {
  return <ExperimentalButton text="Get Started" onClick={handleClick} />;
}
```

#### Advanced Experiment with Custom Tracking

```javascript
import { AdvancedExperiment, Variant } from '../components/ABTesting/ExperimentVariant';

function LandingPage() {
  return (
    <AdvancedExperiment
      experimentId={6}
      fallback={<DefaultLanding />}
      trackClicks={true}
      trackScrollDepth={true}
      metrics={{
        'video_play': {
          selector: '.video-player button',
          eventValue: 1,
          properties: { video_id: 'landing_video' }
        },
        'newsletter_signup': {
          selector: '.newsletter-form',
          eventValue: 5
        }
      }}
    >
      <Variant variantId="control">
        <LandingPageV1 />
      </Variant>
      <Variant variantId="video_hero">
        <LandingPageWithVideo />
      </Variant>
      <Variant variantId="testimonials">
        <LandingPageWithTestimonials />
      </Variant>
    </AdvancedExperiment>
  );
}
```

### Event Tracking

#### Manual Event Tracking

```javascript
import { useExperimentTracking } from '../hooks/useABTesting';

function SearchComponent() {
  const { trackEvent, trackConversion } = useExperimentTracking();

  const handleSearch = async (query) => {
    // Track search event
    await trackEvent(7, 'variant_a', 'search', {
      properties: { 
        query,
        results_count: results.length,
        search_time: Date.now() - searchStart
      }
    });

    // Track conversion if user finds what they want
    if (results.length > 0) {
      await trackConversion(7, 'variant_a', 1, { search_successful: true });
    }
  };

  return (
    <SearchBox onSearch={handleSearch} />
  );
}
```

#### Batch Event Tracking

```javascript
// Events are automatically batched by the client
// Configure batching in ABTestingProvider
function App() {
  return (
    <ABTestingProvider 
      config={{
        batchTracking: true,
        batchSize: 20,
        batchInterval: 10000 // 10 seconds
      }}
    >
      <AppContent />
    </ABTestingProvider>
  );
}
```

## Backend API Reference

### Experiments Management

#### Create Experiment

```javascript
POST /api/experiments

{
  "name": "Homepage CTA Button Color",
  "description": "Test red vs blue CTA button",
  "hypothesis": "Red button will increase conversion rate by 15%",
  "variants": [
    {
      "id": "control",
      "name": "Blue Button",
      "trafficAllocation": 0.5,
      "config": { "buttonColor": "#007bff" }
    },
    {
      "id": "variant_a", 
      "name": "Red Button",
      "trafficAllocation": 0.5,
      "config": { "buttonColor": "#dc3545" }
    }
  ],
  "trafficAllocation": 0.2,
  "targetingRules": {},
  "userSegments": ["creator", "investor"],
  "primaryMetric": "click_through_rate",
  "secondaryMetrics": ["bounce_rate", "time_on_page"],
  "minimumSampleSize": 1000,
  "statisticalPower": 0.8,
  "significanceLevel": 0.05,
  "tags": ["homepage", "cta", "conversion"]
}
```

#### Start/Pause/Complete Experiment

```javascript
// Start experiment
POST /api/experiments/{id}/start

// Pause experiment
POST /api/experiments/{id}/pause
{
  "reason": "Significant performance issues detected"
}

// Complete experiment
POST /api/experiments/{id}/complete
```

#### Get Experiment Results

```javascript
GET /api/experiments/{id}/results

// Response
{
  "success": true,
  "data": {
    "experimentId": 1,
    "status": "significant",
    "totalParticipants": 2500,
    "variantSampleSizes": {
      "control": 1250,
      "variant_a": 1250
    },
    "conversionRates": {
      "control": 0.15,
      "variant_a": 0.18
    },
    "pValue": "0.021",
    "isStatisticallySignificant": true,
    "winningVariant": "variant_a",
    "liftPercentage": "20.0",
    "confidenceLevel": "0.95",
    "recommendation": "Variant variant_a shows a significant improvement of 20.00%. Consider rolling out this variant."
  }
}
```

### User Assignment

#### Get Experiment Assignments

```javascript
POST /api/experiments/assignments

{
  "userContext": {
    "userId": 123,
    "userType": "creator",
    "customProperties": {
      "subscription_tier": "premium",
      "signup_date": "2024-01-15"
    }
  },
  "experimentIds": [1, 2, 3] // Optional: specific experiments
}

// Response
{
  "success": true,
  "data": [
    {
      "experimentId": 1,
      "experimentName": "Homepage CTA Button",
      "variantId": "variant_a",
      "variantConfig": { "buttonColor": "#dc3545" },
      "isActive": true
    }
  ]
}
```

### Event Tracking

#### Track Single Event

```javascript
POST /api/experiments/track

{
  "experimentId": 1,
  "variantId": "variant_a",
  "eventType": "button_click",
  "userContext": {
    "userId": 123,
    "sessionId": "session_abc123"
  },
  "eventData": {
    "eventName": "CTA Button Click",
    "eventValue": 1,
    "properties": {
      "button_text": "Get Started",
      "page": "homepage"
    },
    "url": "/homepage",
    "elementId": "cta-button"
  }
}
```

#### Batch Track Events

```javascript
POST /api/experiments/track/batch

{
  "events": [
    {
      "experimentId": 1,
      "variantId": "control",
      "eventType": "page_view",
      "userContext": { "sessionId": "session_123" },
      "eventData": { "url": "/homepage" }
    },
    {
      "experimentId": 1,
      "variantId": "control", 
      "eventType": "button_click",
      "userContext": { "sessionId": "session_123" },
      "eventData": { "elementId": "signup-btn" }
    }
  ]
}
```

### Feature Flags

#### Get Feature Flag Value

```javascript
POST /api/experiments/feature-flag

{
  "flagKey": "new_dashboard_layout",
  "defaultValue": false,
  "userContext": {
    "userId": 123,
    "userType": "investor"
  }
}

// Response
{
  "success": true,
  "data": {
    "flagKey": "new_dashboard_layout",
    "value": true,
    "defaultValue": false
  }
}
```

## Admin Dashboard

### Accessing the Dashboard

Navigate to `/admin/ab-testing` to access the comprehensive experiment management interface.

### Dashboard Features

1. **Experiment Overview**
   - Total experiments count
   - Active experiments
   - Completed experiments  
   - Significant results counter

2. **Experiment Management**
   - Create new experiments
   - Start/pause/complete experiments
   - View detailed experiment configuration
   - Real-time results monitoring

3. **Results Analysis**
   - Statistical significance indicators
   - Conversion rate comparisons
   - Confidence intervals
   - Recommendation engine

4. **Filtering & Search**
   - Filter by experiment status
   - Search by name, description, or tags
   - Sort by creation date, update date, or name

### Creating Experiments via Dashboard

1. **Basic Information**
   - Experiment name and description
   - Hypothesis statement
   - Tags for organization

2. **Variant Configuration**
   - Define variant names and descriptions
   - Set traffic allocation per variant
   - Configure variant-specific settings

3. **Targeting Rules**
   - User segment targeting
   - Traffic allocation percentage
   - Custom targeting conditions

4. **Success Metrics**
   - Primary conversion metric
   - Secondary metrics
   - Statistical configuration

5. **Advanced Settings**
   - Minimum sample size
   - Statistical power requirements
   - Significance level

## Statistical Analysis

### Sample Size Calculator

```javascript
import { StatisticalAnalysis } from '../utils/statistical-analysis';

const sampleSize = StatisticalAnalysis.calculateSampleSize({
  baselineConversionRate: 0.15,
  minimumDetectableEffect: 0.20, // 20% relative improvement
  significanceLevel: 0.05,
  statisticalPower: 0.8,
  twoSided: true
});

console.log(`Required sample size: ${sampleSize.sampleSizePerVariant} per variant`);
// Output: Required sample size: 1547 per variant
```

### Power Analysis

```javascript
const powerAnalysis = StatisticalAnalysis.performPowerAnalysis({
  controlConversionRate: 0.15,
  variantConversionRate: 0.18,
  sampleSizePerVariant: 1000,
  significanceLevel: 0.05
});

console.log(`Statistical power: ${powerAnalysis.statisticalPower.toFixed(2)}`);
console.log(`Adequately powered: ${powerAnalysis.isAdequatelyPowered}`);
```

### Statistical Testing

#### Frequentist Analysis (Z-test)

```javascript
const zTestResult = StatisticalAnalysis.performZTest({
  controlConversions: 150,
  controlSampleSize: 1000,
  variantConversions: 180,
  variantSampleSize: 1000,
  significanceLevel: 0.05
});

console.log(`P-value: ${zTestResult.pValue.toFixed(4)}`);
console.log(`Statistically significant: ${zTestResult.isStatisticallySignificant}`);
console.log(`Lift: ${zTestResult.lift.toFixed(1)}%`);
```

#### Bayesian Analysis

```javascript
const bayesianResult = StatisticalAnalysis.performBayesianTest({
  controlConversions: 150,
  controlSampleSize: 1000,
  variantConversions: 180,
  variantSampleSize: 1000
});

console.log(`Probability variant beats control: ${bayesianResult.probabilityToBeatControl.toFixed(2)}`);
console.log(`Expected lift: ${bayesianResult.expectedLift.toFixed(1)}%`);
```

#### Multi-Variant Testing

```javascript
const multiVariantResult = StatisticalAnalysis.performMultiVariantTest([
  { name: 'Control', conversions: 100, sampleSize: 1000 },
  { name: 'Variant A', conversions: 120, sampleSize: 1000 },
  { name: 'Variant B', conversions: 110, sampleSize: 1000 },
  { name: 'Variant C', conversions: 135, sampleSize: 1000 }
]);

console.log('Overall test significant:', multiVariantResult.overallTest.isStatisticallySignificant);
console.log('Pairwise comparisons:', multiVariantResult.pairwiseComparisons.length);
```

## Best Practices

### 1. Experiment Design

**DO:**
- Define clear, measurable hypotheses
- Use appropriate sample sizes (power analysis)
- Set success metrics before starting
- Test one variable at a time
- Run experiments for full business cycles

**DON'T:**
- Peek at results too early (use sequential testing)
- Stop experiments early without statistical justification
- Test too many variants simultaneously
- Change experiment configuration mid-test
- Run experiments during unusual business periods

### 2. Statistical Rigor

**Sample Size Planning:**
```javascript
// Plan your sample size before starting
const planning = StatisticalAnalysis.calculateSampleSizeWithTraffic({
  baselineConversionRate: 0.12,
  minimumDetectableEffect: 0.15,
  significanceLevel: 0.05,
  statisticalPower: 0.8,
  twoSided: true,
  dailyTrafficPerVariant: 500
});

console.log(`Need ${planning.sampleSizePerVariant} users per variant`);
console.log(`Estimated duration: ${planning.expectedDuration} days`);
```

**Sequential Testing:**
```javascript
// For experiments that need interim analysis
const sequentialResult = StatisticalAnalysis.performSequentialTest({
  controlConversions: 75,
  controlSampleSize: 500,
  variantConversions: 90,
  variantSampleSize: 500,
  currentSampleRatio: 0.5,
  totalPlannedSampleSize: 2000
});

if (sequentialResult.isStatisticallySignificant) {
  console.log('Early stopping recommended - significant result found');
} else if (sequentialResult.recommendContinue) {
  console.log('Continue experiment - no significant result yet');
}
```

### 3. Technical Implementation

**Consistent User Assignment:**
```javascript
// User bucketing is deterministic based on userId/sessionId
// Same user always gets the same variant
const assignment = await ABTestingService.assignUserToExperiment(1, {
  userId: 123,
  userType: 'creator'
});
```

**Error Handling:**
```javascript
function ExperimentComponent() {
  const { assignment, loading, error } = useExperiment(1);

  if (loading) return <Skeleton />;
  
  if (error) {
    console.error('Experiment error:', error);
    // Always fallback gracefully
    return <DefaultComponent />;
  }

  return assignment ? <VariantComponent /> : <DefaultComponent />;
}
```

**Performance Optimization:**
```javascript
// Use batch tracking to reduce server load
const { trackEvent } = useExperimentTracking();

// Events are automatically batched and sent every 5 seconds
await trackEvent(1, 'variant_a', 'page_view');
await trackEvent(1, 'variant_a', 'scroll', { depth: 25 });
await trackEvent(1, 'variant_a', 'click', { element: 'nav-link' });
```

### 4. Monitoring and Alerting

**Health Checks:**
```javascript
// Monitor experiment health
const healthCheck = async (experimentId) => {
  const results = await fetch(`/api/experiments/${experimentId}/results`);
  const data = await results.json();
  
  // Alert on unusual patterns
  if (data.totalParticipants < expectedParticipants * 0.5) {
    alert('Experiment traffic significantly below expected');
  }
  
  if (data.conversionRates.control < historicalBaseline * 0.8) {
    alert('Control conversion rate unusually low');
  }
};
```

## Examples & Use Cases

### 1. Homepage Hero Section Test

```javascript
// Test different hero messages
function HeroSection() {
  return (
    <Experiment experimentId={101} autoTrack={true}>
      <Variant variantId="control">
        <Hero 
          title="Build Your Movie Pitch"
          subtitle="Connect with investors and production companies"
          ctaText="Get Started"
        />
      </Variant>
      <Variant variantId="urgency">
        <Hero 
          title="Get Funded in 30 Days"
          subtitle="Join 1000+ creators who secured funding"
          ctaText="Start My Pitch"
        />
      </Variant>
      <Variant variantId="social_proof">
        <Hero 
          title="Where Great Movies Begin"
          subtitle="Trusted by Netflix, HBO, and 500+ producers"
          ctaText="Join Now"
        />
      </Variant>
    </Experiment>
  );
}
```

### 2. Pricing Page Optimization

```javascript
function PricingPage() {
  const { value: showAnnualDiscount } = useVariant(102, 'showAnnualDiscount', false);
  const { value: highlightPopular } = useVariant(102, 'highlightPopular', true);
  
  return (
    <div className="pricing-page">
      <PricingHeader showAnnualDiscount={showAnnualDiscount} />
      <PricingCards highlightPopular={highlightPopular} />
    </div>
  );
}
```

### 3. Onboarding Flow Test

```javascript
const OnboardingExperiment = withExperiment(
  103,
  {
    control: SingleStepOnboarding,
    progressive: MultiStepOnboarding,
    gamified: GamifiedOnboarding
  },
  {
    fallbackComponent: SingleStepOnboarding,
    autoTrack: true,
    trackingProperties: { flow_type: 'onboarding' }
  }
);

function App() {
  return (
    <Routes>
      <Route path="/onboarding" component={OnboardingExperiment} />
    </Routes>
  );
}
```

### 4. Feature Flag Rollout

```javascript
function Dashboard() {
  const { value: useNewDashboard } = useFeatureFlag('new_dashboard_v2', false);
  
  useEffect(() => {
    // Track feature flag exposure
    if (useNewDashboard) {
      analytics.track('feature_flag_exposed', {
        flag: 'new_dashboard_v2',
        value: true
      });
    }
  }, [useNewDashboard]);

  return useNewDashboard ? <NewDashboard /> : <LegacyDashboard />;
}
```

### 5. Conversion Funnel Optimization

```javascript
function CheckoutProcess() {
  const { track } = useExperiment(104, {
    autoTrackPageView: true,
    trackingProperties: { funnel_step: 'checkout' }
  });

  const handleStepComplete = async (step, data) => {
    await track(`checkout_step_${step}_complete`, {
      eventValue: data.orderValue,
      properties: {
        payment_method: data.paymentMethod,
        items_count: data.items.length
      }
    });
  };

  return (
    <Experiment experimentId={104}>
      <Variant variantId="single_page">
        <SinglePageCheckout onStepComplete={handleStepComplete} />
      </Variant>
      <Variant variantId="multi_step">
        <MultiStepCheckout onStepComplete={handleStepComplete} />
      </Variant>
    </Experiment>
  );
}
```

## Troubleshooting

### Common Issues

#### 1. Users Not Being Assigned to Experiments

**Problem:** Users always see the fallback/default experience.

**Solutions:**
- Check experiment status (must be 'active')
- Verify traffic allocation settings (> 0%)
- Ensure targeting rules include the user segment
- Check experiment start/end dates
- Verify user context is being passed correctly

```javascript
// Debug user assignment
const debugAssignment = async () => {
  const assignment = await ABTestingService.assignUserToExperiment(1, {
    userId: 123,
    userType: 'creator',
    customProperties: { debug: true }
  });
  
  console.log('Assignment result:', assignment);
};
```

#### 2. Events Not Being Tracked

**Problem:** No events appear in experiment results.

**Solutions:**
- Verify experiment ID matches the active experiment
- Check variant ID matches experiment configuration
- Ensure user context includes userId or sessionId
- Check network requests in browser dev tools
- Verify authentication headers

```javascript
// Debug event tracking
const trackDebugEvent = async () => {
  try {
    await ABTestingService.trackExperimentEvent(
      1, 
      'control', 
      'debug_event',
      { userId: 123, debug: true },
      { properties: { timestamp: Date.now() } }
    );
    console.log('Event tracked successfully');
  } catch (error) {
    console.error('Event tracking failed:', error);
  }
};
```

#### 3. Inconsistent User Assignment

**Problem:** Same user sees different variants on different sessions.

**Solutions:**
- Ensure consistent user identification (userId vs sessionId)
- Check for cache clearing or cookie issues
- Verify deterministic hashing is working correctly

```javascript
// Test consistent bucketing
const testConsistency = () => {
  const userContext = { userId: 123 };
  
  for (let i = 0; i < 10; i++) {
    const assignment = ABTestingService.assignUserToExperiment(1, userContext);
    console.log(`Test ${i}: ${assignment?.variantId}`);
  }
  // Should always return the same variant
};
```

#### 4. Statistical Significance Not Reached

**Problem:** Experiment runs but never reaches significance.

**Solutions:**
- Check if sample size is adequate
- Verify the effect size is realistic
- Consider extending the experiment duration
- Check if the baseline conversion rate assumptions were correct

```javascript
// Analyze experiment progress
const analyzeProgress = async (experimentId) => {
  const results = await ABTestingService.getExperimentResults(experimentId);
  
  console.log(`Current participants: ${results.totalParticipants}`);
  console.log(`P-value: ${results.pValue}`);
  console.log(`Conversion rates:`, results.conversionRates);
  
  // Calculate required sample size for current effect
  const currentEffect = Math.abs(
    results.conversionRates.variant_a - results.conversionRates.control
  ) / results.conversionRates.control;
  
  const requiredSample = StatisticalAnalysis.calculateSampleSize({
    baselineConversionRate: results.conversionRates.control,
    minimumDetectableEffect: currentEffect,
    significanceLevel: 0.05,
    statisticalPower: 0.8,
    twoSided: true
  });
  
  console.log(`Required sample size: ${requiredSample.sampleSizePerVariant}`);
};
```

### Performance Considerations

#### 1. Database Optimization

- Experiment queries are indexed for performance
- Results are cached to avoid recalculation
- Use database connection pooling

#### 2. Frontend Performance

- Batch event tracking (default: 10 events per 5 seconds)
- Lazy load experiment configurations
- Use React.memo for variant components

#### 3. Statistical Calculation

- Results are pre-calculated and cached
- Recalculation triggered by new events (batched)
- Heavy computations run asynchronously

### Monitoring and Alerts

Set up monitoring for:

1. **Experiment Health**
   - Traffic distribution across variants
   - Conversion rate anomalies
   - Sample size progress

2. **System Performance**
   - API response times
   - Database query performance
   - Event tracking success rates

3. **Data Quality**
   - Missing user contexts
   - Invalid event data
   - Assignment consistency

## Conclusion

The Pitchey A/B Testing Framework provides a complete solution for running statistically rigorous experiments with minimal engineering overhead. It includes:

✅ **Complete Implementation**
- Database schema and relations
- Backend API with statistical analysis
- React hooks and components
- Admin dashboard

✅ **Statistical Rigor**
- Power analysis and sample size calculation
- Frequentist and Bayesian analysis
- Multi-variant testing support
- Sequential testing capabilities

✅ **Production Ready**
- Error handling and fallbacks
- Performance optimization
- Comprehensive monitoring
- Audit logging

✅ **Easy to Use**
- Declarative React components
- Automatic event tracking
- Visual admin interface
- Extensive documentation

The framework enables product teams to run experiments independently while maintaining statistical rigor and engineering best practices.

For additional support or advanced use cases, refer to the code documentation or reach out to the engineering team.