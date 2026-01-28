
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'showroom_sales',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    port: parseInt(process.env.PG_PORT || '5432'),
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, pin } = req.body;

    if (!username || !pin) {
        return res.status(400).json({ error: 'Username and PIN are required' });
    }

    try {
        const result = await pool.query(
            'SELECT id, username, role, display_name, pin_hash FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Verify PIN
        // Note: In a real prod app, use bcrypt.compare(pin, user.pin_hash)
        // For migration compatibility with legacy plain text PINs from users.js logic:
        if (user.pin_hash !== pin) {
            return res.status(401).json({ error: 'Invalid PIN' });
        }

        // Success - Return user info (excluding PIN)
        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                name: user.username, // matching legacy 'name' field
                role: user.role,
                displayName: user.display_name
            }
        });

    } catch (error: any) {
        console.error('❌ Auth API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
