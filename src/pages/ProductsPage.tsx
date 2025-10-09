import React, { useState, useMemo } from 'react';
import AreaStoreFilter from '../components/AreaStoreFilter';
import MonthYearFilter from '../components/MonthYearFilter';
import { Table, Column } from '../components/Table';
import { TableSkeleton } from '../components/SkeletonLoader';
import { SparklesIcon } from '../components/Icons';
import { fmtCurrency, fmtNumber } from '@/utils/format';
import { StoreName } from '@/components/Names';
import { getCategory } from '../utils/calculator';
import type { ProductSummary, Store, DateFilter, AreaStoreFilterState, FilterableData, ModalState, UserProfile } from '../types';

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
    return productSummary.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(filters.name.toLowerCase());
        const aliasMatch = p.alias?.toLowerCase().includes(filters.alias.toLowerCase());
        const categoryMatch = filters.category === 'All' || getCategory(p) === filters.category;
        
        const price = p.price || 0;
        const priceMatch = filters.priceRange === 'All' ||
            (filters.priceRange === '<150' && price < 150) ||
            (filters.priceRange === '150-500' && price >= 150 && price <= 500) ||
            (filters.priceRange === '>500' && price > 500);
            
        return nameMatch && aliasMatch && categoryMatch && priceMatch;
    });
  }, [productSummary, filters]);

  // Debug: Log filteredProducts after it's defined (removed to prevent infinite re-render)
  // console.log('ProductsPage - filteredProducts:', filteredProducts);

  const columns: Column<ProductSummary>[] = [
    { key: 'name', label: 'Product Name', sortable: true, render: (item) => item.name ?? '' },
    { key: 'alias', label: 'Code', sortable: true, render: (item) => item.alias ?? '' },
    { key: 'soldQty', label: 'Sold Qty', sortable: true, render: (item) => fmtNumber(item.soldQty) },
    { key: 'price', label: 'Price', sortable: true, render: item => fmtCurrency(item.price) },
    { key: 'totalValue', label: 'Total Sales Value', sortable: true, render: item => fmtCurrency(item.totalValue) },
    { key: 'actions', label: 'Actions', render: (item) => (
      <button onClick={() => setModalState({ type: 'salesPitch', data: item })} className="text-orange-500 hover:text-orange-700" title="Get AI Sales Pitch">
        <SparklesIcon />
      </button>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <MonthYearFilter dateFilter={dateFilter} setDateFilter={setDateFilter} allData={allDateData} />
        <AreaStoreFilter stores={allStores} filters={areaStoreFilter} setFilters={setAreaStoreFilter} profile={profile}/>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-xl font-semibold text-zinc-800 mb-4">Products Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <input type="text" placeholder="Filter by Product Name..." value={filters.name} onChange={e => setFilters(prev => ({...prev, name: e.target.value}))} className="input" />
            <input type="text" placeholder="Filter by Code..." value={filters.alias} onChange={e => setFilters(prev => ({...prev, alias: e.target.value}))} className="input" />
            <select value={filters.category} onChange={e => setFilters(prev => ({...prev, category: e.target.value}))} className="input">
                <option value="All">All Categories</option>
                <option value="Duvets">Duvets</option>
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

        {isRecalculating ? <TableSkeleton /> : <Table columns={columns} data={filteredProducts} initialSortKey="totalValue" />}
      </div>
    </div>
  );
};

export default ProductsPage;
