# Hybrid Data Model Implementation

## Architecture Overview

k.a-cockpit now uses a **hybrid data model** identical to orange-dashboard:

- **2024-2025**: Legacy data (store-level metrics only, NO employees)
- **2026+**: D365 data (store + employee metrics from D365 RetailTransactions API)

---

## Phase 1: Legacy Schema (2024/2025)

### Source

**File**: `employees_data.json` from `https://github.com/ALAAWF2/orange-dashboard`

**Format**:
```json
{
  "storeId": [
    ["date", "employeeName", sales, transactions, ...],
    ...
  ],
  ...
}
```

**Example Entry**:
```json
{
  "1001": [
    ["2024-01-15", "Employee Name", 15000.50, 45, ...],
    ...
  ]
}
```

### Schema Mapping

| Legacy Field (employees_data.json) | Cockpit Field | Notes |
|-----------------------------------|---------------|-------|
| `entry[0]` (date) | `date` | YYYY-MM-DD format |
| `entry[2]` (sales) | `salesAmount` | Summed to store level |
| `entry[3]` (transactions) | `invoices` | Summed to store level |
| `storeId` | `storeId` | From JSON key |
| `store_name` (from management_data.json) | `storeName` | Mapped via store metadata |

### Processing Logic

For legacy years (2024/2025):
1. Load `employees_data.json` from orange-dashboard GitHub repo
2. **Aggregate to store-level only** (ignore employee breakdown)
3. Load store names from `management_data.json`
4. Return normalized response with `byEmployee = []` (empty array)

---

## Phase 2: D365 Schema (2026+)

### Source

**API**: `https://orangepax.operations.eu.dynamics.com/data/RetailTransactions`

**OData Query**:
```
$filter=PaymentAmount ne 0 and TransactionDate ge {startDate} and TransactionDate lt {endDate}
$select=OperatingUnitNumber,PaymentAmount,TransactionDate,StaffId,StaffName
$orderby=TransactionDate
```

### Schema Mapping

| D365 Field | Cockpit Field | Notes |
|------------|---------------|-------|
| `OperatingUnitNumber` | `storeId` | 4-digit store ID (e.g., "1001") |
| `PaymentAmount` | `salesAmount` | Summed per store/employee |
| Transaction count | `invoices` | Count of transactions (PaymentAmount ne 0) |
| `StaffId` | `employeeId` | For employee-level metrics |
| `StaffName` | `employeeName` | For employee-level metrics |
| `TransactionDate` | `date` | For filtering by date range |

### Store Name Mapping

`OperatingUnitNumber` → `storeName` via `mapping.xlsx` from `https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx`

---

## Phase 3: Normalized Response Schema

### `NormalizedSalesResponse`

```typescript
{
  success: boolean;
  range: {
    from: string;  // YYYY-MM-DD
    to: string;    // YYYY-MM-DD
    year: number;
    month?: number;  // 1-12
    day?: number;    // 1-31
  };
  byStore: Array<{
    storeId: string;
    storeName?: string;
    salesAmount: number;
    invoices: number;
    visitors?: number;  // undefined for legacy (not available)
    kpis: {
      atv: number;          // salesAmount / invoices (guard divide-by-zero)
      conversion?: number;  // invoices / visitors * 100 (if visitors exists)
      customerValue?: number; // same as atv
    };
  }>;
  byEmployee: Array<{
    employeeId: string;
    employeeName?: string;
    storeId?: string;
    storeName?: string;
    salesAmount: number;
    invoices: number;
    kpis: {
      atv: number;
    };
  }>;  // Empty array [] for legacy years (2024/2025)
  totals: {
    salesAmount: number;
    invoices: number;
    visitors?: number;
    kpis: {
      atv: number;
      conversion?: number;
      customerValue?: number;
    };
  };
  debug?: {
    source: "legacy" | "d365";
    pages?: number;
    fetched?: number;
    notes?: string[];
  };
}
```

### KPI Formulas

#### ATV (Average Transaction Value)
```
atv = salesAmount / invoices
```
**Guard**: If `invoices === 0`, return `0` (not `NaN` or `Infinity`)

#### Conversion Rate
```
conversion = (invoices / visitors) * 100
```
**Guard**: Only calculated if `visitors` exists and `visitors > 0`. Otherwise `undefined`.

#### Customer Value
```
customerValue = atv  // Same as ATV
```

### Divide-by-Zero Handling

All KPI calculations use guards:

```typescript
const atv = invoices > 0 ? salesAmount / invoices : 0;
const conversion = visitors && visitors > 0 ? (invoices / visitors) * 100 : undefined;
```

**Result**: KPIs are always `number` (0 if cannot compute), never `NaN` or `Infinity`.

---

## Phase 4: Endpoints

### `/api/sales`

**Hybrid Resolver**: Automatically selects Legacy (2024/2025) or D365 (2026+)

**Query Parameters**:
- `year` (required): 2024, 2025, 2026, ...
- `month` (optional): 1-12 (1-based)
- `day` (optional): 1-31
- `storeId` (optional): Filter by store
- `employeeId` (optional): Filter by employee (only for 2026+)

**Response**: `NormalizedSalesResponse`

**Examples**:
```
GET /api/sales?year=2024&month=1
→ debug.source = "legacy", byEmployee = [], byStore populated

GET /api/sales?year=2025
→ debug.source = "legacy", byEmployee = [], byStore populated

GET /api/sales?year=2026&month=1
→ debug.source = "d365", byEmployee populated, byStore populated
```

