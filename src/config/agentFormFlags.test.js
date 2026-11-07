// src/config/agentFormFlags.test.js
//
// Build S1 and S2 — THE FLAG PINS (BUILD_RULES §2) for AGENT_FORM_HUB_ENABLED, AGENT_FORM_BATTLE_ENABLED and
// AGENT_FORM_LEAGUE_ENABLED (src/config/agentFormFlags.js). All three are live, flipped together in the flags-on PR
// (founder ruling F1, Oct 30, 2026), and all three stay as kill switches (F2): a rollback moves the flag and its pin
// here, and its DARK_BY_DESIGN entry stays out, because the flag is now a live kill switch, not dark by design.
//
// The source rows are the kill switch's shape, and they mean more now the flags are on: every reader takes the module's
// literal straight into a ternary that Rollup folds, so setting a flag false gives that surface's old element back and
// nothing of the form stays in its chunks (agentForm.flagOffBundle.test.js reads what is left). An accessor, a
// featureFlags.js export (App.jsx dynamically imports that module, so all of its exports stay in the entry chunk) or a
// read outside a literal ternary would each break it.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_FORM_ARMORY_ENABLED, AGENT_FORM_BATTLE_ENABLED, AGENT_FORM_HUB_ENABLED, AGENT_FORM_LEAGUE_ENABLED } from './agentFormFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(HERE, p), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const FLAGS = read('agentFormFlags.js');

/** Every non-comment line of a source that names `flag`. */
const readsOf = (rel, flag) => strip(read(rel)).split('\n').filter((line) => line.includes(flag)).map((line) => line.trim());

describe('AGENT_FORM_HUB_ENABLED, AGENT_FORM_BATTLE_ENABLED and AGENT_FORM_LEAGUE_ENABLED — the pins (BUILD_RULES §2)', () => {
  it('the hub hero is live', () => {
    expect(AGENT_FORM_HUB_ENABLED).toBe(true);
  });

  it('the battle forms are live', () => {
    expect(AGENT_FORM_BATTLE_ENABLED).toBe(true);
  });

  it('the League\'s forms are live', () => {
    expect(AGENT_FORM_LEAGUE_ENABLED).toBe(true);
  });

  it('each is the module\'s literal, and featureFlags.js carries none (its namespace is in the entry chunk)', () => {
    // Value-neutral: the three rows above pin the values, so a rollback moves the flag and its one pin.
    expect(FLAGS).toMatch(/^export const AGENT_FORM_HUB_ENABLED = (?:true|false);$/m);
    expect(FLAGS).toMatch(/^export const AGENT_FORM_BATTLE_ENABLED = (?:true|false);$/m);
    expect(FLAGS).toMatch(/^export const AGENT_FORM_LEAGUE_ENABLED = (?:true|false);$/m);
    expect(read('featureFlags.js')).not.toMatch(/AGENT_FORM/);
  });

  it('flagPinGuard no longer lists them as dark by design, and still registers their module (a rollback leaves the entries out)', () => {
    const guard = read('flagPinGuard.test.js');
    expect(guard).not.toMatch(/\n {2}AGENT_FORM_HUB_ENABLED:\n/);
    expect(guard).not.toMatch(/\n {2}AGENT_FORM_BATTLE_ENABLED:\n/);
    expect(guard).not.toMatch(/\n {2}AGENT_FORM_LEAGUE_ENABLED:\n/);
    expect(guard).toMatch(/'src\/config\/agentFormFlags\.js',/);
  });
});

