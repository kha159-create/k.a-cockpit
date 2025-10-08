import React, { useState, useMemo } from 'react';
import { SparklesIcon, ArrowLeftIcon } from '../components/Icons';
import { KPICard } from '../components/DashboardComponents';
import MonthYearFilter from '../components/MonthYearFilter';
import type { StoreSummary, DailyMetric, ModalState, DateFilter, FilterableData, UserProfile } from '../types';
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
}

const StoreDetailPage: React.FC<StoreDetailPageProps> = ({ store, allMetrics, onBack, allStores, setModalState, allDateData, profile }) => {
    const { t, locale } = useLocale();
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [dateFilter, setDateFilter] = useState<DateFilter>({ year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all' });

    const filteredMetrics = useMemo(() => {
        return allMetrics.filter(m => {
            if (m.store !== store.name) return false;
            const itemTimestamp = m.date;
            if (!itemTimestamp || typeof itemTimestamp.toDate !== 'function') return false;
            
            const itemDate = itemTimestamp.toDate();

            const yearMatch = dateFilter.year === 'all' || itemDate.getUTCFullYear() === dateFilter.year;
            const monthMatch = dateFilter.month === 'all' || itemDate.getUTCMonth() === dateFilter.month;
            const dayMatch = dateFilter.day === 'all' || itemDate.getUTCDate() === dateFilter.day;
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
            if (m.store !== store.name || !m.date || typeof m.date.toDate !== 'function') return false;
            const metricDate = m.date.toDate();
            return metricDate.getFullYear() === year && metricDate.getMonth() === month;
        }).reduce((sum, m) => sum + (m.totalSales || 0), 0);
            
        const monthlyTarget = calculateEffectiveTarget(store.targets, {year, month, day: 'all'});
        const remainingTarget = monthlyTarget - salesThisMonth;
        
        return {
            salesMTD: salesThisMonth,
            remainingTarget,
            remainingDays,
            requiredDailyAverage: remainingDays > 0 ? Math.max(0, remainingTarget) / remainingDays : 0,
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
                    <SparklesIcon/> {t('compare_with_ai')}
                </button>
            </div>
           
            <div className="p-6 bg-white rounded-xl shadow-sm border">
                <h2 className="text-3xl font-bold text-zinc-800">{store.name}</h2>
                <p className="text-zinc-500">{t('monthly_target')}: {calculateEffectiveTarget(store.targets, {year: new Date().getFullYear(), month: new Date().getMonth(), day: 'all'}).toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}</p>
            </div>

            <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title={t('total_sales')} value={storeData.totalSales} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })} />
                <KPICard title={t('visitors')} value={storeData.totalVisitors} />
                <KPICard title={t('total_transactions')} value={storeData.totalTransactions} />
                <KPICard title={t('avg_transaction_value')} value={storeData.atv} format={v => v.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}/>
                <KPICard title={t('conversion_rate')} value={storeData.visitorRate} format={v => `${v.toFixed(1)}%`} />
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
                     </div>
                 </div>
            </div>
        </div>
    );
};

export default StoreDetailPage;