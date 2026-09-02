// api/_utils/archetypeScoringV2.test.js
//
// Archetype Rank Interface V2 — spec §5 tests 3, 4, 5, 7, 8, 11, 12, 13, 14, 15
// against the V2 pipeline (docs/specs/ARCHETYPE_RANK_INTERFACE_V2_BUILD_SPEC_V1_3.md).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of
// archetypeScoringV2.js pulls src/config/featureFlags.js and the fenced
// agentArchetypeConfig.js key list through the Node test env — never mock them.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeArchetypeRankingsV2,
  maybeComputeArchetypeRankingsV2,
  isArchetypeVectorsV2Enabled,
  ArchetypeScoringV2Error,
  GAME_MODES_V2,
  GAME_MODE_BLEND_V2,
  GAME_MODE_MIN_CANDIDATES_V2,
  ARCHETYPE_WEIGHTS_V2,
  ARCHETYPE_FILTERS_V2,
  ARCHETYPE_INTERLEAVE_V2,
  ARCHETYPE_CONSTRAINTS_V2,
  INTERLEAVE_TOP_N,
} from './archetypeScoringV2.js';
import { deriveAxes, AXIS_KEYS, round1 } from './axisDerivation.js';
import { VALID_ARCHETYPES } from './agentArchetypeConfig.js';

const V2_SOURCE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'archetypeScoringV2.js');
const ARCHETYPES = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];

// ---------- fixtures ----------

// A persisted-shape stockRankings entry (no `axes` — the fallback derives them;
// wrap with withAxes() for the producer path).
function stock(overrides = {}) {
  return {
    symbol: 'X',
    sectorName: 'Technology',
    fundamentalScore: 60,
    technicalScore: 70,
    momentumScore: 55,
    atrPercentile: 0.37,
    techRaw: { rsi: 55.2, bbPercentB: 0.61, distTo52wkHigh: 4.2, atrPercent: 2.1 },
    return1W: 1.5,
    return1M: -3.2,
    return3M: 8.1,
    sma200_position: 5.5,
    baggerBombFit: 50,
    ...overrides,
  };
}
const withAxes = (universe) => {
  const axes = deriveAxes(universe);
  return universe.map((s, i) => ({ ...s, axes: axes[i] }));
};
// Exact-arithmetic fixture: axes supplied directly (persisted shape).
function axed(symbol, axes, extra = {}) {
  return {
    symbol,
    sectorName: 'Technology',
    fundamentalScore: axes.quality ?? null,
    technicalScore: 50,
    momentumScore: axes.persistence ?? null,
    atrPercentile: 0.5,
    return1W: 1,
    return1M: 1,
    return3M: 1,
    sma200_position: 1,
    baggerBombFit: 50,
    ...extra,
    axes: {
      quality: null, strength: null, persistence: null, volatility: null,
      calm: null, dislocation: null, catalyst: null, sectorStanding: null,
      ...axes,
    },
  };
}
const collect = () => { const events = []; return { events, onEvent: (e) => events.push(e) }; };
const quiet = { onEvent: () => {} };
const run = (u, a, o = {}) => computeArchetypeRankingsV2(u, a, { gameMode: 'standard', ...quiet, ...o });

// Deterministic pseudo-random universe (LCG), ~15% nulls per field.
function fixtureUniverse(n = 60, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const maybeNull = (v) => (rnd() < 0.15 ? null : v);
  const sectors = ['Technology', 'Healthcare', 'Energy', 'Financials', 'Utilities', null];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      symbol: `S${String(i).padStart(2, '0')}`,
      sectorName: sectors[i % sectors.length],
      fundamentalScore: maybeNull(Math.round(rnd() * 100)),
      technicalScore: maybeNull(Math.round(rnd() * 100)),
      momentumScore: maybeNull(Math.round(rnd() * 100)),
      atrPercentile: Math.round(rnd() * 100) / 100,
      techRaw: { rsi: 50, bbPercentB: 0.5, distTo52wkHigh: 5, atrPercent: maybeNull(Number((rnd() * 6).toFixed(2))) },
      return1W: maybeNull(Number(((rnd() - 0.5) * 20).toFixed(2))),
      return1M: maybeNull(Number(((rnd() - 0.5) * 60).toFixed(2))),
      return3M: maybeNull(Number(((rnd() - 0.5) * 100).toFixed(2))),
      sma200_position: maybeNull(Number(((rnd() - 0.5) * 80).toFixed(2))),
      baggerBombFit: maybeNull(Math.round(rnd() * 100)),
    });
  }
  return out;
}

// ---------- test 8: fail closed ----------

