
import { useMemo } from 'react';
import type { Store, Employee, DailyMetric, SalesTransaction, DateFilter, AreaStoreFilterState, KPIData, StoreSummary, EmployeeSummary, ProductSummary, DuvetSummary, CommissionStoreData, UserProfile } from '../types.js';
import { calculateEffectiveTarget } from '../utils/calculator.js';

interface UseDataProcessingProps {
  stores: Store[];
  employees: Employee[];
  dailyMetrics: DailyMetric[];
  kingDuvetSales: SalesTransaction[];
  salesTransactions: SalesTransaction[];
  dateFilter: DateFilter;
  areaStoreFilter: AreaStoreFilterState;
  profile: UserProfile | null;
}

import { getSmartDuvetCategories, getSmartDuvetCategory } from '../utils/calculator';

const getStoreCommissionRate = (achievement: number): number => {
    if (achievement >= 100) return 0.02; // 2%
    if (achievement >= 90) return 0.01; // 1%
    if (achievement >= 80) return 0.005; // 0.5%
    return 0;
};

const getEmployeeStoreForPeriod = (employee: Employee, dateFilter: DateFilter): string => {
    if (employee.assignments && dateFilter.year !== 'all' && dateFilter.month !== 'all') {
        const key = `${dateFilter.year}-${String(dateFilter.month + 1).padStart(2, '0')}`;
        if (employee.assignments[key]) {
            return employee.assignments[key];
        }
    }
    // Fallback to the most recent known store
    return employee.currentStore;
};

const getRangeBounds = (
    year: number,
    month: number,
    dayFrom: DateFilter['dayFrom'],
    dayTo: DateFilter['dayTo']
) => {
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return { from: 1, to: 31 };
    }
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let from = typeof dayFrom === 'number' ? dayFrom : 1;
    let to = typeof dayTo === 'number' ? dayTo : lastDay;
    from = Math.max(1, Math.min(from, lastDay));
    to = Math.max(1, Math.min(to, lastDay));
    if (to < from) to = from;
    return { from, to };
};

const aggregateRangeForStores = (
    metrics: DailyMetric[],
    year: number,
    month: number,
    bounds: { from: number; to: number },
    allowedStores: Set<string>
) => {
    const result = new Map<string, { sales: number; visitors: number; transactions: number }>();
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return result;
    }
    metrics.forEach(metric => {
        if (!metric.date || typeof metric.date.toDate !== 'function') return;
        const dateObj = metric.date.toDate();
        if (dateObj.getUTCFullYear() !== year || dateObj.getUTCMonth() !== month) return;
        const day = dateObj.getUTCDate();
        if (day < bounds.from || day > bounds.to) return;
        if (!allowedStores.has(metric.store)) return;
        const existing = result.get(metric.store) || { sales: 0, visitors: 0, transactions: 0 };
        existing.sales += metric.totalSales || 0;
        existing.visitors += metric.visitors || 0;
        existing.transactions += metric.transactionCount || 0;
        result.set(metric.store, existing);
    });
    return result;
};

