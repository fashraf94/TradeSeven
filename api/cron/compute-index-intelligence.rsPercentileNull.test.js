// api/cron/compute-index-intelligence.rsPercentileNull.test.js
//
// THE PERSISTED `?? 50` PLACEHOLDER, REMOVED (row C-1).
//
// Phase 0 §5 ("observable, but a median can be a fabrication") and its finding
// 2: the Sep 9 F-3 fix deleted the READER-side default in the voice-layer brief
// writer; the WRITER-side default at compute-index-intelligence.js:1006
// survived, so a symbol dropped from the RS sort (no rs20, or a non-finite
// change, :920-923) was persisted as `rsPercentile: 50` and rendered to the
// decider as `rsPercentile=50 (outperforming)` — a verdict on a number that
// does not exist. `voice-layer-cache.js:602` still carried the last
// reader-side copy.
//
// The per-symbol doc assembly lives inside the cron's `handler`, which needs
// EODHD + Firebase credentials and live network, so it cannot be exercised
// here (the intraday suite beside this one says the same). This file therefore
// pairs TWO kinds of row, and neither alone would be enough:
//
//   • SOURCE PINS over the cron text — the three expressions, and the absence
//     of the two `?? 50` forms they replaced (the tickStamps.pins.test.js /
//     flagPinGuard.test.js house pattern);
//   • BEHAVIOURAL rows through the REAL collaborators those expressions feed —
//     computeTechnicalScore, computeGameModeFits, the fenced bench renderer and
//     the exported buildScoutAlerts — so the claims "no score moves" and "the
//     line is omitted" are measured, not asserted.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeTechnicalScore } from '../_utils/indexIntelligence.js';
import { computeGameModeFits } from '../_utils/gameModeScoring.js';
// Fenced (BUILD_RULES §1): CALLED to prove the reader-side null-guard, never
// edited. Its import here is also the dependency-surface guard (§4) — this
// file explodes in the Node test env if a browser dep enters that graph.
import { buildBenchTechnicalBlock } from '../_utils/agentEvalPromptAssembly.js';
import { buildScoutAlerts } from './voice-layer-cache.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON = readFileSync(resolve(HERE, 'compute-index-intelligence.js'), 'utf8');
const CACHE = readFileSync(resolve(HERE, 'voice-layer-cache.js'), 'utf8');
// The source with every comment stripped (the deskHonesty.test.js idiom): the
// "no `?? 50` survives" row scans CODE — the D-120 docstring beside the site
// quotes the old expression on purpose, to say what it replaced.
const CACHE_CODE = CACHE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// ---------------------------------------------------------------------------
// The source pins
// ---------------------------------------------------------------------------

describe('C-1 source — the placeholder is gone from the writer and the last reader', () => {
  it('the READING is `?? null`, and the `?? 50` it replaced is nowhere in the file', () => {
    expect(CRON).toContain('const rsPercentile = rsPercentileMap[d.sym] ?? null;');
    expect(CRON).not.toContain('rsPercentileMap[d.sym] ?? 50');
  });

  it('the SCORING INPUT keeps the neutral midpoint, explicitly and separately', () => {
    // The split is the whole point: a null here would score an unmeasured
    // symbol 0/22 in computeTechnicalScore's arithmetic and silently demote it.
    expect(CRON).toContain('rsPercentile: rsPercentile ?? 50,');
  });

  it('the PUBLISHED factor is the reading — the override rides the scoreResult spread', () => {
    const push = CRON.indexOf('stockScores.push({');
    expect(push).toBeGreaterThan(0);
    const block = CRON.slice(push, CRON.indexOf('});', push));
    expect(block).toContain('...scoreResult,');
    expect(block).toContain('factors: { ...scoreResult.factors, rsPercentile },');
    // …and the override comes AFTER the spread, or it would be overwritten
    expect(block.indexOf('factors: { ...scoreResult.factors')).toBeGreaterThan(block.indexOf('...scoreResult,'));
  });

  it('the game-mode fit inputs take `?? null`, so a missing reading redistributes weight', () => {
    expect(CRON).toContain('rsVsSpy: techFactors.rsPercentile ?? null,');
    expect(CRON).toContain('sectorRS: techFactors.sectorRSPercentile ?? techFactors.rsPercentile ?? null,');
    expect(CRON).not.toContain('rsVsSpy: techFactors.rsPercentile ?? 50');
  });

  it('voice-layer-cache carries no `factors.rsPercentile ?? 50` anywhere', () => {
    expect(CACHE).toContain('const rsPercentile = factors.rsPercentile ?? null;');
    expect(CACHE_CODE).not.toMatch(/rsPercentile \?\? 50/);
  });
});

