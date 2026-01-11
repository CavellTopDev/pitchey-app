import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component?: string;
  required: boolean;
  completed: boolean;
  skipped?: boolean;
  progress?: number; // 0-100
  estimatedTime?: number; // minutes
}

export interface TutorialStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
  optional?: boolean;
  highlightPadding?: number;
  customComponent?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
  category: 'basic' | 'intermediate' | 'advanced' | 'milestone';
  points: number;
}

export interface OnboardingFlow {
  id: string;
  name: string;
  userType: 'creator' | 'investor' | 'production';
  steps: OnboardingStep[];
  currentStepIndex: number;
  completed: boolean;
  startedAt?: Date;
  completedAt?: Date;
  skippedSteps: string[];
}

interface OnboardingState {
  // Onboarding Flow State
  currentFlow: OnboardingFlow | null;
  flows: Record<string, OnboardingFlow>;
  isOnboardingActive: boolean;
  canSkipOnboarding: boolean;
  
  // Tutorial State
  activeTutorial: string | null;
  tutorialSteps: TutorialStep[];
  currentTutorialStep: number;
  tutorialHistory: string[];
  
  // Gamification State
  achievements: Achievement[];
  totalPoints: number;
  level: number;
  streakDays: number;
  lastActivityDate?: Date;
  
  // Feature Discovery
  discoveredFeatures: string[];
  pendingFeaturePrompts: string[];
  featureSpotlightQueue: string[];
  
  // User Preferences
  preferences: {
    showTooltips: boolean;
    enableGamification: boolean;
    autoplayTutorials: boolean;
    skipAnimations: boolean;
    reminderFrequency: 'daily' | 'weekly' | 'never';
  };
  
  // Analytics Tracking
  analytics: {
    stepCompletionTimes: Record<string, number>;
    tutorialDropoffPoints: Record<string, number>;
    featureEngagement: Record<string, number>;
    helpRequestCount: number;
  };
  
  // Actions
  initializeOnboarding: (userType: 'creator' | 'investor' | 'production') => void;
  startFlow: (flowId: string) => void;
  completeStep: (stepId: string) => void;
  skipStep: (stepId: string) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  
  // Tutorial Actions
  startTutorial: (tutorialId: string, steps: TutorialStep[]) => void;
  nextTutorialStep: () => void;
  previousTutorialStep: () => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
  
  // Achievement Actions
  unlockAchievement: (achievementId: string) => void;
  addPoints: (points: number) => void;
  updateLevel: () => void;
  updateStreak: () => void;
  
  // Feature Discovery Actions
  markFeatureDiscovered: (featureId: string) => void;
  addFeaturePrompt: (featureId: string) => void;
  dismissFeaturePrompt: (featureId: string) => void;
  queueFeatureSpotlight: (featureId: string) => void;
  
  // Preference Actions
  updatePreferences: (preferences: Partial<OnboardingState['preferences']>) => void;
  
  // Analytics Actions
  trackStepCompletion: (stepId: string, timeSpent: number) => void;
  trackTutorialDropoff: (tutorialId: string, stepIndex: number) => void;
  trackFeatureEngagement: (featureId: string) => void;
  incrementHelpRequests: () => void;
  
  // Reset Actions
  resetOnboarding: () => void;
  resetTutorials: () => void;
  resetAchievements: () => void;
}

