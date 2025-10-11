// Test script to verify environment variables are being read
console.log('Testing environment variables...');
console.log('VITE_FIREBASE_API_KEY:', process.env.VITE_FIREBASE_API_KEY ? 'SET' : 'NOT SET');
console.log('VITE_FIREBASE_AUTH_DOMAIN:', process.env.VITE_FIREBASE_AUTH_DOMAIN ? 'SET' : 'NOT SET');
console.log('VITE_GEMINI_API_KEY:', process.env.VITE_GEMINI_API_KEY ? 'SET' : 'NOT SET');
