import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  safeParseDate,
  toISOString,
  toYYYYMMDD,
  isSameDay,
  isEmptyDate
} from './dateUtils';

describe('safeParseDate', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Firestore Timestamps', () => {
    it('should parse Firestore Timestamp with toDate() method', () => {
      const mockTimestamp = {
        toDate: () => new Date('2026-01-21T00:00:00.000Z')
      };
      const result = safeParseDate(mockTimestamp);
      expect(result).toEqual(new Date('2026-01-21T00:00:00.000Z'));
    });

    it('should parse Firestore Timestamp-like object with seconds/nanoseconds', () => {
      // 1768953600 = 2026-01-21T00:00:00.000Z
      const timestamp = { seconds: 1768953600, nanoseconds: 0 };
      const result = safeParseDate(timestamp);
      expect(result.getTime()).toBe(1768953600000);
    });

    it('should handle Firestore Timestamp with only seconds (no nanoseconds)', () => {
      const timestamp = { seconds: 1768953600 };
      const result = safeParseDate(timestamp);
      expect(result.getTime()).toBe(1768953600000);
    });

    it('should handle nanoseconds precision', () => {
      // 500000000 nanoseconds = 500 milliseconds
      const timestamp = { seconds: 1768953600, nanoseconds: 500000000 };
      const result = safeParseDate(timestamp);
      expect(result.getTime()).toBe(1768953600000 + 500);
    });
  });

  describe('Date objects', () => {
    it('should return valid Date objects unchanged', () => {
      const date = new Date('2026-01-21T00:00:00.000Z');
      const result = safeParseDate(date);
      expect(result).toEqual(date);
    });

    it('should return null for Invalid Date objects', () => {
      const invalidDate = new Date('invalid');
      const result = safeParseDate(invalidDate);
      expect(result).toBeNull();
    });
  });

  describe('ISO strings', () => {
    it('should parse ISO date strings', () => {
      const result = safeParseDate('2026-01-21T00:00:00.000Z');
      expect(result).toEqual(new Date('2026-01-21T00:00:00.000Z'));
    });

    it('should parse ISO strings with timezone offset', () => {
      const result = safeParseDate('2026-01-21T12:00:00-05:00');
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(false);
    });
  });

  describe('YYYY-MM-DD strings', () => {
    it('should parse YYYY-MM-DD strings', () => {
      const result = safeParseDate('2026-01-21');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getDate()).toBe(21);
    });
  });

  describe('numbers', () => {
    it('should parse Unix timestamps in milliseconds', () => {
      const result = safeParseDate(1768953600000);
      expect(result.getTime()).toBe(1768953600000);
    });
  });

  describe('null/undefined/empty inputs', () => {
    it('should return null for null input', () => {
      expect(safeParseDate(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(safeParseDate(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(safeParseDate('')).toBeNull();
    });

    it('should return null for empty object (removeUndefined bug) and log warning', () => {
      const result = safeParseDate({});
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('empty object')
      );
    });
  });

  describe('invalid inputs', () => {
    it('should return null for random string', () => {
      const result = safeParseDate('not-a-date');
      expect(result).toBeNull();
    });

    it('should return null for random object', () => {
      const result = safeParseDate({ foo: 'bar' });
      expect(result).toBeNull();
    });
  });
});

describe('toISOString', () => {
  it('should convert Date to ISO string', () => {
    const date = new Date('2026-01-21T12:30:00.000Z');
    expect(toISOString(date)).toBe('2026-01-21T12:30:00.000Z');
  });

  it('should convert Firestore Timestamp to ISO string', () => {
    const timestamp = { seconds: 1768953600, nanoseconds: 0 };
    expect(toISOString(timestamp)).toBe('2026-01-21T00:00:00.000Z');
  });

  it('should convert Firestore Timestamp with toDate() to ISO string', () => {
    const mockTimestamp = {
      toDate: () => new Date('2026-01-21T00:00:00.000Z')
    };
    expect(toISOString(mockTimestamp)).toBe('2026-01-21T00:00:00.000Z');
  });

  it('should convert ISO string to normalized ISO string', () => {
    expect(toISOString('2026-01-21T00:00:00Z')).toBe('2026-01-21T00:00:00.000Z');
  });

  it('should return null for invalid input', () => {
    expect(toISOString(null)).toBeNull();
    expect(toISOString(undefined)).toBeNull();
    expect(toISOString({})).toBeNull();
  });
});

describe('toYYYYMMDD', () => {
  it('should extract YYYY-MM-DD from ISO string', () => {
    expect(toYYYYMMDD('2026-01-21T15:30:00.000Z')).toBe('2026-01-21');
  });

  it('should return YYYY-MM-DD string unchanged', () => {
    expect(toYYYYMMDD('2026-01-21')).toBe('2026-01-21');
  });

  it('should convert Date object to YYYY-MM-DD', () => {
    const date = new Date('2026-01-21T00:00:00.000Z');
    expect(toYYYYMMDD(date)).toBe('2026-01-21');
  });

  it('should convert Firestore Timestamp to YYYY-MM-DD', () => {
    const timestamp = { seconds: 1768953600, nanoseconds: 0 };
    expect(toYYYYMMDD(timestamp)).toBe('2026-01-21');
  });

  it('should convert Firestore Timestamp with toDate() to YYYY-MM-DD', () => {
    const mockTimestamp = {
      toDate: () => new Date('2026-01-21T00:00:00.000Z')
    };
    expect(toYYYYMMDD(mockTimestamp)).toBe('2026-01-21');
  });

  it('should return null for invalid input', () => {
    expect(toYYYYMMDD(null)).toBeNull();
    expect(toYYYYMMDD(undefined)).toBeNull();
    expect(toYYYYMMDD({})).toBeNull();
  });

  it('should handle ISO strings without full timestamp', () => {
    expect(toYYYYMMDD('2026-01-21T00:00:00Z')).toBe('2026-01-21');
  });
});

describe('isSameDay', () => {
  it('should return true for same day different times', () => {
    expect(isSameDay(
      '2026-01-21T00:00:00.000Z',
      '2026-01-21T23:59:59.999Z'
    )).toBe(true);
  });

  it('should return false for different days', () => {
    expect(isSameDay('2026-01-21', '2026-01-22')).toBe(false);
  });

  it('should handle mixed formats - Date and string', () => {
    const date = new Date('2026-01-21T12:00:00.000Z');
    expect(isSameDay(date, '2026-01-21T18:00:00.000Z')).toBe(true);
  });

  it('should handle mixed formats - Date and Firestore Timestamp', () => {
    const date = new Date('2026-01-21T12:00:00.000Z');
    const timestamp = { seconds: 1768953600, nanoseconds: 0 };
    expect(isSameDay(date, timestamp)).toBe(true);
  });

  it('should handle mixed formats - string and Firestore Timestamp', () => {
    const timestamp = { seconds: 1768953600, nanoseconds: 0 };
    expect(isSameDay('2026-01-21', timestamp)).toBe(true);
  });

  it('should return false if first date is invalid', () => {
    expect(isSameDay(null, new Date())).toBe(false);
    expect(isSameDay({}, '2026-01-21')).toBe(false);
  });

  it('should return false if second date is invalid', () => {
    expect(isSameDay(new Date(), null)).toBe(false);
    expect(isSameDay('2026-01-21', {})).toBe(false);
  });

  it('should return false if both dates are invalid', () => {
    expect(isSameDay(null, null)).toBe(false);
    expect(isSameDay({}, {})).toBe(false);
  });
});

describe('isEmptyDate', () => {
  it('should return true for null', () => {
    expect(isEmptyDate(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isEmptyDate(undefined)).toBe(true);
  });

  it('should return true for empty object (removeUndefined bug)', () => {
    expect(isEmptyDate({})).toBe(true);
  });

  it('should return false for valid date string', () => {
    expect(isEmptyDate('2026-01-21')).toBe(false);
    expect(isEmptyDate('2026-01-21T00:00:00.000Z')).toBe(false);
  });

  it('should return false for Firestore Timestamp with seconds', () => {
    expect(isEmptyDate({ seconds: 1768953600 })).toBe(false);
    expect(isEmptyDate({ seconds: 1768953600, nanoseconds: 0 })).toBe(false);
  });

  it('should return false for Firestore Timestamp with toDate()', () => {
    const mockTimestamp = {
      toDate: () => new Date('2026-01-21T00:00:00.000Z')
    };
    expect(isEmptyDate(mockTimestamp)).toBe(false);
  });

  it('should return true for empty string', () => {
    expect(isEmptyDate('')).toBe(true);
  });
});
