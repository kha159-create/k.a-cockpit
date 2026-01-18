/**
 * API Base URL utility
 * 
 * Works on ANY domain:
 * - Vercel (same-origin): VITE_API_BASE_URL="" or unset → uses relative URLs
 * - GitHub Pages / Custom domain: VITE_API_BASE_URL="https://k-a-cockpit.vercel.app" → uses absolute URLs
 * 
 * Usage:
 *   const API = getApiBaseUrl();
 *   fetch(`${API}/api/sales?year=2025`)
 */
export function getApiBaseUrl(): string {
  // @ts-ignore - Vite environment variable
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (apiBaseUrl && typeof apiBaseUrl === 'string' && apiBaseUrl.trim() !== '') {
    // Remove trailing slash if present
    return apiBaseUrl.trim().replace(/\/$/, '');
  }
  
  // Default: empty string = same-origin (relative URLs)
  // This works on Vercel where API routes are on the same domain
  return '';
}

/**
 * Build full API URL
 * 
 * @param endpoint - API endpoint (e.g., '/api/sales' or 'api/sales')
 * @returns Full URL (e.g., 'https://k-a-cockpit.vercel.app/api/sales' or '/api/sales')
 */
export function buildApiUrl(endpoint: string): string {
  const apiBase = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (apiBase) {
    return `${apiBase}${cleanEndpoint}`;
  }
  
  return cleanEndpoint;
}
