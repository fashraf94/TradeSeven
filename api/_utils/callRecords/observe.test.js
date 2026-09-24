// api/_utils/callRecords/observe.test.js
//
// Cockpit Build 0 — quotes preserved as fetched, one frozen observation per
// exit (spec V1.3 §3.3–§3.4; §3.12 rows 3 "quote shape" and 4 "clock").
//
// Dependency-surface guard (BUILD_RULES §4): this file's import of observe.js
// is the runtime guard that observe.js's src/ import (src/data/battleUniverse.js)
// stays Node-clean. It is never mocked.

import { describe, it, expect } from 'vitest';
import {
  recordFetchedQuote, buildObservation, freezeObservation, freezeModelObservation, observationUsable,
  classifyEntryExit, carryExecutorResult, FLIP_EXITS, OBSERVATION_SOURCES,
  passExaminesHeldPrices, PRICE_SCANNING_GUARDRAIL_TYPES,
} from './observe.js';
import { createCallsContext } from './mode.js';
import { isSettlementQuoteUsable } from '../agentQuoteHealth.js';
import { applyGuardrails } from '../agentGuardrails.js';
import { flattenPortfolioServer } from '../agentScoring.js';
import { makeTickBattle, makePriceTable } from '../__fixtures__/tickStampsHarness.js';

const active = () => createCallsContext({ mode: 'shadow', handlerStartMs: 0 });

describe('the detached quote copy (row 3 — quote shape)', () => {
  it('copies { current, fallback, fetchedAtMs } from the fetched price object — primitives only', () => {
    const ctx = active();
    const price = { current: 162, previousClose: 159.5, changePercent: 1.57, fallback: false };
    recordFetchedQuote(ctx, 'AMD', price, 1000);
    expect(ctx.fetchedQuotes.AMD).toEqual({ current: 162, fallback: false, fetchedAtMs: 1000 });
    // DETACHED: a later execution-price replacement — the cron replaces the
    // map entry with a NEW object, and a mutation of the old one is also
    // possible in principle — never reaches the copy.
    price.current = 999;
    expect(ctx.fetchedQuotes.AMD.current).toBe(162);
    expect(Object.isFrozen(ctx.fetchedQuotes.AMD)).toBe(true);
  });

  it('the detached shape passes and fails isSettlementQuoteUsable exactly as the fetched object does', () => {
    const cases = [
      { current: 162 }, { current: 162, fallback: true }, { current: 0 }, { current: -1 },
      { current: Number.NaN }, { current: '162' }, {},
    ];
    for (const price of cases) {
      const ctx = active();
      recordFetchedQuote(ctx, 'X', price, 1);
      expect(isSettlementQuoteUsable(ctx.fetchedQuotes.X), JSON.stringify(price)).toBe(isSettlementQuoteUsable(price));
    }
  });

  it('at off nothing is copied (no observation machinery at all)', () => {
    const ctx = createCallsContext({ mode: 'off', handlerStartMs: 0 });
    recordFetchedQuote(ctx, 'AMD', { current: 1 }, 1);
    expect(ctx.fetchedQuotes).toEqual({});
  });
});

