/**
 * Category Helper - Supports both legacy (item_alias) and D365 (item_code) categorization
 * 
 * Legacy System (2024-2025):
 * - Uses item_alias prefix (e.g., "4" = Duvets, "2" = Duvets Full)
 * - Also checks product name for keywords
 * 
 * D365 System (2026+):
 * - Uses item_code prefix from product_category_rules table
 * - Matches item_code against prefix_pattern in database
 */

import { apiUrl } from './apiBase';

interface CategoryRule {
  prefix_pattern: string;
  category_name: string;
}

let cachedCategoryRules: CategoryRule[] | null = null;

/**
 * Load category rules from PostgreSQL via API
 */
async function loadCategoryRules(): Promise<CategoryRule[]> {
  if (cachedCategoryRules) {
    return cachedCategoryRules;
  }

  try {
    const response = await fetch(`${apiUrl}/api/get-category-rules`);
    
    if (!response.ok) {
      console.warn('⚠️ Could not fetch category rules from API, using legacy rules');
      return [];
    }
    
    const data = await response.json();
    cachedCategoryRules = data.rules || [];
    console.log(`✅ Loaded ${cachedCategoryRules.length} category rules from database`);
    return cachedCategoryRules;
  } catch (error: any) {
    console.error('❌ Error loading category rules:', error.message);
    return [];
  }
}

/**
 * Get category from D365 item_code using database rules
 * Matches item_code against prefix_pattern in product_category_rules
 */
export async function getCategoryFromD365(itemCode: string | number | null | undefined): Promise<string | null> {
  if (!itemCode) {
    return null;
  }

  const itemCodeStr = String(itemCode).trim();
  if (!itemCodeStr) {
    return null;
  }

  const rules = await loadCategoryRules();
  
  // Sort by prefix length (longest first) to match most specific prefix first
  const sortedRules = [...rules].sort((a, b) => b.prefix_pattern.length - a.prefix_pattern.length);
  
  // Find matching prefix
  for (const rule of sortedRules) {
    if (itemCodeStr.startsWith(rule.prefix_pattern)) {
      return rule.category_name;
    }
  }

  return null;
}

/**
 * Get category from legacy item_alias (for 2024-2025 data)
 * Uses hardcoded rules based on prefix patterns
 */
export function getCategoryFromLegacy(product: { name?: string; alias?: string }): string {
  const name = (product.name || '').toLowerCase();
  const alias = String(product.alias || '');
  
  // Legacy rules based on item_alias prefix
  if (alias.startsWith('4')) return 'Duvets';
  if (alias.startsWith('2')) return 'Duvets Full';
  if (name.includes('mattresspad') || name.includes('matresspad')) return 'Toppers';
  if (name.includes('pillow') && !name.includes('case')) return 'Pillows';
  
  return 'Other';
}

/**
 * Unified category getter - supports both legacy and D365
 * 
 * @param product - Product object with name, alias (legacy), and/or item_code (D365)
 * @param year - Year to determine which system to use (2024-2025 = legacy, 2026+ = D365)
 */
export async function getCategoryUnified(
  product: { 
    name?: string; 
    alias?: string; 
    item_code?: string | number;
    itemCode?: string | number;
  },
  year?: number
): Promise<string> {
  const currentYear = year || new Date().getFullYear();
  
  // Use D365 rules for 2026+
  if (currentYear >= 2026) {
    const itemCode = product.item_code || product.itemCode;
    const d365Category = await getCategoryFromD365(itemCode);
    if (d365Category) {
      return d365Category;
    }
  }
  
  // Fallback to legacy rules (for 2024-2025 or if D365 lookup fails)
  return getCategoryFromLegacy(product);
}

/**
 * Synchronous version for backward compatibility
 * Uses legacy rules only (for immediate use without async)
 */
export function getCategory(product: { name?: string; alias?: string }): string {
  return getCategoryFromLegacy(product);
}
