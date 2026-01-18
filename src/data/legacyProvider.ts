/**
 * Legacy Data Provider (2024/2025)
 * Loads data from public/data/management_data.json
 * Returns normalized response matching cockpit needs
 */

interface ManagementData {
  store_meta?: {
    [storeId: string]: {
      manager?: string;
      store_name?: string;
      outlet?: string;
      city?: string;
    };
  };
  sales?: Array<[string, string, number]>; // ["YYYY-MM-DD", "STORE_ID", amount]
  visitors?: Array<[string, string, number]>; // ["YYYY-MM-DD", "STORE_ID", count]
  transactions?: Array<[string, string, number]>; // ["YYYY-MM-DD", "STORE_ID", count]
  targets?: {
    [year: string]: {
      [storeId: string]: {
        [month: string]: number;
      };
    };
  };
}

interface LegacyMetricsParams {
  year: number;
  month?: number; // 0-11
  day?: number; // 1-31
  storeId?: string;
}

interface LegacyResponse {
  success: boolean;
  totals: {
    salesAmount: number;
    visitors: number;
    invoices: number;
    atv: number;
    conversion: number;
  };
  byStore: Array<{
    storeId: string;
    storeName?: string;
    salesAmount: number;
    visitors: number;
    invoices: number;
    atv: number;
    conversion: number;
  }>;
  byDay?: Array<{
    date: string; // "YYYY-MM-DD"
    byStore: Array<{
      storeId: string;
      storeName?: string;
      salesAmount: number;
      visitors: number;
      invoices: number;
      atv: number;
      conversion: number;
    }>;
  }>;
  byEmployee: []; // ALWAYS EMPTY for legacy
  debug: {
    source: 'legacy';
    range: { from: string; to: string; year: number; month?: number; day?: number };
    counts: { stores: number; salesEntries: number; visitorEntries: number; transactionEntries: number };
  };
}

let cachedData: ManagementData | null = null;
let loadingPromise: Promise<ManagementData> | null = null;

