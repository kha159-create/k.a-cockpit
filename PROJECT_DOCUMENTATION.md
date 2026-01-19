# 📚 وثائق المشروع - K.A Cockpit Dashboard

## 🎯 نظرة عامة

مشروع **Cockpit Dashboard** هو لوحة تحكم متقدمة لإدارة المبيعات والتحليلات. يعتمد النظام على **نموذج هجين** يجمع بين البيانات المحلية التاريخية (2024/2025) وبيانات D365 المباشرة (2026+).

---

## 📊 مصادر البيانات (Hybrid Data Model)

### 1. البيانات المحلية (Legacy Data) - 2024 & 2025

**المصدر:**
- ملفات JSON محلية من مشروع `ALAAWF2/orange-dashboard`
- ملف `managementData.ts` - بيانات المبيعات التاريخية
- ملف `management_data.json` من GitHub:
  ```
  https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/management_data.json
  ```

**البيانات المتوفرة:**
- ✅ بيانات المبيعات (Sales Data)
- ✅ الأهداف الشهرية (Targets) - من `management_data.json`
- ✅ عدد الزوار (Visitors) - من `management_data.json`
- ✅ أسماء المعارض (Store Names) - من `/api/get-stores` أو `management_data.json`

**الملفات المسؤولة:**
- `src/data/legacyProvider.ts` - معالج البيانات التاريخية
- `src/data/managementData.ts` - البيانات المحلية

---

### 2. بيانات D365 المباشرة (Live Data) - 2026+

**المصدر:**
- API Endpoint: `/api/sales?year=2026`
- API Endpoint: `/api/get-stores` - قائمة المعارض
- API Endpoint: `/api/get-employees` - قائمة الموظفين
- API Endpoint: `/api/get-live-sales` - المبيعات المباشرة (Live Page)

**البيانات المتوفرة:**
- ✅ بيانات المبيعات اليومية من D365
- ✅ بيانات المعارض (من API)
- ✅ بيانات الموظفين (من API)
- ⚠️ **Targets & Visitors** - لا تأتي من D365، يجب دمجها من `management_data.json`

**الملفات المسؤولة:**
- `api/sales.ts` - API endpoint للمبيعات
- `src/data/dataProvider.ts` - معالج البيانات من API

---

### 3. دمج Targets & Visitors (Client-Side)

**المشكلة:**
- D365 لا يوفر Targets & Visitors
- يجب دمجها من `management_data.json` على Frontend

**الحل:**
- ✅ `loadTargetsAndVisitors()` - تحميل Targets & Visitors من GitHub
- ✅ `mergeTargetsAndVisitors()` - دمجها مع بيانات المبيعات
- ✅ يتم الدمج **مرة واحدة فقط** عند التحميل في `DataProvider.tsx`

**المكان:**
- `src/data/dataProvider.ts` - وظائف التحميل والدمج
- `src/context/DataProvider.tsx` - دمج أثناء التهيئة

---

## 🏗️ البنية المعمارية

### 1. DataProvider (Context Provider)

**الملف:** `src/context/DataProvider.tsx`

**الوظيفة:**
- تحميل **جميع البيانات** (2024, 2025, 2026) عند بدء التطبيق
- استخدام `Promise.allSettled` لتحميل متوازٍ ومقاوم للأخطاء
- دمج Targets & Visitors مع بيانات المبيعات **مرة واحدة فقط**
- تخزين البيانات في `allSalesData`:
  ```typescript
  {
    2024: NormalizedSalesResponse,
    2025: NormalizedSalesResponse,
    2026: NormalizedSalesResponse
  }
  ```

**البيانات المحملة:**
```typescript
const [year2024, year2025, year2026, targetsVisitors] = await Promise.allSettled([
  getSalesData({ year: 2024 }), // Legacy
  getSalesData({ year: 2025 }), // Legacy
  getSalesData({ year: 2026 }), // D365 (raw, without targets/visitors)
  loadTargetsAndVisitors(), // Load targets/visitors once
]);
```

**المزايا:**
- ✅ لا يوجد تحميل عند التنقل بين الصفحات
- ✅ جميع البيانات جاهزة في الذاكرة
- ✅ دمج Targets/Visitors مرة واحدة فقط (ليس في render loop)

---

### 2. MainLayout (Container Component)

