// src/config/commandCenterPortfolioFlags.test.js
//
// The portfolio hub's slice 1 — THE SWITCH'S PIN (spec docs/specs/20261126_COMMAND_CENTER_PORTFOLIO_HUB_BUILD_SPEC_V1.md,
// ruling PH-20; BUILD_RULES §2). COMMAND_CENTER_PORTFOLIO_HUB_ENABLED ships false. The flip PR moves the first row below,
// the literal and its DARK_BY_DESIGN entry in flagPinGuard.test.js in one commit, and turns the third row around (the entry
// is gone). The first row's title names no value, so a flip moves its literal only. What the switch does is pinned by the
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
const GUARD = lf(readFileSync(path.join(HERE, 'flagPinGuard.test.js'), 'utf8'));

describe('COMMAND_CENTER_PORTFOLIO_HUB_ENABLED — the pin (ruling PH-20, BUILD_RULES §2)', () => {
  it('holds the shipped value: the portfolio hub is dark until its own flip PR', () => {
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
});
