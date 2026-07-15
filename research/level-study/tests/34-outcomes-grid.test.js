// research/level-study/tests/34-outcomes-grid.test.js
//
// LevelStory Session 6 — the DUAL-ORIGIN OUTCOME GRID + bridge columns + the three timestamps
// (parent §9, §9.2, §3). This file is the heart of the session: it pins THE CONFIRMATION LEAK
// GUARDS (§6.1–6.4) — the exact bug the parent spec was founded to prevent — plus the correctness
// battery (§6.5–6.11) and the peer-confirmation ordering (§4).
//
// Convention (tests/_synthetic-labels): anchor 100, atr 1 ⇒ prices read directly as ATR units.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  labelEvent, computeGrid, bridgeColumns, peerConfirmationsSameSessionBeforeTouch,
} from '../lib/labels.js';
import { lbar, sess, flatSession, ordered, mkEvent } from './_synthetic-labels.js';

// A day where a large FAVORABLE spike sits between the 09:30 touch and the entry bar. `spikeHigh`
// controls the pre-entry bar at 10:00 (etMin 600). Touch = 570 (bucket 0); window = buckets 0+1;
// confirmationAt = 690; entry bar = 690 (open 100.5). Bars from 690 on move only modestly.
function leakDay(etDate, spikeHigh) {
  const bars = [];
  for (let et = 570; et <= 955; et += 5) {
    if (et === 600) bars.push(lbar(etDate, et, { c: 100, h: spikeHigh }));            // pre-entry spike
    else if (et >= 690) bars.push(lbar(etDate, et, { o: 100.5, c: 100.5, h: 100.6, l: 100.4 })); // post-entry: modest
    else bars.push(lbar(etDate, et, { c: 100 }));                                     // pre-entry: flat at the level
  }
  return sess(etDate, bars);
}

// ── §6.1 — THE LEAK GUARD: confirmation-time outcomes never read a bar before entryAt ─────────────

test('§6.1 confirmation-time MFE EXCLUDES the touchAt→entryAt spike (the founding bug)', () => {
  const { sessions, dateToIdx } = ordered([leakDay('2024-03-05', 110), flatSession('2024-03-06', 100.5)]);
  const label = labelEvent({ event: mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 570 }), orderedSessions: sessions, dateToIdx });

  // The touch-time study, measuring from 09:30, SEES the +10 ATR spike.
  assert.ok(label.touchTime.mfe.EOD >= 9.9, `touch-time MFE must see the spike (got ${label.touchTime.mfe.EOD})`);
  // The confirmation-time study, measuring from entryAt (11:30), must NOT — the spike is the very
  // move that would have created the label, and crediting it is the confirmation leak.
  assert.ok(label.confirmationTime.mfe.EOD <= 0.2, `confirmation-time MFE must exclude the spike (got ${label.confirmationTime.mfe.EOD})`);
});

// ── §6.2 — the two grids are computed from their own origins, independently ───────────────────────

test('§6.2 poisoning a pre-entry bar changes the touch-time grid but NOT the confirmation-time grid', () => {
  const clean = ordered([leakDay('2024-03-05', 100.1), flatSession('2024-03-06', 100.5)]);
  const poisoned = ordered([leakDay('2024-03-05', 110), flatSession('2024-03-06', 100.5)]);
  const ev = mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 570 });

  const a = labelEvent({ event: ev, orderedSessions: clean.sessions, dateToIdx: clean.dateToIdx });
  const b = labelEvent({ event: ev, orderedSessions: poisoned.sessions, dateToIdx: poisoned.dateToIdx });

  assert.notEqual(JSON.stringify(a.touchTime), JSON.stringify(b.touchTime), 'the touch-time grid reads the poisoned bar and must change');
  assert.equal(JSON.stringify(a.confirmationTime), JSON.stringify(b.confirmationTime), 'the confirmation-time grid starts at entryAt and must be identical');
});

// ── §6.3 — the class / confirmationAt do not exist before the window closes, and the touch-time
//           study never references them ──────────────────────────────────────────────────────────

