import React, { useState, useEffect, useCallback } from 'react';
import { generateText } from '../services/geminiService.js';
import { SparklesIcon } from './Icons.js';
import type { KPIData, StoreSummary, EmployeeSummary, ProductSummary } from '../types.js';
import { useLocale } from '../context/LocaleContext.js';

interface ProactiveAiInsightCardProps {
  fullData: {
    kpiData: KPIData;
    storeSummary: StoreSummary[];
    employeeSummary: { [storeName: string]: EmployeeSummary[] };
    productSummary: ProductSummary[];
  };
}

const ProactiveAiInsightCard: React.FC<ProactiveAiInsightCardProps> = ({ fullData }) => {
  const { t, locale } = useLocale();
  const [insight, setInsight] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const languageInstruction = locale === 'ar' ? 'IMPORTANT: The final response must be in Arabic.' : '';
      const prompt = `You are an expert retail analyst. Based on the following complete data snapshot, identify the single most important insight (either a major opportunity or a significant threat) for the business manager right now. Be concise, direct, and provide one actionable recommendation. ${languageInstruction}
      
      Data Snapshot:
      ${JSON.stringify(fullData, null, 2)}`;
      
            const result = await generateText(prompt, 'gemini-2.5-flash');
      setInsight(result);
    } catch (e: any) {
      setError(t('could_not_generate_insight'));
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [fullData, locale, t]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  return (
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <SparklesIcon /> {t('proactive_ai_insight')}
          </h3>
          <p className="text-blue-200 text-sm">{t('ai_advisor_observation')}</p>
        </div>
        <button onClick={fetchInsight} disabled={isLoading} className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-transform transform active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 4l16 16" /></svg>
        </button>
      </div>
      <div className="mt-4 min-h-[60px]">
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-75"></div>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse delay-150"></div>
            <span className="text-sm">{t('analyzing_data')}</span>
          </div>
        ) : error ? (
          <p className="text-yellow-300">{error}</p>
        ) : (
          <p className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: insight.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        )}
      </div>
    </div>
  );
};

export default ProactiveAiInsightCard;
