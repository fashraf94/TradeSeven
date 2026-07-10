// api/_utils/swapProvenance.test.js
//
// Release 2 PR-b — the provenance SIBLING (site-4 NO-EDIT amendment). Proves
// the spec §14 field set rides a single nested key, Firestore-safe, and that
// the regex-locked receipt contract it must never disturb still holds
// (buildSwapReceiptSource keeps exactly its three keys; a sibling spread adds
// exactly one).

import { describe, it, expect } from 'vitest';
import { buildSwapProvenance } from './swapProvenance.js';
import { buildSwapReceiptSource } from './agentRiskManager.js'; // fenced — called, never edited
import { resolveTempoDial, TEMPO_SUPPRESSION_REASONS } from './tempoDialClamp.js';

describe('buildSwapProvenance — the §14 sibling', () => {
  it('wraps the clamp provenance under ONE swapProvenance key (spread-safe beside the receipt)', () => {
    const { provenance } = resolveTempoDial({ desiredTempo: 'aggressive', dialEnabled: true });
    const metadata = {
      ...buildSwapReceiptSource({ source: 'haiku', archetype: 'degen' }),
      ...buildSwapProvenance(provenance),
    };
    // The receipt's shape-locked three keys are untouched…
    expect(metadata.source).toBe('haiku');
    expect(metadata.archetype).toBeNull();
    expect(metadata.hftKnobsSource).toBe('archetype');
    // …and the sibling adds exactly one nested key.
    expect(Object.keys(metadata).sort()).toEqual(['archetype', 'hftKnobsSource', 'source', 'swapProvenance']);
    expect(metadata.swapProvenance).toEqual({
      tempoDesired: 'aggressive',
      tempoEffective: 'aggressive',
      selectionSource: 'user_dial',
      dialBandVersion: 2,
      knobConfigVersion: 2,
    });
  });

  it('the four PR-b blocking states are all distinguishable in the sibling', () => {
    const dial = (args) => buildSwapProvenance(resolveTempoDial(args).provenance).swapProvenance;
    // 1. default-standard
    expect(dial({ desiredTempo: undefined, dialEnabled: true })).toMatchObject({
      tempoDesired: 'standard', tempoEffective: 'standard', selectionSource: 'default',
    });
    // 2. explicit standard — distinguishable from default
    expect(dial({ desiredTempo: 'standard', dialEnabled: true })).toMatchObject({
      selectionSource: 'user_dial', tempoEffective: 'standard',
    });
    // 3. non-standard → dial-attributed with versions
    expect(dial({ desiredTempo: 'measured', dialEnabled: true })).toMatchObject({
      tempoEffective: 'measured', selectionSource: 'user_dial', dialBandVersion: 2, knobConfigVersion: 2,
    });
    // 4. suppressed → effective standard + reason
    expect(dial({ desiredTempo: 'measured', dialEnabled: false })).toMatchObject({
      tempoDesired: 'measured', tempoEffective: 'standard',
      suppressionReason: TEMPO_SUPPRESSION_REASONS.DIAL_DISABLED,
    });
  });

  it('is Firestore-safe: no undefined values, suppressionReason key only when suppressed', () => {
    const clean = buildSwapProvenance(resolveTempoDial({ desiredTempo: 'aggressive', dialEnabled: true }).provenance);
    expect('suppressionReason' in clean.swapProvenance).toBe(false);
    for (const v of Object.values(clean.swapProvenance)) expect(v).not.toBeUndefined();
    const suppressed = buildSwapProvenance(resolveTempoDial({ desiredTempo: 'aggressive', dialEnabled: false }).provenance);
    expect(suppressed.swapProvenance.suppressionReason).toBe(TEMPO_SUPPRESSION_REASONS.DIAL_DISABLED);
  });

  it('spreads to NOTHING for absent provenance (pre-PR-b call paths stay byte-identical)', () => {
    expect(buildSwapProvenance(null)).toEqual({});
    expect(buildSwapProvenance(undefined)).toEqual({});
    expect({ ...buildSwapReceiptSource({ source: 'haiku' }), ...buildSwapProvenance(null) }).toEqual(
      buildSwapReceiptSource({ source: 'haiku' }),
    );
  });
});
