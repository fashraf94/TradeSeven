// OFFLINE audit. Import the real selector/scorer; no copied scoring formula.
import { buildArchetypeCandidateMenu } from '../../../api/_utils/archetypeCandidateMenu.js';
import { computeArchetypeRankings } from '../../../api/_utils/archetypeScoring.js';
import { listArchetypeIds, getArchetypeDefinition } from '../../../api/_utils/archetypeRegistry.js';
import { flattenPortfolioServer, flattenBenchServer } from '../../../api/_utils/agentScoring.js';
import { unionEquippedIntoHotBench } from '../../../api/_utils/watchlistEquip.js';
import { digest, timeMs, verifySnapshot } from './capture.mjs';

export const EMPTY_CONTROL = Object.freeze({ heldSymbols: [], benchSymbols: [], equippedTickers: [], hotBench: [] });
const unique = values => [...new Set(values)];
const symbols = assets => assets.map(a => a.symbol).filter(Boolean);
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const share = (n, total) => total ? n / total : null;
const etDay = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timeMs(value));

export function validateControl(control) {
  for (const key of Object.keys(EMPTY_CONTROL)) {
    if (!Array.isArray(control[key]) || control[key].some(s => typeof s !== 'string' || !s)) throw new Error('Control needs four arrays of nonempty symbol strings.');
  }
  return Object.fromEntries(Object.keys(EMPTY_CONTROL).map(k => [k, unique(control[k])]));
}

// Transcription of the DARK tiered branch at agent-evaluate.js:1510-1553.
// Keep tie order, || 0 semantics, and the real equipped helper (including duplicates).
export function legacyMenu(rankings, book) {
  const exclude = new Set([...book.heldSymbols, ...book.benchSymbols]);
  const candidates = rankings.filter(s => !exclude.has(s.symbol))
    .sort((a, b) => (b.baggerBombFit || 0) - (a.baggerBombFit || 0));
  let hotBench = candidates.slice(0, 15).map(s => s.symbol);
  if (book.equippedTickers.length) hotBench = unionEquippedIntoHotBench({
    hotBench, equippedTickers: book.equippedTickers, rankings, excludeSymbols: exclude, cap: 20,
  });
  const set = new Set(hotBench);
  return { hotBench, monitoring: candidates.filter(s => !set.has(s.symbol)).slice(0, 18).map(s => s.symbol) };
}

export function bookOf(battle) {
  return {
    heldSymbols: symbols(flattenPortfolioServer(battle.portfolio)),
    benchSymbols: symbols(flattenBenchServer(battle.portfolio?.bench)),
    equippedTickers: battle.agentContext?.equippedWatchlist?.tickers || [],
    hotBench: battle.watchlist?.hotBench || [],
    opponentSymbols: symbols(flattenPortfolioServer(battle.opponent?.portfolio)),
  };
}

export function overlap(a, b) {
  const left = new Set(a), right = new Set(b);
  const common = [...left].filter(s => right.has(s));
  return { common, count: common.length, union: new Set([...left, ...right]).size,
    jaccard: share(common.length, new Set([...left, ...right]).size), shareOfLeft: share(common.length, left.size) };
}

