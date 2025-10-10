import React, { useState, useMemo } from 'react';
import AreaStoreFilter from '../components/AreaStoreFilter';
import MonthYearFilter from '../components/MonthYearFilter';
import { Table, Column } from '../components/Table';
import { TableSkeleton } from '../components/SkeletonLoader';
import { PlusIcon, PencilIcon, TrashIcon, SparklesIcon, PlusCircleIcon, ClipboardListIcon } from '../components/Icons';
import type { EmployeeSummary, Store, DateFilter, AreaStoreFilterState, FilterableData, ModalState, Employee, DailyMetric, SalesTransaction, StoreSummary, UserProfile } from '../types';
import { AchievementBar } from '../components/DashboardComponents';
import { EmployeeName } from '@/components/Names';
import Employee360View from '../components/Employee360View';
import { useLocale } from '../context/LocaleContext';

interface EmployeesPageProps {
  employeeSummary: { [storeName: string]: EmployeeSummary[] };
  allStores: Store[];
  allDateData: FilterableData[];
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  areaStoreFilter: AreaStoreFilterState;
  setAreaStoreFilter: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
  setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
  onEdit: (employee: EmployeeSummary) => void;
  onDelete: (id: string, name: string) => void;
  isRecalculating: boolean;
  dailyMetrics: DailyMetric[];
  salesTransactions: SalesTransaction[];
  kingDuvetSales: SalesTransaction[];
  storeSummary: StoreSummary[];
  allEmployees: Employee[];
  profile: UserProfile | null;
}

