// api/_utils/sharedResearch/refuterPass.test.js
//
// Shared Research B1 — rows for the second refuter pass over everything after
// dd792e4e (the founder's §16 follow-up; BUILD_RULES §2), each named by its
// finding id: SH-* (honesty) and SI-* (record integrity). The defect the
// refuter reproduced, now refused or corrected.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked imports below
// are the runtime guard for these modules' graphs. Never mock them.

import { describe, it, expect } from 'vitest';
import {
  validateStepTurn, forbiddenIn, strayNumberOf, numberTokensOf, retrievalLabelOf, STRAY_TICKER_MASK,
} from './stepSchema.js';
import { isSameCompany, companiesOf } from './companies.js';
import { assertAssertionsSupported, AssertionError, carriedFor } from './adoptPreview.js';
import { openingFindingsOf, dropTopicOf } from './opening.js';
import { previousSessionOf, exchangeOf } from './session.js';
import { openFromItem, beginFraming, beginStep, failStep, closeInvestigation } from './store.js';
import { buildStepSystemPrompt } from './stepPrompt.js';
import { makeSrFirestore } from './__fixtures__/srFirestore.js';
import { buildFinding } from '../researchRecords/model.js';
import { dataCenterRecord, OWNER } from './__fixtures__/records.js';

const READ = '2026-11-12T15:00:00.000Z';
const NOW = '2026-11-12T15:00:05.000Z';
const PARTNER = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const ITEMS = [{ index: 0, url: 'https://n.example/a', title: 'Orders', host: 'n.example', publishedDate: '2026-11-06T00:00:00.000Z' },
  { index: 1, url: 'https://n.example/b', title: 'No date', host: 'n.example', publishedDate: null }];
