// api/_utils/sharedResearch/gate.surface.test.js
//
// Shared Research B1 — THE DEPENDENCY-SURFACE GUARD for the gate (BUILD_RULES §4;
// review D2). gate.js imports src/config/sharedResearchFlags.js; every other test
// that loads the gate mocks that module, so THIS file imports the gate with its
// real graph — the import itself is the guard (it explodes in the Node test env
// if a browser dependency enters the graph). Never mock anything here.

import { describe, it, expect } from 'vitest';
import { sharedResearchMode, sharedResearchOnFor } from './gate.js';
import { SHARED_RESEARCH_MODE } from '../../../src/config/sharedResearchFlags.js';

describe('the unmocked graph (the dependency-surface guard)', () => {
  it('loads, and resolves the shipped mode', () => {
    expect(sharedResearchMode()).toBe(SHARED_RESEARCH_MODE);
  });
  it('at the shipped mode (\'off\') nobody is admitted', () => {
    if (SHARED_RESEARCH_MODE === 'off') expect(sharedResearchOnFor('any-uid')).toBe(false);
  });
});
