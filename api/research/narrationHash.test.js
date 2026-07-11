/**
 * contractHash determinism (Rider 3). The narration cache is keyed off
 * sha1(stableStringify(contract)); a Firestore round-trip that reorders map keys
 * must NOT change the hash, and ANY field change MUST change it — otherwise a
 * narration could be served for a contract it was not built from.
 */
import { describe, it, expect } from 'vitest';
import { contractHashOf } from './correlation-narrate.js';
import { CLASSES } from './narrationCorpus.js';

// Rebuild every object with keys in REVERSE insertion order (arrays untouched) —
// simulates a store that returns map keys in a different order.
function reorderKeys(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(reorderKeys);
  const out = {};
  for (const k of Object.keys(v).reverse()) out[k] = reorderKeys(v[k]);
  return out;
}

describe('contractHashOf — determinism', () => {
  it('two construction paths (key-reordered) hash identically', () => {
    const c = CLASSES.solidStandard();
    expect(contractHashOf(reorderKeys(c))).toBe(contractHashOf(c));
    expect(contractHashOf(structuredClone(c))).toBe(contractHashOf(c));
  });

  it('a changed enum, value, or nested envelope produces a DIFFERENT hash', () => {
    const c = CLASSES.solidStandard();
    const base = contractHashOf(c);

    const stateChanged = structuredClone(c); stateChanged.evidence.readState = 'fragile';
    expect(contractHashOf(stateChanged)).not.toBe(base);

    const valueChanged = structuredClone(c); valueChanged.links.raw60.value = 0.99;
    expect(contractHashOf(valueChanged)).not.toBe(base);

    const bandChanged = structuredClone(c); bandChanged.links.raw60.band = 'loose';
    expect(contractHashOf(bandChanged)).not.toBe(base);

    const criterionChanged = structuredClone(c); criterionChanged.evidence.criteria[0].value = -1;
    expect(contractHashOf(criterionChanged)).not.toBe(base);
  });

  it('distinct contract classes hash distinctly', () => {
    const hashes = Object.values(CLASSES).map((make) => contractHashOf(make()));
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
