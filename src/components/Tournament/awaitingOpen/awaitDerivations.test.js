// src/components/Tournament/awaitingOpen/awaitDerivations.test.js
//
// Pure-logic tests for the Awaiting-the-Open redesign's derivations. No React,
// no Firestore. These cover the two claims the redesigned board and hero rest
// on: that the seat-major lanes agree with the classic round-major grid (they
// derive from the same buildDraftGrid — BUILD_RULES §9), and that the countdown
// segments/run-day come from the one countdown value the numerals show.

import { describe, it, expect } from 'vitest';
import {
  buildSeatLanes, sectorSpread, buildDraftGrid, buildMyPicks,
  buildFreeAgentUniverse, buildFreeAgentBoard, sectorFacets, filterFreeAgents,
} from './podBoard';
import { waitSegments, runStartDay, wireWindowLine, etWeekday, runDays } from './awaitTokens';
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
    // A pair of ET-midnight-boundary instants: each discriminates one direction,
    // which a midday instant cannot (midday is the same weekday in every zone,
    // so a fixed -4 or -5 offset would pass it).
    // Real ET (EDT, -4) = Mon 00:30. A hand-rolled fixed -5 would say SUN.
    expect(runStartDay('2026-08-24T04:30:00Z')).toBe('MON');
    // Real ET (EST, -5) = Sun 23:30. A hand-rolled fixed -4 — or UTC — says MON.
    expect(runStartDay('2026-01-05T04:30:00Z')).toBe('SUN');
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
    // Exact text, not a regex: `.*` let a transposed duration through.
    expect(line.text).toBe('Open — claims lock in 16h 54m (9:24 AM ET).');
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

// etWeekday is the input to wireWindowLine's Friday branch. Every instant the
// Friday tests use is one where UTC and ET agree on the weekday (ET Friday
// daytime never crosses the UTC date line), so dropping the timeZone from
// etWeekday passes them all. This row is the direct guard: an instant where
// UTC and ET disagree.
describe('etWeekday', () => {
  it('resolves the ET weekday, not the UTC one', () => {
    // 2026-08-22T02:00:00Z is Saturday in UTC but Friday 22:00 in ET.
    expect(etWeekday(new Date('2026-08-22T02:00:00Z'))).toBe('Fri');
  });

  it('resolves a plain midweek instant', () => {
    expect(etWeekday(new Date('2026-08-19T18:00:00Z'))).toBe('Wed');
  });
});

describe('runDays', () => {
  it('starts the run on the day the battle actually begins', () => {
    expect(runDays('WED')).toEqual(['WED', 'THU', 'FRI', 'MON', 'TUE']);
  });

  it('is the plain week when the run starts Monday', () => {
    expect(runDays('MON')).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  });

  it('wraps the weekend — a Friday start runs into the next week', () => {
    expect(runDays('FRI')).toEqual(['FRI', 'MON', 'TUE', 'WED', 'THU']);
  });

  it('always names five trading days, each exactly once', () => {
    for (const d of ['MON', 'TUE', 'WED', 'THU', 'FRI']) {
      const days = runDays(d);
      expect(days).toHaveLength(5);
      expect(new Set(days).size).toBe(5);
      expect(days[0]).toBe(d);
    }
  });

  it('falls back to the plain week for an unknown or weekend start', () => {
    expect(runDays(null)).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI']);
    expect(runDays('SUN')).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  });
});

