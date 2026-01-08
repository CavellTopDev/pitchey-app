import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// SIMPLIFIED CONFIG TO FIX TDZ ERRORS
export default defineConfig({
  plugins: [
    react({
      // Use automatic JSX runtime
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Force single React instance
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // CRITICAL: Disable minification to avoid TDZ issues
    minify: false,
    
    // Let Vite handle chunking automatically
    rollupOptions: {
      output: {
        // No manual chunks - let Rollup decide
        manualChunks: undefined,
      },
    },
    
    // Standard settings
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})