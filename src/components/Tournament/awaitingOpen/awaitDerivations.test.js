// src/components/Tournament/awaitingOpen/awaitDerivations.test.js
//
// Pure-logic tests for the Awaiting-the-Open redesign's derivations. No React,
// no Firestore. These cover the two claims the redesigned board and hero rest
// on: that the seat-major lanes agree with the classic round-major grid (they
// derive from the same buildDraftGrid — BUILD_RULES §9), and that the countdown
// segments/run-day come from the one countdown value the numerals show.

import { describe, it, expect } from 'vitest';
import { buildSeatLanes, sectorSpread, buildDraftGrid } from './podBoard';
import { waitSegments, runStartDay, wireWindowLine, etWeekday } from './awaitTokens';
import { getClaimWindowDisplay } from '../../../utils/tournamentSurfaces';

const MEMBERS = ['u1', 'cpu-a', 'cpu-b', 'cpu-c'];
const SECTORS = new Map([
  ['NEM', 'Materials'], ['MSFT', 'Technology'], ['NVDA', 'Technology'],
  ['CB', 'Financials'], ['GS', 'Financials'], ['ZS', 'Technology'],
]);
const EVENTS = [
  { odUserId: 'u1', symbol: 'NEM', round: 1 },
  { odUserId: 'u1', symbol: 'MSFT', round: 2 },
  { odUserId: 'u1', symbol: 'NVDA', round: 3 },
  { odUserId: 'cpu-a', symbol: 'CB', round: 1 },
  { odUserId: 'cpu-a', symbol: 'GS', round: 2 },
  { odUserId: 'cpu-a', symbol: 'ZS', round: 3 },
];

describe('buildSeatLanes', () => {
  it('returns one lane per seat, in group order, flagging only the caller', () => {
    const lanes = buildSeatLanes({ events: EVENTS, groupMembers: MEMBERS, uid: 'u1', sectorMap: SECTORS });
    expect(lanes.map((l) => l.odUserId)).toEqual(MEMBERS);
    expect(lanes.filter((l) => l.you)).toHaveLength(1);
    expect(lanes[0].you).toBe(true);
  });

  it('labels seats with the existing convention (You / CPU {seatIdx})', () => {
    const lanes = buildSeatLanes({ events: EVENTS, groupMembers: MEMBERS, uid: 'u1', sectorMap: SECTORS });
    expect(lanes.map((l) => l.seat)).toEqual(['You', 'CPU 1', 'CPU 2', 'CPU 3']);
  });

  it('reads down a seat column in round order, with sectors joined', () => {
    const lanes = buildSeatLanes({ events: EVENTS, groupMembers: MEMBERS, uid: 'u1', sectorMap: SECTORS });
    expect(lanes[0].picks.map((p) => p && p.symbol)).toEqual(['NEM', 'MSFT', 'NVDA']);
    expect(lanes[0].picks.map((p) => p && p.round)).toEqual(['R1', 'R2', 'R3']);
    expect(lanes[0].picks[0].sector).toBe('Materials');
  });

  it('AGREES with the classic round-major grid — same symbol at every (round, seat)', () => {
    const grid = buildDraftGrid({ events: EVENTS, groupMembers: MEMBERS, picksPerPlayer: 3 });
    const lanes = buildSeatLanes({ events: EVENTS, groupMembers: MEMBERS, uid: 'u1', sectorMap: SECTORS });
    for (let r = 0; r < 3; r += 1) {
      for (let s = 0; s < MEMBERS.length; s += 1) {
        const fromGrid = grid[r][s] ? grid[r][s].symbol : null;
        const fromLane = lanes[s].picks[r] ? lanes[s].picks[r].symbol : null;
        expect(fromLane).toBe(fromGrid);
      }
    }
  });

  it('renders an undrafted slot as null rather than fabricating a pick', () => {
    const lanes = buildSeatLanes({ events: EVENTS, groupMembers: MEMBERS, uid: 'u1', sectorMap: SECTORS });
    expect(lanes[1].picks.every((p) => p !== null)).toBe(true);   // cpu-a drafted all three
    expect(lanes[2].picks).toEqual([null, null, null]);           // cpu-b drafted none
  });

  it('degrades a symbol with no sector entry to Other, never dropping it', () => {
    const lanes = buildSeatLanes({
      events: [{ odUserId: 'u1', symbol: 'ZZZ', round: 1 }],
      groupMembers: MEMBERS, uid: 'u1', sectorMap: SECTORS,
    });
    expect(lanes[0].picks[0]).toMatchObject({ symbol: 'ZZZ', sector: 'Other' });
  });

  it('is empty for an empty group and never throws on missing input', () => {
    expect(buildSeatLanes({})).toEqual([]);
    expect(buildSeatLanes({ groupMembers: [], events: null })).toEqual([]);
  });
});