**الملف:** `src/components/MainLayout.tsx`

**الوظيفة:**
- إدارة حالة التطبيق الرئيسية
- توفير البيانات لجميع الصفحات
- إدارة الفلاتر (Date & Area/Store Filters)
- تحويل `allSalesData` إلى `DailyMetric[]` حسب الفلتر

**الفلاتر:**

#### أ) فلتر التاريخ الموحد (Unified DateFilter)
- ✅ **موحد** عبر جميع الصفحات (Dashboard, Stores, Products, Employees, Commissions)
- ✅ عند تغيير التاريخ في أي صفحة، يتغير في جميع الصفحات
- ⚠️ **صفحة Live مستثناة** - لا تستخدم فلتر التاريخ

#### ب) فلاتر Area/Store (منفصلة لكل صفحة)
- ✅ `storesAreaStoreFilter` - خاص بصفحة المعارض فقط
- ✅ `areaStoreFilter` - للصفحات الأخرى
- ✅ يتم حفظ `storesAreaStoreFilter` في `localStorage` تلقائياً

**التحويل من allSalesData إلى DailyMetric[]:**
```typescript
const convertAllSalesDataToDailyMetrics = (year: number, month: number) => {
  // يحول NormalizedSalesResponse إلى DailyMetric[]
  // يقوم بفلترة حسب year و month
  // يدمج بيانات 2024/2025/2026 حسب الفلتر
}
```

---

### 3. Data Processing Hook

**الملف:** `src/hooks/useDataProcessing.ts`

**الوظيفة:**
- معالجة البيانات الخام (`DailyMetric[]`) وتحويلها إلى:
  - `storeSummary` - ملخص لكل معرض
  - `employeeSummary` - ملخص لكل موظف
  - `productSummary` - ملخص لكل منتج
  - حسابات KPIs (Achievement %, Conversion Rate, etc.)

**المدخلات:**
- `stores` - قائمة المعارض
- `employees` - قائمة الموظفين
- `dailyMetrics` - بيانات يومية (DailyMetric[])
- `dateFilter` - فلتر التاريخ
- `areaStoreFilter` - فلتر Area/Store
- `profile` - معلومات المستخدم (للصلاحيات)

**المخرجات:**
- `storeSummary`, `employeeSummary`, `productSummary`
- بيانات مفلترة حسب الصلاحيات والفلاتر

---

## 📄 الصفحات الرئيسية

### 1. Dashboard Page
**الملف:** `src/pages/Dashboard.tsx`
- يعرض ملخص شامل للمبيعات
- يستخدم `dashboardProcessedData` من `MainLayout`
- فلتر التاريخ موحد مع باقي الصفحات

### 2. Stores Page
**الملف:** `src/pages/StoresPage.tsx`
- قائمة المعارض مع إحصائيات
- فلتر التاريخ موحد
- فلتر Area/Store مستقل (`storesAreaStoreFilter`)
- حفظ الفلتر في `localStorage`

### 3. Products Page
**الملف:** `src/pages/ProductsPage.tsx`
- قائمة المنتجات مع إحصائيات
- فلتر التاريخ موحد

### 4. Employees Page
**الملف:** `src/pages/EmployeesPage.tsx`
- قائمة الموظفين مع إحصائيات
- فلتر التاريخ موحد

### 5. Commissions Page
**الملف:** `src/pages/CommissionsPage.tsx`
- حسابات العمولات
- فلتر التاريخ موحد

### 6. Live Page ⚠️ خاص
**الملف:** `src/pages/LivePage.tsx`
- **مستقل تماماً** عن فلتر التاريخ العام
- يعرض المبيعات المباشرة من D365 (اليوم وأمس)
- يحمل المعارض بشكل مستقل (2026 فقط)
- فلتر Area Manager مستقل عن الفلاتر العامة

**ملاحظة مهمة:**
```typescript
// LivePage تحمل المعارض بشكل مستقل
useEffect(() => {
  const loadStoresForLive = async () => {
    // Always load stores for 2026 (regardless of dateFilter)
    const storesList = await getStores(2026);
    setAllStores(storesList);
  };
  loadStoresForLive();
}, []); // Load once on mount
```

---

## 🔧 الملفات الرئيسية والوظائف

### 1. Data Providers

