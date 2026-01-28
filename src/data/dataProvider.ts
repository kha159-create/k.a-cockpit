
import { apiUrl } from '../utils/apiBase';

export interface SalesParams {
  year: number;
  month?: number; // 0-11
  day?: number; // 1-31
  storeId?: string;
  employeeId?: string;
}

export interface NormalizedSalesResponse {
  success: boolean;
  range: { from: string; to: string; year: number; month?: number; day?: number };
  byStore: Array<{
    storeId: string;
    storeName?: string;
    city?: string;
    salesAmount: number;
    invoices: number;
    visitors?: number;
    target?: number;
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
    date: string;
    byStore: Array<{
      storeId: string;
      storeName?: string;
      salesAmount: number;
      invoices: number;
      kpis: { atv: number; customerValue?: number };
    }>;
  }>;
  totals: {
    salesAmount: number;
    invoices: number;
    visitors?: number;
    target?: number;
    kpis: { atv: number; conversion?: number; customerValue?: number };
  };
  debug?: { source: 'legacy' | 'd365' | 'unified-sql'; notes?: string[] };
}

/**
 * Convert JSON data format (from GitHub) to NormalizedSalesResponse format
 */
function convertJsonToSalesResponse(
  jsonData: any,
  params: SalesParams
): NormalizedSalesResponse {
  const { year, month, day, storeId } = params;
  
  // Calculate date range
  const startDate = new Date(year, month || 0, day || 1);
  const endDate = new Date(year, month !== undefined ? month + 1 : 12, day || 31);
  
  // Filter sales data by date range
  const salesArray = (jsonData.sales || []) as Array<[string, string, number]>;
  const filteredSales = salesArray.filter(([date]) => {
    const saleDate = new Date(date);
    if (month !== undefined && day !== undefined) {
      return saleDate.getFullYear() === year && 
             saleDate.getMonth() === month && 
             saleDate.getDate() === day;
    } else if (month !== undefined) {
      return saleDate.getFullYear() === year && saleDate.getMonth() === month;
    } else {
      return saleDate.getFullYear() === year;
    }
  });
  
  // Filter by store if specified
  const storeFilteredSales = storeId 
    ? filteredSales.filter(([, store]) => store === storeId)
    : filteredSales;
  
  // Group by store
  const storeMap = jsonData.stores || {};
  const storeMeta = jsonData.store_meta || {};
  const targetsMap = new Map<string, number>();
  const visitorsMap = new Map<string, number>();
  
  // Build targets map
  (jsonData.targets || []).forEach(([date, store, amount]: [string, string, number]) => {
    const targetDate = new Date(date);
    if (targetDate.getFullYear() === year && 
        (month === undefined || targetDate.getMonth() === month)) {
      targetsMap.set(store, (targetsMap.get(store) || 0) + amount);
    }
  });
  
  // Build visitors map
  (jsonData.visitors || []).forEach(([date, store, count]: [string, string, number]) => {
    const visitDate = new Date(date);
    if (visitDate.getFullYear() === year && 
        (month === undefined || visitDate.getMonth() === month)) {
      visitorsMap.set(store, (visitorsMap.get(store) || 0) + count);
    }
  });
  
  // Aggregate by store
  const storeSales = new Map<string, { sales: number; invoices: number }>();
  const daySales = new Map<string, Map<string, { sales: number; invoices: number }>>();
  
  storeFilteredSales.forEach(([date, store, amount]) => {
    // Aggregate by store
    const storeData = storeSales.get(store) || { sales: 0, invoices: 0 };
    storeData.sales += amount;
    storeData.invoices += 1;
    storeSales.set(store, storeData);
    
    // Aggregate by day
    if (!daySales.has(date)) {
      daySales.set(date, new Map());
    }
    const dayStoreData = daySales.get(date)!.get(store) || { sales: 0, invoices: 0 };
    dayStoreData.sales += amount;
    dayStoreData.invoices += 1;
    daySales.get(date)!.set(store, dayStoreData);
  });
  
  // Build byStore array
  const byStore = Array.from(storeSales.entries()).map(([storeId, data]) => {
    const storeName = storeMap[storeId] || storeId;
    const meta = storeMeta[storeId] || {};
    const target = targetsMap.get(storeId) || 0;
    const visitors = visitorsMap.get(storeId) || 0;
    const atv = data.invoices > 0 ? data.sales / data.invoices : 0;
    
    return {
      storeId,
      storeName,
      city: meta.city,
      salesAmount: Math.round(data.sales * 100) / 100,
      invoices: data.invoices,
      visitors,
      target,
      kpis: {
        atv: Math.round(atv * 100) / 100,
        customerValue: atv,
      },
    };
  });
  
  // Build byDay array
  const byDay = Array.from(daySales.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stores]) => ({
      date,
      byStore: Array.from(stores.entries()).map(([storeId, data]) => {
        const storeName = storeMap[storeId] || storeId;
        const atv = data.invoices > 0 ? data.sales / data.invoices : 0;
        return {
          storeId,
          storeName,
          salesAmount: Math.round(data.sales * 100) / 100,
          invoices: data.invoices,
          kpis: {
            atv: Math.round(atv * 100) / 100,
            customerValue: atv,
          },
        };
      }),
    }));
  
  // Calculate totals
  const totalSales = Array.from(storeSales.values()).reduce((sum, d) => sum + d.sales, 0);
  const totalInvoices = Array.from(storeSales.values()).reduce((sum, d) => sum + d.invoices, 0);
  const totalVisitors = Array.from(visitorsMap.values()).reduce((sum, v) => sum + v, 0);
  const totalTarget = Array.from(targetsMap.values()).reduce((sum, t) => sum + t, 0);
  const totalAtv = totalInvoices > 0 ? totalSales / totalInvoices : 0;
  
  return {
    success: true,
    range: {
      from: startDate.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0],
      year,
      ...(month !== undefined && { month: month + 1 }),
      ...(day !== undefined && { day }),
    },
    byStore,
    byDay,
    byEmployee: [], // TODO: Add employee data from employees_data.json
    totals: {
      salesAmount: Math.round(totalSales * 100) / 100,
      invoices: totalInvoices,
      visitors: totalVisitors,
      target: totalTarget,
      kpis: {
        atv: Math.round(totalAtv * 100) / 100,
        customerValue: totalAtv,
      },
    },
    debug: {
      source: 'github-json',
      notes: ['Data loaded from GitHub JSON files'],
    },
  };
}

