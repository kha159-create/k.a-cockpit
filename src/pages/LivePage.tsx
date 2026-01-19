import React, { useEffect, useState, useMemo } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { getLiveSales, getStores } from '@/data/dataProvider';
import { useData } from '@/context/DataProvider';
import { apiUrl } from '@/utils/apiBase';
import type { Store, UserProfile } from '@/types';

interface LiveSalesData {
  date: string; // YYYY-MM-DD (from API JSON)
  lastUpdate: string; // HH:MM format (from API JSON)
  today: Array<{ outlet: string; sales: number }>;
  yesterday: Array<{ outlet: string; sales: number }>;
  // Legacy support - fallback to old format
  stores?: Array<{ outlet: string; sales: number }>;
}

interface LivePageProps {
  stores: Store[]; // Legacy prop (may be filtered by dateFilter) - we'll ignore it and load our own
  profile: UserProfile | null;
}

const LivePage: React.FC<LivePageProps> = ({ stores: _legacyStores, profile }) => {
  const { locale, t } = useLocale();
  const { allSalesData } = useData(); // Get preloaded data (independent of dateFilter)
  const [liveData, setLiveData] = useState<LiveSalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'today' | 'yesterday'>('today');
  const [areaManagerFilter, setAreaManagerFilter] = useState<string>('All'); // Local state (independent of global filters)
  
  // Load stores independently from API (2026 only) - NOT affected by dateFilter
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);

  const copy = useMemo(() => {
    if (locale === 'ar') {
      return {
        title: 'المبيعات المباشرة',
        date: 'التاريخ',
        lastUpdate: 'آخر تحديث',
        outlet: 'المعرض',
        sales: 'المبيعات',
        loading: 'جاري التحميل...',
        noData: 'لا توجد بيانات متاحة',
        error: 'حدث خطأ في تحميل البيانات',
        areaManager: 'مدير المنطقة',
        allAreaManagers: 'جميع مديري المناطق',
      };
    }
      return {
        title: 'Live Sales',
        date: 'Date',
        lastUpdate: 'Last Update',
        outlet: 'Outlet',
        sales: 'Sales',
        loading: 'Loading...',
        noData: 'No sales data available',
        error: 'Error loading data',
        areaManager: 'Area Manager',
        allAreaManagers: 'All Area Managers',
      };
  }, [locale]);

  // Load stores independently (2026 only) - NOT affected by dateFilter
  useEffect(() => {
    const loadStoresForLive = async () => {
      try {
        setStoresLoading(true);
        console.log('🔗 Loading stores for Live page (2026 only, independent of dateFilter)...');
        
        // Always load stores for 2026 (current year) regardless of dateFilter
        const currentYear = 2026; // Live page always uses 2026 data
        const storesList = await getStores(currentYear);
        
        if (storesList.length > 0) {
          console.log(`✅ Loaded ${storesList.length} stores for Live page (2026)`);
          setAllStores(storesList as Store[]);
        } else {
          console.warn('⚠️ No stores loaded for Live page');
          setAllStores([]);
        }
        setStoresLoading(false);
      } catch (error: any) {
        console.error('❌ Error loading stores for Live page:', error);
        setAllStores([]);
        setStoresLoading(false);
      }
    };
    
    loadStoresForLive();
  }, []); // Load once on mount, never re-run

  useEffect(() => {
    // Load live sales from D365 API (NO Firestore)
    const loadLiveData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔗 Fetching live sales from D365 API...');
        
        const result = await getLiveSales();
        
        if (result.success !== false && (result.today || result.yesterday)) {
          const data: LiveSalesData = {
            date: result.date || new Date().toISOString().split('T')[0],
            lastUpdate: result.lastUpdate || new Date().toTimeString().slice(0, 5),
            today: result.today || [],
            yesterday: result.yesterday || [],
          };
          setLiveData(data);
          setLoading(false);
          setError(null);
          console.log('✅ Live data loaded successfully from API');
        } else {
          throw new Error(result.error || 'No data in API response');
        }
      } catch (err: any) {
        console.error('❌ Error loading live sales:', err);
        setError(locale === 'ar' ? 'فشل تحميل بيانات المبيعات المباشرة' : 'Failed to load live sales data');
        setLoading(false);
        // Set empty data on error (don't crash)
        setLiveData({
          date: new Date().toISOString().split('T')[0],
          lastUpdate: new Date().toTimeString().slice(0, 5),
          today: [],
          yesterday: [],
        });
      }
    };

    // Load immediately from D365 API
    loadLiveData();

    // Auto-refresh every 15 minutes
    const refreshInterval = setInterval(() => {
      loadLiveData();
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      clearInterval(refreshInterval);
    };
  }, [copy]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '-';
    // timeStr is already a string (HH:MM format) from API
    return timeStr;
  };

  const formatSales = (sales: number) => {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(sales);
  };

  // IMPORTANT: All Hooks (useMemo) must be called BEFORE any early returns
  // Get available area managers (for admin/general_manager only)
  const showAreaManagerFilter = useMemo(() => {
    return profile?.role === 'admin' || profile?.role === 'general_manager';
  }, [profile?.role]);
  
  const availableAreaManagers = useMemo(() => {
    if (!showAreaManagerFilter) return [];
    // Use allStores (loaded independently for 2026) instead of stores prop
    const managers = new Set(allStores.map(s => s.areaManager).filter(Boolean));
    return ['All', ...Array.from(managers).sort()];
  }, [allStores, showAreaManagerFilter]);

  // Support both new format (today/yesterday) and legacy format (stores)
  const todayStores = liveData?.today || liveData?.stores || [];
  const yesterdayStores = liveData?.yesterday || [];
  
  // Filter stores by area manager (using allStores loaded independently for 2026)
  const filteredTodayStores = useMemo(() => {
    if (areaManagerFilter === 'All' || !showAreaManagerFilter) {
      return todayStores;
    }
    // Match outlet names with store names to get areaManager
    // Use allStores (loaded independently for 2026) instead of stores prop
    const storeMap = new Map(allStores.map(s => [s.name, s]));
    return todayStores.filter(item => {
      const store = storeMap.get(item.outlet);
      return store?.areaManager === areaManagerFilter;
    });
  }, [todayStores, areaManagerFilter, allStores, showAreaManagerFilter]);

  const filteredYesterdayStores = useMemo(() => {
    if (areaManagerFilter === 'All' || !showAreaManagerFilter) {
      return yesterdayStores;
    }
    // Use allStores (loaded independently for 2026) instead of stores prop
    const storeMap = new Map(allStores.map(s => [s.name, s]));
    return yesterdayStores.filter(item => {
      const store = storeMap.get(item.outlet);
      return store?.areaManager === areaManagerFilter;
    });
  }, [yesterdayStores, areaManagerFilter, allStores, showAreaManagerFilter]);
  
  // Get current view data
  const currentStores = viewMode === 'today' ? filteredTodayStores : filteredYesterdayStores;
  const totalSales = currentStores.reduce((sum, item) => sum + (item.sales || 0), 0);

  // Early returns AFTER all hooks (useMemo) are called
  if (loading && !liveData) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{copy.loading}</p>
        </div>
      </div>
    );
  }

  if (error && !liveData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <div className="text-center text-red-600">
          <p className="font-semibold">{copy.error}</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{copy.title}</h1>
          
          {/* Area Manager Filter */}
          {showAreaManagerFilter && availableAreaManagers.length > 1 && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <label className="font-semibold text-gray-700">
                {copy.areaManager}:
              </label>
              <select
                value={areaManagerFilter}
                onChange={(e) => setAreaManagerFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {availableAreaManagers.map(manager => (
                  <option key={manager} value={manager}>
                    {manager === 'All' ? copy.allAreaManagers : manager}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* View Mode Toggle */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => setViewMode('today')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                viewMode === 'today'
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {locale === 'ar' ? '📊 اليوم' : '📊 Today'}
            </button>
            <button
              onClick={() => setViewMode('yesterday')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                viewMode === 'yesterday'
                  ? 'bg-gray-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {locale === 'ar' ? '📅 أمس' : '📅 Yesterday'}
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div>
              <span className="font-semibold">{copy.date}:</span>{' '}
              {formatDate(liveData?.date)}
            </div>
            <div>
              <span className="font-semibold">{copy.lastUpdate}:</span>{' '}
              {formatTime(liveData?.lastUpdate)}
            </div>
          </div>
        </div>
      </div>

      {/* Total Card */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg border border-orange-700 p-6 text-white">
        <div className="text-center">
          <div className="text-lg font-medium mb-2 opacity-90">
            {locale === 'ar' 
              ? (viewMode === 'today' ? '📊 إجمالي مبيعات اليوم' : '📅 إجمالي مبيعات أمس')
              : (viewMode === 'today' ? '📊 Total Today\'s Sales' : '📅 Total Yesterday\'s Sales')}
          </div>
          <div className="text-5xl font-bold">
            {formatSales(totalSales)}
          </div>
          <div className="text-sm mt-2 opacity-80">
            {locale === 'ar' ? `${currentStores.length} معرض` : `${currentStores.length} outlets`}
          </div>
        </div>
      </div>

      {/* Sales Grid */}
      {currentStores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">{copy.noData}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {locale === 'ar' 
              ? (viewMode === 'today' ? '📊 مبيعات اليوم' : '📅 مبيعات أمس')
              : (viewMode === 'today' ? '📊 Today\'s Sales' : '📅 Yesterday\'s Sales')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentStores.map((item, index) => (
              <div
                key={`${viewMode}-${index}`}
                className={`rounded-xl shadow-sm border-l-4 p-6 hover:shadow-md transition-all duration-200 ${
                  viewMode === 'today'
                    ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-500'
                    : 'bg-gray-50 border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className={`text-sm font-medium mb-2 truncate ${
                    viewMode === 'today' ? 'text-gray-700' : 'text-gray-600'
                  }`}>
                    {item.outlet}
                  </div>
                  <div className={`text-3xl font-bold ${
                    viewMode === 'today' ? 'text-orange-900' : 'text-gray-800'
                  }`}>
                    {formatSales(item.sales)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
        <p className="text-sm text-blue-700">
          {locale === 'ar' 
            ? '🔄 البيانات تتحدث تلقائياً كل 15 دقيقة'
            : '🔄 Data auto-refreshes every 15 minutes'}
        </p>
      </div>
    </div>
  );
};

export default LivePage;
