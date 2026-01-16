import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/services/firebase';
import firebase from 'firebase/app';
import { useLocale } from '@/context/LocaleContext';

interface LiveSalesData {
  date: firebase.firestore.Timestamp;
  lastUpdate: firebase.firestore.Timestamp;
  stores: Array<{ outlet: string; sales: number }>;
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
    const loadLiveData = async () => {
      try {
        setLoading(true);
        setError(null);

        const doc = await db.collection('liveSales').doc('today').get();
        
        if (doc.exists) {
          const data = doc.data() as LiveSalesData;
          setLiveData(data);
        } else {
          setError(copy.noData);
        }
      } catch (err: any) {
        console.error('Error loading live sales:', err);
        setError(err.message || copy.error);
      } finally {
        setLoading(false);
      }
    };

    // Function to trigger API update (client-side polling)
    const triggerAPIUpdate = async () => {
      try {
        // Call Vercel API endpoint to update live sales
        const response = await fetch('/api/live-sales', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to update live sales');
        }

        // After API call, reload from Firestore
        const doc = await db.collection('liveSales').doc('today').get();
        if (doc.exists) {
          const data = doc.data() as LiveSalesData;
          setLiveData(data);
        }
      } catch (err: any) {
        console.error('Error triggering API update:', err);
      }
    };

    // Load immediately
    loadLiveData();

    // Trigger API update immediately on mount
    triggerAPIUpdate();

    // Set up real-time listener
    const unsubscribe = db.collection('liveSales').doc('today').onSnapshot(
      (doc) => {
        if (doc.exists) {
          const data = doc.data() as LiveSalesData;
          setLiveData(data);
          setLoading(false);
          setError(null);
        } else {
          setError(copy.noData);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Snapshot error:', err);
        setError(err.message || copy.error);
        setLoading(false);
      }
    );

    // Auto-refresh API every 15 minutes (client-side polling)
    const refreshInterval = setInterval(() => {
      triggerAPIUpdate();
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [copy]);

  const formatDate = (timestamp: firebase.firestore.Timestamp | undefined) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timestamp: firebase.firestore.Timestamp | undefined) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
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

  const stores = liveData?.stores || [];

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

      {/* Sales Grid */}
      {stores.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">{copy.noData}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {stores.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border-l-4 border-orange-500 p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="text-center">
                <div className="text-gray-600 text-sm font-medium mb-2 truncate">
                  {item.outlet}
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatSales(item.sales)}
                </div>
              </div>
            </div>
          ))}
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
