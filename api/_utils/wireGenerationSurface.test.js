// api/_utils/wireGenerationSurface.test.js
// P2-15 — the GENERATION_SURFACE committed-baseline lock (Phase 2 Spec V1.3
// D-P2-9 / Amendment G; archetypeRegistry identityHash precedent).
//
// A6 contract, both directions:
//   1. LOCK — any content diff inside the manifest (or wireDigest.js /
//      wireValidator.js) makes the recomputed hash diverge from the
//      committed baseline → this suite goes red. No git diff involved, so
//      it runs in the fetch-depth-1 CI.
//   2. REGEN GATE — regenerating the baseline while the bound version
//      constant is unchanged is REFUSED (assessRegen), so going green after
//      a surface change requires the bump. Unit-tested here on the pure
//      function, and enforced live in the regen branch.
//
// Regenerate: WIRE_GENERATION_BASELINE_REGEN=1 npx vitest run api/_utils/wireGenerationSurface.test.js

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  GENERATION_SURFACE,
  BASELINE_PATH,
  hashFile,
  surfaceHash,
  assessRegen,
} from './wireGenerationSurface.js';
import {
  WIRE_GENERATION_VERSION,
  WIRE_DIGEST_RENDERER_VERSION,
  WIRE_VALIDATOR_VERSION,
} from './wireContracts.js';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const REGEN = process.env.WIRE_GENERATION_BASELINE_REGEN === '1';

function computeCurrent() {
  const files = {};
  for (const rel of GENERATION_SURFACE) {
    files[rel] = hashFile(rel, readFileSync(resolve(REPO_ROOT, rel), 'utf-8'));
  }
  return {
    generationSurface: {
      version: WIRE_GENERATION_VERSION,
      hash: surfaceHash(files),
      files,
    },
    digestRenderer: {
      version: WIRE_DIGEST_RENDERER_VERSION,
      hash: hashFile('api/_utils/wireDigest.js', readFileSync(resolve(REPO_ROOT, 'api/_utils/wireDigest.js'), 'utf-8')),
    },
    validator: {
      version: WIRE_VALIDATOR_VERSION,
      hash: hashFile('api/_utils/wireValidator.js', readFileSync(resolve(REPO_ROOT, 'api/_utils/wireValidator.js'), 'utf-8')),
    },
  };
}

function readBaseline() {
  const p = resolve(REPO_ROOT, BASELINE_PATH);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
}

describe('P2-15: committed-baseline content lock', () => {
  if (REGEN) {
    it('regenerates the baseline (gated: content change requires a version bump)', () => {
      const prev = readBaseline();
      const next = computeCurrent();
      for (const section of ['generationSurface', 'digestRenderer', 'validator']) {
        const verdict = assessRegen(prev?.[section], next[section]);
        if (!verdict.allowed) {
          throw new Error(`[${section}] regen REFUSED: ${verdict.reason}`);
        }
      }
      writeFileSync(
        resolve(REPO_ROOT, BASELINE_PATH),
        JSON.stringify(
          {
            note:
              'Committed baseline for the GENERATION_SURFACE lock (P2-15). ' +
              'Never hand-edit: regenerate via WIRE_GENERATION_BASELINE_REGEN=1 ' +
              'after bumping the bound version constant in wireContracts.js.',
            generatedAgainst: {
              WIRE_GENERATION_VERSION,
              WIRE_DIGEST_RENDERER_VERSION,
              WIRE_VALIDATOR_VERSION,
            },
            ...next,
          },
          null,
          2,
        ) + '\n',
      );
      expect(true).toBe(true);
    });
    return;
  }

  const baseline = readBaseline();
  const current = computeCurrent();

  it('the baseline file exists (first generation is part of the P1 commit)', () => {
    expect(baseline, `missing ${BASELINE_PATH} — run the regen command in the file header`).not.toBeNull();
  });

  it('generation surface content matches the baseline — a diff without a WIRE_GENERATION_VERSION bump fails here', () => {
    // Per-file first so a failure names the exact offender.
    for (const rel of GENERATION_SURFACE) {
      expect(
        current.generationSurface.files[rel],
        `${rel} changed without a WIRE_GENERATION_VERSION bump (F-M1) — bump + regen`,
      ).toBe(baseline.generationSurface.files[rel]);
    }
    expect(current.generationSurface.hash).toBe(baseline.generationSurface.hash);
    // The manifest itself cannot gain or lose paths silently.
    expect(Object.keys(current.generationSurface.files).sort())
      .toEqual(Object.keys(baseline.generationSurface.files).sort());
  });

  it('baseline versions equal the live constants — bump-without-regen also fails', () => {
    expect(baseline.generationSurface.version).toBe(WIRE_GENERATION_VERSION);
    expect(baseline.digestRenderer.version).toBe(WIRE_DIGEST_RENDERER_VERSION);
    expect(baseline.validator.version).toBe(WIRE_VALIDATOR_VERSION);
  });

  it('renderer + validator content is bound to their own version constants', () => {
    expect(current.digestRenderer.hash, 'wireDigest.js changed without a WIRE_DIGEST_RENDERER_VERSION bump')
      .toBe(baseline.digestRenderer.hash);
    expect(current.validator.hash, 'wireValidator.js changed without a WIRE_VALIDATOR_VERSION bump')
      .toBe(baseline.validator.hash);
  });
});

describe('assessRegen — the bump is mechanically unavoidable', () => {
  const prev = { version: 1, hash: 'aaa' };

  it('content changed + version unchanged → refused', () => {
    const verdict = assessRegen(prev, { version: 1, hash: 'bbb' });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/bump the constant/);
  });

  it('content changed + version bumped → allowed', () => {
    expect(assessRegen(prev, { version: 2, hash: 'bbb' }).allowed).toBe(true);
  });

  it('no content change → allowed (idempotent regen)', () => {
    expect(assessRegen(prev, { version: 1, hash: 'aaa' }).allowed).toBe(true);
  });

  it('no committed baseline → allowed (first generation)', () => {
    expect(assessRegen(undefined, { version: 1, hash: 'aaa' }).allowed).toBe(true);
  });
});
