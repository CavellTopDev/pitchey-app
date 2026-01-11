// Main Components
export { OnboardingManager, useOnboarding } from './OnboardingManager';
export { OnboardingProgress } from './OnboardingProgress';
export { OnboardingWelcome } from './OnboardingWelcome';
export { OnboardingAnalytics } from './OnboardingAnalytics';

// Role-specific Onboarding
export { CreatorOnboarding } from './CreatorOnboarding';
export { InvestorOnboarding } from './InvestorOnboarding';
export { ProductionOnboarding } from './ProductionOnboarding';

// Tutorial System
export { GuidedTour, useTour } from './GuidedTour';
export { TutorialTooltip } from './TutorialTooltip';
export { InteractiveTooltip } from './InteractiveTooltip';

// Gamification
export { 
  AchievementSystem,
  AchievementGallery,
  AchievementManager,
  ProgressStats 
} from './AchievementSystem';

// Feature Discovery
export { 
  FeatureDiscovery,
  HelpButton,
  ContextualHelp 
} from './FeatureDiscovery';

// Store
export { useOnboardingStore } from '../../store/onboardingStore';

// Types
export type { 
  OnboardingStep,
  TutorialStep,
  Achievement,
  OnboardingFlow 
} from '../../store/onboardingStore';