describe('§4 contract — fail closed (test 8: missing gameMode, mandate, unknown archetype)', () => {
  const u = withAxes([stock({ symbol: 'A' })]);

  it('missing gameMode throws archetype_game_mode_required', () => {
    expect(() => computeArchetypeRankingsV2(u, 'analyst')).toThrow(/archetype_game_mode_required/);
    expect(() => computeArchetypeRankingsV2(u, 'analyst', {})).toThrow(ArchetypeScoringV2Error);
    let caught = null;
    try { computeArchetypeRankingsV2(u, 'analyst', { gameMode: undefined }); } catch (e) { caught = e; }
    expect(caught?.code).toBe('archetype_game_mode_required');
  });

  it("'mandate' is not a mode (P-5) — it throws like any unknown mode", () => {
    expect(GAME_MODES_V2).toEqual(['baggerBomb', 'standard', 'tournament', 'training', 'scouting']);
    expect(GAME_MODES_V2).not.toContain('mandate');
    expect(() => computeArchetypeRankingsV2(u, 'analyst', { gameMode: 'mandate' })).toThrow(/archetype_game_mode_required/);
    expect(() => computeArchetypeRankingsV2(u, 'analyst', { gameMode: 'BAGGERBOMB' })).toThrow(/archetype_game_mode_required/);
  });

  it('an unknown archetype throws archetype_unknown (P-14) — never a silent analyst fallback', () => {
    expect(() => run(u, 'copycat')).toThrow(/archetype_unknown/);
    expect(() => run(u, undefined)).toThrow(/archetype_unknown/);
    expect(() => run(u, 'ANALYST')).toThrow(/archetype_unknown/);
    for (const a of ARCHETYPES) expect(() => run(u, a, { minCandidates: 1 })).not.toThrow();
  });

  it('the flag is dark: maybeCompute… returns null and never throws while off', () => {
    expect(isArchetypeVectorsV2Enabled()).toBe(false);
    expect(maybeComputeArchetypeRankingsV2(u, 'analyst')).toBeNull();
    expect(maybeComputeArchetypeRankingsV2(u, 'copycat', { gameMode: 'mandate' })).toBeNull();
  });
});

// ---------- test 7: weights ----------

