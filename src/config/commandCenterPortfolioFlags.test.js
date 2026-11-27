// src/config/commandCenterPortfolioFlags.test.js
//
// The portfolio hub's slice 1 — THE SWITCH'S PIN (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md,
// ruling PH-20; BUILD_RULES §2). COMMAND_CENTER_PORTFOLIO_HUB_ENABLED ships false. The flip PR, in one commit: the literal
// and its docstring's OFF; the first row below (its value; its title names none); the third row turned around (the guard
// scans the module but no longer holds it dark); and its DARK_BY_DESIGN entry in flagPinGuard.test.js removed. A dry run of
// the whole suite with the switch on reds those rows and nothing else (build report §4). What the switch does is pinned by the
// decision's rows (src/components/CommandCenter/hub/hubLayout.test.js) and the hub's own suite
// (src/components/CommandCenter/CommandCenterHub.portfolioSwitch.jsdom.test.jsx).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { COMMAND_CENTER_PORTFOLIO_HUB_ENABLED } from './commandCenterPortfolioFlags.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lf = (s) => s.replace(/\r\n/g, '\n');
const SRC = lf(readFileSync(path.join(HERE, 'commandCenterPortfolioFlags.js'), 'utf8'));
const GUARD_SOURCE = lf(readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8'));
/** The guard's code with its comments out, so a commented-out entry is not an entry (review P1T-5). */
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const GUARD = codeOf(GUARD_SOURCE);

describe('COMMAND_CENTER_PORTFOLIO_HUB_ENABLED — the pin (ruling PH-20, BUILD_RULES §2)', () => {
  it('holds the shipped value (the flip PR moves this literal with the flag\'s)', () => {
    // THE ROW THAT MOVES WITH A FLIP, in the flip PR's own commit; a rollback moves it back.
    expect(COMMAND_CENTER_PORTFOLIO_HUB_ENABLED).toBe(false);
  });

  it('is a plain boolean-literal export with a Pinned-by pointer naming this file', () => {
    expect(SRC).toMatch(/^export const COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = (true|false);$/m);
    const idx = SRC.indexOf('export const COMMAND_CENTER_PORTFOLIO_HUB_ENABLED = ');
    expect(SRC.slice(0, idx).split('\n').slice(-2).join('\n')).toMatch(/Pinned by: commandCenterPortfolioFlags\.test\.js/);
  });

  it('the module has no imports and one export, and the guard both scans it and holds it dark by design', () => {
    expect(SRC).not.toMatch(/^\s*import\b/m);
    expect(SRC).not.toMatch(/\bimport\s*\(/);
    expect(SRC.match(/^export /gm)).toEqual(['export ']);
    expect(GUARD).toMatch(/^ {2}'src\/config\/commandCenterPortfolioFlags\.js',$/m);
    expect(GUARD).toMatch(/^ {2}COMMAND_CENTER_PORTFOLIO_HUB_ENABLED:$/m);
  });

  it('the guard rows read the guard\'s code, not its comments: an entry commented out is no entry (value-neutral: a sample, not the guard)', () => {
    const KEY = /^ {2}COMMAND_CENTER_PORTFOLIO_HUB_ENABLED:$/m;
    const entry = "  COMMAND_CENTER_PORTFOLIO_HUB_ENABLED:\n    'the runway note',\n";
    const live = `const DARK_BY_DESIGN = {\n${entry}};\n`;
    const commented = `const DARK_BY_DESIGN = {\n/*\n${entry}*/\n};\n`;
    expect(codeOf(live)).toMatch(KEY);
    // The key line is still there as text (so a plain text match would pass), but not as code.
    expect(commented).toMatch(KEY);
    expect(codeOf(commented)).not.toMatch(KEY);
  });
});
