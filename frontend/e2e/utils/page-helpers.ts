import { Page, expect } from '@playwright/test';

export class PageHelper {
  constructor(private page: Page) {}

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  async checkAccessibility() {
    // Basic accessibility checks
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);

    // Check for alt text on images
    const images = this.page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        // Images should have alt text or be decorative
        expect(alt !== null || role === 'presentation').toBeTruthy();
      }
    }
  }

  async checkForErrors() {
    // Check for JavaScript errors
    const errors: string[] = [];
    
    this.page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    return errors;
  }

  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      const selector = `[data-testid="${field}"], [name="${field}"], #${field}`;
      await this.page.fill(selector, value);
    }
  }

  async selectDropdown(selector: string, value: string) {
    await this.page.selectOption(selector, value);
  }

  async uploadFile(selector: string, filePath: string) {
    await this.page.setInputFiles(selector, filePath);
  }

  async waitForNotification(type: 'success' | 'error' | 'info' = 'success') {
    await expect(this.page.locator(`[data-testid="toast-${type}"]`)).toBeVisible();
  }

  async checkWebSocketConnection() {
    // Check if WebSocket status indicator shows connected
    const wsStatus = this.page.locator('[data-testid="websocket-status"]');
    if (await wsStatus.isVisible()) {
      await expect(wsStatus).toContainText('Connected');
    }
  }

  async verifyTableData(tableSelector: string, expectedData: string[][]) {
    const rows = this.page.locator(`${tableSelector} tbody tr`);
    const rowCount = await rows.count();
    expect(rowCount).toBe(expectedData.length);

    for (let i = 0; i < expectedData.length; i++) {
      const row = rows.nth(i);
      const cells = row.locator('td');
      
      for (let j = 0; j < expectedData[i].length; j++) {
        await expect(cells.nth(j)).toContainText(expectedData[i][j]);
      }
    }
  }
}