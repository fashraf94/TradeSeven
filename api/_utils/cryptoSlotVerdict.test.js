// api/_utils/cryptoSlotVerdict.test.js
//
// Crypto Slot v2 — the verdict behind the CRYPTO SLOT THIS CHECK line (build
// report docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md §5). Two halves:
//
//   1. THE VERDICT on synthetic books, through the REAL fenced functions it
//      calls (validateTradeDecision, clearsHurdleFloor, getRecentSwapCount,
//      resolveHurdleAtr — none mocked): every reason, the first failing check
//      in the gates' order (ruling R-b), the books with no line, the cooldown
//      confirmation (ruling R-c), the dial-clamped config, the flag.
//   2. THE SOURCE PINS: the gate expressions in api/cron/agent-evaluate.js the
//      verdict mirrors (the cap's inline comparison above all — ruling R-c),
//      the gates' order, and where the cron computes and attaches the verdict
//      (after the forced-exit rebuild and the trigger gate, before the prompt
//      build; attached only when there is one). A change to the gate fails
//      here, so the verdict cannot drift from it silently.
//
// The end-to-end "verdict = gate" rows — the real cron, the real gates, the
// line in the real request — live in api/cron/agent-evaluate.cryptoSlotLine.test.js.
//
// NOTE (BUILD_RULES §4 dependency-surface guard): this file's UNMOCKED import
// of cryptoSlotVerdict.js is the runtime guard for its api → src imports.
// Only the flag is walked (vi.mock getter, importOriginal spread).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { flagState } = vi.hoisted(() => ({ flagState: { crypto: false, throws: false } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CRYPTO_SLOT_PROMPT_ENABLED() { if (flagState.throws) throw new Error('flag unreadable'); return flagState.crypto; },
}));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

import {
  computeCryptoSlotVerdict,
  computeCryptoSlotVerdictForced,
  verdictDecision,
  VERDICT_SWAP_REASON,
} from './cryptoSlotVerdict.js';
import { validateTradeDecision } from './agentSwapExecution.js';
import { clampHftConfig } from './tempoDialClamp.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// Comment- and whitespace-blind source (CRLF-safe): the pins compare code, not prose.
const code = (src) => src.replace(/\r\n/g, '\n').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ');
const CRON_RAW = readFileSync(join(HERE, '../cron/agent-evaluate.js'), 'utf8').replace(/\r\n/g, '\n');
const CRON = code(CRON_RAW);
const VERDICT_SRC_RAW = readFileSync(join(HERE, 'cryptoSlotVerdict.js'), 'utf8').replace(/\r\n/g, '\n');
const VERDICT_SRC = code(VERDICT_SRC_RAW);

const NOW = Date.parse('2026-10-14T15:00:00.000Z');
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString();
const ON_COOLDOWN = '2099-01-01T00:00:00.000Z';
const EXPIRED = '2000-01-01T00:00:00.000Z';

// The analyst's knobs as agentArchetypeConfig.js ships them (typed, not
// imported: a direct import of the archetype table would join the §2.3
// import-boundary ratchet for no gain — the verdict takes the config it is
// handed, which is the whole point).
const ANALYST = Object.freeze({
  label: 'Fundamental Investor',
  hftConfig: {
    forcedRotation: { enabled: true, pctThreshold: 0.003, ticksThreshold: 6, maxTickAgeMinutes: 20, winnerThreshold: 0 },
    hurdleFloor: {
      enabled: true,
      byReason: { haiku_decision: { atrMultiplier: 0.4 }, stagnation: { atrMultiplier: 0.5 } },
      default: { atrMultiplier: 0.4 },
      requireBenchPositive: true,
    },
    swapWindow: { enabled: true, capPerWindow: 4, windowMinutes: 60, countEmergencies: false },
  },
});

