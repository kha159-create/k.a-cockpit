import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
  const [storeMap, setStoreMap] = useState<MapRec>({});
  const [employeeMap, setEmployeeMap] = useState<MapRec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!user) {
        setStoreMap({});
        setEmployeeMap({});
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const currentYear = new Date().getFullYear();

        // Parallel load
        const [storesList] = await Promise.all([
          getStores(currentYear)
        ]);

        if (cancelled) return;

        const sMap: MapRec = {};
        storesList.forEach((store) => {
          const key = String((store as any).store_id ?? store.id ?? store.name).trim();
          sMap[key] = pickStoreName(store, key);
        });
        setStoreMap(sMap);
        console.log(`✅ DirectoryProvider: Loaded ${Object.keys(sMap).length} stores`);

        // Load employees
        if (currentYear > 2025) {
          const url = apiUrl('/api/get-employees');
          const response = await fetch(url);
          if (response.ok) {
            const result: any = await response.json();
            if (!cancelled && result.success && Array.isArray(result.employees)) {
              const eMap: MapRec = {};
              result.employees.forEach((emp: any) => {
                const key = String(emp.employeeId ?? emp.id ?? emp.name).trim();
                eMap[key] = pickEmployeeName(emp, key);
              });
              setEmployeeMap(eMap);
              console.log(`✅ DirectoryProvider: Loaded ${Object.keys(eMap).length} employees`);
            }
          }
        }

      } catch (err: any) {
        console.error('❌ DirectoryProvider load error:', err);
        if (!cancelled) setError(err?.message || 'Failed to load directory data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo(() => ({ storeMap, employeeMap, loading, error }), [storeMap, employeeMap, loading, error]);

  return <DirCtx.Provider value={value}>{children}</DirCtx.Provider>;
};


