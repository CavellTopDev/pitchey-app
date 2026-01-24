import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
    outputFile: {
      json: './test-results/vitest-report.json',
      junit: './test-results/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '*.config.*',
        'coverage/**',
        'e2e/**',
        'playwright-report/**',
        'test-results/**',
        'src/test/**',
        'src/tests/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'worker/**',
        'functions/**'
      ],
      include: [
        'src/**/*.{ts,tsx}'
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})