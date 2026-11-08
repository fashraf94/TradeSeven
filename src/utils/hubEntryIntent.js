// src/utils/hubEntryIntent.js
//
// The armory flip's LD-1 (founder ruling, Nov 8, 2026): the League tab's loadout door opens the Command Center on its
// Loadout tab, not the Overview. One-shot: only the visit the door starts opens there; every other way into the Command
// Center, and a later return, still opens on the Overview.
//
// App's door (the League lobby's `agentLoadout.openLoadout`, built only on the flag-on arm) marks the intent and goes to
// the dashboard; the hub's two shells take it in their tab's (area's) lazy initializer, on the flag-on arm only, and
// taking it clears it. So the next mount, whichever shell it is, finds nothing and opens where it always has. The phone
// maps it to its Loadout tab; desktop already opens on the Loadout area (hub/composition.js DEFAULT_AREA), and takes it
// only so a pending intent cannot outlive the visit.
//
// It lives outside src/components/CommandCenter/ because App may reach that directory only through the gate, the picker
// and the chrome predicates (commandCenterHub.mount.guard.test.js), and it holds a boolean, not the hub's tab constant,
// for the same reason. It imports nothing and reads no flag: with the flags off nothing calls it, and the build drops it.

let loadoutPending = false;

/** The League door: the next Command Center mount opens on the Loadout tab; then go to the dashboard. */
export function openCommandCenterOnLoadout(setScreen) {
  loadoutPending = true;
  setScreen('dashboard');
}

/** Read once by a hub shell's first render: does this visit open on Loadout? Taking it clears it (one-shot). */
export function takeLoadoutEntry() {
  const pending = loadoutPending;
  loadoutPending = false;
  return pending;
}
