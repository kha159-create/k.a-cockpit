# ✅ قائمة التحقق من الربط - Integration Checklist

## ✅ ما تم إنجازه

### 1. API Endpoint
- ✅ `api/sales-pg.ts` - جاهز ويقرأ من PostgreSQL
- ✅ يدعم الفلترة حسب: year, month, day, storeId
- ✅ يستخدم `gofrugal_outlets_mapping` لتحسين أسماء المعارض
- ✅ يعيد نفس تنسيق الاستجابة المستخدم في النظام

### 2. Data Provider
- ✅ `src/data/dataProvider.ts` محدث
- ✅ `getSalesData()` يستخدم `/api/sales-pg` للبيانات القديمة (2024-2025)
- ✅ Fallback تلقائي للنظام القديم إذا فشل PostgreSQL

### 3. Dependencies
- ✅ `pg` و `@types/pg` مثبتة

### 4. Environment Variables في Vercel
- ✅ `PG_HOST` - IP جهاز المكتب
- ✅ `PG_DATABASE` - showroom_sales
- ✅ `PG_USER` - postgres
- ✅ `PG_PASSWORD` - KhaKha11@
- ✅ `PG_PORT` - 5432
- ✅ `PG_SSL` - false

---

## 🔄 Flow البيانات

```
Frontend (Browser)
    ↓
getSalesData() في dataProvider.ts
    ↓
/api/sales-pg (Vercel API)
    ↓
PostgreSQL على جهاز المكتب
    ↓
البيانات تعود → Frontend
```

---

## 🧪 اختبار الربط

### بعد إعداد PostgreSQL على جهاز المكتب:

1. **افتح الموقع على Vercel**
2. **افتح Console في المتصفح (F12)**
3. **ابحث عن:**
   - `🔗 Fetching PostgreSQL data from: ...`
   - `✅ Found X sales records`
   - أو `❌ Error fetching PostgreSQL sales`

4. **تحقق من البيانات:**
   - افتح صفحة Dashboard
   - اختر سنة 2024 أو 2025
   - يجب أن تظهر البيانات من PostgreSQL

---

## ⚠️ استكشاف الأخطاء

### المشكلة: "Connection refused" أو "Connection timeout"
**الحل:**
- تأكد أن PostgreSQL على جهاز المكتب شغال
- تأكد أن Firewall مفتوح (منفذ 5432)
- تأكد أن `postgresql.conf` معد للاستماع على `*`
- تأكد أن `pg_hba.conf` يسمح بالاتصالات من الخارج

### المشكلة: "Authentication failed"
**الحل:**
- تأكد من كلمة المرور في Vercel Environment Variables
- تأكد من `pg_hba.conf` يستخدم `md5`

### المشكلة: البيانات لا تظهر
**الحل:**
- تحقق من Console في المتصفح
- تحقق من Network tab في DevTools
- تحقق من Vercel Logs

---

## 📝 ملاحظات

- ✅ النظام جاهز للعمل
- ✅ Fallback mechanism موجود (إذا فشل PostgreSQL، يعود للنظام القديم)
- ⏳ يحتاج إعداد PostgreSQL على جهاز المكتب (Firewall + Config)

---

## 🎯 الخطوة التالية

بعد إعداد PostgreSQL على جهاز المكتب:
1. اختبر الموقع على Vercel
2. تحقق من Console
3. تأكد من ظهور البيانات
