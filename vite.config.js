import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use root-relative paths (works with any CDN)
  base: '/',
  build: {
    // Output to dist folder for deployment
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: "iife",
        entryFileNames: 'index.js',
        assetFileNames: (assetInfo) => {
          // Keep CSS as index.css
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'index.css'
          }
          // Keep other assets with their names
          return '[name][extname]'
        }
      }
    }
  },
  // For dev server
  server: {
    port: 5173,
    open: true
  }
})
