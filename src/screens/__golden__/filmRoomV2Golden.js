// src/screens/__golden__/filmRoomV2Golden.js
//
// Film Room B2 — what the v2 goldens' capture harness
// (captureFilmRoomV2Golden.jsdom.test.jsx) and their comparison suite
// (src/screens/filmRoomV2/FilmRoomScreenV2.cardsOff.golden.jsdom.test.jsx)
// share: the days, the depths, the file names and the one normalisation.
// A plain module, so the comparison suite imports no test file.

/** React 19's useId values come from a process-wide counter: renumber by first appearance (the B1 writer suite's rule). */
export function renumberIds(html) {
  const ids = {};
  let n = 0;
  return html.replace(/_r_[0-9a-z]+_/g, (id) => { if (!(id in ids)) { ids[id] = `_r_${n}_`; n += 1; } return ids[id]; });
}

/** The fixture days photographed: their names (the fixtures themselves come from the harness). */
export const GOLDEN_DAY_NAMES = Object.freeze(['sep23', 'empty']);
/** The depths photographed: the tab's label and its id. */
export const GOLDEN_DEPTHS = Object.freeze([['Glance', 'glance'], ['Study', 'study'], ['Deep dive', 'deep']]);
/** The layouts photographed. */
export const GOLDEN_LAYOUTS = Object.freeze(['phone', 'desktop']);
/** A golden's file name. */
export const goldenName = (day, depth, layout) => `filmRoomV2.${day}.${depth}.${layout}.html`;
