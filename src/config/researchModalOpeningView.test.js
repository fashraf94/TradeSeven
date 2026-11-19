// src/config/researchModalOpeningView.test.js
//
// CP-2's ONE NAMED CONSTANT — THE PIN (OV-4; BUILD_RULES §2; the build "the checks on the page, the Chart view first",
// 19 Nov 2026; spec docs/specs/CHART_READ_SPEC_V1.md V1.1). RESEARCH_MODAL_OPENING_VIEW sits beside the modal's flags in
// researchModalFlags.js; one line puts the opening back to Analysis — the literal and the first row below, together.
// The flag-pin guard scans `*_ENABLED` booleans only, so this string is pinned here, as CHART_READ_MODE is
// (chartReadFlag.test.js). This file is the pin, not a behaviour test: the opening's rows live in
// src/components/draft/AssetResearchModal.chartRead.jsdom.test.jsx and Sheet/shellView.test.js.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { RESEARCH_MODAL_OPENING_VIEW, RESEARCH_MODAL_OPENING_VIEWS } from './researchModalFlags.js';
import { resolveOpeningView } from '../components/Research/Sheet/shellView.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'researchModalFlags.js'), 'utf8').replace(/\r\n/g, '\n');

describe('RESEARCH_MODAL_OPENING_VIEW — the pin (OV-4)', () => {
  it("is 'chart' — a stock opens on the Chart view (CP-2); 'analysis' puts it back in one line", () => {
    // THE ROW THAT MOVES WITH THE CONSTANT, in the same commit.
    expect(RESEARCH_MODAL_OPENING_VIEW).toBe('chart');
  });
  it('the allowed values: exactly analysis · chart, frozen; the resolver reads the constant and maps anything else to analysis', () => {
    expect(RESEARCH_MODAL_OPENING_VIEWS).toEqual(['analysis', 'chart']);
    expect(Object.isFrozen(RESEARCH_MODAL_OPENING_VIEWS)).toBe(true);
    expect(RESEARCH_MODAL_OPENING_VIEWS).toContain(RESEARCH_MODAL_OPENING_VIEW);
    expect(resolveOpeningView()).toBe(RESEARCH_MODAL_OPENING_VIEW);
  });
  it('one literal, beside the flags, with its Pinned-by pointer naming this file', () => {
    expect(SRC.match(/export const RESEARCH_MODAL_OPENING_VIEW = /g)).toHaveLength(1);
    expect(SRC).toContain("// Pinned by: researchModalOpeningView.test.js (the pin and this value move together — BUILD_RULES §2).\nexport const RESEARCH_MODAL_OPENING_VIEW = 'chart';");
  });
});