function menuMetrics(menu, rankings, archetype, book) {
  const map = new Map(rankings.map(s => [s.symbol, s]));
  const names = unique(menu.hotBench);
  const covered = names.map(s => map.get(s)).filter(Boolean);
  const weights = getArchetypeDefinition(archetype)?.scoring.weights || {};
  const inputs = Object.entries(weights).filter(([, weight]) => weight > 0)
    .map(([key]) => key === 'inverseComposite' ? 'compositeScore' : key).filter(k => k !== 'sectorDiversity');
  const missingInputs = covered.filter(s => inputs.some(k => s[k] == null)).map(s => s.symbol);
  const sectors = {};
  for (const name of names) {
    const sector = map.get(name)?.sectorName || 'Unknown';
    sectors[sector] = (sectors[sector] || 0) + 1;
  }
  const failures = covered.filter(s => archetype === 'analyst' ? s.fundamentalScore == null || s.fundamentalScore < 40
    : archetype === 'guardian' ? s.atrPercentile != null && s.atrPercentile > 0.75
      : archetype === 'degen' ? s.atrPercentile != null && s.atrPercentile < 0.5 : false).map(s => s.symbol);
  const identityUnknown = names.filter(name => !map.has(name)
    || (['guardian', 'degen'].includes(archetype) && map.get(name).atrPercentile == null));
  const initialRequests = new Set([...book.heldSymbols, ...book.benchSymbols, ...book.hotBench,
    ...(book.opponentSymbols || []), 'SPY', 'QQQ', 'BTC-USD.CC']);
  return {
    uniqueNames: names.length, coveredNames: covered.length, duplicateSlots: menu.hotBench.length - names.length,
    offUniverse: names.filter(s => !map.has(s)),
    fitMean: mean(covered.map(s => s.baggerBombFit).filter(Number.isFinite)),
    fitMissing: names.filter(s => map.get(s)?.baggerBombFit == null),
    sectors, distinctKnownSectors: Object.keys(sectors).filter(s => s !== 'Unknown').length,
    topSectorShare: share(Math.max(0, ...Object.values(sectors)), names.length),
    technologyShare: share(sectors.Technology || 0, names.length),
    missingInputScoredAs50: { names: missingInputs, shareOfCovered: share(missingInputs.length, covered.length), inputs },
    identity: {
      status: ['analyst', 'guardian', 'degen'].includes(archetype) ? 'partial_numeric_diagnostic'
        : archetype === 'contrarian' ? 'quality_requires_manual_review' : 'manual_review',
      failures, shareOfCovered: ['analyst', 'guardian', 'degen'].includes(archetype) ? share(failures.length, covered.length) : null,
      unknown: identityUnknown,
    },
    // A lower bound if the cron's first quote batch succeeded; not observed API calls.
    additionalQuoteSymbolsAssumingSuccess: names.filter(s => !initialRequests.has(s)),
    evidence: names.map(symbol => {
      const s = map.get(symbol);
      return { symbol, sector: s?.sectorName ?? null, fundamentalScore: s?.fundamentalScore ?? null,
        technicalScore: s?.technicalScore ?? null, baggerBombFit: s?.baggerBombFit ?? null,
        atrPercentile: s?.atrPercentile ?? null, compositeScore: s?.compositeScore ?? null };
    }),
  };
}

function compare(rankings, archetype, book, gameMode) {
  const legacy = legacyMenu(rankings, book);
  const events = [];
  const selected = buildArchetypeCandidateMenu({ rankings, archetype, gameMode,
    equippedTickers: book.equippedTickers, excludeSymbols: new Set([...book.heldSymbols, ...book.benchSymbols]),
    onEvent: event => events.push(event),
  });
  if (!selected && listArchetypeIds().includes(archetype)) throw new Error('Known archetype selector stayed dark or received an unsupported mode.');
  const proposed = selected || legacy;
  const legacyMetrics = menuMetrics(legacy, rankings, archetype, book);
  const proposedMetrics = menuMetrics(proposed, rankings, archetype, book);
  return { archetype, displayName: getArchetypeDefinition(archetype)?.displayName || 'Unknown archetype',
    book, legacy, proposed, events, fallback: !selected,
    overlap: overlap(proposed.hotBench, legacy.hotBench), legacyMetrics, proposedMetrics,
    meanFitGivenUp: legacyMetrics.fitMean != null && proposedMetrics.fitMean != null ? legacyMetrics.fitMean - proposedMetrics.fitMean : null };
}

function churn(current, previous) {
  if (!previous) return null;
  return { added: unique(current).filter(s => !previous.includes(s)), removed: unique(previous).filter(s => !current.includes(s)) };
}

function distribution(values) {
  const numbers = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = numbers.length;
  return { n, min: n ? numbers[0] : null, median: n ? (numbers[Math.floor((n - 1) / 2)] + numbers[Math.floor(n / 2)]) / 2 : null,
    max: n ? numbers[n - 1] : null };
}

