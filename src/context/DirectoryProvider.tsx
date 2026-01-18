import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '@/services/firebase';
import { getStores } from '@/data/dataProvider';
import { apiUrl } from '@/utils/apiBase';

type MapRec = Record<string, string>;

type DirState = {
  storeMap: MapRec;
  employeeMap: MapRec;
  loading: boolean;
  error?: string;
};

const DirCtx = createContext<DirState>({ storeMap: {}, employeeMap: {}, loading: true });

export const useDirectory = () => useContext(DirCtx);

const pickStoreName = (d: any, id: string) =>
  String(
    d?.name ??
    d?.store_name ??
    d?.title ??
    d?.store ??
    d?.storeName ??
    id
  );

const pickEmployeeName = (d: any, id: string) =>
  String(
    d?.name ??
    d?.employee_name ??
    d?.fullName ??
    d?.displayName ??
    d?.username ??
    id
  );

export const DirectoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storeMap, setStoreMap] = useState<MapRec>({});
  const [employeeMap, setEmployeeMap] = useState<MapRec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const loadStores = async () => {
      try {
        setLoading(true);
        // Get current year for stores (or use 2026 as default for D365)
        const currentYear = new Date().getFullYear();
        const storesList = await getStores(currentYear);
        
        if (cancelled) return;
        
        const sMap: MapRec = {};
        storesList.forEach((store) => {
          const key = String((store as any).store_id ?? store.id ?? store.name).trim();
          sMap[key] = pickStoreName(store, key);
        });
        
        setStoreMap(sMap);
        console.log(`✅ DirectoryProvider: Loaded ${Object.keys(sMap).length} stores`);
      } catch (err: any) {
        console.error('❌ DirectoryProvider stores load error:', err);
        if (!cancelled) setError(err?.message || 'Failed to load stores');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadEmployees = async () => {
      try {
        // Load employees from API (2026+ only)
        const currentYear = new Date().getFullYear();
        if (currentYear <= 2025) {
          // Legacy years have no employee data
          if (!cancelled) setEmployeeMap({});
          return;
        }
        
        const url = apiUrl('/api/get-employees');
        const response = await fetch(url);
        
        if (!response.ok) {
          if (!cancelled) setEmployeeMap({});
          return;
        }
        
        const result: any = await response.json();
        if (cancelled) return;
        
        const eMap: MapRec = {};
        if (result.success && Array.isArray(result.employees)) {
          result.employees.forEach((emp: any) => {
            const key = String(emp.employeeId ?? emp.id ?? emp.name).trim();
            eMap[key] = pickEmployeeName(emp, key);
          });
        }
        
        setEmployeeMap(eMap);
        console.log(`✅ DirectoryProvider: Loaded ${Object.keys(eMap).length} employees`);
      } catch (err: any) {
        console.error('❌ DirectoryProvider employees load error:', err);
        if (!cancelled) setEmployeeMap({});
      }
    };

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (cancelled) return;
      if (user) {
        loadStores();
        loadEmployees();
      } else {
        setStoreMap({});
        setEmployeeMap({});
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ storeMap, employeeMap, loading, error }), [storeMap, employeeMap, loading, error]);

  return <DirCtx.Provider value={value}>{children}</DirCtx.Provider>;
};


