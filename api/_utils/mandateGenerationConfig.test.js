// api/_utils/mandateGenerationConfig.test.js
import { describe, it, expect } from 'vitest';
import { getModelSeat, getCadenceTier, MANDATE_DEFAULT_MODEL_SEAT } from './mandateGenerationConfig.js';
import { listArchetypeIds } from './archetypeRegistry.js';
import { MANDATE_CADENCE_TIERS } from './mandateConfig.js';

const ARCHETYPES = listArchetypeIds();

describe('mandateGenerationConfig — model seat + cadence (FR-6 / D-44 / D-19)', () => {
  it('the default seat is a complete, well-formed model seat', () => {
    expect(MANDATE_DEFAULT_MODEL_SEAT.provider).toBe('anthropic');
    expect(typeof MANDATE_DEFAULT_MODEL_SEAT.model).toBe('string');
    expect(MANDATE_DEFAULT_MODEL_SEAT.model.length).toBeGreaterThan(0);
    expect(typeof MANDATE_DEFAULT_MODEL_SEAT.params.maxTokens).toBe('number');
  });

  it('every archetype resolves a complete model seat (provider + model + params)', () => {
    for (const id of ARCHETYPES) {
      const seat = getModelSeat(id);
      expect(seat, id).not.toBeNull();
      expect(seat.provider, id).toBeTruthy();
      expect(seat.model, id).toBeTruthy();
      expect(seat.params, id).toBeTruthy();
      expect(typeof seat.params.maxTokens, id).toBe('number');
    }
  });

  it('every archetype resolves a valid cadence tier (D-19)', () => {
    for (const id of ARCHETYPES) {
      const tier = getCadenceTier(id);
      expect(MANDATE_CADENCE_TIERS, id).toContain(tier);
    }
  });

  it('fails closed on an unknown archetype (returns null, does not throw)', () => {
    expect(getModelSeat('not_an_archetype')).toBeNull();
    expect(getCadenceTier('not_an_archetype')).toBeNull();
  });

  it('the returned seat is a fresh object (mutating it does not corrupt the default)', () => {
    const seat = getModelSeat(ARCHETYPES[0]);
    seat.params.maxTokens = 999999;
    expect(MANDATE_DEFAULT_MODEL_SEAT.params.maxTokens).not.toBe(999999);
  });
});
