import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  server: {
    host: true,
    sourcemapIgnoreList: (sourcePath) => {
      return sourcePath.includes('node_modules') || sourcePath.includes('installHook')
    },
  },
})
