// src/components/CommandCenter/hub/hubCopy.js
//
// Command Center hub — the hub's strings (spec V1.2 §2: "copy in
// hub/hubCopy.js"; §11.3: all strings centralized). It travels in the lazy hub
// chunk, never the main one. S0 holds only the scaffold's placeholder; S1
// replaces it with the approved shell's copy.

export const HUB_COPY = Object.freeze({
  /** The region's accessible name. */
  regionLabel: 'Command Center',
  /** S0 scaffold only: the placeholder heading and line. */
  placeholderTitle: 'Command Center',
  placeholderBody: 'Placeholder. The hub is built in the slices after S0; nothing here reads or changes your games.',
});
