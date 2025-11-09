import React, { useEffect, useMemo, useRef } from 'react';
import type { DateFilter, FilterableData } from '../types';
import { useLocale } from '../context/LocaleContext';

interface MonthYearFilterProps {
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  allData: FilterableData[];
  forceRangeOnly?: boolean;
}

const MonthYearFilter: React.FC<MonthYearFilterProps> = ({ dateFilter, setDateFilter, allData, forceRangeOnly = false }) => {
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
    const sorted = validYears.sort((a, b) => b - a);
    return forceRangeOnly ? sorted : ['all', ...sorted];
  }, [allData, forceRangeOnly]);

  const months = useMemo(() => {
    if (locale === 'ar') {
      return ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    }
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }, [locale]);
  
  const days = ['all', ...Array.from({ length: 31 }, (_, i) => i + 1)];
  const rawMode = dateFilter.mode ?? 'single';
  const effectiveMode = forceRangeOnly ? 'range' : rawMode;
  const dayFromValue = typeof dateFilter.dayFrom === 'number' ? dateFilter.dayFrom : 'all';
  const dayToValue = typeof dateFilter.dayTo === 'number' ? dateFilter.dayTo : 'all';

  const { minDate, maxDate } = useMemo(() => {
    let earliest: Date | null = null;
    let latest: Date | null = null;
    allData.forEach(item => {
      const dateTimestamp = ('date' in item ? item.date : item['Bill Dt.']) as any;
      if (dateTimestamp && typeof dateTimestamp.toDate === 'function') {
        const d = dateTimestamp.toDate();
        const normalized = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        if (!earliest || normalized < earliest) earliest = normalized;
        if (!latest || normalized > latest) latest = normalized;
      }
    });
    const format = (value: Date | null) => value ? value.toISOString().split('T')[0] : null;
    return {
      minDate: format(earliest),
      maxDate: format(latest),
    };
  }, [allData]);

  const lastStandardSelectionRef = useRef<{ year: number; month: number }>({
    year: new Date().getUTCFullYear(),
    month: new Date().getUTCMonth(),
  });

  useEffect(() => {
    if (effectiveMode !== 'custom' && typeof dateFilter.year === 'number' && typeof dateFilter.month === 'number') {
      lastStandardSelectionRef.current = {
        year: dateFilter.year,
        month: dateFilter.month,
      };
    }
  }, [effectiveMode, dateFilter.year, dateFilter.month]);

  useEffect(() => {
    if (!forceRangeOnly) return;
    const needsUpdate =
      dateFilter.mode !== 'range' ||
      dateFilter.day !== 'all' ||
      dateFilter.dayFrom === undefined ||
      dateFilter.dayTo === undefined ||
      typeof dateFilter.year !== 'number' ||
      typeof dateFilter.month !== 'number';
    if (!needsUpdate) return;
    const now = new Date();
    setDateFilter(prev => ({
      ...prev,
      mode: 'range',
      day: 'all',
      year: typeof prev.year === 'number' ? prev.year : now.getUTCFullYear(),
      month: typeof prev.month === 'number' ? prev.month : now.getUTCMonth(),
      dayFrom: prev.dayFrom !== undefined ? prev.dayFrom : 'all',
      dayTo: prev.dayTo !== undefined ? prev.dayTo : 'all',
    }));
  }, [forceRangeOnly, dateFilter.mode, dateFilter.day, dateFilter.dayFrom, dateFilter.dayTo, dateFilter.year, dateFilter.month, setDateFilter]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const year = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => {
      const now = new Date();
      const resolvedMonth = typeof prev.month === 'number' ? prev.month : now.getUTCMonth();
      return {
        ...prev,
        year,
        month: forceRangeOnly ? resolvedMonth : 'all',
        day: 'all',
        dayFrom: forceRangeOnly ? 'all' : prev.dayFrom,
        dayTo: forceRangeOnly ? 'all' : prev.dayTo,
      };
    });
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const month = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => ({ ...prev, month, day: 'all', dayFrom: forceRangeOnly ? 'all' : prev.dayFrom, dayTo: forceRangeOnly ? 'all' : prev.dayTo }));
  };

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (forceRangeOnly) return;
    const nextMode = e.target.value as 'single' | 'range' | 'custom';
    if (nextMode === 'custom') {
      const todayIso = new Date().toISOString().split('T')[0];
      const fallbackStart = dateFilter.customStartDate ?? minDate ?? todayIso;
      const fallbackEnd = dateFilter.customEndDate ?? maxDate ?? todayIso;
      setDateFilter(prev => ({
        ...prev,
        mode: 'custom',
        year: 'all',
        month: 'all',
        day: 'all',
        dayFrom: undefined,
        dayTo: undefined,
        customStartDate: fallbackStart,
        customEndDate: fallbackEnd,
      }));
      return;
    }

    setDateFilter(prev => {
      const comingFromCustom = prev.mode === 'custom';
      const saved = lastStandardSelectionRef.current;
      const year = comingFromCustom ? saved.year : prev.year;
      const month = comingFromCustom ? saved.month : prev.month;
      return {
        ...prev,
        mode: nextMode,
        year,
        month,
        day: 'all',
        customStartDate: prev.customStartDate ?? null,
        customEndDate: prev.customEndDate ?? null,
        dayFrom: nextMode === 'range'
          ? (typeof prev.day === 'number' ? prev.day : typeof prev.dayFrom === 'number' ? prev.dayFrom : 'all')
          : undefined,
        dayTo: nextMode === 'range'
          ? (typeof prev.day === 'number' ? prev.day : typeof prev.dayTo === 'number' ? prev.dayTo : 'all')
          : undefined,
      };
    });
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const day = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => ({ ...prev, day, dayFrom: undefined, dayTo: undefined, mode: 'single' }));
  };

  const handleDayFromChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => {
      let nextTo = prev.dayTo;
      if (typeof val === 'number' && typeof nextTo === 'number' && nextTo < val) nextTo = val;
      return { ...prev, mode: 'range', day: 'all', dayFrom: val, dayTo: nextTo };
    });
  };

  const handleDayToChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setDateFilter(prev => {
      let nextFrom = prev.dayFrom;
      if (typeof val === 'number' && typeof nextFrom === 'number' && nextFrom > val) nextFrom = val;
      return { ...prev, mode: 'range', day: 'all', dayTo: val, dayFrom: nextFrom };
    });
  };

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || null;
    setDateFilter(prev => ({ ...prev, customStartDate: value }));
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || null;
    setDateFilter(prev => ({ ...prev, customEndDate: value }));
  };

    return (
      <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm border border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
            <span className="font-semibold text-zinc-600">{t('year')}:</span>
            <select value={dateFilter.year} onChange={handleYearChange} className="input w-full" disabled={effectiveMode === 'custom'}>
              {years.map(y => <option key={y} value={y}>{y === 'all' ? t('all_years') : y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
            <span className="font-semibold text-zinc-600">{t('month')}:</span>
            <select
              value={dateFilter.month}
              onChange={handleMonthChange}
              className="input w-full"
              disabled={effectiveMode === 'custom' || dateFilter.year === 'all'}>
              {!forceRangeOnly && <option value="all">{t('all_months')}</option>}
              {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          {!forceRangeOnly && (
            <div className="flex items-center gap-2 flex-1 min-w-[150px]">
              <span className="font-semibold text-zinc-600">{t('filter_mode')}:</span>
              <select
                value={effectiveMode}
                onChange={handleModeChange}
                className="input w-full"
                disabled={effectiveMode !== 'custom' && (dateFilter.month === 'all' || dateFilter.year === 'all')}>
                <option value="single">{t('single_day')}</option>
                <option value="range">{t('day_range')}</option>
                <option value="custom">{t('custom_range')}</option>
              </select>
            </div>
          )}
        </div>

        {(!forceRangeOnly && effectiveMode === 'single') ? (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-600">{t('day')}:</span>
            <select value={dateFilter.day} onChange={handleDayChange} className="input" disabled={dateFilter.month === 'all' || dateFilter.year === 'all'}>
              {days.map(d => <option key={d} value={d}>{d === 'all' ? t('all_days') : d}</option>)}
            </select>
          </div>
        ) : effectiveMode === 'range' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-600">{t('day_from')}:</span>
              <select value={dayFromValue} onChange={handleDayFromChange} className="input" disabled={dateFilter.month === 'all' || dateFilter.year === 'all'}>
                {days.map(d => <option key={d} value={d}>{d === 'all' ? t('all_days') : d}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-600">{t('day_to')}:</span>
              <select value={dayToValue} onChange={handleDayToChange} className="input" disabled={dateFilter.month === 'all' || dateFilter.year === 'all'}>
                {days.map(d => <option key={d} value={d}>{d === 'all' ? t('all_days') : d}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-zinc-600">{t('custom_start_date')}:</span>
              <input
                type="date"
                value={dateFilter.customStartDate ?? ''}
                onChange={handleCustomStartChange}
                className="input"
                min={minDate ?? undefined}
                max={dateFilter.customEndDate ?? undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-zinc-600">{t('custom_end_date')}:</span>
              <input
                type="date"
                value={dateFilter.customEndDate ?? ''}
                onChange={handleCustomEndChange}
                className="input"
                min={dateFilter.customStartDate ?? undefined}
                max={maxDate ?? undefined}
              />
            </div>
          </div>
        )}
      </div>
    );
};

export default MonthYearFilter;
