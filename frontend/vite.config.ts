import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// NUCLEAR OPTION: Force everything into a single bundle to fix React initialization
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Force everything into a single JS file - no chunk splitting
        inlineDynamicImports: true,
      },
    },
    // Increase limit since we're bundling everything together
    chunkSizeWarningLimit: 5000,
    // Keep sourcemaps for debugging
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})