const NAMES = { ETN: 'Eaton Corporation plc', NVDA: 'NVIDIA Corporation', META: 'Meta Platforms, Inc.' };
let n = 0;
const ctx = (over = {}) => ({ record: dataCenterRecord('refresh'), items: ITEMS, readAt: READ, partnerExchangeId: PARTNER, partnerAt: NOW, nowIso: NOW, mintFindingId: () => `f_71000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names: NAMES, ...over });
const f = (over = {}) => ({ tempId: 't1', kind: 'relationship', fact: 'Eaton sells switchgear to data-center builders.', symbolCandidate: 'ETN', companyName: 'Eaton', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null, ...over });
const turn = (over = {}) => ({ reply: 'r', findings: [f()], summary: null, lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Next', purpose: 'p' }, companies: [], ...over });
const claim = { effect: 'NVIDIA earns from the build-out', relationship: 'as a chip supplier', evidence: 'the relationship finding', uncertainty: 'the share is not disclosed' };

describe('SH-1 — a finding that names no company carries a symbol only when its fact names that company', () => {
  it('"Taiwan Semiconductor supplies chips to Apple." with candidate NVDA: no symbol, NVIDIA is not supported, no claim', () => {
    const out = validateStepTurn(turn({
      findings: [f({ tempId: 'x', fact: 'Taiwan Semiconductor supplies chips to Apple.', symbolCandidate: 'NVDA', companyName: null })],
      companies: [{ companyName: 'NVIDIA', symbolCandidate: 'NVDA', role: 'Supplier', relationshipRef: 'x', openRef: null, claim }],
    }), ctx());
    expect(out.ok).toBe(true);
    expect(out.findings[0].symbol).toBeNull();
    expect(out.notes).toContain('identity_unnamed:NVDA');
    expect(out.findings.some((x) => x.kind === 'idea')).toBe(false);
    let r = dataCenterRecord('refresh');
    for (const x of out.findings) r = { ...r, findings: [...r.findings, x] };
    expect(companiesOf(r, { names: NAMES }).supported).toEqual([]);
  });
  it('a fact that names the company keeps its symbol', () => {
    const out = validateStepTurn(turn({ findings: [f({ fact: 'NVIDIA sells chips to data-center builders.', symbolCandidate: 'NVDA', companyName: null })] }), ctx());
    expect(out.findings[0].symbol).toBe('NVDA');
  });
});

describe('SH-2 — the named company must BE the symbol\'s: every word of its name is in the stored name', () => {
  it('another company sharing one distinctive word is not it', () => {
    expect(isSameCompany('Meta Materials', { symbol: 'META', name: 'Meta Platforms, Inc.' })).toBe(false);
    expect(isSameCompany('Texas Roadhouse', { symbol: 'TXN', name: 'Texas Instruments Incorporated' })).toBe(false);
    expect(isSameCompany('Apple Hospitality REIT', { symbol: 'AAPL', name: 'Apple Inc.' })).toBe(false);
    const out = validateStepTurn(turn({ findings: [f({ companyName: 'Meta Materials', symbolCandidate: 'META', fact: 'Meta Materials sells films.' })] }), ctx());
    expect(out.findings[0].symbol).toBeNull();
    expect(out.notes).toContain('identity_mismatch:META');
  });
  it('the company by its short name, its full name or its symbol is it; with no stored name only the symbol identifies', () => {
    expect(isSameCompany('Meta', { symbol: 'META', name: 'Meta Platforms, Inc.' })).toBe(true);
    expect(isSameCompany('Disney', { symbol: 'DIS', name: 'The Walt Disney Company' })).toBe(true);
    expect(isSameCompany('Walt Disney', { symbol: 'DIS', name: 'The Walt Disney Company' })).toBe(true);
    expect(isSameCompany('Eaton Corporation', { symbol: 'ETN', name: 'Eaton Corporation plc' })).toBe(true);
    expect(isSameCompany('etn', { symbol: 'ETN', name: undefined })).toBe(true);
    expect(isSameCompany('Eaton', { symbol: 'ETN', name: undefined })).toBe(false);
  });
});

describe('SH-3 / SH-4 / SH-5 — "considered" with the agent, the partner, I or we as its subject (spec §16 FQ-3)', () => {
  it('caught: curly apostrophes, adverbs, negations, "too", and the passive "by your agent"', () => {
    for (const s of ['I’ve considered the filing.', 'We’ve considered the supplier list.', 'We thoroughly considered whether Eaton supplies the builders.',
      'We specifically considered a second source.', 'I seriously considered a second source.', "We haven't considered the vendor's own report.",
      'We, too, considered the vendor report.', 'This connection was considered by your agent.', 'This connection was considered by our agent.']) {
      expect(forbiddenIn(s), s).toContain('considered');
    }
  });
  it('a partner name with letters outside ASCII is a subject too', () => {
    expect(forbiddenIn('José learned the pattern from last quarter.', { partnerName: 'José' })).toContain('learning_claim');
    expect(forbiddenIn('Élodie considered the filing.', { partnerName: 'Élodie' })).toContain('considered');
    expect(forbiddenIn('Maximum demand was considered high.', { partnerName: 'Max' })).toEqual([]);
  });
  it('"by US regulators" is not "by us"; "by us" still is', () => {
    expect(forbiddenIn('The merger was considered by US regulators in 2025.')).toEqual([]);
    expect(forbiddenIn('The deal was considered by the US Treasury.')).toEqual([]);
    expect(forbiddenIn('Eaton was considered by us.')).toContain('considered');
  });
});

describe('SH-6 / SH-7 / SH-8 — dates excuse only dates, and only real ones', () => {
  const dec5 = [{ fact: 'Eaton reported orders.', at: '2025-12-05T00:00:00.000Z', asOf: '2025-12-05T00:00:00.000Z', status: 'verified', source: { label: 'n.example · Orders' } }];
  it('SH-6: a word that starts like a month is no month', () => {
    expect(strayNumberOf("Eaton's data-center orders declined 5% last quarter.", dec5)).toBe('5');
    expect(strayNumberOf('Shipments decreased 5.5% in the quarter.', dec5)).toBe('5.5');
    expect(strayNumberOf('Shipments declined 5,500 units.', dec5)).toBe('5500');
    const mar12 = [{ ...dec5[0], at: '2026-03-12T00:00:00.000Z', asOf: '2026-03-12T00:00:00.000Z' }];
    expect(strayNumberOf('Its operating margin 12% held.', mar12)).toBe('12');
    // a plain number after the word (no % or decimal for the date rule's own lookahead to reject) — the month test alone
    expect(strayNumberOf('Shipments declined 5 units in the quarter.', dec5)).toBe('5');
    expect(strayNumberOf('Its margin 12 points held.', mar12)).toBe('12');
    expect(strayNumberOf('Eaton reported on Dec 5.', dec5)).toBeUndefined();
  });
  it('SH-7: an undated fact\'s read day dates nothing: a summary that names it is withheld', () => {
    const undated = validateStepTurn(turn({ findings: [f({ support: { kind: 'retrieval', index: 1, from: [], reason: null } })], summary: { text: 'Eaton signed the switchgear deal on November 12, 2026.', basedOn: ['t1'] } }), ctx());
    expect(undated.findings[0].source.label.endsWith(' · undated')).toBe(true);
    expect(undated).toMatchObject({ ok: true, summary: null });
    const dated = validateStepTurn(turn({ summary: { text: 'Eaton sells switchgear to data-center builders (reported November 6, 2026).', basedOn: ['t1'] } }), ctx());
    expect(dated.summary).not.toBeNull();
  });
  it('SH-8: a date in a fact\'s text backs no figure; that date itself may be named', () => {
    const held = [{ fact: 'On November 5, 2026, Eaton said data-center orders rose.', at: '2026-11-06T00:00:00.000Z', asOf: null, status: 'verified', source: { label: 'n.example · x' } }];
    expect(strayNumberOf('Eaton earns 5% of its sales from data centers.', held)).toBe('5');
    expect(strayNumberOf('Eaton said on November 5, 2026 that orders rose.', held)).toBeUndefined();
  });
});

describe('SH-9 / SH-13 — numbers the tokenizer must see, and ids it must not', () => {
  it('fullwidth digits read as digits; other scripts\' digits and odd spellings are never held by accident', () => {
    expect(numberTokensOf('Eaton earns ４０% of its orders.')).toEqual(['40']);
    expect(numberTokensOf('Eaton earns ٤٠% of its orders.')).toEqual(['raw:٤٠']);
    const held = [{ fact: 'Margins were 3%.', at: null, asOf: null, status: 'verified', source: { label: 'x' } }];
    expect(strayNumberOf('Margins were 3,75%.', held)).toBe('raw:3,75');
    expect(strayNumberOf('Margins rose .75 points.', held)).toBe('0.75');
    expect(numberTokensOf('$1,200 and 1.90x and 62%')).toEqual(['1200', '1.9', '62']);
  });
  it('an adopted statement in fullwidth digits is checked like any other', () => {
    const r = dataCenterRecord('d4');
    const carried = carriedFor(r, { supported: companiesOf(r, { names: NAMES }).supported, lines: null, symbols: ['ETN'] });
    let code = null;
    try { assertAssertionsSupported('Eaton earns ４０% of its orders from data centers.', { record: r, carried, selected: [{ symbol: 'ETN', name: NAMES.ETN }], deselected: [] }); } catch (e) { code = e instanceof AssertionError ? e.code : e; }
    expect(code).toBe('unsupported_assertion');
  });
  it('SH-13: a finding id in a claim\'s evidence is an id, not a number', () => {
    expect(numberTokensOf('finding f_00000000-0000-4000-8000-643400000000 shows it')).toEqual([]);
    const out = validateStepTurn(turn({ companies: [{ companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 't1', openRef: null, claim: { ...claim, effect: 'Eaton gains orders', evidence: 'finding f_00000000-0000-4000-8000-643400000000' } }] }), ctx());
    expect(out.findings.some((x) => x.kind === 'idea')).toBe(true);
  });
});

describe('SH-10 / SH-11 / SH-12 — no ticker outside the universe is written, from a title, a topic or a fullwidth claim', () => {
  it('SH-10: a retrieval title\'s stray ticker is masked in the label', () => {
    const label = retrievalLabelOf({ host: 'n.example', title: 'QZXW shares jump on Eaton deal' });
    expect(label).toContain(STRAY_TICKER_MASK);
    expect(label).not.toContain('QZXW');
  });
  it('SH-11: a drop topic with a stray ticker or a forbidden pattern is not kept', () => {
    expect(dropTopicOf({ parse: { topic: 'QZXW switchgear backlog' } })).toBeNull();
    expect(dropTopicOf({ parse: { topic: 'ＱＺＸＷ backlog' } })).toBeNull();
    expect(dropTopicOf({ parse: { topic: 'you should buy it now' } })).toBeNull();
    expect(dropTopicOf({ parse: { topic: 'Rook will buy more' } }, { partnerName: 'Rook' })).toBeNull();
    expect(dropTopicOf({ parse: { topic: 'switchgear backlog' } })).toBe('switchgear backlog');
    expect(dropTopicOf({ parse: {} })).toBeNull();
  });
  it('SH-12: a fullwidth stray ticker in a drop claim is not written; a fullwidth universe ticker reads as itself', () => {
    const drop = { input: { type: 'text', text: 'my words', note: null }, parse: { dataPoints: ['ＱＺＸＷ orders rose sharply', 'ＥＴＮ orders rose'] }, droppedAt: READ };
    const fs = openingFindingsOf({ entryKind: 'signaldrop', drop, playerExchange: { exchangeId: PARTNER, text: 'my words', at: READ }, names: ['ETN'], stored: {}, nowIso: NOW });
    expect(fs.filter((x) => x.statusReason === 'from_drop').map((x) => [x.fact, x.symbol])).toEqual([['ETN orders rose', 'ETN']]);
  });
});

describe('letter notes, built — FQ-2\'s rule for the story; NS-1 and no self-description in the prompt', () => {
  it('a story published after the open is undated: the open\'s time, " · undated", no asOf', () => {
    const fs = openingFindingsOf({ entryKind: 'item', story: { id: 's1', headline: 'H', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-12T20:00:00.000Z', primaryTicker: null, tickers: [] }, names: [], stored: {}, nowIso: NOW });
    expect(fs[0]).toMatchObject({ at: NOW, asOf: null });
    expect(fs[0].source.label.endsWith(' · undated')).toBe(true);
  });
  it('the step prompt never says a null next action means the question is answered, and asks for no self-description', () => {
    const p = buildStepSystemPrompt({ partnerName: 'Rook' });
    expect(p).not.toMatch(/question is answered/);
    expect(p).toContain('null when you have no next step to propose');
    expect(p).toContain('Write no sentence about yourself or your own process');
    expect(forbiddenIn(p, { partnerName: 'Rook' })).toEqual([]);
  });
  it('SH-s (NS-1): a model next action that claims the question is answered is not written; the plain marker stands', () => {
    const prior = { findingId: 'f_00000000-0000-4000-8000-6e6100000000', kind: 'next_action', symbol: null, fact: 'Find the source.', source: { recordKind: 'kb', recordId: 'baseline@v0', label: 'Baseline method v0' }, at: READ, asOf: null, status: 'unverified', statusReason: 'proposed', pin: null, supersedes: null };
    const r = { ...dataCenterRecord('refresh'), findings: [...dataCenterRecord('refresh').findings, prior] };
    for (const nextAction of [{ label: 'None needed', purpose: 'The question is answered by the current findings.' }, { label: 'No further steps needed', purpose: '' }]) {
      const out = validateStepTurn(turn({ nextAction }), ctx({ record: r }));
      expect(out.findings.at(-1)).toMatchObject({ kind: 'next_action', fact: 'No next step proposed.', statusReason: 'no_next_step' });
      expect(out.notes).toContain('next_action_claims_answered');
    }
    expect(validateStepTurn(turn({ nextAction: { label: 'Find the filing', purpose: 'Answer whether orders grew.' } }), ctx({ record: r })).findings.at(-1).fact).toBe('Find the filing — Answer whether orders grew.');
  });
});

// ── record integrity ─────────────────────────────────────────────────────────

const ITEM = { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Who earns from the switchgear backlog?', direction: null, topic: null, names: ['ETN'] };
const AGENT = { ownerId: OWNER, name: 'Rook', archetype: 'contrarian' };
const T = (m) => `2026-11-12T15:${String(m).padStart(2, '0')}:00.000Z`;
const STEP = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const opening = (nowIso) => [buildFinding({
  kind: 'coverage', symbol: null, fact: 'Switchgear lead times stretch.', source: { recordKind: 'fantasyTimesStories', recordId: 'story-1', label: 'FantasyTimes · Kim' },
  at: '2026-11-10T13:00:00.000Z', asOf: '2026-11-10T13:00:00.000Z', status: 'unverified', statusReason: 'reporter_content',
}, { findingId: `f_72000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, nowIso })];