describe('buildMyPicks', () => {
  const sectors = new Map([['NEM', 'Materials'], ['MSFT', 'Technology']]);

  it('builds the drop options with round labels and sectors', () => {
    expect(buildMyPicks({ player: { picks: [{ symbol: 'NEM' }, { symbol: 'MSFT' }] }, sectorMap: sectors }))
      .toEqual([
        { symbol: 'NEM', sector: 'Materials', round: 'R1' },
        { symbol: 'MSFT', sector: 'Technology', round: 'R2' },
      ]);
  });

  it('NORMALISES like the draftboard — trims as well as uppercases', () => {
    // The board keys sectorMap through norm() (trim + uppercase). An inline
    // String(x).toUpperCase() would yield ' NEM' here and miss the sector,
    // colouring the same ticker differently in the sheet than on the board.
    const [pick] = buildMyPicks({ player: { picks: [' nem '] }, sectorMap: sectors });
    expect(pick.symbol).toBe('NEM');
    expect(pick.sector).toBe('Materials');
  });

  it('accepts bare-string picks as well as pick objects', () => {
    expect(buildMyPicks({ player: { picks: ['nem'] }, sectorMap: sectors })[0].symbol).toBe('NEM');
  });

  it('degrades an unmapped sector to Other rather than dropping the pick', () => {
    expect(buildMyPicks({ player: { picks: ['ZZZ'] }, sectorMap: sectors }))
      .toEqual([{ symbol: 'ZZZ', sector: 'Other', round: 'R1' }]);
  });

  it('is empty for a missing player and skips empty slots', () => {
    expect(buildMyPicks({})).toEqual([]);
    expect(buildMyPicks({ player: null })).toEqual([]);
    expect(buildMyPicks({ player: { picks: [null, { symbol: '' }] } })).toEqual([]);
  });
});

// ── §7.0 free-agent browser ─────────────────────────────────────────────────
// The capability these guard: the wire is capped at twelve, so the browser is
// the only way to reach a name ranked #40. If the browser ever re-sorted, or
// silently dropped/kept the wrong names, that reach would be wrong in a way no
// other test would notice.
describe('buildFreeAgentUniverse / buildFreeAgentBoard', () => {
  const bigUniverse = Array.from({ length: 40 }, (_, i) => ({
    symbol: `S${String(i).padStart(2, '0')}`,
    sectorName: i % 2 ? 'Energy' : 'Technology',
    industryName: i % 2 ? 'Oil & Gas' : 'Semiconductors',
    arch_scores: { analyst: 100 - i },
    compositeScore: 100 - i,
    momentumRank: i + 1,
    return1W: 1,
    atrPercentile: 0.5,
  }));
  const pool = bigUniverse.map((s) => s.symbol);
  const args = { poolSymbols: pool, universe: bigUniverse, archKey: 'analyst' };

  it('returns EVERY claimable name, not just the wire slice', () => {
    expect(buildFreeAgentUniverse(args)).toHaveLength(40);
  });

  it('THE WIRE IS THE FIRST TWELVE OF IT — one fit metric, not two', () => {
    const full = buildFreeAgentUniverse(args);
    const wire = buildFreeAgentBoard({ ...args, topN: 12 });
    expect(wire).toHaveLength(12);
    expect(wire.map((r) => r.symbol)).toEqual(full.slice(0, 12).map((r) => r.symbol));
    // and the same numbers, not merely the same names
    expect(wire.map((r) => r.fit)).toEqual(full.slice(0, 12).map((r) => r.fit));
    expect(wire.map((r) => r.reason)).toEqual(full.slice(0, 12).map((r) => r.reason));
  });

  it('is fit-descending and stamps a 1-based boardRank', () => {
    const full = buildFreeAgentUniverse(args);
    for (let i = 1; i < full.length; i += 1) expect(full[i - 1].fit).toBeGreaterThanOrEqual(full[i].fit);
    expect(full.map((r) => r.boardRank)).toEqual(full.map((_, i) => i + 1));
  });

  it('reaches a name well outside the wire — the regression this restores', () => {
    const full = buildFreeAgentUniverse(args);
    const deep = full[30];
    expect(deep.boardRank).toBe(31);
    expect(buildFreeAgentBoard({ ...args, topN: 12 }).some((r) => r.symbol === deep.symbol)).toBe(false);
    expect(filterFreeAgents({ board: full, query: deep.symbol })).toHaveLength(1);
  });

  it('is empty for an empty pool and never throws', () => {
    expect(buildFreeAgentUniverse({})).toEqual([]);
    expect(buildFreeAgentUniverse({ poolSymbols: null, universe: null })).toEqual([]);
  });
});

