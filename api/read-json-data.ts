/**
 * Read JSON data from GitHub (like the reference project reads from local files)
 * This replaces direct PostgreSQL connections
 * 
 * The JSON files are generated locally by scripts/generate-json-from-sql.js
 * and pushed to GitHub, then served via GitHub raw URLs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// GitHub raw URL for management_data.json
// Update this to your actual GitHub repo path
const GITHUB_RAW_BASE = process.env.GITHUB_RAW_BASE || 
  'https://raw.githubusercontent.com/kha159-create/k.a-cockpit/main/public/data';

const MANAGEMENT_DATA_URL = `${GITHUB_RAW_BASE}/management_data.json`;
const EMPLOYEES_DATA_URL = `${GITHUB_RAW_BASE}/employees_data.json`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { type = 'management' } = req.query;

    const url = type === 'employees' ? EMPLOYEES_DATA_URL : MANAGEMENT_DATA_URL;
    
    console.log(`📥 Fetching JSON data from GitHub: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`✅ Fetched ${type} data successfully`);

    return res.status(200).json({
      success: true,
      data,
      source: 'github-json',
      url,
    });
  } catch (error: any) {
    console.error('❌ Error fetching JSON data from GitHub:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch JSON data',
    });
  }
}
