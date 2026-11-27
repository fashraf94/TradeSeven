// api/_utils/researchUniverse.boundary.test.js
//
// Research universe Build 1: THE OFF SWITCH (build prompt sections 3.3 and 4). Nothing outside the two new modules
// and their tests imports researchUniverse.js or researchDirectory.js, so no game read, rank, pin, Wire hash,
// scheduled job or client bundle can reach them. When a later build connects one surface, it adds that file here
// on purpose, in its own commit.
//
// The scan is a plain, case-insensitive NAME scan of the path and text of every code file in the repo (api/ and src/,
// which the build prompt names, and also scripts/, the other code folders and the root config files such as
// vite.config.js, which could put the directory into the client bundle), with no comment stripping: a mention
// anywhere fails, which fails closed. Case-insensitive because Windows resolves './ResearchUniverse.js' to
// researchUniverse.js. The names include the generator's (build-research-directory), so nothing imports its fetch
// and writer either. Skipped: dot-folders (other sessions' worktrees live under .claude/), node_modules, build
// output and docs/. Out of scope by design: a path assembled at run time from pieces (no honest import does that).
//
// Build 2 (build prompt section 5.7) adds two more names, each with its own allowed files:
//   - the fetch module, api/_utils/researchMeasures.js: researchUniverse.js and it may be named only by each other, the
//     hand-run script (scripts/research-stock.mjs) and their tests;
//   - the per-stock math, api/_utils/stockMeasures.js: named only by the rankings job (compute-rankings.js), the
//     research modules and their tests.
// Any other file naming one fails.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as rankingConfig from './rankingConfig.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODE_FILE = /\.(?:[cm]?js|jsx|ts|tsx)$/;
const SKIP = new Set(['node_modules', 'dist', 'coverage', 'docs']);
const NAMES = /research[-_]?(?:universe|directory)/i;

/** The two modules and their tests, the generator that writes the directory and its test, and the generator's corrections list and its test (Build 2): the only files that may name them. */
const ALLOWED = new Set([
  'api/_utils/researchUniverse.js',
  'api/_utils/researchDirectory.js',
  'api/_utils/researchUniverse.test.js',
  'api/_utils/researchDirectory.test.js',
  'api/_utils/researchUniverse.boundary.test.js',
  'api/_utils/researchUniverse.precedence.test.js',
  'scripts/build-research-directory.mjs',
  'scripts/build-research-directory.test.js',
  'scripts/research-directory-corrections.mjs',
  'scripts/research-directory-corrections.test.js',
  // Build 2: the fetch module imports researchUniverse.js; its test reads the research sector.
  'api/_utils/researchMeasures.js',
  'api/_utils/researchMeasures.test.js',
  'api/_utils/researchMeasures.precedence.test.js',
]);

/** Build 2: the fetch module. Named only by itself, the hand-run script, their tests and this file. */
const FETCH_NAMES = /research[-_]?measures|research-stock\.(?:m?js|test)/i;
const FETCH_ALLOWED = new Set([
  'api/_utils/researchMeasures.js',
  'api/_utils/researchMeasures.test.js',
  'api/_utils/researchMeasures.precedence.test.js',
  'scripts/research-stock.mjs',
  'scripts/research-stock.test.js',
  'api/_utils/researchUniverse.boundary.test.js',
]);

/** Build 2: the per-stock math. Named only by the rankings job, the research modules and their tests, and this file. */
const MEASURES_NAMES = /stock[-_]?measures/i;
const MEASURES_ALLOWED = new Set([
  'api/_utils/stockMeasures.js',
  'api/_utils/stockMeasures.test.js',
  'api/cron/compute-rankings.js',
  'api/cron/compute-rankings.measuresGolden.test.js',
  'api/cron/compute-rankings.beatRateSource.test.js',
  'api/_utils/__fixtures__/stockMeasuresGoldenInputs.js',
  'api/_utils/researchMeasures.js',
  'api/_utils/researchMeasures.test.js',
  'scripts/research-stock.mjs',
  'scripts/research-stock.test.js',
  'api/_utils/researchUniverse.boundary.test.js',
]);

