import React, { useState, useMemo } from 'react';
import AreaStoreFilter from '../components/AreaStoreFilter';
import MonthYearFilter from '../components/MonthYearFilter';
import { Table, Column } from '../components/Table';
import { TableSkeleton } from '../components/SkeletonLoader';
import { SparklesIcon } from '../components/Icons';
import { StoreName } from '@/components/Names';
import { getCategory, getSmartDuvetCategories, getSmartDuvetCategory } from '../utils/calculator';
import type { ProductSummary, Store, DateFilter, AreaStoreFilterState, FilterableData, ModalState, UserProfile } from '../types';
import { ChartCard, BarChart, LineChart, PieChart } from '../components/DashboardComponents';
import { generateText } from '../services/geminiService';

interface ProductsPageProps {
  productSummary: ProductSummary[];
  allStores: Store[];
  allDateData: FilterableData[];
  dateFilter: DateFilter;
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilter>>;
  areaStoreFilter: AreaStoreFilterState;
  setAreaStoreFilter: React.Dispatch<React.SetStateAction<AreaStoreFilterState>>;
  setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
  isRecalculating: boolean;
  profile: UserProfile | null;
}

const ProductsPage: React.FC<ProductsPageProps> = ({ 
    productSummary, allStores, allDateData, dateFilter, setDateFilter, areaStoreFilter, setAreaStoreFilter, setModalState, isRecalculating, profile
}) => {
  const [filters, setFilters] = useState({ name: '', alias: '', category: 'All', priceRange: 'All' });

  // Debug: Log the data to see what we're receiving (removed to prevent infinite re-render)
  // console.log('ProductsPage - productSummary:', productSummary);
  // console.log('ProductsPage - isRecalculating:', isRecalculating);

  const filteredProducts = useMemo(() => {
    const nameQuery = filters.name.trim().toLowerCase();
    // Support multi-code search: split by +, comma, or whitespace
    const codeTokens = filters.alias
      .toLowerCase()
      .split(/[+,\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    return productSummary.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(nameQuery);
        const aliasLower = (p.alias || '').toLowerCase();
        const aliasMatch = codeTokens.length === 0
          ? aliasLower.includes(filters.alias.toLowerCase())
          : codeTokens.some(token => aliasLower.includes(token));
        const categoryMatch = filters.category === 'All' || getCategory(p) === filters.category;
        
        const price = p.price || 0;
        const priceMatch = filters.priceRange === 'All' ||
            (filters.priceRange === '<150' && price < 150) ||
            (filters.priceRange === '150-500' && price >= 150 && price <= 500) ||
            (filters.priceRange === '>500' && price > 500);
            
        return nameMatch && aliasMatch && categoryMatch && priceMatch;
    });
  }, [productSummary, filters]);

  const totals = useMemo(() => {
    let qty = 0;
    let value = 0;
    for (const p of filteredProducts) {
      qty += p.soldQty || 0;
      value += p.totalValue || 0;
    }
    return { qty, value };
  }, [filteredProducts]);

  // ===== Dashboard Summary (Month-to-Date and Charts) =====
  const summary = useMemo(() => {
    const Y = dateFilter.year === 'all' ? new Date().getUTCFullYear() : (dateFilter.year as number);
    const M = dateFilter.month === 'all' ? new Date().getUTCMonth() : (dateFilter.month as number); // 0-index
    const D = dateFilter.day === 'all' ? 'all' : (dateFilter.day as number);

    const storesInScope = allStores
      .filter(s => (areaStoreFilter.areaManager === 'All' || s.areaManager === areaStoreFilter.areaManager)
        && (areaStoreFilter.store === 'All' || s.name === areaStoreFilter.store))
      .map(s => s.name);
    const storeSet = new Set(storesInScope);

    type Sale = any;
    const isSale = (d: any): d is Sale => d && d['Bill Dt.'] && typeof d['Bill Dt.'].toDate === 'function' && d['Outlet Name'];

    const sales = (allDateData as any[]).filter(isSale).filter(s => storeSet.has(s['Outlet Name']));

    const daysInMonth = new Date(Y, M + 1, 0).getDate();
    const uptoDay = D === 'all' ? daysInMonth : Math.min(D, daysInMonth);

    const currentMonth = sales.filter(s => {
      const d = s['Bill Dt.'].toDate();
      return d.getUTCFullYear() === Y && d.getUTCMonth() === M && d.getUTCDate() <= uptoDay;
    });

    const prevMonthDate = new Date(Date.UTC(Y, M - 1, 1));
    const PY = prevMonthDate.getUTCFullYear();
    const PM = prevMonthDate.getUTCMonth();
    const prevMonth = sales.filter(s => {
      const d = s['Bill Dt.'].toDate();
      return d.getUTCFullYear() === PY && d.getUTCMonth() === PM;
    });

    // Group by product alias (fallback to name)
    const groupBy = (arr: Sale[]) => {
      const map = new Map<string, { name: string; qty: number; value: number; rate: number }>();
      for (const s of arr) {
        const alias = String(s['Item Alias'] || s.alias || s['Item Name'] || '');
        const name = String(s['Item Name'] || alias);
        const qty = Number(s['Sold Qty'] || 0);
        const rate = Number(s['Item Rate'] || 0);
        const value = qty * rate;
        const prev = map.get(alias) || { name, qty: 0, value: 0, rate };
        prev.qty += qty;
        prev.value += value;
        prev.rate = rate || prev.rate;
        map.set(alias, prev);
      }
      return map;
    };

    const curMap = groupBy(currentMonth);
    const prevMap = groupBy(prevMonth);

    let totalQty = 0; let totalValue = 0;
    for (const { qty, value } of curMap.values()) { totalQty += qty; totalValue += value; }

    // Best and weakest products by value
    let best: { name: string; value: number; growth: number } | null = null;
    let weak: { name: string; value: number; growth: number } | null = null;
    curMap.forEach((cur, key) => {
      const prevVal = prevMap.get(key)?.value || 0;
      const growth = prevVal === 0 ? (cur.value > 0 ? 100 : 0) : ((cur.value - prevVal) / prevVal) * 100;
      if (!best || cur.value > best.value) best = { name: cur.name, value: cur.value, growth };
      if ((cur.value > 0) && (!weak || cur.value < weak.value)) weak = { name: cur.name, value: cur.value, growth };
    });

    const avgDaily = uptoDay > 0 ? totalValue / uptoDay : 0;

    const prevTotal = Array.from(prevMap.values()).reduce((s, v) => s + v.value, 0);
    const monthlyGrowth = prevTotal === 0 ? (totalValue > 0 ? 100 : 0) : ((totalValue - prevTotal) / prevTotal) * 100;

    // Charts data
    const top10 = Array.from(curMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(p => ({ name: p.name, value: p.qty }));

    const monthlyTrend = Array.from({ length: 12 }, (_, i) => ({ name: new Date(0, i).toLocaleString('en-US', { month: 'short' }), value: 0 }));
    sales.forEach(s => {
      const d = s['Bill Dt.'].toDate();
      if (d.getUTCFullYear() !== Y) return;
      const m = d.getUTCMonth();
      monthlyTrend[m].value += Number(s['Sold Qty'] || 0) * Number(s['Item Rate'] || 0);
    });

    // Category share using current filtered products
    const categoryMap = new Map<string, number>();
    filteredProducts.forEach(p => {
      const cat = getCategory(p) || 'Other';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + (p.totalValue || 0));
    });
    const categoryShare = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));

    const resolveUnitPrice = (product: ProductSummary) => {
      if (product.price && product.price > 0) {
        return product.price;
      }
      if (product.soldQty && product.totalValue) {
        const inferred = product.totalValue / product.soldQty;
        return Number.isFinite(inferred) ? inferred : 0;
      }
      return 0;
    };

    const duvetProducts = filteredProducts.filter(p => {
      const category = getCategory(p);
      if (filters.category === 'Duvets' || filters.category === 'Duvets Full') {
        return category === filters.category;
      }
      return category === 'Duvets' || category === 'Duvets Full';
    });

    // Smart categorization: collect all prices first, then create categories
    const duvetPrices = duvetProducts.map(p => resolveUnitPrice(p)).filter(p => p > 0);
    const smartCategories = getSmartDuvetCategories(duvetPrices);
    
    const duvetLabels = [smartCategories.low.label, smartCategories.medium.label, smartCategories.high.label];
    const duvetBuckets: Record<string, number> = {
      [smartCategories.low.label]: 0,
      [smartCategories.medium.label]: 0,
      [smartCategories.high.label]: 0,
    };

    let totalDuvetUnits = 0;
    duvetProducts.forEach(product => {
      const price = resolveUnitPrice(product);
      const category = getSmartDuvetCategory(price, smartCategories);
      if (!category) return;
      const qty = product.soldQty || 0;
      duvetBuckets[category] += qty;
      totalDuvetUnits += qty;
    });

    const duvetBreakdown = duvetLabels.map(label => ({
      name: label,
      units: duvetBuckets[label] || 0,
      percentage: totalDuvetUnits > 0 ? ((duvetBuckets[label] || 0) / totalDuvetUnits) * 100 : 0,
    }));

    return {
      totalQty, totalValue, best, weak, avgDaily, monthlyGrowth,
      charts: { top10, monthlyTrend, categoryShare },
      duvetAnalysis: {
        totalUnits: totalDuvetUnits,
        breakdown: duvetBreakdown,
      },
    };
  }, [allDateData, allStores, areaStoreFilter, dateFilter, filteredProducts, filters.category]);

  // ===== Cross-Selling (Frequently Sold Together) =====
  type PairKey = string;
  type PairStat = { a: string; b: string; count: number };
  const crossSelling = useMemo(() => {
    const Y = dateFilter.year === 'all' ? new Date().getUTCFullYear() : (dateFilter.year as number);
    const M = dateFilter.month === 'all' ? new Date().getUTCMonth() : (dateFilter.month as number);
    const storesInScope = allStores
      .filter(s => (areaStoreFilter.areaManager === 'All' || s.areaManager === areaStoreFilter.areaManager)
        && (areaStoreFilter.store === 'All' || s.name === areaStoreFilter.store))
      .map(s => s.name);
    const storeSet = new Set(storesInScope);

    const sales = (allDateData as any[]).filter((d: any) => d && d['Bill Dt.'] && typeof d['Bill Dt.'].toDate === 'function' && d['Outlet Name'] && storeSet.has(d['Outlet Name']));

    // Group items by bill_no if available; fallback to synthetic key
    const byTxn = new Map<string, { name: string }[]>();
    for (const s of sales) {
      const d = s['Bill Dt.'].toDate();
      if (d.getUTCFullYear() !== Y || (dateFilter.month !== 'all' && d.getUTCMonth() !== M)) continue;
      const billNo = (s.bill_no || s['Bill_No'] || s['Invoice'] || s['Transaction_ID'] || s['Bill Number'] || s['Invoice No'] || '').toString();
      const key = billNo
        ? String(billNo)
        : `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}|${s['Outlet Name']}|${s['SalesMan Name'] || ''}`;
      if (!billNo) console.warn('⚠ Missing Bill_No, using fallback mode');
      const name = String(s['Item Name'] || s['Item Alias'] || '');
      if (!name) continue;
      const arr = byTxn.get(key) || [];
      arr.push({ name });
      byTxn.set(key, arr);
    }

    const pairCounts = new Map<PairKey, PairStat>();
    byTxn.forEach(items => {
      const names = Array.from(new Set(items.map(i => i.name)));
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = names[i];
          const b = names[j];
          const key = `${a}__::__${b}`;
          const cur = pairCounts.get(key) || { a, b, count: 0 };
          cur.count += 1;
          pairCounts.set(key, cur);
        }
      }
    });

    const topPairs = Array.from(pairCounts.values()).sort((x, y) => y.count - x.count).slice(0, 20);

    // Prepare heatmap matrix (top N unique items)
    const uniqueItems = Array.from(new Set(topPairs.flatMap(p => [p.a, p.b]))).slice(0, 12);
    const index = new Map(uniqueItems.map((n, i) => [n, i] as const));
    const size = uniqueItems.length;
    const matrix: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
    topPairs.forEach(p => {
      const i = index.get(p.a);
      const j = index.get(p.b);
      if (i === undefined || j === undefined) return;
      matrix[i][j] += p.count;
      matrix[j][i] += p.count;
    });

    // Network graph data
    const nodes = uniqueItems.map(name => ({ id: name, name, value: 1 }));
    const allowed = new Set(uniqueItems);
    const links = topPairs
      .filter(p => allowed.has(p.a) && allowed.has(p.b))
      .map(p => ({ source: p.a, target: p.b, value: p.count }));

    return { topPairs, uniqueItems, matrix, nodes, links };
  }, [allDateData, allStores, areaStoreFilter, dateFilter]);

  // ===== AI Insights (expandable) =====
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const runAiAnalysis = async () => {
    try {
      setAiLoading(true);
      const payload = {
        contents: [
          { role: 'user', parts: [{ text: `You are a retail analyst. Compare current month vs previous month performance for products.
Current Month (upto selected day):
${JSON.stringify(summary, null, 2)}

Provide 3-5 concise bullet insights like:\n- Product X increased by +24% compared to last month.\n- Product Y dropped by -15% — check stock or display.\n- Product Z often sells with Product W.
Use short sentences. Output in Arabic.` }]}
        ],
        systemInstruction: 'Keep answers concise and organized as bullets. No long paragraphs.'
      } as any;
      const text = await generateText(payload, 'gemini-2.5-flash');
      setAiInsights(text);
    } catch (e: any) {
      setAiInsights(`تعذر توليد التحليلات الآن: ${e?.message || e}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Debug: Log filteredProducts after it's defined (removed to prevent infinite re-render)
  // console.log('ProductsPage - filteredProducts:', filteredProducts);

  const columns: Column<ProductSummary>[] = [
    { key: 'name', label: 'Product Name', sortable: true, render: (value) => value ?? '' },
    { key: 'alias', label: 'Code', sortable: true, render: (value) => value ?? '' },
    { key: 'soldQty', label: 'Sold Qty', sortable: true, render: (value) => (value as number).toLocaleString('en-US') },
    { key: 'price', label: 'Price', sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
    { key: 'totalValue', label: 'Total Sales Value', sortable: true, render: (value) => (value as number).toLocaleString('en-US', { style: 'currency', currency: 'SAR' }) },
    { key: 'actions', label: 'Actions', render: (_value, record) => (
      <div className="flex items-center gap-2">
      <button onClick={() => setModalState({ type: 'salesPitch', data: record })} className="text-orange-500 hover:text-orange-700" title="Get AI Sales Pitch">
        <SparklesIcon />
      </button>
      <button onClick={() => setModalState({ type: 'productDetails', data: { product: record, allData: allDateData, stores: allStores } })} className="text-zinc-600 hover:text-zinc-900" title="Product Details">
        ⚙
      </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />
        <AreaStoreFilter stores={allStores} filters={areaStoreFilter} setFilters={setAreaStoreFilter} profile={profile}/>
      </div>
      <div className="space-y-6">
        {/* Table Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-xl font-semibold text-zinc-800 mb-4">Products Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <input type="text" placeholder="Filter by Product Name..." value={filters.name} onChange={e => setFilters(prev => ({...prev, name: e.target.value}))} className="input" />
            <input type="text" placeholder="Filter by Code (use + for multiple)..." value={filters.alias} onChange={e => setFilters(prev => ({...prev, alias: e.target.value}))} className="input" />
            <select value={filters.category} onChange={e => setFilters(prev => ({...prev, category: e.target.value}))} className="input">
                <option value="All">All Categories</option>
                <option value="Duvets">Duvets</option>
                <option value="Duvets Full">Duvets Full</option>
                <option value="Pillows">Pillows</option>
                <option value="Toppers">Toppers</option>
                <option value="Other">Other</option>
            </select>
            <select value={filters.priceRange} onChange={e => setFilters(prev => ({...prev, priceRange: e.target.value}))} className="input">
                <option value="All">All Prices</option>
                <option value="<150">&lt; 150 SAR</option>
                <option value="150-500">150 - 500 SAR</option>
                <option value=">500">&gt; 500 SAR</option>
            </select>
        </div>
        
        

        {isRecalculating ? <TableSkeleton /> : (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-3 text-sm text-zinc-700">
              <div className="px-3 py-1.5 rounded-md bg-zinc-100 border">
                <span className="font-semibold">Sold Qty:</span> {totals.qty.toLocaleString('en-US')}
              </div>
              <div className="px-3 py-1.5 rounded-md bg-zinc-100 border">
                <span className="font-semibold">Total Value:</span> {totals.value.toLocaleString('en-US', { style: 'currency', currency: 'SAR' })}
              </div>
            </div>
            <Table columns={columns} data={filteredProducts} initialSortKey="totalValue" />
          </>
        )}
      </div>
      
      {/* Summary Dashboard & Analytics */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-xs text-zinc-500 mb-1">Total Products Sold (MTD)</div>
            <div className="text-2xl font-bold">{summary.totalQty.toLocaleString('en-US')}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-xs text-zinc-500 mb-1">Total Sales Value (MTD)</div>
            <div className="text-2xl font-bold">{summary.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-xs text-zinc-500 mb-1">Best Performing Product</div>
            <div className="text-sm font-semibold truncate" title={summary.best?.name || ''}>{summary.best?.name || '-'}</div>
            <div className="text-green-600 text-xs">{summary.best ? `${summary.best.growth.toFixed(1)}%` : '-'}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-xs text-zinc-500 mb-1">Weakest Performing Product</div>
            <div className="text-sm font-semibold truncate" title={summary.weak?.name || ''}>{summary.weak?.name || '-'}</div>
            <div className="text-red-600 text-xs">{summary.weak ? `${summary.weak.growth.toFixed(1)}%` : '-'}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border">
            <div className="text-xs text-zinc-500 mb-1">Average Daily Sales</div>
            <div className="text-2xl font-bold">{summary.avgDaily.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 })}</div>
          </div>
        <div className={`bg-white p-4 rounded-xl shadow-sm border`}>
            <div className="text-xs text-zinc-500 mb-1">Monthly Growth Rate</div>
            <div className={`text-2xl font-bold ${summary.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{`${summary.monthlyGrowth.toFixed(1)}%`}</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <ChartCard 
            title="Top 10 Selling Products"
            watermark={areaStoreFilter.store !== 'All' ? areaStoreFilter.store : undefined}
            watermarkOpacity={areaStoreFilter.store !== 'All' ? 0.15 : 0}
          >
            <BarChart data={summary.charts.top10} dataKey="value" nameKey="name" format={v => v.toLocaleString('en-US')} />
          </ChartCard>
          <ChartCard 
            title="Category Share" 
            className="xl:col-span-2"
            watermark={areaStoreFilter.store !== 'All' ? areaStoreFilter.store : undefined}
            watermarkOpacity={areaStoreFilter.store !== 'All' ? 0.15 : 0}
          >
            <PieChart data={summary.charts.categoryShare} vertical={true} />
          </ChartCard>
          <ChartCard 
            title="Duvet Sales Analysis by Value"
            watermark={areaStoreFilter.store !== 'All' ? areaStoreFilter.store : undefined}
            watermarkOpacity={areaStoreFilter.store !== 'All' ? 0.15 : 0}
          >
            <div className="space-y-3 p-1 h-full flex flex-col">
              {summary.duvetAnalysis.totalUnits > 0 ? (
                summary.duvetAnalysis.breakdown.map(item => (
                  <div key={item.name}>
                    <div className="flex justify-between text-xs font-medium text-zinc-600 mb-1">
                      <span>{item.name}</span>
                      <span>{item.units} units ({item.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-sky-500 h-3 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-zinc-500 text-sm">No duvet sales data for this period.</p>
              )}
              <div className="mt-auto pt-2 border-t border-gray-200 text-xs flex justify-between">
                <span className="font-semibold text-zinc-700">Total Duvet Units (MTD):</span>
                <span className="font-bold text-zinc-900">{summary.duvetAnalysis.totalUnits}</span>
              </div>
            </div>
          </ChartCard>
        </div>
      </section>

      {/* Cross-Selling Analytics */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-zinc-800">Frequently Sold Together</h3>

        {/* Heatmap (simple CSS grid visualization) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border overflow-auto">
          <div className="min-w-[640px]">
            <div className="grid" style={{ gridTemplateColumns: `200px repeat(${crossSelling.uniqueItems.length}, minmax(48px, 1fr))` }}>
              <div></div>
              {crossSelling.uniqueItems.map((name) => (
                <div key={`col-${name}`} className="text-[10px] text-zinc-500 text-center truncate px-1">{name}</div>
              ))}
              {crossSelling.uniqueItems.map((rowName, i) => (
                <React.Fragment key={`row-${rowName}`}>
                  <div className="text-[10px] text-zinc-600 truncate px-1 py-1">{rowName}</div>
                  {crossSelling.uniqueItems.map((_, j) => {
                    const v = crossSelling.matrix[i][j];
                    const intensity = Math.min(1, v / Math.max(1, crossSelling.topPairs[0]?.count || 1));
                    const bg = `rgba(34,197,94,${0.1 + intensity * 0.6})`; // green scale
                    return <div key={`cell-${i}-${j}`} className="h-8 m-0.5 rounded" style={{ backgroundColor: i === j ? '#f1f5f9' : bg }} title={`${v}`}></div>;
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Network Graph (simple SVG force layout approximation) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <svg width="100%" height="560" viewBox="0 0 1200 560">
            {(() => {
              const width = 1200; const height = 560;
              const centerX = width / 2; const centerY = height / 2;
              const R = Math.min(width, height) / 2 - 60;
              const n = crossSelling.nodes.length || 1;
              const positions = new Map<string, { x: number; y: number }>();
              crossSelling.nodes.forEach((node, idx) => {
                const angle = (idx / n) * Math.PI * 2;
                positions.set(node.id, { x: centerX + R * Math.cos(angle), y: centerY + R * Math.sin(angle) });
              });
              const maxVal = Math.max(1, ...crossSelling.links.map(l => l.value));
              return (
                <g>
                  {crossSelling.links.map((l, i) => {
                    const s = positions.get(l.source as string);
                    const t = positions.get(l.target as string);
                    if (!s || !t) return null;
                    const opacity = 0.2 + 0.6 * (l.value / maxVal);
                    return <line key={`link-${i}`} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#0ea5e9" strokeOpacity={opacity} strokeWidth={2} />;
                  })}
                  {crossSelling.nodes.map((node, i) => {
                    const p = positions.get(node.id);
                    if (!p) return null;
                    return (
                      <g key={`node-${i}`}>
                        <circle cx={p.x} cy={p.y} r={12} fill="#34d399" stroke="#047857" />
                        <text x={p.x + 14} y={p.y + 4} fontSize={12} fill="#334155">{node.name}</text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* AI Insights (moved below Cross-Selling) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-zinc-800">AI Insights</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setAiOpen(!aiOpen)} className="px-3 py-1.5 rounded-md border text-sm">{aiOpen ? 'إخفاء' : 'إظهار'}</button>
            <button onClick={runAiAnalysis} disabled={aiLoading} className="btn-primary text-sm">{aiLoading ? 'تحليل...' : '🔁 Reanalyze with AI'}</button>
          </div>
        </div>
        {aiOpen && (
          <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 whitespace-pre-wrap text-sm">
            {aiInsights || 'انقر على زر إعادة التحليل لتوليد الرؤى.'}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default ProductsPage;
