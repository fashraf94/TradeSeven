// api/_utils/mandateModelCall.imports.test.js
//
// Spec 1 §3.3 — mandateModelCall is the SOLE Anthropic-client importer on the
// book eval path. Scanned as the TRANSITIVE IMPORT CLOSURE of the eval handler
// (not a filename glob), so routing a book's model call through any other module
// — including a shared seam such as wireModelCall.js that itself imports the
// client — is caught: that module becomes reachable from the handler and is
// flagged. The walk stops at the two sole importers so their sanctioned subtrees
// are not themselves flagged.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evalPathClosure, REPO_ROOT } from './__fixtures__/mandateEvalPathClosure.js';

const ENTRY = 'api/cron/mandate-evaluate.js';
const SOLE_FETCH = 'api/_utils/mandateUniverseSnapshot.js';
const SOLE_MODEL = 'api/_utils/mandateModelCall.js';
const STOP_LEAVES = [SOLE_FETCH, SOLE_MODEL];

function referencesAnthropic(src) {
  return src.includes('@anthropic-ai/sdk') || /new\s+Anthropic\s*\(/.test(src) || /getAnthropicClient\s*\(/.test(src);
}

describe('§3.3: sole Anthropic-client importer over the mandate eval path (import closure)', () => {
  const closure = evalPathClosure(ENTRY, STOP_LEAVES);

  it('the closure is real and reaches the handler + sole importer (self-check)', () => {
    expect(closure).toContain(ENTRY);
    expect(closure).toContain(SOLE_MODEL);
    expect(closure.length).toBeGreaterThan(10);
  });

  it('only mandateModelCall.js references the Anthropic client', () => {
    // Scope to api/ eval-path modules (the invariant's scope); a src/config leaf may
    // name the client in flag prose without importing it.
    const offenders = closure.filter(
      (rel) => rel.startsWith('api/') && rel !== SOLE_MODEL && referencesAnthropic(readFileSync(resolve(REPO_ROOT, rel), 'utf-8')),
    );
    expect(offenders, `Anthropic-client reference on the eval path in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the sole importer itself DOES import the client (the invariant is not vacuous)', () => {
    expect(readFileSync(resolve(REPO_ROOT, SOLE_MODEL), 'utf-8')).toContain("from '@anthropic-ai/sdk'");
  });
});
