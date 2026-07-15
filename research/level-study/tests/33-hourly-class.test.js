// research/level-study/tests/33-hourly-class.test.js
//
// LevelStory Session 6 — the HOURLY CONFIRMATION CLASS (parent §7) and the confirmation window
// (parent §3.2/§7). Pins the P/C/W geometry and the five-class taxonomy against fabricated windows,
// plus the S56-A4 rule that an INELIGIBLE event is never assigned a class.
//
//   P — penetration of the break-side extreme beyond the level (wick-based), daily-ATR
//   C — window-close position, + toward hold side
//   W — max rejection wick with the bar closing on the hold side
//
// Convention (tests/_synthetic-labels): anchor 100, atr 1 ⇒ prices read directly as ATR units.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import {
  confirmationWindow, confirmationAtOf, classMetrics, classifyHourly, labelEvent, anchorOf, bucketOf,
} from '../lib/labels.js';
import { lbar, sess, flatSession, ordered, mkEvent, ANCHOR } from './_synthetic-labels.js';

const ATR = 1;

// ── The confirmation window = touch bar + next bar (parent §3.2/§7) ───────────

test('window is the touch bucket + the NEXT bucket; confirmationAt is the closing boundary', () => {
  // Touch at 11:30 ET (etMin 690, bucket 2 = 690–750). Window = bucket 2 + bucket 3 (750–810).
  const bars = [];
  for (let et = 690; et < 810; et += 5) bars.push(lbar('2024-03-05', et, { c: 100 }));
  const s = sess('2024-03-05', bars);
  const w = confirmationWindow({ session: s, touchEtMinutes: 690 });
  assert.equal(w.touchBucketIndex, 2);
  assert.equal(w.windowCloseEtMinutes, 810, 'the window closes at the end of the NEXT bucket (13:30)');
  assert.equal(w.windowBars.length, 24, '2 hourly buckets × 12 five-minute bars');
  // confirmationAt is the boundary timestamp (13:30), derived DST-safely off a real bar's epoch.
  assert.match(confirmationAtOf(w), /T13:30:00\.000Z$/);
});

test('a touch in the FINAL bucket has no next bar — the window is the touch bucket alone', () => {
  // Touch at 15:30 (etMin 930, bucket 6 = 930–960, the 30-min tail). There is no bucket 7.
  const bars = [];
  for (let et = 930; et <= 955; et += 5) bars.push(lbar('2024-03-05', et, { c: 100 }));
  const w = confirmationWindow({ session: sess('2024-03-05', bars), touchEtMinutes: 930 });
  assert.equal(w.touchBucketIndex, 6);
  assert.equal(w.windowCloseEtMinutes, 960, 'the tail bucket closes at 16:00');
  assert.equal(w.windowBars.length, 6);
});

test('bucketOf maps ET minutes to the 9:30-anchored buckets and rejects off-grid minutes', () => {
  assert.equal(bucketOf(570), 0);
  assert.equal(bucketOf(629), 0);
  assert.equal(bucketOf(630), 1, 'a boundary minute belongs to the bucket it opens');
  assert.equal(bucketOf(955), 6);
  assert.equal(bucketOf(960), null, 'the 16:00 auction minute is not a regular bucket');
  assert.equal(bucketOf(400), null);
});

// ── P/C/W geometry + the five classes (parent §7) ────────────────────────────

/** Build a 2-bar window (adjusted) with the given (low, close) for bar1 and (low, close) for bar2. */
function window2(b1, b2) {
  const bars = [
    lbar('2024-03-05', 690, { l: b1.l, c: b1.c, h: b1.h ?? Math.max(b1.c, ANCHOR) }),
    lbar('2024-03-05', 755, { l: b2.l, c: b2.c, h: b2.h ?? Math.max(b2.c, ANCHOR) }),
  ];
  return { windowBars: bars, windowClose: bars[1].adjClose };
}

test('SHARP_REJECT — shallow close-penetration, deep rejected wick, strong hold-side close', () => {
  // bar1 pierces to 99.68 (P=W=0.32 ≤ 0.35) but closes 100.30 (hold side); window closes 100.40.
  const w = window2({ l: 99.68, c: 100.30 }, { l: 100.35, c: 100.40 });
  const m = classMetrics({ ...w, anchor: 100, atr: ATR, side: 'support' });
  assert.ok(Math.abs(m.P - 0.32) < 1e-9 && Math.abs(m.W - 0.32) < 1e-9 && Math.abs(m.C - 0.40) < 1e-9);
  assert.equal(classifyHourly(m), 'SHARP_REJECT');
});

test('DRIFT_HOLD — shallow, held without conviction (0 ≤ C < 0.25)', () => {
  const w = window2({ l: 99.90, c: 100.05 }, { l: 100.02, c: 100.10 });
  const m = classMetrics({ ...w, anchor: 100, atr: ATR, side: 'support' });
  assert.ok(m.P <= 0.35 && m.C >= 0 && m.C < 0.25);
  assert.equal(classifyHourly(m), 'DRIFT_HOLD');
});

