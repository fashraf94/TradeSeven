// src/config/agentFormFlags.js
//
// The agent identity program's flags (Phase 0 report
// docs/audits/20261028_PHASE0_AGENT_IDENTITY.md §12). A flag-source module of
// its own, registered in flagPinGuard.test.js's FLAG_SOURCE_MODULES, and NOT a
// line in featureFlags.js on purpose: App.jsx dynamically imports featureFlags
// (`await import('./config/featureFlags')`, the Desk's sync read), so Rollup
// keeps that module's whole namespace object in the entry chunk and any new
// export there changes the entry's bytes. A flag here that nothing live reads
// folds away, and the entry chunk stays byte-identical (build S0's check).

/**
 * AGENT_FORM_LAB_ENABLED — the agent form lab (build S0; build report
 * docs/audits/20261029_BUILD_AGENT_FORM_S0.md).
 *
 * When TRUE, `?agentFormLab=1` opens src/screens/AgentFormLab.jsx full screen:
 * the ported WebGL agent forms (src/components/AgentForm/) with the controls
 * and the frame readout the founder's iPhone decides the budget on (live, half
 * rate or stills; which bloom works on iOS).
 *
 * DARK — default FALSE, and it STAYS false on main. It is flipped only on a
 * never-merge smoke branch ("SMOKE ONLY, NEVER MERGE") for the Vercel
 * preview. When FALSE (the shipped state) App.jsx folds all of it away: the
 * lab's lazy declaration is `null`, the URL is never read and the screen never
 * renders, so the production bundle carries no lab chunk and no three.js.
 * App reads the literal directly, never through an accessor: Rollup folds a
 * literal `false` through the ternary and the `&&` (the S8 R-S8F-1 precedent).
 *
 * Nothing in the hub, the battle view or the picker reads it.
 */
// Pinned by: agentFormLabFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const AGENT_FORM_LAB_ENABLED = false;

/**
 * AGENT_FORM_HUB_ENABLED — the armored agent as the Command Center hero
 * (build S1, Scope A; build report docs/audits/20261029_BUILD_AGENT_FORM_S1.md).
 *
 * When TRUE, the hub's stage draws the agent form (src/components/AgentForm/,
 * through src/components/CommandCenter/HubAgentForm.jsx) in Shadow's box at
 * both mount sites (ShadowStage.jsx, the wide stage and PhoneStage): Shadow
 * wearing the equipped archetype's armor, suiting up once when the archetype
 * changes while the hub is mounted.
 *
 * LIVE — TRUE since the flags-on build (founder ruling F1, Oct 30, 2026), and it
 * stays as the hub's kill switch (F2): set it FALSE and the stage draws
 * ShadowCanvas again, because each read of this flag is a literal ternary that
 * Rollup folds to that element.
 */
// Pinned by: agentFormFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const AGENT_FORM_HUB_ENABLED = true;

/**
 * AGENT_FORM_BATTLE_ENABLED — the agent forms in a BaggerBomb 1v1 battle
 * (build S1, Scope B).
 *
 * When TRUE, inside the existing character-pane gates, the arena header, the
 * character pane's header and the floating mark draw the agent form in place
 * of the robot head, with moods from real signals (battleView/agentMood.js),
 * and the header's CPU side draws the opponent as a bare copper core, mirrored.
 *
 * LIVE — TRUE since the flags-on build (founder ruling F1, Oct 30, 2026), and it
 * stays as the battle view's kill switch (F2): set it FALSE and the header, the
 * pane and the mark draw the robot head again, each read folding to that element.
 */
// Pinned by: agentFormFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const AGENT_FORM_BATTLE_ENABLED = true;

/**
 * AGENT_FORM_LEAGUE_ENABLED — the agent forms in a League game, ranked and
 * training (build S2; build report docs/audits/20261030_BUILD_AGENT_FORM_S2.md).
 *
 * When TRUE, the League's two head sites (the fuse hero's tips and the climb's
 * seats) draw the agent form in place of the robot head: the player teal, every
 * opponent copper in their own archetype's armor (a bare core when it is not
 * known), with moods from the standing the screen already shows.
 *
 * LIVE — TRUE since the flags-on build (founder ruling F1, Oct 30, 2026), and it
 * stays as the League's kill switch (F2): set it FALSE and both sites draw the
 * robot head again, each read a literal ternary that Rollup folds to that element.
 */
// Pinned by: agentFormFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const AGENT_FORM_LEAGUE_ENABLED = true;

/**
 * AGENT_FORM_ARMORY_ENABLED — the armory in place of the archetype picker (build A1; Phase 0 report
 * docs/audits/20261102_PHASE0_ARMORY.md §7, §9 A1; build report docs/audits/20261104_BUILD_ARMORY_A1.md).
 *
 * When TRUE, the hub's Change archetype opens the armory (src/components/CommandCenter/Armory.jsx): Shadow in the
 * centre wearing the previewed set, the six sets around it, and Equip, which is today's changeArchetype write. On the
 * wide compositions it is board 6's dialog over the paused hero; on the phone it opens in the hero's own box
 * (founder ruling FD-8). The old ArchetypePicker stays for the League chooser and the fallback shells.
 *
 * LIVE — TRUE since the armory flip, with PER_GAME_LOADOUT_ENABLED in the same commit (founder rulings FL1 and FL2,
 * Nov 7, 2026), and both stay as kill switches. The rollback is two steps: PER_GAME_LOADOUT_ENABLED alone back to
 * false returns A1's armory with one loadout; both back to false returns the app as it was before the flip. The armory
 * never goes off while per-game loadouts are on (the pin row). A rollback moves a flag and its pin; the DARK_BY_DESIGN
 * entry stays out. Every read is a literal ternary (or `FLAG && …`) that Rollup folds, so with it FALSE the hub chunk,
 * the agent form wrapper and every other chunk are what they were before A1.
 */
// Pinned by: agentFormFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
export const AGENT_FORM_ARMORY_ENABLED = true;
