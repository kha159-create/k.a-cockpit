# Orange-Dashboard Architecture Replication

## ✅ Complete Implementation Summary

This document describes how k.a-cockpit now replicates the exact working architecture of orange-dashboard, working from ANY hosting WITHOUT Firestore.

---

## Step 1: How Orange-Dashboard Works (Source of Truth)

### D365 Access Pattern

**Location**: Server-side only (Vercel Functions in `/api/`)

**Files that call D365**:
- `api/live-sales.ts` - Live sales (last 2 days)
- `api/sales.ts` - Historical sales (year/month/day/storeId/employeeId filters)
- `api/get-metrics.ts` - Daily metrics (uses employees_data.json from orange-dashboard)
- `api/sync-d365.ts` - Daily sync (optional, for Firestore backup only)

**D365 OData Endpoints**:
- Base URL: `https://orangepax.operations.eu.dynamics.com/data/RetailTransactions`
- Authentication: Azure MSAL (`@azure/msal-node`)
- Query Pattern:
  ```
  $filter=PaymentAmount ne 0 and TransactionDate ge {startDate} and TransactionDate lt {endDate}
  $select=OperatingUnitNumber,PaymentAmount,TransactionDate,StaffId,StaffName
  $orderby=TransactionDate
  ```

**Paging Handling**:
- Uses `@odata.nextLink` from response
- Loops until `nextLink` is null
- Uses `Prefer: odata.maxpagesize=5000` header

**Aggregation Logic**:
- Groups by `OperatingUnitNumber` (store ID) → maps to store name via `mapping.xlsx`
- Groups by `StaffId`/`StaffName` (employee) → employee totals
- Groups by store + employee → store-employee totals

### Frontend → Backend Communication

**Pattern**: Configurable API base URL
- Same-origin (Vercel): `VITE_API_BASE_URL=""` → uses `/api/...`
- Cross-origin (GitHub Pages): `VITE_API_BASE_URL="https://k-a-cockpit.vercel.app"` → uses `${API}/api/...`

**CORS**: Handled in all API endpoints with `Access-Control-Allow-Origin` headers

---

## Step 2: Applied to K.A Cockpit

### A) Live Endpoint (`/api/live-sales`)

**Status**: ✅ Working (NO Firestore)

**Implementation**:
- Fetches last 2 days from D365
- Splits by Saudi Arabia time (UTC+3)
- Aggregates by store
- Returns JSON (like orange-dashboard)
- **NO Firestore dependency**

**Logs**:
- `fetchedCount`: Total transactions fetched
- `duration`: Request duration in ms
- `nextLinkPages`: Number of pages followed

### B) Historical Data (`/api/sales`)

**Status**: ✅ New endpoint created

**Supports**:
- `year=2024|2025|2026` (required)
- `month=0-11` (optional)
- `day=1-31` (optional)
- `storeId=XXXX` (optional)
- `employeeId=XXXX` (optional)

**Returns**:
- `metrics`: Array of daily metrics (store + employee level)
- `aggregates.byStore`: Store-level totals
- `aggregates.byEmployee`: Employee-level totals
- `debug`: Total transactions, pages, duration, sample transactions

**Paging**: ✅ Full support for `@odata.nextLink`

### C) Frontend Works Anywhere

**Implementation**:
- Added `VITE_API_BASE_URL` to `vite.config.ts`
- Created `src/utils/api.ts` with `getApiBaseUrl()` and `buildApiUrl()`
- Updated all API calls in:
  - `MainLayout.tsx` (stores, employees, metrics)
  - `LivePage.tsx` (live sales)

**Usage**:
```typescript
// @ts-ignore
const API = import.meta.env.VITE_API_BASE_URL || '';
const apiUrl = API ? `${API}/api/endpoint` : '/api/endpoint';
```

---

## Step 3: Verification Endpoints

### `/api/health`

**Checks**:
1. ✅ D365 token acquisition
2. ✅ D365 query test (last 1 day, top 10)
3. ✅ Environment variables (D365 credentials)

