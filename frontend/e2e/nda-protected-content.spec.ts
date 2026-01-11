import { test, expect, Page } from '@playwright/test';

// Helper function to sign in as investor
async function signInAsInvestor(page: Page) {
  await page.goto('/login/investor');
  await page.click('text=Use Demo Investor Account');
  
  // Wait for authentication to complete
  await page.waitForURL('**/investor/dashboard', { timeout: 10000 });
}

// Helper function to navigate to a specific pitch
async function navigateToPitch(page: Page, pitchId: string) {
  await page.goto(`/pitch/${pitchId}`);
  await page.waitForSelector('h1', { timeout: 5000 });
}

test.describe('NDA Protected Content Access', () => {
  test.beforeEach(async ({ page }) => {
    // Set up any required test data or authentication
    await page.goto('/');
  });

  test('investor can access protected content after signing NDA', async ({ page }) => {
    // Step 1: Sign in as investor
    await signInAsInvestor(page);
    
    // Step 2: Navigate to pitch with protected content
    await navigateToPitch(page, '226');
    
    // Step 3: Verify pitch title is visible
    await expect(page.locator('h1')).toContainText('The Memory Thief');
    
    // Step 4: Verify protected content is NOT visible initially
    await expect(page.locator('text=Enhanced Information Available')).toBeVisible();
    await expect(page.locator('text=Budget Breakdown')).not.toBeVisible();
    await expect(page.locator('text=Financial Projections')).not.toBeVisible();
    
    // Step 5: Click Request NDA Access button
    await page.click('button:has-text("Request NDA Access")');
    
    // Step 6: Complete NDA wizard
    await page.waitForSelector('text=Understanding Non-Disclosure Agreements');
    await page.click('button:has-text("Next")');
    
    // Step 7: Submit NDA request
    await page.waitForSelector('text=Request NDA Access');
    await page.click('button:has-text("Submit Request")');
    
    // Step 8: Wait for NDA to be processed (in test environment, should be instant)
    await page.waitForTimeout(2000);
    
    // Step 9: Verify protected content is NOW visible
    await expect(page.locator('text=Enhanced Information')).toBeVisible();
    await expect(page.locator('text=NDA Protected')).toBeVisible();
    
    // Step 10: Verify specific protected fields are displayed
    const protectedFields = [
      'Budget Breakdown',
      'Production Timeline', 
      'Attached Talent',
      'Financial Projections',
      'Distribution Plan',
      'Marketing Strategy',
      'Revenue Model',
      'Contact Information'
    ];
    
    for (const field of protectedFields) {
      await expect(page.locator(`text=${field}`)).toBeVisible();
    }
    
    // Step 11: Verify budget details are visible
    await expect(page.locator('text=/Total Budget.*3,000,000/')).toBeVisible();
    await expect(page.locator('text=/Production.*2,000,000/')).toBeVisible();
    
    // Step 12: Verify attached talent is visible
    await expect(page.locator('text=Director: Maya Patel')).toBeVisible();
    
    // Step 13: Verify financial projections
    await expect(page.locator('text=/ROI.*180%/')).toBeVisible();
    await expect(page.locator('text=/Break-even.*6 months/')).toBeVisible();
  });

  test('protected content persists after page refresh', async ({ page }) => {
    // Sign in and navigate to pitch
    await signInAsInvestor(page);
    await navigateToPitch(page, '226');
    
    // Assuming NDA is already signed in previous test or setup
    // Refresh the page
    await page.reload();
    
    // Verify protected content is still visible
    await expect(page.locator('text=Enhanced Information')).toBeVisible();
    await expect(page.locator('text=Budget Breakdown')).toBeVisible();
  });

  test('non-authenticated users cannot access protected content', async ({ page }) => {
    // Navigate directly to pitch without signing in
    await page.goto('/pitch/226');
    
    // Verify pitch is visible but protected content is not
    await expect(page.locator('h1')).toContainText('The Memory Thief');
    await expect(page.locator('text=Enhanced Information Available')).toBeVisible();
    
    // Verify no protected content is visible
    await expect(page.locator('text=Budget Breakdown')).not.toBeVisible();
    await expect(page.locator('text=Financial Projections')).not.toBeVisible();
    
    // Verify Request NDA button is visible for sign-in prompt
    await expect(page.locator('button:has-text("Request")')).toBeVisible();
  });

  test('creator can view their own pitch protected content without NDA', async ({ page }) => {
    // Sign in as creator
    await page.goto('/login/creator');
    await page.click('text=Use Demo Creator Account');
    await page.waitForURL('**/creator/dashboard', { timeout: 10000 });
    
    // Navigate to creator's own pitch (assuming pitch 226 is owned by demo creator)
    await navigateToPitch(page, '226');
    
    // Creator should see all protected content without needing NDA
    await expect(page.locator('text=Budget Breakdown')).toBeVisible();
    await expect(page.locator('text=Financial Projections')).toBeVisible();
  });

  test('NDA status badge updates correctly', async ({ page }) => {
    await signInAsInvestor(page);
    await navigateToPitch(page, '226');
    
    // Before NDA: Should show "Can Request"
    await expect(page.locator('text=Your Access')).toBeVisible();
    await expect(page.locator('text=Can Request')).toBeVisible();
    
    // After signing NDA
    await page.click('button:has-text("Request NDA Access")');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Submit Request")');
    await page.waitForTimeout(2000);
    
    // After NDA: Should show "Full Access"
    await expect(page.locator('text=Full Access')).toBeVisible();
  });
});

test.describe('NDA Protected Content API', () => {
  test('API returns protected content when NDA is signed', async ({ page }) => {
    await signInAsInvestor(page);
    
    // Intercept API call to check response
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/pitches/public/226') && response.status() === 200
    );
    
    await navigateToPitch(page, '226');
    
    const response = await responsePromise;
    const data = await response.json();
    
    // If NDA is signed, response should include protectedContent
    if (data.data?.hasSignedNDA) {
      expect(data.data.protectedContent).toBeDefined();
      expect(data.data.protectedContent.budgetBreakdown).toBeDefined();
      expect(data.data.protectedContent.financialProjections).toBeDefined();
      expect(data.data.protectedContent.attachedTalent).toBeDefined();
    }
  });

  test('API does not return protected content without NDA', async ({ page }) => {
    // Don't sign in, just navigate directly
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/pitches/public/226') && response.status() === 200
    );
    
    await page.goto('/pitch/226');
    
    const response = await responsePromise;
    const data = await response.json();
    
    // Without NDA, response should NOT include protectedContent
    expect(data.data?.hasSignedNDA).toBeFalsy();
    expect(data.data?.protectedContent).toBeUndefined();
  });
});