# ربط PostgreSQL مع النظام - PostgreSQL Integration

## ✅ ما تم إنجازه

### 1. إنشاء API Endpoint جديد
- **الملف**: `api/sales-pg.ts`
- **الوظيفة**: قراءة بيانات المبيعات من PostgreSQL (2024-2025)
- **المصدر**: `gofrugal_sales` table
- **الحالة**: ✅ **جاهز**

### 2. تحديث Data Provider
- **الملف**: `src/data/dataProvider.ts`
- **التغيير**: `getSalesData()` يستخدم الآن `/api/sales-pg` للبيانات القديمة (2024-2025)
- **Fallback**: إذا فشل PostgreSQL، يعود تلقائياً إلى النظام القديم
- **الحالة**: ✅ **محدث**

### 3. تثبيت Dependencies
- **Package**: `pg` و `@types/pg`
- **الحالة**: ✅ **مثبت**

## 🔧 البنية

### API Endpoint: `/api/sales-pg`

**Parameters**:
- `year` (required): 2024 أو 2025
- `month` (optional): 1-12
- `day` (optional): 1-31
- `storeId` (optional): معرض محدد

**Response Format**:
```json
{
  "success": true,
  "range": {
    "from": "2024-01-01",
    "to": "2024-01-31",
    "year": 2024,
    "month": 1
  },
  "byStore": [
    {
      "storeId": "01-Jeddah INT Market",
      "storeName": "01-Jeddah INT Market",
      "salesAmount": 123456.78,
      "invoices": 1234,
      "kpis": {
        "atv": 100.05,
        "customerValue": 100.05
      }
    }
  ],
  "byDay": [
    {
      "date": "2024-01-01",
      "byStore": [...]
    }
  ],
  "byEmployee": [],
  "totals": {
    "salesAmount": 1234567.89,
    "invoices": 12345,
    "kpis": {
      "atv": 100.05,
      "customerValue": 100.05
    }
  },
  "debug": {
    "source": "postgresql",
    "notes": [...]
  }
}
```

## 🔄 Flow البيانات

### قبل (Legacy):
```
Frontend → getSalesData() → getLegacyMetrics() → management_data.json
```

### بعد (PostgreSQL):
```
Frontend → getSalesData() → /api/sales-pg → PostgreSQL (gofrugal_sales)
```

### Fallback:
```
PostgreSQL فشل → getLegacyMetrics() → management_data.json
```

## ⚙️ Configuration

### Environment Variables (لـ Vercel):
```
PG_HOST=localhost (أو IP السيرفر)
PG_DATABASE=showroom_sales
PG_USER=postgres
PG_PASSWORD=your_postgres_password
PG_PORT=5432
PG_SSL=false (للتطوير المحلي)
```

### Local Development:
- يستخدم القيم الافتراضية في الكود
- يمكن تعديلها عبر environment variables

## 📊 الميزات

1. **Store Mapping**: يستخدم `gofrugal_outlets_mapping` لتحسين أسماء المعارض
2. **Aggregation**: تجميع على مستوى المعرض واليوم
3. **Performance**: استعلامات SQL محسّنة مع indexes
4. **Error Handling**: Fallback تلقائي للنظام القديم
5. **CORS Support**: يدعم cross-origin requests

## ✅ الخلاصة

- ✅ API endpoint جاهز (`/api/sales-pg`)
- ✅ Data provider محدث
- ✅ Dependencies مثبتة
- ✅ Build ناجح
- ✅ Fallback mechanism موجود

**الخطوة التالية**: اختبار API والتأكد من أن البيانات تظهر بشكل صحيح في النظام.
