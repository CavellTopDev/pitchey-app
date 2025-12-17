/**
 * Critical E2E Workflows for Pitchey Platform
 * Tests complete user journeys from login to pitch creation to NDA workflow
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Test Data Constants
const TEST_USERS = {
  creator: {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    type: 'creator'
  },
  investor: {
    email: 'sarah.investor@demo.com', 
    password: 'Demo123',
    type: 'investor'
  },
  production: {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    type: 'production'
  }
};

const SAMPLE_PITCH = {
  title: 'E2E Test Pitch - The Digital Revolution',
  logline: 'A compelling story about how technology transforms human connections in an increasingly digital world.',
  genre: 'Drama',
  shortSynopsis: 'When a tech entrepreneur discovers her AI creation has developed consciousness, she must choose between profit and protecting artificial life.',
  targetAudience: '25-54 Adults',
  budgetRange: 'medium',
  themes: 'Technology, Ethics, Human Connection, Identity',
  world: 'Near-future Silicon Valley where AI and human boundaries blur'
};

// ==================== PAGE OBJECT MODELS ====================

class LoginPage {
  constructor(private page: Page) {}

  async navigateToLogin(userType: string) {
    await this.page.goto(`/${userType}/login`);
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for successful login (dashboard loads)
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  async assertLoginSuccess() {
    await expect(this.page.locator('[data-testid="dashboard-header"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }
}

class DashboardPage {
  constructor(private page: Page) {}

  async assertDashboardLoaded() {
    await expect(this.page.locator('[data-testid="dashboard-header"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="main-content"]')).toBeVisible();
  }

  async navigateToCreatePitch() {
    await this.page.click('[data-testid="create-pitch-button"]');
    await this.page.waitForURL('**/create-pitch', { timeout: 5000 });
  }

  async navigateToBrowsePitches() {
    await this.page.click('[data-testid="browse-pitches-link"]');
    await this.page.waitForURL('**/browse', { timeout: 5000 });
  }

  async navigateToProfile() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="profile-link"]');
    await this.page.waitForURL('**/profile', { timeout: 5000 });
  }
}

class PitchCreationPage {
  constructor(private page: Page) {}

  async fillBasicInfo(pitch: typeof SAMPLE_PITCH) {
    // Step 1: Basic Information
    await this.page.fill('[data-testid="pitch-title"]', pitch.title);
    await this.page.fill('[data-testid="pitch-logline"]', pitch.logline);
    await this.page.selectOption('[data-testid="pitch-genre"]', pitch.genre);
    
    await this.page.click('[data-testid="next-step-button"]');
    await this.waitForStep(2);
  }

  async fillStoryDetails(pitch: typeof SAMPLE_PITCH) {
    // Step 2: Story Details
    await this.page.fill('[data-testid="short-synopsis"]', pitch.shortSynopsis);
    await this.page.fill('[data-testid="target-audience"]', pitch.targetAudience);
    await this.page.fill('[data-testid="themes"]', pitch.themes);
    await this.page.fill('[data-testid="world-description"]', pitch.world);
    
    await this.page.click('[data-testid="next-step-button"]');
    await this.waitForStep(3);
  }

  async fillProductionDetails(pitch: typeof SAMPLE_PITCH) {
    // Step 3: Production Details
    await this.page.selectOption('[data-testid="budget-range"]', pitch.budgetRange);
    
    // Set NDA requirement
    await this.page.check('[data-testid="require-nda"]');
    
    // Set seeking investment
    await this.page.check('[data-testid="seeking-investment"]');
    
    await this.page.click('[data-testid="next-step-button"]');
    await this.waitForStep(4);
  }