describe('sectorSpread', () => {
  it('counts by sector, densest first', () => {
    expect(sectorSpread([
      { sector: 'Technology' }, { sector: 'Materials' }, { sector: 'Technology' },
    ])).toEqual([{ sector: 'Technology', n: 2 }, { sector: 'Materials', n: 1 }]);
  });

  it('breaks ties alphabetically so the order is stable across renders', () => {
    const a = sectorSpread([{ sector: 'Energy' }, { sector: 'Anything' }]);
    const b = sectorSpread([{ sector: 'Anything' }, { sector: 'Energy' }]);
    expect(a).toEqual(b);
    expect(a[0].sector).toBe('Anything');
  });

  it('ignores undrafted slots and bad input', () => {
    expect(sectorSpread([null, { sector: 'Energy' }, { symbol: 'X' }])).toEqual([{ sector: 'Energy', n: 1 }]);
    expect(sectorSpread(null)).toEqual([]);
  });
});

describe('waitSegments', () => {
  it('shows MIN:SEC under an hour', () => {
    expect(waitSegments(292)).toEqual([[4, 'MIN'], [52, 'SEC']]);
  });

  it('shows HRS:MIN:SEC under a day', () => {
    expect(waitSegments(3661)).toEqual([[1, 'HRS'], [1, 'MIN'], [1, 'SEC']]);
  });

  it('stays on HRS:MIN:SEC just under a day (20h32m — a same-week overnight wait)', () => {
    expect(waitSegments(73920)).toEqual([[20, 'HRS'], [32, 'MIN'], [0, 'SEC']]);
  });

  it('adds a DAYS segment past a day — the weekend/holiday case', () => {
    expect(waitSegments(90000)).toEqual([[1, 'DAY'], [1, 'HRS'], [0, 'MIN'], [0, 'SEC']]);
    expect(waitSegments(228600)).toEqual([[2, 'DAYS'], [15, 'HRS'], [30, 'MIN'], [0, 'SEC']]);
  });

  it('singularises the one-day label', () => {
    expect(waitSegments(90000)[0][1]).toBe('DAY');
    expect(waitSegments(180000)[0][1]).toBe('DAYS');
  });

  it('is total-preserving — segments reconstruct the seconds they came from', () => {
    for (const total of [0, 59, 3599, 3600, 86399, 86400, 200000]) {
      const segs = waitSegments(total);
      const by = Object.fromEntries(segs.map(([v, l]) => [l.replace(/^DAYS?$/, 'D'), v]));
      const rebuilt = (by.D || 0) * 86400 + (by.HRS || 0) * 3600 + (by.MIN || 0) * 60 + (by.SEC || 0);
      // Under an hour the HRS segment is dropped, so only the shown units rebuild.
      const shown = total >= 3600 ? total : total % 3600;
      expect(rebuilt).toBe(shown);
    }
  });
});

describe('runStartDay', () => {
  it('names the ET weekday the run begins on', () => {
    // 2026-08-24T13:30:00Z === Monday 09:30 America/New_York (EDT, UTC-4).
    expect(runStartDay('2026-08-24T13:30:00Z')).toBe('MON');
  });

  it('uses America/New_York, not UTC — a late-UTC instant is still the ET day before', () => {
    // 2026-08-25T01:00:00Z is Tuesday in UTC but Monday 21:00 in ET.
    expect(runStartDay('2026-08-25T01:00:00Z')).toBe('MON');
  });

  it('honours the DST offset rather than a hand-rolled one', () => {
    // 2026-01-05T14:30:00Z === Monday 09:30 ET in EST (UTC-5).
    expect(runStartDay('2026-01-05T14:30:00Z')).toBe('MON');
  });

  it('returns null for a missing or malformed anchor rather than guessing', () => {
    expect(runStartDay(null)).toBeNull();
    expect(runStartDay('')).toBeNull();
    expect(runStartDay('not-a-date')).toBeNull();
  });
});

