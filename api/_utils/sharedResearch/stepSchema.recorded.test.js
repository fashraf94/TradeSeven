// api/_utils/sharedResearch/stepSchema.recorded.test.js
//
// Shared Research B1 — THE VALIDATOR ON A REAL ANSWER (build prompt K-3, SQ-1;
// spec §15 S-6). test/fixtures/sharedResearch/step.recorded.json is one live
// `claude-sonnet-5-5` step turn, recorded once by scripts/sharedResearch/probe.mjs
// (the real system prompt, the step schema, the data-center fixture at step 1
// and the three authored items in __fixtures__/probe.js). Nothing here calls a
// model: the recorded answer is validated and applied to the fixture record.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateStepTurn, strayTickersOf, STEP_SCHEMA } from './stepSchema.js';
import { companiesOf } from './companies.js';
import { costUsd, MODELS } from './modelTurn.js';
import { findingAppendPatch, summaryRevisionPatch } from '../researchRecords/model.js';
import { dataCenterRecord } from './__fixtures__/records.js';
import { PROBE_ITEMS, PROBE_READ_AT } from './__fixtures__/probe.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REC = JSON.parse(readFileSync(resolve(HERE, '../../../test/fixtures/sharedResearch/step.recorded.json'), 'utf8'));
const NOW = '2026-11-12T15:00:05.000Z';

function validate() {
  let n = 0;
  return validateStepTurn(REC.output, {
    record: dataCenterRecord('step1'), items: PROBE_ITEMS, readAt: PROBE_READ_AT, partnerExchangeId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    partnerAt: NOW, nowIso: NOW, mintFindingId: () => `f_50000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  });
}

describe('the recorded probe', () => {
  it('one call on the current Sonnet id, answered in full, with its usage and cost (under $0.10)', () => {
    expect(REC).toMatchObject({ model: MODELS.step, ok: true, stopReason: 'end_turn', attempts: 1 });
    expect(REC.usage.input).toBeGreaterThan(0);
    expect(REC.costUsd).toBe(costUsd(MODELS.step, REC.usage));
    expect(REC.costUsd).toBeLessThan(0.1);
    expect(Object.keys(REC.output).sort()).toEqual(Object.keys(STEP_SCHEMA.properties).sort());
  });

  it('passes the validator, and its claim for the supported company is written', () => {
    const v = validate();
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(v.findings.filter((f) => f.kind === 'idea').map((f) => f.symbol)).toEqual(['ETN']);
  });

  it('every verified finding cites a real item by its url; every symbol is the universe\'s; no stray ticker anywhere', () => {
    const v = validate();
    const urls = new Set(PROBE_ITEMS.map((i) => i.url));
    for (const f of v.findings.filter((x) => x.status === 'verified')) expect(urls.has(f.source.url)).toBe(true);
    for (const f of v.findings) if (f.symbol !== null) expect(['ETN']).toContain(f.symbol);
    expect(strayTickersOf(JSON.stringify(REC.output))).toEqual([]);
  });

  it('the undated item\'s fact is dated by its read time and labeled " · undated" (§15 S-2 b)', () => {
    const undated = validate().findings.find((f) => f.source.url === PROBE_ITEMS[2].url);
    expect(undated).toMatchObject({ at: PROBE_READ_AT, asOf: null });
    expect(undated.source.label.endsWith(' · undated')).toBe(true);
  });

  it('applied to the record: Eaton is supported with its open significance question; Northfield Thermal stays a lead', () => {
    const v = validate();
    let r = dataCenterRecord('step1');
    for (const f of v.findings) r = { ...r, ...findingAppendPatch(r, f, { nowIso: NOW }) };
    if (v.summary) r = { ...r, ...summaryRevisionPatch(r, { text: v.summary.text, basedOn: v.summary.basedOn, expectedRev: 0 }, { nowIso: NOW }) };
    const { supported, leads } = companiesOf(r, { names: { ETN: 'Eaton Corporation plc' } });
    expect(supported.map((c) => c.symbol)).toEqual(['ETN']);
    expect(supported[0].openQuestion).not.toBeNull();
    expect(leads.map((l) => l.name)).toContain('Northfield Thermal');
  });
});
