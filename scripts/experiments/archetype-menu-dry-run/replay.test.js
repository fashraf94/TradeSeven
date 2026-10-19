// Real imports below are the Node dependency-surface guard; never mock them.
// The ONLY mock is a partial flag view confined to this test worker.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildArchetypeCandidateMenu } from '../../../api/_utils/archetypeCandidateMenu.js';
import { computeArchetypeRankings } from '../../../api/_utils/archetypeScoring.js';
import { listArchetypeIds } from '../../../api/_utils/archetypeRegistry.js';
import { makeCandidateUniverse } from '../../../api/_utils/__fixtures__/archetypeCandidateMenu.js';
import { analyze, bookOf, EMPTY_CONTROL, legacyMenu, overlap, renderReport } from './comparison.mjs';
import { assertDarkSource, digest } from './capture.mjs';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()), ARCHETYPE_REFRESH_MENU_ENABLED: true,
}));

function fixture({ at = '2026-10-19T14:05:00Z', stocks = makeCandidateUniverse(), battles = [] } = {}) {
  const data = structuredClone(stocks);
  for (const archetype of listArchetypeIds()) {
    for (const s of computeArchetypeRankings(data, archetype, { gameMode: 'standard' })) {
      (data.find(row => row.symbol === s.symbol).arch_scores ||= {})[archetype] = s.archetypeScore;
    }
  }
  const payload = { schemaVersion: 1, projectId: 'synthetic-test-only', startedAt: at, endedAt: at,
    rankings: { updateTime: at, data: { computedAt: at, mode: 'intraday', stocks: data } },
    marketContext: { updateTime: at, data: { regime: 'bull', spy: { changePercent: 0.5 } } }, battles, code: { head: 'synthetic' } };
  return { payload, sha256: digest(payload) };
}

const seal = envelope => ({ payload: envelope.payload, sha256: digest(envelope.payload) });
const activeBattle = (id, archetype, overrides = {}) => ({ id, data: { status: 'active',
  agentContext: { archetype, equippedWatchlist: { tickers: ['OUTSIDE'] } },
  portfolio: { star: [{ symbol: 'S001' }], core: [], support: [], bench: { stocks: [{ symbol: 'S002' }], crypto: { symbol: 'BTC-USD.CC' } } },
  watchlist: { hotBench: ['S003'] }, ...overrides } });

