// src/components/Research/ChartRead/chartRead.guards.test.js
//
// The Chart view's read — its modules hold the sheet's token and motion rules from birth (BUILD_RULES §10, §11;
// the Sheet/sheet.guards.test.js precedent): no colour literal (no hex, no rgb()/rgba()) — colours come from
// sheetTheme.js or readToken — and no inline framer transition object (`transition={{`). Every non-test module in
// this directory is scanned, so a module added later is held without a list to update. Each rule is planted once.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = readdirSync(HERE).filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f)).sort();
const RULES = { hex: /['"`]#[0-9a-fA-F]{3,8}\b/g, rgb: /\brgba?\(/g, inlineTransition: /transition=\{\{/g };
const count = (src, re) => (src.match(re) || []).length;

describe('the Chart view\'s read: no colour literal and no inline motion', () => {
  it('the scan covers the read\'s modules', () => {
    expect(SOURCES).toEqual(expect.arrayContaining(['ChartReadBand.jsx', 'ChartReadSheet.jsx', 'chartRead.js', 'chartReadCopy.js', 'format.js', 'marks.js', 'placeMarks.js', 'ruleMarksPrimitive.js', 'useChartRead.js']));
  });
  for (const f of SOURCES) {
    it(`${f}: zero hex, zero rgb()/rgba(), zero transition={{`, () => {
      const src = readFileSync(path.join(HERE, f), 'utf8');
      for (const [name, re] of Object.entries(RULES)) expect(count(src, re), `${f} ${name}`).toBe(0);
    });
  }
  it('each rule bites (planted)', () => {
    expect(count("const c = '#ff4d5e';", RULES.hex)).toBe(1);
    expect(count('ctx.strokeStyle = rgba(255, 0, 0, 1);', RULES.rgb)).toBe(1);
    expect(count('<motion.div transition={{ duration: 1 }} />', RULES.inlineTransition)).toBe(1);
  });
});
