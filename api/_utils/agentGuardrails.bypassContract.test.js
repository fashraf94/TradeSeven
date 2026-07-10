// api/_utils/agentGuardrails.bypassContract.test.js
//
// Release 2 PR-e — the sourceNote ↔ EMERGENCY_BYPASS_REASONS cross-module
// CONTRACT (founder ruling D2, 2026-07-10: guardrails classes (a) sourceNote
// strings and (b) cap math are fence contact; this test is the tripwire).
//
// The fenced agentRiskManager.js (READ/CALL ONLY — BUILD_RULES §1) hinges its
// A2 safety contract on these strings: clearsHurdleFloor step 1 bypasses the
// quality floor IFF the swap reason is in EMERGENCY_BYPASS_REASONS, and its
// header documents guardrail_stopLoss / guardrail_trailingStop as members
// while "the sector-cap guardrail returns HOLD and never reaches execution,
// so it is intentionally absent." A drifted sourceNote string in the
// NON-fenced agentGuardrails.js would silently break that contract in either
// direction: a renamed protective note would GATE an emergency exit (parking
// an agent in a stop-breaching position); a sector note that wandered INTO
// the set would let a blocked-HOLD's reason class bypass floors it must not.
//
// Every sourceNote below is DERIVED BY RUNNING the real applyGuardrails —
// never re-typed as a literal on the guardrails side — so the test binds the
// emitted value to the fenced set by construction (the §9 display-agreement
// discipline applied to a cross-module string contract).
//
// BUILD_RULES §4 dependency-surface guard: this file imports BOTH real
// modules unmocked (featureFlags rides in with its real values — the paths
// below are flag-independent). Never add vi.mock here.

import { describe, it, expect } from 'vitest';
import { applyGuardrails } from './agentGuardrails.js';
import { EMERGENCY_BYPASS_REASONS, clearsHurdleFloor } from './agentRiskManager.js';

// ==================== FIXTURES (mirror agentGuardrails.test.js shapes) ====================

const POSITION = (symbol, sector, swapPrice = 100) => ({
  symbol, name: symbol, baseATR: 3.0, isCrypto: false, sector, swapPrice,
});

const makeBattle = ({ star = [], core = [], bench = { stocks: [], crypto: null }, thresholdHistory = {} } = {}) => ({
  id: 'battle_contract',
  portfolio: { star, core, bench, support: [], startingPrices: {} },
  thresholdHistory,
  agentContext: {},
});

const AMD_BENCH = { symbol: 'AMD', name: 'AMD', baseATR: 3.5, isCrypto: false, sector: 'Technology' };

