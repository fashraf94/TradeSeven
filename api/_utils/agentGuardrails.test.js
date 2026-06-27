// api/_utils/agentGuardrails.test.js
// Phase 4B: guardrail enforcement unit tests.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

// Phase F — flip ARCHETYPE_INTEGRITY_MODE per-test via a live getter (every other
// real flag preserved). injectDiversifierSectorCap reads the flag inside the
// function, so the getter takes effect at call time. Default 'off' keeps the
// pre-existing suite flag-OFF (byte-identical).
const { archetypeFlag } = vi.hoisted(() => ({ archetypeFlag: { mode: 'off' } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get ARCHETYPE_INTEGRITY_MODE() { return archetypeFlag.mode; },
}));

import { applyGuardrails, injectDiversifierSectorCap, DIVERSIFIER_SECTOR_CAP_PCT } from './agentGuardrails.js';

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

describe('applyGuardrails — profitTarget (soft)', () => {
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
// Tournament-only (flat6) injection of a synthetic maxSectorWeight=35 guardrail,
// min-capped against any user cap (user can only tighten), injected at the call
// site so a zero-guardrail Diversifier is still capped (the C2 trap).

describe('injectDiversifierSectorCap — flag/scope gating', () => {
  afterEach(() => { archetypeFlag.mode = 'off'; });

  // A fully-populated flat6 tournament Diversifier (gameMode + frozen archetype snapshot).
  const divTournament = (over = {}) => ({
    ...makeBattle(over),
    gameMode: TOURNAMENT_GAME_MODE,
    agentContext: { archetype: 'diversifier' },
  });

  it('the locked cap constant is 35', () => {
    expect(DIVERSIFIER_SECTOR_CAP_PCT).toBe(35);
  });

  it('flag-OFF → array returned untouched (same reference, byte-identical)', () => {
    archetypeFlag.mode = 'off';
    const input = [{ type: 'stopLoss', value: 8 }];
    expect(injectDiversifierSectorCap(input, divTournament())).toBe(input);
  });

  it('non-tournament Diversifier (tiered / legacy) → no injection (Option A gate)', () => {
    archetypeFlag.mode = 'enforce';
    const tiered = { ...makeBattle(), gameMode: 'baggerbomb_agent', agentContext: { archetype: 'diversifier' } };
    const legacy = { ...makeBattle(), agentContext: { archetype: 'diversifier' } }; // absent gameMode
    expect(injectDiversifierSectorCap([], tiered)).toEqual([]);
    expect(injectDiversifierSectorCap([], legacy)).toEqual([]);
  });

  it('non-Diversifier tournament agent → no injection', () => {
    archetypeFlag.mode = 'enforce';
    const input = [{ type: 'stopLoss', value: 8 }];
    const battle = { ...makeBattle(), gameMode: TOURNAMENT_GAME_MODE, agentContext: { archetype: 'momentum_chaser' } };
    expect(injectDiversifierSectorCap(input, battle)).toBe(input);
  });

  it('zero-guardrail tournament Diversifier → synthetic 35% cap injected (the C2 trap)', () => {
    archetypeFlag.mode = 'enforce';
    const out = injectDiversifierSectorCap([], divTournament());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'maxSectorWeight', value: 35, enforcement: 'hard' });
  });

  it('user LOOSER cap (60%) → min wins (35%), replaced in place not duplicated', () => {
    archetypeFlag.mode = 'enforce';
    const out = injectDiversifierSectorCap(
      [{ type: 'maxSectorWeight', value: 60, unit: '%', enforcement: 'hard' }],
      divTournament(),
    );
    const caps = out.filter(g => g.type === 'maxSectorWeight');
    expect(caps).toHaveLength(1);     // dedup — never two maxSectorWeight entries
    expect(caps[0].value).toBe(35);   // core wins when user is looser
    expect(caps[0].unit).toBe('%');   // preserves the user guardrail's other fields
  });

  it('user STRICTER cap (25%) → user wins (25%)', () => {
    archetypeFlag.mode = 'enforce';
    const out = injectDiversifierSectorCap(
      [{ type: 'maxSectorWeight', value: 25, enforcement: 'hard' }],
      divTournament(),
    );
    const caps = out.filter(g => g.type === 'maxSectorWeight');
    expect(caps).toHaveLength(1);
    expect(caps[0].value).toBe(25);
  });

  it('preserves the agent\'s other guardrails when injecting', () => {
    archetypeFlag.mode = 'enforce';
    const out = injectDiversifierSectorCap([{ type: 'stopLoss', value: 8 }], divTournament());
    expect(out.find(g => g.type === 'stopLoss')).toEqual({ type: 'stopLoss', value: 8 });
    expect(out.find(g => g.type === 'maxSectorWeight')?.value).toBe(35);
  });

  it('OBSERVE mode does NOT inject — the cap is ENFORCE-only (OBSERVE stays passive)', () => {
    archetypeFlag.mode = 'observe';
    const input = [{ type: 'stopLoss', value: 8 }];
    expect(injectDiversifierSectorCap(input, divTournament())).toBe(input); // untouched
  });
});

describe('Diversifier sector cap — end-to-end (inject → applyGuardrails) on a flat6 6-pick book', () => {
  afterEach(() => { archetypeFlag.mode = 'off'; });

  // A 6-position flat6 book (no crypto — flat6 has none, so held.length is a clean 6).
  const sectored = (symbol, sector) => ({ ...NVDA_POSITION, symbol, sector, swapPrice: 100 });

  const runSwap = ({ star, core, support, bench, symbolOut, symbolIn }) => {
    archetypeFlag.mode = 'enforce';
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

  it('blocks the 3rd-in-sector swap (3/6 = 50% > 35) on a zero-guardrail Diversifier', () => {
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
    expect(blocked?.threshold).toBe(35);
  });

  it('allows the 2nd-in-sector swap (2/6 = 33% <= 35) on a zero-guardrail Diversifier', () => {
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
    archetypeFlag.mode = 'off';
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
