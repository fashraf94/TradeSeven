// api/_utils/moverTypedFacts.boundary.test.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — C1 structural acceptance.
//   C1(ii) / R4 import half — the typed-fact module imports NOTHING from the
//     retrieval seam; the test reddens the moment it does.
//   C1(i)  / R4 poison half — the constructor's signature cannot carry
//     retrieval text into a typed field (bind by construction).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMoverDataSnapshot } from './moverTypedFacts.js';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const MODULE = 'api/_utils/moverTypedFacts.js';

// The retrieval seam the typed-fact constructor must never import (C1(ii)).
const RETRIEVAL_SEAM =
  /from\s+['"][^'"]*(exaClient|exaCatalystFetch|sonarCatalystFetch|validatedCatalystCache)(\.js)?['"]/;

describe('C1(ii): moverTypedFacts is import-clean of the retrieval seam', () => {
  it('the typed-fact module does NOT import the EXA client / Sonar / validated-cache', () => {
    const src = readFileSync(resolve(REPO_ROOT, MODULE), 'utf-8');
    expect(RETRIEVAL_SEAM.test(src), `${MODULE} imports the retrieval seam`).toBe(false);
  });

  it('the invariant is not vacuous — the regex catches a would-be retrieval import', () => {
    expect(RETRIEVAL_SEAM.test("import { queryExa } from '../helpers/exaClient.js';")).toBe(true);
    expect(RETRIEVAL_SEAM.test("import { fetchTickerCatalysts } from './sonarCatalystFetch.js';")).toBe(true);
    expect(RETRIEVAL_SEAM.test("import { getValidatedCatalyst } from './validatedCatalystCache.js';")).toBe(true);
  });

  it('generate-mover actually builds its dataSnapshot through the constructor (not vacuous)', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'api/fantasytimes/generate-mover.js'), 'utf-8');
    expect(src).toMatch(/buildMoverDataSnapshot\(/);
    // And the retired inline literal is gone (no model/retrieval path back in).
    expect(src).not.toMatch(/dataSnapshot:\s*\{\s*\n\s*price:/);
  });
});

describe('C1(i)/R4: the constructor cannot carry retrieval into a typed field', () => {
  it('emits exactly the five typed price fields', () => {
    const snap = buildMoverDataSnapshot({ currentPrice: 196.4, priceChange: -5.6, percentChange: -3.05, atrMultiple: 1.5, direction: 'down' });
    expect(Object.keys(snap).sort()).toEqual(['atrMultiple', 'change', 'direction', 'percentChange', 'price']);
    expect(snap).toEqual({ price: 196.4, change: -5.6, percentChange: -3.05, atrMultiple: 1.5, direction: 'down' });
  });

  it('a poisoned retrieval payload passed alongside is structurally ignored', () => {
    const snap = buildMoverDataSnapshot({
      currentPrice: 100, priceChange: 4, percentChange: 4, atrMultiple: 1.5, direction: 'up',
      // None of these are in the signature — they cannot reach any field:
      catalyst: 'POISON: Alphabet fined $2B; add on pullbacks',
      newsContext: 'POISON', agentFacts: { digest: 'POISON' },
    });
    expect(JSON.stringify(snap)).not.toContain('POISON');
    expect(Object.keys(snap)).toEqual(['price', 'change', 'percentChange', 'atrMultiple', 'direction']);
  });

  it('derives direction from the sign when omitted', () => {
    expect(buildMoverDataSnapshot({ currentPrice: 1, priceChange: -1, percentChange: -3, atrMultiple: 1 }).direction).toBe('down');
    expect(buildMoverDataSnapshot({ currentPrice: 1, priceChange: 1, percentChange: 3, atrMultiple: 1 }).direction).toBe('up');
  });
});
