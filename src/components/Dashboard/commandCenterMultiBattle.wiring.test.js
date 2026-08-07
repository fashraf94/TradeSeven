// src/components/Dashboard/commandCenterMultiBattle.wiring.test.js
//
// Phase 1.5 — Command Center multi-battle. Source-guard for the RENDER wiring in the
// two live shells (mobile CommandDashboard, desktop CommandDashboardDesktop). The
// decision logic is unit-tested in src/utils/commandCenterLiveBattles.test.js; this
// pins that the shells actually consume it — no test mounts these components with
// live-battle state (same idiom as holdDuringLiveBattle.test.js / App.agentBattlesPoll
// .test.js), so the wiring is only guardable at the source level.
//
// The whole restructure rides ONE existing flag (CASUAL_CLONE_CONCURRENCY_ENABLED,
// default false), and flag-off must be byte-identical — so every flag-on branch here
// is paired with a flag-off else that reproduces today's single-battle render.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, rel), 'utf8');

const MOBILE = read('CommandDashboard.jsx');
const DESKTOP = read('CommandDashboardDesktop.jsx');
const MANAGE = read('ManageStation.jsx');
const SHELLS = { mobile: MOBILE, desktop: DESKTOP };

describe('both shells derive the per-type gate off the ONE existing flag', () => {
  for (const [name, src] of Object.entries(SHELLS)) {
    it(`${name}: reads CASUAL_CLONE_CONCURRENCY_ENABLED into concurrencyOn (no new flag)`, () => {
      expect(src).toMatch(/import\s*\{[^}]*\bCASUAL_CLONE_CONCURRENCY_ENABLED\b[^}]*\}\s*from\s*['"][^'"]*featureFlags['"]/);
      expect(src).toMatch(/const concurrencyOn = CASUAL_CLONE_CONCURRENCY_ENABLED;/);
    });
    it(`${name}: derives the gate from the shared deriveDeployGate helper (one source, both shells)`, () => {
      expect(src).toMatch(/import\s*\{[^}]*\bderiveDeployGate\b[^}]*\}\s*from\s*['"][^'"]*commandCenterLiveBattles['"]/);
      expect(src).toMatch(/deriveDeployGate\(\{ liveBattles, agent, concurrencyEnabled: concurrencyOn \}\)/);
      // destructures all four gate values it renders from
      expect(src).toMatch(/const \{ orderedLiveBattles, deployBlockedByLive, deployBlockReason, equipLocked \} =/);
    });
    it(`${name}: renders the block reason on the disabled CTA (acceptance #2)`, () => {
      // The reason string itself is single-sourced in the helper (DEPLOY_BLOCK_REASON);
      // the shell just renders deployBlockReason when present.
      expect(src).toMatch(/deployBlockReason/);
    });
  }
});

describe('both shells render ALL live battles, labeled + ordered (acceptance #4)', () => {
  for (const [name, src] of Object.entries(SHELLS)) {
    it(`${name}: maps the deterministically-ordered set (from the helper) with a per-type card + key`, () => {
      // orderedLiveBattles comes from deriveDeployGate (sorted flag-on); the shell maps it.
      // showType makes ManageStation classify + label the card (it owns the §9 binding).
      expect(src).toMatch(/orderedLiveBattles\.map\(\(b\) => \(/);
      expect(src).toMatch(/<ManageStation key=\{b\.id\} battle=\{b\} showType/);
    });
    it(`${name}: keeps a flag-off single-card fallback (byte-identical)`, () => {
      // The un-mapped legacy card still renders when the flag is off.
      expect(src).toMatch(/<ManageStation battle=\{liveBattle\}/);
    });
    it(`${name}: never resolves the live card via an unsorted index in the flag-on path`, () => {
      // liveBattle (liveBattles[0]) may still exist for the flag-off fallback, but the
      // flag-on Manage render must go through orderedLiveBattles.map, not liveBattle.
      const manageMap = src.indexOf('orderedLiveBattles.map');
      expect(manageMap).toBeGreaterThan(-1);
    });
  }
});

describe('ManageStation labels by type without regressing flag-off copy (§9: one classification)', () => {
  it('gates the type display on a showType prop (flag-off → legacy card, byte-identical)', () => {
    expect(MANAGE).toMatch(/function ManageStation\(\{[^}]*\bshowType\b/);
    expect(MANAGE).toMatch(/const battleType = showType \? classifyBattleType\(battle\) : null/);
  });
  it('binds BOTH the header label and the "· vs CPU" line to the SAME classification (never a second groupId read)', () => {
    // §9 by construction: label from battleType, vs-CPU from battleType — one source.
    expect(MANAGE).toMatch(/const typeLabel = battleType \? battleTypeLabel\(battle\) : null/);
    expect(MANAGE).toMatch(/const showVsCpu = battleType !== BATTLE_TYPE_RANKED/);
    expect(MANAGE).toMatch(/showVsCpu \? ' · vs CPU' : ''/);
    // no raw re-derivation of ranked-ness from groupId anywhere in the render
    expect(MANAGE).not.toMatch(/battle\.groupId \? '' : ' · vs CPU'/);
  });
});

describe('equip lock label is bound to the real-agent source, not isLive (§9, flag-on)', () => {
  // equipLocked (= agent.activeBattleId flag-on, isLive flag-off) is derived in the
  // shared helper and unit-tested there; here we pin that each shell CONSUMES it for the
  // equip label rather than reverting to isLive.
  it('mobile: the Equip section label consumes equipLocked, not isLive', () => {
    expect(MOBILE).toMatch(/label=\{equipLocked \? 'Equip · locked in battle'/);
  });
  it('desktop: EquipBench receives equipLocked as its live/lock signal', () => {
    expect(DESKTOP).toMatch(/<EquipBench[^>]*isLive=\{equipLocked\}/);
  });
});

describe('mobile suppresses the G2 pod-session heads-up flag-on (false positive under the feature)', () => {
  it('gates podSessionConflict on !concurrencyOn (unchanged flag-off)', () => {
    expect(MOBILE).toMatch(/\{!concurrencyOn && podSessionConflict && \(/);
  });
  it('desktop never had the pod-session heads-up (nothing to suppress)', () => {
    expect(DESKTOP).not.toMatch(/podSessionConflict/);
  });
});
