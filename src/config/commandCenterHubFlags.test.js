// src/config/commandCenterHubFlags.test.js
//
// Command Center hub, slice S0 — THE FLAG PIN (BUILD_RULES §2; spec
// docs/specs/20261012_COMMAND_CENTER_CORE_IMPLEMENTATION_SPEC_V1_2.md §4).
//
// COMMAND_CENTER_HUB_ENABLED ships FALSE: the hub is built dark across slices
// S0–S8, and activation is a separate founder action (spec §12). The first row
// is a tripwire in both directions. An accidental flip would put an unbuilt
// hub at the front door; flagPinGuard.test.js turns that into a loud failure
// naming this file. A deliberate flip moves that row to true AND drops the
// flag's DARK_BY_DESIGN entry, in the same commit — the registration row below
// then turns around to assert the entry is gone.
//
// Deliberately pins ONLY this flag (the commandCenterSyncFlags.test.js
// precedent): pinning a flag obliges its docstring to name this file, so an
// unrelated flag added here "as context" would couple its future flip to this
// arc. COMMAND_DASHBOARD_ENABLED and COMMAND_DASHBOARD_DESKTOP_ENABLED are the
// picker's other inputs; they are pinned by their own suite and never read here.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { COMMAND_CENTER_HUB_ENABLED, isCommandCenterHubOn } from './featureFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'featureFlags.js'), 'utf8').replace(/\r\n/g, '\n');
const GUARD = readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8').replace(/\r\n/g, '\n');

/** The body of a named export function, from its signature to its closing brace. */
function fnBody(name) {
  const body = SRC.slice(SRC.indexOf(`export function ${name}`));
  return body.slice(0, body.indexOf('\n}') + 2);
}

describe('COMMAND_CENTER_HUB_ENABLED — the dark pin (BUILD_RULES §2)', () => {
  it('ships DARK — both dashboard sites render the legacy shells until a deliberate founder flip', () => {
    // THE ROW THAT MOVES WITH THE FLIP, in the flip PR's own commit.
    expect(COMMAND_CENTER_HUB_ENABLED).toBe(false);
  });

  it('the accessor returns the flag, so it reads false today', () => {
    expect(isCommandCenterHubOn()).toBe(COMMAND_CENTER_HUB_ENABLED);
  });

  it('the accessor is the flag and nothing else — no URL, environment or localStorage override', () => {
    // A behavioural row cannot see an override while the URL carries no
    // parameter, so this one reads the source (the characterPaneFlags.test.js
    // "no query-string override" precedent).
    expect(fnBody('isCommandCenterHubOn')).toMatch(
      /^export function isCommandCenterHubOn\(\) \{\n {2}return COMMAND_CENTER_HUB_ENABLED;\n\}$/,
    );
  });

  it('no module-scope derivation of the accessor exists in the flag module', () => {
    expect(SRC).not.toMatch(/const \w+ = isCommandCenterHubOn\(\)/);
  });

  it('is a plain boolean export the flag-pin guard can scan', () => {
    expect(typeof COMMAND_CENTER_HUB_ENABLED).toBe('boolean');
    expect(SRC).toMatch(/^export const COMMAND_CENTER_HUB_ENABLED = (true|false);$/m);
  });

  it('its docstring names this pinning suite, the runway, the picker and the never-merge preview', () => {
    const idx = SRC.indexOf('export const COMMAND_CENTER_HUB_ENABLED');
    expect(idx).toBeGreaterThan(-1);
    // Bounded below by the previous export, so a neighbour's prose cannot satisfy it.
    const prev = SRC.lastIndexOf('export const ', idx - 1);
    const window = SRC.slice(prev, idx);
    expect(window).toContain('Pinned by: commandCenterHubFlags.test.js');
    expect(window).toContain('RUNWAY:');
    expect(window).toContain('Never a build PR');
    expect(window).toContain('src/components/CommandCenter/pickDashboardShell.js');
    expect(window).toContain('claude/command-center-hub-s0-smoke');
  });

  it('is registered DARK_BY_DESIGN while it ships false', () => {
    expect(GUARD).toMatch(/\n {2}COMMAND_CENTER_HUB_ENABLED:\n {4}'/);
  });
});
