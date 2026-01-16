# دليل سريع: المزامنة التلقائية من Microsoft 365

## ✅ ما تم إنجازه

تم إعداد نظام مزامنة تلقائي يجلب البيانات من Microsoft Dynamics 365 **كل يوم في نهاية اليوم** (الساعة 1:00 صباحاً) ويحفظها تلقائياً في Firebase.

## 📋 خطوات الإعداد (5 دقائق)

### 1. إضافة Environment Variables في Vercel

اذهب إلى: **Vercel Dashboard → Your Project → Settings → Environment Variables**

أضف المتغيرات التالية:

```
D365_CLIENT_ID=your_client_id_here
D365_CLIENT_SECRET=your_client_secret_here
D365_TENANT_ID=your_tenant_id_here
D365_URL=https://orangepax.operations.eu.dynamics.com

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key_here

CRON_SECRET=any_random_string_for_security
```

### 2. الحصول على Firebase Service Account

1. اذهب إلى [Firebase Console](https://console.firebase.google.com)
2. اختر مشروعك → ⚙️ Settings → Service Accounts
3. انقر على **"Generate New Private Key"**
4. استخرج من الملف:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (انسخ الكامل)

### 3. نشر التحديثات

```bash
git add .
git commit -m "Add D365 auto-sync"
git push
```

Vercel سيقوم بنشر التحديثات تلقائياً.

## ⏰ متى تعمل المزامنة؟

- **تلقائياً**: كل يوم في الساعة **1:00 صباحاً UTC** (4:00 صباحاً بتوقيت السعودية)
- تجلب بيانات **اليوم السابق** (Yesterday)
- **لا حاجة لأي تدخل منك!**

## 🔍 كيف تتحقق من أن المزامنة تعمل؟

### الطريقة 1: Vercel Logs
1. اذهب إلى Vercel Dashboard → Functions
2. ابحث عن `/api/sync-d365`
3. افحص Logs

### الطريقة 2: Firestore
1. اذهب إلى Firebase Console → Firestore
2. افحص collection `sync_logs`
3. ستجد آخر مزامنة مع التفاصيل

### الطريقة 3: اختبار يدوي
افتح في المتصفح:
```
https://your-domain.vercel.app/api/sync-d365?secret=YOUR_CRON_SECRET
```

## 📊 البيانات المحفوظة

البيانات تُحفظ في:
- `dailyMetrics` collection
- `salesTransactions` collection

## ❓ مشاكل شائعة

### المزامنة لا تعمل؟
1. تأكد من إضافة جميع Environment Variables
2. تأكد من صحة Firebase credentials
3. افحص Vercel Logs للأخطاء

### البيانات لا تظهر؟
1. تأكد من وجود stores في Firestore collection `stores`
2. تأكد من أن Store IDs في D365 تطابق Store IDs في Firestore

## 📞 الدعم

للمزيد من التفاصيل، راجع: `D365_SYNC_SETUP.md`
