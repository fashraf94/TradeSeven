// src/components/League/battleArena/buildArenaModel.test.js
//
// The real-data bridge. The import of buildArenaModel (→ leagueAdapter,
// leagueClimbAdapter, leagueStarMeter→calculateAssetScoreV3, leagueBeats,
// tournamentSurfaces, leagueTournament) loading clean in Node IS the
// dependency-surface guard (BUILD_RULES §4 — never mocked): it proves the whole
// bridge graph stays node-clean and the scorer is reached, not copied.

import { describe, it, expect, vi } from 'vitest';
import { buildArenaModel, liveDayIdx, buildAskChips } from './buildArenaModel';
import { BASELINE_POLICY, CAPTURE_STATE } from '../../../constants/leagueTournament';

// H1 — LEAGUE_AGENT_CHAT_ENABLED is ON in source (flipped to production). The
// two-way-ask flag-OFF stub behavior is preserved here by driving the flag
// through a live getter (the scouting-board.test.js idiom) instead of the source
// default. importOriginal keeps every OTHER flag real, so the dependency-surface
// guard above (the real buildArenaModel graph loading clean) is untouched — only
// this single flag flips, and only inside the test that opts in.
const { chatFlag } = vi.hoisted(() => ({ chatFlag: { on: true } }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get LEAGUE_AGENT_CHAT_ENABLED() {
    return chatFlag.on;
  },
}));

const NOW = Date.parse('2026-06-16T20:30:00.000Z'); // Tue 16:30 ET — claim wire OPEN

function flat6Battle() {
  const asset = (symbol) => ({ symbol, name: symbol, tierMultiplier: 1 });
  return {
    id: 'b1', status: 'active', gameMode: 'baggerbomb_tournament', opponent: null,
    activatedAt: '2026-06-15T13:30:00.000Z', createdAt: '2026-06-15T13:30:00.000Z',
    portfolio: {
      star: [asset('NVDA'), asset('AMD')], core: [asset('TSLA'), asset('AAPL')], support: [asset('MSFT'), asset('GOOG')],
      startingPrices: { NVDA: 100, AMD: 50, TSLA: 200, AAPL: 150, MSFT: 300, GOOG: 120 },
    },
    scoring: { thresholds: { NVDA: { threshold: 2.5 }, AMD: { threshold: 2.5 }, TSLA: { threshold: 2.5 }, AAPL: { threshold: 2.5 }, MSFT: { threshold: 2.5 }, GOOG: { threshold: 2.5 } } },
    scoreState: { currentScore: 0 }, thresholdHistory: {}, trades: [],
    agentContext: { archetype: 'degen' }, // → 'Speculator'
    statusFeed: [{ timestamp: NOW - 3600 * 1000, message: 'Swapped SOFI for MSTR', action: 'swap', symbolIn: 'MSTR' }],
  };
}

function makeGroup() {
  const pick = (symbol, direction) => ({ symbol, legs: [{ direction }] });
  return {
    id: 'g1', status: 'battle', watchers: 47,
    userPool: ['NVDA', 'TSLA', 'GE', 'AMZN', 'VLO', 'COIN'],
    players: [
      { odUserId: 'u-you', picks: [pick('GE', 'long'), pick('AMZN', 'long'), pick('VLO', 'short')] },
      { odUserId: 'cpu-1', isCpu: true },
      { odUserId: 'u-riv', picks: [pick('XOM', 'long')] },
      { odUserId: 'cpu-2', isCpu: true },
    ],
    dailyScores: {
      day1: { closeScores: { 'u-you': { compositePoints: -1.2 }, 'cpu-1': { compositePoints: 2.1 }, 'u-riv': { compositePoints: 3.2 }, 'cpu-2': { compositePoints: 0.4 } } },
      day2: { closeScores: { 'u-you': { compositePoints: 1.4 }, 'cpu-1': { compositePoints: 3.0 }, 'u-riv': { compositePoints: 5.8 }, 'cpu-2': { compositePoints: -0.8 } } },
    },
    feed: [{ type: 'flip', symbol: 'VLO', odUserId: 'u-you', timestamp: NOW - 1800 * 1000, bankedLegScore: 2 }],
  };
}

