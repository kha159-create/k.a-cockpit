import React from 'react';
import { useTable } from '../hooks/useTable';
import { useLocale } from '../context/LocaleContext';

export interface Column<T> {
  key: keyof T | 'actions';
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  initialSortKey?: keyof T;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  renderExpandedRow?: (item: T) => React.ReactNode | false;
}

const SortIcon: React.FC<{ direction?: 'asc' | 'desc' }> = ({ direction }) => {
    if (!direction) return <span className="text-gray-300">↕</span>;
    return <span>{direction === 'asc' ? '▲' : '▼'}</span>;
};

export const Table = <T extends { id: string }>({ columns, data, initialSortKey, rowClassName, onRowClick, renderExpandedRow }: TableProps<T>) => {
  const { t } = useLocale();
  const {
    paginatedData,
    sortConfig,
    requestSort,
    currentPage,
    totalPages,
    setCurrentPage,
  } = useTable(data, 10, initialSortKey);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-neutral-50 to-neutral-100 border-b border-neutral-200">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="th cursor-pointer group transition-colors duration-200 hover:bg-neutral-200/50"
                  onClick={() => col.sortable && requestSort(col.key as keyof T)}
                >
                  <div className="flex items-center gap-2">
                    <span className="group-hover:text-primary-600 transition-colors duration-200">{col.label}</span>
                    {col.sortable && (
                      <div className="group-hover:text-primary-600 transition-colors duration-200">
                        <SortIcon direction={sortConfig?.key === col.key ? sortConfig.direction : undefined} />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paginatedData.length === 0 ? (
                <tr>
                    <td colSpan={columns.length} className="text-center py-10 text-gray-500">
                        {t('no_data_to_display')}
                    </td>
                </tr>
            ) : (
                paginatedData.map((item) => {
                  const expandedContent = renderExpandedRow ? renderExpandedRow(item) : null;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => onRowClick && onRowClick(item)}
                        className={`transition-all duration-200 ${rowClassName ? rowClassName(item) : ''} ${onRowClick ? 'cursor-pointer hover:bg-primary-50 hover:shadow-sm' : (rowClassName ? 'hover:brightness-95' : 'hover:bg-neutral-50')}`}
                      >
                        {columns.map((col) => (
                          <td key={`${item.id}-${String(col.key)}`} className="td">
                            {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                          </td>
                        ))}
                      </tr>
                      {expandedContent && (
                        <tr>
                          <td colSpan={columns.length} className="p-0 bg-gray-50 border-t-2 border-orange-200">
                            {expandedContent}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-between items-center">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('previous')}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600">
              {t('page_of', { current: currentPage, total: totalPages })}
            </span>
            {/* مؤشرات الصفحات */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = currentPage - 2 + i;
                if (pageNum < 1 || pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                      currentPage === pageNum
                        ? 'bg-primary-500 text-white shadow-md'
                        : 'text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="btn-secondary text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  );
};