// Build A1 — THE ARMORY'S PIN (BUILD_RULES §2). Dark by design until the founder's phone test: flipped only on the
// never-merge smoke branch. Every read is a literal ternary that Rollup folds, so flag-off the build is main's, byte for
// byte (the build report's masked comparison), and agentForm.flagOffBundle.test.js reads what each module leaves.
describe('AGENT_FORM_ARMORY_ENABLED — the pin (BUILD_RULES §2), dark by design', () => {
  it('the armory is dark on main', () => {
    expect(AGENT_FORM_ARMORY_ENABLED).toBe(false);
  });

  it('it is the module\'s literal, not in featureFlags.js, and flagPinGuard lists it as dark by design', () => {
    expect(FLAGS).toMatch(/^export const AGENT_FORM_ARMORY_ENABLED = (?:true|false);$/m);
    expect(read('featureFlags.js')).not.toMatch(/AGENT_FORM_ARMORY/);
    expect(read('flagPinGuard.test.js')).toMatch(/\n {2}AGENT_FORM_ARMORY_ENABLED:\n/);
  });

  it('the armory is on only while the hub\'s agent form is (it draws it): a hub rollback with the armory on reds here', () => {
    // The hub flag is the forms' kill switch (F2). The armory renders the hub's agent form, so a rollback of the hub
    // flag must take the armory with it, in the same commit.
    expect(!AGENT_FORM_ARMORY_ENABLED || AGENT_FORM_HUB_ENABLED).toBe(true);
  });

  it('every read is a literal ternary on the flag, at exactly these sites', () => {
    const at = (rel) => readsOf(rel, 'AGENT_FORM_ARMORY_ENABLED');
    const hub = '../components/CommandCenter/';
    const IMPORT = "import { AGENT_FORM_ARMORY_ENABLED } from '../../config/agentFormFlags';";
    expect(at('../components/AgentForm/agentFormSpec.js')).toEqual([
      IMPORT,
      "pal: opponent ? 'copper' : AGENT_FORM_ARMORY_ENABLED && allegiance === UNLIT ? 'unlit' : 'teal',",
      "...(AGENT_FORM_ARMORY_ENABLED && coreStage === SET_ALONE ? setAloneKeys(framing, kind) : framing === 'tight' ? { zoom: TIGHT_ZOOM[kind] } : null),",
    ]);
    expect(at(`${hub}CommandCenterHub.jsx`)).toEqual([
      IMPORT,
      // The follow-up's N2(d): the phone armory steps aside for a tab switch, a hold and the strip's Retry.
      'const selectTab = AGENT_FORM_ARMORY_ENABLED',
      // The fix pass (review AR-9): the hold's phase compared by name, so a stored 'idle' could never close it.
      'if (AGENT_FORM_ARMORY_ENABLED && (deploy?.holdPhase === HOLD_PHASES.CHARGING || deploy?.holdPhase === HOLD_PHASES.LOCKED) && sheet.sheet === HUB_SHEETS.ARCHETYPE) runtime.closeSheet();',
      '{AGENT_FORM_ARMORY_ENABLED ? (',
      'onAction={AGENT_FORM_ARMORY_ENABLED && actions.deployAction ? (kind) => { if (kind === DISPLAY_ACTIONS.RETRY && sheet.sheet === HUB_SHEETS.ARCHETYPE) runtime.closeSheet(); actions.deployAction(kind); } : actions.deployAction}',
      'paused={AGENT_FORM_ARMORY_ENABLED ? coverOpen || sheet.sheet === HUB_SHEETS.ARCHETYPE : coverOpen}',
      // The follow-up's N1: the hero's read is bare Shadow with the armory on.
      '<HubAgentFormContext.Provider value={AGENT_FORM_ARMORY_ENABLED ? armoryHeroRead(readers.agent) : readers.agent}>',
    ]);
    expect(at(`${hub}LoadoutSheets.jsx`)).toEqual([IMPORT, '{AGENT_FORM_ARMORY_ENABLED ? (']);
    expect(at(`${hub}ShadowStage.jsx`)).toEqual([IMPORT, 'return AGENT_FORM_ARMORY_ENABLED ? (']);
    // The follow-up's N1 retired A1's `instant` read: the hero's view is main's file again, and reads no armory flag.
    expect(at(`${hub}HubAgentForm.jsx`)).toEqual([]);
    expect(at(`${hub}hub/useHubSheets.js`)).toEqual([
      "import { AGENT_FORM_ARMORY_ENABLED } from '../../../config/agentFormFlags';",
      'if (AGENT_FORM_ARMORY_ENABLED ? kind !== HUB_SHEETS.ARCHETYPE && LEGACY.has(kind) : LEGACY.has(kind)) {',
    ]);
    // The armory itself never reads the flag: it is reached only through those ternaries.
    expect(at(`${hub}Armory.jsx`)).toEqual([]);
    // The fix pass (founder rulings D-B, D-C, Nov 6, 2026): the core's level and its breath, everywhere the core draws, so
    // the engine reads the flag too, each read a literal ternary whose else arm is main's expression, textually.
    const ENGINE_IMPORT = "import { AGENT_FORM_ARMORY_ENABLED } from '../../../config/agentFormFlags';";
    const engine = '../components/AgentForm/engine/';
    expect(at(`${engine}core.js`)).toEqual([
      ENGINE_IMPORT,
      'coreMesh.scale.setScalar(C.core * beacon); AGENT_FORM_ARMORY_ENABLED ? coreMesh.material.color.set(pal.core).multiplyScalar(S.level * (S.lifted || 1)) : coreMesh.material.color.set(pal.core);',
      'glow.material.color.set(pal.near); glow.material.opacity = AGENT_FORM_ARMORY_ENABLED ? clamp(.95 * S.bright * hot * S.level, 0, 1) : clamp(.95 * S.bright * hot, 0, 1); glow.scale.setScalar(.7 * C.glow * beacon * (1 + .08 * Math.sin(t * 1.3)) * hot * (S.lifted || 1));',
      'halo.material.color.set(pal.near); halo.material.opacity = AGENT_FORM_ARMORY_ENABLED ? clamp(.18 * S.bright * hot * S.level, 0, 1) : clamp(.18 * S.bright * hot, 0, 1);',
    ]);
    expect(at(`${engine}form.js`)).toEqual([
      ENGINE_IMPORT,
      'if (F.brain) F.brain.update(t, AGENT_FORM_ARMORY_ENABLED ? { ...S, bright: S.bright * coreLift, lifted: coreLift, level: coreLevel(t, spec.held === true) } : coreLift === 1 ? S : { ...S, bright: S.bright * coreLift, lifted: coreLift }, pal, camDir);',
    ]);
    expect(at(`${engine}engine.js`)).toEqual([
      ENGINE_IMPORT,
      "poseForm(F, AGENT_FORM_ARMORY_ENABLED ? { ...spec, held: into === 'still' || !animates(v) } : spec, t, C, palette);",
    ]);
    // the breath's numbers and curve are the vocabulary's, which reads no flag
    expect(at(`${engine}vocab.js`)).toEqual([]);
  });

  it('no other source file reads it', () => {
    const SRC = path.resolve(HERE, '..');
    const readers = [];
    const walk = (abs) => {
      for (const ent of readdirSync(abs, { withFileTypes: true })) {
        const child = path.join(abs, ent.name);
        if (ent.isDirectory()) { if (ent.name !== 'node_modules') walk(child); continue; }
        if (!/\.[mc]?jsx?$/.test(ent.name) || /\.test\.[mc]?jsx?$/.test(ent.name)) continue;
        if (/\bAGENT_FORM_ARMORY_ENABLED\b/.test(strip(readFileSync(child, 'utf8')))) readers.push(path.relative(SRC, child).split(path.sep).join('/'));
      }
    };
    walk(SRC);
    expect(readers.sort()).toEqual([
      'components/AgentForm/agentFormSpec.js',
      'components/AgentForm/engine/core.js',
      'components/AgentForm/engine/engine.js',
      'components/AgentForm/engine/form.js',
      'components/CommandCenter/CommandCenterHub.jsx',
      'components/CommandCenter/LoadoutSheets.jsx',
      'components/CommandCenter/ShadowStage.jsx',
      'components/CommandCenter/hub/useHubSheets.js',
      'config/agentFormFlags.js',
    ]);
  });
});

