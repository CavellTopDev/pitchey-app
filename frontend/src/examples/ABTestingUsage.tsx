// A/B Testing Framework Usage Examples
// This file demonstrates how to use the comprehensive A/B testing system

import React from 'react';
import { 
  Experiment, 
  Variant, 
  ValueVariant, 
  FeatureFlag,
  AdvancedExperiment,
  withExperiment,
  useVariantComponent
} from '../components/ABTesting/ExperimentVariant';
import { useExperiment, useVariant, useFeatureFlag, useExperimentTracking } from '../hooks/useABTesting';

// Example 1: Simple Button Color A/B Test
const ButtonColorTest: React.FC = () => {
  return (
    <Experiment 
      experimentId={1001}
      fallback={<button className="bg-blue-500 text-white px-6 py-2 rounded">Sign Up</button>}
    >
      <Variant variantId="control">
        <button 
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 transition-colors"
          onClick={() => window.location.href = '/signup'}
        >
          Sign Up
        </button>
      </Variant>
      
      <Variant variantId="variant_red">
        <button 
          className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition-colors"
          onClick={() => window.location.href = '/signup'}
        >
          Sign Up Now
        </button>
      </Variant>
      
      <Variant variantId="variant_green">
        <button 
          className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 transition-colors"
          onClick={() => window.location.href = '/signup'}
        >
          Join Today
        </button>
      </Variant>
    </Experiment>
  );
};

// Example 2: Pricing Page Layout Test
const PricingLayoutTest: React.FC = () => {
  return (
    <Experiment 
      experimentId={1002}
      autoTrack={true}
      trackingProperties={{ page: 'pricing', section: 'hero' }}
      fallback={<div>Loading pricing...</div>}
    >
      <Variant variantId="control">
        <div className="grid grid-cols-3 gap-6">
          <PricingCard tier="basic" price={29} />
          <PricingCard tier="pro" price={79} featured />
          <PricingCard tier="enterprise" price={199} />
        </div>
      </Variant>
      
      <Variant variantId="variant_single_column">
        <div className="max-w-md mx-auto">
          <PricingCard tier="pro" price={79} featured />
          <div className="mt-4 text-center">
            <a href="#other-plans" className="text-blue-600 hover:underline">
              View other plans
            </a>
          </div>
        </div>
      </Variant>
      
      <Variant variantId="variant_comparison">
        <ComparisonTable />
      </Variant>
    </Experiment>
  );
};

// Example 3: Dynamic Value Testing
const DynamicContentTest: React.FC = () => {
  return (
    <div>
      {/* Test different headlines */}
      <ValueVariant 
        experimentId={1003}
        configKey="headline"
        defaultValue="Welcome to Our Platform"
      >
        {(headline, variantId) => (
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            {headline}
          </h1>
        )}
      </ValueVariant>

      {/* Test different CTA text */}
      <ValueVariant 
        experimentId={1003}
        configKey="ctaText"
        defaultValue="Get Started"
      >
        {(ctaText, variantId) => (
          <button 
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            data-variant={variantId}
          >
            {ctaText}
          </button>
        )}
      </ValueVariant>
    </div>
  );
};

// Example 4: Feature Flag Usage
const NewFeatureRollout: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      
      {/* Gradually roll out new analytics feature */}
      <FeatureFlag 
        flagKey="advanced_analytics_enabled"
        defaultValue={false}
        fallback={<div>Loading...</div>}
      >
        {(isEnabled) => (
          isEnabled ? (
            <AdvancedAnalyticsDashboard />
          ) : (
            <BasicAnalyticsDashboard />
          )
        )}
      </FeatureFlag>

      {/* Show beta features to selected users */}
      <FeatureFlag 
        flagKey="beta_features_access"
        defaultValue={false}
      >
        {(hasAccess) => hasAccess && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800">Beta Features</h3>
            <p className="text-yellow-700">You have access to beta features!</p>
            <BetaFeaturesList />
          </div>
        )}
      </FeatureFlag>
    </div>
  );
};

// Example 5: Advanced Experiment with Custom Tracking
const AdvancedTrackingExample: React.FC = () => {
  return (
    <AdvancedExperiment
      experimentId={1004}
      trackClicks={true}
      trackScrollDepth={true}
      metrics={{
        'purchase_intent': {
          selector: '.purchase-button',
          eventValue: 1,
          properties: { funnel_stage: 'intent' }
        },
        'email_signup': {
          selector: '.email-form',
          eventValue: 0.5,
          properties: { lead_type: 'newsletter' }
        }
      }}
      fallback={<DefaultLandingPage />}
    >
      <Variant variantId="control">
        <LandingPageVariantA />
      </Variant>
      
      <Variant variantId="variant_urgency">
        <LandingPageWithUrgency />
      </Variant>
      
      <Variant variantId="variant_social_proof">
        <LandingPageWithSocialProof />
      </Variant>
    </AdvancedExperiment>
  );
};

// Example 6: HOC Pattern for Component Testing
const LoginFormControl: React.FC<{ onSubmit: (data: any) => void }> = ({ onSubmit }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <input type="email" placeholder="Email" className="w-full p-3 border rounded" />
    <input type="password" placeholder="Password" className="w-full p-3 border rounded" />
    <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded">
      Sign In
    </button>
  </form>
);

const LoginFormVariantA: React.FC<{ onSubmit: (data: any) => void }> = ({ onSubmit }) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700">Email Address</label>
      <input type="email" className="w-full p-3 border rounded mt-1" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700">Password</label>
      <input type="password" className="w-full p-3 border rounded mt-1" />
    </div>
    <button type="submit" className="w-full bg-green-600 text-white p-3 rounded font-semibold">
      Continue to Dashboard
    </button>
  </form>
);

