// A/B Testing Framework Usage Examples
import React, { useState } from 'react';
import { 
  useExperiment, 
  useVariant, 
  useFeatureFlag,
  useExperimentTracking,
  useABTestingWebSocket,
  useRealTimeResults
} from '../hooks/useABTesting';
import { 
  Experiment, 
  Variant, 
  ValueVariant,
  FeatureFlag,
  withExperiment,
  AdvancedExperiment
} from '../components/ABTesting/ExperimentVariant';

// Example 1: Simple Button Color Test
export function ButtonColorTest() {
  return (
    <Experiment experimentId={1} fallback={<DefaultButton />}>
      <Variant variantId="control">
        <button className="px-4 py-2 bg-blue-500 text-white rounded">
          Sign Up
        </button>
      </Variant>
      <Variant variantId="variant_a">
        <button className="px-4 py-2 bg-red-500 text-white rounded">
          Sign Up
        </button>
      </Variant>
      <Variant variantId="variant_b">
        <button className="px-4 py-2 bg-green-500 text-white rounded">
          Join Now
        </button>
      </Variant>
    </Experiment>
  );
}

function DefaultButton() {
  return (
    <button className="px-4 py-2 bg-gray-500 text-white rounded">
      Sign Up
    </button>
  );
}

// Example 2: Homepage Hero Section with Tracking
export function HeroSectionTest() {
  const { assignment, track } = useExperiment(2, {
    autoTrackPageView: true,
    trackingProperties: { page: 'homepage', section: 'hero' }
  });

  const handleCTAClick = async () => {
    if (assignment) {
      await track('cta_click', {
        eventValue: 1,
        properties: {
          button_text: assignment.variantConfig.ctaText,
          button_color: assignment.variantConfig.buttonColor
        }
      });
    }
    // Navigate to signup
    window.location.href = '/signup';
  };

  return (
    <Experiment experimentId={2} fallback={<DefaultHero />}>
      <Variant variantId="control">
        <HeroSection
          title="Create Amazing Movie Pitches"
          subtitle="Connect with investors and get your movie funded"
          ctaText="Get Started"
          buttonColor="blue"
          onCTAClick={handleCTAClick}
        />
      </Variant>
      <Variant variantId="urgency">
        <HeroSection
          title="Get Your Movie Funded in 30 Days"
          subtitle="Join 1000+ successful filmmakers"
          ctaText="Start My Pitch Now"
          buttonColor="red"
          onCTAClick={handleCTAClick}
        />
      </Variant>
      <Variant variantId="social_proof">
        <HeroSection
          title="Where Great Movies Begin"
          subtitle="Trusted by Netflix, HBO, and 500+ producers"
          ctaText="Join the Community"
          buttonColor="green"
          onCTAClick={handleCTAClick}
        />
      </Variant>
    </Experiment>
  );
}

function HeroSection({ title, subtitle, ctaText, buttonColor, onCTAClick }: any) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    red: 'bg-red-600 hover:bg-red-700',
    green: 'bg-green-600 hover:bg-green-700'
  };

  return (
    <div className="text-center py-20 px-4">
      <h1 className="text-5xl font-bold text-gray-900 mb-6">{title}</h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">{subtitle}</p>
      <button
        onClick={onCTAClick}
        className={`px-8 py-4 text-white font-semibold rounded-lg text-lg transition-colors ${colorClasses[buttonColor as keyof typeof colorClasses]}`}
      >
        {ctaText}
      </button>
    </div>
  );
}

function DefaultHero() {
  return <HeroSection title="Default Hero" subtitle="Default subtitle" ctaText="Get Started" buttonColor="blue" onCTAClick={() => {}} />;
}

// Example 3: Pricing Page with Value Variants
export function PricingPageTest() {
  const { value: showAnnualDiscount } = useVariant(3, 'showAnnualDiscount', false);
  const { value: highlightPlan } = useVariant(3, 'highlightPlan', 'pro');
  const { value: showTestimonials } = useVariant(3, 'showTestimonials', true);
  
  return (
    <div className="pricing-page">
      <h1 className="text-4xl font-bold text-center mb-8">Choose Your Plan</h1>
      
      {showAnnualDiscount && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6 text-center">
          🎉 Special Offer: 20% off annual plans!
        </div>
      )}
      
      <PricingCards highlightPlan={highlightPlan} />
      
      {showTestimonials && (
        <TestimonialsSection />
      )}
    </div>
  );
}

