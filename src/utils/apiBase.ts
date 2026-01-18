/**
 * API Base URL utility
 * 
 * Works on ANY domain:
 * - Vercel (same-origin): VITE_API_BASE_URL="" or unset → uses relative URLs
 * - GitHub Pages / Custom domain: VITE_API_BASE_URL="https://k-a-cockpit.vercel.app" → uses absolute URLs
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

/**
 * Build full API URL
 * 
 * @param path - API endpoint (e.g., '/api/sales' or 'api/sales')
 * @returns Full URL (e.g., 'https://k-a-cockpit.vercel.app/api/sales' or '/api/sales')
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}
