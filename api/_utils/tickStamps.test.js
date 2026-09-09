// api/_utils/tickStamps.test.js
//
// Phase B — the tick stamps: the PURE COMPOSER's contract (spec §1.2–1.4, §3;
// D-110 → D-112). Imports what it guards. The Heard rows drive the REAL
// resolveControls (the same pure function the fenced assembler and the cron
// call) so the three `suppressed` words are the resolver's own, never a copy.
// The size rows apply the Firestore storage-size rule from the discovery §3 to
// the seven-position fixture the end-to-end harness uses.

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
import {
  HELD,
  BENCH,
  OLD_THREAD,
  RANKINGS_COMPUTED_AT_MS,
  FUND_COMPUTED_AT_MS,
  FUND_COMPUTED_AT_OLDER_MS,
  makeDirective,
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

/** The seven-position inputs exactly as the cron holds them at the entry (mirrors the e2e harness). */
function makeStampInputs({ riskOverrides = {}, regimeOverride = null } = {}) {
  const prices = makePriceTable();
  const starting = { NVDA: 120.5, TSLA: 250.1, MSFT: 410, AMZN: 185, KO: 62.2, PG: 165.3, BTC: 67000 };
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
  return { assetScores, prices, momentumData, stockRegimes, riskStatus };
}

const controlResolutionFor = (directive) => resolve(directive);

describe('tick stamps — the module surface', () => {
  it('names the four entry keys, the nine evidence fields, the five vintage fields and the five candidate fields', () => {
    expect([...TICK_STAMP_KEYS]).toEqual(['heard', 'evidence', 'vintages', 'candidates']);
    expect([...EVIDENCE_FIELDS]).toEqual(['px', 'chg', 'atrX', 'vwapDev', 'bbPct', 'nr7', 'rsPct', 'regime', 'risk']);
    expect([...VINTAGE_FIELDS]).toEqual(['quote', 'vwap', 'tech', 'fundAsOf', 'rankingsAt']);
    expect([...CANDIDATE_FIELDS]).toEqual(['symbol', 'direction', 'signalSummary', 'threshold', 'signalSource']);
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

  it("suppressed 'malformed' — a directive object the resolver could not render; an id-less one names 'unknown'", () => {
    expect(deriveHeardStamp(resolve({ text: 42, directiveThreadId: OLD_THREAD })))
      .toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'malformed' });
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

describe('the evidence (D-111) — nine fields per HELD position, code-composed from the tick\'s objects', () => {
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

  it('each record carries exactly the nine fields, in order — no story ids, no epsRev30d / sectorRs (cut by ruling)', () => {
    const evidence = composeEvidenceStamp(makeStampInputs());
    for (const sym of HELD) {
      expect(Object.keys(evidence[sym])).toEqual([...EVIDENCE_FIELDS]);
    }
    expect(JSON.stringify(evidence)).not.toMatch(/stories|storyIds|epsRev|sectorRs|thresholdProximity|archScore/i);
  });

  it('the nine fields come from their named sources at the rendered precision (2dp for px / chg / atrX / vwapDev)', () => {
    const inputs = makeStampInputs();
    const { NVDA } = composeEvidenceStamp(inputs);
    expect(NVDA.px).toBe(123.4);                                  // prices.NVDA.current
    expect(NVDA.chg).toBe(1.98);                                  // prices.NVDA.changePercent
    expect(NVDA.atrX).toBe(Math.round(inputs.assetScores[0].multiplier * 100) / 100); // assetScores[].multiplier
    expect(NVDA.atrX).toBe(0.78);
    expect(NVDA.vwapDev).toBe(1.05);                              // momentumData.vwap.NVDA.vwapDeviation (1.0483 → 1.05)
    expect(NVDA.bbPct).toBe(15);                                  // momentumData.rankings.NVDA.bBandwidthPercentile
    expect(NVDA.nr7).toBe(true);                                  // momentumData.rankings.NVDA.nr7Flag
    expect(NVDA.rsPct).toBe(88);                                  // momentumData.techScoresMap.NVDA.factors.rsPercentile
    expect(NVDA.regime).toBe('directional_expansion');            // stockRegimes.NVDA (the real classifier)
    expect(NVDA.risk).toEqual({ action: 'LOCK', reason: 'threshold_proximity' }); // riskStatus.NVDA
    const { TSLA } = composeEvidenceStamp(inputs);
    expect(TSLA.regime).toBe('distressed');
    expect(TSLA.nr7).toBe(false);
    expect(TSLA.vwapDev).toBeNull();                              // no VWAP session for TSLA this tick
  });

  it('null honesty (C-20): an absent metric is null — never 0, never a default, never undefined', () => {
    const inputs = makeStampInputs();
    const { BTC } = composeEvidenceStamp(inputs);                 // no ranking row, no technical doc, no VWAP
    expect(BTC.bbPct).toBeNull();
    expect(BTC.nr7).toBeNull();
    expect(BTC.rsPct).toBeNull();
    expect(BTC.regime).toBeNull();
    expect(BTC.vwapDev).toBeNull();
    expect(BTC.px).toBe(67450);
    // Nothing known at all for a held symbol: nine nulls, still nine keys.
    const bare = composeEvidenceStamp({ assetScores: [{ symbol: 'ZZZ', multiplier: NaN }], prices: {}, momentumData: {}, stockRegimes: {}, riskStatus: {} });
    expect(bare.ZZZ).toEqual({ px: null, chg: null, atrX: null, vwapDev: null, bbPct: null, nr7: null, rsPct: null, regime: null, risk: null });
    expect(undefinedPaths(bare)).toEqual([]);
  });

  it('`risk` carries `reason` ONLY when non-HOLD; a non-HOLD verdict without a reason falls back to its detail', () => {
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
    inputs.assetScores = [...inputs.assetScores, { symbol: 'NVDA', multiplier: 9 }, { symbol: null }, { symbol: 7 }];
    const evidence = composeEvidenceStamp(inputs);
    expect(Object.keys(evidence)).toEqual([...HELD]);
    expect(evidence.NVDA.atrX).toBe(0.78);
  });
});

describe('the vintages — one block per entry; dates, never a cadence word for the fundamentals', () => {
  it('carries the five fields: the cadence words for quote / vwap / tech and two DATES', () => {
    const inputs = makeStampInputs();
    const v = composeVintages({ heldSymbols: HELD, rankingsMap: inputs.momentumData.rankingsMap, rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS });
    expect(Object.keys(v)).toEqual([...VINTAGE_FIELDS]);
    expect(v.quote).toBe('tick');
    expect(v.vwap).toBe('tick');
    expect(v.tech).toBe('daily');
    expect(v.fundAsOf).toBe('2026-09-04');                      // the newest held fundamentals computedAt, UTC date
    expect(v.rankingsAt).toBe('2026-09-09T14:30:00.000Z');      // the stockRankings doc's computedAt
  });

  it('never says "weekly" (or any cadence word) for the fundamentals — the date is the whole claim', () => {
    const inputs = makeStampInputs();
    const v = composeVintages({ heldSymbols: HELD, rankingsMap: inputs.momentumData.rankingsMap, rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS });
    expect(JSON.stringify(v)).not.toMatch(/weekly/i);
    expect(v).not.toHaveProperty('fund');
    expect(v.fundAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('fundAsOf is the NEWEST vintage across the HELD book only — an older held ticker does not drag it back, a newer bench ticker does not pull it forward', () => {
    const rankingsMap = {
      KO: { fundamentals: { computedAt: FUND_COMPUTED_AT_OLDER_MS } },
      PG: { fundamentals: { computedAt: FUND_COMPUTED_AT_MS } },
      AMD: { fundamentals: { computedAt: Date.UTC(2026, 8, 8) } }, // bench — newer, must not win
    };
    expect(composeVintages({ heldSymbols: ['KO', 'PG'], rankingsMap, rankingsComputedAtMs: null }).fundAsOf).toBe('2026-09-04');
    expect(composeVintages({ heldSymbols: ['KO'], rankingsMap, rankingsComputedAtMs: null }).fundAsOf).toBe('2026-09-01');
  });

  it('null honesty: no held fundamentals → fundAsOf null; no rankings computedAt → rankingsAt null; a Timestamp-like is accepted', () => {
    const none = composeVintages({ heldSymbols: ['BTC'], rankingsMap: { BTC: {} }, rankingsComputedAtMs: null });
    expect(none.fundAsOf).toBeNull();
    expect(none.rankingsAt).toBeNull();
    expect(composeVintages({ heldSymbols: [], rankingsMap: undefined, rankingsComputedAtMs: NaN }).rankingsAt).toBeNull();
    expect(composeVintages({ heldSymbols: [], rankingsMap: {}, rankingsComputedAtMs: { toMillis: () => RANKINGS_COMPUTED_AT_MS } }).rankingsAt).toBe('2026-09-09T14:30:00.000Z');
    expect(undefinedPaths(none)).toEqual([]);
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
  it('haikuAttempted false (a budget_skipped tick never built the prompt) → {} — nothing heard, nothing seen, even with a directive and candidates in hand', () => {
    const inputs = makeStampInputs();
    const out = composeTickStamps({
      haikuAttempted: false,
      controlResolution: controlResolutionFor(makeDirective()),
      anticipationCandidates: makeAnticipationCandidates(),
      ...inputs,
      rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS,
    });
    expect(out).toEqual({});
    expect(composeTickStamps({ haikuAttempted: undefined, controlResolution: controlResolutionFor(makeDirective()), ...inputs })).toEqual({});
  });

  it('haikuAttempted true → heard + evidence + vintages + candidates, in that order, keys ⊆ TICK_STAMP_KEYS', () => {
    const inputs = makeStampInputs();
    const out = composeTickStamps({
      haikuAttempted: true,
      controlResolution: controlResolutionFor(makeDirective()),
      anticipationCandidates: makeAnticipationCandidates(),
      ...inputs,
      rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS,
    });
    expect(Object.keys(out)).toEqual(['heard', 'evidence', 'vintages', 'candidates']);
    for (const k of Object.keys(out)) expect(TICK_STAMP_KEYS).toContain(k);
    expect(out.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: null });
    expect(Object.keys(out.evidence)).toEqual([...HELD]);
    expect(out.vintages.fundAsOf).toBe('2026-09-04');
    expect(out.candidates).toHaveLength(2);
  });

  it('no directive → no heard key; no candidates → no candidates key; evidence and vintages always ride an attempted tick', () => {
    const inputs = makeStampInputs();
    const out = composeTickStamps({ haikuAttempted: true, controlResolution: controlResolutionFor(null), anticipationCandidates: undefined, ...inputs, rankingsComputedAtMs: null });
    expect(Object.keys(out)).toEqual(['evidence', 'vintages']);
    expect(out.vintages.rankingsAt).toBeNull();
  });

  it('a suppressed directive rides as heard.suppressed — the client must not call that Heard', () => {
    const inputs = makeStampInputs();
    const out = composeTickStamps({
      haikuAttempted: true,
      controlResolution: resolve(makeDirective(), { controlEpochLog: [{ suppressedDirectiveIds: [OLD_THREAD] }] }),
      ...inputs,
    });
    expect(out.heard).toEqual({ directiveThreadId: OLD_THREAD, suppressed: 'epoch_killed' });
  });

  it('never contains `undefined` anywhere (Firestore would reject the cron\'s whole finalUpdate) — full inputs and empty inputs', () => {
    const inputs = makeStampInputs();
    const full = composeTickStamps({ haikuAttempted: true, controlResolution: controlResolutionFor(makeDirective()), anticipationCandidates: makeAnticipationCandidates(), ...inputs, rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS });
    expect(undefinedPaths(full)).toEqual([]);
    const empty = composeTickStamps({ haikuAttempted: true, controlResolution: undefined, anticipationCandidates: [{ symbol: 'X' }], assetScores: undefined, prices: undefined, momentumData: undefined, stockRegimes: undefined, riskStatus: undefined });
    expect(undefinedPaths(empty)).toEqual([]);
    expect(empty).toEqual({ evidence: {}, vintages: { quote: 'tick', vwap: 'tick', tech: 'daily', fundAsOf: null, rankingsAt: null }, candidates: [{ symbol: 'X', direction: null, signalSummary: null, threshold: null }] });
  });

  it('the serialized stamps never carry the word "weekly", a story id, or the directive text', () => {
    const inputs = makeStampInputs();
    const out = composeTickStamps({ haikuAttempted: true, controlResolution: controlResolutionFor(makeDirective()), anticipationCandidates: makeAnticipationCandidates(), ...inputs, rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS });
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/weekly/i);
    expect(json).not.toMatch(/stories|storyId/);
    expect(json).not.toContain('Require stronger confirmation');
  });
});

describe('the size rows (spec §1.3 / §3 — a size row per entry ≤ 1.1 KB; discovery §3 Firestore storage-size rule)', () => {
  const inputs = makeStampInputs();
  const perTick = composeTickStamps({ haikuAttempted: true, controlResolution: controlResolutionFor(makeDirective()), ...inputs, rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS });
  const candidates = composeCandidatesStamp(makeAnticipationCandidates());
  const rows = [
    ['heard', perTick.heard],
    ['evidence (7 held, lean)', perTick.evidence],
    ['vintages', perTick.vintages],
    ['per-tick stamps (heard + evidence + vintages)', { heard: perTick.heard, evidence: perTick.evidence, vintages: perTick.vintages }],
    ['one candidate (four fields + tag)', candidates[0]],
    ['one candidate (four fields)', candidates[1]],
  ];

  it('prints the size table (Firestore-rule bytes · JSON bytes) for the record', () => {
    const table = rows.map(([label, value]) => `${label.padEnd(48)} ${String(firestoreBytes(value)).padStart(6)} B (firestore)  ${String(jsonBytes(value)).padStart(6)} B (json)`);
    console.log(`\n[tick stamps — size rows @ 7 held positions]\n${table.join('\n')}\n`);
    expect(rows.length).toBe(6);
  });

  it('the per-tick stamps for a seven-position book stay ≤ 1,100 Firestore-rule bytes (≤ 1.1 KB per entry)', () => {
    const bytes = firestoreBytes({ heard: perTick.heard, evidence: perTick.evidence, vintages: perTick.vintages });
    expect(bytes).toBeLessThanOrEqual(1100);
    // and the lean evidence itself is under the discovery's ~0.9 KB line
    expect(firestoreBytes(perTick.evidence)).toBeLessThanOrEqual(950);
  });

  it('the Heard stamp is tens of bytes (the free stamp), one candidate stays under 300 bytes', () => {
    expect(firestoreBytes(perTick.heard)).toBeLessThanOrEqual(80);
    expect(firestoreBytes(candidates[0])).toBeLessThanOrEqual(300);
    expect(firestoreBytes(candidates[1])).toBeLessThanOrEqual(300);
  });

  it('the worst-case shape (a UUID-length thread, every regime the longest word, every risk non-HOLD with a reason) stays ≤ 1,300 bytes — the ceiling a field addition must not silently cross', () => {
    const worst = makeStampInputs({
      regimeOverride: 'directional_contraction',
      riskOverrides: Object.fromEntries(HELD.map((s) => [s, { action: 'SWAP_OUT', reason: 'vwap_failure', detail: '' }])),
    });
    const stamps = composeTickStamps({
      haikuAttempted: true,
      controlResolution: controlResolutionFor(makeDirective({ directiveThreadId: 'thread_3f9c2a1e-7b4d-4c8e-9a1f-2d6b8c0e4f5a' })),
      ...worst,
      rankingsComputedAtMs: RANKINGS_COMPUTED_AT_MS,
    });
    const bytes = firestoreBytes({ heard: stamps.heard, evidence: stamps.evidence, vintages: stamps.vintages });
    console.log(`[tick stamps — worst-case per-tick stamps @ 7 held positions] ${bytes} B (firestore)`);
    expect(bytes).toBeLessThanOrEqual(1300);
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
