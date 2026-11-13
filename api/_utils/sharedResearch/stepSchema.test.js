// api/_utils/sharedResearch/stepSchema.test.js
//
// Shared Research B1 — the step validator (spec §6.4, §15 S-2, S-3). Every rule,
// each with the defect it names: a non-existent item index, a foreign ticker, a
// forked supersedes, an unsupported number, a forbidden pattern, a kind the
// model may not write; and the S-2 dates and the S-3 record id.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked import of
// stepSchema.js is the runtime guard for its graph. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  validateStepTurn, validateFrame, ACRONYMS, strayTickersOf, forbiddenIn, numberTokensOf, retrievalRecordIdOf,
  retrievalLabelOf, retrievalDatesOf, STEP_SCHEMA, FRAME_SCHEMA, NO_NEXT_STEP_FACT,
} from './stepSchema.js';
import { ACRONYMS as HUDDLE_ACRONYMS } from '../huddle/scriptPrompt.js';
import { SOURCE_LABEL_MAX_LEN } from '../researchRecords/model.js';
import { dataCenterRecord, fid, DC_QUESTION, baseRecord } from './__fixtures__/records.js';

const PARTNER = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const READ = '2026-11-12T15:00:00.000Z';
const NOW = '2026-11-12T15:00:05.000Z';
const ITEMS = [
  { index: 0, url: 'https://news.example.com/eaton-orders', title: 'Eaton books data-center orders', host: 'news.example.com', publishedDate: '2026-11-06T00:00:00.000Z' },
  { index: 1, url: 'https://blog.example.org/no-date', title: 'An undated post about switchgear', host: 'blog.example.org', publishedDate: null },
];
let n = 0;
const mint = () => `f_10000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const ctx = (over = {}) => ({ record: dataCenterRecord('refresh'), items: ITEMS, readAt: READ, partnerExchangeId: PARTNER, partnerAt: NOW, nowIso: NOW, mintFindingId: mint, ...over });
const finding = (over = {}) => ({
  tempId: 't1', kind: 'relationship', fact: 'Eaton sells switchgear to data-center builders.', symbolCandidate: 'ETN', companyName: 'Eaton',
  support: { kind: 'retrieval', index: 0, from: [], reason: null }, at: null, supersedes: null, ...over,
});
const turn = (over = {}) => ({
  reply: 'Eaton sells switchgear to data-center builders.', findings: [finding()], summary: null,
  lines: { support: 't1', complication: null, missing: null }, nextAction: { label: 'Check how much of Eaton\'s sales go to data centers', purpose: 'The size is the weakest link.' },
  companies: [{ companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 't1', openRef: null, claim: null }],
  ...over,
});

describe('a clean turn', () => {
  it('becomes findings in order: the retrieved relationship (role-prefixed, verified, its url), then the next action superseding the current one', () => {
    const out = validateStepTurn(turn(), ctx());
    expect(out.ok).toBe(true);
    const [rel, next] = out.findings;
    expect(rel).toMatchObject({
      kind: 'relationship', symbol: 'ETN', status: 'verified', statusReason: null,
      fact: 'Supplier · Eaton sells switchgear to data-center builders.',
      source: { recordKind: 'retrieval', recordId: ITEMS[0].url, url: ITEMS[0].url, label: 'news.example.com · Eaton books data-center orders' },
      at: '2026-11-06T00:00:00.000Z', asOf: '2026-11-06T00:00:00.000Z',
    });
    expect(next).toMatchObject({ kind: 'next_action', status: 'unverified', statusReason: 'proposed', source: { recordKind: 'kb', recordId: 'baseline@v0' } });
    expect(out.lines.support).toBe(rel.findingId);
  });
});

describe('rule 1 — a retrieval support must name a real item', () => {
  it('a non-existent index downgrades the fact to an uncited inference — never verified', () => {
    const out = validateStepTurn(turn({ findings: [finding({ support: { kind: 'retrieval', index: 7, from: [], reason: null } })] }), ctx());
    expect(out.ok).toBe(true);
    expect(out.findings[0]).toMatchObject({ kind: 'inference', status: 'unverified', statusReason: 'uncited', source: { recordKind: 'exchange', recordId: PARTNER } });
    expect(out.findings.some((f) => f.status === 'verified')).toBe(false);
  });
  it('with no retrieval this step (readAt null) nothing can be verified', () => {
    const out = validateStepTurn(turn(), ctx({ items: [], readAt: null }));
    expect(out.findings.filter((f) => f.status === 'verified')).toEqual([]);
  });
  it('an inference support citing a finding the step did not write and the record does not hold is refused invalid_source', () => {
    const out = validateStepTurn(turn({ findings: [finding({ kind: 'inference', support: { kind: 'inference', index: null, from: ['f_99999999-0000-4000-8000-000000000000'], reason: null } })] }), ctx());
    expect(out).toMatchObject({ ok: false, rule: 'invalid_source' });
  });
  it('an unresolved support is unavailable with its typed reason', () => {
    const out = validateStepTurn(turn({ findings: [finding({ support: { kind: 'unresolved', index: null, from: [], reason: 'not_disclosed' } })] }), ctx());
    expect(out.findings[0]).toMatchObject({ status: 'unavailable', statusReason: 'not_disclosed', source: { recordKind: 'exchange', label: 'Not yet checked' } });
  });
  it('an inference that could not be checked is an unavailable inference, not a failed step (the recorded probe wrote one)', () => {
    const out = validateStepTurn(turn({ findings: [finding({ kind: 'inference', support: { kind: 'unresolved', index: null, from: [], reason: 'not_disclosed' } })], companies: [] }), ctx());
    expect(out.ok).toBe(true);
    expect(out.findings[0]).toMatchObject({ kind: 'inference', status: 'unavailable', statusReason: 'not_disclosed' });
  });
});

describe('§15 S-2 — a retrieved fact\'s dates', () => {
  it('the model\'s date wins when it is a real date no later than the read; asOf is the published date', () => {
    expect(retrievalDatesOf({ modelAt: '2026-10-28', publishedDate: '2026-11-06T00:00:00.000Z', readAt: READ, writeAt: NOW }))
      .toEqual({ at: '2026-10-28T00:00:00.000Z', asOf: '2026-11-06T00:00:00.000Z', undated: false });
  });
  it('(a) a model date later than the read time is ignored: the published date is next', () => {
    expect(retrievalDatesOf({ modelAt: '2026-12-01', publishedDate: '2026-11-06T00:00:00.000Z', readAt: READ, writeAt: NOW }))
      .toEqual({ at: '2026-11-06T00:00:00.000Z', asOf: '2026-11-06T00:00:00.000Z', undated: false });
  });
  it('(b) no fact date and no published date: `at` is the read time, asOf null, and the label ends " · undated"', () => {
    const out = validateStepTurn(turn({ findings: [finding({ support: { kind: 'retrieval', index: 1, from: [], reason: null } })] }), ctx());
    expect(out.findings[0]).toMatchObject({ at: READ, asOf: null, status: 'verified' });
    expect(out.findings[0].source.label).toBe('blog.example.org · An undated post about switchgear · undated');
  });
  it('the undated suffix survives a long title: the title is what is trimmed, the label stays within 120', () => {
    const label = retrievalLabelOf({ host: 'blog.example.org', title: 'x'.repeat(300) }, { undated: true });
    expect(label.length).toBeLessThanOrEqual(SOURCE_LABEL_MAX_LEN);
    expect(label.endsWith(' · undated')).toBe(true);
  });
  it('never the write time as asOf: a published date at or after the write is null', () => {
    expect(retrievalDatesOf({ modelAt: null, publishedDate: NOW, readAt: READ, writeAt: NOW }).asOf).toBeNull();
  });
});

describe('§15 S-3 — a retrieval source\'s record id', () => {
  it('the url when it fits 256; otherwise url-sha256 of it, and the full url still in source.url', () => {
    expect(retrievalRecordIdOf('https://a.example/x')).toBe('https://a.example/x');
    const long = `https://a.example/${'p'.repeat(400)}`;
    expect(retrievalRecordIdOf(long)).toMatch(/^url-sha256:[0-9a-f]{64}$/);
    const out = validateStepTurn(turn(), ctx({ items: [{ ...ITEMS[0], url: long }] }));
    expect(out.findings[0].source).toMatchObject({ recordId: retrievalRecordIdOf(long), url: long });
  });
});

