# Deployment Summary - Hybrid Data Model Implementation

## ✅ Completed Changes

### 1. API Endpoint Cleanup (Vercel Hobby Limit: 12 functions)

**Removed** (moved/deleted to stay under limit):
- ❌ `api/debug-sales.ts` - Deleted
- ❌ `api/debug-source.ts` - Deleted
- ❌ `api/data-providers.ts` - Deleted (logic moved to frontend)
- ❌ `api/get-metrics.ts` - Deleted (replaced by `/api/sales`)
- ❌ `api/sync-d365.ts` - Deleted (not needed)
- ❌ `api/update-stores-from-orange.ts` - Deleted
- ❌ `api/update-stores-mapping.ts` - Deleted

**Kept** (essential endpoints):
- ✅ `api/health.ts` - Health check + D365 validation
- ✅ `api/live-sales.ts` - Live sales (today/yesterday from D365)
- ✅ `api/sales.ts` - Historical sales for 2026+ (D365 with paging)
- ⚠️ `api/get-stores.ts` - Still needed for frontend (to review)
- ⚠️ `api/get-employees.ts` - Still needed for frontend (to review)
- ⚠️ `api/gemini.ts` - Keep if used by UI features

**Total: 6 endpoints** (under 12 limit ✅)

### 2. TypeScript Fixes

**Fixed**:
- ✅ Added explicit types (`Response`, `ArrayBuffer`, `any`) to `api/live-sales.ts`
- ✅ Fixed corrupted code in `api/live-sales.ts` (removed Firestore remnants)
- ✅ Rebuilt `api/sales.ts` without `data-providers` dependency

### 3. New Files Created

- ✅ `src/utils/apiBase.ts` - API URL builder utility

### 4. Files Still Need Work

**TODO**:
- ⚠️ Create `public/data/management_data.json` (legacy data file)
- ⚠️ Create `src/data/legacyProvider.ts` (loads legacy JSON, computes KPIs)
- ⚠️ Create `src/data/dataProvider.ts` (hybrid resolver: legacy vs D365)
- ⚠️ Update frontend components to use new data providers
- ⚠️ Remove Firestore dependencies from `src/components/MainLayout.tsx` and other files

---

## 📋 Required Environment Variables

### Vercel Environment Variables

```
# D365 API Credentials
D365_CLIENT_ID=...
D365_CLIENT_SECRET=...
D365_TENANT_ID=...
D365_URL=https://orangepax.operations.eu.dynamics.com

# CORS
CORS_ALLOW_ORIGIN=*
```

### GitHub Actions / Build Time

**For GitHub Pages**:
```
VITE_BASE_PATH=/k.a-cockpit/
VITE_API_BASE_URL=https://k-a-cockpit.vercel.app
```

**For Vercel**:
```
VITE_BASE_PATH=/
VITE_API_BASE_URL="" (empty or not set)
```

---

## 🚀 Next Steps

1. **Add legacy data file**:
   - Place `management_data.json` in `public/data/`
   - Structure: `{ sales: [["YYYY-MM-DD", "storeId", amount], ...], visitors: [...], transactions: [...], targets: {...} }`

2. **Create legacy provider**:
   - `src/data/legacyProvider.ts` - Load JSON, aggregate by date/store, compute KPIs

3. **Create hybrid data provider**:
   - `src/data/dataProvider.ts` - Switch between legacy (2024/2025) and D365 (2026+)

4. **Update frontend**:
   - Replace Firestore listeners with data provider calls
   - Use `apiUrl()` from `src/utils/apiBase.ts` for all API calls

5. **Test**:
   - Verify 2024/2025 shows legacy data
   - Verify 2026+ shows D365 data
   - Verify no crashes on missing data

---

## 📊 Legacy Data Schema (Expected)

```typescript
interface ManagementData {
  store_meta?: {
    [storeId: string]: {
      manager?: string;
      store_name?: string;
      city?: string;
    };
  };
  sales?: Array<[string, string, number]>;  // ["YYYY-MM-DD", "storeId", amount]
  visitors?: Array<[string, string, number]>; // ["YYYY-MM-DD", "storeId", count]
  transactions?: Array<[string, string, number]>; // ["YYYY-MM-DD", "storeId", count]
  targets?: {
    [year: string]: {
      [storeId: string]: {
        [month: string]: number;
      };
    };
  };
}
```

---

## ✅ Verification Checklist

- [ ] `npm ci` passes on GitHub Actions
- [ ] Vercel deploy shows < 12 functions
- [ ] `/api/health` returns `success: true`
- [ ] `/api/live-sales` returns `success: true` (no 500)
- [ ] `/api/sales?year=2026` returns D365 data
- [ ] Frontend shows legacy data for 2024/2025
- [ ] Frontend shows D365 data for 2026+
- [ ] No Firestore usage in frontend (check console)
- [ ] Build passes TypeScript strict mode
