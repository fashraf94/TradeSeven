// research/level-study/tests/43-holdout-single-open.test.js
//
// S7 §9 — THE HOLDOUT (parent §11.4 crit 3–4 + §15.5; single-open). applyHoldout graduates an in-sample
// CONFIRMED-pending-holdout contrast to CONFIRMED only when the holdout direction AGREES, the holdout
// point estimate falls WITHIN the in-sample 90% CI, and (confirmation-time) the asymmetry stays
// favorable. Any failure ⇒ DEAD, single-open (no re-test). A non-candidate is never opened.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHoldout } from '../lib/aggregate.js';

// A minimal in-sample contrast that graduated in-sample (verdict CONFIRMED-pending-holdout), with a
// difference of +20 pts and a 90% CI of [8, 32].
function inSampleCandidate() {
  return {
    contrastName: 'A vs B', verdict: 'CONFIRMED-pending-holdout',
    diffPoints: 20, diffCI: { loPct: 8, hiPct: 32 },
    cellA: { label: 'A' }, cellB: { label: 'B' },
  };
}
// A holdout contrast twin with a given holdout difference and a favorable/unfavorable winning-cohort asymmetry.
function holdoutTwin(diffPoints, favorable) {
  return {
    contrastName: 'A vs B', diffPoints, diffCI: { loPct: diffPoints - 10, hiPct: diffPoints + 10 },
    cellA: { label: 'A' }, cellB: { label: 'B' },
    asymmetry: { A: { favorable }, B: { favorable } },
  };
}

test('CONFIRMED: holdout agrees in direction, lands within the in-sample CI, asymmetry favorable', () => {
  const res = applyHoldout(inSampleCandidate(), holdoutTwin(18, true), { confirmationTime: true });
  assert.equal(res.finalVerdict, 'CONFIRMED');
  assert.equal(res.criteria.directionAgrees, true);
  assert.equal(res.criteria.withinInSampleCI, true);
  assert.equal(res.criteria.asymmetry, true);
});

test('DEAD: holdout direction disagrees ⇒ DEAD (single-open, no re-test)', () => {
  const res = applyHoldout(inSampleCandidate(), holdoutTwin(-15, true), { confirmationTime: true });
  assert.equal(res.finalVerdict, 'DEAD');
  assert.equal(res.criteria.directionAgrees, false);
  assert.match(res.reason, /DEAD under single-open/);
});

test('DEAD: holdout point estimate falls OUTSIDE the in-sample 90% CI', () => {
  const res = applyHoldout(inSampleCandidate(), holdoutTwin(50, true), { confirmationTime: true }); // 50 > hi 32
  assert.equal(res.finalVerdict, 'DEAD');
  assert.equal(res.criteria.withinInSampleCI, false);
});

test('DEAD: confirmation-time asymmetry not favorable in holdout ⇒ DEAD even if the rate agrees', () => {
  const res = applyHoldout(inSampleCandidate(), holdoutTwin(18, false), { confirmationTime: true });
  assert.equal(res.finalVerdict, 'DEAD');
  assert.equal(res.criteria.asymmetry, false);
});

test('DEAD: a holdout cell below floor (no difference) ⇒ DEAD, cannot confirm', () => {
  const res = applyHoldout(inSampleCandidate(), { contrastName: 'A vs B', diffPoints: null, diffCI: null }, { confirmationTime: true });
  assert.equal(res.finalVerdict, 'DEAD');
  assert.match(res.reason, /below floor|cannot confirm/);
});

test('a non-candidate (in-sample UNCONFIRMED) is NEVER opened against the holdout', () => {
  const notCandidate = { contrastName: 'A vs B', verdict: 'UNCONFIRMED', diffPoints: 5, diffCI: { loPct: -10, hiPct: 20 } };
  const res = applyHoldout(notCandidate, holdoutTwin(30, true), { confirmationTime: true });
  assert.equal(res.applied, false, 'the holdout is reserved for graduation candidates only (single-open discipline)');
  assert.equal(res.finalVerdict, 'UNCONFIRMED');
});

test('touch-time contrasts (P3) skip the entryAt asymmetry gate', () => {
  const inS = inSampleCandidate();
  const res = applyHoldout(inS, holdoutTwin(18, null), { confirmationTime: false });
  assert.equal(res.finalVerdict, 'CONFIRMED', 'touch-time needs only direction + within-CI');
  assert.equal(res.criteria.asymmetry, 'n/a (touch-time)');
});
