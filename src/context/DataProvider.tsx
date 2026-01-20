import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '@/services/firebase';
import { getSalesData, loadTargetsAndVisitors, mergeTargetsAndVisitors } from '@/data/dataProvider';
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

        // Load all years + targets/visitors in parallel (like orange-dashboard init)
        const [year2024, year2025, year2026, targetsVisitors] = await Promise.allSettled([
          getSalesData({ year: 2024 }), // Legacy data
          getSalesData({ year: 2025 }), // Legacy data
          getSalesData({ year: 2026 }), // D365 data (raw, without targets/visitors)
          loadTargetsAndVisitors(), // Load targets/visitors once (for merging)
        ]);

        if (cancelled) return;

        const newData: AllSalesDataByYear = {};
        const newLoadedYears = new Set<number>();

        // Extract targets/visitors FIRST (once, for merging with all years)
        let targets: any = {};
        let visitors: any[] = [];
        if (targetsVisitors.status === 'fulfilled') {
          targets = targetsVisitors.value.targets || {};
          visitors = targetsVisitors.value.visitors || [];
          console.log(`✅ DataProvider: Loaded targets/visitors - ${Object.keys(targets).length} years, ${visitors.length} visitor entries`);
        } else {
          console.warn('⚠️ DataProvider: Failed to load targets/visitors (will merge empty data):', targetsVisitors.status === 'rejected' ? targetsVisitors.reason : 'unknown error');
        }
        
        // Process 2024 - Merge targets/visitors ONCE during initialization (NOT in render loop)
        if (year2024.status === 'fulfilled' && year2024.value.success) {
          const merged2024 = mergeTargetsAndVisitors(year2024.value, targets, visitors, 2024);
          newData[2024] = merged2024;
          newLoadedYears.add(2024);
        } else {
          newData[2024] = null;
        }
        
        // Process 2025 - Merge targets/visitors ONCE during initialization (NOT in render loop)
        if (year2025.status === 'fulfilled' && year2025.value.success) {
          const merged2025 = mergeTargetsAndVisitors(year2025.value, targets, visitors, 2025);
          newData[2025] = merged2025;
          newLoadedYears.add(2025);
        } else {
          newData[2025] = null;
        }
        
        // Process 2026 - Merge targets/visitors ONCE during initialization (NOT in render loop)
        if (year2026.status === 'fulfilled' && year2026.value.success) {
          const merged2026 = mergeTargetsAndVisitors(year2026.value, targets, visitors, 2026);
          newData[2026] = merged2026;
          newLoadedYears.add(2026);
        } else {
          newData[2026] = null;
        }

        if (cancelled) return;
        
        setAllSalesData(newData);
        setLoadedYears(newLoadedYears);

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