describe('§3.2 weight vectors (test 7)', () => {
  it('cover exactly the registry archetypes, are non-negative, name only axes, and each sums to 1.00', () => {
    expect(Object.keys(ARCHETYPE_WEIGHTS_V2).sort()).toEqual([...VALID_ARCHETYPES].sort());
    for (const w of Object.values(ARCHETYPE_WEIGHTS_V2)) {
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      for (const [axis, v] of Object.entries(w)) {
        expect(AXIS_KEYS).toContain(axis);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('P-6: Trend Follower carries no quality weight; Speculator no dislocation weight; the table is as specified', () => {
    expect(ARCHETYPE_WEIGHTS_V2).toEqual({
      momentum_chaser: { strength: 0.40, persistence: 0.45, volatility: 0.15 },
      contrarian: { quality: 0.40, persistence: 0.15, dislocation: 0.45 },
      degen: { strength: 0.20, persistence: 0.20, volatility: 0.60 },
      analyst: { quality: 0.50, strength: 0.30, persistence: 0.20 },
      diversifier: { quality: 0.30, strength: 0.30, persistence: 0.30, volatility: 0.10 },
      guardian: { quality: 0.45, strength: 0.05, persistence: 0.15, calm: 0.35 },
    });
    expect(Object.isFrozen(ARCHETYPE_WEIGHTS_V2)).toBe(true);
    expect(Object.isFrozen(ARCHETYPE_WEIGHTS_V2.guardian)).toBe(true);
  });
});

// ---------- test 15: blend + return shape ----------

describe('§4 game-mode term and return shape (test 15, P-7, R9)', () => {
  const u = () => [
    axed('A', { quality: 80, strength: 60, persistence: 70 }, { baggerBombFit: 90 }),
    axed('B', { quality: 50, strength: 40, persistence: 30 }, { baggerBombFit: null }),
  ];

  it('archetypeScore is the blend under baggerBomb and equals archetypeBaseScore under every other mode', () => {
    // analyst base A = .5·80 + .3·60 + .2·70 = 72 ; B = 25 + 12 + 6 = 43
    const bb = run(u(), 'analyst', { gameMode: 'baggerBomb', minCandidates: 1 });
    expect(bb.map((s) => s.symbol)).toEqual(['A']); // B: null baggerBombFit ⇒ excluded under baggerBomb (R10)
    expect(bb[0].archetypeBaseScore).toBe(72);
    expect(bb[0].archetypeScore).toBe(round1(0.8 * 72 + 0.2 * 90)); // 75.6
    for (const mode of ['standard', 'tournament', 'training', 'scouting']) {
      const r = run(u(), 'analyst', { gameMode: mode, minCandidates: 1 });
      expect(r.map((s) => s.symbol)).toEqual(['A', 'B']);
      for (const s of r) expect(s.archetypeScore).toBe(s.archetypeBaseScore);
      expect(r[0].archetypeBaseScore).toBe(72);
      expect(r[1].archetypeBaseScore).toBe(43);
    }
  });

  it('GAME_MODE_BLEND_V2 has exactly one entry per mode; only baggerBomb carries the game-mode term', () => {
    expect(Object.keys(GAME_MODE_BLEND_V2).sort()).toEqual([...GAME_MODES_V2].sort());
    expect(GAME_MODE_BLEND_V2.baggerBomb).toEqual({ archetypeBaseScore: 0.80, baggerBombFit: 0.20 });
    for (const mode of ['standard', 'tournament', 'training', 'scouting']) {
      expect(GAME_MODE_BLEND_V2[mode]).toEqual({ archetypeBaseScore: 1, baggerBombFit: 0 });
    }
  });

  it('returns new objects carrying axes + both scores and never mutates the input', () => {
    const input = u();
    const before = JSON.stringify(input);
    const r = run(input, 'analyst', { minCandidates: 1 });
    expect(JSON.stringify(input)).toBe(before);
    expect(r[0]).not.toBe(input[0]);
    expect(r[0]).toMatchObject({ symbol: 'A', archetypeScore: 72, archetypeBaseScore: 72 });
    expect(r[0].axes).toEqual(input[0].axes);
  });
});

// ---------- test 3: null exclusion, no imputation, coverage event ----------

describe('R10 null exclusion + insufficient_axis_coverage (test 3)', () => {
  const five = () => withAxes([
    stock({ symbol: 'FULL' }),
    stock({ symbol: 'NOFUND', fundamentalScore: null }),
    stock({ symbol: 'NOMOM', momentumScore: null }),
    stock({ symbol: 'NOSMA', sma200_position: null }), // dislocation null
    stock({ symbol: 'NOATR', techRaw: { rsi: 50, bbPercentB: 0.5, distTo52wkHigh: 1, atrPercent: null } }), // volatility/calm null
  ]);

  it('a null weighted (or filtered) axis excludes the name — for exactly the archetypes that use it (P-6)', () => {
    const syms = (a) => run(five(), a, { minCandidates: 1 }).map((s) => s.symbol).sort();
    expect(syms('momentum_chaser')).toEqual(['FULL', 'NOFUND', 'NOSMA']);
    expect(syms('degen')).toEqual(['FULL', 'NOFUND', 'NOSMA']);
    expect(syms('analyst')).toEqual(['FULL', 'NOATR', 'NOSMA']);
    expect(syms('contrarian')).toEqual(['FULL', 'NOATR']);
    expect(syms('diversifier')).toEqual(['FULL', 'NOSMA']);
    expect(syms('guardian')).toEqual(['FULL', 'NOSMA']);
  });

  it('never imputes: an excluded name is absent (never scored as average) and the module carries no neutral default', () => {
    const r = run(withAxes([stock({ symbol: 'A' }), stock({ symbol: 'B', fundamentalScore: null })]), 'analyst', { minCandidates: 1 });
    expect(r.map((s) => s.symbol)).toEqual(['A']);
    const src = readFileSync(V2_SOURCE, 'utf8');
    expect(src).not.toMatch(/\?\?\s*50\b/);
    expect(src).not.toMatch(/\?\?\s*0\.5\b/);
    expect(src).not.toMatch(/\|\|\s*50\b/);
  });

  it('emits insufficient_axis_coverage with correct counts against the pinned minimum, and stays silent at or above it', () => {
    const { events, onEvent } = collect();
    const r = run(five(), 'guardian', { minCandidates: 5, onEvent });
    expect(r.map((s) => s.symbol).sort()).toEqual(['FULL', 'NOSMA']);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'insufficient_axis_coverage',
      archetype: 'guardian',
      gameMode: 'standard',
      minCandidates: 5,
      candidates: 2,
      universe: 5,
      axisNullCounts: { quality: 1, strength: 0, persistence: 1, volatility: 1, calm: 1, dislocation: 1, catalyst: 5, sectorStanding: 5 },
      gateFailCounts: { 'quality>=45': 1, 'volatility<=75': 1 },
      nullAxisExclusions: { persistence: 1 },
      baggerBombFitNullExclusions: 0,
      derivedAxes: false,
    });
    const silent = collect();
    run(five(), 'guardian', { minCandidates: 2, onEvent: silent.onEvent });
    expect(silent.events).toEqual([]);
  });

  it('mode defaults apply when minCandidates is absent (§3.4; standard mirrors the §6 flip gate)', () => {
    expect(GAME_MODE_MIN_CANDIDATES_V2).toEqual({ baggerBomb: 35, standard: 35, tournament: 15, training: 1, scouting: 10 });
    const u = withAxes([stock({ symbol: 'A' })]);
    const { events, onEvent } = collect();
    run(u, 'analyst', { gameMode: 'training', onEvent });
    expect(events).toEqual([]);
    run(u, 'analyst', { gameMode: 'scouting', onEvent });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'insufficient_axis_coverage', minCandidates: 10, candidates: 1 });
  });
});

