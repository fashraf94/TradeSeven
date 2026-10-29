// src/config/agentFormLabFlags.test.js
//
// Build S0 — THE FLAG PIN (BUILD_RULES §2) for AGENT_FORM_LAB_ENABLED (src/config/agentFormFlags.js), and
// the shape of App.jsx's one gated mount. The flag is dark by design and stays false on main: it is flipped
// only on a never-merge smoke branch, where this pin goes red on purpose (flagPinGuard names this file).
//
// The App rows read source, because the shape IS the guarantee: Rollup folds a literal `false` through a
// ternary and an `&&`, so with the flag off the bundle carries no lab chunk, no three and no URL read
// (the build report's dist diff: every executable file byte-identical to main's). An accessor, a
// featureFlags.js export (App.jsx dynamically imports that module, so all its exports stay in the entry
// chunk) or a URL read outside the `&&` would each break that.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_FORM_LAB_ENABLED } from './agentFormFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(path.join(HERE, p), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const APP = strip(read('../App.jsx'));
const FLAGS = read('agentFormFlags.js');

describe('AGENT_FORM_LAB_ENABLED — the pin (BUILD_RULES §2)', () => {
  it('DARK: false on main; the lab exists only on a never-merge smoke branch', () => {
    expect(AGENT_FORM_LAB_ENABLED).toBe(false);
  });

  it('is the module\'s literal, and featureFlags.js does not carry it (its namespace is in the entry chunk)', () => {
    expect(FLAGS).toMatch(/^export const AGENT_FORM_LAB_ENABLED = false;$/m);
    expect(read('featureFlags.js')).not.toMatch(/AGENT_FORM/);
  });

  it('flagPinGuard reads this module and lists the flag as dark by design', () => {
    const guard = read('flagPinGuard.test.js');
    expect(guard).toMatch(/'src\/config\/agentFormFlags\.js',/);
    expect(guard).toMatch(/\n {2}AGENT_FORM_LAB_ENABLED:\n/);
  });
});

describe('App.jsx — one lazy declaration and one gated mount, both foldable', () => {
  it('names the flag three times: the import, the lazy ternary, the mount\'s `&&`', () => {
    expect(APP.match(/\bAGENT_FORM_LAB_ENABLED\b/g)).toHaveLength(3);
    expect(APP).toContain("import { AGENT_FORM_LAB_ENABLED } from './config/agentFormFlags';");
    expect(APP).toContain("const AgentFormLab = AGENT_FORM_LAB_ENABLED ? lazy(() => import('./screens/AgentFormLab')) : null;");
    expect(APP).toContain("if (AGENT_FORM_LAB_ENABLED && new URLSearchParams(window.location.search).get('agentFormLab') === '1') {");
  });

  it('reads the parameter only inside the flag\'s `&&`, and mounts the lab nowhere else', () => {
    expect(APP.match(/agentFormLab/g)).toHaveLength(1);
    expect(APP.match(/<AgentFormLab\b/g)).toHaveLength(1);
  });

  it('the lab is a full-screen early return after App\'s hooks and before the onboarding gate and the unified return', () => {
    const gate = APP.indexOf("if (AGENT_FORM_LAB_ENABLED &&"), onboarding = APP.indexOf('const onboardingGateReady'), unified = APP.indexOf('const screenContent = getScreenContent();');
    expect(gate).toBeGreaterThan(APP.indexOf('const getScreenContent = () => {'));
    expect(gate).toBeLessThan(onboarding);
    expect(onboarding).toBeLessThan(unified);
    // No hook between the gate and the end of App's hooks (rules of hooks): the onboarding gate already returns early.
    expect(APP.slice(gate, unified)).not.toMatch(/\buse[A-Z]\w*\(/);
  });
});
