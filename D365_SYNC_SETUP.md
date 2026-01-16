# إعداد المزامنة التلقائية من Microsoft Dynamics 365

## نظرة عامة

تم إعداد نظام مزامنة تلقائي يجلب البيانات من Microsoft Dynamics 365 كل يوم في نهاية اليوم (الساعة 1:00 صباحاً) ويحفظها في Firebase Firestore.

## المكونات

### 1. API Endpoint (`api/sync-d365.ts`)
- يجلب البيانات من D365 API
- يحول البيانات إلى تنسيق Firestore
- يحفظ البيانات في collections: `dailyMetrics` و `salesTransactions`

### 2. Vercel Cron Job (`vercel.json`)
- يعمل تلقائياً كل يوم في الساعة 1:00 صباحاً (UTC)
- يستدعي `/api/sync-d365` تلقائياً

## متطلبات الإعداد

### 1. Environment Variables في Vercel

أضف المتغيرات التالية في Vercel Dashboard → Settings → Environment Variables:

#### Microsoft Dynamics 365 Credentials:
```
D365_CLIENT_ID=your_client_id
D365_CLIENT_SECRET=your_client_secret
D365_TENANT_ID=your_tenant_id
D365_URL=https://orangepax.operations.eu.dynamics.com
```

#### Firebase Admin Credentials:
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key
```

#### Security (اختياري):
```
CRON_SECRET=your_random_secret_string
```

### 2. Firebase Service Account

1. اذهب إلى Firebase Console → Project Settings → Service Accounts
2. انقر على "Generate New Private Key"
3. احفظ الملف واستخرج:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (انسخ الكامل بما في ذلك `\n`)

### 3. Microsoft Dynamics 365 API Setup

تأكد من أن لديك:
- Azure AD App Registration مع Client ID و Secret
- الصلاحيات المطلوبة للوصول إلى RetailTransactions API
- Tenant ID الخاص بك

## كيفية العمل

### المزامنة التلقائية
- تعمل كل يوم في الساعة 1:00 صباحاً (UTC)
- تجلب بيانات اليوم السابق (Yesterday)
- تحفظ البيانات في Firestore تلقائياً

### المزامنة اليدوية (اختياري)

يمكنك استدعاء API يدوياً:

```bash
# باستخدام secret
curl -X GET "https://your-domain.vercel.app/api/sync-d365?secret=YOUR_CRON_SECRET"

# أو باستخدام Bearer token
curl -X POST "https://your-domain.vercel.app/api/sync-d365" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## البيانات المحفوظة

### Collection: `dailyMetrics`
```javascript
{
  date: Timestamp,
  store: string,
  totalSales: number,
  transactions: number,
  lastSynced: Timestamp
}
```

### Collection: `salesTransactions`
```javascript
{
  date: Timestamp,
  store: string,
  totalSales: number,
  transactionCount: number,
  lastSynced: Timestamp
}
```

## سجلات المزامنة

يتم حفظ سجلات المزامنة في collection `sync_logs`:
```javascript
{
  status: 'success' | 'error',
  message: string,
  details: object,
  timestamp: Timestamp
}
```

## استكشاف الأخطاء

### 1. فحص السجلات
- اذهب إلى Vercel Dashboard → Functions → Logs
- ابحث عن `/api/sync-d365`

### 2. فحص Firestore
- اذهب إلى Firebase Console → Firestore
- افحص collection `sync_logs` لرؤية آخر مزامنة

### 3. اختبار يدوي
استخدم curl أو Postman لاختبار API يدوياً

## ملاحظات مهمة

1. **التوقيت**: Cron Job يعمل على UTC، تأكد من حساب التوقيت المحلي
2. **البيانات المكررة**: النظام يستخدم `merge: true` لتحديث البيانات الموجودة
3. **Store Mapping**: النظام يستخدم بيانات `stores` collection في Firestore لربط Store IDs بالأسماء
4. **الأخطاء**: في حالة حدوث خطأ، يتم تسجيله في `sync_logs` collection

## التحديثات المستقبلية

- إضافة دعم لبيانات الموظفين
- إضافة دعم لبيانات المنتجات
- إضافة إشعارات عند فشل المزامنة
- إضافة dashboard لعرض حالة المزامنة
