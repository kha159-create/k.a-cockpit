
import React, { useEffect, useMemo, useState } from 'react';
import MonthYearFilter from '../components/MonthYearFilter';
import { useLocale } from '../context/LocaleContext';
import type { DateFilter, DuvetSummary, Employee, EmployeeSummary, StoreSummary, FilterableData, SalesTransaction } from '../types';
import { getCategory, getSmartPillowCategories, getSmartPillowCategory } from '../utils/calculator';

declare var XLSX: any;

interface SmartUploaderPageProps {
  onUpload: (parsedData: any[], setProgress: (progress: number) => void) => void;
  isProcessing: boolean;
  uploadResult: { successful: any[], skipped: number } | null;
  onClearResult: () => void;
  employeeSummaries: EmployeeSummary[];
  storeSummaries: StoreSummary[];
  storePerformanceExtras: Record<string, {
    avgTicket: number;
    transactions: number;
    conversionRate: number;
    salesPerVisitor: number;
    visitors: number;
    visitorGrowth: number | null;
    salesGrowth: number | null;
  }>;
  duvetSummary: DuvetSummary;
  employeeDuvetSales: { byEmployeeId: Record<string, number>; byEmployeeName: Record<string, number> };
  employees: Employee[];
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  allData: FilterableData[];
}