test('§6.3 confirmationAt is strictly after touchAt; the touch-time grid carries no class/entry field', () => {
  const { sessions, dateToIdx } = ordered([flatSession('2024-03-04', 100), flatSession('2024-03-05', 100)]);
  const label = labelEvent({ event: mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 690 }), orderedSessions: sessions, dateToIdx });

  assert.ok(new Date(label.confirmationAt) > new Date(label.touchAt), 'the class cannot exist before the window closes');
  assert.ok(new Date(label.entryAt) >= new Date(label.confirmationAt), 'entryAt is at/after confirmationAt');
  // The touch-time grid is a pure origin-referenced object — it cannot reference the hourly class,
  // confirmationAt, or entryAt (they are not even passed to computeGrid).
  for (const forbidden of ['hourly_class', 'confirmationAt', 'entryAt', 'P', 'C', 'W']) {
    assert.ok(!(forbidden in label.touchTime), `touch-time grid must not carry ${forbidden}`);
  }
});

// ── §6.4 — the A4 guard nulls the class but leaves the touch-time grid intact ─────────────────────

test('§6.4 an ineligible event has hourly_class null yet KEEPS its touch-time grid (P3 is touch-time)', () => {
  const { sessions, dateToIdx } = ordered([flatSession('2024-03-04', 100), flatSession('2024-03-05', 100)]);
  const label = labelEvent({ event: mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 690, hourlyClassEligible: false }), orderedSessions: sessions, dateToIdx });
  assert.equal(label.hourly_class, null, 'A4: no class from an incomplete window');
  assert.ok(label.touchTime && label.touchTime.mfe, 'but the touch-time grid still exists — the A4 drop is class-only');
  // (The absence from P1/P2/P5 eligibility is enforced upstream and pinned by tests/32.)
});

// ── §6.5 — fractionElapsedAtEntry is null below 0.25 ATR total move, correct otherwise ────────────

test('§6.5 fractionElapsedAtEntry: null when the denominator < 0.25 ATR; before/(before+remaining) else', () => {
  // before 0.20 + remaining 0.60 = 0.80 ≥ 0.25 ⇒ 0.20/0.80 = 0.25
  const ok = bridgeColumns({ touchPrice: 100, entryPrice: 100.20, confirmationMfeEod: 0.60, atr: 1, side: 'support' });
  assert.ok(Math.abs(ok.moveBeforeConfirmation - 0.20) < 1e-9);
  assert.ok(Math.abs(ok.fractionElapsedAtEntry - 0.25) < 1e-9);

  // before 0.05 + remaining 0.10 = 0.15 < 0.25 ⇒ null (no meaningful move to apportion)
  const tiny = bridgeColumns({ touchPrice: 100, entryPrice: 100.05, confirmationMfeEod: 0.10, atr: 1, side: 'support' });
  assert.equal(tiny.fractionElapsedAtEntry, null);

  // a negative net move keeps the denominator small ⇒ null, never a divide that manufactures a number
  const adverse = bridgeColumns({ touchPrice: 100, entryPrice: 99.80, confirmationMfeEod: 0.10, atr: 1, side: 'support' });
  assert.equal(adverse.fractionElapsedAtEntry, null);

  // mirror (resistance): entryPrice 99.80 ⇒ before +0.20; identical result
  const mir = bridgeColumns({ touchPrice: 100, entryPrice: 99.80, confirmationMfeEod: 0.60, atr: 1, side: 'resistance' });
  assert.ok(Math.abs(mir.fractionElapsedAtEntry - 0.25) < 1e-9);
});

// ── §6.6 — intrabar ambiguity resolves adverse-first and increments ambiguousBars ────────────────

test('§6.6 same-bar target+stop resolves adverse-first (stop) and flags the cell ambiguous', () => {
  const origin = sess('2024-03-05', [
    lbar('2024-03-05', 690, { c: 100 }),
    lbar('2024-03-05', 695, { o: 100, c: 100, h: 100.6, l: 99.7 }), // hits +0.50 target AND −0.25 stop
    lbar('2024-03-05', 700, { c: 100 }),
  ]);
  const grid = computeGrid({
    orderedSessions: [origin, flatSession('2024-03-06', 100)].map((s, i) => (i === 0 ? origin : s)),
    originIdx: 0, originEtMinutes: 690, originPrice: 100, anchor: 100, atr: 1, side: 'support',
  });
  assert.deepEqual(grid.targetBeforeStop['0.50/0.25'], { result: 'stop', ambiguous: true }, 'adverse-first: the stop is deemed hit first');
  assert.equal(grid.targetBeforeStop['0.50/0.75'].result, 'target', 'a wider stop (0.75) is not touched ⇒ the target resolves cleanly');
  assert.equal(grid.targetBeforeStop['0.50/0.75'].ambiguous, false);
  assert.equal(grid.ambiguousBars, 1, 'exactly one pair was resolved by a collision bar');
});

// ── §6.7 — overnightEntry rolls to the next session open and carries the gap ─────────────────────