// ---------- test 4 (+ 11 i/ii): filters ----------

describe('§3.1 filters (test 4 — signed percent P-1, week floor P-13, null fails)', () => {
  const syms = (u, a, o = {}) => run(withAxes(u), a, { minCandidates: 1, ...o }).map((s) => s.symbol).sort();

  it('the config table is as specified', () => {
    expect(ARCHETYPE_FILTERS_V2).toEqual({
      momentum_chaser: [],
      contrarian: [{ axis: 'quality', min: 35 }, { field: 'return1M', min: -25 }, { field: 'return1W', minFn: 'weekFloor' }],
      degen: [],
      analyst: [{ axis: 'quality', min: 40 }],
      diversifier: [],
      guardian: [{ axis: 'quality', min: 45 }, { axis: 'volatility', max: 75 }],
    });
  });

  it('analyst: quality ≥ 40 inclusive; null fails', () => {
    expect(syms([stock({ symbol: 'IN', fundamentalScore: 40 }), stock({ symbol: 'OUT', fundamentalScore: 39 }), stock({ symbol: 'NULL', fundamentalScore: null })], 'analyst'))
      .toEqual(['IN']);
  });

  it('guardian: quality ≥ 45 and volatility ≤ 75 inclusive; null fails each', () => {
    expect(syms([
      stock({ symbol: 'IN', fundamentalScore: 45, atrPercentile: 0.75 }),
      stock({ symbol: 'LOWQ', fundamentalScore: 44 }),
      stock({ symbol: 'HIVOL', atrPercentile: 0.76 }),
      stock({ symbol: 'NULLVOL', atrPercentile: null }),
      stock({ symbol: 'NULLQ', fundamentalScore: null }),
    ], 'guardian')).toEqual(['IN']);
  });

  it('contrarian in an UP week (doc median +1.2 ⇒ floor 0): quality ≥ 35, return1M ≥ −25, return1W ≥ 0; each null fails (test 11 i/ii)', () => {
    const base = { fundamentalScore: 60 };
    const u = [
      stock({ symbol: 'IN', ...base, return1M: -25, return1W: 0 }),
      stock({ symbol: 'MILD', ...base, return1M: -3.2, return1W: 0.5 }),   // a −0.25 threshold (C-1) would wrongly exclude this
      stock({ symbol: 'COLLAPSE', ...base, return1M: -25.01, return1W: 1 }),
      stock({ symbol: 'LOWQ', fundamentalScore: 34, return1W: 1 }),
      stock({ symbol: 'FELL', ...base, return1W: -0.01 }),
      stock({ symbol: 'NULL1W', ...base, return1W: null }),
      stock({ symbol: 'NULL1M', ...base, return1M: null, return1W: 1 }),
      stock({ symbol: 'NULLQ', fundamentalScore: null, return1W: 1 }),
    ];
    expect(syms(u, 'contrarian', { universeMedianReturn1W: 1.2 })).toEqual(['IN', 'MILD']);
  });

  it('contrarian in a DOWN week (doc median −2.5 ⇒ floor −2.5): fell less than the median name passes (test 11 i)', () => {
    const u = [
      stock({ symbol: 'HELD', return1W: -2.4 }),
      stock({ symbol: 'ATFLOOR', return1W: -2.5 }),
      stock({ symbol: 'WORSE', return1W: -2.6 }),
      stock({ symbol: 'FLAT', return1W: 0 }),
    ];
    expect(syms(u, 'contrarian', { universeMedianReturn1W: -2.5 })).toEqual(['ATFLOOR', 'FLAT', 'HELD']);
  });

  it('the week floor: supplied doc median wins; null median ⇒ the absolute ≥ 0 gate; unsupplied on a full universe computes the same value', () => {
    const u = [stock({ symbol: 'A', return1W: -1 }), stock({ symbol: 'B', return1W: -3 }), stock({ symbol: 'C', return1W: 2 })];
    expect(syms(u, 'contrarian')).toEqual(['A', 'C']);                                        // median −1 ⇒ floor −1
    expect(syms(u, 'contrarian', { universeMedianReturn1W: -1 })).toEqual(['A', 'C']);
    expect(syms(u, 'contrarian', { universeMedianReturn1W: null })).toEqual(['C']);           // floor 0
    expect(syms(u, 'contrarian', { universeMedianReturn1W: -5 })).toEqual(['A', 'B', 'C']);   // floor −5
    expect(syms(u, 'contrarian', { universeMedianReturn1W: 4 })).toEqual(['C']);              // min(0, 4) = 0
  });

  it('a known subset without the doc median throws axes_subset_unavailable — the floor is never computed on a subset', () => {
    const u = withAxes([stock({ symbol: 'A' }), stock({ symbol: 'B' })]);
    expect(() => run(u.slice(0, 1), 'contrarian', { universeSize: 2 })).toThrow(/axes_subset_unavailable/);
    expect(run(u.slice(0, 1), 'contrarian', { universeSize: 2, universeMedianReturn1W: 0.5, minCandidates: 1 })).toHaveLength(1);
    expect(run(u.slice(0, 1), 'analyst', { universeSize: 2, minCandidates: 1 })).toHaveLength(1); // no week floor needed
  });
});