describe('rule 2 — no ticker the universe does not hold', () => {
  it('a symbol outside ALL_TICKERS is never written: the finding\'s symbol is null and the company is named in its fact', () => {
    const out = validateStepTurn(turn({ findings: [finding({ symbolCandidate: 'VRT', companyName: 'Vertiv' })], companies: [] }), ctx());
    // No company cites the finding, so its role is "Other"; the unresolved company is named first.
    expect(out.findings[0]).toMatchObject({ symbol: null, fact: 'Other · Vertiv: Eaton sells switchgear to data-center builders.' });
  });
  it('a ticker-shaped word outside the universe, the index names and the acronyms fails the step', () => {
    expect(validateStepTurn(turn({ findings: [finding({ fact: 'VRT sells cooling gear.' })] }), ctx())).toMatchObject({ ok: false, rule: 'stray_ticker' });
    expect(validateStepTurn(turn({ reply: 'TSMC builds the chips.' }), ctx())).toMatchObject({ ok: false, rule: 'stray_ticker' });
    expect(strayTickersOf('ETN and SPY rose; the CEO spoke about AI and EPS.')).toEqual([]);
  });
  it('ACRONYMS is the Huddle script\'s list, exactly (the S1 note: one list to share)', () => {
    expect([...ACRONYMS]).toEqual([...HUDDLE_ACRONYMS]);
  });
});

