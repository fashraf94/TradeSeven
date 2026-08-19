// api/_utils/agentGuardrails.test.js
// Phase 4B: guardrail enforcement unit tests.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

// Release 2 PR-e — flip SECTOR_CAP_MODE per-test via a live getter (every other
// real flag preserved; ARCHETYPE_INTEGRITY_MODE also walked to prove the
// DECOUPLE — the cap no longer rides it). The functions read the flags inside
// the call, so the getters take effect at call time. Defaults 'off' keep the
// pre-existing suite flag-OFF (byte-identical).
const { flagState } = vi.hoisted(() => ({ flagState: { sectorCap: 'off', integrity: 'off' } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SECTOR_CAP_MODE() { return flagState.sectorCap; },
  get ARCHETYPE_INTEGRITY_MODE() { return flagState.integrity; },
}));

import { applyGuardrails, injectDiversifierSectorCap, resolveSectorSlotObserveCap, DIVERSIFIER_SECTOR_CAP_PCT } from './agentGuardrails.js';
// Real value via the importOriginal spread above (the mock only walks the
// sector-cap flags) — used to behavior-branch the dark-half suite below.
import { PROFIT_TARGET_EXECUTOR_ENABLED } from '../../src/config/featureFlags.js';

// ==================== FIXTURES ====================

function makeBattle({
  star = [],
  core = [],
  support = [],
  bench = { stocks: [], crypto: null },
  startingPrices = {},
  thresholdHistory = {},
} = {}) {
  return {
    id: 'battle_test',
    portfolio: { star, core, support, bench, startingPrices },
    thresholdHistory,
    agentContext: {},
  };
}

const NVDA_POSITION = {
  symbol: 'NVDA',
  name: 'NVIDIA',
  baseATR: 3.0,
  isCrypto: false,
  sector: 'Technology',
  swapPrice: 100,
};

const AMD_BENCH = {
  symbol: 'AMD',
  name: 'AMD',
  baseATR: 3.5,
  isCrypto: false,
  sector: 'Technology',
};

// ==================== TESTS ====================

describe('applyGuardrails — no-op paths', () => {
  it('returns passthrough when guardrails array is empty', () => {
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [],
      battle: makeBattle(),
      prices: {},
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
    expect(result.symbolOut).toBeNull();
  });

  it('returns passthrough when guardrails is undefined', () => {
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: undefined,
      battle: makeBattle(),
      prices: {},
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
  });

  it('returns passthrough when haikuResult is null', () => {
    const result = applyGuardrails({
      haikuResult: null,
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle: makeBattle({ star: [NVDA_POSITION] }),
      prices: { NVDA: { current: 99 } }, // only -1% — no breach
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
  });
});

describe('applyGuardrails — stopLoss (hard)', () => {
  it('forces SWAP when HOLD position breaches stop-loss', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD', conviction: 60, hypothesis: 'Hold' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 90 }, AMD: { current: 105, changePercent: 1.2 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.symbolIn).toBe('AMD');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced).toBeTruthy();
    expect(forced.type).toBe('stopLoss');
    expect(forced.symbol).toBe('NVDA');
    expect(forced.actual).toBeLessThanOrEqual(-10);
    // threshold must report the CONFIGURED guardrail value, not the actual P&L.
    expect(forced.threshold).toBe(-8);
    expect(forced.threshold).not.toBe(forced.actual);
    // statusMessage should render configured threshold (8%), not actual P&L.
    expect(result.statusMessage).toContain('stop-loss at 8%');
    expect(result.sourceNote).toBe('guardrail_stopLoss');
  });

  it('does not trigger at exactly -7% when threshold is 8%', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 93 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides).toEqual([]);
  });

  it('reinforces rather than double-swapping when Haiku already exits the breached symbol', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'NVDA', symbolIn: 'AMD', conviction: 80 },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 88 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.symbolIn).toBe('AMD');
    const reinforced = result.overrides.find(o => o.action === 'reinforced_haiku');
    expect(reinforced).toBeTruthy();
    // Keystone V1.4 §3.1 (A2): a reinforced protective exit must surface its
    // guardrail sourceNote (not null) so the Knob B hurdle hook bypasses the floor.
    expect(result.sourceNote).toBe('guardrail_stopLoss');
  });

  it('respects LOCKED positions — does not force exit', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 85 }, AMD: { current: 105, changePercent: 1 } },
      lockedPositions: new Set(['NVDA']),
    });
    expect(result.decision).toBe('HOLD');
    const blocked = result.overrides.find(o => o.action === 'blocked_by_lock');
    expect(blocked).toBeTruthy();
    expect(blocked.symbol).toBe('NVDA');
  });

  it('defers to next tick when bench is empty', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 85 } },
    });
    expect(result.decision).toBe('HOLD');
    const deferred = result.overrides.find(o => o.action === 'forced_exit_no_bench');
    expect(deferred).toBeTruthy();
  });

  it('picks the worst breacher when multiple positions violate', () => {
    const msft = { ...NVDA_POSITION, symbol: 'MSFT', swapPrice: 400 };
    const battle = makeBattle({
      star: [NVDA_POSITION, msft],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: {
        NVDA: { current: 91 }, // -9%
        MSFT: { current: 340 }, // -15% ← worse
        AMD: { current: 105, changePercent: 1.2 },
      },
    });
    expect(result.symbolOut).toBe('MSFT');
    expect(
      result.overrides.some(o => o.action === 'pending_next_tick' && o.symbol === 'NVDA')
    ).toBe(true);
  });
});