const LoginFormVariantB: React.FC<{ onSubmit: (data: any) => void }> = ({ onSubmit }) => (
  <div className="bg-gray-50 p-6 rounded-lg">
    <h3 className="text-lg font-semibold mb-4">Welcome Back!</h3>
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="email" placeholder="Enter your email" className="w-full p-3 border rounded" />
      <input type="password" placeholder="Enter your password" className="w-full p-3 border rounded" />
      <button type="submit" className="w-full bg-indigo-600 text-white p-3 rounded">
        Log In Securely
      </button>
    </form>
  </div>
);

const TestableLoginForm = withExperiment(1005, {
  control: LoginFormControl,
  variant_a: LoginFormVariantA,
  variant_b: LoginFormVariantB
}, {
  fallbackComponent: LoginFormControl,
  autoTrack: true,
  trackingProperties: { form_type: 'login', page: 'auth' }
});

// Example 7: Hook-based Component Selection
const HookBasedExample: React.FC = () => {
  const { VariantComponent, variantId } = useVariantComponent(1006, {
    control: () => <div className="bg-blue-100 p-4 rounded">Control Version</div>,
    variant_a: () => <div className="bg-green-100 p-4 rounded">Variant A</div>,
    variant_b: () => <div className="bg-purple-100 p-4 rounded">Variant B</div>
  });

  return (
    <div>
      <h3>Hook-based Variant Selection</h3>
      <p>Current variant: {variantId || 'Not assigned'}</p>
      {VariantComponent && <VariantComponent />}
    </div>
  );
};

// Example 8: Manual Tracking with Hooks
const ManualTrackingExample: React.FC = () => {
  const { assignment, track } = useExperiment(1007, { autoTrackPageView: false });
  const { trackConversion, trackClick } = useExperimentTracking();

  const handlePurchase = () => {
    if (assignment) {
      trackConversion(assignment.experimentId, assignment.variantId, 99.99, {
        product_category: 'subscription',
        plan_type: 'premium'
      });
    }
  };

  const handleNewsletterSignup = () => {
    if (assignment) {
      track('email_signup', {
        eventValue: 0.25,
        properties: { signup_location: 'modal' }
      });
    }
  };

  return (
    <div>
      <h3>Manual Event Tracking</h3>
      <button 
        onClick={handlePurchase}
        className="bg-green-600 text-white px-4 py-2 rounded mr-2"
      >
        Purchase Premium
      </button>
      <button 
        onClick={handleNewsletterSignup}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Subscribe to Newsletter
      </button>
    </div>
  );
};

// Supporting Components (stubs)
const PricingCard: React.FC<{ tier: string; price: number; featured?: boolean }> = ({ tier, price, featured }) => (
  <div className={`border rounded-lg p-6 ${featured ? 'ring-2 ring-blue-500' : ''}`}>
    <h3 className="text-lg font-semibold">{tier}</h3>
    <p className="text-3xl font-bold">${price}/mo</p>
    <button className="w-full mt-4 bg-blue-600 text-white py-2 rounded">
      Select Plan
    </button>
  </div>
);

const ComparisonTable: React.FC = () => (
  <div className="border rounded-lg p-6">
    <h3 className="text-lg font-semibold mb-4">Feature Comparison</h3>
    <p>Detailed comparison table would go here...</p>
  </div>
);

const AdvancedAnalyticsDashboard: React.FC = () => (
  <div className="bg-blue-50 p-6 rounded-lg">
    <h3 className="text-lg font-semibold">Advanced Analytics</h3>
    <p>New advanced analytics features...</p>
  </div>
);

const BasicAnalyticsDashboard: React.FC = () => (
  <div className="bg-gray-50 p-6 rounded-lg">
    <h3 className="text-lg font-semibold">Analytics</h3>
    <p>Basic analytics dashboard...</p>
  </div>
);

const BetaFeaturesList: React.FC = () => (
  <ul className="mt-2 space-y-1">
    <li>• Real-time collaboration</li>
    <li>• Advanced reporting</li>
    <li>• API access</li>
  </ul>
);

const DefaultLandingPage: React.FC = () => <div>Default landing page</div>;
const LandingPageVariantA: React.FC = () => <div>Landing page variant A</div>;
const LandingPageWithUrgency: React.FC = () => <div>Landing page with urgency</div>;
const LandingPageWithSocialProof: React.FC = () => <div>Landing page with social proof</div>;

// Main Example Component
const ABTestingExamples: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-6">A/B Testing Framework Examples</h1>
        <p className="text-gray-600 mb-8">
          This page demonstrates various ways to use the comprehensive A/B testing framework.
          Each example shows different features and patterns for testing user interfaces and experiences.
        </p>
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-4">1. Simple Button Color Test</h2>
        <ButtonColorTest />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">2. Pricing Layout Test</h2>
        <PricingLayoutTest />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">3. Dynamic Content Test</h2>
        <DynamicContentTest />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">4. Feature Flag Examples</h2>
        <NewFeatureRollout />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">5. Advanced Tracking</h2>
        <AdvancedTrackingExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">6. HOC Pattern</h2>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">7. Hook-based Selection</h2>
        <HookBasedExample />
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">8. Manual Event Tracking</h2>
        <ManualTrackingExample />
      </section>
    </div>
  );
};

export default ABTestingExamples;