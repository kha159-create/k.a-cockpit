import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db, auth } from '@/services/firebase';

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
    let unsubStores: (() => void) | null = null;
    let unsubEmployees: (() => void) | null = null;

    const startListeners = () => {
      setLoading(true);
      unsubStores = db.collection('stores').onSnapshot(
        (snap) => {
          const sMap: MapRec = {};
          snap.docs.map((doc) => {
            const data = doc.data();
            const key = String(data?.store_id ?? data?.id ?? doc.id).trim();
            sMap[key] = pickStoreName(data, key);
            return null;
          });
          if (!cancelled) setStoreMap(sMap);
          if (!cancelled) setLoading(false);
        },
        (err) => {
          console.error('DirectoryProvider stores listener error:', err);
          if (!cancelled) setError(err?.message || 'Missing or insufficient permissions');
          if (!cancelled) setLoading(false);
        }
      );

      unsubEmployees = db.collection('employees').onSnapshot(
        (snap) => {
          const eMap: MapRec = {};
          snap.docs.map((doc) => {
            const data = doc.data();
            const key = String(data?.employee_id ?? data?.id ?? doc.id).trim();
            eMap[key] = pickEmployeeName(data, key);
            return null;
          });
          if (!cancelled) setEmployeeMap(eMap);
          if (!cancelled) setLoading(false);
        },
        (err) => {
          console.error('DirectoryProvider employees listener error:', err);
          if (!cancelled) setError(err?.message || 'Missing or insufficient permissions');
          if (!cancelled) setLoading(false);
        }
      );
    };

    const stopListeners = () => {
      if (unsubStores) unsubStores();
      if (unsubEmployees) unsubEmployees();
      unsubStores = null;
      unsubEmployees = null;
      if (!cancelled) {
        setStoreMap({});
        setEmployeeMap({});
      }
    };

    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (cancelled) return;
      if (user) {
        startListeners();
      } else {
        stopListeners();
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      stopListeners();
      unsubAuth();
    };
  }, []);

  const value = useMemo(() => ({ storeMap, employeeMap, loading, error }), [storeMap, employeeMap, loading, error]);

  return <DirCtx.Provider value={value}>{children}</DirCtx.Provider>;
};


