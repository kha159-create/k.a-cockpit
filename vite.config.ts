
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars from .env files AND process.env (for GitHub Actions)
  // process.env takes precedence for CI/CD environments
  const env = {
    ...loadEnv(mode, '.', ''),
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([key]) => key.startsWith('VITE_'))
        .map(([key, value]) => [key, value || ''])
    ),
  };
  
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
    console.log('Source: process.env (GitHub Actions) + .env files');
    requiredVars.forEach(varName => {
      const value = env[varName];
      if (value) {
        const preview = varName.includes('KEY') 
          ? `${value.substring(0, 10)}...` 
          : value;
        console.log(`✅ ${varName}: ${preview}`);
      } else {
        console.error(`❌ ${varName}: MISSING`);
        console.error(`   Checked process.env.${varName}: ${process.env[varName] ? 'EXISTS' : 'NOT FOUND'}`);
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
    // Explicitly define env vars to ensure they're injected during build
    // This is necessary because Vite may not always read from process.env correctly
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY || ''),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN || ''),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID || ''),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET || ''),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID || ''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
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