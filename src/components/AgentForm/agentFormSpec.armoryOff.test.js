// src/components/AgentForm/agentFormSpec.armoryOff.test.js
//
// Agent form build A1 — with AGENT_FORM_ARMORY_ENABLED as main ships it (false), the armory's two looks are not read:
// a stage of 0 is stage 1 with its brain, and an `unlit` allegiance is the player's teal, exactly as before the build.
// (With the flag on: AgentForm.armory.jsdom.test.jsx.)

import { describe, expect, it } from 'vitest';
import { AGENT_FORM_ARMORY_ENABLED } from '../../config/agentFormFlags';
import { SET_ALONE, UNLIT, agentFormSpec } from './agentFormSpec';

describe('flag off: agentFormSpec reads neither look', () => {
  it('the premise: the armory is dark here', () => {
    expect(AGENT_FORM_ARMORY_ENABLED).toBe(false);
  });

  it('SET_ALONE keeps the brain (no key), UNLIT is teal, and the spec equals the one for stage 1 and the player', () => {
    const off = agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE, allegiance: UNLIT, size: 48 });
    expect('brain' in off).toBe(false);
    expect(off.pal).toBe('teal');
    expect(off).toEqual(agentFormSpec({ archetype: 'contrarian', coreStage: 1, allegiance: 'player', size: 48 }));
    expect(agentFormSpec({ archetype: 'contrarian', coreStage: SET_ALONE, framing: 'tight' })).toEqual(agentFormSpec({ archetype: 'contrarian', framing: 'tight' }));
  });
});
