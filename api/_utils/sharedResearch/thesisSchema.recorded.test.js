// api/_utils/sharedResearch/thesisSchema.recorded.test.js
//
// Shared Research B3 — THE BUILDER'S SCHEMAS AND VALIDATOR ON REAL ANSWERS
// (build prompt K-8; the founder's P-2, S-4 and S-5, Nov 17). Each
// test/fixtures/sharedResearch/build.<key>.recorded.json is one live
// `claude-sonnet-5-5` builder turn in one goal's schema, recorded once by
// scripts/sharedResearch/probeBuilder.mjs against the authored fixtures in
// __fixtures__/probeBuilder.js; build.probes.ledger.json lists every call the
// probes made. Nothing here calls a model.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { validateBuildTurn, BUILD_SCHEMAS, buildSchemaOf, acceptsOf, keptReplyOf, MODEL_REPLY_MAX } from './thesisSchema.js';
import { applyProposals, cardContextOf, reasonHolds } from './thesis.js';
import { companiesOf } from './companies.js';
import { costUsd, MODELS, MAX_OUTPUT_TOKENS } from './modelTurn.js';
import { strayTickersOf } from './stepSchema.js';
import { BASELINE } from './method.js';
import { THESIS_PARTS } from '../../../src/constants/sharedResearch.js';
import { builderProbes, PROBE_B_READ_AT, PROBE_B_NOW, PROBE_B_EXCHANGE_ID, PROBE_B_NAMES } from './__fixtures__/probeBuilder.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../../test/fixtures/sharedResearch');
const fileOf = (key) => resolve(FIXTURES, `build.${key.replace(':', '.')}.recorded.json`);
const recorded = (key) => JSON.parse(readFileSync(fileOf(key), 'utf8'));
const LEDGER = JSON.parse(readFileSync(resolve(FIXTURES, 'build.probes.ledger.json'), 'utf8'));
const PROBES = builderProbes();

