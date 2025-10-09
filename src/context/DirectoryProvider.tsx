import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '@/services/firebase';

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

    const run = async () => {
      try {
        setLoading(true);

        // Stores
        const storesSnap = await db.collection('stores').get();
        const sMap: MapRec = {};
        storesSnap.forEach((doc) => {
          const data = doc.data();
          const key = String(data?.store_id ?? data?.id ?? doc.id).trim();
          sMap[key] = pickStoreName(data, key);
        });

        // Employees
        const employeesSnap = await db.collection('employees').get();
        const eMap: MapRec = {};
        employeesSnap.forEach((doc) => {
          const data = doc.data();
          const key = String(data?.employee_id ?? data?.id ?? doc.id).trim();
          eMap[key] = pickEmployeeName(data, key);
        });

        if (!cancelled) {
          setStoreMap(sMap);
          setEmployeeMap(eMap);
          setError(undefined);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Directory load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({ storeMap, employeeMap, loading, error }), [storeMap, employeeMap, loading, error]);

  return <DirCtx.Provider value={value}>{children}</DirCtx.Provider>;
};


