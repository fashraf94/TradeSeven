// api/_utils/sharedResearch/reviewFixes.test.js
//
// Shared Research B1 — rows for the four-lens review's confirmed findings
// (build report §Review; BUILD_RULES §2), each named by its finding id: the
// defect the reviewer reproduced, now refused or corrected.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked imports below
// are the runtime guard for these modules' graphs. Never mock them.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateStepTurn, forbiddenIn, retrievalDatesOf, modelDayOf, strayNumberOf } from './stepSchema.js';
import { namesCompany, coreNameOf, companiesOf } from './companies.js';
import { adoptPreviewOf, assertAssertionsSupported, AssertionError, carriedFor, KEPT_FINDINGS_MAX } from './adoptPreview.js';
import { openingFindingsOf, dropTextOf, maskStrayTickers, STRAY_TICKER_MASK } from './opening.js';
import { stepAdmissionOf, exchangeOf, openSessionOf, etDateOf } from './session.js';
import { beginStep, openFromItem, globalStepCeiling, GLOBAL_STEPS_ENV } from './store.js';
import { makeSrFirestore } from './__fixtures__/srFirestore.js';
import { buildFinding } from '../researchRecords/model.js';
import { dataCenterRecord, fid, withFindings, baseRecord, OWNER, SESSION_ID, RECORD_ID } from './__fixtures__/records.js';

const READ = '2026-11-12T15:00:00.000Z';
const NOW = '2026-11-12T15:00:05.000Z';
const PARTNER = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const ITEMS = [{ index: 0, url: 'https://n.example/a', title: 'Orders', host: 'n.example', publishedDate: '2026-11-06T00:00:00.000Z' },
  { index: 1, url: 'https://n.example/b', title: 'No date', host: 'n.example', publishedDate: null }];