async function loadManagementData(): Promise<ManagementData> {
  if (cachedData) {
    return cachedData;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      // Ensure baseUrl ends with / and remove leading / from path
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const url = `${cleanBase}data/management_data.json`;
      console.log('📥 Loading legacy data from:', url);
      
      const response: Response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load management_data.json: ${response.status} ${response.statusText}`);
      }
      
      const data: ManagementData = await response.json();
      cachedData = data;
      console.log(`✅ Loaded legacy data: ${data.sales?.length || 0} sales, ${data.visitors?.length || 0} visitors, ${data.transactions?.length || 0} transactions`);
      return data;
    } catch (error: any) {
      console.error('❌ Error loading management_data.json:', error);
      throw error;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

export async function getLegacyMetrics(params: LegacyMetricsParams): Promise<LegacyResponse> {
  const { year, month, day, storeId } = params;

  // Calculate date range
  const startDate = new Date(Date.UTC(year, month !== undefined ? month : 0, day || 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(
    year,
    month !== undefined ? month + 1 : 12,
    day || (month !== undefined ? new Date(year, month + 1, 0).getDate() : 31),
    23, 59, 59
  ));

  try {
    const data = await loadManagementData();

    // Build Maps for fast lookup
    const salesMap = new Map<string, number>(); // key: "YYYY-MM-DD_STORE_ID"
    const visitorsMap = new Map<string, number>();
    const transactionsMap = new Map<string, number>();

    // Filter and aggregate sales
    const sales = data.sales || [];
    let salesEntriesCount = 0;
    sales.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 3) return;
      const [dateStr, entryStoreId, amount] = entry;
      
      if (storeId && entryStoreId !== storeId) return;
      
      const entryDate = new Date(dateStr + 'T00:00:00Z');
      if (entryDate.getUTCFullYear() !== year) return;
      if (month !== undefined && entryDate.getUTCMonth() !== month) return;
      if (day !== undefined && entryDate.getUTCDate() !== day) return;

      const key = `${dateStr}_${entryStoreId}`;
      salesMap.set(key, (salesMap.get(key) || 0) + (Number(amount) || 0));
      salesEntriesCount++;
    });

    // Filter and aggregate visitors
    const visitors = data.visitors || [];
    let visitorEntriesCount = 0;
    visitors.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 3) return;
      const [dateStr, entryStoreId, count] = entry;
      
      if (storeId && entryStoreId !== storeId) return;
      
      const entryDate = new Date(dateStr + 'T00:00:00Z');
      if (entryDate.getUTCFullYear() !== year) return;
      if (month !== undefined && entryDate.getUTCMonth() !== month) return;
      if (day !== undefined && entryDate.getUTCDate() !== day) return;

      const key = `${dateStr}_${entryStoreId}`;
      visitorsMap.set(key, (visitorsMap.get(key) || 0) + (Number(count) || 0));
      visitorEntriesCount++;
    });

    // Filter and aggregate transactions
    const transactions = data.transactions || [];
    let transactionEntriesCount = 0;
    transactions.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 3) return;
      const [dateStr, entryStoreId, count] = entry;
      
      if (storeId && entryStoreId !== storeId) return;
      
      const entryDate = new Date(dateStr + 'T00:00:00Z');
      if (entryDate.getUTCFullYear() !== year) return;
      if (month !== undefined && entryDate.getUTCMonth() !== month) return;
      if (day !== undefined && entryDate.getUTCDate() !== day) return;

      const key = `${dateStr}_${entryStoreId}`;
      transactionsMap.set(key, (transactionsMap.get(key) || 0) + (Number(count) || 0));
      transactionEntriesCount++;
    });

    // Aggregate by store
    const storeAggregates = new Map<string, {
      salesAmount: number;
      visitors: number;
      invoices: number;
    }>();

    // Process all keys from all maps
    const allKeys = new Set<string>();
    salesMap.forEach((_, key) => allKeys.add(key));
    visitorsMap.forEach((_, key) => allKeys.add(key));
    transactionsMap.forEach((_, key) => allKeys.add(key));

    allKeys.forEach((key) => {
      const [, storeIdFromKey] = key.split('_');
      
      if (!storeAggregates.has(storeIdFromKey)) {
        storeAggregates.set(storeIdFromKey, { salesAmount: 0, visitors: 0, invoices: 0 });
      }
      
      const agg = storeAggregates.get(storeIdFromKey)!;
      agg.salesAmount += salesMap.get(key) || 0;
      agg.visitors += visitorsMap.get(key) || 0;
      agg.invoices += transactionsMap.get(key) || 0;
    });

    // Build byStore array
    const storeMeta = data.store_meta || {};
    const byStore = Array.from(storeAggregates.entries()).map(([storeId, agg]) => {
      const meta = storeMeta[storeId] || {};
      const storeName = meta.store_name || meta.outlet || storeId;
      
      // Calculate KPIs (prevent NaN/Infinity)
      const atv = agg.invoices > 0 ? agg.salesAmount / agg.invoices : 0;
      const conversion = agg.visitors > 0 ? (agg.invoices / agg.visitors) * 100 : 0;
      
      return {
        storeId,
        storeName,
        salesAmount: Number.isFinite(agg.salesAmount) ? agg.salesAmount : 0,
        visitors: Number.isFinite(agg.visitors) ? agg.visitors : 0,
        invoices: Number.isFinite(agg.invoices) ? agg.invoices : 0,
        atv: Number.isFinite(atv) ? atv : 0,
        conversion: Number.isFinite(conversion) ? conversion : 0,
      };
    });

    // Calculate totals
    const totals = {
      salesAmount: 0,
      visitors: 0,
      invoices: 0,
      atv: 0,
      conversion: 0,
    };

    byStore.forEach((store) => {
      totals.salesAmount += store.salesAmount;
      totals.visitors += store.visitors;
      totals.invoices += store.invoices;
    });

    totals.atv = totals.invoices > 0 ? totals.salesAmount / totals.invoices : 0;
    totals.conversion = totals.visitors > 0 ? (totals.invoices / totals.visitors) * 100 : 0;

    // Ensure no NaN/Infinity in totals
    totals.atv = Number.isFinite(totals.atv) ? totals.atv : 0;
    totals.conversion = Number.isFinite(totals.conversion) ? totals.conversion : 0;

    // Build byDay array (for daily breakdown - same as D365 pattern)
    // Group daily data by date from the maps (key format: "YYYY-MM-DD_STORE_ID")
    const dailyByDate = new Map<string, Map<string, {
      salesAmount: number;
      visitors: number;
      invoices: number;
    }>>();

    // Process all keys from all maps to build daily breakdown
    allKeys.forEach((key) => {
      const [dateStr, storeIdFromKey] = key.split('_');
      
      if (!dailyByDate.has(dateStr)) {
        dailyByDate.set(dateStr, new Map());
      }
      
      const dayStoresMap = dailyByDate.get(dateStr)!;
      if (!dayStoresMap.has(storeIdFromKey)) {
        dayStoresMap.set(storeIdFromKey, { salesAmount: 0, visitors: 0, invoices: 0 });
      }
      
      const dayStoreData = dayStoresMap.get(storeIdFromKey)!;
      dayStoreData.salesAmount += salesMap.get(key) || 0;
      dayStoreData.visitors += visitorsMap.get(key) || 0;
      dayStoreData.invoices += transactionsMap.get(key) || 0;
    });

    // Convert to byDay array format
    const byDay = Array.from(dailyByDate.entries()).map(([dateStr, dayStoresMap]) => {
      const storeMeta = data.store_meta || {};
      return {
        date: dateStr,
        byStore: Array.from(dayStoresMap.entries()).map(([storeId, dayData]) => {
          const meta = storeMeta[storeId] || {};
          const storeName = meta.store_name || meta.outlet || storeId;
          const atv = dayData.invoices > 0 ? dayData.salesAmount / dayData.invoices : 0;
          const conversion = dayData.visitors > 0 ? (dayData.invoices / dayData.visitors) * 100 : 0;
          
          return {
            storeId,
            storeName,
            salesAmount: Number.isFinite(dayData.salesAmount) ? dayData.salesAmount : 0,
            visitors: Number.isFinite(dayData.visitors) ? dayData.visitors : 0,
            invoices: Number.isFinite(dayData.invoices) ? dayData.invoices : 0,
            atv: Number.isFinite(atv) ? atv : 0,
            conversion: Number.isFinite(conversion) ? conversion : 0,
          };
        }),
      };
    }).sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

    console.log(`📅 Built ${byDay.length} days of legacy data from ${salesEntriesCount + visitorEntriesCount + transactionEntriesCount} entries`);

    return {
      success: true,
      totals,
      byStore,
      byDay, // Daily breakdown (same format as D365)
      byEmployee: [], // ALWAYS EMPTY for legacy
      debug: {
        source: 'legacy',
        range: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0],
          year,
          ...(month !== undefined && { month: month + 1 }),
          ...(day !== undefined && { day }),
        },
        counts: {
          stores: byStore.length,
          salesEntries: salesEntriesCount,
          visitorEntries: visitorEntriesCount,
          transactionEntries: transactionEntriesCount,
        },
      },
    };
  } catch (error: any) {
    console.error('❌ Error in getLegacyMetrics:', error);
    return {
      success: false,
      totals: { salesAmount: 0, visitors: 0, invoices: 0, atv: 0, conversion: 0 },
      byStore: [],
      byEmployee: [],
      debug: {
        source: 'legacy',
        range: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0],
          year,
          ...(month !== undefined && { month: month + 1 }),
          ...(day !== undefined && { day }),
        },
        counts: { stores: 0, salesEntries: 0, visitorEntries: 0, transactionEntries: 0 },
      },
    };
  }
}

/**
 * Get stores list from legacy data
 */
export async function getLegacyStores(): Promise<Array<{ id: string; name: string; areaManager: string; city?: string }>> {
  try {
    const data = await loadManagementData();
    const storeMeta = data.store_meta || {};
    
    return Object.entries(storeMeta).map(([storeId, meta]) => ({
      id: storeId,
      name: meta.store_name || meta.outlet || storeId,
      areaManager: meta.manager || '',
      city: meta.city,
    })).filter(store => store.areaManager); // Only stores with managers
  } catch (error: any) {
    console.error('❌ Error getting legacy stores:', error);
    return [];
  }
}
