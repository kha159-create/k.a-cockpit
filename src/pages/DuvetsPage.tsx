
import React, { useMemo } from 'react';
import AreaStoreFilter from '../components/AreaStoreFilter';
import MonthYearFilter from '../components/MonthYearFilter';
import { Table, Column } from '../components/Table';
import { TableSkeleton } from '../components/SkeletonLoader';
import type { DuvetSummary, Store, DateFilter, AreaStoreFilterState, FilterableData, UserProfile } from '../types';

interface DuvetsPageProps {
  duvetSummary: DuvetSummary;
  allStores: Store[];
  allDateData: FilterableData[];
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  areaStoreFilter: AreaStoreFilterState;
  setAreaStoreFilter: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
  isRecalculating: boolean;
  profile: UserProfile | null;
}

type DuvetRow = {
  id: string;
  name: string;
  'Low Value (199-399)': number;
  'Medium Value (495-695)': number;
  'High Value (795-999)': number;
  total: number;
}

const DuvetsPage: React.FC<DuvetsPageProps> = ({ 
    duvetSummary, allStores, allDateData, dateFilter, setDateFilter, areaStoreFilter, setAreaStoreFilter, isRecalculating, profile
}) => {
    const data: DuvetRow[] = useMemo(() => 
        Object.values(duvetSummary).map((d: DuvetSummary[string]) => ({ ...d, id: d.name })).sort((a,b) => b.total - a.total),
    [duvetSummary]);

    const columns: Column<DuvetRow>[] = [
        { key: 'name', label: 'Store', sortable: true },
        { key: 'Low Value (199-399)', label: 'Low Value', sortable: true },
        { key: 'Medium Value (495-695)', label: 'Medium Value', sortable: true },
        { key: 'High Value (795-999)', label: 'High Value', sortable: true },
        { key: 'total', label: 'Total Units', sortable: true }
    ];

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />
            <AreaStoreFilter stores={allStores} filters={areaStoreFilter} setFilters={setAreaStoreFilter} profile={profile} />
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-semibold text-zinc-800 mb-4">Duvet Sales Overview by Store</h3>
          {isRecalculating ? <TableSkeleton /> : <Table columns={columns} data={data} initialSortKey="total" />}
        </div>
    </div>
  );
};

export default DuvetsPage;