// src/components/CommandCenter/hub/hubFlags.js
//
// Command Center hub, slice S5 — the three shipped flags the Loadout reads,
// read at render in one place and handed to the pure selectors as plain
// booleans (hub/selectors/loadout.js takes every input as an argument). Each is
// the flag the shells themselves read, so the hub and the shells agree:
//   concurrencyEnabled  CASUAL_CLONE_CONCURRENCY_ENABLED — EquipStation's and
//                       the Command dashboards' `deriveDeployGate` input;
//   hypothesisRecordsOn HYPOTHESIS_RECORDS_ENABLED through its accessor — the
//                       one gate over the idea records (featureFlags.js);
//   characterTab        RELEASE3_CHARACTER_TAB_ENABLED — whether the Forge's
//                       `traits` area is labelled "Character" (ForgeWorkshop.jsx
//                       navItems); the hub names that door after the tab.
// Anything but exactly `true` reads false.

//
// Slice S2b (ruling R-S2b-7) reads one more, the Scouting Board's
// SCOUTING_BOARD_ENABLED, as `scoutingBoard`: whether the hub offers "See what
// it's eyeing" and mounts the shipped sheet, as the shells do. The Loadout's
// selectors never receive it (the hub root reads it apart).

import {
  CASUAL_CLONE_CONCURRENCY_ENABLED,
  RELEASE3_CHARACTER_TAB_ENABLED,
  SCOUTING_BOARD_ENABLED,
  isHypothesisRecordsOn,
} from '../../../config/featureFlags';
// Shared Research (Command Center Amendment E V1.1 §1; ruling R-D4): the research door's mode, from its own flag module
// (not featureFlags.js, for the entry chunk's sake), on its own import line.
import { SHARED_RESEARCH_MODE, SHARED_RESEARCH_MODES } from '../../../config/sharedResearchFlags';

export function hubFlags() {
  return {
    concurrencyEnabled: CASUAL_CLONE_CONCURRENCY_ENABLED === true,
    hypothesisRecordsOn: isHypothesisRecordsOn() === true,
    characterTab: RELEASE3_CHARACTER_TAB_ENABLED === true,
  };
}

/**
 * Amendment E V1.1 §1 (ruling R-D4): SHARED_RESEARCH_MODE, read at CALL time — never held at module scope — so a mock of
 * the flag module reaches every read. Any value outside SHARED_RESEARCH_MODES reads 'off' (the server's own
 * sharedResearchMode() rule, api/_utils/sharedResearch/gate.js). ConnectedHub hands the result to the admission hook
 * (src/hooks/useHubResearchAdmission.js), which may not import from this directory.
 */
export function sharedResearchMode() {
  const modes = SHARED_RESEARCH_MODES;
  const mode = SHARED_RESEARCH_MODE;
  return Array.isArray(modes) && modes.includes(mode) ? mode : 'off';
}

/** Slice S2b: the Scouting Board's flag, as the shells read it (anything but exactly `true` reads false). */
export function scoutingBoardOn() {
  return SCOUTING_BOARD_ENABLED === true;
}

/**
 * Slice S7 (ruling R-S7-6; spec V1.2 §10): which Shadow the PHONE draws — 'canvas' (the moving one) or 'still'
 * (hub/shadowGeometry.js at rest). The device validation decides it: if the phone check misses its targets
 * (60 fps, scripting ≤ 6 ms a frame, dropped frames ≤ 2%), the fix is this one value, 'still', with the device and
 * run recorded — never a redesign of the sky or of Shadow. Tablet, desktop and stacked ignore it. Pinned by
 * hubFlags.test.js.
 */
export const PHONE_SHADOW = 'canvas';

/**
 * Agent form build S1 (founder ruling R1): the rate the PHONE draws the armored agent at, while
 * AGENT_FORM_HUB_ENABLED is on — 'live' (every frame), 'half' (every other frame, on purpose) or 'still' (the
 * form's designed still). 'live' is the founder's iPhone 16 lab reading (build S0 report §8: every preset passed).
 * The other two stay reachable through this one value; the hub never picks a rate from a measured frame cost
 * (ruling R-S7-2). Tablet, desktop and stacked draw 'live'. Pinned by hubFlags.test.js.
 */
export const AGENT_FORM_PHONE = 'live';
