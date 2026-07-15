// research/level-study/tests/32-bar-coverage-s56-a4.test.js
//
// S56-A4 — the HOURLY-CLASS BAR-COVERAGE GUARD (pre-registered, pre-outcome).
//
// Session 6 assigns the confirmation class from the geometry of the confirmation window's HOURLY
// bars. Those are aggregates of 5-minute constituents. When constituents are absent from the vendor
// feed, the bar's high/low/close/volume — and therefore its penetration, close-position and wick —
// come from a partial session. The class it yields is not noisy, it is WRONG, and it is
// indistinguishable from a real one.
//
// Rule: any bar of the confirmation window missing >20% of its expected constituents ⇒ the class is
// ineligible ⇒ the event drops from P1/P2/P5.
//
// The load-bearing subtlety these tests pin: a HALF-DAY is not a data gap. A 13:00 ET close
// legitimately has fewer bars, and flagging it would condemn every half-day in the study.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import CONFIG from '../config.js';
import { buildHourly, buildSessionCalendar, normalizeFiveMin } from '../lib/normalize.js';
import { detectEvents } from '../lib/events.js';
import { buildBudgetReread } from '../04-features.js';
import { session5m, fiveMinMap, mkFamily, snap, regSession, mkRegistry, geom, bar } from './_synthetic-intraday.js';

const MIN_COV = CONFIG.hourlyClass.minBarCoveragePct; // 80

/** Regular bars for a full session, optionally dropping the given ET minutes. */
function fullSessionBars(etDate, { drop = [] } = {}) {
  const out = [];
  for (let et = 570; et <= 955; et += 5) {
    if (drop.includes(et)) continue;
    out.push(bar(etDate, et, 100));
  }
  return out;
}

// ── Coverage arithmetic ──────────────────────────────────────────────────────

test('a complete full day: every bucket is 100% covered and complete', () => {
  const h = buildHourly(fullSessionBars('2024-03-05'), 960);
  assert.equal(h.length, 7, '6 hourly buckets + the 15:30–16:00 half bucket');
  for (const b of h) {
    assert.equal(b.coveragePct, 100, `bucket ${b.bucketIndex} must be 100% covered`);
    assert.equal(b.complete, true);
  }
  assert.equal(h[0].expectedBarCount, 12, '09:30–10:30 expects 12 five-minute bars');
  assert.equal(h[6].expectedBarCount, 6, 'the final 15:30–16:00 bucket expects 6');
});

test('>20% of a bucket missing ⇒ that bucket is INCOMPLETE (the pre-registered threshold)', () => {
  // 09:30–10:30 expects 12. Drop 3 → 9/12 = 75% < 80% ⇒ incomplete.
  const h3 = buildHourly(fullSessionBars('2024-03-05', { drop: [575, 585, 595] }), 960);
  assert.equal(h3[0].barCount, 9);
  assert.equal(h3[0].coveragePct, 75);
  assert.equal(h3[0].complete, false, '75% < 80% ⇒ incomplete');

  // Drop 2 → 10/12 = 83.3% ≥ 80% ⇒ still usable. The threshold is a real edge, not a vibe.
  const h2 = buildHourly(fullSessionBars('2024-03-05', { drop: [575, 585] }), 960);
  assert.equal(h2[0].coveragePct, 83.3);
  assert.equal(h2[0].complete, true, '83.3% ≥ 80% ⇒ complete');
  assert.equal(h2[0].missingBarCount, 2);
});

