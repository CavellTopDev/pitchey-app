import React, { useEffect } from 'react';
import './onboarding.css';
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { CreatorOnboarding } from './CreatorOnboarding';
import { InvestorOnboarding } from './InvestorOnboarding';
import { ProductionOnboarding } from './ProductionOnboarding';
import { AchievementManager } from './AchievementSystem';
import { ContextualHelp } from './FeatureDiscovery';
import { OnboardingProgress } from './OnboardingProgress';

interface OnboardingManagerProps {
  page?: string;
  showProgressWidget?: boolean;
  forceShow?: boolean;
}

export const OnboardingManager: React.FC<OnboardingManagerProps> = ({
  page = 'dashboard',
  showProgressWidget = false,
  forceShow = false
}) => {
  const { user, isAuthenticated } = useBetterAuthStore();
  const {
    currentFlow,
    isOnboardingActive,
    initializeOnboarding,
    updateStreak,
    unlockAchievement,
    preferences
  } = useOnboardingStore();

  // Initialize onboarding when user logs in
  useEffect(() => {
    if (isAuthenticated && user && !currentFlow) {
      const userType = user.userType as 'creator' | 'investor' | 'production';
      
      // Check if user should see onboarding
      const shouldShowOnboarding = forceShow || 
        !localStorage.getItem(`onboarding-completed-${userType}`) ||
        localStorage.getItem(`onboarding-skipped-${userType}`) !== 'true';

      if (shouldShowOnboarding && userType) {
        initializeOnboarding(userType);
        
        // Award first login achievement
        unlockAchievement('first-login');
      }
      
      // Update daily streak
      updateStreak();
    }
  }, [isAuthenticated, user, currentFlow, initializeOnboarding, forceShow, updateStreak, unlockAchievement]);

  // Don't render if user is not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  const userType = user.userType as 'creator' | 'investor' | 'production';

  const renderOnboardingFlow = () => {
    if (!isOnboardingActive || !currentFlow) return null;

    switch (userType) {
      case 'creator':
        return <CreatorOnboarding />;
      case 'investor':
        return <InvestorOnboarding />;
      case 'production':
        return <ProductionOnboarding />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Main Onboarding Flow */}
      {renderOnboardingFlow()}

      {/* Progress Widget (if enabled and onboarding is active) */}
      {showProgressWidget && isOnboardingActive && currentFlow && (
        <div className="fixed bottom-4 left-4 z-40 max-w-sm">
          <OnboardingProgress compact />
        </div>
      )}

      {/* Contextual Help System */}
      {preferences.showTooltips && (
        <ContextualHelp page={page} userType={userType} />
      )}

      {/* Achievement Notifications */}
      {preferences.enableGamification && <AchievementManager />}
    </>
  );
};

// Hook for easy onboarding management
export const useOnboarding = () => {
  const { user } = useBetterAuthStore();
  const {
    currentFlow,
    isOnboardingActive,
    initializeOnboarding,
    completeOnboarding,
    skipOnboarding,
    completeStep,
    skipStep,
    startTutorial,
    completeTutorial,
    unlockAchievement,
    addPoints,
    markFeatureDiscovered,
    updatePreferences
  } = useOnboardingStore();

  const startOnboarding = (userType?: 'creator' | 'investor' | 'production') => {
    const targetUserType = userType || (user?.userType as any);
    if (targetUserType) {
      initializeOnboarding(targetUserType);
    }
  };

  const finishOnboarding = () => {
    completeOnboarding();
    
    // Mark onboarding as completed in localStorage
    if (user?.userType) {
      localStorage.setItem(`onboarding-completed-${user.userType}`, 'true');
      localStorage.removeItem(`onboarding-skipped-${user.userType}`);
    }
  };

  const skipCurrentOnboarding = () => {
    skipOnboarding();
    
    // Mark onboarding as skipped in localStorage
    if (user?.userType) {
      localStorage.setItem(`onboarding-skipped-${user.userType}`, 'true');
    }
  };

  const restartOnboarding = () => {
    if (user?.userType) {
      localStorage.removeItem(`onboarding-completed-${user.userType}`);
      localStorage.removeItem(`onboarding-skipped-${user.userType}`);
      initializeOnboarding(user.userType as any);
    }
  };

  const hasCompletedOnboarding = () => {
    if (!user?.userType) return false;
    return localStorage.getItem(`onboarding-completed-${user.userType}`) === 'true';
  };

  const hasSkippedOnboarding = () => {
    if (!user?.userType) return false;
    return localStorage.getItem(`onboarding-skipped-${user.userType}`) === 'true';
  };

  return {
    // State
    currentFlow,
    isOnboardingActive,
    isCompleted: hasCompletedOnboarding(),
    isSkipped: hasSkippedOnboarding(),
    
    // Actions
    startOnboarding,
    finishOnboarding,
    skipCurrentOnboarding,
    restartOnboarding,
    completeStep,
    skipStep,
    
    // Tutorial actions
    startTutorial,
    completeTutorial,
    
    // Gamification actions
    unlockAchievement,
    addPoints,
    markFeatureDiscovered,
    
    // Settings
    updatePreferences
  };
};