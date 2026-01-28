import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSalesData, getStores, getEmployees, fetchEmployeeMappings, getProducts } from '@/data/dataProvider';
import type { NormalizedSalesResponse } from '@/data/dataProvider';
import type { Employee } from '@/types';

type AllSalesDataByYear = {
  [year: number]: NormalizedSalesResponse | null;
};

type DataState = {
  allSalesData: AllSalesDataByYear;
  loading: boolean;
  error?: string;
  loadedYears: Set<number>;
  storeMap: Record<string, string>; // Global Master Store Map { ID: Name }
  unifiedEmployees: Employee[]; // Unified Employee List (Rich Object)
  products: any[]; // Unified Product List
  stores: any[]; // Unified Store List
};

const DataCtx = createContext<DataState>({
  allSalesData: {},
  loading: true,
  loadedYears: new Set(),
  storeMap: {}, // Default empty
  unifiedEmployees: [],
  products: [],
  stores: [],
});

export const useData = () => useContext(DataCtx);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [allSalesData, setAllSalesData] = useState<AllSalesDataByYear>({
    2024: null,
    2025: null,
    2026: null,
  });
  const [loading, setLoading] = useState(true); // Default true to prevent race condition
  const [error, setError] = useState<string>();
  const [loadedYears, setLoadedYears] = useState<Set<number>>(new Set());
  const [storeMap, setStoreMap] = useState<Record<string, string>>({});
  const [unifiedEmployees, setUnifiedEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadAllYears = async () => {
      if (!user) {
        setAllSalesData({ 2024: null, 2025: null, 2026: null });
        setLoadedYears(new Set());
        setStoreMap({});
        setStores([]);
        return;
      }

      try {
        setLoading(true);
        setError(undefined);
        console.log('🚀 DataProvider: Starting parallel load (Unified SQL)...');

        // Fetch everything in parallel
        const [year2024, year2025, year2026, storesResult, employeesResult, mappingsResult, productsResult] = await Promise.allSettled([
          getSalesData({ year: 2024 }),
          getSalesData({ year: 2025 }),
          getSalesData({ year: 2026 }),
          getStores(),
          getEmployees(),
          fetchEmployeeMappings(),
          getProducts(),
        ]);

        if (cancelled) return;

        const newData: AllSalesDataByYear = {};
        const newLoadedYears = new Set<number>();

        // Process Sales
        if (year2024.status === 'fulfilled' && year2024.value.success) { newData[2024] = year2024.value; newLoadedYears.add(2024); } else newData[2024] = null;
        if (year2025.status === 'fulfilled' && year2025.value.success) { newData[2025] = year2025.value; newLoadedYears.add(2025); } else newData[2025] = null;
        if (year2026.status === 'fulfilled' && year2026.value.success) { newData[2026] = year2026.value; newLoadedYears.add(2026); } else newData[2026] = null;

        // Process Global Store Map AND List
        if (storesResult.status === 'fulfilled' && Array.isArray(storesResult.value)) {
          setStores(storesResult.value);
          const map: Record<string, string> = {};
          storesResult.value.forEach((s: any) => {
            const id = String(s.store_id || s.id || s.name).trim();
            map[id] = s.name;
          });
          setStoreMap(map);
        }

        // Process Products
        if (productsResult.status === 'fulfilled' && Array.isArray(productsResult.value)) {
          setProducts(productsResult.value);
          console.log(`✅ Products Loaded: ${productsResult.value.length}`);
        }

        // --- GRAND MERGE: Employees + Mappings ---
        const unifiedList: Employee[] = [];
        if (employeesResult.status === 'fulfilled' && Array.isArray(employeesResult.value)) {
          const normalizeID = (id: string | number | undefined | null) => {
            if (!id) return '';
            return String(id).replace(/^0+/, '').trim();
          };

          const mappings = (mappingsResult.status === 'fulfilled' && Array.isArray(mappingsResult.value)) ? mappingsResult.value : [];

          unifiedList.push(...employeesResult.value.map(emp => {
            const cleanID = normalizeID(emp.id);
            const mapping = mappings.find(m => normalizeID(m.sales_group) === cleanID || normalizeID(m.employee_id) === cleanID);

            return {
              ...emp,
              id: cleanID, // Normalized ID
              originalId: emp.id,
              displayName: mapping?.arabic_name || emp.name,
              salesGroup: mapping?.sales_group,
              name: mapping?.arabic_name || emp.name
            };
          }));

          setUnifiedEmployees(unifiedList);
        }

        setAllSalesData(newData);
        setLoadedYears(newLoadedYears);

      } catch (err: any) {
        console.error('❌ DataProvider: Error loading all years:', err);
        if (!cancelled) setError(err?.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAllYears();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo(
    () => ({ allSalesData, loading, error, loadedYears, storeMap, stores, unifiedEmployees, products }),
    [allSalesData, loading, error, loadedYears, storeMap, stores, unifiedEmployees, products]
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
};

