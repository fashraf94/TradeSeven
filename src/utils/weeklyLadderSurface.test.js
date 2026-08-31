// src/utils/weeklyLadderSurface.test.js
//
// Weekly Ladder — the SURFACE contract (spec 20260831_WEEKLY_LADDER_BUILD_SPEC_V1
// §2/§3/§5, acceptance 2 and 5): the one ordering home, the §9 week
// decomposition, and the flag's dark default.
//
// The flag is NOT mocked here — this file asserts the real, shipping value (the
// flagPinGuard pin) and drives the ordering function through its explicit
// `placementEnabled` argument instead. That is what lets one file carry both the
// dark-default pin and the flag-on ordering rules without contradicting itself.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import of
// tournamentSurfaces.js is the runtime guard that it stays Node-clean (it is
// imported by both the browser bundle and the api/ graph). Never mock it.

import { describe, it, expect } from 'vitest';
import { rankLeaderboardEntries, decomposeEntryWeeks } from './tournamentSurfaces';
import { WEEKLY_LADDER_PLACEMENT_ENABLED } from '../config/featureFlags';
import { currentBaseLayerWeek, etDateString, isoWeekString } from '../constants/leagueTournament';

// ==================== THE DARK DEFAULT ====================

describe('WEEKLY_LADDER_PLACEMENT_ENABLED — dark by design', () => {
  // Pinned per BUILD_RULES §2 (flagPinGuard). When the founder flips this in the
  // one-line flip PR, THIS assertion and the DARK_BY_DESIGN entry in
  // src/config/flagPinGuard.test.js move in that same commit.
  it('ships FALSE — the ladder merges dark; the flip is its own PR', () => {
    expect(WEEKLY_LADDER_PLACEMENT_ENABLED).toBe(false);
  });
});

// ==================== §2/§3 — THE ONE ORDERING HOME ====================

const entry = (odUserId, { points = 0, placementPoints = 0, compositeMargin = 0, isCpu = false } = {}) =>
  ({ odUserId, points, placementPoints, compositeMargin, isCpu, weeks: {} });

describe('rankLeaderboardEntries — flag OFF (acceptance 7)', () => {
  it('sorts on cumulative COMPOSITE descending, exactly as the board does today', () => {
    const entries = {
      a: entry('a', { points: 10, placementPoints: 9 }),
      b: entry('b', { points: 50, placementPoints: 0 }),
      c: entry('c', { points: -5, placementPoints: 3 }),
    };
    // placement points are deliberately inverted against composite: flag-off
    // must ignore them entirely.
    expect(rankLeaderboardEntries(entries).map(e => e.odUserId)).toEqual(['b', 'a', 'c']);
  });

  it('is the default posture — an omitted option means OFF', () => {
    const entries = { a: entry('a', { points: 1, placementPoints: 0 }), b: entry('b', { points: 0, placementPoints: 99 }) };
    expect(rankLeaderboardEntries(entries)[0].odUserId).toBe('a');
  });
});

