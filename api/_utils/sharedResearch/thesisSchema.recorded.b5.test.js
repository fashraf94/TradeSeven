// api/_utils/sharedResearch/thesisSchema.recorded.b5.test.js
//
// Shared Research B5 — THE THREE RECORDED PROBES (Amendment B §B13 T-7). Own words "I want to play AI", on
// `claude-sonnet-5-5` with the real builder prompt: (1) map_segments on the T-1 card (the theme unset), (2) find_names
// with the segment set and the theme unset (T-2), (3) build_why on one name. Each card is built from the answer
// recorded before it (__fixtures__/probeBuilder.js b5Probes). The round's own ledger,
// test/fixtures/sharedResearch/build.b5.probes.ledger.json, holds at most 3 calls and $0.10. Nothing here calls a model.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildSchemaOf, acceptsOf, MODEL_REPLY_MAX, keptReplyOf } from './thesisSchema.js';
import { applyProposals, cardContextOf, partStatesOf, reasonHolds } from './thesis.js';
import { companiesOf } from './companies.js';
import { costUsd, MODELS, MAX_OUTPUT_TOKENS } from './modelTurn.js';
import { strayTickersOf } from './stepSchema.js';
import { THESIS_PARTS } from '../../../src/constants/sharedResearch.js';
import { b5Probes, b5FileOf, validateB5, PROBE_B5_KEYS } from './__fixtures__/probeBuilder.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../../../test/fixtures/sharedResearch');
const recorded = (key) => JSON.parse(readFileSync(b5FileOf(key), 'utf8'));
const LEDGER = JSON.parse(readFileSync(resolve(FIXTURES, 'build.b5.probes.ledger.json'), 'utf8'));
const B3_LEDGER = JSON.parse(readFileSync(resolve(FIXTURES, 'build.probes.ledger.json'), 'utf8'));
const PROBES = b5Probes();
const of = (key) => { const p = PROBES.find((x) => x.key === key); return { p, rec: recorded(key), v: validateB5(p, recorded(key).output) }; };
const words = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean);

describe('§B13 T-7 — the three probes and their ledger', () => {
  it('three probes, chained: map_segments → find_names → build_why, each answered in full on the current Sonnet id', () => {
    expect(PROBES.map((p) => p.key)).toEqual(PROBE_B5_KEYS);
    expect(PROBES.map((p) => p.shape)).toEqual([{ goal: 'map_segments', part: null }, { goal: 'find_names', part: null }, { goal: 'build_why', part: null }]);
    for (const key of PROBE_B5_KEYS) expect(recorded(key), key).toMatchObject({ key, model: MODELS.step, ok: true, stopReason: 'end_turn', attempts: 1, apiError: null });
  });
  it('the round\'s own ledger: 3 calls at most, $0.10 at most, each cost the recorded one; B3\'s ledger is untouched (16 calls)', () => {
    expect(LEDGER).toMatchObject({ callsMax: 3, costMaxUsd: 0.1 });
    expect(LEDGER.calls.length).toBeLessThanOrEqual(3);
    expect(LEDGER.calls.reduce((s, c) => s + c.costUsd, 0)).toBeLessThanOrEqual(0.1);
    for (const key of PROBE_B5_KEYS) {
      const last = LEDGER.calls.filter((c) => c.key === key).at(-1);
      expect(last, key).toMatchObject({ ok: true, costUsd: recorded(key).costUsd, usage: recorded(key).usage });
    }
    expect(B3_LEDGER.calls).toHaveLength(16);
    expect(B3_LEDGER.calls.some((c) => String(c.key).startsWith('b5:'))).toBe(false);
  });
  it('the fixtures hold the response, usage and cost — no key, no header, no request', () => {
    for (const key of PROBE_B5_KEYS) {
      const text = JSON.stringify(recorded(key));
      expect(text).not.toMatch(/sk-ant|x-api-key|authorization|CLAUDE_API_KEY/i);
      expect(Object.keys(recorded(key))).not.toContain('request');
    }
  });
  it('each probe\'s goal was on offer in the state it was asked in', () => {
    for (const p of PROBES) expect(p.offered.some((g) => g.goal === p.goal), p.key).toBe(true);
  });
});

