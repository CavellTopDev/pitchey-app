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
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
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
