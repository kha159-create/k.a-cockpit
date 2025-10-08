import React, { useState, useRef, useMemo, useEffect } from 'react';

// --- Reusable UI Components ---
const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
    if (!data || data.length < 2) return null;
    const width = 100;
    const height = 30;
    const padding = 2;
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = (height - padding) - ((d - minVal) / (range || 1)) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    const isUpward = data.length > 1 && data[data.length - 1] > data[0];

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8">
            <polyline
                fill="none"
                stroke={isUpward ? '#10b981' : '#ef4444'}
                strokeWidth="2"
                points={points}
            />
        </svg>
    );
};


// مكون شريط التقدم الدائري
const CircularProgress: React.FC<{ percentage: number; size?: number }> = ({ percentage, size = 60 }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="circular-progress" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    className="circular-progress-bg"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    className="circular-progress-fill"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                        strokeDasharray: `${strokeDasharray} ${strokeDasharray}`,
                        strokeDashoffset: strokeDashoffset,
                    }}
                />
            </svg>
            <div className="circular-progress-text">
                {Math.round(percentage)}%
            </div>
        </div>
    );
};

// مكون مؤشر الاتجاه
const TrendIndicator: React.FC<{ trend: 'up' | 'down' | 'neutral'; value?: string }> = ({ trend, value }) => {
    const getTrendColor = () => {
        switch (trend) {
            case 'up': return 'text-green-600';
            case 'down': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getTrendIcon = () => {
        switch (trend) {
            case 'up': return '↗';
            case 'down': return '↘';
            default: return '→';
        }
    };

    return (
        <div className={`flex items-center gap-1 text-xs font-semibold ${getTrendColor()}`}>
            <span className="text-lg">{getTrendIcon()}</span>
            {value && <span>{value}</span>}
        </div>
    );
};

export const KPICard: React.FC<{ 
    title: string; 
    value: number; 
    format?: (val: number) => string; 
    comparisonValue?: number;
    comparisonLabel?: string;
    icon?: React.ReactNode;
    iconBgColor?: string;
    onClick?: () => void;
    trendData?: number[];
    showProgress?: boolean;
    progressValue?: number;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
}> = ({ 
    title, 
    value, 
    format, 
    comparisonValue, 
    comparisonLabel, 
    icon, 
    iconBgColor, 
    onClick, 
    trendData, 
    showProgress = false,
    progressValue = 0,
    trend = 'neutral',
    trendValue
}) => {
    const isPositive = comparisonValue !== undefined && value >= comparisonValue;
    const formattedValue = format && typeof value === 'number' ? format(value) : (value?.toLocaleString() || 0);
    
    return (
        <button 
            onClick={onClick} 
            disabled={!onClick} 
            className="modern-kpi-card group p-4 flex flex-col text-left w-full h-full disabled:cursor-default"
        >
            {/* تأثير الخلفية المتحرك */}
            <div className="kpi-card-background" />
            
            {/* المحتوى الرئيسي */}
            <div className="relative z-10 flex-1 flex flex-col">
                {/* الرأس - الأيقونة والعنوان */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                 {icon && (
                            <div className="kpi-icon-container flex-shrink-0">
                        {icon}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="kpi-title truncate">{title}</h3>
                        </div>
                    </div>
                    
                    {/* مؤشر الاتجاه */}
                    {trendValue && (
                        <TrendIndicator trend={trend} value={trendValue} />
                    )}
                </div>
                
                {/* القيمة الرئيسية */}
                <div className="mb-4 flex-1 flex items-center">
                    <div className="kpi-value break-all leading-tight">
                        {formattedValue}
                    </div>
                </div>
                
                {/* القسم السفلي */}
                <div className="flex items-end justify-between">
                    {/* شريط التقدم أو البيانات المقارنة */}
                    <div className="flex-1">
                        {showProgress ? (
                            <div className="flex items-center gap-3">
                                <CircularProgress percentage={progressValue} size={50} />
                                <div className="text-xs text-gray-500">
                                    التقدم: {Math.round(progressValue)}%
                </div>
            </div>
                        ) : comparisonValue !== undefined ? (
                            <div className={`text-xs font-semibold flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                <span className="text-sm">{isPositive ? '▲' : '▼'}</span>
                        <span>{comparisonLabel}: {format ? format(comparisonValue) : comparisonValue.toLocaleString()}</span>
                            </div>
                        ) : null}
                    </div>
                    
                    {/* مخطط الاتجاه */}
                    {trendData && trendData.length > 1 && (
                        <div className="ml-3">
                            <Sparkline data={trendData} />
                    </div>
                )}
                </div>
            </div>
        </button>
    );
};

export const ChartCard: React.FC<{ title: React.ReactNode; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-neutral-200 h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:border-primary-200">
        <div className="text-xl font-bold text-neutral-800 mb-6 border-b border-neutral-100 pb-3">{title}</div>
        <div className="flex-grow relative">{children}</div>
    </div>
);


const Tooltip: React.FC<{ content: string; x: number; y: number }> = ({ content, x, y }) => (
  <div className="absolute p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg pointer-events-none" style={{ left: x, top: y, transform: 'translate(-50%, -110%)' }} dangerouslySetInnerHTML={{ __html: content }}
  />
);

export const BarChart: React.FC<{ data: any[]; dataKey: string; nameKey: string; format?: (val: number) => string; }> = ({ data, dataKey, nameKey, format }) => {
    if (!data || data.length === 0) return <div className="flex items-center justify-center h-full text-neutral-500">No data to display</div>;
    const maxValue = Math.max(...data.map(item => item[dataKey] || 0));
    if (maxValue === 0) return <div className="flex items-center justify-center h-full text-neutral-500">No data to display</div>;

    return (
        <div className="w-full h-full flex flex-col space-y-3">
                {data.map((item, index) => {
                    const value = item[dataKey] || 0;
                    const percentage = (value / maxValue) * 100;
                const isTooShort = percentage < 30; 

                    return (
                    <div key={`${item[nameKey]}-${index}`} className="group relative" title={`${item[nameKey]}: ${format ? format(value) : value}`}>
                        {/* التسمية */}
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-neutral-700 truncate pr-2">{item[nameKey]}</span>
                            <span className="text-sm font-bold text-neutral-900 whitespace-nowrap">
                                {format ? format(value) : value.toLocaleString()}
                            </span>
                        </div>
                        
                        {/* شريط التقدم */}
                        <div className="relative h-4 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500 ease-out relative group-hover:from-orange-500 group-hover:to-orange-700"
                                style={{ width: `${Math.max(percentage, 2)}%` }}
                            >
                                {/* تأثير اللمعان */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>
                        </div>
                        </div>
                    );
                })}
        </div>
    );
};

export const PieChart: React.FC<{ data: { name: string, value: number }[], onSliceClick?: (name: string) => void }> = ({ data, onSliceClick }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<{ content: string, x: number, y: number } | null>(null);
    if (!data || data.length === 0) return <div className="flex items-center justify-center h-full text-zinc-500">No data to display</div>;
    
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-full text-zinc-500">No data to display</div>;

    const colors = ['#f97316', '#3b82f6', '#6366f1', '#14b8a6', '#f59e0b', '#84cc16', '#ef4444', '#8b5cf6', '#ec4899', '#22d3ee'];
    let cumulativeAngle = 0;

    const getCoords = (angle: number, radius: number = 50) => [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];

    return (
        <div className="w-full h-full flex flex-col md:flex-row items-center justify-between gap-4" ref={containerRef}>
            <div className="w-48 h-48 relative flex-shrink-0">
                {tooltip && <Tooltip {...tooltip} />}
                <svg viewBox="0 0 100 100" onMouseLeave={() => setTooltip(null)}>
                    {data.map((item, index) => {
                        const angle = (item.value / total) * 2 * Math.PI;
                        const startAngle = cumulativeAngle;
                        cumulativeAngle += angle;
                        const endAngle = cumulativeAngle;
                        
                        const [startX, startY] = getCoords(startAngle, 40);
                        const [endX, endY] = getCoords(endAngle, 40);
                        const largeArcFlag = angle > Math.PI ? 1 : 0;
                        
                        const pathData = `M 50,50 L ${startX},${startY} A 40,40 0 ${largeArcFlag},1 ${endX},${endY} z`;
                        
                        return <path 
                                key={item.name} 
                                d={pathData} 
                                fill={colors[index % colors.length]} 
                                className={onSliceClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
                                onClick={() => onSliceClick && onSliceClick(item.name)}
                                onMouseMove={(e) => {
                                    if (!containerRef.current) return;
                                    const containerRect = containerRef.current.getBoundingClientRect();
                                    const x = e.clientX - containerRect.left;
                                    const y = e.clientY - containerRect.top;
                                    setTooltip({ content: `${item.name}: ${((item.value/total)*100).toFixed(1)}%`, x, y });
                                }}
                               />
                    })}
                </svg>
            </div>
            <div className="flex-grow overflow-y-auto h-full w-full">
                <ul className="space-y-2">
                    {data.slice(0, 10).map((item, index) => (
                        <li key={item.name} className="flex items-center text-sm group hover:bg-neutral-50 p-2 rounded-lg transition-all duration-200">
                            <div className="w-4 h-4 rounded-full mr-3 shadow-sm" style={{ backgroundColor: colors[index % colors.length] }}></div>
                            <span className="text-neutral-700 truncate flex-grow font-medium" title={item.name}>{item.name}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-neutral-500">{item.value.toLocaleString()}</span>
                                <span className="font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded-md text-xs">{((item.value/total) * 100).toFixed(1)}%</span>
                            </div>
                        </li>
                    ))}
                    {data.length > 10 && (
                        <li className="text-xs text-neutral-400 mt-3 p-2 bg-neutral-50 rounded-lg text-center">
                            ... و {data.length - 10} عناصر أخرى
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export const LineChart: React.FC<{ data: { name: string; [key: string]: any }[] }> = ({ data }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);

    const keys = useMemo(() => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]).filter(k => typeof data[0][k] === 'number' && k !== 'monthIndex');
    }, [data]);
    
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => new Set(keys));
    
    useEffect(() => {
        setVisibleKeys(new Set(keys));
    }, [keys]);

    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-full text-neutral-500">No data available</div>;
    }

    const colors: { [key: string]: string } = { 
        Sales: '#10b981', 
        Target: '#a78bfa',
        totalSales: '#f97316',
        effectiveTarget: '#3b82f6',
        targetAchievement: '#8b5cf6'
    };
    
    const width = 600;
    const height = 250;
    const padding = { top: 10, right: 20, bottom: 30, left: 40 };

    const allValues = data.flatMap(d => keys.filter(k => visibleKeys.has(k)).map(k => d[k] as number));
    const maxVal = allValues.length > 0 ? Math.max(...allValues, 1) : 1;
    const yTicks = 5;

    const getPathData = (key: string) => {
        if (data.length < 2) return "";
        const points = data.map((item, i) => {
            const x = padding.left + i * ((width - padding.left - padding.right) / (data.length - 1));
            const y = height - padding.bottom - (((item[key] as number) / maxVal) * (height - padding.top - padding.bottom));
            return `${x},${y}`;
        });
        return `M ${points.join(' L ')}`;
    };

    const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
        if (!containerRef.current) return;
        const svg = e.currentTarget;
        const point = new DOMPoint(e.clientX, e.clientY);
        const transformedPoint = point.matrixTransform((svg.getScreenCTM() as DOMMatrix).inverse());
        
        const index = Math.min(data.length - 1, Math.max(0, Math.round(((transformedPoint.x - padding.left) / (width - padding.left - padding.right)) * (data.length - 1))));

        if (index >= 0 && index < data.length) {
            const item = data[index];
            const tooltipContent = `<div class="font-bold mb-1">${item.name}</div>${keys.filter(k => visibleKeys.has(k)).map(key => `
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center">
                       <span class="w-2 h-2 rounded-full mr-1.5" style="background-color: ${colors[key]}"></span>
                       <span>${key}:</span>
                    </div>
                    <span class="font-semibold">${(item[key] as number).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                </div>
            `).join('')}`;
            
            const containerRect = containerRef.current.getBoundingClientRect();
            setTooltip({ content: tooltipContent, x: e.clientX - containerRect.left, y: e.clientY - containerRect.top });
        }
    };

    const toggleKey = (key: string) => {
        setVisibleKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    return (
        <div className="w-full h-full relative flex flex-col" ref={containerRef}>
            <div className="flex-grow" onMouseLeave={() => setTooltip(null)}>
                {tooltip && <Tooltip {...tooltip} />}
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                    {/* Grid Lines and Y-Axis */}
                    {Array.from({ length: yTicks }).map((_, i) => {
                        const y = height - padding.bottom - (i * (height - padding.top - padding.bottom) / (yTicks - 1));
                        const val = (maxVal / (yTicks - 1)) * i;
                        return (
                            <g key={i} className="text-gray-400">
                                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor">
                                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                                </text>
                                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="2 2" />
                            </g>
                        );
                    })}

                    {/* X-Axis */}
                    {data.map((item, i) => (
                        <text key={item.name} x={padding.left + i * ((width - padding.left - padding.right) / (data.length - 1))} y={height - padding.bottom + 15} textAnchor="middle" fontSize="10" fill="#6b7280">
                            {item.name}
                        </text>
                    ))}

                    {/* Lines */}
                    {keys.map(key => visibleKeys.has(key) && (
                        <path
                            key={key}
                            d={getPathData(key)}
                            fill="none"
                            stroke={colors[key] || '#000'}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={key.toLowerCase() === 'target' ? '6 6' : 'none'}
                            className="transition-all duration-300"
                        />
                    ))}
                    
                    <rect x="0" y="0" width={width} height={height} fill="transparent" onMouseMove={handleMouseMove} />
                </svg>
            </div>
            <div className="flex justify-center gap-6 text-sm mt-2">
                {keys.map(key => (
                    <button key={key} onClick={() => toggleKey(key)} className={`flex items-center gap-2 transition-opacity ${!visibleKeys.has(key) && 'opacity-40'}`}>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[key] || '#000'}}></span>
                        <span>{key}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export const DetailedComparisonCard: React.FC<{ title: string; current: number; previous: number; isPercentage?: boolean }> = ({ title, current, previous, isPercentage }) => {
    const format = (val: number) => {
        if (isPercentage) return `${val.toFixed(1)}%`;
        if (val >= 1000) {
           return val.toLocaleString('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
        }
        return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };

    const difference = current - previous;
    const percentageChange = previous !== 0 ? (difference / Math.abs(previous)) * 100 : current > 0 ? 100 : 0;
    const isPositive = difference >= 0;

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">{format(current)}</p>
            <div className="text-xs text-zinc-400">vs {format(previous)} last year</div>
            <div className={`mt-2 flex items-center text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '▲' : '▼'}
                <span className="ml-1">{format(Math.abs(difference))}</span>
                <span className="ml-2">({Math.abs(percentageChange).toFixed(1)}%)</span>
            </div>
        </div>
    );
};

export const AchievementBar: React.FC<{ percentage: number }> = ({ percentage }) => {
  const cappedPercentage = Math.min(Math.max(percentage, 0), 100);
  
  const getBarColor = () => {
    if (cappedPercentage < 60) return 'from-orange-300 to-orange-400';
    if (cappedPercentage < 80) return 'from-orange-400 to-orange-500';
    if (cappedPercentage < 95) return 'from-orange-500 to-orange-600';
    return 'from-orange-600 to-orange-700';
  };

  const getTextColor = () => {
    if (cappedPercentage < 60) return 'text-red-600';
    if (cappedPercentage < 80) return 'text-yellow-600';
    if (cappedPercentage < 95) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 relative">
        {/* خلفية الشريط */}
        <div className="w-full bg-neutral-200 rounded-full h-4 overflow-hidden">
          {/* شريط التقدم */}
          <div 
            className={`h-full bg-gradient-to-r ${getBarColor()} rounded-full transition-all duration-700 ease-out relative`} 
            style={{ width: `${Math.max(cappedPercentage, 2)}%` }}
          >
            {/* تأثير اللمعان */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
          </div>
        </div>
        
        {/* مؤشر النسبة */}
        <div 
          className="absolute top-0 h-3 w-0.5 bg-white shadow-sm"
          style={{ left: `${cappedPercentage}%` }}
        />
      </div>
      
      {/* النسبة المئوية */}
      <div className={`text-sm font-bold ${getTextColor()} min-w-[2.5rem] text-right`}>
        {percentage.toFixed(1)}%
      </div>
    </div>
  );
};

// مكون البحث الذكي
export const SmartSearch: React.FC<{ 
  placeholder?: string; 
  onSearch: (query: string) => void;
  suggestions?: string[];
}> = ({ placeholder = "البحث في النظام...", onSearch, suggestions = [] }) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (query.length > 0 && suggestions.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredSuggestions(filtered.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [query, suggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setQuery('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    onSearch(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all duration-200 bg-white shadow-sm"
          />
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-4 flex items-center text-neutral-400 hover:text-neutral-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* اقتراحات البحث */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-3 text-left text-sm text-neutral-700 hover:bg-neutral-50 transition-colors duration-150 border-b border-neutral-100 last:border-b-0"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// مكون الإشعارات الذكية
export const SmartNotification: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}> = ({ type, title, message, onClose, autoClose = true, duration = 5000 }) => {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white border rounded-xl shadow-lg p-4 ${getTypeStyles()} animate-slide-in-up`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
          type === 'success' ? 'bg-green-500' :
          type === 'error' ? 'bg-red-500' :
          type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        }`}>
          {getIcon()}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{title}</h4>
          {message && <p className="text-sm mt-1 opacity-90">{message}</p>}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// مكون تبديل الثيم
export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // تحميل الثيم المحفوظ
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    if (newTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg border border-neutral-300 hover:border-primary-500 transition-all duration-200 bg-white hover:bg-primary-50"
      title={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
    >
      {isDark ? (
        // أيقونة الشمس للوضع الليلي
        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // أيقونة القمر للوضع النهاري
        <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
};