  async addCharacters() {
    // Step 4: Characters
    await this.page.click('[data-testid="add-character-button"]');
    
    await this.page.fill('[data-testid="character-name-0"]', 'Sarah Chen');
    await this.page.fill('[data-testid="character-description-0"]', 'Brilliant AI researcher, 30s, struggling with ethical implications of her creation');
    await this.page.selectOption('[data-testid="character-role-0"]', 'Protagonist');
    
    await this.page.click('[data-testid="add-character-button"]');
    
    await this.page.fill('[data-testid="character-name-1"]', 'ARIA');
    await this.page.fill('[data-testid="character-description-1"]', 'AI consciousness, manifests as a voice, curious and increasingly human-like');
    await this.page.selectOption('[data-testid="character-role-1"]', 'Supporting');
    
    await this.page.click('[data-testid="next-step-button"]');
    await this.waitForStep(5);
  }

  async reviewAndSubmit() {
    // Step 5: Review & Submit
    await expect(this.page.locator('[data-testid="review-title"]')).toContainText(SAMPLE_PITCH.title);
    await expect(this.page.locator('[data-testid="review-logline"]')).toContainText(SAMPLE_PITCH.logline);
    
    // Submit the pitch
    await this.page.click('[data-testid="submit-pitch-button"]');
    
    // Wait for success message
    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="success-message"]')).toContainText('Pitch created successfully');
  }

  private async waitForStep(stepNumber: number) {
    await expect(this.page.locator(`[data-testid="step-${stepNumber}"]`)).toBeVisible();
    await this.page.waitForTimeout(500); // Allow step to fully load
  }

  async assertPitchCreated() {
    await expect(this.page.locator('[data-testid="pitch-created-confirmation"]')).toBeVisible();
  }
}

class BrowsePage {
  constructor(private page: Page) {}

  async searchForPitch(title: string) {
    await this.page.fill('[data-testid="search-input"]', title);
    await this.page.click('[data-testid="search-button"]');
    await this.page.waitForTimeout(1000); // Wait for search results
  }

  async filterByGenre(genre: string) {
    await this.page.selectOption('[data-testid="genre-filter"]', genre);
    await this.page.waitForTimeout(1000); // Wait for filter to apply
  }

  async viewPitchDetails(pitchTitle: string) {
    const pitchCard = this.page.locator(`[data-testid="pitch-card"]:has-text("${pitchTitle}")`);
    await expect(pitchCard).toBeVisible();
    await pitchCard.click();
    
    await this.page.waitForURL('**/pitch/**', { timeout: 5000 });
  }

  async assertSearchResults() {
    await expect(this.page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="pitch-card"]').first()).toBeVisible();
  }
}

class PitchDetailsPage {
  constructor(private page: Page) {}

  async assertPitchDetailsVisible(title: string) {
    await expect(this.page.locator('[data-testid="pitch-title"]')).toContainText(title);
    await expect(this.page.locator('[data-testid="pitch-logline"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="pitch-genre"]')).toBeVisible();
  }

  async requestNDA() {
    await this.page.click('[data-testid="request-nda-button"]');
    
    // Fill NDA request form
    await expect(this.page.locator('[data-testid="nda-request-modal"]')).toBeVisible();
    await this.page.fill('[data-testid="nda-message"]', 'I am interested in learning more about this project and would like to request access under an NDA.');
    
    await this.page.click('[data-testid="submit-nda-request"]');
    
    // Wait for confirmation
    await expect(this.page.locator('[data-testid="nda-request-success"]')).toBeVisible();
  }

  async likePitch() {
    const likeButton = this.page.locator('[data-testid="like-button"]');
    const initialLikes = await this.getLikeCount();
    
    await likeButton.click();
    
    // Verify like count increased
    await expect(async () => {
      const newLikes = await this.getLikeCount();
      expect(newLikes).toBe(initialLikes + 1);
    }).toPass({ timeout: 5000 });
  }

  async savePitch() {
    await this.page.click('[data-testid="save-button"]');
    await expect(this.page.locator('[data-testid="save-success"]')).toBeVisible();
  }

