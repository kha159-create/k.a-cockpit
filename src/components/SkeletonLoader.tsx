import React from 'react';

const Shimmer: React.FC = () => (
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
);

const BaseSkeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
        <Shimmer />
    </div>
);

export const KPICardSkeleton: React.FC = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <BaseSkeleton className="h-4 w-3/4 mb-3 rounded" />
        <BaseSkeleton className="h-8 w-1/2 rounded" />
    </div>
);

export const ChartSkeleton: React.FC = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
        <BaseSkeleton className="h-6 w-1/2 mb-4 rounded" />
        <div className="flex-grow">
            <BaseSkeleton className="h-full w-full rounded" />
        </div>
    </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
    <div className="space-y-2 p-4">
        <BaseSkeleton className="h-8 rounded" />
        {[...Array(rows)].map((_, i) => (
            <BaseSkeleton key={i} className="h-12 rounded" />
        ))}
    </div>
);
