import React, { useMemo } from 'react';
import type { Store, AreaStoreFilterState, UserProfile } from '../types';
import { useLocale } from '../context/LocaleContext';

interface AreaStoreFilterProps {
  stores: Store[];
  filters: AreaStoreFilterState;
  setFilters: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
  profile: UserProfile | null;
}

const AreaStoreFilter: React.FC<AreaStoreFilterProps> = ({ stores, filters, setFilters, profile }) => {
  const { t } = useLocale();
  const showAreaManagerFilter = profile?.role === 'admin' || profile?.role === 'general_manager';

  const areaManagers = useMemo(() => {
    if (!showAreaManagerFilter) return [];
    const managers = new Set(stores.map(s => s.areaManager).filter(Boolean));
    return ['All', ...Array.from(managers).sort()];
  }, [stores, showAreaManagerFilter]);

  const availableStores = useMemo(() => {
    if (filters.areaManager === 'All' && showAreaManagerFilter) {
      return stores;
    }
    // For non-admins/GMs, filter based on their area context from profile if available
    const areaToFilterBy = showAreaManagerFilter ? filters.areaManager : profile?.areaManager;
    if (!areaToFilterBy) return stores;
    
    return stores.filter(s => s.areaManager === areaToFilterBy);
  }, [stores, filters.areaManager, showAreaManagerFilter, profile]);

  const handleAreaManagerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ areaManager: e.target.value, store: 'All' });
  };

  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, store: e.target.value }));
  };

    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-neutral-200">
      {showAreaManagerFilter && (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="font-semibold text-zinc-600">{t('area_manager')}:</span>
            <select value={filters.areaManager} onChange={handleAreaManagerChange} className="input w-full">
              {areaManagers.map(m => <option key={m} value={m}>{m === 'All' ? t('all_area_managers') : m}</option>)}
            </select>
          </div>
      )}
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <span className="font-semibold text-zinc-600">{t('store')}:</span>
        <select
          value={filters.store}
          onChange={handleStoreChange}
          className="input w-full"
          disabled={profile?.role === 'employee'}
        >
          <option value="All">{t('all_stores')}</option>
          {availableStores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>
    </div>
  );
};

export default AreaStoreFilter;