describe('every read is a literal ternary on the flag, so a kill switch folds back to the old element', () => {
  it('the hub: the two stage sites and the one scope around the shells, nothing else', () => {
    const hub = '../components/CommandCenter/';
    expect(readsOf(`${hub}ShadowStage.jsx`, 'AGENT_FORM_HUB_ENABLED')).toEqual([
      "import { AGENT_FORM_HUB_ENABLED } from '../../config/agentFormFlags';",
      '{AGENT_FORM_HUB_ENABLED ? (',
      '{AGENT_FORM_HUB_ENABLED ? (',
    ]);
    expect(readsOf(`${hub}CommandCenterHub.jsx`, 'AGENT_FORM_HUB_ENABLED')).toEqual([
      "import { AGENT_FORM_HUB_ENABLED } from '../../config/agentFormFlags';",
      'return AGENT_FORM_HUB_ENABLED ? (',
    ]);
  });

  it('the League: the two head sites, the phone hero, the two lobby sites and the live arena\'s scope, each a ternary', () => {
    const lg = '../components/League/battleArena/';
    const IMPORT = "import { AGENT_FORM_LEAGUE_ENABLED } from '../../../config/agentFormFlags';";
    // FuseHero: the tip's size, its filter, its form, the frame, the scale, the anchors and the scope around the tips.
    const fuse = readsOf(`${lg}FuseHero.jsx`, 'AGENT_FORM_LEAGUE_ENABLED');
    expect(fuse[0]).toBe(IMPORT);
    expect(fuse.slice(1)).toHaveLength(7);
    for (const line of fuse.slice(1)) expect(line).toMatch(/(?:^|[=:] |, )\{?AGENT_FORM_LEAGUE_ENABLED (?:\? |&& showHead \? )/);
    // ArenaMobile: the hero's height, a style that folds to today's object.
    const mobile = readsOf(`${lg}ArenaMobile.jsx`, 'AGENT_FORM_LEAGUE_ENABLED');
    expect(mobile[0]).toBe(IMPORT);
    expect(mobile.slice(1)).toHaveLength(1);
    expect(mobile[1]).toMatch(/style=\{AGENT_FORM_LEAGUE_ENABLED && FUSE_HERO_ON \? /);
    for (const file of ['../components/League/LeagueDeskParts.jsx', '../components/League/LeagueLobbyRedesign.jsx']) {
      expect(readsOf(file, 'AGENT_FORM_LEAGUE_ENABLED'), file).toEqual(["import { AGENT_FORM_LEAGUE_ENABLED } from '../../config/agentFormFlags';", 'AGENT_FORM_LEAGUE_ENABLED ? (']);
    }
    const climb = readsOf(`${lg}ClimbArena.jsx`, 'AGENT_FORM_LEAGUE_ENABLED');
    expect(climb).toEqual([IMPORT, '{AGENT_FORM_LEAGUE_ENABLED ? (']);
    const live = readsOf(`${lg}LeagueBattleArenaLive.jsx`, 'AGENT_FORM_LEAGUE_ENABLED');
    expect(live).toEqual([IMPORT, 'AGENT_FORM_LEAGUE_ENABLED ? (', '{AGENT_FORM_LEAGUE_ENABLED ? (']);
    const slot = readsOf(`${lg}leagueAgentFormSlot.jsx`, 'AGENT_FORM_LEAGUE_ENABLED');
    expect(slot).toEqual([IMPORT, "const LazyLeagueAgentForm = AGENT_FORM_LEAGUE_ENABLED ? lazy(() => import('./LeagueAgentForm')) : null;"]);
  });

  it('the battle view: the screen\'s scopes and the three face sites, each a ternary', () => {
    const bv = '../screens/battleView/';
    for (const file of [`${bv}ArenaHeader.jsx`, `${bv}CharacterPane.jsx`, `${bv}CharacterAvatar.jsx`]) {
      const reads = readsOf(file, 'AGENT_FORM_BATTLE_ENABLED');
      expect(reads[0], file).toBe("import { AGENT_FORM_BATTLE_ENABLED } from '../../config/agentFormFlags';");
      expect(reads.length, file).toBeGreaterThan(1);
      // A ternary on the flag, or a ternary whose test starts with it (`FLAG && a ? X : Y`): both fold to the else arm.
      // A bare `{FLAG && <X />}` would leave a `false` child behind, so it is not one of these.
      for (const line of reads.slice(1)) expect(line, file).toMatch(/^\{?AGENT_FORM_BATTLE_ENABLED (?:\? |&& [^?:]+ \? )/);
    }
    const screen = readsOf('../screens/AgentBattleScreen.jsx', 'AGENT_FORM_BATTLE_ENABLED');
    expect(screen[0]).toBe("import { AGENT_FORM_BATTLE_ENABLED } from '../config/agentFormFlags';");
    expect(screen.slice(1)).toHaveLength(5);
    for (const line of screen.slice(1)) expect(line).toMatch(/^\{?(?:paneOn \? \()?AGENT_FORM_BATTLE_ENABLED \? /);
  });
});
