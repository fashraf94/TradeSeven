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
 * DARK — default FALSE on main. When FALSE (the shipped state) the stage draws
 * today's ShadowCanvas, and every hub chunk is byte-identical to main's: each
 * read of this flag is a literal ternary that Rollup folds to today's element.
 */
// Pinned by: agentFormFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
// SMOKE ONLY (claude/agent-form-s1-smoke, NEVER MERGE): on for the founder's preview.
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
 * DARK — default FALSE on main. When FALSE the battle view draws today's faces
 * and its chunks are byte-identical to main's but for build S1's one flag-off
 * fix (useAgentPresence.js reads agentContext.archetype).
 */
// Pinned by: agentFormFlags.test.js (flagPinGuard: this value and the pin move together — BUILD_RULES §2).
// SMOKE ONLY (claude/agent-form-s1-smoke, NEVER MERGE): on for the founder's preview.
export const AGENT_FORM_BATTLE_ENABLED = true;