test('§6.7 confirmationAt at/after 15:55 ⇒ overnightEntry, entryAt = next session open, gap carried', () => {
  // Touch at 14:30 (etMin 870, bucket 5). Window = bucket 5 + bucket 6 ⇒ closes 16:00 ≥ 15:55.
  const { sessions, dateToIdx } = ordered([flatSession('2024-03-05', 100), flatSession('2024-03-06', 101)]); // +1 ATR gap up
  const label = labelEvent({ event: mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 870 }), orderedSessions: sessions, dateToIdx });

  assert.equal(label.overnightEntry, true);
  assert.equal(label.entryEtMinutes, 570, 'entry rolls to the next session opening bar (09:30)');
  assert.match(label.entryAt, /^2024-03-06T09:30:00/, 'entryAt is the next session open');
  // The confirmation-time study carries the overnight gap: entry at 101 vs touch at 100 ⇒ +1 ATR.
  assert.ok(Math.abs(label.moveBeforeConfirmation - 1.0) < 1e-9, 'the overnight gap is carried into moveBeforeConfirmation');

  // Counter-case: a mid-morning touch confirms and enters same-session.
  const same = labelEvent({ event: mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 690 }), orderedSessions: sessions, dateToIdx });
  assert.equal(same.overnightEntry, false, 'a window closing at 13:30 enters the same session');
  assert.equal(same.entryEtMinutes, 810);
});

// ── §6.8 — held_{horizon} is close-based (a wick through the level does not break a hold) ─────────

test('§6.8 held is close-based — a deep wick that closes back on the hold side does NOT break it', () => {
  const wickBack = sess('2024-03-05', [
    lbar('2024-03-05', 690, { c: 100 }),
    lbar('2024-03-05', 695, { o: 100, c: 100.1, h: 100.1, l: 99.0 }), // wick 1.0 ATR below, closes ABOVE
    lbar('2024-03-05', 700, { c: 100.1 }),
  ], { sessionCloseAdj: 100.1 });
  const heldGrid = computeGrid({ orderedSessions: [wickBack], originIdx: 0, originEtMinutes: 690, originPrice: 100, anchor: 100, atr: 1, side: 'support' });
  assert.equal(heldGrid.held.EOD, true, 'a wick through the level does not break a hold (close stayed above)');
  assert.ok(heldGrid.mae.EOD <= -0.9, 'the excursion (on lows) still records the deep adverse wick');

  const closeBelow = sess('2024-03-05', [
    lbar('2024-03-05', 690, { c: 100 }),
    lbar('2024-03-05', 695, { o: 100, c: 99.0, h: 100, l: 99.0 }), // CLOSES 1.0 ATR below
  ], { sessionCloseAdj: 99.0 });
  const brokeGrid = computeGrid({ orderedSessions: [closeBelow], originIdx: 0, originEtMinutes: 690, originPrice: 100, anchor: 100, atr: 1, side: 'support' });
  assert.equal(brokeGrid.held.EOD, false, 'a CLOSE beyond the level by >0.25 ATR breaks the hold');
});

// ── §6.9 — sign-normalization: mirror-image support and resistance grids are identical ────────────

test('§6.9 a resistance event mirrors a support event exactly (identical sign-normalized grid)', () => {
  // A non-trivial 2-session support path.
  const supBars1 = [
    lbar('2024-03-05', 690, { o: 100, c: 100.3, h: 100.4, l: 99.7 }),
    lbar('2024-03-05', 695, { o: 100.3, c: 100.8, h: 101.0, l: 100.2 }),
    lbar('2024-03-05', 700, { o: 100.8, c: 99.6, h: 100.9, l: 99.5 }),
  ];
  const supBars2 = [lbar('2024-03-06', 570, { o: 100.2, c: 100.5, h: 100.9, l: 100.0 })];
  const sup = ordered([sess('2024-03-05', supBars1), sess('2024-03-06', supBars2)]);

  const mirrorBar = (b) => lbar(b.etDate, b.etMinutes, { o: 200 - b.open, c: 200 - b.close, h: 200 - b.low, l: 200 - b.high });
  const res = ordered([sess('2024-03-05', supBars1.map(mirrorBar)), sess('2024-03-06', supBars2.map(mirrorBar))]);

  const gSup = computeGrid({ orderedSessions: sup.sessions, originIdx: 0, originEtMinutes: 690, originPrice: 100, anchor: 100, atr: 1, side: 'support' });
  const gRes = computeGrid({ orderedSessions: res.sessions, originIdx: 0, originEtMinutes: 690, originPrice: 100, anchor: 100, atr: 1, side: 'resistance' });
  assert.equal(JSON.stringify(gRes), JSON.stringify(gSup), 'the sign-normalized grids must be byte-identical under the mirror');
});

