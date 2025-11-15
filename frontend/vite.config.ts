import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  const sentryEnabled = !!(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT && process.env.SENTRY_AUTH_TOKEN)
  const sentryRelease = process.env.SENTRY_RELEASE || process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA

  return {
    plugins: [
      react(),
      ...(sentryEnabled ? [
        sentryVitePlugin({
          org: process.env.SENTRY_ORG!,
          project: process.env.SENTRY_PROJECT!,
          authToken: process.env.SENTRY_AUTH_TOKEN!,
          release: sentryRelease,
          telemetry: false,
          sourcemaps: {
            filesToDeleteAfterUpload: isProduction ? 'dist/**/*.map' : undefined,
          },
        })
      ] : [])
    ],
    
    base: '/',
    
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
          
          // Advanced manual chunking for optimal caching
          manualChunks: (id) => {
            // Node modules chunking
            if (id.includes('node_modules')) {
              // React ecosystem
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor'
              }
              // Router
              if (id.includes('react-router')) {
                return 'router'
              }
              // Data fetching
              if (id.includes('@tanstack/react-query') || id.includes('axios')) {
                return 'data-fetching'
              }
              // State management
              if (id.includes('zustand')) {
                return 'state'
              }
              // Charts and visualization
              if (id.includes('chart.js') || id.includes('react-chartjs')) {
                return 'charts'
              }
              // UI icons
              if (id.includes('lucide-react')) {
                return 'icons'
              }
              // Date utilities
              if (id.includes('date-fns')) {
                return 'date-utils'
              }
              // Export utilities
              if (id.includes('xlsx') || id.includes('html-to-image')) {
                return 'export-utils'
              }
              // All other vendor code
              return 'vendor'
            }
            
            // Application code chunking
            if (id.includes('src/')) {
              // Admin pages
              if (id.includes('pages/Admin')) {
                return 'admin'
              }
              // Creator pages
              if (id.includes('pages/creator') || id.includes('Creator')) {
                return 'creator'
              }
              // Investor pages
              if (id.includes('pages/investor') || id.includes('Investor')) {
                return 'investor'
              }
              // Production pages
              if (id.includes('pages/production') || id.includes('Production')) {
                return 'production'
              }
              // Common components
              if (id.includes('components/')) {
                // Large components get their own chunks
                if (id.includes('DocumentUpload') || id.includes('FileUpload')) {
                  return 'upload-components'
                }
                if (id.includes('NDA') || id.includes('Nda')) {
                  return 'nda-components'
                }
                if (id.includes('CharacterManagement')) {
                  return 'character-components'
                }
              }
              // Services
              if (id.includes('services/')) {
                return 'services'
              }
              // Utilities
              if (id.includes('utils/')) {
                return 'utils'
              }
            }
          },
          // Don't include source code in sourcemaps for security
          sourcemapExcludeSources: true,
        },
        // Treeshaking optimizations
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        },
        // Prevent variable hoisting issues
        preserveEntrySignatures: 'strict',
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
      jsxDev: false, // force production JSX transform
      legalComments: 'none', // Remove all comments
      drop: isProduction ? ['console', 'debugger'] : [],
      pure: isProduction ? ['console.log', 'console.debug'] : [],
      minifyIdentifiers: isProduction,
      minifySyntax: isProduction,
      minifyWhitespace: isProduction,
      target: 'es2020',
      keepNames: true, // Prevents variable name conflicts
    },
    
    // Optimizations
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'axios',
        'zustand',
        'lucide-react',
        'date-fns'
      ],
      exclude: ['@vite/client', '@vite/env'],
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