const stock = (symbol) => ({ symbol, isCrypto: false, baseATR: 3, sector: 'Technology' });
function book({ held = 'BTC', bench = 'ETH', benchCooldown = null, trades = [], gameMode = 'baggerbomb_agent', support2 = undefined, benchCrypto = undefined } = {}) {
  return {
    id: 'b1',
    gameMode,
    portfolio: {
      star: [stock('NVDA'), stock('TSLA')],
      core: [stock('MSFT'), stock('AMZN')],
      support: [stock('KO'), stock('PG'), support2 !== undefined ? support2 : { symbol: held, isCrypto: true, baseATR: 5, sector: 'Crypto' }],
      bench: {
        stocks: [stock('AMD'), stock('JPM')],
        crypto: benchCrypto !== undefined ? benchCrypto : { symbol: bench, isCrypto: true, baseATR: 5, sector: 'Crypto', ...(benchCooldown ? { cooldownUntil: benchCooldown } : {}) },
      },
      startingPrices: {},
    },
    trades,
  };
}
const prices = (ethDaily, btcDaily = 0.5) => ({ BTC: { current: 1, changePercent: btcDaily }, ETH: { current: 1, changePercent: ethDaily }, SOL: { current: 1, changePercent: ethDaily } });
const swap = (id, minutes, exitReason = 'haiku_decision') => ({ id, symbolOut: 'KO', symbolIn: 'JPM', swappedOutAt: minutesAgo(minutes), exitReason });
const SCORES = [{ symbol: 'BTC', baseATR: 5 }, { symbol: 'ETH', baseATR: 5 }];

function run(over = {}) {
  return computeCryptoSlotVerdictForced({
    battle: over.battle ?? book(),
    prices: over.prices ?? prices(3.0),
    lockedPositions: over.lockedPositions ?? new Set(),
    archetypeConfig: over.archetypeConfig ?? ANALYST,
    freshHurdleAtrMap: over.freshHurdleAtrMap ?? new Map(),
    assetScores: over.assetScores ?? SCORES,
    nowMs: over.nowMs ?? NOW,
  });
}
const reasonOf = (v) => (v === null ? null : v.canSwap ? 'can' : v.reason);

afterEach(() => {
  flagState.crypto = false;
  flagState.throws = false;
  vi.restoreAllMocks();
});

// ==================== 1. the verdict ====================

