
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db } from '@/services/firebase';
// FIX: Import firebase to use Timestamp and FieldValue for Firestore operations.
import firebase from 'firebase/app';

import { useDataProcessing } from '@/hooks/useDataProcessing';
import { useSmartUploader } from '@/hooks/useSmartUploader';
import { useLocale } from '@/context/LocaleContext';

import Dashboard from '@/pages/Dashboard';
import StoresPage from '@/pages/StoresPage';
import EmployeesPage from '@/pages/EmployeesPage';
import ProductsPage from '@/pages/ProductsPage';
import CommissionsPage from '@/pages/CommissionsPage';
import SmartUploaderPage from '@/pages/SmartUploaderPage';
import LFLPage from '@/pages/LFLPage';
import LivePage from '@/pages/LivePage';
import SettingsPage from '@/pages/SettingsPage';
import StoreDetailPage from '@/pages/StoreDetailPage';
import AreaDetailPage from '@/pages/AreaDetailPage';
// import NaturalLanguageSearch from '@/components/NaturalLanguageSearch';
import PendingApprovalPage from '@/pages/PendingApprovalPage';
import PendingApprovalsPage from '@/pages/PendingApprovalsPage';
import RolesManagementPage from '@/pages/RolesManagementPage';


import { 
    // FIX: Imported VisitorsModal to resolve missing component error.
    VisitorsModal, EmployeeModal, StoreModal, DailyMetricModal, MonthlyStoreMetricModal, UserEditModal,
    AiCoachingModal, SalesForecastModal, SalesPitchModal, AppMessageModal,
    NaturalLanguageSearchModal, AiComparisonModal, AiPredictionModal, KPIBreakdownModal,
    TaskModal, ProductDetailsModal
} from '@/components/Modals';

import type { User, UserProfile, Store, Employee, DailyMetric, SalesTransaction, ModalState, DateFilter, AreaStoreFilterState, AppMessage, StoreSummary, BusinessRule, UserRole, Notification, Task } from '@/types';

import {
  HomeIcon, OfficeBuildingIcon, UserGroupIcon, CubeIcon,
  UploadIcon, ChartBarIcon, CalculatorIcon, CogIcon,
  MenuIcon, LogoutIcon, SunIcon, MoonIcon, GlobeIcon, ChevronDownIcon, BellIcon
} from '@/components/Icons';

// Live icon component
const LiveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

// FIX: Initialized Timestamp for use in Firestore operations.
const { Timestamp } = firebase.firestore;

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  name: string;
  activeTab: string;
  setActiveTab: (name: string) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, name, activeTab, setActiveTab, setIsSidebarOpen }) => {
  const isActive = activeTab === name;
  const handleClick = () => {
    setActiveTab(name);
    setIsSidebarOpen(false);
  };
  return (
    <li onClick={handleClick} className={`group relative flex items-center p-3 rounded-xl cursor-pointer transition-all duration-300 ${isActive ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-lg' : 'text-neutral-600 hover:bg-orange-50 hover:text-orange-600 hover:shadow-md'}`}>
      {/* المحتوى */}
      <div className="relative z-10 flex items-center w-full">
        <div className={`p-2 rounded-lg transition-all duration-200 flex-shrink-0 ${isActive ? 'bg-white/20' : 'bg-neutral-100 group-hover:bg-orange-100'}`}>
          {icon}
        </div>
        <span className="ms-3 font-medium text-sm whitespace-nowrap">{label}</span>
      </div>
      
      {/* مؤشر النشاط */}
      {isActive && (
        <div className="absolute right-3 w-2 h-2 bg-white rounded-full shadow-sm" />
      )}
    </li>
  );
};