test('BREAK_HOLD — pierced deep, decisive close beyond (C ≤ −0.15)', () => {
  const w = window2({ l: 99.50, c: 99.70 }, { l: 99.60, c: 99.80 });
  const m = classMetrics({ ...w, anchor: 100, atr: ATR, side: 'support' });
  assert.ok(m.P > 0.35 && m.C <= -0.15);
  assert.equal(classifyHourly(m), 'BREAK_HOLD');
});

test('BREAK_RECLAIM — pierced deep then reclaimed (P>0.35, C≥+0.10) — the trap', () => {
  const w = window2({ l: 99.40, c: 99.50 }, { l: 100.10, c: 100.20 });
  const m = classMetrics({ ...w, anchor: 100, atr: ATR, side: 'support' });
  assert.ok(m.P > 0.35 && m.C >= 0.10);
  assert.equal(classifyHourly(m), 'BREAK_RECLAIM');
});

test('CHOP — shallow but the wick is not a rejection (W < 0.30 with C ≥ 0.25) ⇒ residual', () => {
  // C = +0.30 would look like SHARP_REJECT, but the deepest hold-side wick is only 0.10 — no violent
  // defense. It also is not DRIFT_HOLD (C ≥ 0.25). W is load-bearing: it demotes this to CHOP.
  const w = window2({ l: 99.90, c: 100.20 }, { l: 100.10, c: 100.30 });
  const m = classMetrics({ ...w, anchor: 100, atr: ATR, side: 'support' });
  assert.ok(m.P <= 0.35 && m.C >= 0.25 && m.W < 0.30);
  assert.equal(classifyHourly(m), 'CHOP');
});

test('W excludes wicks whose bar closed on the BREAK side — a break is not a rejection', () => {
  // bar1 pierces to 99.60 (0.40) but CLOSES below the level (99.70) — that is a break, not a reject.
  // bar2 pierces only 0.05 and closes on the hold side. So P = 0.40, but W = 0.05 (only the hold-side
  // close contributes). This is exactly what stops a deep-then-fail bar being read as SHARP_REJECT.
  const w = window2({ l: 99.60, c: 99.70 }, { l: 99.95, c: 100.20 });
  const m = classMetrics({ ...w, anchor: 100, atr: ATR, side: 'support' });
  assert.ok(Math.abs(m.P - 0.40) < 1e-9, 'P sees the deepest wick regardless of close');
  assert.ok(Math.abs(m.W - 0.05) < 1e-9, 'W sees only the hold-side-close bar');
});

// ── Sign-normalization: support and resistance are mirror images (parent §9.1) ─

test('classMetrics is mirror-symmetric — a resistance window mirrors a support window exactly', () => {
  const support = window2({ l: 99.68, c: 100.30 }, { l: 100.35, c: 100.40 });
  // Mirror each bar around the anchor (100): high↔low swap, prices reflected.
  const mirror = (b) => lbar(b.etDate, b.etMinutes, { o: 200 - b.open, c: 200 - b.close, h: 200 - b.low, l: 200 - b.high });
  const resBars = support.windowBars.map(mirror);
  const res = { windowBars: resBars, windowClose: resBars[resBars.length - 1].adjClose };
  const mS = classMetrics({ ...support, anchor: 100, atr: ATR, side: 'support' });
  const mR = classMetrics({ ...res, anchor: 100, atr: ATR, side: 'resistance' });
  assert.deepEqual(mR, mS, 'sign-normalized P/C/W are identical under the mirror');
  assert.equal(classifyHourly(mR), classifyHourly(mS));
});

// ── S56-A4 / S6 §3: an INELIGIBLE event is never assigned a class ─────────────

test('S56-A4: labelEvent nulls hourly_class when the event is coverage-ineligible', () => {
  const { sessions, dateToIdx } = ordered([flatSession('2024-03-04', 100), flatSession('2024-03-05', 100)]);
  const eligible = labelEvent({ event: mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 690, hourlyClassEligible: true }), orderedSessions: sessions, dateToIdx });
  assert.equal(eligible.hourly_class, 'DRIFT_HOLD', 'a complete, flat window holds without conviction');
  assert.ok(eligible.hourlyClassInputs, 'and its P/C/W inputs are recorded');

  const ineligible = labelEvent({ event: mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 690, hourlyClassEligible: false }), orderedSessions: sessions, dateToIdx });
  assert.equal(ineligible.hourly_class, null, 'an incomplete confirmation window ⇒ NO class (S6 §3)');
  assert.equal(ineligible.hourlyClassInputs, null, 'and no P/C/W leaks out either');
});

test('anchorOf recovers the level from the symmetric episode zone', () => {
  assert.equal(anchorOf({ zoneLow: 99.75, zoneHigh: 100.25 }), 100);
  assert.equal(anchorOf({ zoneLow: 240, zoneHigh: 260 }), 250);
});

test('config P/C/W knobs are the parent §7 table (guards against a silent retune)', () => {
  const c = CONFIG.hourlyClass.classes;
  assert.equal(c.SHARP_REJECT.penetrationMax, 0.35);
  assert.equal(c.SHARP_REJECT.closeMin, 0.25);
  assert.equal(c.SHARP_REJECT.wickMin, 0.30);
  assert.equal(c.BREAK_HOLD.penetrationMinExclusive, 0.35);
  assert.equal(c.BREAK_RECLAIM.closeMin, 0.10);
});
