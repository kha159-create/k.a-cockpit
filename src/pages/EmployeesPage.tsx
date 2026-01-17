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

  const canAdd = profile?.role === 'admin';
  const canDelete = profile?.role === 'admin';
  const canEdit = profile?.role === 'admin' || profile?.role === 'area_manager';
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
  }, [employeeSummary, searchTerm, profile, allEmployees]);

  // Group employees by area manager (like StoresPage)
  const employeesByAreaManager = useMemo((): { [key: string]: { storeName: string; employees: EmployeeSummary[] }[] } => {
    const grouped: { [key: string]: { storeName: string; employees: EmployeeSummary[] }[] } = {};
    
    Object.entries(filteredEmployeeSummary).forEach(([storeName, employees]) => {
      // Find store to get areaManager
      const store = allStores.find(s => s.name === storeName);
      const manager = store?.areaManager || t('unassigned');
      
      if (!grouped[manager]) {
        grouped[manager] = [];
      }
      grouped[manager].push({ storeName, employees });
    });
    
    return grouped;
  }, [filteredEmployeeSummary, allStores, t]);

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
        {canAdd && (
            <button onClick={() => setModalState({type: 'employee'})} className="btn-primary flex items-center gap-2">
                <PlusIcon /> {t('add_employee')}
            </button>
        )}
       </div>
        <div className="space-y-6">
            {isRecalculating ? <TableSkeleton /> : (
                Object.keys(employeesByAreaManager).length === 0 ? (
                     <div className="text-center p-10 bg-white rounded-lg shadow"><p>{t('no_employee_data')}</p></div>
                ) : (
                    Object.keys(employeesByAreaManager).sort((a, b) => a.localeCompare(b)).map(managerName => {
                        const storesWithEmployees = employeesByAreaManager[managerName];
                        const totalEmployees = storesWithEmployees.reduce((sum, s) => sum + s.employees.length, 0);
                        const totalSales = storesWithEmployees.reduce((sum, s) => {
                            const storeSales = s.employees.reduce((empSum, emp) => empSum + (emp.totalSales || 0), 0);
                            return sum + storeSales;
                        }, 0);
                        
                        return (
                            <div key={managerName} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                {/* Area Manager Summary Card (similar to StoresPage) */}
                                <div className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 p-4 rounded-lg shadow-sm border-2 border-blue-200/60 mb-6">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="text-xl font-bold text-blue-900 mb-2">{managerName}</h4>
                                            <p className="text-sm text-blue-700">{t('stores_count')}: {storesWithEmployees.length} | {t('employees')}: {totalEmployees}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-blue-900">{totalSales.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</p>
                                            <p className="text-sm text-blue-700">{t('total_sales')}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Employees grouped by Store */}
                                {storesWithEmployees.sort((a, b) => a.storeName.localeCompare(b.storeName)).map(({ storeName, employees }) => (
                                    <div key={storeName} className="mb-6 last:mb-0">
                                        <h5 className="text-md font-semibold text-gray-700 mb-3">{storeName}</h5>
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
                                ))}
                            </div>
                        );
                    })
                )
            )}
        </div>
    </div>
  );
};

export default EmployeesPage;