describe('SI-1 — `previous` is the last investigation to end, whatever a late write does', () => {
  it('a step failure landing on an ended investigation keeps its close time, and `previous` is still the newest', async () => {
    const env = makeSrFirestore({ 'agents/agent-1': AGENT });
    const open = (id, at) => openFromItem(env.db, { uid: OWNER, requestId: id, sessionId: `s-${id}`, entry: ITEM, exchanges: [], findings: opening(at), nowIso: at });
    const close = (sid, at) => closeInvestigation(env.db, { uid: OWNER, sessionId: sid, reason: 'abandoned', closeExchange: exchangeOf({ who: 'player', kind: 'close', text: 'x', at }), nowIso: at });
    await open('A', T(0));
    await beginStep(env.db, { uid: OWNER, sessionId: 's-A', stepId: STEP, intent: 'next', nowIso: T(2) });
    await close('s-A', T(5));
    await open('B', T(8));
    await close('s-B', T(12));
    expect(await failStep(env.db, { uid: OWNER, sessionId: 's-A', stepId: STEP, reason: 'session_not_open', nowIso: T(20) })).toBe(true);
    expect(env.doc('sharedResearchSessions/s-A').updatedAt).toBe(T(5));
    const c = await open('C', T(25));
    expect(c.previous).toEqual({ sessionId: 's-B', endedAt: T(12), terminalReason: 'user_close' });
  });
  it('the pure rule: newest created first', () => {
    const a = { sessionId: 'a', status: 'abandoned', createdAt: T(0), updatedAt: T(20) };
    const b = { sessionId: 'b', status: 'completed', createdAt: T(8), updatedAt: T(12) };
    expect(previousSessionOf([a, b], { sessionId: 'c', createdAt: T(25) })).toBe(b);
  });
});