// ---------------------------------------------------------------------------
// The behaviour: what is published, and what does NOT move
// ---------------------------------------------------------------------------

/** The one-name bench the fenced renderer is handed. */
const bench = { stocks: [{ symbol: 'QCOM', sector: 'Technology' }], crypto: null };

/** 60 newest-first closes with a clean uptrend — enough history for every band. */
const closes = Array.from({ length: 60 }, (_, i) => 100 - i * 0.4);
const highs = closes.map((c) => c + 1);
const lows = closes.map((c) => c - 1);
const volumes = Array.from({ length: 60 }, () => 1_000_000);
const spyCloses = Array.from({ length: 60 }, (_, i) => 500 - i * 0.2);
const technicals = {
  rsi: 58,
  sma20: 98,
  sma50: 92,
  sma200: null,
  macd: { macd: 0.8, signal: 0.5, histogram: 0.3, prevHistogram: 0.1 },
};

/** The cron's own two expressions, run over the REAL scorer. */
function publishedFactors(rsPercentileMapValue) {
  // :1006 — the reading
  const rsPercentile = rsPercentileMapValue ?? null;
  const scoreResult = computeTechnicalScore({
    closes, highs, lows, volumes, spyCloses,
    // :1024 — the scoring input
    rsPercentile: rsPercentile ?? 50,
    rsTrend: 'flat',
    technicals,
    sectorRSPercentile: null,
  });
  // the push — the published factor
  return { ...scoreResult, factors: { ...scoreResult.factors, rsPercentile } };
}

/** The PRE-CHANGE composition, kept so the defect is reproduced, not just described. */
function publishedFactorsPreChange(rsPercentileMapValue) {
  const rsPercentile = rsPercentileMapValue ?? 50;           // the old :1006
  const scoreResult = computeTechnicalScore({
    closes, highs, lows, volumes, spyCloses,
    rsPercentile, rsTrend: 'flat', technicals, sectorRSPercentile: null,
  });
  return scoreResult;                                        // no factors override
}

describe('C-1 behaviour — a symbol dropped from the RS sort publishes null', () => {
  it('THE DEFECT, REPRODUCED: the pre-change composition published the fabricated median', () => {
    // 50 falls in the bench renderer's `< 70 → outperforming` band, which is
    // how an unmeasured symbol reached the decider as "50 (outperforming)".
    expect(publishedFactorsPreChange(undefined).factors.rsPercentile).toBe(50);
    expect(buildBenchTechnicalBlock(bench, {}, { QCOM: publishedFactorsPreChange(undefined) }))
      .toContain('rsPercentile=50 (outperforming)');
  });

  it('dropped (no rs20 / non-finite change) → factors.rsPercentile === null', () => {
    expect(publishedFactors(undefined).factors.rsPercentile).toBeNull();
  });

  it('a symbol WITH a reading is unchanged — the number it measured, published', () => {
    expect(publishedFactors(88).factors.rsPercentile).toBe(88);
    expect(publishedFactors(0).factors.rsPercentile).toBe(0); // 0 is a reading
  });

  it('NO SCORE MOVES: technicalScore, rsVsSpyScore and rank inputs are identical to the pre-change output', () => {
    // The pre-change cron computed the whole scoreResult from the placeholder
    // 50. That is exactly what the scoring input still is, so every number on
    // the doc except the published factor is byte-identical.
    const preChange = computeTechnicalScore({
      closes, highs, lows, volumes, spyCloses,
      rsPercentile: 50, rsTrend: 'flat', technicals, sectorRSPercentile: null,
    });
    const now = publishedFactors(undefined);
    expect(now.technicalScore).toBe(preChange.technicalScore);
    expect(now.rsVsSpyScore).toBe(preChange.rsVsSpyScore);
    expect(now.sectorRSScore).toBe(preChange.sectorRSScore);
    expect(now.factors.sectorRSPercentile).toBe(preChange.factors.sectorRSPercentile);
    // …and a null scoring input WOULD have moved them — the reason for the split
    const ifNullScored = computeTechnicalScore({
      closes, highs, lows, volumes, spyCloses,
      rsPercentile: null, rsTrend: 'flat', technicals, sectorRSPercentile: null,
    });
    expect(ifNullScored.rsVsSpyScore).toBe(0);
    expect(ifNullScored.technicalScore).toBeLessThan(preChange.technicalScore);
  });
});