describe('buildObservation — admission and the clock (row 4)', () => {
  const quotes = {
    AMD: { current: 162, fallback: undefined, fetchedAtMs: 1000 },
    JPM: { current: 201, fallback: true, fetchedAtMs: 1000 },     // a fallback quote
    HOOD: { current: 30, fetchedAtMs: 5000 },                       // fetched AFTER the instant
    ZERO: { current: 0, fetchedAtMs: 1000 },
  };

  it('px is projected from `current`; a fallback quote, a non-positive quote and a quote fetched after the instant are all excluded', () => {
    const obs = buildObservation({ source: 'no_trigger', observedAtMs: 4000, examined: ['AMD', 'JPM', 'HOOD', 'ZERO', 'NOPE'], fetchedQuotes: quotes });
    expect(obs).toEqual({ observedAtMs: 4000, source: 'no_trigger', symbols: { AMD: { px: 162, fetchedAtMs: 1000 } } });
  });

  it('fetchedAtMs ≤ observedAtMs is enforced on every admitted symbol — equality admits, one ms later does not', () => {
    expect(buildObservation({ source: 'passive', observedAtMs: 1000, examined: ['AMD'], fetchedQuotes: quotes }).symbols.AMD.px).toBe(162);
    expect(buildObservation({ source: 'passive', observedAtMs: 999, examined: ['AMD'], fetchedQuotes: quotes }).symbols).toEqual({});
    const late = buildObservation({ source: 'no_trigger', observedAtMs: 6000, examined: ['HOOD'], fetchedQuotes: quotes });
    expect(late.symbols.HOOD).toEqual({ px: 30, fetchedAtMs: 5000 });
    expect(late.symbols.HOOD.fetchedAtMs).toBeLessThanOrEqual(late.observedAtMs);
  });

  it('only the EXAMINED set is observed — a usable quote the exit never examined is not a fact of this observation', () => {
    const obs = buildObservation({ source: 'passive', observedAtMs: 4000, examined: ['HOOD'], fetchedQuotes: quotes });
    expect(obs.symbols).not.toHaveProperty('AMD');
  });

  it('replacedInPrompt marks a replaced row — and px stays the FETCHED quote', () => {
    const obs = buildObservation({ source: 'model_prompt', observedAtMs: 4000, examined: ['AMD'], fetchedQuotes: quotes, replaced: ['AMD'] });
    expect(obs.symbols.AMD).toEqual({ px: 162, fetchedAtMs: 1000, replacedInPrompt: true });
  });

  it('no finite instant → no observation', () => {
    for (const t of [undefined, null, Number.NaN, Infinity, '2026-09-09T15:00:00.000Z']) {
      expect(buildObservation({ source: 'model_prompt', observedAtMs: t, examined: ['AMD'], fetchedQuotes: quotes })).toBeNull();
    }
  });

  it('the observation is frozen (never mutated after its seam)', () => {
    const obs = buildObservation({ source: 'no_trigger', observedAtMs: 4000, examined: ['AMD'], fetchedQuotes: quotes });
    expect(Object.isFrozen(obs)).toBe(true);
    expect(Object.isFrozen(obs.symbols)).toBe(true);
    expect(Object.isFrozen(obs.symbols.AMD)).toBe(true);
  });
});

describe('freezeObservation — ONCE per check, never reconstructed', () => {
  it('the first seam wins; a later seam on the same check does not replace it', () => {
    const ctx = active();
    recordFetchedQuote(ctx, 'AMD', { current: 162 }, 10);
    const first = freezeObservation(ctx, { source: 'gameplan_pass', observedAtMs: 20, examined: ['AMD'] });
    const second = freezeObservation(ctx, { source: 'no_trigger', observedAtMs: 30, examined: ['AMD'] });
    expect(second).toBe(first);
    expect(ctx.observation.source).toBe('gameplan_pass');
    expect(ctx.observation.observedAtMs).toBe(20);
  });

  it('at off nothing is frozen', () => {
    const ctx = createCallsContext({ mode: 'off', handlerStartMs: 0 });
    expect(freezeObservation(ctx, { source: 'passive', observedAtMs: 1, examined: ['AMD'] })).toBeNull();
    expect(ctx.observation).toBeNull();
  });
});