// ---------- test 11 (iii): contrarian ordering ----------

describe('Contrarian fixtures (test 11 iii)', () => {
  it('among passers, (q90, d70, p35) outranks (q60, d98, p10)', () => {
    const u = [
      axed('A', { quality: 90, dislocation: 70, persistence: 35 }, { return1W: 1, return1M: -5 }),
      axed('B', { quality: 60, dislocation: 98, persistence: 10 }, { return1W: 1, return1M: -5 }),
    ];
    const r = run(u, 'contrarian', { minCandidates: 1, universeMedianReturn1W: 0 });
    expect(r.map((s) => s.symbol)).toEqual(['A', 'B']);
    expect(Math.abs(r[0].archetypeBaseScore - 72.75)).toBeLessThanOrEqual(0.05); // .4·90 + .15·35 + .45·70
    expect(Math.abs(r[1].archetypeBaseScore - 69.6)).toBeLessThanOrEqual(0.05);  // .4·60 + .15·10 + .45·98
  });
});

// ---------- test 5: bounded interleave ----------

describe('§3.3(a) bounded sector interleave — Diversifier only (test 5)', () => {
  // Diversifier weights .3/.3/.3/.1 over quality/strength/persistence/volatility:
  // setting all four to S makes the base score exactly S.
  const dv = (symbol, S, sectorName) => axed(symbol, { quality: S, strength: S, persistence: S, volatility: S, calm: 100 - S }, { sectorName });
  const universe = () => [
    dv('T1', 95, 'Technology'), dv('T2', 94, 'Technology'), dv('T3', 93, 'Technology'),
    dv('H1', 85, 'Healthcare'), dv('H2', 84, 'Healthcare'),
    dv('E1', 83, 'Energy'), dv('F1', 82, 'Financials'), dv('U1', 81, 'Utilities'),
    dv('C1', 80, 'Consumer'), dv('I1', 79, 'Industrials'), dv('M1', 78, 'Materials'),
    dv('K1', 77, 'Unknown'), dv('N1', 76, null),
  ];
  const order = (u = universe(), o = {}) => run(u, 'diversifier', { minCandidates: 1, ...o }).map((s) => s.symbol);

  it('config as specified; only the Diversifier interleaves', () => {
    expect(ARCHETYPE_INTERLEAVE_V2).toEqual({ diversifier: { targetDistinctSectorsTop10: 5, maxPerSectorTop10: 2, maxInterleaveScoreGap: 10 } });
    expect(INTERLEAVE_TOP_N).toBe(10);
    // The same fixture under the analyst keeps pure global order (T1..T3 first).
    expect(run(universe(), 'analyst', { minCandidates: 1 }).map((s) => s.symbol).slice(0, 3)).toEqual(['T1', 'T2', 'T3']);
  });

  it('produces the specified order: breadth to 5 sectors within the gap, cap 2 per sector in the top 10, null sector fill-only, global order below 10', () => {
    expect(order()).toEqual(['T1', 'H1', 'E1', 'F1', 'U1', 'T2', 'H2', 'C1', 'I1', 'M1', 'T3', 'K1', 'N1']);
  });

  it('is deterministic and input-order independent', () => {
    const a = order();
    expect(order(universe().reverse())).toEqual(a);
    expect(order([...universe()].sort(() => 0.5))).toEqual(a);
    expect(order()).toEqual(a);
  });

  it('top-10 invariants: ≥ 5 distinct sectors, no sector more than twice, null/Unknown never among the breadth placements', () => {
    const top = run(universe(), 'diversifier', { minCandidates: 1 }).slice(0, INTERLEAVE_TOP_N);
    const counts = {};
    for (const s of top) if (s.sectorName && s.sectorName !== 'Unknown') counts[s.sectorName] = (counts[s.sectorName] || 0) + 1;
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(5);
    for (const c of Object.values(counts)) expect(c).toBeLessThanOrEqual(2);
    for (const s of top.slice(0, 5)) expect(s.sectorName && s.sectorName !== 'Unknown').toBe(true);
  });

  it('the anchor is always eligible and the gap is never exceeded: a candidate exactly 10 below qualifies, 10.1 below does not', () => {
    expect(order([dv('T1', 95, 'Technology'), dv('T2', 90, 'Technology'), dv('H1', 80, 'Healthcare')])).toEqual(['T1', 'H1', 'T2']);
    expect(order([dv('T1', 95, 'Technology'), dv('T2', 90, 'Technology'), dv('H1', 79.9, 'Healthcare')])).toEqual(['T1', 'T2', 'H1']);
  });

  it('gap blocked: stops the breadth phase, emits the event with counts, then fills in global order', () => {
    const { events, onEvent } = collect();
    expect(order([dv('T1', 95, 'Technology'), dv('T2', 94, 'Technology'), dv('H1', 70, 'Healthcare'), dv('E1', 60, 'Energy')], { onEvent }))
      .toEqual(['T1', 'T2', 'H1', 'E1']);
    const gap = events.filter((e) => e.type === 'diversifier_interleave_gap_blocked');
    expect(gap).toHaveLength(1);
    expect(gap[0]).toEqual({
      type: 'diversifier_interleave_gap_blocked',
      archetype: 'diversifier',
      gameMode: 'standard',
      placed: 1,
      distinctSectors: 1,
      targetDistinctSectors: 5,
      anchor: 'T2',
      anchorScore: 94,
      bestUnrepresented: 'H1',
      bestUnrepresentedScore: 70,
      maxInterleaveScoreGap: 10,
    });
  });

  it('skipped candidates are never reconsidered in the breadth phase (the anchor moves past them)', () => {
    // After H1 is placed over T2/T3 the next anchor is H2 (84), not T2 (94): F1 (82)
    // qualifies against H2 and would be blocked against T2 — so F1 and U1 are
    // breadth placements (positions 4-5) rather than a gap block.
    expect(order().slice(0, 5)).toEqual(['T1', 'H1', 'E1', 'F1', 'U1']);
    expect(order().indexOf('T2')).toBeGreaterThan(order().indexOf('U1'));
  });

  it('max-2 per sector holds in the top 10 and only there', () => {
    const o = order();
    expect(o.indexOf('T3')).toBeGreaterThanOrEqual(INTERLEAVE_TOP_N);
    expect(o.slice(INTERLEAVE_TOP_N)).toEqual(['T3', 'K1', 'N1']); // below rank 10: global order, no cap
  });

  it('null / Unknown sector: never a breadth candidate, allowed in the fill and below', () => {
    const o = order([dv('K1', 99, 'Unknown'), dv('N1', 98, null), dv('T1', 90, 'Technology'), dv('H1', 85, 'Healthcare')]);
    // breadth: T1 (anchor, unrepresented) then H1; fill: K1, N1 by global order
    expect(o).toEqual(['T1', 'H1', 'K1', 'N1']);
  });

  it('ties: quality desc, then symbol asc', () => {
    // A and B score 77 with different quality; C wins outright.
    const tie = [
      axed('A', { quality: 60, strength: 90, persistence: 80, volatility: 80 }, { sectorName: 'Utilities' }),
      axed('B', { quality: 70, strength: 80, persistence: 80, volatility: 80 }, { sectorName: 'Energy' }),
      axed('C', { quality: 90, strength: 74, persistence: 74, volatility: 74 }, { sectorName: 'Technology' }),
    ];
    expect(order(tie)).toEqual(['C', 'B', 'A']);
    const sameQuality = [
      axed('Q', { quality: 70, strength: 80, persistence: 80, volatility: 80 }, { sectorName: 'Utilities' }),
      axed('P', { quality: 70, strength: 80, persistence: 80, volatility: 80 }, { sectorName: 'Energy' }),
    ];
    expect(order(sameQuality)).toEqual(['P', 'Q']);
  });
});

