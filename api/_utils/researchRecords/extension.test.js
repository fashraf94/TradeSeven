// api/_utils/researchRecords/extension.test.js
//
// The Research Record Extension (7 Nov 2026; contract
// docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md) — the research
// record's new server-written fields on the pure model, and the store's two
// transactional writes on the optimistic Firestore double (their real-emulator
// concurrency rows: test/rules/researchRecordExtension.rules.mjs):
//   · question — set once, only with the subject; absent on every other record
//   · findings[] — shape, caps, closed lists; append-only; supersedes honoured;
//     the 101st refused; asOf never the write time; retrieval needs its url
//   · symbolKeys — derived (upper case, hyphen form, each once, capped); a host
//     write never adds them and never lets them go stale
//   · summary / summaryRevisions[] — one transaction; rev n+1; the 21st refused
//   · ids — sr_… accepted, the old prefixes unchanged
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): model.js imports
// src/constants/researchRecords.js; this unmocked import is the guard. Never mock it.

import { describe, it, expect } from 'vitest';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';
import {
  RECORD_SCHEMA_VERSION, SYMBOLS_MAX, HOST_COLLECTIONS, STAGES_BY_ORIGIN, RESEARCH_STAGES, RESEARCH_ORIGINS,
  FINDING_KINDS, FINDING_RECORD_KINDS, FINDING_STATUSES, PIN_TYPES,
  QUESTION_MAX_LEN, FINDINGS_MAX, FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, SUMMARY_REVISIONS_MAX,
  researchWorkIdFor, isResearchWorkId, researchRefOf, isOwnedRecord, buildRecord, subjectPatch, turnPatch, closePatch,
  manualFunnel, dialogueFunnel, analysisFunnel, emptyTelemetry, budgetOf, recordSummaryOf,
  buildFinding, findingAppendPatch, currentFindingsOf, summaryRevisionPatch, symbolKeysOf, symbolKeyOf, isFindingId,
  normalizeQuestion, isRecordRef, ResearchRecordError,
} from './model.js';
import { appendFinding, reviseSummary, researchSummariesOf } from './store.js';
import { EVIDENCE_REF_KINDS } from '../hypothesisRecords/model.js';

const EARLIER = '2026-11-07T14:00:00.000Z';
const NOW = '2026-11-07T15:00:00.000Z';
const UID = 'u1';
const fid = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const code = (fn) => { try { fn(); } catch (e) { return e.code ?? `untyped: ${e.message}`; } return 'no refusal'; };

/** A Shared Research record as the route will mint it: subject + question, no funnel. */
const srRecord = (over = {}) => buildRecord({
  researchWorkId: 'sr_s1', userId: UID, origin: 'shared_research', host: { collection: HOST_COLLECTIONS.shared_research, id: 's1' },
  createdAt: EARLIER, watchlistId: 'wl-1', hypothesisVersion: 2, question: '  Does the raised guide hold?  ',
  funnel: manualFunnel(), telemetry: emptyTelemetry(), ...over,
});
/** A finding's input as the route will hand it over (no id — the server mints it). */
const input = (over = {}) => ({
  kind: 'earnings_fact', fact: 'Q3 EPS 1.12 vs 1.05 expected.',
  source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_NVDA', label: 'NVDA, 6 Nov' },
  at: '2026-11-06T21:05:00.000Z', asOf: '2026-11-06T21:10:00.000Z', status: 'verified', ...over,
});
const built = (n, over = {}) => buildFinding(input(over), { findingId: fid(n), nowIso: NOW });
/** A record holding n findings (each its own), appended through the model. */
function withFindings(record, n) {
  let r = record;
  for (let i = 1; i <= n; i++) r = { ...r, ...findingAppendPatch(r, built(i), { nowIso: NOW }) };
  return r;
}

