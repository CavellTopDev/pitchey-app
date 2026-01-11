# Pitchey Mobile Development Kit

A comprehensive React Native and mobile web development kit for the Pitchey movie pitch platform.

## Features

- ✅ **Type-safe API Client** - Full TypeScript support with auto-completion
- ✅ **Cross-platform Components** - React Native components that work on iOS and Android
- ✅ **Mobile Optimizations** - Connection-aware loading, image optimization, and caching
- ✅ **Authentication & Security** - Device management, biometric auth, and secure token storage
- ✅ **Push Notifications** - FCM integration with customizable notification types
- ✅ **Offline Support** - Intelligent caching and offline-first strategies
- ✅ **Performance Monitoring** - Built-in performance tracking and optimization

## Quick Start

### Installation

```bash
npm install @pitchey/mobile-kit
```

### Basic Setup

```typescript
import { createPitcheyApiClient } from '@pitchey/mobile-kit';

// Initialize API client
const apiClient = createPitcheyApiClient({
  apiBaseUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  enableMobileOptimizations: true,
  enableOfflineMode: true
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

console.log('Logged in:', response.user);
```

## API Client

### Authentication

```typescript
// Login with device registration
const loginResponse = await apiClient.login({
  email: 'user@example.com',
  password: 'password',
  deviceInfo: {
    id: await DeviceInfo.getUniqueId(),
    name: await DeviceInfo.getDeviceName(),
    platform: Platform.OS,
    version: Platform.Version,
    model: await DeviceInfo.getModel()
  },
  rememberDevice: true
});

// Store tokens securely
apiClient.setTokens(loginResponse.accessToken, loginResponse.refreshToken);

// Automatic token refresh
const newTokens = await apiClient.refreshTokens();
```

### Fetching Data

```typescript
// Get trending pitches with pagination
const pitches = await apiClient.getTrendingPitches(1, 20, {
  genre: 'Action',
  format: 'Feature Film'
});

// Get pitch details
const pitch = await apiClient.getPitchById(123);

// Search pitches
const searchResults = await apiClient.searchPitches({
  query: 'space adventure',
  page: 1,
  limit: 20,
  filters: {
    genre: 'Sci-Fi',
    budget_min: 1000000
  }
});

// Get user dashboard
const dashboard = await apiClient.getDashboard();
```

### Push Notifications

```typescript
// Subscribe to push notifications
const { vapidPublicKey } = await apiClient.subscribeToPushNotifications({
  endpoint: 'https://fcm.googleapis.com/...',
  keys: {
    p256dh: 'public-key',
    auth: 'auth-key'
  }
});

// Update notification preferences
await apiClient.updateNotificationPreferences({
  'PITCH_LIKE': true,
  'NEW_FOLLOWER': true,
  'INVESTMENT_INTEREST': true,
  'MESSAGE_RECEIVED': false
});

// Test push notification
await apiClient.testPushNotification();
```

## React Native Components

### PitchCard Component

A mobile-optimized pitch card with touch interactions and performance optimizations.

```typescript
import { PitchCard } from '@pitchey/mobile-kit';

function PitchList({ pitches }) {
  return (
    <FlatList
      data={pitches}
      renderItem={({ item }) => (
        <PitchCard
          pitch={item}
          onPress={(pitch) => navigation.navigate('PitchDetail', { pitchId: pitch.id })}
          onLike={(pitchId) => handleLike(pitchId)}
          onSave={(pitchId) => handleSave(pitchId)}
          optimizeForConnection={true}
        />
      )}
      keyExtractor={(item) => item.id.toString()}
    />
  );
}
```

### MobileAuthForm Component

Complete authentication form with biometric support and device registration.

```typescript
import { MobileAuthForm } from '@pitchey/mobile-kit';

function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (credentials) => {
    setLoading(true);
    try {
      const response = await apiClient.login(credentials);
      // Handle successful login
      navigation.navigate('Dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    // Implement biometric authentication
    const credentials = await getBiometricCredentials();
    if (credentials) {
      await handleLogin(credentials);
    }
  };

  return (
    <MobileAuthForm
      onLogin={handleLogin}
      onBiometricLogin={handleBiometricLogin}
      loading={loading}
      error={error}
      biometricEnabled={true}
    />
  );
}
```

## TypeScript Types

The kit includes comprehensive TypeScript definitions for all API responses and data structures.

### Key Types