function PricingCards({ highlightPlan }: { highlightPlan: string }) {
  const plans = [
    { id: 'basic', name: 'Basic', price: '$9/mo' },
    { id: 'pro', name: 'Pro', price: '$29/mo' },
    { id: 'enterprise', name: 'Enterprise', price: '$99/mo' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {plans.map(plan => (
        <div
          key={plan.id}
          className={`border rounded-lg p-6 ${
            plan.id === highlightPlan 
              ? 'border-blue-500 bg-blue-50 relative' 
              : 'border-gray-200'
          }`}
        >
          {plan.id === highlightPlan && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                Most Popular
              </span>
            </div>
          )}
          <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
          <p className="text-3xl font-bold text-gray-900 mb-4">{plan.price}</p>
          <button className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Choose Plan
          </button>
        </div>
      ))}
    </div>
  );
}

function TestimonialsSection() {
  return (
    <div className="bg-gray-50 py-12 px-6 rounded-lg">
      <h2 className="text-2xl font-bold text-center mb-8">What Our Users Say</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 mb-4">"This platform helped me get my first movie funded!"</p>
          <p className="font-semibold">- Sarah Johnson, Director</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600 mb-4">"The best investment tool for film projects."</p>
          <p className="font-semibold">- Mike Chen, Producer</p>
        </div>
      </div>
    </div>
  );
}

// Example 4: Feature Flag Usage
export function NavigationWithFeatureFlag() {
  const { value: useNewNav } = useFeatureFlag('new_navigation_design', false);
  
  return useNewNav ? <NewNavigation /> : <OldNavigation />;
}

function NewNavigation() {
  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Logo />
            <NavLink href="/browse">Browse</NavLink>
            <NavLink href="/create">Create</NavLink>
            <NavLink href="/invest">Invest</NavLink>
          </div>
          <UserMenu />
        </div>
      </div>
    </nav>
  );
}