// ── §6.10 — determinism: two identical runs are byte-identical ────────────────────────────────────

test('§6.10 two identical labelEvent runs produce byte-identical labels', () => {
  const build = () => ordered([leakDay('2024-03-05', 110), flatSession('2024-03-06', 100.5)]);
  const ev = mkEvent({ eventDate: '2024-03-05', touchEtMinutes: 570 });
  const a = labelEvent({ event: ev, ...renameOrdered(build()) });
  const b = labelEvent({ event: ev, ...renameOrdered(build()) });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
function renameOrdered(o) { return { orderedSessions: o.sessions, dateToIdx: o.dateToIdx }; }

// ── §6.11 — the byte-identical guard: throw rather than silently default a required input ─────────

test('§6.11 labelEvent throws on a missing/zero ATR (the ATR series is never defaulted)', () => {
  const { sessions, dateToIdx } = ordered([flatSession('2024-03-05', 100)]);
  assert.throws(() => labelEvent({ event: mkEvent({ atrDaily: 0 }), orderedSessions: sessions, dateToIdx }), /atrDaily/);
  const noAtr = mkEvent(); delete noAtr.atrDaily;
  assert.throws(() => labelEvent({ event: noAtr, orderedSessions: sessions, dateToIdx }), /atrDaily/);
});

test('§6.11 labelEvent throws when the origin session is absent (origin timestamps required)', () => {
  const { sessions, dateToIdx } = ordered([flatSession('2024-03-05', 100)]);
  assert.throws(
    () => labelEvent({ event: mkEvent({ eventDate: '2099-01-01' }), orderedSessions: sessions, dateToIdx }),
    /no session for eventDate/,
  );
});

test('§6.11 labelEvent throws on a pre-A4 event with no hourlyClassEligible (no silent default)', () => {
  const { sessions, dateToIdx } = ordered([flatSession('2024-03-05', 100)]);
  const stale = mkEvent(); delete stale.hourlyClassEligible;
  assert.throws(() => labelEvent({ event: stale, orderedSessions: sessions, dateToIdx }), /hourlyClassEligible/);
});

test('§6.11 computeGrid throws on a non-positive ATR', () => {
  const { sessions } = ordered([flatSession('2024-03-05', 100)]);
  assert.throws(() => computeGrid({ orderedSessions: sessions, originIdx: 0, originEtMinutes: 690, originPrice: 100, anchor: 100, atr: 0, side: 'support' }), /atr > 0/);
});

// ── §4 — peer_confirmations_same_session_before_touch: strictly-before, same-session ordering ─────

test('§4 peer confirmations count same-session peers whose confirmationAt precedes this touchAt', () => {
  const event = { eventDate: '2024-03-05', touchAt: '2024-03-05T14:00:00.000Z' };
  const peers = [
    { symbol: 'A', eventDate: '2024-03-05', disposition: 'touch', confirmationAt: '2024-03-05T13:00:00.000Z' }, // before ⇒ counts
    { symbol: 'B', eventDate: '2024-03-05', disposition: 'touch', confirmationAt: '2024-03-05T14:00:00.000Z' }, // == touch ⇒ NOT strictly before
    { symbol: 'C', eventDate: '2024-03-05', disposition: 'touch', confirmationAt: '2024-03-05T15:00:00.000Z' }, // after ⇒ no
    { symbol: 'D', eventDate: '2024-03-04', disposition: 'touch', confirmationAt: '2024-03-04T13:00:00.000Z' }, // other session ⇒ no
    { symbol: 'E', eventDate: '2024-03-05', disposition: 'GAP_BREAK', confirmationAt: '2024-03-05T13:00:00.000Z' }, // not a touch ⇒ no
    { symbol: 'F', eventDate: '2024-03-05', disposition: 'touch', confirmationAt: null }, // no confirmation ⇒ no
  ];
  assert.equal(peerConfirmationsSameSessionBeforeTouch(event, peers), 1, 'exactly one peer confirmed, in-session, before the touch');
  assert.equal(peerConfirmationsSameSessionBeforeTouch(event, []), 0);
  assert.throws(() => peerConfirmationsSameSessionBeforeTouch({ eventDate: '2024-03-05' }, peers), /touchAt/, 'a missing touchAt is a hard error, not a silent 0');
});