describe('rule 3 — the kinds the model may write', () => {
  for (const kind of ['observation', 'check_receipt', 'setup', 'idea', 'next_action']) {
    it(`${kind} from the model fails the step`, () => {
      expect(validateStepTurn(turn({ findings: [finding({ kind })] }), ctx())).toMatchObject({ ok: false, rule: 'invalid_kind' });
    });
  }
});

describe('rule 4 — a claim only for a supported company', () => {
  const claim = { effect: 'Eaton gains orders', relationship: 'as a supplier of switchgear', evidence: 'the order report', uncertainty: 'the size is not disclosed' };
  it('a supported company (resolved symbol, verified relationship with that symbol) gets an idea finding', () => {
    const out = validateStepTurn(turn({ companies: [{ companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 't1', openRef: null, claim }] }), ctx());
    const idea = out.findings.find((f) => f.kind === 'idea');
    expect(idea).toMatchObject({ symbol: 'ETN', status: 'unverified', statusReason: 'proposed_claim', source: { label: 'Proposed claim' } });
  });
  it('an unverified relationship, or a symbol outside the universe, writes no claim', () => {
    const inferred = turn({ findings: [finding({ support: { kind: 'unresolved', index: null, from: [], reason: 'not_checked' } })], companies: [{ companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 't1', openRef: null, claim }] });
    expect(validateStepTurn(inferred, ctx()).findings.some((f) => f.kind === 'idea')).toBe(false);
    const foreign = turn({ companies: [{ companyName: 'Vertiv', symbolCandidate: 'VRT', role: 'Supplier', relationshipRef: 't1', openRef: null, claim }] });
    expect(validateStepTurn(foreign, ctx()).findings.some((f) => f.kind === 'idea')).toBe(false);
  });
  it('a claim with a number its company\'s verified facts do not hold is not written', () => {
    const out = validateStepTurn(turn({ companies: [{ companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 't1', openRef: null, claim: { ...claim, effect: 'Eaton gains 40% more orders' } }] }), ctx());
    expect(out.findings.some((f) => f.kind === 'idea')).toBe(false);
    expect(out.notes).toContain('claim_unsupported_number:ETN');
  });
  it('a company citing a relationship the step did not write is refused invalid_source', () => {
    expect(validateStepTurn(turn({ companies: [{ companyName: 'Eaton', symbolCandidate: 'ETN', role: 'Supplier', relationshipRef: 't9', openRef: null, claim: null }] }), ctx()))
      .toMatchObject({ ok: false, rule: 'invalid_source' });
  });
});

