import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// Sentry temporarily removed to resolve initialization errors

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
    plugins: [
      react(),
    ],
    
    base: '/',
    
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    
    build: {
      outDir: 'dist',
      sourcemap: isProduction ? 'hidden' : true, // Hidden sourcemaps in production (Sentry plugin will upload)
      minify: 'esbuild', // Use esbuild for minification
      target: 'es2020', // Modern browsers support
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Optimize chunk naming for caching
          entryFileNames: isProduction ? 'assets/[name].[hash].js' : '[name].js',
          chunkFileNames: isProduction ? 'assets/[name].[hash].js' : '[name].js',
          assetFileNames: isProduction ? 'assets/[name].[hash].[ext]' : '[name].[ext]',
          
          // CRITICAL FIX: Ensure React loads first and all dependencies in correct order
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              // React core MUST be in its own chunk and load FIRST
              if (id.includes('react/') || 
                  id.includes('react-dom/') ||
                  id.includes('scheduler/')) {
                return 'vendor-00-react-core'; // 00 prefix ensures this loads first
              }
              
              // All React-dependent libraries in second chunk
              // This includes EVERYTHING that might use React hooks
              if (
                id.includes('react') || // Catch all React-related
                id.includes('recharts') || 
                id.includes('chart') ||
                id.includes('@radix-ui') ||
                id.includes('lucide-react') ||
                id.includes('react-hook-form') ||
                id.includes('react-beautiful-dnd') ||
                id.includes('@tanstack') ||
                id.includes('framer-motion') ||
                id.includes('@floating-ui') ||
                id.includes('d3-') || // D3 dependencies for recharts
                id.includes('victory-vendor') // Victory chart dependencies
              ) {
                return 'vendor-01-react-deps'; // 01 prefix ensures this loads second
              }
              
              // Pure utility libraries (no React dependencies)
              if (id.includes('axios') || id.includes('date-fns') || id.includes('clsx') || id.includes('zod')) {
                return 'vendor-02-utils';
              }
              
              // State management
              if (id.includes('zustand')) {
                return 'vendor-03-state';
              }
              
              // All other vendor code
              return 'vendor-04-misc';
            }
            
            // Feature-based chunks for app code
            if (id.includes('/src/')) {
              // Analytics feature
              if (id.includes('Analytics') || id.includes('analytics')) {
                return 'feature-analytics';
              }
              // Team feature
              if (id.includes('Team') || id.includes('team')) {
                return 'feature-team';
              }
              // Browse feature
              if (id.includes('Browse') || id.includes('browse')) {
                return 'feature-browse';
              }
              // Character management
              if (id.includes('Character') || id.includes('character')) {
                return 'feature-characters';
              }
              // Auth feature
              if (id.includes('auth') || id.includes('Auth')) {
                return 'feature-auth';
              }
              // Pitch feature
              if (id.includes('pitch') || id.includes('Pitch')) {
                return 'feature-pitch';
              }
            }
          },
          // Don't include source code in sourcemaps for security
          sourcemapExcludeSources: true,
        },
        // Treeshaking optimizations - temporarily disabled to fix temporal dead zone
        treeshake: {
          moduleSideEffects: true, // Allow side effects to prevent initialization issues
          propertyReadSideEffects: true,
          tryCatchDeoptimization: true
        },
        // Prevent variable hoisting issues
        preserveEntrySignatures: 'allow-extension', // Less strict to prevent initialization order issues
        external: [],
      },
      // CSS optimization
      cssCodeSplit: true,
      cssMinify: isProduction,
      // Asset inlining threshold
      assetsInlineLimit: 4096, // 4kb
    },

    // CSS optimization
    css: {
      devSourcemap: !isProduction,
      modules: {
        localsConvention: 'camelCase'
      }
    },

    esbuild: {
      jsx: 'automatic',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      jsxDev: false, // force production JSX transform
      legalComments: 'none', // Remove all comments
      drop: isProduction ? ['debugger'] : [], // Keep console for debugging temporal dead zone
      pure: [], // Don't mark any functions as pure to prevent over-optimization
      minifyIdentifiers: false, // Disable identifier minification to prevent 'K' variable conflicts
      minifySyntax: isProduction,
      minifyWhitespace: isProduction,
      target: 'es2020',
      keepNames: true, // Prevents variable name conflicts
    },
    
    // Optimizations - ensure React is fully pre-bundled
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        'scheduler',
        'axios',
        'zustand',
        'lucide-react',
        'date-fns',
        'recharts',
        'd3-scale',
        'd3-shape'
      ],
      exclude: ['@vite/client', '@vite/env'],
      force: true, // Force re-optimization to ensure proper bundling
      esbuildOptions: {
        target: 'es2020'
      }
    },
    
    server: {
      host: true,
      port: 5173,
      // Warm up frequently used files
      warmup: {
        clientFiles: [
          './src/App.tsx',
          './src/main.tsx',
          './src/components/Layout.tsx',
          './src/pages/Homepage.tsx'
        ]
      }
    },
    
    preview: {
      host: true,
      port: 4173,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    },
    
    define: {
      // Ensure we're in production mode for runtime checks
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || (isProduction ? 'production' : 'development')),
      ...(isProduction ? {
        'import.meta.env.DEV': 'false',
        'import.meta.env.PROD': 'true',
      } : {}),
    },
  }
})