
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db } from '@/services/firebase';
// FIX: Import firebase to use Timestamp and FieldValue for Firestore operations.
import firebase from 'firebase/app';

import { useDataProcessing } from '@/hooks/useDataProcessing';
import { useSmartUploader } from '@/hooks/useSmartUploader';
import { useLocale } from '@/context/LocaleContext';
import { useData } from '@/context/DataProvider';
import { getSalesData, getStores } from '@/data/dataProvider';
import { apiUrl } from '@/utils/apiBase';

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
  const { allSalesData, loading: dataPreloading } = useData(); // Get preloaded data from DataProvider
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
  // Each page has its own independent dateFilter (like orange-dashboard)
  
  // Load saved filters from localStorage for Stores page
  const loadStoresFilters = (): { dateFilter: DateFilter; areaStoreFilter: AreaStoreFilterState } => {
    try {
      const savedDateFilter = localStorage.getItem('storesDateFilter');
      const savedAreaStoreFilter = localStorage.getItem('storesAreaStoreFilter');
      
      const defaultDateFilter: DateFilter = { year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' };
      const defaultAreaStoreFilter: AreaStoreFilterState = {
        areaManager: profile?.role === 'area_manager' || profile?.role === 'store_manager' ? profile.areaManager || 'All' : 'All',
        store: profile?.role === 'store_manager' || profile?.role === 'employee' ? profile.store || 'All' : 'All',
        city: 'All',
      };
      
      return {
        dateFilter: savedDateFilter ? JSON.parse(savedDateFilter) : defaultDateFilter,
        areaStoreFilter: savedAreaStoreFilter ? JSON.parse(savedAreaStoreFilter) : defaultAreaStoreFilter,
      };
    } catch {
      return {
        dateFilter: { year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' },
        areaStoreFilter: {
          areaManager: profile?.role === 'area_manager' || profile?.role === 'store_manager' ? profile.areaManager || 'All' : 'All',
          store: profile?.role === 'store_manager' || profile?.role === 'employee' ? profile.store || 'All' : 'All',
          city: 'All',
        },
      };
    }
  };
  
  const savedStoresFilters = loadStoresFilters();
  
  const [dateFilter, setDateFilter] = useState<DateFilter>({ year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' }); // Dashboard default
  const [storesDateFilter, setStoresDateFilter] = useState<DateFilter>(savedStoresFilters.dateFilter); // Stores page - with saved filter
  const [storesAreaStoreFilter, setStoresAreaStoreFilter] = useState<AreaStoreFilterState>(savedStoresFilters.areaStoreFilter); // Stores page - independent area/store filter
  const [productsDateFilter, setProductsDateFilter] = useState<DateFilter>({ year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' }); // Products page
  const [employeesDateFilter, setEmployeesDateFilter] = useState<DateFilter>({ year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' }); // Employees page
  const [commissionsDateFilter, setCommissionsDateFilter] = useState<DateFilter>({ year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' }); // Commissions page
  const [areaStoreFilter, setAreaStoreFilter] = useState<AreaStoreFilterState>({
      areaManager: profile?.role === 'area_manager' || profile?.role === 'store_manager' ? profile.areaManager || 'All' : 'All',
      store: profile?.role === 'store_manager' || profile?.role === 'employee' ? profile.store || 'All' : 'All',
      city: 'All', // City filter (like orange-dashboard) - for other pages
  });
  const [dashboardPieFilter, setDashboardPieFilter] = useState<string | null>(null);

  // Save Stores filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('storesDateFilter', JSON.stringify(storesDateFilter));
      console.log('💾 Saved storesDateFilter to localStorage:', storesDateFilter);
    } catch (e) {
      console.warn('⚠️ Failed to save storesDateFilter to localStorage:', e);
    }
  }, [storesDateFilter]);

  useEffect(() => {
    try {
      localStorage.setItem('storesAreaStoreFilter', JSON.stringify(storesAreaStoreFilter));
      console.log('💾 Saved storesAreaStoreFilter to localStorage:', storesAreaStoreFilter);
    } catch (e) {
      console.warn('⚠️ Failed to save storesAreaStoreFilter to localStorage:', e);
    }
  }, [storesAreaStoreFilter]);

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
    
    // Load stores using hybrid provider (legacy for 2024/2025, API for 2026+)
    const loadStoresHybrid = async () => {
      try {
        const year = typeof dateFilter.year === 'number' ? dateFilter.year : new Date().getFullYear();
        const storesList = await getStores(year);
        
        if (storesList.length > 0) {
          console.log(`✅ Loaded ${storesList.length} stores from ${year <= 2025 ? 'legacy' : 'API'}`);
          setStores(storesList as Store[]);
        } else {
          console.warn('⚠️ No stores loaded - returning empty array');
          setStores([]);
        }
      } catch (error: any) {
        console.error('❌ Error loading stores:', error);
        setStores([]);
      }
    };
    
    loadStoresHybrid();
    
    // Load employees from API (2026+ only, empty for legacy years)
    const loadEmployeesFromAPI = async () => {
      try {
        const year = typeof dateFilter.year === 'number' ? dateFilter.year : new Date().getFullYear();
        
        // Legacy years (2024/2025) have no employee data
        if (year <= 2025) {
          console.log(`📊 Legacy year ${year} - no employee data available`);
          setEmployees([]);
          return;
        }
        
        // For 2026+, load from API
        const url = apiUrl('/api/get-employees');
        const response = await fetch(url);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.employees)) {
            console.log(`✅ Loaded ${result.employees.length} employees from API`);
            setEmployees(result.employees as Employee[]);
          } else {
            console.warn('⚠️ API returned no employees');
            setEmployees([]);
          }
        } else {
          console.warn('⚠️ API failed for employees');
          setEmployees([]);
        }
      } catch (error: any) {
        console.error('❌ Error loading employees from API:', error);
        setEmployees([]);
      }
    };
    
    loadEmployeesFromAPI();
    
    // NO Firestore listeners for sales data - ALL data from API/local JSON (2024+)
    // Removed: kingDuvetSales, salesTransactions, businessRules, tasks
    // These collections are no longer used - all data comes from API (D365) or local JSON (legacy)
    console.log('📊 Firestore listeners removed for sales data - using API/local JSON only (NO Firestore)');
    
    // Only keep users collection for authentication (if admin/general_manager)
    // All other data (stores, employees, metrics) comes from API/local JSON
    let usersUnsubscriber: () => void = () => {};
    if (profile?.role === 'admin' || profile?.role === 'general_manager') {
        const usersRef = db.collection('users');
        usersUnsubscriber = usersRef.onSnapshot(
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (UserProfile & { id: string })[];
                setAllUsers(data);
            },
            (err) => {
                console.error('Error fetching users:', err);
            }
        );
    }

    // Set empty arrays for removed Firestore collections (no longer used)
    setKingDuvetSales([]);
    setSalesTransactions([]);
    setBusinessRules([]);
    setTasks([]);
    
    // Mark data as loaded (no Firestore data to wait for)
                        setDataLoading(false);

    return () => {
        usersUnsubscriber();
    };
}, [profile, dateFilter.year]); // Add dateFilter.year to reload stores/employees when year changes

  // Helper function to convert allSalesData to DailyMetric[] format (reusable for all pages)
  const convertAllSalesDataToDailyMetrics = useCallback((yearFilter: number | 'all', monthFilter: number | 'all') => {
    if (!profile || dataPreloading) {
      return [];
    }
    
    // Check if allSalesData is available (it's an object, not null)
    if (!allSalesData || typeof allSalesData !== 'object') {
      console.warn('⚠️ allSalesData is not available yet');
      return [];
    }
    
    const year = typeof yearFilter === 'number' ? yearFilter : new Date().getFullYear();
    const month = typeof monthFilter === 'number' ? monthFilter : (monthFilter === 'all' ? undefined : new Date().getMonth());
    
    if (typeof year !== 'number' || year < 2024 || year > 2026) {
      return [];
    }
    
    // Get preloaded data for this year (already loaded at startup)
    const result = allSalesData[year];
    if (!result || !result.success) {
      console.warn(`⚠️ No preloaded data for year ${year}`, { 
        availableYears: Object.keys(allSalesData), 
        yearData: result 
      });
      return [];
    }
    
    // Debug: Log data structure
    console.log(`📊 Processing data for year ${year}:`, {
      hasByDay: !!result.byDay,
      byDayLength: result.byDay?.length || 0,
      hasByStore: !!result.byStore,
      byStoreLength: result.byStore?.length || 0,
      hasByEmployee: !!result.byEmployee,
      byEmployeeLength: result.byEmployee?.length || 0,
      storesCount: stores.length,
    });
    
    // Build mapping: storeId -> storeName from current stores list (for proper matching)
    const storeNameMap = new Map<string, string>();
    stores.forEach(s => {
      const storeId = (s as any).store_id || s.id || s.name;
      storeNameMap.set(storeId, s.name);
    });
    
    const apiMetrics: DailyMetric[] = [];
    
    // Filter byDay by month (client-side filtering - no API call)
    if (Array.isArray(result.byDay) && result.byDay.length > 0) {
      result.byDay.forEach((dayData: any) => {
        const dateStr = dayData.date; // "YYYY-MM-DD"
        const dateObj = new Date(dateStr + 'T00:00:00Z');
        
        // Filter by month if specified
        if (month !== undefined && dateObj.getUTCMonth() !== month) {
          return; // Skip days outside the selected month
        }
        
        // Add store-level metrics for this day
        if (Array.isArray(dayData.byStore)) {
          dayData.byStore.forEach((store: any) => {
            const storeId = store.storeId || store.storeName;
            const storeName = storeNameMap.get(storeId) || store.storeName || storeId;
            
            // Check if this store has employee metrics for this day
            const hasEmployees = apiMetrics.some(m => 
              m.store === storeName && 
              m.date && 
              m.date.toDate().toISOString().split('T')[0] === dateStr &&
              m.employee
            );
            
            // Only add store-level if no employee-level exists for this day+store
            if (!hasEmployees || year <= 2025) {
              const id = `${dateStr}_${storeName}`;
              apiMetrics.push({
                id,
                date: firebase.firestore.Timestamp.fromDate(dateObj),
                store: storeName,
                totalSales: store.salesAmount || 0,
                transactionCount: store.invoices || 0,
                visitors: store.visitors,
              });
            }
          });
        }
      });
      
      // Add employee-level metrics from monthly byEmployee (employees_data.json doesn't have daily breakdown)
      // Use first day of month as date for employee metrics (they're monthly totals)
      if (Array.isArray(result.byEmployee) && result.byEmployee.length > 0) {
        const firstDayStr = result.range?.from || new Date().toISOString().split('T')[0];
        const firstDayObj = new Date(firstDayStr + 'T00:00:00Z');
        
        // Filter by month if specified
        if (month === undefined || firstDayObj.getUTCMonth() === month) {
          result.byEmployee.forEach((emp: any) => {
            const storeId = emp.storeId || emp.storeName;
            const storeName = storeNameMap.get(storeId) || emp.storeName || storeId;
            const id = `${firstDayStr}_${storeName}_${emp.employeeName || emp.employeeId}`;
            apiMetrics.push({
              id,
              date: firebase.firestore.Timestamp.fromDate(firstDayObj),
              store: storeName,
              employee: emp.employeeName,
              employeeId: emp.employeeId,
              totalSales: emp.salesAmount || 0,
              transactionCount: emp.invoices || 0,
            });
          });
        }
      }
    } else {
      // Fallback: Monthly aggregation (legacy or when byDay not available)
      const dateStr = result.range?.from || new Date().toISOString().split('T')[0];
      const dateObj = new Date(dateStr + 'T00:00:00Z');
      
      // Filter by month if specified
      if (month === undefined || dateObj.getUTCMonth() === month) {
        // Add employee-level metrics (byEmployee from API/D365, empty for legacy)
        if (Array.isArray(result.byEmployee)) {
          result.byEmployee.forEach((emp: any) => {
            const storeId = emp.storeId || emp.storeName;
            const storeName = storeNameMap.get(storeId) || emp.storeName || storeId;
            const id = `${dateStr}_${storeName}_${emp.employeeName || emp.employeeId}`;
            apiMetrics.push({
              id,
              date: firebase.firestore.Timestamp.fromDate(dateObj),
              store: storeName,
              employee: emp.employeeName,
              employeeId: emp.employeeId,
              totalSales: emp.salesAmount || 0,
              transactionCount: emp.invoices || 0,
            });
          });
        }
        
        // Add store-level metrics (byStore from legacy or D365)
        if (Array.isArray(result.byStore)) {
          result.byStore.forEach((store: any) => {
            const storeId = store.storeId || store.storeName;
            const storeName = storeNameMap.get(storeId) || store.storeName || storeId;
            
            const hasEmployees = apiMetrics.some(m => m.store === storeName);
            if (!hasEmployees || year <= 2025) {
              const id = `${dateStr}_${storeName}`;
              apiMetrics.push({
                id,
                date: firebase.firestore.Timestamp.fromDate(dateObj),
                store: storeName,
                totalSales: store.salesAmount || 0,
                transactionCount: store.invoices || 0,
                visitors: store.visitors,
              });
            }
          });
        }
      }
    }
    
    console.log(`📊 Converted ${apiMetrics.length} metrics from preloaded data for year ${year} (${month !== undefined ? `month ${month + 1}` : 'all months'})`);
    return apiMetrics;
  }, [profile, allSalesData, dataPreloading, stores]);

  // Convert preloaded NormalizedSalesResponse to DailyMetric[] format for Dashboard (uses dateFilter)
  const dailyMetricsFromPreloaded = useMemo(() => {
    return convertAllSalesDataToDailyMetrics(dateFilter.year, dateFilter.month);
  }, [convertAllSalesDataToDailyMetrics, dateFilter.year, dateFilter.month]);

  // Convert for Stores page (uses storesDateFilter)
  const storesDailyMetrics = useMemo(() => {
    return convertAllSalesDataToDailyMetrics(storesDateFilter.year, storesDateFilter.month);
  }, [convertAllSalesDataToDailyMetrics, storesDateFilter.year, storesDateFilter.month]);

  // Convert for Products page (uses productsDateFilter)
  const productsDailyMetrics = useMemo(() => {
    return convertAllSalesDataToDailyMetrics(productsDateFilter.year, productsDateFilter.month);
  }, [convertAllSalesDataToDailyMetrics, productsDateFilter.year, productsDateFilter.month]);

  // Convert for Employees page (uses employeesDateFilter)
  const employeesDailyMetrics = useMemo(() => {
    return convertAllSalesDataToDailyMetrics(employeesDateFilter.year, employeesDateFilter.month);
  }, [convertAllSalesDataToDailyMetrics, employeesDateFilter.year, employeesDateFilter.month]);

  // Convert for Commissions page (uses commissionsDateFilter)
  const commissionsDailyMetrics = useMemo(() => {
    return convertAllSalesDataToDailyMetrics(commissionsDateFilter.year, commissionsDateFilter.month);
  }, [convertAllSalesDataToDailyMetrics, commissionsDateFilter.year, commissionsDateFilter.month]);

  // Use preloaded data instead of fetching (like orange-dashboard) - Dashboard uses dateFilter
  useEffect(() => {
    if (!profile || dataPreloading) {
      return;
    }
    
    // Update dailyMetrics from preloaded data (client-side filtering only)
    setDailyMetrics(dailyMetricsFromPreloaded);
  }, [profile, dataPreloading, dailyMetricsFromPreloaded]);

  // OLD: Fetch metrics from API (DISABLED - now using preloaded data from DataProvider)
  // Data is now loaded at startup via DataProvider and filtered client-side (like orange-dashboard)
  // This useEffect is disabled to prevent redundant API calls
  /*
  useEffect(() => {
    if (!profile) return;
    
    const year = typeof dateFilter.year === 'number' ? dateFilter.year : new Date().getFullYear();
    const month = typeof dateFilter.month === 'number' ? dateFilter.month : (dateFilter.month === 'all' ? undefined : new Date().getMonth());
    
    if (typeof year !== 'number' || year < 2024) {
      console.log(`⚠️ Skipping API fetch: year=${year} (< 2024 or invalid)`);
      return;
    }

    const fetchMetricsHybrid = async () => {
      try {
        console.log(`📊 Fetching metrics for year ${year}, month ${month !== undefined ? month : 'all'} (${year <= 2025 ? 'legacy' : 'D365'})...`);
        
        const result = await getSalesData({ year, month });
        
        console.log(`✅ Hybrid response:`, { 
          success: result.success, 
          source: result.debug?.source || 'unknown',
          byStore: result.byStore?.length || 0, 
          byEmployee: result.byEmployee?.length || 0,
          byDay: result.byDay?.length || 0
        });
        
        // Debug: Log sample data to verify structure
        if (result.success && result.byStore && result.byStore.length > 0) {
          console.log(`📋 Fetched Data Sample (byStore[0]):`, result.byStore[0]);
        }
        if (result.success && result.byDay && result.byDay.length > 0) {
          console.log(`📋 Fetched Data Sample (byDay[0]):`, result.byDay[0]);
        }
        
        if (result.success) {
          // Convert normalized response to DailyMetric[] format for compatibility
          const apiMetrics: DailyMetric[] = [];
          
          // Build mapping: storeId -> storeName from current stores list (for proper matching)
          const storeNameMap = new Map<string, string>();
          stores.forEach(s => {
            const storeId = (s as any).store_id || s.id || s.name;
            storeNameMap.set(storeId, s.name);
          });
          
          // Use byDay if available (D365 daily breakdown), otherwise fall back to byStore (monthly)
          if (Array.isArray(result.byDay) && result.byDay.length > 0) {
            // Daily breakdown from D365 (2026+) - each day has its own byStore array
            result.byDay.forEach((dayData: any) => {
              const dateStr = dayData.date; // "YYYY-MM-DD"
              const dateObj = new Date(dateStr + 'T00:00:00Z');
              
              // Add store-level metrics for this day
              if (Array.isArray(dayData.byStore)) {
                dayData.byStore.forEach((store: any) => {
                  const storeId = store.storeId || store.storeName;
                  const storeName = storeNameMap.get(storeId) || store.storeName || storeId;
                  
                  // Check if this store has employee metrics for this day
                  const hasEmployees = apiMetrics.some(m => 
                    m.store === storeName && 
                    m.date && 
                    m.date.toDate().toISOString().split('T')[0] === dateStr &&
                    m.employee
                  );
                  
                  // Only add store-level if no employee-level exists for this day+store
                  if (!hasEmployees || year <= 2025) {
                    const id = `${dateStr}_${storeName}`;
                    apiMetrics.push({
                      id,
                      date: firebase.firestore.Timestamp.fromDate(dateObj),
                      store: storeName,
                      totalSales: store.salesAmount || 0,
                      transactionCount: store.invoices || 0,
                      visitors: store.visitors,
                    });
                  }
                });
              }
            });
            
            // Add employee-level metrics from monthly byEmployee (employees_data.json doesn't have daily breakdown)
            // Use first day of month as date for employee metrics (they're monthly totals)
            if (Array.isArray(result.byEmployee) && result.byEmployee.length > 0) {
              const firstDayStr = result.range?.from || new Date().toISOString().split('T')[0];
              const firstDayObj = new Date(firstDayStr + 'T00:00:00Z');
              
              result.byEmployee.forEach((emp: any) => {
                const storeId = emp.storeId || emp.storeName;
                const storeName = storeNameMap.get(storeId) || emp.storeName || storeId;
                const id = `${firstDayStr}_${storeName}_${emp.employeeName || emp.employeeId}`;
                apiMetrics.push({
                  id,
                  date: firebase.firestore.Timestamp.fromDate(firstDayObj),
                  store: storeName,
                  employee: emp.employeeName,
                  employeeId: emp.employeeId,
                  totalSales: emp.salesAmount || 0,
                  transactionCount: emp.invoices || 0,
                });
              });
            }
          } else {
            // Fallback: Monthly aggregation (legacy or when byDay not available)
            const dateStr = result.range?.from || new Date().toISOString().split('T')[0];
            const dateObj = new Date(dateStr + 'T00:00:00Z');
            
            // Add employee-level metrics (byEmployee from API/D365, empty for legacy)
            if (Array.isArray(result.byEmployee)) {
              result.byEmployee.forEach((emp: any) => {
                const storeId = emp.storeId || emp.storeName;
                const storeName = storeNameMap.get(storeId) || emp.storeName || storeId;
                const id = `${dateStr}_${storeName}_${emp.employeeName || emp.employeeId}`;
                apiMetrics.push({
                  id,
                  date: firebase.firestore.Timestamp.fromDate(dateObj),
                  store: storeName,
                  employee: emp.employeeName,
                  employeeId: emp.employeeId,
                  totalSales: emp.salesAmount || 0,
                  transactionCount: emp.invoices || 0,
                });
              });
            }
            
            // Add store-level metrics (byStore from legacy or D365)
            if (Array.isArray(result.byStore)) {
              result.byStore.forEach((store: any) => {
                const storeId = store.storeId || store.storeName;
                const storeName = storeNameMap.get(storeId) || store.storeName || storeId;
                
                const hasEmployees = apiMetrics.some(m => m.store === storeName);
                if (!hasEmployees || year <= 2025) {
                  const id = `${dateStr}_${storeName}`;
                  apiMetrics.push({
                    id,
                    date: firebase.firestore.Timestamp.fromDate(dateObj),
                    store: storeName,
                    totalSales: store.salesAmount || 0,
                    transactionCount: store.invoices || 0,
                    visitors: store.visitors,
                  });
                }
              });
            }
          }
          
          console.log(`📊 Converted ${apiMetrics.length} metrics from ${result.debug?.source || 'hybrid'}`);
          console.log(`✅ Setting ${apiMetrics.length} metrics (${result.debug?.source || 'hybrid'})`);
          if (apiMetrics.length > 0) {
            console.log(`📋 Sample metrics:`, apiMetrics.slice(0, 3).map(m => ({ 
              id: m.id, 
              store: m.store, 
              sales: m.totalSales, 
              transactions: m.transactionCount,
              date: m.date?.toDate ? m.date.toDate().toISOString().split('T')[0] : m.date
            })));
          } else {
            console.warn(`⚠️ No metrics converted! Result structure:`, {
              hasByDay: !!result.byDay,
              hasByStore: !!result.byStore,
              hasByEmployee: !!result.byEmployee,
              byDayLength: result.byDay?.length || 0,
              byStoreLength: result.byStore?.length || 0,
            });
          }
          setDailyMetrics(apiMetrics);
        } else {
          console.warn('⚠️ Hybrid provider returned error:', result);
          setDailyMetrics([]);
        }
      } catch (error: any) {
        console.error('❌ Error fetching metrics from hybrid provider:', error.message || error);
        setDailyMetrics([]);
      }
    };

    fetchMetricsHybrid();
  }, [profile, dateFilter.year, dateFilter.month, stores]); // Add stores dependency for proper store name mapping
  */

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

  // Dashboard processedData (uses dateFilter and dailyMetrics)
  const dashboardProcessedData = useDataProcessing({
    stores,
    employees,
    dailyMetrics,
    kingDuvetSales,
    salesTransactions,
    dateFilter,
    areaStoreFilter: effectiveAreaStoreFilter,
    profile,
  });

  // Stores page processedData (uses storesDateFilter and storesDailyMetrics)
  const storesProcessedData = useDataProcessing({
    stores,
    employees,
    dailyMetrics: storesDailyMetrics,
    kingDuvetSales,
    salesTransactions,
    dateFilter: storesDateFilter,
    areaStoreFilter: effectiveAreaStoreFilter,
    profile,
  });

  // Products page processedData (uses productsDateFilter and productsDailyMetrics)
  const productsProcessedData = useDataProcessing({
    stores,
    employees,
    dailyMetrics: productsDailyMetrics,
    kingDuvetSales,
    salesTransactions,
    dateFilter: productsDateFilter,
    areaStoreFilter: effectiveAreaStoreFilter,
    profile,
  });

  // Employees page processedData (uses employeesDateFilter and employeesDailyMetrics)
  const employeesProcessedData = useDataProcessing({
    stores,
    employees,
    dailyMetrics: employeesDailyMetrics,
    kingDuvetSales,
    salesTransactions,
    dateFilter: employeesDateFilter,
    areaStoreFilter: effectiveAreaStoreFilter,
    profile,
  });

  // Commissions page processedData (uses commissionsDateFilter and commissionsDailyMetrics)
  const commissionsProcessedData = useDataProcessing({
    stores,
    employees,
    dailyMetrics: commissionsDailyMetrics,
    kingDuvetSales,
    salesTransactions,
    dateFilter: commissionsDateFilter,
    areaStoreFilter: effectiveAreaStoreFilter,
    profile,
  });

  // Default processedData (for backward compatibility, uses dashboard data)
  const processedData = dashboardProcessedData;

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
        // NO Firestore writes - data now comes from API/local JSON only
        // This function is disabled to prevent Firestore connections
        setIsProcessing(true);
        setAppMessage({ isOpen: true, text: t('daily_metric_success') || 'Daily metric saved (local only - no Firestore)', type: 'alert' });
        setIsProcessing(false);
        setModalState({ type: null });
    };

    // NO Firestore writes - data now comes from API/local JSON only
    const handleVisitorsSave = async (data: { date: string; store: string; visitors: number }) => {
        // This function is disabled to prevent Firestore connections
        setIsProcessing(true);
        setAppMessage({ isOpen: true, text: t('add_visitors_success') || 'Visitors saved (local only - no Firestore)', type: 'alert' });
            setIsProcessing(false);
            setModalState({ type: null });
    };

    const handleMonthlyMetricSave = async (metricData: any) => {
        // NO Firestore writes - data now comes from API/local JSON only
        // This function is disabled to prevent Firestore connections
        setIsProcessing(true);
        setAppMessage({ isOpen: true, text: t('monthly_metric_success') || 'Monthly metric saved (local only - no Firestore)', type: 'alert' });
            setIsProcessing(false);
            setModalState({ type: null });
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
        // NO Firestore writes - tasks no longer stored in Firestore
        // This function is disabled to prevent Firestore connections
        if (!user || !profile) return;
        setIsProcessing(true);
        setAppMessage({ isOpen: true, text: `Task sent to ${taskData.recipientName} (local only - no Firestore).`, type: 'alert' });
            setIsProcessing(false); 
            setModalState({ type: null }); 
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
      return <Dashboard {...dashboardProcessedData} {...pageProps} dashboardPieFilter={dashboardPieFilter} setDashboardPieFilter={setDashboardPieFilter} tasks={tasks} onUpdateTaskStatus={handleUpdateTaskStatus} isProcessing={isProcessing} />;
    case 'stores':
      // Use independent dateFilter and processedData for Stores page
      // Use storesAreaStoreFilter (independent) for Stores page
      return <StoresPage {...storesProcessedData} dateFilter={storesDateFilter} setDateFilter={(value: DateFilter) => runWithRecalculation(setStoresDateFilter, value)} areaStoreFilter={storesAreaStoreFilter} setAreaStoreFilter={(value: AreaStoreFilterState) => runWithRecalculation(setStoresAreaStoreFilter, value)} allStores={stores} allDateData={allDateData} setModalState={setModalState} isRecalculating={isRecalculating} profile={profile} onEdit={d => setModalState({type: 'store', data: d})} onDelete={(id, name) => handleDelete('stores', id, name)} onSelectStore={setSelectedStore} onSelectArea={(managerName, stores) => setSelectedArea({ managerName, stores })} allMetrics={storesDailyMetrics} />;
     case 'employees':
      // Use independent dateFilter and processedData for Employees page
      return <EmployeesPage 
          {...employeesProcessedData} 
          dateFilter={employeesDateFilter} 
          setDateFilter={(value: DateFilter) => runWithRecalculation(setEmployeesDateFilter, value)} 
          areaStoreFilter={areaStoreFilter} 
          setAreaStoreFilter={(value: AreaStoreFilterState) => runWithRecalculation(setAreaStoreFilter, value)} 
          allStores={stores} 
          allDateData={allDateData} 
          setModalState={setModalState} 
          isRecalculating={isRecalculating} 
          profile={profile}
          onEdit={d => setModalState({type: 'employee', data: d})} 
          onDelete={(id, name) => handleDelete('employees', id, name)} 
          dailyMetrics={employeesDailyMetrics} 
          salesTransactions={salesTransactions}
          kingDuvetSales={kingDuvetSales}
          allEmployees={employees}
          storeSummary={employeesProcessedData.storeSummary}
          />;
     case 'products':
       // Use independent dateFilter and processedData for Products page
       return <ProductsPage {...productsProcessedData} dateFilter={productsDateFilter} setDateFilter={(value: DateFilter) => runWithRecalculation(setProductsDateFilter, value)} areaStoreFilter={areaStoreFilter} setAreaStoreFilter={(value: AreaStoreFilterState) => runWithRecalculation(setAreaStoreFilter, value)} allStores={stores} allDateData={allDateData} setModalState={setModalState} isRecalculating={isRecalculating} profile={profile} />;
     case 'commissions':
        // Use independent dateFilter and processedData for Commissions page
        return <CommissionsPage {...commissionsProcessedData} dateFilter={commissionsDateFilter} setDateFilter={(value: DateFilter) => runWithRecalculation(setCommissionsDateFilter, value)} areaStoreFilter={areaStoreFilter} setAreaStoreFilter={(value: AreaStoreFilterState) => runWithRecalculation(setAreaStoreFilter, value)} allStores={stores} allDateData={allDateData} setModalState={setModalState} isRecalculating={isRecalculating} profile={profile} />;
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
        return <LivePage stores={stores} profile={profile} />;
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
