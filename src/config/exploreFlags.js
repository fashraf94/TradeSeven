// src/config/exploreFlags.js
//
// Explore Build 1 — the switch (spec of record
// docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §6; build prompt K-2).
// A flag-source module of its own, and NOT a line in featureFlags.js on purpose:
// App.jsx dynamically imports featureFlags (`await import('./config/featureFlags')`),
// so Rollup keeps that module's whole namespace in the entry chunk and any new
// export there changes the entry's bytes (the sharedResearchFlags.js precedent).
// It holds no `*_ENABLED` boolean, so the flag pin guard has nothing in it to
// scan; EXPLORE_MODE is noted by name in the guard's DARK_BY_DESIGN block instead.
//
// IMPORTS NOTHING. The nav (in the entry chunk) and the Search page read it.

/** The walked states of EXPLORE_MODE, in runway order. */
export const EXPLORE_MODES = Object.freeze(['off', 'allowlist', 'on']);

/**
 * EXPLORE_MODE — Explore, the front page of Search, and its door into Work an idea.
 *
 * A STRING TRI-STATE ('off' | 'allowlist' | 'on'), resolved at CALL time by
 * exploreMode() below, which maps any value outside EXPLORE_MODES to 'off'.
 * Never read at module scope.
 *
 *   'off'        nobody sees Explore: the Search page, its tabs, its heading and
 *                the nav are today's, the research read is never made and no
 *                Explore chunk is requested.
 *   'allowlist'  the page is today's until Explore's one research read answers;
 *                a player it admits (the server's own gate: the founder and FT_QA)
 *                gets the Explore tab in front, and the nav still says "Search".
 *   'on'         the Explore tab is first for everyone and the nav says "Explore";
 *                only players the read admits can start an investigation (FQ-4).
 *
 * RUNWAY: 'off' ships with Build 1 (dark). 'allowlist' is its own one-line
 * founder PR, after the two rules blocks and the stories index are deployed to
 * production and the AI-buildout collection is published with real companies and
 * real sources (spec §6, FQ-1); 'on' is another. Never a build PR; each step moves
 * the first row of exploreFlags.test.js in the same commit (BUILD_RULES §2). The 'on'
 * step also reconciles, in that commit, the three nav rows that list the Search
 * entry by its label "Search" (src/components/Navigation/leagueHide.nav.jsdom.test.jsx,
 * the ON and OFF label rows): pin EXPLORE_MODE in that suite's mocks, or move the label.
 * ROLLBACK: one step back at a time ('on' → 'allowlist' → 'off') by moving the literal and its pin together; at 'off' the page is today's and nothing of Explore loads.
 *
 * NOTHING THE AGENT SEES OR TRADES changes at any value: Explore reads stories and
 * the player's bookmarks, makes one research read, and opens the existing Work an
 * idea sheet, which does everything else.
 */
// Pinned by: exploreFlags.test.js (the pin and this value move together — BUILD_RULES §2).
export const EXPLORE_MODE = 'off';

/** The switch at call time: 'off' for any value outside EXPLORE_MODES. */
export function exploreMode() {
  return EXPLORE_MODE === 'allowlist' || EXPLORE_MODE === 'on' ? EXPLORE_MODE : 'off';
}

/**
 * EXPLORE_COMPARE_ROUTE — whether the research server runs the compare-and-narrow investigation for a broad question
 * (Explore Build 2, spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §6, ruling B-9; build prompt K-2,
 * K-14). A plain BOOLEAN, read at CALL time — the literal itself, compared with `true` inside a render, never at
 * module scope — so the production build folds it: no Explore chunk imports anything new from the entry chunk (a
 * reader function here would be a new entry export, and every chunk's import letters would move).
 *
 * IT CHANGES WORDS ONLY. false: the panel describes the investigation that exists — "Companies this question names",
 * the first step "checks the story against its source", no "Compares on", no "Then", and the word "compare" on no
 * screen. true: the compare wording of §6's right column. At either value the page shows no figure and orders nothing.
 *
 * RUNWAY: false ships with Build 2 (dark). THE COMPARE BUILD SETS IT — the build that makes the compare investigation
 * real on the research server sets it true in its own commit, with this file's pin (exploreFlags.test.js) and this
 * docstring moved in the same commit (BUILD_RULES §2). Never Explore's own build PR.
 * ROLLBACK: back to false by moving the literal and its pin together; the panel then says only what exists.
 */
// Pinned by: exploreFlags.test.js (the pin and this value move together — BUILD_RULES §2).
export const EXPLORE_COMPARE_ROUTE = false;