test('a HALF-DAY is not a data gap — expected bars are clipped to the session\'s real close', () => {
  // US half-days close at 13:00 ET (etMin 780): the last regular bar opens 12:55.
  const halfDay = [];
  for (let et = 570; et <= 775; et += 5) halfDay.push(bar('2024-11-29', et, 100));
  const h = buildHourly(halfDay, 780); // auction print at 13:00

  // Every bucket that exists is fully covered — nothing is "missing", the day simply ended.
  for (const b of h) {
    assert.equal(b.complete, true, `half-day bucket ${b.bucketIndex} must NOT be flagged incomplete`);
    assert.equal(b.missingBarCount, 0);
  }
  // The bucket containing the close (12:30–13:30) expects only the 6 slots before 13:00 — not 12.
  const closing = h[h.length - 1];
  assert.equal(closing.openEtMinutes, 750, '12:30–13:30 is the last bucket with bars');
  assert.equal(closing.expectedBarCount, 6, 'expectation is CLIPPED to the 13:00 close, not 12');
  assert.equal(closing.barCount, 6);
  assert.equal(closing.coveragePct, 100);

  // If the expectation were hardcoded to a full day, this bucket would read 50% and every half-day
  // in the study would be condemned as a data gap. That is the bug this test exists to prevent.
  const naive = buildHourly(halfDay, 960);
  assert.equal(naive[naive.length - 1].complete, false, 'sanity: assuming a 16:00 close DOES flag the half-day…');
  assert.equal(closing.complete, true, '…and deriving the real close does not');
});

// ── The event-level gate ─────────────────────────────────────────────────────

/** Build a one-symbol registry + 5m map, with the event session optionally missing bars. */
function runEvents(dropMins) {
  const g = geom(100, 1);
  const fam = mkFamily('TST_fam000001', { anchor: 100, bornDate: '2023-05-01' });
  const seed = session5m('2023-07-10', Array.from({ length: 78 }, () => g.aboveSeed));

  // Day 2: above the zone, descends into it at 11:30 (etMin 690) → a real intraday approach.
  const prices = [];
  for (let et = 570; et <= 955; et += 5) prices.push(et >= 690 ? g.inside : g.aboveSeed);
  let day2 = session5m('2023-07-11', prices);
  if (dropMins.length) {
    day2 = { ...day2, regular: day2.regular.filter((b) => !dropMins.includes(b.etMinutes)) };
  }
  // Rebuild the hourly buckets from the (possibly thinned) bars, with the true 16:00 close.
  day2 = { ...day2, hourly: buildHourly(day2.regular, 960) };
  const seedWithHourly = { ...seed, hourly: buildHourly(seed.regular, 960) };

  const registry = mkRegistry('TST', [fam], ['2023-07-10', '2023-07-11'].map((d) => regSession(d, [snap('TST_fam000001', d)])));
  const { events } = detectEvents({
    symbol: 'TST', registry, fiveMinByDate: fiveMinMap([seedWithHourly, day2]), studyStart: '2023-07-10',
  });
  return events.filter((e) => e.eventDate === '2023-07-11');
}

test('S56-A4 a complete session ⇒ hourlyClassEligible true', () => {
  const evs = runEvents([]);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].hourlyClassEligible, true);
  assert.equal(evs[0].touchHourCoveragePct, 100);
  assert.equal(evs[0].windowMinCoveragePct, 100);
});

test('S56-A4 gutting the TOUCH hour ⇒ ineligible (the class would be built from a partial bar)', () => {
  // The 11:30 touch lands in the 11:30–12:30 bucket (etMin 690–750, 12 expected bars).
  // Drop 4 of them → 8/12 = 66.7% < 80%.
  const evs = runEvents([695, 705, 715, 725]);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].touchHourCoveragePct, 66.7);
  assert.equal(evs[0].hourlyClassEligible, false, 'touch-hour bar is >20% absent ⇒ class ineligible');
});

test('S56-A4 (S56-C2) gutting the NEXT hour also ⇒ ineligible — the window is BOTH bars', () => {
  // Touch hour (11:30–12:30) fully intact; the NEXT bucket (12:30–13:30, etMin 750–810) loses 5 of
  // its 12. The confirmation class is computed from touch bar + next bar, so a complete touch bar
  // followed by a half-empty next bar still yields garbage. This is the S56-C2 decision, pinned.
  const evs = runEvents([755, 765, 775, 785, 795]);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].touchHourCoveragePct, 100, 'the touch bar itself is untouched…');
  assert.equal(evs[0].windowMinCoveragePct, 58.3, '…but the NEXT bar of the window is 58.3% covered');
  assert.equal(evs[0].hourlyClassEligible, false, 'so the class is still ineligible (S56-C2)');
});

// ── Regressions: the two ways a coverage guard silently certifies garbage ─────
//
// Both of these PASSED the gate before they were fixed. They are the guard's failure modes, and
// neither is caught by the partial-gutting tests above — those only ever thin a bucket, never empty
// it, and never truncate the session. A guard you cannot fail is not a guard.