describe('the verdict — each check, through the real gate functions', () => {
  it('the fixed decision the validator is asked about (ruling R-c): SWAP, held out, bench in, conviction 70, a 10+ character hypothesis', () => {
    const d = verdictDecision('BTC', 'ETH');
    expect(d).toEqual({ decision: 'SWAP', symbolOut: 'BTC', symbolIn: 'ETH', conviction: 70, hypothesis: 'Crypto slot verdict: the held crypto for the bench crypto.' });
    expect(d.hypothesis.trim().length).toBeGreaterThanOrEqual(10);
    // On a clean book every other predicate the validator applies passes —
    // the premise behind "a refusal is the cooldown".
    expect(validateTradeDecision(d, book())).toEqual(expect.objectContaining({ valid: true, errors: [] }));
    expect(VERDICT_SWAP_REASON).toBe('haiku_decision');
  });

  it('all clear → can swap, with the bench crypto\'s raw daily move', () => {
    expect(run()).toEqual({ held: 'BTC', bench: 'ETH', canSwap: true, reason: null, benchDailyPct: 3.0 });
  });

  it('LOCK → lock (the gate\'s own predicate: lockedPositions.has(held))', () => {
    expect(reasonOf(run({ lockedPositions: new Set(['BTC']) }))).toBe('lock');
    expect(reasonOf(run({ lockedPositions: new Set(['NVDA']) }))).toBe('can'); // another position's lock is not the crypto's
  });

  it('cooldown → cooldown, confirmed by clearing it; an expired cooldown is no cooldown', () => {
    expect(reasonOf(run({ battle: book({ benchCooldown: ON_COOLDOWN }) }))).toBe('cooldown');
    expect(reasonOf(run({ battle: book({ benchCooldown: EXPIRED }) }))).toBe('can');
  });

  it('the bench crypto not up on the day → not_up (0.00 is not up; the BENCH table\'s `|| 0` for a missing quote too)', () => {
    expect(run({ prices: prices(-1.12) })).toEqual({ held: 'BTC', bench: 'ETH', canSwap: false, reason: 'not_up', benchDailyPct: -1.12 });
    expect(reasonOf(run({ prices: prices(0) }))).toBe('not_up');
    expect(run({ prices: { BTC: { changePercent: 0.5 } } })).toEqual(expect.objectContaining({ reason: 'not_up', benchDailyPct: 0 }));
  });

  it('up but short of the margin → margin (0.4 × the held ATR, as the gate computes it)', () => {
    // BTC +0.5, ATR 5 → the bench must be at least +2.50 (0.4 × 5 = 2.0 points over BTC).
    expect(reasonOf(run({ prices: prices(2.49) }))).toBe('margin');
    expect(reasonOf(run({ prices: prices(2.51) }))).toBe('can');
    // The fresh rankings ATR wins when there is one (resolveHurdleAtr): ATR 0.3 × 8 = 2.4 → +1.46 clears.
    expect(reasonOf(run({ prices: prices(1.47), freshHurdleAtrMap: new Map([['BTC', 0.3]]) }))).toBe('can');
    expect(reasonOf(run({ prices: prices(1.47) }))).toBe('margin');
    // A zero ATR cannot be compared — the gate refuses it (margin_invalid) — and so does the verdict.
    expect(reasonOf(run({ assetScores: [{ symbol: 'BTC', baseATR: 0 }] }))).toBe('margin');
    // No score for the held crypto → the gate's own ?? 2.5 fallback.
    expect(reasonOf(run({ assetScores: [], prices: prices(1.51) }))).toBe('can');
    expect(reasonOf(run({ assetScores: [], prices: prices(1.49) }))).toBe('margin');
  });

  it('the swap window full → swap_cap; out-of-window and emergency swaps do not count', () => {
    const four = [swap('a', 5), swap('b', 10), swap('c', 20), swap('d', 59)];
    expect(reasonOf(run({ battle: book({ trades: four }) }))).toBe('swap_cap');
    expect(reasonOf(run({ battle: book({ trades: four.slice(0, 3) }) }))).toBe('can');
    expect(reasonOf(run({ battle: book({ trades: [...four.slice(0, 3), swap('old', 61)] }) }))).toBe('can');
    expect(reasonOf(run({ battle: book({ trades: [...four.slice(0, 3), swap('e', 5, 'vwap_failure')] }) }))).toBe('can');
    expect(reasonOf(run({ battle: book({ trades: [...four.slice(0, 3), swap('f', 5, 'guardrail_profitTarget')] }) }))).toBe('can');
    // A disabled window caps nothing — the gate's `swCfg?.enabled &&`.
    const noWindow = { ...ANALYST, hftConfig: { ...ANALYST.hftConfig, swapWindow: { ...ANALYST.hftConfig.swapWindow, enabled: false } } };
    expect(reasonOf(run({ battle: book({ trades: four }), archetypeConfig: noWindow }))).toBe('can');
    // The window is anchored at nowMs — the gate's own Date.now().
    expect(reasonOf(run({ battle: book({ trades: four }), nowMs: NOW + 30 * 60000 }))).toBe('can');
  });

  it('the first failing check names the reason — the gates\' order LOCK → cooldown → not up → margin → cap (ruling R-b)', () => {
    const four = [swap('a', 5), swap('b', 10), swap('c', 20), swap('d', 30)];
    expect(reasonOf(run({ lockedPositions: new Set(['BTC']), battle: book({ benchCooldown: ON_COOLDOWN, trades: four }), prices: prices(-2) }))).toBe('lock');
    expect(reasonOf(run({ battle: book({ benchCooldown: ON_COOLDOWN, trades: four }), prices: prices(-2) }))).toBe('cooldown');
    expect(reasonOf(run({ battle: book({ trades: four }), prices: prices(-2) }))).toBe('not_up');
    expect(reasonOf(run({ battle: book({ trades: four }), prices: prices(1) }))).toBe('margin');
    expect(reasonOf(run({ battle: book({ trades: four }), prices: prices(3) }))).toBe('swap_cap');
  });

  it('follows the dial-clamped config it is handed (the gates use the clamped one): measured tempo → cap 3, margin ×1/0.7', () => {
    const measured = { ...ANALYST, hftConfig: clampHftConfig({ hftConfig: ANALYST.hftConfig, desiredTempo: 'measured', dialEnabled: true }).hftConfig };
    expect(measured.hftConfig.swapWindow.capPerWindow).toBe(3);
    const three = [swap('a', 5), swap('b', 10), swap('c', 20)];
    expect(reasonOf(run({ battle: book({ trades: three }), prices: prices(6.0) }))).toBe('can');
    expect(reasonOf(run({ battle: book({ trades: three }), prices: prices(6.0), archetypeConfig: measured }))).toBe('swap_cap');
    // 0.4 / 0.7 = 0.57 × 5 = 2.85 points over BTC's +0.5.
    expect(reasonOf(run({ prices: prices(3.0), archetypeConfig: measured }))).toBe('margin');
    expect(reasonOf(run({ prices: prices(3.4), archetypeConfig: measured }))).toBe('can');
  });

  it('ETH held / SOL on the bench — the symbols are the book\'s', () => {
    expect(run({ battle: book({ held: 'ETH', bench: 'SOL' }), assetScores: [{ symbol: 'ETH', baseATR: 5 }], prices: { ETH: { changePercent: 0.5 }, SOL: { changePercent: 3.0 } } })).toEqual({ held: 'ETH', bench: 'SOL', canSwap: true, reason: null, benchDailyPct: 3.0 });
  });
});

