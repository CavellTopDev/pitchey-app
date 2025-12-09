# Pitchey Platform - Testing Framework Documentation
**Version**: 1.0
**Date**: December 7, 2024
**Enhanced with Context7 Testing Patterns**

## Table of Contents
1. [Testing Architecture](#testing-architecture)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing with Playwright](#end-to-end-testing-with-playwright)
5. [API Testing](#api-testing)
6. [WebSocket Testing](#websocket-testing)
7. [Performance Testing](#performance-testing)
8. [Test Data Management](#test-data-management)
9. [CI/CD Integration](#cicd-integration)

---

## Testing Architecture

### Test Pyramid Strategy
```
         E2E Tests (10%)
        /            \
       /              \
      Integration (30%) \
     /                  \
    /                    \
   Unit Tests (60%)       \
```

### Browser Console Test Configuration
```javascript
// Run these commands directly in browser console at https://pitchey.pages.dev
const testConfig = {
  production: {
    apiUrl: 'https://pitchey-production.cavelltheleaddev.workers.dev',
    wsUrl: 'wss://pitchey-production.cavelltheleaddev.workers.dev',
    frontendUrl: 'https://pitchey.pages.dev'
  }
};

// Helper functions for browser testing
const api = testConfig.production.apiUrl;

// Test helper to make authenticated requests
const authFetch = (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  return fetch(`${api}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers
    }
  });
};
```

---

## Unit Testing

### Component Testing with Vitest
```typescript
// frontend/src/components/PitchCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PitchCard } from './PitchCard';
import { BrowserRouter } from 'react-router-dom';

describe('PitchCard', () => {
  const mockPitch = {
    id: 1,
    title: 'Test Pitch',
    logline: 'A compelling story',
    genre: 'drama',
    viewCount: 150,
    creatorName: 'John Doe',
    createdAt: new Date().toISOString(),
  };
  
  it('should render pitch details', () => {
    render(
      <BrowserRouter>
        <PitchCard pitch={mockPitch} />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Test Pitch')).toBeInTheDocument();
    expect(screen.getByText('A compelling story')).toBeInTheDocument();
    expect(screen.getByText('150 views')).toBeInTheDocument();
  });
  
  it('should call onClick handler when clicked', () => {
    const handleClick = vi.fn();
    
    render(
      <BrowserRouter>
        <PitchCard pitch={mockPitch} onClick={handleClick} />
      </BrowserRouter>
    );
    
    fireEvent.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledWith(mockPitch);
  });
  
  it('should show trending badge for high view count', () => {
    const trendingPitch = { ...mockPitch, viewCount: 1000 };
    
    render(
      <BrowserRouter>
        <PitchCard pitch={trendingPitch} />
      </BrowserRouter>
    );
    
    expect(screen.getByText('🔥 Trending')).toBeInTheDocument();
  });
});
```

### Service Testing
```typescript
// src/services/pitch.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PitchService } from './pitch.service';
import { db } from '../db';

vi.mock('../db');

describe('PitchService', () => {
  let pitchService: PitchService;
  
  beforeEach(() => {
    pitchService = new PitchService(db);
    vi.clearAllMocks();
  });
  
  describe('createPitch', () => {
    it('should create a pitch with valid data', async () => {
      const pitchData = {
        title: 'New Pitch',
        logline: 'An amazing story',
        genre: 'thriller',
        creatorId: 1,
      };
      
      const expectedPitch = { id: 1, ...pitchData, status: 'draft' };
      vi.mocked(db.insert).mockResolvedValue([expectedPitch]);
      
      const result = await pitchService.createPitch(pitchData);
      
      expect(result).toEqual(expectedPitch);
      expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
        ...pitchData,
        status: 'draft',
      }));
    });
    
    it('should validate required fields', async () => {
      const invalidData = { title: '' };
      
      await expect(pitchService.createPitch(invalidData))
        .rejects.toThrow('Title is required');
    });
  });
  
  describe('getTrendingPitches', () => {
    it('should return pitches with high view counts', async () => {
      const trendingPitches = [
        { id: 1, title: 'Trending 1', viewCount: 500 },
        { id: 2, title: 'Trending 2', viewCount: 300 },
      ];
      
      vi.mocked(db.select).mockResolvedValue(trendingPitches);
      
      const result = await pitchService.getTrendingPitches();
      
      expect(result).toEqual(trendingPitches);
      expect(db.select).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.stringContaining('view_count >= 100'),
          orderBy: 'view_count DESC',
        })
      );
    });
  });
});
```

---

## Integration Testing

### Database Integration Tests
```typescript
// tests/integration/database.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