const PRICE_CTX = {
  now: NOW, isActivationDay: false,
  effectivePrices: { NVDA: 110, AMD: 52, TSLA: 210, AAPL: 148, MSFT: 305, GOOG: 119, GE: 40, AMZN: 185, VLO: 130 },
  previousClosePrices: { NVDA: 100, AMD: 50, TSLA: 200, AAPL: 150, MSFT: 300, GOOG: 120, GE: 39, AMZN: 184, VLO: 131 },
};

const BASE = {
  group: makeGroup(), battle: flat6Battle(), priceCtx: PRICE_CTX,
  claims: [{ odUserId: 'u-you', dropSymbol: 'VLO', addSymbol: 'NVDA', status: 'pending', createdAt: NOW }],
  displayNames: { 'u-riv': 'Riva' }, uid: 'u-you', mode: 'ranked',
  compositeContext: { composite: 1.4, userPoints: 0.5 },
};

describe('liveDayIdx', () => {
  it('is 0 for an empty/awaiting climb and last-index otherwise', () => {
    expect(liveDayIdx({})).toBe(0);
    expect(liveDayIdx({ a: [], b: [] })).toBe(0);
    expect(liveDayIdx({ a: [1, 2, 3], b: [1] })).toBe(2);
  });
});

describe('buildArenaModel — seats', () => {
  const { seats } = buildArenaModel(BASE);
  it('builds four seats; YOU is teal + kind "you" + your agent archetype', () => {
    expect(seats).toHaveLength(4);
    const you = seats.find((s) => s.you);
    expect(you.color).toBe('#5EEAD4');
    expect(you.kind).toBe('you');
    expect(you.arch).toBe('Speculator'); // from battle.agentContext.archetype 'degen'
  });
  it('names CPU seats and keeps their archetype omitted', () => {
    const cpu = seats.find((s) => s.id === 'cpu-1');
    expect(cpu.kind).toBe('cpu');
    expect(cpu.name.startsWith('CPU')).toBe(true);
    expect(cpu.arch).toBeUndefined();
  });
  it('SEALS a rival human: name shown, archetype never fabricated', () => {
    const riv = seats.find((s) => s.id === 'u-riv');
    expect(riv.kind).toBe('human');
    expect(riv.name).toBe('Riva');
    expect(riv.arch).toBeUndefined(); // rival battle never read → arch sealed
  });
  it('gives every seat a DISTINCT hue — no shared CPU violet, YOU teal', () => {
    const you = seats.find((s) => s.you);
    expect(you.color).toBe('#5EEAD4');
    const rivals = seats.filter((s) => !s.you).map((s) => s.color);
    // CPUs no longer collapse to the one shared identity violet…
    expect(rivals).not.toContain('#9A8CE0');
    // …and the rivals read apart from each other and from YOUR teal.
    expect(new Set([...rivals, you.color]).size).toBe(4);
  });
  it('RESERVES your teal — a CPU that would hash to teal is re-rolled off it', () => {
    // cpu-3 hashes straight to HUMAN_PALETTE[6] === YOU_COLOR (#5EEAD4); the
    // de-collision must move it off YOUR identity color (and keep it distinct).
    const group = {
      id: 'g2', status: 'battle',
      players: [{ odUserId: 'u-you' }, { odUserId: 'cpu-3', isCpu: true }],
      dailyScores: { day1: { closeScores: { 'u-you': { compositePoints: 1 }, 'cpu-3': { compositePoints: 2 } } } },
    };
    const { seats } = buildArenaModel({ ...BASE, group, battle: null });
    const you = seats.find((s) => s.you);
    const cpu3 = seats.find((s) => s.id === 'cpu-3');
    expect(you.color).toBe('#5EEAD4');
    expect(cpu3.color).not.toBe('#5EEAD4'); // never YOUR teal
  });
  it('NEVER prints a raw odUserId — unresolved human name → "Player"', () => {
    const { seats: s2 } = buildArenaModel({ ...BASE, displayNames: {} });
    for (const seat of s2) {
      expect(seat.name).not.toBe(seat.id); // no seat shows its raw key
      if (seat.kind !== 'cpu') {
        expect(seat.name).toBe('Player'); // clean placeholder, not the id
        expect(seat.owner).toBeUndefined(); // owner never leaks the raw key either
      }
    }
  });
});

