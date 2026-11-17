// api/_utils/sharedResearch/thesisSchema.test.js
//
// Shared Research B3 — THE BUILDER TURN'S VALIDATOR (Amendment B §B4.2; §B10
// S-B3; K-4). Each rule with the defect it names: B1's rules still fail the
// step; a proposal that breaks rules 1–6 is dropped with a note and the step's
// findings still land; each goal lands only its own proposals; the reply is
// replaced by a plain line when the goal's own proposal is dropped whole.

import { describe, it, expect } from 'vitest';
import {
  validateBuildTurn, BUILD_SCHEMAS, BUILD_SHAPES, buildSchemaOf, schemaKeyOf, turnShapeOf, NAMES_A_PRICE, builderFallbackReplyOf, unsourcedLineOf, acceptsOf,
  DEAD_END_LINE,
} from './thesisSchema.js';
import { STEP_SCHEMA } from './stepSchema.js';
import { emptyCard } from './thesis.js';

const id = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = '2026-11-16T15:00:05.000Z';
const READ = '2026-11-16T15:00:01.000Z';
const src = (n) => ({ recordKind: 'retrieval', recordId: `https://n.example/${n}`, label: 'n.example · t', url: `https://n.example/${n}` });
const F = (n, kind, symbol, status, fact) => ({ findingId: id(n), kind, symbol, status, fact, source: src(n), at: '2026-11-01T00:00:00.000Z', asOf: null, statusReason: status === 'verified' ? null : 'inference', supersedes: null });
const RECORD = {
  researchWorkId: 'sr_s1', state: 'open', question: 'Build a thesis on: AI',
  findings: [
    F(1, 'relationship', 'NVDA', 'verified', 'Supplier · Nvidia sells accelerators to data centers.'),
    F(2, 'earnings_fact', 'NVDA', 'verified', 'Nvidia said data-center revenue was 78% of sales.'),
    F(3, 'inference', 'NVDA', 'unverified', 'Nvidia probably keeps its lead.'),
    F(4, 'coverage', null, 'verified', 'Four of six large buyers design their own chips.'),
    F(5, 'relationship', 'AMD', 'verified', 'Competitor · AMD sells competing accelerators.'),
  ],
};
const ITEMS = [{ index: 0, url: 'https://news.example.com/amd', title: 'AMD wins a cloud order', host: 'news.example.com', publishedDate: '2026-11-10T00:00:00.000Z', highlights: ['AMD won an accelerator order from a cloud buyer.'] }];
const NAMES = { NVDA: 'NVIDIA Corporation', AMD: 'Advanced Micro Devices, Inc.', AVGO: 'Broadcom Inc.' };

function cardWithNames(names) {
  const c = emptyCard();
  c.theme = { state: 'set', value: 'AI', by: 'player_wrote', suggestion: null };
  c.segment = { state: 'set', value: 'GPUs', by: 'player_chose', findingIds: [], skipped: false, map: [{ label: 'GPUs', line: 'chips', findingIds: [] }, { label: 'Power', line: 'power', findingIds: [] }] };
  if (names) c.names = { state: 'set', value: names, by: 'player_chose', blocked: null };
  return c;
}
const base = (over = {}) => ({
  reply: 'Two reasons hold up in the sources.', findings: [], companies: [],
  themeSuggestion: null, segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null, ...over,
});
function validate(output, { goal = 'build_why', part = null, card = cardWithNames(['NVDA']), record = RECORD, shape = undefined } = {}) {
  let n = 100;
  return validateBuildTurn(output, {
    record, items: ITEMS, readAt: READ, partnerExchangeId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', partnerAt: NOW, nowIso: NOW,
    mintFindingId: () => id(++n), names: NAMES, partnerName: 'Atlas', card, goal, part, ...(shape ? { shape } : {}),
  });
}
const WHY = (over = {}) => ({
  shared: 'it sells the accelerators data centers buy',
  reasons: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', text: 'Data centers are most of its sales.', refs: [id(2)] }],
  against: { text: 'Large buyers design their own chips.', refs: [id(4)] }, ...over,
});

