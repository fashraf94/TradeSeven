// src/config/agentFormFlags.test.js
//
// Build S1 — THE FLAG PINS (BUILD_RULES §2) for AGENT_FORM_HUB_ENABLED and AGENT_FORM_BATTLE_ENABLED
// (src/config/agentFormFlags.js). Both are dark by design and stay false on main: each is flipped only on the
// never-merge smoke branch, where these pins go red on purpose (flagPinGuard names this file).
//
// The source rows are the flag-off guarantee's shape: every reader takes the module's literal straight into a
// ternary that Rollup folds to today's element, so with both flags off the hub and the battle view build
// byte-identical to main's (the build report's masked dist diff). An accessor, a featureFlags.js export (App.jsx
// dynamically imports that module, so all of its exports stay in the entry chunk) or a read outside a literal
// ternary would each break it.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_FORM_BATTLE_ENABLED, AGENT_FORM_HUB_ENABLED } from './agentFormFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(HERE, p), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const FLAGS = read('agentFormFlags.js');

/** Every non-comment line of a source that names `flag`. */
const readsOf = (rel, flag) => strip(read(rel)).split('\n').filter((line) => line.includes(flag)).map((line) => line.trim());

describe('AGENT_FORM_HUB_ENABLED and AGENT_FORM_BATTLE_ENABLED — the pins (BUILD_RULES §2)', () => {
  it('DARK: the hub hero is false on main; it is true only on the never-merge smoke branch', () => {
    expect(AGENT_FORM_HUB_ENABLED).toBe(false);
  });

  it('DARK: the battle forms are false on main; true only on the never-merge smoke branch', () => {
    expect(AGENT_FORM_BATTLE_ENABLED).toBe(false);
  });

  it('each is the module\'s literal, and featureFlags.js carries neither (its namespace is in the entry chunk)', () => {
    expect(FLAGS).toMatch(/^export const AGENT_FORM_HUB_ENABLED = false;$/m);
    expect(FLAGS).toMatch(/^export const AGENT_FORM_BATTLE_ENABLED = false;$/m);
    expect(read('featureFlags.js')).not.toMatch(/AGENT_FORM/);
  });

  it('flagPinGuard lists both as dark by design', () => {
    const guard = read('flagPinGuard.test.js');
    expect(guard).toMatch(/\n {2}AGENT_FORM_HUB_ENABLED:\n/);
    expect(guard).toMatch(/\n {2}AGENT_FORM_BATTLE_ENABLED:\n/);
  });
});

describe('every read is a literal ternary on the flag, so flag-off folds to today\'s element', () => {
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