describe('rule 5 — corrections name a current finding, never a fork', () => {
  it('supersedes naming no current finding fails', () => {
    expect(validateStepTurn(turn({ findings: [finding({ supersedes: fid('zz') })] }), ctx())).toMatchObject({ ok: false, rule: 'invalid_supersedes' });
  });
  it('two corrections of one finding in one step fail as a forked chain', () => {
    const two = turn({ findings: [finding({ tempId: 'a', supersedes: fid('d3'), kind: 'inference', support: { kind: 'inference', index: null, from: [], reason: null } }), finding({ tempId: 'b', supersedes: fid('d3'), kind: 'inference', support: { kind: 'inference', index: null, from: [], reason: null } })], companies: [] });
    expect(validateStepTurn(two, ctx())).toMatchObject({ ok: false, rule: 'forked_chain' });
  });
  it('a finding already superseded on the record is not current: correcting it fails', () => {
    const r = dataCenterRecord('d4x');
    expect(validateStepTurn(turn({ findings: [finding({ supersedes: fid('d4') })] }), ctx({ record: r }))).toMatchObject({ ok: false, rule: 'invalid_supersedes' });
  });
});

describe('rule 6 — the summary', () => {
  it('rests on 1–25 current findings; every number in it is in one of them', () => {
    const out = validateStepTurn(turn({ summary: { text: 'Lead times stretched past a year in 2026, and Eaton sells switchgear.', basedOn: ['t1', fid('d1')] } }), ctx());
    expect(out.ok).toBe(true);
    expect(out.summary.basedOn).toEqual([out.findings[0].findingId, fid('d1')]);
  });
  it('a finding holds its own date: a sentence dating a fact by it passes; a different date fails', () => {
    const dated = validateStepTurn(turn({ summary: { text: 'Eaton sells switchgear to data-center builders (reported 2026-11-06).', basedOn: ['t1'] } }), ctx());
    expect(dated.ok).toBe(true);
    expect(validateStepTurn(turn({ summary: { text: 'Eaton sells switchgear (reported 2026-11-09).', basedOn: ['t1'] } }), ctx())).toMatchObject({ ok: false, rule: 'unsupported_number', detail: '9' });
  });
  it('a sentence with a number no basedOn fact holds fails unsupported_number', () => {
    expect(validateStepTurn(turn({ summary: { text: 'Lead times stretched to 18 months.', basedOn: [fid('d1')] } }), ctx())).toMatchObject({ ok: false, rule: 'unsupported_number', detail: '18' });
  });
  it('an empty basedOn, or one naming a finding the step corrected, fails', () => {
    expect(validateStepTurn(turn({ summary: { text: 'Eaton sells switchgear.', basedOn: [] } }), ctx())).toMatchObject({ ok: false, rule: 'invalid_based_on' });
    const corrected = turn({ findings: [finding({ supersedes: fid('d1') })], summary: { text: 'Eaton sells switchgear.', basedOn: [fid('d1')] } });
    expect(validateStepTurn(corrected, ctx())).toMatchObject({ ok: false, rule: 'invalid_based_on' });
  });
  it('over 1,000 characters fails', () => {
    expect(validateStepTurn(turn({ summary: { text: 'a'.repeat(1001), basedOn: ['t1'] } }), ctx())).toMatchObject({ ok: false, rule: 'summary_too_long' });
  });
});

describe('rule 7 — the forbidden patterns', () => {
  const cases = [
    ['guarantee', 'This guarantees Eaton more orders.'],
    ['will_do', 'The agent will buy Eaton.'],
    ['considered', 'The agent considered Eaton.'],
    ['confidence_number', 'I have 80% confidence in this link.'],
    ['price_target', 'The price target is higher.'],
    ['buy_sell_advice', 'You should buy Eaton.'],
    ['learning_claim', 'I learned that switchgear matters.'],
  ];
  for (const [name, text] of cases) {
    it(`${name} in the reply fails the step; in a fact too`, () => {
      expect(forbiddenIn(text)).toContain(name);
      expect(validateStepTurn(turn({ reply: text }), ctx())).toMatchObject({ ok: false, rule: 'forbidden' });
      expect(validateStepTurn(turn({ findings: [finding({ fact: text })] }), ctx())).toMatchObject({ ok: false, rule: 'forbidden' });
    });
  }
  it('business words are not learning claims, and a method question is not advice', () => {
    expect(forbiddenIn('Eaton revenue grew and margins improved.')).toEqual([]);
    expect(forbiddenIn('Does the company own the product, supply it, buy it, or compete with it?')).toEqual([]);
  });
});

