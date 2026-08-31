// src/screens/agentBattleTabs.js
//
// The battle-view tab identity, in its own module so it can be tested against
// the REAL flag rather than re-implemented in a test.
//
// key 'command' is legacy; the display name is Huddle (PASS1 spec §10).
// Deliberately not renamed: the key is not user-visible, not persisted (no
// localStorage, no Firestore field, no analytics event — and this app has no
// router at all), and it is compared against in four places in
// AgentBattleScreen.jsx. Renaming it churns all four for zero user value.

import { COMMAND_CENTER_SYNC_ENABLED } from '../config/featureFlags';

export const TAB_KEYS = ['matchups', 'command', 'gametape'];

/**
 * D-15: the in-battle tab is "Huddle" — it communicates conversation rather
 * than command authority, and "Command Center" now names the Dashboard, which
 * Pass 1 makes the surface that actually holds the agent's situation. One name
 * for two places was the confusion worth removing.
 *
 * Behind COMMAND_CENTER_SYNC_ENABLED so flag-off keeps the old label: the
 * rename and the surface it describes ship together or neither ships.
 *
 * A FUNCTION, not a const object: a module-scope object would bake the dark
 * value in at import, which is both the hermetic-mock hazard and untestable in
 * both states from one run.
 */
export function tabLabels() {
  return {
    matchups: 'Matchups',
    command: COMMAND_CENTER_SYNC_ENABLED ? 'Huddle' : 'Command Center',
    gametape: 'Game Tape',
  };
}
