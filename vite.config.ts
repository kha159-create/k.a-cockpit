
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  
  // Debug: Log environment variables during build (without exposing full values)
  if (mode === 'production') {
    const requiredVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
      'VITE_GEMINI_API_KEY',
    ];
    
    console.log('🔍 Checking environment variables during build...');
    requiredVars.forEach(varName => {
      const value = env[varName] || process.env[varName];
      if (value) {
        const preview = varName.includes('KEY') 
          ? `${value.substring(0, 10)}...` 
          : value;
        console.log(`✅ ${varName}: ${preview}`);
      } else {
        console.error(`❌ ${varName}: MISSING`);
      }
    });
  }
  
  return {
    base: '/k.a-cockpit/',
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
      // Environment variables are loaded automatically by Vite
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