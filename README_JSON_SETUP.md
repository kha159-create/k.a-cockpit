# 📋 إعداد نظام JSON Files (مثل المشروع المرجعي)

## 🎯 الهدف
استخدام نفس آلية المشروع المرجعي:
- **سكربت محلي** يولد ملفات JSON من PostgreSQL المحلي
- **رفع الملفات إلى GitHub**
- **Vercel API يقرأ من GitHub** بدلاً من الاتصال بقاعدة البيانات مباشرة

---

## 📝 الخطوات

### 1️⃣ توليد ملفات JSON محلياً

```bash
# تشغيل السكربت لتوليد management_data.json
node scripts/generate-json-from-sql.js
```

هذا السكربت:
- ✅ يتصل بقاعدة البيانات المحلية (`localhost`)
- ✅ يولد `public/data/management_data.json`
- ✅ نفس تنسيق المشروع المرجعي

### 2️⃣ رفع الملفات إلى GitHub

```bash
git add public/data/management_data.json
git commit -m "Update management_data.json"
git push
```

### 3️⃣ تحديث Vercel Environment Variables

أضف في Vercel:
```
GITHUB_RAW_BASE=https://raw.githubusercontent.com/kha159-create/k.a-cockpit/main/public/data
```

### 4️⃣ استخدام API الجديد

بدلاً من `/api/sales-pg` (الذي يتصل بقاعدة البيانات)، استخدم:
- `/api/read-json-data?type=management` - يقرأ من GitHub
- `/api/read-json-data?type=employees` - يقرأ من GitHub

---

## 🔄 التحديث التلقائي

### خيار 1: GitHub Actions (موصى به)
أنشئ `.github/workflows/update-json.yml`:

```yaml
name: Update JSON Data
on:
  schedule:
    - cron: '0 */6 * * *'  # كل 6 ساعات
  workflow_dispatch:  # يدوي

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: node scripts/generate-json-from-sql.js
      - run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add public/data/*.json
          git commit -m "Auto-update JSON data" || exit 0
          git push
```

### خيار 2: سكربت محلي + Task Scheduler
- أنشئ `update-json.bat`:
```bat
@echo off
cd /d "C:\Users\Orange1\.cursor\worktrees\cockpit\vmb"
node scripts/generate-json-from-sql.js
git add public/data/*.json
git commit -m "Update JSON data"
git push
```

- اضبط Task Scheduler لتشغيله كل ساعة

---

## ✅ الملفات المطلوبة

1. ✅ `scripts/generate-json-from-sql.js` - توليد JSON محلياً
2. ✅ `api/read-json-data.ts` - قراءة من GitHub
3. ✅ `public/data/management_data.json` - ملف JSON (يُولد تلقائياً)

---

## 🚀 الخطوات التالية

1. ✅ شغّل `node scripts/generate-json-from-sql.js` محلياً
2. ✅ ارفع `public/data/management_data.json` إلى GitHub
3. ✅ حدّث `dataProvider.ts` ليستخدم `/api/read-json-data` بدلاً من `/api/sales-pg`
4. ✅ أضف `GITHUB_RAW_BASE` في Vercel Environment Variables
5. ✅ اختبر من Vercel

---

## 📌 ملاحظات

- ✅ لا حاجة لـ `PG_HOST` في Vercel (فقط محلياً)
- ✅ الملفات JSON تُحدّث محلياً ثم تُرفع
- ✅ Vercel يقرأ من GitHub (أسرع وأبسط)
- ✅ نفس آلية المشروع المرجعي تماماً
