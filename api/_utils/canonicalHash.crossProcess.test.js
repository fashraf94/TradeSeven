// api/_utils/canonicalHash.crossProcess.test.js
//
// Composition Build (PR 1) — the cross-process determinism test the Phase 0
// discovery found MISSING (docs/audits/20260806_COMPOSITION_BUILD_V09_PHASE0_DISCOVERY.md,
// item 12 / spec §1 "Cross-process determinism test required"; acceptance A17).
//
// canonicalHash.js documents stability "across ... process, and platform"
// (canonicalHash.js:38-40) but the only shipped assertions were same-process
// value comparisons (archetypePhase2Constants.test.js:70-79). This test spawns
// a SEPARATE Node process, hashes the same input there, and asserts the digest
// equals the in-process digest — the guarantee the identity chain relies on
// (the CI lock recomputes identityHash in one process and compares it to a
// snapshot generated in another).
//
// It also pins the serializer's TWO load-bearing properties for the authored
// cell matrix: (1) object key order is irrelevant (Firestore alphabetizes keys),
// and (2) ARRAY order IS significant — so any set-like array in the registry
// (rulingIds, notes) MUST be pre-sorted at authoring time or an equal-membership
// reorder changes the hash (spec §1 correction A7).

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { canonicalContentHash, stableStringify } from './canonicalHash.js';

// Absolute file: URL to the module under test, resolved from THIS file's
// location so the child process reproduces the import regardless of its cwd.
const HASH_MODULE_URL = pathToFileURL(
  resolve(dirname(fileURLToPath(import.meta.url)), 'canonicalHash.js'),
).href;

/** Hash `value` in a fresh, independent Node process. */
function hashInChildProcess(value) {
  const payloadB64 = Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
  const code = [
    `const { canonicalContentHash } = await import(${JSON.stringify(HASH_MODULE_URL)});`,
    `const v = JSON.parse(Buffer.from(process.argv[1], 'base64').toString('utf8'));`,
    `process.stdout.write(canonicalContentHash(v));`,
  ].join('\n');
  return execFileSync(
    process.execPath,
    ['--input-type=module', '-e', code, payloadB64],
    { encoding: 'utf8' },
  ).trim();
}

// Representative fixtures: nested objects with keys in a deliberately non-sorted
// insertion order, arrays (order-significant), a registry-cell-shaped object,
// and edge values (null, empty array/object, unicode, an escaped apostrophe).
const FIXTURES = [
  { b: 2, a: [1, 2, 3], nested: { z: 1, y: [{ k: 2, j: 1 }] } },
  {
    state: 'tension',
    rulingIds: ['R-13', 'R-2', 'R-107'],
    narrowedParams: { allow: ['bearish'] },
    advisory: "the agent is instructed the floor never lowers the archetype's standard",
    displayReason: null,
    notes: [],
  },
  { empty: {}, list: [], zero: 0, neg: -0, nul: null, unicode: 'café — ✓' },
  { definitions: { a: { compat: { x: 1 } }, b: { compat: { y: 2 } } }, corpus: { ruleFamilies: {} } },
];

describe('canonicalContentHash — cross-process determinism (A17)', () => {
  it.each(FIXTURES.map((fx, i) => [i, fx]))(
    'fixture %i hashes identically in a separate Node process',
    (_i, fx) => {
      expect(hashInChildProcess(fx)).toBe(canonicalContentHash(fx));
    },
  );

  it('a key-reordered (structurally equal) object hashes identically across processes', () => {
    const a = { b: 2, a: [1, 2, 3], nested: { z: 1, y: [{ k: 2, j: 1 }] } };
    const b = { a: [1, 2, 3], nested: { y: [{ j: 1, k: 2 }], z: 1 }, b: 2 }; // reordered keys, same content
    expect(canonicalContentHash(a)).toBe(canonicalContentHash(b));
    expect(hashInChildProcess(b)).toBe(canonicalContentHash(a));
  });
});

describe('canonicalContentHash — documented serializer limits (spec §1 / A7)', () => {
  it('object key order is NOT significant', () => {
    expect(canonicalContentHash({ a: 1, b: 2 })).toBe(canonicalContentHash({ b: 2, a: 1 }));
  });

  it('ARRAY order IS significant — set-like arrays must be pre-sorted at authoring time', () => {
    // The serializer never sorts arrays (canonicalHash.js:23). This is why the
    // authored cell matrix pre-sorts rulingIds/notes: an equal-membership
    // reorder here yields a DIFFERENT hash, which would be a spurious identity
    // change if the registry did not normalize order.
    expect(canonicalContentHash({ rulingIds: ['R-2', 'R-13'] }))
      .not.toBe(canonicalContentHash({ rulingIds: ['R-13', 'R-2'] }));
    // Pre-sorted, equal-membership arrays are identical by construction.
    const sortedA = ['R-13', 'R-2', 'R-107'].slice().sort();
    const sortedB = ['R-107', 'R-2', 'R-13'].slice().sort();
    expect(canonicalContentHash({ rulingIds: sortedA }))
      .toBe(canonicalContentHash({ rulingIds: sortedB }));
  });

  it('stableStringify drops undefined properties, keeps null, and renders undefined array slots as null', () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
    expect(stableStringify([undefined])).toBe('[null]');
  });
});
