import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '@/services/firebase';
import { getSalesData } from '@/data/dataProvider';
import type { NormalizedSalesResponse } from '@/data/dataProvider';

type AllSalesDataByYear = {
  [year: number]: NormalizedSalesResponse | null;
};

type DataState = {
  allSalesData: AllSalesDataByYear;
  loading: boolean;
  error?: string;
  loadedYears: Set<number>;
};

const DataCtx = createContext<DataState>({
  allSalesData: {},
  loading: true,
  loadedYears: new Set(),
});

export const useData = () => useContext(DataCtx);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allSalesData, setAllSalesData] = useState<AllSalesDataByYear>({
    2024: null,
    2025: null,
    2026: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [loadedYears, setLoadedYears] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadAllYears = async () => {
      if (cancelled) return;

      try {
        setLoading(true);
        setError(undefined);
        console.log('🚀 DataProvider: Starting parallel load of all years (2024, 2025, 2026)...');

        // Load all years in parallel using Promise.all
        const [year2024, year2025, year2026] = await Promise.allSettled([
          getSalesData({ year: 2024 }), // Legacy data
          getSalesData({ year: 2025 }), // Legacy data
          getSalesData({ year: 2026 }), // D365 data
        ]);

        if (cancelled) return;

        const newData: AllSalesDataByYear = {};
        const newLoadedYears = new Set<number>();

        // Process 2024
        if (year2024.status === 'fulfilled' && year2024.value.success) {
          newData[2024] = year2024.value;
          newLoadedYears.add(2024);
          console.log(`✅ DataProvider: Loaded 2024 (legacy) - ${year2024.value.byStore.length} stores, ${year2024.value.byDay?.length || 0} days`);
        } else {
          console.warn('⚠️ DataProvider: Failed to load 2024:', year2024.status === 'rejected' ? year2024.reason : 'unknown error');
          newData[2024] = null;
        }

        // Process 2025
        if (year2025.status === 'fulfilled' && year2025.value.success) {
          newData[2025] = year2025.value;
          newLoadedYears.add(2025);
          console.log(`✅ DataProvider: Loaded 2025 (legacy) - ${year2025.value.byStore.length} stores, ${year2025.value.byDay?.length || 0} days`);
        } else {
          console.warn('⚠️ DataProvider: Failed to load 2025:', year2025.status === 'rejected' ? year2025.reason : 'unknown error');
          newData[2025] = null;
        }

        // Process 2026
        if (year2026.status === 'fulfilled' && year2026.value.success) {
          newData[2026] = year2026.value;
          newLoadedYears.add(2026);
          console.log(`✅ DataProvider: Loaded 2026 (D365) - ${year2026.value.byStore.length} stores, ${year2026.value.byDay?.length || 0} days, ${year2026.value.byEmployee.length} employees`);
        } else {
          console.warn('⚠️ DataProvider: Failed to load 2026:', year2026.status === 'rejected' ? year2026.reason : 'unknown error');
          newData[2026] = null;
        }

        setAllSalesData(newData);
        setLoadedYears(newLoadedYears);
        console.log(`🎉 DataProvider: Completed loading - Loaded years: ${Array.from(newLoadedYears).join(', ')}`);

      } catch (err: any) {
        console.error('❌ DataProvider: Error loading all years:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Start loading when user is authenticated
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (cancelled) return;
      if (user) {
        loadAllYears();
      } else {
        // Reset data when logged out
        setAllSalesData({ 2024: null, 2025: null, 2026: null });
        setLoadedYears(new Set());
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, []); // Load once on mount

  const value = useMemo(
    () => ({ allSalesData, loading, error, loadedYears }),
    [allSalesData, loading, error, loadedYears]
  );

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
};
