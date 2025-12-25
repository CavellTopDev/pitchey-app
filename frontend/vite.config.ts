import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // CRITICAL: Force single React instance to prevent duplicate React error
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep React together in one chunk
          'vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Increase chunk warning limit
    chunkSizeWarningLimit: 2000,
    // Keep sourcemaps for debugging
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    // Force optimization to prevent duplicates
    force: true,
  },
})