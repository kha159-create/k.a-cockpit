import React, { useState, useMemo } from 'react';
import type { Store, DailyMetric, UserProfile } from '../types';
import { DetailedComparisonCard, ChartCard, BarChart, LineChart, PieChart } from '../components/DashboardComponents';
import { Table, Column } from '../components/Table';
import * as XLSX from 'xlsx';
import { parseDateValue } from '../utils/date';

interface LFLPageProps {
    allStores: Store[];
    allMetrics: DailyMetric[];
    profile: UserProfile | null;
}

interface LFLData {
    totalSales: number;
    totalVisitors: number;
    totalTransactions: number;
    atv: number;
    visitorRate: number;
}

const ComparisonTypeSelector: React.FC<{ value: string, onChange: (value: string) => void }> = ({ value, onChange }) => {
    const types = [
        { id: 'daily', label: 'Daily' },
        { id: 'mtd', label: 'Month-to-Date' },
        { id: 'ytd', label: 'Year-to-Date' },
        { id: 'monthly', label: 'Full Month' },
        { id: 'dayRange', label: 'Day Range' },
    ];
    return (
        <div className="flex bg-gray-100 rounded-lg p-1 border">
            {types.map(type => (
                <button key={type.id}
                    onClick={() => onChange(type.id)}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all duration-200 ${
                        value === type.id ? 'bg-white shadow-sm text-orange-600' : 'text-zinc-600 hover:bg-gray-200'
                    }`}
                >
                    {type.label}
                </button>
            ))}
        </div>
    );
};


const LFLPage: React.FC<LFLPageProps> = ({ allStores, allMetrics, profile }) => {
    const [areaFilter, setAreaFilter] = useState('All');
    const [storeFilter, setStoreFilter] = useState('All');
    const [monthFilter, setMonthFilter] = useState(new Date().getMonth());
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
    const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [comparisonType, setComparisonType] = useState('daily');
    const [rangeAStart, setRangeAStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [rangeAEnd, setRangeAEnd] = useState(() => new Date().toISOString().split('T')[0]);
    const [rangeBStart, setRangeBStart] = useState('');
    const [rangeBEnd, setRangeBEnd] = useState('');
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

    const availableAreaManagers = useMemo(() => {
        const managers = new Set(allStores.map(s => s.areaManager).filter(Boolean));
        return ['All', ...Array.from(managers).sort()];
    }, [allStores]);

    const visibleStores = useMemo(() => {
        if (!profile) return [];
        
        let stores = allStores;
        
        // Apply role-based filtering first
        if (profile.role !== 'admin' && profile.role !== 'general_manager') {
            const { role, areaManager, store: userStoreName } = profile;
            if (role === 'area_manager') {
                stores = stores.filter(s => s.areaManager === areaManager);
            } else if (role === 'store_manager') {
                const userStore = stores.find(s => s.name === userStoreName);
                stores = userStore ? stores.filter(s => s.areaManager === userStore.areaManager) : [];
            } else if (role === 'employee') {
                stores = stores.filter(s => s.name === userStoreName);
            }
        }
        
        // Apply area filter
        if (areaFilter !== 'All') {
            stores = stores.filter(s => s.areaManager === areaFilter);
        }
        
        return stores;
    }, [allStores, profile, areaFilter]);

    const availableStoresForFilter = useMemo(() => {
        return visibleStores;
    }, [visibleStores]);

    const availableYears = useMemo(() => {
        const yearSet = new Set<number>();
        allMetrics.forEach(m => {
            if (m.date && typeof m.date.toDate === 'function') {
                const d = parseDateValue(m.date);
                if (!d) return;
                yearSet.add(d.getUTCFullYear());
            }
        });
        const currentYear = new Date().getFullYear();
        yearSet.add(currentYear);
        return Array.from(yearSet).sort((a, b) => b - a);
    }, [allMetrics]);

    const lflData = useMemo(() => {
        const processPeriod = (data: DailyMetric[], startDate: Date, endDate: Date): LFLData => {
            const filtered = data.filter(s => {
                if (!s.date || typeof s.date.toDate !== 'function') return false;
                const d = parseDateValue(s.date);
                if (!d) return;
                // Ensure we compare dates only, ignoring time part by using UTC
                const itemDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
                return itemDate >= startDate && itemDate <= endDate;
            });
            const totalSales = filtered.reduce((sum, item) => sum + (item.totalSales || 0), 0);
            const totalVisitors = filtered.reduce((sum, item) => sum + (item.visitors || 0), 0);
            const totalTransactions = filtered.reduce((sum, item) => sum + (item.transactionCount || 0), 0);
            return {
                totalSales, totalTransactions, totalVisitors,
                atv: totalTransactions > 0 ? totalSales / totalTransactions : 0,
                // Visitor rate is transaction / visitors
                visitorRate: totalVisitors > 0 ? (totalTransactions / totalVisitors) * 100 : 0,
            };
        };

        const parseYmd = (s: string) => {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        };

        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth();
        const currentDay = now.getUTCDate();
        const previousYear = currentYear - 1;

        // Filter metrics by store and area
        let dataForFilter = allMetrics;
        if (storeFilter !== 'All') {
            dataForFilter = dataForFilter.filter(s => s.store === storeFilter);
        } else if (areaFilter !== 'All') {
            // When storeFilter is 'All' but areaFilter is set, filter by area
            const storesInArea = visibleStores.map(s => s.name);
            const storeSet = new Set(storesInArea);
            dataForFilter = dataForFilter.filter(s => storeSet.has(s.store));
        }
        
        // Daily
        const dailyParts = dailyDate.split('-').map(Number);
        const selectedDay = new Date(Date.UTC(dailyParts[0], dailyParts[1] - 1, dailyParts[2]));
        const selectedDayLY = new Date(Date.UTC(selectedDay.getUTCFullYear() - 1, selectedDay.getUTCMonth(), selectedDay.getUTCDate()));
        const daily = {
            current: processPeriod(dataForFilter, selectedDay, selectedDay),
            previous: processPeriod(dataForFilter, selectedDayLY, selectedDayLY),
        };

        // MTD
        const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
        const yesterday = new Date(Date.UTC(currentYear, currentMonth, currentDay -1));
        const startOfMonthLY = new Date(Date.UTC(previousYear, currentMonth, 1));
        const yesterdayLY = new Date(Date.UTC(previousYear, currentMonth, currentDay-1));
        const mtd = {
            current: processPeriod(dataForFilter, startOfMonth, yesterday),
            previous: processPeriod(dataForFilter, startOfMonthLY, yesterdayLY),
        };
        
        // YTD
        const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
        const startOfYearLY = new Date(Date.UTC(previousYear, 0, 1));
        const ytd = {
            current: processPeriod(dataForFilter, startOfYear, yesterday),
            previous: processPeriod(dataForFilter, startOfYearLY, yesterdayLY),
        };

        // Full Month - use selected year and compare with previous year
        const selectedYear = yearFilter;
        const comparisonYear = selectedYear - 1; // Compare selected year with previous year
        const startOfMonthFilter = new Date(Date.UTC(selectedYear, monthFilter, 1));
        const endOfMonthFilter = new Date(Date.UTC(selectedYear, monthFilter + 1, 0));
        const startOfMonthFilterLY = new Date(Date.UTC(comparisonYear, monthFilter, 1));
        const endOfMonthFilterLY = new Date(Date.UTC(comparisonYear, monthFilter + 1, 0));
        const monthly = {
            current: processPeriod(dataForFilter, startOfMonthFilter, endOfMonthFilter),
            previous: processPeriod(dataForFilter, startOfMonthFilterLY, endOfMonthFilterLY),
        }

        // Day Range (custom vs custom)
        const hasRangeA = rangeAStart && rangeAEnd;
        const hasRangeB = rangeBStart && rangeBEnd;
        const rangeCurrentStart = hasRangeA ? parseYmd(rangeAStart) : startOfMonth;
        const rangeCurrentEnd = hasRangeA ? parseYmd(rangeAEnd) : now;
        const rangePrevStart = hasRangeB ? parseYmd(rangeBStart) : startOfMonthLY;
        const rangePrevEnd = hasRangeB ? parseYmd(rangeBEnd) : yesterdayLY;
        const dayRange = {
            current: processPeriod(dataForFilter, rangeCurrentStart, rangeCurrentEnd),
            previous: processPeriod(dataForFilter, rangePrevStart, rangePrevEnd),
        };

        return { daily, mtd, ytd, monthly, dayRange };
    }, [allMetrics, storeFilter, areaFilter, visibleStores, monthFilter, yearFilter, dailyDate, rangeAStart, rangeAEnd, rangeBStart, rangeBEnd]);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Prepare trend data for line chart (Monthly data from Jan to Dec)
    const trendData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;
        
        // Filter metrics by store and area
        let dataForFilter = allMetrics;
        if (storeFilter !== 'All') {
            dataForFilter = dataForFilter.filter(s => s.store === storeFilter);
        } else if (areaFilter !== 'All') {
            // When storeFilter is 'All' but areaFilter is set, filter by area
            const storesInArea = visibleStores.map(s => s.name);
            const storeSet = new Set(storesInArea);
            dataForFilter = dataForFilter.filter(s => storeSet.has(s.store));
        }

        const processMonth = (year: number, month: number) => {
            const startDate = new Date(Date.UTC(year, month, 1));
            const endDate = new Date(Date.UTC(year, month + 1, 0));
            const filtered = dataForFilter.filter(s => {
                if (!s.date || typeof s.date.toDate !== 'function') return false;
                const d = parseDateValue(s.date);
                if (!d) return;
                const itemDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
                return itemDate >= startDate && itemDate <= endDate;
            });
            const totalSales = filtered.reduce((sum, item) => sum + (item.totalSales || 0), 0);
            const totalVisitors = filtered.reduce((sum, item) => sum + (item.visitors || 0), 0);
            const totalTransactions = filtered.reduce((sum, item) => sum + (item.transactionCount || 0), 0);
            return {
                totalSales,
                totalVisitors,
                totalTransactions,
                atv: totalTransactions > 0 ? totalSales / totalTransactions : 0,
            };
        };

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const monthlyData = monthNames.map((monthName, monthIndex) => {
            const current = processMonth(currentYear, monthIndex);
            const previous = processMonth(previousYear, monthIndex);
            return {
                name: monthName,
                Current: current.totalSales,
                Previous: previous.totalSales,
                CurrentVisitors: current.totalVisitors,
                PreviousVisitors: previous.totalVisitors,
            };
        });

        return {
            sales: monthlyData.map(m => ({ name: m.name, Current: m.Current, Previous: m.Previous })),
            visitors: monthlyData.map(m => ({ name: m.name, Current: m.CurrentVisitors, Previous: m.PreviousVisitors })),
        };
    }, [allMetrics, storeFilter, areaFilter, visibleStores]);

    const renderComparisonSet = (title: string, data: { current: LFLData, previous: LFLData }) => {
        const metrics = [
            { key: 'sales', title: 'Sales', current: data.current.totalSales, previous: data.previous.totalSales, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
            { key: 'visitors', title: 'Visitors', current: data.current.totalVisitors, previous: data.previous.totalVisitors, format: (v: number) => v.toLocaleString('en-US') },
            { key: 'atv', title: 'ATV', current: data.current.atv, previous: data.previous.atv, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
            { key: 'transactions', title: 'Transactions', current: data.current.totalTransactions, previous: data.previous.totalTransactions, format: (v: number) => v.toLocaleString('en-US') },
            { key: 'visitorRate', title: 'Visitor Conversion Rate', current: data.current.visitorRate, previous: data.previous.visitorRate, format: (v: number) => `${Math.round(v)}%`, isPercentage: true },
            { key: 'salesPerVisitor', title: 'Sales per Visitor', current: data.current.totalVisitors > 0 ? data.current.totalSales / data.current.totalVisitors : 0, previous: data.previous.totalVisitors > 0 ? data.previous.totalSales / data.previous.totalVisitors : 0, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
        ];

        const chartData = selectedMetric 
            ? (() => {
                const metric = metrics.find(m => m.key === selectedMetric);
                if (!metric) return [];
                return [
                    { name: 'Current', value: metric.current },
                    { name: 'Previous', value: metric.previous }
                ];
            })()
            : [];

        // Prepare table data
        const tableData = metrics.map(metric => {
            const difference = metric.current - metric.previous;
            const percentageChange = metric.previous !== 0 ? (difference / Math.abs(metric.previous)) * 100 : metric.current > 0 ? 100 : 0;
            return {
                id: metric.key,
                metric: metric.title,
                current: metric.current,
                previous: metric.previous,
                difference: difference,
                percentageChange: percentageChange,
                formattedCurrent: metric.format(metric.current),
                formattedPrevious: metric.format(metric.previous),
                formattedDifference: metric.format(Math.abs(difference)),
                isCurrentPositive: difference >= 0,
                isPreviousPositive: metric.current >= metric.previous,
            };
        });

        const exportToExcel = () => {
            const workbook = XLSX.utils.book_new();

            // Get date information
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.toLocaleString('en-US', { month: 'long' });
            const currentDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            
            // Prepare header information
            const reportYear = comparisonType === 'monthly' ? yearFilter : currentYear;
            const reportMonth = comparisonType === 'monthly' ? months[monthFilter] : currentMonth;
            const headerInfo = [
                ['LFL Comparison Report'],
                [''],
                ['Report Title:', title],
                ['Store Filter:', storeFilter],
                ['Area Filter:', areaFilter],
                ['Comparison Type:', comparisonType.toUpperCase()],
                ['Generated Date:', currentDate],
                ['Year:', reportYear.toString()],
                ['Month:', reportMonth],
                ['']
            ];

            let excelData: any[] = [];
            let headerRow = 9;
            let columnHeaders: string[] = [];
            let storesToProcess: typeof visibleStores = [];

            if (storeFilter === 'All') {
                // Detailed report for all stores
                columnHeaders = ['Store', 'Area Manager', 'Metric', 'Current', 'Previous', 'Difference', 'Change %'];
                
                // Get current period data based on comparison type
                const currentData = data;
                
                // Process each store
                storesToProcess = visibleStores;
                const storeDataRows: any[] = [];
                
                storesToProcess.forEach(store => {
                    // Get store metrics
                    const storeMetrics = allMetrics.filter(m => m.store === store.name);
                    
                    // Process period for this store
                    const processStorePeriod = (storeMetrics: DailyMetric[], startDate: Date, endDate: Date): LFLData => {
                        const filtered = storeMetrics.filter(s => {
                            if (!s.date || typeof s.date.toDate !== 'function') return false;
                            const d = parseDateValue(s.date);
                            if (!d) return;
                            const itemDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
                            return itemDate >= startDate && itemDate <= endDate;
                        });
                        const totalSales = filtered.reduce((sum, item) => sum + (item.totalSales || 0), 0);
                        const totalVisitors = filtered.reduce((sum, item) => sum + (item.visitors || 0), 0);
                        const totalTransactions = filtered.reduce((sum, item) => sum + (item.transactionCount || 0), 0);
                        return {
                            totalSales, totalTransactions, totalVisitors,
                            atv: totalTransactions > 0 ? totalSales / totalTransactions : 0,
                            visitorRate: totalVisitors > 0 ? (totalTransactions / totalVisitors) * 100 : 0,
                        };
                    };

                    const parseYmd = (s: string) => {
                        const [y, m, d] = s.split('-').map(Number);
                        return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
                    };

                    const now = new Date();
                    const currentYear = now.getUTCFullYear();
                    const currentMonth = now.getUTCMonth();
                    const currentDay = now.getUTCDate();
                    const previousYear = currentYear - 1;

                    let storeCurrent: LFLData, storePrevious: LFLData;

                    if (comparisonType === 'daily') {
                        const dailyParts = dailyDate.split('-').map(Number);
                        const selectedDay = new Date(Date.UTC(dailyParts[0], dailyParts[1] - 1, dailyParts[2]));
                        const selectedDayLY = new Date(Date.UTC(selectedDay.getUTCFullYear() - 1, selectedDay.getUTCMonth(), selectedDay.getUTCDate()));
                        storeCurrent = processStorePeriod(storeMetrics, selectedDay, selectedDay);
                        storePrevious = processStorePeriod(storeMetrics, selectedDayLY, selectedDayLY);
                    } else if (comparisonType === 'mtd') {
                        const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
                        const yesterday = new Date(Date.UTC(currentYear, currentMonth, currentDay - 1));
                        const startOfMonthLY = new Date(Date.UTC(previousYear, currentMonth, 1));
                        const yesterdayLY = new Date(Date.UTC(previousYear, currentMonth, currentDay - 1));
                        storeCurrent = processStorePeriod(storeMetrics, startOfMonth, yesterday);
                        storePrevious = processStorePeriod(storeMetrics, startOfMonthLY, yesterdayLY);
                    } else if (comparisonType === 'ytd') {
                        const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
                        const yesterday = new Date(Date.UTC(currentYear, currentMonth, currentDay - 1));
                        const startOfYearLY = new Date(Date.UTC(previousYear, 0, 1));
                        const yesterdayLY = new Date(Date.UTC(previousYear, currentMonth, currentDay - 1));
                        storeCurrent = processStorePeriod(storeMetrics, startOfYear, yesterday);
                        storePrevious = processStorePeriod(storeMetrics, startOfYearLY, yesterdayLY);
                    } else if (comparisonType === 'monthly') {
                        const selectedYear = yearFilter;
                        const comparisonYear = selectedYear - 1;
                        const startOfMonthFilter = new Date(Date.UTC(selectedYear, monthFilter, 1));
                        const endOfMonthFilter = new Date(Date.UTC(selectedYear, monthFilter + 1, 0));
                        const startOfMonthFilterLY = new Date(Date.UTC(comparisonYear, monthFilter, 1));
                        const endOfMonthFilterLY = new Date(Date.UTC(comparisonYear, monthFilter + 1, 0));
                        storeCurrent = processStorePeriod(storeMetrics, startOfMonthFilter, endOfMonthFilter);
                        storePrevious = processStorePeriod(storeMetrics, startOfMonthFilterLY, endOfMonthFilterLY);
                    } else {
                        const hasRangeA = rangeAStart && rangeAEnd;
                        const hasRangeB = rangeBStart && rangeBEnd;
                        const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
                        const rangeCurrentStart = hasRangeA ? parseYmd(rangeAStart) : startOfMonth;
                        const rangeCurrentEnd = hasRangeA ? parseYmd(rangeAEnd) : now;
                        const startOfMonthLY = new Date(Date.UTC(previousYear, currentMonth, 1));
                        const yesterdayLY = new Date(Date.UTC(previousYear, currentMonth, currentDay - 1));
                        const rangePrevStart = hasRangeB ? parseYmd(rangeBStart) : startOfMonthLY;
                        const rangePrevEnd = hasRangeB ? parseYmd(rangeBEnd) : yesterdayLY;
                        storeCurrent = processStorePeriod(storeMetrics, rangeCurrentStart, rangeCurrentEnd);
                        storePrevious = processStorePeriod(storeMetrics, rangePrevStart, rangePrevEnd);
                    }

                    // Add rows for each metric
                    const storeMetricsData = [
                        { key: 'sales', title: 'Sales', current: storeCurrent.totalSales, previous: storePrevious.totalSales, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
                        { key: 'visitors', title: 'Visitors', current: storeCurrent.totalVisitors, previous: storePrevious.totalVisitors, format: (v: number) => v.toLocaleString('en-US') },
                        { key: 'atv', title: 'ATV', current: storeCurrent.atv, previous: storePrevious.atv, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
                        { key: 'transactions', title: 'Transactions', current: storeCurrent.totalTransactions, previous: storePrevious.totalTransactions, format: (v: number) => v.toLocaleString('en-US') },
                        { key: 'visitorRate', title: 'Visitor Conversion Rate', current: storeCurrent.visitorRate, previous: storePrevious.visitorRate, format: (v: number) => `${Math.round(v)}%`, isPercentage: true },
                        { key: 'salesPerVisitor', title: 'Sales per Visitor', current: storeCurrent.totalVisitors > 0 ? storeCurrent.totalSales / storeCurrent.totalVisitors : 0, previous: storePrevious.totalVisitors > 0 ? storePrevious.totalSales / storePrevious.totalVisitors : 0, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
                    ];

                    storeMetricsData.forEach(metric => {
                        const difference = metric.current - metric.previous;
                        const percentageChange = metric.previous !== 0 ? (difference / Math.abs(metric.previous)) * 100 : metric.current > 0 ? 100 : 0;
                        const isPercentage = metric.isPercentage;
                        storeDataRows.push([
                            store.name,
                            store.areaManager || '-',
                            metric.title,
                            isPercentage ? metric.current / 100 : Math.round(metric.current),
                            isPercentage ? metric.previous / 100 : Math.round(metric.previous),
                            isPercentage ? difference / 100 : Math.round(difference),
                            percentageChange
                        ]);
                    });
                });

                // Add summary row (All Stores Total)
                const summaryMetrics = [
                    { key: 'sales', title: 'Sales', current: data.current.totalSales, previous: data.previous.totalSales },
                    { key: 'visitors', title: 'Visitors', current: data.current.totalVisitors, previous: data.previous.totalVisitors },
                    { key: 'atv', title: 'ATV', current: data.current.atv, previous: data.previous.atv },
                    { key: 'transactions', title: 'Transactions', current: data.current.totalTransactions, previous: data.previous.totalTransactions },
                    { key: 'visitorRate', title: 'Visitor Conversion Rate', current: data.current.visitorRate, previous: data.previous.visitorRate },
                    { key: 'salesPerVisitor', title: 'Sales per Visitor', current: data.current.totalVisitors > 0 ? data.current.totalSales / data.current.totalVisitors : 0, previous: data.previous.totalVisitors > 0 ? data.previous.totalSales / data.previous.totalVisitors : 0 },
                ];

                summaryMetrics.forEach(metric => {
                    const difference = metric.current - metric.previous;
                    const percentageChange = metric.previous !== 0 ? (difference / Math.abs(metric.previous)) * 100 : metric.current > 0 ? 100 : 0;
                    const isPercentage = metric.key === 'visitorRate';
                    storeDataRows.push([
                        'ALL STORES (TOTAL)',
                        '-',
                        metric.title,
                        isPercentage ? metric.current / 100 : Math.round(metric.current),
                        isPercentage ? metric.previous / 100 : Math.round(metric.previous),
                        isPercentage ? difference / 100 : Math.round(difference),
                        percentageChange
                    ]);
                });

                excelData = [
                    ...headerInfo,
                    columnHeaders,
                    ...storeDataRows
                ];
            } else {
                // Single store report (existing format)
                columnHeaders = ['Metric', 'Current', 'Previous', 'Difference', 'Change %'];
                excelData = [
                    ...headerInfo,
                    columnHeaders,
                    ...tableData.map(row => {
                        const isPercentage = row.metric === 'Visitor Conversion Rate';
                        return [
                            row.metric,
                            isPercentage ? row.current / 100 : Math.round(row.current),
                            isPercentage ? row.previous / 100 : Math.round(row.previous),
                            isPercentage ? row.difference / 100 : Math.round(row.difference),
                            row.percentageChange
                        ];
                    })
                ];
            }

            // Create worksheet
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);

            // Set column widths based on report type
            if (storeFilter === 'All') {
                worksheet['!cols'] = [
                    { wch: 25 }, // Store
                    { wch: 20 }, // Area Manager
                    { wch: 25 }, // Metric
                    { wch: 18 }, // Current
                    { wch: 18 }, // Previous
                    { wch: 18 }, // Difference
                    { wch: 15 }  // Change %
                ];
            } else {
                worksheet['!cols'] = [
                    { wch: 25 }, // Metric
                    { wch: 18 }, // Current
                    { wch: 18 }, // Previous
                    { wch: 18 }, // Difference
                    { wch: 15 }  // Change %
                ];
            }

            // Format header row (row 10, 0-indexed)
            const headerCols = storeFilter === 'All' ? ['A', 'B', 'C', 'D', 'E', 'F', 'G'] : ['A', 'B', 'C', 'D', 'E'];
            
            headerCols.forEach(col => {
                const cellRef = `${col}${headerRow + 1}`;
                if (!worksheet[cellRef]) return;
                worksheet[cellRef].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: 'F97316' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } }
                    }
                };
            });

            // Format title row
            if (worksheet['A1']) {
                worksheet['A1'].s = {
                    font: { bold: true, sz: 16, color: { rgb: 'F97316' } },
                    alignment: { horizontal: 'left' }
                };
            }

            // Format data rows with numbers
            const dataStartRow = headerRow + 2;
            const totalDataRows = storeFilter === 'All' 
                ? (storesToProcess.length * 6) + 6 // Each store has 6 metrics + 6 summary rows
                : tableData.length;

            for (let i = 0; i < totalDataRows; i++) {
                const rowNum = dataStartRow + i;
                const rowData = excelData[headerRow + 1 + i];
                if (!rowData) continue;

                if (storeFilter === 'All') {
                    // Format: Store, Area Manager, Metric, Current, Previous, Difference, Change %
                    const metricName = rowData[2]; // Metric column
                    const isCurrency = ['Sales', 'ATV', 'Sales per Visitor'].includes(metricName);
                    const isPercentage = metricName === 'Visitor Conversion Rate';
                    
                    // Format Current (column D)
                    const currentCellRef = `D${rowNum}`;
                    const currentValue = Number(rowData[3]);
                    if (worksheet[currentCellRef]) {
                        if (isPercentage) {
                            worksheet[currentCellRef].z = '0.00%';
                            worksheet[currentCellRef].s = { 
                                numFmt: '0.00%', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: currentValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        } else if (isCurrency) {
                            worksheet[currentCellRef].z = '#,##0';
                            worksheet[currentCellRef].s = { 
                                numFmt: '#,##0', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: currentValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        } else {
                            worksheet[currentCellRef].z = '#,##0';
                            worksheet[currentCellRef].s = { 
                                numFmt: '#,##0', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: currentValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        }
                    }

                    // Format Previous (column E)
                    const previousCellRef = `E${rowNum}`;
                    const previousValue = Number(rowData[4]);
                    if (worksheet[previousCellRef]) {
                        if (isPercentage) {
                            worksheet[previousCellRef].z = '0.00%';
                            worksheet[previousCellRef].s = { 
                                numFmt: '0.00%', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: previousValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        } else if (isCurrency) {
                            worksheet[previousCellRef].z = '#,##0';
                            worksheet[previousCellRef].s = { 
                                numFmt: '#,##0', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: previousValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        } else {
                            worksheet[previousCellRef].z = '#,##0';
                            worksheet[previousCellRef].s = { 
                                numFmt: '#,##0', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: previousValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        }
                    }

                    // Format Difference (column F)
                    const differenceCellRef = `F${rowNum}`;
                    const differenceValue = Number(rowData[5]);
                    if (worksheet[differenceCellRef]) {
                        if (isPercentage) {
                            worksheet[differenceCellRef].z = '0.00%';
                            worksheet[differenceCellRef].s = { 
                                numFmt: '0.00%', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: differenceValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        } else if (isCurrency) {
                            worksheet[differenceCellRef].z = '#,##0';
                            worksheet[differenceCellRef].s = { 
                                numFmt: '#,##0', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: differenceValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        } else {
                            worksheet[differenceCellRef].z = '#,##0';
                            worksheet[differenceCellRef].s = { 
                                numFmt: '#,##0', 
                                alignment: { horizontal: 'right' },
                                font: { color: { rgb: differenceValue >= 0 ? '008000' : 'FF0000' } }
                            };
                        }
                    }

                    // Format Change % (column G)
                    const changeCellRef = `G${rowNum}`;
                    if (worksheet[changeCellRef] && rowData[6] !== undefined) {
                        const percentageValue = Number(rowData[6]) / 100;
                        worksheet[changeCellRef].v = percentageValue;
                        worksheet[changeCellRef].z = '0.00%';
                        worksheet[changeCellRef].s = {
                            numFmt: '0.00%',
                            font: { 
                                bold: true,
                                color: { rgb: percentageValue >= 0 ? '008000' : 'FF0000' } 
                            },
                            alignment: { horizontal: 'center', vertical: 'center' }
                        };
                    }

                    // Highlight summary rows (ALL STORES)
                    if (rowData[0] === 'ALL STORES (TOTAL)') {
                        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
                            const cellRef = `${col}${rowNum}`;
                            if (worksheet[cellRef]) {
                                worksheet[cellRef].s = {
                                    ...(worksheet[cellRef].s || {}),
                                    fill: { fgColor: { rgb: 'FFF3E0' } },
                                    font: { bold: true }
                                };
                            }
                        });
                    }
                } else {
                    // Single store format (existing)
                    const row = tableData[i];
                    if (!row) continue;
                    
                    const isCurrency = ['Sales', 'ATV', 'Sales per Visitor'].includes(row.metric);
                    const isPercentage = row.metric === 'Visitor Conversion Rate';
                    
                    ['B', 'C', 'D'].forEach((col, idx) => {
                        const cellRef = `${col}${rowNum}`;
                        const cellValue = idx === 0 ? row.current : idx === 1 ? row.previous : row.difference;
                        if (worksheet[cellRef]) {
                            if (isPercentage) {
                                worksheet[cellRef].z = '0.00%';
                                worksheet[cellRef].s = { 
                                    numFmt: '0.00%', 
                                    alignment: { horizontal: 'right' },
                                    font: { color: { rgb: cellValue >= 0 ? '008000' : 'FF0000' } }
                                };
                            } else if (isCurrency) {
                                worksheet[cellRef].z = '#,##0';
                                worksheet[cellRef].s = { 
                                    numFmt: '#,##0', 
                                    alignment: { horizontal: 'right' },
                                    font: { color: { rgb: cellValue >= 0 ? '008000' : 'FF0000' } }
                                };
                            } else {
                                worksheet[cellRef].z = '#,##0';
                                worksheet[cellRef].s = { 
                                    numFmt: '#,##0', 
                                    alignment: { horizontal: 'right' },
                                    font: { color: { rgb: cellValue >= 0 ? '008000' : 'FF0000' } }
                                };
                            }
                        }
                    });

                    const changeCellRef = `E${rowNum}`;
                    if (worksheet[changeCellRef]) {
                        const percentageValue = row.percentageChange / 100;
                        worksheet[changeCellRef].v = percentageValue;
                        worksheet[changeCellRef].z = '0.00%';
                        worksheet[changeCellRef].s = {
                            numFmt: '0.00%',
                            font: { 
                                bold: true,
                                color: { rgb: row.percentageChange >= 0 ? '008000' : 'FF0000' } 
                            },
                            alignment: { horizontal: 'center', vertical: 'center' }
                        };
                    }
                }
            }

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Comparison');

            // Generate filename with date
            const fileName = `LFL_Comparison_${title.replace(/[^a-z0-9]/gi, '_')}_${currentYear}_${currentMonth}_${now.getDate()}.xlsx`;
            
            // Write file
            XLSX.writeFile(workbook, fileName);
        };

        const tableColumns: Column<typeof tableData[0]>[] = [
            { key: 'metric', label: 'Metric', sortable: true, render: (value) => value as string },
            { 
                key: 'formattedCurrent', 
                label: 'Current', 
                sortable: true, 
                render: (value, record) => {
                    const isPositive = record.isCurrentPositive;
                    return (
                        <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {value as string}
                        </span>
                    );
                }
            },
            { 
                key: 'formattedPrevious', 
                label: 'Previous', 
                sortable: true, 
                render: (value, record) => {
                    const isPositive = record.isPreviousPositive;
                    return (
                        <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {value as string}
                        </span>
                    );
                }
            },
            { 
                key: 'formattedDifference', 
                label: 'Difference', 
                sortable: true, 
                render: (value, record) => {
                    const isPositive = record.difference >= 0;
                    return (
                        <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {isPositive ? '+' : '-'}{value as string}
                        </span>
                    );
                }
            },
            { 
                key: 'percentageChange', 
                label: 'Change %', 
                sortable: true, 
                render: (value, record) => {
                    const change = record.percentageChange;
                    const isPositive = change >= 0;
                    return (
                        <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {isPositive ? '▲' : '▼'} {Math.round(Math.abs(change))}%
                        </span>
                    );
                }
            },
        ];

        return (
            <div className="mt-6 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-zinc-800">{title}</h3>
                        {storeFilter !== 'All' && (
                            <span className="text-sm font-normal text-orange-500">{storeFilter}</span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                        {metrics.map(metric => (
                            <div 
                                key={metric.key}
                                onClick={() => setSelectedMetric(selectedMetric === metric.key ? null : metric.key)}
                                className={`cursor-pointer transition-all duration-200 ${
                                    selectedMetric === metric.key 
                                        ? 'transform scale-105' 
                                        : 'hover:transform hover:scale-102'
                                }`}
                            >
                                <div className={`${selectedMetric === metric.key ? 'ring-2 ring-orange-500 shadow-lg' : ''}`}>
                                    <DetailedComparisonCard 
                                        title={metric.title} 
                                        current={metric.current} 
                                        previous={metric.previous} 
                                        isPercentage={metric.isPercentage}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Dynamic Bar Chart */}
                {selectedMetric && chartData.length > 0 && (
                    <ChartCard 
                        title={`${metrics.find(m => m.key === selectedMetric)?.title} Comparison`}
                        watermark={storeFilter !== 'All' ? storeFilter : undefined}
                        watermarkOpacity={storeFilter !== 'All' ? 0.15 : 0}
                    >
                        <BarChart 
                            data={chartData} 
                            dataKey="value" 
                            nameKey="name" 
                            format={(v: number) => {
                                const metric = metrics.find(m => m.key === selectedMetric);
                                return metric ? metric.format(v) : v.toLocaleString('en-US');
                            }} 
                        />
                    </ChartCard>
                )}

                {/* Trend Line Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ChartCard 
                        title="Sales Trend (Daily, MTD, YTD)"
                        watermark={storeFilter !== 'All' ? storeFilter : undefined}
                        watermarkOpacity={storeFilter !== 'All' ? 0.15 : 0}
                    >
                        <LineChart data={trendData.sales} />
                    </ChartCard>
                    <ChartCard 
                        title="Visitors Trend (Daily, MTD, YTD)"
                        watermark={storeFilter !== 'All' ? storeFilter : undefined}
                        watermarkOpacity={storeFilter !== 'All' ? 0.15 : 0}
                    >
                        <LineChart data={trendData.visitors} />
                    </ChartCard>
                </div>

                {/* Detailed Comparison Table */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-zinc-800">Detailed Comparison Table</h3>
                        <button 
                            onClick={exportToExcel}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200 flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export to Excel
                        </button>
                    </div>
                    <Table columns={tableColumns} data={tableData} initialSortKey="metric" />
                </div>
        </div>
    );
    };
    
    const selectedDayForTitle = new Date(dailyDate);

    const renderContent = () => {
        switch (comparisonType) {
            case 'daily':
                return renderComparisonSet(`Daily Comparison (${selectedDayForTitle.toLocaleDateString('en-CA')} vs Same Day Last Year)`, lflData.daily);
            case 'mtd':
                return renderComparisonSet(`Month-to-Date Comparison (MTD vs MTD Last Year)`, lflData.mtd);
            case 'ytd':
                return renderComparisonSet(`Year-to-Date Comparison (YTD vs YTD Last Year)`, lflData.ytd);
            case 'monthly':
                const comparisonYear = yearFilter - 1;
                return renderComparisonSet(`Full Month Comparison (${months[monthFilter]} ${yearFilter} vs ${comparisonYear})`, lflData.monthly);
            case 'dayRange':
                return renderComparisonSet(
                    `Day Range Comparison (${rangeAStart || '—'} to ${rangeAEnd || '—'} vs ${rangeBStart || '—'} to ${rangeBEnd || '—'})`,
                    lflData.dayRange
                );
            default:
                return null;
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(profile?.role === 'admin' || profile?.role === 'general_manager') && (
                        <div>
                            <label className="label">Filter by Area:</label>
                            <select 
                                value={areaFilter} 
                                onChange={e => {
                                    setAreaFilter(e.target.value);
                                    setStoreFilter('All'); // Reset store filter when area changes
                                }} 
                                className="input"
                            >
                                {availableAreaManagers.map(area => (
                                    <option key={area} value={area}>{area === 'All' ? 'All Areas' : area}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="label">Filter by Store:</label>
                        <select 
                            value={storeFilter} 
                            onChange={e => setStoreFilter(e.target.value)} 
                            className="input" 
                            disabled={profile?.role === 'employee'}
                        >
                            <option value="All">All Stores</option>
                            {availableStoresForFilter.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label className="label">Select Comparison Type:</label>
                        <ComparisonTypeSelector value={comparisonType} onChange={setComparisonType} />
                    </div>
                </div>
                {comparisonType === 'daily' && (
                    <div>
                        <label className="label">Select Day for Daily Comparison:</label>
                        <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className="input" />
                    </div>
                )}
                 {comparisonType === 'monthly' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Select Year for Full Month Comparison:</label>
                            <select value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))} className="input">
                                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Select Month for Full Month Comparison:</label>
                            <select value={monthFilter} onChange={e => setMonthFilter(Number(e.target.value))} className="input">
                                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                )}
                {comparisonType === 'dayRange' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="label">Range A (Current):</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input type="date" value={rangeAStart} onChange={e => setRangeAStart(e.target.value)} className="input" />
                                <input type="date" value={rangeAEnd} onChange={e => setRangeAEnd(e.target.value)} className="input" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="label">Range B (Compare To):</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input type="date" value={rangeBStart} onChange={e => setRangeBStart(e.target.value)} className="input" />
                                <input type="date" value={rangeBEnd} onChange={e => setRangeBEnd(e.target.value)} className="input" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {renderContent()}
        </div>
    );
};

export default LFLPage;