for (const key of PROBE_B5_KEYS) {
  describe(`the recorded ${key} probe`, () => {
    it('its usage and cost; its output fills exactly its schema, inside the 2,500-token cap', () => {
      const { p, rec } = of(key);
      expect(rec.costUsd).toBe(costUsd(MODELS.step, rec.usage));
      expect(rec.usage.output).toBeLessThanOrEqual(MAX_OUTPUT_TOKENS.step);
      expect(Object.keys(rec.output)).toEqual(Object.keys(buildSchemaOf(p.shape).properties));
    });
    it('passes the validator with no note; no stray ticker; the reply kept is within 320 and ends a sentence', () => {
      const { rec, v } = of(key);
      expect(v.ok, JSON.stringify(v)).toBe(true);
      expect(v.notes).toEqual([]);
      expect(strayTickersOf(JSON.stringify(rec.output))).toEqual([]);
      expect(v.reply.length).toBeLessThanOrEqual(MODEL_REPLY_MAX);
      expect(v.reply).toMatch(/[.!?]$/);
      // §B14 Q-3 (moved from a prefix of the reply): the kept reply is the reply's own sentences, as keptReplyOf keeps them
      expect(v.reply).toBe(keptReplyOf(rec.output.reply.replace(/\s+/g, ' ').trim()).text);
    });
    it('lands only what its goal may land, and sets no part (V2-4)', () => {
      const { p, v } = of(key);
      const accepts = acceptsOf(p.shape.goal, p.shape.part);
      const field = { themeSuggestion: 'themeSuggestion', map: 'segments', why: 'why', wrongIfOptions: 'wrongIfOptions', timeFrame: 'timeFramePick', pick: 'pick' };
      for (const [k, f] of Object.entries(field)) if (v.proposals[k]) expect(accepts, `${key}: ${f}`).toContain(f);
      const after = { ...p.record, findings: [...p.record.findings, ...v.findings] };
      const card = applyProposals(p.card, v.proposals, cardContextOf({ record: after, supported: companiesOf(after).supported }));
      for (const part of THESIS_PARTS) expect(card[part].state, part).toBe(p.card[part].state);
    });
  });
}

describe('what the B5 probes say (T-1, T-2, T-3)', () => {
  it('(1) map_segments on the T-1 card: a theme suggestion of six words or fewer, never a sentence; the model\'s own reply at most 320', () => {
    const { p, rec, v } = of('b5:map_segments');
    expect(p.card.theme).toEqual({ state: 'unset', value: null, by: null, suggestion: null });
    const t = rec.output.themeSuggestion;
    expect(words(t).length).toBeGreaterThanOrEqual(2);
    expect(words(t).length).toBeLessThanOrEqual(6);
    expect(t.length).toBeLessThanOrEqual(80);
    expect(t).not.toMatch(/[.!?]$/);
    expect(v.proposals.themeSuggestion).toBe(t);
    expect(rec.output.reply.length).toBeLessThanOrEqual(320);
    expect(v.reply).toBe(rec.output.reply); // whole: nothing was cut
    expect(v.proposals.map.length).toBeGreaterThanOrEqual(2);
    expect(v.proposals.map.map((m) => m.label)).toContain(v.proposals.pick.value);
  });
  it('(2) find_names with the segment set and the theme only suggested: on offer (T-2); the model wrote 327 characters; the server keeps its first and its last sentence (§B14 Q-3, moved from the first two)', () => {
    const { p, rec, v } = of('b5:find_names');
    expect(p.card.theme.state).toBe('unset');
    expect(partStatesOf(p.card, cardContextOf({ record: p.record, supported: p.supported })).theme).toBe('suggested');
    expect(p.card.segment).toMatchObject({ state: 'set', by: 'partner_suggested_confirmed' });
    expect(rec.output.reply.length).toBeGreaterThan(320);
    expect(v.reply.length).toBeLessThan(rec.output.reply.length);
    expect(v.reply.endsWith('I would build on Nvidia and AMD, with Broadcom as a third name.')).toBe(true); // the proposal stays
    const after = { ...p.record, findings: [...p.record.findings, ...v.findings] };
    expect(companiesOf(after).supported.map((c) => c.symbol)).toEqual(['NVDA', 'AMD', 'AVGO']);
    expect(v.proposals.pick).toMatchObject({ part: 'names', asked: false });
  });
  it('(3) build_why on one name: a complete why for it, the point against, wrong-if options, a time frame', () => {
    const { p, v } = of('b5:build_why');
    expect(p.card.names.value).toHaveLength(1);
    expect(v.proposals.why.forNames).toEqual(p.card.names.value);
    const after = { ...p.record, findings: [...p.record.findings, ...v.findings] };
    const ctx = cardContextOf({ record: after, supported: companiesOf(after).supported });
    expect(v.proposals.why.reasons.every((r) => reasonHolds(ctx, r))).toBe(true);
    expect(v.proposals.why.against).not.toBeNull();
    expect(v.proposals.wrongIfOptions.length).toBeGreaterThan(0);
    expect(v.proposals.timeFrame).not.toBeNull();
  });
  it('no reply calls the player\'s words "your observation", or names "the retrieved items" or "the record" (T-3)', () => {
    for (const key of PROBE_B5_KEYS) expect(recorded(key).output.reply, key).not.toMatch(/your observation|retrieved items|the record\b/i);
  });
});