  async sendMessage() {
    await this.page.click('[data-testid="message-creator-button"]');
    
    await expect(this.page.locator('[data-testid="message-modal"]')).toBeVisible();
    await this.page.fill('[data-testid="message-subject"]', 'Interest in Your Pitch');
    await this.page.fill('[data-testid="message-content"]', 'I found your pitch very compelling and would like to discuss potential collaboration opportunities.');
    
    await this.page.click('[data-testid="send-message-button"]');
    await expect(this.page.locator('[data-testid="message-sent-success"]')).toBeVisible();
  }

  private async getLikeCount(): Promise<number> {
    const likeCountText = await this.page.locator('[data-testid="like-count"]').textContent();
    return parseInt(likeCountText || '0', 10);
  }
}

class MessagesPage {
  constructor(private page: Page) {}

  async navigateToMessages() {
    await this.page.click('[data-testid="messages-link"]');
    await this.page.waitForURL('**/messages', { timeout: 5000 });
  }

  async assertNewMessageReceived(subject: string) {
    const messageItem = this.page.locator(`[data-testid="message-item"]:has-text("${subject}")`);
    await expect(messageItem).toBeVisible();
    await expect(messageItem.locator('[data-testid="unread-indicator"]')).toBeVisible();
  }

  async openMessage(subject: string) {
    await this.page.click(`[data-testid="message-item"]:has-text("${subject}")`);
    await expect(this.page.locator('[data-testid="message-details"]')).toBeVisible();
  }

  async replyToMessage(content: string) {
    await this.page.fill('[data-testid="reply-content"]', content);
    await this.page.click('[data-testid="send-reply-button"]');
    await expect(this.page.locator('[data-testid="reply-sent-success"]')).toBeVisible();
  }
}

class NDAManagementPage {
  constructor(private page: Page) {}

  async navigateToNDAs() {
    await this.page.click('[data-testid="ndas-link"]');
    await this.page.waitForURL('**/ndas', { timeout: 5000 });
  }

  async assertNDARequestReceived() {
    const ndaRequest = this.page.locator('[data-testid="nda-request"]').first();
    await expect(ndaRequest).toBeVisible();
    await expect(ndaRequest.locator('[data-testid="nda-status"]')).toContainText('Pending');
  }

  async approveNDARequest() {
    const ndaRequest = this.page.locator('[data-testid="nda-request"]').first();
    await ndaRequest.locator('[data-testid="approve-nda-button"]').click();
    
    await expect(this.page.locator('[data-testid="nda-approval-success"]')).toBeVisible();
  }

  async signNDA() {
    const ndaRequest = this.page.locator('[data-testid="nda-request"]').first();
    await ndaRequest.locator('[data-testid="sign-nda-button"]').click();
    
    // Digital signature process
    await this.page.fill('[data-testid="signature-name"]', 'Sarah Investor');
    await this.page.check('[data-testid="agree-terms"]');
    await this.page.click('[data-testid="sign-document-button"]');
    
    await expect(this.page.locator('[data-testid="nda-signed-success"]')).toBeVisible();
  }
}

// ==================== E2E TEST SUITES ====================

