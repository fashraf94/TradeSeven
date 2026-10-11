// src/screens/filmRoomV2/filmRoomBack.js
//
// "BACK GOES BACK" (the follow-up pass before 'on'). The Film Room's back
// control returns to the surface the Film Room was opened from, and its label
// names that destination. App records the screen the 'filmRoom' route was
// entered from (src/App.jsx: the screen it showed before); this maps it:
//   'battle'         the in-battle banner (AgentBattleScreen's Film Room
//                    banner, inside the battle view) → back to that battle
//   'battleHistory'  Battle History → back to Battle History
//   'dashboard'      the dashboard's Review station (the dashboard's one
//                    Film Room entry) → back to the dashboard
//   anything else    the origin is unknown → the dashboard, "Dashboard"
// The legacy screen keeps its own back (App's onBack, unchanged): only v2
// reads this.

/** The screens the Film Room is opened from, by the App screen id each one is. */
export const FILM_ROOM_ORIGINS = Object.freeze(['battle', 'battleHistory', 'dashboard']);

/**
 * Where back goes from a Film Room opened from `fromScreen` (an App screen id, or null): `{ origin, screen }` —
 * `origin` names the label (one of FILM_ROOM_ORIGINS, or 'unknown'), `screen` the App screen to return to.
 */
export function filmRoomBackOf(fromScreen) {
  if (FILM_ROOM_ORIGINS.includes(fromScreen)) return { origin: fromScreen, screen: fromScreen };
  return { origin: 'unknown', screen: 'dashboard' };
}
