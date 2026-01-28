import React, { useState, useMemo } from 'react';
import { SparklesIcon, ArrowLeftIcon } from '../components/Icons';
import { KPICard, ChartCard } from '../components/DashboardComponents';
import MonthYearFilter from '../components/MonthYearFilter';
import CustomBusinessRules from '../components/CustomBusinessRules';
import type { StoreSummary, DailyMetric, ModalState, DateFilter, FilterableData, UserProfile, BusinessRule, SalesTransaction } from '../types';
import { calculateEffectiveTarget } from '../utils/calculator';
import { generateText } from '../services/geminiService';
import { useLocale } from '../context/LocaleContext';

interface StoreDetailPageProps {
    store: StoreSummary;
    allMetrics: DailyMetric[];
    onBack: () => void;
    allStores: StoreSummary[];
    setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
    allDateData: FilterableData[];
    profile: UserProfile | null;
    businessRules: BusinessRule[];
    onSaveRule: (rule: string, existingId?: string) => void;
    onDeleteRule: (id: string) => void;
    isProcessing: boolean;
    storesDateFilter: DateFilter; // Receive storesDateFilter to maintain filter state
    setStoresDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>; // To update storesDateFilter
}

const StoreDetailPage: React.FC<StoreDetailPageProps> = ({
    store,
    allMetrics,
    onBack,
    allStores,
    setModalState,
    allDateData,
    profile,
    businessRules,
    onSaveRule,
    onDeleteRule,
    isProcessing,
    storesDateFilter,
    setStoresDateFilter,
}) => {
    const { t, locale } = useLocale();
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    // Use storesDateFilter directly (unified dateFilter) - no local state needed
    // Changes to dateFilter in StoreDetailPage will update the unified dateFilter automatically
    const dateFilter = storesDateFilter;
    const setDateFilter = setStoresDateFilter;

    const filteredMetrics = useMemo(() => {
        return allMetrics.filter(m => {
            if (m.store !== store.name && (m as any).storeId !== store.id && (m as any).storeId !== (store as any).store_id) return false;
            const itemTimestamp = m.date;
            if (!itemTimestamp) return false;
            const itemDate =
                typeof itemTimestamp === 'string'
                    ? new Date(`${itemTimestamp}T00:00:00Z`)
                    : typeof (itemTimestamp as any)?.toDate === 'function'
                        ? (itemTimestamp as any).toDate()
                        : new Date(itemTimestamp as any);
            if (Number.isNaN(itemDate.getTime())) return false;
            const normalizedDate = new Date(Date.UTC(itemDate.getUTCFullYear(), itemDate.getUTCMonth(), itemDate.getUTCDate()));

            const mode = dateFilter.mode ?? 'single';
            const parseIsoDate = (value?: string | null) => {
                if (!value) return null;
                const [y, mValue, d] = value.split('-').map(Number);
                if ([y, mValue, d].some(num => Number.isNaN(num))) return null;
                return new Date(Date.UTC(y, (mValue || 1) - 1, d || 1));
            };

            if (mode === 'custom') {
                const start = parseIsoDate(dateFilter.customStartDate);
                const end = parseIsoDate(dateFilter.customEndDate);
                if (start && normalizedDate < start) return false;
                if (end && normalizedDate > end) return false;
                return true;
            }

            const yearMatch = dateFilter.year === 'all' || normalizedDate.getUTCFullYear() === dateFilter.year;
            const monthMatch = dateFilter.month === 'all' || normalizedDate.getUTCMonth() === dateFilter.month;
            if (!yearMatch || !monthMatch) return yearMatch && monthMatch;

            if (mode === 'range' && dateFilter.month !== 'all' && dateFilter.year !== 'all') {
                const from = dateFilter.dayFrom === undefined ? 'all' : dateFilter.dayFrom;
                const to = dateFilter.dayTo === undefined ? 'all' : dateFilter.dayTo;
                const d = normalizedDate.getUTCDate();
                if (from === 'all' && to === 'all') return true;
                if (from === 'all' && typeof to === 'number') return d <= to;
                if (typeof from === 'number' && to === 'all') return d >= from;
                if (typeof from === 'number' && typeof to === 'number') {
                    const min = Math.min(from, to);
                    const max = Math.max(from, to);
                    return d >= min && d <= max;
                }
                return true;
            }

            const dayMatch = dateFilter.day === 'all' || normalizedDate.getUTCDate() === dateFilter.day;
            return yearMatch && monthMatch && dayMatch;
        });
    }, [store.name, allMetrics, dateFilter]);

    const storeData = useMemo(() => {
        const totalSales = filteredMetrics.reduce((sum, m) => sum + (m.totalSales || 0), 0);
        const totalVisitors = filteredMetrics.reduce((sum, m) => sum + (m.visitors || 0), 0);
        const totalTransactions = filteredMetrics.reduce((sum, m) => sum + (m.transactionCount || 0), 0);
        return {
            totalSales, totalVisitors, totalTransactions,
            atv: totalTransactions > 0 ? totalSales / totalTransactions : 0,
            visitorRate: totalVisitors > 0 ? (totalTransactions / totalVisitors) * 100 : 0,
            salesPerVisitor: totalVisitors > 0 ? totalSales / totalVisitors : 0,
        };
    }, [filteredMetrics]);


    const dynamicTargetData = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const todayDate = now.getDate();

        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        const remainingDays = Math.max(0, totalDaysInMonth - todayDate + 1);

        const salesThisMonth = allMetrics.filter(m => {
            if (m.store !== store.name || !m.date) return false;
            const metricDate = typeof m.date === 'string' ? new Date(m.date) : (m.date?.toDate ? m.date.toDate() : new Date(m.date));
            return metricDate.getFullYear() === year && metricDate.getMonth() === month;
        }).reduce((sum, m) => sum + (m.totalSales || 0), 0);

        const monthlyTarget = calculateEffectiveTarget(store.targets, { year, month, day: 'all' });
        const remainingTarget = monthlyTarget - salesThisMonth;

        // 90% goal calculations
        const monthlyTarget90 = monthlyTarget * 0.9;
        const remainingTarget90 = monthlyTarget90 - salesThisMonth;

        return {
            salesMTD: salesThisMonth,
            remainingTarget,
            remainingDays,
            requiredDailyAverage: remainingDays > 0 ? Math.max(0, remainingTarget) / remainingDays : 0,
            requiredDailyAverage90: remainingDays > 0 ? Math.max(0, remainingTarget90) / remainingDays : 0,
        };
    }, [store.name, store.targets, allMetrics]);

    const handleGenerateAnalysis = async () => {
        setIsAnalyzing(true);
        setAiAnalysis('');
        try {
            const languageInstruction = locale === 'ar' ? 'Provide the response in Arabic.' : '';
            const prompt = `Analyze the performance for store "${store.name}". Data: ${JSON.stringify(storeData)}. Provide a brief summary, 2 strengths, 1 area for improvement, and 2 actionable steps. ${languageInstruction}`;
            const result = await generateText({ model: 'gemini-2.5-flash', contents: [{ parts: [{ text: prompt }] }] });
            setAiAnalysis(result);
        } catch (error: any) {
            setAiAnalysis(`Error: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleCompare = () => {
        setModalState({
            type: 'aiComparison',
            data: {
                item: store,
                allItems: allStores,
                type: 'store'
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="btn-secondary flex items-center gap-2">
                    <ArrowLeftIcon /> {t('back_to_all_stores')}
                </button>
                <button onClick={handleCompare} className="btn-secondary flex items-center gap-2">
                    <SparklesIcon /> {t('compare_with_ai')}
                </button>
            </div>

            <div className="p-6 bg-white rounded-xl shadow-sm border">
                <h2 className="text-3xl font-bold text-zinc-800">{store.name}</h2>
                <p className="text-zinc-500">{t('monthly_target')}: {calculateEffectiveTarget(store.targets, { year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' }).toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</p>
            </div>

            <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title={t('total_sales')} value={storeData.totalSales} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })} />
                <KPICard title={t('visitors')} value={storeData.totalVisitors} />
                <KPICard title={t('total_transactions')} value={storeData.totalTransactions} />
                <KPICard title={t('avg_transaction_value')} value={storeData.atv} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })} />
                <KPICard title={t('conversion_rate')} value={storeData.visitorRate} format={v => `${Math.round(v)}%`} />
                <KPICard title={t('sales_per_visitor')} value={storeData.salesPerVisitor} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-xl shadow-sm border">
                    <h3 className="font-semibold text-lg text-zinc-700 mb-3">{t('ai_performance_review')}</h3>
                    <button onClick={handleGenerateAnalysis} disabled={isAnalyzing} className="btn-primary flex items-center gap-2">
                        <SparklesIcon /> {isAnalyzing ? t('analyzing') : t('generate_ai_analysis')}
                    </button>
                    {isAnalyzing && <div className="mt-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div></div>}
                    {aiAnalysis && <div className="mt-4 p-4 bg-gray-50 rounded-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br />') }} />}
                </div>
                <div className="p-6 bg-white rounded-xl shadow-sm border">
                    <h3 className="font-semibold text-lg text-zinc-700 mb-3">{t('dynamic_daily_target')}</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between"><span>{t('sales_this_month')}</span><span className="font-semibold">{dynamicTargetData.salesMTD.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</span></div>
                        <div className="flex justify-between"><span>{t('remaining_target')}</span><span className="font-semibold text-red-600">{dynamicTargetData.remainingTarget > 0 ? dynamicTargetData.remainingTarget.toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) : t('achieved')}</span></div>
                        <div className="flex justify-between"><span>{t('remaining_days')}</span><span className="font-semibold">{dynamicTargetData.remainingDays}</span></div>
                        <div className="flex justify-between items-center bg-orange-50 p-2 rounded-lg mt-2"><span className="font-bold text-orange-700">{t('required_daily_avg')}</span><span className="font-bold text-orange-700 text-lg">{dynamicTargetData.requiredDailyAverage.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</span></div>
                        <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg"><span className="font-bold text-amber-700">{t('required_daily_avg_90')}</span><span className="font-bold text-amber-700 text-lg">{dynamicTargetData.requiredDailyAverage90.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</span></div>
                    </div>
                </div>
            </div>

            <CustomBusinessRules
                rules={businessRules}
                stores={[store]}
                onSave={onSaveRule}
                onDelete={onDeleteRule}
                isProcessing={isProcessing}
                showGeneralRules={false}
            />
        </div>
    );
};

export default StoreDetailPage;