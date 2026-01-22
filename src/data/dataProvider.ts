/**
 * Hybrid Data Provider
 * Switches between Legacy (2024/2025) and D365 (2026+) based on year
 * Merges Targets & Visitors from orange-dashboard on the frontend (reduces API load)
 */

import { getLegacyMetrics, getLegacyStores } from './legacyProvider';
import { apiUrl } from '../utils/apiBase';

// Load targets and visitors from orange-dashboard (for all years, including 2026+)
interface OrangeDashboardManagementData {
  targets?: {
    [year: string]: {
      [storeId: string]: {
        [month: string]: number; // month: "1", "2", ... "12"
      };
    };
  };
  visitors?: Array<[string, string, number]>; // ["YYYY-MM-DD", "STORE_ID", count]
}

let cachedTargetsAndVisitors: OrangeDashboardManagementData | null = null;

export async function loadTargetsAndVisitors(): Promise<{ targets: OrangeDashboardManagementData['targets']; visitors: OrangeDashboardManagementData['visitors'] }> {
  // NOTE: Targets and visitors are now loaded directly from PostgreSQL in api/sales-pg.ts
  // This function is kept for backwards compatibility but returns empty data
  // The API now includes targets and visitors in the response
  console.log('📥 Targets and visitors are now loaded from PostgreSQL (included in API response)');
  return { targets: {}, visitors: [] };
}

/**
 * Merge Targets & Visitors into D365 response (frontend-side)
 * NOTE: For PostgreSQL (2024-2025), targets and visitors are already included in the API response
 * This function is kept for D365 (2026+) compatibility
 * IMPORTANT: This function should be called ONCE during initialization, NOT in render loop
 */
export function mergeTargetsAndVisitors(
  response: NormalizedSalesResponse,
  targets: OrangeDashboardManagementData['targets'],
  visitors: OrangeDashboardManagementData['visitors'],
  year: number,
  month?: number
): NormalizedSalesResponse {
  // If response already has visitors/targets (from PostgreSQL), return as-is
  if (response.byStore.length > 0 && 
      (response.byStore[0].visitors !== undefined || response.byStore[0].target !== undefined)) {
    console.log('📊 Response already includes targets/visitors from PostgreSQL, skipping merge');
    return response;
  }
  
  // For D365 (2026+), merge targets/visitors from orange-dashboard
  const yearKey = String(year);
  const monthKey = month !== undefined ? String(month + 1) : 'all'; // month is 0-11, target uses 1-12
  
  // Build visitors maps for fast lookup
  const monthlyVisitorsMap = new Map<string, number>(); // Key: storeId
  const dailyVisitorsMap = new Map<string, number>(); // Key: "YYYY-MM-DD_STORE_ID"
  
  const startDateStr = response.range.from;
  const endDateStr = response.range.to;
  
  (visitors || []).forEach((entry) => {
    if (!Array.isArray(entry) || entry.length < 3) return;
    const [entryDateStr, entryStoreId, count] = entry;
    
    // Filter by date range
    if (entryDateStr < startDateStr || entryDateStr > endDateStr) return;
    
    // Monthly visitors
    const currentMonthlyCount = monthlyVisitorsMap.get(entryStoreId) || 0;
    monthlyVisitorsMap.set(entryStoreId, currentMonthlyCount + (Number(count) || 0));
    
    // Daily visitors
    const dailyKey = `${entryDateStr}_${entryStoreId}`;
    const currentDailyCount = dailyVisitorsMap.get(dailyKey) || 0;
    dailyVisitorsMap.set(dailyKey, currentDailyCount + (Number(count) || 0));
  });
  
  // Merge into byStore
  const byStore = response.byStore.map(store => {
    const targetValue = targets?.[yearKey]?.[store.storeId]?.[monthKey] || 0;
    const monthlyVisitors = monthlyVisitorsMap.get(store.storeId) || 0;
    const conversion = monthlyVisitors > 0 ? (store.invoices / monthlyVisitors) * 100 : 0;
    
    return {
      ...store,
      visitors: monthlyVisitors,
      target: Number(targetValue) || 0,
      kpis: {
        ...store.kpis,
        conversion: Number.isFinite(conversion) ? conversion : 0,
      },
    };
  });
  
  // Merge into byDay
  const byDay = response.byDay?.map(day => ({
    ...day,
    byStore: day.byStore.map(store => {
      const dailyVisitors = dailyVisitorsMap.get(`${day.date}_${store.storeId}`) || 0;
      const conversion = dailyVisitors > 0 ? (store.invoices / dailyVisitors) * 100 : 0;
      
      return {
        ...store,
        visitors: dailyVisitors,
        kpis: {
          ...store.kpis,
          conversion: Number.isFinite(conversion) ? conversion : 0,
        },
      };
    }),
  }));
  
  // Calculate totals with visitors
  const totalVisitors = byStore.reduce((sum, s) => sum + (s.visitors || 0), 0);
  const totalConversion = totalVisitors > 0 ? (response.totals.invoices / totalVisitors) * 100 : 0;
  
  return {
    ...response,
    byStore,
    byDay,
    totals: {
      ...response.totals,
      visitors: totalVisitors,
      kpis: {
        ...response.totals.kpis,
        conversion: Number.isFinite(totalConversion) ? totalConversion : 0,
      },
    },
  };
}