describe('rankLeaderboardEntries — flag ON (acceptance 2, founder decision D2)', () => {
  const on = { placementEnabled: true };

  it('sorts on cumulative PLACEMENT POINTS descending, not composite', () => {
    const entries = {
      a: entry('a', { points: 999, placementPoints: 1 }),
      b: entry('b', { points: 0, placementPoints: 7 }),
      c: entry('c', { points: 500, placementPoints: 4 }),
    };
    expect(rankLeaderboardEntries(entries, on).map(e => e.odUserId)).toEqual(['b', 'c', 'a']);
  });

  it('breaks a placement tie on cumulative composite MARGIN (spec §3)', () => {
    const entries = {
      lo: entry('lo', { placementPoints: 5, compositeMargin: 2 }),
      hi: entry('hi', { placementPoints: 5, compositeMargin: 40 }),
      mid: entry('mid', { placementPoints: 5, compositeMargin: -3 }),
    };
    expect(rankLeaderboardEntries(entries, on).map(e => e.odUserId)).toEqual(['hi', 'lo', 'mid']);
  });

  it('a NEGATIVE margin still outranks a more negative one (signed, never floored)', () => {
    const entries = {
      worse: entry('worse', { placementPoints: 3, compositeMargin: -50 }),
      better: entry('better', { placementPoints: 3, compositeMargin: -1 }),
    };
    expect(rankLeaderboardEntries(entries, on)[0].odUserId).toBe('better');
  });

  it('resolves a FULL tie on odUserId — total, stable, and rename-proof', () => {
    const tie = (id) => entry(id, { placementPoints: 4, compositeMargin: 10 });
    const entries = { zed: tie('zed'), alpha: tie('alpha'), mike: tie('mike') };
    expect(rankLeaderboardEntries(entries, on).map(e => e.odUserId)).toEqual(['alpha', 'mike', 'zed']);
  });

  it('the order does not depend on object insertion order (deterministic across reads)', () => {
    const rows = [
      entry('b', { placementPoints: 4, compositeMargin: 1 }),
      entry('a', { placementPoints: 4, compositeMargin: 1 }),
      entry('c', { placementPoints: 9 }),
    ];
    const fwd = Object.fromEntries(rows.map(r => [r.odUserId, r]));
    const rev = Object.fromEntries([...rows].reverse().map(r => [r.odUserId, r]));
    expect(rankLeaderboardEntries(fwd, on).map(e => e.odUserId))
      .toEqual(rankLeaderboardEntries(rev, on).map(e => e.odUserId));
  });

  it('a CPU ranks on the same keys and may sit FIRST — no eligibility exclusion (ruling §4)', () => {
    const entries = {
      'cpu-1': entry('cpu-1', { placementPoints: 9, isCpu: true }),
      human: entry('human', { placementPoints: 6 }),
    };
    const ranked = rankLeaderboardEntries(entries, on);
    expect(ranked[0].odUserId).toBe('cpu-1');
    expect(ranked[0].isCpu).toBe(true);
  });

  it('never mutates the caller’s entries object', () => {
    const entries = { a: entry('a', { placementPoints: 1 }), b: entry('b', { placementPoints: 2 }) };
    const before = JSON.stringify(entries);
    rankLeaderboardEntries(entries, on);
    expect(JSON.stringify(entries)).toBe(before);
  });

  it('tolerates absent fields (a pre-ladder doc read under the flag)', () => {
    const entries = { a: { odUserId: 'a' }, b: { odUserId: 'b', placementPoints: 1 } };
    expect(rankLeaderboardEntries(entries, on).map(e => e.odUserId)).toEqual(['b', 'a']);
    expect(rankLeaderboardEntries(undefined, on)).toEqual([]);
  });
});

// ==================== §9 — THE DECOMPOSITION ====================

describe('decomposeEntryWeeks — the §9 display-agreement rule (acceptance 5)', () => {
  const ENTRY = {
    odUserId: 'founder',
    placementPoints: 4,
    weeks: {
      g1: { baseLayerWeek: '2026-W25', placement: 1, placementPoints: 3, compositeMargin: 40, points: 60, final: true, updatedAt: '2026-06-19T21:00:00.000Z' },
      g2: { baseLayerWeek: '2026-W26', placement: 3, placementPoints: 1, compositeMargin: -15, points: 10, final: true, updatedAt: '2026-06-26T21:00:00.000Z' },
      g3: { baseLayerWeek: '2026-W27', placement: null, placementPoints: 0, compositeMargin: 0, points: 5, final: false, updatedAt: '2026-06-30T21:00:00.000Z' },
    },
  };

  it('the displayed total DECOMPOSES into the weeks that produced it', () => {
    const weeks = decomposeEntryWeeks(ENTRY);
    expect(weeks.reduce((s, w) => s + w.placementPoints, 0)).toBe(ENTRY.placementPoints);
  });

  it('reads the STORED per-week values — never a re-derivation that could drift', () => {
    const w = decomposeEntryWeeks(ENTRY).find(x => x.groupId === 'g1');
    expect(w).toMatchObject({ label: '2026-W25', placement: 1, placementPoints: 3, compositeMargin: 40, points: 60, final: true });
  });

  it('orders newest week first', () => {
    expect(decomposeEntryWeeks(ENTRY).map(w => w.groupId)).toEqual(['g3', 'g2', 'g1']);
  });

  it('marks an unfinished week as not final, contributing zero', () => {
    const w = decomposeEntryWeeks(ENTRY).find(x => x.groupId === 'g3');
    expect(w.final).toBe(false);
    expect(w.placementPoints).toBe(0);
    expect(w.placement).toBeNull();
  });

  it('labels a bracket week by its game id, and degrades to the group id', () => {
    const rows = decomposeEntryWeeks({ weeks: { gb: { bracketGameId: 'b-r1-g1' }, gx: {} } });
    expect(rows.find(r => r.groupId === 'gb').label).toBe('Bracket b-r1-g1');
    expect(rows.find(r => r.groupId === 'gx').label).toBe('gx');
  });

  it('an entry with no weeks decomposes to an empty list, not a throw', () => {
    expect(decomposeEntryWeeks({})).toEqual([]);
    expect(decomposeEntryWeeks(undefined)).toEqual([]);
  });
});

