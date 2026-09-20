/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  test: {
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Without an explicit group the vendor runtime lands in whichever chunk
        // happens to import it first, and the file gets named after that
        // chunk's entry module — which produced an 83 kB React + react-router
        // bundle called `spinner-*.js`. Naming the group makes the chunk
        // self-describing when auditing the build output.
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 100,
            },
            {
              name: 'vendor-data',
              test: /[\\/]node_modules[\\/](@tanstack|i18next|react-i18next)[\\/]/,
              priority: 90,
            },
          ],
        },
      },
    },
  },
})
