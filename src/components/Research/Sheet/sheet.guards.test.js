// Research Modal Build C — the sheet's own token and motion guard (BUILD_RULES
// §10, §11; review D13).
//
// The shared guards (src/theme/tokens.guard.test.js, motion.guard.test.js)
// scan curated file lists this build does not edit (new tests only). This file
// holds the sheet to the same rules from its birth, on EVERY non-test module
// in src/components/Research/Sheet/ — a module added later is scanned without
// a list to update:
//   · no colour literal: no hex ('#0a0e14'), no rgb()/rgba() — colours come
//     from sheetTheme.js (CSS custom properties, color-mix tints) or readToken;
//   · no inline framer transition object (`transition={{`) — motion comes from
//     src/theme/motion.js (motionToken).
// Each rule is planted once below to prove it bites.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = readdirSync(HERE).filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f)).sort();

const RULES = {
  hex: /['"`]#[0-9a-fA-F]{3,8}\b/g,
  rgb: /\brgba?\(/g,
  inlineTransition: /transition=\{\{/g,
};
const count = (src, re) => (src.match(re) || []).length;

describe('the sheet\'s modules carry no colour literal and no inline motion', () => {
  it('the scan covers the sheet\'s modules (the two-view shell\'s header, tabs and What\'s moving among them)', () => {
    expect(SOURCES).toEqual(expect.arrayContaining(['AnalysisSheet.jsx', 'AskReply.jsx', 'packs.js', 'sheetTheme.js', 'useSheetView.js', 'ShellHeader.jsx', 'ShellTabs.jsx', 'WhatsMoving.jsx', 'shellView.js', 'ranksLabel.js']));
  });
  // The two-view shell's body lives in the modal (review D9): its block, between its two markers,
  // held to the same rules — the rest of AssetResearchModal.jsx is today's code and not scanned.
  it('AssetResearchModal.jsx — the shell\'s body block: zero hex, zero rgb()/rgba(), zero transition={{', () => {
    const src = readFileSync(path.join(HERE, '..', '..', 'draft', 'AssetResearchModal.jsx'), 'utf8');
    const from = src.indexOf("// ── The two-view shell's body");
    const to = src.indexOf('// Use Portal to render', from);
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    const block = src.slice(from, to);
    expect(block).toContain('shellBody = (');
    for (const [rule, re] of Object.entries(RULES)) expect(count(block, re), `shell body: ${rule}`).toBe(0);
  });
  for (const f of SOURCES) {
    it(`${f}: zero hex, zero rgb()/rgba(), zero transition={{`, () => {
      const src = readFileSync(path.join(HERE, f), 'utf8');
      for (const [rule, re] of Object.entries(RULES)) {
        expect(count(src, re), `${f}: ${rule} — use sheetTheme.js tokens / motionToken (BUILD_RULES §10, §11)`).toBe(0);
      }
    });
  }
  it('each rule bites (planted)', () => {
    expect(count("color: '#0a0e14'", RULES.hex)).toBe(1);
    expect(count("background: 'rgba(255,255,255,0.03)'", RULES.rgb)).toBe(1);
    expect(count('<motion.div transition={{ duration: 0.2 }} />', RULES.inlineTransition)).toBe(1);
    expect(count('transition={motionToken(\'fade\')}', RULES.inlineTransition)).toBe(0);
  });
});
