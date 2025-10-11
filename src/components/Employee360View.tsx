
import React, { useState, useMemo, useCallback } from 'react';
import { KPICard, ChartCard, BarChart, PieChart } from './DashboardComponents';
import { SparklesIcon } from './Icons';
import { calculateEffectiveTarget, getCategory } from '../utils/calculator';
import type { EmployeeSummary, DailyMetric, SalesTransaction, StoreSummary, DateFilter, ModalState } from '../types';
import { useLocale } from '../context/LocaleContext';

interface Employee360ViewProps {
    employee: EmployeeSummary;
    allMetrics: DailyMetric[];
    salesTransactions: SalesTransaction[];
    kingDuvetSales: SalesTransaction[];
    storeSummary: StoreSummary[];
    dateFilter: DateFilter;
    setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
    allEmployeeSummaries: EmployeeSummary[];
}

const Employee360View: React.FC<Employee360ViewProps> = ({ employee, allMetrics, salesTransactions, kingDuvetSales, storeSummary, dateFilter, setModalState, allEmployeeSummaries }) => {
    const { t } = useLocale();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const getDuvetCategory = useCallback((price: number) => {
        if (price >= 199 && price <= 399) return 'Low Value (199-399)';
        if (price >= 495 && price <= 695) return 'Medium Value (495-695)';
        if (price >= 795 && price <= 999) return 'High Value (795-999)';
        return null;
    }, []);
    
    const employeeData = useMemo(() => {
        // --- Date Filtering Logic ---
        const filterByDate = (item: DailyMetric | SalesTransaction) => {
            const itemTimestamp = 'date' in item ? item.date : item['Bill Dt.'];
            if (!itemTimestamp || typeof itemTimestamp.toDate !== 'function') return false;
            const itemDate = itemTimestamp.toDate();

            const yearMatch = dateFilter.year === 'all' || itemDate.getUTCFullYear() === dateFilter.year;
            const monthMatch = dateFilter.month === 'all' || itemDate.getUTCMonth() === dateFilter.month;
            const dayMatch = dateFilter.day === 'all' || itemDate.getUTCDate() === dateFilter.day;
            return yearMatch && monthMatch && dayMatch;
        };

        const filteredMetrics = allMetrics.filter(filterByDate);
        const filteredSalesTransactions = salesTransactions.filter(filterByDate);
        const filteredKingDuvetSales = kingDuvetSales.filter(filterByDate);

        // --- Basic Employee Metrics (uses filtered data) ---
        const metrics = filteredMetrics.filter(m => m.employee === employee.name);
        const totalSales = metrics.reduce((sum, m) => sum + (m.totalSales || 0), 0);
        // Compute transactions via distinct bill_no for accuracy
        const combinedSales = [...filteredSalesTransactions, ...filteredKingDuvetSales].filter(s => s['SalesMan Name'] === employee.name);
        const distinctBillsForEmployee = new Set<string>();
        combinedSales.forEach(s => {
            const bill = (s as any).bill_no || (s as any)['Bill_No'] || (s as any)['Invoice'] || (s as any)['Invoice No'] || (s as any)['Transaction_ID'] || '';
            if (bill) distinctBillsForEmployee.add(String(bill));
        });
        const totalTransactions = distinctBillsForEmployee.size || metrics.reduce((sum, m) => sum + (m.transactionCount || 0), 0);
        const atv = totalTransactions > 0 ? totalSales / totalTransactions : 0;
        const effectiveTarget = calculateEffectiveTarget(employee.targets, dateFilter);
        const achievement = effectiveTarget > 0 ? (totalSales / effectiveTarget) * 100 : 0;
        const totalItemsSold = combinedSales.reduce((sum, sale) => sum + (sale['Sold Qty'] || 0), 0);
        const avgItemsPerBill = totalTransactions > 0 ? totalItemsSold / totalTransactions : 0;

        // --- Peer Comparison Data (uses filtered data) ---
        // FIX: Add explicit type to the find() callback parameter to resolve type inference issues.
        const store = storeSummary.find((s: StoreSummary) => s.name === employee.store);
        const contributionPercentage = (store?.totalSales && store.totalSales > 0) ? (totalSales / store.totalSales) * 100 : 0;
        const storeAvgAtv = store?.atv || 0;
        const storeTotalItems = [...filteredSalesTransactions, ...filteredKingDuvetSales]
            .filter(s => s['Outlet Name'] === employee.store)
            .reduce((sum, s) => sum + (s['Sold Qty'] || 0), 0);
        // Store-level average uses distinct bills per store
        const distinctBillsForStore = new Set<string>();
        [...filteredSalesTransactions, ...filteredKingDuvetSales]
            .filter(s => s['Outlet Name'] === employee.store)
            .forEach(s => {
                const bill = (s as any).bill_no || (s as any)['Bill_No'] || (s as any)['Invoice'] || (s as any)['Invoice No'] || (s as any)['Transaction_ID'] || '';
                if (bill) distinctBillsForStore.add(String(bill));
            });
        const storeTotalTransactions = distinctBillsForStore.size || (store?.transactionCount || 0);
        const storeAvgUpt = storeTotalTransactions > 0 ? storeTotalItems / storeTotalTransactions : 0;
        
        // --- Interactive Category & Product Data (uses filtered data) ---
        // FIX: Explicitly typed the accumulator and initial value in the `reduce` function to resolve a TypeScript type inference issue.
        const productsByCategory = combinedSales.reduce((acc: {[key: string]: {totalSales: number, products: {[key: string]: number}}}, sale) => {
            const productInfo = { name: sale['Item Name'], alias: sale['Item Alias'] };
            const category = getCategory(productInfo);
            if (!acc[category]) acc[category] = { totalSales: 0, products: {} };
            const salesValue = (sale['Sold Qty'] || 0) * (sale['Item Rate'] || 0);
            acc[category].totalSales += salesValue;
            acc[category].products[sale['Item Name']] = (acc[category].products[sale['Item Name']] || 0) + (sale['Sold Qty'] || 0);
            return acc;
        }, {} as { [key: string]: {totalSales: number, products: {[key: string]: number}} });
        
        const categoryData = Object.entries(productsByCategory).map(([name, data]) => ({ name, value: data.totalSales }));

        // --- Duvet Sales for selected period (uses filtered data) ---
        const employeeDuvetSales = filteredKingDuvetSales.filter(s => s['SalesMan Name'] === employee.name);
        // FIX: Explicitly typed the accumulator in the `reduce` function.
        const duvetSummary = employeeDuvetSales.reduce((acc: {[key: string]: number}, sale) => {
            const category = getDuvetCategory(sale['Item Rate']);
            if (category) acc[category] = (acc[category] || 0) + (sale['Sold Qty'] || 0);
            return acc;
        }, { 'Low Value (199-399)': 0, 'Medium Value (495-695)': 0, 'High Value (795-999)': 0 });
        const totalDuvets = Object.values(duvetSummary).reduce((sum, count) => sum + count, 0);
        const duvetCategories = [
            { name: 'Low Value (199-399)', count: duvetSummary['Low Value (199-399)'] },
            { name: 'Medium Value (495-695)', count: duvetSummary['Medium Value (495-695)'] },
            { name: 'High Value (795-999)', count: duvetSummary['High Value (795-999)'] },
        ];

        // --- Dynamic & MTD Target Calculations (uses raw data, ignores global filter) ---
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const monthlyTarget = calculateEffectiveTarget(employee.targets, { year, month, day: 'all' });
        const salesThisMonth = allMetrics.filter(m => {
            if (m.employee !== employee.name || !m.date || typeof m.date.toDate !== 'function') return false;
            const metricDate = m.date.toDate();
            return metricDate.getFullYear() === year && metricDate.getMonth() === month;
        }).reduce((sum, m) => sum + (m.totalSales || 0), 0);
        const remainingTarget = monthlyTarget - salesThisMonth;
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        const remainingDays = Math.max(0, totalDaysInMonth - now.getDate() + 1);
        const requiredDailyAverage = remainingDays > 0 ? Math.max(0, remainingTarget) / remainingDays : 0;
        const dynamicTarget = { salesMTD: salesThisMonth, monthlyTarget, remainingTarget, remainingDays, requiredDailyAverage };

        const monthlyDuvetTarget = employee.duvetTargets?.[year]?.[String(month + 1)] || 0;
        const duvetsSoldThisMonth = kingDuvetSales.filter(s => {
            if (s['SalesMan Name'] !== employee.name || !s['Bill Dt.'] || typeof s['Bill Dt.'].toDate !== 'function') return false;
            const saleDate = s['Bill Dt.'].toDate();
            return saleDate.getFullYear() === year && saleDate.getMonth() === month;
        }).reduce((sum, s) => sum + (s['Sold Qty'] || 0), 0);
        const duvetAchievement = monthlyDuvetTarget > 0 ? (duvetsSoldThisMonth / monthlyDuvetTarget) * 100 : 0;
        const duvetTargetData = { target: monthlyDuvetTarget, sold: duvetsSoldThisMonth, achievement: duvetAchievement };

        return { 
            totalSales, atv, achievement, contributionPercentage, avgItemsPerBill,
            storeAvgAtv, storeAvgUpt, categoryData, productsByCategory,
            duvetCategories, totalDuvets, dynamicTarget, duvetTargetData
        };

    }, [employee, allMetrics, salesTransactions, kingDuvetSales, storeSummary, dateFilter, getDuvetCategory]);

    const topProductsInCategory: {name: string, soldQty: number}[] = useMemo(() => selectedCategory ? Object.entries(employeeData.productsByCategory[selectedCategory]?.products || {})
        .sort(([, qtyA], [, qtyB]) => Number(qtyB) - Number(qtyA))
        .slice(0, 5)
        .map(([name, soldQty]) => ({ name, soldQty: soldQty as number })) : [], [selectedCategory, employeeData.productsByCategory]);
        
    const handleCompare = () => {
        setModalState({
            type: 'aiComparison',
            data: {
                item: employee,
                allItems: allEmployeeSummaries,
                type: 'employee'
            }
        });
    };

    return (
        <div className="w-full">
            <div className="bg-gray-50 p-4 m-2 border-l-4 border-orange-500 rounded-r-lg animate-fade-in">
                <div className="flex justify-end mb-4">
                    <button onClick={handleCompare} className="btn-secondary text-sm flex items-center gap-1 py-1 px-2">
                        <SparklesIcon /> {t('compare_with_ai')}
                    </button>
                </div>

                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 my-4">
                    <KPICard title={t('total_sales')} value={employeeData.totalSales} format={v => v.toLocaleString('en-US', {style: 'currency', currency: 'SAR'})} />
                    <KPICard title={t('avg_transaction_value')} value={employeeData.atv} format={v => v.toLocaleString('en-US', {style: 'currency', currency: 'SAR'})} comparisonValue={employeeData.storeAvgAtv} comparisonLabel={t('store_avg')}/>
                    <KPICard title={t('items_per_bill')} value={employeeData.avgItemsPerBill} format={v => v.toFixed(2)} comparisonValue={employeeData.storeAvgUpt} comparisonLabel={t('store_avg')}/>
                    <KPICard title={t('achievement')} value={employeeData.achievement} format={v => `${v.toFixed(1)}%`} />
                    <KPICard title={t('contribution_to_store_sales')} value={employeeData.contributionPercentage} format={v => `${v.toFixed(1)}%`} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ChartCard title={selectedCategory ? `${t('top_products_in')} ${selectedCategory}` : t('sales_by_product_category')}>
                        {selectedCategory ? (
                            <div>
                                <button onClick={() => setSelectedCategory(null)} className="btn-secondary text-sm mb-4">{t('back_to_categories')}</button>
                                <BarChart data={topProductsInCategory} dataKey="soldQty" nameKey="name" format={v => `${v} units`} />
                            </div>
                        ) : (
                            <PieChart data={employeeData.categoryData} onSliceClick={(category) => setSelectedCategory(prev => prev === category ? null : category)} />
                        )}
                    </ChartCard>

                    <ChartCard title="Duvet Sales Analysis by Value">
                        <div className="space-y-2 p-1 h-full flex flex-col justify-center">
                            {employeeData.totalDuvets > 0 ? employeeData.duvetCategories.map(cat => {
                                const percentage = employeeData.totalDuvets > 0 ? (cat.count / employeeData.totalDuvets) * 100 : 0;
                                return (
                                    <div key={cat.name}>
                                        <div className="flex justify-between text-xs font-medium text-zinc-600 mb-1">
                                            <span>{cat.name}</span>
                                            <span>{cat.count} units ({percentage.toFixed(1)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-sky-500 h-3 rounded-full" style={{ width: `${percentage}%` }}></div></div>
                                    </div>
                                )
                            }) : <p className="text-center text-zinc-500">No duvet sales data for this period.</p>}
                            <div className="mt-auto pt-2 border-t border-gray-200">
                                <div className="flex justify-between items-center text-xs"><span className="font-semibold text-zinc-700">Monthly Duvet Target:</span><span className="font-bold">{employeeData.duvetTargetData.target}</span></div>
                                <div className="flex justify-between items-center text-xs mt-1"><span className="font-semibold text-zinc-700">Sold (MTD):</span><span className="font-bold">{employeeData.duvetTargetData.sold}</span></div>
                                <div className="flex justify-between items-center text-sm mt-1"><span className="font-bold text-green-700">Achievement (MTD):</span><span className="font-extrabold text-green-600">{employeeData.duvetTargetData.achievement.toFixed(1)}%</span></div>
                            </div>
                        </div>
                    </ChartCard>
                    <ChartCard title={t('dynamic_daily_target')}>
                        <div className="h-full flex flex-col justify-center">
                                <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span>{t('sales_this_month')} (MTD)</span><span className="font-semibold">{employeeData.dynamicTarget.salesMTD.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</span></div>
                                <div className="flex justify-between"><span>{t('monthly_target')}</span><span className="font-semibold">{employeeData.dynamicTarget.monthlyTarget.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</span></div>
                                <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold">{t('remaining_target')}</span><span className="font-bold text-red-600">{employeeData.dynamicTarget.remainingTarget > 0 ? employeeData.dynamicTarget.remainingTarget.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) : t('achieved')}</span></div>
                                <div className="flex justify-between"><span>{t('remaining_days')}</span><span className="font-semibold">{employeeData.dynamicTarget.remainingDays}</span></div>
                                <div className="flex justify-between items-center bg-orange-50 p-2 rounded-lg mt-2"><span className="font-bold text-orange-700">{t('required_daily_avg')}</span><span className="font-bold text-orange-700 text-md">{employeeData.dynamicTarget.requiredDailyAverage.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</span></div>
                            </div>
                        </div>
                    </ChartCard>
                </div>
            </div>
        </div>
    );
};

export default Employee360View;