test('S56-A4 regression: a WHOLLY EMPTY confirmation bucket must FAIL, not vanish', () => {
  // The bug: buildHourly skipped buckets with zero bars, so hourlyCoverageOf's `next` lookup found
  // nothing, read it as "the touch is in the final bucket" (a legitimate short window), and computed
  // eligibility over the touch bar ALONE — which was complete. Net effect: a confirmation hour with
  // 58% coverage was correctly REJECTED, but the same hour with ZERO bars was ACCEPTED. The guard
  // was strictly monotonic in the wrong direction: the worse the data, the likelier it passed.
  const wholeNextHour = [750, 755, 760, 765, 770, 775, 780, 785, 790, 795, 800, 805];
  const evs = runEvents(wholeNextHour);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].touchHourCoveragePct, 100, 'the touch bar is intact…');
  assert.equal(evs[0].windowMinCoveragePct, 0, '…and the next bar of the window has NOTHING in it');
  assert.equal(evs[0].hourlyClassEligible, false, '0% coverage must be the STRONGEST failure, not a pass');
});

test('S56-A4 regression: an empty bucket mid-session is EMITTED (0%), not dropped', () => {
  // The bucket must exist in the output for the window lookup to find it. Emitting it is the fix.
  const bars = fullSessionBars('2024-03-05').filter((b) => b.etMinutes < 750 || b.etMinutes >= 810);
  const h = buildHourly(bars, 960);
  assert.equal(h.length, 7, 'the empty 12:30–13:30 bucket still occupies its slot');
  const empty = h.find((b) => b.openEtMinutes === 750);
  assert.ok(empty, 'the wholly-empty bucket must be EMITTED, not skipped');
  assert.equal(empty.barCount, 0);
  assert.equal(empty.expectedBarCount, 12, 'the session was open — 12 bars were owed');
  assert.equal(empty.coveragePct, 0);
  assert.equal(empty.complete, false);
  assert.equal(empty.close, null, 'and it carries no prices — there is nothing to build a class from');
});

test('S56-A4 regression: a TRUNCATED session cannot certify its own completeness', () => {
  // The bug: the session's end was taken from the LAST DELIVERED BAR. So a session whose feed simply
  // stopped at 14:00 reported "expected = what I delivered" ⇒ 100% complete. The coverage metric
  // certified itself, and it did so exactly on the thin, low-print names S56-A5 exists to detect —
  // biasing the completeness distribution CLEAN precisely where it needed to be dirty.
  //
  // sessionEndOf() therefore takes the close from the AUCTION PRINT, else the 16:00 regular close —
  // never from the delivered bars. A feed that dies at 14:00 on a full trading day is a data gap.
  const truncated = [];
  for (let et = 570; et < 840; et += 5) truncated.push(bar('2024-03-05', et, 100)); // stops at 14:00

  const h = buildHourly(truncated, CONFIG.session.regularCloseEtMinutes); // 960 — the fallback
  assert.equal(h.length, 7, 'the buckets after the feed died still exist — the market did not close');
  for (const b of h.filter((x) => x.openEtMinutes >= 840)) {
    assert.equal(b.barCount, 0);
    assert.equal(b.coveragePct, 0, `bucket ${b.bucketIndex} is a GAP, not a short session`);
    assert.equal(b.complete, false);
  }
  // The contrast that pins it: had the end been inferred from the last bar (840), the session would
  // have reported every bucket complete and the gap would have been invisible.
  const selfCertified = buildHourly(truncated, 840);
  assert.ok(selfCertified.every((b) => b.complete === true), 'sanity: inferring the close from the bars hides the gap…');
  assert.ok(h.some((b) => b.complete === false), '…and taking it from the session close exposes it');
});

// ── S56-C3: the market session calendar ──────────────────────────────────────
//
// The half-day test above passes `buildHourly(halfDay, 780)` — it HANDS the function the early
// close, as if the closing auction had supplied it. Production never does. EODHD emits NO auction
// print on a half-day: on all 7 in the study window, 229/229 symbols have hasAuction === false.
// So the real path fell back to 16:00, measured a 13:00 close against a 78-bar expectation, and
// read every half-day as a ~53%-covered data gap — for EVERY symbol, uniformly, which is why the
// bias was invisible and why not one of the 229 names cleared a 99% completeness floor.
//
// These tests exercise the path production actually takes.