// Run the real function and return the emitted sourceNote for each firing path.
function emittedSourceNotes() {
  // stopLoss forced exit: NVDA -15% breaches an 8% stop, AMD replaces.
  const stopLoss = applyGuardrails({
    haikuResult: { decision: 'HOLD' },
    guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
    battle: makeBattle({ star: [POSITION('NVDA', 'Technology')], bench: { stocks: [AMD_BENCH], crypto: null } }),
    prices: { NVDA: { current: 85 }, AMD: { current: 105, changePercent: 1.2 } },
  });

  // trailingStop forced exit: implied peak via thresholdHistory, -12% drawdown.
  const trailingStop = applyGuardrails({
    haikuResult: { decision: 'HOLD' },
    guardrails: [{ type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' }],
    battle: makeBattle({
      star: [POSITION('NVDA', 'Technology')],
      bench: { stocks: [AMD_BENCH], crypto: null },
      thresholdHistory: { NVDA: { maxMultiplier: 8 } }, // peak = 100 × (1 + 8×3/100) = 124
    }),
    prices: { NVDA: { current: 105 }, AMD: { current: 105, changePercent: 1.2 } }, // -15.3% from peak
  });

  // reinforced protective exit (A2): Haiku already exits the breaching symbol.
  const reinforced = applyGuardrails({
    haikuResult: { decision: 'SWAP', symbolOut: 'NVDA', symbolIn: 'AMD', conviction: 80 },
    guardrails: [{ type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' }],
    battle: makeBattle({ star: [POSITION('NVDA', 'Technology')], bench: { stocks: [AMD_BENCH], crypto: null } }),
    prices: { NVDA: { current: 88 }, AMD: { current: 105, changePercent: 1 } },
  });

  // sector block: user cap, tech 2/3 → 3/3 = 100% > 50 → HOLD.
  const sectorBlock = applyGuardrails({
    haikuResult: { decision: 'SWAP', symbolOut: 'JPM', symbolIn: 'AMD', conviction: 80 },
    guardrails: [{ type: 'maxSectorWeight', value: 50, unit: '%', enforcement: 'hard' }],
    battle: makeBattle({
      star: [POSITION('NVDA', 'Technology'), POSITION('MSFT', 'Technology')],
      core: [POSITION('JPM', 'Financials', 180)],
      bench: { stocks: [AMD_BENCH], crypto: null },
    }),
    prices: { NVDA: { current: 100 }, MSFT: { current: 100 }, JPM: { current: 185 }, AMD: { current: 105, changePercent: 1 } },
  });

  return { stopLoss, trailingStop, reinforced, sectorBlock };
}

// ==================== THE CONTRACT ====================

describe('sourceNote ↔ EMERGENCY_BYPASS_REASONS (cross-module contract, D2)', () => {
  const { stopLoss, trailingStop, reinforced, sectorBlock } = emittedSourceNotes();

  it('each path actually fired (the derivation is real, not vacuous)', () => {
    expect(stopLoss.decision).toBe('SWAP');
    expect(stopLoss.overrides.some(o => o.action === 'forced_exit')).toBe(true);
    expect(trailingStop.decision).toBe('SWAP');
    expect(trailingStop.overrides.some(o => o.action === 'forced_exit' && o.type === 'trailingStop')).toBe(true);
    expect(reinforced.overrides.some(o => o.action === 'reinforced_haiku')).toBe(true);
    expect(sectorBlock.decision).toBe('HOLD');
    expect(sectorBlock.overrides.some(o => o.action === 'blocked_swap')).toBe(true);
  });

  it('PROTECTIVE exits emit sourceNotes that ARE emergency-bypass members (A2: never park an agent in a breaching position)', () => {
    for (const [path, result] of Object.entries({ stopLoss, trailingStop, reinforced })) {
      expect(typeof result.sourceNote, path).toBe('string');
      expect(EMERGENCY_BYPASS_REASONS.has(result.sourceNote), `${path} emitted "${result.sourceNote}"`).toBe(true);
    }
  });

  it('the sector-slot block emits a sourceNote that is NOT a bypass member (it returns HOLD — intentionally absent per the fenced header)', () => {
    expect(typeof sectorBlock.sourceNote).toBe('string');
    expect(EMERGENCY_BYPASS_REASONS.has(sectorBlock.sourceNote)).toBe(false);
  });

  it('emergency-bypass ordering untouched: the emitted protective notes clear the hurdle floor at STEP 1, before any floor math', () => {
    // A floor config that would block anything on merit (impossible multiplier,
    // bench-negative) — only the step-1 bypass can clear it.
    const blockingFloor = {
      hftConfig: { hurdleFloor: { enabled: true, requireBenchPositive: true, default: { atrMultiplier: 99 } } },
    };
    const gate = (reason) => clearsHurdleFloor({
      active: { symbol: 'NVDA', dailyPct: -0.02 },
      benchCandidate: { symbol: 'AMD', dailyPct: -0.01 }, // bench NEGATIVE — step 4 would refuse
      reason,
      archetypeConfig: blockingFloor,
      userATR: 3.0,
    });
    for (const result of [stopLoss, trailingStop, reinforced]) {
      expect(gate(result.sourceNote)).toEqual({ clears: true, bypassed: true, reason: result.sourceNote });
    }
    // The sector note is GATED like any non-emergency reason — no bypass.
    const gated = gate(sectorBlock.sourceNote);
    expect(gated.bypassed).toBeUndefined();
    expect(gated.clears).toBe(false);
  });
});
