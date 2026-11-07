// api/_utils/huddle/dissentTable.test.js
//
// Huddle S1 — the dissent table (spec V1.1 §4.3): one row per archetype, every row
// moves a stance toward WATCH, and an archetype with no row fails closed. The six keys
// are held as values; this file pins them to the fenced archetype table's ids (read,
// never edited — BUILD_RULES §1), so a new archetype without a row fails here.

import { describe, it, expect } from 'vitest';
// Fenced (BUILD_RULES §1): READ to pin the key set, never edited. A test import is not a
// production importer of the legacy table (the §2.3 ratchet counts non-test importers).
import { VALID_ARCHETYPES } from '../agentArchetypeConfig.js';
import { DISSENT_TABLE, dissentRowOf, isArchetypeSupported } from './dissentTable.js';
import { STANCE_KINDS } from './planTemplates.js';

describe('the dissent table', () => {
  it('has exactly one row per archetype of the archetype table', () => {
    expect(Object.keys(DISSENT_TABLE).sort()).toEqual([...VALID_ARCHETYPES].sort());
  });

  it('every row moves a stance kind to WATCH (never toward more risk) with a reason', () => {
    for (const [archetype, row] of Object.entries(DISSENT_TABLE)) {
      expect(STANCE_KINDS, archetype).toContain(row.from);
      expect(row.to, archetype).toBe('WATCH');
      expect(row.from, archetype).not.toBe('WATCH');
      expect(row.reason.length, archetype).toBeGreaterThan(20);
      expect(Object.isFrozen(row)).toBe(true);
    }
  });

  it('the proposed rows, for the founder to ratify', () => {
    expect(Object.fromEntries(Object.entries(DISSENT_TABLE).map(([k, r]) => [k, `${r.from}->${r.to}`]))).toEqual({
      momentum_chaser: 'FADE->WATCH',
      contrarian: 'CHASE->WATCH',
      diversifier: 'CHASE->WATCH',
      degen: 'FADE->WATCH',
      analyst: 'CHASE->WATCH',
      guardian: 'CHASE->WATCH',
    });
  });

  it('fails closed: no row for an unknown, missing or inherited name', () => {
    for (const a of ['unknown', '', null, undefined, 'constructor', 'toString', 'Contrarian']) {
      expect(dissentRowOf(a), String(a)).toBeNull();
      expect(isArchetypeSupported(a), String(a)).toBe(false);
    }
    expect(isArchetypeSupported('guardian')).toBe(true);
  });
});
