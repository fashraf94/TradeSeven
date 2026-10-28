// api/_utils/setupEvaluator/thresholds.test.js
//
// Measured Trend Evidence, slice 1 (P3) — V3 build prompt §9.5: every slot
// equals the blessing sheet, the hash literal is pinned, a changed value or
// key order changes the hash, and SEMANTICS_NOTES names what the hash cannot.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  TF_SETUP_V1_THRESHOLDS, SETUP_VERSION, THRESHOLDS_HASH, hashThresholds,
  SEMANTICS_ID, SEMANTICS_NOTES, MIN_COMPLETED_BARS, describeRuleSet,
} from './thresholds.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('tf-setup-v1 thresholds (definition §8, blessed 24 Sep 2026)', () => {
  it('every slot equals the blessing sheet, in the declared key order', () => {
    expect(TF_SETUP_V1_THRESHOLDS).toEqual({
      smaFastLength: 20,
      smaSlowLength: 50,
      swingLookbackBars: 20,
      atrLength: 14,
      volumeAverageLength: 20,
      slowSmaRisingWindowBars: 5,
      breakoutVolumeMultiple: 1.5,
      pullbackTouchWindowBars: 3,
      pullbackVolumeRule: 'none',
      extensionGuardAtrMultiple: 2.0,
    });
    expect(Object.keys(TF_SETUP_V1_THRESHOLDS)).toEqual([
      'smaFastLength', 'smaSlowLength', 'swingLookbackBars', 'atrLength', 'volumeAverageLength',
      'slowSmaRisingWindowBars', 'breakoutVolumeMultiple', 'pullbackTouchWindowBars', 'pullbackVolumeRule', 'extensionGuardAtrMultiple',
    ]);
    expect(Object.isFrozen(TF_SETUP_V1_THRESHOLDS)).toBe(true);
  });

  it('the version, the hash literal and the minimum bar count are pinned', () => {
    expect(SETUP_VERSION).toBe('tf-setup-v1');
    expect(THRESHOLDS_HASH).toBe('26f3f411b566');
    expect(MIN_COMPLETED_BARS).toBe(55);
  });

  it('THRESHOLDS_HASH is the canonical hash of the frozen object, computed, not pasted', () => {
    expect(THRESHOLDS_HASH).toBe(hashThresholds(TF_SETUP_V1_THRESHOLDS));
    expect(THRESHOLDS_HASH).toMatch(/^[0-9a-f]{12}$/);
    // The source-text tripwire: the export must be the function applied to the object.
    const src = readFileSync(path.join(HERE, 'thresholds.js'), 'utf8');
    expect(src).toMatch(/export const THRESHOLDS_HASH = hashThresholds\(TF_SETUP_V1_THRESHOLDS\);/);
  });

  it('a changed value changes the hash', () => {
    for (const [key, value] of Object.entries(TF_SETUP_V1_THRESHOLDS)) {
      const changed = { ...TF_SETUP_V1_THRESHOLDS, [key]: typeof value === 'number' ? value + 1 : 'changed' };
      expect(hashThresholds(changed), key).not.toBe(THRESHOLDS_HASH);
    }
  });

  it('a changed key order changes the hash', () => {
    const entries = Object.entries(TF_SETUP_V1_THRESHOLDS);
    const swapped = Object.fromEntries([entries[1], entries[0], ...entries.slice(2)]);
    expect(swapped).toEqual(TF_SETUP_V1_THRESHOLDS); // same content…
    expect(hashThresholds(swapped)).not.toBe(THRESHOLDS_HASH); // …different canonical bytes
  });

  it('SEMANTICS_ID is the initial interpretation and SEMANTICS_NOTES names what the hash cannot', () => {
    expect(SEMANTICS_ID).toBe('tf-setup-v1/sem-1');
    expect(Object.isFrozen(SEMANTICS_NOTES)).toBe(true);
    const text = SEMANTICS_NOTES.join('\n');
    expect(text).toMatch(/C1 \(FD-P3-1/);
    expect(text).toMatch(/pattern-scoped/);
    expect(text).toMatch(/Raw basis \(FD-P3-2\)/);
    expect(text).toMatch(/Volume policy: .*finite number greater than zero/);
    expect(text).toMatch(/only when all 20 are usable/);
    expect(text).toMatch(/Calendar-expected session/);
    expect(text).toMatch(/never an older fallback/);
    expect(text).toMatch(/Split heuristic and provenance/);
    expect(text).toMatch(/A ratio of 1 proves nothing/);
    expect(text).toMatch(/newest first/);
    expect(text).toMatch(/4-decimal/);
    expect(text).toMatch(/breakout_close C >= swingHigh/);
    expect(text).toMatch(/pullback_touch min\(low\[0\.\.2\]\) <= SMA_fast/);
    expect(text).toMatch(/Numerical policy .*computed exactly in decimal/); // the fix round after Astra's review
    expect(text).toMatch(/never with a tolerance/);
    expect(text).toMatch(/a step of exactly 10% never trips/);
  });

  it('describeRuleSet returns the frozen identity every record carries', () => {
    const rs = describeRuleSet();
    expect(rs).toEqual({ setupVersion: 'tf-setup-v1', thresholdsHash: THRESHOLDS_HASH, semanticsId: 'tf-setup-v1/sem-1' });
    expect(Object.isFrozen(rs)).toBe(true);
  });
});
