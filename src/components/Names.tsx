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
  const key = id != null ? String(id).trim() : '';

  // Try direct string match
  // Then try stripping leading zeros (e.g. "0046" -> "46")
  // Then try fallback
  const name = (key && employeeMap[key]) ||
    (key && employeeMap[String(Number(key))]) ||
    fallback;

  return <span>{name || (loading ? '…' : '—')}</span>;
};


