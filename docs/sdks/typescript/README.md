# Pitchey TypeScript/JavaScript SDK

Official TypeScript/JavaScript SDK for the Pitchey API - the comprehensive movie pitch platform.

[![npm version](https://badge.fury.io/js/@pitchey/sdk.svg)](https://badge.fury.io/js/@pitchey/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✅ **Full TypeScript support** with comprehensive type definitions
- 🔐 **Multi-portal authentication** (Creator, Investor, Production Company)
- 🎬 **Complete pitch management** (CRUD, search, filtering)
- 💬 **Real-time messaging** and notifications
- 📄 **NDA workflows** and document management
- 💰 **Investment tracking** and portfolio management
- 📊 **Analytics** and user behavior tracking
- 🔍 **Advanced search** with multiple filters
- 📁 **Media uploads** with type validation
- ⚡ **Automatic retries** and error handling
- 🌐 **Cross-platform** (Node.js, Browser, React Native)

## Installation

```bash
npm install @pitchey/sdk
```

```bash
yarn add @pitchey/sdk
```

```bash
pnpm add @pitchey/sdk
```

## Quick Start

### Basic Usage

```typescript
import { PitcheySDK } from '@pitchey/sdk';

// Initialize the SDK
const pitchey = new PitcheySDK({
  apiUrl: 'https://pitchey-production.cavelltheleaddev.workers.dev',
  debug: true
});

// Authenticate
const auth = await pitchey.auth.login({
  email: 'user@example.com',
  password: 'password123'
});

console.log('Logged in as:', auth.user.username);

// Get public pitches
const pitches = await pitchey.pitches.getPublic({
  limit: 10,
  genre: 'sci-fi'
});

console.log(`Found ${pitches.meta.total} sci-fi pitches`);
```

### Using Factory Methods

```typescript
import { PitcheySDK } from '@pitchey/sdk';

// Production environment
const pitchey = PitcheySDK.production('your-api-key');

// Development environment
const pitcheyDev = PitcheySDK.development('your-api-key');

// Demo account (automatically authenticated)
const pitcheyDemo = await PitcheySDK.demo('creator');

// Public access (no authentication)
const pitcheyPublic = PitcheySDK.public();
```

### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>Pitchey SDK Example</title>
</head>
<body>
    <script type="module">
        import { PitcheySDK } from 'https://cdn.skypack.dev/@pitchey/sdk';
        
        const pitchey = PitcheySDK.public();
        const pitches = await pitchey.pitches.getPublic({ limit: 5 });
        
        console.log('Latest pitches:', pitches.data);
    </script>
</body>
</html>
```

## Authentication

### Portal-Specific Login

```typescript
// Creator portal
const creatorAuth = await pitchey.auth.creatorLogin({
  email: 'creator@example.com',
  password: 'password123'
});

// Investor portal
const investorAuth = await pitchey.auth.investorLogin({
  email: 'investor@example.com',
  password: 'password123'
});

// Production company portal
const productionAuth = await pitchey.auth.productionLogin({
  email: 'production@example.com',
  password: 'password123'
});
```

### Demo Accounts

```typescript
// Quick demo login
await pitchey.auth.loginDemoCreator();
await pitchey.auth.loginDemoInvestor();
await pitchey.auth.loginDemoProduction();

// Get demo account information
const demoAccounts = pitchey.auth.getDemoAccounts();
console.log('Available demo accounts:', demoAccounts);
```

### Registration

```typescript
const registration = await pitchey.auth.register({
  email: 'newuser@example.com',
  username: 'newfilmmaker',
  password: 'securePassword123',
  userType: 'creator',
  firstName: 'Jane',
  lastName: 'Smith',
  companyName: 'Smith Productions'
});

console.log('Registered successfully:', registration.user);
```

## Pitch Management

### Creating Pitches

```typescript
const newPitch = await pitchey.pitches.create({
  title: 'The Last Star',
  logline: 'A space exploration thriller about humanity\'s last chance',
  genre: 'Sci-Fi Thriller',
  format: 'feature',
  shortSynopsis: 'When Earth becomes uninhabitable...',
  targetAudience: 'Adults 25-54, sci-fi enthusiasts',
  budgetRange: '5M-20M',
  seekingInvestment: true,
  visibility: 'public'
});

console.log('Pitch created:', newPitch.pitch.id);
```

### Searching Pitches

```typescript
// Basic search
const searchResults = await pitchey.pitches.search({
  q: 'space thriller',
  genre: 'sci-fi',
  format: 'feature',
  page: 1,
  limit: 20
});

// Advanced search with multiple filters
const advancedResults = await pitchey.search.advanced({
  query: 'thriller',
  genres: ['thriller', 'action'],
  budgetRanges: ['1M-5M', '5M-20M'],
  seekingInvestment: true,
  sort: 'relevance'
});

console.log('Search results:', advancedResults.pitches);
```

### Updating Pitches

```typescript
const updatedPitch = await pitchey.pitches.update(123, {
  title: 'The Last Star: Updated',
  shortSynopsis: 'An updated synopsis...',
  budgetRange: '10M-30M'
});

console.log('Pitch updated:', updatedPitch.pitch.title);
```

## User Management

### Profile Management

```typescript
// Get current user profile
const profile = await pitchey.users.getProfile();
console.log('Current user:', profile);

// Update profile
const updatedProfile = await pitchey.users.updateProfile({
  bio: 'Independent filmmaker with 10 years of experience',
  location: 'Los Angeles, CA',
  website: 'https://myfilmcompany.com'
});

// Get and update preferences
const preferences = await pitchey.users.getPreferences();
await pitchey.users.updatePreferences({
  email_notifications: true,
  preferred_genres: ['action', 'thriller', 'sci-fi'],
  notification_frequency: 'daily'
});
```

### Following Users

```typescript
// Follow a user
await pitchey.users.follow(456);

// Get followers and following
const followers = await pitchey.users.getFollowers();
const following = await pitchey.users.getFollowing();

console.log(`${followers.meta.total} followers, following ${following.meta.total}`);
```

## Messaging

### Conversations

```typescript
// Get conversations
const conversations = await pitchey.messages.getConversations({
  page: 1,
  limit: 20
});

// Send a message
const sentMessage = await pitchey.messages.send({
  receiverId: 456,
  subject: 'Interest in your project',
  content: 'Hi, I\'m interested in learning more about your project...',
  pitchId: 123 // Optional pitch reference
});

// Mark message as read
await pitchey.messages.markAsRead(sentMessage.messageData.id);
```

## NDA Management

### Requesting NDA Access

```typescript
// Request NDA access to a pitch
const ndaRequest = await pitchey.ndas.request({
  pitchId: 123,
  message: 'I\'m interested in learning more about this project'
});

// Get signed NDAs
const signedNDAs = await pitchey.ndas.getSigned();

// Approve/reject NDA requests (pitch owner only)
await pitchey.ndas.approve(ndaRequest.nda.id);
await pitchey.ndas.reject(ndaRequest.nda.id, 'Not suitable for current portfolio');
```

## Investment Tracking

### Managing Investments

```typescript
// Track a new investment
const investment = await pitchey.investments.track({
  pitchId: 123,
  amount: 500000,
  notes: 'Promising sci-fi project with strong team'
});

// Get investment portfolio
const portfolio = await pitchey.investments.list();
console.log(`Total portfolio value: $${portfolio.totalValue.toLocaleString()}`);
console.log(`Total gain: $${portfolio.totalGain.toLocaleString()}`);
```

## Media Uploads

### File Uploads

```typescript
// Upload a poster image
const fileInput = document.getElementById('posterFile') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file) {
  const upload = await pitchey.media.upload({
    file: file,
    type: 'poster',
    pitchId: 123
  });
  
  console.log('File uploaded:', upload.file.url);
}

// In Node.js
import fs from 'fs';

const fileBuffer = fs.readFileSync('./movie-poster.jpg');
const blob = new Blob([fileBuffer], { type: 'image/jpeg' });

const upload = await pitchey.media.upload({
  file: blob,
  type: 'poster',
  pitchId: 123
});
```

## Notifications

### Managing Notifications

```typescript
// Get notifications
const notifications = await pitchey.notifications.list({
  page: 1,
  limit: 20,
  read: false // Only unread notifications
});

console.log(`${notifications.unreadCount} unread notifications`);

// Mark notification as read
await pitchey.notifications.markAsRead(notifications.data[0].id);
```

## Watchlist

### Managing Watchlist

```typescript
// Get watchlist
const watchlist = await pitchey.watchlist.list();

// Add to watchlist
await pitchey.watchlist.add(123);

// Remove from watchlist
await pitchey.watchlist.remove(123);
```

## Analytics

### Event Tracking

```typescript
// Track user events
await pitchey.analytics.track({
  eventType: 'pitch_view',
  pitchId: 123,
  eventData: {
    duration: 180,
    scrollDepth: 85
  }
});

await pitchey.analytics.track({
  eventType: 'search',
  eventData: {
    query: 'sci-fi thriller',
    resultsCount: 25
  }
});
```

## Error Handling

The SDK provides comprehensive error handling with specific error types:

```typescript
import { 
  PitcheyAPIError,
  PitcheyValidationError,
  PitcheyAuthenticationError,
  PitcheyNotFoundError,
  PitcheyRateLimitError
} from '@pitchey/sdk';

try {
  const pitch = await pitchey.pitches.get(999);
} catch (error) {
  if (error instanceof PitcheyNotFoundError) {
    console.log('Pitch not found');
  } else if (error instanceof PitcheyAuthenticationError) {
    console.log('Please log in');
    // Redirect to login
  } else if (error instanceof PitcheyValidationError) {
    console.log('Validation errors:', error.validation_errors);
  } else if (error instanceof PitcheyRateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error instanceof PitcheyAPIError) {
    console.log(`API error: ${error.message} (${error.status})`);
  }
}
```

## Configuration Options

```typescript
const pitchey = new PitcheySDK({
  // API base URL
  apiUrl: 'https://pitchey-production.cavelltheleaddev.workers.dev',
  
  // API key for authentication
  apiKey: 'your-api-key',
  
  // Request timeout in milliseconds
  timeout: 30000,
  
  // Number of retry attempts for failed requests
  retries: 3,
  
  // Delay between retries in milliseconds
  retryDelay: 1000,
  
  // Enable debug logging
  debug: false,
  
  // Custom user agent
  userAgent: 'MyApp/1.0.0'
});
```

## TypeScript Support

The SDK is written in TypeScript and provides comprehensive type definitions:

```typescript
import { 
  Pitch,
  User,
  CreatePitchData,
  PitchFilters,
  SearchResults,
  PaginatedResponse
} from '@pitchey/sdk';

// All API responses are fully typed
const pitches: PaginatedResponse<Pitch> = await pitchey.pitches.getPublic();
const user: User = await pitchey.users.getProfile();

// Input data is validated at compile time
const pitchData: CreatePitchData = {
  title: 'My Movie',
  logline: 'An exciting story...',
  genre: 'Action',
  format: 'feature' // TypeScript ensures valid enum values
};
```

## React Integration

```typescript
import React, { useEffect, useState } from 'react';
import { PitcheySDK, Pitch } from '@pitchey/sdk';

function PitchList() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadPitches() {
      try {
        const pitchey = PitcheySDK.public();
        const result = await pitchey.pitches.getPublic({ limit: 10 });
        setPitches(result.data);
      } catch (error) {
        console.error('Failed to load pitches:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPitches();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {pitches.map(pitch => (
        <div key={pitch.id}>
          <h3>{pitch.title}</h3>
          <p>{pitch.logline}</p>
        </div>
      ))}
    </div>
  );
}
```

## Node.js Server Example

```typescript
import express from 'express';
import { PitcheySDK } from '@pitchey/sdk';

const app = express();
app.use(express.json());

const pitchey = PitcheySDK.production();

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const auth = await pitchey.auth.login({ email, password });
    res.json({ success: true, user: auth.user });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

app.get('/api/pitches', async (req, res) => {
  try {
    const pitches = await pitchey.pitches.getPublic({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    });
    res.json(pitches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Testing

The SDK includes comprehensive test coverage:

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm test`
6. Commit your changes: `git commit -am 'Add new feature'`
7. Push to the branch: `git push origin feature-name`
8. Submit a pull request

## Support

- 📖 [API Documentation](https://pitchey.com/developers)
- 💬 [Discord Community](https://discord.gg/pitchey-developers)
- 📧 Email: [developers@pitchey.com](mailto:developers@pitchey.com)
- 🐛 [Issue Tracker](https://github.com/pitchey/sdk-typescript/issues)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- Full TypeScript support
- Complete API coverage
- Comprehensive error handling
- Browser and Node.js support
- Demo account integration