export function analyze(envelopes, controlInput = EMPTY_CONTROL, code = {}) {
  if (!envelopes.length) throw new Error('No snapshots found; capture a live rebuild first.');
  envelopes.forEach(verifySnapshot);
  if (new Set(envelopes.map(e => e.payload.projectId)).size !== 1) throw new Error('Do not combine different Firebase projects.');
  const control = validateControl(controlInput);
  const seen = new Set();
  const snapshots = envelopes.map(e => e.payload).sort((a, b) => timeMs(a.rankings.data.computedAt) - timeMs(b.rankings.data.computedAt))
    .filter(p => {
      const key = digest([p.rankings.updateTime, p.rankings.data]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  const previous = new Map(), days = {}, instants = [];
  for (const p of snapshots) {
    const rankings = p.rankings.data.stocks;
    const computedAt = p.rankings.data.computedAt;
    const day = etDay(computedAt);
    const coverage = days[day] ||= { premarket: 0, intraday: 0, other: 0, regimes: [], spyDirections: [], captureLagSeconds: [], stale: 0 };
    const mode = p.rankings.data.mode;
    coverage[['premarket', 'intraday'].includes(mode) ? mode : 'other']++;
    coverage.regimes = unique([...coverage.regimes, p.marketContext.data.regime ?? 'unknown']);
    const spy = p.marketContext.data.spy?.changePercent;
    if (Number.isFinite(spy)) coverage.spyDirections = unique([...coverage.spyDirections, spy > 0 ? 'up' : spy < 0 ? 'down' : 'flat']);
    const lag = (timeMs(p.startedAt) - timeMs(computedAt)) / 1000;
    coverage.captureLagSeconds.push(lag);
    const stale = etDay(p.startedAt) !== day || (Number.isFinite(timeMs(p.rankings.data.expiresAt)) && timeMs(p.rankings.data.expiresAt) < timeMs(p.startedAt));
    if (stale) coverage.stale++;
    const controls = listArchetypeIds().map(a => ({ scope: 'control', ...compare(rankings, a, control, 'baggerbomb_agent') }));
    const battles = [], skippedBattles = [];
    for (const b of p.battles) {
      const battleKey = digest([p.projectId, b.id]).slice(0, 16);
      const data = b.data;
      const reason = data.status !== 'active' ? 'inactive'
        : data.gameMode != null && data.gameMode !== 'baggerbomb_agent' ? 'other_mode'
          : !data.watchlist ? 'no_watchlist'
            : Number.isFinite(timeMs(data.expiresAt)) && timeMs(data.expiresAt) < timeMs(p.startedAt) ? 'expired' : null;
      if (reason) { skippedBattles.push({ battleKey, reason }); continue; }
      battles.push({ scope: battleKey, ...compare(rankings, data.agentContext?.archetype, bookOf(data), data.gameMode),
        recordedLastHotBenchComputedAt: data.cronState?.lastHotBenchComputedAt ?? null });
    }
    const currentKeys = new Set();
    for (const row of [...controls, ...battles]) {
      const key = `${row.scope}:${row.archetype}`;
      currentKeys.add(key);
      const last = previous.get(key);
      row.churnSincePreviousObservation = {
        gapSeconds: last ? (timeMs(computedAt) - last.at) / 1000 : null,
        legacy: churn(row.legacy.hotBench, last?.legacy), proposed: churn(row.proposed.hotBench, last?.proposed),
        bookChanged: last ? digest(last.book) !== digest(row.book) : null,
      };
      previous.set(key, { at: timeMs(computedAt), legacy: row.legacy.hotBench, proposed: row.proposed.hotBench, book: row.book });
    }
    for (const key of previous.keys()) if (!currentKeys.has(key)) previous.delete(key);
    const pairwise = controls.flatMap((a, i) => controls.slice(i + 1).map(b => ({
      a: a.archetype, b: b.archetype, legacy: overlap(a.legacy.hotBench, b.legacy.hotBench), proposed: overlap(a.proposed.hotBench, b.proposed.hotBench),
    })));
    const scoreConsistency = listArchetypeIds().map(archetype => {
      const recomputed = computeArchetypeRankings(rankings, archetype, { gameMode: 'standard' });
      return { archetype, checked: recomputed.length,
        missing: recomputed.filter(s => s.arch_scores?.[archetype] == null).map(s => s.symbol),
        mismatches: recomputed.filter(s => s.arch_scores?.[archetype] != null && s.arch_scores[archetype] !== s.archetypeScore)
          .map(s => ({ symbol: s.symbol, stored: s.arch_scores[archetype], recomputed: s.archetypeScore })) };
    });
    instants.push({ computedAt, day, mode, capturedAt: p.startedAt, captureLagSeconds: lag, stale,
      observationDurationSeconds: (timeMs(p.endedAt) - timeMs(p.startedAt)) / 1000,
      regime: p.marketContext.data.regime ?? null, marketContextUpdatedAt: p.marketContext.updateTime,
      feedUpdateTimesMatch: digest(p.rankings.updateTime) === digest(p.marketContext.updateTime),
      producerDeploySha: p.rankings.data.deploySha ?? null, captureCode: p.code,
      controls, battles, skippedBattles, pairwise, scoreConsistency,
      battleUnion: Object.fromEntries(['legacy', 'proposed'].map(arm => [arm, unique(battles.flatMap(b => b[arm].hotBench))])),
    });
  }
  const controlSummary = listArchetypeIds().map(archetype => {
    const rows = instants.flatMap(i => i.controls.filter(r => r.archetype === archetype));
    return { archetype, displayName: rows[0].displayName, observations: rows.length,
      legacyOverlap: distribution(rows.map(r => r.overlap.count)), fitGivenUp: distribution(rows.map(r => r.meanFitGivenUp)),
      ...Object.fromEntries(['legacy', 'proposed'].map(arm => [arm, {
        namesOut: distribution(rows.map(r => r.churnSincePreviousObservation[arm]?.removed.length)),
        topSectorShare: distribution(rows.map(r => r[`${arm}Metrics`].topSectorShare)),
        missingInputShare: distribution(rows.map(r => r[`${arm}Metrics`].missingInputScoredAs50.shareOfCovered)),
        identityFailureShare: distribution(rows.map(r => r[`${arm}Metrics`].identity.shareOfCovered)),
        additionalQuoteSymbolsAssumingSuccess: distribution(rows.map(r => r[`${arm}Metrics`].additionalQuoteSymbolsAssumingSuccess.length)),
      }])) };
  });
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), projectId: snapshots[0].projectId,
    analysisCode: code, sourceSnapshotHashes: envelopes.map(e => e.sha256), control, controlHash: digest(control),
    activationVerdict: 'NOT_ASSESSED: founder reviews live menus, coverage, identity and paired distributions before a separate flag PR.',
    coverage: { uniqueRebuilds: snapshots.length, duplicateInputsIgnored: envelopes.length - snapshots.length, days,
      daysWithPremarketAndSevenIntraday: Object.values(days).filter(d => d.premarket >= 1 && d.intraday >= 7 && d.stale === 0).length,
      note: 'Observed counts are not proof of complete capture. Inspect missing slots, late captures, feed pairing, market days and regime coverage. Regime is an MA trend, not daily SPY direction.' },
    controlSummary, instants };
}

export function renderReport(report) {
  const lines = ['# BaggerBomb menu dry run', '', report.activationVerdict, '',
    `Project: ${report.projectId}. Rebuilds: ${report.coverage.uniqueRebuilds}. Control hash: ${report.controlHash}.`, '',
    'Read-only selection comparison. No model, quote-provider, trading or Firestore write calls. The flag override exists only in the isolated replay process; V2 remains dark.', '',
    '| ET day | Premarket | Intraday | Stale | Stored regimes | Observed SPY signs |', '|---|---:|---:|---:|---|---|'];
  for (const [day, d] of Object.entries(report.coverage.days)) lines.push(`| ${day} | ${d.premarket} | ${d.intraday} | ${d.stale} | ${d.regimes.join(', ')} | ${d.spyDirections.join(', ')} |`);
  lines.push('', report.coverage.note, '', 'Identity diagnostics are partial: analyst <40/missing fundamentals; guardian ATR >0.75; speculator ATR <0.5. Contrarian quality has no agreed numerical cutoff. Review its raw fundamentals and composite alongside the thesis. No new cutoff or activation bar is invented.', '',
    'Fit means exclude missing values. Missing counts and off-universe names are explicit in JSON. Quote counts assume the initial held/bench/old-menu/opponent/macro requests succeeded; failures add retries. Both arms use the same observed old menu, so these are one-refresh estimates, not a simulation of long-run traffic after activation. Churn spans observed snapshots and is not proof every intermediate rebuild was captured. Battle books are hypothetical refreshes at capture time, not reconstructed historical cron executions.', '');
  lines.push('## Paired control-book observations', '', 'Medians below include gaps and overnight transitions; these are descriptive observations, not activation thresholds. Full min/median/max distributions are in JSON.', '',
    '| Archetype | Observations | Shared with legacy | Mean fit given up | Legacy names out | Proposed names out |', '|---|---:|---:|---:|---:|---:|');
  for (const row of report.controlSummary) lines.push(`| ${row.displayName} | ${row.observations} | ${row.legacyOverlap.median ?? 'n/a'} | ${row.fitGivenUp.median?.toFixed(1) ?? 'n/a'} | ${row.legacy.namesOut.median ?? 'n/a'} | ${row.proposed.namesOut.median ?? 'n/a'} |`);
  lines.push('', '## Latest six menus', '', 'Every earlier menu remains in JSON. The table below is the latest observed rebuild, including stale or mismatched-feed warnings when present.', '');
  for (const instant of report.instants.slice(-1)) {
    lines.push(`## ${new Date(timeMs(instant.computedAt)).toISOString()} · ${instant.regime ?? 'unknown'}`, '',
      `Capture lag: ${instant.captureLagSeconds.toFixed(1)} seconds. Stale: ${instant.stale}. Feed update times match: ${instant.feedUpdateTimesMatch}. Active comparison books: ${instant.battles.length}.`, '',
      '| Archetype | Legacy menu | Proposed menu | Shared names | Mean fit given up | Identity flags |', '|---|---|---|---:|---:|---|');
    for (const row of instant.controls) lines.push(`| ${row.displayName} | ${row.legacy.hotBench.join(', ')} | ${row.proposed.hotBench.join(', ')} | ${row.overlap.count} | ${row.meanFitGivenUp?.toFixed(1) ?? 'missing'} | ${row.proposedMetrics.identity.status}: ${row.proposedMetrics.identity.failures.join(', ') || 'none flagged'} |`);
    lines.push('', '| Archetype pair | Legacy shared | Proposed shared | Proposed Jaccard |', '|---|---:|---:|---:|');
    for (const pair of instant.pairwise) lines.push(`| ${pair.a} / ${pair.b} | ${pair.legacy.count} | ${pair.proposed.count} | ${pair.proposed.jaccard?.toFixed(3) ?? 'n/a'} |`);
    const missing = instant.scoreConsistency.reduce((n, c) => n + c.missing.length, 0);
    const mismatches = instant.scoreConsistency.reduce((n, c) => n + c.mismatches.length, 0);
    lines.push('', `Stored V1 parity: ${missing} missing scores; ${mismatches} mismatches. Battle union: ${instant.battleUnion.legacy.length} legacy / ${instant.battleUnion.proposed.length} proposed.`, '');
  }
  lines.push('Full per-name evidence, sector mix, missing-input rates, price-request estimates, battle comparisons and churn are in the adjacent JSON. This report does not evaluate model choice, technical entry timing, executed trades or cockpit congestion.');
  return `${lines.join('\n')}\n`;
}
