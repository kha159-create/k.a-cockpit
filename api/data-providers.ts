/**
 * Hybrid Data Provider System (orange-dashboard architecture)
 * 
 * Legacy (2024-2025): Store-level metrics from management_data.json (NO employees)
 * D365 (2026+): Store + Employee metrics from D365 RetailTransactions API
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';
import * as XLSX from 'xlsx';

// ============================================================================
// NORMALIZED RESPONSE TYPES
// ============================================================================

export type NormalizedSalesResponse = {
  success: boolean;
  range: { from: string; to: string; year: number; month?: number; day?: number };
  byStore: Array<{
    storeId: string;
    storeName?: string;
    salesAmount: number;
    invoices: number;
    visitors?: number;
    kpis: {
      atv: number;          // salesAmount / invoices
      conversion?: number;  // invoices / visitors (if visitors exists)
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
    kpis: { atv: number };
  }>;
  totals: {
    salesAmount: number;
    invoices: number;
    visitors?: number;
    kpis: { atv: number; conversion?: number; customerValue?: number };
  };
  debug?: { source: 'legacy' | 'd365'; pages?: number; fetched?: number; notes?: string[] };
};

// ============================================================================
// LEGACY DATA PROVIDER (2024-2025)
// ============================================================================

interface LegacyManagementData {
  store_meta?: {
    [storeId: string]: {
      manager?: string;
      store_name?: string;
      outlet?: string;
      city?: string;
    };
  };
  // Legacy store metrics (if available in management_data.json)
  // Format may vary - needs inspection
  [key: string]: any;
}

/**
 * Load legacy data from orange-dashboard employees_data.json
 * For 2024/2025: employees_data.json contains data, but we aggregate to STORE-LEVEL only (NO employee breakdown)
 * Format: { "storeId": [["date", "employeeName", sales, transactions, ...], ...], ... }
 */
async function loadLegacyStoreMetrics(
  year: number,
  month?: number
): Promise<Map<string, { salesAmount: number; invoices: number; visitors?: number }>> {
  const metrics = new Map<string, { salesAmount: number; invoices: number; visitors?: number }>();
  
  try {
    // Load employees_data.json - it contains data for 2024/2025 but we aggregate to store level
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/employees_data.json');
    
    if (!response.ok) {
      console.warn(`⚠️ Could not fetch employees_data.json for legacy year ${year}`);
      return metrics;
    }
    
    const employeesData: { [storeId: string]: any[][] } = await response.json();
    
    // Aggregate ALL employee entries to store-level totals (ignore employee breakdown for legacy years)
    Object.entries(employeesData).forEach(([storeId, entries]) => {
      if (!Array.isArray(entries)) return;
      
      entries.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length < 3) return;
        
        const dateStr = String(entry[0] || '').trim();
        const sales = Number(entry[2]) || 0;
        const transactions = Number(entry[3]) || 0;
        
        if (!dateStr || sales === 0) return;
        
        // Parse date and filter by year/month
        try {
          const txDate = new Date(dateStr + 'T00:00:00Z');
          if (txDate.getUTCFullYear() !== year) return;
          if (month !== undefined && txDate.getUTCMonth() !== month) return;
        } catch (e) {
          return;
        }
        
        // Aggregate to store level (sum all employee sales for this store)
        if (!metrics.has(storeId)) {
          metrics.set(storeId, { salesAmount: 0, invoices: 0 });
        }
        const storeData = metrics.get(storeId)!;
        storeData.salesAmount += sales;
        storeData.invoices += transactions;
      });
    });
    
    console.log(`✅ Loaded legacy store metrics for ${year}: ${metrics.size} stores`);
  } catch (error: any) {
    console.error(`❌ Error loading legacy metrics for ${year}:`, error.message);
  }

  return metrics;
}

/**
 * Legacy Data Provider - Returns store-level metrics only (NO employees)
 */