function OldNavigation() {
  return (
    <nav className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          <Logo />
          <div className="space-x-6">
            <a href="/browse" className="hover:text-gray-300">Browse</a>
            <a href="/create" className="hover:text-gray-300">Create</a>
            <a href="/invest" className="hover:text-gray-300">Invest</a>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Logo() {
  return <div className="text-xl font-bold">Pitchey</div>;
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md">
      {children}
    </a>
  );
}

function UserMenu() {
  return (
    <div className="flex items-center space-x-4">
      <button className="text-gray-700 hover:text-gray-900">Notifications</button>
      <button className="text-gray-700 hover:text-gray-900">Profile</button>
    </div>
  );
}

// Example 5: HOC Pattern for Component Variants
const CheckoutButton = ({ onClick, disabled }: { onClick: () => void; disabled: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
  >
    Complete Purchase
  </button>
);

const CheckoutButtonGreen = ({ onClick, disabled }: { onClick: () => void; disabled: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
  >
    Buy Now
  </button>
);

const CheckoutButtonGradient = ({ onClick, disabled }: { onClick: () => void; disabled: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
  >
    Purchase Now
  </button>
);

export const ExperimentalCheckoutButton = withExperiment(
  4, // experimentId
  {
    control: CheckoutButton,
    green_variant: CheckoutButtonGreen,
    gradient_variant: CheckoutButtonGradient
  },
  {
    fallbackComponent: CheckoutButton,
    autoTrack: true,
    trackingProperties: { component: 'checkout_button' }
  }
);

// Example 6: Advanced Experiment with Multiple Metrics
export function ProductListingExperiment() {
  return (
    <AdvancedExperiment
      experimentId={5}
      fallback={<DefaultProductListing />}
      autoTrack={true}
      trackClicks={true}
      trackScrollDepth={true}
      trackHovers={false}
      metrics={{
        'product_click': {
          selector: '.product-card',
          eventValue: 1,
          properties: { interaction_type: 'product_view' }
        },
        'add_to_cart': {
          selector: '.add-to-cart-btn',
          eventValue: 2,
          properties: { interaction_type: 'cart_addition' }
        },
        'filter_used': {
          selector: '.filter-option',
          eventValue: 0.5,
          properties: { interaction_type: 'filter_engagement' }
        }
      }}
      onVariantSelected={(variantId, config) => {
      }}
    >
      <Variant variantId="control">
        <ProductListingGrid layout="grid" showFilters={true} sortBy="popularity" />
      </Variant>
      <Variant variantId="list_view">
        <ProductListingList layout="list" showFilters={true} sortBy="popularity" />
      </Variant>
      <Variant variantId="minimal_filters">
        <ProductListingGrid layout="grid" showFilters={false} sortBy="newest" />
      </Variant>
    </AdvancedExperiment>
  );
}

function DefaultProductListing() {
  return <ProductListingGrid layout="grid" showFilters={true} sortBy="popularity" />;
}

function ProductListingGrid({ layout, showFilters, sortBy }: any) {
  return (
    <div className="product-listing">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Movie Pitches</h1>
        {showFilters && <FilterBar />}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ProductCard />
        <ProductCard />
        <ProductCard />
      </div>
    </div>
  );
}

function ProductListingList({ layout, showFilters, sortBy }: any) {
  return (
    <div className="product-listing">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Movie Pitches</h1>
        {showFilters && <FilterBar />}
      </div>
      <div className="space-y-4">
        <ProductCardList />
        <ProductCardList />
        <ProductCardList />
      </div>
    </div>
  );
}

function ProductCard() {
  const { trackConversion } = useExperimentTracking();
  
  const handleAddToCart = () => {
    trackConversion(5, 'control', 29.99, { product_type: 'movie_pitch' });
  };

  return (
    <div className="product-card border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer">
      <div className="aspect-video bg-gray-200 rounded mb-4"></div>
      <h3 className="font-semibold mb-2">Sci-Fi Thriller Pitch</h3>
      <p className="text-gray-600 text-sm mb-4">An exciting space adventure...</p>
      <button
        onClick={handleAddToCart}
        className="add-to-cart-btn w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        View Pitch
      </button>
    </div>
  );
}

function ProductCardList() {
  return (
    <div className="product-card flex items-center p-4 border rounded-lg hover:shadow-lg transition-shadow cursor-pointer">
      <div className="w-32 h-20 bg-gray-200 rounded mr-4"></div>
      <div className="flex-1">
        <h3 className="font-semibold mb-1">Romantic Comedy Pitch</h3>
        <p className="text-gray-600 text-sm mb-2">A heartwarming story...</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Genre: Comedy</span>
          <button className="add-to-cart-btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            View
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterBar() {
  return (
    <div className="flex space-x-4">
      <select className="filter-option border rounded px-3 py-2">
        <option>All Genres</option>
        <option>Action</option>
        <option>Comedy</option>
        <option>Drama</option>
      </select>
      <select className="filter-option border rounded px-3 py-2">
        <option>All Budgets</option>
        <option>$1M-$5M</option>
        <option>$5M-$20M</option>
        <option>$20M+</option>
      </select>
    </div>
  );
}

// Example 7: Real-time Results Display
export function ExperimentResultsDashboard({ experimentId }: { experimentId: number }) {
  const { results, loading, error, lastUpdate, connectionStatus } = useRealTimeResults(
    experimentId,
    {
      refreshInterval: 30000, // Fallback refresh every 30 seconds
      onSignificantResult: (results) => {
        // Show notification or alert
      }
    }
  );

  if (loading) {
    return <div className="animate-pulse">Loading results...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (!results) {
    return <div>No results available</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Experiment Results</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className="text-sm text-gray-600">
            {connectionStatus === 'connected' ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{results.totalParticipants}</div>
          <div className="text-sm text-gray-600">Total Participants</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            results.isStatisticallySignificant ? 'text-green-600' : 'text-gray-600'
          }`}>
            {results.pValue ? parseFloat(results.pValue).toFixed(4) : 'N/A'}
          </div>
          <div className="text-sm text-gray-600">P-Value</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            results.winningVariant ? 'text-blue-600' : 'text-gray-600'
          }`}>
            {results.winningVariant || 'None'}
          </div>
          <div className="text-sm text-gray-600">Winner</div>
        </div>
      </div>

      {results.conversionRates && (
        <div>
          <h3 className="text-lg font-medium mb-4">Conversion Rates</h3>
          <div className="space-y-3">
            {Object.entries(results.conversionRates).map(([variantId, rate]) => (
              <div key={variantId} className="flex items-center justify-between">
                <span className="font-medium">{variantId}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        variantId === results.winningVariant ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${(rate as number * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-mono">
                    {((rate as number) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.isStatisticallySignificant && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-green-600 font-medium">✅ Statistically Significant</span>
            {results.liftPercentage && (
              <span className="ml-2 text-sm text-gray-600">
                ({parseFloat(results.liftPercentage).toFixed(1)}% lift)
              </span>
            )}
          </div>
          {results.recommendation && (
            <p className="mt-2 text-sm text-gray-700">{results.recommendation}</p>
          )}
        </div>
      )}

      {lastUpdate && (
        <div className="mt-4 text-xs text-gray-500">
          Last updated: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// Example 8: Experiment Value Variant Usage
export function DynamicPricingExample() {
  return (
    <ValueVariant
      experimentId={6}
      configKey="discountPercentage"
      defaultValue={10}
    >
      {(discount, variantId) => (
        <div className="pricing-banner">
          <h2 className="text-2xl font-bold mb-4">Special Offer!</h2>
          <p className="text-lg">
            Get <span className="font-bold text-red-600">{discount}% OFF</span> your first subscription
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Variant: {variantId || 'default'}
          </p>
        </div>
      )}
    </ValueVariant>
  );
}

export default {
  ButtonColorTest,
  HeroSectionTest,
  PricingPageTest,
  NavigationWithFeatureFlag,
  ExperimentalCheckoutButton,
  ProductListingExperiment,
  ExperimentResultsDashboard,
  DynamicPricingExample
};