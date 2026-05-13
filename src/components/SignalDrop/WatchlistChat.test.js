// src/components/SignalDrop/WatchlistChat.test.js
//
// Sprint 6 Phase 3.7 — pure-function tests for the chip intent helpers
// exported by WatchlistChat.jsx. Mirrors the SectorRail / AgentChat pattern
// (mock module-load side effects, import named exports, test them) since
// this repo doesn't ship a jsdom + React Testing Library setup.

import { describe, it, expect, vi } from 'vitest';

// Neutralize module-load side effects so we can import the named pure
// helpers without booting Firebase. WatchlistChat.jsx imports
// fetchWithAuth, which pulls in firebase/auth via authService.
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}));
vi.mock('../../firebase/config', () => ({
  auth: {},
  db: {},
  default: {},
}));
vi.mock('../../firebase/authService', () => ({
  getIdToken: vi.fn(async () => null),
}));

import {
  chipIntentToPhaseRequest,
  normalizeChipForRender,
  buildSaveRequest,
} from './WatchlistChat';

describe('chipIntentToPhaseRequest', () => {
  it("returns 'advance' for intent='advance'", () => {
    expect(chipIntentToPhaseRequest('advance')).toBe('advance');
  });

  it("returns 'finalize' for intent='finalize'", () => {
    expect(chipIntentToPhaseRequest('finalize')).toBe('finalize');
  });

  it("returns null for intent='none' (no-op chip — sends as normal message)", () => {
    expect(chipIntentToPhaseRequest('none')).toBeNull();
  });

  it('returns null for undefined intent (defensive default)', () => {
    expect(chipIntentToPhaseRequest(undefined)).toBeNull();
  });

  it('returns null for an unknown intent value', () => {
    expect(chipIntentToPhaseRequest('reset')).toBeNull();
    expect(chipIntentToPhaseRequest('garbage')).toBeNull();
  });

  it('returns null for non-string intent values', () => {
    expect(chipIntentToPhaseRequest(null)).toBeNull();
    expect(chipIntentToPhaseRequest(42)).toBeNull();
    expect(chipIntentToPhaseRequest({})).toBeNull();
    expect(chipIntentToPhaseRequest([])).toBeNull();
  });
});

describe('normalizeChipForRender', () => {
  it('passes a fully-shaped object chip through unchanged (after trim)', () => {
    expect(normalizeChipForRender({ label: 'Show me candidates', intent: 'advance' })).toEqual({
      label: 'Show me candidates',
      intent: 'advance',
    });
    expect(normalizeChipForRender({ label: 'Ship it', intent: 'finalize' })).toEqual({
      label: 'Ship it',
      intent: 'finalize',
    });
    expect(normalizeChipForRender({ label: 'Tell me more', intent: 'none' })).toEqual({
      label: 'Tell me more',
      intent: 'none',
    });
  });

  it("coerces missing intent to 'none'", () => {
    expect(normalizeChipForRender({ label: 'Ship it' })).toEqual({
      label: 'Ship it',
      intent: 'none',
    });
  });

  it("coerces invalid intent values to 'none'", () => {
    expect(normalizeChipForRender({ label: 'X', intent: 'reset' })).toEqual({
      label: 'X',
      intent: 'none',
    });
    expect(normalizeChipForRender({ label: 'X', intent: 42 })).toEqual({
      label: 'X',
      intent: 'none',
    });
    expect(normalizeChipForRender({ label: 'X', intent: null })).toEqual({
      label: 'X',
      intent: 'none',
    });
    expect(normalizeChipForRender({ label: 'X', intent: '' })).toEqual({
      label: 'X',
      intent: 'none',
    });
  });

  it('returns null when label is missing / empty / non-string', () => {
    expect(normalizeChipForRender({ intent: 'advance' })).toBeNull();
    expect(normalizeChipForRender({ label: '', intent: 'advance' })).toBeNull();
    expect(normalizeChipForRender({ label: '   ', intent: 'advance' })).toBeNull();
    expect(normalizeChipForRender({ label: 42, intent: 'advance' })).toBeNull();
    expect(normalizeChipForRender({ label: null, intent: 'advance' })).toBeNull();
  });

  it("coerces a bare string entry to { label, intent: 'none' } (legacy shape)", () => {
    expect(normalizeChipForRender('legacy chip')).toEqual({
      label: 'legacy chip',
      intent: 'none',
    });
  });

  it('trims whitespace from string entries', () => {
    expect(normalizeChipForRender('  trimmed  ')).toEqual({
      label: 'trimmed',
      intent: 'none',
    });
  });

  it('returns null for empty / whitespace-only strings', () => {
    expect(normalizeChipForRender('')).toBeNull();
    expect(normalizeChipForRender('   ')).toBeNull();
  });

  it('returns null for non-object non-string entries (number, null, array)', () => {
    expect(normalizeChipForRender(null)).toBeNull();
    expect(normalizeChipForRender(undefined)).toBeNull();
    expect(normalizeChipForRender(42)).toBeNull();
    expect(normalizeChipForRender(['nested'])).toBeNull();
  });
});

