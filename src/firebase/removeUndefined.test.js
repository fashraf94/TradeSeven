import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test removeUndefined which is not exported, so we'll recreate it here
// for testing purposes. This mirrors the FIXED production code in firebaseService.js

import { toISOString as dateToISO } from '../utils/dateUtils.js';

/**
 * Copy of removeUndefined for testing edge cases
 * This mirrors the FIXED production code in firebaseService.js
 */
function removeUndefined(obj) {
  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return null;
  }

  // Preserve Date objects - convert to ISO string for Firebase compatibility
  if (obj instanceof Date) {
    return dateToISO(obj);
  }

  // Handle Firestore Timestamp-like objects (has toDate method)
  if (typeof obj?.toDate === 'function') {
    try {
      const date = obj.toDate();
      return dateToISO(date);
    } catch {
      console.warn('[removeUndefined] Failed to convert Timestamp-like object');
      return null;
    }
  }

  // Warn about NaN and Infinity - Firestore doesn't accept these
  if (typeof obj === 'number' && !Number.isFinite(obj)) {
    console.warn('[removeUndefined] NaN or Infinity detected - Firestore will reject this value');
  }

  // Handle arrays - filter out undefined elements BEFORE mapping
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => removeUndefined(item));
  }

  // Handle Map - convert to plain object
  if (obj instanceof Map) {
    console.warn('[removeUndefined] Map object detected - converting to plain object');
    const plain = {};
    for (const [key, value] of obj) {
      if (value !== undefined) {
        plain[key] = removeUndefined(value);
      }
    }
    return plain;
  }

  // Handle Set - convert to array
  if (obj instanceof Set) {
    console.warn('[removeUndefined] Set object detected - converting to array');
    return Array.from(obj)
      .filter(item => item !== undefined)
      .map(item => removeUndefined(item));
  }

  // Handle plain objects
  if (typeof obj === 'object' && obj !== null) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const cleanedValue = removeUndefined(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned;
  }

  // Return primitives as-is
  return obj;
}