// The locked-wire copy (build spec §6.1). These run against the REAL
// getClaimWindowDisplay so the line can never drift from the window state it
// describes — the founder ruled the shared helper must not be widened, so the
// one nuance it cannot express (Friday) is handled in wireWindowLine and is
// pinned here.
describe('wireWindowLine', () => {
  // 2026-08-21 is a Friday; 2026-08-22 a Saturday; 2026-08-19 a Wednesday.
  const at = (iso) => {
    const now = new Date(iso);
    return { now, line: wireWindowLine(getClaimWindowDisplay(now), now) };
  };

  it('counts down honestly on a mid-week afternoon', () => {
    const { now, line } = at('2026-08-19T18:00:00Z'); // Wed 14:00 ET
    expect(etWeekday(now)).toBe('Wed');
    expect(line.isOpen).toBe(false);
    expect(line.text).toBe('Closed — the wire opens in 2h 0m (4:00 PM ET).');
  });

  it('reports OPEN with the lock-in countdown after 4:00 PM ET on a weekday', () => {
    const { line } = at('2026-08-19T20:30:00Z'); // Wed 16:30 ET
    expect(line.isOpen).toBe(true);
    expect(line.text).toMatch(/^Open — claims lock in .* \(9:24 AM ET\)\.$/);
  });

  it('NEVER shows a countdown on a Friday afternoon — the wire does not open at 4pm Friday', () => {
    const { now, line } = at('2026-08-21T18:00:00Z'); // Fri 14:00 ET
    expect(etWeekday(now)).toBe('Fri');
    // The raw window still reports market_hours with a countdown to today 16:00…
    expect(getClaimWindowDisplay(now).countdownMinutes).toBe(120);
    // …but Friday 16:00 is friday_evening (closed until Monday), so a countdown
    // would be a lie. The line states the real reopen instead.
    expect(line.text).not.toMatch(/opens in/);
    expect(line.text).toBe('Closed — the wire reopens Monday at 4:00 PM ET.');
    expect(line.isOpen).toBe(false);
  });

  it('states the Monday reopen on a Friday evening', () => {
    const { line } = at('2026-08-21T21:00:00Z'); // Fri 17:00 ET
    expect(line.text).toBe('Closed — the wire reopens Monday at 4:00 PM ET.');
    expect(line.isOpen).toBe(false);
  });

  it('states the Monday open across the weekend', () => {
    const { line } = at('2026-08-22T18:00:00Z'); // Sat 14:00 ET
    expect(line.text).toBe('Closed for the weekend — the wire opens Monday at 4:00 PM ET.');
    expect(line.isOpen).toBe(false);
  });

  it('agrees with the window mirror it describes — isOpen is never invented', () => {
    for (const iso of [
      '2026-08-19T18:00:00Z', '2026-08-19T20:30:00Z', '2026-08-21T18:00:00Z',
      '2026-08-21T21:00:00Z', '2026-08-22T18:00:00Z', '2026-08-20T12:00:00Z',
    ]) {
      const now = new Date(iso);
      const win = getClaimWindowDisplay(now);
      expect(wireWindowLine(win, now).isOpen).toBe(win.isOpen);
    }
  });

  it('never emits a countdown without a finite countdownMinutes', () => {
    const now = new Date('2026-08-22T18:00:00Z');
    const line = wireWindowLine({ isOpen: false, reason: 'market_hours', countdownMinutes: null }, now);
    expect(line.text).not.toMatch(/in\s+\d/);
  });

  it('degrades safely on a missing window', () => {
    expect(wireWindowLine(null)).toEqual({ text: '', isOpen: false });
  });
});
