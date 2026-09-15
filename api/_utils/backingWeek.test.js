// api/_utils/backingWeek.test.js
//
// Backing Beta PR 1 — the window, proved case by case (spec V1.3 §2, §4;
// rulings D-c amended, D-h, D-x; addendum §2 Q2 / A-C6).
//
// PURE MODULE, REAL HELPERS. Nothing is mocked: the assertions run against the
// writers' own `deriveBattleStartWeek` / `deriveBaseLayerWeek` /
// `etWallClockInstantIso` and the real NYSE holiday calendar, which is the
// point — a pool's window must agree with the pod's own anchor by
// construction, and a mocked Monday rule would prove nothing about that.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's real import of
// api/_utils/backingWeek.js is the runtime guard for that module's api/ -> src/
// import of src/constants/backing.js — it explodes in this Node test env if a
// browser-only dep ever enters the graph. Never mock it.
//
// FIXTURE CALENDAR (all 2026, all verified against the real helpers):
//   Mon 2026-09-14 · Tue 09-15 · Wed 09-16 · Sun 09-20 · Mon 09-21 (battle)
//   Mon 2026-09-07 — LABOR DAY, a holiday Monday (api/_utils/marketSchedule.js)
//   Sun 2026-03-08 — spring forward   ·   Sun 2026-11-01 — fall back

import { describe, it, expect } from 'vitest';
import {
  battleMondayEtDateFor,
  backingWeekFor,
  closesAtFor,
  opensAtFor,
  poolEligible,
  currentBackingWeek,
  POOL_INELIGIBLE,
} from './backingWeek.js';
import { deriveBattleStartWeek } from './liveDraftFormation.js';
import { POOL_MIN_WINDOW_MS } from '../../src/constants/backing.js';

const at = (iso) => new Date(iso);
const seconds = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 1000;

/** A lobby pod: no Monday date of its own, so the Monday derives from createdAt. */
const lobbyPod = (createdAt, extra = {}) => ({ status: 'forming', createdAt, ...extra });

/** A slot pod, stamped exactly as claimSlotSeat stamps it (liveDraftFormation.js). */
const slotPod = (slotId, fireIso, createdAt, extra = {}) => ({
  status: 'forming',
  isLiveDraft: true,
  slotId,
  createdAt,
  scheduledDraftAt: fireIso,
  battleStartWeek: deriveBattleStartWeek(fireIso),
  ...extra,
});