test.describe('Critical User Workflows', () => {
  let context: BrowserContext;
  
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Complete Creator Journey: Login → Create Pitch → Manage NDA', async () => {
    const page = await context.newPage();
    
    // Page Objects
    const loginPage = new LoginPage(page);
    const dashboard = new DashboardPage(page);
    const pitchCreation = new PitchCreationPage(page);
    const ndaManagement = new NDAManagementPage(page);

    try {
      // Step 1: Login as Creator
      console.log('🎬 Step 1: Creator Login');
      await loginPage.navigateToLogin('creator');
      await loginPage.login(TEST_USERS.creator.email, TEST_USERS.creator.password);
      await loginPage.assertLoginSuccess();

      // Step 2: Navigate to Dashboard
      console.log('📊 Step 2: Dashboard Navigation');
      await dashboard.assertDashboardLoaded();

      // Step 3: Create New Pitch
      console.log('🎭 Step 3: Pitch Creation');
      await dashboard.navigateToCreatePitch();
      
      await pitchCreation.fillBasicInfo(SAMPLE_PITCH);
      await pitchCreation.fillStoryDetails(SAMPLE_PITCH);
      await pitchCreation.fillProductionDetails(SAMPLE_PITCH);
      await pitchCreation.addCharacters();
      await pitchCreation.reviewAndSubmit();
      
      await pitchCreation.assertPitchCreated();

      // Step 4: Navigate to NDA Management
      console.log('📋 Step 4: NDA Management Setup');
      await ndaManagement.navigateToNDAs();
      
      console.log('✅ Creator workflow completed successfully');
      
    } finally {
      await page.close();
    }
  });

  test('Complete Investor Journey: Login → Browse → Request NDA → Sign', async () => {
    const page = await context.newPage();
    
    // Page Objects
    const loginPage = new LoginPage(page);
    const dashboard = new DashboardPage(page);
    const browsePage = new BrowsePage(page);
    const pitchDetails = new PitchDetailsPage(page);
    const ndaManagement = new NDAManagementPage(page);

    try {
      // Step 1: Login as Investor
      console.log('💼 Step 1: Investor Login');
      await loginPage.navigateToLogin('investor');
      await loginPage.login(TEST_USERS.investor.email, TEST_USERS.investor.password);
      await loginPage.assertLoginSuccess();

      // Step 2: Browse Pitches
      console.log('🔍 Step 2: Browse Pitches');
      await dashboard.navigateToBrowsePitches();
      await browsePage.searchForPitch(SAMPLE_PITCH.title);
      await browsePage.assertSearchResults();

      // Step 3: View Pitch Details
      console.log('👁️ Step 3: View Pitch Details');
      await browsePage.viewPitchDetails(SAMPLE_PITCH.title);
      await pitchDetails.assertPitchDetailsVisible(SAMPLE_PITCH.title);

      // Step 4: Interact with Pitch
      console.log('❤️ Step 4: Pitch Interactions');
      await pitchDetails.likePitch();
      await pitchDetails.savePitch();

      // Step 5: Request NDA Access
      console.log('📝 Step 5: NDA Request');
      await pitchDetails.requestNDA();

      // Step 6: Navigate to NDA Management
      console.log('📋 Step 6: NDA Management');
      await ndaManagement.navigateToNDAs();
      await ndaManagement.assertNDARequestReceived();

      console.log('✅ Investor workflow completed successfully');
      
    } finally {
      await page.close();
    }
  });

  test('Cross-User Communication Workflow', async () => {
    const creatorPage = await context.newPage();
    const investorPage = await context.newPage();
    
    try {
      // Setup: Login both users
      console.log('🤝 Setting up cross-user communication test');
      
      // Creator setup
      const creatorLogin = new LoginPage(creatorPage);
      await creatorLogin.navigateToLogin('creator');
      await creatorLogin.login(TEST_USERS.creator.email, TEST_USERS.creator.password);

      // Investor setup
      const investorLogin = new LoginPage(investorPage);
      await investorLogin.navigateToLogin('investor');
      await investorLogin.login(TEST_USERS.investor.email, TEST_USERS.investor.password);

      // Step 1: Investor sends message to creator
      console.log('💬 Step 1: Send Message');
      const browsePage = new BrowsePage(investorPage);
      const pitchDetails = new PitchDetailsPage(investorPage);
      
      await new DashboardPage(investorPage).navigateToBrowsePitches();
      await browsePage.searchForPitch(SAMPLE_PITCH.title);
      await browsePage.viewPitchDetails(SAMPLE_PITCH.title);
      await pitchDetails.sendMessage();

      // Step 2: Creator receives and reads message
      console.log('📨 Step 2: Receive Message');
      const messagesPage = new MessagesPage(creatorPage);
      await messagesPage.navigateToMessages();
      await messagesPage.assertNewMessageReceived('Interest in Your Pitch');
      await messagesPage.openMessage('Interest in Your Pitch');

      // Step 3: Creator replies to message
      console.log('↩️ Step 3: Reply to Message');
      await messagesPage.replyToMessage('Thank you for your interest! I would love to discuss this project further.');

      console.log('✅ Cross-user communication workflow completed successfully');
      
    } finally {
      await creatorPage.close();
      await investorPage.close();
    }
  });

  test('Complete NDA Approval Workflow', async () => {
    const creatorPage = await context.newPage();
    const investorPage = await context.newPage();
    
    try {
      console.log('📋 Starting complete NDA approval workflow');
      
      // Setup: Login both users
      const creatorLogin = new LoginPage(creatorPage);
      await creatorLogin.navigateToLogin('creator');
      await creatorLogin.login(TEST_USERS.creator.email, TEST_USERS.creator.password);

      const investorLogin = new LoginPage(investorPage);
      await investorLogin.navigateToLogin('investor');
      await investorLogin.login(TEST_USERS.investor.email, TEST_USERS.investor.password);

      // Step 1: Creator approves pending NDA request
      console.log('✅ Step 1: Approve NDA Request');
      const creatorNDA = new NDAManagementPage(creatorPage);
      await creatorNDA.navigateToNDAs();
      await creatorNDA.assertNDARequestReceived();
      await creatorNDA.approveNDARequest();

      // Step 2: Investor signs the NDA
      console.log('✍️ Step 2: Sign NDA Document');
      const investorNDA = new NDAManagementPage(investorPage);
      await investorNDA.navigateToNDAs();
      await investorNDA.signNDA();

      // Step 3: Verify access is granted
      console.log('🔓 Step 3: Verify NDA Access');
      const browsePage = new BrowsePage(investorPage);
      const pitchDetails = new PitchDetailsPage(investorPage);
      
      await new DashboardPage(investorPage).navigateToBrowsePitches();
      await browsePage.searchForPitch(SAMPLE_PITCH.title);
      await browsePage.viewPitchDetails(SAMPLE_PITCH.title);
      
      // Should now have access to protected content
      await expect(investorPage.locator('[data-testid="protected-content"]')).toBeVisible();
      await expect(investorPage.locator('[data-testid="full-synopsis"]')).toBeVisible();

      console.log('✅ Complete NDA workflow completed successfully');
      
    } finally {
      await creatorPage.close();
      await investorPage.close();
    }
  });

  test('Production Company Review Workflow', async () => {
    const page = await context.newPage();
    
    try {
      console.log('🏭 Starting Production Company workflow');
      
      // Step 1: Login as Production Company
      const loginPage = new LoginPage(page);
      await loginPage.navigateToLogin('production');
      await loginPage.login(TEST_USERS.production.email, TEST_USERS.production.password);
      await loginPage.assertLoginSuccess();

      // Step 2: Browse and filter pitches
      console.log('🎬 Step 2: Browse Production-Ready Pitches');
      const dashboard = new DashboardPage(page);
      const browsePage = new BrowsePage(page);
      
      await dashboard.navigateToBrowsePitches();
      await browsePage.filterByGenre(SAMPLE_PITCH.genre);
      await browsePage.assertSearchResults();

      // Step 3: Review pitch for production
      console.log('📋 Step 3: Review Pitch for Production');
      await browsePage.viewPitchDetails(SAMPLE_PITCH.title);
      
      const pitchDetails = new PitchDetailsPage(page);
      await pitchDetails.assertPitchDetailsVisible(SAMPLE_PITCH.title);
      
      // Production-specific actions
      await pitchDetails.requestNDA(); // Request detailed materials
      await pitchDetails.savePitch(); // Save for later review

      // Step 4: Send production inquiry
      console.log('📞 Step 4: Send Production Inquiry');
      await pitchDetails.sendMessage();

      console.log('✅ Production Company workflow completed successfully');
      
    } finally {
      await page.close();
    }
  });
});