describe('buildArenaModel — climb / stars / beats / voice', () => {
  const m = buildArenaModel(BASE);
  it('passes the cumulative climb series straight through (never re-summed)', () => {
    expect(m.climb['u-you']).toEqual([-1.2, 1.4]);
    expect(m.youId).toBe('u-you');
    expect(liveDayIdx(m.climb)).toBe(1);
  });
  it('reads your six agent stars + three user stars in the flat contract', () => {
    expect(m.agentStars).toHaveLength(6);
    expect(m.userStars).toHaveLength(3);
    for (const r of [...m.agentStars, ...m.userStars]) {
      for (const f of ['tk', 'tier', 'dir', 'mult', 'banked', 'points', 'badge', 'state', 'justIn']) {
        expect(r).toHaveProperty(f);
      }
    }
  });
  it('derives beats (the flip feed event surfaces) and reads the agent voice', () => {
    expect(Array.isArray(m.beats)).toBe(true);
    expect(m.beats.some((b) => b.kind === 'flip')).toBe(true);
    expect(m.voice.arch).toBe('Speculator');
    expect(m.voice.live[0]).toMatchObject({ kind: 'trade', ticker: 'MSTR' });
  });
});

describe('buildArenaModel — pod / wire / youRank / claim', () => {
  const m = buildArenaModel(BASE);
  it('pod reads the latest banked day + watchers', () => {
    expect(m.pod).toMatchObject({ day: 2, days: 5, watchers: 47, toOpen: null, nextClose: null });
  });
  it('wire reflects the open claim window + your pending count (cap 3)', () => {
    expect(m.wire.open).toBe(true);
    expect(m.wire.closes).toBeGreaterThan(0);
    expect(m.wire.claimsUsed).toBe(1);
    expect(m.wire.claimsTotal).toBe(3);
  });
  it('ranks YOU at the last index (3rd of four here), never 0', () => {
    // day2: riv 5.8 > cpu-1 3.0 > you 1.4 > cpu-2 -0.8
    expect(m.youRank).toBe(3);
  });
  it('claim sheet offers the pool MINUS held (canonical rule) and your picks', () => {
    expect(m.claim.poolNames).toEqual(['NVDA', 'TSLA', 'COIN']); // GE/AMZN/VLO held → removed
    expect(m.claim.picks.map((p) => p.symbol)).toEqual(['GE', 'AMZN', 'VLO']);
    expect(m.claim.claimsTotal).toBe(3);
  });
});

describe('buildArenaModel — pre-deploy (no battle)', () => {
  it('renders dormant: empty agent stars, empty voice lane, seats still built', () => {
    const m = buildArenaModel({ ...BASE, battle: null });
    expect(m.agentStars).toEqual([]);
    expect(m.voice.live).toEqual([]);
    expect(m.seats).toHaveLength(4);
    expect(m.seats.find((s) => s.you).arch).toBeUndefined(); // no battle → your arch unknown too
  });
});

describe('buildAskChips — the two-way ask chips (standing-aware)', () => {
  it('the strategy starter set + one standing-aware slot; every chip is a { q } prompt', () => {
    const chips = buildAskChips(1);
    expect(chips).toHaveLength(6);
    expect(chips.every((c) => typeof c.q === 'string' && c.q.length > 0)).toBe(true);
    expect('a' in chips[0]).toBe(false); // no canned echo — the chip text IS the message
  });
  it('advancing (rank 1-2) offers "protect the lead"', () => {
    expect(buildAskChips(1).at(-1).q).toMatch(/protect the lead/i);
    expect(buildAskChips(2).at(-1).q).toMatch(/protect the lead/i);
  });
  it('behind (rank 3-4) offers "catch up"', () => {
    expect(buildAskChips(3).at(-1).q).toMatch(/catch up/i);
    expect(buildAskChips(4).at(-1).q).toMatch(/catch up/i);
  });
});