const NotificationBell: React.FC<{
    notifications: Notification[];
    onNotificationClick: (id: string) => void;
}> = ({ notifications, onNotificationClick }) => {
    const { t } = useLocale();
    const [isOpen, setIsOpen] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="relative p-2 text-zinc-600 hover:bg-gray-100 rounded-full">
                <BellIcon />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
                )}
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 end-0 w-80 bg-white rounded-lg shadow-xl border z-10" onMouseLeave={() => setIsOpen(false)}>
                    <div className="p-3 font-semibold text-sm border-b">{t('notifications')}</div>
                    {notifications.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500">{t('no_notifications')}</p>
                    ) : (
                        <ul className="max-h-80 overflow-y-auto">
                            {notifications.map(n => (
                                <li key={n.id} onClick={() => onNotificationClick(n.id)} className={`p-3 text-sm border-b hover:bg-gray-50 cursor-pointer ${!n.read ? 'bg-blue-50' : ''}`}>
                                    <p className="font-semibold">{t('new_user_registered')}</p>
                                    <p className="text-gray-600">{t('user_awaits_approval', { name: n.userName })}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};


const UserMenu: React.FC<{ user: User; profile: UserProfile | null; onLogout: () => void; }> = ({ user, profile, onLogout }) => {
    const { t } = useLocale();
    const [isOpen, setIsOpen] = useState(false);
    const [timeDetails, setTimeDetails] = useState({ greeting: '', Icon: SunIcon });

    useEffect(() => {
        const hour = new Date().getHours();
        const greetingKey = (hour >= 4 && hour < 12) ? 'greeting_morning' : 'greeting_evening';
        setTimeDetails({
            greeting: t(greetingKey),
            Icon: (hour >= 4 && hour < 12) ? SunIcon : MoonIcon
        });
    }, [t]);

    const userName = useMemo(() => {
        if (profile?.name) return profile.name;
        if (user.displayName) return user.displayName;
        if (!user.email) return 'User';
        const namePart = user.email.split('@')[0];
        return namePart?.charAt(0)?.toUpperCase() + namePart?.slice(1) || 'User';
    }, [user, profile]);

    // Language toggle moved to header; removed from user menu

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-sm text-zinc-700 font-medium greeting-fade-in p-2 rounded-lg hover:bg-gray-100">
                <timeDetails.Icon />
                <span>{timeDetails.greeting}, {userName}</span>
                <ChevronDownIcon />
            </button>
            {isOpen && (
                <div
                    className="absolute top-full mt-2 end-0 w-48 bg-white rounded-lg shadow-xl border z-10"
                    onMouseLeave={() => setIsOpen(false)}
                 >
                    <ul className="p-2 text-sm text-gray-700">
                         <li>
                            <button onClick={onLogout} className="w-full text-start flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 text-red-600">
                                <LogoutIcon /> {t('logout')}
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};


interface MainLayoutProps {
  user: User;
  profile: UserProfile | null;
}

const MainLayout: React.FC<MainLayoutProps> = ({ user, profile }) => {
  const { t, locale, setLocale } = useLocale();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data states
  const [stores, setStores] = useState<Store[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [kingDuvetSales, setKingDuvetSales] = useState<SalesTransaction[]>([]);
  const [salesTransactions, setSalesTransactions] = useState<SalesTransaction[]>([]);
  const [businessRules, setBusinessRules] = useState<BusinessRule[]>([]);
  const [allUsers, setAllUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filter States: default to current year and current month
  const [dateFilter, setDateFilter] = useState<DateFilter>({ year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' });
  const [areaStoreFilter, setAreaStoreFilter] = useState<AreaStoreFilterState>({
      areaManager: profile?.role === 'area_manager' || profile?.role === 'store_manager' ? profile.areaManager || 'All' : 'All',
      store: profile?.role === 'store_manager' || profile?.role === 'employee' ? profile.store || 'All' : 'All',
  });
  const [dashboardPieFilter, setDashboardPieFilter] = useState<string | null>(null);

  // UI State
  const [modalState, setModalState] = useState<ModalState>({ type: null, data: null });
  const [appMessage, setAppMessage] = useState<AppMessage>({ isOpen: false, text: '', type: 'alert' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreSummary | null>(null);
  const [selectedArea, setSelectedArea] = useState<{ managerName: string; stores: StoreSummary[] } | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile) return;
    const collectionsToWatch: { [key: string]: React.Dispatch<React.SetStateAction<any>> } = {
        stores: setStores,
        employees: setEmployees,
        // dailyMetrics: handled separately (Firestore + API merge)
        kingDuvetSales: setKingDuvetSales,
        salesTransactions: setSalesTransactions,
        businessRules: setBusinessRules,
    };

    if (profile?.role === 'admin' || profile?.role === 'general_manager') {
        collectionsToWatch.users = setAllUsers;
    }

    const collectionKeys = Object.keys(collectionsToWatch);
    let loadedCount = 0;

    const unsubscribers = Object.entries(collectionsToWatch).map(([name, setter]) =>
        db.collection(name).onSnapshot(
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
                setter(data);
                if (unsubscribers.length > 0 && loadedCount < collectionKeys.length) {
                    loadedCount++;
                    if (loadedCount === collectionKeys.length) {
                        setDataLoading(false);
                    }
                }
            },
            (err) => {
                console.error(`Error fetching ${name}:`, err);
                if (unsubscribers.length > 0 && loadedCount < collectionKeys.length) {
                    loadedCount++;
                    if (loadedCount === collectionKeys.length) {
                        setDataLoading(false);
                    }
                }
            }
        )
    );

    // Separate listener for dailyMetrics (only for < 2026 data from Firestore)
    const dailyMetricsUnsubscriber = db.collection('dailyMetrics').onSnapshot(
        (snapshot) => {
            const firestoreMetrics = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((m: any) => {
                    // Only include data from before 2026 (old system)
                    if (!m.date || typeof m.date.toDate !== 'function') return true; // Include if date is invalid
                    const metricDate = m.date.toDate();
                    return metricDate.getFullYear() < 2026;
                }) as DailyMetric[];
            
            // Merge with API metrics (2026+) from separate state
            setDailyMetrics(prevMetrics => {
                const apiMetrics = prevMetrics.filter(m => {
                    if (!m.date || typeof m.date.toDate !== 'function') return false;
                    const metricDate = m.date.toDate();
                    return metricDate.getFullYear() >= 2026;
                });
                return [...firestoreMetrics, ...apiMetrics];
            });
            
            if (unsubscribers.length > 0 && loadedCount < collectionKeys.length) {
                loadedCount++;
                if (loadedCount === collectionKeys.length) {
                    setDataLoading(false);
                }
            }
        },
        (err) => {
            console.error('Error fetching dailyMetrics:', err);
            if (unsubscribers.length > 0 && loadedCount < collectionKeys.length) {
                loadedCount++;
                if (loadedCount === collectionKeys.length) {
                    setDataLoading(false);
                }
            }
        }
    );
    
    // Add dailyMetrics unsubscriber to cleanup
    unsubscribers.push(dailyMetricsUnsubscriber);
    
    let tasksUnsubscriber: () => void = () => {};
    if (profile?.employeeId) {
        const q = db.collection('tasks').where('recipientId', '==', profile.employeeId).orderBy('createdAt', 'desc');
        tasksUnsubscriber = q.onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
            setTasks(data);
        }, err => {
            console.error("Error fetching tasks:", err);
        });
    }

    return () => {
        unsubscribers.forEach(unsub => unsub());
        tasksUnsubscriber();
    };
}, [profile]);

  // Fetch metrics from API for 2026+ (new system, like orange-dashboard)
  useEffect(() => {
    if (!profile) return;
    
    const year = typeof dateFilter.year === 'number' ? dateFilter.year : new Date().getFullYear();
    const month = typeof dateFilter.month === 'number' ? dateFilter.month : new Date().getMonth();
    
    // Only fetch from API if year >= 2026
    if (year < 2026) {
      return;
    }

    const fetchMetricsFromAPI = async () => {
      try {
        const vercelUrl = import.meta.env.VITE_VERCEL_API_URL || 'https://k-a-cockpit.vercel.app';
        const apiUrl = `${vercelUrl}/api/get-metrics?year=${year}&month=${month}`;
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success && Array.isArray(result.metrics)) {
          // Convert ISO date strings to Firestore Timestamps
          const apiMetrics: DailyMetric[] = result.metrics.map((m: any) => ({
            id: `${m.date}_${m.store}`,
            date: firebase.firestore.Timestamp.fromDate(new Date(m.date)),
            store: m.store,
            totalSales: m.totalSales,
            transactionCount: m.transactionCount,
            employee: m.employee,
            employeeId: m.employeeId,
          }));
          
          // Merge with Firestore metrics (keep old data, replace new data)
          setDailyMetrics(prevMetrics => {
            const oldMetrics = prevMetrics.filter(m => {
              if (!m.date || typeof m.date.toDate !== 'function') return true;
              const metricDate = m.date.toDate();
              return metricDate.getFullYear() < 2026;
            });
            return [...oldMetrics, ...apiMetrics];
          });
        }
      } catch (error: any) {
        console.error('Error fetching metrics from API:', error);
      }
    };

    fetchMetricsFromAPI();
  }, [profile, dateFilter.year, dateFilter.month]);


useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'general_manager') {
      return;
    }
    
    const q = db.collection('users').where('status', '==', 'pending');
    const unsub = q.onSnapshot(snapshot => {
        const newNotifications: Notification[] = [];
        const pendingUserIds = new Set<string>();
        snapshot.forEach(doc => {
            const user = doc.data() as UserProfile;
            pendingUserIds.add(user.id);
            const exists = notifications.some(n => n.id === user.id);
            if (!exists) {
                newNotifications.push({
                    id: user.id,
                    userName: user.name,
                    message: `New user "${user.name}" is awaiting approval.`,
                    type: 'newUser',
                    timestamp: Timestamp.now(),
                    read: false,
                });
            }
        });
        
        setNotifications(prev => 
            [...newNotifications, ...prev.filter(p => pendingUserIds.has(p.id))]
            .sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis())
        );
      });

    return () => unsub();
}, [profile, notifications]); 

const handleNotificationClick = (notificationId: string) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    setActiveTab('pendingApprovals');
};


  const effectiveAreaStoreFilter = useMemo(() => {
    if (dashboardPieFilter) {
      const store = stores.find(s => s.name === dashboardPieFilter);
      return {
        areaManager: store?.areaManager || 'All',
        store: dashboardPieFilter,
      };
    }
    return areaStoreFilter;
  }, [dashboardPieFilter, areaStoreFilter, stores]);

  const processedData = useDataProcessing({
    stores,
    employees,
    dailyMetrics,
    kingDuvetSales,
    salesTransactions,
    dateFilter,
    areaStoreFilter: effectiveAreaStoreFilter,
    profile,
  });

  const allDateData = useMemo(() => [...dailyMetrics, ...salesTransactions, ...kingDuvetSales], [dailyMetrics, salesTransactions, kingDuvetSales]);
  
  const { handleSmartUpload, uploadResult, clearUploadResult } = useSmartUploader(db, setAppMessage, setIsProcessing, employees, stores);

  const runWithRecalculation = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setIsRecalculating(true);
    setter(value);
    setTimeout(() => setIsRecalculating(false), 50);
  }, []);

  // --- CRUD and Action Handlers ---
    const handleSave = async (collectionName: 'stores' | 'employees', data: any) => {
        const isNew = !data.id;
        if (isNew && profile?.role !== 'admin') {
            setAppMessage({ isOpen: true, text: 'You do not have permission to add new items.', type: 'alert' });
            return;
        }

        if (collectionName === 'employees' && profile?.role !== 'admin' && profile?.role !== 'area_manager') {
            setAppMessage({ isOpen: true, text: 'You do not have permission to modify employees.', type: 'alert' });
            return;
        }

        if (collectionName === 'stores' && profile?.role !== 'admin' && profile?.role !== 'general_manager') {
            setAppMessage({ isOpen: true, text: 'You do not have permission to modify stores.', type: 'alert' });
            return;
        }

        setIsProcessing(true);
        try {
            const docId = data.id || data.name.replace(/\s+/g, '_');
            const docRef = db.collection(collectionName).doc(docId);
            
            const dataToSave: Partial<Store | Employee> = { name: data.name };
            if ('store' in data) (dataToSave as Employee).currentStore = data.store;
            if ('areaManager' in data) (dataToSave as Store).areaManager = data.areaManager;

            await docRef.set(dataToSave, { merge: true });

            if (data.targetUpdate) {
                const { year, month, salesTarget, duvetTarget } = data.targetUpdate;
                const updatePayload: any = {};
                if (salesTarget !== undefined) updatePayload[`targets.${year}.${month}`] = salesTarget;
                if (duvetTarget !== undefined) updatePayload[`duvetTargets.${year}.${month}`] = duvetTarget;
                
                if (Object.keys(updatePayload).length > 0) {
                    await docRef.update(updatePayload);
                }
            }
            setAppMessage({ isOpen: true, text: t('save_success', { item: t(collectionName.slice(0, -1)) }), type: 'alert' });
        } catch (error: any) { 
            setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' }); 
        } finally { 
            setIsProcessing(false); 
            setModalState({ type: null }); 
        }
    };

    const handleDelete = (collectionName: 'stores' | 'employees' | 'businessRules', id: string, name: string) => {
        if (profile?.role !== 'admin') {
            setAppMessage({ isOpen: true, text: 'You do not have permission to delete items.', type: 'alert' });
            return;
        }
        setAppMessage({
            isOpen: true, text: t('confirm_delete', { name }), type: 'confirm', onConfirm: async () => {
                setIsProcessing(true);
                try {
                    await db.collection(collectionName).doc(id).delete();
                    setAppMessage({ isOpen: true, text: t('delete_success', { name }), type: 'alert' });
                } catch (error: any) { setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' }); }
                finally { setIsProcessing(false); }
            }
        });
    };
    
    const handleDailyMetricSave = async (metricData: any) => {
        setIsProcessing(true);
        try {
            const dateObject = new Date(metricData.date as any);
            const firestoreTimestamp = Timestamp.fromDate(dateObject);

            await db.collection('dailyMetrics').add({ ...metricData, date: firestoreTimestamp });
            setAppMessage({ isOpen: true, text: t('daily_metric_success'), type: 'alert' });
        } catch (error: any) { setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' }); }
        finally { setIsProcessing(false); setModalState({ type: null }); }
    };

    // FIX: Added missing handleVisitorsSave function to handle visitor data entry.
    const handleVisitorsSave = async (data: { date: string; store: string; visitors: number }) => {
        setIsProcessing(true);
        try {
            const { date, store, visitors } = data;
            const firestoreTimestamp = Timestamp.fromDate(new Date(date));
            const docId = `${date}_${store.replace(/\s+/g, '-')}`;
            const metricRef = db.collection('dailyMetrics').doc(docId);

            await metricRef.set({
                date: firestoreTimestamp,
                store,
                visitors
            }, { merge: true });

            setAppMessage({ isOpen: true, text: t('add_visitors_success'), type: 'alert' });
        } catch (error: any) {
            setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' });
        } finally {
            setIsProcessing(false);
            setModalState({ type: null });
        }
    };

    const handleMonthlyMetricSave = async (metricData: any) => {
        setIsProcessing(true);
        try {
            const { year, month, store, totalSales, visitors, transactionCount, atv, visitorRate } = metricData;
            const lastDayOfMonth = new Date(year, month, 0).getDate();
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
            
            const dateObject = new Date(dateStr);
            const firestoreTimestamp = Timestamp.fromDate(dateObject);

            await db.collection('dailyMetrics').add({ date: firestoreTimestamp, store, totalSales, visitors, transactionCount, atv, visitorRate, isMonthlySummary: true });
            setAppMessage({ isOpen: true, text: t('monthly_metric_success'), type: 'alert' });
        } catch (error: any) {
            setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' });
        } finally {
            setIsProcessing(false);
            setModalState({ type: null });
        }
    };
    
    const handleDeleteAllData = () => {
        setAppMessage({
            isOpen: true,
            text: t('confirm_delete_all'),
            type: 'confirm',
            onConfirm: async () => {
                setIsProcessing(true);
                const collectionsToDelete = ['dailyMetrics', 'kingDuvetSales', 'salesTransactions', 'employees', 'stores', 'businessRules'];
                try {
                    for (const name of collectionsToDelete) {
                        const querySnapshot = await db.collection(name).get();
                        const batch = db.batch();
                        querySnapshot.docs.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                    }
                    setAppMessage({ isOpen: true, text: t('delete_all_success'), type: 'alert' });
                } catch (error: any) {
                    setAppMessage({ isOpen: true, text: `${t('error_deleting_data')}: ${error.message}`, type: 'alert' });
                } finally {
                    setIsProcessing(false);
                }
            }
        });
    };

    // FIX: Added missing handleSelectiveDelete function for targeted data removal.
    const handleSelectiveDelete = async (dataType: 'visitors' | 'sales' | 'products', year: number, month: number) => {
        const monthName = new Date(year, month).toLocaleString(locale, { month: 'long' });
        const confirmationKey = dataType === 'visitors' ? 'confirm_delete_visitors_data' : (dataType === 'sales' ? 'confirm_delete_sales_data' : 'confirm_delete_products_data');
        const confirmationText = t(confirmationKey, { month: monthName, year: year.toString() });
    
        setAppMessage({
            isOpen: true,
            text: confirmationText,
            type: 'confirm',
            onConfirm: async () => {
                setIsProcessing(true);
                try {
                    const startDate = Timestamp.fromDate(new Date(year, month, 1));
                    const endDate = Timestamp.fromDate(new Date(year, month + 1, 0, 23, 59, 59));
                    const batch = db.batch();
    
                    if (dataType === 'visitors') {
                        const metricsQuery = db.collection('dailyMetrics').where('date', '>=', startDate).where('date', '<=', endDate);
                        const metricsSnapshot = await metricsQuery.get();
                        metricsSnapshot.forEach(doc => {
                            batch.update(doc.ref, { visitors: firebase.firestore.FieldValue.delete() });
                        });
                    } else if (dataType === 'sales') {
                        // 1. Update dailyMetrics
                        const metricsQuery = db.collection('dailyMetrics').where('date', '>=', startDate).where('date', '<=', endDate);
                        const metricsSnapshot = await metricsQuery.get();
                        metricsSnapshot.forEach(doc => {
                            batch.update(doc.ref, { 
                                totalSales: firebase.firestore.FieldValue.delete(), 
                                transactionCount: firebase.firestore.FieldValue.delete(),
                                employee: firebase.firestore.FieldValue.delete(),
                                employeeId: firebase.firestore.FieldValue.delete()
                            });
                        });
    
                        // 2. Delete salesTransactions
                        const salesQuery = db.collection('salesTransactions').where('Bill Dt.', '>=', startDate).where('Bill Dt.', '<=', endDate);
                        const salesSnapshot = await salesQuery.get();
                        salesSnapshot.forEach(doc => batch.delete(doc.ref));
    
                        // 3. Delete kingDuvetSales
                        const duvetQuery = db.collection('kingDuvetSales').where('Bill Dt.', '>=', startDate).where('Bill Dt.', '<=', endDate);
                        const duvetSnapshot = await duvetQuery.get();
                        duvetSnapshot.forEach(doc => batch.delete(doc.ref));
                    } else if (dataType === 'products') {
                        const startDate = Timestamp.fromDate(new Date(year, month, 1));
                        const endDate = Timestamp.fromDate(new Date(year, month + 1, 0, 23, 59, 59));

                        const deleteInChunks = async (collectionName: string) => {
                            const snap = await db.collection(collectionName)
                                .where('Bill Dt.', '>=', startDate)
                                .where('Bill Dt.', '<=', endDate)
                                .get();
                            console.log(`[SelectiveDelete] ${collectionName} matched:`, snap.size);
                            let count = 0;
                            let localBatch = db.batch();
                            for (const d of snap.docs) {
                                localBatch.delete(d.ref);
                                count++;
                                if (count % 400 === 0) {
                                    await localBatch.commit();
                                    console.log(`[SelectiveDelete] ${collectionName} committed 400 deletes`);
                                    localBatch = db.batch();
                                }
                            }
                            await localBatch.commit();
                            console.log(`[SelectiveDelete] ${collectionName} final commit; total deleted: ${count}`);
                        };

                        await deleteInChunks('salesTransactions');
                        await deleteInChunks('kingDuvetSales');
                    }
    
                    await batch.commit();
                    const successText = t('delete_success_for_period', { dataType: t(dataType), month: monthName, year: year.toString() });
                    setAppMessage({ isOpen: true, text: successText, type: 'alert' });
                } catch (error: any) {
                    setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' });
                } finally {
                    setIsProcessing(false);
                }
            }
        });
    };

    const handleSaveBusinessRule = async (rule: string, existingRuleId?: string) => {
        if (!rule.trim() && !existingRuleId) return;
        setIsProcessing(true);
        try {
            if (existingRuleId && !rule.trim()) {
                await db.collection('businessRules').doc(existingRuleId).delete();
                setAppMessage({ isOpen: true, text: 'تم حذف القاعدة بنجاح', type: 'alert' });
            } else if (existingRuleId) {
                await db.collection('businessRules').doc(existingRuleId).set({ rule });
                setAppMessage({ isOpen: true, text: t('rule_saved_success'), type: 'alert' });
            } else {
                await db.collection('businessRules').add({ rule });
                setAppMessage({ isOpen: true, text: t('rule_saved_success'), type: 'alert' });
            }
        } catch (error: any) {
             setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateUser = async (userId: string, data: Partial<UserProfile>) => {
        setIsProcessing(true);
        try {
            await db.collection('users').doc(userId).update(data);
            setAppMessage({ isOpen: true, text: t('user_updated_success'), type: 'alert' });
        } catch (error: any) {
            setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' });
        } finally {
            setIsProcessing(false);
            setModalState({ type: null });
        }
    };

    const handleDeleteUser = (userId: string, userName: string) => {
        if (profile?.role !== 'admin') {
            setAppMessage({ isOpen: true, text: 'You do not have permission to delete users.', type: 'alert' });
            return;
        }
        
        setAppMessage({
            isOpen: true,
            text: `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
            type: 'confirm',
            onConfirm: async () => {
                setIsProcessing(true);
                try {
                    await db.collection('users').doc(userId).delete();
                    setAppMessage({ isOpen: true, text: t('user_deleted_success'), type: 'alert' });
                } catch (error: any) {
                    console.error('Error deleting user:', error);
                    setAppMessage({ isOpen: true, text: t('error_deleting_user'), type: 'alert' });
                } finally {
                    setIsProcessing(false);
                }
            }
        });
    };

    const handleSaveTask = async (taskData: { recipientId: string, recipientName: string, title: string, message: string }) => {
        if (!user || !profile) return;
        setIsProcessing(true);
        try {
            const newTask = {
                ...taskData,
                senderId: user.uid,
                senderName: profile.name,
                status: 'pending' as 'pending' | 'completed',
                createdAt: Timestamp.now(),
            };
            await db.collection('tasks').add(newTask);
            setAppMessage({ isOpen: true, text: `Task sent to ${taskData.recipientName}.`, type: 'alert' });
        } catch (error: any) { 
            setAppMessage({ isOpen: true, text: `${t('error')}: ${error.message}`, type: 'alert' }); 
        } finally { 
            setIsProcessing(false); 
            setModalState({ type: null }); 
        }
    };

    const handleUpdateTaskStatus = async (taskId: string, status: 'completed') => {
        try {
            const taskRef = db.collection('tasks').doc(taskId);
            const updateData: any = { status };
            if (status === 'completed') {
                updateData.completedAt = Timestamp.now();
            }
            await taskRef.update(updateData);
        } catch (error: any) {
            setAppMessage({ isOpen: true, text: `Error updating task: ${error.message}`, type: 'alert' });
        }
    };

  const handleLogout = async () => {
    await auth.signOut();
  };
  
  const navItemsConfig = useMemo(() => {
      const role: UserRole = profile?.role || 'employee';
      const allItems = [
          { icon: <HomeIcon />, label: t('dashboard'), name: "dashboard", roles: ['admin', 'general_manager', 'area_manager', 'store_manager', 'employee'] as UserRole[] },
          { icon: <LiveIcon />, label: t('live'), name: "live", roles: ['admin', 'general_manager', 'area_manager', 'store_manager', 'employee'] as UserRole[] },
          { icon: <ChartBarIcon />, label: t('lfl_comparison'), name: "lfl", roles: ['admin', 'general_manager', 'area_manager', 'store_manager', 'employee'] as UserRole[] },
          { icon: <OfficeBuildingIcon />, label: t('stores'), name: "stores", roles: ['admin', 'general_manager', 'area_manager', 'store_manager', 'employee'] as UserRole[] },
          { icon: <UserGroupIcon />, label: t('employees'), name: "employees", roles: ['admin', 'general_manager', 'area_manager', 'store_manager', 'employee'] as UserRole[] },
          { icon: <CalculatorIcon />, label: t('commissions'), name: "commissions", roles: ['admin', 'general_manager', 'area_manager', 'store_manager'] as UserRole[] },
          { icon: <CubeIcon />, label: t('products'), name: "products", roles: ['admin', 'general_manager', 'area_manager', 'store_manager', 'employee'] as UserRole[] },
          { icon: <UploadIcon />, label: t('smart_upload'), name: "uploads", roles: ['admin', 'general_manager', 'area_manager'] as UserRole[] },
          { icon: <CogIcon />, label: t('settings'), name: "settings", roles: ['admin', 'general_manager'] as UserRole[] },
          { icon: <span>⏳</span>, label: t('pending_approvals'), name: "pendingApprovals", roles: ['admin'] as UserRole[] },
          { icon: <span>👥</span>, label: t('roles_management'), name: "rolesManagement", roles: ['admin'] as UserRole[] },
      ];
      return allItems.filter(item => item.roles.includes(role));
  }, [profile, t]);
  
  useEffect(() => {
      if (profile && !navItemsConfig.find(item => item.name === activeTab)) {
          setActiveTab(navItemsConfig[0]?.name || 'dashboard');
      }
  }, [navItemsConfig, activeTab, profile]);

  if (profile?.status === 'pending') {
      return <PendingApprovalPage onLogout={handleLogout} />;
  }

 const renderContent = () => {
  if (dataLoading) {
    return (
       <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (activeTab === 'stores' && selectedArea) {
      return <AreaDetailPage 
          areaManager={selectedArea.managerName}
          stores={selectedArea.stores}
          allMetrics={dailyMetrics} 
          onBack={() => setSelectedArea(null)}
          allStores={processedData.storeSummary}
          setModalState={setModalState}
          allDateData={allDateData}
          profile={profile}
          onSelectStore={(store) => {
            setSelectedArea(null);
            setSelectedStore(store);
          }}
      />;
  }

  if (activeTab === 'stores' && selectedStore) {
      return <StoreDetailPage 
          store={selectedStore} 
          allMetrics={dailyMetrics} 
          onBack={() => setSelectedStore(null)}
          allStores={processedData.storeSummary}
          setModalState={setModalState}
          allDateData={allDateData}
          profile={profile}
          businessRules={businessRules}
          onSaveRule={handleSaveBusinessRule}
          onDeleteRule={(id) => handleDelete('businessRules', id, 'this rule')}
          isProcessing={isProcessing}
      />;
  }
  
  const pageProps = {
      dateFilter,
      setDateFilter: (value: DateFilter) => runWithRecalculation(setDateFilter, value),
      areaStoreFilter,
      setAreaStoreFilter: (value: AreaStoreFilterState) => runWithRecalculation(setAreaStoreFilter, value),
      allStores: stores,
      allDateData: allDateData,
      setModalState,
      isRecalculating,
      profile,
  };

  switch (activeTab) {
    case 'dashboard':
      return <Dashboard {...processedData} {...pageProps} dashboardPieFilter={dashboardPieFilter} setDashboardPieFilter={setDashboardPieFilter} tasks={tasks} onUpdateTaskStatus={handleUpdateTaskStatus} isProcessing={isProcessing} />;
    case 'stores':
      return <StoresPage {...processedData} {...pageProps} onEdit={d => setModalState({type: 'store', data: d})} onDelete={(id, name) => handleDelete('stores', id, name)} onSelectStore={setSelectedStore} onSelectArea={(managerName, stores) => setSelectedArea({ managerName, stores })} allMetrics={dailyMetrics} />;
     case 'employees':
      return <EmployeesPage 
          {...processedData} 
          {...pageProps} 
          onEdit={d => setModalState({type: 'employee', data: d})} 
          onDelete={(id, name) => handleDelete('employees', id, name)} 
          dailyMetrics={dailyMetrics} 
          salesTransactions={salesTransactions}
          kingDuvetSales={kingDuvetSales}
          allEmployees={employees}
          storeSummary={processedData.storeSummary}
          />;
     case 'products':
       return <ProductsPage {...processedData} {...pageProps} />;
     case 'commissions':
        return <CommissionsPage {...processedData} {...pageProps} />;
    case 'uploads':
       return (
         <SmartUploaderPage
           onUpload={handleSmartUpload}
           isProcessing={isProcessing}
           uploadResult={uploadResult}
           onClearResult={clearUploadResult}
           employeeSummaries={Object.values(processedData.employeeSummary).flat()}
           storeSummaries={processedData.storeSummary}
           storePerformanceExtras={processedData.storePerformanceExtras}
           duvetSummary={processedData.duvetSummary}
          employeeDuvetSales={processedData.employeeDuvetSales}
           employees={employees}
           dateFilter={dateFilter}
           setDateFilter={pageProps.setDateFilter}
           allData={allDateData}
           allMetrics={dailyMetrics}
           allStores={stores}
         />
       );
     case 'live':
        return <LivePage />;
     case 'lfl':
        return <LFLPage allStores={stores} allMetrics={dailyMetrics} profile={profile}/>;
     case 'settings':
        return <SettingsPage
                  storeSummary={processedData.storeSummary}
                  onAddMonthlyData={() => setModalState({type: 'monthlyStoreMetric'})}
                  onDeleteAllData={handleDeleteAllData}
                  onSelectiveDelete={handleSelectiveDelete}
                  isProcessing={isProcessing}
                  profile={profile}
               />;
     case 'pendingApprovals':
        return <PendingApprovalsPage />;
     case 'rolesManagement':
        return <RolesManagementPage />;
    default:
      return (
        <div className="text-center p-10 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-bold text-zinc-800">{t('page_not_found_title')}</h2>
          <p className="text-zinc-500 mt-2">{t('page_not_found_message')}</p>
        </div>
      );
  }
};

  const fullProcessedData = { ...processedData, salesTransactions, kingDuvetSales };

  const sidebarOffscreenClass = locale === 'ar' ? 'translate-x-full' : '-translate-x-full';
  
  const isAdmin = profile?.role === 'admin' || profile?.role === 'general_manager';

  return (
    <div className="relative md:flex">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}
      <aside className={`w-64 sm:w-72 bg-white border-r border-primary-100 h-screen flex flex-col fixed inset-y-0 ltr:left-0 rtl:right-0 transform ${isSidebarOpen ? 'translate-x-0' : sidebarOffscreenClass} md:translate-x-0 transition-all duration-300 ease-in-out z-30 shadow-xl`}>
        {/* الشعار */}
        <div className="p-4 sm:p-6 border-b border-primary-100">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">K.A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">COCKPIT</h1>
              <p className="text-sm text-neutral-500">Management Dashboard</p>
            </div>
          </div>
        </div>
        
        {/* القائمة */}
        <nav className="flex-grow overflow-y-auto p-3 sm:p-4">
          <ul className="space-y-2">
             {navItemsConfig.map(item => (
                <NavItem key={item.name} {...item} activeTab={activeTab} setActiveTab={setActiveTab} setIsSidebarOpen={setIsSidebarOpen} />
            ))}
          </ul>
        </nav>
        
        {/* معلومات المستخدم */}
        <div className="p-3 sm:p-4 border-t border-primary-100 bg-white">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">{profile?.name || 'User'}</p>
              <p className="text-xs text-neutral-500 capitalize">{profile?.role || 'employee'}</p>
            </div>
          </div>
          <div className="text-center text-xs text-neutral-400">
            Developed by K.A Team
          </div>
        </div>
      </aside>
      <main className="flex-1 p-2 sm:p-4 md:p-6 md:ltr:ml-64 md:rtl:mr-64 lg:ltr:ml-72 lg:rtl:mr-72 bg-neutral-50 min-h-screen">
        <header className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-4 min-w-0">
                    <button className="md:hidden p-3 text-neutral-600 hover:bg-neutral-100 rounded-xl transition-all duration-200" onClick={() => setIsSidebarOpen(true)}>
                        <MenuIcon />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-neutral-900 capitalize truncate max-w-[70vw] sm:max-w-none">{t(activeTab.replace(/([A-Z])/g, ' $1').replace('ai', 'AI'))}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                     {isAdmin && <NotificationBell notifications={notifications} onNotificationClick={handleNotificationClick} />}
                     <button onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')} className="px-3 py-1.5 text-xs font-semibold rounded-full border border-zinc-300 hover:bg-gray-100 text-zinc-700" title={locale === 'en' ? 'العربية' : 'English'}>
                        {locale === 'en' ? 'A' : 'ع'} - {locale === 'en' ? 'ع' : 'A'}
                     </button>
                     <UserMenu user={user} profile={profile} onLogout={handleLogout} />
                </div>
            </div>
        </header>
        {renderContent()}
      </main>

        {modalState.type &&
            <div className="modal-backdrop">
                {modalState.type === 'visitors' && <VisitorsModal onSave={handleVisitorsSave} onClose={() => setModalState({ type: null })} isProcessing={isProcessing} stores={processedData.storeSummary} profile={profile} />}
                {modalState.type === 'employee' && <EmployeeModal profile={profile} data={modalState.data} onSave={(data) => handleSave('employees', data)} onClose={() => setModalState({ type: null })} isProcessing={isProcessing} stores={stores} />}
                {modalState.type === 'store' && <StoreModal profile={profile} data={modalState.data} onSave={(data) => handleSave('stores', data)} onClose={() => setModalState({ type: null })} isProcessing={isProcessing} />}
                {modalState.type === 'dailyMetric' && <DailyMetricModal data={modalState.data} onSave={handleDailyMetricSave} onClose={() => setModalState({ type: null })} isProcessing={isProcessing} stores={stores} />}
                {modalState.type === 'monthlyStoreMetric' && <MonthlyStoreMetricModal onSave={handleMonthlyMetricSave} onClose={() => setModalState({ type: null })} isProcessing={isProcessing} stores={stores} />}
                {modalState.type === 'userEdit' && <UserEditModal data={modalState.data} onSave={handleUpdateUser} onClose={() => setModalState({type: null})} isProcessing={isProcessing} stores={stores} allEmployees={employees} />}
                {modalState.type === 'aiCoaching' && <AiCoachingModal data={modalState.data} onClose={() => setModalState({ type: null })} />}
                {modalState.type === 'salesForecast' && <SalesForecastModal salesData={modalState.data} onClose={() => setModalState({ type: null })} />}
                {modalState.type === 'salesPitch' && <SalesPitchModal product={modalState.data} onClose={() => setModalState({ type: null })} />}
                {modalState.type === 'naturalLanguageSearch' && <NaturalLanguageSearchModal query={modalState.data.query} fullData={processedData} onClose={() => setModalState({type: null})} />}
                {modalState.type === 'aiComparison' && <AiComparisonModal data={modalState.data.item} allItems={modalState.data.allItems} type={modalState.data.type} onClose={() => setModalState({type: null})} />}
                {modalState.type === 'aiPrediction' && <AiPredictionModal data={modalState.data} onClose={() => setModalState({type: null})} />}
                {modalState.type === 'kpiBreakdown' && <KPIBreakdownModal data={modalState.data} onClose={() => setModalState({ type: null })} />}
                {modalState.type === 'productDetails' && <ProductDetailsModal data={modalState.data} onClose={() => setModalState({ type: null })} />}
                {modalState.type === 'task' && <TaskModal data={modalState.data} onSave={handleSaveTask} onClose={() => setModalState({ type: null })} isProcessing={isProcessing} />}
            </div>
        }
        {appMessage.isOpen && <AppMessageModal message={appMessage} onClose={() => setAppMessage({ isOpen: false, text: '', type: 'alert' })} />}
    </div>
  );
};

export default MainLayout;
