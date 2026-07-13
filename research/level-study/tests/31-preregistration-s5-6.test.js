// research/level-study/tests/31-preregistration-s5-6.test.js
//
// S5.6 pre-registration amendments — S56-A1 (hasIntradayApproach / P3) and S56-A2 (OPEN_TOUCH).
// These are PRE-OUTCOME amendments; after Session 6 computes its first outcome the pre-registration
// is frozen permanently. These tests pin what was registered, so a later session cannot quietly
// drift the population P3 is measured on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents } from '../lib/events.js';
import { assembleEventFeatures } from '../lib/features.js';
import { buildBudgetReread } from '../04-features.js';
import { mkEventFixture } from './_synthetic-features.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry, geom } from './_synthetic-intraday.js';

// ── S56-A1: hasIntradayApproach is a structural fact about the event ─────────

test('S56-A1 hasIntradayApproach is FALSE iff the touch bar is the session first regular bar', () => {
  const g = geom(100, 1);
  const fam = mkFamily('TST_fam000001', { anchor: 100, bornDate: '2023-05-01' });

  // A support episode opens FROM OUTSIDE (config episode.open.supportFromAbove), so both cases need
  // a prior session closing clearly ABOVE the zone to seed the approach side. The ONLY difference
  // between the two runs is WHERE the zone is first entered.
  const seedDay = []; for (let et = 570; et <= 955; et += 5) seedDay.push(g.aboveSeed);

  // Day 2, case A: still above at the open, descends into the zone at 11:30 → a real approach.
  const approach = [];
  for (let et = 570; et <= 955; et += 5) approach.push(et >= 690 ? g.inside : g.aboveSeed);

  // Day 2, case B: the FIRST bar is already in the zone (gapped down into the level overnight) →
  // zero pre-touch bars. This is the OPEN_TOUCH shape.
  const openTouch = [];
  for (let et = 570; et <= 955; et += 5) openTouch.push(g.inside);

  const run = (day2) => {
    const sessions = [session5m('2023-07-10', seedDay), session5m('2023-07-11', day2)];
    const registry = mkRegistry('TST', [fam], ['2023-07-10', '2023-07-11'].map((d) => regSession(d, [snap('TST_fam000001', d)])));
    const { events } = detectEvents({ symbol: 'TST', registry, fiveMinByDate: fiveMinMap(sessions), studyStart: '2023-07-10' });
    return events.filter((e) => e.eventDate === '2023-07-11'); // the day under test
  };

  const withApproach = run(approach);
  assert.ok(withApproach.length > 0, 'fixture must emit an event');
  assert.equal(withApproach[0].hasIntradayApproach, true, 'a mid-session touch HAS an intraday approach');

  const noApproach = run(openTouch);
  assert.ok(noApproach.length > 0, 'fixture must emit an event');
  assert.equal(noApproach[0].hasIntradayApproach, false, 'a touch on the 09:30 bar has NO intraday approach (zero pre-touch bars)');

  // It is a BOOLEAN on every event — never undefined, never null. P3's gate depends on that.
  for (const ev of [...withApproach, ...noApproach]) {
    assert.equal(typeof ev.hasIntradayApproach, 'boolean', `${ev.eventId}: must be a boolean`);
  }
});

test('S56-A1 the feature row REFUSES an event artifact predating the amendment (no silent undefined)', () => {
  // A stale event (built before S5.6) has no hasIntradayApproach. If that silently read as `false`,
  // P3 would empty out and OPEN_TOUCH would swallow the entire study — invisibly. Fail loudly.
  const fx = mkEventFixture({ touchEtMin: 720 });
  const stale = { ...fx.event };
  delete stale.hasIntradayApproach;
  assert.throws(
    () => assembleEventFeatures({ event: stale, series: fx.series, fiveMinByDate: fx.fiveMinByDate, sessionDates: fx.sessionDates }),
    /hasIntradayApproach missing/,
    'a pre-S5.6 event artifact must force a rebuild, never be silently classed as no-approach',
  );
});

// ── S56-A1 + S56-A2: the budget re-read splits, and never pools ──────────────

