import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { reactAsyncModeFix } from './vite-react-fix.js'

export default defineConfig({
  plugins: [
    react({
      // CRITICAL: Use automatic JSX runtime (production mode)
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      // Ensure production build uses correct JSX transform
      babel: {
        plugins: process.env.NODE_ENV === 'production' ? [
          // Remove console logs in production
          ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }],
        ] : [],
      },
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
      'react-is': path.resolve(__dirname, './node_modules/react-is'),
      // Also dedupe React internals used by libraries
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
      // CRITICAL: jsx-dev-runtime should NEVER be used - always use production runtime
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
    },
    // Deduplicate React across all dependencies
    dedupe: ['react', 'react-dom', 'react-is'],
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
        // Ensure proper chunk dependencies - use function for better control
        manualChunks: (id) => {
          // CRITICAL: React and react-global MUST be in vendor chunk and loaded first
          if (id.includes('react-global')) {
            return 'vendor'; // Ensure react-global is in vendor chunk
          }
          
          if (id.includes('node_modules')) {
            // React core + scheduler in single vendor chunk
            if (id.includes('/react/') || id.includes('/react-dom/') || 
                id.includes('/scheduler/') || id.includes('react-is') ||
                id.includes('react/jsx-runtime') || id.includes('react/jsx-dev-runtime')) {
              return 'vendor'; // Put React in vendor chunk that loads first
            }
            
            // React Router in separate chunk after vendor
            if (id.includes('react-router')) {
              return 'react-router';
            }
            
            // UI libraries after React
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            
            // Charts
            if (id.includes('recharts') || id.includes('react-smooth') || id.includes('d3-')) {
              return 'charts';
            }
            
            // Icons
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            
            // Utils in vendor
            return 'vendor';
          }
        },
        // OLD manual chunks function - keeping as fallback
        manualChunks_OLD: (id) => {
          // Vendor chunk for core dependencies
          if (id.includes('node_modules')) {
            // CRITICAL: React and scheduler MUST be in a single chunk loaded first
            if (id.includes('/react/index') || id.includes('/react-dom/index') || 
                id.includes('/react-is/') || id.includes('/scheduler/') ||
                id.includes('react/cjs/') || id.includes('react-dom/cjs/') ||
                id.includes('scheduler/cjs/')) {
              return 'react'; // Single chunk for React core and scheduler
            }
            
            // React-dependent UI libraries (must load AFTER React)
            if (id.includes('@radix-ui') || id.includes('framer-motion') || 
                id.includes('react-hook-form') || id.includes('@tanstack') ||
                id.includes('react-router') || id.includes('lucide-react')) {
              return 'react-libs';
            }
            
            // Recharts and react-smooth MUST be together (they share dependencies)
            if (id.includes('recharts') || id.includes('react-smooth') || 
                id.includes('d3-') || id.includes('victory')) {
              return 'charts';
            }
            
            // Sentry and monitoring
            if (id.includes('@sentry') || id.includes('sentry')) {
              return 'monitoring';
            }
            
            // Everything else that doesn't use React
            return 'vendor';
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
    include: [
      'react', 
      'react-dom',
      'react-is',
      'react-router-dom',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-slot',
      'recharts',
      'react-smooth'
    ],
    // Ensure consistent React version
    esbuildOptions: {
      // Treat React as external to force resolution through aliases
      define: {
        global: 'globalThis',
      },
    },
    // Force re-optimization when deps change
    force: true,
  },
  // Define global variables for production
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    // Force production mode to prevent any dev-only code
    '__DEV__': 'false',
    'process.env': JSON.stringify({ NODE_ENV: process.env.NODE_ENV || 'production' }),
  },
  // Development server optimizations
  server: {
    hmr: {
      overlay: false, // Disable error overlay for cleaner development
    },
  },
})