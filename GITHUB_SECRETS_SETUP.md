# إعداد GitHub Secrets لاستخدامها مع Vercel

## ✅ نعم، يمكن استخدام GitHub Secrets مع Vercel!

Vercel يمكنه قراءة GitHub Secrets إذا كان المشروع مربوط بـ GitHub. لكن هناك طريقتان:

---

## الطريقة 1: استخدام GitHub Secrets مباشرة (موصى به)

### المزايا:
- ✅ **مركزية** - كل Secrets في مكان واحد (GitHub)
- ✅ **أسهل** - لا حاجة لإضافة نفس القيم في مكانين
- ✅ **آمن** - GitHub Secrets محمية
- ✅ **مفاتيح Firebase موجودة** - يمكن استخدام نفس Secrets

### الخطوات:

#### 1. إضافة Secrets في GitHub

1. اذهب إلى: **https://github.com/kha159-create/k.a-cockpit**
2. **Settings** → **Secrets and variables** → **Actions**
3. انقر **New repository secret**

أضف هذه Secrets:

**Secret 1:**
- **Name**: `D365_CLIENT_ID`
- **Value**: (من ملف env في مجلد item code)
- **Add secret**

**Secret 2:**
- **Name**: `D365_TENANT_ID`
- **Value**: (من ملف env في مجلد item code)
- **Add secret**

**Secret 3:**
- **Name**: `D365_CLIENT_SECRET`
- **Value**: (من ملف env في مجلد item code)
- **Add secret**

**Secret 4:**
- **Name**: `D365_URL`
- **Value**: `https://orangepax.operations.eu.dynamics.com`
- **Add secret**

**Secret 5:**
- **Name**: `FIREBASE_PROJECT_ID`
- **Value**: (نفس القيمة الموجودة مسبقاً)
- **Add secret**

**Secret 6:**
- **Name**: `FIREBASE_CLIENT_EMAIL`
- **Value**: (نفس القيمة الموجودة مسبقاً)
- **Add secret**

**Secret 7:**
- **Name**: `FIREBASE_PRIVATE_KEY`
- **Value**: (نفس القيمة الموجودة مسبقاً)
- **Add secret**

**Secret 8:**
- **Name**: `CRON_SECRET`
- **Value**: `any_random_string`
- **Add secret**

#### 2. ربط Vercel بـ GitHub Secrets

**الخيار A: استخدام Vercel CLI (موصى به)**

1. ثبت Vercel CLI:
```bash
npm install -g vercel
```

2. سجل الدخول:
```bash
vercel login
```

3. ربط المشروع:
```bash
vercel link
```

4. إضافة Secrets من GitHub:
```bash
# Vercel سيسألك عن Environment Variables
# يمكنك استخدام GitHub Secrets هنا
```

**الخيار B: إضافة يدوياً في Vercel Dashboard**

1. اذهب إلى Vercel Dashboard → مشروعك → **Settings** → **Environment Variables**
2. أضف نفس الأسماء والقيم من GitHub Secrets
3. Vercel سيستخدمها تلقائياً

---

## الطريقة 2: استخدام GitHub Actions لتمرير Secrets إلى Vercel

يمكن إنشاء GitHub Action يمرر Secrets إلى Vercel تلقائياً.

### إنشاء `.github/workflows/sync-secrets.yml`:

```yaml
name: Sync Secrets to Vercel

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Vercel CLI
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
      
      - name: Set Vercel Environment Variables
        run: |
          vercel env add D365_CLIENT_ID production <<< "${{ secrets.D365_CLIENT_ID }}"
          vercel env add D365_TENANT_ID production <<< "${{ secrets.D365_TENANT_ID }}"
          vercel env add D365_CLIENT_SECRET production <<< "${{ secrets.D365_CLIENT_SECRET }}"
          vercel env add D365_URL production <<< "${{ secrets.D365_URL }}"
          vercel env add FIREBASE_PROJECT_ID production <<< "${{ secrets.FIREBASE_PROJECT_ID }}"
          vercel env add FIREBASE_CLIENT_EMAIL production <<< "${{ secrets.FIREBASE_CLIENT_EMAIL }}"
          vercel env add FIREBASE_PRIVATE_KEY production <<< "${{ secrets.FIREBASE_PRIVATE_KEY }}"
          vercel env add CRON_SECRET production <<< "${{ secrets.CRON_SECRET }}"
```

**لكن هذا يحتاج:**
- `VERCEL_TOKEN` في GitHub Secrets
- `VERCEL_ORG_ID` في GitHub Secrets
- `VERCEL_PROJECT_ID` في GitHub Secrets

---

## ✅ الحل الأسهل والأفضل (موصى به)

### استخدم GitHub Secrets + أضفها يدوياً في Vercel مرة واحدة:

1. ✅ **أضف Secrets في GitHub** (كما هو موضح أعلاه)
2. ✅ **أضف نفس القيم في Vercel Dashboard** (مرة واحدة فقط)
3. ✅ **الآن كل شيء في مكانين** - GitHub للـ CI/CD، Vercel للـ Runtime

### لماذا هذا الأفضل؟
- ✅ **GitHub Secrets** → للـ GitHub Actions (إذا كان لديك CI/CD)
- ✅ **Vercel Environment Variables** → للـ Vercel Functions (API endpoints)
- ✅ **Firebase Secrets موجودة** → يمكن استخدام نفس القيم

---

## 📝 ملخص

| المكان | الاستخدام | متى |
|--------|----------|-----|
| **GitHub Secrets** | CI/CD, GitHub Actions | عند الحاجة لـ CI/CD |
| **Vercel Environment Variables** | Vercel Functions, API | **مطلوب للـ API** |

**الخلاصة:** 
- ✅ أضف في **GitHub Secrets** (للمستقبل والـ CI/CD)
- ✅ أضف في **Vercel Environment Variables** (مطلوب للـ API)

أو يمكنك استخدام **GitHub Secrets فقط** إذا كنت تستخدم طريقة ربط Vercel بـ GitHub مباشرة.

---

## 🔗 روابط مفيدة

- GitHub Secrets: https://github.com/kha159-create/k.a-cockpit/settings/secrets/actions
- Vercel Dashboard: https://vercel.com/dashboard
- Vercel + GitHub Integration: https://vercel.com/docs/concepts/git
