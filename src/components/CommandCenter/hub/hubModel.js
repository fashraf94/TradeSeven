// src/components/CommandCenter/hub/hubModel.js
//
// Command Center hub, slice S1 — the hub's section props, and the one value S1
// passes: every section in the state spec V1.2 §3 defines for "no result has
// resolved".
//
// Every section is presentational and takes its data as a prop in the shape
// the spec names (§3, §7, §8: `{ status: 'loading' | 'ready' | 'error', … }`),
// so S3–S6 replace a value here with a reader's result without touching the
// layout. S1 has no reader, so nothing here is ever fabricated: no row, no
// count, no timer, no resolution. The layout fixtures
// (../__fixtures__/hubLayoutFixtures.js) fill the same shapes for tests only.
//
//   nextAction  { status, candidate: null | { key: 'openGame'|'review'|'deploy',
//                 title, why, detail?, cta } }                         §8.2
//   games       { status, rows: [{ id, mode, opponent, live, clock?, preOpen?,
//                 detail, outcome?: { text, tone: 'pos'|'neg'|'neutral' },
//                 review?: boolean }] }                                §3, §7
//   deploy      { displayState, canStart, reason? }                    §3.1 (S2a)
//   loadout     { status, archetype?: { name, approach },
//                 watchlist?: { name, symbols }, summary? }            §2 (S5)
//   research    { status }                                             §8.1 (S6)
//   activity    { status, rows: [{ id, kind, text, sub, at }] }        §8.2 (S4)
//   brief       { status, caption?, body? }                            §8.3 (S4)
//   career      { status, record? }                                    §7 (S5)
//
// Partnership takes no prop: it is the reserved panel (§8.3), with no read.

export const HUB_S1_SECTIONS = Object.freeze({
  nextAction: Object.freeze({ status: 'loading', candidate: null }),
  games: Object.freeze({ status: 'loading', rows: Object.freeze([]) }),
  deploy: Object.freeze({ displayState: 'checking', canStart: false }),
  loadout: Object.freeze({ status: 'loading' }),
  research: Object.freeze({ status: 'loading' }),
  activity: Object.freeze({ status: 'loading', rows: Object.freeze([]) }),
  brief: Object.freeze({ status: 'loading' }),
  career: Object.freeze({ status: 'loading' }),
});

/** The rows a section may show, empty unless its read has resolved. */
export const readyRows = (section) => (section?.status === 'ready' && Array.isArray(section.rows) ? section.rows : []);

/** Live rows first, then completed (the design's GamesSection order). */
export function splitGames(games) {
  const rows = readyRows(games);
  return { live: rows.filter((g) => g.live), completed: rows.filter((g) => !g.live) };
}

/** Desktop and tablet Games show live rows plus at most two completed rows (spec §8.2). */
export const DESKTOP_COMPLETED_LIMIT = 2;
/** The phone Overview shows a short activity list (the design's limit 3). */
export const PHONE_ACTIVITY_LIMIT = 3;
