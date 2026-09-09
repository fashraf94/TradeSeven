// api/_utils/tickStamps.test.js
//
// Phase B — the tick stamps: the PURE COMPOSER's contract (spec §1.2–1.4, §3;
// D-110 → D-112; review findings A-1…A-7, C-2 folded in). Imports what it
// guards. The Heard rows drive the REAL resolveControls (the same pure function
// the fenced assembler and the cron call) so the three `suppressed` words are
// the resolver's own, never a copy. The vintage rows drive the REAL
// buildFundamentalsBlock (non-fenced) so `fundAsOf` is proved equal to the
// rendered header date. The size rows apply the Firestore storage-size rule
// from the discovery §3 to the seven-position fixture the end-to-end harness
// uses.

import { describe, it, expect } from 'vitest';
import {
  TICK_STAMP_KEYS,
  EVIDENCE_FIELDS,
  VINTAGE_FIELDS,
  CANDIDATE_FIELDS,
  HEARD_SUPPRESSED_REASONS,
  deriveHeardStamp,
  composeEvidenceStamp,
  composeVintages,
  composeCandidatesStamp,
  composeTickStamps,
} from './tickStamps.js';
import { resolveControls, SUPPRESSION_REASONS } from './controlPromptRenderer.js';
import { classifyStockRegime } from './agentRegimeClassifier.js';
import { buildFundamentalsBlock } from './fundamentalsRender.js';
import { FUNDAMENTAL_MIRROR_ENABLED } from '../../src/config/featureFlags.js';
import {
  HELD,
  BENCH,
  OLD_THREAD,
  RANKINGS_COMPUTED_AT_MS,
  TECH_UPDATED_AT_MS,
  FUND_COMPUTED_AT_MS,
  FUND_COMPUTED_AT_OLDER_MS,
  FUND_COMPUTED_AT_BENCH_MS,
  makeDirective,
  makeTickBattle,
  makePriceTable,
  makeRankingsDoc,
  makeTechDocs,
  makeAnticipationCandidates,
  firestoreBytes,
  jsonBytes,
  undefinedPaths,
} from './__fixtures__/tickStampsHarness.js';

const ENFORCE = { archetypeIntegrityMode: 'enforce', standingLeansEnabled: true };
const resolve = (directive, extra = {}) => resolveControls({ modes: ENFORCE, directive, standingLeans: [], leanOverrides: [], controlEpochLog: [], ...extra });
const controlResolutionFor = (directive) => resolve(directive);
const toFixed2 = (v) => Number(v.toFixed(2)) || 0;

/** The seven-position inputs exactly as the cron holds them at the entry (mirrors the e2e harness). */
function makeStampInputs({ riskOverrides = {}, regimeOverride = null } = {}) {
  const prices = makePriceTable();
  const battle = makeTickBattle();
  const starting = battle.portfolio.startingPrices;
  const baseATR = { NVDA: 3.1, TSLA: 4, MSFT: 1.9, AMZN: 2.2, KO: 1.1, PG: 1, BTC: 5 };
  const assetScores = HELD.map((symbol) => {
    const priceChange = ((prices[symbol].current - starting[symbol]) / starting[symbol]) * 100;
    return { symbol, priceChange, multiplier: priceChange / baseATR[symbol], baseATR: baseATR[symbol], badges: [] };
  });
  const stocks = makeRankingsDoc().stocks;
  const techScoresMap = makeTechDocs();
  const stockRegimes = {};
  for (const sym of [...HELD, ...BENCH]) {
    if (techScoresMap[sym]) stockRegimes[sym] = regimeOverride || classifyStockRegime(techScoresMap[sym]);
  }
  const rankings = Object.fromEntries(stocks.map((s) => [s.symbol, { bBandwidthPercentile: s.bBandwidthPercentile ?? null, nr7Flag: s.nr7Flag ?? false, dailyRange: s.dailyRange ?? null }]));
  const momentumData = {
    vwap: { NVDA: { vwap: 122.12, currentPrice: 123.4, vwapDeviation: 1.0483, sma20_5m: null, sessionDate: '2026-09-09' } },
    rankings,
    rankingsMap: Object.fromEntries(stocks.map((s) => [s.symbol, s])),
    techScoresMap,
    regimes: stockRegimes,
  };
  const riskStatus = Object.fromEntries(HELD.map((s) => [s, { action: 'HOLD', reason: null, detail: '' }]));
  riskStatus.NVDA = { action: 'LOCK', reason: 'threshold_proximity', detail: 'NVDA at +0.78x ATR — only 0.22x from BaggerBomb (+15pts). Position locked.' };
  Object.assign(riskStatus, riskOverrides);
  // The FUNDAMENTALS block's bench set — flattenBenchServer's shape (benchType + slotIndex on each asset).
  const benchAssets = battle.portfolio.bench.stocks.map((a, i) => ({ ...a, benchType: 'stock', slotIndex: i }));
  return { assetScores, prices, momentumData, stockRegimes, riskStatus, benchAssets, battle };
}