/**
 * Get sales data (hybrid: JSON from GitHub for 2024/2025, D365 SQL for 2026+)
 */
export async function getSalesData(params: SalesParams): Promise<NormalizedSalesResponse> {
  const { year, month, day, storeId } = params;

  if (year <= 2025) {
    // Use JSON API from GitHub for 2024-2025 (like reference project)
    const url = apiUrl('/api/read-json-data?type=management');
    console.log(`🔗 Fetching JSON data from GitHub: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`JSON API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        console.error('❌ JSON API returned error:', result.error);
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
            source: 'github-json',
            notes: [result.error || 'JSON API failed'],
          },
        };
      }
      
      // Convert JSON format to NormalizedSalesResponse
      return convertJsonToSalesResponse(result.data, params);
    } catch (err: any) {
      console.error(`❌ Error fetching JSON data for ${year}:`, err);
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
          source: 'github-json',
          notes: [err.message],
        },
      };
    }
  } else {
    // Use D365 SQL API for 2026+
    const monthParam = month !== undefined ? `&month=${month}` : '';
    const dayParam = day !== undefined ? `&day=${day}` : '';
    const storeParam = storeId ? `&storeId=${encodeURIComponent(storeId)}` : '';
    
    const url = apiUrl(`/api/sales-d365-sql?year=${year}${monthParam}${dayParam}${storeParam}`);
    console.log(`🔗 Fetching D365 SQL data from: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`D365 SQL API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        console.warn('⚠️ D365 SQL returned error:', result.debug?.notes);
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
            notes: result.debug?.notes || ['SQL connection failed'],
          },
        };
      }
      
      return result;
    } catch (err: any) {
      console.error(`❌ Error fetching D365 SQL data for ${year}:`, err);
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
          notes: [err.message],
        },
      };
    }
  }
}

export async function getLiveSales(): Promise<any> {
  try {
    const url = apiUrl('/api/live-sales');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Live API error: ${response.status}`);
    return await response.json();
  } catch (e: any) {
    console.error("❌ Live Sales Error:", e);
    return { success: false, today: [], yesterday: [], error: e.message };
  }
}

export async function getStores(year?: number): Promise<Array<{ id: string; name: string; areaManager: string; city?: string; is_online?: boolean }>> {
  try {
    const url = apiUrl('/api/get-stores');
    const response = await fetch(url);
    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.stores)) {
        console.log(`✅ Loaded ${result.stores.length} stores from API`);
        return result.stores;
      }
    }
    return [];
  } catch (e) {
    console.error("❌ API getStores Error:", e);
    return [];
  }
}

export async function getEmployees(): Promise<any[]> {
  try {
    const url = apiUrl('/api/get-employees');
    const response = await fetch(url);
    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.employees)) {
        return result.employees;
      }
    }
    return [];
  } catch (e) {
    console.error("❌ API getEmployees Error:", e);
    return [];
  }
}

export async function fetchEmployeeMappings(): Promise<any[]> {
  try {
    const url = apiUrl('/api/get-employee-mappings');
    const response = await fetch(url);
    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.mappings)) {
        return result.mappings;
      }
    }
    return [];
  } catch (e) {
    console.error("❌ API fetchEmployeeMappings Error:", e);
    return [];
  }
}

export async function getProducts(): Promise<any[]> {
  try {
    const url = apiUrl('/api/get-products');
    const response = await fetch(url);
    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.products)) {
        return result.products;
      }
    }
    return [];
  } catch (e) {
    console.error("❌ API getProducts Error:", e);
    return [];
  }
}