#### `src/data/dataProvider.ts`
- `getSalesData(params)` - جلب بيانات المبيعات (Hybrid)
- `loadTargetsAndVisitors()` - تحميل Targets & Visitors من GitHub
- `mergeTargetsAndVisitors()` - دمج Targets & Visitors مع بيانات المبيعات
- `getStores(year)` - جلب قائمة المعارض (Hybrid)
- `getLiveSales()` - جلب المبيعات المباشرة

#### `src/data/legacyProvider.ts`
- `getLegacyMetrics(year)` - جلب بيانات 2024/2025
- `loadStoreMapping()` - تحميل أسماء المعارض
- `loadTargetsAndVisitorsFromOrangeDashboard()` - تحميل Targets & Visitors

---

### 2. API Endpoints

#### `api/sales.ts`
- `GET /api/sales?year=2026`
- **مهم:** يعيد بيانات D365 **بدون** Targets & Visitors
- يستخدم `aggregatedGroups` (ليس `transactions`)
- ⚠️ لا يستخدم `url.parse()` (استخدام `new URL()`)

#### `api/get-stores.ts`
- `GET /api/get-stores`
- يعيد قائمة المعارض من D365

#### `api/get-employees.ts`
- `GET /api/get-employees`
- يعيد قائمة الموظفين من D365

#### `api/get-live-sales.ts`
- `GET /api/get-live-sales`
- يعيد المبيعات المباشرة (اليوم وأمس)

---

### 3. Types & Interfaces

#### `src/types.ts`

**DailyMetric:**
```typescript
interface DailyMetric {
  id: string;
  date: string; // ✅ STRING (not firebase.firestore.Timestamp)
  store: string;
  totalSales: number;
  transactionCount: number;
  visitors?: number;
  // ...
}
```

**NormalizedSalesResponse:**
```typescript
interface NormalizedSalesResponse {
  success: boolean;
  byStore: Array<{
    storeId: string;
    storeName: string;
    salesAmount: number;
    invoices: number;
    visitors?: number; // ✅ Merged from management_data.json
    target?: number; // ✅ Merged from management_data.json
  }>;
  byDay: Array<{...}>;
  range: { from: string; to: string };
}
```

**DateFilter:**
```typescript
interface DateFilter {
  year: number | 'all';
  month: number | 'all';
  day: number | 'all';
}
```

**AreaStoreFilterState:**
```typescript
interface AreaStoreFilterState {
  areaManager: string; // 'All' | manager name
  store: string; // 'All' | store name
  city: string; // 'All' | city name
}
```

---

## 🔄 سير العمل (Workflow)

### 1. عند بدء التطبيق

```
App Start
  ↓
DataProvider.loadAllYears()
  ↓
Promise.allSettled([
  getSalesData(2024),  // Legacy
  getSalesData(2025),  // Legacy
  getSalesData(2026),  // D365 (raw)
  loadTargetsAndVisitors() // From GitHub
])
  ↓
mergeTargetsAndVisitors() for each year
  ↓
Store in allSalesData: { 2024, 2025, 2026 }
```

### 2. عند تغيير فلتر التاريخ

```
User changes dateFilter (e.g., 2024, month 5)
  ↓
MainLayout.convertAllSalesDataToDailyMetrics(2024, 5)
  ↓
Filters allSalesData[2024] by month 5
  ↓
Converts to DailyMetric[]
  ↓
All pages update automatically (unified filter)
```

### 3. عند الدخول لصفحة Live

```
User navigates to Live Page
  ↓
LivePage loads stores independently (getStores(2026))
  ↓
LivePage loads live sales (getLiveSales())
  ↓
Area Manager filter works independently
  (NOT affected by global dateFilter)
```

---

## ⚠️ مشاكل تم حلها

### 1. ✅ 25-Second Freeze
**المشكلة:** دمج Targets/Visitors في render loop
**الحل:** نقل الدمج إلى `DataProvider` initialization

### 2. ✅ Store Names Appearing as Numbers (2024/2025)
**المشكلة:** البيانات المحلية تحتوي على أرقام فقط
**الحل:** `loadStoreMapping()` من `/api/get-stores` أو `management_data.json`

### 3. ✅ Targets & Visitors Showing as 0.0%
**المشكلة:** D365 لا يوفر Targets/Visitors
**الحل:** دمج من `management_data.json` على Frontend