export async function getLegacySalesData(
  year: number,
  month?: number,
  day?: number
): Promise<NormalizedSalesResponse> {
  const startDate = new Date(Date.UTC(year, month || 0, day || 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(
    year,
    month !== undefined ? month + 1 : 12,
    day || (month !== undefined ? new Date(year, month + 1, 0).getDate() : 31),
    23, 59, 59
  ));

  // Load legacy store metrics
  const legacyMetrics = await loadLegacyStoreMetrics(year, month);

  // Load store metadata for names
  let storeMetadata: LegacyManagementData = {};
  try {
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/management_data.json');
    if (response.ok) {
      storeMetadata = await response.json();
    }
  } catch (error: any) {
    console.error('❌ Error loading store metadata:', error.message);
  }

  const storeMeta = storeMetadata.store_meta || {};

  // Build byStore array
  const byStore: NormalizedSalesResponse['byStore'] = [];
  let totalSales = 0;
  let totalInvoices = 0;
  let totalVisitors = 0;

  legacyMetrics.forEach((metrics, storeId) => {
    const meta = storeMeta[storeId] || {};
    const storeName = meta.store_name || meta.outlet || storeId;
    
    const salesAmount = metrics.salesAmount || 0;
    const invoices = metrics.invoices || 0;
    const visitors = metrics.visitors;

    totalSales += salesAmount;
    totalInvoices += invoices;
    if (visitors !== undefined) totalVisitors += visitors;

    // Calculate KPIs (guard divide-by-zero)
    const atv = invoices > 0 ? salesAmount / invoices : 0;
    const conversion = visitors && visitors > 0 ? (invoices / visitors) * 100 : undefined;

    byStore.push({
      storeId,
      storeName,
      salesAmount,
      invoices,
      ...(visitors !== undefined && { visitors }),
      kpis: {
        atv: Number.isFinite(atv) ? atv : 0,
        ...(conversion !== undefined && { conversion: Number.isFinite(conversion) ? conversion : 0 }),
        customerValue: Number.isFinite(atv) ? atv : 0,
      },
    });
  });

  // Calculate total KPIs
  const totalAtv = totalInvoices > 0 ? totalSales / totalInvoices : 0;
  const totalConversion = totalVisitors > 0 ? (totalInvoices / totalVisitors) * 100 : undefined;

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
    byEmployee: [], // Legacy years have NO employee data
    totals: {
      salesAmount: totalSales,
      invoices: totalInvoices,
      ...(totalVisitors > 0 && { visitors: totalVisitors }),
      kpis: {
        atv: Number.isFinite(totalAtv) ? totalAtv : 0,
        ...(totalConversion !== undefined && { conversion: Number.isFinite(totalConversion) ? totalConversion : 0 }),
        customerValue: Number.isFinite(totalAtv) ? totalAtv : 0,
      },
    },
    debug: {
      source: 'legacy',
      notes: [
        `Legacy data for year ${year}`,
        `No employee-level data available for legacy years`,
        ...(legacyMetrics.size === 0 ? ['⚠️ No legacy metrics found - may need to load from orange-dashboard'] : []),
      ],
    },
  };
}

// ============================================================================
// D365 DATA PROVIDER (2026+)
// ============================================================================

interface D365Transaction {
  OperatingUnitNumber: string;
  PaymentAmount: number;
  TransactionDate: string;
  StaffId?: string;
  StaffName?: string;
  [key: string]: any;
}

async function getD365AccessToken(): Promise<string> {
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const tenantId = process.env.D365_TENANT_ID;
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Missing D365 credentials');
  }

  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const scope = `${d365Url}/.default`;

  const app = new ConfidentialClientApplication({
    auth: { clientId, clientSecret, authority },
  });

  const result = await app.acquireTokenByClientCredential({ scopes: [scope] });

  if (!result?.accessToken) {
    throw new Error(`Auth failed: ${JSON.stringify(result)}`);
  }

  return result.accessToken;
}

async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    if (!response.ok) return mapping;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];
    
    const firstRow = data[0] || {};
    const keys = Object.keys(firstRow);
    
    const storeIdCol = keys.find(k => {
      const kLower = k.toLowerCase();
      return kLower.includes('store') && (kLower.includes('number') || kLower.includes('id'));
    }) || keys[0];
    
    const storeNameCol = keys.find(k => {
      const kLower = k.toLowerCase();
      return kLower.includes('outlet') || (kLower.includes('name') && !kLower.includes('store'));
    }) || keys[1];
    
    data.forEach((row: any) => {
      const storeId = String(row[storeIdCol] || '').trim();
      const storeName = String(row[storeNameCol] || '').trim();
      if (storeId && storeName && storeId !== 'NaN' && storeName !== 'NaN') {
        mapping.set(storeId, storeName);
      }
    });
  } catch (error: any) {
    console.error('❌ Error loading store mapping:', error.message);
  }

  return mapping;
}

async function fetchD365Transactions(
  token: string,
  startDate: Date,
  endDate: Date,
  storeId?: string,
  employeeId?: string
): Promise<{ transactions: D365Transaction[]; pages: number }> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  let filter = `PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}`;
  if (storeId) filter += ` and OperatingUnitNumber eq '${storeId}'`;
  if (employeeId) filter += ` and StaffId eq '${employeeId}'`;

  const selectFields = 'OperatingUnitNumber,PaymentAmount,TransactionDate,StaffId,StaffName';
  const queryUrl = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$select=${selectFields}&$orderby=TransactionDate`;

  const allTransactions: D365Transaction[] = [];
  let nextLink: string | null = queryUrl;
  let pages = 0;

  while (nextLink) {
    pages++;
    const response = await fetch(nextLink, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        Prefer: 'odata.maxpagesize=5000',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`D365 API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    allTransactions.push(...(data.value || []));
    nextLink = data['@odata.nextLink'] || null;
  }

  return { transactions: allTransactions, pages };
}

