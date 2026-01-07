// /src/utils/formatters.js

/**
 * Safe number conversion utility
 * Returns fallback if value is null, undefined, or NaN
 */
export const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? fallback : num;
};

/**
 * Safe toFixed that always works
 * Converts value to number and calls toFixed with specified decimals
 */
export const safeToFixed = (val, decimals = 2, fallback = 0) => {
  return safeNumber(val, fallback).toFixed(decimals);
};

/**
 * Format large numbers to abbreviated format (K, M, B, T)
 */
export const formatLargeNumber = (num, decimals = 1) => {
  if (num === null || num === undefined) return 'N/A';
  const n = safeNumber(num);

  if (n >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
};

/**
 * Format percentage with optional sign
 */
export const formatPercent = (val, decimals = 2, showSign = true) => {
  const num = safeNumber(val);
  const sign = showSign && num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
};

/**
 * Format price with appropriate decimal places
 */
export const formatPrice = (val, decimals = 2) => {
  const num = safeNumber(val);
  return `$${num.toFixed(decimals)}`;
};

/**
 * Get time ago string from date
 */
export const getTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};
