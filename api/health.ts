import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ConfidentialClientApplication } from '@azure/msal-node';

// D365 Authentication (same as orange-dashboard)
async function getAccessToken(): Promise<string> {
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const tenantId = process.env.D365_TENANT_ID;
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Missing D365 credentials');
  }

  const authority = `https://login.microsoftonline.com/${tenantId}`;
  const scope = `${d365Url}/.default`;

  const app = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority,
    },
  });

  const result = await app.acquireTokenByClientCredential({
    scopes: [scope],
  });

  if (!result?.accessToken) {
    throw new Error(`Auth failed: ${JSON.stringify(result)}`);
  }

  return result.accessToken;
}

// Test D365 query with small sample (last 1 day)
async function testD365Query(token: string): Promise<{ count: number; duration: number }> {
  const d365Url = process.env.D365_URL || 'https://orangepax.operations.eu.dynamics.com';
  const baseUrl = `${d365Url}/data/RetailTransactions`;

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 1); // Last 1 day

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  const queryUrl = `${baseUrl}?$filter=PaymentAmount ne 0 and TransactionDate ge ${startStr} and TransactionDate lt ${endStr}&$select=OperatingUnitNumber,PaymentAmount,TransactionDate&$top=10`;

  const startTime = Date.now();
  
  const response = await fetch(queryUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    throw new Error(`D365 API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const count = (data.value || []).length;

  return { count, duration };
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

  const checks: { [key: string]: { status: 'ok' | 'error'; message: string; duration?: number } } = {};

  try {
    // Check 1: D365 Token Acquisition
    const tokenStartTime = Date.now();
    try {
      const token = await getAccessToken();
      const tokenDuration = Date.now() - tokenStartTime;
      checks.tokenAcquisition = {
        status: 'ok',
        message: 'D365 token acquired successfully',
        duration: tokenDuration,
      };
    } catch (error: any) {
      checks.tokenAcquisition = {
        status: 'error',
        message: `Token acquisition failed: ${error.message}`,
      };
      return res.status(500).json({
        success: false,
        checks,
        error: 'D365 authentication failed',
      });
    }

    // Check 2: D365 Query Test
    const queryStartTime = Date.now();
    try {
      const token = await getAccessToken();
      const { count, duration } = await testD365Query(token);
      checks.d365Query = {
        status: 'ok',
        message: `D365 query successful - fetched ${count} sample transactions`,
        duration,
      };
    } catch (error: any) {
      checks.d365Query = {
        status: 'error',
        message: `D365 query failed: ${error.message}`,
      };
    }

    // Check 3: Environment Variables
    const hasD365Creds = !!(
      process.env.D365_CLIENT_ID &&
      process.env.D365_CLIENT_SECRET &&
      process.env.D365_TENANT_ID
    );
    checks.environment = {
      status: hasD365Creds ? 'ok' : 'error',
      message: hasD365Creds
        ? 'D365 credentials configured'
        : 'Missing D365 credentials (D365_CLIENT_ID, D365_CLIENT_SECRET, D365_TENANT_ID)',
    };

    const allOk = Object.values(checks).every(c => c.status === 'ok');

    return res.status(allOk ? 200 : 500).json({
      success: allOk,
      checks,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      checks,
      error: error.message || 'Unknown error',
    });
  }
}