/** A schema's size as the API's grammar sees it: objects, arrays, properties, union types (and optional parameters). */
function countsOf(schema) {
  const c = { objects: 0, arrays: 0, properties: 0, unions: 0, optional: 0 };
  const walk = (s) => {
    if (!s || typeof s !== 'object') return;
    if (Array.isArray(s.anyOf) || Array.isArray(s.type)) c.unions += 1;
    for (const b of [s, ...(s.anyOf ?? [])]) {
      if (b.type === 'object') {
        c.objects += 1;
        for (const [k, v] of Object.entries(b.properties ?? {})) { c.properties += 1; if (!(b.required ?? []).includes(k)) c.optional += 1; walk(v); }
      }
      if (b.type === 'array') { c.arrays += 1; walk(b.items); }
    }
  };
  walk(schema);
  return c;
}
/**
 * The size of every builder schema that COMPILED live (S-5; the recorded probes in test/fixtures/sharedResearch/
 * build.*.recorded.json, thesisSchema.recorded.test.js). A schema that grows past any of these numbers fails here: the
 * API refused one schema for all goals ("The compiled grammar is too large…") and the split exists to stay compiled.
 */
const COMPILED = Object.freeze({
  verify_source: { objects: 4, arrays: 3, properties: 20, unions: 8 },
  map_segments: { objects: 6, arrays: 5, properties: 27, unions: 9 },
  find_names: { objects: 5, arrays: 3, properties: 22, unions: 9 },
  build_why: { objects: 9, arrays: 7, properties: 33, unions: 9 },
  pick: { objects: 3, arrays: 2, properties: 7, unions: 1 },
  'strengthen:theme': { objects: 3, arrays: 2, properties: 14, unions: 6 },
  'strengthen:segment': { objects: 5, arrays: 4, properties: 21, unions: 7 },
  'strengthen:names': { objects: 4, arrays: 2, properties: 17, unions: 7 },
  'strengthen:why': { objects: 6, arrays: 5, properties: 24, unions: 7 },
  'strengthen:wrongIf': { objects: 5, arrays: 4, properties: 20, unions: 7 },
  'strengthen:timeFrame': { objects: 4, arrays: 2, properties: 17, unions: 7 },
  direction: { objects: 4, arrays: 3, properties: 19, unions: 8 },
});

