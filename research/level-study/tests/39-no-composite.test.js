// research/level-study/tests/39-no-composite.test.js
//
// S7 §5 test 5 — NO COMPOSITE SCORE ANYWHERE (parent §10.3; BUILD_RULES §9). The report is a checklist
// of displayed facts. No blended / weighted / composite score field may appear anywhere in the
// aggregation output. This walks the entire output tree and asserts no forbidden key exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateInSample } from '../lib/aggregate.js';
import { recs } from './_synthetic-aggregate.js';

const FORBIDDEN = /score|composite|weighted|blend/i;

function collectKeys(obj, path = '', out = []) {
  if (obj == null || typeof obj !== 'object') return out;
  for (const k of Object.keys(obj)) {
    out.push({ key: k, path: `${path}.${k}` });
    collectKeys(obj[k], `${path}.${k}`, out);
  }
  return out;
}

test('the aggregation output contains NO composite/blended/weighted score field', () => {
  const agg = aggregateInSample(recs(240, {}));
  const keys = collectKeys(agg);
  const offenders = keys.filter((e) => FORBIDDEN.test(e.key));
  assert.deepEqual(offenders, [], `no composite-score keys allowed; found: ${offenders.map((o) => o.path).join(', ')}`);
});

test('the report is a checklist of facts: only rates, counts, CIs, verdicts — no derived single number', () => {
  const agg = aggregateInSample(recs(240, {}));
  // Spot-check a representative cohort: every displayed cell is a rate/count/CI, never a "score".
  const cell = agg.P1.perSide.support.cells[0];
  const allowed = new Set(['label', 'n', 'uniqueDates', 'nullEndpointExcluded', 'floorOk',
    'top5SymbolPct', 'topSymbols', 'topSectorPct', 'topSectors', 'ratePct', 'rateCI', 'insufficient']);
  for (const k of Object.keys(cell)) assert.ok(allowed.has(k), `cell field '${k}' must be a displayed fact, not a synthesized score`);
});
