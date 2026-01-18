import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ManagementData {
  store_meta?: {
    [storeId: string]: {
      manager?: string;
      store_name?: string;
      outlet?: string;
      city?: string;
    };
  };
}

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
    console.log('📥 Fetching management_data.json from orange-dashboard...');
    
    // Fetch management_data.json from orange-dashboard GitHub repository
    const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/management_data.json');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch management_data.json: ${response.status} ${response.statusText}`);
    }
    
    const managementData: ManagementData = await response.json();
    const storeMeta = managementData.store_meta || {};
    
    console.log(`📊 Found ${Object.keys(storeMeta).length} stores in management_data.json`);
    
    // Load store mapping (store_id -> store_name)
    const storeMapping = await loadStoreMapping();
    
    // Build stores array (like Firestore stores collection)
    const stores: Array<{
      id: string;
      store_id?: string;
      name: string;
      areaManager: string;
      city?: string;
    }> = [];
    
    Object.entries(storeMeta).forEach(([storeId, meta]) => {
      const manager = meta.manager?.trim();
      const storeName = storeMapping.get(storeId) || meta.store_name || meta.outlet || storeId;
      const city = meta.city?.trim() || undefined;
      
      if (manager && manager.toLowerCase() !== 'unknown' && manager.toLowerCase() !== 'online') {
        stores.push({
          id: storeId, // Use storeId as document ID
          store_id: storeId,
          name: storeName.trim(),
          areaManager: manager,
          ...(city && { city }),
        });
      }
    });
    
    console.log(`✅ Returning ${stores.length} stores from orange-dashboard`);
    
    return res.status(200).json({
      success: true,
      stores,
      count: stores.length,
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching stores from orange-dashboard:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