// Default flows for each user type
const createDefaultFlows = (): Record<string, OnboardingFlow> => {
  const creatorFlow: OnboardingFlow = {
    id: 'creator-onboarding',
    name: 'Creator Onboarding',
    userType: 'creator',
    currentStepIndex: 0,
    completed: false,
    skippedSteps: [],
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Pitchey',
        description: 'Learn how to create and manage your movie pitches',
        required: false,
        completed: false,
        estimatedTime: 2
      },
      {
        id: 'profile-setup',
        title: 'Complete Your Profile',
        description: 'Set up your creator profile to attract investors and production companies',
        required: true,
        completed: false,
        estimatedTime: 5
      },
      {
        id: 'first-pitch',
        title: 'Create Your First Pitch',
        description: 'Learn how to create compelling movie pitches',
        required: true,
        completed: false,
        estimatedTime: 10
      },
      {
        id: 'nda-setup',
        title: 'Understand NDA Process',
        description: 'Learn how to protect your intellectual property',
        required: false,
        completed: false,
        estimatedTime: 3
      },
      {
        id: 'dashboard-tour',
        title: 'Dashboard Tour',
        description: 'Explore your creator dashboard and analytics',
        required: false,
        completed: false,
        estimatedTime: 5
      }
    ]
  };

  const investorFlow: OnboardingFlow = {
    id: 'investor-onboarding',
    name: 'Investor Onboarding',
    userType: 'investor',
    currentStepIndex: 0,
    completed: false,
    skippedSteps: [],
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Pitchey',
        description: 'Discover promising movie projects and investment opportunities',
        required: false,
        completed: false,
        estimatedTime: 2
      },
      {
        id: 'profile-setup',
        title: 'Investment Profile Setup',
        description: 'Define your investment criteria and preferences',
        required: true,
        completed: false,
        estimatedTime: 5
      },
      {
        id: 'browse-pitches',
        title: 'Browse Pitches',
        description: 'Learn how to discover and evaluate movie pitches',
        required: true,
        completed: false,
        estimatedTime: 8
      },
      {
        id: 'nda-signing',
        title: 'NDA Process',
        description: 'Understand how to request and sign NDAs',
        required: false,
        completed: false,
        estimatedTime: 3
      },
      {
        id: 'portfolio-management',
        title: 'Portfolio Management',
        description: 'Learn to track and manage your investments',
        required: false,
        completed: false,
        estimatedTime: 7
      }
    ]
  };

  const productionFlow: OnboardingFlow = {
    id: 'production-onboarding',
    name: 'Production Company Onboarding',
    userType: 'production',
    currentStepIndex: 0,
    completed: false,
    skippedSteps: [],
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Pitchey',
        description: 'Find exceptional scripts and manage your production pipeline',
        required: false,
        completed: false,
        estimatedTime: 2
      },
      {
        id: 'company-setup',
        title: 'Company Profile Setup',
        description: 'Set up your production company profile and capabilities',
        required: true,
        completed: false,
        estimatedTime: 6
      },
      {
        id: 'submission-process',
        title: 'Submission Management',
        description: 'Learn how to manage incoming pitch submissions',
        required: true,
        completed: false,
        estimatedTime: 10
      },
      {
        id: 'collaboration-tools',
        title: 'Collaboration Features',
        description: 'Explore tools for working with creators and investors',
        required: false,
        completed: false,
        estimatedTime: 5
      },
      {
        id: 'pipeline-management',
        title: 'Production Pipeline',
        description: 'Organize and track your production projects',
        required: false,
        completed: false,
        estimatedTime: 8
      }
    ]
  };

  return {
    'creator-onboarding': creatorFlow,
    'investor-onboarding': investorFlow,
    'production-onboarding': productionFlow
  };
};

