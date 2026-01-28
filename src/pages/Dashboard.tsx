
import React, { useMemo } from 'react';
import AreaStoreFilter from '../components/AreaStoreFilter';
import MonthYearFilter from '../components/MonthYearFilter';
import { KPICard, ChartCard, BarChart, PieChart, LineChart } from '../components/DashboardComponents';
import { CurrencyDollarIcon, ReceiptTaxIcon, ScaleIcon, UsersIcon, ChartPieIcon } from '../components/Icons';
import { KPICardSkeleton, ChartSkeleton } from '../components/SkeletonLoader';
import MyTasks from '../components/MyTasks';
import type { KPIData, StoreSummary, EmployeeSummary, ProductSummary, Store, DateFilter, AreaStoreFilterState, FilterableData, ModalState, UserProfile, Task } from '../types';
import { useLocale } from '../context/LocaleContext';

interface DashboardProps {
  kpiData: KPIData;
  storeSummary: StoreSummary[];
  employeeSummary: { [storeName: string]: EmployeeSummary[] };
  productSummary: ProductSummary[];
  salesPerformance: { name: string, Sales: number, Target: number }[];

  allStores: Store[];
  allDateData: FilterableData[];
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  areaStoreFilter: AreaStoreFilterState;
  setAreaStoreFilter: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
  setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
  isRecalculating: boolean;
  dashboardPieFilter: string | null;
  setDashboardPieFilter: React.Dispatch<React.SetStateAction<string | null>>;
  profile: UserProfile | null;
  tasks: Task[];
  onUpdateTaskStatus: (taskId: string, status: 'completed') => void;
  isProcessing: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  kpiData, storeSummary, employeeSummary, productSummary, salesPerformance,
  allStores, allDateData, dateFilter, setDateFilter, areaStoreFilter, setAreaStoreFilter, setModalState,
  isRecalculating, dashboardPieFilter, setDashboardPieFilter, profile,
  tasks, onUpdateTaskStatus, isProcessing
}) => {
  const { t } = useLocale();
  const fullData = { kpiData, storeSummary, employeeSummary, productSummary };

  const isEmployee = profile?.role === 'employee';

  const employeePersonalKpis = useMemo(() => {
    if (!isEmployee || !profile?.employeeId) return null;

    // FIX: Explicitly type `e` in the find callback to resolve type inference errors.
    const mySummary = Object.values(employeeSummary).flat().find((e: EmployeeSummary) => e.employeeId === profile.employeeId);
    if (!mySummary) {
      return { totalSales: 0, totalTransactions: 0, averageTransactionValue: 0, conversionRate: 0, salesPerVisitor: 0 };
    }

    return {
      totalSales: mySummary.totalSales,
      totalTransactions: mySummary.totalTransactions,
      averageTransactionValue: mySummary.atv,
      conversionRate: 0, // Not applicable for employees
      salesPerVisitor: 0, // Not applicable for employees
    };
  }, [isEmployee, profile, employeeSummary]);

  const displayKpiData = isEmployee ? employeePersonalKpis : kpiData;

  const topEmployeesByAchievement = useMemo(() => {
    return Object.values(employeeSummary).flat().sort((a: EmployeeSummary, b: EmployeeSummary) => b.achievement - a.achievement).slice(0, 10);
  }, [employeeSummary]);

  const productPerformance = useMemo(() => {
    const top5 = [...productSummary].sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
    return { top5 };
  }, [productSummary]);

  const handlePieSliceClick = (sliceName: string) => {
    setDashboardPieFilter(prev => prev === sliceName ? null : sliceName);
  };

  const lineChartTitle = dateFilter.month === 'all'
    ? t('monthly_sales_performance')
    : t('daily_sales_performance');

  const { dailyAvgSales, monthlyAvgSales } = useMemo(() => {
    if (dateFilter.year === 'all') return { dailyAvgSales: 0, monthlyAvgSales: 0 };

    // حدد المتاجر ضمن الفلتر
    const storesInScope = allStores.filter(s =>
      (areaStoreFilter.areaManager === 'All' || s.areaManager === areaStoreFilter.areaManager) &&
      (areaStoreFilter.store === 'All' || s.name === areaStoreFilter.store)
    ).map(s => s.name);
    const storeSet = new Set(storesInScope);

    // اجمع من dailyMetrics فقط داخل allDateData (وجود حقل date و totalSales)
    const metrics = (allDateData as any[]).filter((d: any) => d && d.date && typeof d.date.toDate === 'function' && d.store && storeSet.has(d.store));

    const Y = dateFilter.year as number;
    const M = dateFilter.month === 'all' ? 'all' : (dateFilter.month as number); // 0-index
    const D = dateFilter.day === 'all' ? 'all' : (dateFilter.day as number);

    // شهري: مجموع من يناير إلى M واقسم على (M+1)
    const monthlyTotals = Array.from({ length: 12 }, () => 0);
    metrics.forEach((m: any) => {
      const d = typeof m.date === 'string' ? new Date(m.date) : (m.date?.toDate ? m.date.toDate() : new Date(m.date));
      if (d.getUTCFullYear() !== Y) return;
      monthlyTotals[d.getUTCMonth()] += Number(m.totalSales || 0);
    });

    let monthlyAvg = 0;
    if (M === 'all') {
      const totalYear = monthlyTotals.reduce((a, b) => a + b, 0);
      monthlyAvg = totalYear / 12; // متوسط شهري على كامل السنة
    } else {
      const upto = M; // 0..M
      const sum = monthlyTotals.slice(0, upto + 1).reduce((a, b) => a + b, 0);
      monthlyAvg = (upto + 1) > 0 ? sum / (upto + 1) : 0;
    }

    // يومي: داخل الشهر المحدد، اجمع من 1..D واقسم على D
    let dailyAvg = 0;
    if (M === 'all') {
      // عندما لا يوجد شهر محدد: متوسط يومي سنوي = إجمالي السنة / عدد أيام السنة
      const totalYear = monthlyTotals.reduce((a, b) => a + b, 0);
      const isLeap = (Y % 4 === 0 && Y % 100 !== 0) || (Y % 400 === 0);
      dailyAvg = totalYear / (isLeap ? 366 : 365);
    } else {
      const daysInMonth = new Date(Y, M + 1, 0).getDate();
      const dailyTotals = Array.from({ length: daysInMonth }, () => 0);
      metrics.forEach((m: any) => {
        const d = typeof m.date === 'string' ? new Date(m.date) : (m.date?.toDate ? m.date.toDate() : new Date(m.date));
        if (d.getUTCFullYear() !== Y || d.getUTCMonth() !== M) return;
        const idx = d.getUTCDate() - 1;
        if (idx >= 0 && idx < daysInMonth) dailyTotals[idx] += Number(m.totalSales || 0);
      });
      const uptoDay = D === 'all' ? daysInMonth : Math.min(D, daysInMonth);
      const sum = dailyTotals.slice(0, uptoDay).reduce((a, b) => a + b, 0);
      dailyAvg = uptoDay > 0 ? sum / uptoDay : 0;
    }

    return { dailyAvgSales: dailyAvg, monthlyAvgSales: monthlyAvg };
  }, [allDateData, allStores, areaStoreFilter, dateFilter]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />
        <AreaStoreFilter stores={allStores} filters={areaStoreFilter} setFilters={setAreaStoreFilter} profile={profile} />
      </div>

      <MyTasks tasks={tasks} onUpdateStatus={onUpdateTaskStatus} isProcessing={isProcessing} />

      {dashboardPieFilter && (
        <div className="p-3 bg-orange-50 text-orange-800 rounded-lg flex justify-between items-center shadow-sm">
          <span>{t('filtered_by')} <strong>{dashboardPieFilter}</strong></span>
          <button onClick={() => setDashboardPieFilter(null)} className="font-bold text-lg">&times;</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {(isRecalculating || !displayKpiData) ? (
          [...Array(5)].map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard title={t('total_sales')} value={displayKpiData.totalSales} format={val => val.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })} icon={<CurrencyDollarIcon />} iconBgColor="bg-orange-100 text-orange-600" onClick={() => !isEmployee && setModalState({ type: 'kpiBreakdown', data: { title: t('total_sales'), kpi: 'totalSales', data: storeSummary } })} />
            <KPICard title={t('total_transactions')} value={displayKpiData.totalTransactions} format={val => val.toLocaleString('en-US')} icon={<ReceiptTaxIcon />} iconBgColor="bg-blue-100 text-blue-600" />
            <KPICard title={t('avg_transaction_value')} value={displayKpiData.averageTransactionValue} format={val => val.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })} icon={<ScaleIcon />} iconBgColor="bg-indigo-100 text-indigo-600" />
            {!isEmployee && (
              <>
                <KPICard title={t('conversion_rate')} value={displayKpiData.conversionRate} format={v => `${Math.round(v)}%`} icon={<ChartPieIcon />} iconBgColor="bg-amber-100 text-amber-600" />
                <KPICard title={t('sales_per_visitor')} value={displayKpiData.salesPerVisitor} format={val => val.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })} icon={<UsersIcon />} iconBgColor="bg-pink-100 text-pink-600" />
              </>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
        <div className="lg:col-span-3">
          {isRecalculating ? <ChartSkeleton /> : (
            <ChartCard title={
              <div className="flex items-center justify-between">
                <span>{lineChartTitle}</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-bold">ADS: {dailyAvgSales.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</span>
                  <span className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-bold">AMS: {monthlyAvgSales.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            }>
              <LineChart data={salesPerformance} />
            </ChartCard>
          )}
        </div>
        <div className="lg:col-span-2">
          {isRecalculating ? <ChartSkeleton /> : (
            <ChartCard title={t('sales_by_store')}>
              <PieChart data={storeSummary.map(s => ({ name: s.name, value: s.totalSales }))} onSliceClick={handlePieSliceClick} />
            </ChartCard>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {isRecalculating ? <ChartSkeleton /> : (
          <ChartCard title={t('top_stores_by_achievement')}>
            <BarChart data={[...storeSummary].sort((a, b) => b.targetAchievement - a.targetAchievement).slice(0, 10)} dataKey="targetAchievement" nameKey="name" format={val => `${Math.round(val)}%`} />
          </ChartCard>
        )}
        {isRecalculating ? <ChartSkeleton /> : (
          <ChartCard title={t('top_employees_by_achievement')}>
            <BarChart data={topEmployeesByAchievement} dataKey="achievement" nameKey="name" format={val => `${Math.round(val)}%`} />
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 mt-6">
        {isRecalculating ? <ChartSkeleton /> : (
          <ChartCard title={t('top_products_by_sales_value')}>
            <BarChart data={productPerformance.top5} dataKey="totalValue" nameKey="name" format={val => val.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })} />
          </ChartCard>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