describe('SI-2 — a step refused before its model call gives its counted call back', () => {
  it('refundCall: both daily counts go back down; a failure after a call keeps them', async () => {
    const env = makeSrFirestore({ 'agents/agent-1': AGENT });
    await openFromItem(env.db, { uid: OWNER, requestId: 'r', sessionId: 's1', entry: ITEM, exchanges: [], findings: opening(T(0)), nowIso: T(0) });
    await beginStep(env.db, { uid: OWNER, sessionId: 's1', stepId: STEP, intent: 'next', nowIso: T(1) });
    expect([env.doc(`sharedResearchQuota/${OWNER}`).stepCalls, env.doc('sharedResearchQuota/_global').stepCalls]).toEqual([1, 1]);
    await failStep(env.db, { uid: OWNER, sessionId: 's1', stepId: STEP, reason: 'invalid_target', nowIso: T(1), refundCall: true });
    expect([env.doc(`sharedResearchQuota/${OWNER}`).stepCalls, env.doc('sharedResearchQuota/_global').stepCalls]).toEqual([0, 0]);
    const STEP2 = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6e';
    await beginStep(env.db, { uid: OWNER, sessionId: 's1', stepId: STEP2, intent: 'next', nowIso: T(2) });
    await failStep(env.db, { uid: OWNER, sessionId: 's1', stepId: STEP2, reason: 'invalid_unparseable', nowIso: T(3) });
    expect(env.doc(`sharedResearchQuota/${OWNER}`).stepCalls).toBe(1);
  });
  it('a call counted on another ET day is never refunded into today', async () => {
    const env = makeSrFirestore({ 'agents/agent-1': AGENT });
    await openFromItem(env.db, { uid: OWNER, requestId: 'r', sessionId: 's1', entry: ITEM, exchanges: [], findings: opening('2026-11-11T20:00:00.000Z'), nowIso: '2026-11-11T20:00:00.000Z' });
    await beginStep(env.db, { uid: OWNER, sessionId: 's1', stepId: STEP, intent: 'next', nowIso: '2026-11-12T04:59:00.000Z' }); // 23:59 ET on the 11th
    env.store.set(`sharedResearchQuota/${OWNER}`, { etDate: '2026-11-12', investigationsOpened: 0, framingsRun: 0, stepCalls: 4 });
    await failStep(env.db, { uid: OWNER, sessionId: 's1', stepId: STEP, reason: 'deadline', nowIso: '2026-11-12T05:00:30.000Z', refundCall: true });
    expect(env.doc(`sharedResearchQuota/${OWNER}`).stepCalls).toBe(4);
  });
});

describe('SI-3 — a requestId names one request in both directions', () => {
  it('an item\'s requestId never answers a framing', async () => {
    const env = makeSrFirestore({ 'agents/agent-1': AGENT });
    await openFromItem(env.db, { uid: OWNER, requestId: 'shared-id', sessionId: 's1', entry: ITEM, exchanges: [], findings: opening(T(0)), nowIso: T(0) });
    const err = await beginFraming(env.db, { uid: OWNER, requestId: 'shared-id', observation: 'o', playerExchange: exchangeOf({ who: 'player', kind: 'observation', text: 'o', at: T(1) }), sessionId: 'f1', nowIso: T(1) }).catch((e) => e);
    expect([err.status, err.code]).toEqual([400, 'invalid_request']);
    expect(env.store.has('sharedResearchSessions/f1')).toBe(false);
  });
});