describe('rule 8 — the caps', () => {
  it('more than 12 findings fails', () => {
    const many = Array.from({ length: 13 }, (_, i) => finding({ tempId: `t${i}`, kind: 'coverage', symbolCandidate: null, companyName: null }));
    expect(validateStepTurn(turn({ findings: many, companies: [], lines: { support: null, complication: null, missing: null } }), ctx())).toMatchObject({ ok: false, rule: 'too_many_findings' });
  });
  it('a step that would take the record past 100 findings fails findings_full', () => {
    const full = { ...dataCenterRecord('refresh') };
    full.findings = [...full.findings, ...Array.from({ length: 95 }, (_, i) => ({ ...full.findings[0], findingId: `f_20000000-0000-4000-8000-${String(i).padStart(12, '0')}` }))];
    expect(validateStepTurn(turn(), ctx({ record: full }))).toMatchObject({ ok: false, rule: 'findings_full' });
  });
});

describe('the next action', () => {
  it('no next action from the model supersedes the current one with "no next step proposed"', () => {
    const out = validateStepTurn(turn({ nextAction: null }), ctx({ record: { ...dataCenterRecord('refresh') } }));
    expect(out.ok).toBe(true);
  });
  it('replaces a current next action (one at a time)', () => {
    let r = baseRecord({ question: DC_QUESTION });
    const prior = { findingId: fid('na'), kind: 'next_action', symbol: null, fact: 'Find the source.', source: { recordKind: 'kb', recordId: 'baseline@v0', label: 'Baseline method v0' }, at: READ, asOf: null, status: 'unverified', statusReason: 'proposed', pin: null, supersedes: null };
    r = { ...r, findings: [prior] };
    const out = validateStepTurn(turn({ nextAction: null }), ctx({ record: r }));
    expect(out.findings.at(-1)).toMatchObject({ kind: 'next_action', fact: NO_NEXT_STEP_FACT, statusReason: 'no_next_step', supersedes: fid('na') });
  });
});

describe('the frame', () => {
  it('three bounded texts; a stray ticker or a forbidden pattern fails', () => {
    expect(validateFrame({ question: 'Which company earns from slow security reviews?', check: 'Who sells review tools.', notEstablished: 'That reviews delay deals.' }))
      .toMatchObject({ ok: true });
    expect(validateFrame({ question: 'Does CRWDX earn from it?', check: 'a', notEstablished: 'b' })).toMatchObject({ ok: false, rule: 'stray_ticker' });
    expect(validateFrame({ question: 'You should buy now?', check: 'a', notEstablished: 'b' })).toMatchObject({ ok: false, rule: 'forbidden' });
    expect(validateFrame({ question: '', check: 'a', notEstablished: 'b' })).toMatchObject({ ok: false, rule: 'frame_incomplete' });
  });
});

describe('the schemas are structured-output shaped', () => {
  const walk = (s, out = []) => {
    if (s && typeof s === 'object') {
      if (s.type === 'object') out.push(s);
      for (const v of Object.values(s)) walk(v, out);
    }
    return out;
  };
  it('every object closed with every key required; no length or count keyword (unsupported there)', () => {
    for (const schema of [STEP_SCHEMA, FRAME_SCHEMA]) {
      for (const o of walk(schema)) {
        expect(o.additionalProperties).toBe(false);
        expect([...o.required].sort()).toEqual(Object.keys(o.properties).sort());
      }
      expect(JSON.stringify(schema)).not.toMatch(/"(maxLength|minLength|maxItems|minItems|minimum|maximum)"/);
    }
  });
  it('numbers normalize for comparison', () => {
    expect(numberTokensOf('$1,200 and 1.90x and 62%')).toEqual(['1200', '1.9', '62']);
  });
});