describe('buildArenaModel — two-way ask identity + flag gating', () => {
  it('exposes battleId/agentId for the ask POST, and ask stays [] with the chat flag off (stub)', () => {
    chatFlag.on = false;
    try {
      const m = buildArenaModel({ ...BASE, battle: { ...flat6Battle(), agentId: 'agent-9' } });
      expect(m.battleId).toBe('b1');
      expect(m.agentId).toBe('agent-9');
      // Flag mocked OFF → no chips → today's local-echo stub is byte-identical.
      expect(m.ask).toEqual([]);
    } finally {
      chatFlag.on = true;
    }
  });

  it('with the chat flag ON (production default) ask carries the standing-aware chips', () => {
    const m = buildArenaModel({ ...BASE, battle: { ...flat6Battle(), agentId: 'agent-9' } });
    expect(m.battleId).toBe('b1');
    expect(m.agentId).toBe('agent-9');
    expect(m.ask.length).toBeGreaterThan(0);
    expect(m.ask.every((c) => typeof c.q === 'string' && c.q.length > 0)).toBe(true);
  });
});

// ── Phase 5 — canonical-open settlement axis threaded into the arena model ──
describe('buildArenaModel — user-layer settlement states (Deliverables 1,3,4)', () => {
  it('LEGACY round (absent stamp): every user star is settleState null, no pending, wire.canonical false', () => {
    const m = buildArenaModel(BASE);
    expect(m.userStars.every((s) => s.settleState === null)).toBe(true);
    expect(m.userPending).toBe(0);
    expect(m.wire.canonical).toBe(false); // claim UI unchanged for legacy
  });

  const canonicalGroup = () => {
    const g = makeGroup();
    g.baselinePolicy = BASELINE_POLICY.CANONICAL_OPEN;
    g.players[0].picks = [
      { symbol: 'GE', legs: [{ direction: 'long', baselinePrice: null, captureState: CAPTURE_STATE.PENDING_OPEN, thresholdHistory: [] }] },     // pending
      { symbol: 'AMZN', legs: [{ direction: 'long', baselinePrice: 100, captureState: CAPTURE_STATE.CAPTURED, thresholdHistory: [] }] },        // estimated
      { symbol: 'VLO', legs: [{ direction: 'short', baselinePrice: null, captureState: CAPTURE_STATE.NO_ELIGIBLE_OPEN, thresholdHistory: [] }] }, // void
    ];
    return g;
  };

  it('CANONICAL round: stars carry pending/estimated/void; userPending counts the awaiting picks', () => {
    const m = buildArenaModel({ ...BASE, group: canonicalGroup() });
    const byTk = Object.fromEntries(m.userStars.map((s) => [s.tk, s.settleState]));
    expect(byTk).toEqual({ GE: 'pending', AMZN: 'estimated', VLO: 'void' });
    expect(m.userPending).toBe(1);          // one pick awaiting the open → "1 pick pending"
    expect(m.wire.canonical).toBe(true);
  });

  it('dayBanked flips a captured leg estimated → official (today ET already banked)', () => {
    const g = canonicalGroup();
    // NOW = 2026-06-16T20:30Z → ET date 2026-06-16. Bank that day.
    g.dailyScores.day3 = { closeScores: { 'u-you': { compositePoints: 1 } }, recordedDate: '2026-06-16' };
    const m = buildArenaModel({ ...BASE, group: g });
    expect(m.userStars.find((s) => s.tk === 'AMZN').settleState).toBe('official');
    expect(m.userStars.find((s) => s.tk === 'GE').settleState).toBe('pending');  // still no baseline
    expect(m.userStars.find((s) => s.tk === 'VLO').settleState).toBe('void');     // terminal
  });

  it('close-only claim messaging: a canonical round mid-market-hours flags wire.reason market_hours', () => {
    // 2026-06-16T17:00:00Z = Tue 13:00 ET — market OPEN, claim window CLOSED.
    const marketHoursNow = Date.parse('2026-06-16T17:00:00.000Z');
    const m = buildArenaModel({ ...BASE, group: canonicalGroup(), priceCtx: { ...PRICE_CTX, now: marketHoursNow } });
    expect(m.wire.open).toBe(false);
    expect(m.wire.canonical).toBe(true);
    expect(m.wire.reason).toBe('market_hours'); // → "CLAIMS OPEN AFTER CLOSE" on the disabled control
  });
});
