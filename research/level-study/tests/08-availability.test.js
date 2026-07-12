// Test #8 (S3 required test 1) — Availability assertion (parent §5.3 / §3.10).
// On sampled (symbol, day) pairs from COMMITTED FIXTURES: every level in the D registry
// satisfies firstTradableDate ≤ D — snapshot-level AND member-level — and re-derives
// from the D−1-truncated series alone (the re-derivation harness: a from-scratch
// truncated rebuild reproduces the exact same day-D snapshots, availability fields
// included). FIXTURE-BASED: no fetched data required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDaily } from '../lib/normalize.js';
import { runLevels, runTruncated, registryAt, canonical } from '../02-build-levels.js';
import { loadFixture } from './_helpers.js';
import { sampleDistinct, fnv1a } from './_synthetic.js';

const SYMBOLS = ['AAPL', 'KO', 'COIN'];
const END = '2024-03-28'; // ~180 registry sessions per symbol keeps the suite fast
const DAYS_PER_SYMBOL = 3;

for (const sym of SYMBOLS) {
  test(`availability: ${sym} sampled registry days honor firstTradableDate ≤ D and re-derive truncated`, () => {
    const { bars } = normalizeDaily(loadFixture(`daily/${sym}_eod_2018-01-01_2026-07-10.json`));
    const inc = runLevels(bars, { symbol: sym, endDate: END });
    assert.ok(inc.sessions.length >= 100, `${sym}: only ${inc.sessions.length} registry sessions`);

    // Seed = stable hash of the FULL symbol string (S3.5 §9.1) — never name length.
    const sampledDays = sampleDistinct(inc.sessions.map((s) => s.date), DAYS_PER_SYMBOL, fnv1a(`avail:${sym}`));
    for (const D of sampledDays) {
      const day = registryAt(inc, D);
      assert.ok(day.snapshots.length > 0, `${sym} ${D}: empty registry`);

      // 1. Availability: every snapshot and every member level tradable by D.
      for (const snap of day.snapshots) {
        assert.ok(snap.firstTradableDate <= D, `${sym} ${D}: snapshot ${snap.snapshotId} firstTradable ${snap.firstTradableDate} > D`);
        assert.ok(snap.firstKnownDate <= D, `${sym} ${D}: snapshot ${snap.snapshotId} firstKnown ${snap.firstKnownDate} > D`);
        for (const m of snap.members) {
          assert.ok(m.firstTradableDate <= D, `${sym} ${D}: member ${m.method}@${m.price} firstTradable ${m.firstTradableDate} > D`);
          assert.ok(m.formationDate <= m.firstKnownDate && m.firstKnownDate <= m.firstTradableDate,
            `${sym} ${D}: member ${m.method} availability triple out of order`);
        }
      }

      // 2. Re-derivation: the D registry is reproducible from the D−1-truncated series alone.
      const tru = runTruncated(bars, D, { symbol: sym });
      const truDay = registryAt(tru, D);
      assert.ok(truDay, `${sym} ${D}: truncated rebuild produced no day-D registry`);
      assert.equal(canonical(day.snapshots), canonical(truDay.snapshots),
        `${sym} ${D}: day-D snapshots differ between incremental and truncated rebuild`);
    }
  });
}