describe('Database Integration', () => {
  let db: ReturnType<typeof drizzle>;
  let sql: ReturnType<typeof postgres>;
  
  beforeAll(async () => {
    // Use test database
    sql = postgres(process.env.TEST_DATABASE_URL!);
    db = drizzle(sql, { schema });
    
    // Run migrations
    await migrate(db, { migrationsFolder: './drizzle' });
  });
  
  afterAll(async () => {
    await sql.end();
  });
  
  beforeEach(async () => {
    // Clean database between tests
    await db.delete(schema.pitches);
    await db.delete(schema.users);
  });
  
  it('should create and retrieve a user with pitches', async () => {
    // Create user
    const [user] = await db
      .insert(schema.users)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        userType: 'creator',
      })
      .returning();
    
    // Create pitches
    await db.insert(schema.pitches).values([
      {
        title: 'Pitch 1',
        logline: 'First pitch',
        genre: 'drama',
        creatorId: user.id,
      },
      {
        title: 'Pitch 2',
        logline: 'Second pitch',
        genre: 'comedy',
        creatorId: user.id,
      },
    ]);
    
    // Query with relations
    const userWithPitches = await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
      with: {
        pitches: true,
      },
    });
    
    expect(userWithPitches).toBeDefined();
    expect(userWithPitches?.pitches).toHaveLength(2);
    expect(userWithPitches?.pitches[0].title).toBe('Pitch 1');
  });
  
  it('should enforce foreign key constraints', async () => {
    await expect(
      db.insert(schema.pitches).values({
        title: 'Orphan Pitch',
        logline: 'No creator',
        genre: 'horror',
        creatorId: 99999, // Non-existent user
      })
    ).rejects.toThrow('foreign key constraint');
  });
});
```

### API Integration Tests
```typescript
// tests/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Worker API Integration', () => {
  let worker: UnstableDevWorker;
  
  beforeAll(async () => {
    worker = await unstable_dev('src/worker-production-db.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });
  
  afterAll(async () => {
    await worker.stop();
  });
  
  it('should handle authentication flow', async () => {
    // Login
    const loginResponse = await worker.fetch('/api/auth/creator/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123',
      }),
    });
    
    const { token } = await loginResponse.json();
    expect(token).toBeDefined();
    
    // Use token for authenticated request
    const profileResponse = await worker.fetch('/api/user/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const profile = await profileResponse.json();
    expect(profile.email).toBe('alex.creator@demo.com');
  });
  
  it('should handle CORS preflight', async () => {
    const response = await worker.fetch('/api/pitches', {
      method: 'OPTIONS',
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods'))
      .toContain('GET');
  });
});
```

---

## End-to-End Testing with Playwright

### Playwright Configuration (Context7 Pattern)
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'https://pitchey.pages.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // No local dev server needed for production testing
  // Tests run directly against https://pitchey.pages.dev
});
```

### Page Object Model (Context7 Pattern)
```typescript
// e2e/pages/LoginPage.ts
import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly demoButton: Locator;
  private readonly errorMessage: Locator;
  
  constructor(public readonly page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Sign in' });
    this.demoButton = page.getByRole('button', { name: /Use Demo.*Account/ });
    this.errorMessage = page.getByRole('alert');
  }
  
  async goto(portal: 'creator' | 'investor' | 'production') {
    await this.page.goto(`/login/${portal}`);
  }
  
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
  
  async loginWithDemo() {
    await this.demoButton.click();
    await this.loginButton.click();
  }
  
  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}

// e2e/pages/DashboardPage.ts
export class DashboardPage {
  private readonly heading: Locator;
  private readonly statsCards: Locator;
  private readonly logoutButton: Locator;
  
  constructor(public readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.statsCards = page.getByTestId('stat-card');
    this.logoutButton = page.getByRole('button', { name: 'Sign Out' });
  }
  
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.heading).toBeVisible();
  }
  
  async getStats() {
    const cards = await this.statsCards.all();
    const stats: Record<string, string> = {};
    
    for (const card of cards) {
      const label = await card.getByTestId('stat-label').textContent();
      const value = await card.getByTestId('stat-value').textContent();
      if (label && value) {
        stats[label] = value;
      }
    }
    
    return stats;
  }
  
  async logout() {
    await this.logoutButton.click();
    await this.page.waitForURL('/');
  }
}
```

### E2E Test Fixtures (Context7 Pattern)
```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PitchCreatePage } from './pages/PitchCreatePage';

type TestFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  pitchCreatePage: PitchCreatePage;
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  
  pitchCreatePage: async ({ page }, use) => {
    await use(new PitchCreatePage(page));
  },
  
  authenticatedPage: async ({ page, loginPage }, use) => {
    // Setup: Login before test
    await loginPage.goto('creator');
    await loginPage.loginWithDemo();
    await page.waitForURL('/creator/dashboard');
    
    // Use authenticated page in test
    await use(page);
    
    // Teardown: Logout after test
    await page.getByRole('button', { name: 'Sign Out' }).click();
  },
});

export { expect } from '@playwright/test';
```

### E2E Test Scenarios
```typescript
// e2e/creator-workflow.spec.ts
import { test, expect } from './fixtures';

test.describe('Creator Workflow', () => {
  test('should complete full pitch creation flow', async ({
    loginPage,
    dashboardPage,
    pitchCreatePage,
  }) => {
    // Login
    await loginPage.goto('creator');
    await loginPage.loginWithDemo();
    
    // Verify dashboard
    await dashboardPage.waitForLoad();
    const stats = await dashboardPage.getStats();
    expect(stats['Total Pitches']).toBeDefined();
    
    // Create new pitch
    await pitchCreatePage.goto();
    await pitchCreatePage.fillBasicInfo({
      title: 'Test Pitch ' + Date.now(),
      logline: 'An automated test pitch',
      genre: 'drama',
    });
    
    await pitchCreatePage.fillSynopsis(
      'This is a comprehensive synopsis for testing purposes.'
    );
    
    await pitchCreatePage.addCharacter({
      name: 'John Doe',
      description: 'The protagonist',
    });
    
    await pitchCreatePage.saveDraft();
    await expect(page.getByText('Draft saved')).toBeVisible();
    
    // Publish pitch
    await pitchCreatePage.publish();
    await expect(page.getByText('Pitch published successfully')).toBeVisible();
  });
  
  test('should handle NDA workflow', async ({ authenticatedPage }) => {
    // Navigate to pitch
    await authenticatedPage.goto('/browse');
    await authenticatedPage.getByText('Test Pitch').first().click();
    
    // Request NDA access
    await authenticatedPage.getByRole('button', { name: 'Request NDA' }).click();
    await expect(authenticatedPage.getByText('NDA request sent')).toBeVisible();
    
    // Check NDA status
    await authenticatedPage.goto('/creator/nda-requests');
    await expect(
      authenticatedPage.getByText('Pending NDA Request')
    ).toBeVisible();
  });
});
```

### API Mocking in E2E Tests (Context7 Pattern)
```typescript
// e2e/with-mocking.spec.ts
import { test, expect } from '@playwright/test';

test('should handle API errors gracefully', async ({ page }) => {
  // Mock API failure
  await page.route('**/api/pitches', route => {
    route.fulfill({
      status: 500,
      json: { error: 'Internal Server Error' },
    });
  });
  
  await page.goto('/browse');
  
  // Verify error handling
  await expect(page.getByText('Failed to load pitches')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('should display mocked trending pitches', async ({ page }) => {
  // Mock trending pitches
  await page.route('**/api/pitches?sort=trending', route => {
    route.fulfill({
      status: 200,
      json: {
        success: true,
        data: [
          {
            id: 1,
            title: 'Mock Trending Pitch',
            viewCount: 10000,
            genre: 'thriller',
          },
        ],
      },
    });
  });
  
  await page.goto('/browse');
  await page.getByRole('tab', { name: 'Trending' }).click();
  
  await expect(page.getByText('Mock Trending Pitch')).toBeVisible();
  await expect(page.getByText('10,000 views')).toBeVisible();
});
```

---

## API Testing - Browser Console

### REST API Testing from Browser
```javascript
// Run these tests directly in browser console at https://pitchey.pages.dev
// First, login with demo account to get auth token

// Test 1: Login as Creator
(async () => {
  const response = await fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.creator@demo.com',
      password: 'Demo123'
    })
  });
  const data = await response.json();
  if (data.token) {
    localStorage.setItem('authToken', data.token);
    console.log('✅ Creator login successful', data);
  } else {
    console.error('❌ Login failed', data);
  }
  return data;
})();
  
// Test 2: Fetch Pitches
(async () => {
  const response = await fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/public?limit=5');
  const data = await response.json();
  console.log('📊 Public Pitches:', data);
  console.log(`✅ Found ${data.data?.length || 0} pitches`);
  return data;
})();

// Test 3: Get User Profile (Requires Auth)
(async () => {
  const token = localStorage.getItem('authToken');
  if (!token) {
    console.error('❌ No auth token. Please login first.');
    return;
  }
  
  const response = await fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/user/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log('👤 User Profile:', data);
  return data;
})();
  
// Test 4: View Specific Pitch
(async () => {
  const pitchId = 1;
  const response = await fetch(`https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/public/${pitchId}`);
  const data = await response.json();
  console.log(`🎬 Pitch #${pitchId}:`, data);
  return data;
})();

