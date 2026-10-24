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

export function hubFlags() {
  return {
    concurrencyEnabled: CASUAL_CLONE_CONCURRENCY_ENABLED === true,
    hypothesisRecordsOn: isHypothesisRecordsOn() === true,
    characterTab: RELEASE3_CHARACTER_TAB_ENABLED === true,
  };
}

/** Slice S2b: the Scouting Board's flag, as the shells read it (anything but exactly `true` reads false). */
export function scoutingBoardOn() {
  return SCOUTING_BOARD_ENABLED === true;
}