describe('closed lists — defined once in the model, grown only with a new schema version', () => {
  // Growing a list means a new entry HERE under a new RECORD_SCHEMA_VERSION; editing version 1's lists is the violation this row exists to show.
  const LISTS_BY_SCHEMA = {
    1: {
      FINDING_KINDS: ['earnings_fact', 'release', 'coverage', 'check_receipt', 'setup', 'idea', 'observation', 'product', 'relationship', 'inference', 'next_action'],
      FINDING_RECORD_KINDS: ['symbolDayEvidence', 'fantasyTimesWire', 'fantasyTimesStories', 'ingestedClaims', 'stockBriefs', 'estimatesCache', 'setupEvidence', 'activationPointer', 'call', 'hypothesisVersion', 'exchange', 'kb', 'retrieval'],
      FINDING_STATUSES: ['verified', 'unverified', 'unavailable'],
      PIN_TYPES: ['price', 'time'],
      EVIDENCE_REF_KINDS: ['researchWork', 'evidenceItem', 'exchange'],
      RESEARCH_ORIGINS: ['signaldrop', 'theme', 'screener', 'analysis', 'manual', 'shared_research'],
    },
  };
  it('each list, exactly, for the current schema version — and frozen', () => {
    const lists = { FINDING_KINDS, FINDING_RECORD_KINDS, FINDING_STATUSES, PIN_TYPES, EVIDENCE_REF_KINDS, RESEARCH_ORIGINS };
    expect(RECORD_SCHEMA_VERSION).toBe(1);
    expect(lists).toEqual(LISTS_BY_SCHEMA[RECORD_SCHEMA_VERSION]);
    for (const l of Object.values(lists)) expect(Object.isFrozen(l)).toBe(true);
  });
  it('the source-kind list lives in a DATA-ONLY module: one frozen list, no import, no require, no read (review B1 — its guard listing covers no code)', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./findingRecordKinds.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const body = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').trim();
    expect(body).toMatch(/^export const FINDING_RECORD_KINDS = Object\.freeze\(\[[\s'A-Za-z,]*\]\);$/);
  });
  it('the caps, as the contract states them', () => {
    expect({ QUESTION_MAX_LEN, FINDINGS_MAX, FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, SUMMARY_REVISIONS_MAX, SYMBOLS_MAX })
      .toEqual({ QUESTION_MAX_LEN: 500, FINDINGS_MAX: 100, FINDING_FACT_MAX_LEN: 500, SOURCE_LABEL_MAX_LEN: 120, SUMMARY_TEXT_MAX_LEN: 600, SUMMARY_REVISIONS_MAX: 20, SYMBOLS_MAX: 100 });
  });
});

describe('ids — sr_… is accepted; the old prefixes are unchanged', () => {
  it('a Shared Research session mints sr_<host id>; every older collection keeps its prefix', () => {
    expect(HOST_COLLECTIONS).toEqual({ dialogue: 'watchlistSessions', screener: 'researchSessions', analysis: 'analysisSessions', shared_research: 'sharedResearchSessions' });
    expect(researchWorkIdFor({ collection: 'sharedResearchSessions', id: 'abc' })).toBe('sr_abc');
    expect([
      researchWorkIdFor({ collection: 'watchlistSessions', id: 'abc' }), researchWorkIdFor({ collection: 'researchSessions', id: 'abc' }),
      researchWorkIdFor({ collection: 'analysisSessions', id: 'abc' }), researchWorkIdFor({ collection: 'watchlists', id: 'abc' }),
    ]).toEqual(['ws_abc', 'rs_abc', 'as_abc', 'wl_abc']);
    for (const ok of ['sr_a', 'sr_A-1_b', 'ws_a', 'rs_a', 'as_a', 'wl_a']) expect(isResearchWorkId(ok), ok).toBe(true);
    for (const bad of ['sr_', 'sr_a/b', 'sx_a', 'SR_a', 'sr a']) expect(isResearchWorkId(bad), bad).toBe(false);
    expect(researchRefOf('sr_abc')).toEqual({ kind: 'researchWork', id: 'sr_abc' });
  });
  it('a Shared Research record has no funnel: every stage null; it is an owned, readable record', () => {
    expect(STAGES_BY_ORIGIN.shared_research).toEqual([]);
    const r = srRecord();
    expect(r.stages).toEqual(Object.fromEntries(RESEARCH_STAGES.map((k) => [k, null])));
    expect(isOwnedRecord(r, UID)).toBe(true);
  });
  it('the Forge summary of a Shared Research record shows none of the new fields (what readers see is unchanged)', () => {
    const r = { ...withFindings(srRecord(), 1) };
    const s = recordSummaryOf(r);
    expect(Object.keys(s)).toEqual(['researchWorkId', 'origin', 'createdAt', 'watchlistId', 'hypothesisVersion', 'stages', 'completions', 'state', 'terminalReason', 'endedAt']);
  });
});

describe('the question — set once, together with the subject', () => {
  it('stored with the subject at mint, outer whitespace dropped; at most 500 characters', () => {
    expect(srRecord().question).toBe('Does the raised guide hold?');
    expect(srRecord({ question: 'q'.repeat(QUESTION_MAX_LEN) }).question).toHaveLength(QUESTION_MAX_LEN);
    for (const bad of ['q'.repeat(QUESTION_MAX_LEN + 1), '', '   ', 7, {}]) expect(code(() => srRecord({ question: bad })), String(bad).slice(0, 9)).toBe('invalid_question');
    expect(normalizeQuestion(' a ')).toBe('a');
  });
  it('never without the subject: a question with no list is refused', () => {
    expect(code(() => srRecord({ watchlistId: null, hypothesisVersion: null }))).toBe('question_without_subject');
  });
  it('a record minted without one has NO question key (every host record keeps its exact shape)', () => {
    const host = buildRecord({
      researchWorkId: 'ws_s', userId: UID, origin: 'signaldrop', host: { collection: 'watchlistSessions', id: 's' }, createdAt: EARLIER,
      funnel: dialogueFunnel({ candidates: [{ symbol: 'NVDA', status: 'kept' }] }), budget: budgetOf({ messageBudget: 20, messagesUsed: 1 }), telemetry: emptyTelemetry(),
    });
    expect(Object.keys(host)).toEqual([
      'schemaVersion', 'researchWorkId', 'userId', 'origin', 'host', 'createdAt', 'watchlistId', 'hypothesisVersion', 'stages', 'symbols',
      'symbolsTruncated', 'budget', 'telemetry', 'state', 'terminalReason', 'endedAt', 'updatedAt',
    ]);
  });
  it('subjectPatch: the question rides only WITH the subject; offered anywhere else it is REFUSED, never silently dropped (review A3)', () => {
    const open = srRecord({ watchlistId: null, hypothesisVersion: null, question: null });
    expect(subjectPatch(open, { watchlistId: 'wl-9', hypothesisVersion: 3, question: 'Why now?' }))
      .toEqual({ watchlistId: 'wl-9', hypothesisVersion: 3, question: 'Why now?', symbolKeys: [] });
    expect(code(() => subjectPatch(srRecord(), { watchlistId: 'wl-9', hypothesisVersion: 3, question: 'A different question' }))).toBe('question_already_set');
    const subjectNoQuestion = { ...srRecord({ question: null }) };
    expect(code(() => subjectPatch(subjectNoQuestion, { watchlistId: 'wl-9', question: 'Late question' }))).toBe('question_after_subject');
    expect(code(() => subjectPatch(open, { watchlistId: null, question: 'No list' }))).toBe('question_without_subject');
    expect(code(() => closePatch(subjectNoQuestion, { state: 'completed', terminalReason: 'saved_to_list', atIso: NOW, funnel: manualFunnel(), subject: { watchlistId: 'wl-9', question: 'Late question' } }))).toBe('question_after_subject');
    // Without a question the patch is exactly what it always was — a set subject still answers {}.
    expect(subjectPatch(open, { watchlistId: 'wl-9', hypothesisVersion: 3 })).toEqual({ watchlistId: 'wl-9', hypothesisVersion: 3 });
    expect(subjectPatch(srRecord(), { watchlistId: 'wl-9', hypothesisVersion: 3 })).toEqual({});
    expect(code(() => subjectPatch(open, { watchlistId: 'wl-9', question: '' }))).toBe('invalid_question');
  });
  it('any mint that sets a question is an extension write: it carries symbolKeys whatever its origin (review A8 — one shape)', () => {
    const host = buildRecord({
      researchWorkId: 'ws_s', userId: UID, origin: 'signaldrop', host: { collection: 'watchlistSessions', id: 's' }, createdAt: EARLIER,
      watchlistId: 'wl-1', question: 'Why NVDA?', funnel: dialogueFunnel({ candidates: [{ symbol: 'NVDA', status: 'kept' }] }), telemetry: emptyTelemetry(),
    });
    expect(host).toMatchObject({ question: 'Why NVDA?', symbolKeys: ['NVDA'] });
  });
});

describe('findings — shape, caps and closed lists', () => {
  it('a finding is exactly its fields, in order, with the server\'s id', () => {
    const f = built(1, { pin: { type: 'price', value: 142.5 } });
    expect(f).toEqual({
      findingId: fid(1), kind: 'earnings_fact', fact: 'Q3 EPS 1.12 vs 1.05 expected.',
      source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_NVDA', label: 'NVDA, 6 Nov' },
      at: '2026-11-06T21:05:00.000Z', asOf: '2026-11-06T21:10:00.000Z', status: 'verified', statusReason: null,
      pin: { type: 'price', value: 142.5 }, supersedes: null,
    });
    expect(Object.keys(f)).toEqual(['findingId', 'kind', 'fact', 'source', 'at', 'asOf', 'status', 'statusReason', 'pin', 'supersedes']);
    expect(isFindingId(fid(1))).toBe(true);
  });
  it('the id is the server\'s: a caller-sent findingId (or any unknown field) is refused; a malformed server id throws', () => {
    expect(code(() => buildFinding({ ...input(), findingId: fid(9) }, { findingId: fid(1), nowIso: NOW }))).toBe('invalid_finding');
    expect(code(() => buildFinding({ ...input(), origin: 'x' }, { findingId: fid(1), nowIso: NOW }))).toBe('invalid_finding');
    expect(() => buildFinding(input(), { findingId: 'f_1', nowIso: NOW })).toThrow(/server-minted id/);
    for (const bad of ['f_00000000-0000-1000-8000-000000000001', `F_${fid(1).slice(2)}`, fid(1).toUpperCase()]) expect(isFindingId(bad), bad).toBe(false);
  });
  it('every closed list refuses what it does not hold', () => {
    for (const kind of FINDING_KINDS) expect(built(1, { kind }).kind).toBe(kind);
    expect(code(() => built(1, { kind: 'rumor' }))).toBe('invalid_finding_kind');
    for (const status of ['unverified', 'unavailable']) expect(built(1, { status, statusReason: 'provider_unavailable' }).status).toBe(status);
    expect(code(() => built(1, { status: 'maybe' }))).toBe('invalid_status');
    expect(code(() => built(1, { source: { recordKind: 'tweets', recordId: 'x', label: 'x' } }))).toBe('invalid_source');
    for (const recordKind of FINDING_RECORD_KINDS) {
      const recordId = recordKind === 'symbolDayEvidence' ? '2026-11-06_AMD' : 'rec-1';
      const url = recordKind === 'retrieval' ? 'https://example.com/a' : undefined;
      expect(built(1, { source: { recordKind, recordId, label: 'L', ...(url ? { url } : {}) } }).source.recordKind).toBe(recordKind);
    }
  });
  it('fact ≤ 500, label ≤ 120 (outer whitespace dropped, never empty)', () => {
    expect(built(1, { fact: 'x'.repeat(FINDING_FACT_MAX_LEN) }).fact).toHaveLength(FINDING_FACT_MAX_LEN);
    for (const fact of ['x'.repeat(FINDING_FACT_MAX_LEN + 1), '', '  ', null]) expect(code(() => built(1, { fact }))).toBe('invalid_fact');
    const src = (label) => ({ recordKind: 'call', recordId: 'c-1', label });
    expect(built(1, { source: src('y'.repeat(SOURCE_LABEL_MAX_LEN)) }).source.label).toHaveLength(SOURCE_LABEL_MAX_LEN);
    for (const label of ['y'.repeat(SOURCE_LABEL_MAX_LEN + 1), '', '   ']) expect(code(() => built(1, { source: src(label) }))).toBe('invalid_source');
  });
  it('a retrieval WITHOUT a url is refused; a url is http(s) and kept only when given', () => {
    expect(code(() => built(1, { source: { recordKind: 'retrieval', recordId: 'r-1', label: 'Reuters' } }))).toBe('retrieval_needs_url');
    expect(code(() => built(1, { source: { recordKind: 'retrieval', recordId: 'r-1', label: 'Reuters', url: null } }))).toBe('retrieval_needs_url');
    expect(built(1, { source: { recordKind: 'retrieval', recordId: 'r-1', label: 'Reuters', url: 'https://r.example/x' } }).source)
      .toEqual({ recordKind: 'retrieval', recordId: 'r-1', label: 'Reuters', url: 'https://r.example/x' });
    for (const url of ['ftp://x', 'javascript:alert(1)', 'not a url', `https://e.x/${'a'.repeat(2048)}`]) {
      expect(code(() => built(1, { source: { recordKind: 'retrieval', recordId: 'r-1', label: 'R', url } })), url.slice(0, 12)).toBe('invalid_source');
    }
    expect(Object.keys(built(1).source)).toEqual(['recordKind', 'recordId', 'label']); // no url key when none was given
  });
  it('a symbolDayEvidence record id is {etDate}_{SYMBOL} on a real date', () => {
    for (const ok of ['2026-11-06_NVDA', '2026-11-06_BRK.B', '2024-02-29_X']) expect(isRecordRef('symbolDayEvidence', ok), ok).toBe(true);
    for (const bad of ['NVDA', '2026-11-06', '2026-02-30_NVDA', '2026-13-01_X', '2026-11-06_nvda', '2026-11-06_NVDA_x']) expect(isRecordRef('symbolDayEvidence', bad), bad).toBe(false);
    expect(isRecordRef('call', 'a\u0000b')).toBe(false); // ids are printable
    expect(isRecordRef('call', 'x'.repeat(257))).toBe(false);
  });
  it('asOf is when the SOURCE knew it: absent → null, never the write time; equal to or after the write time is refused', () => {
    const { asOf, ...noAsOf } = input();
    expect(buildFinding(noAsOf, { findingId: fid(1), nowIso: NOW }).asOf).toBeNull();
    expect(built(1, { asOf: null }).asOf).toBeNull();
    expect(code(() => built(1, { asOf: NOW }))).toBe('as_of_not_before_write');
    expect(code(() => built(1, { asOf: '2026-11-07T15:00:01.000Z' }))).toBe('as_of_not_before_write');
    expect(code(() => built(1, { asOf: '2026-11-06' }))).toBe('invalid_as_of');
    expect(asOf).toBe('2026-11-06T21:10:00.000Z');
  });
  it('at is the fact\'s own instant (it may be ahead of the write: a scheduled release)', () => {
    expect(built(1, { kind: 'release', at: '2026-11-19T21:00:00.000Z' }).at).toBe('2026-11-19T21:00:00.000Z');
    for (const at of [undefined, null, '2026-11-06', 'yesterday', '2026-11-06T21:05:00+01:00']) expect(code(() => built(1, { at }))).toBe('invalid_at');
  });
  it('an instant is a REAL one in the one toISOString spelling: no 30 Feb, no 24:00, no whole-seconds variant (review A2)', () => {
    for (const bad of ['2026-02-30T00:00:00.000Z', '2026-04-31T00:00:00.000Z', '2026-11-07T24:00:00.000Z', '2026-11-06T21:05:60.000Z', '2026-11-06T21:05:00Z', '2026-11-06T21:05:00.5Z']) {
      expect(code(() => built(1, { at: bad })), bad).toBe('invalid_at');
      expect(code(() => built(1, { asOf: bad })), bad).toBe('invalid_as_of');
      expect(code(() => built(1, { pin: { type: 'time', value: bad } })), bad).toBe('invalid_pin');
    }
    expect(built(1, { at: '2024-02-29T23:59:59.999Z' }).at).toBe('2024-02-29T23:59:59.999Z');
  });
  it('statusReason: a typed word when not verified; none when verified', () => {
    expect(code(() => built(1, { status: 'unverified' }))).toBe('invalid_status_reason');
    expect(code(() => built(1, { status: 'unverified', statusReason: 'Not Sure!' }))).toBe('invalid_status_reason');
    expect(code(() => built(1, { status: 'verified', statusReason: 'checked' }))).toBe('invalid_status_reason');
    expect(built(1, { status: 'unavailable', statusReason: 'source_not_found' }).statusReason).toBe('source_not_found');
  });
  it('pin: a price (positive) or a time (an instant), or null', () => {
    expect(built(1, { pin: { type: 'time', value: '2026-11-06T21:05:00.000Z' } }).pin).toEqual({ type: 'time', value: '2026-11-06T21:05:00.000Z' });
    expect(built(1).pin).toBeNull();
    for (const pin of [{ type: 'price', value: 0 }, { type: 'price', value: '142' }, { type: 'time', value: 1 }, { type: 'level', value: 1 }, { type: 'price', value: 1, note: 'x' }]) {
      expect(code(() => built(1, { pin })), JSON.stringify(pin)).toBe('invalid_pin');
    }
  });
});

describe('findings — append-only; supersedes honoured; the 101st refused', () => {
  it('an append adds one finding and leaves every earlier one exactly as it was', () => {
    const r1 = withFindings(srRecord(), 1);
    const before = structuredClone(r1.findings);
    const p = findingAppendPatch(r1, built(2), { nowIso: NOW });
    expect(p.findings).toHaveLength(2);
    expect(p.findings.slice(0, 1)).toEqual(before);
    expect(Object.keys(p).sort()).toEqual(['findings', 'symbolKeys', 'updatedAt']);
  });
  it('a correction is a NEW finding naming the earlier one; the earlier stays, and is no longer current', () => {
    const r = withFindings(srRecord(), 2);
    const fix = buildFinding(input({ fact: 'Q3 EPS 1.12 vs 1.06 expected (consensus moved).', supersedes: fid(1) }), { findingId: fid(3), nowIso: NOW });
    const r3 = { ...r, ...findingAppendPatch(r, fix, { nowIso: NOW }) };
    expect(r3.findings.map((f) => f.findingId)).toEqual([fid(1), fid(2), fid(3)]);
    expect(r3.findings[0]).toEqual(r.findings[0]);
    expect(currentFindingsOf(r3).map((f) => f.findingId)).toEqual([fid(2), fid(3)]);
  });
  it('supersedes must name a finding on THIS record, not one already corrected (the chain never forks)', () => {
    const r = withFindings(srRecord(), 2);
    expect(code(() => findingAppendPatch(r, built(3, { supersedes: fid(9) }), { nowIso: NOW }))).toBe('supersedes_unknown');
    const r3 = { ...r, ...findingAppendPatch(r, built(3, { supersedes: fid(1) }), { nowIso: NOW }) };
    expect(code(() => findingAppendPatch(r3, built(4, { supersedes: fid(1) }), { nowIso: NOW }))).toBe('finding_already_superseded');
    expect(findingAppendPatch(r3, built(4, { supersedes: fid(3) }), { nowIso: NOW }).findings).toHaveLength(4); // correct the correction
    expect(code(() => built(4, { supersedes: 'f_1' }))).toBe('invalid_supersedes');
  });
  it('the 100th lands; the 101st is refused with findings_full', () => {
    const r99 = withFindings(srRecord(), 99);
    const r100 = { ...r99, ...findingAppendPatch(r99, built(100), { nowIso: NOW }) };
    expect(r100.findings).toHaveLength(FINDINGS_MAX);
    expect(code(() => findingAppendPatch(r100, built(101), { nowIso: NOW }))).toBe('findings_full');
  });
  it('a duplicate id, a closed record or an unreadable one is refused', () => {
    const r = withFindings(srRecord(), 1);
    expect(code(() => findingAppendPatch(r, built(1), { nowIso: NOW }))).toBe('finding_id_taken');
    for (const state of ['completed', 'abandoned', 'failed']) expect(code(() => findingAppendPatch({ ...r, state }, built(2), { nowIso: NOW }))).toBe('record_closed');
    expect(code(() => findingAppendPatch({ ...r, state: 'weird' }, built(2), { nowIso: NOW }))).toBe('record_unreadable');
    expect(code(() => findingAppendPatch(null, built(2), { nowIso: NOW }))).toBe('record_unreadable');
  });
});

describe('symbolKeys — derived server-side, deduplicated, upper case, hyphen form', () => {
  it('from symbols[] and the findings\' records, first-seen order, each once', () => {
    const record = {
      symbols: [{ symbol: 'brk.b' }, { symbol: 'NVDA' }, { symbol: ' amd ' }, { symbol: '' }, { symbol: 'not a symbol!' }],
      findings: [built(1, { source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_AMD', label: 'a' } }), built(2), built(3, { source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_BF.B', label: 'b' } }), built(4, { source: { recordKind: 'call', recordId: 'NVDA', label: 'c' } })],
    };
    expect(symbolKeysOf(record)).toEqual(['BRK-B', 'NVDA', 'AMD', 'BF-B']);
    expect(symbolKeyOf('brk.b')).toBe('BRK-B');
    expect(symbolKeyOf('BRK-B')).toBe('BRK-B');
    for (const bad of [null, '', '   ', 'A B', 'TOOLONGSYMBOL1', '$NVDA']) expect(symbolKeyOf(bad), String(bad)).toBeNull();
  });
  it('at most SYMBOLS_MAX', () => {
    const symbols = Array.from({ length: SYMBOLS_MAX + 30 }, (_, i) => ({ symbol: `S${i}` }));
    expect(symbolKeysOf({ symbols })).toHaveLength(SYMBOLS_MAX);
  });
  it('a Shared Research mint carries them; every finding append and summary revision rewrites them', () => {
    expect(srRecord({ funnel: { stages: {}, symbols: [{ symbol: 'tsm', outcome: null, reason: null }] } }).symbolKeys).toEqual(['TSM']);
    const r = srRecord();
    expect(r.symbolKeys).toEqual([]);
    const p = findingAppendPatch(r, built(1), { nowIso: NOW });
    expect(p.symbolKeys).toEqual(['NVDA']);
    expect(summaryRevisionPatch({ ...r, ...p }, { text: 'Holds.', basedOn: [fid(1)] }, { nowIso: NOW }).symbolKeys).toEqual(['NVDA']);
  });
  it('a HOST mint or write never ADDS them (nothing writes the new fields yet), and keeps them fresh where they exist', () => {
    const host = (origin, over = {}) => buildRecord({
      researchWorkId: 'as_s', userId: UID, origin, host: origin === 'manual' ? null : { collection: 'analysisSessions', id: 's' }, createdAt: EARLIER,
      funnel: origin === 'manual' ? manualFunnel() : analysisFunnel({ symbols: ['NVDA'], digest: { size: 1, covered: 1, offUniverse: [] } }),
      telemetry: emptyTelemetry(), ...over,
    });
    for (const origin of RESEARCH_ORIGINS.filter((o) => o === 'analysis' || o === 'manual')) expect(Object.keys(host(origin)), origin).not.toContain('symbolKeys');
    const rec = host('analysis');
    const turn = turnPatch(rec, { kind: 'completion', atIso: NOW, funnel: analysisFunnel({ symbols: ['NVDA', 'AMD'], digest: { size: 2, covered: 2, offUniverse: [] }, prior: rec }) });
    expect(Object.keys(turn).sort()).toEqual(['stages', 'symbols', 'symbolsTruncated', 'telemetry', 'updatedAt']);
    const closed = closePatch(rec, { state: 'abandoned', terminalReason: 'user_close', atIso: NOW, funnel: analysisFunnel({ symbols: ['NVDA'], digest: { size: 1, covered: 1, offUniverse: [] } }) });
    expect(Object.keys(closed)).not.toContain('symbolKeys');
    // A record that carries them: the host's new cohort is reflected in the same write.
    const keyed = { ...rec, symbolKeys: ['NVDA'] };
    expect(turnPatch(keyed, { kind: 'completion', atIso: NOW, funnel: analysisFunnel({ symbols: ['NVDA', 'AMD'], digest: { size: 2, covered: 2, offUniverse: [] }, prior: keyed }) }).symbolKeys).toEqual(['NVDA', 'AMD']);
    expect(closePatch(keyed, { state: 'abandoned', terminalReason: 'user_close', atIso: NOW, funnel: analysisFunnel({ symbols: ['MU'], digest: { size: 1, covered: 1, offUniverse: [] } }) }).symbolKeys).toEqual(['MU']);
  });
  it('a close that sets the subject WITH a question derives the keys from the cohort the close writes', () => {
    const open = srRecord({ watchlistId: null, hypothesisVersion: null, question: null });
    const p = closePatch(open, {
      state: 'completed', terminalReason: 'saved_to_list', atIso: NOW,
      funnel: { stages: {}, symbols: [{ symbol: 'AVGO', outcome: 'eligible', reason: 'saved_to_list' }] },
      subject: { watchlistId: 'wl-2', hypothesisVersion: 1, question: 'Is networking next?' },
    });
    expect(p).toMatchObject({ watchlistId: 'wl-2', question: 'Is networking next?', symbolKeys: ['AVGO'] });
  });
});

describe('summary — one revision at a time, appended and made the summary together', () => {
  const r2 = () => withFindings(srRecord(), 2);
  it('the first revision is rev 1; the summary IS the last revision; nothing earlier is overwritten', () => {
    const a = summaryRevisionPatch(r2(), { text: '  The guide holds.  ', basedOn: [fid(1)] }, { nowIso: EARLIER });
    expect(a.summary).toEqual({ rev: 1, text: 'The guide holds.', at: EARLIER, basedOn: [fid(1)] });
    expect(a.summaryRevisions).toEqual([a.summary]);
    const ra = { ...r2(), ...a };
    const b = summaryRevisionPatch(ra, { text: 'It holds, on two checks.', basedOn: [fid(1), fid(2)] }, { nowIso: NOW });
    expect(b.summary.rev).toBe(2);
    expect(b.summaryRevisions).toEqual([a.summary, b.summary]);
    expect(b.summaryRevisions[0]).toEqual(ra.summaryRevisions[0]);
    expect(Object.keys(b).sort()).toEqual(['summary', 'summaryRevisions', 'symbolKeys', 'updatedAt']);
  });
  it('the 20th lands; the 21st is refused with summary_revisions_full', () => {
    let r = r2();
    for (let i = 1; i <= SUMMARY_REVISIONS_MAX; i++) r = { ...r, ...summaryRevisionPatch(r, { text: `rev ${i}` }, { nowIso: NOW }) };
    expect(r.summary.rev).toBe(SUMMARY_REVISIONS_MAX);
    expect(r.summaryRevisions).toHaveLength(SUMMARY_REVISIONS_MAX);
    expect(code(() => summaryRevisionPatch(r, { text: 'one more' }, { nowIso: NOW }))).toBe('summary_revisions_full');
  });
  it('a revision the caller did not see is a typed conflict when it says what it saw', () => {
    const r = { ...r2(), ...summaryRevisionPatch(r2(), { text: 'v1' }, { nowIso: NOW }) };
    expect(code(() => summaryRevisionPatch(r, { text: 'v2', expectedRev: 0 }, { nowIso: NOW }))).toBe('summary_conflict');
    expect(summaryRevisionPatch(r, { text: 'v2', expectedRev: 1 }, { nowIso: NOW }).summary.rev).toBe(2);
  });
  it('text ≤ 600; basedOn names findings the record holds, each once', () => {
    expect(summaryRevisionPatch(r2(), { text: 'z'.repeat(SUMMARY_TEXT_MAX_LEN) }, { nowIso: NOW }).summary.text).toHaveLength(SUMMARY_TEXT_MAX_LEN);
    for (const text of ['z'.repeat(SUMMARY_TEXT_MAX_LEN + 1), '', '  ', null]) expect(code(() => summaryRevisionPatch(r2(), { text }, { nowIso: NOW }))).toBe('invalid_summary_text');
    expect(code(() => summaryRevisionPatch(r2(), { text: 't', basedOn: [fid(7)] }, { nowIso: NOW }))).toBe('based_on_unknown');
    expect(code(() => summaryRevisionPatch(r2(), { text: 't', basedOn: [fid(1), fid(1)] }, { nowIso: NOW }))).toBe('invalid_based_on');
    expect(code(() => summaryRevisionPatch(r2(), { text: 't', basedOn: 'f' }, { nowIso: NOW }))).toBe('invalid_based_on');
  });
  it('a closed record never moves; a summary that disagrees with its revisions is unreadable', () => {
    expect(code(() => summaryRevisionPatch({ ...r2(), state: 'completed' }, { text: 't' }, { nowIso: NOW }))).toBe('record_closed');
    expect(code(() => summaryRevisionPatch({ ...r2(), summary: { rev: 3 }, summaryRevisions: [] }, { text: 't' }, { nowIso: NOW }))).toBe('summary_unreadable');
  });
  it('a corrupt stored record is REFUSED, never overwritten (review A6): a list field that is not a list, a summary that is not the last revision', () => {
    const r = { ...r2(), ...summaryRevisionPatch(r2(), { text: 'v1' }, { nowIso: NOW }) };
    for (const bad of ['corrupt', { a: 1 }, 7]) {
      expect(code(() => findingAppendPatch({ ...r, findings: bad }, built(9), { nowIso: NOW })), JSON.stringify(bad)).toBe('record_unreadable');
      expect(code(() => summaryRevisionPatch({ ...r, summaryRevisions: bad, summary: null }, { text: 't' }, { nowIso: NOW })), JSON.stringify(bad)).toBe('record_unreadable');
      expect(code(() => summaryRevisionPatch({ ...r, findings: bad }, { text: 't' }, { nowIso: NOW })), JSON.stringify(bad)).toBe('record_unreadable');
    }
    expect(code(() => summaryRevisionPatch({ ...r, summary: null }, { text: 't' }, { nowIso: NOW }))).toBe('summary_unreadable'); // revisions but no summary
    expect(code(() => summaryRevisionPatch({ ...r, summary: { ...r.summary, text: 'edited' } }, { text: 't' }, { nowIso: NOW }))).toBe('summary_unreadable');
    // Firestore returns map keys alphabetized: the same summary in another key order still reads as the last revision.
    const alphabetized = Object.fromEntries(Object.keys(r.summary).sort().map((k) => [k, r.summary[k]]));
    expect(summaryRevisionPatch({ ...r, summary: alphabetized }, { text: 'v2' }, { nowIso: NOW }).summary.rev).toBe(2);
    // An absent or null list is simply empty.
    expect(findingAppendPatch({ ...srRecord(), findings: null }, built(1), { nowIso: NOW }).findings).toHaveLength(1);
  });
});

describe('the Forge summaries — a Shared Research record never displaces the list\'s own research (review A4)', () => {
  const sum = (id, origin, createdAt, completions = 1) => ({
    researchWorkId: id, userId: UID, origin, state: 'completed', watchlistId: 'wl-1', createdAt, telemetry: { completions },
    stages: Object.fromEntries(RESEARCH_STAGES.map((k) => [k, null])),
  });
  it('the list\'s own research first, then its worked analysis — however many Shared Research records are attached', () => {
    const own = sum('ws_own', 'signaldrop', '2026-11-01T00:00:00.000Z');
    const worked = sum('as_a1', 'analysis', '2026-11-02T00:00:00.000Z');
    const shared = Array.from({ length: 25 }, (_, i) => sum(`sr_x${i}`, 'shared_research', `2026-11-03T00:00:${String(i).padStart(2, '0')}.000Z`));
    const out = researchSummariesOf([own, worked, ...shared]);
    expect(out).toHaveLength(20);
    expect(out.slice(0, 2).map((s) => s.researchWorkId)).toEqual(['ws_own', 'as_a1']);
    expect(out.slice(2).every((s) => s.origin === 'shared_research')).toBe(true);
  });
  it('with no Shared Research record the order is exactly what it was', () => {
    const records = [sum('ws_own', 'signaldrop', '2026-11-01T00:00:00.000Z'), sum('as_a0', 'analysis', '2026-11-02T00:00:00.000Z', 0), sum('as_a1', 'analysis', '2026-11-03T00:00:00.000Z')];
    expect(researchSummariesOf(records).map((s) => s.researchWorkId)).toEqual(['ws_own', 'as_a1', 'as_a0']);
  });
});

describe('table E stays whole (review A5)', () => {
  it('the scanned files carry no escaped quote inside a quoted literal (the extractor would stop at it and miss the rest)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['./model.js', './store.js', '../../../src/constants/researchRecords.js']) {
      expect(readFileSync(new URL(f, import.meta.url), 'utf8'), f).not.toMatch(/\\'/);
    }
  });
});

describe('the store — appendFinding and reviseSummary: one transaction each, server-only', () => {
  const seed = (record = srRecord()) => makeCallsFirestore({ docs: { 'researchWork/sr_s1': record } });
  it('appendFinding mints the id (f_ + a v4 UUID), checks the shape, appends in ONE transaction', async () => {
    const db = seed();
    const out = await appendFinding(db, { researchWorkId: 'sr_s1', uid: UID, finding: input(), nowIso: NOW });
    expect(isFindingId(out.finding.findingId)).toBe(true);
    expect(out.count).toBe(1);
    const rec = stored(db, 'researchWork/sr_s1');
    expect(rec.findings).toEqual([out.finding]);
    expect(rec.symbolKeys).toEqual(['NVDA']);
    expect(db.__txAttempts).toBe(1);
    expect(db.__access.writes.map((w) => [w.op, w.path])).toEqual([['update', 'researchWork/sr_s1']]);
    const again = await appendFinding(db, { researchWorkId: 'sr_s1', uid: UID, finding: input(), nowIso: NOW });
    expect(again.finding.findingId).not.toBe(out.finding.findingId);
  });
  it('a malformed finding is refused BEFORE any read; a missing or foreign record answers record_not_found; nothing is written', async () => {
    const db = seed();
    await expect(appendFinding(db, { researchWorkId: 'sr_s1', uid: UID, finding: input({ kind: 'rumor' }), nowIso: NOW })).rejects.toMatchObject({ code: 'invalid_finding_kind' });
    expect(db.__access.reads).toEqual([]);
    await expect(appendFinding(db, { researchWorkId: 'sr_s1', uid: 'intruder', finding: input(), nowIso: NOW })).rejects.toMatchObject({ code: 'record_not_found' });
    await expect(appendFinding(db, { researchWorkId: 'sr_none', uid: UID, finding: input(), nowIso: NOW })).rejects.toMatchObject({ code: 'record_not_found' });
    await expect(appendFinding(db, { researchWorkId: 'bad/id', uid: UID, finding: input(), nowIso: NOW })).rejects.toBeInstanceOf(ResearchRecordError);
    expect(db.__access.writes).toEqual([]);
  });
  it('two concurrent appends both land (the second commits while the first is in its body; the first re-reads)', async () => {
    const db = seed();
    let raced = false;
    db.__hooks.afterTxBody = async () => {
      if (raced) return;
      raced = true;
      db.__hooks.afterTxBody = null;
      await appendFinding(db, { researchWorkId: 'sr_s1', uid: UID, finding: input({ fact: 'the other one' }), nowIso: NOW });
    };
    await appendFinding(db, { researchWorkId: 'sr_s1', uid: UID, finding: input(), nowIso: NOW });
    const rec = stored(db, 'researchWork/sr_s1');
    expect(rec.findings.map((f) => f.fact)).toEqual(['the other one', 'Q3 EPS 1.12 vs 1.05 expected.']);
    expect(new Set(rec.findings.map((f) => f.findingId)).size).toBe(2);
  });
  it('…within the cap: at 99, of two concurrent appends one lands and the other is refused findings_full', async () => {
    const db = seed(withFindings(srRecord(), 99));
    let second = null;
    db.__hooks.afterTxBody = async () => {
      db.__hooks.afterTxBody = null;
      second = await appendFinding(db, { researchWorkId: 'sr_s1', uid: UID, finding: input({ fact: 'the 100th' }), nowIso: NOW });
    };
    await expect(appendFinding(db, { researchWorkId: 'sr_s1', uid: UID, finding: input(), nowIso: NOW })).rejects.toMatchObject({ code: 'findings_full' });
    expect(second.count).toBe(100);
    expect(stored(db, 'researchWork/sr_s1').findings).toHaveLength(100);
  });
  it('two concurrent summary revisions produce rev n+1 and n+2 — never a lost one', async () => {
    const db = seed(withFindings(srRecord(), 1));
    db.__hooks.afterTxBody = async () => {
      db.__hooks.afterTxBody = null;
      await reviseSummary(db, { researchWorkId: 'sr_s1', uid: UID, text: 'first to commit', nowIso: NOW });
    };
    const out = await reviseSummary(db, { researchWorkId: 'sr_s1', uid: UID, text: 'second to commit', basedOn: [fid(1)], nowIso: NOW });
    expect(out.summary.rev).toBe(2);
    const rec = stored(db, 'researchWork/sr_s1');
    expect(rec.summaryRevisions.map((s) => [s.rev, s.text])).toEqual([[1, 'first to commit'], [2, 'second to commit']]);
    expect(rec.summary).toEqual(rec.summaryRevisions[1]);
  });
  it('…or, when both say they saw rev n, one typed conflict', async () => {
    const db = seed(withFindings(srRecord(), 1));
    db.__hooks.afterTxBody = async () => {
      db.__hooks.afterTxBody = null;
      await reviseSummary(db, { researchWorkId: 'sr_s1', uid: UID, text: 'won', expectedRev: 0, nowIso: NOW });
    };
    await expect(reviseSummary(db, { researchWorkId: 'sr_s1', uid: UID, text: 'lost', expectedRev: 0, nowIso: NOW })).rejects.toMatchObject({ code: 'summary_conflict' });
    expect(stored(db, 'researchWork/sr_s1').summaryRevisions.map((s) => s.text)).toEqual(['won']);
  });
  it('reviseSummary on a foreign record is refused and writes nothing', async () => {
    const db = seed();
    await expect(reviseSummary(db, { researchWorkId: 'sr_s1', uid: 'intruder', text: 't', nowIso: NOW })).rejects.toMatchObject({ code: 'record_not_found' });
    expect(db.__access.writes).toEqual([]);
  });
});
