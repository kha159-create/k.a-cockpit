# دليل إعداد Vercel Dashboard - خطوة بخطوة

## 📍 الوصول إلى Vercel Dashboard

### الطريقة 1: من الموقع الرسمي
1. اذهب إلى: **https://vercel.com**
2. سجل الدخول بحسابك (GitHub, GitLab, أو Bitbucket)
3. ستجد قائمة المشاريع (Projects)

### الطريقة 2: من GitHub
1. اذهب إلى repository الخاص بك على GitHub
2. ابحث عن رابط Vercel في README أو Settings
3. أو اذهب مباشرة إلى: **https://vercel.com/dashboard**

---

## 🔧 إضافة Environment Variables

### الخطوة 1: فتح المشروع
1. في Vercel Dashboard، ابحث عن مشروع **k.a-cockpit** أو اسم المشروع الخاص بك
2. انقر على المشروع لفتحه

### الخطوة 2: فتح Settings
1. في أعلى الصفحة، انقر على تبويب **Settings** (الإعدادات)
2. من القائمة الجانبية، اختر **Environment Variables**

### الخطوة 3: إضافة المتغيرات
لكل متغير، انقر على **Add New** وأدخل:

#### 1. Microsoft Dynamics 365 Credentials

**المتغير الأول:**
- **Name**: `D365_CLIENT_ID`
- **Value**: `your_client_id_here` (من ملف env في مجلد item code)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

**المتغير الثاني:**
- **Name**: `D365_TENANT_ID`
- **Value**: `your_tenant_id_here` (من ملف env في مجلد item code)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

**المتغير الثالث:**
- **Name**: `D365_CLIENT_SECRET`
- **Value**: `your_client_secret_here` (من ملف env في مجلد item code)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

**المتغير الرابع:**
- **Name**: `D365_URL`
- **Value**: `https://orangepax.operations.eu.dynamics.com`
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

#### 2. Firebase Admin Credentials

**المتغير الخامس:**
- **Name**: `FIREBASE_PROJECT_ID`
- **Value**: `your_firebase_project_id` (استبدل بقيمة مشروعك)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

**المتغير السادس:**
- **Name**: `FIREBASE_CLIENT_EMAIL`
- **Value**: `your_service_account_email` (من Firebase Service Account)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

**المتغير السابع:**
- **Name**: `FIREBASE_PRIVATE_KEY`
- **Value**: `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` (انسخ الكامل)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

#### 3. Security (اختياري)

**المتغير الثامن:**
- **Name**: `CRON_SECRET`
- **Value**: `any_random_string_here` (مثل: `mySecret123!@#`)
- **Environment**: ✅ Production ✅ Preview ✅ Development
- **Save**

---

## 🔄 Redeploy المشروع

بعد إضافة جميع Environment Variables:

1. اذهب إلى تبويب **Deployments**
2. ابحث عن آخر deployment
3. انقر على **⋮** (ثلاث نقاط) بجانب Deployment
4. اختر **Redeploy**
5. تأكد من اختيار **Use existing Build Cache** = ❌ (غير مفعّل)
6. انقر **Redeploy**

أو ببساطة:
- اذهب إلى **Settings** → **Git**
- انقر **Redeploy** بجانب آخر commit

---

## ✅ التحقق من الإعداد

### 1. فحص Logs
1. اذهب إلى **Deployments**
2. انقر على آخر deployment
3. انقر على **Functions** tab
4. ابحث عن `/api/live-sales` أو `/api/sync-d365`
5. افحص Logs للتأكد من عدم وجود أخطاء

### 2. اختبار API يدوياً
افتح في المتصفح:
```
https://your-project.vercel.app/api/live-sales?secret=YOUR_CRON_SECRET
```

يجب أن ترى:
```json
{
  "success": true,
  "message": "Live sales updated",
  ...
}
```

---

## 📸 لقطات شاشة (Screen Shots)

### موقع Environment Variables:
```
Vercel Dashboard
  └── Your Project
      └── Settings
          └── Environment Variables ← هنا!
```

### شكل إضافة متغير:
```
┌─────────────────────────────────────┐
│ Add New Environment Variable       │
├─────────────────────────────────────┤
│ Key: D365_CLIENT_ID                │
│ Value: [your_client_id_here]       │
│                                     │
│ ☑ Production                       │
│ ☑ Preview                          │
│ ☑ Development                      │
│                                     │
│ [Cancel]  [Save]                   │
└─────────────────────────────────────┘
```

---

## 🆘 حل المشاكل

### المشكلة: لا أجد Environment Variables
- تأكد أنك في تبويب **Settings**
- ابحث عن **Environment Variables** في القائمة الجانبية

### المشكلة: API لا يعمل
- تأكد من إضافة جميع المتغيرات
- تأكد من Redeploy بعد إضافة المتغيرات
- افحص Logs في Deployments

### المشكلة: Firebase credentials خطأ
- تأكد من نسخ Private Key كاملاً (بما في ذلك `\n`)
- تأكد من Project ID و Client Email صحيحة

---

## 📝 ملاحظات مهمة

1. ✅ **لا تضع Environment Variables في GitHub** - استخدم Vercel فقط
2. ✅ **Redeploy ضروري** - بعد إضافة متغيرات جديدة
3. ✅ **اختر جميع Environments** - Production, Preview, Development
4. ✅ **Private Key** - انسخ الكامل بما في ذلك `-----BEGIN` و `-----END`

---

## 🔗 روابط مفيدة

- Vercel Dashboard: https://vercel.com/dashboard
- Vercel Docs: https://vercel.com/docs
- Environment Variables Guide: https://vercel.com/docs/projects/environment-variables
