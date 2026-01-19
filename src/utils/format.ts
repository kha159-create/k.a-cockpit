export const safeNumber = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v)
    ? v
    : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))
      ? Number(v)
      : 0;

export const fmtNumber = (v: unknown, locale = 'ar-SA') =>
  safeNumber(v).toLocaleString(locale);

export const fmtCurrency = (
  v: unknown,
  currency: string = 'SAR',
  locale: string = 'ar-SA'
) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(safeNumber(v));


