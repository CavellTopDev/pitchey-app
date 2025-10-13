import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  base: '/',
  
  build: {
    outDir: 'dist',
    sourcemap: false,  // Disable sourcemaps in production
    minify: 'esbuild',  // Enable minification
    target: 'esnext',
    chunkSizeWarningLimit: 600, // Increase warning limit slightly
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // UI and utility libraries
          'ui-libs': ['lucide-react', '@tanstack/react-query'],
          
          // Services and utilities (avoiding circular deps)
          'services': ['./src/services/notification.service', './src/services/messaging.service'],
        },
      },
    },
  },
  
  server: {
    host: true,
    port: 5173,
  },
  
  define: {
    // Ensure we're in production mode
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})