describe('tick stamps — the module surface', () => {
  it('names the four entry keys, the eight evidence fields, the five vintage fields and the five candidate fields', () => {
    expect([...TICK_STAMP_KEYS]).toEqual(['heard', 'evidence', 'vintages', 'candidates']);
    expect([...EVIDENCE_FIELDS]).toEqual(['px', 'chg', 'atrX', 'vwapDev', 'bbPct', 'nr7', 'regime', 'risk']);
    expect([...VINTAGE_FIELDS]).toEqual(['quote', 'vwap', 'techAt', 'fundAsOf', 'rankingsAt']);
    expect([...CANDIDATE_FIELDS]).toEqual(['symbol', 'direction', 'signalSummary', 'threshold', 'signalSource']);
  });

  it('rsPct is NOT an evidence field: the prompt renders rsPercentile for bench names only (review A-2)', () => {
    expect(EVIDENCE_FIELDS).not.toContain('rsPct');
  });

  it("the three `suppressed` words are the resolver's own directive reasons (controlPromptRenderer.js), no copy", () => {
    expect([...HEARD_SUPPRESSED_REASONS]).toEqual([
      SUPPRESSION_REASONS.MALFORMED,
      SUPPRESSION_REASONS.MODE_NOT_ENFORCE,
      SUPPRESSION_REASONS.EPOCH_KILLED,
    ]);
  });
});

describe('Heard (D-110) — derived from the cron\'s own resolveControls resolution, never the model\'s echo', () => {
  it('no active directive → null (the key is absent from the entry)', () => {
    expect(deriveHeardStamp(resolve(null))).toBeNull();
    expect(deriveHeardStamp(undefined)).toBeNull();
    expect(deriveHeardStamp({})).toBeNull();
  });

  it('a rendered directive → { directiveThreadId, suppressed: null } — exactly two keys, never the text', () => {
    const stamp = deriveHeardStamp(resolve(makeDirective()));
    expect(stamp).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
    expect(Object.keys(stamp)).toEqual(['directiveThreadId', 'suppressed']);
    expect(JSON.stringify(stamp)).not.toContain('Require stronger confirmation');
  });

  it("suppressed 'mode_not_enforce' — the directive existed but the assembler withheld it under any mode but enforce (NOT Heard)", () => {
    for (const mode of ['observe', 'off', undefined]) {
      const resolution = resolveControls({ modes: { archetypeIntegrityMode: mode, standingLeansEnabled: true }, directive: makeDirective(), controlEpochLog: [] });
      expect(deriveHeardStamp(resolution)).toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'mode_not_enforce' });
    }
  });

  it("suppressed 'epoch_killed' — a thread the battle's controlEpochLog ever logged as suppressed stays dead (no resurrection)", () => {
    const resolution = resolve(makeDirective(), { controlEpochLog: [{ epochKey: 'integrity=observe|leans=on', suppressedDirectiveIds: [OLD_THREAD] }] });
    expect(deriveHeardStamp(resolution)).toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'epoch_killed' });
  });

  it("suppressed 'malformed' — a type-corrupt directive the resolver could not render: a non-string text keeps its id; a NON-STRING id (truthy, so it passes the cron's pre-gate) is named 'unknown' — reachable end to end (review A-10 / D-5, V3); an id-LESS one never reaches the resolver from the cron (the pre-gate turns it into no directive → key absent)", () => {
    expect(deriveHeardStamp(resolve({ text: 42, directiveThreadId: OLD_THREAD })))
      .toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'malformed' });
    expect(deriveHeardStamp(resolve({ text: 'ok', directiveThreadId: 7 })))
      .toEqual({ directiveThreadId: 'unknown', suppressed: 'malformed' });
    expect(deriveHeardStamp(resolve({ text: 'x' })))
      .toEqual({ directiveThreadId: 'unknown', suppressed: 'malformed' });
  });

  it('every suppressed word the stamp can carry is one of the three ruled reasons', () => {
    const cases = [
      resolve(makeDirective(), { modes: { archetypeIntegrityMode: 'observe' } }),
      resolve(makeDirective(), { controlEpochLog: [{ suppressedDirectiveIds: [OLD_THREAD] }] }),
      resolve({ text: 42, directiveThreadId: OLD_THREAD }),
    ];
    for (const resolution of cases) {
      expect(HEARD_SUPPRESSED_REASONS).toContain(deriveHeardStamp(resolution).suppressed);
    }
  });

  it('a lean-only suppression is not a directive suppression — no directive, no key', () => {
    const resolution = resolveControls({
      modes: { archetypeIntegrityMode: 'enforce', standingLeansEnabled: false },
      directive: null,
      standingLeans: [{ adjustmentId: 'TF-01', version: 1, text: 'Lean text' }],
    });
    expect(resolution.suppressionDescriptors.some((d) => d.target === 'lean')).toBe(true);
    expect(deriveHeardStamp(resolution)).toBeNull();
  });
});

