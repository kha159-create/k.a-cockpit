# 🚀 Deployment Guide - دليل النشر

## 📋 Prerequisites - المتطلبات المسبقة

### 1. GitHub Secrets Setup - إعداد أسرار GitHub

قبل نشر المشروع، يجب إضافة المفاتيح التالية إلى GitHub Secrets:

#### 🔐 Required Secrets - الأسرار المطلوبة:

1. **VITE_FIREBASE_API_KEY**
   - Value: `AIzaSyD7p6iK1b0lG7sGP187VU7tBlTZyGo1wBA`

2. **VITE_FIREBASE_AUTH_DOMAIN**
   - Value: `alsani-cockpit-v3.firebaseapp.com`

3. **VITE_FIREBASE_PROJECT_ID**
   - Value: `alsani-cockpit-v3`

4. **VITE_FIREBASE_STORAGE_BUCKET**
   - Value: `alsani-cockpit-v3.firebasestorage.app`

5. **VITE_FIREBASE_MESSAGING_SENDER_ID**
   - Value: `1055161240393`

6. **VITE_FIREBASE_APP_ID**
   - Value: `1:1055161240393:web:64428acfb48922fbc76898`

7. **VITE_GEMINI_API_KEY**
   - Value: `AIzaSyBJeuf5Ne_IsEvgKlxIfbsOS7Sm9Xjl4Ws`

### 2. How to Add Secrets - كيفية إضافة الأسرار:

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the exact name and value listed above
6. Click **Add secret**

## 🔄 Automated Deployment Process - عملية النشر التلقائي

### What Happens on Push - ما يحدث عند الدفع:

1. **Code Checkout** - استخراج الكود
2. **Node.js Setup** - إعداد Node.js 18
3. **Dependencies Installation** - تثبيت الاعتمادات
4. **Build with Secrets** - البناء مع الأسرار
5. **Build Verification** - التحقق من البناء
6. **Firebase Connection Test** - اختبار اتصال Firebase
7. **GitHub Pages Deployment** - نشر على GitHub Pages

### Build Verification Steps - خطوات التحقق من البناء:

```bash
✅ Build completed successfully!
📁 Build artifacts found in dist/ directory
✅ Firebase connected successfully!
🔥 Firebase App initialized: [DEFAULT]
✅ Ready to deploy!
```

### Deployment Output - مخرجات النشر:

```
🚀 Deployment completed successfully!
🌐 Your app is now live at: https://[username].github.io/[repository-name]
📅 Deployed at: [timestamp]
```

## 🛠️ Manual Testing - الاختبار اليدوي

### Local Development - التطوير المحلي:

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables - متغيرات البيئة:

For local development, create `.env.local` file:

```env
VITE_FIREBASE_API_KEY=AIzaSyD7p6iK1b0lG7sGP187VU7tBlTZyGo1wBA
VITE_FIREBASE_AUTH_DOMAIN=alsani-cockpit-v3.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=alsani-cockpit-v3
VITE_FIREBASE_STORAGE_BUCKET=alsani-cockpit-v3.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1055161240393
VITE_FIREBASE_APP_ID=1:1055161240393:web:64428acfb48922fbc76898
VITE_GEMINI_API_KEY=AIzaSyBJeuf5Ne_IsEvgKlxIfbsOS7Sm9Xjl4Ws
```

## 🔍 Troubleshooting - استكشاف الأخطاء

### Common Issues - المشاكل الشائعة:

1. **Build Fails** - فشل البناء:
   - Check if all GitHub Secrets are set correctly
   - Verify Firebase project configuration

2. **Firebase Connection Fails** - فشل اتصال Firebase:
   - Verify API keys in Firebase Console
   - Check if Firebase project is active

3. **Deployment Fails** - فشل النشر:
   - Check GitHub Pages settings
   - Verify repository permissions

### Debug Commands - أوامر التصحيح:

```bash
# Check build locally
npm run build

# Test Firebase connection
node firebase-test.js

# Check environment variables
echo $VITE_FIREBASE_API_KEY
```

## 📊 Monitoring - المراقبة

### GitHub Actions Logs - سجلات GitHub Actions:

1. Go to your repository
2. Click **Actions** tab
3. Click on the latest workflow run
4. Check logs for any errors

### Firebase Console - وحدة تحكم Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `alsani-cockpit-v3`
3. Check **Authentication** and **Firestore** usage

## 🔒 Security Notes - ملاحظات الأمن

- ✅ All secrets are encrypted in GitHub
- ✅ No sensitive data in source code
- ✅ Environment variables only in CI/CD
- ✅ Local development uses `.env.local` (not committed)

---

**Ready to deploy! 🚀**

Make sure all GitHub Secrets are set before pushing to main branch.