function walk(rel, out) {
  for (const ent of readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    if (ent.name.startsWith('.') || SKIP.has(ent.name)) continue;
    const child = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.isDirectory()) walk(child, out);
    else if (CODE_FILE.test(ent.name)) out.push(child);
  }
  return out;
}

/** Files (repo-relative path, text) that name either module and are not allowed to. */
function offendersIn(files, allowed = ALLOWED, names = NAMES) {
  return files.filter((f) => (names.test(f.path) || names.test(f.text)) && !allowed.has(f.path)).map((f) => f.path);
}

describe('Build 2: the scanner catches every way of reaching the fetch module and the per-stock math (planted)', () => {
  it.each([
    ['a route importing the fetch module', 'api/stocks/research.js', "import { fetchResearchStock } from '../_utils/researchMeasures.js';", FETCH_ALLOWED, FETCH_NAMES],
    ['a cron importing the fetch module', 'api/cron/zz-research.js', "const m = await import('../_utils/researchMeasures.js');", FETCH_ALLOWED, FETCH_NAMES],
    ['a screen importing the fetch module', 'src/components/Research/x.jsx', "import { readResearchStock } from '../../../api/_utils/researchMeasures';", FETCH_ALLOWED, FETCH_NAMES],
    ['a case variant of the fetch module', 'src/g.ts', "import x from '../api/_utils/ResearchMeasures.js';", FETCH_ALLOWED, FETCH_NAMES],
    ['an importer of the hand-run script', 'api/cron/zz2.js', "import { runCli } from '../../scripts/research-stock.mjs';", FETCH_ALLOWED, FETCH_NAMES],
    ['a game module importing the per-stock math', 'api/cron/compute-estimates.js', "import { extractMetrics } from '../_utils/stockMeasures.js';", MEASURES_ALLOWED, MEASURES_NAMES],
    ['a screen importing the per-stock math', 'src/components/x.jsx', "import { getQuarterlyTTM } from '../../api/_utils/stockMeasures';", MEASURES_ALLOWED, MEASURES_NAMES],
    ['a file named for the per-stock math', 'api/_utils/stock_measures_copy.js', 'export const X = 1;', MEASURES_ALLOWED, MEASURES_NAMES],
  ])('%s', (_title, p, text, allowed, names) => {
    expect(offendersIn([{ path: p, text }], allowed, names)).toEqual([p]);
  });
  it('passes the allowed files', () => {
    expect(offendersIn([...FETCH_ALLOWED].map((p) => ({ path: p, text: "import './researchMeasures.js';" })), FETCH_ALLOWED, FETCH_NAMES)).toEqual([]);
    expect(offendersIn([...MEASURES_ALLOWED].map((p) => ({ path: p, text: "import './stockMeasures.js';" })), MEASURES_ALLOWED, MEASURES_NAMES)).toEqual([]);
  });
  it('the rankings job may import the per-stock math but never the fetch module or the research list', () => {
    expect(MEASURES_ALLOWED.has('api/cron/compute-rankings.js')).toBe(true);
    expect(FETCH_ALLOWED.has('api/cron/compute-rankings.js')).toBe(false);
    expect(ALLOWED.has('api/cron/compute-rankings.js')).toBe(false);
  });
});