describe('chipIntentToPhaseRequest + normalizeChipForRender (composed pipeline)', () => {
  // Models the FE chip-tap flow: chip arrives over the wire, gets
  // render-normalized, then on tap the intent is mapped to the phaseRequest
  // sent on the next POST.
  it("intent='advance' chip → tap sends phaseRequest='advance'", () => {
    const chip = normalizeChipForRender({ label: 'Show me candidates', intent: 'advance' });
    expect(chipIntentToPhaseRequest(chip.intent)).toBe('advance');
  });

  it("intent='finalize' chip → tap sends phaseRequest='finalize'", () => {
    const chip = normalizeChipForRender({ label: 'Ship it', intent: 'finalize' });
    expect(chipIntentToPhaseRequest(chip.intent)).toBe('finalize');
  });

  it("intent='none' chip → tap sends no phaseRequest (null)", () => {
    const chip = normalizeChipForRender({ label: 'Tell me more', intent: 'none' });
    expect(chipIntentToPhaseRequest(chip.intent)).toBeNull();
  });

  it("missing-intent chip is coerced to 'none' → tap sends no phaseRequest", () => {
    const chip = normalizeChipForRender({ label: 'Hmm' });
    expect(chip.intent).toBe('none');
    expect(chipIntentToPhaseRequest(chip.intent)).toBeNull();
  });

  it('legacy string chip is coerced safely → tap sends no phaseRequest', () => {
    const chip = normalizeChipForRender('Retry');
    expect(chip).toEqual({ label: 'Retry', intent: 'none' });
    expect(chipIntentToPhaseRequest(chip.intent)).toBeNull();
  });
});

// Phase 4A: buildSaveRequest is the request-shape helper extracted from
// handleFinalizeClose so the save-call payload is unit-testable without a
// jsdom + RTL setup. Mirrors the chipIntentToPhaseRequest extraction
// precedent.
describe('buildSaveRequest', () => {
  it('returns the request body when all three ids are present', () => {
    expect(buildSaveRequest('session-1', 'agent-1', 'drop-1')).toEqual({
      sessionId: 'session-1',
      agentId: 'agent-1',
      dropId: 'drop-1',
    });
  });

  it('returns null when sessionId is missing or empty', () => {
    expect(buildSaveRequest(null, 'agent-1', 'drop-1')).toBeNull();
    expect(buildSaveRequest(undefined, 'agent-1', 'drop-1')).toBeNull();
    expect(buildSaveRequest('', 'agent-1', 'drop-1')).toBeNull();
  });

  it('returns null when agentId is missing or empty', () => {
    expect(buildSaveRequest('session-1', null, 'drop-1')).toBeNull();
    expect(buildSaveRequest('session-1', undefined, 'drop-1')).toBeNull();
    expect(buildSaveRequest('session-1', '', 'drop-1')).toBeNull();
  });

  it('returns null when dropId is missing or empty', () => {
    expect(buildSaveRequest('session-1', 'agent-1', null)).toBeNull();
    expect(buildSaveRequest('session-1', 'agent-1', undefined)).toBeNull();
    expect(buildSaveRequest('session-1', 'agent-1', '')).toBeNull();
  });

  it('returns null for non-string inputs', () => {
    expect(buildSaveRequest(42, 'agent-1', 'drop-1')).toBeNull();
    expect(buildSaveRequest('session-1', {}, 'drop-1')).toBeNull();
    expect(buildSaveRequest('session-1', 'agent-1', [])).toBeNull();
  });

  it('does not leak extra properties from the call site', () => {
    // Defensive: even if the caller spreads in extra metadata, the
    // helper only returns the documented three-field shape.
    const result = buildSaveRequest('session-1', 'agent-1', 'drop-1');
    expect(Object.keys(result).sort()).toEqual(['agentId', 'dropId', 'sessionId']);
  });
});
