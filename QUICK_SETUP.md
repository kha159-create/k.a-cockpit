# ⚡ Quick Setup Guide - دليل الإعداد السريع

## 🚀 GitHub Secrets Setup (5 minutes)

### Step 1: Go to Repository Settings
1. Go to your GitHub repository: `https://github.com/kha159-create/k.a-cockpit`
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**

### Step 2: Add These 7 Secrets
Click **"New repository secret"** for each:

| Secret Name | Secret Value |
|-------------|--------------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyD7p6iK1b0lG7sGP187VU7tBlTZyGo1wBA` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `alsani-cockpit-v3.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `alsani-cockpit-v3` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `alsani-cockpit-v3.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `1055161240393` |
| `VITE_FIREBASE_APP_ID` | `1:1055161240393:web:64428acfb48922fbc76898` |
| `VITE_GEMINI_API_KEY` | `AIzaSyBJeuf5Ne_IsEvgKlxIfbsOS7Sm9Xjl4Ws` |

### Step 3: Enable GitHub Pages
1. Go to **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Save

### Step 4: Test Deployment
1. Make any small change to README.md
2. Commit and push to main branch
3. Go to **Actions** tab to watch deployment
4. Your app will be live at: `https://kha159-create.github.io/k.a-cockpit`

## ✅ Verification Checklist

- [ ] All 7 secrets added to GitHub
- [ ] GitHub Pages enabled
- [ ] First deployment triggered
- [ ] Firebase connection test passed
- [ ] App accessible via GitHub Pages URL

## 🎯 Expected Results

After successful deployment, you should see:
- ✅ Build completed successfully!
- ✅ Firebase connection verified!
- ✅ Ready to deploy!
- 🚀 Deployment completed successfully!

---

**Total setup time: ~5 minutes** ⏱️