const NAMES = { ETN: 'Eaton Corporation plc' };
let n = 0;
const ctx = (over = {}) => ({ record: dataCenterRecord('refresh'), items: ITEMS, readAt: READ, partnerExchangeId: PARTNER, partnerAt: NOW, nowIso: NOW, mintFindingId: () => `f_70000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names: NAMES, ...over });
const f = (over = {}) => ({ tempId: 't1', kind: 'relationship', fact: 'Eaton sells switchgear to data-center builders.', symbolCandidate: 'ETN', companyName: 'Eaton', support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null, ...over });
const turn = (over = {}) => ({ reply: 'r', findings: [f()], summary: null, lines: { support: null, complication: null, missing: null }, nextAction: { label: 'Next', purpose: 'p' }, companies: [], ...over });

describe('B1 — a symbol never borrows another company\'s fact', () => {
  it('companyName Vertiv with symbolCandidate ETN: no symbol, the fact names Vertiv, Eaton is not supported', () => {
    const out = validateStepTurn(turn({ findings: [f({ companyName: 'Vertiv', fact: 'Vertiv sells cooling units to data-center builders.' })] }), ctx());
    expect(out.ok).toBe(true);
    expect(out.findings[0]).toMatchObject({ symbol: null, fact: 'Other · Vertiv: Vertiv sells cooling units to data-center builders.' });
    expect(out.notes).toContain('identity_mismatch:ETN');
    let r = dataCenterRecord('refresh');
    for (const x of out.findings) r = { ...r, findings: [...r.findings, x] };
    expect(companiesOf(r, { names: NAMES }).supported).toEqual([]);
  });
  it('a company name written as its ticker resolves; the right company keeps its symbol', () => {
    expect(validateStepTurn(turn({ findings: [f({ companyName: 'ETN', symbolCandidate: null })] }), ctx()).findings[0].symbol).toBe('ETN');
    expect(validateStepTurn(turn(), ctx()).findings[0].symbol).toBe('ETN');
  });
  it('with no stored name for the symbol, a name that is not the symbol cannot be checked: no symbol', () => {
    expect(validateStepTurn(turn(), ctx({ names: {} })).findings[0].symbol).toBeNull();
  });
});

describe('B2 — a date part is not a held number', () => {
  const held = [{ fact: 'Eaton said orders rose.', at: '2026-11-05T00:00:00.000Z', asOf: '2026-11-05T00:00:00.000Z', status: 'verified' }];
  it('5%, 11% and 2026 are not excused by a finding dated 2026-11-05', () => {
    expect(strayNumberOf('Eaton earns 5% of its sales from data centers.', held)).toBe('5');
    expect(strayNumberOf('Eaton earns 11% of its sales.', held)).toBe('11');
    expect(strayNumberOf('Eaton earns 2026 dollars.', held)).toBe('2026');
  });
  it('the finding\'s own date, written ISO or in words, is excused', () => {
    expect(strayNumberOf('Orders rose (reported 2026-11-05).', held)).toBeUndefined();
    expect(strayNumberOf('Orders rose, Eaton said on November 5, 2026.', held)).toBeUndefined();
    expect(strayNumberOf('Orders rose on Nov 5.', held)).toBeUndefined();
    expect(strayNumberOf('Orders rose on Nov 6.', held)).toBe('6');
  });
  it('an adopted statement cannot borrow the step\'s date for a figure', () => {
    const r = dataCenterRecord('d4');
    const carried = carriedFor(r, { supported: companiesOf(r, { names: NAMES }).supported, lines: null, symbols: ['ETN'] });
    const refusal = () => { try { assertAssertionsSupported('Eaton earns 5% of its sales from data centers.', { record: r, carried, selected: [{ symbol: 'ETN', name: NAMES.ETN }], deselected: [] }); return null; } catch (e) { return e instanceof AssertionError ? e.code : e; } };
    expect(refusal()).toBe('unsupported_assertion');
  });
});

describe('B3 — as built, the spec\'s letter (rule 6, §6.6): any cited or carried finding backs a number (founder question FQ-5)', () => {
  it('a summary number held only by a cited inference passes; one held by no cited finding fails', () => {
    const inferred = f({ tempId: 'i1', kind: 'inference', fact: 'Data centers are likely about 40% of orders.', symbolCandidate: null, companyName: null, support: { kind: 'inference', index: null, from: [], reason: null } });
    expect(validateStepTurn(turn({ findings: [inferred], summary: { text: 'About 40% of orders come from data centers.', basedOn: ['i1'] } }), ctx()).ok).toBe(true);
    expect(validateStepTurn(turn({ findings: [inferred], summary: { text: 'About 45% of orders come from data centers.', basedOn: ['i1'] } }), ctx())).toMatchObject({ ok: false, rule: 'unsupported_number', detail: '45' });
  });
  it('an adoption number held by the carried open question passes; one no carried finding holds fails', () => {
    let r = dataCenterRecord('d4');
    r = withFindings(r, [['oq', { kind: 'relationship', symbol: 'ETN', fact: "Supplier · Eaton's data-center share, perhaps 40% of orders, is not disclosed.", source: { recordKind: 'exchange', recordId: PARTNER, label: 'Not yet checked' }, at: NOW, asOf: null, status: 'unavailable', statusReason: 'not_disclosed' }]], NOW);
    const supported = companiesOf(r, { names: NAMES }).supported;
    const carried = carriedFor(r, { supported, lines: null, symbols: ['ETN'] });
    expect(carried).toContain(fid('oq'));
    expect(() => assertAssertionsSupported('Eaton earns 40% of its orders from data centers.', { record: r, carried, selected: [{ symbol: 'ETN', name: NAMES.ETN }], deselected: [] })).not.toThrow();
    expect(() => assertAssertionsSupported('Eaton earns 45% of its orders from data centers.', { record: r, carried, selected: [{ symbol: 'ETN', name: NAMES.ETN }], deselected: [] })).toThrow('unsupported_assertion');
  });
});

describe('B4 — the model\'s date is a strict calendar day', () => {
  it('"2026", "Nov 5", "11/05" and 2026-02-30 are no date: the published date, else the read time and " · undated"', () => {
    for (const bad of ['2026', '2026-11', 'Nov 5', 'November 5', '11/05', '2026-02-30', '2026-11-31']) expect(modelDayOf(bad)).toBeNull();
    expect(modelDayOf('2026-11-05')).toBe('2026-11-05T00:00:00.000Z');
    expect(retrievalDatesOf({ modelAt: 'Nov 5', publishedDate: null, readAt: READ, writeAt: NOW })).toEqual({ at: READ, asOf: null, undated: true });
    expect(retrievalDatesOf({ modelAt: '2026-02-30', publishedDate: '2026-11-06T00:00:00.000Z', readAt: READ, writeAt: NOW }).at).toBe('2026-11-06T00:00:00.000Z');
  });
  it('a published date later than the read is still the published date (§15 S-2\'s letter); asOf never the write time', () => {
    expect(retrievalDatesOf({ modelAt: null, publishedDate: '2026-12-01T00:00:00.000Z', readAt: READ, writeAt: NOW })).toEqual({ at: '2026-12-01T00:00:00.000Z', asOf: null, undated: false });
  });
});

describe('B5 — what a step may supersede', () => {
  const withObservation = () => withFindings(baseRecord({ question: 'Q?' }), [['ob', { kind: 'observation', symbol: null, fact: 'Security reviews delay my deals.', source: { recordKind: 'exchange', recordId: PARTNER, label: 'Your words' }, at: READ, asOf: null, status: 'unverified', statusReason: 'player_words' }],
    ['vf', { kind: 'earnings_fact', symbol: 'ETN', fact: 'Consensus growth for ETN is 12%.', source: { recordKind: 'estimatesCache', recordId: 'latest', label: 'x' }, at: READ, asOf: READ, status: 'verified', statusReason: null }]], NOW);
  const inf = (over) => f({ kind: 'inference', symbolCandidate: null, companyName: null, support: { kind: 'inference', index: null, from: [], reason: null }, ...over });
  it('never the player\'s words', () => {
    expect(validateStepTurn(turn({ findings: [inf({ fact: 'Security reviews slow deals across the industry.', supersedes: fid('ob') })] }), ctx({ record: withObservation() }))).toMatchObject({ ok: false, rule: 'invalid_supersedes' });
  });
  it('rule 5\'s letter: an inference may supersede a verified fact (founder question FQ-4); so may an unavailable correction', () => {
    expect(validateStepTurn(turn({ findings: [inf({ fact: 'Growth is probably near 25%.', supersedes: fid('vf') })] }), ctx({ record: withObservation() })).ok).toBe(true);
    const unresolved = f({ kind: 'earnings_fact', fact: 'The consensus figure could not be confirmed.', support: { kind: 'unresolved', index: null, from: [], reason: 'single_source' }, supersedes: fid('vf') });
    expect(validateStepTurn(turn({ findings: [unresolved] }), ctx({ record: withObservation() })).ok).toBe(true);
  });
});

describe('B6 — the forbidden patterns: misses closed, honest prose passes', () => {
  it('the misses', () => {
    expect(forbiddenIn('Atlas will buy Eaton.', { partnerName: 'Atlas' })).toContain('will_do');
    expect(forbiddenIn('Atlas has learned that switchgear matters.', { partnerName: 'Atlas' })).toContain('learning_claim');
    expect(forbiddenIn('Your agents learn from every investigation.')).toContain('learning_claim');
    expect(forbiddenIn('The agent improved its picks after this step.')).toContain('learning_claim');
    expect(forbiddenIn('I am 80 per cent confident in this link.')).toContain('confidence_number');
    expect(forbiddenIn('Eaton shares could climb to $400 by spring.')).toContain('price_forecast');
    expect(forbiddenIn('Buy ETN before the next report.')).toContain('buy_sell_advice');
    expect(forbiddenIn('Eaton is a buy.')).toContain('buy_sell_advice');
    expect(forbiddenIn('I have 80％ confidence.')).toContain('confidence_number');
    expect(forbiddenIn('This guar​antees orders.')).toContain('guarantee');
    expect(forbiddenIn('The agent considered Eaton.')).toContain('considered');
    // rule 7 names the bare word: honest prose using it fails too (founder question FQ-3)
    expect(forbiddenIn('Eaton is widely considered the largest switchgear supplier.')).toEqual(['considered']);
  });
  it('honest business prose', () => {
    for (const s of ['The deal unlocks new orders for Eaton, a partner of the builder.',
      'Customers can learn more through the partner portal.', 'Sell-side analysts raised estimates.', 'Short interest rose last month.', 'Margins improved and revenue grew.']) {
      expect(forbiddenIn(s), s).toEqual([]);
    }
  });
});

describe('B7 — company names', () => {
  it('core names and distinctive words', () => {
    expect(coreNameOf('Amazon.com, Inc.')).toBe('Amazon');
    expect(coreNameOf('JPMorgan Chase & Co.')).toBe('JPMorgan Chase');
    expect(namesCompany('Meta gains from it.', { symbol: 'META', name: 'Meta Platforms, Inc.' })).toBe(true);
    expect(namesCompany('Disney gains from it.', { symbol: 'DIS', name: 'The Walt Disney Company' })).toBe(true);
    expect(namesCompany('JPMorgan leads it.', { symbol: 'JPM', name: 'JPMorgan Chase & Co.' })).toBe(true);
  });
  it('a one- or two-letter symbol is not matched as a bare word', () => {
    expect(namesCompany('Eaton led the Series C round.', { symbol: 'C', name: 'Citigroup Inc.' })).toBe(false);
    expect(namesCompany('Citigroup led the round.', { symbol: 'C', name: 'Citigroup Inc.' })).toBe(true);
  });
});

describe('B8 / B11 — the opening writes no stray ticker and dates honestly', () => {
  const drop = { input: { type: 'text', text: 'my words', note: null }, parse: { dataPoints: ['VRT has a price target of 200 and you should buy it now', 'orders up 20%'] }, droppedAt: READ };
  const EX = { exchangeId: PARTNER, text: 'my words', at: READ };
  it('a parser claim naming a stray ticker is not written (other wording is quoted as the drop\'s — FQ-6); a headline\'s stray ticker is masked', () => {
    const fs = openingFindingsOf({ entryKind: 'signaldrop', drop: { ...drop, parse: { dataPoints: [...drop.parse.dataPoints, 'you should buy it now'] } }, playerExchange: EX, names: [], stored: {}, nowIso: NOW });
    expect(fs.filter((x) => x.statusReason === 'from_drop').map((x) => x.fact)).toEqual(['orders up 20%', 'you should buy it now']);
    expect(maskStrayTickers('VRT and ETN race to add capacity')).toBe(`${STRAY_TICKER_MASK} and ETN race to add capacity`);
  });
  it('a story with no publication time is labeled " · undated"; a blank text drop is not called an image', () => {
    const fs = openingFindingsOf({ entryKind: 'item', story: { id: 's1', headline: 'H', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: null, primaryTicker: null, tickers: [] }, names: [], stored: {}, nowIso: NOW });
    expect(fs[0].source.label.endsWith(' · undated')).toBe(true);
    expect(dropTextOf({ input: { type: 'text', text: '  ', note: null } })).toBe('Your drop held no text');
  });
});

describe('B9 / B10 — leads and roles come from the server\'s own prefixes', () => {
  it('a colon in prose does not invent a company', () => {
    const out = validateStepTurn(turn({ findings: [f({ kind: 'product', fact: 'Switchgear lead times: over a year at most makers.', symbolCandidate: null, companyName: null })] }), ctx());
    expect(out.findings[0].fact).toBe('Switchgear lead times — over a year at most makers.');
    let r = dataCenterRecord('step1');
    r = { ...r, findings: [...r.findings, out.findings[0]] };
    expect(companiesOf(r).leads.map((l) => l.name)).toEqual(['Northfield Thermal']);
  });
  it('the role comes from the company that IS the finding\'s company', () => {
    const out = validateStepTurn(turn({ companies: [
      { companyName: 'Apple', symbolCandidate: 'AAPL', role: 'Customer', relationshipRef: 't1', openRef: null, claim: null },
      { companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 't1', openRef: null, claim: null },
    ] }), ctx({ names: { ...NAMES, AAPL: 'Apple Inc.' } }));
    expect(out.findings[0].fact.startsWith('Supplier · ')).toBe(true);
  });
});

describe('A3 — any completed stepId is a replay', () => {
  it('an older completed stepId (its partner exchange on the session) replays; a failed one stays retryable', () => {
    const s = { status: 'open', stepsUsed: 2, stepBudget: 10, lastStep: { stepId: 'b', status: 'completed' }, exchanges: [{ who: 'partner', kind: 'step', stepId: 'a' }, { who: 'player', kind: 'direction', stepId: 'c' }] };
    expect(stepAdmissionOf(s, { stepId: 'a', nowMs: Date.parse(NOW) })).toEqual({ replay: true });
    expect(stepAdmissionOf(s, { stepId: 'c', nowMs: Date.parse(NOW) })).toEqual({ ok: true, rerun: false });
  });
});

describe('A4 — a company carrying more than 28 findings is shown as not adoptable', () => {
  it('adoptable false with the reason, at 29', () => {
    let r = withFindings(baseRecord({ question: 'Q?' }), [['rel', { kind: 'relationship', symbol: 'SHOP', fact: 'Product owner · Shopify owns Shop Pay.', source: { recordKind: 'retrieval', recordId: 'https://x.example/r', label: 'x', url: 'https://x.example/r' }, at: READ, asOf: null, status: 'verified', statusReason: null }]], NOW);
    r = withFindings(r, Array.from({ length: 28 }, (_, i) => [`e${String(i).padStart(2, '0')}`, { kind: 'earnings_fact', symbol: 'SHOP', fact: `Fact ${i}.`, source: { recordKind: 'retrieval', recordId: `https://x.example/${i}`, label: 'x', url: `https://x.example/${i}` }, at: READ, asOf: null, status: 'verified', statusReason: null }]), NOW);
    const p = adoptPreviewOf(r, { companies: companiesOf(r, { names: { SHOP: 'Shopify Inc.' } }), lines: null });
    expect(p.companies[0]).toMatchObject({ symbol: 'SHOP', adoptable: false, reason: 'too_many_evidence_refs' });
    expect(p.companies[0].carried).toHaveLength(KEPT_FINDINGS_MAX + 1);
    expect(p.keptMax).toBe(28);
  });
});