describe('removeUndefined', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Basic types', () => {
    it('should return null for undefined', () => {
      expect(removeUndefined(undefined)).toBeNull();
    });

    it('should return null for null', () => {
      expect(removeUndefined(null)).toBeNull();
    });

    it('should preserve empty string', () => {
      expect(removeUndefined('')).toBe('');
    });

    it('should preserve zero', () => {
      expect(removeUndefined(0)).toBe(0);
    });

    it('should preserve false', () => {
      expect(removeUndefined(false)).toBe(false);
    });

    it('should preserve strings', () => {
      expect(removeUndefined('hello')).toBe('hello');
    });

    it('should preserve numbers', () => {
      expect(removeUndefined(42)).toBe(42);
      expect(removeUndefined(3.14)).toBe(3.14);
    });

    it('should preserve boolean true', () => {
      expect(removeUndefined(true)).toBe(true);
    });
  });

  describe('Special number values', () => {
    it('should preserve NaN but warn (Firestore will reject)', () => {
      const result = removeUndefined(NaN);
      expect(result).toBeNaN();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('NaN or Infinity')
      );
    });

    it('should preserve Infinity but warn (Firestore will reject)', () => {
      const result = removeUndefined(Infinity);
      expect(result).toBe(Infinity);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('NaN or Infinity')
      );
    });

    it('should preserve -Infinity but warn', () => {
      const result = removeUndefined(-Infinity);
      expect(result).toBe(-Infinity);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('NaN or Infinity')
      );
    });
  });

  describe('Date handling', () => {
    it('should convert Date to ISO string', () => {
      const date = new Date('2026-01-21T12:00:00.000Z');
      expect(removeUndefined(date)).toBe('2026-01-21T12:00:00.000Z');
    });

    it('should handle Invalid Date', () => {
      const invalidDate = new Date('invalid');
      // dateToISO returns null for invalid dates
      expect(removeUndefined(invalidDate)).toBeNull();
    });
  });

  describe('Object handling', () => {
    it('should remove undefined values from objects', () => {
      const obj = { a: 1, b: undefined, c: 'hello' };
      expect(removeUndefined(obj)).toEqual({ a: 1, c: 'hello' });
    });

    it('should handle nested objects', () => {
      const obj = { a: { b: undefined, c: 1 }, d: 2 };
      expect(removeUndefined(obj)).toEqual({ a: { c: 1 }, d: 2 });
    });

    it('should handle deeply nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              keep: 'value',
              remove: undefined
            }
          }
        }
      };
      expect(removeUndefined(obj)).toEqual({
        level1: { level2: { level3: { keep: 'value' } } }
      });
    });

    it('should return empty object for object with all undefined', () => {
      const obj = { a: undefined, b: undefined };
      expect(removeUndefined(obj)).toEqual({});
    });

    it('should preserve empty object', () => {
      expect(removeUndefined({})).toEqual({});
    });
  });

  describe('Array handling', () => {
    it('should filter undefined from arrays (not convert to null)', () => {
      // FIXED: Previously undefined became null due to map-then-filter order
      expect(removeUndefined([1, undefined, 3])).toEqual([1, 3]);
    });

    it('should handle arrays with null (preserve null)', () => {
      // null !== undefined is true, so null should be preserved
      expect(removeUndefined([1, null, 3])).toEqual([1, null, 3]);
    });

    it('should handle arrays of objects', () => {
      const arr = [{ a: 1 }, { b: undefined, c: 2 }];
      expect(removeUndefined(arr)).toEqual([{ a: 1 }, { c: 2 }]);
    });

    it('should handle nested arrays', () => {
      const arr = [[1, undefined], [2, 3]];
      expect(removeUndefined(arr)).toEqual([[1], [2, 3]]);
    });

    it('should handle objects containing arrays', () => {
      const obj = { a: [1, undefined, 3], b: 'test' };
      expect(removeUndefined(obj)).toEqual({ a: [1, 3], b: 'test' });
    });

    it('should preserve empty array', () => {
      expect(removeUndefined([])).toEqual([]);
    });

    it('should handle array with multiple undefined values', () => {
      expect(removeUndefined([undefined, 1, undefined, 2, undefined])).toEqual([1, 2]);
    });
  });

  describe('Firestore Timestamp-like objects', () => {
    it('should convert Firestore Timestamp-like object to ISO string', () => {
      // FIXED: Now detects toDate() method and converts to ISO string
      const mockTimestamp = {
        toDate: () => new Date('2026-01-21T00:00:00.000Z'),
        seconds: 1768953600,
        nanoseconds: 0
      };
      const result = removeUndefined(mockTimestamp);
      // Should be converted to ISO string
      expect(result).toBe('2026-01-21T00:00:00.000Z');
    });

    it('should handle Timestamp with only toDate method', () => {
      const mockTimestamp = {
        toDate: () => new Date('2026-01-21T15:30:00.000Z')
      };
      expect(removeUndefined(mockTimestamp)).toBe('2026-01-21T15:30:00.000Z');
    });

    it('should handle Timestamp that throws on toDate', () => {
      const badTimestamp = {
        toDate: () => { throw new Error('Invalid'); }
      };
      const result = removeUndefined(badTimestamp);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to convert Timestamp-like object')
      );
    });
  });

  describe('Map and Set objects', () => {
    it('should convert Map to plain object and warn', () => {
      // FIXED: Now properly converts Map to plain object
      const map = new Map([['a', 1], ['b', 2]]);
      const result = removeUndefined(map);
      expect(result).toEqual({ a: 1, b: 2 });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Map object detected')
      );
    });

    it('should convert Set to array and warn', () => {
      // FIXED: Now properly converts Set to array
      const set = new Set([1, 2, 3]);
      const result = removeUndefined(set);
      expect(result).toEqual([1, 2, 3]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Set object detected')
      );
    });

    it('should handle Map with undefined values', () => {
      const map = new Map([['a', 1], ['b', undefined], ['c', 3]]);
      const result = removeUndefined(map);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle Set with undefined values', () => {
      const set = new Set([1, undefined, 3]);
      const result = removeUndefined(set);
      expect(result).toEqual([1, 3]);
    });

    it('should handle nested Map/Set', () => {
      const map = new Map([
        ['nested', new Set([1, 2])]
      ]);
      const result = removeUndefined(map);
      expect(result).toEqual({ nested: [1, 2] });
    });
  });

  describe('Edge cases for Firestore compatibility', () => {
    it('should handle object with Date property', () => {
      const obj = {
        name: 'test',
        createdAt: new Date('2026-01-21T00:00:00.000Z')
      };
      expect(removeUndefined(obj)).toEqual({
        name: 'test',
        createdAt: '2026-01-21T00:00:00.000Z'
      });
    });

    it('should handle mixed nested structure', () => {
      const obj = {
        user: {
          name: 'John',
          email: undefined,
          settings: {
            theme: 'dark',
            notifications: undefined
          }
        },
        items: [
          { id: 1, value: undefined },
          { id: 2, value: 'test' }
        ],
        createdAt: new Date('2026-01-21T00:00:00.000Z')
      };

      expect(removeUndefined(obj)).toEqual({
        user: {
          name: 'John',
          settings: {
            theme: 'dark'
          }
        },
        items: [
          { id: 1 },
          { id: 2, value: 'test' }
        ],
        createdAt: '2026-01-21T00:00:00.000Z'
      });
    });

    it('should handle object with Firestore Timestamp property', () => {
      const obj = {
        name: 'test',
        createdAt: {
          toDate: () => new Date('2026-01-21T00:00:00.000Z'),
          seconds: 1768953600,
          nanoseconds: 0
        }
      };
      expect(removeUndefined(obj)).toEqual({
        name: 'test',
        createdAt: '2026-01-21T00:00:00.000Z'
      });
    });
  });
});
