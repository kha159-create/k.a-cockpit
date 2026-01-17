import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/services/firebase';
import firebase from 'firebase/app';
import { useLocale } from '@/context/LocaleContext';

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
    // Function to load from API (Local JSON like dailysales)
    const loadLiveDataFromAPI = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get Vercel API URL - always use full URL for Vercel API
        // Default to Vercel URL, use environment variable if available
        let apiUrl = 'https://k-a-cockpit.vercel.app/api/live-sales';
        
        // @ts-ignore - Vite environment variables
        const vercelApiUrl = import.meta.env.VITE_VERCEL_API_URL;
        if (vercelApiUrl) {
          let vercelUrl = String(vercelApiUrl).trim();
          if (!vercelUrl.startsWith('http://') && !vercelUrl.startsWith('https://')) {
            vercelUrl = `https://${vercelUrl}`;
          }
          vercelUrl = vercelUrl.replace(/\/$/, '');
          apiUrl = `${vercelUrl}/api/live-sales`;
        }
        
        console.log('🔗 Fetching from API URL:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch live sales');
        }

        const result = await response.json();
        
        console.log('📊 API Response:', result);
        
        // Check if API returned data (even if success is false, we can still try to use the data)
        if (result.today || result.yesterday) {
          // Convert API response to LiveSalesData format
          const data: LiveSalesData = {
            date: result.date || new Date().toISOString().split('T')[0],
            lastUpdate: result.lastUpdate || new Date().toTimeString().slice(0, 5),
            today: result.today || [],
            yesterday: result.yesterday || [],
          };
          setLiveData(data);
          setLoading(false);
          setError(null);
          console.log('✅ Live data loaded successfully:', data);
        } else if (result.success === false && result.error) {
          // API returned explicit error
          throw new Error(result.error);
        } else {
          // No data and no explicit error - try Firestore fallback
          console.warn('⚠️ API returned no data, trying Firestore fallback');
          throw new Error('No data in API response');
        }
      } catch (err: any) {
        console.error('❌ Error loading live sales from API:', err);
        console.log('🔄 Falling back to Firestore...');
        // Fallback to Firestore if API fails (for backward compatibility)
        loadLiveDataFromFirestore();
      }
    };

    // Fallback: Load from Firestore (for historical data or if API fails)
    const loadLiveDataFromFirestore = async () => {
      try {
        console.log('📦 Loading from Firestore...');
        const doc = await db.collection('liveSales').doc('today').get();
        
        if (doc.exists) {
          const firestoreData = doc.data() as any;
          console.log('📦 Firestore data found:', firestoreData);
          // Convert Firestore format to LiveSalesData format
          const data: LiveSalesData = {
            date: firestoreData.date?.toDate?.()?.toISOString()?.split('T')[0] || new Date().toISOString().split('T')[0],
            lastUpdate: firestoreData.lastUpdateTime || firestoreData.lastUpdate?.toDate?.()?.toTimeString()?.slice(0, 5) || new Date().toTimeString().slice(0, 5),
            today: firestoreData.today || firestoreData.stores || [],
            yesterday: firestoreData.yesterday || [],
          };
          setLiveData(data);
          setLoading(false);
          setError(null);
          console.log('✅ Firestore data loaded successfully:', data);
        } else {
          console.warn('⚠️ No data in Firestore either');
          setError(copy.noData);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('❌ Error loading live sales from Firestore:', err);
        setError(err.message || copy.error);
        setLoading(false);
      }
    };

    // Load immediately from API (Local JSON like dailysales)
    loadLiveDataFromAPI();

    // Auto-refresh API every 15 minutes (client-side polling)
    const refreshInterval = setInterval(() => {
      loadLiveDataFromAPI();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{copy.title}</h1>
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

      {/* Today Sales Grid */}
      {todayStores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">{copy.noData}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {locale === 'ar' ? '📊 مبيعات اليوم' : '📊 Today\'s Sales'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {todayStores.map((item, index) => (
                <div
                  key={`today-${index}`}
                  className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-sm border-l-4 border-orange-500 p-6 hover:shadow-md transition-all duration-200"
                >
                  <div className="text-center">
                    <div className="text-gray-700 text-sm font-medium mb-2 truncate">
                      {item.outlet}
                    </div>
                    <div className="text-3xl font-bold text-orange-900">
                      {formatSales(item.sales)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Yesterday Sales Grid (if available) */}
          {yesterdayStores.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {locale === 'ar' ? '📅 مبيعات أمس' : '📅 Yesterday\'s Sales'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {yesterdayStores.map((item, index) => (
                  <div
                    key={`yesterday-${index}`}
                    className="bg-gray-50 rounded-xl shadow-sm border-l-4 border-gray-400 p-6 hover:shadow-md transition-all duration-200"
                  >
                    <div className="text-center">
                      <div className="text-gray-600 text-sm font-medium mb-2 truncate">
                        {item.outlet}
                      </div>
                      <div className="text-3xl font-bold text-gray-800">
                        {formatSales(item.sales)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
