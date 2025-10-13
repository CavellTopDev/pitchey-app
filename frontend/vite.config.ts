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
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor';
          }
          
          // UI and Icon libraries
          if (id.includes('lucide-react')) {
            return 'ui-icons';
          }
          
          // Date and time libraries
          if (id.includes('date-fns') || id.includes('moment') || id.includes('dayjs')) {
            return 'date-libs';
          }
          
          // State management and data fetching
          if (id.includes('zustand') || id.includes('@tanstack/react-query') || id.includes('swr')) {
            return 'state-libs';
          }
          
          // Form and validation libraries
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('yup')) {
            return 'form-libs';
          }
          
          // Dashboard components (largest components)
          if (id.includes('ProductionDashboard') || id.includes('CreatorDashboard') || id.includes('InvestorDashboard')) {
            return 'dashboards';
          }
          
          // Large feature modules
          if (id.includes('Billing') || id.includes('Calendar') || id.includes('Messages')) {
            return 'features-large';
          }
          
          // Pitch creation and editing
          if (id.includes('CreatePitch') || id.includes('PitchEdit') || id.includes('ProductionPitchCreate')) {
            return 'pitch-creation';
          }
          
          // Pitch viewing and analytics
          if (id.includes('PitchDetail') || id.includes('PitchAnalytics') || id.includes('PublicPitchView') || 
              id.includes('PitchView') || id.includes('Marketplace')) {
            return 'pitch-viewing';
          }
          
          // Authentication and user management
          if (id.includes('Login') || id.includes('Register') || id.includes('Profile') || 
              id.includes('Settings') || id.includes('Portfolio')) {
            return 'user-auth';
          }
          
          // Utility services and APIs
          if (id.includes('services/') || id.includes('lib/') || id.includes('utils/')) {
            return 'services-utils';
          }
          
          // Everything else in node_modules goes to vendor
          if (id.includes('node_modules')) {
            return 'vendor';
          }
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
