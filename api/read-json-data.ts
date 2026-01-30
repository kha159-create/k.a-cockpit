/**
 * Read JSON data from local files (no external hosts).
 * Files are generated locally by scripts/generate-json-from-sql.js
 * and stored in the repo for Vercel to read directly.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'fs';
import path from 'path';

const LOCAL_DATA_DIRS = [
  path.join(process.cwd(), 'public', 'data'),
  path.join(process.cwd(), 'data'),
  path.join(process.cwd(), 'k.a-cockpit', 'data'),
  process.cwd(),
];

function buildLocalPaths(fileName: string): string[] {
  const paths = LOCAL_DATA_DIRS.map(dir => path.join(dir, fileName));
  return Array.from(new Set(paths));
}

async function readJsonFromDisk(fileName: string): Promise<{ data: any; path: string }> {
  const candidatePaths = buildLocalPaths(fileName);
  const errors: string[] = [];

  for (const filePath of candidatePaths) {
    try {
      const contents = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(contents);
      return { data, path: filePath };
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        errors.push(`${filePath} -> ${error?.message || 'Unknown error'}`);
      }
    }
  }

  const error = new Error(`Local JSON file not found: ${candidatePaths.join(' | ')}`);
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

    console.log(`📥 Reading JSON data from disk: ${fileName}`);

    const { data, path: dataPath } = await readJsonFromDisk(fileName);

    console.log(`✅ Loaded ${type} data successfully from ${dataPath}`);

    return res.status(200).json({
      success: true,
      data,
      source: 'local-json',
      path: dataPath,
    });
  } catch (error: any) {
    console.error('❌ Error reading JSON data from disk:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch JSON data',
    });
  }
}
