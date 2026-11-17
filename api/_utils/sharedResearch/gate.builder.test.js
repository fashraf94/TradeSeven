// api/_utils/sharedResearch/gate.builder.test.js
//
// Shared Research B3 — THE THESIS BUILDER'S SWITCH, read at call time (Amendment
// B §B2; K-2; routine choice 1). sharedResearchBuilderMode() answers 'on' only
// for the literal 'on'; any other value, a missing export and a read that throws
// answer 'off' — so a test file that mocks the flags module without the new name
// (every route test written before B3) runs every investigation as a ledger.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ value: 'off', throws: false, present: true }));
vi.mock('../../../src/config/sharedResearchFlags.js', () => ({
  SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']),
  SHARED_RESEARCH_MODE: 'on',
  get SHARED_RESEARCH_BUILDER_MODE() {
    if (state.throws) throw new Error('boom');
    if (!state.present) throw new Error('[vitest] No "SHARED_RESEARCH_BUILDER_MODE" export is defined on the mock');
    return state.value;
  },
}));

const { sharedResearchBuilderMode, sharedResearchMode } = await import('./gate.js');

beforeEach(() => Object.assign(state, { value: 'off', throws: false, present: true }));

describe('sharedResearchBuilderMode() (§B2)', () => {
  it.each([['on', 'on'], ['off', 'off'], ['ON', 'off'], ['allowlist', 'off'], ['', 'off'], [null, 'off'], [undefined, 'off'], [true, 'off']])('%j → %s', (value, want) => {
    state.value = value;
    expect(sharedResearchBuilderMode()).toBe(want);
  });
  it('a read that throws, or a mock without the export, answers off — never throws', () => {
    state.throws = true;
    expect(sharedResearchBuilderMode()).toBe('off');
    state.throws = false;
    state.present = false;
    expect(sharedResearchBuilderMode()).toBe('off');
  });
  it('is read at call time, not at module scope', () => {
    state.value = 'off';
    expect(sharedResearchBuilderMode()).toBe('off');
    state.value = 'on';
    expect(sharedResearchBuilderMode()).toBe('on');
  });
  it('does not move who may use Shared Research (SHARED_RESEARCH_MODE stays its own switch)', () => {
    state.value = 'on';
    expect(sharedResearchMode()).toBe('on');
    state.value = 'off';
    expect(sharedResearchMode()).toBe('on');
  });
});

describe('a mock that does not define the new name at all (how every pre-B3 route test mocks the module)', () => {
  it('reads off', async () => {
    vi.resetModules();
    vi.doMock('../../../src/config/sharedResearchFlags.js', () => ({ SHARED_RESEARCH_MODES: Object.freeze(['off', 'allowlist', 'on']), SHARED_RESEARCH_MODE: 'on' }));
    const fresh = await import('./gate.js');
    expect(fresh.sharedResearchBuilderMode()).toBe('off');
    vi.doUnmock('../../../src/config/sharedResearchFlags.js');
  });
});