```typescript
import {
  User,
  Pitch,
  PitchDetail,
  ApiResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  DeviceInfo,
  NotificationPayload
} from '@pitchey/mobile-kit';

// User interface
interface User {
  id: number;
  email: string;
  display_name: string;
  user_type: 'creator' | 'investor' | 'production';
  profile_image_url?: string;
  verified?: boolean;
}

// Pitch interface
interface Pitch {
  id: number;
  title: string;
  description: string;
  genre: string;
  format: string;
  status: 'draft' | 'published' | 'archived';
  view_count: number;
  like_count: number;
  creator_name: string;
  created_at: string;
}

// API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
```

## Configuration

### Environment Setup

```typescript
import { ApiClientConfigs } from '@pitchey/mobile-kit';

// Use pre-configured environments
const apiClient = createPitcheyApiClient(ApiClientConfigs.production);

// Or customize configuration
const apiClient = createPitcheyApiClient({
  apiBaseUrl: 'https://your-api.com',
  timeout: 15000,
  retries: 3,
  enableOfflineMode: true,
  enableMobileOptimizations: true,
  cache: {
    maxSize: 100,
    ttl: 300000, // 5 minutes
    strategies: {
      images: 'stale-while-revalidate',
      api: 'network-first',
      static: 'cache-first'
    }
  }
});
```

### Connection Awareness

```typescript
import NetInfo from '@react-native-community/netinfo';

// Monitor connection and update API client
NetInfo.addEventListener((state) => {
  apiClient.setConnectionInfo({
    isConnected: state.isConnected,
    type: state.type,
    effectiveType: state.details?.effectiveType
  });
});
```

## Examples

### Complete Login Flow

```typescript
import React, { useState } from 'react';
import { Alert } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { MobileAuthForm, createPitcheyApiClient } from '@pitchey/mobile-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiClient = createPitcheyApiClient({
  apiBaseUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev'
});

function LoginScreen({ navigation }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (credentials) => {
    setLoading(true);
    
    try {
      // Add device information
      const deviceInfo = {
        id: await DeviceInfo.getUniqueId(),
        name: await DeviceInfo.getDeviceName(),
        platform: Platform.OS,
        version: Platform.Version,
        model: await DeviceInfo.getModel()
      };

      const response = await apiClient.login({
        ...credentials,
        deviceInfo
      });

      // Store authentication data
      await AsyncStorage.multiSet([
        ['accessToken', response.accessToken],
        ['refreshToken', response.refreshToken],
        ['deviceId', response.deviceId],
        ['user', JSON.stringify(response.user)]
      ]);

      // Update API client
      apiClient.setTokens(response.accessToken, response.refreshToken);
      apiClient.setDeviceId(response.deviceId);

      // Navigate to main app
      navigation.replace('MainTabs');

    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileAuthForm
      onLogin={handleLogin}
      loading={loading}
    />
  );
}
```

### Pitch List with Infinite Scroll

```typescript
import React, { useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { PitchCard } from '@pitchey/mobile-kit';

function PitchListScreen() {
  const [pitches, setPitches] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadPitches = useCallback(async (pageNum = 1, refresh = false) => {
    if (loading && !refresh) return;
    
    setLoading(true);
    
    try {
      const response = await apiClient.getTrendingPitches(pageNum, 20);
      
      if (refresh) {
        setPitches(response.data);
      } else {
        setPitches(prev => [...prev, ...response.data]);
      }
      
      setHasMore(response.pagination.hasNext);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Failed to load pitches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPitches(1, true);
  }, [loadPitches]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadPitches(page + 1);
    }
  }, [hasMore, loading, page, loadPitches]);

  const handlePitchPress = (pitch) => {
    navigation.navigate('PitchDetail', { pitchId: pitch.id });
  };

  React.useEffect(() => {
    loadPitches();
  }, []);

  return (
    <FlatList
      data={pitches}
      renderItem={({ item }) => (
        <PitchCard
          pitch={item}
          onPress={handlePitchPress}
          onLike={(pitchId) => console.log('Liked:', pitchId)}
          onSave={(pitchId) => console.log('Saved:', pitchId)}
        />
      )}
      keyExtractor={(item) => item.id.toString()}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.1}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }
      contentContainerStyle={{ padding: 16 }}
    />
  );
}
```

## Performance Tips

1. **Enable Connection Awareness**: Let the API client optimize requests based on network conditions
2. **Use Image Optimization**: Images are automatically optimized based on device capabilities
3. **Implement Caching**: Leverage built-in caching for offline support
4. **Monitor Bundle Size**: Use only the components and functions you need
5. **Lazy Load Heavy Components**: Use React.lazy() for components not immediately needed

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/pitchey/mobile-kit/issues)
- Documentation: [Mobile Development Guide](../docs/MOBILE_DEVELOPMENT_GUIDE.md)
- API Reference: [API Documentation](../docs/API_DOCUMENTATION.md)