**Returns**:
```json
{
  "success": true,
  "checks": {
    "tokenAcquisition": { "status": "ok", "duration": 123 },
    "d365Query": { "status": "ok", "count": 10, "duration": 456 },
    "environment": { "status": "ok" }
  }
}
```

### `/api/debug-sales`

**Parameters**:
- `from=YYYY-MM-DD` (required)
- `to=YYYY-MM-DD` (required)

**Returns**:
```json
{
  "success": true,
  "totalTransactions": 1234,
  "pagesFetched": 3,
  "durationMs": 5678,
  "sampleTransactions": [...],
  "aggregates": {
    "byStore": [...],
    "byEmployee": [...]
  }
}
```

---

## Step 4: Runbook

### Environment Variables (Vercel)

**Required**:
```
D365_CLIENT_ID=your_client_id
D365_CLIENT_SECRET=your_client_secret
D365_TENANT_ID=your_tenant_id
D365_URL=https://orangepax.operations.eu.dynamics.com
CORS_ALLOW_ORIGIN=*
```

**Optional** (for cross-origin frontend):
```
VITE_API_BASE_URL=https://k-a-cockpit.vercel.app
```

### Testing Steps

1. **Health Check**:
   ```
   GET https://k-a-cockpit.vercel.app/api/health
   ```
   Expected: `success: true`, all checks `ok`

2. **Live Sales**:
   ```
   GET https://k-a-cockpit.vercel.app/api/live-sales
   ```
   Expected: `success: true`, `today` and `yesterday` arrays with data

3. **Historical Sales (2024)**:
   ```
   GET https://k-a-cockpit.vercel.app/api/sales?year=2024&month=0
   ```
   Expected: `success: true`, `metrics` array with data, `debug.totalTransactions > 0`

4. **Historical Sales (2025)**:
   ```
   GET https://k-a-cockpit.vercel.app/api/sales?year=2025&month=0
   ```
   Expected: Same as above

5. **Debug Sales**:
   ```
   GET https://k-a-cockpit.vercel.app/api/debug-sales?from=2024-01-01&to=2024-01-31
   ```
   Expected: `totalTransactions > 0`, `pagesFetched >= 1`, sample transactions

6. **Frontend**:
   - Open Cockpit UI
   - Check Console for API calls
   - Verify data appears in Dashboard/Stores/Employees pages

---

## Root Cause Analysis

### Why Cockpit Was Not Showing Sales

1. **Firestore Dependency**: System was trying to merge Firestore data with API data, causing conflicts
2. **Hardcoded URLs**: Frontend used hardcoded Vercel URLs, breaking on GitHub Pages
3. **Missing Endpoints**: No `/api/sales` endpoint for historical data
4. **Incomplete Paging**: Some endpoints didn't handle `@odata.nextLink` properly

### Files Changed

**New Files**:
- `api/sales.ts` - Historical sales endpoint
- `api/health.ts` - Health check endpoint
- `api/debug-sales.ts` - Debug endpoint
- `src/utils/api.ts` - API base URL utility

**Modified Files**:
- `api/live-sales.ts` - Removed Firestore, pure D365 API
- `api/get-metrics.ts` - Uses orange-dashboard employees_data.json
- `src/components/MainLayout.tsx` - Uses VITE_API_BASE_URL
- `src/pages/LivePage.tsx` - Uses VITE_API_BASE_URL
- `vite.config.ts` - Added VITE_API_BASE_URL

---

## Proof of Non-Empty Data

After deployment, verify:

1. `/api/health` returns `success: true`
2. `/api/live-sales` returns `todayStoresCount > 0`
3. `/api/sales?year=2024` returns `debug.totalTransactions > 0`
4. `/api/sales?year=2025` returns `debug.totalTransactions > 0`
5. Frontend shows data in UI

---

## Architecture Diagram

```
┌─────────────────┐
│   Frontend     │
│  (Any Domain)  │
└────────┬────────┘
         │ VITE_API_BASE_URL
         │ ("" or "https://...")
         ▼
┌─────────────────┐
│  Vercel API     │
│  /api/*         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   D365 API      │
│  RetailTransactions│
└─────────────────┘
```

**NO Firestore in data flow** ✅