// ==================== THE WEEK BOUNDARY (D-WEEKBOUNDARY) ====================

describe('currentBaseLayerWeek — ET-anchored (the D-WEEKBOUNDARY fix)', () => {
  // The defect: isoWeekString(new Date()) is pure UTC, so the queried week
  // advanced when UTC crossed into Monday — 20:00 ET (EDT) / 19:00 ET (EST) on
  // SUNDAY, 4-5 hours before the ET week turns. THE FIELD then asked for a week
  // with no groups while dropping the week just played, and rendered empty.
  it('does NOT advance during the Sunday-evening window that broke THE FIELD (EDT)', () => {
    const sun1900 = new Date('2026-09-06T23:00:00Z'); // Sun 19:00 ET
    const sun2000 = new Date('2026-09-07T00:00:00Z'); // Sun 20:00 ET — UTC is now Monday
    const sun2300 = new Date('2026-09-07T03:00:00Z'); // Sun 23:00 ET
    expect(isoWeekString(sun2000)).toBe('2026-W37');  // the old, UTC reading — early
    expect(currentBaseLayerWeek(sun1900)).toBe('2026-W36');
    expect(currentBaseLayerWeek(sun2000)).toBe('2026-W36'); // still Sunday in ET
    expect(currentBaseLayerWeek(sun2300)).toBe('2026-W36');
  });

  it('does NOT advance during the Sunday-evening window (EST — the other offset)', () => {
    expect(isoWeekString(new Date('2026-01-05T00:00:00Z'))).toBe('2026-W02'); // old reading, early
    expect(currentBaseLayerWeek(new Date('2026-01-04T23:59:00Z'))).toBe('2026-W01'); // Sun 18:59 ET
    expect(currentBaseLayerWeek(new Date('2026-01-05T00:00:00Z'))).toBe('2026-W01'); // Sun 19:00 ET
    expect(currentBaseLayerWeek(new Date('2026-01-05T04:59:00Z'))).toBe('2026-W01'); // Sun 23:59 ET
  });

  it('advances exactly at ET midnight Monday, not before', () => {
    expect(currentBaseLayerWeek(new Date('2026-09-07T03:59:00Z'))).toBe('2026-W36'); // Sun 23:59 ET
    expect(currentBaseLayerWeek(new Date('2026-09-07T04:00:00Z'))).toBe('2026-W37'); // Mon 00:00 ET
  });

  it('agrees with the WRITE side for every hour of an ET week', () => {
    // The write side (liveDraftFormation.deriveBaseLayerWeek) labels the battle
    // week's ET Monday through the same isoWeekString. Read and write must not
    // disagree at ANY instant, or a group falls out of its own cohort.
    const writeSide = isoWeekString(new Date(Date.UTC(2026, 8, 7))); // ET Monday 2026-09-07
    const mondayEt0000 = new Date('2026-09-07T04:00:00Z');
    for (let h = 0; h < 24 * 7; h++) {
      const at = new Date(mondayEt0000.getTime() + h * 3600e3);
      expect(currentBaseLayerWeek(at)).toBe(writeSide);
    }
  });

  it('is pure — the caller supplies the instant, and the same instant always maps alike', () => {
    const at = new Date('2026-03-11T15:00:00Z');
    expect(currentBaseLayerWeek(at)).toBe(currentBaseLayerWeek(at));
  });

  it('etDateString reports the ET calendar date across the UTC-midnight seam', () => {
    expect(etDateString(new Date('2026-09-07T03:00:00Z'))).toBe('2026-09-06'); // still Sunday in ET
    expect(etDateString(new Date('2026-09-07T04:00:00Z'))).toBe('2026-09-07');
  });
});