describe('freezeModelObservation — the model seam', () => {
  it('held rows + bench rows, at Date.parse(promptBuiltAt), replaced rows marked; the universe frozen beside it', () => {
    const ctx = active();
    recordFetchedQuote(ctx, 'NVDA', { current: 123.4 }, Date.parse('2026-09-09T14:59:59.000Z'));
    recordFetchedQuote(ctx, 'AMD', { current: 162 }, Date.parse('2026-09-09T14:59:59.500Z'));
    const obs = freezeModelObservation(ctx, {
      heldSymbols: ['NVDA'], benchSymbols: ['AMD'], promptBuiltAt: '2026-09-09T15:00:00.000Z', replacedSymbols: ['NVDA'], battle: makeTickBattle(),
    });
    expect(obs.observedAtMs).toBe(Date.parse('2026-09-09T15:00:00.000Z'));
    expect(obs.source).toBe('model_prompt');
    expect(obs.symbols).toEqual({
      NVDA: { px: 123.4, fetchedAtMs: Date.parse('2026-09-09T14:59:59.000Z'), replacedInPrompt: true },
      AMD: { px: 162, fetchedAtMs: Date.parse('2026-09-09T14:59:59.500Z') },
    });
    expect(ctx.universe).toEqual(['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM']);
  });

  it('a missing or unparseable promptBuiltAt → no observation (the model rows need a real prompt instant)', () => {
    for (const promptBuiltAt of [null, undefined, 'not a date']) {
      const ctx = active();
      expect(freezeModelObservation(ctx, { heldSymbols: [], benchSymbols: [], promptBuiltAt, replacedSymbols: [], battle: makeTickBattle() })).toBeNull();
    }
  });
});

describe('classifyEntryExit — HEAD\'s own failure classes decide the row', () => {
  it('every entry-writing path maps to its §3.4 row', () => {
    expect(classifyEntryExit({ refreshFailure: 'x', haikuFailure: { failureClass: 'refresh_failed' }, promptBuilt: false })).toBe('refresh_failed');
    expect(classifyEntryExit({ refreshFailure: null, haikuFailure: { failureClass: 'budget_skipped' }, promptBuilt: false })).toBe('budget_skipped');
    expect(classifyEntryExit({ refreshFailure: null, haikuFailure: { failureClass: 'build_timeout' }, promptBuilt: false })).toBe('prompt_build_failed');
    for (const failureClass of ['timeout', 'APIConnectionError', '529', 'truncated_response', 'invalid_tool_result']) {
      expect(classifyEntryExit({ refreshFailure: null, haikuFailure: { failureClass }, promptBuilt: true }), failureClass).toBe('transport_failed_after_prompt');
    }
    expect(classifyEntryExit({ refreshFailure: null, haikuFailure: null, promptBuilt: true })).toBe('model_result');
  });

  it('the flip rows are exactly §3.4\'s eight; the excluded rows are not among them', () => {
    expect(FLIP_EXITS).toEqual(['model_result', 'transport_failed_after_prompt', 'budget_skipped', 'no_trigger', 'proposal_pending', 'gameplan_pending', 'gameplan_created', 'passive']);
    for (const excluded of ['refresh_failed', 'prompt_build_failed', 'degraded_quotes', 'tick_error']) expect(FLIP_EXITS).not.toContain(excluded);
    expect(OBSERVATION_SOURCES).toHaveLength(6);
  });

  it('observationUsable needs a finite instant', () => {
    expect(observationUsable(null)).toBe(false);
    expect(observationUsable({ observedAtMs: 1, symbols: {} })).toBe(true);
    expect(observationUsable({ observedAtMs: Number.NaN, symbols: {} })).toBe(false);
  });
});

