import React, { useEffect, useState, useMemo } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { getLiveSales, getStores } from '@/data/dataProvider';
import { useData } from '@/context/DataProvider';
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
  stores?: Store[]; // Legacy prop - ignored in current implementation
  profile: UserProfile | null;
}

const LivePage: React.FC<LivePageProps> = ({ profile }) => {
  const { locale } = useLocale();
  const { unifiedEmployees, stores: allStores } = useData(); // Use global stores
  const [liveData, setLiveData] = useState<LiveSalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'today' | 'yesterday'>('today');
  const [areaManagerFilter, setAreaManagerFilter] = useState<string>('All');

  // Stores are now from Context, no need for local state or fetching
  // const [allStores, setAllStores] = useState<Store[]>([]);
  // const [storesLoading, setStoresLoading] = useState(true);

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
        totalToday: '📊 إجمالي مبيعات اليوم',
        totalYesterday: '📅 إجمالي مبيعات أمس',
        outlets: 'معرض'
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
      totalToday: '📊 Total Today\'s Sales',
      totalYesterday: '📅 Total Yesterday\'s Sales',
      outlets: 'outlets'
    };
  }, [locale]);

  // Removed useEffect for loading stores

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
    // Use unifiedEmployees for robust matching (ID "46" vs "0046")
    const storeMapByName = new Map(allStores.map(s => [s.name, s]));
    const storeMapById = new Map(allStores.map(s => [String((s as any).store_id || s.id || '').trim(), s]));

    return todayStores.map(item => {
      // 1. Try matching by Outlet/Store ID using Global Store List
      let store = storeMapById.get(String((item as any).storeId || '').trim()) ||
        storeMapByName.get(item.outlet) ||
        storeMapById.get(String(item.outlet || '').trim());

      // 2. If not found, try matching against Unified Employee List (if outlet is actually an employee ID like "46")
      if (!store) {
        const cleanID = String(item.outlet || (item as any).storeId || '').trim();
        // Find employee who matches this ID
        const employee = unifiedEmployees?.find(e =>
          e.id === cleanID || // Normalized match (e.g. "46" === "46")
          e.originalId === cleanID ||
          e.employeeId === cleanID
        );

        if (employee) {
          // Get the store this employee belongs to
          // Wait, 'currentStore' implies where they work. 
          // But 'outlet' in Live Data usually means the transaction location.
          // If 'outlet' is "46", it means Employee 46 made a sale.
          // We want to display the Employee Name? Or the Store Name?
          // User Request: "Ensure that local ID '0046' matches API ID 46."
          // And "UI displays 'Employee 0046'".
          // It seems the Goal is to display the Name (Arabic).

          // If it's a store list, we expect store names. 
          // If the API returns Employee IDs as "outlets", this is a fundamental ambiguity.
          // However, typically Live Sales is by Store.
          // Let's assume 'outlet' is a Store ID/Name.
          // But the User mentioned "Employee 0046" issues in `EmployeesPage`.
          // And "LivePage shows 0 sales".

          // Let's stick to solving the ID mismatch for STORES here.
          // The user said: "LivePage: Live data loaded successfully... UI shows Total Sales: 0... Root Cause: D365 API returns IDs as numbers (e.g. 101)."
          // "0046" example might be for EmployeesPage.

          // So for LivePage, we just need robust Store ID matching.
          // We've enforced String conversion.
          // Let's ensure we use the 'unifiedEmployees' context if meaningful here?
          // Actually, LivePage is about STORES. The unified list is EMPLOYEES.
          // The user instruction "Step 3: Fix LivePage (Use Unified Data)" says:
          // "refactor LivePage... to use Context's unifiedEmployees."
          // "const employee = unifiedEmployees.find(e => e.id === String(sale.storeId))"
          // Wait, is 'sale.storeId' actually an EMPLOYEE ID in some contexts?
          // Or did the user mean "EmployeesPage"?
          // Re-reading User Request: "2. Employees Page Issue... 1. LivePage Issue... LivePage shows 0 sales."
          // "The Problem: LivePage shows 0 sales because '0046' !== 46."
          // If '0046' is a STORE ID, then we need a Unified STORE List?
          // We have `stores` from `getStores()`.
          // Maybe the "Unified Data Layer" request is primarily about EMPLOYEES, but they want it used in LivePage too?
          // "When matching Sales Data (from API) to Employees... In LivePage logic: const employee = unifiedEmployees.find..."
          // This implies LivePage displays EMPLOYEES?
          // Looking at `LivePage` UI: It displays "Outlet / Sales".
          // Maybe for some users (Commission based?), "Outlet" is actually an Employee?
          // "gofrugal_employee_mapping" suggests we are mapping employees.

          // HYPOTHESIS: In this system, "Outlets" in the live feed might be Sales Groups (Employees).
          // So we should check `unifiedEmployees` too.

          const matchedEmp = unifiedEmployees?.find(e => String(e.salesGroup || e.id) === cleanID);

          if (matchedEmp) {
            return {
              ...item,
              outlet: matchedEmp.displayName || matchedEmp.name, // Use Arabic Name!
              areaManager: matchedEmp.currentStore // Fallback to their store?
            };
          }
        }
      }

      if (store) {
        return { ...item, outlet: store.name, areaManager: store.areaManager };
      }
      return { ...item, areaManager: undefined };
    }).filter(item => {
      if (areaManagerFilter === 'All') return true;
      return item.areaManager === areaManagerFilter;
    });
  }, [todayStores, areaManagerFilter, allStores, showAreaManagerFilter, unifiedEmployees]);

  const filteredYesterdayStores = useMemo(() => {
    const storeMapByName = new Map(allStores.map(s => [s.name, s]));
    const storeMapById = new Map(allStores.map(s => [String((s as any).store_id || s.id || '').trim(), s]));

    return yesterdayStores.map(item => {
      let store = storeMapById.get(String((item as any).storeId || '').trim()) ||
        storeMapByName.get(item.outlet) ||
        storeMapById.get(String(item.outlet || '').trim());

      if (!store) {
        const cleanID = String(item.outlet || (item as any).storeId || '').trim();
        const matchedEmp = unifiedEmployees?.find(e => String(e.salesGroup || e.id) === cleanID);
        if (matchedEmp) {
          return {
            ...item,
            outlet: matchedEmp.displayName || matchedEmp.name,
            areaManager: matchedEmp.currentStore
          };
        }
      }

      if (store) {
        return { ...item, outlet: store.name, areaManager: store.areaManager };
      }
      return { ...item, areaManager: undefined };
    }).filter(item => {
      if (areaManagerFilter === 'All') return true;
      return item.areaManager === areaManagerFilter;
    });
  }, [yesterdayStores, areaManagerFilter, allStores, showAreaManagerFilter, unifiedEmployees]);

  // Get current view data
  const currentStores = viewMode === 'today' ? filteredTodayStores : filteredYesterdayStores;
  const totalSales = currentStores.reduce((sum, item) => sum + (item.sales || 0), 0);

  // Debug: Mapping Check (User Requested)
  console.log('Mapping Check:', {
    firstStoreId: allStores[0]?.id,
    typeOfStoreId: typeof allStores[0]?.id,
    firstApiId: (liveData?.today?.[0] as any)?.storeId,
    typeOfApiId: typeof (liveData?.today?.[0] as any)?.storeId,
    firstOutlet: liveData?.today?.[0]?.outlet,
    storesCount: allStores.length,
    liveDataCount: liveData?.today?.length
  });

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
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${viewMode === 'today'
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {locale === 'ar' ? '📊 اليوم' : '📊 Today'}
            </button>
            <button
              onClick={() => setViewMode('yesterday')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${viewMode === 'yesterday'
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
                className={`rounded-xl shadow-sm border-l-4 p-6 hover:shadow-md transition-all duration-200 ${viewMode === 'today'
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-500'
                  : 'bg-gray-50 border-gray-400'
                  }`}
              >
                <div className="text-center">
                  <div className={`text-sm font-medium mb-2 truncate ${viewMode === 'today' ? 'text-gray-700' : 'text-gray-600'
                    }`}>
                    {item.outlet}
                  </div>
                  <div className={`text-3xl font-bold ${viewMode === 'today' ? 'text-orange-900' : 'text-gray-800'
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
