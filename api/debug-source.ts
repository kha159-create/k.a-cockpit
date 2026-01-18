import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getHybridSalesData } from './data-providers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) - 1 : undefined;

    // Determine which provider will be used
    const source = year <= 2025 ? 'legacy' : 'd365';
    
    // Get a sample response
    const sampleResponse = await getHybridSalesData(year, month);

    // Field mapping
    const fieldMapping = {
      legacy: {
        storeId: 'storeId from employees_data.json aggregation',
        storeName: 'store_name from management_data.json',
        salesAmount: 'Sum of sales from employees_data.json entries (store-level aggregation)',
        invoices: 'Sum of transactions from employees_data.json entries',
        visitors: 'Not available in legacy data (returns undefined)',
        employees: 'N/A - byEmployee is always empty array [] for legacy years',
      },
      d365: {
        storeId: 'OperatingUnitNumber from D365 RetailTransactions',
        storeName: 'Mapped via mapping.xlsx (OperatingUnitNumber → store name)',
        salesAmount: 'Sum of PaymentAmount from D365 transactions',
        invoices: 'Count of transactions (PaymentAmount ne 0)',
        visitors: 'Not available from D365 (returns undefined)',
        employeeId: 'StaffId from D365 RetailTransactions',
        employeeName: 'StaffName from D365 RetailTransactions',
      },
    };

    return res.status(200).json({
      success: true,
      year,
      provider: source,
      willUseProvider: source,
      sampleRow: {
        byStore: sampleResponse.byStore.slice(0, 1),
        byEmployee: sampleResponse.byEmployee.slice(0, 1),
      },
      fieldMapping: fieldMapping[source],
      debug: sampleResponse.debug,
      notes: [
        `Year ${year} will use ${source} provider`,
        year <= 2025 
          ? 'Legacy years (2024/2025) return store-level metrics only (byEmployee = [])'
          : 'Year 2026+ returns store + employee metrics from D365',
      ],
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
