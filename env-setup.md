# Environment Setup Instructions

## Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Gemini AI API Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

## How to Get Your API Keys

### Gemini API Key
1. Visit: https://makersuite.google.com/app/apikey
2. Create a new API key
3. Copy the key to `VITE_GEMINI_API_KEY`

### Firebase Configuration
1. Go to: https://console.firebase.google.com/
2. Select your project (or create a new one)
3. Go to Project Settings > General > Your apps
4. Copy the configuration values to the respective environment variables

## Important Notes
- Never commit `.env.local` to version control
- The Firebase config in `src/services/firebase.ts` has fallback values for development
- AI features will be disabled if `VITE_GEMINI_API_KEY` is not set
- Make sure to replace all placeholder values with your actual credentials