describe('C-1 behaviour — the game-mode fit redistributes rather than counting a median', () => {
  const measured = {
    rsVsSpy: 88, sectorRS: 80, smaPosition: 60, macd: 50, weekHighProx: 70, volume: 55, rsi: 50,
  };

  it('a null rsVsSpy is SKIPPED, not counted as 50 — computeWeightedScore redistributes its weight', () => {
    const withNull = computeGameModeFits({
      pillarScores: {}, technicalFactorScores: { ...measured, rsVsSpy: null, sectorRS: null }, atrPercentile: 0.5,
    });
    const withPlaceholder = computeGameModeFits({
      pillarScores: {}, technicalFactorScores: { ...measured, rsVsSpy: 50, sectorRS: 50 }, atrPercentile: 0.5,
    });
    expect(withNull.baggerBombFit).not.toBe(withPlaceholder.baggerBombFit);
    expect(withNull.baggerBombFit).toBeGreaterThan(0);
    expect(Number.isFinite(withNull.baggerBombFit)).toBe(true);
  });

  it('a symbol WITH a reading is unchanged', () => {
    const a = computeGameModeFits({ pillarScores: {}, technicalFactorScores: measured, atrPercentile: 0.5 });
    const b = computeGameModeFits({ pillarScores: {}, technicalFactorScores: { ...measured }, atrPercentile: 0.5 });
    expect(a.baggerBombFit).toBe(b.baggerBombFit);
  });
});

// ---------------------------------------------------------------------------
// The readers: the decider's bench block, and the scout alerts
// ---------------------------------------------------------------------------

describe('C-1 readers — nothing is shown where nothing was measured', () => {
  it("the fenced bench block OMITS the rsPercentile clause for a null reading (its own `!= null` guard)", () => {
    const withNull = buildBenchTechnicalBlock(bench, {}, { QCOM: { factors: { rsi: 71, rsPercentile: null } } });
    expect(withNull).toContain('RSI=71');
    expect(withNull).not.toContain('rsPercentile');
    // …and the placeholder it replaced would have been rendered as a VERDICT
    const withPlaceholder = buildBenchTechnicalBlock(bench, {}, { QCOM: { factors: { rsi: 71, rsPercentile: 50 } } });
    expect(withPlaceholder).toContain('rsPercentile=50 (outperforming)');
  });

  it('a real reading still renders, with its band word', () => {
    const out = buildBenchTechnicalBlock(bench, {}, { QCOM: { factors: { rsi: 71, rsPercentile: 88 } } });
    expect(out).toContain('rsPercentile=88 (leading)');
  });

  it('buildScoutAlerts: an unmeasured symbol raises no rs_breakout and no fabricated median', () => {
    const watchlist = { active: ['QCOM'] };
    const rankingsMap = { QCOM: { technicalScore: 92, technicalRank: 3 } };
    const unmeasured = buildScoutAlerts(watchlist, rankingsMap, { QCOM: { factors: { rsPercentile: null }, volumeConfirmation: 0 } }, 'momentum_chaser', new Set());
    expect(unmeasured.filter((a) => a.type === 'rs_breakout')).toEqual([]);
    expect(JSON.stringify(unmeasured)).not.toContain('percentile 50');

    // a measured symbol over the bar still alerts, with its own number
    const measured = buildScoutAlerts(watchlist, rankingsMap, { QCOM: { factors: { rsPercentile: 91 }, volumeConfirmation: 0 } }, 'momentum_chaser', new Set());
    expect(measured.map((a) => a.type)).toContain('rs_breakout');
    expect(measured.find((a) => a.type === 'rs_breakout').headline).toContain('RS percentile 91');
  });

  it('the rs_breakout gate is UNCHANGED by the swap — 50 never cleared 85 either', () => {
    const watchlist = { active: ['QCOM'] };
    const rankingsMap = { QCOM: { technicalScore: 92, technicalRank: 3 } };
    const asPlaceholder = buildScoutAlerts(watchlist, rankingsMap, { QCOM: { factors: { rsPercentile: 50 }, volumeConfirmation: 0 } }, 'momentum_chaser', new Set());
    const asNull = buildScoutAlerts(watchlist, rankingsMap, { QCOM: { factors: { rsPercentile: null }, volumeConfirmation: 0 } }, 'momentum_chaser', new Set());
    expect(asPlaceholder.filter((a) => a.type === 'rs_breakout')).toEqual([]);
    expect(asNull.filter((a) => a.type === 'rs_breakout')).toEqual([]);
  });
});