// ============================================================================
describe('battleMondayEtDateFor — the anchor (§4, A-C6)', () => {
  it('a SLOT pod reads its stamped battleStartWeek.mondayEtDate', () => {
    const pod = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', '2026-09-14T13:00:00.000Z');
    expect(pod.battleStartWeek.mondayEtDate).toBe('2026-09-21');
    expect(battleMondayEtDateFor(pod)).toBe('2026-09-21');
  });

  it('the stamped Monday WINS over createdAt — the re-stamped-pod case', () => {
    // The stale-anchor guard re-stamps battleStartWeek for a pod that lingered
    // past its Monday (liveDraftLifecycle.js). If this read fell back to
    // createdAt the pool would target the week the pod NO LONGER plays. The two
    // disagree here on purpose, so the row can fail under that defect.
    const pod = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', '2026-08-26T23:00:00.000Z');
    expect(battleMondayEtDateFor({ ...pod, createdAt: '2026-08-26T23:00:00.000Z' })).toBe('2026-09-21');
    expect(deriveBattleStartWeek('2026-08-26T23:00:00.000Z').mondayEtDate).toBe('2026-08-31');
  });

  it('a LOBBY pod derives the Monday from createdAt through the writers\' own helper', () => {
    // Tuesday 2026-09-15 14:00 ET → the upcoming Monday.
    expect(battleMondayEtDateFor(lobbyPod('2026-09-15T18:00:00.000Z'))).toBe('2026-09-21');
  });

  it('a lobby pod formed Monday BEFORE 09:30 ET targets that SAME Monday', () => {
    expect(battleMondayEtDateFor(lobbyPod('2026-09-14T12:00:00.000Z'))).toBe('2026-09-14'); // 08:00 ET
  });

  it('a lobby pod formed Monday AT/AFTER 09:30 ET targets the FOLLOWING Monday', () => {
    expect(battleMondayEtDateFor(lobbyPod('2026-09-14T14:00:00.000Z'))).toBe('2026-09-21'); // 10:00 ET
  });

  it('a HOLIDAY Monday stays the Monday — the anchor moves, the label does not (§4)', () => {
    // Labor Day 2026-09-07. deriveBattleStartWeek walks anchorEtDate forward to
    // Tuesday; we take mondayEtDate. Both values are asserted so the row fails
    // if this module ever reads the anchor instead.
    const derived = deriveBattleStartWeek('2026-09-02T16:00:00.000Z');
    expect(derived.mondayEtDate).toBe('2026-09-07');
    expect(derived.anchorEtDate).toBe('2026-09-08');
    expect(battleMondayEtDateFor(lobbyPod('2026-09-02T16:00:00.000Z'))).toBe('2026-09-07');
  });

  it('a pod with NO derivable Monday is null, never a guess', () => {
    expect(battleMondayEtDateFor({ status: 'forming' })).toBeNull();
    expect(battleMondayEtDateFor({ status: 'forming', createdAt: null })).toBeNull();
    expect(battleMondayEtDateFor({ status: 'forming', createdAt: 'not-a-date' })).toBeNull();
    expect(battleMondayEtDateFor({ status: 'forming', createdAt: '2026-13-45T00:00:00Z' })).toBeNull();
    expect(battleMondayEtDateFor(null)).toBeNull();
    // A malformed stamp falls through to createdAt rather than being trusted.
    expect(battleMondayEtDateFor({ battleStartWeek: { mondayEtDate: 'Monday' } })).toBeNull();
    expect(battleMondayEtDateFor({ battleStartWeek: { mondayEtDate: '2026-9-7' } })).toBeNull();
  });
});

// ============================================================================
describe('backingWeekFor — Monday 00:00 ET → Sunday 23:59:59 ET (§2)', () => {
  it('is the seven days BEFORE the battle Monday, labeled by the battle Monday\'s ISO week', () => {
    expect(backingWeekFor('2026-09-21')).toEqual({
      weekKey: '2026-W39',
      startIso: '2026-09-14T04:00:00.000Z', // Mon 2026-09-14 00:00 EDT
      closeIso: '2026-09-21T03:59:59.000Z', // Sun 2026-09-20 23:59:59 EDT
    });
  });

  it('the label is the BATTLE week, not the backing week — the two differ by one', () => {
    // The backing week that funds 2026-W39 is lived during 2026-W38. Keying the
    // pool on the battle week is what makes "every stake on a pool is drawn from
    // the same allowance" (§2) true.
    const week = backingWeekFor('2026-09-21');
    expect(week.weekKey).toBe('2026-W39');
    expect(backingWeekFor('2026-09-14').weekKey).toBe('2026-W38');
  });

  it('a holiday Monday does not move the close (§4)', () => {
    const holiday = backingWeekFor('2026-09-07'); // Labor Day
    expect(holiday.closeIso).toBe('2026-09-07T03:59:59.000Z'); // Sun 2026-09-06 23:59:59 EDT
    // Had the close been keyed on the TRADING anchor (Tue 2026-09-08) it would
    // land a day later — the defect this row exists to catch.
    expect(backingWeekFor('2026-09-08').closeIso).toBe('2026-09-08T03:59:59.000Z');
    expect(holiday.weekKey).toBe('2026-W37');
  });

  it('an ordinary week is 7 days minus one second of real time', () => {
    const w = backingWeekFor('2026-09-21');
    expect(seconds(w.startIso, w.closeIso)).toBe(7 * 86_400 - 1);
  });

  it('SPRING FORWARD: the week ending Sun 2026-03-08 is ONE HOUR SHORT (DST-safe)', () => {
    // Start is EST (-05:00), close is EDT (-04:00). A `start + 7 * 24h` close
    // would land an hour LATE — this is the row that catches fixed-hour math.
    const w = backingWeekFor('2026-03-09');
    expect(w).toEqual({
      weekKey: '2026-W11',
      startIso: '2026-03-02T05:00:00.000Z', // Mon 00:00 EST
      closeIso: '2026-03-09T03:59:59.000Z', // Sun 23:59:59 EDT
    });
    expect(seconds(w.startIso, w.closeIso)).toBe(7 * 86_400 - 3_600 - 1);
  });

  it('FALL BACK: the week ending Sun 2026-11-01 is ONE HOUR LONG (DST-safe)', () => {
    const w = backingWeekFor('2026-11-02');
    expect(w).toEqual({
      weekKey: '2026-W45',
      startIso: '2026-10-26T04:00:00.000Z', // Mon 00:00 EDT
      closeIso: '2026-11-02T04:59:59.000Z', // Sun 23:59:59 EST
    });
    expect(seconds(w.startIso, w.closeIso)).toBe(7 * 86_400 + 3_600 - 1);
  });

  it('both DST weeks still span exactly seven ET CALENDAR days', () => {
    // The real-time length changes; the calendar span never does. Both halves
    // matter: one proves DST is honored, the other that it did not shift a day.
    for (const [monday, start, close] of [
      ['2026-03-09', '2026-03-02', '2026-03-08'],
      ['2026-11-02', '2026-10-26', '2026-11-01'],
    ]) {
      const w = backingWeekFor(monday);
      const et = (iso) => new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(iso));
      expect(et(w.startIso)).toBe(start);
      expect(et(w.closeIso)).toBe(close);
    }
  });

  it('refuses a non-date argument rather than inventing a week', () => {
    for (const bad of [null, undefined, '', '2026-W39', '2026-9-7', 'Monday', 42, {}]) {
      expect(backingWeekFor(bad)).toBeNull();
    }
  });
});