describe('sectorFacets', () => {
  const board = [
    { symbol: 'A', sectorName: 'Energy' }, { symbol: 'B', sectorName: 'Technology' },
    { symbol: 'C', sectorName: 'Energy' }, { symbol: 'D', sectorName: 'Energy' },
    { symbol: 'E', sectorName: 'Technology' },
  ];

  it('counts the names available in each sector, densest first', () => {
    expect(sectorFacets(board)).toEqual([
      { sector: 'Energy', n: 3 }, { sector: 'Technology', n: 2 },
    ]);
  });

  it('breaks ties alphabetically so the chip order is stable', () => {
    const a = sectorFacets([{ sectorName: 'Utilities' }, { sectorName: 'Energy' }]);
    const b = sectorFacets([{ sectorName: 'Energy' }, { sectorName: 'Utilities' }]);
    expect(a).toEqual(b);
    expect(a[0].sector).toBe('Energy');
  });

  it('buckets a missing sector as Other rather than dropping the name', () => {
    expect(sectorFacets([{ symbol: 'X' }])).toEqual([{ sector: 'Other', n: 1 }]);
  });

  it('is empty for an empty board', () => {
    expect(sectorFacets([])).toEqual([]);
    expect(sectorFacets(null)).toEqual([]);
  });
});

describe('filterFreeAgents', () => {
  const board = [
    { symbol: 'NVDA', sectorName: 'Technology', industryName: 'Semiconductors', fit: 90, boardRank: 1 },
    { symbol: 'DVN', sectorName: 'Energy', industryName: 'Oil & Gas', fit: 70, boardRank: 2 },
    { symbol: 'AMD', sectorName: 'Technology', industryName: 'Semiconductors', fit: 60, boardRank: 3 },
    { symbol: 'COP', sectorName: 'Energy', industryName: 'Oil & Gas', fit: 50, boardRank: 4 },
  ];

  it('returns everything when unfiltered', () => {
    expect(filterFreeAgents({ board })).toHaveLength(4);
  });

  it('matches on ticker, case-insensitively and as a prefix or substring', () => {
    expect(filterFreeAgents({ board, query: 'nv' }).map((r) => r.symbol)).toEqual(['NVDA']);
    expect(filterFreeAgents({ board, query: 'MD' }).map((r) => r.symbol)).toEqual(['AMD']);
  });

  it('matches on sector and industry text — the searchable fields that DO exist', () => {
    expect(filterFreeAgents({ board, query: 'energy' }).map((r) => r.symbol)).toEqual(['DVN', 'COP']);
    expect(filterFreeAgents({ board, query: 'semiconduct' }).map((r) => r.symbol)).toEqual(['NVDA', 'AMD']);
  });

  it('BROWSES a whole sector with no query — the discovery path', () => {
    expect(filterFreeAgents({ board, sector: 'Energy' }).map((r) => r.symbol)).toEqual(['DVN', 'COP']);
  });

  it('combines sector filter and query', () => {
    expect(filterFreeAgents({ board, sector: 'Technology', query: 'a' }).map((r) => r.symbol)).toEqual(['NVDA', 'AMD']);
    expect(filterFreeAgents({ board, sector: 'Energy', query: 'nvda' })).toEqual([]);
  });

  it('NEVER re-sorts — results stay in the board fit order in search AND browse', () => {
    for (const opts of [{}, { query: 'a' }, { sector: 'Technology' }, { query: 'o' }]) {
      const out = filterFreeAgents({ board, ...opts });
      expect(out.map((r) => r.boardRank)).toEqual([...out.map((r) => r.boardRank)].sort((a, b) => a - b));
      for (let i = 1; i < out.length; i += 1) expect(out[i - 1].fit).toBeGreaterThanOrEqual(out[i].fit);
    }
  });

  it('excludes names that are not claimable right now', () => {
    const out = filterFreeAgents({ board, excludeSymbols: new Set(['NVDA', 'COP']) });
    expect(out.map((r) => r.symbol)).toEqual(['DVN', 'AMD']);
  });

  it('applies exclusions even when a query would otherwise match', () => {
    expect(filterFreeAgents({ board, query: 'nvda', excludeSymbols: new Set(['NVDA']) })).toEqual([]);
  });

  it('trims a padded query rather than matching nothing', () => {
    expect(filterFreeAgents({ board, query: '  dvn  ' }).map((r) => r.symbol)).toEqual(['DVN']);
  });

  it('degrades safely on missing input', () => {
    expect(filterFreeAgents({})).toEqual([]);
    expect(filterFreeAgents({ board: null, query: 'x' })).toEqual([]);
    expect(filterFreeAgents({ board: [null, undefined] })).toEqual([]);
  });
});