const EmployeesPage: React.FC<EmployeesPageProps> = ({ 
    employeeSummary, allStores, allDateData, dateFilter, setDateFilter, areaStoreFilter, setAreaStoreFilter, setModalState, onEdit, onDelete, isRecalculating,
    dailyMetrics, salesTransactions, kingDuvetSales, storeSummary, allEmployees,
    profile
}) => {
  const { t } = useLocale();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Debug: Log the data to see what we're receiving (removed to prevent infinite re-render)
  // console.log('EmployeesPage - employeeSummary:', employeeSummary);
  // console.log('EmployeesPage - allEmployees:', allEmployees);
  // console.log('EmployeesPage - isRecalculating:', isRecalculating);

  const canAdd = false; // removed manual add
  const canDelete = false; // removed manual delete
  const canEdit = false; // removed manual edit
  const canSendTasks = profile?.role !== 'employee';

  const allEmployeeSummaries = useMemo(() => {
    const summaries = Object.values(employeeSummary);
    return Array.isArray(summaries) ? summaries.flat() : [];
  }, [employeeSummary]);

  const filteredEmployeeSummary = useMemo(() => {
    // Derive manager's effective store (used to scope visibility)
    const derivedFromEmployees = allEmployees.find(e =>
      (profile?.employeeId && e.employeeId === profile.employeeId) ||
      (e.userEmail && profile?.email && e.userEmail === profile.email)
    );
    const managerStore = profile?.store || derivedFromEmployees?.currentStore || '';

    return Object.entries(employeeSummary).reduce((acc, [storeName, employees]) => {
        // If user is store_manager, hide employee lists of other stores entirely
        if (profile?.role === 'store_manager' && storeName !== managerStore) {
            return acc; // skip rendering this store's employees
        }
        const employeesArray = Array.isArray(employees) ? employees as EmployeeSummary[] : [];
        if (!searchTerm) {
            acc[storeName] = employeesArray;
            return acc;
        }
        const filteredEmployees = employeesArray.filter(emp => (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
        if (filteredEmployees.length > 0) {
            acc[storeName] = filteredEmployees;
        }
        return acc;
    }, {} as {[storeName: string]: EmployeeSummary[]});
  }, [employeeSummary, searchTerm]);

  // Debug: Log filteredEmployeeSummary after it's defined (removed to prevent infinite re-render)
  // console.log('EmployeesPage - filteredEmployeeSummary:', filteredEmployeeSummary);
  
  const getRowClassName = (item: EmployeeSummary) => {
    if (item.achievement >= 100) return 'bg-green-50';
    if (item.achievement < 80) return 'bg-red-50';
    return '';
  };

  const handleRowClick = (employee: EmployeeSummary) => {
    setSelectedEmployeeId(prev => (prev === employee.id ? null : employee.id));
  };

  const columns: Column<EmployeeSummary>[] = [
      { key: 'name', label: t('employee'), sortable: true, render: (_value, record) => (
        <span className="font-medium text-blue-600">
          <EmployeeName id={(record as any).employeeId ?? (record as any).id ?? record.name} fallback={record.name} />
        </span>
      ) },
      { key: 'totalSales', label: t('total_sales'), sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
      { key: 'atv', label: t('avg_transaction_value'), sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
      { key: 'effectiveTarget', label: t('sales_target'), sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
      { key: 'achievement', label: t('achievement'), sortable: true, render: (_value, record) => <AchievementBar percentage={record.achievement ?? 0} /> },
      { key: 'actions', label: t('actions'), render: (_value, record) => (
          <div className="flex space-x-1">
              <button onClick={(e) => { e.stopPropagation(); setModalState({type: 'aiCoaching', data: record}); }} className="text-orange-500 p-1" title={t('ai_coaching_title')}><SparklesIcon /></button>
              {canSendTasks && <button onClick={(e) => { e.stopPropagation(); setModalState({type: 'task', data: record}); }} className="text-gray-600 p-1" title={t('send_task_title')}><ClipboardListIcon /></button>}
              {canEdit && <button onClick={(e) => { e.stopPropagation(); setModalState({type: 'dailyMetric', data: {mode: 'employee', employee: record.name, store: (record as any).store}}); }} className="text-green-600 p-1" title={t('add_kpi_title')}><PlusCircleIcon /></button>}
              {canEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(record); }} className="text-blue-600 p-1" title={t('edit_title')}><PencilIcon /></button>}
              {canDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(record.id, record.name); }} className="text-red-600 p-1" title={t('delete_title')}><TrashIcon /></button>}
          </div>
      )},
    ];
  
  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />
        <AreaStoreFilter stores={allStores} filters={areaStoreFilter} setFilters={setAreaStoreFilter} profile={profile} />
      </div>
       <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
         <input
          type="text"
          placeholder={t('search_employee_placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input w-full max-w-sm"
        />
        {/* Manual employee actions removed as per new flow */}
       </div>
        <div className="space-y-6">
            {isRecalculating ? <TableSkeleton /> : (
                Object.keys(filteredEmployeeSummary).length === 0 ? (
                     <div className="text-center p-10 bg-white rounded-lg shadow"><p>{t('no_employee_data')}</p></div>
                ) : (
                    Object.entries(filteredEmployeeSummary).sort(([a], [b]) => a.localeCompare(b)).map(([storeName, employees]) => (
                        <div key={storeName} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-xl font-semibold text-zinc-800 mb-4">{storeName}</h3>
                            <Table 
                                columns={columns} 
                                data={employees as EmployeeSummary[]} 
                                initialSortKey="totalSales"
                                rowClassName={getRowClassName} 
                                onRowClick={handleRowClick}
                                renderExpandedRow={(item) => 
                                    selectedEmployeeId === item.id && (
                                        <div className="p-4">
                                            <Employee360View
                                                employee={item}
                                                allMetrics={dailyMetrics}
                                                salesTransactions={salesTransactions}
                                                kingDuvetSales={kingDuvetSales}
                                                storeSummary={storeSummary}
                                                dateFilter={dateFilter}
                                                setModalState={setModalState}
                                                allEmployeeSummaries={allEmployeeSummaries}
                                            />
                                        </div>
                                    )
                                }
                            />
                        </div>
                    ))
                )
            )}
        </div>
    </div>
  );
};

export default EmployeesPage;