describe('applyGuardrails — trailingStop (hard)', () => {
  it('triggers when drawdown from implied peak exceeds threshold', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
      thresholdHistory: { NVDA: { maxMultiplier: 5 } }, // peak = entry * (1 + 5 * 3% / 100) = 115
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' }],
      battle,
      // current = 102 → drawdown from 115 = -11.3%
      prices: { NVDA: { current: 102 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced.type).toBe('trailingStop');
    // threshold must be the CONFIGURED trailing-stop value, not the actual drawdown.
    expect(forced.threshold).toBe(-10);
    expect(forced.actual).not.toBe(forced.threshold);
    expect(result.statusMessage).toContain('trailing stop at 10%');
  });

  it('does not trigger when position was never in profit (peak = 0)', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
      thresholdHistory: { NVDA: { maxMultiplier: 0 } },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 85 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides.filter(o => o.action === 'forced_exit')).toEqual([]);
  });

  it('yields to stopLoss when both would trigger on same position', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
      thresholdHistory: { NVDA: { maxMultiplier: 5 } },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [
        { type: 'stopLoss', value: 5, unit: '%', enforcement: 'hard' },
        { type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' },
      ],
      battle,
      prices: { NVDA: { current: 90 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('SWAP');
    const forced = result.overrides.find(o => o.action === 'forced_exit');
    expect(forced.type).toBe('stopLoss'); // stop-loss wins
  });
});

describe('applyGuardrails — maxSectorWeight (hard)', () => {
  it('blocks SWAP that would push sector above cap', () => {
    const tech1 = { ...NVDA_POSITION, symbol: 'NVDA', sector: 'Technology' };
    const tech2 = { ...NVDA_POSITION, symbol: 'MSFT', sector: 'Technology' };
    const fin = { ...NVDA_POSITION, symbol: 'JPM', sector: 'Financials', swapPrice: 180 };
    const amdTech = { ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' };

    const battle = makeBattle({
      star: [tech1, tech2],
      core: [fin],
      bench: { stocks: [amdTech], crypto: null },
    });
    // Haiku wants to SWAP JPM (Financials) for AMD (Tech) → tech goes from 2/3 to 3/3 = 100%
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
      guardrails: [{ type: 'maxSectorWeight', value: 50, unit: '%', enforcement: 'hard' }],
      battle,
      prices: {
        NVDA: { current: 100 }, MSFT: { current: 100 }, JPM: { current: 185 },
        AMD: { current: 105, changePercent: 1 },
      },
    });
    expect(result.decision).toBe('HOLD');
    const blocked = result.overrides.find(o => o.action === 'blocked_swap');
    expect(blocked.type).toBe('maxSectorWeight');
  });

  it('allows SWAP when sector remains under cap', () => {
    const tech1 = { ...NVDA_POSITION, symbol: 'NVDA' };
    const fin = { ...NVDA_POSITION, symbol: 'JPM', sector: 'Financials', swapPrice: 180 };
    const health = { ...NVDA_POSITION, symbol: 'JNJ', sector: 'Healthcare', swapPrice: 160 };
    const amdTech = { ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' };

    const battle = makeBattle({
      star: [tech1, fin],
      core: [health],
      bench: { stocks: [amdTech], crypto: null },
    });
    // SWAP JPM for AMD → tech 1/3 → 2/3 = 67%, cap is 70%
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
      guardrails: [{ type: 'maxSectorWeight', value: 70, unit: '%', enforcement: 'hard' }],
      battle,
      prices: {
        NVDA: { current: 100 }, JPM: { current: 185 }, JNJ: { current: 162 },
        AMD: { current: 105, changePercent: 1 },
      },
    });
    expect(result.decision).toBe('SWAP');
  });
});

describe('applyGuardrails — maxPosition (n/a in BaggerBomb)', () => {
  it('logs skipped_incompatible without changing decision', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'maxPosition', value: 15, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 100 }, AMD: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('HOLD');
    const skipped = result.overrides.find(o => o.action === 'skipped_incompatible');
    expect(skipped).toBeTruthy();
    expect(skipped.type).toBe('maxPosition');
  });
});

