// api/_utils/mandateUniverseSnapshot.imports.test.js
//
// Spec 1 — §3.0 enforcement (HARD REQUIREMENT): "no module on the book eval path
// imports market-fetch clients except mandateUniverseSnapshot.js." This is the
// largest scaling risk (Risk #2) — per-book fetching works in dark testing and
// breaks at scale — so the invariant is a test, not a comment.
//
// The scan set is the TRANSITIVE IMPORT CLOSURE of the eval handler (not a
// filename glob): the eval PATH, not the naming convention. A non-`mandate*`
// helper pulled onto the path, or a route through a shared seam, is caught here
// because it is actually reachable from the handler. The walk stops at the two
// sole importers so their sanctioned client subtrees are not themselves flagged.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evalPathClosure, REPO_ROOT } from './__fixtures__/mandateEvalPathClosure.js';

const ENTRY = 'api/cron/mandate-evaluate.js';
const SOLE_FETCH = 'api/_utils/mandateUniverseSnapshot.js';
const SOLE_MODEL = 'api/_utils/mandateModelCall.js';
const STOP_LEAVES = [SOLE_FETCH, SOLE_MODEL];

// The market-fetch client modules and their entry points. Any eval-path module
// other than the sole importer referencing one is a violation.
const FORBIDDEN_MODULE_PATHS = ['tournamentPrices.js', 'marketDataCache.js'];
const FORBIDDEN_SYMBOLS = [
  'fetchBatchQuotes', 'fetchQuoteForSymbol', 'getStockAnalysisData',
  'getCachedBatchQuotes', 'fetchIntradayBatch', 'fetchIntradayCandles',
];

function referencesFetchClient(src) {
  if (FORBIDDEN_MODULE_PATHS.some((m) => src.includes(m))) return true;
  return FORBIDDEN_SYMBOLS.some((sym) => new RegExp(`\\b${sym}\\b`).test(src));
}

describe('§3.0: sole market-fetch importer over the mandate eval path (import closure)', () => {
  const closure = evalPathClosure(ENTRY, STOP_LEAVES);

  it('the closure is real and reaches the handler + sole importer (self-check)', () => {
    expect(closure).toContain(ENTRY);
    expect(closure).toContain(SOLE_FETCH);
    expect(closure).toContain('api/_utils/mandateGate.js'); // a deep orchestration module is reached
    expect(closure.length).toBeGreaterThan(10);
  });

  it('only mandateUniverseSnapshot.js references a market-fetch client', () => {
    // Scope to api/ eval-path modules — the fetch clients live in api/_utils, and a
    // shared src/config constants leaf (featureFlags) may name a client in flag prose
    // without ever fetching. The invariant is about the api eval path.
    const offenders = closure.filter(
      (rel) => rel.startsWith('api/') && rel !== SOLE_FETCH && referencesFetchClient(readFileSync(resolve(REPO_ROOT, rel), 'utf-8')),
    );
    expect(offenders, `market-fetch client reference on the eval path in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the sole importer itself DOES import the fetch clients (the invariant is not vacuous)', () => {
    const src = readFileSync(resolve(REPO_ROOT, SOLE_FETCH), 'utf-8');
    expect(src).toContain("from './tournamentPrices.js'");
    expect(src).toContain("from './marketDataCache.js'");
  });
});
