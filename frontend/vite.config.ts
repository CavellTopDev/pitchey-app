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
          
          // Disable manual chunking to prevent initialization order issues
          manualChunks: undefined,
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
    
    // Optimizations
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'axios',
        'zustand',
        'lucide-react',
        'date-fns'
      ],
      exclude: ['@vite/client', '@vite/env', 'chart.js', 'react-chartjs-2', 'xlsx', 'html-to-image', '@tanstack/react-query'],
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