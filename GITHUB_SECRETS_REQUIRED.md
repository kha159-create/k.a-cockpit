# Environment Variables المطلوبة

## ✅ يمكن إضافتها في GitHub Secrets أو Vercel Dashboard

### 📍 الخيار 1: GitHub Secrets (موصى به - أسهل)
- ✅ **مركزية** - كل Secrets في مكان واحد
- ✅ **مفاتيح Firebase موجودة** - يمكن استخدام نفس المكان
- ✅ **أسهل** - لا حاجة لإضافة في مكانين

**الرابط:** https://github.com/kha159-create/k.a-cockpit/settings/secrets/actions

### 📍 الخيار 2: Vercel Dashboard
- ✅ **مباشر** - للـ Vercel Functions فقط
- ⚠️ **منفصل** - يحتاج إضافة منفصلة

**الرابط:** https://vercel.com/dashboard → مشروعك → Settings → Environment Variables

### 📖 للتفاصيل الكاملة: راجع `GITHUB_SECRETS_SETUP.md` أو `VERCEL_SETUP_GUIDE.md`

---

## Environment Variables التي يجب إضافتها في Vercel

بعد رفع الكود على GitHub، يجب إضافة هذه Environment Variables في **Vercel Dashboard**:

### Microsoft Dynamics 365 Credentials:
```
D365_CLIENT_ID=your_client_id_here
D365_TENANT_ID=your_tenant_id_here
D365_CLIENT_SECRET=your_client_secret_here
D365_URL=https://orangepax.operations.eu.dynamics.com
```

### Firebase Admin Credentials:
```
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key
```

### Security (اختياري):
```
CRON_SECRET=any_random_string_for_security
```

## خطوات الإضافة في Vercel:

1. اذهب إلى **Vercel Dashboard** → مشروعك
2. **Settings** → **Environment Variables**
3. أضف كل متغير مع القيمة
4. اختر **Production, Preview, Development** لكل متغير
5. **Save**
6. **Redeploy** المشروع

## ملاحظات:

- ✅ لا تضع هذه القيم في GitHub Secrets (لأنها للـ Vercel فقط)
- ✅ Vercel Environment Variables منفصلة عن GitHub Secrets
- ✅ بعد إضافة المتغيرات، يجب Redeploy المشروع