const downloadTemplate = (fileName: string, headers: string[]) => {
    if (typeof XLSX === 'undefined') { alert("File library is still loading..."); return; }
    const ws = XLSX.utils.json_to_sheet([], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SmartUploaderPage: React.FC<SmartUploaderPageProps> = ({
  onUpload,
  isProcessing,
  uploadResult,
  onClearResult,
  employeeSummaries,
  storeSummaries,
  storePerformanceExtras,
  duvetSummary,
  employeeDuvetSales,
  employees,
  dateFilter,
  setDateFilter,
  allData
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
  const { locale } = useLocale();
  const copy = useMemo(() => {
    if (locale === 'ar') {
      return {
        filterTitle: 'مرشحات التقارير',
        filterHint: 'اختر الفترة الزمنية للتقارير قبل التنزيل.',
        downloadsTitle: 'تقارير جاهزة للتنزيل',
        downloadsDescription: 'حمّل ملفات Excel منسقة للموظفين والمعارض بناءً على مرشحات التاريخ الحالية.',
        employeeButton: '📊 تحميل تقرير الموظفين',
        storeButton: '🏬 تحميل تقرير المعارض',
        employeeNote: 'يتضمن تقرير الموظفين: التارجت، المبيعات، تحصيل التارجت، إضافة إلى تارجت الألحفة ومبيعاتها ونسبة تحقيقها.',
        storeNote: 'يتضمن تقرير المعارض: التارجت، المبيعات، تحصيل التارجت، إضافة إلى تفصيل مبيعات الألحفة مقابل أهدافها.',
      };
    }
    return {
      filterTitle: 'Report Filters',
      filterHint: 'Choose the time period for the exports before downloading.',
      downloadsTitle: 'Ready-to-Download Reports',
      downloadsDescription: 'Download formatted Excel reports for employees and stores using the current date filters.',
      employeeButton: '📊 Download Employees Report',
      storeButton: '🏬 Download Stores Report',
      employeeNote: 'Employee report includes targets, sales, achievement, and duvet targets vs sales.',
      storeNote: 'Store report includes targets, sales, achievement, plus duvet performance against goals.',
    };
  }, [locale]);

  useEffect(() => {
    setDateFilter(prev => {
      const now = new Date();
      let changed = false;
      const next: DateFilter = { ...prev };
      if (prev.mode !== 'range') { next.mode = 'range'; changed = true; }
      if (prev.day !== 'all') { next.day = 'all'; changed = true; }
      if (prev.dayFrom === undefined) { next.dayFrom = 'all'; changed = true; }
      if (prev.dayTo === undefined) { next.dayTo = 'all'; changed = true; }
      if (typeof prev.year !== 'number') { next.year = now.getUTCFullYear(); changed = true; }
      if (typeof prev.month !== 'number') { next.month = now.getUTCMonth(); changed = true; }
      return changed ? next : prev;
    });
  }, [setDateFilter]);

  const ensureWorkbookLib = () => {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة إنشاء الملفات لم تجهز بعد، حاول بعد لحظات.');
      return false;
    }
    return true;
  };

  const periodLabel = useMemo(() => {
    if (dateFilter.mode === 'custom' && dateFilter.customStartDate && dateFilter.customEndDate) {
      return `${dateFilter.customStartDate} → ${dateFilter.customEndDate}`;
    }
    const now = new Date();
    const resolvedYear = typeof dateFilter.year === 'number' ? dateFilter.year : now.getUTCFullYear();
    if (dateFilter.month === 'all') {
      return `${resolvedYear}`;
    }
    if (typeof dateFilter.month === 'number') {
      const monthName = monthNames[dateFilter.month];
      const lastDay = new Date(Date.UTC(resolvedYear, dateFilter.month + 1, 0)).getUTCDate();
      const fromDay = typeof dateFilter.dayFrom === 'number' ? dateFilter.dayFrom : 1;
      const toDay = typeof dateFilter.dayTo === 'number' ? dateFilter.dayTo : lastDay;
      const displayRange = typeof dateFilter.dayFrom === 'number' || typeof dateFilter.dayTo === 'number';
      return displayRange
        ? `${monthName} ${resolvedYear} (${fromDay}-${toDay})`
        : `${monthName} ${resolvedYear}`;
    }
    return `${resolvedYear}`;
  }, [dateFilter]);

  const allowedStoreNames = useMemo(() => new Set(storeSummaries.map(s => s.name)), [storeSummaries]);

  const getEmployeeStoreForPeriod = (employee: Employee) => {
    if (
      employee.assignments &&
      dateFilter.year !== 'all' &&
      dateFilter.month !== 'all'
    ) {
      const key = `${dateFilter.year}-${String((dateFilter.month as number) + 1).padStart(2, '0')}`;
      if (employee.assignments[key]) {
        return employee.assignments[key];
      }
    }
    return employee.currentStore;
  };

  const extractTargetForPeriod = (targets?: { [year: string]: { [month: string]: number } }) => {
    if (!targets || dateFilter.year === 'all') return 0;
    const yearData = targets[String(dateFilter.year)];
    if (!yearData) return 0;
    if (dateFilter.month === 'all') {
      return Object.values(yearData).reduce((sum, value) => sum + (Number(value) || 0), 0);
    }
    if (typeof dateFilter.month === 'number') {
      const monthKey = String(dateFilter.month + 1);
      return Number(yearData[monthKey]) || 0;
    }
    return 0;
  };

  const storeDuvetTargets = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach(emp => {
      const storeName = getEmployeeStoreForPeriod(emp);
      if (!storeName || !allowedStoreNames.has(storeName)) return;
      const current = map.get(storeName) || 0;
      map.set(storeName, current + extractTargetForPeriod(emp.duvetTargets));
    });
    return map;
  }, [employees, allowedStoreNames, dateFilter]);

  const employeeLookup = useMemo(() => {
    const byId = new Map<string, Employee>();
    const byEmployeeId = new Map<string, Employee>();
    const byName = new Map<string, Employee>();
    employees.forEach(emp => {
      if (emp.id) byId.set(emp.id, emp);
      if (emp.employeeId) byEmployeeId.set(emp.employeeId, emp);
      if (emp.name) byName.set(emp.name, emp);
    });
    return { byId, byEmployeeId, byName };
  }, [employees]);

  // Calculate Category Share per store
  const storeCategoryShare = useMemo(() => {
    const shareMap: Record<string, { Duvets: number; 'Duvets Full': number; Toppers: number; Pillows: number; Other: number; total: number }> = {};
    
    // Filter sales transactions by date
    const filterByDate = (item: FilterableData) => {
      const itemTimestamp = 'date' in item ? item.date : item['Bill Dt.'];
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

      const now = new Date();
      const year = dateFilter.year === 'all' ? now.getUTCFullYear() : (dateFilter.year as number);
      const month = dateFilter.month === 'all' ? now.getUTCMonth() : (dateFilter.month as number);
      const yearMatch = normalizedDate.getUTCFullYear() === year;
      const monthMatch = normalizedDate.getUTCMonth() === month;

      if (mode === 'range') {
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const fromDay = typeof dateFilter.dayFrom === 'number' ? dateFilter.dayFrom : 1;
        const toDay = typeof dateFilter.dayTo === 'number' ? dateFilter.dayTo : lastDay;
        const day = normalizedDate.getUTCDate();
        return yearMatch && monthMatch && day >= fromDay && day <= toDay;
      }

      const day = dateFilter.day === 'all' ? true : normalizedDate.getUTCDate() === dateFilter.day;
      return yearMatch && monthMatch && day;
    };

    const filteredSales = allData.filter((item): item is SalesTransaction => {
      if (!filterByDate(item)) return false;
      return 'Item Name' in item && 'Item Alias' in item && 'Outlet Name' in item;
    });

    filteredSales.forEach(sale => {
      const storeName = sale['Outlet Name'];
      if (!storeName) return;
      
      const category = getCategory({ name: sale['Item Name'], alias: sale['Item Alias'] });
      const value = (sale['Sold Qty'] || 0) * (sale['Item Rate'] || 0);
      
      if (!shareMap[storeName]) {
        shareMap[storeName] = { Duvets: 0, 'Duvets Full': 0, Toppers: 0, Pillows: 0, Other: 0, total: 0 };
      }
      
      const categoryKey = category as 'Duvets' | 'Duvets Full' | 'Toppers' | 'Pillows' | 'Other';
      if (shareMap[storeName][categoryKey] !== undefined) {
        shareMap[storeName][categoryKey] += value;
      }
      shareMap[storeName].total += value;
    });

    // Calculate percentages and values
    const result: Record<string, {
      values: { Duvets: number; 'Duvets Full': number; Toppers: number; Pillows: number; Other: number };
      percentages: { Duvets: number; 'Duvets Full': number; Toppers: number; Pillows: number; Other: number };
    }> = {};
    Object.keys(shareMap).forEach(storeName => {
      const data = shareMap[storeName];
      const total = data.total || 1; // Avoid division by zero
      result[storeName] = {
        values: {
          Duvets: data.Duvets,
          'Duvets Full': data['Duvets Full'],
          Toppers: data.Toppers,
          Pillows: data.Pillows,
          Other: data.Other,
        },
        percentages: {
          Duvets: (data.Duvets / total) * 100,
          'Duvets Full': (data['Duvets Full'] / total) * 100,
          Toppers: (data.Toppers / total) * 100,
          Pillows: (data.Pillows / total) * 100,
          Other: (data.Other / total) * 100,
        },
      };
    });

    return result;
  }, [allData, dateFilter]);

  // Calculate Pillow categories per store
  const pillowSummary = useMemo(() => {
    const filterByDate = (item: FilterableData) => {
      const itemTimestamp = 'date' in item ? item.date : item['Bill Dt.'];
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

      const now = new Date();
      const year = dateFilter.year === 'all' ? now.getUTCFullYear() : (dateFilter.year as number);
      const month = dateFilter.month === 'all' ? now.getUTCMonth() : (dateFilter.month as number);
      const yearMatch = normalizedDate.getUTCFullYear() === year;
      const monthMatch = normalizedDate.getUTCMonth() === month;

      if (mode === 'range') {
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const fromDay = typeof dateFilter.dayFrom === 'number' ? dateFilter.dayFrom : 1;
        const toDay = typeof dateFilter.dayTo === 'number' ? dateFilter.dayTo : lastDay;
        const day = normalizedDate.getUTCDate();
        return yearMatch && monthMatch && day >= fromDay && day <= toDay;
      }

      const day = dateFilter.day === 'all' ? true : normalizedDate.getUTCDate() === dateFilter.day;
      return yearMatch && monthMatch && day;
    };

    const filteredSales = allData.filter((item): item is SalesTransaction => {
      if (!filterByDate(item)) return false;
      if (!('Item Name' in item && 'Item Alias' in item && 'Outlet Name' in item)) return false;
      const category = getCategory({ name: item['Item Name'], alias: item['Item Alias'] });
      return category === 'Pillows';
    });

    // Collect all pillow prices
    const pillowPrices = filteredSales.map(s => Number(s['Item Rate'] || 0)).filter(p => p > 0);
    const smartCategories = getSmartPillowCategories(pillowPrices);

    return filteredSales.reduce((acc, sale) => {
      const storeName = sale['Outlet Name'];
      const category = getSmartPillowCategory(Number(sale['Item Rate'] || 0), smartCategories);
      if (category) {
        if (!acc[storeName]) {
          acc[storeName] = { 
            name: storeName, 
            [smartCategories.low.label]: 0, 
            [smartCategories.medium.label]: 0, 
            [smartCategories.high.label]: 0, 
            total: 0 
          };
        }
        acc[storeName][category] = (acc[storeName][category] || 0) + (sale['Sold Qty'] || 0);
        acc[storeName].total += (sale['Sold Qty'] || 0);
      }
      return acc;
    }, {} as Record<string, { name: string; [key: string]: number | string }>);
  }, [allData, dateFilter]);

  const sortedEmployeeRows = useMemo(() => {
    const rows = employeeSummaries.map((emp, index) => {
      const sourceEmployee =
        employeeLookup.byId.get(emp.id) ||
        (emp.employeeId ? employeeLookup.byEmployeeId.get(emp.employeeId) : undefined) ||
        employeeLookup.byName.get(emp.name);

      const duvetTarget = extractTargetForPeriod(sourceEmployee?.duvetTargets);
      const duvetUnitsById = emp.employeeId ? employeeDuvetSales.byEmployeeId[emp.employeeId] : undefined;
      const duvetUnits = (duvetUnitsById ?? employeeDuvetSales.byEmployeeName[emp.name] ?? 0);
      const duvetAchievementPercent = duvetTarget > 0 ? duvetUnits / duvetTarget : 0;

      return {
        idx: index + 1,
        name: emp.name,
        store: emp.store || '-',
        salesTarget: emp.effectiveTarget || 0,
        salesAchieved: emp.totalSales || 0,
        achievementPercent: (emp.achievement || 0) / 100,
        atv: emp.atv || 0,
        duvetTarget,
        duvetUnits,
        duvetAchievementPercent,
      };
    });
    return rows.sort((a, b) => {
      if (a.store === b.store) return a.name.localeCompare(b.name);
      return a.store.localeCompare(b.store);
    });
  }, [employeeSummaries, employeeLookup, employeeDuvetSales, dateFilter]);

  const storeReportRows = useMemo(() => {
    // Get smart category labels from first store that has duvet data
    const getCategoryKeys = (duvetData: any) => {
      if (!duvetData) return { low: 'Low Value', medium: 'Medium Value', high: 'High Value' };
      const keys = Object.keys(duvetData).filter(k => k !== 'name' && k !== 'total');
      return {
        low: keys.find(k => k.toLowerCase().includes('low')) || 'Low Value',
        medium: keys.find(k => k.toLowerCase().includes('medium')) || 'Medium Value',
        high: keys.find(k => k.toLowerCase().includes('high')) || 'High Value',
      };
    };
    
    // Get pillow category keys
    const getPillowCategoryKeys = (pillowData: any) => {
      if (!pillowData) return { low: 'Low Value (39-99)', medium: 'Medium Value (100-190)', high: 'High Value (199+)' };
      const keys = Object.keys(pillowData).filter(k => k !== 'name' && k !== 'total');
      return {
        low: keys.find(k => k.toLowerCase().includes('low')) || 'Low Value (39-99)',
        medium: keys.find(k => k.toLowerCase().includes('medium')) || 'Medium Value (100-190)',
        high: keys.find(k => k.toLowerCase().includes('high')) || 'High Value (199+)',
      };
    };
    
    // Find category keys from first available store
    const firstStoreWithData = storeSummaries.find(s => duvetSummary[s.name]);
    const categoryKeys = getCategoryKeys(duvetSummary[firstStoreWithData?.name || '']);
    
    const firstStoreWithPillowData = storeSummaries.find(s => pillowSummary[s.name]);
    const pillowCategoryKeys = getPillowCategoryKeys(pillowSummary[firstStoreWithPillowData?.name || '']);
    
    return storeSummaries.map((store, index) => {
      const duvetData = duvetSummary[store.name];
      const low = duvetData?.[categoryKeys.low] ?? 0;
      const medium = duvetData?.[categoryKeys.medium] ?? 0;
      const high = duvetData?.[categoryKeys.high] ?? 0;
      const totalDuvetUnits = duvetData?.total ?? 0;
      const duvetTarget = storeDuvetTargets.get(store.name) || 0;
      
      const pillowData = pillowSummary[store.name];
      const pillowLow = pillowData?.[pillowCategoryKeys.low] ?? 0;
      const pillowMedium = pillowData?.[pillowCategoryKeys.medium] ?? 0;
      const pillowHigh = pillowData?.[pillowCategoryKeys.high] ?? 0;
      
      const extras = storePerformanceExtras[store.name] || {
        avgTicket: store.atv || 0,
        transactions: store.transactionCount || 0,
        conversionRate: store.visitors > 0 ? store.transactionCount / store.visitors : 0,
        salesPerVisitor: store.visitors > 0 ? (store.totalSales || 0) / store.visitors : 0,
        visitors: store.visitors || 0,
        visitorGrowth: null,
        salesGrowth: null,
      };
      const categoryShare = storeCategoryShare[store.name] || {
        values: { Duvets: 0, 'Duvets Full': 0, Toppers: 0, Pillows: 0, Other: 0 },
        percentages: { Duvets: 0, 'Duvets Full': 0, Toppers: 0, Pillows: 0, Other: 0 },
      };

      return {
        idx: index + 1,
        name: store.name,
        areaManager: store.areaManager || '-',
        salesTarget: store.effectiveTarget || 0,
        salesAchieved: store.totalSales || 0,
        achievementPercent: (store.targetAchievement || 0) / 100,
        transactions: extras.transactions ?? store.transactionCount ?? 0,
        avgTicket: extras.avgTicket ?? (store.transactionCount > 0 ? store.totalSales / store.transactionCount : 0),
        conversionRate: extras.conversionRate ?? ((store.visitorRate ?? 0) / 100),
        salesPerVisitor: extras.salesPerVisitor ?? (store.salesPerVisitor ?? ((store.totalSales || 0) / Math.max(store.visitors || 1, 1))),
        visitors: extras.visitors ?? store.visitors ?? 0,
        duvetTarget,
        duvetUnits: totalDuvetUnits,
        duvetAchievementPercent: duvetTarget > 0 ? (totalDuvetUnits / duvetTarget) : 0,
        visitorGrowth: extras.visitorGrowth ?? null,
        salesGrowth: extras.salesGrowth ?? null,
        duvetLow: low,
        duvetMedium: medium,
        duvetHigh: high,
        pillowLow,
        pillowMedium,
        pillowHigh,
        categoryShareDuvetsValue: categoryShare.values.Duvets,
        categoryShareDuvetsFullValue: categoryShare.values['Duvets Full'],
        categoryShareToppersValue: categoryShare.values.Toppers,
        categorySharePillowsValue: categoryShare.values.Pillows,
        categoryShareOtherValue: categoryShare.values.Other,
        categoryShareDuvets: categoryShare.percentages.Duvets,
        categoryShareDuvetsFull: categoryShare.percentages['Duvets Full'],
        categoryShareToppers: categoryShare.percentages.Toppers,
        categorySharePillows: categoryShare.percentages.Pillows,
        categoryShareOther: categoryShare.percentages.Other,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [storeSummaries, storePerformanceExtras, duvetSummary, pillowSummary, storeDuvetTargets, storeCategoryShare]);

  const buildWorkbookStyles = () => {
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { fgColor: { rgb: 'FF1F2937' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      },
    };
    const titleStyle = {
      font: { bold: true, sz: 14, color: { rgb: 'FF1F2937' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    const subtitleStyle = {
      font: { italic: true, color: { rgb: 'FF4B5563' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    const totalStyle = {
      font: { bold: true, color: { rgb: 'FF111827' } },
      fill: { fgColor: { rgb: 'FFF3F4F6' } },
      border: {
        top: { style: 'thin', color: { rgb: 'FFD1D5DB' } },
      },
    };
    return { headerStyle, titleStyle, subtitleStyle, totalStyle };
  };

  const applyHeaderStyles = (ws: any, headerRowIndex: number, cols: number, headerStyle: any) => {
    for (let c = 0; c < cols; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c });
      if (ws[cellAddress]) {
        ws[cellAddress].s = { ...(ws[cellAddress].s || {}), ...headerStyle };
      }
    }
  };

  const applyNumberFormats = (ws: any, startRow: number, rows: number, columns: { index: number; format: string }[]) => {
    for (let r = startRow; r < startRow + rows; r++) {
      columns.forEach(({ index, format }) => {
        const address = XLSX.utils.encode_cell({ r, c: index });
        const cell = ws[address];
        if (cell) {
          cell.t = 'n';
          cell.z = format;
        }
      });
    }
  };

  const downloadEmployeeReport = () => {
    if (!ensureWorkbookLib()) return;
    if (sortedEmployeeRows.length === 0) {
      alert('لا توجد بيانات موظفين ضمن النطاق الحالي.');
      return;
    }

    const { headerStyle, titleStyle, subtitleStyle, totalStyle } = buildWorkbookStyles();
    const header = [
      '#',
      'Employee',
      'Store',
      'Sales Target (SAR)',
      'Sales Achieved (SAR)',
      'Target Achievement %',
      'ATV (SAR)',
      'Duvet Target (Units)',
      'Duvet Sales (Units)',
      'Duvet Achievement %',
    ];

    const data: (string | number | null)[][] = [
      ['Employee Performance Report'],
      [`Period: ${periodLabel}`],
      [],
      header,
    ];

    sortedEmployeeRows.forEach((row, idx) => {
      data.push([
        idx + 1,
        row.name,
        row.store,
        row.salesTarget,
        row.salesAchieved,
        row.achievementPercent,
        row.atv,
        row.duvetTarget,
        row.duvetUnits,
        row.duvetAchievementPercent,
      ]);
    });

    data.push([]);
    const totalTarget = sortedEmployeeRows.reduce((sum, row) => sum + row.salesTarget, 0);
    const totalSales = sortedEmployeeRows.reduce((sum, row) => sum + row.salesAchieved, 0);
    const totalAchievement = totalTarget > 0 ? totalSales / totalTarget : 0;
    const totalATV = sortedEmployeeRows.length > 0 
      ? sortedEmployeeRows.reduce((sum, row) => sum + row.atv, 0) / sortedEmployeeRows.length 
      : 0;
    const totalDuvetTarget = sortedEmployeeRows.reduce((sum, row) => sum + row.duvetTarget, 0);
    const totalDuvetUnits = sortedEmployeeRows.reduce((sum, row) => sum + row.duvetUnits, 0);
    const totalDuvetAchievement = totalDuvetTarget > 0 ? totalDuvetUnits / totalDuvetTarget : 0;
    data.push(['Totals', null, null, totalTarget, totalSales, totalAchievement, totalATV, totalDuvetTarget, totalDuvetUnits, totalDuvetAchievement]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
    ];
    ws['!merges'] = [
      XLSX.utils.decode_range('A1:J1'),
      XLSX.utils.decode_range('A2:J2'),
    ];

    if (ws['A1']) ws['A1'].s = titleStyle;
    if (ws['A2']) ws['A2'].s = subtitleStyle;

    const headerRowIndex = 3;
    applyHeaderStyles(ws, headerRowIndex, header.length, headerStyle);

    const dataStartRow = headerRowIndex + 1;
    applyNumberFormats(ws, dataStartRow, sortedEmployeeRows.length, [
      { index: 3, format: '#,##0.00' },
      { index: 4, format: '#,##0.00' },
      { index: 5, format: '0.0%' },
      { index: 6, format: '#,##0.00' },
      { index: 7, format: '#,##0' },
      { index: 8, format: '#,##0' },
      { index: 9, format: '0.0%' },
    ]);

    const totalsRowIndex = dataStartRow + sortedEmployeeRows.length + 1;
    applyNumberFormats(ws, totalsRowIndex, 1, [
      { index: 3, format: '#,##0.00' },
      { index: 4, format: '#,##0.00' },
      { index: 5, format: '0.0%' },
      { index: 6, format: '#,##0.00' },
      { index: 7, format: '#,##0' },
      { index: 8, format: '#,##0' },
      { index: 9, format: '0.0%' },
    ]);
    for (let c = 0; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: totalsRowIndex, c });
      if (ws[addr]) ws[addr].s = { ...(ws[addr].s || {}), ...totalStyle };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    const fileName = `Employees_Report_${periodLabel.replace(/[^\w]+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const downloadStoreReport = () => {
    if (!ensureWorkbookLib()) return;
    if (storeReportRows.length === 0) {
      alert('لا توجد بيانات معارض ضمن النطاق الحالي.');
      return;
    }

    const { headerStyle, titleStyle, subtitleStyle, totalStyle } = buildWorkbookStyles();
    const header = [
      '#',
      'Store',
      'Area Manager',
      'Sales Target (SAR)',
      'Sales Achieved (SAR)',
      'Target Achievement %',
      'Transactions',
      'ATV Avg (SAR)',
      'Conversion Rate %',
      'Sales per Visitor (SAR)',
      'Duvet Target (Units)',
      'Duvet Sales (Units)',
      'Duvet Achievement %',
      'Visitor Growth %',
      'Store Sales Growth %',
      'Low Value Units',
      'Medium Value Units',
      'High Value Units',
      'Pillow Low (39-99)',
      'Pillow Medium (100-190)',
      'Pillow High (199+)',
      'Duvets (SAR)',
      'Duvets %',
      'Duvets Full (SAR)',
      'Duvets Full %',
      'Toppers (SAR)',
      'Toppers %',
      'Pillows (SAR)',
      'Pillows %',
      'Other (SAR)',
      'Other %',
    ];

    const data: (string | number | null)[][] = [
      ['Store Performance Report'],
      [`Period: ${periodLabel}`],
      [],
      header,
    ];

    storeReportRows.forEach((row, idx) => {
      data.push([
        idx + 1,
        row.name,
        row.areaManager,
        row.salesTarget,
        row.salesAchieved,
        row.achievementPercent,
        row.transactions,
        row.avgTicket,
        row.conversionRate,
        row.salesPerVisitor,
        row.duvetTarget,
        row.duvetUnits,
        row.duvetAchievementPercent,
        row.visitorGrowth,
        row.salesGrowth,
        row.duvetLow,
        row.duvetMedium,
        row.duvetHigh,
        row.pillowLow,
        row.pillowMedium,
        row.pillowHigh,
        row.categoryShareDuvetsValue,
        row.categoryShareDuvets / 100,
        row.categoryShareDuvetsFullValue,
        row.categoryShareDuvetsFull / 100,
        row.categoryShareToppersValue,
        row.categoryShareToppers / 100,
        row.categorySharePillowsValue,
        row.categorySharePillows / 100,
        row.categoryShareOtherValue,
        row.categoryShareOther / 100,
      ]);
    });

    data.push([]);
    const totalSalesTarget = storeReportRows.reduce((sum, row) => sum + row.salesTarget, 0);
    const totalSalesAchieved = storeReportRows.reduce((sum, row) => sum + row.salesAchieved, 0);
    const totalSalesAchievement = totalSalesTarget > 0 ? totalSalesAchieved / totalSalesTarget : 0;
    const totalTransactions = storeReportRows.reduce((sum, row) => sum + row.transactions, 0);
    const overallAvgTicket = totalTransactions > 0 ? totalSalesAchieved / totalTransactions : 0;
    const totalVisitors = storeReportRows.reduce((sum, row) => sum + (row.visitors || 0), 0);
    const overallConversionRate = totalVisitors > 0 ? totalTransactions / totalVisitors : 0;
    const overallSalesPerVisitor = totalVisitors > 0 ? totalSalesAchieved / totalVisitors : 0;
    const totalDuvetTarget = storeReportRows.reduce((sum, row) => sum + row.duvetTarget, 0);
    const totalDuvetUnits = storeReportRows.reduce((sum, row) => sum + row.duvetUnits, 0);
    const totalDuvetAchievement = totalDuvetTarget > 0 ? totalDuvetUnits / totalDuvetTarget : 0;
    const totalLow = storeReportRows.reduce((sum, row) => sum + row.duvetLow, 0);
    const totalMedium = storeReportRows.reduce((sum, row) => sum + row.duvetMedium, 0);
    const totalHigh = storeReportRows.reduce((sum, row) => sum + row.duvetHigh, 0);
    const totalPillowLow = storeReportRows.reduce((sum, row) => sum + row.pillowLow, 0);
    const totalPillowMedium = storeReportRows.reduce((sum, row) => sum + row.pillowMedium, 0);
    const totalPillowHigh = storeReportRows.reduce((sum, row) => sum + row.pillowHigh, 0);
    const totalDuvetsValue = storeReportRows.reduce((sum, row) => sum + row.categoryShareDuvetsValue, 0);
    const totalDuvetsFullValue = storeReportRows.reduce((sum, row) => sum + row.categoryShareDuvetsFullValue, 0);
    const totalToppersValue = storeReportRows.reduce((sum, row) => sum + row.categoryShareToppersValue, 0);
    const totalPillowsValue = storeReportRows.reduce((sum, row) => sum + row.categorySharePillowsValue, 0);
    const totalOtherValue = storeReportRows.reduce((sum, row) => sum + row.categoryShareOtherValue, 0);
    const totalCategoryValue = totalDuvetsValue + totalDuvetsFullValue + totalToppersValue + totalPillowsValue + totalOtherValue;

    data.push([
      'Totals',
      null,
      null,
      totalSalesTarget,
      totalSalesAchieved,
      totalSalesAchievement,
      totalTransactions,
      overallAvgTicket,
      overallConversionRate,
      overallSalesPerVisitor,
      totalDuvetTarget,
      totalDuvetUnits,
      totalDuvetAchievement,
      null,
      null,
      totalLow,
      totalMedium,
      totalHigh,
      totalPillowLow,
      totalPillowMedium,
      totalPillowHigh,
      totalDuvetsValue,
      totalCategoryValue > 0 ? (totalDuvetsValue / totalCategoryValue) * 100 : 0,
      totalDuvetsFullValue,
      totalCategoryValue > 0 ? (totalDuvetsFullValue / totalCategoryValue) * 100 : 0,
      totalToppersValue,
      totalCategoryValue > 0 ? (totalToppersValue / totalCategoryValue) * 100 : 0,
      totalPillowsValue,
      totalCategoryValue > 0 ? (totalPillowsValue / totalCategoryValue) * 100 : 0,
      totalOtherValue,
      totalCategoryValue > 0 ? (totalOtherValue / totalCategoryValue) * 100 : 0,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 26 },
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
    ];
    ws['!merges'] = [
      XLSX.utils.decode_range('A1:AG1'),
      XLSX.utils.decode_range('A2:AG2'),
    ];

    if (ws['A1']) ws['A1'].s = titleStyle;
    if (ws['A2']) ws['A2'].s = subtitleStyle;

    const headerRowIndex = 3;
    applyHeaderStyles(ws, headerRowIndex, header.length, headerStyle);

    const dataStartRow = headerRowIndex + 1;
    applyNumberFormats(ws, dataStartRow, storeReportRows.length, [
      { index: 3, format: '#,##0.00' },
      { index: 4, format: '#,##0.00' },
      { index: 5, format: '0.0%' },
      { index: 6, format: '#,##0' },
      { index: 7, format: '#,##0.00' },
      { index: 8, format: '0.0%' },
      { index: 9, format: '#,##0.00' },
      { index: 10, format: '#,##0' },
      { index: 11, format: '#,##0' },
      { index: 12, format: '0.0%' },
      { index: 13, format: '0.0%' },
      { index: 14, format: '0.0%' },
      { index: 15, format: '#,##0' },
      { index: 16, format: '#,##0' },
      { index: 17, format: '#,##0' },
      { index: 18, format: '#,##0' },    // Pillow Low
      { index: 19, format: '#,##0' },    // Pillow Medium
      { index: 20, format: '#,##0' },    // Pillow High
      { index: 21, format: '#,##0.00' }, // Duvets (SAR)
      { index: 22, format: '0.0%' },     // Duvets %
      { index: 23, format: '#,##0.00' }, // Duvets Full (SAR)
      { index: 24, format: '0.0%' },     // Duvets Full %
      { index: 25, format: '#,##0.00' }, // Toppers (SAR)
      { index: 26, format: '0.0%' },     // Toppers %
      { index: 27, format: '#,##0.00' }, // Pillows (SAR)
      { index: 28, format: '0.0%' },     // Pillows %
      { index: 29, format: '#,##0.00' }, // Other (SAR)
      { index: 30, format: '0.0%' },     // Other %
    ]);

    const totalsRowIndex = dataStartRow + storeReportRows.length + 1;
    applyNumberFormats(ws, totalsRowIndex, 1, [
      { index: 3, format: '#,##0.00' },
      { index: 4, format: '#,##0.00' },
      { index: 5, format: '0.0%' },
      { index: 6, format: '#,##0' },
      { index: 7, format: '#,##0.00' },
      { index: 8, format: '0.0%' },
      { index: 9, format: '#,##0.00' },
      { index: 10, format: '#,##0' },
      { index: 11, format: '#,##0' },
      { index: 12, format: '0.0%' },
      { index: 13, format: '0.0%' },
      { index: 14, format: '0.0%' },
      { index: 15, format: '#,##0' },
      { index: 16, format: '#,##0' },
      { index: 17, format: '#,##0' },
      { index: 18, format: '#,##0' },    // Pillow Low
      { index: 19, format: '#,##0' },    // Pillow Medium
      { index: 20, format: '#,##0' },    // Pillow High
      { index: 21, format: '#,##0.00' }, // Duvets (SAR)
      { index: 22, format: '0.0%' },     // Duvets %
      { index: 23, format: '#,##0.00' }, // Duvets Full (SAR)
      { index: 24, format: '0.0%' },     // Duvets Full %
      { index: 25, format: '#,##0.00' }, // Toppers (SAR)
      { index: 26, format: '0.0%' },     // Toppers %
      { index: 27, format: '#,##0.00' }, // Pillows (SAR)
      { index: 28, format: '0.0%' },     // Pillows %
      { index: 29, format: '#,##0.00' }, // Other (SAR)
      { index: 30, format: '0.0%' },     // Other %
    ]);
    for (let c = 0; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: totalsRowIndex, c });
      if (ws[addr]) ws[addr].s = { ...(ws[addr].s || {}), ...totalStyle };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stores');
    const fileName = `Stores_Report_${periodLabel.replace(/[^\w]+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            onClearResult();
            setUploadProgress(0);
        }
    };

    const handleUpload = () => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
                onUpload(jsonData, setUploadProgress);
            } catch (error: any) {
                alert(`File processing failed: ${error.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6 max-w-3xl mx-auto">
            <div>
                <h3 className="text-xl font-semibold text-zinc-700">Smart Data Uploader</h3>
                <p className="text-sm text-zinc-500 mt-1">Upload an XLSX file. The system will automatically detect the file type and import the data.</p>
            </div>

      <div className="p-4 border border-indigo-100 rounded-lg bg-indigo-50/70">
        <h4 className="font-semibold text-indigo-900 mb-3">{copy.filterTitle}</h4>
        <p className="text-xs text-indigo-700 mb-4">{copy.filterHint}</p>
        <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allData} forceRangeOnly />
      </div>

      <div className="p-5 rounded-xl border border-blue-100 bg-sky-50/70 space-y-3">
        <div>
          <h4 className="text-lg font-semibold text-sky-900">{copy.downloadsTitle}</h4>
          <p className="text-sm text-sky-700 mt-1">{copy.downloadsDescription}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={downloadEmployeeReport}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          >
            {copy.employeeButton}
          </button>
          <button
            onClick={downloadStoreReport}
            className="btn-secondary w-full text-sm flex items-center justify-center gap-2 border-sky-400 text-sky-900 hover:bg-sky-100"
          >
            {copy.storeButton}
          </button>
        </div>
        <div className="text-xs text-sky-600">
          <p>{copy.employeeNote}</p>
          <p>{copy.storeNote}</p>
        </div>
      </div>
            
            <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-zinc-600 mb-2">Download Templates</h4>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => downloadTemplate('Sales_Summary_Template', ['Sales Man Name', 'Outlet Name', 'Bill Date', 'Net Amount', 'Total Sales Bills'])} className="btn-secondary text-sm">Sales Summary</button>
                    <button onClick={() => downloadTemplate('Item_Wise_Sales_Template', ['Outlet Name', 'SalesMan Name', 'Bill Dt.', 'Item Name', 'Item Alias', 'Sold Qty', 'Item Rate'])} className="btn-secondary text-sm">Item-wise Sales</button>
                    <button onClick={() => downloadTemplate('Install_Template', ['Type', 'Store Name', 'Area Manager', 'Employee Name', 'Employee Store', 'Year', 'Month', 'Store Target', 'Employee Sales Target', 'Employee Duvet Target'])} className="btn-secondary text-sm">Install File</button>
                    <button onClick={() => downloadTemplate('Visitors_Template', ['Date', 'Store Name', 'Visitors'])} className="btn-secondary text-sm">Visitors</button>
                </div>
            </div>

            <div>
                <label className="label font-semibold">Upload Your File</label>
                <input type="file" onChange={handleFileChange} accept=".xlsx, .xls" className="input mt-2" />
            </div>

            {file && <button onClick={handleUpload} disabled={isProcessing} className="btn-primary w-full">{isProcessing ? 'Uploading...' : 'Upload Data'}</button>}

            {isProcessing && (
                <div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4"><div className="bg-orange-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div></div>
                    <p className="text-center text-sm text-zinc-600 mt-1">{Math.round(uploadProgress)}% Complete</p>
                </div>
            )}

            {uploadResult && (
                <div className="p-4 rounded-lg bg-green-100 text-green-700">
                    <h4 className="font-bold">Upload Complete</h4>
                    <p>Successfully processed {uploadResult.successful.length} records. {uploadResult.skipped} rows skipped.</p>
                    <button onClick={onClearResult} className="btn-secondary mt-2 text-sm">Clear</button>
                </div>
            )}
        </div>
    );
};

export default SmartUploaderPage;