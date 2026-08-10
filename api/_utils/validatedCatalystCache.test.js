// api/_utils/validatedCatalystCache.test.js
// Catalyst-path defects (Aug 10) — A6 acceptance rows for the ValidatedCatalyst
// module. Each row cites a test that fails under the defect it guards.
//   C1 — the persisted catalyst entry is Firestore-legal (no nested array).
//        Pre-fix headlineKeywords was Object.entries() => [string,number][], a
//        nested array Firestore rejects, so the whole write was swallowed.
//   C3 — extractKeywords drops wh-question stopwords, so "why" can never be the
//        dominant keyword the confidence label is computed from.
//   C5 — a Sonar 401 (insufficient_quota) is non-fatal on the catalyst path:
//        validateAndCacheCatalyst degrades to EODHD and still returns an entry.
//
// We mock helpers/sonar.js (querySonar) so the REAL fetchTickerCatalysts +
// EODHD fallback run, and firebaseAdmin so the write payload is captured.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
  const state = { lastSet: undefined };
  const fakeDoc = {
    set: async (payload) => { state.lastSet = payload; },
    get: async () => ({ exists: false, data: () => undefined }),
    delete: async () => {},
  };
  return { state, querySonar: vi.fn(), fakeDoc };
});

vi.mock('../helpers/sonar.js', () => ({ querySonar: h.querySonar }));
vi.mock('./firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({ collection: () => ({ doc: () => h.fakeDoc }) }),
}));

import { validateAndCacheCatalyst, extractKeywords } from './validatedCatalystCache.js';
import { fetchTickerCatalysts } from './sonarCatalystFetch.js';

const realFetch = global.fetch;
const okJson = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
const nowIso = () => new Date().toISOString();

// "Why …"-led financial mover headlines — exactly the shape that made "why"
// the dominant keyword in production.
const WHY_HEADLINES = okJson([
  { title: 'Why NVDA Stock Is Soaring After Earnings Beat', date: nowIso() },
  { title: 'Why NVDA Jumped on an Analyst Upgrade', date: nowIso() },
  { title: 'Why NVDA Rallied on a Guidance Raise', date: nowIso() },
]);

// Recursively detect an array whose element is itself an array (Firestore's
// "invalid nested entity" rule).
function hasNestedArray(v) {
  if (Array.isArray(v)) return v.some((el) => Array.isArray(el) || hasNestedArray(el));
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.values(v).some(hasNestedArray);
  return false;
}

beforeEach(() => {
  process.env.EODHD_API_KEY = 'test-key';
  h.state.lastSet = undefined;
  h.querySonar.mockReset();
});
afterEach(() => { global.fetch = realFetch; vi.restoreAllMocks(); });

describe('C1 — persisted catalyst entry is Firestore-legal (no nested array)', () => {
  it('headlineKeywords is array-of-objects and the write payload has no array-in-array', async () => {
    h.querySonar.mockResolvedValue({ text: 'NVDA rose on strong datacenter earnings and an upgrade', citations: [] });
    global.fetch = vi.fn().mockResolvedValue(WHY_HEADLINES);

    const entry = await validateAndCacheCatalyst('NVDA', 'NVIDIA', 'up', 5.2);

    // The write must have been attempted with a Firestore-legal payload — the
    // nested-array version threw and was swallowed at the catch.
    expect(h.state.lastSet).toBeDefined();
    expect(hasNestedArray(h.state.lastSet)).toBe(false);      // FAILS pre-fix (tuples)

    // headlineKeywords is non-empty and each element is {keyword, count}.
    expect(entry.headlineKeywords.length).toBeGreaterThan(0);
    for (const k of entry.headlineKeywords) {
      expect(Array.isArray(k)).toBe(false);                   // FAILS pre-fix (each was a 2-tuple array)
      expect(k).toEqual({ keyword: expect.any(String), count: expect.any(Number) });
    }
  });
});

describe('C3 — extractKeywords drops wh-question stopwords', () => {
  it('"why" (and generic motion fillers) cannot survive extraction', () => {
    const kws = extractKeywords('Why is NVDA stock moving today? Here is why NVDA moved. Why now?');
    expect(kws).not.toContain('why');       // FAILS pre-fix — "why" survived and dominated
    expect(kws).not.toContain('moving');
    expect(kws).toContain('nvda');          // a real token still survives
  });

  it('a purely "why"-clustered headline set no longer yields a stopword catalyst', async () => {
    h.querySonar.mockRejectedValue(new Error('Sonar timeout'));   // no Sonar text
    global.fetch = vi.fn().mockResolvedValue(okJson([
      { title: 'Why the market moved', date: nowIso() },
      { title: 'Why stocks moved', date: nowIso() },
      { title: 'Why shares moved', date: nowIso() },
    ]));
    const entry = await validateAndCacheCatalyst('ZZZ', 'Zeta', 'up', 3.5);
    // Pre-fix: "why"/"moved" clustered to freq>=3 => source 'eodhd_dominant' off a
    // stopword. Post-fix: no real >=3 token => the honest 'none'.
    expect(entry.source).not.toBe('eodhd_dominant');
    expect(entry.headlineKeywords.map((k) => k.keyword)).not.toContain('why');
  });
});

describe('C5 — Sonar 401 (insufficient_quota) is non-fatal on the catalyst path', () => {
  it('fetchTickerCatalysts degrades to EODHD, never rejects', async () => {
    h.querySonar.mockRejectedValue(new Error('Perplexity API error: 401'));
    global.fetch = vi.fn().mockResolvedValue(WHY_HEADLINES);

    const res = await fetchTickerCatalysts('NVDA', 'NVIDIA', 5.2, 'up');
    expect(res.fallback).toBe(true);
    expect(res.catalysts).toBeNull();
    expect(Array.isArray(res.headlines)).toBe(true);
  });

  it('validateAndCacheCatalyst still returns a cacheable entry under a Sonar 401', async () => {
    h.querySonar.mockRejectedValue(new Error('Perplexity API error: 401'));
    global.fetch = vi.fn().mockResolvedValue(WHY_HEADLINES);

    // The assertion IS that this call resolves rather than throwing.
    const entry = await validateAndCacheCatalyst('NVDA', 'NVIDIA', 'up', 5.2);
    expect(entry).toBeDefined();
    expect(typeof entry.catalyst).toBe('string');
    expect(['high', 'medium', 'low']).toContain(entry.confidence);
    expect(hasNestedArray(h.state.lastSet)).toBe(false);
  });
});