// Test 5: Test Dashboard Data (Requires Auth)
(async () => {
  const token = localStorage.getItem('authToken');
  const userType = localStorage.getItem('userType');
  
  if (!token || !userType) {
    console.error('❌ Please login first');
    return;
  }
  
  const response = await fetch(`https://pitchey-production.cavelltheleaddev.workers.dev/api/${userType}/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log(`📈 ${userType} Dashboard:`, data);
  return data;
})();
```

---

## Browser Console Testing Suite

### Complete Test Suite for Browser Console
```javascript
// Copy and paste this entire test suite into browser console at https://pitchey.pages.dev

// Test Suite Configuration
const testSuite = {
  api: 'https://pitchey-production.cavelltheleaddev.workers.dev',
  ws: 'wss://pitchey-production.cavelltheleaddev.workers.dev/ws',
  
  // Run all tests
  async runAll() {
    console.log('🚀 Starting Pitchey Test Suite...');
    console.log('=====================================');
    
    // Public tests (no auth required)
    await this.testPublicEndpoints();
    
    // Auth tests for each user type
    await this.testCreatorPortal();
    await this.testInvestorPortal();
    await this.testProductionPortal();
    
    console.log('=====================================');
    console.log('✅ Test Suite Complete!');
  },
  
  // Test public endpoints
  async testPublicEndpoints() {
    console.log('\n📋 Testing Public Endpoints...');
    
    // Test 1: Browse public pitches
    const pitches = await fetch(`${this.api}/api/pitches/public?limit=3`)
      .then(r => r.json());
    console.log(`  ✓ Public pitches: ${pitches.data?.length || 0} found`);
    
    // Test 2: View specific pitch
    if (pitches.data?.length > 0) {
      const pitch = await fetch(`${this.api}/api/pitches/public/${pitches.data[0].id}`)
        .then(r => r.json());
      console.log(`  ✓ Pitch detail: "${pitch.data?.title || 'Not found'}"`);
    }
    
    // Test 3: Search functionality
    const search = await fetch(`${this.api}/api/pitches/browse/general?search=the`)
      .then(r => r.json());
    console.log(`  ✓ Search results: ${search.data?.length || 0} matches`);
  },
  
  // Test Creator Portal
  async testCreatorPortal() {
    console.log('\n🎬 Testing Creator Portal...');
    
    // Login
    const login = await fetch(`${this.api}/api/auth/creator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex.creator@demo.com',
        password: 'Demo123'
      })
    }).then(r => r.json());
    
    if (login.token) {
      console.log('  ✓ Creator login successful');
      localStorage.setItem('authToken', login.token);
      
      // Test dashboard
      const dashboard = await fetch(`${this.api}/api/creator/dashboard`, {
        headers: { 'Authorization': `Bearer ${login.token}` }
      }).then(r => r.json());
      console.log(`  ✓ Dashboard: ${dashboard.stats?.totalPitches || 0} pitches`);
      
      // Test profile
      const profile = await fetch(`${this.api}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${login.token}` }
      }).then(r => r.json());
      console.log(`  ✓ Profile: ${profile.data?.name || 'Unknown'}`);
    } else {
      console.error('  ✗ Creator login failed');
    }
  },
  
  // Test Investor Portal
  async testInvestorPortal() {
    console.log('\n💰 Testing Investor Portal...');
    
    // Login
    const login = await fetch(`${this.api}/api/auth/investor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sarah.investor@demo.com',
        password: 'Demo123'
      })
    }).then(r => r.json());
    
    if (login.token) {
      console.log('  ✓ Investor login successful');
      
      // Test dashboard
      const dashboard = await fetch(`${this.api}/api/investor/dashboard`, {
        headers: { 'Authorization': `Bearer ${login.token}` }
      }).then(r => r.json());
      console.log(`  ✓ Dashboard: $${dashboard.stats?.totalInvested || 0} invested`);
      
      // Test portfolio
      const portfolio = await fetch(`${this.api}/api/investor/portfolio`, {
        headers: { 'Authorization': `Bearer ${login.token}` }
      }).then(r => r.json());
      console.log(`  ✓ Portfolio: ${portfolio.data?.length || 0} investments`);
    } else {
      console.error('  ✗ Investor login failed');
    }
  },
  
  // Test Production Portal
  async testProductionPortal() {
    console.log('\n🎥 Testing Production Portal...');
    
    // Login
    const login = await fetch(`${this.api}/api/auth/production/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stellar.production@demo.com',
        password: 'Demo123'
      })
    }).then(r => r.json());
    
    if (login.token) {
      console.log('  ✓ Production login successful');
      
      // Test dashboard
      const dashboard = await fetch(`${this.api}/api/production/dashboard`, {
        headers: { 'Authorization': `Bearer ${login.token}` }
      }).then(r => r.json());
      console.log(`  ✓ Dashboard: ${dashboard.stats?.activeProjects || 0} projects`);
      
      // Test following
      const following = await fetch(`${this.api}/api/follows/following`, {
        headers: { 'Authorization': `Bearer ${login.token}` }
      }).then(r => r.json());
      console.log(`  ✓ Following: ${following.data?.length || 0} creators`);
    } else {
      console.error('  ✗ Production login failed');
    }
  }
};

