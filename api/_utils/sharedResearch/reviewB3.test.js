// api/_utils/sharedResearch/reviewB3.test.js
//
// Shared Research B3 — THE REVIEW'S FIXES, pure (BUILD_RULES §2 review, K-10; record
// docs/audits/20261116_BUILD_SHARED_RESEARCH_B3.md §9). One block per finding fixed:
// each row fails on the head the review read (1ecf712d) and passes after its fix.

import { describe, it, expect } from 'vitest';
import { NAMES_A_PRICE, BUILDER_FORECAST, builderPromiseOf, builderWordingOf, lineFailOf } from './thesisWords.js';
import { validateBuildTurn, cutAtSentence, DEAD_END_LINE } from './thesisSchema.js';
import {
  emptyCard, cardContextOf, applyCardOp, freeChoicesOf, readinessOf, saveIssueOf, sharedIssueOf, sentenceOf, thesisViewOf,
} from './thesis.js';

// ── a record and a card (the shapes thesis.test.js uses) ─────────────────────────
const F = (findingId, kind, symbol, status, fact = `${findingId} fact`, extra = {}) => ({
  findingId, kind, symbol, status, fact, source: { recordKind: 'retrieval', recordId: `https://x.example/${findingId}`, label: 'x', url: `https://x.example/${findingId}` },
  at: '2026-11-10T00:00:00.000Z', asOf: null, statusReason: null, supersedes: null, ...extra,
});
const BASE = [
  F('rN', 'relationship', 'NVDA', 'verified', 'Supplier · Nvidia sells accelerators.'), F('rA', 'relationship', 'AMD', 'verified', 'Competitor · AMD sells accelerators.'),
  F('eN', 'earnings_fact', 'NVDA', 'verified', 'Nvidia said data centers were 78% of sales.'), F('eN2', 'earnings_fact', 'NVDA', 'verified', 'Nvidia sells to cloud buyers.'),
  F('eA', 'earnings_fact', 'AMD', 'verified', 'AMD said its accelerator sales grew 40% last quarter.'), F('c1', 'coverage', null, 'verified', 'Buyers design their own chips.'),
];
const SUPPORTED = [{ symbol: 'NVDA', name: 'NVIDIA Corporation', relationshipFindingId: 'rN' }, { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', relationshipFindingId: 'rA' }];
const session = { status: 'open', stepsUsed: 2, stepBudget: 10, entry: { kind: 'observation' }, exchanges: [] };
const ctxOf = (findings = BASE, supported = SUPPORTED) => cardContextOf({ record: { researchWorkId: 'sr_s', state: 'open', findings }, supported, session });
const CTX = ctxOf();
function readyCard(names = ['NVDA']) {
  const c = emptyCard();
  c.theme = { state: 'set', value: 'AI', by: 'player_wrote', suggestion: null };
  c.segment = { state: 'set', value: 'GPUs', by: 'player_chose', findingIds: ['c1'], skipped: false, map: [{ label: 'GPUs', line: 'chips', findingIds: ['c1'] }, { label: 'Power', line: 'power', findingIds: [] }] };
  c.names = { state: 'set', value: names, by: 'player_chose', blocked: null };
  c.why = { state: 'set', by: 'partner_suggested_confirmed', shared: 'they sell accelerators to data centers', reasons: names.map((s) => ({ symbol: s, text: 'sells chips', findingIds: [s === 'NVDA' ? 'eN2' : 'eA'] })), against: { text: 'Buyers design their own chips', findingIds: ['c1'] }, proposal: null };
  c.wrongIf = { ...c.wrongIf, state: 'set', by: 'player_wrote', text: 'big buyers cut spending for two quarters', findingIds: [] };
  c.timeFrame = { state: 'set', by: 'player_chose', value: 'positional', suggestion: null };
  return c;
}

describe('RA-1 / RB-6 — what a save states is checked, the composed sentence included', () => {
  it('a confirm re-checks the shared reason against the KEPT reasons: a number held only by a dropped reason is refused', () => {
    const c = readyCard();
    c.why = { ...emptyCard().why, proposal: { shared: 'data centers are 78% of its sales', forNames: ['NVDA'], against: null, reasons: [{ symbol: 'NVDA', text: 'a', findingIds: ['eN'] }, { symbol: 'NVDA', text: 'b', findingIds: ['eN2'] }] } };
    expect(applyCardOp(c, { op: 'confirm', part: 'why' }, CTX).ok).toBe(true); // 78 sits in eN, kept
    expect(applyCardOp(c, { op: 'set', part: 'why', value: { keep: [1] } }, CTX)).toEqual({ ok: false, reason: 'shared_unsupported' }); // eN dropped
  });
  it('a confirm refuses a shared reason that names a supported company the card does not name (after a narrowing)', () => {
    const c = readyCard(['NVDA']);
    c.why = { ...emptyCard().why, proposal: { shared: 'NVDA and AMD both sell to data centers', forNames: ['NVDA'], against: null, reasons: [{ symbol: 'NVDA', text: 'a', findingIds: ['eN2'] }] } };
    expect(sharedIssueOf(CTX, c.why.proposal.shared, c.why.proposal.reasons, ['NVDA'])).toBe('names_another_company');
    expect(applyCardOp(c, { op: 'confirm', part: 'why' }, CTX)).toEqual({ ok: false, reason: 'shared_unsupported' });
    expect(freeChoicesOf(c, CTX).some((f) => f.op === 'confirm' && f.part === 'why')).toBe(false);
  });
  it('the save issue: a segment\'s figure no carried fact holds; the theme\'s own figure is the player\'s', () => {
    const c = readyCard();
    expect(saveIssueOf(c, CTX)).toBeNull();
    c.segment = { ...c.segment, value: 'The top 5 chip makers' };
    expect(saveIssueOf(c, CTX)).toEqual({ code: 'unsupported_assertion', detail: '5' });
    const t = readyCard();
    t.theme.value = 'the top 3 cloud buyers';
    expect(saveIssueOf(t, CTX)).toBeNull();
    expect(thesisViewOf(c, CTX).saveIssue).toEqual({ code: 'unsupported_assertion', detail: '5' });
  });
  it('an edited sentence must still name every name (B1\'s company-name rule); the composed one names them by construction', () => {
    const c = readyCard();
    expect(saveIssueOf(c, CTX, 'Chips sell well because buyers keep spending.')).toEqual({ code: 'names_not_supported', detail: { missing: 'NVDA' } });
    expect(saveIssueOf(c, CTX, sentenceOf(c))).toBeNull();
  });
  it('the save issue: more carried findings than the idea builder takes (RA-7)', () => {
    const many = Array.from({ length: 30 }, (_, i) => F(`n${i}`, 'earnings_fact', 'NVDA', 'verified', `fact ${i}`));
    const c = readyCard();
    c.why.reasons = [{ symbol: 'NVDA', text: 'many', findingIds: many.map((f) => f.findingId) }];
    expect(saveIssueOf(c, ctxOf([...BASE, ...many]))).toMatchObject({ code: 'too_many_evidence_refs' });
  });
  it('a stale segment blocks the save until it is changed: the sentence never carries a part that no longer holds', () => {
    const c = readyCard();
    const corrected = [...BASE, F('c2', 'coverage', null, 'verified', 'x', { supersedes: 'c1' })];
    c.why.against = null;
    expect(readinessOf(c, ctxOf(corrected))).toEqual({ ready: false, blockers: [{ part: 'segment', state: 'stale' }] });
    expect(sentenceOf(c)).toContain('through GPUs');
  });
});

describe('RA-3 — a free choice never silently clears a set part', () => {
  it('setting an unset segment (or skipping it) keeps the names, the why and the price lines', () => {
    const c = readyCard();
    c.segment = { ...emptyCard().segment, map: c.segment.map };
    c.wrongIf.priceLines = [{ symbol: 'NVDA', level: 100 }];
    const out = applyCardOp(c, { op: 'set', part: 'segment', value: 'skip' }, CTX);
    expect(out.card.names.state).toBe('set');
    expect(out.card.why.state).toBe('set');
    expect(out.card.wrongIf.priceLines).toHaveLength(1);
  });
  it('drop_unsourced is offered only while the why is not set', () => {
    const c = readyCard(['NVDA', 'AMD']);
    c.why.proposal = { shared: 's', forNames: ['NVDA', 'AMD'], against: null, reasons: [{ symbol: 'NVDA', text: 'a', findingIds: ['eN2'] }] };
    expect(freeChoicesOf(c, CTX).some((f) => f.reason === 'drop_unsourced')).toBe(false);
    c.why = { ...emptyCard().why, proposal: c.why.proposal };
    expect(freeChoicesOf(c, CTX).some((f) => f.reason === 'drop_unsourced')).toBe(true);
  });
});

describe('RB-1 / RB-2 / RB-3 — the builder\'s own wording (builder lines only; B1\'s checks are untouched)', () => {
  it.each([
    'its stock will rise as data centers keep buying accelerators', 'its shares should rally as AI spending grows',
    'it is the clear winner and a great play on AI spending', 'there is a nine-in-ten chance data centers keep buying its chips',
    'the share price is likely to climb as orders grow',
  ])('a forecast, praise or odds: "%s"', (text) => {
    expect(builderWordingOf(text)).toMatch(/^forecast:/);
    expect(lineFailOf(text, [])).toMatch(/^forecast:/);
  });
  it.each([
    'Your thesis will be tracked every session.', 'Atlas will watch this thesis for you.', 'We will alert you if buyers cut spending.',
    'The app will keep an eye on NVDA for you.', 'This thesis will be monitored until it is proved wrong.',
  ])('a promise: "%s"', (text) => {
    expect(builderPromiseOf(text, 'Atlas')).toBe(true);
  });
  it.each(["NVDA's price drops for two quarters", 'The stock halves', 'NVDA trades lower for two quarters', 'NVDA sells off after earnings'])('a price condition: "%s"', (text) => {
    expect(NAMES_A_PRICE.test(text)).toBe(true);
  });
  it.each([
    'NVDA sells off its networking unit', 'AMD halves its dividend', 'AMD halves its capex',
    "NVDA's average selling price drops for two quarters", 'hyperscalers sell off their GPU clusters',
  ])('a business condition is never read as a price (refuter R2\'s controls): "%s"', (text) => {
    expect(NAMES_A_PRICE.test(text)).toBe(false);
  });
  it.each([
    'it sells the accelerators AI data centers are buying', 'its market share should rise as buyers add capacity', 'accelerator prices will fall as supply grows',
    'big buyers cut accelerator spending for two quarters', 'a price war cuts margins', 'it sells off a networking unit', 'revenue halves after a buyer leaves',
    'Spending plans run over several quarters.', 'The team will test a new chip next year.',
  ])('business prose passes: "%s"', (text) => {
    expect(builderWordingOf(text, 'Atlas')).toBeNull();
    if (!/sells off a networking|revenue halves|price war|prices will fall/.test(text)) expect(NAMES_A_PRICE.test(text)).toBe(false);
  });
  it('the forecast patterns stay builder-side: B1\'s own list is unchanged', () => {
    expect(Object.keys(BUILDER_FORECAST)).toEqual(['price_move', 'praise', 'odds_in_words']);
  });
});

// ── the validator's fixes ────────────────────────────────────────────────────
const id = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = '2026-11-16T15:00:05.000Z';
const vrec = (findings) => ({ researchWorkId: 'sr_s1', state: 'open', question: 'q', findings });
const vf = (n, kind, symbol, status, fact) => ({ findingId: id(n), kind, symbol, status, fact, source: { recordKind: 'retrieval', recordId: `https://n.example/${n}`, label: 'n', url: `https://n.example/${n}` }, at: '2026-11-01T00:00:00.000Z', asOf: null, statusReason: null, supersedes: null });
const RECORD = vrec([vf(1, 'relationship', 'NVDA', 'verified', 'Supplier · Nvidia sells accelerators.'), vf(2, 'earnings_fact', 'NVDA', 'verified', 'Nvidia shipped 1,200 racks.'), vf(5, 'relationship', 'AMD', 'verified', 'Competitor · AMD sells accelerators.')]);
const EMPTY = { reply: '', findings: [], companies: [], themeSuggestion: '', segments: [], why: null, wrongIfOptions: [], timeFramePick: null, pick: null };
function cardNoNames() { const c = emptyCard(); c.theme = { state: 'set', value: 'AI', by: 'player_wrote', suggestion: null }; c.segment = { ...c.segment, state: 'set', value: 'GPUs', by: 'player_chose' }; return c; }
function validate(over, { goal = 'find_names', part = null, card = cardNoNames(), record = RECORD } = {}) {
  let n = 100;
  return validateBuildTurn({ ...EMPTY, ...over }, {
    record, items: [], readAt: null, partnerExchangeId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', partnerAt: NOW, nowIso: NOW,
    mintFindingId: () => id(++n), names: { NVDA: 'NVIDIA Corporation', AMD: 'Advanced Micro Devices, Inc.' }, partnerName: 'Atlas', card, goal, part,
  });
}

describe('RB-4 — a names pick is dropped, never narrowed', () => {
  it.each([['NVDA, AMD and Broadcom'], ['NVDA and QZXW'], ['Nvidia and AMD']])('"%s" → dropped', (value) => {
    const v = validate({ pick: { part: 'names', value, reason: 'All of them sell accelerators.', refs: [], reasons: [] } });
    expect(v.proposals.pick).toBeNull();
    expect(v.notes).toContain('dropped:pick:not_supported');
  });
  it.each([['NVDA and AMD'], ['NVDA, AMD.']])('"%s" lands whole', (value) => {
    expect(validate({ pick: { part: 'names', value, reason: 'Both sell accelerators.', refs: [], reasons: [] } }).proposals.pick.value).toEqual(['NVDA', 'AMD']);
  });
});

describe('RB-5 — the dead end is honest end to end', () => {
  it('a find_names reply that names a company when none is supported is replaced, with the dead-end line', () => {
    const v = validate({ reply: 'NVDA is the company to build this thesis on.', pick: { part: 'names', value: 'NVDA', reason: 'x', refs: [], reasons: [] } }, { record: vrec([]) });
    expect(v.reply).toContain(DEAD_END_LINE);
    expect(v.reply).not.toContain('NVDA');
    expect(v.notes).toContain('reply_replaced:dead_end');
  });
  it('an honest dead-end reply stands', () => {
    const v = validate({ reply: 'No listed company has a sourced connection to this segment.' }, { record: vrec([]) });
    expect(v.reply).toBe('No listed company has a sourced connection to this segment.');
  });
  it('a reply stands only while something it proposed landed (RC-3: a strengthen whose only proposal is dropped)', () => {
    const c = cardNoNames();
    c.timeFrame = { state: 'set', by: 'player_chose', value: 'swing', suggestion: null };
    const v = validate({ reply: 'I would move it to positional.', timeFramePick: { horizon: 'positional', reason: 'r' } }, { goal: 'strengthen', part: 'timeFrame', card: c });
    expect(v.notes).toEqual(expect.arrayContaining(['dropped:timeFramePick:time_frame_set', 'reply_replaced:proposals_dropped']));
    expect(v.reply).toBe('This step added 0 findings. The card did not change.');
  });
});

describe('RB-7 — the reply is cut at a sentence, before B1\'s number check, and stays within 600 with the server\'s line', () => {
  it('a held figure is never cut into an unheld one', () => {
    const reply = `${'Plain words here. '.repeat(33)}It shipped 1,200 racks.`;
    expect(reply.length).toBeGreaterThan(600);
    const v = validate({ reply }, { goal: 'direction' });
    expect(v.reply.length).toBeLessThanOrEqual(600);
    expect(v.reply).not.toMatch(/1,20(?!0)/);
    expect(v.notes.some((n) => n.startsWith('reply_replaced:'))).toBe(false);
  });
  it('cutAtSentence keeps whole sentences, or cuts the first at a space', () => {
    expect(cutAtSentence('One two. Three four.', 12)).toBe('One two.');
    expect(cutAtSentence('Onetwothree fourfive', 15)).toBe('Onetwothree');
    expect(cutAtSentence('short', 600)).toBe('short');
  });
});

describe('RC-1 — a malformed proposal field is dropped, never thrown on', () => {
  it.each([[{ segments: { label: 'x' } }, 'segments'], [{ segments: 'GPUs; power' }, 'segments'], [{ wrongIfOptions: { text: 'x' } }, 'wrongIfOptions'], [{ pick: 'NVDA' }, 'pick']])('%j', (over, field) => {
    const v = validate(over, { goal: 'map_segments' });
    expect(v.ok).toBe(true);
    expect(v.notes).toContain(`dropped:${field}:malformed`);
  });
});
