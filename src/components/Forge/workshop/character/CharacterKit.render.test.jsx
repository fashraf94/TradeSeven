// Render smoke for the ported Character-tab atoms. Confirms they mount without
// throwing and surface the real derived data (fingerprint axes, verbatim
// directive, state copy) — catches JSX/prop/runtime regressions the unit tests
// on the pure data layer can't. Uses SSR string rendering (no DOM needed); the
// atoms' real imports (behaviorFingerprint / leanRevalidation / archetypeAdjustments)
// are Node-clean, so this also guards the client→api dependency surface.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ForgeKitProvider } from '../forgeKit.jsx';
import { Fingerprint, TempoControl, BornWithKit, LeanSlots, LeanEntry, StateNotice, BattleSnapshot } from './CharacterKit.jsx';
import { ARCHETYPE_ADJUSTMENTS } from '../../../../data/archetypeAdjustments.js';

const wrap = (node) => renderToStaticMarkup(<ForgeKitProvider tokens={{}}>{node}</ForgeKitProvider>);

describe('CharacterKit — render smoke', () => {
  it('Fingerprint renders the radar + the Q3 teaching caption for the two fixed anchors', () => {
    const html = wrap(<Fingerprint archId="momentum_chaser" archName="Trend Follower" tempo="aggressive" liveTempo="standard" equippedLeans={[]} />);
    expect(html).toContain('polygon');            // radar drew
    expect(html).toContain('Concentration &amp; Discipline'); // teaching caption
    expect(html).toContain('set by your archetype');          // the dial doesn't move these
    expect(html).toContain('Tempo');              // axis label
  });

  it('Fingerprint bar-fallback (mobile) renders labeled bars, not a radar', () => {
    const html = wrap(<Fingerprint archId="degen" archName="Speculator" tempo="standard" liveTempo="standard" barFallback compact />);
    expect(html).not.toContain('<polygon');
    expect(html).toContain('Patience');
  });

  it('LeanEntry shows the VERBATIM canonical directive + a derived gloss', () => {
    const adj = ARCHETYPE_ADJUSTMENTS.momentum_chaser.adjustments[0]; // TF-01
    const html = wrap(<LeanEntry archId="momentum_chaser" lean={adj} state="available" slotsFull={false} locked={false} />);
    expect(html).toContain(adj.canonical);        // verbatim, never paraphrased
    expect(html).toContain('Agent directive');
    expect(html).toContain('What this changes:');
    expect(html).toContain(adj.id);
  });

  it('LeanEntry blocked state shows the conflict reason with the group dimension', () => {
    // guardian CP-04 / CP-05 are a conflict group (dimension: "stop width")
    const adj = ARCHETYPE_ADJUSTMENTS.guardian.adjustments.find((a) => a.id === 'CP-05');
    const html = wrap(<LeanEntry archId="guardian" lean={adj} state="blocked" blockedBy="CP-04" slotsFull={false} locked={false} />);
    expect(html).toContain('Blocked');
    expect(html).toContain('run alongside');       // conflict reason
    expect(html).toContain('stop width');          // the real group dimension
    expect(html).toContain('CP-04');
  });

  it('TempoControl renders three positions + the archetype meaning', () => {
    const html = wrap(<TempoControl archId="guardian" archName="Capital Preserver" value="standard" onChange={() => {}} />);
    expect(html).toContain('Measured');
    expect(html).toContain('Standard');
    expect(html).toContain('Aggressive');
    expect(html).toContain('within its lane'); // guardian tempo meaning
  });

  it('BornWithKit renders equipped traits read-only with their strength', () => {
    const html = wrap(<BornWithKit archName="Trend Follower" equippedTraits={[{ traitId: 't1', name: 'Trend Rider', identityStatement: 'Rides the trend', strength: 'dominant' }]} signatureIds={['t1']} />);
    expect(html).toContain('Trend Rider');
    expect(html).toContain('Dominant');
    expect(html).toContain('Born with');
  });

  it('StateNotice renders each of the five states (and nothing for live)', () => {
    for (const state of ['preactivation', 'empty', 'battle', 'changed', 'reconfirm']) {
      const html = wrap(<StateNotice state={state} archName="Contrarian" agentName="Ada" droppedCount={2} pending={{ leans: false, tempo: false }} />);
      expect(html.length).toBeGreaterThan(20);
    }
    expect(wrap(<StateNotice state="live" archName="Contrarian" agentName="Ada" />)).toBe('');
  });

  it('preactivation copy is activation-worded (§2.2), never "next deploy"', () => {
    const html = wrap(<StateNotice state="preactivation" archName="Contrarian" agentName="Ada" pending={{ leans: true, tempo: true }} />);
    expect(html).toContain('activates when');
    expect(html).not.toContain('next time');
  });

  it('LeanSlots renders equipped + empty slots', () => {
    const html = wrap(<LeanSlots equipped={[{ adjustmentId: 'TF-01', version: 1, text: 'Prefer fresh breakouts' }]} locked={false} onRemove={() => {}} onFocusMenu={() => {}} />);
    expect(html).toContain('TF-01');
    expect(html).toContain('Add a standing lean'); // the empty slot
  });

  it('BattleSnapshot renders the frozen loadout', () => {
    const html = wrap(<BattleSnapshot leans={[{ adjustmentId: 'TF-01', version: 1, text: 'Prefer fresh breakouts' }]} tempo="aggressive" />);
    expect(html).toContain('Locked in for this battle');
    expect(html).toContain('Aggressive');
  });
});
