# Pitchey Onboarding & Tutorial System

A comprehensive, role-specific onboarding system designed to guide new users through the Pitchey platform with interactive tutorials, gamification, and contextual help.

## 🎯 System Overview

The onboarding system provides:
- **Role-specific flows** for Creators, Investors, and Production Companies
- **Interactive guided tours** with tooltips and highlights
- **Gamification** with achievements, points, and progress tracking
- **Contextual help** and feature discovery
- **Analytics** to track engagement and optimize flows
- **Accessibility support** with reduced motion options

## 📁 File Structure

```
frontend/src/components/Onboarding/
├── index.ts                      # Main exports
├── onboarding.css               # Animation styles
├── OnboardingManager.tsx        # Global manager & hooks
├── OnboardingSettings.tsx       # Settings page
├── OnboardingProgress.tsx       # Progress widgets
├── OnboardingWelcome.tsx        # Welcome component
├── OnboardingAnalytics.tsx      # Analytics dashboard
├── CreatorOnboarding.tsx        # Creator-specific flow
├── InvestorOnboarding.tsx       # Investor-specific flow
├── ProductionOnboarding.tsx     # Production-specific flow
├── GuidedTour.tsx              # Tour system
├── TutorialTooltip.tsx         # Interactive tooltips
├── InteractiveTooltip.tsx      # Feature tooltips
├── AchievementSystem.tsx       # Gamification components
└── FeatureDiscovery.tsx        # Contextual help
```

## 🗄️ State Management

**Store Location:** `frontend/src/store/onboardingStore.ts`

### Key Features:
- **Zustand-based** persistent state management
- **Role-specific flows** with step tracking
- **Tutorial system** with multi-step guides
- **Achievement engine** with points and levels
- **Feature discovery** tracking
- **Analytics collection** for optimization
- **User preferences** for customization

### Default Achievements:
- Welcome Aboard (10 pts) - First login
- Profile Master (25 pts) - Complete profile
- Pitch Perfect (50 pts) - Create first pitch
- NDA Expert (35 pts) - Complete NDA process
- Consistent Creator (75 pts) - 7-day streak
- Tutorial Master (100 pts) - Complete 5 tutorials
- Onboarding Champion (150 pts) - Complete full onboarding

## 🎭 Role-Specific Flows

### Creator Onboarding (5 steps)
1. **Welcome** - Platform introduction (2 min)
2. **Profile Setup** - Complete creator profile (5 min)
3. **First Pitch** - Create compelling pitch (10 min)
4. **NDA Education** - IP protection learning (3 min)
5. **Dashboard Tour** - Platform navigation (5 min)

### Investor Onboarding (5 steps)
1. **Welcome** - Platform introduction (2 min)
2. **Investment Profile** - Define criteria (5 min)
3. **Browse Pitches** - Discovery process (8 min)
4. **NDA Signing** - Legal process (3 min)
5. **Portfolio Management** - Tracking tools (7 min)

### Production Onboarding (5 steps)
1. **Welcome** - Platform introduction (2 min)
2. **Company Setup** - Profile and capabilities (6 min)
3. **Submission Process** - Managing pitches (10 min)
4. **Collaboration Tools** - Team features (5 min)
5. **Pipeline Management** - Production tracking (8 min)

## 🎮 Interactive Components

### Guided Tours
- **Multi-step tutorials** with contextual overlays
- **Smart positioning** that adapts to viewport
- **Keyboard navigation** (arrow keys, ESC)
- **Auto-advancement** with manual controls
- **Skip options** for experienced users

### Tutorial Tooltips
- **Dynamic positioning** based on target elements
- **Multiple placements** (top, bottom, left, right, center)
- **Backdrop highlighting** with element focus
- **Progress indicators** showing step completion
- **Responsive design** for mobile devices

### Feature Discovery
- **Contextual spotlights** for new features
- **Smart timing** based on user behavior
- **Priority system** for important features
- **Dismissible prompts** with preferences
- **Help button** with quick access menu

## 🏆 Gamification System

### Achievement Engine
- **Real-time notifications** for unlocked achievements
- **Point accumulation** with level progression
- **Category system** (basic, intermediate, advanced, milestone)
- **Visual gallery** showing locked/unlocked status
- **Streak tracking** for daily engagement

### Progress Tracking
- **Level system** (100 points per level)
- **Daily streaks** with bonus achievements
- **Feature engagement** analytics
- **Completion metrics** per onboarding flow
- **Time tracking** for optimization