// Ask 3: the soft note is the DARK half of the executor flag split. This suite
// pins today's live (flag-false) behavior and self-retires at the Ask 1 flip —
// the flip PR reconciles nothing here (behavior-branched per BUILD_RULES §2);
// flag-ON coverage lives in agentGuardrails.profitTarget.test.js, which walks
// the flag explicitly.
describe.runIf(!PROFIT_TARGET_EXECUTOR_ENABLED)('applyGuardrails — profitTarget (soft, dark half)', () => {
  it('surfaces a note but does not override decision', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'profitTarget', value: 15, unit: '%', enforcement: 'soft' }],
      battle,
      prices: { NVDA: { current: 120 }, AMD: { current: 105, changePercent: 1 } }, // +20%
    });
    expect(result.decision).toBe('HOLD');
    const note = result.overrides.find(o => o.action === 'note');
    expect(note).toBeTruthy();
    expect(note.type).toBe('profitTarget');
    expect(note.symbol).toBe('NVDA');
  });

  it('does not fire below the profit target', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      bench: { stocks: [AMD_BENCH], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'profitTarget', value: 15, unit: '%', enforcement: 'soft' }],
      battle,
      prices: { NVDA: { current: 110 } }, // +10%
    });
    expect(result.overrides.filter(o => o.type === 'profitTarget')).toEqual([]);
  });
});

// ==================== VWAP FLOOR B2 — FORCED-EXIT HELD/SELF EXCLUSION ====================
// June 11: the forced-exit path used the quality-blind picker, which could
// return a symbol already occupying another slot (PANW triple-slot shape).
// The reroute through pickSwapReplacementCandidate must exclude held symbols.

describe('applyGuardrails — VWAP Floor B2 forced-exit held/self exclusion', () => {
  const MSFT_BENCH = { symbol: 'MSFT', name: 'Microsoft', baseATR: 2.0, isCrypto: false, sector: 'Technology' };

  it('skips a bench candidate that already occupies another active slot', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      core: [{ ...AMD_BENCH, swapPrice: 100 }], // AMD is HELD in core
      bench: { stocks: [AMD_BENCH, MSFT_BENCH], crypto: null }, // stale bench duplicate
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      // AMD has the better momentum — without the exclusion it would win.
      prices: { NVDA: { current: 90 }, AMD: { current: 110, changePercent: 5 }, MSFT: { current: 105, changePercent: 1 } },
    });
    expect(result.decision).toBe('SWAP');
    expect(result.symbolOut).toBe('NVDA');
    expect(result.symbolIn).toBe('MSFT'); // AMD excluded as held
  });

  it('defers the forced exit when every bench candidate is held (no self/dup swap)', () => {
    const battle = makeBattle({
      star: [NVDA_POSITION],
      core: [{ ...AMD_BENCH, swapPrice: 100 }],
      bench: { stocks: [AMD_BENCH, { ...NVDA_POSITION }], crypto: null }, // only held symbols on bench
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'HOLD' },
      guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
      battle,
      prices: { NVDA: { current: 90 }, AMD: { current: 110, changePercent: 5 } },
    });
    expect(result.decision).toBe('HOLD');
    const deferred = result.overrides.find(o => o.action === 'forced_exit_no_bench');
    expect(deferred).toBeTruthy();
    expect(deferred.symbol).toBe('NVDA');
  });
});

// ==================== Phase F — Diversifier sector-position cap (Option A) ====================
// Tournament-only (flat6) injection of a synthetic, config-DERIVED maxSectorWeight
// guardrail (DIVERSIFIER_SECTOR_CAP_PCT, from sectorConcentrationCap = 2 on a 6-book),
// min-capped against any user cap (user can only tighten), injected at the call
// site so a zero-guardrail Diversifier is still capped (the C2 trap).

