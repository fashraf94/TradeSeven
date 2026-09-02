// api/cron/compute-index-intelligence.axes.test.js
//
// Archetype Rank Interface V2 — Phase A producer contract. Style-A per the
// in-file convention (compute-index-intelligence.fundamentalsMirror.test.js):
// the cron handler is not exported, so the wiring is locked by source-text
// assertions against the real cron source, while the math itself is proven in
// axisDerivation.test.js.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of
// compute-index-intelligence.js is the runtime guard for the cron's new edges
// (axisDerivation.js, rankingSnapshots.js, tournamentTime.js) — it explodes in
// the Node test env if a browser dep ever enters that graph. NEVER mock it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STOCK_RANKINGS_DOC_WARN_BYTES } from './compute-index-intelligence.js';
import { AXES_FORMULA_VERSION } from '../_utils/axisDerivation.js';

const SOURCE = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'compute-index-intelligence.js'), 'utf8');
const at = (needle) => {
  const i = SOURCE.indexOf(needle);
  if (i < 0) throw new Error(`cron source lost: ${needle}`);
  return i;
};

// Reproduces the stockEntry techRaw mirror VERBATIM (the attachArchScores /
// computeSma200Position precedent): null readings stay null — never a default.
// rsi comes from the raw RSI-14 map, NOT factors.rsi (which imputes 50).
function mirrorTechRaw(tech, rawRsi) {
  return {
    rsi: rawRsi ?? null,
    bbPercentB: tech.bbPercentB ?? null,
    distTo52wkHigh: tech.factors?.distTo52wkHigh ?? null,
    atrPercent: tech.atrPercent ?? null,
  };
}