### 4. ✅ ReferenceError: transactions is not defined
**المشكلة:** API يستخدم `transactions` بدلاً من `aggregatedGroups`
**الحل:** تحديث `api/sales.ts` لاستخدام `aggregatedGroups`

### 5. ✅ Live Page Area Manager Filter Broken
**المشكلة:** يعتمد على `stores` من `MainLayout` (مفلتر حسب dateFilter)
**الحل:** تحميل المعارض بشكل مستقل في `LivePage` (2026 فقط)

### 6. ✅ Decimal Places in Numbers
**المشكلة:** `toFixed(1)` يعرض أرقام عشرية
**الحل:** استخدام `Math.round()` و `maximumFractionDigits: 0`

### 7. ✅ Stores Page Filter Not Persisting
**المشكلة:** فلتر المعارض لا يبقى عند العودة من صفحة التفاصيل
**الحل:** حفظ في `localStorage` تلقائياً

---

## 🎨 تنسيق الأرقام

**الملف:** `src/utils/format.ts`

```typescript
export const fmtCurrency = (value: number): string => {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0, // ✅ لا أرقام عشرية
  }).format(value);
};

// للـ percentages:
Math.round(value) // ✅ بدلاً من value.toFixed(1)
```

---

## 💾 حفظ الحالة (State Persistence)

### localStorage Keys:
- `storesAreaStoreFilter` - فلتر المعارض (Area/Store)
- يتم الحفظ تلقائياً عند تغيير الفلتر

---

## 🚫 أشياء تم إزالتها

### Firebase/Firestore Listeners:
- ✅ تم إزالة جميع `onSnapshot` listeners
- ✅ تم إزالة جميع `firebase.firestore.Timestamp` usage
- ✅ البيانات الآن من API فقط (إلا للمصادقة)

### Old URL Parsing:
- ✅ لا استخدام `url.parse()` - استخدام `new URL()` أو `req.query`

---

## 🔐 الصلاحيات (Roles)

- `admin` - صلاحيات كاملة
- `general_manager` - صلاحيات كاملة
- `area_manager` - بيانات منطقته فقط
- `store_manager` - بيانات معرضه فقط
- `employee` - بيانات معرضه فقط

**الملف:** `src/hooks/useDataProcessing.ts` - `roleFilteredData`

---

## 📦 الاعتماديات الرئيسية

- React 18+
- TypeScript
- Firebase (للمصادقة فقط)
- Vite (Build Tool)
- TailwindCSS (Styling)

---

## 🔗 روابط مهمة

### مصادر البيانات:
- GitHub: `https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/management_data.json`
- API: `/api/sales?year=2026`
- API: `/api/get-stores`
- API: `/api/get-employees`
- API: `/api/get-live-sales`

---

## 🔌 API Endpoints - تفاصيل تقنية

### 1. GET /api/sales?year=2026

**الوظيفة:** جلب بيانات المبيعات من D365

**المعلمات:**
- `year` (required): السنة (2026+)

**المخرجات:**
```typescript
{
  success: true,
  byStore: Array<{
    storeId: string;
    storeName: string;
    salesAmount: number;
    invoices: number;
    // ⚠️ NO targets/visitors here - merged on frontend
  }>,
  byDay: Array<{...}>,
  range: { from: string; to: string }
}
```

**ملاحظات مهمة:**
- ✅ يستخدم `aggregatedGroups` (ليس `transactions`)
- ✅ لا يستخدم `url.parse()` - استخدام `req.query` مباشرة
- ✅ لا يقوم بدمج Targets/Visitors (يتم على Frontend)

---

### 2. GET /api/get-stores

**الوظيفة:** جلب قائمة المعارض من D365

**المخرجات:**
```typescript
Array<{
  id: string;
  name: string;
  areaManager: string;
  city?: string;
}>
```

---

### 3. GET /api/get-employees

**الوظيفة:** جلب قائمة الموظفين من D365

**المخرجات:**
```typescript
{
  success: true,
  employees: Array<{
    employeeId: string;
    employeeName: string;
    currentStore: string;
    // ...
  }>
}
```

---

### 4. GET /api/get-live-sales

**الوظيفة:** جلب المبيعات المباشرة (اليوم وأمس)

**المخرجات:**
```typescript
{
  date: string; // YYYY-MM-DD
  lastUpdate: string; // HH:MM
  today: Array<{ outlet: string; sales: number }>,
  yesterday: Array<{ outlet: string; sales: number }>
}
```