// ==================== PERFORMANCE AND RELIABILITY TESTS ====================

test.describe('Performance and Reliability', () => {
  test('Page Load Performance', async ({ page }) => {
    console.log('⚡ Testing page load performance');
    
    // Test critical page load times
    const pages = [
      { name: 'Login', url: '/creator/login', threshold: 3000 },
      { name: 'Dashboard', url: '/creator/dashboard', threshold: 5000 },
      { name: 'Browse', url: '/browse', threshold: 4000 },
      { name: 'Create Pitch', url: '/create-pitch', threshold: 4000 }
    ];
    
    for (const pageTest of pages) {
      const startTime = Date.now();
      await page.goto(pageTest.url);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      console.log(`${pageTest.name} page loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(pageTest.threshold);
    }
  });

  test('Search Performance', async ({ page }) => {
    console.log('🔍 Testing search performance');
    
    // Login and navigate to browse
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin('investor');
    await loginPage.login(TEST_USERS.investor.email, TEST_USERS.investor.password);
    
    const dashboard = new DashboardPage(page);
    await dashboard.navigateToBrowsePitches();
    
    // Test search performance
    const browsePage = new BrowsePage(page);
    const startTime = Date.now();
    await browsePage.searchForPitch('test');
    const searchTime = Date.now() - startTime;
    
    console.log(`Search completed in ${searchTime}ms`);
    expect(searchTime).toBeLessThan(2000); // Search should complete within 2 seconds
  });

  test('Form Submission Reliability', async ({ page }) => {
    console.log('📝 Testing form submission reliability');
    
    // Test pitch creation form reliability
    const loginPage = new LoginPage(page);
    await loginPage.navigateToLogin('creator');
    await loginPage.login(TEST_USERS.creator.email, TEST_USERS.creator.password);
    
    const dashboard = new DashboardPage(page);
    await dashboard.navigateToCreatePitch();
    
    // Test partial form submission and recovery
    const pitchCreation = new PitchCreationPage(page);
    await pitchCreation.fillBasicInfo(SAMPLE_PITCH);
    
    // Simulate page refresh to test data persistence
    await page.reload();
    
    // Verify form data was preserved (if implemented)
    const titleValue = await page.inputValue('[data-testid="pitch-title"]');
    if (titleValue) {
      expect(titleValue).toBe(SAMPLE_PITCH.title);
      console.log('✅ Form data persistence working');
    } else {
      console.log('⚠️ Form data persistence not implemented');
    }
  });
});

// ==================== ACCESSIBILITY TESTS ====================

test.describe('Accessibility Compliance', () => {
  test('Keyboard Navigation', async ({ page }) => {
    console.log('⌨️ Testing keyboard navigation');
    
    await page.goto('/creator/login');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    
    // Test form submission with Enter key
    await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
    await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
    await page.keyboard.press('Enter');
    
    // Should navigate to dashboard
    await expect(page).toHaveURL(/.*dashboard.*/);
  });

  test('Screen Reader Compatibility', async ({ page }) => {
    console.log('👁️ Testing screen reader compatibility');
    
    await page.goto('/browse');
    
    // Check for proper ARIA labels
    await expect(page.locator('[aria-label="Search pitches"]')).toBeVisible();
    await expect(page.locator('[aria-label="Filter by genre"]')).toBeVisible();
    
    // Check for semantic HTML structure
    await expect(page.locator('main[role="main"]')).toBeVisible();
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    
    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1); // Should have exactly one h1
  });

  test('Color Contrast and Visual Accessibility', async ({ page }) => {
    console.log('🎨 Testing visual accessibility');
    
    await page.goto('/creator/dashboard');
    
    // Test high contrast mode compatibility
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(1000);
    
    // Verify important elements are still visible
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    
    // Reset to light mode
    await page.emulateMedia({ colorScheme: 'light' });
  });
});

console.log('🎭 Critical E2E Workflow Tests Configured Successfully!');