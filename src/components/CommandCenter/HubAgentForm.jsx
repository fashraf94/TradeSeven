// src/components/CommandCenter/HubAgentForm.jsx
//
// Agent form build S1 (Scope A) — the armored agent as the hub's hero, behind AGENT_FORM_HUB_ENABLED
// (src/config/agentFormFlags.js). It takes ShadowCanvas's place at both stage sites (ShadowStage.jsx) and keeps
// the ONE SWAPPABLE COMPONENT contract (ShadowStill.jsx): a fixed `size × size` box, handed back through `boxRef`,
// so the connector, the area controls and the status line anchor to the box as before.
//
// What it draws (src/components/AgentForm/AgentForm.jsx):
//   - the archetype of the hub's own agent read (HubAgentFormContext; CommandCenterHub.jsx provides it around the
//     shells, from the read the Loadout shows), through the code-id table: anything unknown, the 'unknown'
//     sentinel and a missing value are bare Shadow;
//   - mood 'researching' while a hub-started deployment submits (the stage's 'processing' status), otherwise
//     'idle'. Nothing from a poll: the hub holds no live score;
//   - growth stage 1 (getAgentGrowth; ruling R7), the fixed teal of allegiance (R11), batched plates (R2), and the
//     CSS-blurred glow the founder chose in S0, clipped at the box (R3: the connector leaves from its edge);
//   - its rate: the phone's AGENT_FORM_PHONE, 'live' on every wider stage, and a still under 40 px (R12, in the
//     wrapper). Nothing measured picks it (R-S7-2; ruling R6d).
// The suit-up plays only for a change between two READY reads of the SAME agent: the form is keyed by the read,
// so the first answer, an account or agent switch and a remount (a width change, a return to the hub) draw the
// form at once; the engine never plays a change at mount. Reduced motion (the hub's one source, R-S7-1) draws the
// still, and a change under it redraws the still. Paused while the deploy ceremony covers the page (R-S7-5). Its
// accessible name is "Shadow wearing <archetype>" (R10), the name from hub/archetypeLines.js, with the state and
// selected area the stage's labels have always carried (spec V1.2 §10); bare Shadow keeps Shadow's own label.

import React, { createContext, useContext, useState } from 'react';
import AgentForm from '../AgentForm/AgentForm';
import { formForArchetype, hasWebGL } from '../AgentForm/agentFormSpec';
import { getAgentGrowth } from '../AgentForm/agentGrowth';
import { archetypeLines } from './hub/archetypeLines';
import { AGENT_FORM_COPY, HUB_COPY as COPY } from './hub/hubCopy';
import { AGENT_FORM_PHONE } from './hub/hubFlags';

/** The hub's agent read ({ status, agent }), from CommandCenterHub.jsx; absent, the form is bare Shadow. */
export const HubAgentFormContext = /* @__PURE__ */ createContext(null);

/** The rate the hero draws at: the phone's one constant, 'live' on every wider stage (rulings R1, R6d). */
export function hubFormRate(phone) {
  return phone ? AGENT_FORM_PHONE : 'live';
}

/** What the form shows of the read: the archetype once the read is ready, and the key its suit-ups are kept under. */
export function hubFormRead(read) {
  if (!read || read.status !== 'ready') return { archetype: undefined, key: 'pending' };
  const agent = read.agent && typeof read.agent === 'object' ? read.agent : null;
  return { archetype: agent ? agent.archetype : undefined, key: `agent:${agent && agent.id != null ? agent.id : 'none'}` };
}

export default function HubAgentForm({ size, status = 'ambient', selectedArea = null, reducedMotion = false, paused = false, phone = false, boxRef }) {
  const { archetype, key } = hubFormRead(useContext(HubAgentFormContext));
  const [formStatus, setFormStatus] = useState(() => (hasWebGL() ? 'loading' : 'unavailable'));
  const rate = hubFormRate(phone);
  const processing = status === 'processing';
  const { coreStage, armorStage } = getAgentGrowth(null);
  const still = reducedMotion || rate === 'still' || formStatus !== 'live';
  const state = COPY.shadow.states[still ? 'still' : processing ? 'processing' : 'ambient'];
  const sel = selectedArea === 0 || selectedArea === 1 || selectedArea === 2 ? selectedArea : null;
  const areaName = sel == null ? null : COPY.areas.names[sel];
  const armored = formForArchetype(archetype) !== 'none';
  const label = armored ? AGENT_FORM_COPY.imageLabel(archetypeLines(archetype).name, state, areaName) : COPY.shadow.imageLabel(state, areaName);
  return (
    <div ref={boxRef} data-shadow-box="" data-hub-agent-form="" data-shadow-status={state} style={{ width: size, height: size, flexShrink: 0 }}>
      <AgentForm
        key={key}
        archetype={archetype}
        mood={processing ? 'researching' : 'idle'}
        coreStage={coreStage}
        armorStage={armorStage}
        allegiance="player"
        size={size}
        reducedMotion={reducedMotion}
        bloom="css"
        batched
        rate={rate}
        paused={paused}
        clip
        equipOnChange
        label={label}
        onStatus={setFormStatus}
      />
    </div>
  );
}
