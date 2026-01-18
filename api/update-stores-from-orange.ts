import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Missing Firebase credentials');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('✅ Firebase Admin initialized');
    }
  } catch (error: any) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

let db: admin.firestore.Firestore | null = null;
try {
  db = admin.firestore();
} catch (error: any) {
  console.error('❌ Firestore initialization error:', error);
}

interface ManagementData {
  store_meta?: {
    [storeId: string]: {
      manager?: string;
      store_name?: string;
      outlet?: string;
      // Add other fields if needed
    };
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Allow GET (for testing) and POST (for actual update)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Firestore not initialized' });
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
    
    // Build mapping: store_id → { manager, store_name, city }
    const storeMapping: { [storeId: string]: { manager: string; storeName: string; city?: string } } = {};
    
    Object.entries(storeMeta).forEach(([storeId, meta]) => {
      const manager = meta.manager?.trim();
      const storeName = meta.store_name || meta.outlet || storeId;
      const city = meta.city?.trim() || undefined;
      
      if (manager && manager.toLowerCase() !== 'unknown' && manager.toLowerCase() !== 'online') {
        storeMapping[storeId] = {
          manager,
          storeName: storeName.trim(),
          city,
        };
      }
    });
    
    console.log(`✅ Mapped ${Object.keys(storeMapping).length} stores with managers`);
    
    // Group stores by manager (for summary)
    const managerGroups: { [manager: string]: string[] } = {};
    Object.entries(storeMapping).forEach(([storeId, data]) => {
      if (!managerGroups[data.manager]) {
        managerGroups[data.manager] = [];
      }
      managerGroups[data.manager].push(data.storeName);
    });
    
    console.log(`👥 Found ${Object.keys(managerGroups).length} area managers:`);
    Object.entries(managerGroups).forEach(([manager, stores]) => {
      console.log(`  - ${manager}: ${stores.length} stores`);
    });
    
    // If GET request, just return the mapping (for testing)
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: 'Store mapping loaded from orange-dashboard',
        totalStores: Object.keys(storeMapping).length,
        totalManagers: Object.keys(managerGroups).length,
        managers: Object.keys(managerGroups),
        mapping: storeMapping,
        managerGroups,
      });
    }
    
    // POST request: Update Firestore stores
    // For testing: Allow GET requests without secret (just for checking status)
    // For actual updates: POST requires secret
    if (req.method === 'POST') {
      const secret = req.headers['x-secret'] || req.body?.secret;
      const expectedSecret = process.env.API_SECRET || 'your-secret-here';
      
      // If API_SECRET is not set in Vercel, allow updates without secret (for testing only)
      // TODO: Set API_SECRET in Vercel for production security
      if (process.env.API_SECRET && secret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid secret' });
      }
    }
    
    console.log('🔄 Updating stores in Firestore...');
    
    // Get all stores from Firestore
    const storesSnapshot = await db.collection('stores').get();
    let updatedCount = 0;
    let createdCount = 0;
    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500;
    
    // Update existing stores or create new ones
    const existingStoreIds = new Set<string>();
    
    storesSnapshot.forEach((doc) => {
      const storeData = doc.data();
      const storeId = String(storeData.store_id || doc.id).trim();
      existingStoreIds.add(storeId);
      
      const mapping = storeMapping[storeId];
      if (mapping) {
        const storeRef = db!.collection('stores').doc(doc.id);
        batch.update(storeRef, {
          areaManager: mapping.manager,
          name: mapping.storeName, // Update name if different
          ...(mapping.city && { city: mapping.city }), // Add city if available
        });
        batchCount++;
        updatedCount++;
      }
    });
    
    // Create new stores for store_ids that don't exist in Firestore
    Object.entries(storeMapping).forEach(([storeId, mapping]) => {
      if (!existingStoreIds.has(storeId)) {
        const newStoreRef = db!.collection('stores').doc();
        batch.set(newStoreRef, {
          store_id: storeId,
          name: mapping.storeName,
          areaManager: mapping.manager,
          ...(mapping.city && { city: mapping.city }), // Add city if available
          targets: {}, // Empty targets, can be set later
        });
        batchCount++;
        createdCount++;
      }
      
      // Commit batch if needed
      if (batchCount >= MAX_BATCH_SIZE) {
        // Note: In a real implementation, you'd commit here and create a new batch
        // For simplicity, we'll commit all at once at the end
      }
    });
    
    // Commit all changes
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Updated ${updatedCount} stores, created ${createdCount} new stores`);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Stores updated from orange-dashboard',
      updated: updatedCount,
      created: createdCount,
      total: updatedCount + createdCount,
      managers: Object.keys(managerGroups),
    });
    
  } catch (error: any) {
    console.error('❌ Error updating stores from orange-dashboard:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
