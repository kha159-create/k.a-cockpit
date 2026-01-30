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

function buildFallbackUrls(base: string, fileName: string): string[] {
  const normalizedBase = base.replace(/\/$/, '');
  const rootBase = normalizedBase.replace(/\/public\/data$/, '');
  const urls: string[] = [
    `${normalizedBase}/${fileName}`,
    `${rootBase}/${fileName}`,
  ];

  if (!rootBase.includes('/k.a-cockpit/data')) {
    urls.push(`${rootBase}/k.a-cockpit/data/${fileName}`);
  }

  return Array.from(new Set(urls));
}

async function fetchFirstAvailable(urls: string[]): Promise<{ data: any; url: string }> {
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        errors.push(`${url} -> ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      return { data, url };
    } catch (error: any) {
      errors.push(`${url} -> ${error?.message || 'Unknown error'}`);
    }
  }

  const error = new Error(`GitHub fetch failed for all URLs: ${errors.join(' | ')}`);
  (error as any).details = errors;
  throw error;
}

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
    const fileName = type === 'employees' ? 'employees_data.json' : 'management_data.json';
    const candidateUrls = buildFallbackUrls(GITHUB_RAW_BASE, fileName);

    console.log(`📥 Fetching JSON data from GitHub:`, candidateUrls);

    const { data, url } = await fetchFirstAvailable(candidateUrls);

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