// ============================================================================
describe('closesAtFor — the earlier of the clock and the fire (§4, D-x)', () => {
  it('a LOBBY pod closes on the clock: Sunday 23:59:59 ET', () => {
    expect(closesAtFor(lobbyPod('2026-09-15T18:00:00.000Z'))).toEqual({
      closesAt: '2026-09-21T03:59:59.000Z',
      closeReason: 'clock',
    });
  });

  it('a WED 19:00 slot pod closes AT FIRE — days before the Sunday clock', () => {
    const pod = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', '2026-09-14T13:00:00.000Z');
    expect(closesAtFor(pod)).toEqual({ closesAt: '2026-09-16T23:00:00.000Z', closeReason: 'fire' });
    // Four full days earlier than the clock it displaced — the window the human
    // draft would otherwise have been visible through (A-C1).
    expect(seconds(pod.scheduledDraftAt, '2026-09-21T03:59:59.000Z')).toBe(4 * 86_400 + 4 * 3_600 + 59 * 60 + 59);
  });

  it('a SUN 19:00 slot pod closes AT FIRE — hours before the same evening\'s clock', () => {
    const pod = slotPod('sun-1900', '2026-09-20T23:00:00.000Z', '2026-09-14T13:00:00.000Z');
    expect(closesAtFor(pod)).toEqual({ closesAt: '2026-09-20T23:00:00.000Z', closeReason: 'fire' });
    expect(seconds(pod.scheduledDraftAt, '2026-09-21T03:59:59.000Z')).toBe(4 * 3_600 + 59 * 60 + 59);
  });

  it('a MON 08:45 slot pod would close on the CLOCK — its fire is AFTER the close (why D-x excludes it)', () => {
    // The structural fact behind the exclusion: there is no honest window. The
    // slot is refused by POOL_EXCLUDED_SLOT_IDS before this ever matters, but
    // the arithmetic is asserted so the rationale is not folklore.
    const pod = slotPod('mon-0845', '2026-09-21T12:45:00.000Z', '2026-09-14T13:00:00.000Z');
    expect(pod.battleStartWeek.mondayEtDate).toBe('2026-09-21');
    expect(closesAtFor(pod)).toEqual({ closesAt: '2026-09-21T03:59:59.000Z', closeReason: 'clock' });
    expect(new Date(pod.scheduledDraftAt).getTime()).toBeGreaterThan(new Date('2026-09-21T03:59:59.000Z').getTime());
  });

  it('a live-draft pod with an unreadable fire instant falls back to the clock', () => {
    const base = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', '2026-09-14T13:00:00.000Z');
    for (const bad of [null, undefined, 'soon', NaN]) {
      expect(closesAtFor({ ...base, scheduledDraftAt: bad }))
        .toEqual({ closesAt: '2026-09-21T03:59:59.000Z', closeReason: 'clock' });
    }
  });

  it('a scheduledDraftAt on a NON-live-draft pod is ignored — only isLiveDraft pods fire-close', () => {
    const pod = { ...lobbyPod('2026-09-15T18:00:00.000Z'), scheduledDraftAt: '2026-09-16T23:00:00.000Z' };
    expect(closesAtFor(pod)).toEqual({ closesAt: '2026-09-21T03:59:59.000Z', closeReason: 'clock' });
  });

  it('is null when no battle Monday is derivable', () => {
    expect(closesAtFor({ status: 'forming' })).toBeNull();
  });
});

