# 🚨 URGENT: GitHub Secrets Setup Required

## ⚠️ Current Issue
The deployed site shows "Missing or insufficient permissions" because GitHub Actions is not passing environment variables to the build process.

## ✅ Solution
You MUST add these secrets to GitHub for the deployment to work:

### 🔗 Quick Link:
**https://github.com/kha159-create/k.a-cockpit/settings/secrets/actions**

### 📋 Required Secrets (Copy & Paste):

| Secret Name | Secret Value |
|-------------|--------------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyD7p6iK1b0lG7sGP187VU7tBlTZyGo1wBA` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `alsani-cockpit-v3.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `alsani-cockpit-v3` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `alsani-cockpit-v3.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1055161240393` |
| `VITE_FIREBASE_APP_ID` | `1:1055161240393:web:64428acfb48922fbc76898` |
| `VITE_GEMINI_API_KEY` | `AIzaSyBJeuf5Ne_IsEvgKlxIfbsOS7Sm9Xjl4Ws` |

## 🚀 Steps:
1. Click the link above
2. Click "New repository secret"
3. Add each secret with exact name and value
4. Click "Add secret"
5. Repeat for all 7 secrets

## 🎯 After Setup:
1. Make any small change (like updating this file)
2. Commit and push to trigger deployment
3. Check Actions tab for successful build
4. Site will work at: https://kha159-create.github.io/k.a-cockpit/

---

**⏱️ This will take 3 minutes to fix the deployment issue.**
