# 🔐 Vercel Environment Variables Setup

**مهم جداً:** جميع المتغيرات يجب أن تكون في Vercel Dashboard → Settings → Environment Variables

---

## 📋 Environment Variables المطلوبة

### 1️⃣ **Firebase Configuration** (مطلوب)

```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**كيفية الحصول عليها:**
1. افتح [Firebase Console](https://console.firebase.google.com/)
2. اختر المشروع: `alsanicockpit`
3. Settings → Project Settings → General
4. في قسم "Your apps" → Web app → Config

---

### 2️⃣ **PostgreSQL Configuration** (مطلوب)

```
PG_HOST=your_postgres_host
PG_DATABASE=showroom_sales
PG_USER=postgres
PG_PASSWORD=your_postgres_password
PG_PORT=5432
PG_SSL=true
```

**ملاحظة:** 
- `PG_SSL=true` للإنتاج (Vercel)
- `PG_SSL=false` للتطوير المحلي

---

### 3️⃣ **D365 Configuration** (مطلوب)

```
D365_CLIENT_ID=your_client_id
D365_CLIENT_SECRET=your_client_secret
D365_TENANT_ID=your_tenant_id
D365_URL=https://orangepax.operations.eu.dynamics.com
```

**كيفية الحصول عليها:**
- من Azure Portal → App Registrations

---

### 4️⃣ **Other Configuration** (اختياري)

```
CORS_ALLOW_ORIGIN=*
VITE_API_BASE_URL=
VITE_GEMINI_API_KEY= (optional - AI features)
```

---

## 🚀 خطوات الإعداد في Vercel

### 1. افتح Vercel Dashboard:
```
https://vercel.com/kha159-creates-projects/k-a-cockpit/settings/environment-variables
```

### 2. أضف جميع المتغيرات:
- اضغط "Add New"
- أدخل الاسم والقيمة
- اختر Environment: Production, Preview, Development (أو Production فقط)

### 3. تأكد من:
- ✅ جميع المتغيرات موجودة
- ✅ القيم صحيحة
- ✅ Environment محددة بشكل صحيح

---

## ⚠️ مشكلة Firebase API Key

**الخطأ:**
```
API key not valid. Please pass a valid API key.
```

**الحل:**
1. تأكد من أن `VITE_FIREBASE_API_KEY` موجود في Vercel Environment Variables
2. تأكد من أن القيمة صحيحة (من Firebase Console)
3. أعد Deploy بعد إضافة المتغيرات:
   ```bash
   vercel --prod
   ```

---

## 📊 Serverless Functions Limit

**الحد الأقصى لـ Vercel Hobby Plan: 12 functions**

**APIs الحالية (12):**
1. ✅ `api/sales-pg.ts`
2. ✅ `api/sales-d365-sql.ts`
3. ✅ `api/get-stores-pg.ts`
4. ✅ `api/get-stores.ts`
5. ✅ `api/get-employees.ts`
6. ✅ `api/live-sales.ts`
7. ✅ `api/health.ts`
8. ✅ `api/gemini.ts`
9. ✅ `api/get-category-rules.ts`
10. ✅ `api/sales.ts`
11. ✅ `api/fetch-d365-raw.ts`
12. ✅ `api/save-d365-to-sql.ts`

**تم حذف:**
- ❌ `api/test-db.ts` (للاختبار فقط)

---

## ✅ Checklist

- [ ] جميع Firebase variables موجودة في Vercel
- [ ] جميع PostgreSQL variables موجودة في Vercel
- [ ] جميع D365 variables موجودة في Vercel
- [ ] `VITE_FIREBASE_API_KEY` صحيح
- [ ] تم Deploy بعد إضافة المتغيرات
- [ ] لا توجد hardcoded secrets في الكود
- [ ] عدد APIs = 12 (ضمن الحد)

---

🎉 **بعد إكمال هذه الخطوات، التطبيق سيعمل بشكل صحيح!**
