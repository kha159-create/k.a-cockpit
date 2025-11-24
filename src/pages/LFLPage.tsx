import React, { useState, useMemo } from 'react';
import type { Store, DailyMetric, UserProfile } from '../types';
import { DetailedComparisonCard, ChartCard, BarChart, LineChart, PieChart } from '../components/DashboardComponents';
import { Table, Column } from '../components/Table';

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
    const [storeFilter, setStoreFilter] = useState('All');
    const [monthFilter, setMonthFilter] = useState(new Date().getMonth());
    const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [comparisonType, setComparisonType] = useState('daily');
    const [rangeAStart, setRangeAStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [rangeAEnd, setRangeAEnd] = useState(() => new Date().toISOString().split('T')[0]);
    const [rangeBStart, setRangeBStart] = useState('');
    const [rangeBEnd, setRangeBEnd] = useState('');
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

    const visibleStores = useMemo(() => {
        if (!profile) return [];
        if (profile.role === 'admin' || profile.role === 'general_manager') return allStores;
        
        const { role, areaManager, store: userStoreName } = profile;
        if (role === 'area_manager') {
            return allStores.filter(s => s.areaManager === areaManager);
        }
        if (role === 'store_manager') {
            const userStore = allStores.find(s => s.name === userStoreName);
            return userStore ? allStores.filter(s => s.areaManager === userStore.areaManager) : [];
        }
        if (role === 'employee') {
            return allStores.filter(s => s.name === userStoreName);
        }
        return [];
    }, [allStores, profile]);

    const lflData = useMemo(() => {
        const processPeriod = (data: DailyMetric[], startDate: Date, endDate: Date): LFLData => {
            const filtered = data.filter(s => {
                if (!s.date || typeof s.date.toDate !== 'function') return false;
                const d = s.date.toDate();
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

        const dataForFilter = storeFilter === 'All' ? allMetrics : allMetrics.filter(s => s.store === storeFilter);
        
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

        // Full Month
        const startOfMonthFilter = new Date(Date.UTC(currentYear, monthFilter, 1));
        const endOfMonthFilter = new Date(Date.UTC(currentYear, monthFilter + 1, 0));
        const startOfMonthFilterLY = new Date(Date.UTC(previousYear, monthFilter, 1));
        const endOfMonthFilterLY = new Date(Date.UTC(previousYear, monthFilter + 1, 0));
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
    }, [allMetrics, storeFilter, monthFilter, dailyDate, rangeAStart, rangeAEnd, rangeBStart, rangeBEnd]);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Prepare trend data for line chart (Monthly data from Jan to Dec)
    const trendData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;
        const dataForFilter = storeFilter === 'All' ? allMetrics : allMetrics.filter(s => s.store === storeFilter);

        const processMonth = (year: number, month: number) => {
            const startDate = new Date(Date.UTC(year, month, 1));
            const endDate = new Date(Date.UTC(year, month + 1, 0));
            const filtered = dataForFilter.filter(s => {
                if (!s.date || typeof s.date.toDate !== 'function') return false;
                const d = s.date.toDate();
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
    }, [allMetrics, storeFilter]);

    const renderComparisonSet = (title: string, data: { current: LFLData, previous: LFLData }) => {
        const metrics = [
            { key: 'sales', title: 'Sales', current: data.current.totalSales, previous: data.previous.totalSales, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
            { key: 'visitors', title: 'Visitors', current: data.current.totalVisitors, previous: data.previous.totalVisitors, format: (v: number) => v.toLocaleString('en-US') },
            { key: 'atv', title: 'ATV', current: data.current.atv, previous: data.previous.atv, format: (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }) },
            { key: 'transactions', title: 'Transactions', current: data.current.totalTransactions, previous: data.previous.totalTransactions, format: (v: number) => v.toLocaleString('en-US') },
            { key: 'visitorRate', title: 'Visitor Conversion Rate', current: data.current.visitorRate, previous: data.previous.visitorRate, format: (v: number) => `${v.toFixed(1)}%`, isPercentage: true },
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
            };
        });

        const exportToExcel = () => {
            if (typeof (window as any).XLSX === 'undefined') {
                alert('Excel library is loading. Please try again in a moment.');
                return;
            }

            const XLSX = (window as any).XLSX;
            const workbook = XLSX.utils.book_new();

            // Get date information
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.toLocaleString('en-US', { month: 'long' });
            const currentDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            
            // Prepare header information
            const headerInfo = [
                ['LFL Comparison Report'],
                [''],
                ['Report Title:', title],
                ['Store Filter:', storeFilter],
                ['Comparison Type:', comparisonType.toUpperCase()],
                ['Generated Date:', currentDate],
                ['Year:', currentYear.toString()],
                ['Month:', currentMonth],
                ['']
            ];

            // Prepare data with proper formatting
            const excelData = [
                ...headerInfo,
                ['Metric', 'Current', 'Previous', 'Difference', 'Change %'],
                ...tableData.map(row => [
                    row.metric,
                    row.current, // Use raw numbers for Excel formatting
                    row.previous,
                    row.difference,
                    row.percentageChange
                ])
            ];

            // Create worksheet
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);

            // Set column widths
            worksheet['!cols'] = [
                { wch: 25 }, // Metric
                { wch: 18 }, // Current
                { wch: 18 }, // Previous
                { wch: 18 }, // Difference
                { wch: 15 }  // Change %
            ];

            // Format header row (row 10, 0-indexed)
            const headerRow = 9;
            ['A', 'B', 'C', 'D', 'E'].forEach(col => {
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
            tableData.forEach((row, index) => {
                const rowNum = headerRow + 2 + index;
                
                // Format Current, Previous, Difference columns as numbers
                // Check if it's a currency metric (sales, atv, salesPerVisitor)
                const isCurrency = ['Sales', 'ATV', 'Sales per Visitor'].includes(row.metric);
                const isPercentage = row.metric === 'Visitor Conversion Rate';
                
                ['B', 'C', 'D'].forEach(col => {
                    const cellRef = `${col}${rowNum}`;
                    if (worksheet[cellRef]) {
                        if (isPercentage) {
                            worksheet[cellRef].z = '0.00%';
                            worksheet[cellRef].s = {
                                numFmt: '0.00%',
                                alignment: { horizontal: 'right' }
                            };
                        } else if (isCurrency) {
                            worksheet[cellRef].z = '#,##0.00';
                            worksheet[cellRef].s = {
                                numFmt: '#,##0.00',
                                alignment: { horizontal: 'right' }
                            };
                        } else {
                            worksheet[cellRef].z = '#,##0';
                            worksheet[cellRef].s = {
                                numFmt: '#,##0',
                                alignment: { horizontal: 'right' }
                            };
                        }
                    }
                });

                // Format Change % column
                const changeCellRef = `E${rowNum}`;
                if (worksheet[changeCellRef]) {
                    // Convert percentage to decimal for Excel (e.g., 15.5% -> 0.155)
                    const percentageValue = row.percentageChange / 100;
                    worksheet[changeCellRef].v = percentageValue;
                    worksheet[changeCellRef].z = '0.0%';
                    worksheet[changeCellRef].s = {
                        numFmt: '0.0%',
                        font: { 
                            bold: true,
                            color: { rgb: row.percentageChange >= 0 ? '008000' : 'FF0000' } 
                        },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
            });

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Comparison');

            // Generate filename with date
            const fileName = `LFL_Comparison_${title.replace(/[^a-z0-9]/gi, '_')}_${currentYear}_${currentMonth}_${now.getDate()}.xlsx`;
            
            // Write file
            XLSX.writeFile(workbook, fileName);
        };

        const tableColumns: Column<typeof tableData[0]>[] = [
            { key: 'metric', label: 'Metric', sortable: true, render: (value) => value as string },
            { key: 'formattedCurrent', label: 'Current', sortable: true, render: (value) => value as string },
            { key: 'formattedPrevious', label: 'Previous', sortable: true, render: (value) => value as string },
            { key: 'formattedDifference', label: 'Difference', sortable: true, render: (value) => value as string },
            { 
                key: 'percentageChange', 
                label: 'Change %', 
                sortable: true, 
                render: (value, record) => {
                    const change = record.percentageChange;
                    const isPositive = change >= 0;
                    return (
                        <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                        </span>
                    );
                }
            },
        ];

        return (
            <div className="mt-6 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-zinc-800 mb-4">{title}</h3>
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
                    <ChartCard title={`${metrics.find(m => m.key === selectedMetric)?.title} Comparison`}>
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
                    <ChartCard title="Sales Trend (Daily, MTD, YTD)">
                        <LineChart data={trendData.sales} />
                    </ChartCard>
                    <ChartCard title="Visitors Trend (Daily, MTD, YTD)">
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
                return renderComparisonSet(`Full Month Comparison (${months[monthFilter]} ${currentYear} vs ${previousYear})`, lflData.monthly);
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Filter by Store:</label>
                        <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="input" disabled={profile?.role === 'employee'}>
                            <option value="All">All Stores</option>
                            {visibleStores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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
                    <div>
                        <label className="label">Select Month for Full Month Comparison:</label>
                        <select value={monthFilter} onChange={e => setMonthFilter(Number(e.target.value))} className="input">
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
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
