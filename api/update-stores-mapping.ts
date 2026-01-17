import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

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

// Store mapping from orange-dashboard (based on image)
// Format: store_id (4-digit from D365 OperatingUnitNumber) -> store_name
// Note: This mapping should match orange-dashboard's store naming convention
const STORE_MAPPING: { [key: string]: string } = {
  // First block (1001-1012)
  '1001': '04-Andalos Mall',
  '1002': '05-Madina Center',
  '1003': '06-Haifa Mall',
  '1004': '07-Al-Salam Mall',
  '1005': '08-Al_Khayyat Center',
  '1006': '09-Riyadh Othaim Mall',
  '1007': '10-Makkah Mall',
  '1008': '11-Alia Mall Madinah',
  '1009': '12-Dhahran Mall khobar',
  '1010': '13-Red Sea Mall',
  '1011': '14-Al Nakheel Mall Riyadh',
  '1012': '15-Al-Noor Mall Madinah',
  '1013': 'PLATFORMS',
  // Second block (1101+)
  '1101': '12-Al_Hamra Mall',
  // Add more mappings here based on your image...
  // The user should provide the complete list or we can load from orange-dashboard
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow POST requests with secret or GET for testing
  if (req.method === 'OPTIONS') {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-secret');
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET: Show current mapping (for testing)
  if (req.method === 'GET') {
    return res.status(200).json({
      message: 'Store mapping API - Send POST with mapping data',
      mapping: STORE_MAPPING,
      count: Object.keys(STORE_MAPPING).length,
    });
  }

  // POST: Update stores from Excel file or mapping object
  const secret = req.headers['x-secret'] || req.query.secret;
  const expectedSecret = process.env.UPDATE_SECRET || 'update-stores-secret';

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // If request has Excel file, parse it
  let mappingToUpdate = req.body?.mapping || STORE_MAPPING;
  
  // Option 1: Try to load mapping from orange-dashboard GitHub (dailysales repo)
  // This automatically fetches mapping.xlsx from the dailysales repository
  if (!req.body?.mapping && Object.keys(STORE_MAPPING).length === 0) {
    try {
      console.log('📥 Fetching mapping from orange-dashboard (dailysales)...');
      const orangeDashboardResponse = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
      
      if (orangeDashboardResponse.ok) {
        const arrayBuffer = await orangeDashboardResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const firstRow = data[0] || {};
        const keys = Object.keys(firstRow);
        
        // Find columns (flexible matching like dailysales fetch_sales.py)
        const storeIdCol = keys.find(k => {
          const kLower = k.toLowerCase();
          return kLower.includes('store') && (kLower.includes('number') || kLower.includes('id'));
        }) || keys[0];
        
        const storeNameCol = keys.find(k => {
          const kLower = k.toLowerCase();
          return kLower.includes('outlet') || (kLower.includes('name') && !kLower.includes('store'));
        }) || keys[1];
        
        console.log('📊 Excel columns found:', { storeIdCol, storeNameCol, sampleKeys: keys.slice(0, 5) });
        
        mappingToUpdate = {};
        data.forEach((row: any) => {
          const storeId = String(row[storeIdCol] || '').trim();
          const storeName = String(row[storeNameCol] || '').trim();
          if (storeId && storeName && storeId !== 'NaN' && storeName !== 'NaN') {
            mappingToUpdate[storeId] = storeName;
          }
        });
        
        console.log(`✅ Loaded ${Object.keys(mappingToUpdate).length} stores from orange-dashboard`);
      }
    } catch (fetchError: any) {
      console.warn('⚠️ Could not load from orange-dashboard:', fetchError.message);
    }
  }

  // Option 2: Try to parse Excel file if provided in request body
  if (req.body?.excelFile || req.body?.file) {
    try {
      let buffer: Buffer;
      
      if (req.body.excelFile) {
        // Base64 encoded
        buffer = Buffer.from(req.body.excelFile, 'base64');
      } else if (req.body.file) {
        buffer = Buffer.from(req.body.file, 'base64');
      } else {
        throw new Error('Invalid file format');
      }
      
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      // Try to find store number and name columns
      const firstRow = data[0] || {};
      const keys = Object.keys(firstRow);
      
      // Find columns (flexible matching)
      const storeIdCol = keys.find(k => 
        k.toLowerCase().includes('store') && 
        (k.toLowerCase().includes('number') || k.toLowerCase().includes('id') || k.toLowerCase().includes('code'))
      ) || keys.find(k => k.toLowerCase().includes('operating')) || keys[0];
      
      const storeNameCol = keys.find(k => 
        k.toLowerCase().includes('store') && k.toLowerCase().includes('name')
      ) || keys.find(k => k.toLowerCase().includes('outlet') || k.toLowerCase().includes('name')) || keys[1];
      
      console.log('📊 Excel columns found:', { storeIdCol, storeNameCol, allKeys: keys });
      
      // Build mapping
      mappingToUpdate = {};
      data.forEach((row: any) => {
        const storeId = String(row[storeIdCol] || '').trim();
        const storeName = String(row[storeNameCol] || '').trim();
        if (storeId && storeName) {
          mappingToUpdate[storeId] = storeName;
        }
      });
      
      console.log(`✅ Parsed ${Object.keys(mappingToUpdate).length} stores from Excel`);
    } catch (excelError: any) {
      console.error('❌ Excel parsing error:', excelError);
      // Continue with default mapping if Excel parsing fails
    }
  }

  if (!db) {
    return res.status(500).json({ error: 'Firestore not initialized' });
  }

  try {
    console.log('🚀 Starting store mapping update...');
    
    const batch = db.batch();
    let count = 0;

    for (const [storeId, storeName] of Object.entries(mappingToUpdate)) {
      const docRef = db.collection('stores').doc(storeId);
      
      batch.set(docRef, {
        store_id: storeId,
        name: storeName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      count++;

      // Commit in batches of 500 (Firestore limit)
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`✅ Updated ${count} stores...`);
      }
    }

    // Commit remaining
    if (count % 500 !== 0) {
      await batch.commit();
    }

    console.log(`✅ Successfully updated ${count} stores`);

    return res.status(200).json({
      success: true,
      message: `Updated ${count} stores`,
      count,
    });
  } catch (error: any) {
    console.error('❌ Error updating stores:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Update failed',
    });
  }
}
