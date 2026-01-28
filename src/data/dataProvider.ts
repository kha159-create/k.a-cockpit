
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
 * Get sales data (hybrid: PostgreSQL for 2024/2025, D365 SQL for 2026+)
 */
export async function getSalesData(params: SalesParams): Promise<NormalizedSalesResponse> {
  const { year, month, day, storeId } = params;

  if (year <= 2025) {
    // Use PostgreSQL API for 2024-2025
    const monthParam = month !== undefined ? `&month=${month}` : ''; // API expects 0-11
    const dayParam = day !== undefined ? `&day=${day}` : '';
    const storeParam = storeId ? `&storeId=${encodeURIComponent(storeId)}` : '';
    
    const url = apiUrl(`/api/sales-pg?year=${year}${monthParam}${dayParam}${storeParam}`);
    console.log(`🔗 Fetching PostgreSQL data from: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`PostgreSQL API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        console.error('❌ PostgreSQL returned error:', result.debug?.notes);
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
      
      return result;
    } catch (err: any) {
      console.error(`❌ Error fetching PostgreSQL data for ${year}:`, err);
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