describe('the evidence (D-111) — eight fields per HELD position, each a number a RENDERED line carried', () => {
  it('stamps every held position and NO bench name, though bench quotes / regimes / tech scores are in scope', () => {
    const inputs = makeStampInputs();
    for (const sym of BENCH) {
      expect(inputs.prices[sym]).toBeTruthy();
      expect(inputs.stockRegimes[sym]).toBeTruthy();
      expect(inputs.momentumData.techScoresMap[sym]).toBeTruthy();
    }
    const evidence = composeEvidenceStamp(inputs);
    expect(Object.keys(evidence)).toEqual([...HELD]);
    for (const sym of BENCH) expect(evidence).not.toHaveProperty(sym);
  });

  it('each record carries exactly the eight fields, in order — no rsPct, no story ids, no epsRev30d / sectorRs (cut by ruling or by render)', () => {
    const evidence = composeEvidenceStamp(makeStampInputs());
    for (const sym of HELD) {
      expect(Object.keys(evidence[sym])).toEqual([...EVIDENCE_FIELDS]);
    }
    expect(JSON.stringify(evidence)).not.toMatch(/rsPct|rsPercentile|stories|storyIds|epsRev|sectorRs|thresholdProximity|archScore/i);
  });

  it('the fields come from their named sources at the rendered precision — chg is the CSV row\'s Gain% from ENTRY (review A-1), never the quote\'s session change', () => {
    const inputs = makeStampInputs();
    const { NVDA, TSLA, BTC } = composeEvidenceStamp(inputs);
    expect(NVDA.px).toBe(123.4);                                  // prices.NVDA.current ($Current)
    expect(NVDA.chg).toBe(2.41);                                  // assetScores.priceChange: (123.4 − 120.5) / 120.5 → the row's +2.41%
    expect(NVDA.chg).not.toBe(1.98);                              // NOT prices.NVDA.changePercent (rendered for bench names only)
    expect(NVDA.atrX).toBe(toFixed2(inputs.assetScores[0].multiplier)); // assetScores.multiplier (ATR Mult)
    expect(NVDA.atrX).toBe(0.78);
    expect(NVDA.vwapDev).toBe(1.05);                              // momentumData.vwap.NVDA.vwapDeviation (1.0483 → 1.05)
    expect(NVDA.bbPct).toBe(15);                                  // momentumData.rankings.NVDA.bBandwidthPercentile
    expect(NVDA.nr7).toBe(true);                                  // momentumData.rankings.NVDA.nr7Flag
    expect(NVDA.regime).toBe('directional_expansion');            // stockRegimes.NVDA (the real classifier)
    expect(NVDA.risk).toEqual({ action: 'LOCK', reason: 'threshold_proximity' }); // riskStatus.NVDA
    expect(TSLA.chg).toBe(-2.08);                                 // (244.9 − 250.1) / 250.1
    expect(TSLA.regime).toBe('distressed');
    expect(TSLA.nr7).toBe(false);
    expect(TSLA.vwapDev).toBeNull();                              // no VWAP session for TSLA this tick
    expect(BTC.chg).toBe(0.67);                                   // (67450 − 67000) / 67000
  });

  it('rounds with the renderer\'s own primitive — Number(v.toFixed(2)) — never Math.round(v*100)/100 (review A-5 / C-2), and never a negative zero', () => {
    const inputs = makeStampInputs();
    inputs.prices.NVDA = { current: 0.615, previousClose: 0.6, changePercent: 0 };
    inputs.prices.TSLA = { current: 2.675, previousClose: 2.6, changePercent: 0 };
    inputs.assetScores = inputs.assetScores.map((s) => (s.symbol === 'MSFT' ? { ...s, priceChange: -9.955, multiplier: -0.005 } : s));
    inputs.momentumData.vwap.KO = { vwapDeviation: -0.001 };
    const { NVDA, TSLA, MSFT, KO } = composeEvidenceStamp(inputs);
    expect(NVDA.px).toBe(Number((0.615).toFixed(2)));   // 0.61 — Math.round would say 0.62
    expect(NVDA.px).toBe(0.61);
    expect(TSLA.px).toBe(2.67);                          // Math.round would say 2.68
    expect(MSFT.chg).toBe(-9.96);                        // Math.round would say -9.95
    expect(Object.is(MSFT.atrX, -0)).toBe(false);        // (-0.005).toFixed(2) is "-0.01"; (-0.001) would be "-0.00" → 0
    expect(Object.is(KO.vwapDev, -0)).toBe(false);
    expect(KO.vwapDev).toBe(0);
  });

  it('null honesty (C-20): an absent metric is null — never 0, never a default, never undefined', () => {
    const inputs = makeStampInputs();
    const { BTC } = composeEvidenceStamp(inputs);                 // no ranking row, no technical doc, no VWAP
    expect(BTC.bbPct).toBeNull();
    expect(BTC.nr7).toBeNull();
    expect(BTC.regime).toBeNull();
    expect(BTC.vwapDev).toBeNull();
    expect(BTC.px).toBe(67450);
    // Nothing known at all for a held symbol: eight nulls, still eight keys.
    const bare = composeEvidenceStamp({ assetScores: [{ symbol: 'ZZZ', multiplier: NaN }], prices: {}, momentumData: {}, stockRegimes: {}, riskStatus: {} });
    expect(bare.ZZZ).toEqual({ px: null, chg: null, atrX: null, vwapDev: null, bbPct: null, nr7: null, regime: null, risk: null });
    expect(undefinedPaths(bare)).toEqual([]);
  });

  it('`risk` carries `reason` ONLY when non-HOLD (the code, not the rendered detail sentence — review A-7); a non-HOLD verdict without a reason falls back to its detail', () => {
    const inputs = makeStampInputs({
      riskOverrides: {
        TSLA: { action: 'SWAP_OUT', reason: 'vwap_failure', detail: 'below VWAP' },
        MSFT: { action: 'TRAIL_STOP', reason: null, detail: 'trailing stop hit' },
        KO: { action: 'HOLD', reason: 'should_never_be_stamped', detail: 'nor this' },
      },
    });
    const evidence = composeEvidenceStamp(inputs);
    expect(evidence.KO.risk).toEqual({ action: 'HOLD' });
    expect(evidence.KO.risk).not.toHaveProperty('reason');
    expect(evidence.PG.risk).toEqual({ action: 'HOLD' });
    expect(evidence.NVDA.risk).toEqual({ action: 'LOCK', reason: 'threshold_proximity' });
    expect(evidence.TSLA.risk).toEqual({ action: 'SWAP_OUT', reason: 'vwap_failure' });
    expect(evidence.MSFT.risk).toEqual({ action: 'TRAIL_STOP', reason: 'trailing stop hit' });
    expect(JSON.stringify(evidence)).not.toContain('detail');
  });

  it('a duplicated symbol in assetScores stamps once (first wins); non-string symbols are skipped', () => {
    const inputs = makeStampInputs();
    inputs.assetScores = [...inputs.assetScores, { symbol: 'NVDA', multiplier: 9, priceChange: 9 }, { symbol: null }, { symbol: 7 }];
    const evidence = composeEvidenceStamp(inputs);
    expect(Object.keys(evidence)).toEqual([...HELD]);
    expect(evidence.NVDA.atrX).toBe(0.78);
  });
});