---

## 📂 هيكل المشروع

```
cockpit/
├── api/                    # API Endpoints (Backend)
│   ├── sales.ts           # D365 Sales Data
│   ├── get-stores.ts      # D365 Stores
│   ├── get-employees.ts   # D365 Employees
│   └── get-live-sales.ts  # Live Sales Data
│
├── src/
│   ├── context/
│   │   └── DataProvider.tsx    # ⭐ Core: Preloads all data
│   │
│   ├── components/
│   │   └── MainLayout.tsx      # ⭐ Core: Main container
│   │
│   ├── data/
│   │   ├── dataProvider.ts     # Hybrid data provider
│   │   ├── legacyProvider.ts   # 2024/2025 data
│   │   └── managementData.ts   # Local legacy data
│   │
│   ├── hooks/
│   │   └── useDataProcessing.ts # Data processing logic
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── StoresPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── EmployeesPage.tsx
│   │   ├── CommissionsPage.tsx
│   │   ├── LivePage.tsx         # ⚠️ Special: Independent
│   │   └── ...
│   │
│   ├── types.ts                 # TypeScript interfaces
│   └── utils/
│       └── format.ts            # Number formatting
│
└── PROJECT_DOCUMENTATION.md     # 📚 This file
```

---

## 🔄 Data Flow - تدفق البيانات

### 1. عند بدء التطبيق

```
main.tsx
  ↓
<DataProvider>
  ↓
DataProvider.tsx.loadAllYears()
  ↓
Promise.allSettled([
  getSalesData(2024) → legacyProvider.ts → managementData.ts
  getSalesData(2025) → legacyProvider.ts → managementData.ts
  getSalesData(2026) → dataProvider.ts → /api/sales?year=2026
  loadTargetsAndVisitors() → fetch(GitHub management_data.json)
])
  ↓
mergeTargetsAndVisitors() for each year
  ↓
Store in Context: allSalesData = { 2024, 2025, 2026 }
```

### 2. عند عرض صفحة

```
User navigates to Dashboard
  ↓
MainLayout.tsx
  ↓
useData() → get allSalesData from Context
  ↓
convertAllSalesDataToDailyMetrics(dateFilter.year, dateFilter.month)
  ↓
Filter allSalesData[year] by month
  ↓
Convert to DailyMetric[]
  ↓
useDataProcessing({ dailyMetrics, dateFilter, areaStoreFilter })
  ↓
Return processedData (storeSummary, employeeSummary, etc.)
  ↓
Dashboard.tsx receives processedData
  ↓
Render UI
```

### 3. عند تغيير فلتر

```
User changes dateFilter (e.g., 2024, month 5)
  ↓
setDateFilter({ year: 2024, month: 5 })
  ↓
MainLayout.convertAllSalesDataToDailyMetrics(2024, 5) re-runs
  ↓
All pages using dateFilter update automatically
  (Dashboard, Stores, Products, Employees, Commissions)
  ↓
Live Page NOT affected (independent)
```

---

## 🎯 القواعد الذهبية (Golden Rules)

### 1. ✅ Data Loading
- **قاعدة:** جميع البيانات تُحمل **مرة واحدة** عند بدء التطبيق
- **قاعدة:** لا fetch في render loop - استخدم `allSalesData` من Context
- **قاعدة:** دمج Targets/Visitors **مرة واحدة فقط** في `DataProvider`

### 2. ✅ Filtering
- **قاعدة:** DateFilter **موحد** عبر جميع الصفحات (إلا Live)
- **قاعدة:** AreaStoreFilter **منفصل** لكل صفحة
- **قاعدة:** Live Page **مستقل تماماً** عن DateFilter العام

### 3. ✅ Data Formatting
- **قاعدة:** جميع الأرقام **بدون** أرقام عشرية (`maximumFractionDigits: 0`)
- **قاعدة:** استخدام `Math.round()` للـ percentages
- **قاعدة:** `DailyMetric.date` هو `string` (ليس `Timestamp`)

### 4. ✅ API Integration
- **قاعدة:** D365 API لا يوفر Targets/Visitors - دمج على Frontend
- **قاعدة:** استخدام `aggregatedGroups` (ليس `transactions`)
- **قاعدة:** لا استخدام `url.parse()` - استخدام `req.query` أو `new URL()`

