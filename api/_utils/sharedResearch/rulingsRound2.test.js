// api/_utils/sharedResearch/rulingsRound2.test.js
//
// Shared Research B1 — rows for the founder's round-2 rulings (spec §17, Nov 13):
// FQ-9 who is the agent, FQ-10 a chain that began Source-backed, FQ-11 the
// stale answer, FQ-14 what the model sees of the player's words, FQ-15 the
// reply's numbers. (FQ-12 and FQ-13: kept as built.)
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked imports below
// are the runtime guard for these modules' graphs. Never mock them.

import { describe, it, expect } from 'vitest';
import { validateStepTurn, forbiddenIn, replacedReplyOf, STRAY_TICKER_MASK } from './stepSchema.js';
import { projectionOf, answerStaleOf } from './companies.js';
import { renderStepUser, renderFrameUser } from './stepPrompt.js';
import { dataCenterRecord, withFindings, baseRecord, fid } from './__fixtures__/records.js';

const READ = '2026-11-12T15:00:00.000Z';
const NOW = '2026-11-12T15:00:05.000Z';
const EARLIER = '2026-11-10T00:00:00.000Z';
const PARTNER = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const ITEMS = [{ index: 0, url: 'https://n.example/a', title: 'Orders', host: 'n.example', publishedDate: '2026-11-06T00:00:00.000Z' }];
const NAMES = { ETN: 'Eaton Corporation plc' };
let n = 0;
const ctx = (over = {}) => ({ record: dataCenterRecord('refresh'), items: ITEMS, readAt: READ, partnerExchangeId: PARTNER, partnerAt: NOW, nowIso: NOW, mintFindingId: () => `f_73000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names: NAMES, ...over });
const f = (over = {}) => ({ tempId: 't1', kind: 'relationship', fact: 'Eaton sells switchgear to data-center builders.', symbolCandidate: 'ETN', companyName: 'Eaton', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null, ...over });
const turn = (over = {}) => ({ reply: 'r', findings: [f()], summary: null, lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Next', purpose: 'p' }, companies: [], ...over });
const src = (label) => ({ recordKind: 'exchange', recordId: PARTNER, label });
const retrieved = (url) => ({ recordKind: 'retrieval', recordId: url, label: 'n.example · x', url });

describe('FQ-9 — who is the agent: "the agent", "your/my/our agent(s)", the partner and its name, I, we', () => {
  it('a bare plural "agents" in business prose is no one of us', () => {
    for (const s of ['Leasing agents have considered lower rents.', 'AI agents are considered a growth driver for software sellers.',
      'The agents considered the offer.', 'Real estate agents learned the market quickly.']) {
      expect(forbiddenIn(s), s).toEqual([]);
    }
  });
  it('the agent, your/our agent(s), the partner\'s name, I and we still are', () => {
    for (const [s, hit] of [['The agent considered Eaton.', 'considered'], ['Your agent considered Eaton.', 'considered'], ['Our agent learned from this step.', 'learning_claim'],
      ['Your agents learn from every investigation.', 'learning_claim'], ['We considered three suppliers.', 'considered'], ['I considered the filing.', 'considered'],
      ['This connection was considered by the agent.', 'considered']]) {
      expect(forbiddenIn(s), s).toContain(hit);
    }
    expect(forbiddenIn('Rook considered the filing.', { partnerName: 'Rook' })).toContain('considered');
  });
});

describe('FQ-10 — in a chain that began Source-backed, the head may only be verified or unavailable, at any depth', () => {
  // v0 (verified) → u1 (unavailable, supersedes v0): u1 is the current head of a chain that began verified
  const chain = () => withFindings(withFindings(baseRecord({ question: 'Q?' }), [
    ['v0', { kind: 'earnings_fact', symbol: 'ETN', fact: 'Consensus growth for ETN is 12%.', source: { recordKind: 'estimatesCache', recordId: 'latest', label: 'x' }, at: READ, asOf: EARLIER, status: 'verified', statusReason: null }],
  ], READ), [
    ['u1', { kind: 'earnings_fact', symbol: 'ETN', fact: 'The consensus figure could not be confirmed.', source: src('Not yet checked'), at: READ, asOf: null, status: 'unavailable', statusReason: 'single_source', supersedes: fid('v0') }],
  ], READ);
  it('an inference never supersedes the unavailable head — by status, or by kind with unresolved support', () => {
    const byStatus = f({ kind: 'inference', fact: 'Growth is probably near 25%.', symbolCandidate: null, companyName: null, support: { kind: 'inference', index: null, from: [], reason: null }, supersedes: fid('u1') });
    expect(validateStepTurn(turn({ findings: [byStatus] }), ctx({ record: chain() }))).toMatchObject({ ok: false, rule: 'invalid_supersedes', detail: 't1:weaker' });
    const byKind = f({ kind: 'inference', fact: 'Growth may have slowed.', symbolCandidate: null, companyName: null, support: { kind: 'unresolved', index: null, from: [], reason: 'not_checked' }, supersedes: fid('u1') });
    expect(validateStepTurn(turn({ findings: [byKind] }), ctx({ record: chain() }))).toMatchObject({ ok: false, rule: 'invalid_supersedes', detail: 't1:weaker' });
  });
  it('a verified or an unavailable (non-inference) head may follow; a chain that began unverified is not guarded', () => {
    expect(validateStepTurn(turn({ findings: [f({ kind: 'earnings_fact', fact: 'Consensus growth for ETN is 13%.', supersedes: fid('u1') })] }), ctx({ record: chain() })).ok).toBe(true);
    expect(validateStepTurn(turn({ findings: [f({ kind: 'earnings_fact', fact: 'Still unconfirmed by a second source.', support: { kind: 'unresolved', index: null, from: [], reason: 'single_source' }, supersedes: fid('u1') })] }), ctx({ record: chain() })).ok).toBe(true);
    const guess = f({ kind: 'inference', fact: 'Makers with cooling lines may earn the most.', symbolCandidate: null, companyName: null, support: { kind: 'inference', index: null, from: [], reason: null }, supersedes: fid('d3') });
    expect(validateStepTurn(turn({ findings: [guess] }), ctx()).ok).toBe(true); // d3 began as an inference
  });
});

describe('FQ-11 — the read projection flags a stale answer; the next step\'s prompt asks for a revision', () => {
  const base = () => withFindings(baseRecord({ question: 'Q?' }), [
    ['a', { kind: 'coverage', symbol: null, fact: 'Lead times stretched past a year.', source: retrieved('https://n.example/a'), at: READ, asOf: EARLIER, status: 'verified', statusReason: null }],
  ], READ);
  it('answerStale: true when a basedOn finding is no longer current; false otherwise; false with no answer', () => {
    const answered = { ...base(), summary: { text: 'Lead times stretched past a year.', basedOn: [fid('a')], rev: 1, at: READ } };
    expect(answerStaleOf(answered)).toBe(false);
    expect(projectionOf(answered, { nowIso: NOW }).answerStale).toBe(false);
    const corrected = withFindings(answered, [['a2', { kind: 'coverage', symbol: null, fact: 'Lead times stretched past 18 months.', source: retrieved('https://n.example/a2'), at: READ, asOf: EARLIER, status: 'verified', statusReason: null, supersedes: fid('a') }]], READ);
    expect(answerStaleOf(corrected)).toBe(true);
    expect(projectionOf(corrected, { nowIso: NOW }).answerStale).toBe(true);
    expect(projectionOf(base(), { nowIso: NOW }).answerStale).toBe(false);
  });
  it('the step prompt states the answer must be revised only when it is stale', () => {
    const p = { question: 'Q?', entryKind: 'item', intent: 'next', stepsLeft: 3, findings: [], items: [], retrieval: 'none', summary: { rev: 1, text: 'An answer.' } };
    expect(renderStepUser({ ...p, answerStale: true })).toContain('This answer rests on a finding that has since been corrected. Revise it this step');
    expect(renderStepUser({ ...p, answerStale: false })).not.toContain('since been corrected');
  });
});

describe('FQ-14 — the model never sees a ticker the universe does not hold; the player\'s words stay verbatim in the record', () => {
  it('the frame prompt masks it in the player\'s observation', () => {
    const user = renderFrameUser({ observation: 'QZXW and ETN both sell power gear to builders.' });
    expect(user).toContain(STRAY_TICKER_MASK);
    expect(user).not.toContain('QZXW');
    expect(user).toContain('ETN');
  });
  it('the step prompt masks it in the question, the direction, the record\'s facts and the retrieved items', () => {
    const user = renderStepUser({
      question: 'Who earns like QZXW does?', entryKind: 'observation', intent: 'direction', direction: 'Look at QZXW first.', stepsLeft: 3, retrieval: 'items',
      findings: [{ findingId: fid('ob'), kind: 'observation', symbol: null, status: 'unverified', statusReason: 'player_words', fact: 'My deals need QZXW gear.' }],
      items: [{ index: 0, host: 'n.example', publishedDate: null, title: 'QZXW jumps', highlights: ['QZXW said orders rose.'] }],
    });
    expect(user).not.toContain('QZXW');
    expect(user.split(STRAY_TICKER_MASK).length - 1).toBe(5);
  });
});

describe('FQ-15 — the reply gets the summary\'s number check; a failing reply is replaced and the step lands', () => {
  it('a reply stating a number no Source-backed fact on the record holds is replaced; the findings still land', () => {
    const out = validateStepTurn(turn({ reply: 'Eaton earns 40% of its orders from data centers.' }), ctx());
    expect(out.ok).toBe(true);
    expect(out.reply).toBe('This step added 2 findings. The answer was not updated.');
    expect(out.notes).toContain('reply_replaced:unsupported_number:40');
    expect(out.findings).toHaveLength(2);
  });
  it('"finding" for one; a number the record holds is kept; when the answer WAS revised, the line says so', () => {
    expect(replacedReplyOf(1)).toBe('This step added 1 finding. The answer was not updated.');
    const one = validateStepTurn(turn({ reply: 'Eaton grew 40% last year.', nextAction: null }), ctx());
    expect(one.reply).toBe('This step added 1 finding. The answer was not updated.');
    expect(validateStepTurn(turn({ reply: 'Lead times stretched past a year in 2026.' }), ctx()).reply).toBe('Lead times stretched past a year in 2026.');
    const revised = validateStepTurn(turn({ reply: 'Eaton earns 40% of its orders.', summary: { text: 'Eaton sells switchgear to data-center builders.', basedOn: ['t1'] } }), ctx());
    expect(revised.summary).not.toBeNull();
    expect(revised.reply).toBe('This step added 2 findings. The answer was updated.');
  });
});
