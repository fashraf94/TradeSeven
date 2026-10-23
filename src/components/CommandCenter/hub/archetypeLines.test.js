// src/components/CommandCenter/hub/archetypeLines.test.js
//
// Command Center hub, slice S5 — the hub's one reader of the archetype identity
// tables (ruling R-S5-1: "the name and approach, through the existing archetype
// identity helpers"). The tables are read through this module alone, as the hub
// does: importing them here would add a second importer to the §2.3 ratchet
// (lens E5, E5-11).

import { describe, expect, it } from 'vitest';
import { archetypeLines } from './archetypeLines';

describe('archetypeLines', () => {
  it('a code-id the identity table holds: its display name and its one-line disposition', () => {
    // The disposition's words belong to the identity table, which is tuned there: the shape is what the hub relies on.
    const trend = archetypeLines('momentum_chaser');
    expect(trend.name).toBe('Trend Follower');
    expect(trend.approach).toMatch(/\S/);
    const guardian = archetypeLines('guardian');
    expect(guardian.name).toBe('Capital Preserver');
    expect(guardian.approach).toMatch(/\S/);
    expect(guardian.approach).not.toBe(trend.approach);
  });

  it('a code-id it does not hold prints NO approach — never the analyst profile the identity helper falls back to', () => {
    // premise: the helper the shells use WOULD answer for an unknown code, with the analyst's disposition
    expect(archetypeLines('analyst').approach).toMatch(/\S/);
    for (const unknown of ['zz_unknown', 'Trend Follower', 'constructor', 'toString', '__proto__', '', null, undefined]) {
      expect(archetypeLines(unknown).approach, String(unknown)).toBeNull();
    }
  });

  it('an unknown code-id still has a name (humanized, or "Unknown" when there is none)', () => {
    expect(archetypeLines('zz_unknown').name).toBe('Zz unknown');
    expect(archetypeLines(null).name).toBe('Unknown');
    expect(archetypeLines(undefined).name).toBe('Unknown');
  });
});
