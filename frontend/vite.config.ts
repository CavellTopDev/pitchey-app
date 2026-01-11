import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// SIMPLIFIED CONFIG WITH PWA SUPPORT
export default defineConfig(() => {
  return {
    plugins: [
      react({
        // Force production JSX runtime - completely disable development transforms
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
        // Disable Fast Refresh in production builds to prevent dev transforms
        fastRefresh: false,
        // Explicitly set Babel to not include development plugins
        babel: {
          compact: true,
          minified: true,
        },
      }),
    ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Force single React instance
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  esbuild: {
    // Force production JSX transform - no development helpers
    jsx: 'automatic',
    jsxDev: false,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    '__DEV__': 'false',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': JSON.stringify('production'),
  },
  mode: 'production',
  }
})