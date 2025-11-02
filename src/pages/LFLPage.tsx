import React, { useState, useMemo } from 'react';
import type { Store, DailyMetric, UserProfile } from '../types';
import { DetailedComparisonCard } from '../components/DashboardComponents';

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

    const renderComparisonSet = (title: string, data: { current: LFLData, previous: LFLData }) => (
        <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-xl font-semibold text-zinc-800 mb-4">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <DetailedComparisonCard title="Sales" current={data.current.totalSales} previous={data.previous.totalSales} />
                <DetailedComparisonCard title="Visitors" current={data.current.totalVisitors} previous={data.previous.totalVisitors} />
                <DetailedComparisonCard title="ATV" current={data.current.atv} previous={data.previous.atv} />
                <DetailedComparisonCard title="Transactions" current={data.current.totalTransactions} previous={data.previous.totalTransactions} />
                <DetailedComparisonCard title="Visitor Conversion Rate" current={data.current.visitorRate} previous={data.previous.visitorRate} isPercentage={true} />
                <DetailedComparisonCard title="Sales per Visitor" current={data.current.totalVisitors > 0 ? data.current.totalSales / data.current.totalVisitors : 0} previous={data.previous.totalVisitors > 0 ? data.previous.totalSales / data.previous.totalVisitors : 0} />
            </div>
        </div>
    );
    
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
