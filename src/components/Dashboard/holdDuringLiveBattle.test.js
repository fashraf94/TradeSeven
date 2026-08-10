// src/components/Dashboard/holdDuringLiveBattle.test.js
//
// THE MID-BATTLE HOLD IS UNREACHABLE — and the intent tuning depends on it.
// Delight Layer arc, Task 4. Founder question at the Phase 2 SOFT STOP.
//
// Because deploy intent is `max(coreSpeed, curve)`, how quickly a hold becomes
// visible depends on the tier the sky is already in. That made the BATTLE LIVE
// crossover (~45% of the press) look like a live tuning concern in feel-pass
// round 1. It is not: with a battle live, EVERY deploy hold in the app is either
// unmounted or disabled, so a hold against a BATTLE LIVE sky cannot happen in
// production at all. INTENT_PEAK is therefore judged against RESTING alone.
//
// That conclusion is only safe while the two mechanisms below hold, and both are
// ordinary render decisions somebody could reasonably change without realising a
// tuning argument rests on them. Hence this guard.
//
//   MECHANISM A — UNMOUNTED. The Deploy section is gated out (taking DeployStation /
//   DeployCard and their holds with it) — flag-off whenever a battle is live, flag-on
//   whenever a deploy is blocked (deployBlockedByLive). Flag-off the two coincide.
//
//   MECHANISM B — DISABLED. The READ-section holds do render mid-battle, but
//   receive `disabled={deployDisabled}`, and deployDisabled includes deployBlockedByLive
//   (=== isLive flag-off).
//   useHoldToDeploy attaches NO handlers when disabled (bind === {}), so the
//   gesture cannot start and no ft-deploy-intent is ever dispatched. The runtime
//   half of that is asserted for real in starfield.intent.test.jsx ("a disabled
//   button neither holds nor dispatches"); this file pins the wiring that feeds
//   it, which no runtime test can see.
//
// Source-guard idiom, per App.agentBattlesPoll.test.js: these are render
// decisions inside components no test mounts with live-battle state.
//
// ── PHASE 1.5 NOTE (Command Center multi-battle) ────────────────────────────
// Phase 1.5 makes the deploy gate PER-TYPE behind CASUAL_CLONE_CONCURRENCY_ENABLED:
// the Command-Center deploy starts a BaggerBomb on a separate clone id, so flag-ON
// the CTA blocks only on a live BaggerBomb — NOT on a live ranked battle. A deploy
// hold is therefore ARMABLE while a ranked battle is live, so the header's "a hold
// against a BATTLE LIVE sky cannot happen in production" premise — and the Task 4
// INTENT_PEAK RESTING-only tuning that rests on it — holds ONLY flag-off. When the
// concurrency flag flips ON (a separate PR; DEPLOY_SKY_COUPLING is already on), that
// crossover becomes reachable and INTENT_PEAK wants a preview feel-check. Flag-off,
// deployBlockedByLive === isLive and every mechanism below is byte-identical, which
// is what the flag-OFF assertions here pin.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8');

const MOBILE = read('CommandDashboard.jsx');
const DESKTOP = read('CommandDashboardDesktop.jsx');
const READ_COLUMN = read('desktop/ReadColumn.jsx');

/** Every `<HoldToDeployButton ... />` element in a file, whole. */
function holdButtons(source) {
  return [...source.matchAll(/<HoldToDeployButton[\s\S]*?\/>/g)].map((m) => m[0]);
}

describe('deployDisabled carries the live gate in both shells', () => {
  // PHASE 1.5 UPDATE. deployDisabled no longer names isLive directly — it names
  // `deployBlockedByLive`, which is `concurrencyOn ? hasLiveBaggerBomb(liveBattles)
  // : isLive`. Flag-OFF (the shipping default) it reduces to the legacy isLive gate,
  // so every mid-battle guarantee below is byte-identical. Flag-ON it is the per-type
  // gate — a deploy hold IS armable while a RANKED battle is live (that is the
  // concurrency the feature delivers), which is why the BATTLE-LIVE-sky reachability
  // claim in the header holds only flag-off. See the Phase 1.5 note at the top.
  it('mobile: deployDisabled carries deployBlockedByLive', () => {
    expect(MOBILE).toMatch(/const deployDisabled = [^;]*\bdeployBlockedByLive\b/);
  });

  it('desktop: deployDisabled carries deployBlockedByLive', () => {
    expect(DESKTOP).toMatch(/const deployDisabled = [^;]*\bdeployBlockedByLive\b/);
  });

  it('both shells derive the gate from the shared deriveDeployGate helper (flag-off equivalence unit-tested there)', () => {
    // The per-type gate + its flag-off === isLive fallback live in one place now
    // (src/utils/commandCenterLiveBattles.js, unit-tested); the shells just consume it.
    for (const src of [MOBILE, DESKTOP]) {
      expect(src).toMatch(/deriveDeployGate\(\{ liveBattles, agent, concurrencyEnabled: concurrencyOn \}\)/);
      expect(src).toMatch(/const \{[^}]*\bdeployBlockedByLive\b[^}]*\} =/);
    }
  });

  it('and the desktop shell hands deployDisabled to ReadColumn', () => {
    // ReadColumn takes it as a prop, so the desktop READ holds inherit the gate
    // only if this pass-through survives.
    expect(DESKTOP).toMatch(/deployDisabled=\{deployDisabled\}/);
  });
});

