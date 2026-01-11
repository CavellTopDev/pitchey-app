# Pitchey Mobile Development Guide

## Overview

This guide provides comprehensive documentation for developing mobile applications for the Pitchey platform, including Progressive Web Apps (PWA), React Native apps, and mobile web optimizations.

## Table of Contents

1. [Progressive Web App (PWA) Setup](#progressive-web-app-pwa-setup)
2. [React Native Development Kit](#react-native-development-kit)
3. [Mobile API Endpoints](#mobile-api-endpoints)
4. [Authentication & Device Management](#authentication--device-management)
5. [Push Notifications](#push-notifications)
6. [Mobile UI Components](#mobile-ui-components)
7. [Testing Guidelines](#testing-guidelines)
8. [Performance Optimization](#performance-optimization)
9. [Deployment](#deployment)

---

## Progressive Web App (PWA) Setup

### 1. PWA Manifest

The PWA manifest is located at `/frontend/public/manifest.json` and includes:

- **App metadata**: Name, description, theme colors
- **Icons**: Multiple sizes for different devices (72x72 to 512x512)
- **Screenshots**: Mobile and desktop app previews
- **Shortcuts**: Quick actions for installed app
- **File handling**: Support for sharing files to the app

```json
{
  "name": "Pitchey - Movie Pitch Platform",
  "short_name": "Pitchey",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#1f2937",
  "background_color": "#ffffff"
}
```

### 2. Service Worker

Two service worker implementations are provided:

- **Standard**: `/frontend/public/service-worker.js`
- **Mobile-optimized**: `/frontend/public/sw-mobile.js`

The mobile-optimized service worker includes:

- Connection-aware caching strategies
- Image optimization based on network speed
- Enhanced offline support
- Background sync for mobile data
- Push notification handling

### 3. PWA Components

#### PWAInstallPrompt Component
- Cross-platform install prompts (iOS, Android, Desktop)
- Handles beforeinstallprompt events
- Provides iOS-specific install instructions

#### ServiceWorkerManager Component
- Service worker registration and updates
- Cache status monitoring
- Mobile optimization toggles
- Connection quality indicators

#### PWAManager Component
- Complete PWA initialization
- Mobile viewport optimizations
- iOS splash screen setup
- Safe area handling

### 4. Installation

```typescript
import PWAManager from '@/components/PWA/PWAManager';

function App() {
  return (
    <PWAManager
      enableInstallPrompt={true}
      showServiceWorkerStatus={false}
      enableMobileOptimizations={true}
    >
      {/* Your app content */}
    </PWAManager>
  );
}
```

---

## React Native Development Kit

The React Native kit is located at `/mobile-kit/` and provides:

### 1. Shared Type Definitions

Location: `/mobile-kit/src/types/index.ts`

Key interfaces:
- `User`, `Pitch`, `PitchDetail`
- `ApiResponse`, `PaginatedResponse`
- `DeviceInfo`, `MobileDevice`
- `NotificationPayload`, `PushSubscription`
- `LoginRequest`, `LoginResponse`

### 2. API Client

Location: `/mobile-kit/src/api/PitcheyApiClient.ts`

Features:
- Type-safe API methods
- Automatic token refresh
- Connection-aware caching
- Mobile-specific optimizations
- Offline support

```typescript
import { createPitcheyApiClient } from '@pitchey/mobile-kit';

const apiClient = createPitcheyApiClient({
  apiBaseUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  enableMobileOptimizations: true
});

// Login
const response = await apiClient.login({
  email: 'user@example.com',
  password: 'password',
  deviceInfo: {
    id: 'device-123',
    name: 'iPhone',
    platform: 'ios'
  }
});

// Get trending pitches
const pitches = await apiClient.getTrendingPitches(1, 20);
```

### 3. React Native Components

#### PitchCard Component
- Optimized touch interactions
- Image lazy loading
- Performance metrics
- Accessibility support

#### MobileAuthForm Component
- Biometric authentication support
- Device registration
- Form validation
- Multi-step signup flow

### 4. Installation

```bash
npm install @pitchey/mobile-kit
```

```typescript
import { PitchCard, MobileAuthForm } from '@pitchey/mobile-kit';
```

---

## Mobile API Endpoints

All mobile endpoints are prefixed with `/api/mobile/` and include mobile-specific optimizations.

### 1. Authentication Endpoints

```typescript
// Login with device registration
POST /api/mobile/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "deviceInfo": {
    "id": "device-123",
    "name": "iPhone",
    "platform": "ios",
    "version": "17.0",
    "pushToken": "fcm-token-123"
  },
  "rememberDevice": true
}

// Token refresh
POST /api/mobile/auth/refresh
{
  "refreshToken": "refresh-token-here"
}

// Logout
POST /api/mobile/auth/logout
{
  "deviceId": "device-123",
  "deactivateDevice": false
}
```

### 2. Content Endpoints

```typescript
// Get trending pitches with mobile optimizations
GET /api/mobile/pitches/trending?page=1&limit=20&genre=Drama

// Get pitch details with optimized images
GET /api/mobile/pitches/123

// Search pitches with pagination
GET /api/mobile/search/pitches?q=action&page=1&limit=20

// Get user dashboard
GET /api/mobile/dashboard
```

### 3. Device Management

```typescript
// Get user devices
GET /api/mobile/devices

// Revoke device access
DELETE /api/mobile/devices/device-123/revoke

// Update push token
PUT /api/mobile/push/token
{
  "pushToken": "new-fcm-token",
  "deviceId": "device-123"
}
```

### 4. Notifications

```typescript
// Get notifications with pagination
GET /api/mobile/notifications?page=1&limit=20&unread_only=true

// Subscribe to push notifications
POST /api/mobile/push/subscribe
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "key-here",
      "auth": "auth-here"
    }
  },
  "deviceId": "device-123",
  "platform": "web"
}
```

---

## Authentication & Device Management

### 1. Mobile Authentication Flow

```typescript
// 1. Generate device info
const deviceInfo: DeviceInfo = {
  id: await generateDeviceId(),
  name: await getDeviceName(),
  platform: Platform.OS,
  version: Platform.Version,
  model: await getDeviceModel()
};

// 2. Login with device registration
const response = await apiClient.login({
  email,
  password,
  deviceInfo,
  rememberDevice: true
});

// 3. Store tokens securely
await SecureStore.setItemAsync('accessToken', response.accessToken);
await SecureStore.setItemAsync('refreshToken', response.refreshToken);
await SecureStore.setItemAsync('deviceId', response.deviceId);
```

### 2. Device Security Features

- **Device Fingerprinting**: Unique device identification
- **Failed Login Protection**: Account locking after multiple failures
- **Session Management**: Per-device session tracking
- **Remote Device Revocation**: Ability to revoke access from other devices
- **Security Event Logging**: Audit trail for authentication events

### 3. Biometric Authentication

```typescript
import TouchID from 'react-native-touch-id';

const enableBiometric = async () => {
  const isSupported = await TouchID.isSupported();
  if (isSupported) {
    // Store credentials securely
    await Keychain.setInternetCredentials(
      'pitchey',
      username,
      password,
      { touchID: true, biometry: 'TouchID' }
    );
  }
};

const authenticateWithBiometric = async () => {
  try {
    const credentials = await Keychain.getInternetCredentials('pitchey');
    if (credentials) {
      return await apiClient.login({
        email: credentials.username,
        password: credentials.password,
        deviceInfo
      });
    }
  } catch (error) {
    console.error('Biometric authentication failed:', error);
  }
};
```

---

## Push Notifications

### 1. Web Push (PWA)

```typescript
// Register for push notifications
const registration = await navigator.serviceWorker.register('/sw-mobile.js');
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: vapidPublicKey
});

// Subscribe on server
await apiClient.subscribeToPushNotifications(subscription);
```

### 2. React Native Push

```typescript
import messaging from '@react-native-firebase/messaging';

// Request permission
const authStatus = await messaging().requestPermission();
const enabled =
  authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
  authStatus === messaging.AuthorizationStatus.PROVISIONAL;

if (enabled) {
  // Get FCM token
  const fcmToken = await messaging().getToken();
  
  // Update token on server
  await apiClient.updatePushToken(fcmToken);
}

// Handle foreground messages
messaging().onMessage(async remoteMessage => {
  console.log('Foreground message:', remoteMessage);
});

// Handle background messages
messaging().onNotificationOpenedApp(remoteMessage => {
  console.log('App opened from notification:', remoteMessage);
});
```

### 3. Notification Types

The platform supports various notification types:

- `PITCH_LIKE`: Someone liked your pitch
- `PITCH_COMMENT`: Someone commented on your pitch
- `NEW_FOLLOWER`: Someone followed you
- `INVESTMENT_INTEREST`: Investment interest in your pitch
- `NDA_SIGNED`: NDA was signed
- `NDA_REQUEST`: New NDA request
- `MESSAGE_RECEIVED`: New message received
- `SYSTEM_ANNOUNCEMENT`: System announcements

### 4. Notification Preferences

```typescript
// Update notification preferences
await apiClient.updateNotificationPreferences({
  'PITCH_LIKE': true,
  'PITCH_COMMENT': true,
  'NEW_FOLLOWER': false,
  'INVESTMENT_INTEREST': true,
  'NDA_SIGNED': true,
  'NDA_REQUEST': true,
  'MESSAGE_RECEIVED': true,
  'SYSTEM_ANNOUNCEMENT': false
});
```

---

## Mobile UI Components

### 1. Touch Gesture Support

```typescript
import { useSwipeNavigation, usePullToRefresh, useLongPress } from '@/hooks/useMobileGestures';

// Swipe navigation
const { bindGestures } = useSwipeNavigation(
  () => console.log('Swiped left'),
  () => console.log('Swiped right')
);

// Pull to refresh
const { bindGestures: bindRefresh } = usePullToRefresh(() => {
  console.log('Refreshing...');
});

// Long press
const { bindLongPress } = useLongPress((position) => {
  console.log('Long press at:', position);
});
```

### 2. Mobile-Optimized Components

#### MobilePitchCard
- Touch interactions with haptic feedback
- Swipe gestures for quick actions
- Long press context menus
- Optimized image loading
- Performance metrics display

#### Connection-Aware Loading
```typescript
import { useMobileCapabilities } from '@/hooks/useMobileGestures';

function ImageComponent({ src }) {
  const { isMobile } = useMobileCapabilities();
  const [connectionInfo, setConnectionInfo] = useState(null);
  
  useEffect(() => {
    if ('connection' in navigator) {
      setConnectionInfo(navigator.connection);
    }
  }, []);
  
  const optimizedSrc = useMemo(() => {
    if (!connectionInfo || !isMobile) return src;
    
    const params = new URLSearchParams();
    if (connectionInfo.effectiveType === '2g') {
      params.set('w', '300');
      params.set('q', '50');
    } else if (connectionInfo.effectiveType === '3g') {
      params.set('w', '600');
      params.set('q', '70');
    }
    
    return `${src}?${params.toString()}`;
  }, [src, connectionInfo, isMobile]);
  
  return <img src={optimizedSrc} />;
}
```

### 3. Responsive Design

```css
/* Mobile-first approach */
.pitch-card {
  width: 100%;
  margin: 0 16px;
}

/* Tablet */
@media (min-width: 768px) {
  .pitch-card {
    width: calc(50% - 32px);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .pitch-card {
    width: calc(33.333% - 32px);
  }
}

/* Safe area support for iOS */
.app-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Custom viewport height for mobile browsers */
.full-height {
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
}
```

---

## Testing Guidelines

### 1. PWA Testing

```bash
# Install dependencies
npm install --save-dev @playwright/test lighthouse

# Run PWA audit
lighthouse --chrome-flags="--headless" --output=json --output-path=./lighthouse-report.json https://your-app.com

# Test PWA installation
npx playwright test pwa-install.spec.ts
```

### 2. Mobile Web Testing

```typescript
// Test mobile gestures
import { test, expect } from '@playwright/test';

test('mobile swipe gesture', async ({ page }) => {
  await page.goto('/marketplace');
  
  const pitchCard = page.locator('[data-testid="pitch-card"]').first();
  
  // Simulate swipe left
  await pitchCard.hover();
  await page.mouse.down();
  await page.mouse.move(100, 0);
  await page.mouse.up();
  
  await expect(page.locator('[data-testid="like-feedback"]')).toBeVisible();
});

// Test pull-to-refresh
test('pull to refresh', async ({ page }) => {
  await page.goto('/dashboard');
  
  await page.touchscreen.tap(200, 100);
  await page.touchscreen.move(200, 200);
  
  await expect(page.locator('[data-testid="refresh-indicator"]')).toBeVisible();
});
```

### 3. React Native Testing

```typescript
// Component testing
import { render, fireEvent } from '@testing-library/react-native';
import { PitchCard } from '@pitchey/mobile-kit';

test('pitch card interactions', () => {
  const onPress = jest.fn();
  const onLike = jest.fn();
  
  const { getByTestId } = render(
    <PitchCard pitch={mockPitch} onPress={onPress} onLike={onLike} />
  );
  
  fireEvent.press(getByTestId('pitch-card'));
  expect(onPress).toHaveBeenCalledWith(mockPitch);
  
  fireEvent.press(getByTestId('like-button'));
  expect(onLike).toHaveBeenCalledWith(mockPitch.id);
});

// API testing
import { PitcheyApiClient } from '@pitchey/mobile-kit';

test('api client authentication', async () => {
  const apiClient = new PitcheyApiClient({
    apiBaseUrl: 'http://localhost:8001'
  });
  
  const response = await apiClient.login({
    email: 'test@example.com',
    password: 'password',
    deviceInfo: mockDeviceInfo
  });
  
  expect(response.accessToken).toBeDefined();
  expect(response.user.email).toBe('test@example.com');
});
```

### 4. Performance Testing

```typescript
// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);

// React Native performance
import { Performance } from 'react-native-performance';

const perfMonitor = Performance.createMonitor();
perfMonitor.markStart('screen_load');

// ... screen loading logic

perfMonitor.markEnd('screen_load');
const duration = perfMonitor.getDuration('screen_load');
console.log('Screen load time:', duration);
```

---

## Performance Optimization

### 1. Image Optimization

```typescript
// Connection-aware image loading
const getOptimizedImageUrl = (url: string, connectionInfo: any) => {
  const params = new URLSearchParams();
  
  if (connectionInfo?.effectiveType === '2g') {
    params.set('w', '400');
    params.set('q', '60');
    params.set('f', 'webp');
  } else if (connectionInfo?.effectiveType === '3g') {
    params.set('w', '600');
    params.set('q', '75');
    params.set('f', 'webp');
  } else {
    params.set('w', '800');
    params.set('q', '85');
    params.set('f', 'webp');
  }
  
  return `${url}?${params.toString()}`;
};

// Progressive image loading
const ProgressiveImage = ({ src, placeholder, alt }) => {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className="relative">
      {!loaded && (
        <img
          src={placeholder}
          alt={alt}
          className="absolute inset-0 blur-sm"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
```

### 2. Code Splitting

```typescript
// Route-based code splitting
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Profile = lazy(() => import('./pages/Profile'));

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

// Component-based code splitting
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function MyComponent() {
  const [showHeavy, setShowHeavy] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowHeavy(true)}>
        Load Heavy Component
      </button>
      
      {showHeavy && (
        <Suspense fallback={<div>Loading...</div>}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  );
}
```

### 3. Caching Strategies

```typescript
// Service Worker caching
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/pitches/trending')) {
    event.respondWith(
      caches.open('trending-cache').then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          
          return response || fetchPromise;
        });
      })
    );
  }
});

// React Query caching
import { useQuery } from '@tanstack/react-query';

const useTrendingPitches = (page: number) => {
  return useQuery({
    queryKey: ['pitches', 'trending', page],
    queryFn: () => apiClient.getTrendingPitches(page),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    keepPreviousData: true
  });
};
```

### 4. Bundle Optimization

```javascript
// Webpack bundle analysis
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    })
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5
        }
      }
    }
  }
};
```

---

## Deployment

### 1. PWA Deployment

```bash
# Build production PWA
npm run build:prod

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=pitchey-pwa

# Verify PWA features
lighthouse --chrome-flags="--headless" --only-categories=pwa https://pitchey.com
```

### 2. React Native Deployment

```bash
# iOS deployment
cd ios && pod install && cd ..
npx react-native run-ios --configuration Release

# Android deployment
npx react-native run-android --variant=release

# Build for app stores
# iOS
xcodebuild -workspace ios/Pitchey.xcworkspace -scheme Pitchey -configuration Release archive

# Android
cd android && ./gradlew assembleRelease
```

### 3. Environment Configuration

```typescript
// environment.ts
export const config = {
  development: {
    apiBaseUrl: 'http://localhost:8001',
    enableLogging: true,
    enableServiceWorker: false
  },
  staging: {
    apiBaseUrl: 'https://pitchey-staging.com',
    enableLogging: true,
    enableServiceWorker: true
  },
  production: {
    apiBaseUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
    enableLogging: false,
    enableServiceWorker: true
  }
};

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return config[env];
};
```

### 4. CI/CD Pipeline

```yaml
# .github/workflows/mobile-deploy.yml
name: Mobile Deploy

on:
  push:
    branches: [main]
    paths: ['mobile-kit/**', 'frontend/**']

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd mobile-kit && npm ci
      
      - name: Run tests
        run: |
          npm test
          cd mobile-kit && npm test
      
      - name: Build PWA
        run: |
          cd frontend
          npm run build:prod
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: pitchey-pwa
          directory: frontend/dist
      
      - name: Publish mobile kit
        run: |
          cd mobile-kit
          npm version patch
          npm publish
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Additional Resources

### 1. Documentation Links
- [PWA Developer Guide](https://web.dev/progressive-web-apps/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Web Push Protocol](https://tools.ietf.org/html/rfc8030)
- [Service Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

### 2. Tools & Libraries
- [Workbox](https://developers.google.com/web/tools/workbox) - PWA libraries
- [React Native Elements](https://react-native-elements.github.io/react-native-elements/) - UI toolkit
- [React Navigation](https://reactnavigation.org/) - Navigation library
- [Flipper](https://fbflipper.com/) - Debugging platform

### 3. Testing Tools
- [Playwright](https://playwright.dev/) - End-to-end testing
- [Jest](https://jestjs.io/) - JavaScript testing framework
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/) - Testing utilities
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Performance audits

### 4. Performance Monitoring
- [Web Vitals](https://web.dev/vitals/) - Core web vitals
- [React Native Performance](https://reactnative.dev/docs/performance) - Performance optimization
- [Flipper Performance](https://fbflipper.com/docs/features/performance-plugin) - Performance monitoring

---

This guide provides a comprehensive foundation for mobile development on the Pitchey platform. For specific implementation details, refer to the code examples and component documentation in the respective directories.