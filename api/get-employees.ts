import type { VercelRequest, VercelResponse } from '@vercel/node';

// Load store mapping from mapping.xlsx (from dailysales repository)
async function loadStoreMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  
  try {
    console.log('📥 Loading store mapping from dailysales...');
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch mapping.xlsx, using store IDs as names');
      return mapping;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
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
    
    console.log(`✅ Loaded ${mapping.size} store mappings`);
  } catch (error: any) {
    console.error('❌ Error loading store mapping:', error.message);
  }

  return mapping;
}

// Load employees_data.json and extract unique employees
// Format: { "storeId": [["date", "employeeName", sales, transactions, ...], ...], ... }
async function loadEmployeesData(): Promise<{ [storeId: string]: any[][] }> {
  try {
    console.log('📥 Loading employees_data.json from orange-dashboard...');
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/employees_data.json');
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch employees_data.json from orange-dashboard');
      return {};
    }
    
    const data = await response.json();
    console.log(`✅ Loaded employees data for ${Object.keys(data).length} stores`);
    return data;
  } catch (error: any) {
    console.error('❌ Error loading employees_data.json:', error.message);
    return {};
  }
}

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
    console.log('📥 Extracting employees from employees_data.json (2026+ only)...');
    
    // Load store mapping
    const storeMapping = await loadStoreMapping();
    
    // Load employees data
    const employeesData = await loadEmployeesData();
    
    if (Object.keys(employeesData).length === 0) {
      console.warn('⚠️ No employees data found in employees_data.json');
      return res.status(200).json({
        success: true,
        employees: [],
        count: 0,
        message: 'No employees data found',
      });
    }
    
    // Extract unique employees from employees_data.json
    // employees_data.json format: { "storeId": [["date", "employeeName", sales, ...], ...], ... }
    // Strategy: Collect ALL employees, then filter to only those with 2026+ activity
    const employeeMap = new Map<string, {
      id: string;
      employeeId: string | null;
      name: string;
      currentStore: string;
      status: 'active';
      has2026Data: boolean; // Track if employee has any 2026+ entries
    }>();
    
    // First pass: Collect all employees and track if they have 2026+ data
    let totalEntries = 0;
    let entries2026Plus = 0;
    
    Object.entries(employeesData).forEach(([storeId, entries]) => {
      if (!Array.isArray(entries)) return;
      
      const storeName = storeMapping.get(storeId) || storeId;
      
      entries.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length < 2) return;
        
        totalEntries++;
        const dateStr = String(entry[0] || '').trim(); // "2026-01-17" or "2024-01-17"
        const employeeName = String(entry[1] || '').trim(); // "4661-Fatima Albeshi"
        
        if (!employeeName) return;
        
        // Extract employeeId from name (e.g., "4661-Fatima Albeshi" -> "4661")
        const employeeIdMatch = employeeName.match(/^(\d+)[-_\s]/);
        const employeeId = employeeIdMatch ? employeeIdMatch[1] : null;
        
        // Use employeeId as key, or name if no ID
        const key = employeeId || employeeName;
        
        // Check if date is 2026+
        let is2026Data = false;
        if (dateStr) {
          try {
            const entryDate = new Date(dateStr + 'T00:00:00Z'); // Parse YYYY-MM-DD as UTC
            is2026Data = entryDate.getUTCFullYear() >= 2026;
            if (is2026Data) entries2026Plus++;
          } catch (e) {
            // If date parsing fails, skip date check
            console.warn(`⚠️ Failed to parse date: ${dateStr}`);
          }
        }
        
        // Add or update employee in map
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            id: employeeId || employeeName.replace(/\s+/g, '_'),
            employeeId,
            name: employeeName,
            currentStore: storeName,
            status: 'active',
            has2026Data: is2026Data,
          });
        } else {
          const existing = employeeMap.get(key)!;
          // Update store if this is more recent
          existing.currentStore = storeName;
          // If this entry is 2026+, mark employee as having 2026+ data
          if (is2026Data) {
            existing.has2026Data = true;
          }
        }
      });
    });
    
    // Filter: Only include employees who have 2026+ data
    const employees = Array.from(employeeMap.values())
      .filter(emp => emp.has2026Data) // Only employees with 2026+ activity
      .map(({ has2026Data, ...emp }) => emp); // Remove has2026Data from output
    
    console.log(`📊 Total entries: ${totalEntries}, Entries 2026+: ${entries2026Plus}`);
    console.log(`📊 Total employees in data: ${employeeMap.size}, Employees with 2026+ data: ${employees.length}`);
    console.log(`✅ Extracted ${employees.length} unique employees from employees_data.json (2026+ only)`);
    
    return res.status(200).json({
      success: true,
      employees,
      count: employees.length,
      debug: {
        totalEntries,
        entries2026Plus,
        totalEmployeesInData: employeeMap.size,
        employeesWith2026Data: employees.length,
      },
    });
    
  } catch (error: any) {
    console.error('❌ Error extracting employees:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