// Run the test suite
testSuite.runAll();
```

### Quick Individual Tests
```javascript
// Test 1: Check API Health
fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/health')
  .then(r => r.json())
  .then(data => console.log('API Health:', data))
  .catch(err => console.error('API Error:', err));

// Test 2: Get Trending Pitches
fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/browse/enhanced?tab=trending')
  .then(r => r.json())
  .then(data => console.log('Trending:', data.data?.length || 0, 'pitches'));

// Test 3: Check WebSocket Connection
const ws = new WebSocket('wss://pitchey-production.cavelltheleaddev.workers.dev/ws');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (err) => console.error('❌ WebSocket error:', err);
ws.onclose = () => console.log('WebSocket closed');

// Test 4: Verify Authentication
if (localStorage.getItem('authToken')) {
  fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/verify', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
  })
  .then(r => r.json())
  .then(data => console.log('Auth Status:', data.valid ? '✅ Valid' : '❌ Invalid'));
} else {
  console.log('No auth token found');
}
```

---

## WebSocket Testing

### WebSocket Browser Console Testing
```javascript
// Test WebSocket connection from browser console
const testWebSocket = () => {
  const ws = new WebSocket('wss://pitchey-production.cavelltheleaddev.workers.dev/ws');
  
  ws.onopen = () => {
    console.log('✅ WebSocket connected');
    
    // Send auth if token exists
    const token = localStorage.getItem('authToken');
    if (token) {
      ws.send(JSON.stringify({ type: 'auth', token }));
      console.log('📤 Auth token sent');
    }
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('📥 WebSocket message:', data);
  };
  
  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('🔌 WebSocket disconnected');
  };
  
  return ws;
};

