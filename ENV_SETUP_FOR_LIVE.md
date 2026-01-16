# إعداد Environment Variables للـ Live API

## القيم المطلوبة من ملف env

من ملف `C:\Users\Orange1\Desktop\item code\env`:

```
CLIENT_ID=your_client_id_here
TENANT_ID=your_tenant_id_here
CLIENT_SECRET=your_client_secret_here
```

## كيفية إضافة Environment Variables في Vercel

### الخطوات:

1. اذهب إلى **Vercel Dashboard** → مشروعك → **Settings** → **Environment Variables**

2. أضف المتغيرات التالية:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `D365_CLIENT_ID` | `your_client_id_here` | Production, Preview, Development |
| `D365_TENANT_ID` | `your_tenant_id_here` | Production, Preview, Development |
| `D365_CLIENT_SECRET` | `your_client_secret_here` | Production, Preview, Development |
| `D365_URL` | `https://orangepax.operations.eu.dynamics.com` | Production, Preview, Development |

3. **Firebase Admin Credentials** (مطلوبة أيضاً):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `FIREBASE_PROJECT_ID` | `your_project_id` | Production, Preview, Development |
| `FIREBASE_CLIENT_EMAIL` | `your_service_account_email` | Production, Preview, Development |
| `FIREBASE_PRIVATE_KEY` | `your_private_key` | Production, Preview, Development |

4. **Security** (اختياري):

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `CRON_SECRET` | `any_random_string` | Production, Preview, Development |

## ملاحظات مهمة

- ✅ **لا تضع ملف `.env` في Git** - استخدم Vercel Environment Variables فقط
- ✅ **CLIENT_SECRET** حساس - لا تشاركه أبداً
- ✅ بعد إضافة المتغيرات، يجب **Redeploy** المشروع في Vercel

## التحقق من الإعداد

بعد إضافة المتغيرات، يمكنك اختبار الـ API:

```bash
# اختبار يدوي (استبدل YOUR_SECRET بالقيمة التي وضعتها)
curl "https://your-domain.vercel.app/api/live-sales?secret=YOUR_SECRET"
```

## استبدال النظام القديم

إذا كنت تستخدم نظام Python مع ملف `.env` محلي:

1. ✅ **استخدم Vercel API بدلاً من Python script**
2. ✅ **البيانات تُحفظ تلقائياً في Firestore**
3. ✅ **لا حاجة لتشغيل Python script يدوياً**
4. ✅ **المزامنة تعمل تلقائياً كل 15 دقيقة**

## المزايا

- 🔄 **تحديث تلقائي** - لا حاجة لتدخل يدوي
- 🔒 **آمن** - Environment Variables محمية في Vercel
- ⚡ **سريع** - Serverless functions
- 📊 **Real-time** - البيانات تظهر مباشرة في الصفحة
