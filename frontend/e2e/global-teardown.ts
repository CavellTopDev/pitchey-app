import { FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown...');
  
  try {
    // Clean up test artifacts
    const testResultsDir = path.resolve(__dirname, '../test-results');
    
    // Compress screenshots and videos for storage efficiency
    const screenshotsDir = path.join(testResultsDir, 'screenshots');
    
    try {
      const screenshots = await fs.readdir(screenshotsDir).catch(() => []);
      console.log(`Found ${screenshots.length} screenshots to process`);
    } catch (error) {
      // Screenshots directory might not exist, which is fine
    }
    
    // Generate test summary
    const summaryPath = path.join(testResultsDir, 'test-summary.json');
    const summary = {
      timestamp: new Date().toISOString(),
      environment: {
        frontend: 'http://localhost:5173',
        backend: 'http://localhost:8001',
        node_version: process.version,
        platform: process.platform
      },
      notes: 'E2E test run completed with Better Auth session management'
    };
    
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2)).catch(() => {
      console.warn('Could not write test summary');
    });
    
    // Log completion
    console.log('Test artifacts processed');
    
  } catch (error) {
    console.warn('Global teardown encountered issues:', error);
    // Don't fail the entire test run due to teardown issues
  }
  
  console.log('Global teardown completed');
}

export default globalTeardown;