import React, { useMemo } from 'react';
import AreaStoreFilter from '../components/AreaStoreFilter';
import MonthYearFilter from '../components/MonthYearFilter';
import { Table, Column } from '../components/Table';
import { TableSkeleton } from '../components/SkeletonLoader';
import { PlusIcon, PencilIcon, TrashIcon, UsersIcon } from '../components/Icons';
import type { StoreSummary, Store, DateFilter, AreaStoreFilterState, FilterableData, ModalState, UserProfile, DailyMetric } from '../types';
import { useLocale } from '../context/LocaleContext';
import { AchievementBar } from '../components/DashboardComponents';
import { StoreName } from '@/components/Names';

interface StoresPageProps {
  storeSummary: StoreSummary[];
  allStores: Store[];
  allDateData: FilterableData[];
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  areaStoreFilter: AreaStoreFilterState;
  setAreaStoreFilter: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
  setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
  onEdit: (store: StoreSummary) => void;
  onDelete: (id: string, name: string) => void;
  onSelectStore: (store: StoreSummary) => void;
  isRecalculating: boolean;
  profile: UserProfile | null;
  allMetrics: DailyMetric[];
}

const StoresPage: React.FC<StoresPageProps> = ({ 
    storeSummary, allStores, allDateData, dateFilter, setDateFilter, areaStoreFilter, setAreaStoreFilter, setModalState, onEdit, onDelete, onSelectStore, isRecalculating, profile
}) => {
  const { t } = useLocale();

  // Debug: Log the data to see what we're receiving (removed to prevent infinite re-render)
  // console.log('StoresPage - storeSummary:', storeSummary);
  // console.log('StoresPage - isRecalculating:', isRecalculating);
  const canAdd = profile?.role === 'admin';
  const canDelete = profile?.role === 'admin';
  const canEdit = profile?.role === 'admin' || profile?.role === 'general_manager';
  const canAddVisitors = ['admin', 'general_manager', 'area_manager', 'store_manager'].includes(profile?.role || '');

  const columns: Column<StoreSummary>[] = [
    { key: 'name', label: t('store'), sortable: true, render: (_value, record) => (
      <span onClick={() => onSelectStore(record)} className="cursor-pointer font-medium text-blue-600 hover:underline">
        <StoreName id={(record as any).store_id ?? (record as any).id ?? record.name} fallback={record.name} />
      </span>
    ) },
    { key: 'totalSales', label: t('total_sales'), sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
    { key: 'effectiveTarget', label: t('sales_target'), sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
    { key: 'targetAchievement', label: t('achievement'), sortable: true, render: (_value, record) => <AchievementBar percentage={record.targetAchievement ?? 0} /> },
  ];

  if (canEdit || canDelete) {
    columns.push({ key: 'actions', label: t('actions'), render: (item) => (
      <div className="flex space-x-2">
        {canEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="text-blue-600 hover:text-blue-800 p-1" title={t('edit_title')}><PencilIcon /></button>}
        {canDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.name); }} className="text-red-600 hover:text-red-800 p-1" title={t('delete_title')}><TrashIcon /></button>}
      </div>
    )});
  }
  
  const storesByAreaManager = useMemo((): { [key: string]: StoreSummary[] } => {
    if (!Array.isArray(storeSummary) || storeSummary.length === 0) {
      return {};
    }
    
    const grouped: { [key: string]: StoreSummary[] } = {};
    for (const store of storeSummary) {
        const manager = store.areaManager || t('unassigned');
        if (!grouped[manager]) {
            grouped[manager] = [];
        }
        grouped[manager].push(store);
    }
    return grouped;
  }, [storeSummary, t]);

  // Debug: Log storesByAreaManager after it's defined (removed to prevent infinite re-render)
  // console.log('StoresPage - storesByAreaManager:', storesByAreaManager);

  const getRowClassName = (item: StoreSummary) => {
    if (item.targetAchievement >= 100) return 'bg-green-50';
    if (item.targetAchievement < 80) return 'bg-red-50';
    return '';
  };

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />
        <AreaStoreFilter stores={allStores} filters={areaStoreFilter} setFilters={setAreaStoreFilter} profile={profile} />
      </div>
      <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold text-zinc-800">{t('stores_overview')}</h3>
          <div className="flex items-center gap-2">
              {canAddVisitors && (
                <button onClick={() => setModalState({type: 'visitors'})} className="btn-secondary flex items-center gap-2">
                    <UsersIcon /> {t('add_visitors')}
                </button>
              )}
              {canAdd && (
                <button onClick={() => setModalState({type: 'store'})} className="btn-primary flex items-center gap-2">
                    <PlusIcon /> {t('add_store')}
                </button>
              )}
          </div>
        </div>
        <div className="space-y-6">
            {isRecalculating ? <TableSkeleton /> : (
                Object.keys(storesByAreaManager).sort((a, b) => a.localeCompare(b)).map(managerName => {
                    const stores = storesByAreaManager[managerName];
                    return (
                        <div key={managerName} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h4 className="text-lg font-bold text-zinc-700 mb-4">{managerName}</h4>
                            <Table columns={columns} data={stores} initialSortKey="totalSales" rowClassName={getRowClassName} />
                        </div>
                    );
                })
            )}
        </div>
    </div>
  );
};

export default StoresPage;