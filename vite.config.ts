
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // ⬇️ حمّل كل المتغيرات من .env files و process.env
  // دمج loadEnv مع process.env لضمان قراءة VITE_* من GitHub Actions
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...Object.fromEntries(
      Object.entries(process.env)
        .filter(([key]) => key.startsWith('VITE_'))
        .map(([key, value]) => [key, value || ''])
    ),
  }

  // Force inline replacements — يمنع أي undefined في الإنتاج
  const inlineEnv = {
    'import.meta.env.VITE_FIREBASE_API_KEY':        JSON.stringify(env.VITE_FIREBASE_API_KEY),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN':    JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID':     JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    'import.meta.env.VITE_FIREBASE_APP_ID':         JSON.stringify(env.VITE_FIREBASE_APP_ID),
    // (عاملة فقط لو بتستخدمها بالفرونت) — الأفضل إن جيميني يكون بالسيرفر
    'import.meta.env.VITE_GEMINI_API_KEY':          JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
  }

  return {
    base: '/k.a-cockpit/',
    plugins: [react()],
    publicDir: 'public',
    define: inlineEnv,
    build: {
      minify: 'terser',
      terserOptions: {
        compress: { drop_console: true, drop_debugger: true },
      },
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    },
    envPrefix: 'VITE_',
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
  }
})