describe('compute-index-intelligence — Phase A axis block wiring', () => {
  it('still exports the unchanged doc-size guard (the §5 size gate)', () => {
    expect(STOCK_RANKINGS_DOC_WARN_BYTES).toBe(Math.floor(1048576 * 0.6));
    expect(AXES_FORMULA_VERSION).toBe(1);
  });

  it('imports the pure helpers rather than re-deriving anything locally (BUILD_RULES §4)', () => {
    expect(SOURCE).toMatch(/import \{ deriveAxes, computeUniverseMedianReturn1W, countAxisNulls, AXES_FORMULA_VERSION \} from '\.\.\/_utils\/axisDerivation\.js';/);
    expect(SOURCE).toMatch(/from '\.\.\/_utils\/rankingSnapshots\.js';/);
    expect(SOURCE).toMatch(/import \{ formatEtDate \} from '\.\.\/_utils\/tournamentTime\.js';/);
  });

  it('derives axes on the PERSISTED-SHAPE entries: after the compositeScore sort, before the arch_scores loop (P-10)', () => {
    const sortIdx = at('return b.compositeScore - a.compositeScore;');
    const axesIdx = at('const axesList = deriveAxes(rankingStocks);');
    const attachIdx = at('rankingStocks.forEach((stock, i) => { stock.axes = axesList[i]; });');
    const medianIdx = at('const universeMedianReturn1W = computeUniverseMedianReturn1W(rankingStocks);');
    const archIdx = at('const ranked = computeArchetypeRankings(rankingStocks, archetype');
    expect(sortIdx).toBeLessThan(axesIdx);
    expect(axesIdx).toBeLessThan(attachIdx);
    expect(attachIdx).toBeLessThan(medianIdx);
    expect(medianIdx).toBeLessThan(archIdx);
  });

  it('writes the four doc-level fields into rankingsPayload', () => {
    const payloadIdx = at('const rankingsPayload = {');
    const commitIdx = at('await batch.commit();');
    for (const field of [
      'axes_formula_version: AXES_FORMULA_VERSION,',
      'axes_universe_size: rankingStocks.length,',
      'universe_median_return1W: universeMedianReturn1W,',
      'arch_scores_version: 1,',
    ]) {
      const i = at(field);
      expect(i).toBeGreaterThan(payloadIdx);
      expect(i).toBeLessThan(commitIdx);
    }
  });

  it('mirrors techRaw { rsi, bbPercentB, distTo52wkHigh, atrPercent } with null-not-default semantics — rsi from the RAW reading, never factors.rsi', () => {
    expect(SOURCE).toMatch(/techRaw: \{\s*rsi: rawRsiMap\.get\(tech\.symbol\) \?\? null,\s*bbPercentB: tech\.bbPercentB \?\? null,\s*distTo52wkHigh: tech\.factors\?\.distTo52wkHigh \?\? null,\s*atrPercent: tech\.atrPercent \?\? null,\s*\}/);
    // The raw map is filled from calculateRSI's own value (null under 15 bars) —
    // computeTechnicalScore's factors.rsi imputes 50 and must never be the source.
    expect(SOURCE).toMatch(/const rsi = calculateRSI\(closes, 14\);\s*rawRsiMap\.set\(d\.sym, rsi\?\.value \?\? null\);/);
    expect(SOURCE).not.toMatch(/rsi: tech\.factors\?\.rsi/);
    expect(mirrorTechRaw({ factors: { rsi: 50, distTo52wkHigh: 3.2 }, bbPercentB: 0.71, atrPercent: 1.9 }, 61.4))
      .toEqual({ rsi: 61.4, bbPercentB: 0.71, distTo52wkHigh: 3.2, atrPercent: 1.9 });
    expect(mirrorTechRaw({ factors: { rsi: 50 }, bbPercentB: null, atrPercent: undefined }, null))
      .toEqual({ rsi: null, bbPercentB: null, distTo52wkHigh: null, atrPercent: null });
    expect(mirrorTechRaw({}, undefined)).toEqual({ rsi: null, bbPercentB: null, distTo52wkHigh: null, atrPercent: null });
  });

  it('snapshot writer: ops doc read at run start, write AFTER the rankings commit, expiry only on the premarket run, failures into `errors`', () => {
    const opsIdx = at('const snapshotOps = await readRankingSnapshotOps(db, { log });');
    const fetchIdx = at("log('Step 2: Fetching index, TNX, and sector ETF data in parallel...');");
    expect(opsIdx).toBeLessThan(fetchIdx);
    const commitIdx = at('await batch.commit();');
    const writeIdx = at('await writeRankingSnapshot(db, id, {');
    expect(writeIdx).toBeGreaterThan(commitIdx);
    expect(SOURCE).toMatch(/if \(!intraday\) \{\s*const \{ deleted \} = await expireRankingSnapshots\(db, \{ nowMs: now\.getTime\(\), retainDays: snapshotOps\.retainDays \}\);/);
    expect(SOURCE).toMatch(/errors\.push\(\{ stage: 'rankingSnapshot', error: err\.message \}\);/);
    expect(SOURCE).toMatch(/expiresAt: Timestamp\.fromMillis\(docData\.expiresAtMs\),/);
    expect(SOURCE).toMatch(/codeHead: process\.env\.VERCEL_GIT_COMMIT_SHA \|\| null,/);
    expect(SOURCE).toMatch(/if \(snapshotOps\.enabled && v2Snapshot\) \{/);
    // Bound to the run's start, not its finish (review finding): label + ET date from startTime.
    expect(SOURCE).toMatch(/const runStartedAt = new Date\(startTime\);\s*const runLabel = resolveSnapshotRunLabel\(\{ intraday, now: runStartedAt, override: snapshotOverride \}\);/);
    expect(SOURCE).toMatch(/const now = runStartedAt;\s*const etDate = formatEtDate\(now\);/);
  });

  it('does not add a cron entry or touch the schedule (spec §5: no new cron)', () => {
    const vercel = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'vercel.json'), 'utf8');
    expect((vercel.match(/"schedule"/g) || []).length).toBe(39);
    expect(vercel).not.toMatch(/rankingSnapshots/);
  });
});