describe('Stage A offline comparison', () => {
  it('keeps real flags dark and overrides only menu selection inside this worker', async () => {
    const actualFlags = await vi.importActual('../../../src/config/featureFlags.js');
    const mocked = await import('../../../src/config/featureFlags.js');
    expect(actualFlags.ARCHETYPE_REFRESH_MENU_ENABLED).toBe(false);
    expect(actualFlags.ARCHETYPE_VECTORS_V2_ENABLED).toBe(false);
    expect({ ...mocked, ARCHETYPE_REFRESH_MENU_ENABLED: false }).toEqual({ ...actualFlags });
    assertDarkSource();
    expect(buildArchetypeCandidateMenu({ archetype: 'analyst', rankings: makeCandidateUniverse() })).not.toBeNull();
  });

  it('uses one identical fixed book for all six archetypes, with real selector outputs', () => {
    const sample = fixture();
    const before = JSON.stringify(sample);
    const control = { heldSymbols: ['S001'], benchSymbols: ['S002'], equippedTickers: ['OUTSIDE'], hotBench: ['S003'] };
    const report = analyze([sample], control);
    expect(report.instants[0].controls).toHaveLength(6);
    const legacy = new Set(report.instants[0].controls.map(c => JSON.stringify(c.legacy)));
    const proposed = new Set(report.instants[0].controls.map(c => JSON.stringify(c.proposed)));
    expect(legacy.size).toBe(1);
    expect(proposed.size).toBeGreaterThan(1);
    for (const row of report.instants[0].controls) {
      expect(row.book).toEqual(control);
      expect(row.proposed.hotBench).toContain('OUTSIDE');
      expect(row.proposed.hotBench).not.toContain('S001');
      expect(row.proposed.hotBench).not.toContain('S002');
      expect(row.proposed).toEqual(buildArchetypeCandidateMenu({ rankings: sample.payload.rankings.data.stocks,
        archetype: row.archetype, gameMode: 'baggerbomb_agent', excludeSymbols: new Set(['S001', 'S002']), equippedTickers: ['OUTSIDE'] }));
    }
    expect(report.instants[0].pairwise).toHaveLength(15);
    expect(JSON.stringify(sample)).toBe(before);
  });

  it('preserves legacy fit tie order and ||0 behavior with equipped overflow', () => {
    const stocks = Array.from({ length: 25 }, (_, i) => ({ symbol: `T${i}`, baggerBombFit: i < 20 ? 50 : null }));
    const book = { ...EMPTY_CONTROL, heldSymbols: ['T0'], benchSymbols: ['T1'], equippedTickers: ['T20', 'T21', 'T22', 'T23', 'T24', 'OUT'] };
    const menu = legacyMenu(stocks, book);
    expect(menu.hotBench).toEqual([...Array.from({ length: 14 }, (_, i) => `T${i + 2}`), ...book.equippedTickers]);
    expect(menu.monitoring).toEqual(['T16', 'T17', 'T18', 'T19']);
  });

  it('preserves the legacy duplicate-equipped quirk instead of laundering the baseline', () => {
    const menu = legacyMenu([{ symbol: 'A', baggerBombFit: 1 }], { ...EMPTY_CONTROL, equippedTickers: ['X', 'X'] });
    expect(menu.hotBench).toEqual(['A', 'X', 'X']);
    expect(overlap(['A', 'A', 'B'], ['B', 'C'])).toEqual({ common: ['B'], count: 1, union: 3, jaccard: 1 / 3, shareOfLeft: 1 / 2 });
  });

  it('compares actual books, excludes non-refreshable battles, and reports unknown fallback', () => {
    const sample = fixture({ battles: [activeBattle('real-one', 'analyst'), activeBattle('unknown', 'future-archetype'),
      activeBattle('no-watchlist', 'analyst', { watchlist: null }),
      activeBattle('flat6', 'analyst', { gameMode: 'baggerbomb_tournament' }),
      activeBattle('expired', 'analyst', { expiresAt: '2026-10-18T00:00:00Z' })] });
    const instant = analyze([sample]).instants[0];
    expect(instant.battles).toHaveLength(2);
    expect(instant.skippedBattles.map(b => b.reason)).toEqual(['no_watchlist', 'other_mode', 'expired']);
    expect(instant.battles[0].book.heldSymbols).toEqual(['S001']);
    expect(instant.battles[0].book.benchSymbols).toEqual(['S002', 'BTC-USD.CC']);
    expect(instant.battles[0].scope).not.toBe('real-one');
    expect(instant.battles[1].fallback).toBe(true);
    expect(instant.battles[1].events[0].reason).toBe('unknown_archetype');
    expect(instant.battleUnion.proposed).toEqual([...new Set(instant.battles.flatMap(b => b.proposed.hotBench))]);
  });

  it('reports weighted missing inputs, identity violations, off-universe uncertainty and sector counts', () => {
    const stocks = [
      { symbol: 'MISSING', sectorName: 'Technology', fundamentalScore: null, technicalScore: 50, baggerBombFit: 50, atrPercentile: null, compositeScore: 50 },
      { symbol: 'RISK', sectorName: 'Energy', fundamentalScore: 10, technicalScore: 50, baggerBombFit: 60, atrPercentile: 0.9, compositeScore: 50 },
      { symbol: 'LOW', sectorName: 'Technology', fundamentalScore: 80, technicalScore: 50, baggerBombFit: 70, atrPercentile: 0.2, compositeScore: 50 },
    ];
    const rows = analyze([fixture({ stocks })], { ...EMPTY_CONTROL, equippedTickers: ['OUT'] }).instants[0].controls;
    const analyst = rows.find(r => r.archetype === 'analyst').proposedMetrics;
    expect(analyst.identity.failures.sort()).toEqual(['MISSING', 'RISK']);
    expect(analyst.missingInputScoredAs50.names).toEqual(['MISSING']);
    expect(analyst.missingInputScoredAs50.shareOfCovered).toBe(1 / 3);
    expect(analyst.offUniverse).toEqual(['OUT']);
    expect(analyst.sectors).toEqual({ Technology: 2, Energy: 1, Unknown: 1 });
    expect(analyst.technologyShare).toBe(0.5);
    expect(rows.find(r => r.archetype === 'guardian').proposedMetrics.identity.failures).toEqual(['RISK']);
    expect(rows.find(r => r.archetype === 'degen').proposedMetrics.identity.failures).toEqual(['LOW']);
    expect(rows.find(r => r.archetype === 'contrarian').proposedMetrics.identity.status).toBe('quality_requires_manual_review');
  });

  it('accounts for opponent and macro requests without claiming observed provider calls', () => {
    const battle = activeBattle('prices', 'analyst', { opponent: { portfolio: { star: [{ symbol: 'S004' }] } } });
    expect(bookOf(battle.data).opponentSymbols).toEqual(['S004']);
    const stocks = ['S003', 'S004', 'SPY', 'QQQ', 'BTC-USD.CC', 'NEW'].map(symbol => ({ symbol, baggerBombFit: 60 }));
    const row = analyze([fixture({ stocks, battles: [battle] })]).instants[0].battles[0];
    expect(row.proposedMetrics.additionalQuoteSymbolsAssumingSuccess.sort()).toEqual(['NEW', 'OUTSIDE']);
  });

  it('checks stored V1 scores and distinguishes missing scores from mismatches', () => {
    const sample = fixture();
    sample.payload.rankings.data.stocks[0].arch_scores.analyst += 1;
    delete sample.payload.rankings.data.stocks[1].arch_scores.guardian;
    const consistency = analyze([seal(sample)]).instants[0].scoreConsistency;
    expect(consistency.find(c => c.archetype === 'analyst').mismatches.map(s => s.symbol)).toEqual(['S000']);
    expect(consistency.find(c => c.archetype === 'guardian').missing).toEqual(['S001']);
    expect(consistency.find(c => c.archetype === 'degen').mismatches).toEqual([]);
  });

  it('sorts observations, deduplicates rebuilds and measures churn only across present books', () => {
    const first = fixture({ battles: [activeBattle('book', 'analyst')] });
    const second = fixture({ at: '2026-10-19T15:05:00Z', stocks: makeCandidateUniverse().map(s => ({ ...s, fundamentalScore: 100 - s.fundamentalScore })) });
    const third = fixture({ at: '2026-10-19T16:05:00Z', battles: [activeBattle('book', 'analyst')] });
    const report = analyze([third, second, first, first]);
    expect(report.coverage.uniqueRebuilds).toBe(3);
    expect(report.coverage.duplicateInputsIgnored).toBe(1);
    const changed = report.instants[1].controls.find(r => r.archetype === 'analyst').churnSincePreviousObservation;
    expect(changed.gapSeconds).toBe(3600);
    expect(changed.proposed.added.length).toBeGreaterThan(0);
    expect(changed.legacy.added).toEqual([]);
    expect(changed.bookChanged).toBe(false);
    expect(report.instants[2].battles[0].churnSincePreviousObservation.proposed).toBeNull();
    const summary = report.controlSummary.find(r => r.archetype === 'analyst');
    expect(summary.legacy.namesOut).toEqual({ n: 2, min: 0, median: 0, max: 0 });
    expect(summary.proposed.namesOut.median).toBeGreaterThan(0);
  });

  it('keeps stale observations, mismatched feeds, raw regimes and daily SPY direction visible', () => {
    const sample = fixture();
    sample.payload.startedAt = '2026-10-20T14:05:00Z';
    sample.payload.endedAt = sample.payload.startedAt;
    sample.payload.marketContext.updateTime = '2026-10-19T13:00:00Z';
    sample.payload.marketContext.data.spy.changePercent = -0.5;
    const report = analyze([seal(sample)]);
    expect(report.instants[0].stale).toBe(true);
    expect(report.instants[0].feedUpdateTimesMatch).toBe(false);
    expect(report.coverage.days['2026-10-19'].regimes).toEqual(['bull']);
    expect(report.coverage.days['2026-10-19'].spyDirections).toEqual(['down']);
    expect(report.coverage.daysWithPremarketAndSevenIntraday).toBe(0);
    expect(renderReport(report)).toContain('NOT_ASSESSED');
  });

  it('rejects corrupt snapshots, mixed projects, absent data and invalid controls', () => {
    const sample = fixture(), other = fixture();
    sample.payload.rankings.data.stocks[0].baggerBombFit += 1;
    expect(() => analyze([sample])).toThrow('checksum');
    other.payload.projectId = 'different-project';
    expect(() => analyze([fixture(), seal(other)])).toThrow('different Firebase');
    expect(() => analyze([])).toThrow('No snapshots');
    expect(() => analyze([fixture()], { heldSymbols: [] })).toThrow('four arrays');
  });
});

// CLI bridge: selected explicitly by run.mjs, never a network-connected test.
if (process.env.MENU_DRY_RUN_JOB) {
  it('writes the requested real-data comparison after validation', () => {
    assertDarkSource();
    const job = JSON.parse(readFileSync(process.env.MENU_DRY_RUN_JOB, 'utf8'));
    const report = analyze(job.files.map(file => JSON.parse(readFileSync(file, 'utf8'))),
      job.controlFile ? JSON.parse(readFileSync(job.controlFile, 'utf8')) : EMPTY_CONTROL, job.code);
    writeFileSync(`${job.reportBase}.json`, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    writeFileSync(`${job.reportBase}.md`, renderReport(report), { flag: 'wx', mode: 0o600 });
  });
}