describe('the verdict — no line where there is nothing honest to say', () => {
  it('flat6, no crypto held, two cryptos held, no bench crypto, no book → null', () => {
    expect(run({ battle: book({ gameMode: 'baggerbomb_tournament' }) })).toBeNull();
    expect(run({ battle: book({ support2: stock('KO2') }) })).toBeNull();
    const two = book();
    two.portfolio.core[1] = { symbol: 'SOL', isCrypto: true, baseATR: 6 };
    expect(run({ battle: two })).toBeNull();
    expect(run({ battle: book({ benchCrypto: null }) })).toBeNull();
    expect(run({ battle: book({ benchCrypto: { isCrypto: true } }) })).toBeNull();
    expect(run({ battle: { gameMode: 'baggerbomb_agent' } })).toBeNull();
  });

  it('a validator refusal that is NOT the cooldown is structural → null, never "cooldown" (bench crypto missing isCrypto: the type match refuses)', () => {
    const malformed = book({ benchCrypto: { symbol: 'ETH', baseATR: 5 } });
    expect(validateTradeDecision(verdictDecision('BTC', 'ETH'), malformed).valid).toBe(false);
    expect(run({ battle: malformed })).toBeNull();
    // …even when a cooldown is ALSO present: clearing it does not cure the refusal.
    expect(run({ battle: book({ benchCrypto: { symbol: 'ETH', baseATR: 5, cooldownUntil: ON_COOLDOWN } }) })).toBeNull();
  });

  it('the bench crypto already held → structural → null', () => {
    const b = book();
    b.portfolio.core[0] = { symbol: 'ETH', isCrypto: false, baseATR: 5 };
    expect(run({ battle: b })).toBeNull();
  });
});

