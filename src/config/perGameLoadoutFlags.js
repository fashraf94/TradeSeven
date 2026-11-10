// src/config/perGameLoadoutFlags.js
//
// Build A2's flag (per-game loadouts; Phase 0 armory report docs/audits/20261102_PHASE0_ARMORY.md §9 A2; build report
// docs/audits/20261106_BUILD_ARMORY_A2.md). A flag-source module of its own, registered in flagPinGuard.test.js's
// FLAG_SOURCE_MODULES, and NOT a line in featureFlags.js, for the reason agentFormFlags.js and
// activationEvidenceFlags.js give: App.jsx dynamically imports featureFlags, so Rollup keeps that module's whole
// namespace in the entry chunk and any new export there changes the entry's bytes. Read by both sides: the server's
// loadout writers and readers (api/agent/change-archetype.js, equip-watchlist.js, unequip-watchlist.js,
// api/_utils/casualClone.js, trainingClone.js, api/tournament/lobby-quickplay-training.js,
// api/_utils/filmRoom/cardStore.js) and the client's surfaces. No imports.

/**
 * PER_GAME_LOADOUT_ENABLED — a loadout per kind of game (founder ruling D1): BaggerBomb, deployed from the Command
 * Center on the casual clone, and League (ranked; training pods wear it).
 *
 * When TRUE:
 *   - the BaggerBomb loadout is its own slot on the ranked agent, `agents/{rankedId}.loadouts.baggerbomb`
 *     ({ archetype, book: { ref: { watchlistId } | null, name, pin: null } }), written by the three loadout writers
 *     with `loadout: 'baggerbomb'`; it changes at any time and reaches the next deploy only (FD-1). Absent, it is the
 *     ranked record's own fields (FD-11), and the first loadout write of either kind snapshots it from them;
 *   - the League loadout is the ranked record's own fields (FD-2), frozen while the player has a ranked group before
 *     COMPLETE, EXPIRED or VOIDED (FD-3; src/constants/perGameLoadout.js leagueLockOf);
 *   - the casual clone's resync applies the BaggerBomb loadout; training reads the League loadout and the chooser's
 *     override is gone (FD-4); the plays ledger shelves against both loadouts' archetypes;
 *   - with AGENT_FORM_ARMORY_ENABLED also on, the hub draws the two loadout cards, the Deploy card's line and the
 *     armory's context, and the League lobby its line.
 *
 * LIVE — TRUE since the armory flip, with AGENT_FORM_ARMORY_ENABLED in the same commit (founder rulings FL1 and FL2,
 * Nov 7, 2026), and both stay as kill switches. The rollback is two steps: PER_GAME_LOADOUT_ENABLED alone back to
 * false returns A1's armory with one loadout; both back to false returns the app as it was before the flip. The armory
 * never goes off while per-game loadouts are on (the pin row). A rollback moves a flag and its pin; the DARK_BY_DESIGN
 * entry stays out. Off, the server behaves as before A2 (the `loadout` field is ignored) and every client read is a
 * literal ternary that Rollup folds.
 *
 * Per-game loadouts never run without casual clones (FL3, pinned in perGameLoadoutFlags.test.js): with
 * CASUAL_CLONE_CONCURRENCY_ENABLED off, every BaggerBomb deploy runs on the ranked record in the League loadout.
 */
// Pinned by: perGameLoadoutFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const PER_GAME_LOADOUT_ENABLED = true;