## 📊 Analytics & Insights

### Tracking Metrics
- **Completion rates** by user type and step
- **Drop-off analysis** identifying problem areas
- **Time spent** per step for optimization
- **Feature engagement** measuring adoption
- **Help request** frequency and patterns
- **Skip rates** for optional content

### Optimization Features
- **A/B testing** ready infrastructure
- **Export functionality** for detailed analysis
- **Real-time monitoring** of user progress
- **Conversion funnel** tracking
- **User journey** mapping

## 🔧 Integration Points

### Authentication System
- **Better Auth** session integration
- **Role detection** from user profile
- **Auto-initialization** on login
- **Persistent state** across sessions
- **Multi-portal** support

### App Integration
- **Global OnboardingManager** in App.tsx
- **Route-specific** contextual help
- **Settings page** at `/settings/onboarding`
- **Progress widgets** for dashboards
- **Help buttons** throughout platform

## 🎨 User Experience

### Accessibility
- **Reduced motion** support for animations
- **Keyboard navigation** for all interactions
- **High contrast** mode compatibility
- **Screen reader** friendly tooltips
- **Focus management** during tours

### Responsive Design
- **Mobile-optimized** tooltip positioning
- **Touch-friendly** interaction areas
- **Adaptive layouts** for different screens
- **Gesture support** for mobile navigation
- **Performance optimized** lazy loading

### Customization
- **User preferences** for tooltip behavior
- **Animation controls** for accessibility
- **Reminder frequency** settings
- **Feature spotlight** toggles
- **Progress visibility** options

## 🚀 Usage Examples

### Basic Integration
```tsx
import { OnboardingManager, useOnboarding } from './components/Onboarding';

// Global integration (in App.tsx)
<OnboardingManager 
  showProgressWidget={isAuthenticated && onDashboard}
  page="dashboard"
/>

// Component-level hooks
const { startOnboarding, isCompleted } = useOnboarding();
```

### Custom Tours
```tsx
import { GuidedTour, useTour } from './components/Onboarding';

const steps = [
  {
    id: 'step1',
    target: '#feature-button',
    title: 'New Feature',
    content: 'This button opens our new feature...'
  }
];

<GuidedTour
  tourId="feature-intro"
  steps={steps}
  onComplete={() => console.log('Tour complete')}
/>
```

### Achievement Tracking
```tsx
import { useOnboardingStore } from './store/onboardingStore';

const { unlockAchievement, addPoints } = useOnboardingStore();

// Trigger achievements
unlockAchievement('first-pitch');
addPoints(50);
```

## 🔄 Development Workflow

### Adding New Steps
1. Update flow definition in `onboardingStore.ts`
2. Create step component in role-specific onboarding
3. Add tutorial steps if needed
4. Update analytics tracking

### Creating Achievements
1. Define achievement in store defaults
2. Add unlock triggers in relevant components
3. Design notification UI
4. Test point calculations

### Adding Contextual Help
1. Define feature in `FeatureDiscovery.tsx`
2. Add data-tour attributes to target elements
3. Configure spotlight behavior
4. Test positioning and timing

## 📈 Success Metrics

### Key Performance Indicators
- **Onboarding Completion Rate**: Target 80%+
- **Time to First Value**: Under 10 minutes
- **Feature Adoption**: 60%+ discovery rate
- **User Satisfaction**: Based on help requests
- **Retention Impact**: 30-day active users

### Optimization Opportunities
- **Step refinement** based on drop-off data
- **Content updates** from user feedback
- **Flow personalization** by user behavior
- **Performance improvements** for mobile
- **Accessibility enhancements** ongoing

## 🎯 Next Steps

### Immediate Enhancements
1. **Video tutorials** embedded in steps
2. **Internationalization** for global users
3. **Advanced analytics** with ML insights
4. **Social features** for sharing progress
5. **Integration testing** with real user data

### Future Expansions
1. **AI-powered** personalized flows
2. **Voice guidance** for accessibility
3. **AR overlays** for mobile experience
4. **Community features** for peer learning
5. **Advanced gamification** with leaderboards

## 📝 Configuration

The onboarding system can be customized through:
- **Store configuration** in `onboardingStore.ts`
- **Flow definitions** per user type
- **Achievement settings** and point values
- **Animation preferences** in CSS
- **Analytics collection** parameters

This comprehensive system ensures new users quickly understand and engage with the Pitchey platform while providing valuable insights for continuous improvement.