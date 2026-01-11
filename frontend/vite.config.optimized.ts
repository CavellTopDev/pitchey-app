import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { compression } from 'vite-plugin-compression2'

// Performance-optimized Vite configuration
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
    plugins: [
      react({
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
        babel: {
          plugins: isProduction ? [
            ['transform-remove-console', { exclude: ['error', 'warn'] }]
          ] : []
        }
      }),
      
      // Brotli compression for production
      isProduction && compression({
        algorithm: 'brotliCompress',
        exclude: [/\.(png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|svg)$/],
        threshold: 1024,
        compressionOptions: { level: 11 },
        deleteOriginFile: false
      }),
      
      // Gzip compression fallback
      isProduction && compression({
        algorithm: 'gzip',
        exclude: [/\.(png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|svg)$/],
        threshold: 1024,
        compressionOptions: { level: 9 },
        deleteOriginFile: false
      }),
      
      // Bundle analyzer for development
      !isProduction && visualizer({
        open: false,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true
      })
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom', 'react-router-dom']
    },
    
    build: {
      target: 'es2020',
      minify: isProduction ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug'],
          passes: 2
        },
        mangle: {
          safari10: true
        },
        format: {
          comments: false
        }
      },
      
      rollupOptions: {
        output: {
          // Manual chunks for optimal code splitting
          manualChunks: {
            // React core libraries
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            
            // UI components library
            'ui-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-switch',
              '@radix-ui/react-progress',
              '@radix-ui/react-avatar',
              'lucide-react',
              'framer-motion'
            ],
            
            // Data viz
            'charts': ['recharts'],
            
            // Utils
            'utils': [
              'date-fns',
              'clsx',
              'tailwind-merge',
              'class-variance-authority'
            ],
            
            // State and auth
            'state': ['zustand', 'better-auth'],
            
            // Forms and validation
            'forms': ['zod', 'valibot']
          },
          
          // Asset naming with hash for cache busting
          assetFileNames: (assetInfo) => {
            const extType = assetInfo.name.split('.').pop()
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              return 'assets/images/[name]-[hash][extname]'
            }
            if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
              return 'assets/fonts/[name]-[hash][extname]'
            }
            return 'assets/[name]-[hash][extname]'
          },
          
          chunkFileNames: 'chunks/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js'
        },
        
        // Tree shaking
        treeshake: {
          preset: 'recommended',
          moduleSideEffects: false
        }
      },
      
      // Performance optimizations
      sourcemap: isProduction ? false : 'inline',
      chunkSizeWarningLimit: 1000,
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      
      // Advanced optimizations
      cssMinify: isProduction,
      reportCompressedSize: false,
      
      // Module preload polyfill
      modulePreload: {
        polyfill: true
      }
    },
    
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'zustand',
        'better-auth',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu'
      ],
      exclude: ['@vite/client', '@vite/env'],
      esbuildOptions: {
        target: 'es2020'
      }
    },
    
    server: {
      headers: {
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        
        // Cache control for development
        'Cache-Control': 'no-cache'
      }
    },
    
    preview: {
      headers: {
        // Production-like headers for preview
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block'
      }
    },
    
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      '__APP_VERSION__': JSON.stringify(process.env.npm_package_version)
    }
  }
})