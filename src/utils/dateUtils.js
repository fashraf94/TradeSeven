/**
 * Shared date utilities for consistent date handling across the codebase.
 * Handles Firestore Timestamps, Date objects, ISO strings, and YYYY-MM-DD.
 *
 * This module consolidates date parsing logic to prevent bugs like the
 * removeUndefined() issue where Date objects were stripped to {}.
 */

/**
 * Safely parse any date format into a Date object.
 * Handles: Firestore Timestamps, ISO strings, Date objects, null/undefined.
 *
 * @param {any} value - The value to parse
 * @returns {Date|null} - Date object or null if unparseable
 *
 * @example
 * // Firestore Timestamp with toDate() method
 * safeParseDate({ toDate: () => new Date('2026-01-21') }) // => Date
 *
 * @example
 * // Firestore Timestamp-like object with seconds/nanoseconds
 * safeParseDate({ seconds: 1737417600, nanoseconds: 0 }) // => Date
 *
 * @example
 * // ISO string
 * safeParseDate('2026-01-21T00:00:00.000Z') // => Date
 *
 * @example
 * // YYYY-MM-DD string
 * safeParseDate('2026-01-21') // => Date
 *
 * @example
 * // Date object (returned as-is if valid)
 * safeParseDate(new Date('2026-01-21')) // => Date
 *
 * @example
 * // Invalid inputs return null
 * safeParseDate(null) // => null
 * safeParseDate({}) // => null (logs warning)
 */
export function safeParseDate(value) {
  if (!value) return null;

  try {
    // Firestore Timestamp object - has toDate() method
    if (typeof value?.toDate === 'function') {
      return value.toDate();
    }

    // Firestore Timestamp-like object with seconds/nanoseconds
    if (typeof value === 'object' && value.seconds !== undefined) {
      return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }

    // Already a Date object
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // Empty object check (common bug from removeUndefined stripping Date objects)
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      console.warn('[dateUtils] Received empty object {} - possibly a stripped Date');
      return null;
    }

    // String or number - try to parse
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    console.warn('[dateUtils] Failed to parse date:', value, error.message);
    return null;
  }
}

/**
 * Normalize any date format to ISO string (YYYY-MM-DDTHH:mm:ss.sssZ).
 * Useful for Firebase storage and API responses.
 *
 * @param {any} value - The value to normalize
 * @returns {string|null} - ISO string or null if unparseable
 *
 * @example
 * toISOString(new Date('2026-01-21')) // => '2026-01-21T00:00:00.000Z'
 * toISOString({ seconds: 1737417600 }) // => '2026-01-21T00:00:00.000Z'
 * toISOString('2026-01-21') // => '2026-01-21T00:00:00.000Z'
 * toISOString(null) // => null
 */
export function toISOString(value) {
  const date = safeParseDate(value);
  return date ? date.toISOString() : null;
}

/**
 * Normalize any date format to YYYY-MM-DD (for EODHD API queries).
 * Optimized to extract directly from ISO strings without Date parsing.
 *
 * @param {any} value - The value to normalize
 * @returns {string|null} - YYYY-MM-DD string or null if unparseable
 *
 * @example
 * toYYYYMMDD('2026-01-21T15:30:00.000Z') // => '2026-01-21'
 * toYYYYMMDD('2026-01-21') // => '2026-01-21'
 * toYYYYMMDD(new Date('2026-01-21')) // => '2026-01-21'
 * toYYYYMMDD({ seconds: 1737417600 }) // => '2026-01-21'
 * toYYYYMMDD(null) // => null
 */
export function toYYYYMMDD(value) {
  // Optimize: extract directly from strings without Date parsing
  if (typeof value === 'string') {
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    // ISO string - extract date portion
    if (value.includes('T')) {
      return value.split('T')[0];
    }
  }

  const date = safeParseDate(value);
  return date ? date.toISOString().split('T')[0] : null;
}

/**
 * Check if two dates represent the same calendar day.
 * Uses YYYY-MM-DD comparison to avoid timezone issues.
 *
 * @param {any} date1 - First date (any format)
 * @param {any} date2 - Second date (any format)
 * @returns {boolean} - True if both dates are on the same day
 *
 * @example
 * isSameDay('2026-01-21', new Date('2026-01-21T23:59:59Z')) // => true
 * isSameDay('2026-01-21', '2026-01-22') // => false
 * isSameDay(null, new Date()) // => false
 */
export function isSameDay(date1, date2) {
  const d1 = toYYYYMMDD(date1);
  const d2 = toYYYYMMDD(date2);

  if (!d1 || !d2) return false;
  return d1 === d2;
}

/**
 * Check if a date value is empty or invalid.
 * Useful for detecting the removeUndefined() bug where Date objects become {}.
 *
 * @param {any} value - The value to check
 * @returns {boolean} - True if the value is empty/invalid
 *
 * @example
 * isEmptyDate(null) // => true
 * isEmptyDate(undefined) // => true
 * isEmptyDate({}) // => true (empty object from bug)
 * isEmptyDate('2026-01-21') // => false
 * isEmptyDate({ seconds: 1737417600 }) // => false (valid Firestore timestamp)
 */
export function isEmptyDate(value) {
  if (!value) return true;
  if (typeof value === 'string' && value.length > 0) return false;
  if (typeof value === 'object') {
    // Empty object {} - the removeUndefined bug
    if (Object.keys(value).length === 0) return true;
    // Valid Firestore Timestamp
    if (value.seconds !== undefined || typeof value.toDate === 'function') return false;
  }
  return true;
}
