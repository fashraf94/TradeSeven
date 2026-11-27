// api/_utils/stockMeasures.test.js
//
// Research universe Build 2 (PR B), build prompt section 4: the per-stock math's one home. The golden
// (api/cron/compute-rankings.measuresGolden.test.js) proves the rankings job computes what it computed before the
// move; this file proves the research path reaches the same functions, that the module stays pure and reaches no
// research module, and that the rankings job re-exports the very functions it imports.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES section 4): importing stockMeasures.js here is the runtime proof that its graph is
// Node-clean. Never mock it.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as measures from './stockMeasures.js';
import * as rankingsJob from '../cron/compute-rankings.js';
import { GOLDEN_CASES, encodeGolden } from './__fixtures__/stockMeasuresGoldenInputs.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'stockMeasures.js'), 'utf8');
const GOLDEN = JSON.parse(readFileSync(path.join(HERE, '__fixtures__', 'stockMeasures.golden.json'), 'utf8'));

describe('the module', () => {
  it('imports rankingConfig.js only, so the rankings job can never reach a research module through it', () => {
    // Every form: `from '…'`, a bare side-effect `import '…'` (review L1-5), `import('…')`, `require('…')`.
    const specifiersOf = (src) => [...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]);
    expect(specifiersOf(SRC)).toEqual(['./rankingConfig.js']);
    expect(specifiersOf("import { a } from './rankingConfig.js';\nimport './metricSnapshots.js';")).toEqual(['./rankingConfig.js', './metricSnapshots.js']);
  });
  it('exports the shaper and the eight moved functions, and nothing else', () => {
    expect(Object.keys(measures).sort()).toEqual([
      'computeAvgSurprise', 'computeEarningsConsistency', 'computeEpsRevisionScore', 'computeShortInterestMetrics',
      'extractBalanceSheetMetrics', 'extractMetrics', 'extractYearlyDebtMetrics', 'getQuarterlyTTM', 'shapeFundamentals',
    ]);
  });
  it('makes no call, reads no environment and touches no store', () => {
    expect(SRC).not.toMatch(/\bfetch\s*\(|process\.env|firebase|getFirestore|\.collection\(/);
  });
});

describe('the rankings job uses these very functions', () => {
  it('re-exports the same function objects it imports (not copies)', () => {
    expect(rankingsJob.extractMetrics).toBe(measures.extractMetrics);
    expect(rankingsJob.computeEarningsConsistency).toBe(measures.computeEarningsConsistency);
  });
});

describe('the research path reaches the golden through stockMeasures.js directly', () => {
  it.each(GOLDEN_CASES.map((c) => [c.id, c]))('%s: shapeFundamentals then extractMetrics give the golden', (id, c) => {
    const realLog = console.log;
    console.log = () => {};
    try {
      const shaped = measures.shapeFundamentals(structuredClone(c.response), c.ticker);
      const metrics = measures.extractMetrics(c.ticker, shaped);
      const golden = GOLDEN.cases[id];
      expect(encodeGolden(shaped)).toEqual(golden['=shaped']);
      expect(encodeGolden(metrics)).toEqual(golden['=metrics']);
    } finally {
      console.log = realLog;
    }
  });
});

describe('pure: the same input gives the same output and is left as it was', () => {
  it.each(GOLDEN_CASES.map((c) => [c.id, c]))('%s', (_id, c) => {
    const realLog = console.log;
    console.log = () => {};
    try {
      const input = structuredClone(c.response);
      const before = JSON.stringify(input);
      const a = measures.extractMetrics(c.ticker, measures.shapeFundamentals(input, c.ticker));
      const b = measures.extractMetrics(c.ticker, measures.shapeFundamentals(input, c.ticker));
      expect(encodeGolden(a)).toEqual(encodeGolden(b));
      expect(JSON.stringify(input)).toBe(before);
    } finally {
      console.log = realLog;
    }
  });
});
