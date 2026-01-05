import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { reactAsyncModeFix } from './vite-react-fix.js'

export default defineConfig({
  plugins: [
    react({
      // Optimize React production build
      babel: {
        plugins: [
          // Remove prop-types in production
          ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }],
        ],
      },
      // Fix React 18 compatibility
      jsxRuntime: 'automatic',
    }),
    // Fix AsyncMode issues in legacy dependencies
    reactAsyncModeFix(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // CRITICAL: Force single React instance to prevent duplicate React error
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
  build: {
    // Optimize build output - Updated for React 18 compatibility
    target: 'es2022', // Updated to es2022 for better React 18 support
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production', // Only remove console logs in production
        drop_debugger: true,
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug', 'console.info'] : [], // Remove specific functions in production
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
      // Fix for React 18 compatibility
      defaultIsModuleExports: false,
      // Fix exports undefined errors for UMD modules
      requireReturnsDefault: 'auto',
      ignoreDynamicRequires: true,
    },
    rollupOptions: {
      output: {
        // Optimized code splitting for better performance
        manualChunks: (id) => {
          // Vendor chunk for core dependencies
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('recharts') || id.includes('chart')) {
              return 'vendor-charts';
            }
            if (id.includes('@sentry') || id.includes('sentry')) {
              return 'vendor-monitoring';
            }
            return 'vendor-misc';
          }
          
          // Portal-specific chunks with sub-splitting
          if (id.includes('/creator/') || id.includes('Creator')) {
            if (id.includes('Analytics')) return 'portal-creator-analytics';
            return 'portal-creator';
          }
          
          if (id.includes('/investor/') || id.includes('Investor')) {
            if (id.includes('Analytics') || id.includes('Portfolio')) return 'portal-investor-analytics';
            if (id.includes('NDA') || id.includes('Deals')) return 'portal-investor-deals';
            return 'portal-investor';
          }
          
          if (id.includes('/production/') || id.includes('Production')) {
            if (id.includes('Analytics') || id.includes('Reports')) return 'portal-production-analytics';
            if (id.includes('Projects') || id.includes('Pipeline')) return 'portal-production-projects';
            return 'portal-production';
          }
          
          if (id.includes('/admin/') || id.includes('Admin')) {
            return 'portal-admin';
          }
          
          // Component chunks with category-based splitting
          if (id.includes('/components/')) {
            if (id.includes('Analytics') || id.includes('Chart')) return 'components-analytics';
            if (id.includes('Upload') || id.includes('FileUpload')) return 'components-upload';
            if (id.includes('NDA')) return 'components-nda';
            if (id.includes('Investment')) return 'components-investment';
            if (id.includes('ui/') || id.includes('UI')) return 'components-ui';
            return 'components-core';
          }
          
          // Service chunks
          if (id.includes('.service') || id.includes('/services/')) {
            return 'services';
          }
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'unknown';
          return `chunks/[name]-[hash].js`;
        },
        entryFileNames: 'entry-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    // Reduce chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Disable sourcemaps in production for smaller size
    sourcemap: process.env.NODE_ENV === 'development',
    // Enable gzip compression analysis
    reportCompressedSize: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    // Force optimization to prevent duplicates
    force: true,
  },
  // Development server optimizations
  server: {
    hmr: {
      overlay: false, // Disable error overlay for cleaner development
    },
  },
})