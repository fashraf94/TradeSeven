// src/components/League/battleArena/buildArenaModel.test.js
//
// The real-data bridge. The import of buildArenaModel (→ leagueAdapter,
// leagueClimbAdapter, leagueStarMeter→calculateAssetScoreV3, leagueBeats,
// tournamentSurfaces, leagueTournament) loading clean in Node IS the
// dependency-surface guard (BUILD_RULES §4 — never mocked): it proves the whole
// bridge graph stays node-clean and the scorer is reached, not copied.

import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { buildArenaModel, liveDayIdx, buildAskChips } from './buildArenaModel';
import { seatAltitude, seatHasLiveSample } from './seatAltitude';
import { buildScoreHistory } from './buildScoreHistory';
import { buildFlat6BattleModel } from '../../../utils/flat6BattleEnrichment';
import { BASELINE_POLICY, CAPTURE_STATE, computeComposite } from '../../../constants/leagueTournament';

// H1 — LEAGUE_AGENT_CHAT_ENABLED and LEAGUE_LIVE_ORB_ENABLED are BOTH ON in
// source (flipped to production — the live-orb flip is commit 2bd50fc9,
// "Enable ... league live orb"); LEAGUE_SCORE_HISTORY_ON is DARK (OFF). We drive
// all three through live getters (the scouting-board.test.js idiom) instead of
// the source default, so a test can exercise each flag's ON and OFF contract
// without editing the source: chat + live-orb default ON to match production (the
// live-orb dark contract runs via offGate()), while score-history defaults OFF
// (dark) and the day-index tests flip it ON locally to exercise the trading-day-
// index header binding. importOriginal keeps every OTHER flag real, so the
// dependency-surface guard above (the real buildArenaModel graph loading clean)
// is untouched.
const { chatFlag, orbFlag, scoreHistoryFlag } = vi.hoisted(() => ({ chatFlag: { on: true }, orbFlag: { on: true }, scoreHistoryFlag: { on: false } }));
vi.mock('../../../config/featureFlags', async (importOriginal) => ({
  ...(await importOriginal()),
  get LEAGUE_AGENT_CHAT_ENABLED() {
    return chatFlag.on;
  },
  get LEAGUE_LIVE_ORB_ENABLED() {
    return orbFlag.on;
  },
  // Dark by default (flag-off = today's banked-count header, byte-identical); the
  // day-index tests flip it on to exercise the trading-day-index header binding.
  get LEAGUE_SCORE_HISTORY_ON() {
    return scoreHistoryFlag.on;
  },
}));