export const useDataProcessing = ({
  stores,
  employees,
  dailyMetrics,
  kingDuvetSales,
  salesTransactions,
  dateFilter,
  areaStoreFilter,
  profile,
}: UseDataProcessingProps) => {

  const activeEmployees = useMemo(() => employees.filter(e => e.status !== 'inactive'), [employees]);

  const roleFilteredData = useMemo(() => {
    if (!profile) {
      return { stores: [], employees: [], dailyMetrics: [], kingDuvetSales: [], salesTransactions: [] };
    }
    const { role } = profile;

    // Derive user's current store and area if missing on profile
    const derivedStoreFromEmployees = employees.find(e =>
      (profile.employeeId && e.employeeId === profile.employeeId) ||
      (e.userId && e.userId === (profile as any).id) ||
      (e.userEmail && e.userEmail === profile.email)
    );

    const effectiveStoreName = profile.store || derivedStoreFromEmployees?.currentStore || '';
    const effectiveAreaManager = profile.areaManager || stores.find(s => s.name === effectiveStoreName)?.areaManager || profile.areaManager || '';

    if (role === 'admin' || role === 'general_manager') {
      return { stores, employees: activeEmployees, dailyMetrics, kingDuvetSales, salesTransactions };
    }

    let visibleStores: Store[];
    if (role === 'area_manager') {
      visibleStores = stores.filter(s => s.areaManager === effectiveAreaManager);
    } else if (role === 'store_manager') {
      const userStore = stores.find(s => s.name === effectiveStoreName);
      visibleStores = userStore ? stores.filter(s => s.areaManager === userStore.areaManager) : [];
    } else { // employee
      visibleStores = stores.filter(s => s.name === effectiveStoreName);
    }

    const visibleStoreNames = new Set(visibleStores.map(s => s.name));
    
    let visibleEmployees: Employee[];
    if (role === 'employee') {
       // Sees colleagues in the same store
      visibleEmployees = activeEmployees.filter(e => e.currentStore === effectiveStoreName);
    } else if (role === 'store_manager') {
      // Sees only employees from their own store
      visibleEmployees = activeEmployees.filter(e => e.currentStore === effectiveStoreName);
    } else { // area_manager
      visibleEmployees = activeEmployees.filter(e => visibleStoreNames.has(getEmployeeStoreForPeriod(e, dateFilter)));
    }
    
    const filterMetrics = (m: DailyMetric) => visibleStoreNames.has(m.store);
    const filterSales = (s: SalesTransaction) => visibleStoreNames.has(s['Outlet Name']);

    return {
      stores: visibleStores,
      employees: visibleEmployees,
      dailyMetrics: dailyMetrics.filter(filterMetrics),
      kingDuvetSales: kingDuvetSales.filter(filterSales),
      salesTransactions: salesTransactions.filter(filterSales),
    };
  }, [profile, stores, activeEmployees, dailyMetrics, kingDuvetSales, salesTransactions, dateFilter]);

  const dateFilteredData = useMemo(() => {
    const filterByDate = (item: DailyMetric | SalesTransaction) => {
        const itemTimestamp = 'date' in item ? item.date : item['Bill Dt.'];
        if (!itemTimestamp || typeof itemTimestamp.toDate !== 'function') return false; // Check if it's a valid Timestamp
        const itemDate = itemTimestamp.toDate();
        const normalizedDate = new Date(Date.UTC(itemDate.getUTCFullYear(), itemDate.getUTCMonth(), itemDate.getUTCDate()));

        const mode = dateFilter.mode ?? 'single';
        const parseIsoDate = (value?: string | null) => {
            if (!value) return null;
            const [y, m, d] = value.split('-').map(Number);
            if ([y, m, d].some(num => Number.isNaN(num))) return null;
            return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
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

        if (!yearMatch || !monthMatch) return yearMatch && monthMatch; // early exit

        if (mode === 'range' && dateFilter.month !== 'all' && dateFilter.year !== 'all') {
            const from = dateFilter.dayFrom === undefined ? 'all' : dateFilter.dayFrom;
            const to = dateFilter.dayTo === undefined ? 'all' : dateFilter.dayTo;
            const itemDay = normalizedDate.getUTCDate();
            if (from === 'all' && to === 'all') return true;
            if (from === 'all' && typeof to === 'number') return itemDay <= to;
            if (typeof from === 'number' && to === 'all') return itemDay >= from;
            if (typeof from === 'number' && typeof to === 'number') {
                const min = Math.min(from, to);
                const max = Math.max(from, to);
                return itemDay >= min && itemDay <= max;
            }
            return true;
        }

        const dayMatch = dateFilter.day === 'all' || normalizedDate.getUTCDate() === dateFilter.day;
        return yearMatch && monthMatch && dayMatch;
    };
    const combinedSales = [...roleFilteredData.salesTransactions, ...roleFilteredData.kingDuvetSales];
    const filteredCombinedSales = combinedSales.filter(filterByDate);

    const filteredDuvetSales = filteredCombinedSales.filter(sale => {
        const alias = sale['Item Alias'] || '';
        const name = sale['Item Name'] || '';
        return String(alias).startsWith('4') && name.toUpperCase().includes('COMFORTER');
    });
    
    return {
        metrics: roleFilteredData.dailyMetrics.filter(filterByDate),
        sales: filteredCombinedSales,
        duvetSales: filteredDuvetSales
    };
  }, [roleFilteredData, dateFilter]);

  const areaFilteredData = useMemo(() => {
      const filteredStores = roleFilteredData.stores.filter(store => 
        (areaStoreFilter.areaManager === 'All' || store.areaManager === areaStoreFilter.areaManager) &&
        (areaStoreFilter.store === 'All' || store.name === areaStoreFilter.store)
      );
      const storeNames = new Set(filteredStores.map(s => s.name));
      // default: employees inside selected stores
      let employeesInScope = roleFilteredData.employees.filter(e => storeNames.has(getEmployeeStoreForPeriod(e, dateFilter)));

      // Special rule: store_manager sees all stores of area, but only employees of own store
      if (profile?.role === 'store_manager') {
        // derive effective store again (same logic used above)
        const derivedStoreFromEmployees = employees.find(e =>
          (profile.employeeId && e.employeeId === profile.employeeId) ||
          (e.userId && e.userId === (profile as any).id) ||
          (e.userEmail && e.userEmail === profile.email)
        );
        const effectiveStoreName = profile.store || derivedStoreFromEmployees?.currentStore || '';
        employeesInScope = roleFilteredData.employees.filter(e => getEmployeeStoreForPeriod(e, dateFilter) === effectiveStoreName);
      }

      return {
          stores: filteredStores,
          employees: employeesInScope,
          metrics: dateFilteredData.metrics.filter(m => storeNames.has(m.store)),
          sales: dateFilteredData.sales.filter(s => storeNames.has(s['Outlet Name'])),
          duvetSales: dateFilteredData.duvetSales.filter(s => storeNames.has(s['Outlet Name'])),
      };
  }, [roleFilteredData, dateFilteredData, areaStoreFilter, dateFilter]);

  const storeSummary = useMemo((): StoreSummary[] => {
    // First calculate employee summaries to get total sales per store from employees
    const employeeSummaryForCalculation: { [storeName: string]: EmployeeSummary[] } = {};
    
    areaFilteredData.employees.forEach(employee => {
      const storeForPeriod = getEmployeeStoreForPeriod(employee, dateFilter);
      if (!areaFilteredData.stores.some(s => s.name === storeForPeriod)) return;

      const metricsForEmployee = areaFilteredData.metrics.filter(m => 
        m.employeeId === employee.employeeId || m.employee === employee.name
      );
      const totalSales = metricsForEmployee.reduce((sum, m) => sum + (m.totalSales || 0), 0);
      const totalTransactions = metricsForEmployee.reduce((sum, m) => sum + (m.transactionCount || 0), 0);

      if (!employeeSummaryForCalculation[storeForPeriod]) employeeSummaryForCalculation[storeForPeriod] = [];
      employeeSummaryForCalculation[storeForPeriod].push({
        ...employee,
        store: storeForPeriod,
        totalSales,
        totalTransactions,
      } as EmployeeSummary);
    });
    
    // Calculate store totals from employees (store.totalSales = sum of employee sales)
    return areaFilteredData.stores.map(store => {
      // Get total sales from employees in this store
      const employeesInStore = employeeSummaryForCalculation[store.name] || [];
      const totalSalesFromEmployees = employeesInStore.reduce((sum, emp) => sum + (emp.totalSales || 0), 0);
      const totalTransactionsFromEmployees = employeesInStore.reduce((sum, emp) => sum + (emp.totalTransactions || 0), 0);
      
      // Also get from direct store metrics (for backward compatibility or manual entries)
      const metricsForStore = areaFilteredData.metrics.filter(m => m.store === store.name && !m.employee);
      const totalSalesFromMetrics = metricsForStore.reduce((sum, m) => sum + (m.totalSales || 0), 0);
      const transactionCountFromMetrics = metricsForStore.reduce((sum, m) => sum + (m.transactionCount || 0), 0);
      
      // Combine both: employees take priority, but add any direct store metrics
      const totalSales = totalSalesFromEmployees + totalSalesFromMetrics;
      const transactionCount = totalTransactionsFromEmployees + transactionCountFromMetrics;
      const visitors = areaFilteredData.metrics.filter(m => m.store === store.name).reduce((sum, m) => sum + (m.visitors || 0), 0);
      const effectiveTarget = calculateEffectiveTarget(store.targets, dateFilter);
      
      return {
        ...store,
        totalSales, transactionCount, visitors,
        atv: transactionCount > 0 ? totalSales / transactionCount : 0,
        visitorRate: visitors > 0 ? (transactionCount / visitors) * 100 : 0,
        effectiveTarget,
        targetAchievement: effectiveTarget > 0 ? (totalSales / effectiveTarget) * 100 : 0,
        salesPerVisitor: visitors > 0 ? totalSales / visitors : 0,
      };
    });
  }, [areaFilteredData.stores, areaFilteredData.metrics, areaFilteredData.employees, dateFilter]);

  const storeNamesSet = useMemo(() => new Set(areaFilteredData.stores.map(store => store.name)), [areaFilteredData.stores]);

  const storePerformanceExtras = useMemo(() => {
      const now = new Date();
      const resolvedYear = typeof dateFilter.year === 'number' ? dateFilter.year : now.getUTCFullYear();
      const resolvedMonth = typeof dateFilter.month === 'number' ? dateFilter.month : now.getUTCMonth();
      const comparisonYear = resolvedYear - 1;
      const currentBounds = getRangeBounds(resolvedYear, resolvedMonth, dateFilter.dayFrom, dateFilter.dayTo);
      const comparisonBounds = getRangeBounds(comparisonYear, resolvedMonth, dateFilter.dayFrom, dateFilter.dayTo);

      const currentAggregates = aggregateRangeForStores(
          roleFilteredData.dailyMetrics,
          resolvedYear,
          resolvedMonth,
          currentBounds,
          storeNamesSet
      );
      const comparisonAggregates = aggregateRangeForStores(
          roleFilteredData.dailyMetrics,
          comparisonYear,
          resolvedMonth,
          comparisonBounds,
          storeNamesSet
      );

      const extras: Record<string, {
          avgTicket: number;
          transactions: number;
          conversionRate: number;
          salesPerVisitor: number;
          visitors: number;
          visitorGrowth: number | null;
          salesGrowth: number | null;
      }> = {};
      storeSummary.forEach(store => {
          const current = currentAggregates.get(store.name) ?? {
              sales: store.totalSales ?? 0,
              visitors: store.visitors ?? 0,
              transactions: store.transactionCount ?? 0,
          };
          const previous = comparisonAggregates.get(store.name) ?? { sales: 0, visitors: 0, transactions: 0 };
          const salesGrowth = previous.sales > 0 ? (current.sales - previous.sales) / previous.sales : null;
          const visitorGrowth = previous.visitors > 0 ? (current.visitors - previous.visitors) / previous.visitors : null;
          extras[store.name] = {
              avgTicket: current.transactions > 0 ? current.sales / current.transactions : 0,
              transactions: current.transactions,
              conversionRate: current.visitors > 0 ? current.transactions / current.visitors : 0,
              salesPerVisitor: current.visitors > 0 ? current.sales / current.visitors : 0,
              visitors: current.visitors,
              visitorGrowth,
              salesGrowth,
          };
      });
      return extras;
  }, [storeSummary, roleFilteredData.dailyMetrics, storeNamesSet, dateFilter]);

  const employeeSummary = useMemo(() => {
      const summary: { [storeName: string]: EmployeeSummary[] } = {};
      
      // First, process employees from the employees list
      areaFilteredData.employees.forEach(employee => {
          const storeForPeriod = getEmployeeStoreForPeriod(employee, dateFilter);
          if (!areaFilteredData.stores.some(s => s.name === storeForPeriod)) return;

          // Try to match by employeeId first, then by name as fallback
          const metricsForEmployee = areaFilteredData.metrics.filter(m => 
            m.employeeId === employee.employeeId || m.employee === employee.name
          );
          const totalSales = metricsForEmployee.reduce((sum, m) => sum + (m.totalSales || 0), 0);
          const totalTransactions = metricsForEmployee.reduce((sum, m) => sum + (m.transactionCount || 0), 0);
          const effectiveTarget = calculateEffectiveTarget(employee.targets, dateFilter);

          if (!summary[storeForPeriod]) summary[storeForPeriod] = [];
          summary[storeForPeriod].push({
              ...employee, 
              store: storeForPeriod,
              totalSales, 
              totalTransactions,
              atv: totalTransactions > 0 ? totalSales / totalTransactions : 0,
              effectiveTarget,
              achievement: effectiveTarget > 0 ? (totalSales / effectiveTarget) * 100 : 0,
          });
      });

      // Second, find employees from sales transactions who might not be in the employees list
      const employeeNamesFromSales = new Set<string>();
      areaFilteredData.sales.forEach(sale => {
          const employeeName = sale['SalesMan Name'];
          if (employeeName && !employeeNamesFromSales.has(employeeName)) {
              employeeNamesFromSales.add(employeeName);
              
              // Check if this employee is already processed
              const alreadyProcessed = Object.values(summary).some(employees => 
                  employees.some(emp => emp.name === employeeName)
              );
              
              if (!alreadyProcessed) {
                  // Create a virtual employee entry for this salesperson
                  const employeeSales = areaFilteredData.sales.filter(s => s['SalesMan Name'] === employeeName);
                  const totalSales = employeeSales.reduce((sum, s) => sum + (s['Net Amount'] || 0), 0);
                  const totalTransactions = employeeSales.length;
                  const storeName = employeeSales[0]?.['Outlet Name'] || 'Unknown Store';
                  
                  if (!summary[storeName]) summary[storeName] = [];
                  summary[storeName].push({
                      id: employeeName.replace(/\s+/g, '_'),
                      name: employeeName,
                      currentStore: storeName,
                      store: storeName,
                      totalSales,
                      totalTransactions,
                      atv: totalTransactions > 0 ? totalSales / totalTransactions : 0,
                      effectiveTarget: 0,
                      achievement: 0,
                      status: 'active',
                      employeeId: null,
                  });
              }
          }
      });

      return summary;
  }, [areaFilteredData.employees, areaFilteredData.metrics, areaFilteredData.stores, areaFilteredData.sales, dateFilter]);
  
  const productSummary = useMemo((): ProductSummary[] => {
      const productsMap = new Map<string, ProductSummary>();
      areaFilteredData.sales.forEach(sale => {
          const alias = sale['Item Alias'];
          const qty = sale['Sold Qty'] || 0;
          const rate = sale['Item Rate'] || 0;
          const existing = productsMap.get(alias) || {
              id: alias, name: sale['Item Name'], alias, price: rate, soldQty: 0, totalValue: 0,
          };
          existing.soldQty += qty;
          existing.totalValue += qty * rate;
          productsMap.set(alias, existing);
      });
      return Array.from(productsMap.values()).sort((a,b) => b.totalValue - a.totalValue);
  }, [areaFilteredData.sales]);
  
  const duvetSummary = useMemo((): DuvetSummary => {
      // Smart categorization: collect all prices first
      const duvetPrices = areaFilteredData.duvetSales.map(s => Number(s['Item Rate'] || 0)).filter(p => p > 0);
      const smartCategories = getSmartDuvetCategories(duvetPrices);
      
      return areaFilteredData.duvetSales.reduce((acc, sale) => {
        const storeName = sale['Outlet Name'];
        const category = getSmartDuvetCategory(Number(sale['Item Rate'] || 0), smartCategories);
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
            acc[storeName][category] = (acc[storeName][category] || 0) + sale['Sold Qty'];
            acc[storeName].total += sale['Sold Qty'];
        }
        return acc;
      }, {} as DuvetSummary);
  }, [areaFilteredData.duvetSales]);
  
  const employeeDuvetSales = useMemo(() => {
      return areaFilteredData.duvetSales.reduce<{ byEmployeeId: Record<string, number>; byEmployeeName: Record<string, number> }>((acc, sale) => {
          const qty = Number(sale['Sold Qty'] || 0);
          const empId = sale.employeeId;
          const empName = sale['SalesMan Name'];
          if (empId) {
              acc.byEmployeeId[empId] = (acc.byEmployeeId[empId] || 0) + qty;
          }
          if (empName) {
              acc.byEmployeeName[empName] = (acc.byEmployeeName[empName] || 0) + qty;
          }
          return acc;
      }, { byEmployeeId: {}, byEmployeeName: {} });
  }, [areaFilteredData.duvetSales]);
  
  const commissionData = useMemo((): CommissionStoreData[] => {
      const data: { [key: string]: CommissionStoreData } = {};
      // FIX: Cast the result of flat() to EmployeeSummary[] to resolve type inference issue.
      const allEmployees: EmployeeSummary[] = Object.values(employeeSummary).flat() as EmployeeSummary[];
      
      allEmployees.forEach(employee => {
          const store = storeSummary.find(s => s.name === employee.store);
          if (!store) return;
          if (!data[store.name]) {
              data[store.name] = { name: store.name, achievement: store.targetAchievement, commissionRate: getStoreCommissionRate(store.targetAchievement) * 100, employees: [] };
          }
          const finalCommissionRate = (data[store.name].commissionRate / 100) * (employee.achievement / 100);
          data[store.name].employees.push({ ...employee, finalCommissionRate: finalCommissionRate * 100, commissionAmount: employee.totalSales * finalCommissionRate });
      });
      return Object.values(data);
  }, [storeSummary, employeeSummary]);

  const kpiData = useMemo((): KPIData => {
    const totalSales = storeSummary.reduce((s, i) => s + i.totalSales, 0);
    const totalTransactions = storeSummary.reduce((s, i) => s + i.transactionCount, 0);
    const totalVisitors = storeSummary.reduce((s, i) => s + i.visitors, 0);
    return { 
        totalSales, totalTransactions, 
        averageTransactionValue: totalTransactions > 0 ? totalSales / totalTransactions : 0, 
        conversionRate: totalVisitors > 0 ? (totalTransactions / totalVisitors) * 100 : 0, 
        salesPerVisitor: totalVisitors > 0 ? totalSales / totalVisitors : 0 
    };
  }, [storeSummary]);
  
  const salesPerformance = useMemo(() => {
    const { year, month } = dateFilter;
    if (year === 'all') return [];

    // DAILY VIEW
    if (month !== 'all') {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
            name: `${i + 1}`,
            Sales: 0,
            Target: 0,
        }));

        let totalMonthlyTarget = 0;
        areaFilteredData.stores.forEach(store => {
            totalMonthlyTarget += calculateEffectiveTarget(store.targets, { year, month, day: 'all' });
        });
        const dailyTarget = daysInMonth > 0 ? totalMonthlyTarget / daysInMonth : 0;
        
        dailyData.forEach(day => day.Target = dailyTarget);

        areaFilteredData.metrics.forEach(metric => {
            if (!metric.date || typeof metric.date.toDate !== 'function') return;
            const date = metric.date.toDate();
            if (date.getUTCFullYear() === year && date.getUTCMonth() === month) {
                const dayOfMonth = date.getUTCDate() - 1;
                if (dayOfMonth >= 0 && dayOfMonth < daysInMonth) {
                    dailyData[dayOfMonth].Sales += metric.totalSales || 0;
                }
            }
        });

        return dailyData;
    }

    // MONTHLY VIEW
    const performanceByMonth: { [month: number]: { sales: number; target: number } } = {};
    for (let i = 0; i < 12; i++) {
        performanceByMonth[i] = { sales: 0, target: 0 };
    }

    areaFilteredData.metrics.forEach(metric => {
        if (!metric.date || typeof metric.date.toDate !== 'function') return;
        const date = metric.date.toDate();
        if (date.getUTCFullYear() === year) {
            const monthIndex = date.getUTCMonth();
            performanceByMonth[monthIndex].sales += metric.totalSales || 0;
        }
    });

    areaFilteredData.stores.forEach(store => {
        const storeTargets = store.targets?.[year];
        if (storeTargets) {
            for (const monthKey in storeTargets) {
                const monthIndex = parseInt(monthKey, 10) - 1;
                if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
                    performanceByMonth[monthIndex].target += storeTargets[monthKey] || 0;
                }
            }
        }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Array.from({ length: 12 }).map((_, monthIndex) => ({
        name: monthNames[monthIndex],
        Sales: performanceByMonth[monthIndex].sales,
        Target: performanceByMonth[monthIndex].target,
    }));
}, [areaFilteredData.metrics, areaFilteredData.stores, dateFilter]);

  return { kpiData, storeSummary, storePerformanceExtras, employeeSummary, productSummary, duvetSummary, employeeDuvetSales, commissionData, salesPerformance };
};