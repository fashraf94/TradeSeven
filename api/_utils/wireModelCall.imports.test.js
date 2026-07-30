// api/_utils/wireModelCall.imports.test.js
// P2-48 — wireModelCall is the SOLE Anthropic-client importer in the Wire
// context (Phase 2 Spec V1.5 R4-B2, scoped by Addendum A R-A1).
//
// Scope asserted: every non-test module under api/fantasytimes/**
// (recursive) plus every api/_utils/wire*.js module. The N3 editorial judge
// joins this set when it lands (it will live in the scanned set by
// construction). Fenced decide.js and every other repo importer are OUT of
// scope per R-A1 — this suite deliberately does not scan them.
//
// A6: the injected fault is any in-scope seam importing the client
// directly. Reverting one seam's import (e.g. restoring
// `import Anthropic from '@anthropic-ai/sdk'` to generate-pulse.js) turns
// the first test red. The scan is source-text over import forms — the
// archetypeRegistry direct-import precedent — plus a constructor-name belt;
// R3-M9's full AST enforcement arrives with the N1.1 reader boundary (P3).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SOLE_IMPORTER = 'api/_utils/wireModelCall.js';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js') && !p.endsWith('.test.js')) out.push(p);
  }
  return out;
}

function wireContextFiles() {
  const files = walk(resolve(REPO_ROOT, 'api/fantasytimes'));
  for (const name of readdirSync(resolve(REPO_ROOT, 'api/_utils'))) {
    if (name.startsWith('wire') && name.endsWith('.js') && !name.endsWith('.test.js')) {
      files.push(resolve(REPO_ROOT, 'api/_utils', name));
    }
  }
  return files.map((p) => relative(REPO_ROOT, p)).sort();
}

describe('P2-48: sole-importer invariant over the Wire context', () => {
  const files = wireContextFiles();

  it('the scan set is real and includes the seams (self-check against a vacuous pass)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain('api/fantasytimes/generate-pulse.js');
    expect(files).toContain('api/fantasytimes/poll-batch.js');
    expect(files).toContain(SOLE_IMPORTER);
  });

  it("only wireModelCall.js references '@anthropic-ai/sdk'", () => {
    const offenders = files.filter(
      (rel) => rel !== SOLE_IMPORTER && readFileSync(resolve(REPO_ROOT, rel), 'utf-8').includes('@anthropic-ai/sdk'),
    );
    expect(offenders, `direct Anthropic-client reference in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('belt: no in-scope module constructs an Anthropic client by name', () => {
    const offenders = files.filter((rel) => {
      if (rel === SOLE_IMPORTER) return false;
      const src = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
      return /new\s+Anthropic\s*\(/.test(src) || /getAnthropicClient\s*\(/.test(src);
    });
    expect(offenders, `client construction in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the sole importer itself does import the client (the invariant is not vacuous)', () => {
    const src = readFileSync(resolve(REPO_ROOT, SOLE_IMPORTER), 'utf-8');
    expect(src).toContain("from '@anthropic-ai/sdk'");
  });
});
