import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function loadStoreMapping(): Promise<Map<string, string>> {
    const mapping = new Map<string, string>();
    try {
        const response = await fetch('https://raw.githubusercontent.com/ALAAWF2/dailysales/main/backend/mapping.xlsx');
        if (!response.ok) return mapping;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as any[];
        const firstRow = data[0] || {};
        const keys = Object.keys(firstRow);
        const storeIdCol = keys.find(k => k.toLowerCase().includes('store') && (k.toLowerCase().includes('number') || k.toLowerCase().includes('id'))) || keys[0];
        const storeNameCol = keys.find(k => k.toLowerCase().includes('outlet') || (k.toLowerCase().includes('name') && !k.toLowerCase().includes('store'))) || keys[1];
        data.forEach((row: any) => {
            const storeId = String(row[storeIdCol] || '').trim();
            const storeName = String(row[storeNameCol] || '').trim();
            if (storeId && storeName && storeId !== 'NaN' && storeName !== 'NaN') mapping.set(storeId, storeName);
        });
    } catch (err) { }
    return mapping;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Sync Stores from management_data.json
            const mgmtResp = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/management_data.json');
            if (mgmtResp.ok) {
                const mgmtData = await mgmtResp.json();
                const storeMeta = mgmtData.store_meta || {};
                const storeMapping = await loadStoreMapping();

                for (const [storeId, meta] of Object.entries(storeMeta) as any[]) {
                    const name = storeMapping.get(storeId) || meta.store_name || meta.outlet || `Store ${storeId}`;
                    const manager = meta.manager || 'Showroom';
                    const city = meta.city || 'Unknown';
                    const type = meta.type || 'Showroom';

                    await client.query(`
            INSERT INTO stores (store_id, name, city, area_manager, type, is_active)
            VALUES ($1, $2, $3, $4, $5, TRUE)
            ON CONFLICT (store_id) DO UPDATE SET 
              name = EXCLUDED.name, 
              city = EXCLUDED.city, 
              area_manager = EXCLUDED.area_manager,
              type = EXCLUDED.type
          `, [storeId, name, city, manager, type]);
                }
            }

            // 2. Sync Employees from employees_data.json
            const empResp = await fetch('https://raw.githubusercontent.com/ALAAWF2/orange-dashboard/main/employees_data.json');
            if (empResp.ok) {
                const empData = await empResp.json();
                const storeEmployees = new Map<string, { id: string, name: string, store: string }>();

                Object.entries(empData).forEach(([storeId, entries]: [string, any]) => {
                    if (Array.isArray(entries)) {
                        entries.forEach(entry => {
                            if (!Array.isArray(entry) || entry.length < 2) return;
                            const empName = String(entry[1] || '').trim();
                            if (!empName) return;
                            const idMatch = empName.match(/^(\d+)[-_\s]/);
                            const id = idMatch ? idMatch[1] : empName;
                            storeEmployees.set(id, { id, name: empName, store: storeId });
                        });
                    } else if (typeof entries === 'object' && entries !== null) {
                        Object.entries(entries).forEach(([empId, empName]) => {
                            const name = String(empName || '').trim();
                            if (!name) return;
                            storeEmployees.set(empId, { id: empId, name, store: storeId });
                        });
                    }
                });

                for (const emp of storeEmployees.values()) {
                    await client.query(`
            INSERT INTO employees (employee_id, name, current_store, is_active)
            VALUES ($1, $2, $3, TRUE)
            ON CONFLICT (employee_id) DO UPDATE SET 
              name = EXCLUDED.name, 
              current_store = EXCLUDED.current_store
          `, [emp.id, emp.name, emp.store]);
                }
            }

            await client.query('COMMIT');
            res.status(200).json({ success: true, message: 'Metadata synced successfully' });
        } catch (err: any) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}
