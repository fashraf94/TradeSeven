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
  GENERATION_VALUE_EXPORTS,
  BASELINE_PATH,
  hashFile,
  hashValueExport,
  stableStringify,
  surfaceHash,
  assessRegen,
} from './wireGenerationSurface.js';
// The value-locked exports (founder ruling, P1 closeout): imported LIVE so
// the lock hashes the real runtime values, not a snapshot of source text.
import { ALL_TICKERS, TICKER_TO_SECTOR } from './rankingConfig.js';
import {
  WIRE_GENERATION_VERSION,
  WIRE_DIGEST_RENDERER_VERSION,
  WIRE_VALIDATOR_VERSION,
} from './wireContracts.js';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const REGEN = process.env.WIRE_GENERATION_BASELINE_REGEN === '1';

const VALUE_EXPORTS = { ALL_TICKERS, TICKER_TO_SECTOR };

function computeCurrent() {
  const files = {};
  for (const rel of GENERATION_SURFACE) {
    files[rel] = hashFile(rel, readFileSync(resolve(REPO_ROOT, rel), 'utf-8'));
  }
  // Value-level locks ride the same map under `value:` keys — same
  // mismatch handling, same regen gate, same version binding.
  for (const { key, exportName } of GENERATION_VALUE_EXPORTS) {
    files[key] = hashValueExport(key, VALUE_EXPORTS[exportName]);
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
    // Value-locked exports fail by name too (founder ruling: universe
    // content changes force a bump; unrelated rankingConfig edits touch
    // nothing because the FILE is not hashed — only these values are).
    for (const { key } of GENERATION_VALUE_EXPORTS) {
      expect(
        current.generationSurface.files[key],
        `${key} value changed without a WIRE_GENERATION_VERSION bump — universe/content change, bump + regen`,
      ).toBe(baseline.generationSurface.files[key]);
    }
    expect(current.generationSurface.hash).toBe(baseline.generationSurface.hash);
    // The manifest itself cannot gain or lose paths silently.
    expect(Object.keys(current.generationSurface.files).sort())
      .toEqual(Object.keys(baseline.generationSurface.files).sort());
  });

  it('the value lock is live: both locked exports are non-trivially hashed', () => {
    expect(ALL_TICKERS.length).toBeGreaterThan(50);
    expect(Object.keys(TICKER_TO_SECTOR).length).toBeGreaterThan(100);
    for (const { key } of GENERATION_VALUE_EXPORTS) {
      expect(baseline.generationSurface.files[key]).toMatch(/^[0-9a-f]{64}$/);
    }
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

describe('stableStringify — the value-lock canonical form', () => {
  it('arrays keep order (a ticker reorder IS a lockable change)', () => {
    expect(stableStringify(['A', 'B'])).not.toBe(stableStringify(['B', 'A']));
  });

  it('object keys sort (a cosmetic literal reorder is NOT a universe change)', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('a membership change hashes differently (the A6 direction)', () => {
    const base = hashValueExport('k', ['AAPL', 'MSFT']);
    expect(hashValueExport('k', ['AAPL', 'MSFT', 'FAKE'])).not.toBe(base);
    expect(hashValueExport('k', ['AAPL'])).not.toBe(base);
  });
});
