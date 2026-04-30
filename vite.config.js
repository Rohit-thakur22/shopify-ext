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
    // Copy public directory assets to dist
    copyPublicDir: true,
    rollupOptions: {
      output: {
        // ES module output unlocks dynamic-import code splitting. The Shopify
        // block must load this with <script type="module"> for it to run.
        // Rolling back: swap to format: "iife" and remove chunkFileNames /
        // manualChunks; the Liquid <script> tag also needs to drop type="module".
        format: "es",
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'index.css'
          }
          return '[name][extname]'
        },
        // Pin the heavy canvas libraries into their own cacheable chunks so
        // the initial entry stays small and they're cached across deploys.
        manualChunks: (id) => {
          if (id.includes('node_modules/fabric')) return 'fabric';
          if (id.includes('node_modules/konva') || id.includes('node_modules/react-konva')) return 'konva';
        },
      }
    }
  },
  // For dev server
  server: {
    port: 5173,
    open: true
  }
})
