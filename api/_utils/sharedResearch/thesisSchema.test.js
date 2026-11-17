// api/_utils/sharedResearch/thesisSchema.test.js
//
// Shared Research B3 — THE BUILDER TURN'S VALIDATOR (Amendment B §B4.2; §B10
// S-B3; K-4). Each rule with the defect it names: B1's rules still fail the
// step; a proposal that breaks rules 1–6 is dropped with a note and the step's
// findings still land; each goal lands only its own proposals; the reply is
// replaced by a plain line when the goal's own proposal is dropped whole.

import { describe, it, expect } from 'vitest';
import { validateBuildTurn, BUILD_SCHEMA, NAMES_A_PRICE, builderFallbackReplyOf, unsourcedLineOf, acceptsOf, UNION_PARAMETERS } from './thesisSchema.js';
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
function validate(output, { goal = 'build_why', part = null, card = cardWithNames(['NVDA']), record = RECORD } = {}) {
  let n = 100;
  return validateBuildTurn(output, {
    record, items: ITEMS, readAt: READ, partnerExchangeId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', partnerAt: NOW, nowIso: NOW,
    mintFindingId: () => id(++n), names: NAMES, partnerName: 'Atlas', card, goal, part,
  });
}
const WHY = (over = {}) => ({
  shared: 'it sells the accelerators data centers buy',
  reasons: [{ companyName: 'Nvidia', symbolCandidate: 'NVDA', text: 'Data centers are most of its sales.', refs: [id(2)] }],
  against: { text: 'Large buyers design their own chips.', refs: [id(4)] }, ...over,
});

describe('the schema (§B4.2)', () => {
  it('keeps B1\'s reply, findings and companies exactly; drops summary, lines and nextAction; adds the six proposals', () => {
    expect(Object.keys(BUILD_SCHEMA.properties)).toEqual(['reply', 'findings', 'companies', 'themeSuggestion', 'segments', 'why', 'wrongIfOptions', 'timeFramePick', 'pick']);
    expect(BUILD_SCHEMA.properties.findings).toBe(STEP_SCHEMA.properties.findings);
    expect(BUILD_SCHEMA.properties.companies).toBe(STEP_SCHEMA.properties.companies);
    expect(BUILD_SCHEMA.required).toEqual(Object.keys(BUILD_SCHEMA.properties));
    expect(BUILD_SCHEMA.properties.pick.anyOf[0].properties.reasons.items.required).toEqual(['text', 'refs']); // §B10 S-B3
  });
  it('stays inside the API\'s schema limits: fewer than 16 union-type parameters (13), no optional parameter', () => {
    const unions = [];
    let optional = 0;
    const walk = (s, at) => {
      if (!s || typeof s !== 'object') return;
      if (Array.isArray(s.anyOf) || Array.isArray(s.type)) unions.push(at);
      for (const branch of [s, ...(s.anyOf ?? [])]) {
        if (branch.type === 'object' && branch.properties) {
          for (const [k, v] of Object.entries(branch.properties)) { if (!(branch.required ?? []).includes(k)) optional += 1; walk(v, `${at}.${k}`); }
        }
        if (branch.items) walk(branch.items, `${at}[]`);
      }
    };
    walk(BUILD_SCHEMA, '');
    expect(unions).toHaveLength(UNION_PARAMETERS);
    expect(UNION_PARAMETERS).toBeLessThan(16);
    expect(optional).toBe(0);
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
    expect(v.reply).toBe('This step added 0 findings.');
  });
  it('a shared reason that breaks a rule drops the whole why', () => {
    const v = validate(base({ why: WHY({ shared: 'it will rise to $900' }) }));
    expect(v.proposals.why).toBeNull();
    expect(v.notes.some((x) => x.startsWith('dropped:why:shared_'))).toBe(true);
    expect(v.reply).toBe('This step added 0 findings.');
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
  it('a pick for another part than the one asked is dropped', () => {
    const v = validate(base({ pick: { part: 'timeFrame', value: 'swing', reason: 'x', refs: [], reasons: [] } }), { goal: 'pick', part: 'segment', card: card() });
    expect(v.notes).toContain('dropped:pick:wrong_part');
    expect(v.reply).toBe('This step added 0 findings.');
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
    expect(acceptsOf('direction')).toHaveLength(6);
  });
  it('a theme suggestion is not taken when the card has a theme', () => {
    const v = validate(base({ themeSuggestion: 'Power' }), { goal: 'map_segments', card: cardWithNames(null) });
    expect(v.notes).toContain('dropped:themeSuggestion:theme_set');
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
    expect(builderFallbackReplyOf(1, false)).toBe('This step added 1 finding.');
    expect(builderFallbackReplyOf(3, true)).toBe('This step added 3 findings. The card shows what it proposes.');
    expect(unsourcedLineOf(['NVDA', 'AMD'], NAMES)).toBe('No Source-backed reason was found for NVIDIA Corporation (NVDA) and Advanced Micro Devices, Inc. (AMD) yet, so the why cannot be confirmed with them.');
  });
});