describe('injectDiversifierSectorCap — flag/scope gating', () => {
  afterEach(() => { flagState.sectorCap = 'off'; flagState.integrity = 'off'; });

  // A fully-populated flat6 tournament Diversifier (gameMode + frozen archetype snapshot).
  const divTournament = (over = {}) => ({
    ...makeBattle(over),
    gameMode: TOURNAMENT_GAME_MODE,
    agentContext: { archetype: 'diversifier' },
  });

  it('the cap is DERIVED from the Diversifier sectorConcentrationCap — exact value, admits 2 of 6 / blocks 3 of 6', () => {
    // Single source: agentArchetypeConfig diversifier.sectorConcentrationCap (2) on the flat6 book (6).
    // EXACT regression lock (restores the strength of the old `toBe(35)` lock): the derived value
    // must equal (2 / 6) * 100 plus the 1e-6 float guard. Drift in the fenced config value, the
    // denominator, or the derivation formula fails this loudly — a range check could not.
    expect(DIVERSIFIER_SECTOR_CAP_PCT).toBe((2 / 6) * 100 + 1e-6);
    // …which is also the semantic contract on the flat6 book:
    expect(DIVERSIFIER_SECTOR_CAP_PCT).toBeGreaterThanOrEqual((2 / 6) * 100); // 2 of 6 (33.3%) allowed
    expect(DIVERSIFIER_SECTOR_CAP_PCT).toBeLessThan((3 / 6) * 100);           // 3 of 6 (50%) blocked
  });

  it('flag-OFF → array returned untouched (same reference, byte-identical)', () => {
    flagState.sectorCap = 'off';
    const input = [{ type: 'stopLoss', value: 8 }];
    expect(injectDiversifierSectorCap(input, divTournament())).toBe(input);
  });

  it('non-tournament Diversifier (tiered / legacy) → no injection (Option A gate)', () => {
    flagState.sectorCap = 'enforce';
    const tiered = { ...makeBattle(), gameMode: 'baggerbomb_agent', agentContext: { archetype: 'diversifier' } };
    const legacy = { ...makeBattle(), agentContext: { archetype: 'diversifier' } }; // absent gameMode
    expect(injectDiversifierSectorCap([], tiered)).toEqual([]);
    expect(injectDiversifierSectorCap([], legacy)).toEqual([]);
  });

  it('non-Diversifier tournament agent → no injection', () => {
    flagState.sectorCap = 'enforce';
    const input = [{ type: 'stopLoss', value: 8 }];
    const battle = { ...makeBattle(), gameMode: TOURNAMENT_GAME_MODE, agentContext: { archetype: 'momentum_chaser' } };
    expect(injectDiversifierSectorCap(input, battle)).toBe(input);
  });

  it('zero-guardrail tournament Diversifier → synthetic derived cap injected (the C2 trap)', () => {
    flagState.sectorCap = 'enforce';
    const out = injectDiversifierSectorCap([], divTournament());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'maxSectorWeight', value: DIVERSIFIER_SECTOR_CAP_PCT, enforcement: 'hard' });
  });

  it('user LOOSER cap (60%) → min wins (core), replaced in place not duplicated', () => {
    flagState.sectorCap = 'enforce';
    const out = injectDiversifierSectorCap(
      [{ type: 'maxSectorWeight', value: 60, unit: '%', enforcement: 'hard' }],
      divTournament(),
    );
    const caps = out.filter(g => g.type === 'maxSectorWeight');
    expect(caps).toHaveLength(1);     // dedup — never two maxSectorWeight entries
    expect(caps[0].value).toBe(DIVERSIFIER_SECTOR_CAP_PCT); // core wins when user is looser
    expect(caps[0].unit).toBe('%');   // preserves the user guardrail's other fields
  });

  it('user STRICTER cap (25%) → user wins (25%)', () => {
    flagState.sectorCap = 'enforce';
    const out = injectDiversifierSectorCap(
      [{ type: 'maxSectorWeight', value: 25, enforcement: 'hard' }],
      divTournament(),
    );
    const caps = out.filter(g => g.type === 'maxSectorWeight');
    expect(caps).toHaveLength(1);
    expect(caps[0].value).toBe(25);
  });

  it('preserves the agent\'s other guardrails when injecting', () => {
    flagState.sectorCap = 'enforce';
    const out = injectDiversifierSectorCap([{ type: 'stopLoss', value: 8 }], divTournament());
    expect(out.find(g => g.type === 'stopLoss')).toEqual({ type: 'stopLoss', value: 8 });
    expect(out.find(g => g.type === 'maxSectorWeight')?.value).toBe(DIVERSIFIER_SECTOR_CAP_PCT);
  });

  it('UN-SHADOWABLE: two existing maxSectorWeight entries → exactly one survives, LAST, = min(all, core)', () => {
    flagState.sectorCap = 'enforce';
    // applyGuardrails dedups keep-LAST; a malformed two-entry snapshot must not let a
    // looser cap shadow ours. Drop both, append the synthetic last.
    const out = injectDiversifierSectorCap(
      [
        { type: 'stopLoss', value: 8 },
        { type: 'maxSectorWeight', value: 60, enforcement: 'hard' },
        { type: 'maxSectorWeight', value: 80, enforcement: 'hard' }, // would shadow under keep-last
      ],
      divTournament(),
    );
    const caps = out.filter(g => g.type === 'maxSectorWeight');
    expect(caps).toHaveLength(1);                         // both user entries collapsed
    expect(caps[0].value).toBe(DIVERSIFIER_SECTOR_CAP_PCT); // min(60, 80, core) = core
    expect(out[out.length - 1].type).toBe('maxSectorWeight'); // ours is LAST → keep-last lands on it
    expect(out.find(g => g.type === 'stopLoss')).toBeTruthy(); // unrelated guardrail preserved
  });

  it('UN-SHADOWABLE: a user STRICTER cap among two entries still wins (min over all)', () => {
    flagState.sectorCap = 'enforce';
    const out = injectDiversifierSectorCap(
      [
        { type: 'maxSectorWeight', value: 25, enforcement: 'hard' }, // stricter than core
        { type: 'maxSectorWeight', value: 70, enforcement: 'hard' },
      ],
      divTournament(),
    );
    const caps = out.filter(g => g.type === 'maxSectorWeight');
    expect(caps).toHaveLength(1);
    expect(caps[0].value).toBe(25); // min(25, 70, core) = 25 — user's tighter cap wins
  });

  it('OBSERVE mode does NOT inject — firing is ENFORCE-only (observe measures via the resolver, never the array)', () => {
    flagState.sectorCap = 'observe';
    const input = [{ type: 'stopLoss', value: 8 }];
    expect(injectDiversifierSectorCap(input, divTournament())).toBe(input); // untouched
  });

  it('DECOUPLE (PR-e): ARCHETYPE_INTEGRITY_MODE=enforce alone no longer injects — the cap rides SECTOR_CAP_MODE only', () => {
    flagState.integrity = 'enforce';
    flagState.sectorCap = 'off';
    const input = [{ type: 'stopLoss', value: 8 }];
    expect(injectDiversifierSectorCap(input, divTournament())).toBe(input); // untouched
    expect(resolveSectorSlotObserveCap(input, divTournament())).toBeNull();
    // …and the inverse: the cap fires with the integrity flag fully off.
    flagState.integrity = 'off';
    flagState.sectorCap = 'enforce';
    const out = injectDiversifierSectorCap([], divTournament());
    expect(out[0]).toMatchObject({ type: 'maxSectorWeight', value: DIVERSIFIER_SECTOR_CAP_PCT, enforcement: 'hard' });
  });
});

