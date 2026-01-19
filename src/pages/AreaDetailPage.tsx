import React, { useState, useMemo } from 'react';
import { SparklesIcon, ArrowLeftIcon } from '../components/Icons';
import { KPICard, ChartCard } from '../components/DashboardComponents';
import MonthYearFilter from '../components/MonthYearFilter';
import type { StoreSummary, DailyMetric, ModalState, DateFilter, FilterableData, UserProfile, SalesTransaction } from '../types';
import { calculateEffectiveTarget } from '../utils/calculator';
import { generateText } from '../services/geminiService';
import { useLocale } from '../context/LocaleContext';
import { StoreName } from '@/components/Names';

interface AreaDetailPageProps {
    areaManager: string;
    stores: StoreSummary[];
    allMetrics: DailyMetric[];
    onBack: () => void;
    allStores: StoreSummary[];
    setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
    allDateData: FilterableData[];
    profile: UserProfile | null;
    onSelectStore: (store: StoreSummary) => void;
}

const AreaDetailPage: React.FC<AreaDetailPageProps> = ({
    areaManager,
    stores,
    allMetrics,
    onBack,
    allStores,
    setModalState,
    allDateData,
    profile,
    onSelectStore,
}) => {
    const { t, locale } = useLocale();
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [dateFilter, setDateFilter] = useState<DateFilter>({ year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' });

    const filteredMetrics = useMemo(() => {
        const storeNames = new Set(stores.map(s => s.name));
        return allMetrics.filter(m => {
            if (!storeNames.has(m.store)) return false;
            const itemTimestamp = m.date;
            if (!itemTimestamp || typeof itemTimestamp.toDate !== 'function') return false;
            const itemDate = itemTimestamp.toDate();
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
    }, [stores, allMetrics, dateFilter]);

    const areaData = useMemo(() => {
        const totalSales = filteredMetrics.reduce((sum, m) => sum + (m.totalSales || 0), 0);
        const totalVisitors = filteredMetrics.reduce((sum, m) => sum + (m.visitors || 0), 0);
        const totalTransactions = filteredMetrics.reduce((sum, m) => sum + (m.transactionCount || 0), 0);
        const totalTarget = stores.reduce((sum, s) => sum + calculateEffectiveTarget(s.targets, dateFilter), 0);
        const totalSalesFromStores = stores.reduce((sum, s) => sum + (s.totalSales || 0), 0);
        const targetAchievement = totalTarget > 0 ? (totalSalesFromStores / totalTarget) * 100 : 0;
        
        return {
            totalSales, 
            totalVisitors, 
            totalTransactions,
            totalTarget,
            targetAchievement,
            atv: totalTransactions > 0 ? totalSales / totalTransactions : 0,
            visitorRate: totalVisitors > 0 ? (totalTransactions / totalVisitors) * 100 : 0,
            salesPerVisitor: totalVisitors > 0 ? totalSales / totalVisitors : 0,
        };
    }, [filteredMetrics, stores, dateFilter]);

    const dynamicTargetData = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const todayDate = now.getDate();

        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
        const remainingDays = Math.max(0, totalDaysInMonth - todayDate + 1);
        
        const salesThisMonth = allMetrics.filter(m => {
            const storeNames = new Set(stores.map(s => s.name));
            if (!storeNames.has(m.store) || !m.date || typeof m.date.toDate !== 'function') return false;
            const metricDate = m.date.toDate();
            return metricDate.getFullYear() === year && metricDate.getMonth() === month;
        }).reduce((sum, m) => sum + (m.totalSales || 0), 0);
            
        const monthlyTarget = stores.reduce((sum, s) => sum + calculateEffectiveTarget(s.targets, {year, month, day: 'all'}), 0);
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
    }, [stores, allMetrics]);
    
    const handleGenerateAnalysis = async () => {
        setIsAnalyzing(true);
        setAiAnalysis('');
        try {
            const languageInstruction = locale === 'ar' ? 'Provide the response in Arabic.' : '';
            const prompt = `Analyze the performance for area managed by "${areaManager}". Data: ${JSON.stringify(areaData)}. Provide a brief summary, 2 strengths, 1 area for improvement, and 2 actionable steps. ${languageInstruction}`;
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
                item: { name: areaManager, ...areaData },
                allItems: allStores,
                type: 'area'
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
                    <SparklesIcon/> {t('compare_with_ai')}
                </button>
            </div>
           
            <div className="p-6 bg-white rounded-xl shadow-sm border">
                <h2 className="text-3xl font-bold text-zinc-800">{areaManager}</h2>
                <p className="text-zinc-500">{t('area_target')}: {areaData.totalTarget.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</p>
                <p className="text-zinc-500">{t('stores_count')}: {stores.length}</p>
            </div>

            <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title={t('total_sales')} value={areaData.totalSales} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })} />
                <KPICard title={t('visitors')} value={areaData.totalVisitors} />
                <KPICard title={t('total_transactions')} value={areaData.totalTransactions} />
                <KPICard title={t('avg_transaction_value')} value={areaData.atv} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}/>
                <KPICard title={t('conversion_rate')} value={areaData.visitorRate} format={v => `${Math.round(v)}%`} />
                <KPICard title={t('sales_per_visitor')} value={areaData.salesPerVisitor} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })} />
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

            {/* Stores List */}
            <div className="p-6 bg-white rounded-xl shadow-sm border">
                <h3 className="font-semibold text-lg text-zinc-700 mb-4">{t('stores_in_area')}</h3>
                <div className="space-y-2">
                    {stores.map(store => (
                        <div 
                            key={store.id} 
                            onClick={() => onSelectStore(store)}
                            className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <StoreName id={(store as any).store_id ?? (store as any).id ?? store.name} fallback={store.name} />
                                    <p className="text-sm text-zinc-500">{t('sales')}: {store.totalSales.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-zinc-700">{Math.round(store.targetAchievement)}%</p>
                                    <p className="text-sm text-zinc-500">{t('achievement')}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AreaDetailPage;