describe('one schema per goal (the founder\'s S-1, S-2 and S-5, Nov 17)', () => {
  /** S-1, by the letter: reply plus only what the goal may land, with findings and companies where S-1 lists them. */
  const KEYS = Object.freeze({
    verify_source: ['reply', 'findings', 'companies', 'themeSuggestion'],
    map_segments: ['reply', 'findings', 'companies', 'themeSuggestion', 'segments', 'pick'],
    find_names: ['reply', 'findings', 'companies', 'pick'],
    build_why: ['reply', 'findings', 'why', 'wrongIfOptions', 'timeFramePick', 'pick'],
    pick: ['reply', 'pick'],
    'strengthen:theme': ['reply', 'findings'],
    'strengthen:segment': ['reply', 'findings', 'segments', 'pick'],
    'strengthen:names': ['reply', 'findings', 'pick'],
    'strengthen:why': ['reply', 'findings', 'why'],
    'strengthen:wrongIf': ['reply', 'findings', 'wrongIfOptions', 'pick'],
    'strengthen:timeFrame': ['reply', 'findings', 'timeFramePick'],
    direction: ['reply', 'findings', 'companies'],
  });
  it('each goal\'s schema holds reply plus only what that goal may land; findings and companies only where S-1 lists them', () => {
    expect(Object.keys(BUILD_SCHEMAS)).toEqual(Object.keys(KEYS));
    for (const [key, keys] of Object.entries(KEYS)) {
      expect(Object.keys(BUILD_SCHEMAS[key].properties), key).toEqual(keys);
      expect(BUILD_SCHEMAS[key].required, key).toEqual(keys);
    }
    for (const s of BUILD_SHAPES) expect(buildSchemaOf(s)).toBe(BUILD_SCHEMAS[schemaKeyOf(s)]);
  });
  it('findings are B1\'s exactly; the builder\'s companies drop claim and openRef (S-2); the ledger\'s STEP_SCHEMA keeps both', () => {
    for (const s of Object.values(BUILD_SCHEMAS)) if (s.properties.findings) expect(s.properties.findings).toBe(STEP_SCHEMA.properties.findings);
    const company = BUILD_SCHEMAS.find_names.properties.companies.items;
    expect(Object.keys(company.properties)).toEqual(['companyName', 'symbolCandidate', 'role', 'relationshipRef']);
    for (const k of Object.keys(company.properties)) expect(company.properties[k]).toBe(STEP_SCHEMA.properties.companies.items.properties[k]);
    expect(Object.keys(STEP_SCHEMA.properties.companies.items.properties)).toEqual(['companyName', 'symbolCandidate', 'role', 'relationshipRef', 'openRef', 'claim']);
    expect(Object.keys(STEP_SCHEMA.properties)).toEqual(['reply', 'findings', 'summary', 'lines', 'nextAction', 'companies']);
  });
  it('a research goal\'s pick is a value and one reason; the reasons with refs exist only in the pick goal\'s schema (S-2; §B10 S-B3)', () => {
    for (const [key, s] of Object.entries(BUILD_SCHEMAS)) {
      if (!s.properties.pick) continue;
      const p = s.properties.pick.anyOf[0];
      expect(Object.keys(p.properties), key).toEqual(key === 'pick' ? ['value', 'reason', 'reasons'] : ['value', 'reason']);
    }
    expect(BUILD_SCHEMAS.pick.properties.pick.anyOf[0].properties.reasons.items.required).toEqual(['text', 'refs']);
  });
  it('every schema stays at or under the size that compiled live (S-5), with no optional parameter', () => {
    expect(Object.keys(COMPILED)).toEqual(Object.keys(BUILD_SCHEMAS));
    for (const [key, s] of Object.entries(BUILD_SCHEMAS)) {
      const { optional, ...size } = countsOf(s);
      expect(optional, key).toBe(0);
      for (const [k, max] of Object.entries(COMPILED[key])) expect(size[k], `${key}.${k}`).toBeLessThanOrEqual(max);
    }
  });
  it('the counter counts what the grammar holds (a planted array, object, property and union each raise it)', () => {
    const base = countsOf(BUILD_SCHEMAS.pick);
    const grown = { ...BUILD_SCHEMAS.pick, properties: { ...BUILD_SCHEMAS.pick.properties, extra: { anyOf: [{ type: 'array', items: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } }, { type: 'null' }] } } };
    expect(countsOf(grown)).toEqual({ ...base, objects: base.objects + 1, arrays: base.arrays + 1, properties: base.properties + 2, unions: base.unions + 1, optional: 1 });
  });
  it('reads the schema\'s empty-string none like null: no theme, no point against, no symbol', () => {
    const v = validate(base({ themeSuggestion: '', why: WHY({ against: { text: '', refs: [] }, reasons: [{ companyName: 'Nvidia', symbolCandidate: '', text: 'Data centers are most of its sales.', refs: [id(2)] }] }) }));
    expect(v.notes.filter((n) => n.startsWith('dropped:') || n.startsWith('ignored:'))).toEqual([]);
    expect(v.proposals.why).toMatchObject({ against: null, reasons: [{ symbol: 'NVDA' }] });
  });
});

describe('B1\'s rules still fail the step', () => {
  it('a stray ticker in a fact fails the step, as on a ledger turn', () => {
    const v = validate(base({ findings: [{ tempId: 't1', kind: 'coverage', fact: 'QZXW raised prices.', symbolCandidate: null, companyName: null, support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }] }));
    expect(v).toMatchObject({ ok: false, rule: 'stray_ticker' });
  });
  it('a forbidden pattern in the reply fails the step', () => {
    expect(validate(base({ reply: 'You should buy NVDA now.' }))).toMatchObject({ ok: false, rule: 'forbidden' });
  });
});

