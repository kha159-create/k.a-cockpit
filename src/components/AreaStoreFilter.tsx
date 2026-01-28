import React, { useMemo } from 'react';
import type { Store, AreaStoreFilterState, UserProfile } from '../types';
import { useLocale } from '../context/LocaleContext';

interface AreaStoreFilterProps {
  stores: Store[];
  filters: AreaStoreFilterState;
  setFilters: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
  profile: UserProfile | null;
}

/**
 * Normalizes city names to Title Case, trims, and deduplicates.
 */
function normalizeCity(city: string | undefined): string {
  if (!city) return 'Unknown';
  const trimmed = city.trim();
  if (!trimmed) return 'Unknown';

  // Title Case logic: First letter Upper, rest lower
  return trimmed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const AreaStoreFilter: React.FC<AreaStoreFilterProps> = ({ stores, filters, setFilters, profile }) => {
  const { t } = useLocale();
  const showAreaManagerFilter = profile?.role === 'admin' || profile?.role === 'general_manager';

  // 1. Available Area Managers (derived from all stores)
  const areaManagers = useMemo(() => {
    if (!showAreaManagerFilter) return [];
    const managers = new Set(stores.map(s => s.areaManager).filter(Boolean));
    return ['All', ...Array.from(managers).sort()];
  }, [stores, showAreaManagerFilter]);

  // 2. Normalize and enrich stores with clean city names
  const normalizedStores = useMemo(() => {
    return stores.map(s => ({
      ...s,
      cleanCity: normalizeCity(s.city)
    }));
  }, [stores]);

  // 3. Available Cities (DEPENDS on selected Area Manager) - CASCADE 1
  const cities = useMemo(() => {
    let relevantStores = normalizedStores;
    if (filters.areaManager !== 'All' && showAreaManagerFilter) {
      relevantStores = relevantStores.filter(s => s.areaManager === filters.areaManager);
    } else if (!showAreaManagerFilter && profile?.areaManager) {
      relevantStores = relevantStores.filter(s => s.areaManager === profile.areaManager);
    }

    const citySet = new Set(relevantStores.map(s => s.cleanCity));
    return ['All', ...Array.from(citySet).sort()];
  }, [normalizedStores, filters.areaManager, showAreaManagerFilter, profile]);

  // 4. Available Stores (DEPENDS on Area Manager AND City) - CASCADE 2
  const availableStores = useMemo(() => {
    let filtered = normalizedStores;

    // Filter by area manager
    if (filters.areaManager !== 'All' && showAreaManagerFilter) {
      filtered = filtered.filter(s => s.areaManager === filters.areaManager);
    } else if (!showAreaManagerFilter && profile?.areaManager) {
      filtered = filtered.filter(s => s.areaManager === profile.areaManager);
    }

    // Filter by city (using normalized name)
    if (filters.city && filters.city !== 'All') {
      filtered = filtered.filter(s => s.cleanCity === filters.city);
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [normalizedStores, filters.areaManager, filters.city, showAreaManagerFilter, profile]);

  // Event Handlers
  const handleAreaManagerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    // Reset city and store when manager changes
    setFilters({ areaManager: val, store: 'All', city: 'All' });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    // Reset store when city changes
    setFilters({ ...filters, city: val, store: 'All' });
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
            {areaManagers.map(m => (
              <option key={m} value={m}>
                {m === 'All' ? t('all_area_managers') : m}
              </option>
            ))}
          </select>
        </div>
      )}

      {cities.length > 1 && (
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="font-semibold text-zinc-600">{t('city')}:</span>
          <select value={filters.city || 'All'} onChange={handleCityChange} className="input w-full">
            {cities.map(c => (
              <option key={c} value={c}>
                {c === 'All' ? t('all_cities') : c}
              </option>
            ))}
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
          {availableStores.map(s => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default AreaStoreFilter;