// ============================================================================
describe('opensAtFor — the later of formation and the week start (§4)', () => {
  it('a pod formed INSIDE its backing week opens at formation', () => {
    expect(opensAtFor(lobbyPod('2026-09-15T18:00:00.000Z'))).toBe('2026-09-15T18:00:00.000Z');
  });

  it('a pod formed BEFORE its backing week opens at the week start, not at formation', () => {
    // A slot pod claimed nine days out. Opening at formation would let a stake
    // be drawn from the PREVIOUS week's allowance (§2).
    const pod = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', '2026-09-07T13:00:00.000Z');
    expect(opensAtFor(pod)).toBe('2026-09-14T04:00:00.000Z');
  });

  it('a pod with no readable createdAt opens at the week start', () => {
    const pod = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', undefined);
    expect(opensAtFor(pod)).toBe('2026-09-14T04:00:00.000Z');
  });

  it('is null when no battle Monday is derivable', () => {
    expect(opensAtFor({ status: 'forming' })).toBeNull();
  });
});

// ============================================================================
describe('poolEligible — the §4 predicate', () => {
  const NOW = at('2026-09-15T18:00:00.000Z'); // Tue 2026-09-15 14:00 ET

  it('a LOBBY POD FORMED TUESDAY gets a pool, closing on the clock', () => {
    const verdict = poolEligible(lobbyPod('2026-09-15T18:00:00.000Z'), NOW);
    expect(verdict.eligible).toBe(true);
    expect(verdict.reason).toBeNull();
    expect(verdict.weekKey).toBe('2026-W39');
    expect(verdict.closeReason).toBe('clock');
    expect(verdict.closesAt).toBe('2026-09-21T03:59:59.000Z');
    expect(verdict.opensAt).toBe('2026-09-15T18:00:00.000Z');
  });

  it('a LOBBY POD FORMED MONDAY BEFORE 09:30 ET gets NO POOL — its close is already past', () => {
    // It battles THAT Monday, so its backing week closed the night before.
    const created = '2026-09-14T12:00:00.000Z'; // Mon 08:00 ET
    const verdict = poolEligible(lobbyPod(created), at(created));
    expect(verdict.eligible).toBe(false);
    expect(verdict.reason).toBe(POOL_INELIGIBLE.WINDOW_TOO_SHORT);
    expect(verdict.closesAt).toBe('2026-09-14T03:59:59.000Z');
    // NEGATIVE remaining is how a caller tells "already closed" from "too
    // short" without a second reason word.
    expect(verdict.msRemaining).toBeLessThan(0);
  });

  it('a WED 19:00 SLOT POD gets a pool that closes at fire', () => {
    const pod = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', '2026-09-14T13:00:00.000Z');
    const verdict = poolEligible(pod, at('2026-09-14T13:00:00.000Z'));
    expect(verdict.eligible).toBe(true);
    expect(verdict.closeReason).toBe('fire');
    expect(verdict.closesAt).toBe('2026-09-16T23:00:00.000Z');
    expect(verdict.weekKey).toBe('2026-W39');
  });

  it('a SUN 19:00 SLOT POD gets a pool that closes at fire, before the Sunday clock', () => {
    const pod = slotPod('sun-1900', '2026-09-20T23:00:00.000Z', '2026-09-14T13:00:00.000Z');
    const verdict = poolEligible(pod, at('2026-09-15T18:00:00.000Z'));
    expect(verdict.eligible).toBe(true);
    expect(verdict.closeReason).toBe('fire');
    expect(verdict.closesAt).toBe('2026-09-20T23:00:00.000Z');
  });

  it('a MON 08:45 SLOT POD is EXCLUDED (D-x) — before any window arithmetic runs', () => {
    const pod = slotPod('mon-0845', '2026-09-21T12:45:00.000Z', '2026-09-14T13:00:00.000Z');
    const verdict = poolEligible(pod, at('2026-09-14T13:00:00.000Z'));
    expect(verdict.eligible).toBe(false);
    expect(verdict.reason).toBe(POOL_INELIGIBLE.SLOT_EXCLUDED);
    // The exclusion is the slot's own, not a side effect of a short window:
    // no window fields are returned at all.
    expect(verdict.closesAt).toBeUndefined();
  });

  it('the other three slots are NOT excluded — the list is the Monday slot alone', () => {
    // A row that cannot fail under "POOL_EXCLUDED_SLOT_IDS grew" is not a guard.
    for (const [slotId, fire] of [
      ['wed-1900', '2026-09-16T23:00:00.000Z'],
      ['sat-1200', '2026-09-19T16:00:00.000Z'],
      ['sun-1900', '2026-09-20T23:00:00.000Z'],
    ]) {
      const verdict = poolEligible(slotPod(slotId, fire, '2026-09-14T13:00:00.000Z'), at('2026-09-14T13:00:00.000Z'));
      expect(verdict.reason, slotId).not.toBe(POOL_INELIGIBLE.SLOT_EXCLUDED);
    }
  });

  it('a pod with FEWER THAN 24 HOURS remaining gets no pool', () => {
    // Formed Sunday 10:00 ET against a Sunday 23:59:59 ET close: ~14h.
    const created = '2026-09-20T14:00:00.000Z';
    const verdict = poolEligible(lobbyPod(created), at(created));
    expect(verdict.eligible).toBe(false);
    expect(verdict.reason).toBe(POOL_INELIGIBLE.WINDOW_TOO_SHORT);
    expect(verdict.msRemaining).toBeGreaterThan(0);
    expect(verdict.msRemaining).toBeLessThan(POOL_MIN_WINDOW_MS);
  });

  it('EXACTLY 24 hours remaining is eligible — the rule is ≥, and the boundary is pinned', () => {
    const created = '2026-09-20T03:59:59.000Z'; // exactly 24h before the close
    const verdict = poolEligible(lobbyPod(created), at(created));
    expect(verdict.msRemaining).toBe(POOL_MIN_WINDOW_MS);
    expect(verdict.eligible).toBe(true);
    // One millisecond later it is not.
    const late = poolEligible(lobbyPod('2026-09-20T03:59:59.001Z'), at('2026-09-20T03:59:59.001Z'));
    expect(late.eligible).toBe(false);
    expect(late.reason).toBe(POOL_INELIGIBLE.WINDOW_TOO_SHORT);
  });

  it('the 24-hour test measures from NOW when the pod formed earlier — a late READ is refused too', () => {
    // Formed Monday, read on Sunday afternoon: eligible at formation, not now.
    const pod = lobbyPod('2026-09-14T14:00:00.000Z');
    expect(poolEligible(pod, at('2026-09-14T14:00:00.000Z')).eligible).toBe(true);
    const late = poolEligible(pod, at('2026-09-20T18:00:00.000Z'));
    expect(late.eligible).toBe(false);
    expect(late.reason).toBe(POOL_INELIGIBLE.WINDOW_TOO_SHORT);
  });

  it('the 24-hour test measures from OPENS-AT when the pod formed before its week', () => {
    // Claimed nine days out and read the same day: the window is measured from
    // the week start, not from `now`, so the pod is eligible rather than being
    // credited with nine phantom days.
    const pod = slotPod('wed-1900', '2026-09-16T23:00:00.000Z', '2026-09-07T13:00:00.000Z');
    const verdict = poolEligible(pod, at('2026-09-07T13:00:00.000Z'));
    expect(verdict.opensAt).toBe('2026-09-14T04:00:00.000Z');
    expect(verdict.msRemaining).toBe(
      new Date('2026-09-16T23:00:00.000Z').getTime() - new Date('2026-09-14T04:00:00.000Z').getTime(),
    );
    expect(verdict.eligible).toBe(true);
  });

  it('a HOLIDAY-MONDAY week is eligible on its unchanged close', () => {
    const created = '2026-09-02T16:00:00.000Z'; // Wed before Labor Day
    const verdict = poolEligible(lobbyPod(created), at(created));
    expect(verdict.eligible).toBe(true);
    expect(verdict.weekKey).toBe('2026-W37');
    expect(verdict.closesAt).toBe('2026-09-07T03:59:59.000Z'); // Sun 09-06 23:59:59 ET
  });

  it('a DEV pod and a TRAINING pod are ineligible, each with its own reason', () => {
    const created = '2026-09-15T18:00:00.000Z';
    expect(poolEligible(lobbyPod(created, { isDev: true }), NOW))
      .toEqual({ eligible: false, reason: POOL_INELIGIBLE.DEV_POD });
    expect(poolEligible(lobbyPod(created, { isTraining: true }), NOW))
      .toEqual({ eligible: false, reason: POOL_INELIGIBLE.TRAINING_POD });
    // The omission idiom: `isDev: false` / absent is eligible (§6, D-DEVFIELD).
    expect(poolEligible(lobbyPod(created, { isDev: false, isTraining: false }), NOW).eligible).toBe(true);
  });

  it('a pod with NO DERIVABLE MONDAY is ineligible, never windowed on a guess', () => {
    expect(poolEligible({ status: 'forming' }, NOW))
      .toEqual({ eligible: false, reason: POOL_INELIGIBLE.NO_BATTLE_MONDAY });
    expect(poolEligible({ status: 'forming', createdAt: 'whenever' }, NOW))
      .toEqual({ eligible: false, reason: POOL_INELIGIBLE.NO_BATTLE_MONDAY });
  });

  it('only `forming` opens a pool — there is no `active` status (A-C3)', () => {
    const created = '2026-09-15T18:00:00.000Z';
    for (const status of ['drafting', 'awaiting_open', 'battle', 'complete', 'expired', 'voided', 'active', undefined]) {
      const verdict = poolEligible(lobbyPod(created, { status }), NOW);
      expect(verdict, String(status)).toEqual({ eligible: false, reason: POOL_INELIGIBLE.NOT_FORMING });
    }
  });

  it('refusal reasons are checked in a FIXED order — a dev training pod reads `dev_pod`', () => {
    // Determinism matters: PR 2 surfaces these strings, and a reason that
    // depended on clause evaluation order would be a §9 display drift.
    const pod = lobbyPod('2026-09-15T18:00:00.000Z', { isDev: true, isTraining: true, slotId: 'mon-0845' });
    expect(poolEligible(pod, NOW).reason).toBe(POOL_INELIGIBLE.DEV_POD);
    expect(poolEligible({ ...pod, isDev: false }, NOW).reason).toBe(POOL_INELIGIBLE.TRAINING_POD);
    expect(poolEligible({ ...pod, isDev: false, isTraining: false }, NOW).reason).toBe(POOL_INELIGIBLE.SLOT_EXCLUDED);
  });

  it('`reason` is null exactly when `eligible` is true', () => {
    const eligible = poolEligible(lobbyPod('2026-09-15T18:00:00.000Z'), NOW);
    expect(eligible.eligible).toBe(true);
    expect(eligible.reason).toBeNull();
    const refused = poolEligible(lobbyPod('2026-09-15T18:00:00.000Z', { isDev: true }), NOW);
    expect(refused.eligible).toBe(false);
    expect(typeof refused.reason).toBe('string');
  });
});