describe('rule 1 — a reason counts only on current Source-backed findings about that name', () => {
  it('a reason resting on an inference is dropped; the name is then incomplete and the reply names the company', () => {
    const v = validate(base({ why: WHY({ reasons: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', text: 'It keeps its lead.', refs: [id(3)] }] }) }));
    expect(v.ok).toBe(true);
    expect(v.notes).toContain('dropped:why.reason:0:not_source_backed');
    expect(v.proposals.why).toMatchObject({ reasons: [], forNames: ['NVDA'] });
    expect(v.notes).toContain('why_incomplete:NVDA');
    expect(v.reply).toContain('No Source-backed reason was found for NVIDIA Corporation (NVDA) yet');
  });
  it('a reason citing another company\'s finding is dropped', () => {
    const v = validate(base({ why: WHY({ reasons: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', text: 'A rival sells chips.', refs: [id(5)] }] }) }));
    expect(v.notes).toContain('dropped:why.reason:0:not_source_backed');
  });
  it('a reason for a company that is not a name on the card is dropped', () => {
    const v = validate(base({ why: WHY({ reasons: [{ companyName: 'AMD', symbolCandidate: 'AMD', text: 'It sells chips.', refs: [id(5)] }] }) }));
    expect(v.notes).toContain('dropped:why.reason:0:not_a_name');
  });
  it('a reason may rest on this turn\'s own Source-backed finding about the name (its tempId)', () => {
    const v = validate(base({
      findings: [{ tempId: 'a1', kind: 'relationship', fact: 'AMD won an accelerator order from a cloud buyer.', symbolCandidate: 'AMD', companyName: 'AMD', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null }],
      why: WHY({ reasons: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', text: 'Data centers are most of its sales.', refs: [id(2)] }, { companyName: 'AMD', symbolCandidate: 'AMD', text: 'It won a cloud order.', refs: ['a1'] }] }),
    }), { card: cardWithNames(['NVDA', 'AMD']) });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(v.proposals.why.reasons.map((r) => r.symbol)).toEqual(['NVDA', 'AMD']);
    expect(v.proposals.why.reasons[1].findingIds).toEqual([v.findings[0].findingId]);
    expect(v.notes.some((x) => x.startsWith('why_incomplete'))).toBe(false);
  });
  it('a reason whose company name is another company\'s is dropped (identity)', () => {
    const v = validate(base({ why: WHY({ reasons: [{ companyName: 'Nvidia Materials', symbolCandidate: 'NVDA', text: 'x', refs: [id(2)] }] }) }));
    expect(v.notes).toContain('dropped:why.reason:0:identity_mismatch');
  });
});

describe('rule 2 — the point against needs a current finding', () => {
  it('a point against with no finding is dropped; the why stands with none ("No point against found yet")', () => {
    const v = validate(base({ why: WHY({ against: { text: 'Buyers may slow down.', refs: [] } }) }));
    expect(v.notes).toContain('dropped:why.against:no_finding');
    expect(v.proposals.why.against).toBeNull();
    expect(v.proposals.why.reasons).toHaveLength(1);
  });
  it('a point against citing nothing real is dropped', () => {
    expect(validate(base({ why: WHY({ against: { text: 'x', refs: ['f_nope'] } }) })).notes).toContain('dropped:why.against:invalid_source');
  });
});

describe('rule 3 — every written line: forbidden patterns, the ticker scan, the number rule, no service promise', () => {
  it.each([
    ['a stray ticker in a segment label', { label: 'QZXW chips', line: 'x', refs: [] }, 'stray_ticker'],
    ['a number no cited Source-backed finding holds', { label: 'GPUs', line: 'A 45% share of spend', refs: [] }, 'unsupported_number'],
    ['a forbidden pattern', { label: 'GPUs', line: 'You should buy the leader', refs: [] }, 'forbidden'],
    ['a service promise', { label: 'GPUs', line: 'The idea book will track it', refs: [] }, 'service_promise'],
    ['a ref that names no finding', { label: 'GPUs', line: 'chips', refs: ['nope'] }, 'invalid_source'],
    ['a label over 60', { label: 'g'.repeat(61), line: 'chips', refs: [] }, 'length'],
  ])('%s → that segment is dropped', (_, seg, rule) => {
    const v = validate(base({ segments: [seg, { label: 'Power', line: 'power', refs: [] }, { label: 'Cloud', line: 'cloud', refs: [] }] }), { goal: 'map_segments', card: cardWithNames(null) });
    expect(v.ok).toBe(true);
    expect(v.notes).toContain(`dropped:segment:0:${rule}`);
    expect(v.proposals.map.map((m) => m.label)).toEqual(['Power', 'Cloud']);
  });
  it('a number the line\'s own cited Source-backed finding holds is kept', () => {
    const v = validate(base({ segments: [{ label: 'GPUs', line: 'Data centers are 78% of sales', refs: [id(2)] }, { label: 'Power', line: 'power', refs: [] }] }), { goal: 'map_segments' });
    expect(v.proposals.map[0]).toEqual({ label: 'GPUs', line: 'Data centers are 78% of sales', findingIds: [id(2)] });
  });
  it('fewer than two segments surviving → no map, and the reply is replaced (the goal\'s own proposal)', () => {
    const v = validate(base({ reply: 'Here are four segments.', segments: [{ label: 'GPUs', line: 'x', refs: [] }] }), { goal: 'map_segments' });
    expect(v.proposals.map).toBeNull();
    expect(v.notes).toEqual(expect.arrayContaining(['dropped:segments:too_few', 'reply_replaced:goal_proposal_dropped']));
    expect(v.reply).toBe('This step added 0 findings. The card did not change.');
    expect(v.cardChanged).toBe(false);
  });
  it('a shared reason that breaks a rule drops the whole why', () => {
    const v = validate(base({ why: WHY({ shared: 'it will rise to $900' }) }));
    expect(v.proposals.why).toBeNull();
    expect(v.notes.some((x) => x.startsWith('dropped:why:shared_'))).toBe(true);
    expect(v.reply).toBe('This step added 0 findings. The card did not change.');
  });
  it('a theme suggestion with a stray ticker is dropped', () => {
    const v = validate(base({ themeSuggestion: 'QZXW power' }), { goal: 'verify_source', card: emptyCard() });
    expect(v.notes).toContain('dropped:themeSuggestion:stray_ticker');
  });
});

describe('rule 4 — a wrong-if option names a business condition, never a price', () => {
  it.each([
    ['Shares close below $100', false], ['The stock falls 20% in a month', false], ['It misses its price target', false], ['A 52-week low', false],
    ['Big buyers cut accelerator spending for two quarters', true], ['A price war cuts margins', true], ['A big buyer switches to its own chips', true],
  ])('%s → kept: %s', (text, kept) => {
    expect(NAMES_A_PRICE.test(text)).toBe(!kept);
    const v = validate(base({ why: WHY(), wrongIfOptions: [{ text, refs: [] }] }));
    expect(Boolean(v.proposals.wrongIfOptions)).toBe(kept);
  });
  it.each([
    ['The share price falls below where it was saved'], ['Shares close under their old high'], ['The stock trades below its level of last week'],
  ])('a price condition with no figure and no forbidden word — "%s" — is dropped by rule 4 itself', (text) => {
    const v = validate(base({ why: WHY(), wrongIfOptions: [{ text, refs: [] }] }));
    expect(v.notes).toContain('dropped:wrongIf.option:0:names_a_price');
    expect(v.proposals.wrongIfOptions).toBeNull();
  });
  it('at most three; repeats dropped', () => {
    const v = validate(base({ why: WHY(), wrongIfOptions: ['a', 'b', 'B', 'c', 'd'].map((t) => ({ text: `buyers cut ${t}`, refs: [] })) }));
    expect(v.proposals.wrongIfOptions.map((o) => o.text)).toEqual(['buyers cut a', 'buyers cut b', 'buyers cut c']);
  });
});

describe('rule 5 — a names pick names only supported companies', () => {
  it('a symbol with no verified relationship is dropped; one this turn just sourced counts', () => {
    const bad = validate(base({ pick: { part: 'names', value: 'NVDA, AVGO', reason: 'They lead.', refs: [], reasons: [] } }), { goal: 'find_names', card: cardWithNames(null) });
    expect(bad.notes).toContain('dropped:pick:not_supported');
    const good = validate(base({ pick: { part: 'names', value: 'NVDA and AMD', reason: 'Both sell accelerators.', refs: [id(1)], reasons: [] } }), { goal: 'find_names', card: cardWithNames(null) });
    expect(good.proposals.pick).toMatchObject({ part: 'names', value: ['NVDA', 'AMD'], asked: false });
  });
});

describe('rule 6 — the pick goal cites only findings already on the record', () => {
  const card = () => { const c = cardWithNames(null); c.segment.state = 'unset'; return c; };
  it('a pick reason citing this turn\'s own finding is dropped; one citing the record is kept', () => {
    const v = validate(base({
      findings: [{ tempId: 'n1', kind: 'inference', fact: 'GPUs lead.', symbolCandidate: null, companyName: null, support: { kind: 'inference', from: [id(4)], index: null, reason: null }, at: null, supersedes: null }],
      pick: { part: 'segment', value: 'GPUs', reason: 'Buyers design their own chips less there.', refs: [id(4)], reasons: [{ text: 'Supply is the limit.', refs: ['n1'] }, { text: 'Buyers say so.', refs: [id(4)] }, { text: 'It is the easiest to tie to sales.', refs: [] }] },
    }), { goal: 'pick', part: 'segment', card: card() });
    expect(v.notes).toContain('dropped:pick.reason:0:not_on_record');
    expect(v.proposals.pick).toMatchObject({ part: 'segment', value: 'GPUs', asked: true, findingIds: [id(4)] });
    expect(v.proposals.pick.reasons.map((r) => r.text)).toEqual(['Buyers say so.', 'It is the easiest to tie to sales.']);
  });
  it('the pick\'s part is the server\'s — the one asked — never the model\'s: a time frame offered for the segment is not a choice', () => {
    const v = validate(base({ pick: { part: 'timeFrame', value: 'swing', reason: 'x', reasons: [] } }), { goal: 'pick', part: 'segment', card: card() });
    expect(v.notes).toContain('dropped:pick:not_a_choice');
    expect(v.proposals.pick).toBeNull();
    expect(v.reply).toBe('This step added 0 findings. The card did not change.');
  });
  it('the pick goal rests on the findings its kept reasons cite, and on nothing a dropped reason cited', () => {
    const v = validate(base({ pick: { value: 'GPUs', reason: 'Buyers say so.', reasons: [{ text: 'Buyers say so.', refs: [id(4)] }, { text: 'Supply is the limit.', refs: [id(9)] }] } }), { goal: 'pick', part: 'segment', card: card() });
    expect(v.notes).toContain('dropped:pick.reason:1:not_on_record');
    expect(v.proposals.pick).toMatchObject({ part: 'segment', findingIds: [id(4)], asked: true });
  });
  it('a pick for a part the player already set is dropped', () => {
    const v = validate(base({ pick: { part: 'segment', value: 'GPUs', reason: 'x', refs: [], reasons: [] } }), { goal: 'map_segments' });
    expect(v.notes).toContain('dropped:pick:part_set');
  });
});

describe('each goal lands only its own proposals', () => {
  it('map_segments ignores a why and wrong-if options', () => {
    const v = validate(base({ segments: [{ label: 'A', line: 'a', refs: [] }, { label: 'B', line: 'b', refs: [] }], why: WHY(), wrongIfOptions: [{ text: 'buyers cut', refs: [] }] }), { goal: 'map_segments' });
    expect(v.notes).toEqual(expect.arrayContaining(['ignored:why', 'ignored:wrongIfOptions']));
    expect([v.proposals.why, v.proposals.wrongIfOptions]).toEqual([null, null]);
  });
  it('the accept table', () => {
    expect(acceptsOf('verify_source')).toEqual(['themeSuggestion']);
    expect(acceptsOf('pick', 'names')).toEqual(['pick']);
    expect(acceptsOf('strengthen', 'theme')).toEqual([]);
    expect(acceptsOf('strengthen', 'why')).toEqual(['why']);
    expect(acceptsOf('direction')).toEqual([]);
  });
  it('direction is asked as the first research goal on offer — never pick, never itself — or with findings only when none is', () => {
    expect(turnShapeOf({ goal: 'direction' }, [{ goal: 'build_why' }, { goal: 'strengthen', part: 'theme' }, { goal: 'direction' }])).toEqual({ goal: 'build_why', part: null });
    expect(turnShapeOf({ goal: 'direction' }, [{ goal: 'pick', part: 'segment' }, { goal: 'strengthen', part: 'names' }, { goal: 'direction' }])).toEqual({ goal: 'strengthen', part: 'names' });
    expect(turnShapeOf({ goal: 'direction' }, [{ goal: 'pick', part: 'segment' }, { goal: 'direction' }])).toEqual({ goal: 'direction', part: null });
    expect(turnShapeOf({ goal: 'direction' }, [])).toEqual({ goal: 'direction', part: null });
    expect(turnShapeOf({ goal: 'find_names', part: 'theme' })).toEqual({ goal: 'find_names', part: null });
    expect(turnShapeOf({ goal: 'strengthen', part: 'why' }, [{ goal: 'build_why' }])).toEqual({ goal: 'strengthen', part: 'why' });
  });
  it('a direction turn lands exactly what the goal it was asked as lands, and nothing else', () => {
    const asWhy = validate(base({ why: WHY(), themeSuggestion: 'Chips' }), { goal: 'direction', shape: { goal: 'build_why', part: null } });
    expect(asWhy.proposals.why).not.toBeNull();
    expect(asWhy.notes).toContain('ignored:themeSuggestion');
    expect(asWhy.proposals.goal).toBe('direction');
    const none = validate(base({ why: WHY(), segments: [{ label: 'A', line: 'a', refs: [] }, { label: 'B', line: 'b', refs: [] }] }), { goal: 'direction' });
    expect([none.proposals.why, none.proposals.map]).toEqual([null, null]);
    expect(none.notes).toEqual(expect.arrayContaining(['ignored:why', 'ignored:segments']));
  });
  it('a research goal\'s pick rests on no finding and is labelled the partner\'s reasoning; a ref it carries is never read (S-2)', () => {
    const v = validate(base({ pick: { value: 'NVDA', reason: 'It has the sourced connection.', refs: [id(1)] } }), { goal: 'find_names', card: cardWithNames(null) });
    expect(v.proposals.pick).toMatchObject({ part: 'names', value: ['NVDA'], findingIds: [], reasons: [], asked: false });
    const n = validate(base({ pick: { value: 'NVDA', reason: 'Data centers are 78% of its sales.' } }), { goal: 'find_names', card: cardWithNames(null) });
    expect(n.notes).toContain('dropped:pick:unsupported_number');
  });
  it('a company\'s claim is never read on a builder turn: no proposed claim lands as a finding (S-2)', () => {
    const v = validate(base({
      companies: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', role: 'Supplier', relationshipRef: id(1), openRef: id(3), claim: { effect: 'It sells more chips.', relationship: 'Supplier.', evidence: 'Its sales.', uncertainty: 'None.' } }],
    }), { goal: 'find_names', card: cardWithNames(null) });
    expect(v.ok).toBe(true);
    expect(v.findings.filter((f) => f.kind === 'idea')).toEqual([]);
  });
  it('a theme suggestion is not taken when the card has a theme', () => {
    const v = validate(base({ themeSuggestion: 'Power' }), { goal: 'map_segments', card: cardWithNames(null) });
    expect(v.notes).toContain('dropped:themeSuggestion:theme_set');
  });
});

describe('the schema split\'s refuter pass (SPL-1, SPL-4)', () => {
  const unsegmented = () => { const c = cardWithNames(null); c.segment = { ...c.segment, state: 'unset', value: null, by: null }; return c; };
  const SEG2 = [{ label: 'Cooling', line: 'chillers', refs: [] }];
  it('SPL-1: a direction turn asked as map_segments whose map is dropped cannot keep a reply that describes it', () => {
    const reply = 'I mapped the theme into cooling and grid links, two new segments.';
    const asMap = validate(base({ reply, segments: SEG2, pick: { value: 'GPUs', reason: 'It ties to sales.' } }), { goal: 'direction', card: unsegmented(), shape: { goal: 'map_segments', part: null } });
    expect(asMap.notes).toEqual(expect.arrayContaining(['dropped:segments:too_few', 'reply_replaced:goal_proposal_dropped']));
    expect(asMap.reply).toBe('This step added 0 findings. The card shows what it proposes.');
    const quiet = validate(base({ reply: 'Power is a link in the chain; nothing here changes the map.' }), { goal: 'direction', card: unsegmented(), shape: { goal: 'map_segments', part: null } });
    expect(quiet.reply).toBe('Power is a link in the chain; nothing here changes the map.');
  });
  it('SPL-1: a direction turn asked as find_names at a dead end cannot keep a reply that names a listed company', () => {
    const noneSupported = { ...RECORD, findings: RECORD.findings.filter((f) => f.kind !== 'relationship') };
    const v = validate(base({ reply: 'NVDA and AMD both sell accelerators.' }), { goal: 'direction', card: cardWithNames(null), record: noneSupported, shape: { goal: 'find_names', part: null } });
    expect(v.notes).toContain('reply_replaced:dead_end');
    expect(v.reply).toContain(DEAD_END_LINE);
  });
  it('SPL-4: what a schema lacks is not read — findings on a pick turn, companies on a build_why turn', () => {
    const f = { tempId: 'p1', kind: 'inference', fact: 'GPUs lead.', symbolCandidate: null, companyName: null, support: { kind: 'inference', from: [id(4)], index: null, reason: null }, at: null, supersedes: null };
    const pick = validate(base({ findings: [f], pick: { value: 'GPUs', reason: 'x', reasons: [] } }), { goal: 'pick', part: 'segment', card: unsegmented() });
    expect(pick.findings).toEqual([]);
    expect(pick.notes).toContain('ignored:findings');
    const why = validate(base({ why: WHY(), companies: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', role: 'Supplier', relationshipRef: id(1) }] }));
    expect(why.notes).toContain('ignored:companies');
  });
});

describe('the reply (K-4)', () => {
  it('is cut to 600 characters', () => {
    const v = validate(base({ reply: `${'word '.repeat(200)}end.`, why: WHY() }));
    expect(v.reply.length).toBeLessThanOrEqual(600);
  });
  it('a reply with a service promise is replaced by the plain line', () => {
    const v = validate(base({ reply: 'Atlas will track this for you.', why: WHY() }));
    expect(v.reply).toBe('This step added 0 findings. The card shows what it proposes.');
    expect(v.notes).toContain('reply_replaced:service_promise');
  });
  it('the plain line never claims what did not happen', () => {
    expect(builderFallbackReplyOf(1, { landed: false, cardChanged: false })).toBe('This step added 1 finding. The card did not change.');
    expect(builderFallbackReplyOf(2, { landed: false, cardChanged: true })).toBe('This step added 2 findings.');
    expect(builderFallbackReplyOf(3, { landed: true, cardChanged: true })).toBe('This step added 3 findings. The card shows what it proposes.');
    expect(unsourcedLineOf(['NVDA', 'AMD'], NAMES)).toBe('No Source-backed reason was found for NVIDIA Corporation (NVDA) and Advanced Micro Devices, Inc. (AMD) yet, so the why cannot be confirmed with them.');
  });
});
