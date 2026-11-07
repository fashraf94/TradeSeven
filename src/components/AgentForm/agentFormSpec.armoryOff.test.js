// src/components/AgentForm/agentFormSpec.armoryOff.test.js
//
// Agent form build A1 — with AGENT_FORM_ARMORY_ENABLED off (as main ships it; held off here, so this file is no pin of
// the live value), the armory's two looks are not read: a stage of 0 is stage 1 with its brain, and an `unlit`
// allegiance is the player's teal, exactly as before the build. (With the flag on: AgentForm.armory.jsdom.test.jsx.)

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/agentFormFlags', async (importOriginal) => ({ ...(await importOriginal()), AGENT_FORM_ARMORY_ENABLED: false }));

import { SET_ALONE, UNLIT, agentFormSpec } from './agentFormSpec';

describe('flag off: agentFormSpec reads neither look', () => {
  it('SET_ALONE keeps the brain (no key), UNLIT is teal, and the spec equals the one for stage 1 and the player', () => {
    const off = agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE, allegiance: UNLIT, size: 48 });
    expect('brain' in off).toBe(false);
    expect(off.pal).toBe('teal');
    expect(off).toEqual(agentFormSpec({ archetype: 'contrarian', coreStage: 1, allegiance: 'player', size: 48 }));
    expect(agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE, framing: 'tight' })).toEqual(agentFormSpec({ archetype: 'contrarian', framing: 'tight' }));
  });
});
