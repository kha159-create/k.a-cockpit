import React, { useMemo } from 'react';
import type { DateFilter, FilterableData } from '../types';
import { useLocale } from '../context/LocaleContext';

interface MonthYearFilterProps {
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  allData: FilterableData[];
}

const MonthYearFilter: React.FC<MonthYearFilterProps> = ({ dateFilter, setDateFilter, allData }) => {
  const { t, locale } = useLocale();
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    allData.forEach(d => {
      // Handle both potential date property names, now as Timestamps
      const dateTimestamp = ('date' in d ? d.date : d['Bill Dt.']) as any;
      if (dateTimestamp && typeof dateTimestamp.toDate === 'function') {
        const dateObj = dateTimestamp.toDate();
        const year = dateObj.getUTCFullYear();
        if (!isNaN(year)) {
          yearSet.add(year);
        }
      }
    });
    const currentYear = new Date().getFullYear();
    yearSet.add(currentYear);
    const validYears = Array.from(yearSet).filter(y => !isNaN(y));
    return ['all', ...validYears.sort((a, b) => b - a)];
  }, [allData]);

  const months = useMemo(() => {
    if (locale === 'ar') {
      return ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    }
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }, [locale]);
  
  const days = ['all', ...Array.from({ length: 31 }, (_, i) => i + 1)];

  const mode = dateFilter.mode ?? 'single';
  const dayFrom = (dateFilter.dayFrom ?? (typeof dateFilter.day === 'number' ? dateFilter.day : 'all')) as number | 'all';
  const dayTo = (dateFilter.dayTo ?? (typeof dateFilter.day === 'number' ? dateFilter.day : 'all')) as number | 'all';

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = e.target.value === 'all' ? 'all' : Number(e.target.value);
    // Reset month and day when year changes for a better UX
    setDateFilter({ year, month: 'all', day: 'all' });
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const month = e.target.value === 'all' ? 'all' : Number(e.target.value);
    // Reset day when month changes
    setDateFilter(prev => ({ ...prev, month, day: 'all' }));
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode = e.target.value as 'single' | 'range';
    setDateFilter(prev => ({
      ...prev,
      mode: nextMode,
      // when switching to range, initialize from/to from current day
      dayFrom: nextMode === 'range' ? (typeof prev.day === 'number' ? prev.day : 'all') : undefined,
      dayTo: nextMode === 'range' ? (typeof prev.day === 'number' ? prev.day : 'all') : undefined,
    }));
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const day = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => ({ ...prev, day, dayFrom: undefined, dayTo: undefined, mode: 'single' }));
  };

  const handleDayFromChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => ({ ...prev, mode: 'range', dayFrom: val }));
  };

  const handleDayToChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => ({ ...prev, mode: 'range', dayTo: val }));
  };

    return (
      <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm border border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
            <span className="font-semibold text-zinc-600">{t('year')}:</span>
            <select value={dateFilter.year} onChange={handleYearChange} className="input w-full">
              {years.map(y => <option key={y} value={y}>{y === 'all' ? t('all_years') : y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
            <span className="font-semibold text-zinc-600">{t('month')}:</span>
            <select value={dateFilter.month} onChange={handleMonthChange} className="input w-full" disabled={dateFilter.year === 'all'}>
              <option value="all">{t('all_months')}</option>
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
            <span className="font-semibold text-zinc-600">{t('filter_mode')}:</span>
            <select value={mode} onChange={handleModeChange} className="input w-full" disabled={dateFilter.month === 'all' || dateFilter.year === 'all'}>
              <option value="single">{t('single_day')}</option>
              <option value="range">{t('day_range')}</option>
            </select>
          </div>
        </div>

        {mode === 'single' ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-600">{t('day')}:</span>
            <select value={dateFilter.day} onChange={handleDayChange} className="input" disabled={dateFilter.month === 'all' || dateFilter.year === 'all'}>
              {days.map(d => <option key={d} value={d}>{d === 'all' ? t('all_days') : d}</option>)}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-600">{t('from_day')}:</span>
              <select value={dayFrom} onChange={handleDayFromChange} className="input" disabled={dateFilter.month === 'all' || dateFilter.year === 'all'}>
                {days.map(d => <option key={d} value={d}>{d === 'all' ? t('all_days') : d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-600">{t('to_day')}:</span>
              <select value={dayTo} onChange={handleDayToChange} className="input" disabled={dateFilter.month === 'all' || dateFilter.year === 'all'}>
                {days.map(d => <option key={d} value={d}>{d === 'all' ? t('all_days') : d}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    );
};

export default MonthYearFilter;