describe('store — A1, A5, C1, C2, C7', () => {
  const RANKED = { ownerId: OWNER, name: 'Rook', archetype: 'contrarian' };
  const STAMP = { agentId: 'agent-1', archetypeCodeId: 'contrarian', baggerbombArchetypeCodeId: null, identityVersion: 2, at: NOW };
  let env;
  const seed = (record) => {
    env.store.set(`sharedResearchSessions/${SESSION_ID}`, openSessionOf({ sessionId: SESSION_ID, userId: OWNER, requestId: 'r', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, names: [] }, exchanges: [], attribution: STAMP, researchWorkId: RECORD_ID, nowIso: NOW }));
    env.store.set(`researchWork/${RECORD_ID}`, record);
  };
  const step = (stepId) => beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId, intent: 'next', nowIso: NOW });
  const code = async (p) => { try { await p; return null; } catch (e) { return e.code; } };
  beforeEach(() => { env = makeSrFirestore({ 'agents/agent-1': RANKED }); });
  afterEach(() => { delete process.env[GLOBAL_STEPS_ENV]; });

  it('A1: a record one finding short of full is refused findings_full BEFORE any call, nothing marked running', async () => {
    const full = dataCenterRecord('refresh');
    full.findings = [...full.findings, ...Array.from({ length: 99 - full.findings.length }, (_, i) => ({ ...full.findings[0], findingId: `f_80000000-0000-4000-8000-${String(i).padStart(12, '0')}` }))];
    seed(full);
    expect(await code(step('s1'))).toBe('findings_full');
    expect(env.doc(`sharedResearchSessions/${SESSION_ID}`).lastStep).toBeNull();
  });
  it('C1/C2: every admitted step CALL counts on the player\'s day and the app\'s; the 31st call of a player\'s day is step_limit', async () => {
    seed(dataCenterRecord('refresh'));
    await step('s1');
    expect(env.doc(`sharedResearchQuota/${OWNER}`).stepCalls).toBe(1);
    expect(env.doc('sharedResearchQuota/_global').stepCalls).toBe(1);
    env.store.set(`sharedResearchQuota/${OWNER}`, { etDate: etDateOf(NOW), investigationsOpened: 0, framingsRun: 0, stepCalls: 30 });
    env.store.get(`sharedResearchSessions/${SESSION_ID}`).lastStep = { stepId: 's1', status: 'failed' };
    expect(await code(step('s2'))).toBe('step_limit');
  });
  it('C1: the app\'s step calls stop at twice its step ceiling, failed steps included', async () => {
    seed(dataCenterRecord('refresh'));
    env.store.set('sharedResearchQuota/_global', { etDate: etDateOf(NOW), steps: 10, framings: 0, stepCalls: 300 });
    expect(await code(step('s1'))).toBe('budget_paused');
  });
  it('C7: SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY=0 pauses steps', async () => {
    process.env[GLOBAL_STEPS_ENV] = '0';
    expect(globalStepCeiling()).toBe(0);
    seed(dataCenterRecord('refresh'));
    expect(await code(step('s1'))).toBe('budget_paused');
  });
  it('A5: a requestId names one request: reusing a frame\'s for an item open is invalid_request', async () => {
    env.store.set('sharedResearchSessions/fs1', { sessionId: 'fs1', userId: OWNER, requestId: 'shared-id', status: 'framing', itemKey: null, exchanges: [] });
    const findings = [buildFinding({ kind: 'coverage', symbol: null, fact: 'H', source: { recordKind: 'fantasyTimesStories', recordId: 'story-1', label: 'x' }, at: READ, asOf: null, status: 'unverified', statusReason: 'reporter_content' }, { findingId: 'f_90000000-0000-4000-8000-000000000001', nowIso: NOW })];
    expect(await code(openFromItem(env.db, { uid: OWNER, requestId: 'shared-id', sessionId: 's-new', entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Q?', names: [] }, exchanges: [], findings, nowIso: NOW }))).toBe('invalid_request');
  });
  it('a direction exchange id is minted once (unchanged by the fixes)', () => {
    const a = exchangeOf({ who: 'player', kind: 'direction', text: 'x', at: NOW, stepId: 's' });
    expect(a.exchangeId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