function validate(p, rec) {
  let n = 0;
  return validateBuildTurn(rec.output, {
    record: p.record, items: p.items, readAt: PROBE_B_READ_AT, partnerExchangeId: PROBE_B_EXCHANGE_ID, partnerAt: PROBE_B_NOW, nowIso: PROBE_B_NOW,
    mintFindingId: () => `f_7b000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names: PROBE_B_NAMES, partnerName: 'Atlas', method: BASELINE,
    card: p.card, goal: p.goal, part: p.part, shape: p.shape,
  });
}
const landed = (p, v) => {
  const after = { ...p.record, findings: [...p.record.findings, ...v.findings] };
  return applyProposals(p.card, v.proposals, cardContextOf({ record: after, supported: companiesOf(after).supported }));
};
const PROPOSAL_OF = Object.freeze({ themeSuggestion: 'themeSuggestion', segments: 'map', why: 'why', wrongIfOptions: 'wrongIfOptions', timeFramePick: 'timeFrame', pick: 'pick' });

describe('every builder schema compiled live (S-4, S-5)', () => {
  it('one recorded probe per schema, each answered in full on the current Sonnet id', () => {
    expect(PROBES.map((p) => p.key).sort()).toEqual(Object.keys(BUILD_SCHEMAS).sort());
    for (const key of Object.keys(BUILD_SCHEMAS)) {
      expect(existsSync(fileOf(key)), key).toBe(true);
      expect(recorded(key), key).toMatchObject({ key, model: MODELS.step, ok: true, stopReason: 'end_turn', attempts: 1, apiError: null });
    }
  });
  it('the ledger: every call the probes made, within 16 calls and $0.50, its costs the recorded ones', () => {
    expect(LEDGER.calls.length).toBeLessThanOrEqual(16);
    const spent = LEDGER.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
    expect(spent).toBeLessThanOrEqual(0.5);
    for (const key of Object.keys(BUILD_SCHEMAS)) {
      const last = LEDGER.calls.filter((c) => c.key === key).at(-1);
      expect(last, key).toMatchObject({ ok: true, costUsd: recorded(key).costUsd, usage: recorded(key).usage });
    }
  });
  it('each probe\'s goal was on offer in the state it was asked in (offeredGoalsOf)', () => {
    for (const p of PROBES) expect(p.offered.some((g) => g.goal === p.goal && (g.part ?? null) === (p.part ?? null)), p.key).toBe(true);
  });
});

for (const p of PROBES) {
  describe(`the recorded ${p.key} probe`, () => {
    const rec = recorded(p.key);
    it('its usage and cost; its output fills exactly its schema, inside the 2,500-token cap', () => {
      expect(rec.costUsd).toBe(costUsd(MODELS.step, rec.usage));
      expect(rec.usage.output).toBeLessThanOrEqual(MAX_OUTPUT_TOKENS.step);
      expect(Object.keys(rec.output)).toEqual(Object.keys(buildSchemaOf(p.shape).properties));
    });
    it('passes B1\'s validator; no stray ticker anywhere in the answer', () => {
      const v = validate(p, rec);
      expect(v.ok, JSON.stringify(v)).toBe(true);
      expect(strayTickersOf(JSON.stringify(rec.output))).toEqual([]);
    });
    it('lands only what its goal may land, and sets no part (V2-4)', () => {
      const v = validate(p, rec);
      const accepts = acceptsOf(p.shape.goal, p.shape.part);
      for (const [field, key] of Object.entries(PROPOSAL_OF)) if (v.proposals[key]) expect(accepts, `${p.key}: ${field}`).toContain(field);
      const card = landed(p, v);
      for (const part of THESIS_PARTS) {
        expect(card[part].state, part).toBe(p.card[part].state);
        expect(card[part].value ?? null, part).toEqual(p.card[part].value ?? null);
      }
    });
  });
}

describe('what the probes proposed', () => {
  const of = (key) => { const p = PROBES.find((x) => x.key === key); return { p, v: validate(p, recorded(key)) }; };
  it('map_segments: a map of two to five segments, and Atlas\'s pick among them as a value and one reason', () => {
    const { v } = of('map_segments');
    expect(v.proposals.map.length).toBeGreaterThanOrEqual(2);
    expect(v.proposals.map.length).toBeLessThanOrEqual(5);
    expect(v.proposals.map.map((m) => m.label)).toContain(v.proposals.pick.value);
    expect(v.proposals.pick).toMatchObject({ part: 'segment', findingIds: [], reasons: [], asked: false });
  });
  it('the pick goal: two or three reasons, each citing only findings already on the record', () => {
    const { p, v } = of('pick');
    const onRecord = new Set(p.record.findings.map((f) => f.findingId));
    expect(v.proposals.pick.reasons.length).toBeGreaterThanOrEqual(2);
    expect(v.proposals.pick.reasons.length).toBeLessThanOrEqual(3);
    for (const r of v.proposals.pick.reasons) for (const id of r.findingIds) expect(onRecord.has(id)).toBe(true);
    expect(v.findings).toEqual([]);
  });
  it('build_why: a why for NVDA, the point against, wrong-if options with no price', () => {
    const { v } = of('build_why');
    expect(v.proposals.why.forNames).toEqual(['NVDA']);
    expect(v.proposals.wrongIfOptions.length).toBeGreaterThan(0);
    for (const r of v.proposals.why.reasons) expect(r.symbol).toBe('NVDA');
  });
  it.each(['build_why', 'strengthen:why'])('%s, replayed under §B12 W-10: the NVDA reason (an NVDA fact and a general Source-backed fact) is kept and the why is complete', (key) => {
    const { p, v } = of(key);
    expect(v.notes.filter((x) => x.startsWith('dropped:why.reason') || x.startsWith('why_incomplete'))).toEqual([]);
    expect(v.proposals.why.reasons.map((r) => r.symbol)).toEqual(['NVDA']);
    const after = { ...p.record, findings: [...p.record.findings, ...v.findings] };
    const ctx = cardContextOf({ record: after, supported: companiesOf(after).supported });
    const nvda = v.proposals.why.reasons[0].findingIds.map((id) => ctx.current.get(id));
    expect(nvda.every((f) => f.status === 'verified')).toBe(true);
    expect(nvda.some((f) => f.symbol === 'NVDA') && nvda.some((f) => f.symbol !== 'NVDA')).toBe(true); // the case W-10 rules
    expect(reasonHolds(ctx, v.proposals.why.reasons[0])).toBe(true);
  });
  // §B13 T-3 (moved from "the reply stands" verbatim): the model's reply now stands cut at 320 at a sentence's end —
  // both recorded replies run longer (414 and 365 characters)
  it('strengthen:names and strengthen:timeFrame: the model\'s own reply stands (§B12 Q-1), cut at 320 at a sentence\'s end (§B13 T-3)', () => {
    for (const key of ['strengthen:names', 'strengthen:timeFrame']) {
      const { v } = of(key);
      expect(v.notes.filter((x) => x.startsWith('reply_replaced')), key).toEqual([]);
      // §B14 Q-3 (moved from the leading sentences that fit): the first and the last sentence, else the first
      expect(v.reply, key).toBe(keptReplyOf(recorded(key).output.reply.replace(/\s+/g, ' ').trim(), MODEL_REPLY_MAX).text);
      expect(v.reply.length, key).toBeLessThanOrEqual(320);
    }
  });
  // §B13 T-2 (retitled from "direction with nothing else on offer"): replayed in the shape B3 recorded it in; today its
  // card offers the map, so the same step would be asked as map_segments
  it('direction, replayed in its recorded shape: findings only, nothing proposed for the card; today the card asks it as map_segments (§B13 T-2)', () => {
    const { p, v } = of('direction');
    expect(Object.values({ ...v.proposals, goal: null, part: null }).every((x) => x === null)).toBe(true);
    expect(recorded('direction').shape).toEqual({ goal: 'direction', part: null });
    expect(p.asNow).toEqual({ goal: 'map_segments', part: null });
  });
});
