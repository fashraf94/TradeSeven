// src/data/agentColorPalette.test.js
//
// Guards the onboarding color palette and the single-primary → gradient
// derivation (the value the future "color fusion" mechanic combines).

import { describe, it, expect } from 'vitest';
import {
  AGENT_COLOR_PALETTE, DEFAULT_AGENT_COLOR, DEFAULT_AGENT_COLOR_ID,
  getAgentColorById, deriveAvatarColors,
} from './agentColorPalette.js';

const HEX6 = /^#[0-9a-f]{6}$/i;

describe('agent color palette — integrity', () => {
  it('is a non-empty set of well-formed entries with unique ids', () => {
    expect(AGENT_COLOR_PALETTE.length).toBeGreaterThanOrEqual(4);
    const ids = AGENT_COLOR_PALETTE.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of AGENT_COLOR_PALETTE) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.primary).toMatch(HEX6);
    }
  });

  it('the default color id resolves to the default primary', () => {
    expect(getAgentColorById(DEFAULT_AGENT_COLOR_ID).primary).toBe(DEFAULT_AGENT_COLOR);
  });
});

describe('getAgentColorById', () => {
  it('returns the matching entry', () => {
    expect(getAgentColorById('teal').id).toBe('teal');
  });
  it('falls back to the first entry for an unknown id', () => {
    expect(getAgentColorById('not-a-color')).toBe(AGENT_COLOR_PALETTE[0]);
  });
});

describe('deriveAvatarColors', () => {
  it('returns a [primary, partner] pair of valid hex, primary preserved', () => {
    const [c1, c2] = deriveAvatarColors('#5eead4');
    expect(c1).toBe('#5eead4');
    expect(c2).toMatch(HEX6);
    expect(c2).not.toBe(c1); // the partner is a distinct second stop
  });

  it('derives a valid pair for every palette primary', () => {
    for (const c of AGENT_COLOR_PALETTE) {
      const pair = deriveAvatarColors(c.primary);
      expect(pair).toHaveLength(2);
      expect(pair[0]).toMatch(HEX6);
      expect(pair[1]).toMatch(HEX6);
    }
  });

  it('falls back to a valid pair for unparseable input', () => {
    const pair = deriveAvatarColors('not-a-hex');
    expect(pair).toHaveLength(2);
    expect(pair[0]).toMatch(HEX6);
    expect(pair[1]).toMatch(HEX6);
  });
});