// buildSessionCalendar consumes the FLAT `bars` array that normalizeFiveMin actually returns — the
// normalized session objects do NOT carry their constituent bars. Building these fixtures from any
// other shape would test a function production never calls.
//
// A CLOSING PRINT carries a price but no volume; a regular bar carries volume. That is the signal
// the calendar reads, and these fixtures reproduce it exactly as EODHD emits it.
const tradedBars = (etDate, lastOpen) =>
  Array.from({ length: (lastOpen - 570) / 5 + 1 }, (_, i) => bar(etDate, 570 + i * 5, 100));
const closingPrint = (etDate, etMin) => ({ ...bar(etDate, etMin, 100), volume: null });

test('S56-C3 the closing PRINT dates the session end (it has a price but no volume)', () => {
  // A half-day as the vendor actually emits it: traded bars through 12:55, then the 13:00 print.
  const half = (sym) => ({ symbol: sym, bars: [...tradedBars('2024-11-29', 775), closingPrint('2024-11-29', 780)] });
  const refs = Array.from({ length: 12 }, (_, i) => half(`REF${i}`));
  assert.equal(buildSessionCalendar(refs, 3).get('2024-11-29'), 780, 'the session ends AT the 13:00 print');
});

test('S56-C3 with NO closing print the session ends one step past the last traded bar', () => {
  // 2025-10-13 → 2025-10-27: eleven consecutive sessions where the vendor emitted no closing print
  // at all, for every symbol. A rule keyed on the print alone would mis-date the close of all eleven.
  const refs = Array.from({ length: 12 }, (_, i) => ({ symbol: `REF${i}`, bars: tradedBars('2025-10-13', 955) }));
  assert.equal(buildSessionCalendar(refs, 3).get('2025-10-13'), 960, 'last traded bar opens 15:55 ⇒ close is 16:00');
});

test('S56-C3 one truncated reference cannot move the mode', () => {
  const good = (sym) => ({ symbol: sym, bars: tradedBars('2024-03-05', 955) });
  const refs = [
    ...Array.from({ length: 11 }, (_, i) => good(`REF${i}`)),
    { symbol: 'TRUNC', bars: tradedBars('2024-03-05', 660) }, // feed died at 11:00
  ];
  assert.equal(buildSessionCalendar(refs, 3).get('2024-03-05'), 960, 'eleven outvote one');
});

test('S56-C3 normalizeFiveMin REFUSES to run without an explicit calendar decision', () => {
  // The defect this pins is not a wrong number — it is a SILENT one. `sessionCalendar` was optional
  // with a null default, and 03-detect-events.js (which re-normalizes from raw to recover per-bar
  // arrays) simply forgot to pass it. It rebuilt every hourly bucket against a 16:00 close and
  // stamped pre-fix coverage onto all 166k events. The sessions on disk were correct. The events
  // were wrong. Nothing failed, and the budget re-read came back byte-identical — which is the only
  // reason it was caught.
  //
  // Omitting the argument is now an ERROR. Passing null is a deliberate opt-out.
  assert.throws(() => normalizeFiveMin([], new Map()), /MISSING_SESSION_CALENDAR/);
  assert.doesNotThrow(() => normalizeFiveMin([], new Map(), null), 'null is a deliberate opt-out');
});

test('S56-C3 below quorum the references are not trusted — no calendar entry, no silent guess', () => {
  // Two references, each saying something different. There is no consensus, so there is no fact.
  const refs = [
    { symbol: 'A', bars: tradedBars('2024-11-29', 770) },
    { symbol: 'B', bars: tradedBars('2024-11-29', 955) },
  ];
  assert.equal(buildSessionCalendar(refs, 3).has('2024-11-29'), false, 'no entry ⇒ sessionEndOf falls back, loudly');
});

