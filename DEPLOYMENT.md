# 🚀 دليل النشر - Deployment Guide

## 📋 **متطلبات النشر**

### **1. GitHub Secrets**
يجب إضافة المتغيرات التالية في GitHub Secrets:

#### **Firebase Configuration:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

#### **Gemini AI:**
- `VITE_GEMINI_API_KEY`

### **2. كيفية إضافة Secrets:**

1. **اذهب إلى المشروع على GitHub**
2. **اضغط على "Settings"**
3. **اختر "Secrets and variables"**
4. **اضغط "Actions"**
5. **اضغط "New repository secret"**
6. **أضف كل متغير مع قيمته**

### **3. GitHub Pages Setup:**

1. **اذهب إلى "Settings"**
2. **اختر "Pages"**
3. **اختر "GitHub Actions" كـ Source**
4. **احفظ الإعدادات**

### **4. تفعيل GitHub Pages:**

```bash
# في إعدادات المشروع
Settings → Pages → Source: GitHub Actions
```

## 🔧 **إصلاح أخطاء البناء:**

### **خطأ: Missing Environment Variables**
```bash
# تأكد من إضافة جميع المتغيرات في GitHub Secrets
VITE_FIREBASE_API_KEY=your_key
VITE_GEMINI_API_KEY=your_key
# ... باقي المتغيرات
```

### **خطأ: Build Failed**
```bash
# تأكد من صحة المتغيرات
npm run build
```

### **خطأ: Firebase Connection**
```bash
# تأكد من صحة Firebase configuration
# تأكد من تفعيل Firestore في Firebase Console
```

## 📱 **النشر المحلي:**

### **1. إعداد البيئة:**
```bash
# نسخ ملف البيئة
cp env-template.txt .env

# تعديل القيم في .env
# إضافة مفاتيح Firebase و Gemini
```

### **2. البناء:**
```bash
npm install
npm run build
```

### **3. النشر:**
```bash
# Firebase Hosting
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy

# أو Vercel
npm install -g vercel
vercel deploy
```

## 🌐 **الروابط:**

- **GitHub Repository:** https://github.com/kha159-create/k.a-cockpit
- **GitHub Pages:** https://kha159-create.github.io/k.a-cockpit/
- **Firebase Console:** https://console.firebase.google.com/
- **Gemini API:** https://makersuite.google.com/app/apikey

## ⚠️ **ملاحظات مهمة:**

1. **لا تشارك مفاتيح API** في الكود
2. **استخدم Secrets** في GitHub Actions
3. **تأكد من تفعيل Firestore** في Firebase
4. **تحقق من صحة CORS** في Firebase
5. **اختبر التطبيق** قبل النشر

## 🆘 **استكشاف الأخطاء:**

### **خطأ 404:**
- تأكد من صحة مسار `base` في `vite.config.ts`
- تحقق من إعدادات GitHub Pages

### **خطأ Firebase:**
- تأكد من صحة Firebase configuration
- تحقق من قواعد Firestore Security

### **خطأ Gemini:**
- تأكد من صحة API key
- تحقق من quotas في Google AI Studio

---
**تم إنشاء هذا الدليل لمساعدتك في نشر المشروع بنجاح! 🎉**
