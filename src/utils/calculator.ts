export function normalizeDate(value: any): string | null {
    if (!value) return null;

    // Excel serial date number
    if (typeof value === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const date = new Date(excelEpoch.getTime() + value * 86400 * 1000);
        return date.toISOString().split("T")[0];
    }
    
    const valueStr = String(value);

    // ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(valueStr)) {
        return valueStr.substring(0, 10);
    }

    // dd/mm/yyyy or dd-mm-yyyy etc.
    const parts = valueStr.split(/[\/\-.]/);
    if (parts.length === 3) {
        let [d, m, y] = parts;
        if (y && y.length === 2) y = "20" + y; // 25 → 2025
        if (d && m && y && y.length === 4) {
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
    }

    // Text with month names
    const tryDate = new Date(valueStr);
    if (!isNaN(tryDate.getTime())) {
        return tryDate.toISOString().split("T")[0];
    }

    return null;
}

export const getCategory = (product: { name?: string, alias?: string }): string => {
    const name = (product.name || '').toLowerCase();
    const alias = String(product.alias || '');
    
    if (alias.startsWith('4')) return 'Duvets';
    if (name.includes('matterspad')) return 'Toppers';
    if (name.includes('pillow') && !name.includes('case')) return 'Pillows';
    
    return 'Other';
};


export const calculateEffectiveTarget = (
    targetsMap: { [year: string]: { [month: string]: number } } | undefined,
    dateFilter: { year: number | 'all', month: number | 'all', day: number | 'all' }
): number => {
    if (!targetsMap || !dateFilter) return 0;

    const { year, month, day } = dateFilter;

    if (year === 'all') {
        return 0; // Cannot calculate target for all years combined
    }

    const yearKey = String(year);
    const monthKey = String(month === 'all' ? 'all' : month + 1);
    const yearData = targetsMap[yearKey];

    if (month === 'all') {
        if (yearData && typeof yearData === 'object') {
            return Object.values(yearData).reduce((sum, val) => sum + (Number(val) || 0), 0);
        }
        return 0;
    }

    const monthlyTarget = (yearData && typeof yearData === 'object') ? (Number(yearData[monthKey]) || 0) : 0;

    if (day === 'all') {
        return monthlyTarget;
    }
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return daysInMonth > 0 ? monthlyTarget / daysInMonth : 0;
};


export const parseNumber = (numInput: any): number => {
    if (numInput === undefined || numInput === null) return 0;
    const cleaned = Number(String(numInput).replace(/,/g, ''));
    return isNaN(cleaned) ? 0 : cleaned;
};
