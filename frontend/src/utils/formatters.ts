// Safe number formatting utilities to prevent $NaN values
export const safeNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

export const formatCurrency = (value: unknown, options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  const safeValue = safeNumber(value, 0);
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(safeValue);
};

export const formatPercentage = (value: unknown, fallback = 0): string => {
  const safeValue = safeNumber(value, fallback);
  return `${safeValue.toFixed(1)}%`;
};

export const formatNumber = (value: unknown, fallback = 0): string => {
  const safeValue = safeNumber(value, fallback);
  return new Intl.NumberFormat('en-US').format(safeValue);
};