### `/api/live-sales`

**Always uses D365** (for current day/yesterday)

**Response**: 
```json
{
  "success": true,
  "date": "2026-01-18",
  "lastUpdate": "14:30",
  "today": [...],
  "yesterday": [...],
  "todayStoresCount": 15,
  "yesterdayStoresCount": 15,
  "todayTransactionsCount": 1234,
  "yesterdayTransactionsCount": 1098
}
```

**Error Handling**: Never crashes. Returns `success: true` with empty arrays if D365 fails.

### `/api/debug-source`

**Purpose**: Show which provider is used for a given year

**Query Parameters**:
- `year` (required): Year to check
- `month` (optional): Month (1-12, 1-based)

**Response**:
```json
{
  "success": true,
  "year": 2024,
  "provider": "legacy",
  "willUseProvider": "legacy",
  "sampleRow": {
    "byStore": [...],
    "byEmployee": []
  },
  "fieldMapping": { ... },
  "debug": { ... },
  "notes": [...]
}
```

### `/api/health`

**Checks**:
1. D365 token acquisition
2. D365 query test
3. **canFetchLiveSales**: Validates RetailTransactions entity accessibility
4. Environment variables

---

## Phase 5: Frontend Compatibility

### Employees Page

**Handle Missing Employees**:

```typescript
if (byEmployee.length === 0 && year <= 2025) {
  // Show friendly message: "No employee data for legacy years 2024/2025"
}
```

### Dashboard Cards

**Safe KPI Rendering**:

```typescript
const atv = totals.kpis.atv || 0;  // Never NaN/Infinity
const conversion = totals.kpis.conversion || 0;  // Handle undefined

// Display
<span>{Number.isFinite(atv) ? atv.toFixed(2) : '0.00'}</span>
```

### Stores Page

**Render Store KPIs**:

```typescript
byStore.forEach(store => {
  const atv = store.kpis.atv || 0;
  const conversion = store.kpis.conversion || 0;
  // Render safely
});
```

---

## Verification

### Test URLs

1. **Legacy 2024**:
   ```
   GET /api/sales?year=2024&month=1
   ```
   Expected:
   - `debug.source = "legacy"`
   - `byEmployee = []` (empty array)
   - `byStore.length > 0`
   - `totals.kpis.atv` is a number (not NaN)

2. **Legacy 2025**:
   ```
   GET /api/sales?year=2025&month=0
   ```
   Expected: Same as 2024

3. **D365 2026**:
   ```
   GET /api/sales?year=2026&month=0
   ```
   Expected:
   - `debug.source = "d365"`
   - `byEmployee.length > 0`
   - `byStore.length > 0`
   - `debug.pages >= 1`
   - `debug.fetched > 0`

4. **Live Sales**:
   ```
   GET /api/live-sales
   ```
   Expected:
   - `success: true` (even if D365 fails)
   - `today` array (may be empty)
   - `yesterday` array (may be empty)

### Expected Behavior

- **Never crashes**: All endpoints return 200 OK with consistent schema
- **Empty data**: Returns empty arrays, not errors
- **KPIs**: Always numbers (0 if cannot compute), never NaN/Infinity
- **Legacy years**: `byEmployee = []` (handled gracefully in UI)

---

## Files Changed

### New Files
- `api/data-providers.ts` - Hybrid resolver (Legacy + D365 providers)
- `api/debug-source.ts` - Debug endpoint for provider selection
- `HYBRID_DATA_MODEL.md` - This file

### Modified Files
- `api/sales.ts` - Now uses hybrid resolver
- `api/live-sales.ts` - Never crashes, returns empty arrays on error
- `api/health.ts` - Added `canFetchLiveSales` check

---

## Deployment & Troubleshooting

### Environment Variables (Vercel)

```
D365_CLIENT_ID=...
D365_CLIENT_SECRET=...
D365_TENANT_ID=...
D365_URL=https://orangepax.operations.eu.dynamics.com
CORS_ALLOW_ORIGIN=*
```

### Troubleshooting

1. **No data for 2024/2025**:
   - Check if `employees_data.json` contains entries for those years
   - Verify aggregation logic in `loadLegacyStoreMetrics()`

2. **D365 errors**:
   - Check `/api/health` → `canFetchLiveSales` status
   - Verify D365 credentials
   - Check OData filter syntax in logs

3. **KPIs showing NaN/Infinity**:
   - Should not happen (guards in place)
   - Check divide-by-zero guards in KPI calculations

4. **Employees empty for 2026+**:
   - Verify `StaffId`/`StaffName` exist in D365 transactions
   - Check employee aggregation logic in `getD365SalesData()`

---

## KPI Formulas Reference

### ATV (Average Transaction Value)
```typescript
atv = invoices > 0 ? salesAmount / invoices : 0
```

### Conversion Rate
```typescript
conversion = visitors && visitors > 0 ? (invoices / visitors) * 100 : undefined
```

### Customer Value
```typescript
customerValue = atv  // Same as ATV
```

### Divide-by-Zero Guards
- Always check denominator > 0 before division
- Return `0` for ATV/Customer Value if cannot compute
- Return `undefined` for Conversion if visitors missing
- Use `Number.isFinite()` before displaying KPIs