describe('the vintages — one block per entry; instants and dates for the doc-borne sources, never a cadence word', () => {
  const vintagesFor = (inputs, { benchAssets = inputs.benchAssets } = {}) => composeVintages({
    heldSymbols: HELD,
    benchAssets,
    rankingsMap: inputs.momentumData.rankingsMap,
    techScoresMap: inputs.momentumData.techScoresMap,
    rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS,
  });

  it('carries the five fields: quote / vwap fetched this tick, techAt and rankingsAt as instants, fundAsOf as a date', () => {
    const v = vintagesFor(makeStampInputs());
    expect(Object.keys(v)).toEqual([...VINTAGE_FIELDS]);
    expect(v.quote).toBe('tick');
    expect(v.vwap).toBe('tick');
    expect(v.techAt).toBe('2026-09-09T14:29:55.000Z');       // the newest held stockTechnicalScores updatedAt
    expect(v.fundAsOf).toBe('2026-09-08');                     // the FUNDAMENTALS block's header date (held + bench; bench AMD is the newest)
    expect(v.rankingsAt).toBe('2026-09-09T14:30:00.000Z');    // the stockRankings doc's computedAt
  });

  it('never says "weekly" or "daily" — the technical docs are rewritten hourly during RTH (review A-3), so only an instant is honest', () => {
    const v = vintagesFor(makeStampInputs());
    expect(JSON.stringify(v)).not.toMatch(/weekly|daily/i);
    expect(v).not.toHaveProperty('fund');
    expect(v).not.toHaveProperty('tech');
    expect(v.fundAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v.techAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('fundAsOf follows the FUNDAMENTALS block\'s header rule — the newest vintage across HELD + NON-CRYPTO BENCH (review A-6): bench can win, crypto bench cannot, held-only when the bench is empty', () => {
    const inputs = makeStampInputs();
    expect(vintagesFor(inputs).fundAsOf).toBe('2026-09-08');                                   // bench AMD (Sep 8) wins over held (Sep 4)
    expect(vintagesFor(inputs, { benchAssets: [] }).fundAsOf).toBe('2026-09-04');               // held-only: the newest held (NVDA/TSLA/MSFT/PG), KO's Sep 1 does not drag it back
    const cryptoBench = [{ symbol: 'AMD', isCrypto: true, benchType: 'stock' }];               // a crypto-flagged bench asset is excluded like the block does
    expect(vintagesFor(inputs, { benchAssets: cryptoBench }).fundAsOf).toBe('2026-09-04');
    const heldOnly = composeVintages({ heldSymbols: ['KO'], rankingsMap: inputs.momentumData.rankingsMap, rankingsComputedAtMs: null });
    expect(heldOnly.fundAsOf).toBe('2026-09-01');
  });

  it('display agreement (§9): fundAsOf equals the date the REAL buildFundamentalsBlock prints in its "Fundamentals data as of" header, by construction', () => {
    if (!FUNDAMENTAL_MIRROR_ENABLED) return; // the block renders nothing while dark; the stamp then describes nothing rendered
    const inputs = makeStampInputs();
    const rendered = buildFundamentalsBlock(inputs.assetScores, inputs.battle.portfolio.bench, inputs.momentumData.rankingsMap);
    const m = /Fundamentals data as of (\d{2})-(\d{2}) \(UTC\)/.exec(rendered || '');
    expect(m, 'the FUNDAMENTALS block must render its header date').toBeTruthy();
    const v = vintagesFor(inputs);
    expect(v.fundAsOf.slice(5)).toBe(`${m[1]}-${m[2]}`);
  });

  it('null honesty: no technical docs → techAt null; no fundamentals → fundAsOf null; no rankings computedAt → rankingsAt null; Timestamp-likes and numbers are both accepted', () => {
    const none = composeVintages({ heldSymbols: ['BTC'], rankingsMap: { BTC: {} }, techScoresMap: {}, rankingsComputedAtMs: null });
    expect(none).toEqual({ quote: 'tick', vwap: 'tick', techAt: null, fundAsOf: null, rankingsAt: null });
    expect(composeVintages({ heldSymbols: [], rankingsMap: undefined, rankingsComputedAtMs: NaN }).rankingsAt).toBeNull();
    expect(composeVintages({ heldSymbols: [], rankingsMap: {}, rankingsComputedAtMs: { toMillis: () => RANKINGS_COMPUTED_AT_MS } }).rankingsAt).toBe('2026-09-09T14:30:00.000Z');
    expect(composeVintages({ heldSymbols: ['X'], techScoresMap: { X: { updatedAt: TECH_UPDATED_AT_MS } }, rankingsMap: {}, rankingsComputedAtMs: null }).techAt).toBe('2026-09-09T14:29:55.000Z');
    expect(composeVintages({ heldSymbols: ['X'], techScoresMap: { X: { updatedAt: new Date(TECH_UPDATED_AT_MS) } }, rankingsMap: {}, rankingsComputedAtMs: null }).techAt).toBe('2026-09-09T14:29:55.000Z');
    expect(undefinedPaths(none)).toEqual([]);
  });

  it('techAt is the NEWEST held technical vintage and ignores bench docs', () => {
    const techScoresMap = {
      KO: { updatedAt: { toMillis: () => Date.UTC(2026, 8, 9, 13, 0) } },
      PG: { updatedAt: { toMillis: () => Date.UTC(2026, 8, 9, 14, 0) } },
      AMD: { updatedAt: { toMillis: () => Date.UTC(2026, 8, 9, 15, 0) } }, // bench — must not win
    };
    expect(composeVintages({ heldSymbols: ['KO', 'PG'], benchAssets: [{ symbol: 'AMD' }], techScoresMap, rankingsMap: {}, rankingsComputedAtMs: null }).techAt).toBe('2026-09-09T14:00:00.000Z');
  });
});

describe('the candidates (D-112) — the decider\'s own output, four fields plus the tag, rationale cut', () => {
  it('persists symbol / direction / signalSummary / threshold (+ signalSource when sent) and cuts rationale', () => {
    const stamped = composeCandidatesStamp(makeAnticipationCandidates());
    expect(stamped).toHaveLength(2);
    expect(stamped[0]).toEqual({
      symbol: 'AMD',
      direction: 'potential_entry',
      signalSummary: 'Relative strength building against the sector and volume is confirming.',
      threshold: 'If it holds above the 20-day on the next test, I would rotate it into Core.',
      signalSource: 'relative_strength',
    });
    expect(Object.keys(stamped[0])).toEqual([...CANDIDATE_FIELDS]);
    expect(JSON.stringify(stamped)).not.toContain('rationale');
    expect(JSON.stringify(stamped)).not.toContain('Fuller context');
  });

  it('signalSource is OMITTED (never undefined) when the model sent none; the queue\'s admission rule drops an item without a symbol', () => {
    const stamped = composeCandidatesStamp(makeAnticipationCandidates());
    expect(Object.keys(stamped[1])).toEqual(['symbol', 'direction', 'signalSummary', 'threshold']);
    expect(stamped[1]).not.toHaveProperty('signalSource');
    expect(stamped.some((c) => c.signalSummary?.includes('no symbol'))).toBe(false);
    expect(undefinedPaths(stamped)).toEqual([]);
  });

  it('threshold IS persisted here (the render withholding is D-103\'s, at voiceLayerAnticipation.js — never this module\'s)', () => {
    const [amd] = composeCandidatesStamp(makeAnticipationCandidates());
    expect(typeof amd.threshold).toBe('string');
    expect(amd.threshold.length).toBeGreaterThan(0);
  });

  it('null when the model sent nothing usable — the caller omits the key', () => {
    expect(composeCandidatesStamp(undefined)).toBeNull();
    expect(composeCandidatesStamp(null)).toBeNull();
    expect(composeCandidatesStamp([])).toBeNull();
    expect(composeCandidatesStamp([null, 'x', { direction: 'potential_entry' }, { symbol: '' }])).toBeNull();
  });
});

describe('composeTickStamps — the object the cron spreads onto the entry', () => {
  const fullArgs = (inputs, extra = {}) => ({
    promptBuilt: true,
    controlResolution: controlResolutionFor(makeDirective()),
    anticipationCandidates: makeAnticipationCandidates(),
    ...inputs,
    rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS,
    ...extra,
  });

  it('promptBuilt false (a budget_skipped tick never built the prompt; a builder throw never finished it) → {} — nothing heard, nothing seen, even with a directive and candidates in hand', () => {
    const inputs = makeStampInputs();
    expect(composeTickStamps(fullArgs(inputs, { promptBuilt: false }))).toEqual({});
    expect(composeTickStamps(fullArgs(inputs, { promptBuilt: undefined }))).toEqual({});
    expect(composeTickStamps(fullArgs(inputs, { promptBuilt: 1 }))).toEqual({});
  });

  it('promptBuilt true → heard + evidence + vintages + candidates, in that order, keys ⊆ TICK_STAMP_KEYS', () => {
    const out = composeTickStamps(fullArgs(makeStampInputs()));
    expect(Object.keys(out)).toEqual(['heard', 'evidence', 'vintages', 'candidates']);
    for (const k of Object.keys(out)) expect(TICK_STAMP_KEYS).toContain(k);
    expect(out.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
    expect(Object.keys(out.evidence)).toEqual([...HELD]);
    expect(out.vintages).toEqual({ quote: 'tick', vwap: 'tick', techAt: '2026-09-09T14:29:55.000Z', fundAsOf: '2026-09-08', rankingsAt: '2026-09-09T14:30:00.000Z' });
    expect(out.candidates).toHaveLength(2);
  });

  it('no directive → no heard key; no candidates → no candidates key; evidence and vintages always ride a built prompt', () => {
    const inputs = makeStampInputs();
    const out = composeTickStamps(fullArgs(inputs, { controlResolution: controlResolutionFor(null), anticipationCandidates: undefined, rankingsComputedAtMs: null }));
    expect(Object.keys(out)).toEqual(['evidence', 'vintages']);
    expect(out.vintages.rankingsAt).toBeNull();
  });

  it('a suppressed directive rides as heard.suppressed — the client must not call that Heard', () => {
    const out = composeTickStamps(fullArgs(makeStampInputs(), {
      controlResolution: resolve(makeDirective(), { controlEpochLog: [{ suppressedDirectiveIds: [OLD_THREAD] }] }),
    }));
    expect(out.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'epoch_killed' });
  });

  it('never contains `undefined` anywhere (Firestore would reject the cron\'s whole finalUpdate) — full inputs and empty inputs', () => {
    expect(undefinedPaths(composeTickStamps(fullArgs(makeStampInputs())))).toEqual([]);
    const empty = composeTickStamps({ promptBuilt: true, controlResolution: undefined, anticipationCandidates: [{ symbol: 'X' }], assetScores: undefined, prices: undefined, momentumData: undefined, stockRegimes: undefined, riskStatus: undefined });
    expect(undefinedPaths(empty)).toEqual([]);
    expect(empty).toEqual({ evidence: {}, vintages: { quote: 'tick', vwap: 'tick', techAt: null, fundAsOf: null, rankingsAt: null }, candidates: [{ symbol: 'X', direction: null, signalSummary: null, threshold: null }] });
  });

  it('the serialized stamps never carry a cadence word ("weekly" / "daily"), a story id, rsPct, or the directive text', () => {
    const json = JSON.stringify(composeTickStamps(fullArgs(makeStampInputs())));
    expect(json).not.toMatch(/weekly|daily/i);
    expect(json).not.toMatch(/stories|storyId|rsPct/);
    expect(json).not.toContain('Require stronger confirmation');
  });
});

describe('the size rows (spec §1.3 / §3 — a size row per entry ≤ 1.1 KB; discovery §3 Firestore storage-size rule)', () => {
  const inputs = makeStampInputs();
  const perTick = composeTickStamps({ promptBuilt: true, controlResolution: controlResolutionFor(makeDirective()), ...inputs, rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS });
  const candidates = composeCandidatesStamp(makeAnticipationCandidates());
  const rows = [
    ['heard', perTick.heard],
    ['evidence (7 held, lean)', perTick.evidence],
    ['vintages', perTick.vintages],
    ['per-tick stamps (heard + evidence + vintages)', { heard: perTick.heard, evidence: perTick.evidence, vintages: perTick.vintages }],
    ['one candidate (four fields + tag)', candidates[0]],
    ['one candidate (four fields)', candidates[1]],
  ];

  it('the per-tick stamps for a seven-position book stay ≤ 1,100 Firestore-rule bytes (≤ 1.1 KB per entry); the table is printed for the record', () => {
    const table = rows.map(([label, value]) => `${label.padEnd(48)} ${String(firestoreBytes(value)).padStart(6)} B (firestore)  ${String(jsonBytes(value)).padStart(6)} B (json)`);
    console.log(`\n[tick stamps — size rows @ 7 held positions]\n${table.join('\n')}\n`);
    const bytes = firestoreBytes({ heard: perTick.heard, evidence: perTick.evidence, vintages: perTick.vintages });
    expect(bytes).toBeLessThanOrEqual(1100);
    // and the lean evidence itself is under the discovery's ~0.9 KB line
    expect(firestoreBytes(perTick.evidence)).toBeLessThanOrEqual(950);
  });

  it('the worst-case shape (a UUID-length thread, every regime the longest word, every risk non-HOLD with a reason) stays ≤ 1,300 bytes — the ceiling a field addition must not silently cross', () => {
    const worst = makeStampInputs({
      regimeOverride: 'directional_contraction',
      riskOverrides: Object.fromEntries(HELD.map((s) => [s, { action: 'SWAP_OUT', reason: 'vwap_failure', detail: '' }])),
    });
    const stamps = composeTickStamps({
      promptBuilt: true,
      controlResolution: controlResolutionFor(makeDirective({ directiveThreadId: 'thread_3f9c2a1e-7b4d-4c8e-9a1f-2d6b8c0e4f5a' })),
      ...worst,
      rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS,
    });
    const bytes = firestoreBytes({ heard: stamps.heard, evidence: stamps.evidence, vintages: stamps.vintages });
    console.log(`[tick stamps — worst-case per-tick stamps @ 7 held positions] ${bytes} B (firestore)`);
    expect(bytes).toBeLessThanOrEqual(1300);
  });

  it('the Heard stamp is tens of bytes (the free stamp), one candidate stays under 300 bytes', () => {
    expect(firestoreBytes(perTick.heard)).toBeLessThanOrEqual(80);
    expect(firestoreBytes(candidates[0])).toBeLessThanOrEqual(300);
    expect(firestoreBytes(candidates[1])).toBeLessThanOrEqual(300);
  });

  it('the size rule is the discovery\'s (string = utf8 + 1, number 8, bool/null 1, map = Σ key + 1 + value)', () => {
    expect(firestoreBytes('tick')).toBe(5);
    expect(firestoreBytes(1.5)).toBe(8);
    expect(firestoreBytes(null)).toBe(1);
    expect(firestoreBytes(true)).toBe(1);
    expect(firestoreBytes({ a: 'b' })).toBe(1 + 1 + 2);
    expect(firestoreBytes([1, 'x'])).toBe(8 + 2);
  });
});