// Run `fn` with the live-orb flag OFF (the dark contract), ALWAYS restoring the
// production-default ON afterward (even on a thrown assertion) so the toggle
// never leaks across tests.
function offGate(fn) {
  const prev = orbFlag.on;
  orbFlag.on = false;
  try {
    return fn();
  } finally {
    orbFlag.on = prev;
  }
}

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
  it('names CPU seats and recovers their archetype deterministically (Phase 4 / R12)', () => {
    // Pre-Phase-4 this pinned cpu.arch undefined; R12 plumbs it — cpu-1 →
    // CPU_ARCHETYPE_ORDER[0] 'momentum_chaser', label via the canonical map.
    const cpu = seats.find((s) => s.id === 'cpu-1');
    expect(cpu.kind).toBe('cpu');
    expect(cpu.name.startsWith('CPU')).toBe(true);
    expect(cpu.archId).toBe('momentum_chaser');
    expect(cpu.arch).toBe('Trend Follower');
    const cpu2 = seats.find((s) => s.id === 'cpu-2');
    expect(cpu2.archId).toBe('contrarian');
  });
  it('a rival human WITHOUT a spectator projection: name shown, archetype never fabricated', () => {
    const riv = seats.find((s) => s.id === 'u-riv');
    expect(riv.kind).toBe('human');
    expect(riv.name).toBe('Riva');
    expect(riv.archId).toBeNull();    // no projection supplied → the defined fallback
    expect(riv.arch).toBeUndefined(); // label never fabricated
  });
  it('a rival human WITH the spectator projection: archId from PUBLIC_AGENT_CONTEXT (Phase 4 / R12)', () => {
    const m = buildArenaModel({
      ...BASE,
      spectatedBattles: { 'u-riv': { agentContext: { archetype: 'guardian' } } },
    });
    const riv = m.seats.find((s) => s.id === 'u-riv');
    expect(riv.archId).toBe('guardian');
    expect(riv.arch).toBe('Capital Preserver'); // canonical label, not a local map
    // and YOUR seat is never sourced from the projection, even if it carries you
    const m2 = buildArenaModel({
      ...BASE,
      spectatedBattles: { 'u-you': { agentContext: { archetype: 'guardian' } } },
    });
    expect(m2.seats.find((s) => s.you).archId).toBe('degen'); // own battle wins
  });
  it('YOUR seat carries the stable code-id alongside the label', () => {
    const you = seats.find((s) => s.you);
    expect(you.archId).toBe('degen');
    expect(you.arch).toBe('Speculator');
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

// ── Branch 1 — the live YOUR-seat composite for the orb ──
describe('buildArenaModel — live YOUR-seat composite (youLiveScore)', () => {
  const sum = (rows) => rows.reduce((a, s) => a + (Number.isFinite(s?.points) ? s.points : 0), 0);
  // The live orb requires TODAY's fullday battle doc — the pod's NOW is
  // 2026-06-16 ET, so the battle must be activated that ET day. Training always
  // rides the orb; ranked rides it too when the live-orb flag is ON (production
  // today) and stays banked when it is OFF (the offGate() dark-contract tests).
  const TODAY_BATTLE = { ...flat6Battle(), activatedAt: '2026-06-16T14:00:00.000Z', createdAt: '2026-06-16T14:00:00.000Z' };
  const liveArgs = (extra = {}) => ({ ...BASE, mode: 'training', battle: TODAY_BATTLE, ...extra });

  it('§9: youLiveScore = computeComposite(priorBankedAgent + Σ agent points, Σ user points) from the SAME rows the dock renders', () => {
    const m = buildArenaModel(liveArgs());
    // The fixtures carry compositePoints but no agentPoints → priorBankedAgent 0.
    expect(typeof m.youLiveScore).toBe('number');
    expect(m.youLiveScore).toBeCloseTo(computeComposite(sum(m.agentStars), sum(m.userStars)), 6);
  });

  it('ADDS the prior banked cumulative agent (agent battles are fullday/daily docs) so it settles to the banked composite', () => {
    const g = makeGroup();
    g.dailyScores.day2.closeScores['u-you'].agentPoints = 12; // cumulative agent through the last close
    const m = buildArenaModel(liveArgs({ group: g }));
    expect(m.youLiveScore).toBeCloseTo(computeComposite(12 + sum(m.agentStars), sum(m.userStars)), 6);
  });

  it('week-to-date includes 1.5× the user PRIOR banked days (cumulative Σuser) — no term snaps in at close', () => {
    // The user layer is a cumulative snapshot, not a per-day term: scorePick banks
    // a closed leg AND scores the live leg from its Monday baseline, so a prior
    // day's realized flip rides in Σuser (and thus in the composite). Adding the
    // closed banked leg (+8 user pts) must move youLiveScore by exactly 1.5×8 —
    // proving the "missing 1.5× user prior days" drop does not exist (Item A).
    const withPrior = makeGroup();
    withPrior.players[0].picks = [{ symbol: 'GE', legs: [
      { direction: 'long', baselinePrice: 40, closedAt: '2026-06-15T20:00:00.000Z', bankedScore: 8 }, // a prior banked day
      { direction: 'long', baselinePrice: 40 }, // today's live leg (GE 40→40 → 0 live pts)
    ] }];
    const withoutPrior = makeGroup();
    withoutPrior.players[0].picks = [{ symbol: 'GE', legs: [{ direction: 'long', baselinePrice: 40 }] }];
    const a = buildArenaModel(liveArgs({ group: withPrior }));
    const b = buildArenaModel(liveArgs({ group: withoutPrior }));
    expect(a.youLiveScore - b.youLiveScore).toBeCloseTo(1.5 * 8, 6);
  });

  it('a non-finite banked agentPoints degrades to 0 — never poisons the orb with NaN', () => {
    const g = makeGroup();
    g.dailyScores.day2.closeScores['u-you'].agentPoints = NaN;
    const m = buildArenaModel(liveArgs({ group: g }));
    expect(Number.isFinite(m.youLiveScore)).toBe(true);
    expect(m.youLiveScore).toBeCloseTo(computeComposite(sum(m.agentStars), sum(m.userStars)), 6);
  });

  it('drives youRank live too — the orb crown/rank and the ask standing agree (§9)', () => {
    const m = buildArenaModel(liveArgs());
    const order = [
      ['u-you', m.youLiveScore],
      ['cpu-1', m.climb['cpu-1'].at(-1)], ['u-riv', m.climb['u-riv'].at(-1)], ['cpu-2', m.climb['cpu-2'].at(-1)],
    ].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    expect(m.youRank).toBe(order.indexOf('u-you') + 1); // ranked by the LIVE score, not the banked 1.4
  });

  it('is null (orb stays banked) with no battle — rivals, preview, pre-deploy', () => {
    expect(buildArenaModel(liveArgs({ battle: null })).youLiveScore).toBeNull();
  });

  it('is null in RANKED mode when the live orb is OFF — Branch 1 is training-only (ranked orb stays banked)', () => {
    offGate(() => {
      expect(buildArenaModel(liveArgs({ mode: 'ranked' })).youLiveScore).toBeNull();
    });
  });

  it('goes LIVE in RANKED mode when the live orb is ON — ranked rides the same orb as training', () => {
    // orbFlag defaults ON (production, commit 2bd50fc9): ranked no longer stays
    // banked — it rides the live orb at parity with the training orb.
    const rankedLive = buildArenaModel(liveArgs({ mode: 'ranked' })).youLiveScore;
    expect(rankedLive).not.toBeNull();
    expect(rankedLive).toBeCloseTo(buildArenaModel(liveArgs({ mode: 'training' })).youLiveScore, 6);
  });

  it('is null for a STALE prior-day battle doc — no double-count of an already-banked agent layer', () => {
    // BASE.battle is activated 2026-06-15 but NOW is 2026-06-16 → not today's fullday doc.
    expect(buildArenaModel({ ...BASE, mode: 'training' }).youLiveScore).toBeNull();
  });

  it('is null once TODAY is already banked — the live→final settle to the banked composite', () => {
    const g = makeGroup();
    // NOW → ET 2026-06-16; banking that day means the banked series already holds today.
    g.dailyScores.day3 = { closeScores: { 'u-you': { compositePoints: 1 } }, recordedDate: '2026-06-16' };
    expect(buildArenaModel(liveArgs({ group: g })).youLiveScore).toBeNull();
  });

  it('is null when the round is not live (awaiting / complete)', () => {
    const g = makeGroup();
    g.status = 'complete';
    expect(buildArenaModel(liveArgs({ group: g })).youLiveScore).toBeNull();
  });
});

describe('buildArenaModel — departed-position points (model fields)', () => {
  const sum = (rows) => rows.reduce((a, s) => a + (Number.isFinite(s?.points) ? s.points : 0), 0);
  const TODAY_BATTLE = { ...flat6Battle(), activatedAt: '2026-06-16T14:00:00.000Z', createdAt: '2026-06-16T14:00:00.000Z' };
  const liveArgs = (extra = {}) => ({ ...BASE, mode: 'training', battle: TODAY_BATTLE, ...extra });

  it('both null off the live gate — ranked/banked/pre-deploy render byte-identical', () => {
    expect(buildArenaModel({ ...BASE, mode: 'ranked' }).agentDeparted).toBeNull();
    expect(buildArenaModel({ ...BASE, mode: 'ranked' }).userDeparted).toBeNull();
    expect(buildArenaModel(liveArgs({ battle: null })).agentDeparted).toBeNull(); // pre-deploy
  });

  it('agentDeparted is null with no swaps; aggregates Σ trades[].lockedPoints and enumerates items when present', () => {
    expect(buildArenaModel(liveArgs()).agentDeparted).toBeNull(); // BASE battle trades: []
    const battle = { ...TODAY_BATTLE, trades: [
      { symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 12, swapDay: 2 },
      { symbolOut: 'PFE', symbolIn: 'AMD', lockedPoints: -3, swapDay: 3 },
    ] };
    const m = buildArenaModel(liveArgs({ battle }));
    expect(m.agentDeparted.total).toBeCloseTo(9, 6); // 12 + (-3)
    expect(m.agentDeparted.items.map((i) => [i.out, i.in, i.pts])).toEqual([['LLY', 'NVDA', 12], ['PFE', 'AMD', -3]]);
  });

  it('§9 CROSS-SURFACE: the live strip SWAPS term === the recap current-day subtotal (one buildSwapLedger source, both call sites)', () => {
    // Binds the two SURFACES on the SAME input — not by asserting each against
    // its own literal (which would let a reintroduced local swap copy in either
    // call site pass, the §4 anti-pattern the name-only parity missed). Fractional
    // locked points so the value is a real float threaded through both paths.
    const battle = { ...TODAY_BATTLE, trades: [
      { symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 12.5, swapDay: 1 },
      { symbolOut: 'PFE', symbolIn: 'AMD', lockedPoints: -3.2, swapDay: 1 },
    ] };
    const strip = buildArenaModel(liveArgs({ battle })).decomposition;
    expect(strip).not.toBeNull(); // orb live (training) → the decomposition strip renders
    const recap = buildScoreHistory({ group: BASE.group, battleChain: [battle], uid: 'u-you' });
    // The strip's SWAPS term and the recap's today-subtotal are ONE number by
    // construction (both = buildSwapLedger(battle.trades).total) — exact equality.
    expect(recap.currentSwapSubtotal).toBe(strip.swaps);
    expect(strip.swaps).toBeCloseTo(9.3, 6); // 12.5 + (-3.2)
  });

  it('userDeparted aggregates dropped banked points and flags same-day pending drops (no fake 0)', () => {
    const g = makeGroup();
    g.players[0].droppedPicks = [
      { symbol: 'KO', legs: [{ direction: 'long', baselinePrice: 60, closedAt: '2026-06-14T20:00:00Z', bankedScore: 7 }] }, // banked
      { symbol: 'F', legs: [{ direction: 'long', baselinePrice: 12, closedAt: '2026-06-16T13:25:00Z' }] },                   // same-day → pending
    ];
    const m = buildArenaModel(liveArgs({ group: g }));
    expect(m.userDeparted.total).toBeCloseTo(7, 6);  // the pending leg contributes 0, never a fabricated number
    expect(m.userDeparted.pendingCount).toBe(1);
    expect(m.userDeparted.items.map((i) => [i.tk, i.pending])).toEqual([['KO', false], ['F', true]]);
    expect(buildArenaModel(liveArgs()).userDeparted).toBeNull(); // no droppedPicks → null
  });

  it('star rows are UNCHANGED by departed points — the ledger is additive to the orb only', () => {
    const battle = { ...TODAY_BATTLE, trades: [{ symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 50, swapDay: 1 }] };
    const g = makeGroup();
    g.players[0].droppedPicks = [{ symbol: 'KO', legs: [{ direction: 'long', baselinePrice: 60, closedAt: '2026-06-14T20:00:00Z', bankedScore: 40 }] }];
    const withDeparted = buildArenaModel(liveArgs({ battle, group: g }));
    const withoutDeparted = buildArenaModel(liveArgs());
    expect(sum(withDeparted.agentStars)).toBeCloseTo(sum(withoutDeparted.agentStars), 6);
    expect(sum(withDeparted.userStars)).toBeCloseTo(sum(withoutDeparted.userStars), 6);
  });
});

describe('buildArenaModel — orb swap/drop-accurate (Phase 2)', () => {
  const sum = (rows) => rows.reduce((a, s) => a + (Number.isFinite(s?.points) ? s.points : 0), 0);
  const TODAY_BATTLE = { ...flat6Battle(), activatedAt: '2026-06-16T14:00:00.000Z', createdAt: '2026-06-16T14:00:00.000Z' };
  const liveArgs = (extra = {}) => ({ ...BASE, mode: 'training', battle: TODAY_BATTLE, ...extra });

  it('§9 identity: the orb ADDS exactly the sums the chips display (agent ×1, user ×1.5)', () => {
    const battle = { ...TODAY_BATTLE, trades: [{ symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 50, swapDay: 1 }] };
    const g = makeGroup();
    g.players[0].droppedPicks = [{ symbol: 'KO', legs: [{ direction: 'long', baselinePrice: 60, closedAt: '2026-06-14T20:00:00Z', bankedScore: 40 }] }];
    const withDeparted = buildArenaModel(liveArgs({ battle, group: g }));
    const base = buildArenaModel(liveArgs());
    expect(withDeparted.agentDeparted.total).toBe(50);
    expect(withDeparted.userDeparted.total).toBe(40);
    // orb rises by the swap term (agent, ×1) + 1.5 × the dropped term (user half)
    expect(withDeparted.youLiveScore - base.youLiveScore).toBeCloseTo(50 + 1.5 * 40, 6);
  });

  it('no settle-step (agent): the orb today agent-term == Flat6 liveAgentScore', () => {
    const battle = { ...TODAY_BATTLE, trades: [{ symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 12, swapDay: 1 }] };
    const m = buildArenaModel(liveArgs({ battle }));
    const flat6 = buildFlat6BattleModel(battle, BASE.priceCtx);
    const agentTodayTerm = sum(m.agentStars) + m.agentDeparted.total; // activeScore(live) + Σ today's swaps
    expect(Math.round(agentTodayTerm)).toBe(flat6.liveAgentScore); // == the Flat6 number, exactly
  });

  it('no double-count: today swaps add on TOP of the cumulative priorBankedAgent (Day-1 counted once)', () => {
    const g = makeGroup();
    g.dailyScores.day2.closeScores['u-you'].agentPoints = 30; // cumulative agent incl. prior-day swaps
    const battle = { ...TODAY_BATTLE, trades: [{ symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 15, swapDay: 1 }] };
    const withTodaySwap = buildArenaModel(liveArgs({ group: g, battle }));
    const noTodaySwap = buildArenaModel(liveArgs({ group: g }));
    // today's +15 adds exactly +15 to the agent layer, on top of the 30 — never doubled
    expect(withTodaySwap.youLiveScore - noTodaySwap.youLiveScore).toBeCloseTo(15, 6);
  });

  it('user half: a dropped pick banked +M moves the orb by exactly 1.5×M (no sag, no close jump)', () => {
    const g = makeGroup();
    g.players[0].droppedPicks = [{ symbol: 'KO', legs: [{ direction: 'long', baselinePrice: 60, closedAt: '2026-06-14T20:00:00Z', bankedScore: 8 }] }];
    const withDrop = buildArenaModel(liveArgs({ group: g }));
    const noDrop = buildArenaModel(liveArgs());
    expect(withDrop.youLiveScore - noDrop.youLiveScore).toBeCloseTo(1.5 * 8, 6);
  });

  it('the announced A3 residual: a SAME-DAY pending drop adds 0 to the orb (never a fake value)', () => {
    const g = makeGroup();
    g.players[0].droppedPicks = [{ symbol: 'F', legs: [{ direction: 'long', baselinePrice: 12, closedAt: '2026-06-16T13:25:00Z' }] }]; // no bankedScore → pending
    const withPending = buildArenaModel(liveArgs({ group: g }));
    const noDrop = buildArenaModel(liveArgs());
    expect(withPending.userDeparted.pendingCount).toBe(1);
    expect(withPending.userDeparted.total).toBe(0);
    expect(withPending.youLiveScore).toBeCloseTo(noDrop.youLiveScore, 6); // the pending leg moves nothing
  });

  it('§9 badge-zero guard: warns ONCE per battle (dev) when a live doc carries non-zero bankedBadgePoints', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildArenaModel(liveArgs()); // normal fixture: badges absent/0 → no warn
    expect(spy).not.toHaveBeenCalled();
    const battle = { ...TODAY_BATTLE, id: 'badge-leak-1', scoreState: { currentScore: 0, bankedBadgePoints: { total: 7 } } };
    buildArenaModel(liveArgs({ battle }));
    buildArenaModel(liveArgs({ battle })); // same battle id, next price tick → deduped, not re-warned
    expect(spy).toHaveBeenCalledTimes(1); // once per battle, never every tick
    expect(String(spy.mock.calls[0][0])).toMatch(/bankedBadgePoints/);
    spy.mockRestore();
  });

  it('ranked stays byte-identical when the live orb is OFF — the orb never goes live (departed never added off training)', () => {
    offGate(() => {
      const battle = { ...TODAY_BATTLE, trades: [{ symbolOut: 'LLY', symbolIn: 'NVDA', lockedPoints: 99, swapDay: 1 }] };
      const g = makeGroup();
      g.players[0].droppedPicks = [{ symbol: 'KO', legs: [{ direction: 'long', baselinePrice: 60, closedAt: '2026-06-14T20:00:00Z', bankedScore: 99 }] }];
      const m = buildArenaModel({ ...BASE, mode: 'ranked', battle, group: g });
      expect(m.youLiveScore).toBeNull();      // ranked orb stays banked
      expect(m.agentDeparted).toBeNull();
      expect(m.userDeparted).toBeNull();
    });
  });
});

describe('fence tripwire — the orb agent-half depends on fresh daily docs (fullday mode)', () => {
  // agentBattleService.js is FENCED/read-only — this is a SOURCE-TEXT tripwire (the
  // decide.js/buildThresholds precedent in tournamentUserScoring.test.js), NOT an
  // edit. AGENT_BATTLE_DURATION_MODE is module-private, so we pin it by text.
  const battleServiceSource = readFileSync(
    new URL('../../../../api/_utils/agentBattleService.js', import.meta.url), 'utf8',
  );

  it("AGENT_BATTLE_DURATION_MODE === 'fullday' — buildArenaModel's no-double-count + badge-zero properties depend on it", () => {
    // buildArenaModel's agent half adds priorBankedAgent (cumulative week-to-date)
    // + Σ TODAY's trades[].lockedPoints and DELIBERATELY OMITS bankedBadgePoints —
    // BOTH correct ONLY because each pod-day is a fresh SINGLE-day battle doc:
    //   • trades[] is today-only → no double-count with priorBankedAgent (Checkpoint A1),
    //   • the doc completes before the badge cron → bankedBadgePoints is 0 live (A4).
    // If this mode flips to a multi-day/persistent doc, trades accumulate across days
    // (→ double-count) and badges bank into a LIVE doc (→ agent-half under-count).
    // buildArenaModel's agent half (swapBanked add + the badge-zero omission) MUST be
    // fixed BEFORE this line changes. If this assertion fails, do not just update it —
    // fix the orb first.
    expect(battleServiceSource).toContain("const AGENT_BATTLE_DURATION_MODE = 'fullday'");
  });
});

describe('buildArenaModel — user ATR basis parity (Phase 2.5, R1)', () => {
  const sumRows = (rows) => rows.reduce((a, s) => a + (Number.isFinite(s?.points) ? s.points : 0), 0);
  const heldGroup = (symbol = 'GE') => {
    const g = makeGroup();
    g.players[0].picks = [{ symbol, legs: [{ direction: 'long', baselinePrice: 100, thresholdHistory: [] }] }];
    return g;
  };
  // GE +5% live; extra merges atrPercentiles / other effectivePrices
  const px = (extra = {}) => ({ ...PRICE_CTX, effectivePrices: { ...PRICE_CTX.effectivePrices, GE: 105 }, ...extra });

  it('RANKED too (Amendment 1): held picks score against the percentile ATR (resolveBaseATR), not the 2.5/5.0 preview', () => {
    const g = heldGroup();
    // deliberate rewrite of the old "ranked byte-identical (user cells)" expectation:
    // ranked was showing the overstated preview multiplier; it now rides banking's basis.
    const preview = buildArenaModel({ ...BASE, mode: 'ranked', group: g, priceCtx: px() });                          // no rankings → default 2.5
    const banked = buildArenaModel({ ...BASE, mode: 'ranked', group: g, priceCtx: px({ atrPercentiles: { GE: 0.9 } }) }); // 0.9 → (0.9)×8 = 7.2
    const geP = preview.userStars.find((s) => s.tk === 'GE');
    const geB = banked.userStars.find((s) => s.tk === 'GE');
    expect(geP.mult).toBeCloseTo(5 / 2.5, 5); // +5% / preview 2.5 = 2.0 (the 1.6–3× overstatement)
    expect(geB.mult).toBeCloseTo(5 / 7.2, 5); // +5% / percentile 7.2 ≈ 0.69 — shrinks to the banked basis
    expect(Math.abs(geB.points)).toBeLessThan(Math.abs(geP.points)); // whole cell moves on ONE scorePick call
  });

  it('missing symbol → 4.0 ((undefined ‖ 0.5)×8), NOT the 2.5 default — fallback parity with banking', () => {
    const g = heldGroup();
    const m = buildArenaModel({ ...BASE, group: g, priceCtx: px({ atrPercentiles: { AAPL: 0.5 } }) }); // GE absent from rankings
    const ge = m.userStars.find((s) => s.tk === 'GE');
    expect(ge.mult).toBeCloseTo(5 / 4.0, 5); // +5% / 4.0 (banking's missing-symbol path), not /2.5
  });

  it('degraded null (no rankings client-side): port-contract fallback; a .CC crypto pick → 5.0, not 2.5', () => {
    const g = heldGroup('BTC.CC');
    const priceCtx = { ...PRICE_CTX, effectivePrices: { ...PRICE_CTX.effectivePrices, 'BTC.CC': 105 } }; // no atrPercentiles
    const m = buildArenaModel({ ...BASE, group: g, priceCtx });
    const btc = m.userStars.find((s) => s.tk === 'BTC.CC');
    expect(btc.mult).toBeCloseTo(5 / 5.0, 5); // +5% / crypto 5.0 (banking's null path), not /2.5
  });

  it('§9 identity holds on the new basis: the training orb sums the percentile-basis userStars', () => {
    const g = heldGroup();
    const TODAY = { ...flat6Battle(), activatedAt: '2026-06-16T14:00:00.000Z', createdAt: '2026-06-16T14:00:00.000Z' };
    const m = buildArenaModel({ ...BASE, mode: 'training', battle: TODAY, group: g, priceCtx: px({ atrPercentiles: { GE: 0.9 } }) });
    // no trades / no dropped picks here → orb = computeComposite(Σagent, Σuser-on-the-new-basis)
    expect(m.youLiveScore).toBeCloseTo(computeComposite(sumRows(m.agentStars), sumRows(m.userStars)), 5);
  });

  it('no atrPercentiles (fixtures/legacy caller) → default ATR, byte-identical to pre-2.5', () => {
    const g = heldGroup();
    const withArg = buildArenaModel({ ...BASE, group: g, priceCtx: px() });            // priceCtx has no atrPercentiles
    const geP = withArg.userStars.find((s) => s.tk === 'GE');
    expect(geP.mult).toBeCloseTo(5 / 2.5, 5); // the port-contract default path is preserved for callers that pass nothing
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

// ── Phase B (Option X) — the live orb flag gates the RIVAL endpoint map as ONE
// unit. This suite runs with the flag OFF (its default in Node — featureFlags reads
// no window → false), so it proves the dark posture: a supplied liveComposites map
// is IGNORED and every rival stays on the banked series, byte-identical to today.
// The flag-ON behavior (rivals live) is proven in b3Lockstep.test.js. ──
describe('buildArenaModel — live orb flag gating (Option X, flag off vs on)', () => {
  const map = { 'u-riv': 999, 'cpu-1': 888 }; // a rival overtake — ignored while dark, surfaced when live
  const TODAY_BATTLE = { ...flat6Battle(), activatedAt: '2026-06-16T14:00:00.000Z', createdAt: '2026-06-16T14:00:00.000Z' };

  it('a supplied liveComposites map is IGNORED off-gate: rivals banked, model.liveComposites null', () => {
    offGate(() => {
      const withMap = buildArenaModel({ ...BASE, mode: 'ranked', liveComposites: map });
      const without = buildArenaModel({ ...BASE, mode: 'ranked' });
      expect(withMap.liveComposites).toBeNull();                 // never surfaced when off
      expect(withMap.youRank).toBe(without.youRank);             // the 999 rival overtake is ignored
      const rivWith = withMap.seats.find((s) => s.id === 'u-riv');
      const rivWithout = without.seats.find((s) => s.id === 'u-riv');
      expect(rivWith.score).toBe(rivWithout.score);              // rival seat.score stays banked (no swap off-gate)
    });
  });

  it('a supplied liveComposites map IS surfaced on-gate: rivals go live', () => {
    // orbFlag defaults ON (production): the 999 rival overtake now surfaces and
    // moves the rival's seat score vs the off-gate banked value.
    const withMap = buildArenaModel({ ...BASE, mode: 'ranked', liveComposites: map });
    expect(withMap.liveComposites).toEqual(map);               // surfaced when on
    const rivOn = withMap.seats.find((s) => s.id === 'u-riv');
    const rivOff = offGate(() => buildArenaModel({ ...BASE, mode: 'ranked', liveComposites: map }))
      .seats.find((s) => s.id === 'u-riv');
    expect(rivOn.score).not.toBe(rivOff.score);                // the seat score swaps to live when on
  });

  it('the decomposition is null and cards stay "mult" off-gate — even when the orb is LIVE (training)', () => {
    offGate(() => {
      // training + today's battle → youLiveScore is LIVE, but the decomposition
      // strip + points-led cards are flag-gated → dark when the orb flag is off.
      const m = buildArenaModel({ ...BASE, mode: 'training', battle: TODAY_BATTLE });
      expect(m.youLiveScore).not.toBeNull(); // the orb is live (training path, unchanged)
      expect(m.decomposition).toBeNull();    // …but the decomposition is dark (flag off)
      expect(m.headline).toBe('mult');       // …and the cards lead with the multiplier (the dark/pre-flip render)
    });
  });

  it('the decomposition IS present and the cards lead with points on-gate (training)', () => {
    // orbFlag defaults ON (production): the strip lights up and reconciles to
    // the orb (agentSide + userLayer === orb === youLiveScore, Ruling A).
    const m = buildArenaModel({ ...BASE, mode: 'training', battle: TODAY_BATTLE });
    expect(m.youLiveScore).not.toBeNull();
    expect(m.decomposition).not.toBeNull();
    expect(m.decomposition.orb).toBeCloseTo(m.youLiveScore, 6);
    expect(m.decomposition.agentSide + m.decomposition.userLayer).toBeCloseTo(m.youLiveScore, 6);
    expect(m.headline).not.toBe('mult');   // cards no longer lead with the multiplier
  });
});

// ── Day-index axis reconciliation (founder ruling: header ↔ recap, one index) ──
describe('buildArenaModel — the day index binds the header to the recap current-day label', () => {
  const g = {
    id: 'g', status: 'battle', watchers: 0, userPool: [],
    players: [{ odUserId: 'u-you', picks: [] }],
    dailyScores: {
      day1: { recordedDate: '2026-06-14', closeScores: { 'u-you': { compositePoints: 5 } } },
      day2: { recordedDate: '2026-06-15', closeScores: { 'u-you': { compositePoints: 8 } } },
    },
  };
  const now = Date.parse('2026-06-16T14:00:00.000Z'); // ET 2026-06-16 → the live, UNBANKED 3rd day
  const todayDoc = {
    id: 't', status: 'active', createdAt: '2026-06-16T13:30:00.000Z',
    timing: { tradingDays: ['2026-06-16'] },
    trades: [{ symbolOut: 'A', symbolIn: 'B', lockedPoints: 2 }],
  };

  it('flag-OFF: the header stays the banked-day count (byte-identical — Day 2)', () => {
    const m = buildArenaModel({ group: g, priceCtx: { now }, uid: 'u-you', mode: 'ranked' });
    expect(m.pod.day).toBe(2); // getLatestDayEntry().dayN — today's behavior, unchanged
  });

  it('flag-ON: the header reads the trading-day index (Day 3 for the in-progress day, never Day 0)', () => {
    scoreHistoryFlag.on = true;
    try {
      const m = buildArenaModel({ group: g, priceCtx: { now }, uid: 'u-you', mode: 'ranked' });
      expect(m.pod.day).toBe(3); // deriveCurrentTradingDay: latest day2 (6-15) ≠ today → 2+1
    } finally {
      scoreHistoryFlag.on = false;
    }
  });

  it('the arena header day === the recap current-day label (one index, both deriveCurrentTradingDay)', () => {
    scoreHistoryFlag.on = true;
    try {
      const m = buildArenaModel({ group: g, priceCtx: { now }, uid: 'u-you', mode: 'ranked' });
      const h = buildScoreHistory({ group: g, battleChain: [todayDoc], uid: 'u-you', now });
      expect(h.currentTradingDay).toBe(m.pod.day);                     // 3 === 3
      expect(h.swapDays.find((d) => d.isCurrent).day).toBe(m.pod.day); // today's swaps read DAY 3, matching the header
    } finally {
      scoreHistoryFlag.on = false;
    }
  });

  it('C3 preserved: a BANKED day reads its banked dayN, and it AGREES with the trading-day index', () => {
    // "Today" IS banked (recordedDate matches) — the current doc maps to day2 (via
    // recordedDate, robust to gaps) AND deriveCurrentTradingDay returns 2; the two
    // axes agree on a banked day, no papering-over.
    scoreHistoryFlag.on = true;
    try {
      const bankedToday = Date.parse('2026-06-15T20:30:00.000Z'); // ET 2026-06-15 = day2's recordedDate
      const m = buildArenaModel({ group: g, priceCtx: { now: bankedToday }, uid: 'u-you', mode: 'ranked' });
      expect(m.pod.day).toBe(2);
      const day2Doc = {
        id: 'd2', status: 'completed', createdAt: '2026-06-15T13:30:00.000Z',
        timing: { tradingDays: ['2026-06-15'] }, trades: [{ symbolOut: 'C', symbolIn: 'D', lockedPoints: 1 }],
      };
      const h = buildScoreHistory({ group: g, battleChain: [day2Doc], uid: 'u-you', now: bankedToday });
      const cur = h.swapDays.find((d) => d.isCurrent);
      expect(cur.day).toBe(2);                 // banked dayN (recordedDate map) — C3
      expect(cur.dayIsOrdinalFallback).toBe(false);
      expect(cur.day).toBe(m.pod.day);         // banked dayN === trading-day index (agree)
    } finally {
      scoreHistoryFlag.on = false;
    }
  });
});

// ── Phase 2 / Phase 3 sampling + cut inputs (Amendment A3.1 / A4) ───────────
// The session trail and the ranked cut BOTH read these off the model. They are
// pinned here because the alternative — deriving either from seats[].score — is
// a §9 violation that would look plausible all session and be wrong all session:
// with the orb on, a rival's seat.score is its LIVE endpoint composite while
// YOUR seat keeps the BANKED getWeeklyComposite.
describe('buildArenaModel — scoresAtLast / seatLive / seatBanked (the ONE sampling basis)', () => {
  it('exposes all three, keyed by every seat', () => {
    const m = buildArenaModel({ ...BASE });
    const ids = m.seats.map((s) => s.id);
    expect(ids.length).toBe(4);
    for (const id of ids) {
      expect(Number.isFinite(m.scoresAtLast[id]), `scoresAtLast[${id}]`).toBe(true);
      expect(Number.isFinite(m.seatBanked[id]), `seatBanked[${id}]`).toBe(true);
      expect(typeof m.seatLive[id], `seatLive[${id}]`).toBe('boolean');
    }
  });

  it('agrees with the resolver + predicate seat for seat (one ruler, no second copy)', () => {
    const m = buildArenaModel({ ...BASE });
    const ctx = (id) => ({
      youId: 'u-you',
      youLiveScore: m.youLiveScore,
      liveComposites: m.liveComposites,
      banked: m.seatBanked[id],
    });
    for (const id of m.seats.map((s) => s.id)) {
      expect(m.scoresAtLast[id]).toBe(seatAltitude(id, ctx(id)));
      expect(m.seatLive[id]).toBe(seatHasLiveSample(id, ctx(id)));
    }
  });

  it('seatBanked is the banked CLOSE, independent of the live orb', () => {
    const on = buildArenaModel({ ...BASE });
    const off = offGate(() => buildArenaModel({ ...BASE }));
    expect(off.seatBanked).toEqual(on.seatBanked);
  });

  it('off-gate: no seat reports a live sample, so the trail would not extend', () => {
    const off = offGate(() => buildArenaModel({ ...BASE, mode: 'ranked' }));
    const live = Object.values(off.seatLive);
    expect(live.length).toBe(4);
    expect(live.every((v) => v === false)).toBe(true);
  });

  it('the mixed-basis hazard is REAL: a rival seat.score can differ from its banked close', () => {
    // Guards the reason A4 forbids deriving the cut from seats[].score. If this
    // ever stops holding, the hazard note (and the ruling) needs revisiting.
    const m = buildArenaModel({ ...BASE });
    const rival = m.seats.find((s) => !s.you && m.seatLive[s.id]);
    if (rival) expect(m.scoresAtLast[rival.id]).toBe(rival.score);
    const you = m.seats.find((s) => s.you);
    expect(you.score).toBe(m.seatBanked[you.id]); // YOUR seat stays banked
  });
});
