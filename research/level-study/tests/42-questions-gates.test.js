// research/level-study/tests/42-questions-gates.test.js
//
// S7 — the FROZEN QUESTION GATES (parent §10.1 as amended; S5-A1, S56-A1/A2/A4, Addendum §A4.3). Each
// question conditions on exactly its pre-registered population — no more, no less. These pin the gating
// so a later edit that widens or narrows a population fails loudly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildP1, buildP2, buildP3, buildP4, buildP5, buildP6, buildOpenTouch, applyHoldout, P6_MIN_DIFF_POINTS } from '../lib/aggregate.js';
import { rec } from './_synthetic-aggregate.js';

const spread = (arr) => arr.map((r, i) => ({ ...r, eventId: `${r.eventId || 'e'}_${i}`, eventDate: `2024-0${(i % 6) + 1}-${String((i % 20) + 1).padStart(2, '0')}`, symbol: `S${i % 6}`, sector: `X${i % 3}` }));

test('P1 gate: F2+ AND hourlyClassEligible===true; F3 pools into F2+; F1 and ineligible excluded', () => {
  const data = spread([
    ...Array.from({ length: 20 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT' })),
    ...Array.from({ length: 10 }, () => rec({ side: 'support', familyTier: 'F3', hourlyClassEligible: true, hourly_class: 'DRIFT_HOLD' })), // F3 pools into F2+
    ...Array.from({ length: 10 }, () => rec({ side: 'support', familyTier: 'F1', hourlyClassEligible: true, hourly_class: 'DRIFT_HOLD' })), // F1 excluded (not F2+)
    ...Array.from({ length: 10 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: false, hourly_class: null })),       // A4-ineligible excluded
  ]);
  const p1 = buildP1(data);
  assert.equal(p1.perSide.support.population, 30, 'F2 + F3 eligible = 30; F1 and ineligible excluded');
});

test('P3 gate: F2+ AND hasIntradayApproach===true; OPEN_TOUCH excluded and its count reported', () => {
  const data = spread([
    ...Array.from({ length: 25 }, () => rec({ side: 'resistance', familyTier: 'F2', hasIntradayApproach: true, rvol_bucket: 'MID' })),
    ...Array.from({ length: 8 }, () => rec({ side: 'resistance', familyTier: 'F2', hasIntradayApproach: false, touchEtMinutes: 570 })), // OPEN_TOUCH
  ]);
  const p3 = buildP3(data);
  assert.equal(p3.perSide.resistance.population, 25, 'only approach-bearing events are in P3');
  assert.equal(p3.perSide.resistance.excludedNoIntradayApproach, 8, 'the excluded no-approach count is stated, never hidden (S56-A1)');
  // P3 is touch-time: its endpoint is clean_bounce from touchAt (the cells describe the touch-time clean_bounce).
  assert.equal(p3.endpoint, 'clean_bounce');
  assert.equal(p3.origin, 'touchAt');
});

test('P4 gate: within SHARP_REJECT, F1 vs F2 (S5-A1); F3 is a descriptive footnote only', () => {
  const data = spread([
    ...Array.from({ length: 18 }, () => rec({ side: 'support', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT', familyTier: 'F1' })),
    ...Array.from({ length: 18 }, () => rec({ side: 'support', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT', familyTier: 'F2' })),
    ...Array.from({ length: 4 }, () => rec({ side: 'support', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT', familyTier: 'F3' })),
    ...Array.from({ length: 10 }, () => rec({ side: 'support', hourlyClassEligible: true, hourly_class: 'DRIFT_HOLD', familyTier: 'F2' })), // not SHARP_REJECT ⇒ excluded
  ]);
  const p4 = buildP4(data);
  assert.equal(p4.perSide.support.population, 40, 'all SHARP_REJECT (F1+F2+F3), DRIFT_HOLD excluded');
  assert.equal(p4.perSide.support.contrast.contrastName, 'F1 vs F2');
  assert.equal(p4.perSide.support.f3Footnote.n, 4, 'F3 rendered as a footnote, never in the primary contrast');
});

test('P6: 10-point floor (Addendum §A4.3), MID displayed-not-tested, regime interaction present', () => {
  assert.equal(P6_MIN_DIFF_POINTS, 10, 'P6 uses the Addendum §A4.3 10-point floor, not the generic 15');
  const data = spread([
    ...Array.from({ length: 16 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT', extension_bucket: 'EXT' })),
    ...Array.from({ length: 16 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT', extension_bucket: 'NOT_EXT' })),
    ...Array.from({ length: 8 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT', extension_bucket: 'MID' })),
  ]);
  const p6 = buildP6(data);
  assert.equal(p6.perSide.support.contrast.minDiffPoints, 10);
  assert.ok(p6.perSide.support.midDisplayed, 'MID is displayed');
  assert.ok(p6.perSide.support.regimeInteraction, 'the regime interaction is computed');
  assert.ok(p6.perSide.support.regimeInteraction.dropped, 'starved regime cells ⇒ interaction DROPS first (fallback ladder)');
});

test('P5 and P2 are NOT tier-gated (parent §10.1 omits F2+): F1 events are included', () => {
  const data = spread([
    ...Array.from({ length: 15 }, () => rec({ side: 'support', familyTier: 'F1', hourlyClassEligible: true, hourly_class: 'BREAK_RECLAIM' })),
    ...Array.from({ length: 15 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: true, hourly_class: 'DRIFT_HOLD' })),
    ...Array.from({ length: 10 }, () => rec({ side: 'support', familyTier: 'F1', hourlyClassEligible: true, hourly_class: 'SHARP_REJECT' })),
    ...Array.from({ length: 5 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: false, hourly_class: null })), // ineligible excluded
  ]);
  // 40 eligible across F1+F2 (no tier filter); the 5 ineligible are dropped (S56-A4).
  assert.equal(buildP5(data).perSide.support.population, 40, 'P5 includes F1 (no F2+ gate); ineligible excluded');
  assert.equal(buildP2(data).perSide.support.population, 40, 'P2 includes F1 (no F2+ gate); ineligible excluded');
});

test('P5 (median-difference contrast) exposes label-keyed asymmetry so the holdout §15.5 gate can read it', () => {
  const data = spread([
    ...Array.from({ length: 20 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: true, hourly_class: 'BREAK_RECLAIM', mfe_eod_entry: 0.9, mae_eod_entry: -0.2 })),
    ...Array.from({ length: 20 }, () => rec({ side: 'support', familyTier: 'F2', hourlyClassEligible: true, hourly_class: 'DRIFT_HOLD', mfe_eod_entry: 0.4, mae_eod_entry: -0.2 })),
  ]);
  const contrast = buildP5(data).perSide.support.contrast;
  assert.ok(contrast.asymmetry && contrast.asymmetry.BREAK_RECLAIM && contrast.asymmetry.DRIFT_HOLD,
    'P5 contrast carries label-keyed asymmetry (regression: without it applyHoldout could never CONFIRM P5)');
  assert.ok('favorable' in contrast.asymmetry.BREAK_RECLAIM);
  // And applyHoldout can read it: a candidate whose holdout twin has the asymmetry object does not
  // fail the §15.5 gate purely for a missing field.
  if (contrast.verdict === 'CONFIRMED-pending-holdout') {
    const twin = { ...contrast, diffMedian: contrast.diffMedian, diffCI: contrast.diffCI };
    const res = applyHoldout(contrast, twin, { confirmationTime: true });
    assert.ok(res.criteria.asymmetry !== undefined, 'the asymmetry gate resolves to a real value, not undefined');
  }
});

test('OPEN_TOUCH is descriptive-only: no verdict, never pooled into P3', () => {
  const data = spread([
    ...Array.from({ length: 20 }, () => rec({ side: 'support', hasIntradayApproach: false, touchEtMinutes: 570 })),
    ...Array.from({ length: 5 }, () => rec({ side: 'support', hasIntradayApproach: false, touchEtMinutes: 700 })), // NO_PRE_BAR_DATA_GAP, not OPEN_TOUCH
  ]);
  const ot = buildOpenTouch(data);
  assert.equal(ot.descriptiveOnly, true);
  assert.equal(ot.perSide.support.n, 20, 'OPEN_TOUCH = 09:30 gap-opens only; the data-gap event is not OPEN_TOUCH');
  // no verdict field anywhere in an OPEN_TOUCH side
  assert.ok(!('verdict' in ot.perSide.support), 'a descriptive class carries no verdict');
  // And a pure OPEN_TOUCH population produces an empty P3 (all excluded for no approach).
  const p3 = buildP3(data);
  assert.equal(p3.perSide.support.population, 0, 'OPEN_TOUCH events are never pooled into P3');
});