/**
 * D365 Data Provider - Returns store + employee metrics
 */
export async function getD365SalesData(
  year: number,
  month?: number,
  day?: number,
  storeId?: string,
  employeeId?: string
): Promise<NormalizedSalesResponse> {
  const startDate = new Date(Date.UTC(year, month || 0, day || 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(
    year,
    month !== undefined ? month + 1 : 12,
    day || (month !== undefined ? new Date(year, month + 1, 0).getDate() : 31),
    23, 59, 59
  ));

  const token = await getD365AccessToken();
  const storeMapping = await loadStoreMapping();

  const { transactions, pages } = await fetchD365Transactions(token, startDate, endDate, storeId, employeeId);

  // Aggregate by store
  const storeMap = new Map<string, { salesAmount: number; invoices: number }>();
  transactions.forEach((tx) => {
    const id = tx.OperatingUnitNumber;
    const amount = tx.PaymentAmount || 0;
    if (!storeMap.has(id)) storeMap.set(id, { salesAmount: 0, invoices: 0 });
    const data = storeMap.get(id)!;
    data.salesAmount += amount;
    data.invoices += 1;
  });

  // Aggregate by employee
  const employeeMap = new Map<string, { salesAmount: number; invoices: number; storeId: string }>();
  transactions.forEach((tx) => {
    if (!tx.StaffId) return;
    const key = `${tx.StaffId}_${tx.StaffName || 'Unknown'}`;
    const amount = tx.PaymentAmount || 0;
    const storeId = tx.OperatingUnitNumber;
    if (!employeeMap.has(key)) {
      employeeMap.set(key, { salesAmount: 0, invoices: 0, storeId });
    }
    const data = employeeMap.get(key)!;
    data.salesAmount += amount;
    data.invoices += 1;
  });

  // Build byStore array
  const byStore: NormalizedSalesResponse['byStore'] = [];
  let totalSales = 0;
  let totalInvoices = 0;

  storeMap.forEach((data, storeId) => {
    const storeName = storeMapping.get(storeId) || storeId;
    totalSales += data.salesAmount;
    totalInvoices += data.invoices;

    const atv = data.invoices > 0 ? data.salesAmount / data.invoices : 0;

    byStore.push({
      storeId,
      storeName,
      salesAmount: data.salesAmount,
      invoices: data.invoices,
      kpis: {
        atv: Number.isFinite(atv) ? atv : 0,
        customerValue: Number.isFinite(atv) ? atv : 0,
      },
    });
  });

  // Build byEmployee array
  const byEmployee: NormalizedSalesResponse['byEmployee'] = [];
  employeeMap.forEach((data, key) => {
    const [employeeId, employeeName] = key.split('_');
    const storeName = storeMapping.get(data.storeId) || data.storeId;
    const atv = data.invoices > 0 ? data.salesAmount / data.invoices : 0;

    byEmployee.push({
      employeeId,
      employeeName,
      storeId: data.storeId,
      storeName,
      salesAmount: data.salesAmount,
      invoices: data.invoices,
      kpis: { atv: Number.isFinite(atv) ? atv : 0 },
    });
  });

  // Calculate totals
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
    byEmployee,
    totals: {
      salesAmount: totalSales,
      invoices: totalInvoices,
      kpis: {
        atv: Number.isFinite(totalAtv) ? totalAtv : 0,
        customerValue: Number.isFinite(totalAtv) ? totalAtv : 0,
      },
    },
    debug: {
      source: 'd365',
      pages,
      fetched: transactions.length,
      notes: [`Fetched from D365 RetailTransactions API`, `Pages: ${pages}`, `Transactions: ${transactions.length}`],
    },
  };
}

// ============================================================================
// HYBRID RESOLVER
// ============================================================================

/**
 * Main Hybrid Resolver - Automatically selects Legacy or D365 based on year
 */
export async function getHybridSalesData(
  year: number,
  month?: number,
  day?: number,
  storeId?: string,
  employeeId?: string
): Promise<NormalizedSalesResponse> {
  try {
    if (year <= 2025) {
      // Legacy years: Store-level metrics only (NO employees)
      return await getLegacySalesData(year, month, day);
    } else {
      // 2026+: D365 data (Store + Employee)
      return await getD365SalesData(year, month, day, storeId, employeeId);
    }
  } catch (error: any) {
    // Never crash - return error response with consistent schema
    console.error(`❌ Error in hybrid resolver for year ${year}:`, error);
    
    return {
      success: false,
      range: {
        from: new Date(Date.UTC(year, month || 0, day || 1)).toISOString().split('T')[0],
        to: new Date(Date.UTC(year, month !== undefined ? month + 1 : 12, day || 31)).toISOString().split('T')[0],
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
        source: year <= 2025 ? 'legacy' : 'd365',
        notes: [`Error: ${error.message}`],
      },
    };
  }
}