test('S56-C3 a half-day is NOT a data gap (the production path, end to end)', () => {
  // A half-day exactly as EODHD emits it: 42 traded bars (09:30 … 12:55) + the 13:00 closing print.
  const traded = tradedBars('2024-11-29', 775);
  assert.equal(traded.length, 42, '09:30 through 12:55 is 42 five-minute bars');
  const cal = buildSessionCalendar([{ symbol: 'SPY', bars: [...traded, closingPrint('2024-11-29', 780)] }], 1);
  assert.equal(cal.get('2024-11-29'), 780, 'the session closed at 13:00');

  // The auction print is excluded from the hourly aggregation (§4.4) — only the traded bars go in.
  const h = buildHourly(traded, cal.get('2024-11-29'));
  for (const b of h) {
    assert.equal(b.complete, true, `half-day bucket ${b.bucketIndex} must NOT be flagged incomplete`);
    assert.equal(b.coveragePct, 100);
  }
  const closing = h[h.length - 1];
  assert.equal(closing.openEtMinutes, 750, '12:30–13:30 is the last bucket');
  assert.equal(closing.expectedBarCount, 6, 'expectation is CLIPPED to the 13:00 close, not 12');

  // The contrast that pins it — the exact bug, and the exact cost. This is what shipped before
  // S56-C3: the 16:00 fallback condemns the whole afternoon of every half-day, for every symbol.
  const withoutCalendar = buildHourly(traded, CONFIG.session.regularCloseEtMinutes);
  assert.ok(withoutCalendar.filter((b) => b.complete === false).length >= 3,
    'sanity: falling back to 16:00 condemns the half-day…');
  assert.ok(h.every((b) => b.complete === true), '…and the market calendar clears all of it');
});

test('S56-C3 a HALT is still a gap — the calendar must not launder a truncated feed', () => {
  // The case the calendar must NOT swallow. The market ran to 16:00 (the references say so); THIS
  // symbol stopped printing at 14:00. That is a halt or a feed failure, and its afternoon hourly
  // bars are exactly the ones S56-A4 exists to refuse.
  const refs = [{ symbol: 'SPY', bars: fullSessionBars('2024-03-05') }];
  const cal = buildSessionCalendar(refs, 1);
  assert.equal(cal.get('2024-03-05'), 960, 'the market closed at 16:00');

  const halted = fullSessionBars('2024-03-05').filter((b) => b.etMinutes < 840);
  const h = buildHourly(halted, cal.get('2024-03-05'));
  assert.ok(h.some((b) => b.complete === false), 'the halted symbol still reads INCOMPLETE');
  assert.ok(h.filter((b) => b.openEtMinutes >= 840).every((b) => b.coveragePct === 0), 'its post-halt buckets are 0%');
});

// ── The budget re-read drops them from P1/P2/P5 ──────────────────────────────

test('S56-A4 ineligible events DROP from P1/P2/P5 and the dropped count is STATED', () => {
  const row = (o) => ({
    eventDate: o.eventDate, side: 'support', familyTier: 'F2', disposition: 'touch',
    hasIntradayApproach: true, touchEtMinutes: 690, hourlyClassEligible: o.eligible,
    features: { pre_touch: { rvol_bucket: 'MID', extension_bucket: null, momo_regime: null } },
  });
  const rows = [
    ...Array.from({ length: 40 }, (_, i) => row({ eventDate: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`, eligible: true })),
    ...Array.from({ length: 15 }, (_, i) => row({ eventDate: `2024-02-${String((i % 28) + 1).padStart(2, '0')}`, eligible: false })),
  ];
  const rr = buildBudgetReread(rows);

  assert.equal(rr.questions.P1_P2_P5.cells.support.n, 40, 'only eligible events reach P1/P2/P5');
  assert.equal(rr.questions.P1_P2_P5.droppedIncompleteHourlyBars.n, 15, 'and the drop is reported, not hidden');
  assert.match(rr.questions.P1_P2_P5.gate, /hourlyClassEligible === true/, 'the gate STATES the conditioning');

  // P3 does NOT gate on hourly completeness — it is a touch-time question with no hourly input.
  // The A4 guard must not silently narrow a question it has nothing to do with.
  assert.equal(rr.questions.P3.cells['support.MID'].n, 55, 'P3 keeps all 55 — it reads no hourly bar');
});
