// api/scripts/archetype-integrity-eval/corpus.test.js
//
// Phase H — corpus COMPLETENESS/coverage checks (hermetic; runs in the default
// suite). Proves the fixed corpus covers every allowlist id ≥2× and is correctly
// labelled BEFORE any live run — so the founder's eval measures a complete corpus.

import { describe, it, expect } from 'vitest';
import { buildCorpus, RAW, ARCHETYPES, HARD_OUTCOME } from './corpus.js';
import { getAllowlist } from '../../../src/data/archetypeAdjustments.js';

const corpus = buildCorpus();

describe('eval corpus — coverage', () => {
  it('covers all six code-id archetypes', () => {
    expect(ARCHETYPES.sort()).toEqual(
      ['analyst', 'contrarian', 'degen', 'diversifier', 'guardian', 'momentum_chaser'].sort(),
    );
  });

  it('covers every allowlist id of every archetype with ≥2 distinct flex phrasings', () => {
    for (const archetype of ARCHETYPES) {
      const realIds = getAllowlist(archetype).map((a) => a.id);
      expect(realIds.length).toBeGreaterThan(0);
      for (const id of realIds) {
        const phrasings = (corpus.filter(
          (it) => it.archetype === archetype && it.category === 'valid_flex' && it.expectedAdjustmentId === id,
        )).map((it) => it.message);
        expect(phrasings.length, `${archetype}/${id} flex coverage`).toBeGreaterThanOrEqual(2);
        expect(new Set(phrasings).size, `${archetype}/${id} distinct phrasings`).toBe(phrasings.length);
      }
    }
  });

  it('every valid_flex expectedAdjustmentId is a REAL id for its archetype (no typos)', () => {
    for (const it of corpus.filter((c) => c.category === 'valid_flex')) {
      const realIds = new Set(getAllowlist(it.archetype).map((a) => a.id));
      expect(realIds.has(it.expectedAdjustmentId), `${it.itemId}`).toBe(true);
    }
  });

  it('every archetype contributes the full non-flex battery (4 conflicts + lever + research + multi + follow-up)', () => {
    for (const archetype of ARCHETYPES) {
      const cat = (c) => corpus.filter((it) => it.archetype === archetype && it.category === c);
      expect(cat('core_conflict')).toHaveLength(4);
      expect(cat('core_conflict').map((it) => it.subtype).sort()).toEqual(['adversarial', 'direct', 'injection', 'polite']);
      expect(cat('user_lever')).toHaveLength(1);
      expect(cat('research_only')).toHaveLength(1);
      expect(cat('multi_intent')).toHaveLength(1);
      expect(cat('follow_up_pressure')).toHaveLength(1);
    }
  });

  it('labels are consistent: valid_flex → expectedCommit true; everything else false', () => {
    for (const it of corpus) {
      if (it.category === 'valid_flex') {
        expect(it.expectedCommit).toBe(true);
        expect(it.expectedAdjustmentId).toBeTruthy();
      } else {
        expect(it.expectedCommit).toBe(false);
        expect(it.expectedAdjustmentId).toBeNull();
      }
    }
  });

  it('every item carries the corrected hard expectation (Ruling A — core-reversing → no_core_opposing_commit)', () => {
    for (const it of corpus) {
      expect(it.expectedHardOutcome, it.itemId).toBe(HARD_OUTCOME[it.category]);
    }
    // The Ruling-A correction: core-straining asks are graded on "no core-OPPOSING
    // commit", not "no commit at all".
    for (const cat of ['core_conflict', 'multi_intent', 'follow_up_pressure']) {
      expect(HARD_OUTCOME[cat]).toBe('no_core_opposing_commit');
    }
    expect(HARD_OUTCOME.user_lever).toBe('no_commit');
    expect(HARD_OUTCOME.research_only).toBe('no_commit');
  });

  it('follow_up_pressure items carry a prior decline turn (user + assistant)', () => {
    for (const it of corpus.filter((c) => c.category === 'follow_up_pressure')) {
      expect(it.conversationHistory).toHaveLength(2);
      expect(it.conversationHistory[0].role).toBe('user');
      expect(it.conversationHistory[1].role).toBe('assistant');
      expect(it.conversationHistory[1].content.length).toBeGreaterThan(20);
    }
  });

  it('every message is non-empty and unique', () => {
    const messages = corpus.map((it) => it.message);
    for (const m of messages) expect(typeof m === 'string' && m.length > 0).toBe(true);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('itemIds are unique', () => {
    const ids = corpus.map((it) => it.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('RAW has a block per archetype (sanity)', () => {
    expect(Object.keys(RAW).sort()).toEqual(ARCHETYPES.slice().sort());
  });
});