interface SalesParams {
  year: number;
  month?: number; // 0-11
  day?: number; // 1-31
  storeId?: string;
  employeeId?: string;
}

interface NormalizedSalesResponse {
  success: boolean;
  range: { from: string; to: string; year: number; month?: number; day?: number };
  byStore: Array<{
    storeId: string;
    storeName?: string;
    salesAmount: number;
    invoices: number;
    visitors?: number;
    target?: number; // Added for Target Achievement calculation
    kpis: {
      atv: number;
      conversion?: number;
      customerValue?: number;
    };
  }>;
  byEmployee: Array<{
    employeeId: string;
    employeeName?: string;
    storeId?: string;
    storeName?: string;
    salesAmount: number;
    invoices: number;
    kpis: { atv: number };
  }>;
  byDay?: Array<{
    date: string; // "YYYY-MM-DD"
    byStore: Array<{
      storeId: string;
      storeName?: string;
      salesAmount: number;
      invoices: number;
      kpis: { atv: number; customerValue?: number };
    }>;
    byEmployee?: Array<any>;
  }>;
  totals: {
    salesAmount: number;
    invoices: number;
    visitors?: number;
    kpis: { atv: number; conversion?: number; customerValue?: number };
  };
  debug?: { source: 'legacy' | 'd365'; pages?: number; fetched?: number; notes?: string[] };
}

/**
 * Get sales data (hybrid: legacy for 2024/2025, D365 for 2026+)
 */