// ---------- test 12: parity + the P-8 subset rule ----------

describe('producer-path vs fallback-path parity (test 12) and the P-8 subset rule', () => {
  const universe = fixtureUniverse(60);

  it('is byte-identical whether axes are persisted (producer) or derived in the fallback, for every archetype', () => {
    for (const a of ARCHETYPES) {
      const persistedEvents = collect();
      const persisted = run(withAxes(universe), a, { minCandidates: 1, onEvent: persistedEvents.onEvent });
      const derivedEvents = collect();
      const derived = run(universe, a, { minCandidates: 1, onEvent: derivedEvents.onEvent });
      expect(JSON.stringify(derived)).toBe(JSON.stringify(persisted));
      expect(persistedEvents.events.some((e) => e.type === 'axes_fallback_computed')).toBe(false);
      expect(derivedEvents.events.filter((e) => e.type === 'axes_fallback_computed')).toEqual([
        { type: 'axes_fallback_computed', archetype: a, gameMode: 'standard', count: 60, universeSize: null },
      ]);
    }
  });

  it('a JSON round trip of the persisted doc changes nothing', () => {
    const doc = withAxes(universe);
    const a = run(doc, 'contrarian', { minCandidates: 1 });
    const b = run(JSON.parse(JSON.stringify(doc)), 'contrarian', { minCandidates: 1 });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('a known subset without axes throws axes_subset_unavailable (cross-sectional axes need the full universe)', () => {
    expect(() => run(universe.slice(0, 10), 'analyst', { universeSize: 60 })).toThrow(/axes_subset_unavailable/);
    // no universeSize ⇒ derives over the input (the transitional doc case) and logs
    const { events, onEvent } = collect();
    expect(() => run(universe.slice(0, 10), 'analyst', { minCandidates: 1, onEvent })).not.toThrow();
    expect(events[0]).toMatchObject({ type: 'axes_fallback_computed', count: 10, universeSize: null });
  });

  it('a subset WITH persisted axes scores without derivation, and its per-name scores equal the full-universe scores', () => {
    const full = withAxes(universe);
    const subset = full.slice(0, 12);
    const { events, onEvent } = collect();
    const r = run(subset, 'analyst', { universeSize: 60, universeMedianReturn1W: 0.3, minCandidates: 1, onEvent });
    expect(events.some((e) => e.type === 'axes_fallback_computed')).toBe(false);
    const fullR = run(full, 'analyst', { minCandidates: 1 });
    expect(r.length).toBeGreaterThan(0);
    for (const s of r) expect(s.archetypeBaseScore).toBe(fullR.find((x) => x.symbol === s.symbol).archetypeBaseScore);
  });

  it('never mixes persisted and derived axes: one axes-less name forces full derivation for all', () => {
    const mixed = withAxes(universe);
    delete mixed[3].axes;
    const { events, onEvent } = collect();
    const r = run(mixed, 'analyst', { minCandidates: 1, onEvent });
    expect(events.filter((e) => e.type === 'axes_fallback_computed')).toHaveLength(1);
    expect(events[0].count).toBe(60);
    expect(JSON.stringify(r)).toBe(JSON.stringify(run(universe, 'analyst', { minCandidates: 1 })));
  });
});

// ---------- test 13: guardian vs sector breadth ----------

describe('Guardian ordering is unaffected by sector breadth (test 13, R4 / R11)', () => {
  it('same names, one sector vs many ⇒ identical order and scores; no archetype SCORE depends on sector', () => {
    const u = fixtureUniverse(40, 11);
    const oneSector = u.map((s) => ({ ...s, sectorName: 'Technology' }));
    const rows = (x, a) => run(withAxes(x), a, { minCandidates: 1 }).map((s) => [s.symbol, s.archetypeScore, s.archetypeBaseScore]);
    expect(rows(oneSector, 'guardian')).toEqual(rows(u, 'guardian'));
    for (const a of ARCHETYPES) {
      const spread = Object.fromEntries(rows(u, a).map(([sym, sc]) => [sym, sc]));
      const flat = Object.fromEntries(rows(oneSector, a).map(([sym, sc]) => [sym, sc]));
      expect(flat).toEqual(spread);
    }
  });
});

// ---------- test 14: narration ----------

describe('§3.5 narration strings — every factual claim holds on the post-filter list (test 14)', () => {
  const u = withAxes(fixtureUniverse(60, 3));
  const CSV_COLUMNS = new Set(['TICKER', 'SECTOR', 'FUND', 'TECH', 'BB_FIT', 'ATR_PCT', 'ARCH']);

  it('one string per archetype, each referencing only CSV-visible columns', () => {
    expect(Object.keys(ARCHETYPE_CONSTRAINTS_V2).sort()).toEqual([...ARCHETYPES].sort());
    for (const text of Object.values(ARCHETYPE_CONSTRAINTS_V2)) {
      for (const token of text.match(/\b[A-Z][A-Z_]{2,}\b/g) || []) expect(CSV_COLUMNS.has(token), token).toBe(true);
    }
  });

  it('analyst: "clears your quality floor (FUND ≥ 40)"; "quality first, chart setup second"', () => {
    expect(ARCHETYPE_CONSTRAINTS_V2.analyst).toContain('FUND ≥ 40');
    const r = run(u, 'analyst', { minCandidates: 1 });
    expect(r.length).toBeGreaterThan(0);
    for (const s of r) { expect(s.axes.quality).toBeGreaterThanOrEqual(40); expect(s.fundamentalScore).toBeGreaterThanOrEqual(40); }
    const w = ARCHETYPE_WEIGHTS_V2.analyst;
    expect(w.quality).toBeGreaterThan(w.strength);
    expect(w.strength).toBeGreaterThan(w.persistence);
  });

  it('guardian: quality floor + "volatility cap (ATR_PCT ≤ 0.75)"; "ranks quality and calm"', () => {
    expect(ARCHETYPE_CONSTRAINTS_V2.guardian).toContain('ATR_PCT ≤ 0.75');
    const r = run(u, 'guardian', { minCandidates: 1 });
    expect(r.length).toBeGreaterThan(0);
    for (const s of r) {
      expect(s.axes.quality).toBeGreaterThanOrEqual(45);
      expect(s.axes.volatility).toBeLessThanOrEqual(75);
      expect(s.atrPercentile).toBeLessThanOrEqual(0.75);
    }
    const top2 = Object.entries(ARCHETYPE_WEIGHTS_V2.guardian).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
    expect(new Set(top2)).toEqual(new Set(['quality', 'calm']));
  });

  it('contrarian: quality floor; "down more than 25% on the month are excluded"; the week rule in up and down weeks', () => {
    expect(ARCHETYPE_CONSTRAINTS_V2.contrarian).toContain('25%');
    const up = run(u, 'contrarian', { universeMedianReturn1W: 0.4, minCandidates: 1 });
    expect(up.length).toBeGreaterThan(0);
    for (const s of up) {
      expect(s.axes.quality).toBeGreaterThanOrEqual(35);
      expect(s.return1M).toBeGreaterThanOrEqual(-25);
      expect(s.return1W).toBeGreaterThanOrEqual(0);
    }
    const down = run(u, 'contrarian', { universeMedianReturn1W: -3, minCandidates: 1 });
    for (const s of down) expect(s.return1W).toBeGreaterThanOrEqual(-3);
    expect(down.length).toBeGreaterThanOrEqual(up.length);
  });

  it('degen: "Fundamentals are not part of this rank"; "Prefer high ATR_PCT"', () => {
    const w = ARCHETYPE_WEIGHTS_V2.degen;
    expect(w.quality).toBeUndefined();
    expect(Object.keys(w).sort()).toEqual(['persistence', 'strength', 'volatility']);
    expect(w.volatility).toBe(Math.max(...Object.values(w)));
    const r = run(withAxes([stock({ symbol: 'NOFUND', fundamentalScore: null }), stock({ symbol: 'X' })]), 'degen', { minCandidates: 1 });
    expect(r.map((s) => s.symbol).sort()).toEqual(['NOFUND', 'X']);
  });

  it('momentum_chaser: "by momentum persistence and chart strength"', () => {
    const w = ARCHETYPE_WEIGHTS_V2.momentum_chaser;
    expect(w.persistence + w.strength).toBeGreaterThanOrEqual(0.85);
    const top2 = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
    expect(new Set(top2)).toEqual(new Set(['persistence', 'strength']));
    expect(w.quality).toBeUndefined();
    expect(w.dislocation).toBeUndefined();
  });

  it('diversifier: "ordered for breadth near the top: the best name from each of several sectors comes first"; "at least 5 sectors, no sector more than twice" holds on the interleaved top 10', () => {
    const dv = (symbol, S, sectorName) => axed(symbol, { quality: S, strength: S, persistence: S, volatility: S, calm: 100 - S }, { sectorName });
    const fixture = [
      dv('T1', 95, 'Technology'), dv('T2', 94, 'Technology'), dv('T3', 93, 'Technology'),
      dv('H1', 85, 'Healthcare'), dv('H2', 84, 'Healthcare'), dv('E1', 83, 'Energy'),
      dv('F1', 82, 'Financials'), dv('U1', 81, 'Utilities'), dv('C1', 80, 'Consumer'),
      dv('I1', 79, 'Industrials'), dv('M1', 78, 'Materials'),
    ];
    const r = run(fixture, 'diversifier', { minCandidates: 1 });
    const top = r.slice(0, INTERLEAVE_TOP_N);
    const counts = {};
    for (const s of top) counts[s.sectorName] = (counts[s.sectorName] || 0) + 1;
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(5);
    for (const c of Object.values(counts)) expect(c).toBeLessThanOrEqual(2);
    const bestBySector = {};
    for (const s of [...fixture].sort((a, b) => b.axes.quality - a.axes.quality)) bestBySector[s.sectorName] ??= s.symbol;
    const firstFive = r.slice(0, 5);
    expect(new Set(firstFive.map((s) => s.sectorName)).size).toBe(5);
    for (const s of firstFive) expect(s.symbol).toBe(bestBySector[s.sectorName]);
  });
});
