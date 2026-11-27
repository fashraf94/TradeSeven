// src/config/commandCenterPortfolioFlags.js
//
// The portfolio hub's switch (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md, ruling PH-20; Phase 0
// docs/audits/20261125_PHASE0_COMMAND_CENTER_PORTFOLIO_HUB.md §2.4).
//
// A FLAG-SOURCE MODULE OF ITS OWN, NOT A LINE IN featureFlags.js. The hub chunk reads it as a literal at each of its sites,
// so with it false Rollup folds every read away and the hub's modules build as they did before it existed; a zero-import
// module of its own keeps that fold possible and keeps the flag out of the entry chunk. No imports.

/**
 * COMMAND_CENTER_PORTFOLIO_HUB_ENABLED — for a player with an idea book, the Command Center becomes the portfolio (spec §0).
 *
 * OFF (ships false, ruling PH-20): every player sees today's hub, and the hub makes no read of its own of the idea book (the
 * entry card reads for itself, as before). With it true the hub's connected shell reads the book once, decides the layout
 * from that read (hub/hubLayout.js: 'book' only for a ready read with a book; every other case is 'today') and hands the
 * same read to the entry card. It also needs PRACTICE_FIELD_SCREEN_ENABLED on, as the book's route does.
 * Runway: six slices merge dark (spec §4, §8); then its own flip PR, after the cumulative review, the phone timing and the
 * founder's walk of the preview. In one commit (BUILD_RULES §2): this literal and the OFF above; the value row in
 * commandCenterPortfolioFlags.test.js, and its guard row turned around (the entry is gone); and the DARK_BY_DESIGN entry in
 * flagPinGuard.test.js removed. Rollback: the literal and its value row back to false.
 */
// Pinned by: commandCenterPortfolioFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = false;