describe('the scanner catches every way of reaching the modules (planted)', () => {
  it.each([
    ['a static import', 'src/a.js', "import { researchUniverse } from '../api/_utils/researchUniverse.js';"],
    ['a dynamic import', 'api/b.js', "const m = await import('./_utils/researchDirectory.js');"],
    ['a re-export', 'api/_utils/c.js', "export * from './researchUniverse.js';"],
    ['a require', 'api/d.cjs', "const d = require('./_utils/researchDirectory');"],
    ['a path without its extension', 'src/e.jsx', "import { isResearchStock } from '../api/_utils/researchUniverse';"],
    ['a case variant (Windows resolves it)', 'src/f.ts', "import x from '../api/_utils/ResearchDirectory.js';"],
    ['a mention in a comment (fails closed)', 'api/g.mjs', '// later: wire researchUniverse here'],
    ['a file named for it (a copy is not an import, but it is not the off switch either)', 'src/data/researchDirectoryCopy.js', 'export const X = 1;'],
    ['an allowed file name at another path', 'src/researchUniverse.js', 'export const X = 1;'],
    ['a root config file putting the directory in the client bundle', 'vite.config.js', "import { RESEARCH_DIRECTORY } from './api/_utils/researchDirectory.js';"],
    ['a hand-run script', 'scripts/zz-readout.mjs', "import { researchUniverse } from '../api/_utils/researchUniverse.js';"],
    ['an importer of the generator (its graph holds the EODHD fetch and the writer)', 'api/cron/zz.js', "import { houseSpelling } from '../../scripts/build-research-directory.mjs';"],
    ['a hyphenated or underscored file name', 'src/data/research_directory.js', 'export const X = 1;'],
  ])('%s', (_title, p, text) => {
    expect(offendersIn([{ path: p, text }])).toEqual([p]);
  });
  it('passes a clean file and the allowed files', () => {
    const files = [{ path: 'src/clean.js', text: "import { ALL_TICKERS } from '../api/_utils/rankingConfig.js';" },
      ...[...ALLOWED].map((p) => ({ path: p, text: "import './researchUniverse.js'; import './researchDirectory.js';" }))];
    expect(offendersIn(files)).toEqual([]);
  });
});

describe('nothing outside the two modules and their tests names them', () => {
  const files = walk('', []);
  it('scans every code file in the repo: api/, src/, scripts/, the other code folders and the root config files', () => {
    expect(files.length).toBeGreaterThan(4000);
    for (const p of ['api/_utils/rankingConfig.js', 'src/App.jsx', 'api/_utils/wireGenerationSurface.js', 'api/cron/compute-rankings.js',
      'scripts/fetch-ticker-industries.js', 'scripts/build-research-directory.mjs', 'vite.config.js', 'tailwind.config.js', 'vitest.config.js']) {
      expect(files).toContain(p);
    }
    expect(files.some((p) => p.startsWith('.') || p.includes('/.') || p.includes('node_modules/'))).toBe(false);
  });
  it('every allowed file exists (no stale allowance)', () => {
    for (const p of [...ALLOWED, ...FETCH_ALLOWED, ...MEASURES_ALLOWED]) expect(existsSync(path.join(ROOT, p))).toBe(true);
  });
  // Read at collection time, outside any row's timeout (about 2 seconds for ~3,000 files on a quiet machine).
  const scanned = files.map((p) => ({ path: p, text: readFileSync(path.join(ROOT, p), 'utf8') }));
  it('finds no other file naming researchUniverse or researchDirectory', () => {
    expect(offendersIn(scanned)).toEqual([]);
  });
  it('Build 2: finds no other file naming the fetch module or the hand-run script', () => {
    expect(offendersIn(scanned, FETCH_ALLOWED, FETCH_NAMES)).toEqual([]);
  });
  it('Build 2: finds no other file naming the per-stock math (the rankings job and the research modules only)', () => {
    expect(offendersIn(scanned, MEASURES_ALLOWED, MEASURES_NAMES)).toEqual([]);
  });
});

describe('loading the accessor leaves the game list as it was', () => {
  const snapshot = () => JSON.stringify(
    Object.keys(rankingConfig).sort().map((k) => [k, typeof rankingConfig[k] === 'function' ? String(rankingConfig[k]) : rankingConfig[k]]),
    (_k, v) => (v instanceof Set ? [...v] : v),
  );
  it('every rankingConfig export is unchanged after researchUniverse.js loads, and the 228 are still 228', async () => {
    const before = snapshot();
    const mod = await import('./researchUniverse.js');
    expect(mod.researchUniverse.has('GLW')).toBe(true);
    expect(snapshot()).toBe(before);
    expect(rankingConfig.ALL_TICKERS.length).toBe(228);
    expect(rankingConfig.ALL_TICKERS).not.toContain('GLW');
    expect(Object.hasOwn(rankingConfig.TICKER_TO_SECTOR, 'GLW')).toBe(false);
  });
});
