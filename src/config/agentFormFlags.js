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