describe('MECHANISM B — every READ-section hold is disabled while a battle is live', () => {
  it('mobile: all HoldToDeployButtons in the shell take disabled={deployDisabled}', () => {
    const buttons = holdButtons(MOBILE);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toContain('disabled={deployDisabled}');
    }
  });

  it('desktop: all HoldToDeployButtons in ReadColumn take disabled={deployDisabled}', () => {
    const buttons = holdButtons(READ_COLUMN);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button).toContain('disabled={deployDisabled}');
    }
  });
});

describe('MECHANISM A — the Deploy section unmounts while a deploy is blocked (flag-off: mid-battle)', () => {
  // PHASE 1.5: the gate moved from isLive to deployBlockedByLive. Flag-OFF the two are
  // identical, so the Deploy station still unmounts for the whole of any live battle
  // (byte-identical, Task 4 premise intact). Flag-ON it unmounts only while a BaggerBomb
  // is live — so beside a live RANKED battle the Deploy station (and its hold) mount by
  // design. The mount gate is still the sole thing standing between a blocked-deploy
  // state and an armed DeployStation hold (its own `disabled` omits the live gate).
  it('mobile: DeployStation mounts only under the !deployBlockedByLive gate, before the Manage block', () => {
    // Split (not a ternary): `{!deployBlockedByLive && (…DeployStation…)}{isLive && (…Manage…)}`.
    const deployGate = MOBILE.indexOf('{!deployBlockedByLive && (');
    const manageGate = MOBILE.indexOf('{isLive && (', deployGate);
    const station = MOBILE.indexOf('<DeployStation');
    expect(deployGate, 'the !deployBlockedByLive deploy gate must exist').toBeGreaterThan(-1);
    expect(manageGate, 'the isLive manage gate must exist after it').toBeGreaterThan(deployGate);
    expect(station).toBeGreaterThan(deployGate);
    expect(station).toBeLessThan(manageGate); // DeployStation is inside the deploy gate, ahead of Manage
  });

  it('desktop renders DeployCard only under the !deployBlockedByLive gate', () => {
    const gate = DESKTOP.indexOf('{!deployBlockedByLive && (');
    const card = DESKTOP.indexOf('<DeployCard');
    expect(gate, 'the !deployBlockedByLive gate must exist').toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(gate);
    // ...and is still INSIDE it. Ordering alone is not enough: a DeployCard moved BELOW
    // a closed gate would satisfy `card > gate` while rendering unconditionally. The gate
    // is `&&`, so assert it has not closed before the card appears.
    expect(DESKTOP.slice(gate, card)).not.toContain(')}');
  });

  it('DeployStation and DeployCard rely on that gate — their own disabled omits the live gate', () => {
    // Stated so the reliance is explicit: if either ever renders outside the
    // gate, its own `disabled` would NOT save it, and mechanism A is the only
    // thing standing between a live battle and an armed hold.
    for (const rel of ['DeployStation.jsx', 'desktop/DeployCard.jsx']) {
      expect(read(rel)).toMatch(/const disabled = deploying \|\| !agent;/);
    }
  });
});

describe('the sky can never be past RESTING while a hold is still armed', () => {
  it('the sky reads a SUBSET of what makes isLive true', () => {
    // The whole argument in one place. Both surfaces read activeAgentBattles;
    // the shells keep `status === 'active'`, and the sky's adapter applies the
    // SAME filter and then additionally drops games whose clock has run out. So
    // the sky's live set is a subset of the shells' — a non-RESTING sky implies
    // isLive, which implies every hold is unmounted or disabled.
    const adapter = read('../warpBattleAdapter.js');
    expect(adapter).toMatch(/battle\.status === 'active'/);
    expect(MOBILE).toMatch(/filter\(\(b\) => b\.status === 'active'\)/);
    expect(DESKTOP).toMatch(/filter\(\(b\) => b\.status === 'active'\)/);
  });
});
