/**
 * fetchEodCloses unit test (V3 Sub-build 3 — the additive volume/OHLC flag).
 *
 * Pins the byte-identity contract: without `withVolume` the row shape is EXACTLY
 * { date, close } (the closes-only callers stay untouched); with `withVolume` the
 * row ADDITIONALLY carries the raw open/high/low/volume + rawClose the audit
 * needs, while `close` stays adjusted (adjusted_close ?? close).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEodCloses } from './fetchDriverSeries.js';

const WIRE = [
  // newest-first (order=d), adjusted_close ≠ close to prove which one `close` uses
  { date: '2026-07-10', adjusted_close: 101.5, close: 100.0, open: 99.0, high: 102.0, low: 98.5, volume: 1_200_000 },
  { date: '2026-07-09', adjusted_close: 100.2, close: 99.0, open: 98.0, high: 101.0, low: 97.5, volume: 900_000 },
];

beforeEach(() => {
  vi.stubEnv('EODHD_API_KEY', 'test-key');
  vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => WIRE }));
});

describe('fetchEodCloses — closes-only (existing callers, byte-identical)', () => {
  it('maps exactly { date, close } and nothing else', async () => {
    const rows = await fetchEodCloses('SPY.US', 504);
    expect(rows).toEqual([
      { date: '2026-07-10', close: 101.5 }, // adjusted_close preferred
      { date: '2026-07-09', close: 100.2 },
    ]);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['close', 'date']);
    // no volume / OHLC leaks into the closes-only shape
    expect(JSON.stringify(rows)).not.toMatch(/volume|open|high|low|rawClose/);
  });

  it('passing only { signal } stays closes-only (the additive-options precedent is preserved)', async () => {
    const rows = await fetchEodCloses('SPY.US', 504, { signal: undefined });
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['close', 'date']);
  });
});

describe('fetchEodCloses — withVolume (the audit path)', () => {
  it('additively maps raw open/high/low/volume/rawClose; close stays adjusted', async () => {
    const rows = await fetchEodCloses('SMH.US', 504, { withVolume: true });
    expect(rows[0]).toEqual({
      date: '2026-07-10',
      close: 101.5, // still adjusted_close
      volume: 1_200_000,
      open: 99.0,
      high: 102.0,
      low: 98.5,
      rawClose: 100.0, // the RAW close (for single-print detection)
    });
    expect(rows[1].rawClose).toBe(99.0);
  });

  it('single-print detection uses the raw bar (open==high==low==rawClose)', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      json: async () => [{ date: '2026-07-10', adjusted_close: 50.4, close: 50, open: 50, high: 50, low: 50, volume: 3000 }],
    }));
    const [row] = await fetchEodCloses('DEAD.US', 504, { withVolume: true });
    expect(row.open === row.high && row.high === row.low && row.low === row.rawClose).toBe(true);
  });
});
