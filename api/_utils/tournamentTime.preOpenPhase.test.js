// api/_utils/tournamentTime.preOpenPhase.test.js
//
// PRE-OPEN PHASE predicate battery (spec V2 §2 comparison table). Injectable-`now`
// DST matrix in the house style: every case is asserted in BOTH regimes at the
// 09:30 boundary, because the whole point of the tuple compare is that it is
// DST-immune (getEtParts/Intl, never a UTC offset assumption).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the import of the REAL
// tournamentTime module below is the runtime guard for its transitive graph —
// marketSchedule.js AND the api/ -> src/ import of src/constants/
// leagueTournament.js (a zero-import constants module). It explodes in this Node
// test environment if a browser-only dependency ever enters that graph. Never
// mock this import.

import { describe, it, expect } from 'vitest';
import { isPreOpenOnBattleDay } from './tournamentTime.js';
import { GROUP_STATUS } from '../../src/constants/leagueTournament.js';

// ── instants, all verified against getEtParts ────────────────────────────────
// EDT (summer, UTC-4) — Thu 2026-08-27
const EDT_DAY = '2026-08-27';
const EDT_0030 = new Date('2026-08-27T04:30:00.000Z'); // ET 00:30
const EDT_0800 = new Date('2026-08-27T12:00:00.000Z'); // ET 08:00
const EDT_0929 = new Date('2026-08-27T13:29:00.000Z'); // ET 09:29
const EDT_0930 = new Date('2026-08-27T13:30:00.000Z'); // ET 09:30  ← boundary
const EDT_1400 = new Date('2026-08-27T18:00:00.000Z'); // ET 14:00
// EST (winter, UTC-5) — Wed 2026-01-21
const EST_DAY = '2026-01-21';
const EST_0929 = new Date('2026-01-21T14:29:00.000Z'); // ET 09:29
const EST_0930 = new Date('2026-01-21T14:30:00.000Z'); // ET 09:30  ← boundary
// Ranked Monday anchors
const EDT_MON = '2026-08-31';
const EDT_MON_0700 = new Date('2026-08-31T11:00:00.000Z'); // ET Mon 07:00
const EDT_MON_0850 = new Date('2026-08-31T12:50:00.000Z'); // ET Mon 08:50
const EST_MON = '2026-12-07';
const EST_MON_0700 = new Date('2026-12-07T12:00:00.000Z'); // ET Mon 07:00
const EST_MON_0930 = new Date('2026-12-07T14:30:00.000Z'); // ET Mon 09:30

const battlePod = (anchorEtDate) => ({ status: GROUP_STATUS.BATTLE, startAnchor: { anchorEtDate } });

describe('isPreOpenOnBattleDay — spec V2 §2 comparison table', () => {
  it('BATTLE, anchor TODAY, 00:30 ET → pre-open (the headline repro)', () => {
    // Drafted just after ET midnight: the founder reads this as "last night, battle
    // tomorrow", the code reads today's anchor, and it lands straight in BATTLE.
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0030)).toBe(true);
  });

  it('BATTLE, anchor TODAY, 08:00 ET → pre-open', () => {
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0800)).toBe(true);
  });

  it('BATTLE, anchor TODAY, 09:29 ET → pre-open (last minute before the bell)', () => {
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0929)).toBe(true);
  });

  it('BATTLE, anchor TODAY, 09:30 ET → LIVE (the boundary is inclusive of the open)', () => {
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0930)).toBe(false);
  });

  it('BATTLE, anchor TODAY, 14:00 ET → live', () => {
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_1400)).toBe(false);
  });

  it('BATTLE, anchor in the PAST (stale / late fire) → live, never stranded', () => {
    // The late-fire safety row: a pod whose battle day has been and gone must read
    // live even at 00:30, or a missed flip would strand it on the awaiting surface.
    expect(isPreOpenOnBattleDay(battlePod('2026-08-24'), EDT_0030)).toBe(false);
    expect(isPreOpenOnBattleDay(battlePod('2026-08-24'), EDT_1400)).toBe(false);
  });

  it('AWAITING_OPEN with a FUTURE anchor → false (routes on its own status, unchanged)', () => {
    const pod = { status: GROUP_STATUS.AWAITING_OPEN, startAnchor: { anchorEtDate: '2026-08-28' } };
    expect(isPreOpenOnBattleDay(pod, EDT_1400)).toBe(false);
  });

  it('BATTLE with a FUTURE anchor → false (defensive; the flip should never write this)', () => {
    expect(isPreOpenOnBattleDay(battlePod('2026-08-28'), EDT_1400)).toBe(false);
  });
});