### 5. ✅ State Management
- **قاعدة:** `allSalesData` في Context - لا local state
- **قاعدة:** `storesAreaStoreFilter` يُحفظ في localStorage
- **قاعدة:** `dateFilter` لا يُحفظ (موحد فقط)

---

## 🧪 Testing Checklist

عند إضافة ميزة جديدة، تأكد من:

- [ ] ✅ البيانات تُحمل مرة واحدة فقط
- [ ] ✅ لا يوجد fetch في render loop
- [ ] ✅ DateFilter موحد (إلا Live)
- [ ] ✅ AreaStoreFilter منفصل (إلا Stores - localStorage)
- [ ] ✅ الأرقام بدون أرقام عشرية
- [ ] ✅ Live Page مستقل عن DateFilter
- [ ] ✅ Targets/Visitors تظهر بشكل صحيح
- [ ] ✅ Store Names تظهر (ليس أرقام)
- [ ] ✅ الصلاحيات مطبقة بشكل صحيح
- [ ] ✅ لا يوجد `onSnapshot` listeners
- [ ] ✅ لا استخدام `url.parse()`

---

## 🚨 Common Pitfalls - أخطاء شائعة

### 1. ❌ Fetch في render loop
```typescript
// ❌ خطأ
useEffect(() => {
  fetchData(); // سيتم استدعاءه في كل render
}, []);

// ✅ صحيح
const { allSalesData } = useData(); // من Context (محمل مرة واحدة)
```

### 2. ❌ استخدام stores prop في LivePage
```typescript
// ❌ خطأ
const LivePage = ({ stores }) => {
  // stores قد يكون مفلتر حسب dateFilter
};

// ✅ صحيح
const [allStores, setAllStores] = useState([]);
useEffect(() => {
  getStores(2026).then(setAllStores); // مستقل
}, []);
```

### 3. ❌ دمج Targets/Visitors في render
```typescript
// ❌ خطأ
const processed = useMemo(() => {
  mergeTargetsAndVisitors(data); // في render loop
}, [data]);

// ✅ صحيح
// دمج مرة واحدة في DataProvider.loadAllYears()
```

### 4. ❌ استخدام dateFilter في LivePage
```typescript
// ❌ خطأ
const LivePage = ({ dateFilter }) => {
  // Live Page لا يجب أن يعتمد على dateFilter
};

// ✅ صحيح
// Live Page مستقل تماماً
```

---

## 📊 Performance Optimization

### 1. Preloading
- ✅ جميع البيانات محملة عند بدء التطبيق
- ✅ لا يوجد loading عند التنقل بين الصفحات

### 2. Memoization
- ✅ `useMemo` للبيانات المفلترة
- ✅ `useCallback` للدوال المستخدمة في dependencies

### 3. Data Processing
- ✅ معالجة البيانات **مرة واحدة** في `DataProvider`
- ✅ لا معالجة في render loop

### 4. API Calls
- ✅ `Promise.allSettled` للتحميل المتوازي
- ✅ Cache لـ Targets/Visitors في `loadTargetsAndVisitors()`

---

## 🔍 Debugging Guide

### 1. تحقق من DataProvider
```typescript
// في DataProvider.tsx
console.log('📊 All Sales Data:', allSalesData);
console.log('📊 Loaded Years:', loadedYears);
```

### 2. تحقق من MainLayout
```typescript
// في MainLayout.tsx
console.log('📅 Date Filter:', dateFilter);
console.log('📊 Daily Metrics:', dailyMetricsFromPreloaded.length);
```

### 3. تحقق من LivePage
```typescript
// في LivePage.tsx
console.log('🏪 All Stores:', allStores.length);
console.log('👥 Area Managers:', availableAreaManagers);
```

### 4. تحقق من API
```typescript
// في api/sales.ts
console.log('📊 Aggregated Groups:', aggregatedGroups.length);
```

---

## 📝 ملاحظات إضافية

### 1. Store Mapping
- البيانات المحلية (2024/2025) قد تحتوي على أرقام فقط
- يجب تحميل Store Mapping من `/api/get-stores` أو `management_data.json`
- يتم التطبيق في `legacyProvider.ts` → `loadStoreMapping()`

