/**
 * Hybrid Data Provider
 * Switches between Legacy (2024/2025) and D365 (2026+) based on year
 */

import { getLegacyMetrics, getLegacyStores } from './legacyProvider';
import { apiUrl } from '../utils/apiBase';

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
    // Use legacy provider
    const legacyResult = await getLegacyMetrics({ year, month, day, storeId });
    
    // Convert legacy response to normalized format
    return {
      success: legacyResult.success,
      range: legacyResult.debug.range,
      byStore: legacyResult.byStore.map(store => ({
        storeId: store.storeId,
        storeName: store.storeName,
        salesAmount: store.salesAmount,
        invoices: store.invoices,
        visitors: store.visitors,
        kpis: {
          atv: store.atv,
          conversion: store.conversion,
          customerValue: store.atv,
        },
      })),
      byDay: legacyResult.byDay?.map(day => ({
        date: day.date,
        byStore: day.byStore.map(store => ({
          storeId: store.storeId,
          storeName: store.storeName,
          salesAmount: store.salesAmount,
          invoices: store.invoices,
          kpis: {
            atv: store.atv,
            conversion: store.conversion,
            customerValue: store.atv,
          },
        })),
      })),
      byEmployee: [], // ALWAYS EMPTY for legacy
      totals: {
        salesAmount: legacyResult.totals.salesAmount,
        invoices: legacyResult.totals.invoices,
        visitors: legacyResult.totals.visitors,
        kpis: {
          atv: legacyResult.totals.atv,
          conversion: legacyResult.totals.conversion,
          customerValue: legacyResult.totals.atv,
        },
      },
      debug: {
        source: 'legacy',
        notes: [`Legacy data from management_data.json`, `Stores: ${legacyResult.debug.counts.stores}`, `Daily breakdown: ${legacyResult.byDay?.length || 0} days`],
      },
    };
  } else {
    // Use D365 API (2026+)
    try {
      const monthParam = month !== undefined ? `&month=${month}` : '';
      const dayParam = day !== undefined ? `&day=${day}` : '';
      const storeParam = storeId ? `&storeId=${encodeURIComponent(storeId)}` : '';
      const empParam = employeeId ? `&employeeId=${encodeURIComponent(employeeId)}` : '';
      
      const url = apiUrl(`/api/sales?year=${year}${monthParam}${dayParam}${storeParam}${empParam}`);
      console.log(`🔗 Fetching D365 data from: ${url}`);
      
      const response: Response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const result: NormalizedSalesResponse = await response.json();
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
 * Get stores list (hybrid: legacy for 2024/2025, API for 2026+)
 */
export async function getStores(year?: number): Promise<Array<{ id: string; name: string; areaManager: string; city?: string }>> {
  // For 2024/2025, use legacy stores
  if (year && year <= 2025) {
    return getLegacyStores();
  }
  
  // For 2026+, try API (fallback to empty if fails)
  try {
    const url = apiUrl('/api/get-stores');
    const response: Response = await fetch(url);
    
    if (response.ok) {
      const result: any = await response.json();
      if (result.success && Array.isArray(result.stores)) {
        return result.stores;
      }
    }
  } catch (error: any) {
    console.error('❌ Error fetching stores from API:', error);
  }
  
  // Fallback: empty array
  return [];
}
