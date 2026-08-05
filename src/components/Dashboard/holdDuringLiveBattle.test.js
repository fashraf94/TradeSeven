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
//   MECHANISM A — UNMOUNTED. The Deploy section is swapped for Manage when a
//   battle is live, taking DeployStation / DeployCard (and their holds) with it.
//
//   MECHANISM B — DISABLED. The READ-section holds do render mid-battle, but
//   receive `disabled={deployDisabled}`, and deployDisabled includes isLive.
//   useHoldToDeploy attaches NO handlers when disabled (bind === {}), so the
//   gesture cannot start and no ft-deploy-intent is ever dispatched. The runtime
//   half of that is asserted for real in starfield.intent.test.jsx ("a disabled
//   button neither holds nor dispatches"); this file pins the wiring that feeds
//   it, which no runtime test can see.
//
// Source-guard idiom, per App.agentBattlesPoll.test.js: these are render
// decisions inside components no test mounts with live-battle state.

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

describe('deployDisabled carries isLive in both shells', () => {
  it('mobile', () => {
    expect(MOBILE).toMatch(/const deployDisabled = [^;]*\bisLive\b/);
  });

  it('desktop', () => {
    expect(DESKTOP).toMatch(/const deployDisabled = [^;]*\bisLive\b/);
  });

  it('and the desktop shell hands that exact value to ReadColumn', () => {
    // ReadColumn takes it as a prop, so the desktop READ holds inherit isLive
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

describe('MECHANISM A — the Deploy section unmounts while a battle is live', () => {
  it('mobile swaps DeployStation out for Manage', () => {
    // `{!isLive ? ( ...DeployStation... ) : ( ...ManageStation... )}`
    const gate = MOBILE.indexOf('{!isLive ? (');
    const station = MOBILE.indexOf('<DeployStation');
    const otherwise = MOBILE.indexOf(') : (', gate);
    expect(gate, 'the !isLive gate must exist').toBeGreaterThan(-1);
    expect(station).toBeGreaterThan(gate);
    expect(station).toBeLessThan(otherwise); // DeployStation is on the NOT-live arm
  });

  it('desktop renders DeployCard only when not live', () => {
    const gate = DESKTOP.indexOf('{!isLive && (');
    const card = DESKTOP.indexOf('<DeployCard');
    expect(gate, 'the !isLive gate must exist').toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(gate);
    // ...and is still INSIDE it. Ordering alone is not enough: a DeployCard
    // moved BELOW a closed gate would satisfy `card > gate` while rendering
    // unconditionally. The gate is `&&`, so there is no `) : (` arm to bound
    // against — assert instead that it has not closed before the card appears.
    expect(DESKTOP.slice(gate, card)).not.toContain(')}');
  });

  it('DeployStation and DeployCard rely on that gate — their own disabled omits isLive', () => {
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
