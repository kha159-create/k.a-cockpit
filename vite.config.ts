
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  
  return {
    base: './',
    plugins: [react()],
    publicDir: 'public',
    build: {
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    },
    define: {
      // No environment variables needed - using hardcoded values
    },
    envPrefix: 'VITE_',
    resolve: {
      alias: {
        // FIX: Replaced __dirname with './src' which path.resolve can use from the project root.
        '@': path.resolve('./src'),
      },
    },
  }
})