// ============================================================================
describe('currentBackingWeek — the week the wallet grants for (§2, D-h)', () => {
  it('mid-week names the week in progress', () => {
    expect(currentBackingWeek(at('2026-09-15T18:00:00.000Z'))).toEqual({
      weekKey: '2026-W39',
      startIso: '2026-09-14T04:00:00.000Z',
      closeIso: '2026-09-21T03:59:59.000Z',
    });
  });

  it('on a MONDAY it names the week that STARTS that Monday — both sides of 09:30 ET', () => {
    // The distinction that matters: deriveBattleStartWeek(Mon 08:00) names THAT
    // Monday, whose backing closed last night. The wallet must not grant for a
    // week that has already closed, so this function does not follow it.
    expect(deriveBattleStartWeek('2026-09-14T12:00:00.000Z').mondayEtDate).toBe('2026-09-14');
    for (const iso of ['2026-09-14T04:00:00.000Z', '2026-09-14T12:00:00.000Z', '2026-09-14T14:00:00.000Z']) {
      expect(currentBackingWeek(at(iso)), iso).toEqual({
        weekKey: '2026-W39',
        startIso: '2026-09-14T04:00:00.000Z',
        closeIso: '2026-09-21T03:59:59.000Z',
      });
    }
  });

  it('on the closing Sunday it still names the closing week, right up to the last second', () => {
    for (const iso of ['2026-09-20T23:00:00.000Z', '2026-09-21T03:59:59.000Z']) {
      expect(currentBackingWeek(at(iso)).weekKey, iso).toBe('2026-W39');
    }
  });

  it('one millisecond past the close it names the NEXT week', () => {
    expect(currentBackingWeek(at('2026-09-21T03:59:59.001Z'))).toEqual({
      weekKey: '2026-W40',
      startIso: '2026-09-21T04:00:00.000Z',
      closeIso: '2026-09-28T03:59:59.000Z',
    });
  });

  it('`now` always falls inside [startIso, closeIso] — the invariant the allowance rides on', () => {
    // Walk a full year at six-hour steps across both DST transitions. If the
    // week ever failed to contain `now`, a wallet could be granted twice in one
    // week or not at all in another.
    const step = 6 * 3_600 * 1_000;
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += step) {
      const now = new Date(t);
      const week = currentBackingWeek(now);
      expect(new Date(week.startIso).getTime(), now.toISOString()).toBeLessThanOrEqual(t);
      expect(new Date(week.closeIso).getTime(), now.toISOString()).toBeGreaterThanOrEqual(t);
    }
  });

  it('consecutive weeks tile without gap or overlap across both DST transitions', () => {
    const seen = [];
    const step = 6 * 3_600 * 1_000;
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += step) {
      const week = currentBackingWeek(new Date(t));
      if (seen.length === 0 || seen[seen.length - 1].weekKey !== week.weekKey) seen.push(week);
    }
    expect(seen.length).toBeGreaterThan(50);
    for (let i = 1; i < seen.length; i++) {
      // The next week starts exactly one millisecond after the previous closes:
      // 23:59:59.000 + 1ms is NOT midnight, so the tiling is asserted on the
      // module's own convention — closes at the last whole second, opens at the
      // next Monday midnight — rather than on an assumed continuity.
      const prevClose = new Date(seen[i - 1].closeIso).getTime();
      const nextStart = new Date(seen[i].startIso).getTime();
      expect(nextStart - prevClose, `${seen[i - 1].weekKey} → ${seen[i].weekKey}`).toBe(1_000);
      expect(seen[i].weekKey).not.toBe(seen[i - 1].weekKey);
    }
  });

  it('refuses an unreadable instant rather than guessing a week', () => {
    expect(currentBackingWeek(new Date('nope'))).toBeNull();
    expect(currentBackingWeek('not-a-date')).toBeNull();
    expect(currentBackingWeek(null)).toBeNull();
  });

  it('defaults to the real clock and returns a well-formed week', () => {
    const week = currentBackingWeek();
    expect(week.weekKey).toMatch(/^\d{4}-W\d{2}$/);
    expect(new Date(week.startIso).getTime()).toBeLessThan(new Date(week.closeIso).getTime());
  });
});