describe('the verdict — the flag and the tick-side wrapper', () => {
  const args = () => ({ battle: book(), prices: prices(3.0), lockedPositions: new Set(), archetypeConfig: ANALYST, freshHurdleAtrMap: new Map(), assetScores: SCORES, nowMs: NOW });

  it('dark: computeCryptoSlotVerdict is null while the flag is off, read at call time', () => {
    flagState.crypto = false;
    expect(computeCryptoSlotVerdict(args())).toBeNull();
    flagState.crypto = true;
    expect(computeCryptoSlotVerdict(args())).toEqual(computeCryptoSlotVerdictForced(args()));
    flagState.crypto = false;
    expect(computeCryptoSlotVerdict(args())).toBeNull();
  });

  it('dark: nothing runs, not even the clock read — a dark tick does exactly what it did before', () => {
    flagState.crypto = false;
    const now = vi.spyOn(Date, 'now');
    const { nowMs, ...noClock } = args();
    expect(computeCryptoSlotVerdict(noClock)).toBeNull();
    expect(now).not.toHaveBeenCalled();
  });

  it('lit, without nowMs: the cap window is anchored at Date.now() taken after the flag', () => {
    flagState.crypto = true;
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const four = [swap('a', 5), swap('b', 10), swap('c', 20), swap('d', 59)];
    const { nowMs, ...noClock } = args();
    expect(reasonOf(computeCryptoSlotVerdict({ ...noClock, battle: book({ trades: four }) }))).toBe('swap_cap');
    Date.now.mockReturnValue(NOW + 2 * 60000);
    expect(reasonOf(computeCryptoSlotVerdict({ ...noClock, battle: book({ trades: four }) }))).toBe('can');
  });

  it('an unreadable flag is no line, never a thrown tick', () => {
    flagState.throws = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(computeCryptoSlotVerdict(args())).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('a fault is no line, never a thrown tick', () => {
    flagState.crypto = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const throwing = { ...args(), battle: { gameMode: 'baggerbomb_agent', get portfolio() { throw new Error('boom'); } } };
    expect(computeCryptoSlotVerdict(throwing)).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});

// ==================== 2. the source pins ====================

/** The text of `start` … the first `end` after it, comment- and whitespace-blind. */
function slice(src, start, end) {
  const at = src.indexOf(start);
  expect(at, `anchor not found: ${start}`).toBeGreaterThan(-1);
  const stop = src.indexOf(end, at + start.length);
  expect(stop, `end not found after: ${start}`).toBeGreaterThan(at);
  return src.slice(at, stop + end.length);
}

describe('source pins — the verdict mirrors the gates as they run in agent-evaluate.js', () => {
  it('the swap cap: the gate\'s inline expression and the verdict\'s are the same expression (ruling R-c: never extracted, pinned instead)', () => {
    const gate = slice(CRON, 'const capBlocked = swCfg?.enabled', ';');
    expect(gate).toBe('const capBlocked = swCfg?.enabled && !EMERGENCY_BYPASS_REASONS.has(haikuSwapReason) && !USER_DIRECTIVE_BYPASS_REASONS.has(haikuSwapReason) && getRecentSwapCount(battle.trades || [], swCfg.windowMinutes, Date.now(), { countEmergencies: swCfg.countEmergencies }) >= swCfg.capPerWindow;');
    const mirrored = slice(VERDICT_SRC, 'const capBlocked = swCfg?.enabled', ';')
      .replace(/VERDICT_SWAP_REASON/g, 'haikuSwapReason')
      .replace('nowMs', 'Date.now()');
    expect(mirrored).toBe(gate);
    expect(CRON).toContain('const swCfg = archetypeConfig.hftConfig?.swapWindow; const capBlocked');
    expect(VERDICT_SRC).toContain('const swCfg = archetypeConfig?.hftConfig?.swapWindow; const capBlocked');
  });

  it('the hurdle floor: the same call, the same arguments, the same ATR fallback', () => {
    const gateAtr = slice(CRON, 'const activeBaseATR = assetScores.find(', ';');
    expect(gateAtr).toBe('const activeBaseATR = assetScores.find(s => s.symbol === haikuResult.symbolOut)?.baseATR ?? 2.5;');
    const gate = slice(CRON, 'const hurdle = clearsHurdleFloor({', '});');
    expect(gate).toBe('const hurdle = clearsHurdleFloor({ active: { symbol: haikuResult.symbolOut, dailyPct: (prices[haikuResult.symbolOut]?.changePercent || 0) / 100 }, benchCandidate: { symbol: haikuResult.symbolIn, dailyPct: (prices[haikuResult.symbolIn]?.changePercent || 0) / 100 }, reason: haikuSwapReason, archetypeConfig, userATR: resolveHurdleAtr(haikuResult.symbolOut, freshHurdleAtrMap, activeBaseATR).atr, });');
    const mirrored = slice(VERDICT_SRC, 'const hurdle = clearsHurdleFloor({', '});')
      .replace(/prices\?\.\[held\]/g, 'prices[haikuResult.symbolOut]')
      .replace(/prices\?\.\[bench\]/g, 'prices[haikuResult.symbolIn]')
      .replace(/symbol: held/g, 'symbol: haikuResult.symbolOut')
      .replace(/symbol: bench/g, 'symbol: haikuResult.symbolIn')
      .replace('VERDICT_SWAP_REASON', 'haikuSwapReason')
      .replace('resolveHurdleAtr(held,', 'resolveHurdleAtr(haikuResult.symbolOut,');
    expect(mirrored).toBe(gate);
    expect(VERDICT_SRC).toContain('const activeBaseATR = assetScores?.find?.((s) => s.symbol === held)?.baseATR ?? 2.5;');
    // The model's own swap reaches the gate as haiku_decision (no guardrail sourceNote).
    expect(CRON).toContain(": 'haiku_decision';");
  });

  it('LOCK and the validator: the gates\' own predicates', () => {
    expect(CRON).toContain('if (decision === \'SWAP\' && haikuResult && lockedPositions.has(haikuResult.symbolOut)) {');
    expect(CRON).toContain('const validation = validateTradeDecision(haikuResult, battle);');
    expect(VERDICT_SRC).toContain('if (lockedPositions?.has?.(held)) return verdict(false, \'lock\');');
    expect(VERDICT_SRC).toContain('if (!validateTradeDecision(decision, battle).valid) {');
  });

  it('the gates\' order at HEAD is LOCK → distressed → validator → hurdle → cap — and the verdict checks in that order (ruling R-b)', () => {
    const at = (s, src = CRON) => { const i = src.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    const order = [
      at('lockedPositions.has(haikuResult.symbolOut)) {'),
      at("stockRegimes[haikuResult.symbolIn] === 'distressed') {"),
      at('const validation = validateTradeDecision(haikuResult, battle);'),
      at('const hurdle = clearsHurdleFloor({ active: { symbol: haikuResult.symbolOut'),
      at('if (!hurdle.clears) {'),
      at('} else if (capBlocked) {'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const v = [
      at("return verdict(false, 'lock')", VERDICT_SRC),
      at("return verdict(false, 'cooldown')", VERDICT_SRC),
      at("return verdict(false, 'not_up')", VERDICT_SRC),
      at("return verdict(false, 'margin')", VERDICT_SRC),
      at("return verdict(false, 'swap_cap')", VERDICT_SRC),
      at('return verdict(true, null)', VERDICT_SRC),
    ];
    expect([...v].sort((a, b) => a - b)).toEqual(v);
  });

  it('the verdict module re-implements nothing: no date, margin or floor arithmetic of its own', () => {
    const body = VERDICT_SRC.slice(VERDICT_SRC.indexOf('export function verdictDecision'));
    expect(body).not.toMatch(/new Date\(|Date\.parse|atrMultiplier|marginAtrUnits|requireBenchPositive|isCrypto !==|> 0\b|<= 0\b/);
  });
});

describe('source pins — where the cron computes and attaches the verdict', () => {
  const at = (s) => { const i = CRON_RAW.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };

  it('after the forced-exit rebuild, the proposal / meeting re-reads and the trigger gate; before the prompt build', () => {
    const call = at('const cryptoSlotVerdict = refreshFailure ? null : computeCryptoSlotVerdict({ battle, prices, lockedPositions, archetypeConfig, freshHurdleAtrMap, assetScores });');
    expect(CRON_RAW.split('computeCryptoSlotVerdict(')).toHaveLength(2);
    expect(at('Rebuilt decision snapshot after')).toBeLessThan(call);
    expect(at('await handleGameplanMeeting(db, battleRef, battle')).toBeLessThan(call);
    expect(at('if (!shouldEvaluate) {')).toBeLessThan(call);
    expect(call).toBeLessThan(at('const buildPrompt = async () => {'));
    expect(call).toBeLessThan(at('const liveContextBlock = await buildLiveContextBlock('));
    expect(call).toBeLessThan(at('await anthropic.messages.create('));
  });

  it('attached only when there is a verdict — the flag-off momentumData never carries the key', () => {
    expect(CRON_RAW).toContain('    if (cryptoSlotVerdict) momentumData.cryptoSlotVerdict = cryptoSlotVerdict;\n');
    expect(CRON_RAW.split('momentumData.cryptoSlotVerdict')).toHaveLength(2);
    expect(CRON_RAW.split('cryptoSlotVerdict:')).toHaveLength(1);
  });
});
