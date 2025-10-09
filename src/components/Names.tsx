import React from 'react';
import { useDirectory } from '@/context/DirectoryProvider';

export const StoreName: React.FC<{ id?: string | number; fallback?: string }> = ({ id, fallback }) => {
  const { storeMap, loading } = useDirectory();
  const key = id != null ? String(id) : '';
  const name = (key && storeMap[key]) || fallback;
  return <span>{name || (loading ? '…' : '—')}</span>;
};

export const EmployeeName: React.FC<{ id?: string | number; fallback?: string }> = ({ id, fallback }) => {
  const { employeeMap, loading } = useDirectory();
  const key = id != null ? String(id) : '';
  const name = (key && employeeMap[key]) || fallback;
  return <span>{name || (loading ? '…' : '—')}</span>;
};