describe('carryExecutorResult — the committed executor return, independent of capture', () => {
  it('carries the closed trade\'s symbolOut / symbolIn / tier / slotIndex', () => {
    const ctx = active();
    carryExecutorResult(ctx, { closedTrade: { symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0, lockedPoints: 1 }, incomingAsset: {} });
    expect(ctx.executorResult).toEqual({ symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0 });
  });

  it('a field the executor did not return is null — never reconstructed', () => {
    const ctx = active();
    carryExecutorResult(ctx, { closedTrade: { symbolOut: 'KO', symbolIn: 'AMD' } });
    expect(ctx.executorResult).toEqual({ symbolOut: 'KO', symbolIn: 'AMD', tier: null, slotIndex: null });
    carryExecutorResult(ctx, null);
    expect(ctx.executorResult).toEqual({ symbolOut: null, symbolIn: null, tier: null, slotIndex: null });
  });

  it('at off nothing is carried', () => {
    const ctx = createCallsContext({ mode: 'off', handlerStartMs: 0 });
    carryExecutorResult(ctx, { closedTrade: { symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', slotIndex: 0 } });
    expect(ctx.executorResult).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Branch review BR-2: the R11 pass's observation membership comes from ACTUAL
// price examination. The adapter mirrors the fenced helper's preconditions; the
// rows below run the REAL helper (called, never edited) with every price read
// recorded, so the adapter cannot drift from what the helper really examines.
describe('the R11 pass examines held prices ONLY through a price-scanning guardrail (review BR-2)', () => {
  const STOP = { type: 'stopLoss', value: 8, unit: '%', enforcement: 'hard' };
  const TRAIL = { type: 'trailingStop', value: 10, unit: '%', enforcement: 'hard' };
  const TARGET = { type: 'profitTarget', value: 15, unit: '%', enforcement: 'hard' };
  const SECTOR = { type: 'maxSectorWeight', value: 40, unit: '%', enforcement: 'hard' };
  const MAX_POSITION = { type: 'maxPosition', value: 25, unit: '%', enforcement: 'hard' };
  const CASES = {
    'sector-only': [SECTOR],
    'maxPosition-only': [MAX_POSITION],
    'sector + maxPosition': [SECTOR, MAX_POSITION],
    stopLoss: [STOP],
    trailingStop: [TRAIL],
    profitTarget: [TARGET],
    'sector + stopLoss': [SECTOR, STOP],
    'stopLoss without a numeric value': [{ ...STOP, value: '8' }],
    'the LAST stopLoss wins (non-numeric)': [STOP, { ...STOP, value: null }],
    'the LAST stopLoss wins (numeric)': [{ ...STOP, value: null }, STOP],
  };

  /** The held symbols whose price the REAL helper reads, called exactly as the suppression pass calls it. */
  function heldPricesRead(guardrails) {
    const battle = makeTickBattle();
    const read = new Set();
    const prices = new Proxy(makePriceTable(), {
      get(target, prop, receiver) {
        if (typeof prop === 'string') read.add(prop);
        return Reflect.get(target, prop, receiver);
      },
    });
    applyGuardrails({ haikuResult: null, guardrails, battle, prices, lockedPositions: new Set(), stockRegimes: {}, sectorSlotObserveCap: null });
    const held = flattenPortfolioServer(battle.portfolio).map((a) => a.symbol);
    return { held, read: held.filter((symbol) => read.has(symbol)) };
  }

  it('the adapter agrees with the REAL helper on every configuration: every held price read ⟺ passExaminesHeldPrices, and no held price read otherwise', () => {
    for (const [label, guardrails] of Object.entries(CASES)) {
      const { held, read } = heldPricesRead(guardrails);
      expect(held.length, label).toBeGreaterThan(0);
      expect(read, label).toEqual(passExaminesHeldPrices(guardrails) ? held : []);
    }
  });

  it('the verdicts: sector-only and maxPosition-only examine nothing; a numeric stop, trailing stop or profit target (the last of its type) examines every held price', () => {
    expect(Object.fromEntries(Object.entries(CASES).map(([label, g]) => [label, passExaminesHeldPrices(g)]))).toEqual({
      'sector-only': false,
      'maxPosition-only': false,
      'sector + maxPosition': false,
      stopLoss: true,
      trailingStop: true,
      profitTarget: true,
      'sector + stopLoss': true,
      'stopLoss without a numeric value': false,
      'the LAST stopLoss wins (non-numeric)': false,
      'the LAST stopLoss wins (numeric)': true,
    });
    expect(PRICE_SCANNING_GUARDRAIL_TYPES).toEqual(['stopLoss', 'trailingStop', 'profitTarget']);
    expect(passExaminesHeldPrices([])).toBe(false);
    expect(passExaminesHeldPrices(null)).toBe(false);
  });
});