### 2. Targets & Visitors Structure
```typescript
// management_data.json
{
  targets: {
    "2024": {
      "STORE_ID": {
        "1": 100000,  // January target
        "2": 120000,  // February target
        // ...
      }
    }
  },
  visitors: [
    ["2024-01-15", "STORE_ID", 500],  // [date, storeId, count]
    // ...
  ]
}
```

### 3. Date Format
- `DailyMetric.date`: `string` (format: "YYYY-MM-DD")
- **لا** استخدام `firebase.firestore.Timestamp`
- التحويل: `new Date(dateStr)` عند الحاجة

---

## 🎓 Quick Reference

### أهم الملفات:
1. `src/context/DataProvider.tsx` - تحميل البيانات
2. `src/components/MainLayout.tsx` - إدارة الحالة والفلاتر
3. `src/hooks/useDataProcessing.ts` - معالجة البيانات
4. `src/pages/LivePage.tsx` - صفحة خاصة (مستقلة)

### أهم الوظائف:
1. `DataProvider.loadAllYears()` - تحميل جميع البيانات
2. `MainLayout.convertAllSalesDataToDailyMetrics()` - تحويل البيانات
3. `useDataProcessing()` - معالجة البيانات
4. `mergeTargetsAndVisitors()` - دمج Targets/Visitors

---

**📌 ملاحظة:** هذا الملف يحتوي على جميع التفاصيل اللازمة لمتابعة المشروع. إذا كان لديك أي أسئلة، راجع هذا الملف أولاً!

---

## 📝 ملاحظات للمطورين

### 1. عند إضافة صفحة جديدة:
- استخدم `dailyMetricsFromPreloaded` من `MainLayout`
- استخدم `dateFilter` الموحد (إلا إذا كانت صفحة خاصة مثل Live)
- استخدم `useDataProcessing` لمعالجة البيانات

### 2. عند تعديل فلتر:
- **DateFilter:** موحد عبر جميع الصفحات (إلا Live)
- **AreaStoreFilter:** منفصل لكل صفحة (إلا Stores - له localStorage)

### 3. عند العمل على Live Page:
- **مستقل تماماً** عن `dateFilter` العام
- يحمل المعارض بشكل مستقل (2026 فقط)
- فلتر Area Manager مستقل

### 4. عند إضافة بيانات جديدة:
- إذا كانت من D365: أضف إلى `api/sales.ts`
- إذا كانت من Legacy: أضف إلى `legacyProvider.ts`
- إذا كانت Targets/Visitors: استخدم `loadTargetsAndVisitors()`

---

## 🐛 Debug Tips

### مشكلة: البيانات لا تظهر
1. تحقق من `DataProvider` - هل تم تحميل `allSalesData`؟
2. تحقق من `convertAllSalesDataToDailyMetrics` - هل الفلتر صحيح؟
3. تحقق من console.log في `DataProvider.tsx`

### مشكلة: فلتر لا يعمل
1. تحقق من `dateFilter` - هل موحد؟
2. تحقق من `areaStoreFilter` - هل منفصل لكل صفحة؟
3. تحقق من localStorage - هل يتم الحفظ؟

### مشكلة: Live Page لا يعمل
1. تحقق من `allStores` في `LivePage` - هل تم تحميلها؟
2. تحقق من `getStores(2026)` - هل يعمل؟
3. تحقق من أن `LivePage` لا تستخدم `stores` prop من `MainLayout`

---

## ✅ Checklist عند إضافة ميزة جديدة

- [ ] هل تحتاج بيانات من Legacy (2024/2025)؟
- [ ] هل تحتاج بيانات من D365 (2026+)؟
- [ ] هل تحتاج Targets/Visitors؟
- [ ] هل الفلتر موحد أم منفصل؟
- [ ] هل تحتاج حفظ في localStorage؟
- [ ] هل الأرقام بدون أرقام عشرية؟
- [ ] هل الصلاحيات مطبقة بشكل صحيح؟

---

## 📞 معلومات الاتصال

- **Project:** K.A Cockpit Dashboard
- **Architecture:** Hybrid Data Model (Legacy + D365)
- **Data Loading:** Preload All at Startup
- **Filter Strategy:** Unified DateFilter + Separate Area/Store Filters

---

**آخر تحديث:** تم توحيد DateFilter + إصلاح Live Page Area Manager Filter