// Default achievements
const defaultAchievements: Achievement[] = [
  {
    id: 'first-login',
    title: 'Welcome Aboard!',
    description: 'Successfully logged into Pitchey',
    icon: '🎬',
    category: 'basic',
    points: 10
  },
  {
    id: 'profile-complete',
    title: 'Profile Master',
    description: 'Completed your profile setup',
    icon: '👤',
    category: 'basic',
    points: 25
  },
  {
    id: 'first-pitch',
    title: 'Pitch Perfect',
    description: 'Created your first movie pitch',
    icon: '🎯',
    category: 'basic',
    points: 50
  },
  {
    id: 'nda-expert',
    title: 'NDA Expert',
    description: 'Successfully completed the NDA process',
    icon: '🔒',
    category: 'intermediate',
    points: 35
  },
  {
    id: 'week-streak',
    title: 'Consistent Creator',
    description: 'Logged in for 7 consecutive days',
    icon: '🔥',
    category: 'intermediate',
    points: 75
  },
  {
    id: 'tutorial-master',
    title: 'Tutorial Master',
    description: 'Completed 5 tutorials',
    icon: '🎓',
    category: 'advanced',
    points: 100
  },
  {
    id: 'onboarding-complete',
    title: 'Onboarding Champion',
    description: 'Completed the entire onboarding process',
    icon: '🏆',
    category: 'milestone',
    points: 150
  }
];

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Initial State
      currentFlow: null,
      flows: createDefaultFlows(),
      isOnboardingActive: false,
      canSkipOnboarding: true,
      
      activeTutorial: null,
      tutorialSteps: [],
      currentTutorialStep: 0,
      tutorialHistory: [],
      
      achievements: defaultAchievements,
      totalPoints: 0,
      level: 1,
      streakDays: 0,
      
      discoveredFeatures: [],
      pendingFeaturePrompts: [],
      featureSpotlightQueue: [],
      
      preferences: {
        showTooltips: true,
        enableGamification: true,
        autoplayTutorials: false,
        skipAnimations: false,
        reminderFrequency: 'weekly'
      },
      
      analytics: {
        stepCompletionTimes: {},
        tutorialDropoffPoints: {},
        featureEngagement: {},
        helpRequestCount: 0
      },

      // Onboarding Actions
      initializeOnboarding: (userType) => {
        const flowId = `${userType}-onboarding`;
        const flow = get().flows[flowId];
        
        if (flow) {
          set({
            currentFlow: { ...flow, startedAt: new Date() },
            isOnboardingActive: true
          });
        }
      },

      startFlow: (flowId) => {
        const flow = get().flows[flowId];
        if (flow) {
          set({
            currentFlow: { ...flow, startedAt: new Date() },
            isOnboardingActive: true
          });
        }
      },

      completeStep: (stepId) => {
        const { currentFlow, trackStepCompletion } = get();
        if (!currentFlow) return;

        const stepIndex = currentFlow.steps.findIndex(step => step.id === stepId);
        if (stepIndex === -1) return;

        const updatedSteps = [...currentFlow.steps];
        updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], completed: true, progress: 100 };

        const updatedFlow = {
          ...currentFlow,
          steps: updatedSteps,
          currentStepIndex: Math.min(stepIndex + 1, updatedSteps.length - 1)
        };

        // Check if all required steps are completed
        const allRequiredCompleted = updatedSteps
          .filter(step => step.required)
          .every(step => step.completed);

        if (allRequiredCompleted) {
          updatedFlow.completed = true;
          updatedFlow.completedAt = new Date();
        }

        set({
          currentFlow: updatedFlow,
          flows: { ...get().flows, [updatedFlow.id]: updatedFlow }
        });

        // Track completion time
        trackStepCompletion(stepId, Date.now());

        // Check for achievements
        get().unlockAchievement('profile-complete');
        if (stepId === 'first-pitch') get().unlockAchievement('first-pitch');
        if (allRequiredCompleted) get().unlockAchievement('onboarding-complete');
      },

      skipStep: (stepId) => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        const stepIndex = currentFlow.steps.findIndex(step => step.id === stepId);
        if (stepIndex === -1 || currentFlow.steps[stepIndex].required) return;

        const updatedSteps = [...currentFlow.steps];
        updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], skipped: true };

        const updatedFlow = {
          ...currentFlow,
          steps: updatedSteps,
          currentStepIndex: Math.min(stepIndex + 1, updatedSteps.length - 1),
          skippedSteps: [...currentFlow.skippedSteps, stepId]
        };

        set({
          currentFlow: updatedFlow,
          flows: { ...get().flows, [updatedFlow.id]: updatedFlow }
        });
      },

      nextStep: () => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        const nextIndex = Math.min(currentFlow.currentStepIndex + 1, currentFlow.steps.length - 1);
        set({
          currentFlow: { ...currentFlow, currentStepIndex: nextIndex }
        });
      },

      previousStep: () => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        const prevIndex = Math.max(currentFlow.currentStepIndex - 1, 0);
        set({
          currentFlow: { ...currentFlow, currentStepIndex: prevIndex }
        });
      },

      skipOnboarding: () => {
        set({ isOnboardingActive: false, currentFlow: null });
      },

      completeOnboarding: () => {
        const { currentFlow } = get();
        if (!currentFlow) return;

        const completedFlow = {
          ...currentFlow,
          completed: true,
          completedAt: new Date()
        };

        set({
          currentFlow: completedFlow,
          flows: { ...get().flows, [completedFlow.id]: completedFlow },
          isOnboardingActive: false
        });

        get().unlockAchievement('onboarding-complete');
        get().addPoints(150);
      },

      // Tutorial Actions
      startTutorial: (tutorialId, steps) => {
        set({
          activeTutorial: tutorialId,
          tutorialSteps: steps,
          currentTutorialStep: 0,
          tutorialHistory: [...get().tutorialHistory, tutorialId]
        });
      },

      nextTutorialStep: () => {
        const { currentTutorialStep, tutorialSteps } = get();
        if (currentTutorialStep < tutorialSteps.length - 1) {
          set({ currentTutorialStep: currentTutorialStep + 1 });
        }
      },

      previousTutorialStep: () => {
        const { currentTutorialStep } = get();
        if (currentTutorialStep > 0) {
          set({ currentTutorialStep: currentTutorialStep - 1 });
        }
      },

      completeTutorial: () => {
        set({
          activeTutorial: null,
          tutorialSteps: [],
          currentTutorialStep: 0
        });
        
        get().addPoints(25);
        
        // Check for tutorial master achievement
        const completedTutorials = get().tutorialHistory.length;
        if (completedTutorials >= 5) {
          get().unlockAchievement('tutorial-master');
        }
      },

      skipTutorial: () => {
        const { activeTutorial, currentTutorialStep, trackTutorialDropoff } = get();
        if (activeTutorial) {
          trackTutorialDropoff(activeTutorial, currentTutorialStep);
        }
        
        set({
          activeTutorial: null,
          tutorialSteps: [],
          currentTutorialStep: 0
        });
      },

      // Achievement Actions
      unlockAchievement: (achievementId) => {
        const achievements = get().achievements;
        const achievementIndex = achievements.findIndex(a => a.id === achievementId);
        
        if (achievementIndex !== -1 && !achievements[achievementIndex].unlockedAt) {
          const updatedAchievements = [...achievements];
          updatedAchievements[achievementIndex] = {
            ...updatedAchievements[achievementIndex],
            unlockedAt: new Date()
          };
          
          set({ achievements: updatedAchievements });
          get().addPoints(updatedAchievements[achievementIndex].points);
        }
      },

      addPoints: (points) => {
        const newTotal = get().totalPoints + points;
        set({ totalPoints: newTotal });
        get().updateLevel();
      },

      updateLevel: () => {
        const points = get().totalPoints;
        // Level up every 100 points
        const newLevel = Math.floor(points / 100) + 1;
        set({ level: newLevel });
      },

      updateStreak: () => {
        const { lastActivityDate, streakDays } = get();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (!lastActivityDate) {
          set({ streakDays: 1, lastActivityDate: today });
          return;
        }

        const lastActivity = new Date(lastActivityDate);
        const isSameDay = lastActivity.toDateString() === today.toDateString();
        const isYesterday = lastActivity.toDateString() === yesterday.toDateString();

        if (isSameDay) {
          // Same day, no change
          return;
        } else if (isYesterday) {
          // Consecutive day, increase streak
          const newStreak = streakDays + 1;
          set({ streakDays: newStreak, lastActivityDate: today });
          
          if (newStreak >= 7) {
            get().unlockAchievement('week-streak');
          }
        } else {
          // Streak broken, reset
          set({ streakDays: 1, lastActivityDate: today });
        }
      },

      // Feature Discovery Actions
      markFeatureDiscovered: (featureId) => {
        const discovered = get().discoveredFeatures;
        if (!discovered.includes(featureId)) {
          set({ discoveredFeatures: [...discovered, featureId] });
          get().trackFeatureEngagement(featureId);
        }
      },

      addFeaturePrompt: (featureId) => {
        const prompts = get().pendingFeaturePrompts;
        if (!prompts.includes(featureId)) {
          set({ pendingFeaturePrompts: [...prompts, featureId] });
        }
      },

      dismissFeaturePrompt: (featureId) => {
        set({
          pendingFeaturePrompts: get().pendingFeaturePrompts.filter(id => id !== featureId)
        });
      },

      queueFeatureSpotlight: (featureId) => {
        const queue = get().featureSpotlightQueue;
        if (!queue.includes(featureId)) {
          set({ featureSpotlightQueue: [...queue, featureId] });
        }
      },

      // Preference Actions
      updatePreferences: (newPreferences) => {
        set({
          preferences: { ...get().preferences, ...newPreferences }
        });
      },

      // Analytics Actions
      trackStepCompletion: (stepId, timeSpent) => {
        const analytics = get().analytics;
        set({
          analytics: {
            ...analytics,
            stepCompletionTimes: {
              ...analytics.stepCompletionTimes,
              [stepId]: timeSpent
            }
          }
        });
      },

      trackTutorialDropoff: (tutorialId, stepIndex) => {
        const analytics = get().analytics;
        set({
          analytics: {
            ...analytics,
            tutorialDropoffPoints: {
              ...analytics.tutorialDropoffPoints,
              [`${tutorialId}-${stepIndex}`]: (analytics.tutorialDropoffPoints[`${tutorialId}-${stepIndex}`] || 0) + 1
            }
          }
        });
      },

      trackFeatureEngagement: (featureId) => {
        const analytics = get().analytics;
        set({
          analytics: {
            ...analytics,
            featureEngagement: {
              ...analytics.featureEngagement,
              [featureId]: (analytics.featureEngagement[featureId] || 0) + 1
            }
          }
        });
      },

      incrementHelpRequests: () => {
        const analytics = get().analytics;
        set({
          analytics: {
            ...analytics,
            helpRequestCount: analytics.helpRequestCount + 1
          }
        });
      },

      // Reset Actions
      resetOnboarding: () => {
        set({
          currentFlow: null,
          flows: createDefaultFlows(),
          isOnboardingActive: false
        });
      },

      resetTutorials: () => {
        set({
          activeTutorial: null,
          tutorialSteps: [],
          currentTutorialStep: 0,
          tutorialHistory: []
        });
      },

      resetAchievements: () => {
        set({
          achievements: defaultAchievements,
          totalPoints: 0,
          level: 1,
          streakDays: 0,
          lastActivityDate: undefined
        });
      }
    }),
    {
      name: 'pitchey-onboarding',
      partialize: (state) => ({
        flows: state.flows,
        achievements: state.achievements,
        totalPoints: state.totalPoints,
        level: state.level,
        streakDays: state.streakDays,
        lastActivityDate: state.lastActivityDate,
        discoveredFeatures: state.discoveredFeatures,
        preferences: state.preferences,
        analytics: state.analytics,
        tutorialHistory: state.tutorialHistory
      })
    }
  )
);