/** A minimal re-read row: only the fields buildBudgetReread reads. */
function row(o) {
  return {
    eventDate: o.eventDate, side: o.side, familyTier: o.familyTier ?? 'F2',
    disposition: 'touch', hasIntradayApproach: o.hasIntradayApproach,
    // 570 = 09:30 ET regular open. A no-approach event AT 570 is a true gap-into-the-zone OPEN_TOUCH;
    // a no-approach event at any later minute is a vendor DATA GAP, and the two must not pool.
    touchEtMinutes: o.touchEtMinutes ?? (o.hasIntradayApproach ? 720 : 570),
    features: { pre_touch: { rvol_bucket: o.rvol ?? null, extension_bucket: null, momo_regime: null } },
  };
}

test('S56-A1 P3 is computed ONLY on hasIntradayApproach === true, and states its excluded count', () => {
  const rows = [
    // approach-bearing, F2, with RVOL buckets
    ...Array.from({ length: 40 }, (_, i) => row({ eventDate: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`, side: 'support', hasIntradayApproach: true, rvol: 'HIGH' })),
    // NO intraday approach — these must NOT appear in any P3 bucket cell
    ...Array.from({ length: 25 }, (_, i) => row({ eventDate: `2024-02-${String((i % 28) + 1).padStart(2, '0')}`, side: 'support', hasIntradayApproach: false, rvol: null })),
  ];
  const rr = buildBudgetReread(rows);

  assert.match(rr.questions.P3.gate, /hasIntradayApproach === true/, 'P3 must STATE its conditioning');
  assert.equal(rr.questions.P3.cells['support.HIGH'].n, 40, 'only approach-bearing events populate P3 buckets');
  assert.equal(rr.questions.P3.cells['support.null_rvol'].n, 0, 'the 25 no-approach events are EXCLUDED, not dumped into null_rvol');
  assert.equal(rr.questions.P3.excludedNoIntradayApproach.n, 25, 'and the excluded count is reported, not hidden');
});

test('S56-A2 OPEN_TOUCH carries the excluded events as its own class — never pooled into P3', () => {
  const rows = [
    ...Array.from({ length: 12 }, (_, i) => row({ eventDate: `2024-01-${String(i + 1).padStart(2, '0')}`, side: 'support', hasIntradayApproach: true, rvol: 'MID' })),
    ...Array.from({ length: 9 }, (_, i) => row({ eventDate: `2024-03-${String(i + 1).padStart(2, '0')}`, side: 'support', hasIntradayApproach: false })),
    ...Array.from({ length: 7 }, (_, i) => row({ eventDate: `2024-04-${String(i + 1).padStart(2, '0')}`, side: 'resistance', hasIntradayApproach: false })),
  ];
  const rr = buildBudgetReread(rows);

  assert.equal(rr.questions.OPEN_TOUCH.cells.support.n, 9);
  assert.equal(rr.questions.OPEN_TOUCH.cells.resistance.n, 7);
  assert.equal(rr.questions.OPEN_TOUCH.descriptiveOnly, true, 'OPEN_TOUCH is DESCRIBED, never TESTED — no hypothesis is registered on it');

  // The partition is exact: P3's population + OPEN_TOUCH = the F2+ touch population, with no
  // double-counting. An event is in exactly one of them.
  const p3n = ['LOW', 'MID', 'HIGH'].reduce((a, b) => a + rr.questions.P3.cells[`support.${b}`].n + rr.questions.P3.cells[`resistance.${b}`].n, 0)
    + rr.questions.P3.cells['support.null_rvol'].n + rr.questions.P3.cells['resistance.null_rvol'].n;
  assert.equal(p3n, 12, 'P3 sees exactly the approach-bearing events');
  assert.equal(rr.questions.P3.excludedNoIntradayApproach.n, 16, 'and exactly the other 16 are excluded');
  assert.equal(p3n + rr.questions.P3.excludedNoIntradayApproach.n, rows.length, 'the two classes partition the population exactly — no event is counted twice, none is lost');
});

test('S56-A2 a DATA-GAP session is NOT pooled into OPEN_TOUCH (a missing-bars artifact is not a gap open)', () => {
  // Both null RVOL and both leave P3. But a touch on the 09:30 bar is a real gap-into-the-zone
  // setup, while a touch on the first *delivered* bar at 11:15 (the session's early bars are simply
  // missing from the vendor feed) is a data artifact. Pooling the artifacts into OPEN_TOUCH would
  // contaminate the base rates the founder reads for a real economic class.
  const rows = [
    ...Array.from({ length: 6 }, (_, i) => row({ eventDate: `2024-01-0${i + 1}`, side: 'support', hasIntradayApproach: false, touchEtMinutes: 570 })), // true 09:30 gap-opens
    ...Array.from({ length: 4 }, (_, i) => row({ eventDate: `2024-02-0${i + 1}`, side: 'support', hasIntradayApproach: false, touchEtMinutes: 675 })), // 11:15 — data gap
  ];
  const rr = buildBudgetReread(rows);

  assert.equal(rr.questions.OPEN_TOUCH.cells.support.n, 6, 'only the true 09:30 opens are OPEN_TOUCH');
  assert.equal(rr.questions.NO_PRE_BAR_DATA_GAP.cells.support.n, 4, 'the missing-early-bars sessions are reported as their own artifact class');
  assert.equal(rr.questions.P3.excludedNoIntradayApproach.n, 10, 'both are excluded from P3 — neither has a measurable approach');
  // Neither is silently absorbed: the two descriptive classes partition the no-approach population.
  assert.equal(rr.questions.OPEN_TOUCH.cells.support.n + rr.questions.NO_PRE_BAR_DATA_GAP.cells.support.n, 10);
});

test('a DESCRIPTIVE class never renders a verdict (S56-A2: described, never tested)', () => {
  // cell() stamps PASS/UNDERPOWERED on everything it touches. A reader scanning the verdict column
  // would take "OPEN_TOUCH … PASS" for a cleared hypothesis — on a class that is never tested.
  const rows = Array.from({ length: 60 }, (_, i) => row({
    eventDate: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`, side: 'support', hasIntradayApproach: false, touchEtMinutes: 570,
  }));
  const rr = buildBudgetReread(rows);

  assert.ok(rr.questions.OPEN_TOUCH.cells.support.n >= 30, 'the cell would clear the n floor…');
  assert.equal(rr.questions.OPEN_TOUCH.cells.support.verdict, undefined, '…but it must carry NO verdict — it is described, not tested');
  assert.equal(rr.questions.NO_PRE_BAR_DATA_GAP.cells.support.verdict, undefined, 'nor may the data-gap class');
  // The tested questions still do carry verdicts — the distinction is real, not a blanket removal.
  assert.ok(['PASS', 'UNDERPOWERED'].includes(rr.questions.P4.cells['support.F2'].verdict), 'P4 is a tested question and keeps its verdict');
});

test('S56-A2 OPEN_TOUCH events REMAIN in P4 (they keep tier and the daily grain)', () => {
  // OPEN_TOUCH lacks only the intraday fingerprint. It keeps hourly bars, tier, and every daily
  // feature — so it stays in P1/P2/P4/P5/P6 unchanged. Only P3 (which needs the fingerprint) drops it.
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => row({ eventDate: `2024-01-${String(i + 1).padStart(2, '0')}`, side: 'support', familyTier: 'F1', hasIntradayApproach: false })),
    ...Array.from({ length: 10 }, (_, i) => row({ eventDate: `2024-02-${String(i + 1).padStart(2, '0')}`, side: 'support', familyTier: 'F2', hasIntradayApproach: false })),
  ];
  const rr = buildBudgetReread(rows);
  assert.equal(rr.questions.P4.cells['support.F1'].n, 10, 'no-approach events still count in P4 F1');
  assert.equal(rr.questions.P4.cells['support.F2'].n, 10, 'and in P4 F2 — P4 does not gate on the intraday fingerprint');
  assert.equal(rr.questions.P3.cells['support.LOW'].n, 0, 'while P3 correctly sees none of them');
});
