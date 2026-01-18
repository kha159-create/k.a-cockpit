import React, { useEffect, useState, useMemo } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { getLiveSales } from '@/data/dataProvider';
import { apiUrl } from '@/utils/apiBase';

interface LiveSalesData {
  date: string; // YYYY-MM-DD (from JSON) or firebase.firestore.Timestamp (from Firestore)
  lastUpdate: string; // HH:MM format (from JSON) or firebase.firestore.Timestamp (from Firestore)
  today: Array<{ outlet: string; sales: number }>;
  yesterday: Array<{ outlet: string; sales: number }>;
  // Legacy support - fallback to old format
  stores?: Array<{ outlet: string; sales: number }>;
}

const LivePage: React.FC = () => {
  const { locale } = useLocale();
  const [liveData, setLiveData] = useState<LiveSalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'today' | 'yesterday'>('today');

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
    };
  }, [locale]);

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

  const formatDate = (dateStr: string | firebase.firestore.Timestamp | undefined) => {
    if (!dateStr) return '-';
    let date: Date;
    if (typeof dateStr === 'string') {
      date = new Date(dateStr);
    } else {
      date = dateStr.toDate();
    }
    return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr: string | firebase.firestore.Timestamp | undefined) => {
    if (!timeStr) return '-';
    // If it's already a string (HH:MM format), return it
    if (typeof timeStr === 'string') {
      return timeStr;
    }
    // If it's a Firestore Timestamp, format it
    const date = timeStr.toDate();
    return date.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatSales = (sales: number) => {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(sales);
  };

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

  // Support both new format (today/yesterday) and legacy format (stores)
  const todayStores = liveData?.today || liveData?.stores || [];
  const yesterdayStores = liveData?.yesterday || [];
  
  // Get current view data
  const currentStores = viewMode === 'today' ? todayStores : yesterdayStores;
  const totalSales = currentStores.reduce((sum, item) => sum + (item.sales || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{copy.title}</h1>
          
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
