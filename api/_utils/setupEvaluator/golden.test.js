// api/_utils/setupEvaluator/golden.test.js
//
// Measured Trend Evidence, slice 1 (P3) — V3 build prompt §4.3 and §9.4: the
// golden-verdict fixture pins the COMPLETE record of every synthetic scenario,
// and the append-only baseline pins the golden's canonical sha under the
// current SEMANTICS_ID. This proves consistency WITHIN one revision and
// nothing more; the cross-revision check is
// scripts/experiments/tf-setup-golden-baseline-check.mjs (run in the final
// checks against the merge-base), whose canonical-bytes helpers are reused here
// so both hash the same thing.
//
// REGENERATION (a deliberate semantics change only — bump SEMANTICS_ID and
// append a baseline entry in the same commit, or this file stays red):
//   GENERATE_TF_SETUP_GOLDEN=1 npx vitest run api/_utils/setupEvaluator/golden.test.js

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SCENARIOS, SCENARIO_NAMES } from './__fixtures__/syntheticBars.js';
import { evaluateTfEntry, evaluateTfHolding } from './tfSetupV1.js';
import { SEMANTICS_ID, SETUP_VERSION, THRESHOLDS_HASH } from './thresholds.js';
import { canonicalJson, canonicalSha256, checkBaselineIntegrity } from '../../../scripts/experiments/tf-setup-golden-baseline-check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(HERE, '__fixtures__', 'goldenVerdicts.json');
const BASELINE_PATH = path.join(HERE, '__fixtures__', 'goldenBaseline.json');

function currentGolden() {
  const entry = {}; const holding = {};
  for (const name of SCENARIO_NAMES) {
    const s = SCENARIOS[name];
    if (s.kind === 'entry') entry[name] = evaluateTfEntry(s.build());
    else holding[name] = evaluateTfHolding(s.build(), s.options);
  }
  return { semanticsId: SEMANTICS_ID, setupVersion: SETUP_VERSION, thresholdsHash: THRESHOLDS_HASH, entry, holding };
}

if (process.env.GENERATE_TF_SETUP_GOLDEN === '1') {
  writeFileSync(GOLDEN_PATH, canonicalJson(currentGolden()));
}

const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

describe('the golden-verdict fixture (in-revision)', () => {
  it('names the current rule-set identity', () => {
    expect(golden.semanticsId).toBe(SEMANTICS_ID);
    expect(golden.setupVersion).toBe(SETUP_VERSION);
    expect(golden.thresholdsHash).toBe(THRESHOLDS_HASH);
  });

  it('covers every scenario of the catalogue and nothing else', () => {
    const entryNames = SCENARIO_NAMES.filter((n) => SCENARIOS[n].kind === 'entry').sort();
    const holdingNames = SCENARIO_NAMES.filter((n) => SCENARIOS[n].kind === 'holding').sort();
    expect(Object.keys(golden.entry).sort()).toEqual(entryNames);
    expect(Object.keys(golden.holding).sort()).toEqual(holdingNames);
  });

  it.each(SCENARIO_NAMES.filter((n) => SCENARIOS[n].kind === 'entry'))('entry scenario %s reproduces its full record', (name) => {
    expect(evaluateTfEntry(SCENARIOS[name].build())).toEqual(golden.entry[name]);
  });

  it.each(SCENARIO_NAMES.filter((n) => SCENARIOS[n].kind === 'holding'))('holding scenario %s reproduces its full record', (name) => {
    expect(evaluateTfHolding(SCENARIOS[name].build(), SCENARIOS[name].options)).toEqual(golden.holding[name]);
  });

  it('the committed file is in canonical form (sorted keys, LF, trailing newline) so its bytes and its hash agree on every platform', () => {
    const raw = readFileSync(GOLDEN_PATH, 'utf8').replace(/\r\n/g, '\n');
    expect(raw).toBe(canonicalJson(golden));
  });
});

describe('the append-only baseline (in-revision)', () => {
  it('the last entry carries the current golden\'s canonical sha and SEMANTICS_ID; ids unique and in order', () => {
    expect(checkBaselineIntegrity({ baseline, goldenSha: canonicalSha256(golden), semanticsId: SEMANTICS_ID })).toEqual([]);
  });

  it('the last entry carries recordedAt and a note naming C1', () => {
    const last = baseline[baseline.length - 1];
    expect(last.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/);
    expect(last.note).toMatch(/C1/);
    expect(last.note).toMatch(/FD-P3-1/);
  });

  it('the golden computed now hashes to the baseline\'s last sha (a regenerated golden under the same id reds this row)', () => {
    expect(canonicalSha256(currentGolden())).toBe(baseline[baseline.length - 1].goldenSha256);
  });
});

describe('every recorded check explains its own result (the fix round after Astra\'s review)', () => {
  const plain = (op, a, b) => {
    switch (op) {
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      case '===': return a === b;
      default: throw new Error(`unexpected operator ${op}`);
    }
  };
  it('in the committed golden and in the records computed now, each true/false result is the plain IEEE comparison of the recorded lhs and rhs', () => {
    let checked = 0;
    for (const set of [golden, currentGolden()]) {
      for (const rec of [...Object.values(set.entry), ...Object.values(set.holding)]) {
        for (const c of rec.checks) {
          if (c.result === 'unknown') continue;
          const pairs = Array.isArray(c.lhs) ? c.lhs.map((l, i) => [l, c.rhs[i]]) : [[c.lhs, c.rhs]];
          expect(pairs.every(([l, r]) => plain(c.op, l, r)), `${c.id}: ${JSON.stringify(c.lhs)} ${c.op} ${JSON.stringify(c.rhs)}`).toBe(c.result);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(800);
  });
});