export async function getSalesData(params: SalesParams): Promise<NormalizedSalesResponse> {
  const { year, month, day, storeId, employeeId } = params;

  if (year <= 2025) {
    // Use PostgreSQL API ONLY for 2024-2025 data (NO legacy fallback)
    const monthParam = month !== undefined ? `&month=${month + 1}` : ''; // API expects 1-12
    const dayParam = day !== undefined ? `&day=${day}` : '';
    const storeParam = storeId ? `&storeId=${encodeURIComponent(storeId)}` : '';
    
    const url = apiUrl(`/api/sales-pg?year=${year}${monthParam}${dayParam}${storeParam}`);
    console.log(`🔗 Fetching PostgreSQL data from: ${url}`);
    
    const response: Response = await fetch(url);
    if (!response.ok) {
      throw new Error(`PostgreSQL API error: ${response.status} ${response.statusText}`);
    }
    
    const result: NormalizedSalesResponse = await response.json();
    
    if (!result.success) {
      console.error('❌ PostgreSQL returned error:', result.debug?.notes);
      // Return empty data instead of throwing (graceful degradation)
      const startDate = new Date(year, month || 0, day || 1);
      const endDate = new Date(year, month !== undefined ? month + 1 : 12, day || 31);
      
      return {
        success: false,
        range: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0],
          year,
          ...(month !== undefined && { month: month + 1 }),
          ...(day !== undefined && { day }),
        },
        byStore: [],
        byDay: [],
        byEmployee: [],
        totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
        debug: {
          source: 'postgresql',
          notes: result.debug?.notes || ['PostgreSQL connection failed'],
        },
      };
    }
    
    // Add visitors from orange-dashboard (frontend-side merge, like before)
    // Visitors will be merged in DataProvider during initialization
    return result;
  } else {
    // Use D365 SQL API ONLY (2026+) - unified SQL source
    // All data comes from PostgreSQL dynamic_sales_bills and dynamic_sales_items
    const monthParam = month !== undefined ? `&month=${month}` : '';
    const dayParam = day !== undefined ? `&day=${day}` : '';
    const storeParam = storeId ? `&storeId=${encodeURIComponent(storeId)}` : '';
    
    const url = apiUrl(`/api/sales-d365-sql?year=${year}${monthParam}${dayParam}${storeParam}`);
    console.log(`🔗 Fetching D365 SQL data from: ${url}`);
    
    try {
      const response: Response = await fetch(url);
      if (!response.ok) {
        throw new Error(`D365 SQL API error: ${response.status} ${response.statusText}`);
      }
      
      const result: NormalizedSalesResponse = await response.json();
      
      if (!result.success) {
        console.warn('⚠️ D365 SQL returned error:', result.debug?.notes);
        // Return empty data instead of fallback (SQL is the only source)
        const startDate = new Date(year, month || 0, day || 1);
        const endDate = new Date(year, month !== undefined ? month + 1 : 12, day || 31);
        
        return {
          success: false,
          range: {
            from: startDate.toISOString().split('T')[0],
            to: endDate.toISOString().split('T')[0],
            year,
            ...(month !== undefined && { month: month + 1 }),
            ...(day !== undefined && { day }),
          },
          byStore: [],
          byDay: [],
          byEmployee: [],
          totals: { salesAmount: 0, invoices: 0, kpis: { atv: 0, customerValue: 0 } },
          debug: {
            source: 'sql-d365',
            notes: result.debug?.notes || ['SQL connection failed - no data available'],
          },
        };
      }
      
      // D365 SQL data already includes targets/visitors
      return result;
    } catch (error: any) {
      console.error('❌ Error fetching D365 sales:', error);
      // Return empty response on error
      const startDate = new Date(year, month || 0, day || 1);
      const endDate = new Date(year, month !== undefined ? month + 1 : 12, day || 31);
      
      return {
        success: false,
        range: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0],
          year,
          ...(month !== undefined && { month: month + 1 }),
          ...(day !== undefined && { day }),
        },
        byStore: [],
        byEmployee: [],
        totals: {
          salesAmount: 0,
          invoices: 0,
          kpis: { atv: 0, customerValue: 0 },
        },
        debug: {
          source: 'd365',
          notes: [`Error: ${error.message}`],
        },
      };
    }
  }
}

/**
 * Get live sales (always from D365)
 */
export async function getLiveSales(): Promise<any> {
  try {
    const url = apiUrl('/api/live-sales');
    const response: Response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Live sales API error: ${response.status}`);
    }
    
    const result: any = await response.json();
    return result;
  } catch (error: any) {
    console.error('❌ Error fetching live sales:', error);
    return {
      success: false,
      today: [],
      yesterday: [],
      error: error.message,
    };
  }
}

/**
 * Get stores list (hybrid: PostgreSQL for 2024/2025, D365 API for 2026+)
 */
export async function getStores(year?: number): Promise<Array<{ id: string; name: string; areaManager: string; city?: string }>> {
  // For 2024/2025, use PostgreSQL
  if (year && year <= 2025) {
    try {
      const url = apiUrl('/api/get-stores-pg');
      const response: Response = await fetch(url);
      
      if (response.ok) {
        const result: any = await response.json();
        if (result.success && Array.isArray(result.stores)) {
          console.log(`✅ Loaded ${result.stores.length} stores from PostgreSQL for year ${year}`);
          return result.stores;
        }
      }
    } catch (error: any) {
      console.error('❌ Error fetching stores from PostgreSQL:', error);
      // Fallback to legacy stores if PostgreSQL fails
      return getLegacyStores();
    }
  }
  
  // For 2026+, try D365 API (fallback to empty if fails)
  try {
    const url = apiUrl('/api/get-stores');
    const response: Response = await fetch(url);
    
    if (response.ok) {
      const result: any = await response.json();
      if (result.success && Array.isArray(result.stores)) {
        console.log(`✅ Loaded ${result.stores.length} stores from D365 API for year ${year}`);
        return result.stores;
      }
    }
  } catch (error: any) {
    console.error('❌ Error fetching stores from D365 API:', error);
  }
  
  // Fallback: empty array
  return [];
}