describe('isPreOpenOnBattleDay — ranked (the Mon 08:45 slot writes BATTLE ~40min pre-open)', () => {
  it('ranked Monday anchor at Mon 07:00 ET → pre-open (closes the Monday sweep leak)', () => {
    expect(isPreOpenOnBattleDay(battlePod(EDT_MON), EDT_MON_0700)).toBe(true);
  });

  it('ranked slot pod at Mon 08:50 ET, inline BATTLE → pre-open (closes the inline leak)', () => {
    // liveDraftLifecycle.test.js pins DRAFTING → BATTLE straight through at 08:47 ET
    // on a today anchor; this is that pod, three minutes later.
    expect(isPreOpenOnBattleDay(battlePod(EDT_MON), EDT_MON_0850)).toBe(true);
  });

  it('ranked Monday anchor at Mon 09:30 ET → live', () => {
    expect(isPreOpenOnBattleDay(battlePod(EST_MON), EST_MON_0930)).toBe(false);
  });

  it('ranked Monday anchor at Mon 07:00 ET in WINTER → pre-open', () => {
    expect(isPreOpenOnBattleDay(battlePod(EST_MON), EST_MON_0700)).toBe(true);
  });
});

describe('isPreOpenOnBattleDay — DST immunity at the 09:30 boundary', () => {
  it('EDT (UTC-4): 09:29 pre-open, 09:30 live', () => {
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0929)).toBe(true);
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0930)).toBe(false);
  });

  it('EST (UTC-5): 09:29 pre-open, 09:30 live — the SAME ET wall-clock, one hour later in UTC', () => {
    expect(isPreOpenOnBattleDay(battlePod(EST_DAY), EST_0929)).toBe(true);
    expect(isPreOpenOnBattleDay(battlePod(EST_DAY), EST_0930)).toBe(false);
  });

  it('the two regimes flip at the same ET minute but a DIFFERENT UTC hour (13:30 vs 14:30)', () => {
    // Anti-regression for a hand-rolled offset: if anyone replaces getEtParts with
    // a fixed UTC-4/UTC-5 assumption, exactly one of these two rows breaks.
    expect(EDT_0930.getUTCHours()).toBe(13);
    expect(EST_0930.getUTCHours()).toBe(14);
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0930)).toBe(false);
    expect(isPreOpenOnBattleDay(battlePod(EST_DAY), EST_0930)).toBe(false);
  });
});

describe('isPreOpenOnBattleDay — non-BATTLE and malformed input fail SAFE (false = today’s routing)', () => {
  it.each([
    ['forming', GROUP_STATUS.FORMING],
    ['drafting', GROUP_STATUS.DRAFTING],
    ['awaiting_open', GROUP_STATUS.AWAITING_OPEN],
    ['complete', GROUP_STATUS.COMPLETE],
    ['expired', GROUP_STATUS.EXPIRED],
  ])('status %s with a today anchor → false (BATTLE-only derivation)', (_label, status) => {
    expect(isPreOpenOnBattleDay({ status, startAnchor: { anchorEtDate: EDT_DAY } }, EDT_0800)).toBe(false);
  });

  it.each([
    ['null group', null],
    ['undefined group', undefined],
    ['no startAnchor', { status: GROUP_STATUS.BATTLE }],
    ['null startAnchor', { status: GROUP_STATUS.BATTLE, startAnchor: null }],
    ['no anchorEtDate', { status: GROUP_STATUS.BATTLE, startAnchor: {} }],
    ['empty anchorEtDate', { status: GROUP_STATUS.BATTLE, startAnchor: { anchorEtDate: '' } }],
    ['non-string anchorEtDate', { status: GROUP_STATUS.BATTLE, startAnchor: { anchorEtDate: 20260827 } }],
  ])('%s → false', (_label, group) => {
    expect(isPreOpenOnBattleDay(group, EDT_0800)).toBe(false);
  });

  it('defaults `now` to the real clock without throwing', () => {
    expect(typeof isPreOpenOnBattleDay(battlePod(EDT_DAY))).toBe('boolean');
  });
});

describe('isPreOpenOnBattleDay — anti-vacuous (BUILD_RULES §2: a row that cannot fail is not a guard)', () => {
  it('genuinely discriminates on the minute, not just the date', () => {
    // If the implementation dropped the `minutes < MARKET_OPEN_MIN` term and
    // compared dates only, EVERY same-date row would return true and this fails.
    const pod = battlePod(EDT_DAY);
    expect(isPreOpenOnBattleDay(pod, EDT_0929)).toBe(true);
    expect(isPreOpenOnBattleDay(pod, EDT_0930)).toBe(false);
  });

  it('genuinely discriminates on the date, not just the minute', () => {
    // If the implementation dropped the date term, a 00:30 read on a STALE anchor
    // would return true and strand the pod on the awaiting surface.
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0030)).toBe(true);
    expect(isPreOpenOnBattleDay(battlePod('2026-08-24'), EDT_0030)).toBe(false);
  });

  it('genuinely discriminates on status', () => {
    expect(isPreOpenOnBattleDay(battlePod(EDT_DAY), EDT_0800)).toBe(true);
    expect(isPreOpenOnBattleDay({ status: GROUP_STATUS.AWAITING_OPEN, startAnchor: { anchorEtDate: EDT_DAY } }, EDT_0800)).toBe(false);
  });
});
