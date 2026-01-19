export const parseDateValue = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};