describe('resolveSectorSlotObserveCap — the observe half (would-block measurement input)', () => {
  afterEach(() => { flagState.sectorCap = 'off'; });

  const divTournament = (over = {}) => ({
    ...makeBattle(over),
    gameMode: TOURNAMENT_GAME_MODE,
    agentContext: { archetype: 'diversifier' },
  });

  it('observe + in-scope → the effective cap (core when no user cap)', () => {
    flagState.sectorCap = 'observe';
    expect(resolveSectorSlotObserveCap([], divTournament())).toBe(DIVERSIFIER_SECTOR_CAP_PCT);
  });

  it('the min(user, core) merge is the SAME rule as enforce (shared context): stricter user cap wins', () => {
    flagState.sectorCap = 'observe';
    expect(resolveSectorSlotObserveCap(
      [{ type: 'maxSectorWeight', value: 25, enforcement: 'hard' }], divTournament(),
    )).toBe(25);
    expect(resolveSectorSlotObserveCap(
      [{ type: 'maxSectorWeight', value: 60, enforcement: 'hard' }], divTournament(),
    )).toBe(DIVERSIFIER_SECTOR_CAP_PCT);
  });

  it('null under off AND under enforce (enforce measures nothing — the real block is the record)', () => {
    flagState.sectorCap = 'off';
    expect(resolveSectorSlotObserveCap([], divTournament())).toBeNull();
    flagState.sectorCap = 'enforce';
    expect(resolveSectorSlotObserveCap([], divTournament())).toBeNull();
  });

  it('null off-scope: non-tournament or non-Diversifier (Option A gates shared with enforce)', () => {
    flagState.sectorCap = 'observe';
    const tiered = { ...makeBattle(), gameMode: 'baggerbomb_agent', agentContext: { archetype: 'diversifier' } };
    const chaser = { ...makeBattle(), gameMode: TOURNAMENT_GAME_MODE, agentContext: { archetype: 'momentum_chaser' } };
    expect(resolveSectorSlotObserveCap([], tiered)).toBeNull();
    expect(resolveSectorSlotObserveCap([], chaser)).toBeNull();
  });
});

