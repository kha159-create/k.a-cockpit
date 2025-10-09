import React, { useState } from 'react';
import { EmployeeName } from '@/components/Names';
import AreaStoreFilter from '../components/AreaStoreFilter';
import MonthYearFilter from '../components/MonthYearFilter';
import { Table, Column } from '../components/Table';
import { TableSkeleton } from '../components/SkeletonLoader';
import type { CommissionStoreData, EmployeeSummary, Store, DateFilter, AreaStoreFilterState, FilterableData, UserProfile } from '../types';

interface CommissionsPageProps {
    commissionData: CommissionStoreData[];
    allStores: Store[];
    allDateData: FilterableData[];
    dateFilter: DateFilter;
    setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
    areaStoreFilter: AreaStoreFilterState;
    setAreaStoreFilter: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
    isRecalculating: boolean;
    profile: UserProfile | null;
}

type CommissionEmployeeRow = EmployeeSummary & {
    finalCommissionRate: number;
    commissionAmount: number;
};

const CommissionsPage: React.FC<CommissionsPageProps> = ({ 
    commissionData, allStores, allDateData, dateFilter, setDateFilter, areaStoreFilter, setAreaStoreFilter, isRecalculating, profile
}) => {
    const [openStore, setOpenStore] = useState<string | null>(commissionData.length > 0 ? commissionData[0].name : null);

    const columns: Column<CommissionEmployeeRow>[] = [
        { key: 'name', label: 'Employee', sortable: true, render: (_value, record) => (
            <EmployeeName id={(record as any).employeeId ?? (record as any).id ?? record.name} fallback={record.name} />
        ) },
        { key: 'totalSales', label: 'Total Sales', sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
        { key: 'achievement', label: 'Employee Achievement', sortable: true, render: (value) => `${(value as number).toFixed(1)}%` },
        { key: 'finalCommissionRate', label: 'Final Commission Rate', sortable: true, render: (value) => <span className="font-semibold text-blue-600">{`${(value as number).toFixed(2)}%`}</span> },
        { key: 'commissionAmount', label: 'Commission Amount', sortable: true, render: (value) => <span className="font-semibold text-green-600">{(value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</span> },
    ];

    // Determine manager's store to scope visible employees if needed
    const effectiveStoreName = profile?.store || '';

    return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />
            <AreaStoreFilter stores={allStores} filters={areaStoreFilter} setFilters={setAreaStoreFilter} profile={profile}/>
        </div>
        {isRecalculating ? <TableSkeleton rows={10} /> : (
            commissionData.length === 0 ? (
                <div className="text-center p-10 bg-white rounded-lg shadow"><p>No commission data available for the selected period.</p></div>
            ) : (
                <div className="space-y-4">
                     {Array.isArray(commissionData) ? commissionData.sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(store => (
                    <div key={store.name} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => setOpenStore(prev => prev === store.name ? null : store.name)}>
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-semibold text-zinc-800">{store.name}</h3>
                                <span className="text-xl">{openStore === store.name ? '−' : '+'}</span>
                            </div>
                            <p className="text-sm text-zinc-500 mt-1">
                                Store Achievement: {store.achievement.toFixed(1)}% | Applicable Commission Rate: <strong>{store.commissionRate.toFixed(1)}%</strong>
                            </p>
                        </div>
                            {openStore === store.name && (
                            <div className="p-4 border-t border-gray-200">
                                    <Table 
                                      columns={columns} 
                                      data={
                                        profile?.role === 'store_manager' && effectiveStoreName
                                          ? store.employees.filter(e => (e as any).store === effectiveStoreName)
                                          : store.employees
                                      } 
                                      initialSortKey="commissionAmount" 
                                    />
                            </div>
                        )}
                    </div>
                )) : []}
                </div>
            )
        )}
    </div>
  );
};

export default CommissionsPage;