// Run the test
const ws = testWebSocket();

// Send a test message after connection
setTimeout(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
    console.log('📤 Ping sent');
  }
}, 1000);
```

### Original WebSocket Test Utilities
```typescript
// tests/helpers/websocket-client.ts
export class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private messages: any[] = [];
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  
  async connect(url: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        if (token) {
          this.send({ type: 'auth', token });
        }
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.messages.push(data);
        
        const handler = this.messageHandlers.get(data.type);
        if (handler) {
          handler(data);
        }
      };
      
      this.ws.onerror = reject;
    });
  }
  
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
  
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }
  
  async waitForMessage(type: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message: ${type}`));
      }, timeout);
      
      this.onMessage(type, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }
  
  disconnect(): void {
    this.ws?.close();
  }
}

// tests/websocket.test.ts
describe('WebSocket Communication', () => {
  let client1: TestWebSocketClient;
  let client2: TestWebSocketClient;
  
  beforeEach(async () => {
    client1 = new TestWebSocketClient();
    client2 = new TestWebSocketClient();
    
    await client1.connect('wss://pitchey-production.cavelltheleaddev.workers.dev/ws', 'creator-token');
    await client2.connect('wss://pitchey-production.cavelltheleaddev.workers.dev/ws', 'investor-token');
  });
  
  afterEach(() => {
    client1.disconnect();
    client2.disconnect();
  });
  
  it('should broadcast notifications', async () => {
    // Set up listener
    const notificationPromise = client2.waitForMessage('notification');
    
    // Send notification
    client1.send({
      type: 'broadcast',
      target: 'investor-id',
      payload: {
        type: 'notification',
        message: 'New pitch available',
      },
    });
    
    // Verify receipt
    const notification = await notificationPromise;
    expect(notification.payload.message).toBe('New pitch available');
  });
  
  it('should update presence status', async () => {
    // Update presence
    client1.send({
      type: 'presence',
      status: 'away',
    });
    
    // Verify broadcast to other clients
    const update = await client2.waitForMessage('presence_update');
    expect(update.userId).toBeDefined();
    expect(update.status).toBe('away');
  });
});
```

---

## Performance Testing

### Load Testing with k6
```javascript
// tests/load/pitch-api.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],              // Error rate under 10%
  },
};

const BASE_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';

export default function () {
  // Browse pitches
  const browseRes = http.get(`${BASE_URL}/api/pitches?limit=12`);
  check(browseRes, {
    'browse status 200': (r) => r.status === 200,
    'browse has pitches': (r) => JSON.parse(r.body).data.length > 0,
  });
  errorRate.add(browseRes.status !== 200);
  
  sleep(1);
  
  // View specific pitch
  const pitchId = Math.floor(Math.random() * 100) + 1;
  const viewRes = http.get(`${BASE_URL}/api/pitches/${pitchId}`);
  check(viewRes, {
    'view status 200': (r) => r.status === 200,
    'view has title': (r) => JSON.parse(r.body).data?.title !== undefined,
  });
  errorRate.add(viewRes.status !== 200);
  
  sleep(1);
}

export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

### Performance Monitoring
```typescript
// src/middleware/performance.ts
export function performanceMiddleware() {
  return async (request: Request, next: () => Promise<Response>) => {
    const start = Date.now();
    const url = new URL(request.url);
    
    try {
      const response = await next();
      const duration = Date.now() - start;
      
      // Log to analytics
      await logPerformance({
        path: url.pathname,
        method: request.method,
        duration,
        status: response.status,
        timestamp: new Date().toISOString(),
      });
      
      // Add performance headers
      response.headers.set('X-Response-Time', `${duration}ms`);
      response.headers.set('Server-Timing', `total;dur=${duration}`);
      
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      
      await logPerformance({
        path: url.pathname,
        method: request.method,
        duration,
        status: 500,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  };
}
```

---

## Test Data Management

### Test Data Factories
```typescript
// tests/factories/index.ts
import { faker } from '@faker-js/faker';

export const factories = {
  user: (overrides = {}) => ({
    id: faker.number.int(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    userType: faker.helpers.arrayElement(['creator', 'investor', 'production']),
    verified: true,
    createdAt: faker.date.past(),
    ...overrides,
  }),
  
  pitch: (overrides = {}) => ({
    id: faker.number.int(),
    title: faker.company.catchPhrase(),
    logline: faker.lorem.paragraph(),
    genre: faker.helpers.arrayElement(['drama', 'comedy', 'thriller', 'sci-fi', 'horror']),
    status: 'published',
    viewCount: faker.number.int({ min: 0, max: 5000 }),
    creatorId: faker.number.int(),
    createdAt: faker.date.recent(),
    ...overrides,
  }),
  
  nda: (overrides = {}) => ({
    id: faker.number.int(),
    pitchId: faker.number.int(),
    requesterId: faker.number.int(),
    status: faker.helpers.arrayElement(['pending', 'approved', 'rejected']),
    requestedAt: faker.date.recent(),
    ...overrides,
  }),
  
  investment: (overrides = {}) => ({
    id: faker.number.int(),
    pitchId: faker.number.int(),
    investorId: faker.number.int(),
    amount: faker.number.int({ min: 10000, max: 1000000 }),
    status: 'active',
    investedAt: faker.date.recent(),
    ...overrides,
  }),
};

// Seed functions
export async function seedTestDatabase(db: any, config = {}) {
  const { userCount = 10, pitchCount = 50 } = config;
  
  // Create users
  const users = Array.from({ length: userCount }, () => factories.user());
  await db.insert(schema.users).values(users);
  
  // Create pitches
  const creators = users.filter(u => u.userType === 'creator');
  const pitches = Array.from({ length: pitchCount }, () => 
    factories.pitch({
      creatorId: faker.helpers.arrayElement(creators).id,
    })
  );
  await db.insert(schema.pitches).values(pitches);
  
  // Create NDAs
  const investors = users.filter(u => u.userType === 'investor');
  const ndas = pitches.slice(0, 20).map(pitch => 
    factories.nda({
      pitchId: pitch.id,
      requesterId: faker.helpers.arrayElement(investors).id,
    })
  );
  await db.insert(schema.ndaRequests).values(ndas);
  
  return { users, pitches, ndas };
}
```

### Database Snapshots
```typescript
// tests/helpers/db-snapshot.ts
export class DatabaseSnapshot {
  private snapshot: any = null;
  
  constructor(private db: any) {}
  
  async capture(): Promise<void> {
    this.snapshot = {
      users: await this.db.select().from(schema.users),
      pitches: await this.db.select().from(schema.pitches),
      ndaRequests: await this.db.select().from(schema.ndaRequests),
      investments: await this.db.select().from(schema.investments),
    };
  }
  
  async restore(): Promise<void> {
    if (!this.snapshot) {
      throw new Error('No snapshot to restore');
    }
    
    // Clear tables
    await this.db.delete(schema.investments);
    await this.db.delete(schema.ndaRequests);
    await this.db.delete(schema.pitches);
    await this.db.delete(schema.users);
    
    // Restore data
    if (this.snapshot.users.length > 0) {
      await this.db.insert(schema.users).values(this.snapshot.users);
    }
    if (this.snapshot.pitches.length > 0) {
      await this.db.insert(schema.pitches).values(this.snapshot.pitches);
    }
    if (this.snapshot.ndaRequests.length > 0) {
      await this.db.insert(schema.ndaRequests).values(this.snapshot.ndaRequests);
    }
    if (this.snapshot.investments.length > 0) {
      await this.db.insert(schema.investments).values(this.snapshot.investments);
    }
  }
}

// Usage in tests
describe('Complex Feature', () => {
  const snapshot = new DatabaseSnapshot(db);
  
  beforeAll(async () => {
    await seedTestDatabase(db);
    await snapshot.capture();
  });
  
  beforeEach(async () => {
    await snapshot.restore();
  });
  
  // Tests run with consistent data
});
```

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
  
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: pitchey_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/pitchey_test
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_DATABASE_URL: postgresql://postgres:test@localhost:5432/pitchey_test
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_ENV: staging
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
  
  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Run k6 tests
        uses: grafana/k6-action@v0.3.0
        with:
          filename: tests/load/pitch-api.js
        env:
          API_URL: ${{ secrets.STAGING_URL }}
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: k6-report
          path: summary.html
```

### Browser Console Test Commands
```javascript
// Quick command reference for browser console testing
// Run these at https://pitchey.pages.dev

// 1. Login Tests
const loginCreator = () => fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'alex.creator@demo.com', password: 'Demo123' })
}).then(r => r.json()).then(d => { if(d.token) localStorage.setItem('authToken', d.token); return d; });

const loginInvestor = () => fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/investor/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'sarah.investor@demo.com', password: 'Demo123' })
}).then(r => r.json()).then(d => { if(d.token) localStorage.setItem('authToken', d.token); return d; });

const loginProduction = () => fetch('https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/production/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'stellar.production@demo.com', password: 'Demo123' })
}).then(r => r.json()).then(d => { if(d.token) localStorage.setItem('authToken', d.token); return d; });

// 2. Quick API Tests
const testAPI = (endpoint) => fetch(`https://pitchey-production.cavelltheleaddev.workers.dev${endpoint}`, {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
}).then(r => r.json());

// 3. Usage Examples
loginCreator().then(console.log);  // Login as creator
testAPI('/api/user/profile').then(console.log);  // Get profile
testAPI('/api/creator/dashboard').then(console.log);  // Get dashboard
```

---

## Best Practices

### Test Organization
- Group tests by feature, not by file structure
- Use descriptive test names that explain the behavior
- Keep tests independent and idempotent
- Use proper setup and teardown

### Test Performance
- Run tests in parallel when possible
- Use test databases that can be reset quickly
- Mock expensive operations (external APIs, file uploads)
- Cache dependencies in CI

### Test Maintenance
- Keep page objects updated with UI changes
- Use data-testid attributes for reliable element selection
- Version your API tests with your API
- Regular test review and cleanup

---

## Troubleshooting

### Common Issues

1. **Flaky Tests**
   - Add proper waits (`waitForLoadState`, `waitForSelector`)
   - Increase timeouts for CI environments
   - Use retry mechanisms for network requests

2. **Database State**
   - Always clean database between tests
   - Use transactions for test isolation
   - Consider database snapshots for complex scenarios

3. **WebSocket Tests**
   - Ensure proper connection before sending messages
   - Add timeouts for message expectations
   - Clean up connections in afterEach

4. **Performance Tests**
   - Warm up the system before measurements
   - Run multiple iterations for consistency
   - Monitor system resources during tests

---

This comprehensive testing framework documentation provides patterns and examples for all testing levels in the Pitchey platform, enhanced with Context7's Playwright best practices.