describe('Diversifier sector cap — end-to-end (inject → applyGuardrails) on a flat6 6-pick book', () => {
  afterEach(() => { flagState.sectorCap = 'off'; });

  // A 6-position flat6 book (no crypto — flat6 has none, so held.length is a clean 6).
  const sectored = (symbol, sector) => ({ ...NVDA_POSITION, symbol, sector, swapPrice: 100 });

  const runSwap = ({ star, core, support, bench, symbolOut, symbolIn }) => {
    flagState.sectorCap = 'enforce';
    const battle = {
      ...makeBattle({ star, core, support, bench }),
      gameMode: TOURNAMENT_GAME_MODE,
      agentContext: { archetype: 'diversifier' }, // NOTE: no deployedGuardrails — zero-guardrail agent
    };
    // The call-site wiring: inject first (makes the array non-empty), then enforce.
    const guardrails = injectDiversifierSectorCap(battle.agentContext.deployedGuardrails || [], battle);
    return applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut, symbolIn, conviction: 80 },
      guardrails,
      battle,
      prices: {},
    });
  };

  it('blocks the 3rd-in-sector swap (3/6 = 50% > cap) on a zero-guardrail Diversifier', () => {
    const result = runSwap({
      star: [sectored('NVDA', 'Technology'), sectored('MSFT', 'Technology')],
      core: [sectored('JPM', 'Financials'), sectored('JNJ', 'Healthcare')],
      support: [sectored('XOM', 'Energy'), sectored('PG', 'Staples')],
      bench: { stocks: [{ ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' }], crypto: null },
      symbolOut: 'JPM', symbolIn: 'AMD', // Technology would go 2 → 3 of 6
    });
    expect(result.decision).toBe('HOLD');
    const blocked = result.overrides.find(o => o.action === 'blocked_swap');
    expect(blocked?.type).toBe('maxSectorWeight');
    expect(blocked?.threshold).toBe(DIVERSIFIER_SECTOR_CAP_PCT);
  });

  it('allows the 2nd-in-sector swap (2/6 = 33% <= cap) on a zero-guardrail Diversifier', () => {
    const result = runSwap({
      star: [sectored('NVDA', 'Technology'), sectored('JPM', 'Financials')],
      core: [sectored('JNJ', 'Healthcare'), sectored('XOM', 'Energy')],
      support: [sectored('PG', 'Staples'), sectored('KO', 'Staples')],
      bench: { stocks: [{ ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' }], crypto: null },
      symbolOut: 'JPM', symbolIn: 'AMD', // Technology would go 1 → 2 of 6
    });
    expect(result.decision).toBe('SWAP');
  });

  it('flag-OFF: the same 3rd-in-sector swap is NOT capped (zero-guardrail → applyGuardrails skipped)', () => {
    // Proves the dark path: with the flag off the injector returns [], so the
    // call-site length>0 skip holds and no cap is applied.
    flagState.sectorCap = 'off';
    const battle = {
      ...makeBattle({
        star: [sectored('NVDA', 'Technology'), sectored('MSFT', 'Technology')],
        core: [sectored('JPM', 'Financials'), sectored('JNJ', 'Healthcare')],
        support: [sectored('XOM', 'Energy'), sectored('PG', 'Staples')],
        bench: { stocks: [{ ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' }], crypto: null },
      }),
      gameMode: TOURNAMENT_GAME_MODE,
      agentContext: { archetype: 'diversifier' },
    };
    const guardrails = injectDiversifierSectorCap(battle.agentContext.deployedGuardrails || [], battle);
    expect(guardrails).toEqual([]); // dark: nothing injected
  });
});

// ==================== Release 2 PR-e — the sector-SLOT denominator ====================
//
// Spec §6: denominator = the MODE's slot count (6, the flat6 book config),
// never the momentary held count; evaluate the PROJECTED post-trade book.
// "2 of 6 allowed, 3 of 6 blocked" must hold at EVERY held count 1–6, and a
// partially-filled book must never be trapped by inflated shares.
describe('sector-SLOT rule — mode-slot-count denominator (tournament)', () => {
  afterEach(() => { flagState.sectorCap = 'off'; });

  const sectored = (symbol, sector) => ({ ...NVDA_POSITION, symbol, sector, swapPrice: 100 });
  const FILLERS = [
    sectored('JPM', 'Financials'), sectored('JNJ', 'Healthcare'),
    sectored('XOM', 'Energy'), sectored('PG', 'Staples'), sectored('KO', 'Utilities'),
  ];

  // A tournament Diversifier book holding `heldCount` positions, `techHeld` of
  // them Technology, swapping a non-tech holding out for a tech bench name.
  const runTechSwap = ({ heldCount, techHeld }) => {
    flagState.sectorCap = 'enforce';
    const tech = [sectored('NVDA', 'Technology'), sectored('MSFT', 'Technology')].slice(0, techHeld);
    const others = FILLERS.slice(0, heldCount - techHeld);
    const battle = {
      ...makeBattle({
        star: [...tech, ...others].slice(0, 2),
        core: [...tech, ...others].slice(2, 4),
        support: [...tech, ...others].slice(4, 6),
        bench: { stocks: [{ ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' }], crypto: null },
      }),
      gameMode: TOURNAMENT_GAME_MODE,
      agentContext: { archetype: 'diversifier' },
    };
    const guardrails = injectDiversifierSectorCap([], battle);
    return applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: others[0].symbol, symbolIn: 'AMD', conviction: 80 },
      guardrails,
      battle,
      prices: {},
    });
  };

  it('"2 of 6 allowed": the swap making a 2nd tech slot passes at EVERY held count 2..6 (partial books included)', () => {
    for (let heldCount = 2; heldCount <= 6; heldCount++) {
      const result = runTechSwap({ heldCount, techHeld: 1 }); // projected: 2 tech of SIX slots
      expect(result.decision, `heldCount=${heldCount}`).toBe('SWAP');
      expect(result.overrides.find(o => o.action === 'blocked_swap'), `heldCount=${heldCount}`).toBeUndefined();
    }
  });

  it('"3 of 6 blocked": the swap making a 3rd tech slot blocks at EVERY held count 3..6', () => {
    for (let heldCount = 3; heldCount <= 6; heldCount++) {
      const result = runTechSwap({ heldCount, techHeld: 2 }); // projected: 3 tech of SIX slots
      expect(result.decision, `heldCount=${heldCount}`).toBe('HOLD');
      const blocked = result.overrides.find(o => o.action === 'blocked_swap');
      expect(blocked?.actual, `heldCount=${heldCount}`).toBe(50); // 3/6 — the SLOT share, whatever is held
    }
  });

  it('partial-fill construction never trapped: 2nd-in-sector on a 3-held book is 2/6=33%, NOT 2/3=67% (the Phase-0 defect)', () => {
    // Pre-PR-e, held.length=3 made this 67% > the cap → a spurious block that could
    // trap a partial book (a no-replacement forced exit) out of rebuilding.
    const result = runTechSwap({ heldCount: 3, techHeld: 1 });
    expect(result.decision).toBe('SWAP');
  });

  it('sustained-partial behavior (documented): shares are honest against the TARGET book, so a tiny book may transiently concentrate', () => {
    // A 1-held book swapping into tech reads 1..2/6 — permissive by design: the
    // denominator is the book the mode will refill toward (equal-weight slots),
    // so the cap governs CONSTRUCTION toward 6, not the transient gap state.
    // The absolute ceiling is unchanged: a 3rd tech slot blocks regardless.
    const result = runTechSwap({ heldCount: 2, techHeld: 1 }); // projected 2 tech, only 2 held
    expect(result.decision).toBe('SWAP');
    const blockedAtCeiling = runTechSwap({ heldCount: 3, techHeld: 2 });
    expect(blockedAtCeiling.decision).toBe('HOLD');
  });

  it('NON-tournament user caps keep the held-count denominator (live Phase-4B behavior untouched)', () => {
    // Same 3-held 2-tech projection, but a tiered battle with a USER cap:
    // 2+1=... swap JPM→AMD makes tech 3 of 3 held = 100% > 50 → blocks under
    // held-count math (would be 50% under slot math with a 7-slot book).
    const battle = makeBattle({
      star: [sectored('NVDA', 'Technology'), sectored('MSFT', 'Technology')],
      core: [sectored('JPM', 'Financials')],
      bench: { stocks: [{ ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' }], crypto: null },
    });
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
      guardrails: [{ type: 'maxSectorWeight', value: 50, unit: '%', enforcement: 'hard' }],
      battle,
      prices: {},
    });
    expect(result.decision).toBe('HOLD');
    expect(result.overrides.find(o => o.action === 'blocked_swap')?.actual).toBe(100);
  });
});

// ==================== Release 2 PR-e — OBSERVE mode (would-block measurement) ====================
describe('sector-SLOT rule — OBSERVE logs would-blocks without touching the decision', () => {
  afterEach(() => { flagState.sectorCap = 'off'; });

  const sectored = (symbol, sector) => ({ ...NVDA_POSITION, symbol, sector, swapPrice: 100 });

  const divBattle = (userGuardrails = undefined) => ({
    ...makeBattle({
      star: [sectored('NVDA', 'Technology'), sectored('MSFT', 'Technology')],
      core: [sectored('JPM', 'Financials'), sectored('JNJ', 'Healthcare')],
      support: [sectored('XOM', 'Energy'), sectored('PG', 'Staples')],
      bench: { stocks: [{ ...AMD_BENCH, symbol: 'AMD', sector: 'Technology' }], crypto: null },
    }),
    gameMode: TOURNAMENT_GAME_MODE,
    agentContext: { archetype: 'diversifier', ...(userGuardrails ? { deployedGuardrails: userGuardrails } : {}) },
  });

  // The cron call-site wiring under observe: inject (no-op), resolve, pass both.
  const runObserved = (battle, haikuResult, prices = {}) => {
    const guardrails = injectDiversifierSectorCap(battle.agentContext.deployedGuardrails || [], battle);
    const sectorSlotObserveCap = resolveSectorSlotObserveCap(battle.agentContext.deployedGuardrails || [], battle);
    return { guardrails, result: applyGuardrails({ haikuResult, guardrails, battle, prices, sectorSlotObserveCap }) };
  };

  it('a zero-guardrail Diversifier (the C2 case): the 3rd-in-sector swap PROCEEDS and the would-block is recorded', () => {
    flagState.sectorCap = 'observe';
    const { guardrails, result } = runObserved(
      divBattle(),
      { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
    );
    expect(guardrails).toEqual([]); // observe never touches the array
    expect(result.decision).toBe('SWAP'); // …or the decision
    expect(result.symbolOut).toBe('JPM');
    expect(result.symbolIn).toBe('AMD');
    expect(result.sourceNote).toBeNull(); // nothing fired — no bypass note
    const wb = result.overrides.find(o => o.action === 'would_block_swap');
    expect(wb).toMatchObject({ type: 'maxSectorWeight', threshold: DIVERSIFIER_SECTOR_CAP_PCT, actual: 50 }); // 3/6 — same math as enforce
  });

  it('parity: what observe records is exactly what enforce blocks (same battle, same swap)', () => {
    const battle = divBattle();
    const haiku = { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 };
    flagState.sectorCap = 'observe';
    const observed = runObserved(battle, haiku).result;
    flagState.sectorCap = 'enforce';
    const enforced = runObserved(battle, haiku).result;
    const wb = observed.overrides.find(o => o.action === 'would_block_swap');
    const blocked = enforced.overrides.find(o => o.action === 'blocked_swap');
    expect(enforced.decision).toBe('HOLD');
    expect(wb.threshold).toBe(blocked.threshold);
    expect(wb.actual).toBe(blocked.actual);
    expect(wb.symbol).toBe(blocked.symbol);
  });

  it('an allowed swap (2nd-in-sector) records nothing', () => {
    flagState.sectorCap = 'observe';
    const { result } = runObserved(
      divBattle(),
      { decision: 'SWAP', symbolOut: 'MSFT', symbolIn: 'AMD', conviction: 80 }, // tech 2 → 2 of 6
    );
    expect(result.decision).toBe('SWAP');
    expect(result.overrides.find(o => o.action === 'would_block_swap')).toBeUndefined();
  });

  it("a user's OWN hard cap still blocks under observe (SECTOR_CAP_MODE never governs user guardrails)", () => {
    flagState.sectorCap = 'observe';
    const { result } = runObserved(
      divBattle([{ type: 'maxSectorWeight', value: 40, unit: '%', enforcement: 'hard' }]),
      { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 }, // tech → 3/6 = 50%
    );
    expect(result.decision).toBe('HOLD'); // the USER cap fired, as it does today
    expect(result.overrides.find(o => o.action === 'blocked_swap')?.threshold).toBe(40);
    // …and the core-rule measurement still landed (min(40, core)=core would also block).
    expect(result.overrides.find(o => o.action === 'would_block_swap')?.threshold).toBe(DIVERSIFIER_SECTOR_CAP_PCT);
  });

  it('forced-exit precedence parity: a stop-loss breach suppresses the shadow check exactly as it suppresses enforce', () => {
    flagState.sectorCap = 'observe';
    const battle = divBattle([{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }]);
    const { result } = runObserved(
      battle,
      { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
      { NVDA: { current: 85 }, AMD: { current: 105, changePercent: 1.2 } }, // NVDA -15% breaches
    );
    // The forced exit wins (enforce would never consult the sector check) —
    // so observe must not log a would-block for this tick either.
    expect(result.overrides.find(o => o.action === 'would_block_swap')).toBeUndefined();
    expect(result.sourceNote).toBe('guardrail_stopLoss');
  });

  it('OFF is byte-identical: no injection, no resolver cap, empty array short-circuits as before', () => {
    flagState.sectorCap = 'off';
    const battle = divBattle();
    const guardrails = injectDiversifierSectorCap(battle.agentContext.deployedGuardrails || [], battle);
    const cap = resolveSectorSlotObserveCap(battle.agentContext.deployedGuardrails || [], battle);
    expect(guardrails).toEqual([]);
    expect(cap).toBeNull();
    const result = applyGuardrails({
      haikuResult: { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
      guardrails,
      battle,
      prices: {},
      sectorSlotObserveCap: cap,
    });
    expect(result.decision).toBe('SWAP');
    expect(result.overrides).toEqual([]);
  });
});
