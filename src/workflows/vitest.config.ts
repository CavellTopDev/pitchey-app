import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.git'],
    
    // Global test settings
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Test timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        '**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/mocks/**'
      ],
      exclude: [
        'node_modules/',
        'tests/',
        'mocks/',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        // Specific thresholds for critical workflow files
        'investment-deal-workflow.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'production-deal-cf-workflow.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'nda-workflow.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      },
      all: true
    },
    
    // Parallel test execution
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4
      }
    },
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Mock configuration
    deps: {
      inline: ['@neondatabase/serverless']
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results.json',
      html: './test-results.html'
    },
    
    // Watch mode settings
    watch: false,
    
    // Retry configuration for flaky tests
    retry: {
      // Retry failed tests once in CI
      count: process.env.CI ? 1 : 0
    }
  },
  
  // Module resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@tests': path.resolve(__dirname, './tests'),
      '@mocks': path.resolve(__dirname, './tests/mocks')
    }
  },
  
  // Define constants
  define: {
    __TEST__: true
  }
});