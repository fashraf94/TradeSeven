// api/_utils/researchRecords/extension.test.js
//
// The Research Record Extension (7 Nov 2026; contract
// docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md, as changed by its
// follow-up V2 of the same day) — the research record's server-written fields
// on the pure model, and the store's two transactional writes on the
// optimistic Firestore double (their real-emulator concurrency rows:
// test/rules/researchRecordExtension.rules.mjs; the size row: size.test.js):
//   · the extension fields belong to `shared_research` records only (Q2/Q8):
//     every other origin is refused (`wrong_origin`) and never gets symbolKeys
//   · question — at mint or once later (questionPatch), never changed; a
//     completed Shared Research close needs one; subjectPatch is main's
//   · findings[] — shape (with the explicit `symbol`, Q3), caps, closed lists
//     (three more source kinds); append-only; supersedes honoured; the 101st
//   · symbolKeys — the current findings' symbols, then symbols[]; every
//     Shared Research write writes them fresh; no host write ever adds them
//   · summary — 1,000 characters; basedOn 1–25 current findings (Q5)
//   · `concluded` — only a Shared Research record closing completed
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): model.js imports
// src/constants/researchRecords.js; this unmocked import is the guard. Never mock it.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';
import {
  RECORD_SCHEMA_VERSION, SYMBOLS_MAX, HOST_COLLECTIONS, STAGES_BY_ORIGIN, RESEARCH_STAGES, RESEARCH_ORIGINS, TERMINAL_REASONS,
  FINDING_KINDS, FINDING_RECORD_KINDS, EVIDENCE_ITEM_RECORD_KINDS, FINDING_STATUSES, PIN_TYPES,
  QUESTION_MAX_LEN, FINDINGS_MAX, FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, SUMMARY_REVISIONS_MAX, BASED_ON_MAX,
  researchWorkIdFor, isResearchWorkId, researchRefOf, isOwnedRecord, buildRecord, subjectPatch, turnPatch, closePatch, questionPatch,
  manualFunnel, dialogueFunnel, analysisFunnel, screenerFunnel, emptyTelemetry, recordSummaryOf,
  buildFinding, findingAppendPatch, currentFindingsOf, summaryRevisionPatch, symbolKeysOf, symbolKeyOf, isFindingId,
  normalizeQuestion, isRecordRef, ResearchRecordError,
} from './model.js';
import { appendFinding, reviseSummary, recordTurnOutcome, researchSummariesOf } from './store.js';
import { EVIDENCE_REF_KINDS, SERVER_EVIDENCE_REFS_MAX } from '../hypothesisRecords/model.js';

const EARLIER = '2026-11-07T14:00:00.000Z';
const NOW = '2026-11-07T15:00:00.000Z';
const UID = 'u1';
const UUID = '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c';
const fid = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const code = (fn) => { try { fn(); } catch (e) { return e.code ?? `untyped: ${e.message}`; } return 'no refusal'; };
const HOST_ORIGINS = RESEARCH_ORIGINS.filter((o) => o !== 'shared_research');

/** A Shared Research record as the route will mint it: a question, no subject yet, no funnel. */
const srRecord = (over = {}) => buildRecord({
  researchWorkId: 'sr_s1', userId: UID, origin: 'shared_research', host: { collection: HOST_COLLECTIONS.shared_research, id: 's1' },
  createdAt: EARLIER, question: '  Does the raised guide hold?  ', funnel: manualFunnel(), telemetry: emptyTelemetry(), ...over,
});
/** A host record of each origin, as its host mints it (no question). */
const HOST_ID = { signaldrop: 'ws_h', theme: 'ws_h', screener: 'rs_h', analysis: 'as_h', manual: 'wl_h' };
const HOST_FUNNEL = {
  signaldrop: () => dialogueFunnel({ candidates: [{ symbol: 'NVDA', status: 'kept' }] }),
  theme: () => dialogueFunnel({ candidates: [{ symbol: 'NVDA', status: 'kept' }] }),
  screener: () => screenerFunnel({ screens: [] }),
  analysis: () => analysisFunnel({ symbols: ['NVDA'], digest: { size: 1, covered: 1, offUniverse: [] } }),
  manual: () => manualFunnel(),
};
const hostRecord = (origin, over = {}) => buildRecord({
  researchWorkId: HOST_ID[origin], userId: UID, origin, host: origin === 'manual' ? null : { collection: 'watchlistSessions', id: 'h' },
  createdAt: EARLIER, funnel: HOST_FUNNEL[origin](), telemetry: emptyTelemetry(), ...over,
});
/** A finding's input as the route will hand it over (no id — the server mints it). */
const input = (over = {}) => ({
  kind: 'earnings_fact', fact: 'Q3 EPS 1.12 vs 1.05 expected.',
  source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_NVDA', label: 'NVDA, 6 Nov' },
  at: '2026-11-06T21:05:00.000Z', asOf: '2026-11-06T21:10:00.000Z', status: 'verified', ...over,
});
const built = (n, over = {}) => buildFinding(input(over), { findingId: fid(n), nowIso: NOW });
/** A record holding n findings (each its own), appended through the model. */
function withFindings(record, n, over = {}) {
  let r = record;
  for (let i = 1; i <= n; i++) r = { ...r, ...findingAppendPatch(r, built(i, over), { nowIso: NOW }) };
  return r;
}

describe('closed lists — defined once in the model, version 1 amended in place by the follow-up (nothing stored yet)', () => {
  // Growing a list once records exist means a new entry HERE under a new RECORD_SCHEMA_VERSION.
  const LISTS_BY_SCHEMA = {
    1: {
      FINDING_KINDS: ['earnings_fact', 'release', 'coverage', 'check_receipt', 'setup', 'idea', 'observation', 'product', 'relationship', 'inference', 'next_action'],
      FINDING_RECORD_KINDS: ['symbolDayEvidence', 'fantasyTimesWire', 'fantasyTimesStories', 'ingestedClaims', 'stockBriefs', 'estimatesCache', 'setupEvidence', 'activationPointer', 'call', 'hypothesisVersion', 'exchange', 'kb', 'retrieval', 'stockRankings', 'peerRankings', 'researchWork'],
      EVIDENCE_ITEM_RECORD_KINDS: ['symbolDayEvidence', 'fantasyTimesWire', 'fantasyTimesStories', 'ingestedClaims', 'stockBriefs', 'estimatesCache', 'setupEvidence', 'activationPointer', 'call', 'hypothesisVersion', 'kb', 'stockRankings', 'peerRankings', 'researchWork'],
      FINDING_STATUSES: ['verified', 'unverified', 'unavailable'],
      PIN_TYPES: ['price', 'time'],
      EVIDENCE_REF_KINDS: ['researchWork', 'evidenceItem', 'exchange'],
      RESEARCH_ORIGINS: ['signaldrop', 'theme', 'screener', 'analysis', 'manual', 'shared_research'],
      TERMINAL_REASONS: { savedToList: 'saved_to_list', playerAuthored: 'player_authored', concluded: 'concluded' },
    },
  };
  it('each list, exactly, for the current schema version — and frozen', () => {
    const lists = { FINDING_KINDS, FINDING_RECORD_KINDS, EVIDENCE_ITEM_RECORD_KINDS, FINDING_STATUSES, PIN_TYPES, EVIDENCE_REF_KINDS, RESEARCH_ORIGINS, TERMINAL_REASONS };
    expect(RECORD_SCHEMA_VERSION).toBe(1);
    expect(lists).toEqual(LISTS_BY_SCHEMA[RECORD_SCHEMA_VERSION]);
    for (const l of Object.values(lists)) expect(Object.isFrozen(l)).toBe(true);
  });
  it('the source-kind list lives in a DATA-ONLY module: one frozen list, no import, no require, no read (review B1 — its guard listing covers no code)', () => {
    const src = readFileSync(new URL('./findingRecordKinds.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const body = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').trim();
    expect(body).toMatch(/^export const FINDING_RECORD_KINDS = Object\.freeze\(\[[\s'A-Za-z,]*\]\);$/);
  });
  it('the caps, as the contract states them', () => {
    expect({ QUESTION_MAX_LEN, FINDINGS_MAX, FINDING_FACT_MAX_LEN, SOURCE_LABEL_MAX_LEN, SUMMARY_TEXT_MAX_LEN, SUMMARY_REVISIONS_MAX, BASED_ON_MAX, SYMBOLS_MAX, SERVER_EVIDENCE_REFS_MAX })
      .toEqual({ QUESTION_MAX_LEN: 500, FINDINGS_MAX: 100, FINDING_FACT_MAX_LEN: 500, SOURCE_LABEL_MAX_LEN: 120, SUMMARY_TEXT_MAX_LEN: 1000, SUMMARY_REVISIONS_MAX: 10, BASED_ON_MAX: 25, SYMBOLS_MAX: 100, SERVER_EVIDENCE_REFS_MAX: 30 });
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
    const s = recordSummaryOf(withFindings(srRecord(), 1));
    expect(Object.keys(s)).toEqual(['researchWorkId', 'origin', 'createdAt', 'watchlistId', 'hypothesisVersion', 'stages', 'completions', 'state', 'terminalReason', 'endedAt']);
  });
});

describe('the question — at mint or once later; never changed; independent of the subject (clarification 1)', () => {
  it('a Shared Research mint with a question (no subject needed) and one without', () => {
    expect(srRecord()).toMatchObject({ question: 'Does the raised guide hold?', watchlistId: null });
    expect(srRecord({ question: 'q'.repeat(QUESTION_MAX_LEN) }).question).toHaveLength(QUESTION_MAX_LEN);
    for (const bad of ['q'.repeat(QUESTION_MAX_LEN + 1), '', '   ', 7, {}]) expect(code(() => srRecord({ question: bad })), String(bad).slice(0, 9)).toBe('invalid_question');
    expect(Object.keys(srRecord({ question: null }))).not.toContain('question');
    expect(normalizeQuestion(' a ')).toBe('a');
  });
  it('a mint with a question on ANY other origin is refused (wrong_origin)', () => {
    for (const origin of HOST_ORIGINS) expect(code(() => hostRecord(origin, { question: 'Why?' })), origin).toBe('wrong_origin');
  });
  it('questionPatch sets it once on an open Shared Research record; a second set is refused', () => {
    const open = srRecord({ question: null });
    const p = questionPatch(open, { question: '  Why now?  ', atIso: NOW });
    expect(p).toEqual({ question: 'Why now?', updatedAt: NOW, symbolKeys: [] });
    expect(code(() => questionPatch({ ...open, ...p }, { question: 'Another?', atIso: NOW }))).toBe('question_already_set');
    expect(code(() => questionPatch(srRecord(), { question: 'Another?', atIso: NOW }))).toBe('question_already_set');
    expect(code(() => questionPatch(open, { question: '', atIso: NOW }))).toBe('invalid_question');
  });
  it('questionPatch is refused on a closed record and on every host origin', () => {
    for (const state of ['completed', 'abandoned', 'failed']) expect(code(() => questionPatch({ ...srRecord({ question: null }), state }, { question: 'Q?', atIso: NOW })), state).toBe('record_closed');
    for (const origin of HOST_ORIGINS) expect(code(() => questionPatch(hostRecord(origin), { question: 'Q?', atIso: NOW })), origin).toBe('wrong_origin');
  });
  it('subjectPatch behaves exactly as on main, for every origin (a question key in the subject is not read)', () => {
    // main d503dd07's subjectPatch, verbatim, as the oracle.
    const mainSubjectPatch = (record, { watchlistId, hypothesisVersion = null }) => {
      if (!(record !== null && typeof record === 'object' && !Array.isArray(record)) || record.watchlistId != null || !(typeof watchlistId === 'string' && watchlistId.length > 0)) return {};
      return { watchlistId, hypothesisVersion: Number.isSafeInteger(hypothesisVersion) && hypothesisVersion > 0 ? hypothesisVersion : null };
    };
    const records = [...HOST_ORIGINS.map((o) => hostRecord(o)), srRecord(), srRecord({ question: null }), { ...srRecord(), watchlistId: 'wl-0' }, null, 'x'];
    const subjects = [{ watchlistId: 'wl-9', hypothesisVersion: 3 }, { watchlistId: 'wl-9' }, { watchlistId: 'wl-9', hypothesisVersion: 0 }, { watchlistId: '' }, { watchlistId: 'wl-9', question: 'Q?' }];
    for (const r of records) for (const s of subjects) expect(subjectPatch(r, s)).toEqual(mainSubjectPatch(r, s));
  });
  it('a Shared Research record cannot close completed without its question; abandoned or failed need none', () => {
    const noQ = srRecord({ question: null });
    expect(code(() => closePatch(noQ, { state: 'completed', terminalReason: 'saved_to_list', atIso: NOW, funnel: manualFunnel() }))).toBe('question_missing');
    expect(code(() => closePatch(noQ, { state: 'completed', terminalReason: 'concluded', atIso: NOW, funnel: manualFunnel() }))).toBe('question_missing');
    for (const state of ['abandoned', 'failed']) expect(closePatch(noQ, { state, terminalReason: 'user_close', atIso: NOW, funnel: manualFunnel() })).toMatchObject({ state });
    expect(closePatch(srRecord(), { state: 'completed', terminalReason: 'saved_to_list', atIso: NOW, funnel: manualFunnel(), subject: { watchlistId: 'wl-2', hypothesisVersion: 1 } }))
      .toMatchObject({ state: 'completed', watchlistId: 'wl-2', hypothesisVersion: 1 });
  });
});

describe('`concluded` — a Shared Research investigation completed without an idea (clarification 4)', () => {
  it('accepted on a Shared Research record closing completed; refused everywhere else', () => {
    expect(closePatch(srRecord(), { state: 'completed', terminalReason: 'concluded', atIso: NOW, funnel: manualFunnel() })).toMatchObject({ state: 'completed', terminalReason: 'concluded' });
    for (const state of ['abandoned', 'failed']) expect(code(() => closePatch(srRecord(), { state, terminalReason: 'concluded', atIso: NOW, funnel: manualFunnel() })), state).toBe('invalid_terminal_reason');
    for (const origin of HOST_ORIGINS) {
      for (const state of ['completed', 'abandoned']) expect(code(() => closePatch(hostRecord(origin), { state, terminalReason: 'concluded', atIso: NOW, funnel: HOST_FUNNEL[origin]() })), `${origin} ${state}`).toBe('invalid_terminal_reason');
    }
  });
  it('every host close with its own reasons is exactly what it was', () => {
    for (const origin of HOST_ORIGINS) {
      const p = closePatch(hostRecord(origin), { state: 'abandoned', terminalReason: 'user_close', atIso: NOW, funnel: HOST_FUNNEL[origin]() });
      expect(Object.keys(p), origin).toEqual(['state', 'terminalReason', 'endedAt', 'updatedAt', 'stages', 'symbols', 'symbolsTruncated']);
    }
  });
});

describe('findings — shape, caps and closed lists', () => {
  it('a finding is exactly its fields, in order, with the server\'s id and its symbol', () => {
    const f = built(1, { pin: { type: 'price', value: 142.5 } });
    expect(f).toEqual({
      findingId: fid(1), kind: 'earnings_fact', symbol: 'NVDA', fact: 'Q3 EPS 1.12 vs 1.05 expected.',
      source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_NVDA', label: 'NVDA, 6 Nov' },
      at: '2026-11-06T21:05:00.000Z', asOf: '2026-11-06T21:10:00.000Z', status: 'verified', statusReason: null,
      pin: { type: 'price', value: 142.5 }, supersedes: null,
    });
    expect(Object.keys(f)).toEqual(['findingId', 'kind', 'symbol', 'fact', 'source', 'at', 'asOf', 'status', 'statusReason', 'pin', 'supersedes']);
    expect(isFindingId(fid(1))).toBe(true);
  });
  it('the id is the server\'s: a caller-sent findingId (or any unknown field) is refused; a malformed server id throws', () => {
    expect(code(() => buildFinding({ ...input(), findingId: fid(9) }, { findingId: fid(1), nowIso: NOW }))).toBe('invalid_finding');
    expect(code(() => buildFinding({ ...input(), origin: 'x' }, { findingId: fid(1), nowIso: NOW }))).toBe('invalid_finding');
    expect(() => buildFinding(input(), { findingId: 'f_1', nowIso: NOW })).toThrow(/server-minted id/);
    for (const bad of ['f_00000000-0000-1000-8000-000000000001', `F_${fid(1).slice(2)}`, fid(1).toUpperCase()]) expect(isFindingId(bad), bad).toBe(false);
  });
  it('symbol (Q3): null or one key-form symbol; a symbolDayEvidence finding takes its id\'s, and a different one is refused', () => {
    const call = (symbol) => built(1, { symbol, source: { recordKind: 'call', recordId: 'c-1', label: 'A call' } });
    expect(call(null).symbol).toBeNull();
    expect(call(undefined).symbol).toBeNull();
    expect(call('BRK-B').symbol).toBe('BRK-B');
    for (const bad of ['brk-b', 'BRK.B', ' NVDA', 'NOT A SYMBOL', 7, '']) expect(code(() => call(bad)), String(bad)).toBe('invalid_symbol');
    expect(built(1).symbol).toBe('NVDA'); // filled from 2026-11-06_NVDA
    expect(built(1, { symbol: 'NVDA' }).symbol).toBe('NVDA');
    expect(built(1, { source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_BRK.B', label: 'b' } }).symbol).toBe('BRK-B');
    expect(code(() => built(1, { symbol: 'AMD' }))).toBe('invalid_symbol');
  });
  it('every closed list refuses what it does not hold; each source kind validates with its own id shape', () => {
    for (const kind of FINDING_KINDS) expect(built(1, { kind }).kind).toBe(kind);
    expect(code(() => built(1, { kind: 'rumor' }))).toBe('invalid_finding_kind');
    for (const status of ['unverified', 'unavailable']) expect(built(1, { status, statusReason: 'provider_unavailable' }).status).toBe(status);
    expect(code(() => built(1, { status: 'maybe' }))).toBe('invalid_status');
    expect(code(() => built(1, { source: { recordKind: 'tweets', recordId: 'x', label: 'x' } }))).toBe('invalid_source');
    const ID = { symbolDayEvidence: '2026-11-06_AMD', researchWork: 'as_other-1', exchange: UUID };
    for (const recordKind of FINDING_RECORD_KINDS) {
      const url = recordKind === 'retrieval' ? 'https://example.com/a' : undefined;
      expect(built(1, { source: { recordKind, recordId: ID[recordKind] ?? 'rec-1', label: 'L', ...(url ? { url } : {}) } }).source.recordKind).toBe(recordKind);
    }
  });
  it('the three added kinds (clarification 2): stockRankings and peerRankings take any record id; researchWork a research record id; exchange a v4 UUID', () => {
    for (const recordKind of ['stockRankings', 'peerRankings']) expect(isRecordRef(recordKind, 'stockRankings-2026-11-06')).toBe(true);
    for (const ok of ['as_x', 'sr_older-1', 'wl_w']) expect(isRecordRef('researchWork', ok), ok).toBe(true);
    for (const bad of ['older', 'sr_', 'xx_1']) expect(isRecordRef('researchWork', bad), bad).toBe(false);
    expect(isRecordRef('exchange', UUID)).toBe(true);
    for (const bad of ['ex-1', UUID.toUpperCase(), '6f1c2b0e-8a7d-1c3b-9e21-0a5d4f3e2b1c']) expect(isRecordRef('exchange', bad), bad).toBe(false);
    expect(code(() => built(1, { source: { recordKind: 'exchange', recordId: 'ex-1', label: 'turn 3' } }))).toBe('invalid_source');
  });
  it('a researchWork source cites an EARLIER investigation, never its own record', () => {
    const r = srRecord();
    const own = built(1, { source: { recordKind: 'researchWork', recordId: 'sr_s1', label: 'this one' } });
    expect(code(() => findingAppendPatch(r, own, { nowIso: NOW }))).toBe('invalid_source');
    const older = built(1, { source: { recordKind: 'researchWork', recordId: 'sr_older', label: 'last week' } });
    expect(findingAppendPatch(r, older, { nowIso: NOW }).findings).toHaveLength(1);
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
    expect(Object.keys(built(1).source)).toEqual(['recordKind', 'recordId', 'label']);
  });
  it('a symbolDayEvidence record id is {etDate}_{SYMBOL} on a real date', () => {
    for (const ok of ['2026-11-06_NVDA', '2026-11-06_BRK.B', '2026-11-06_BRK-B', '2024-02-29_X']) expect(isRecordRef('symbolDayEvidence', ok), ok).toBe(true);
    for (const bad of ['NVDA', '2026-11-06', '2026-02-30_NVDA', '2026-13-01_X', '2026-11-06_nvda', '2026-11-06_NVDA_x']) expect(isRecordRef('symbolDayEvidence', bad), bad).toBe(false);
    expect(isRecordRef('call', 'a\u0000b')).toBe(false);
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
    expect(findingAppendPatch(r3, built(4, { supersedes: fid(3) }), { nowIso: NOW }).findings).toHaveLength(4);
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

describe('wrong_origin — the extension fields belong to Shared Research records only (Q2/Q8)', () => {
  it('each of the four extension writes refuses every host origin', () => {
    for (const origin of HOST_ORIGINS) {
      const r = hostRecord(origin);
      expect(code(() => findingAppendPatch(r, built(1), { nowIso: NOW })), `finding ${origin}`).toBe('wrong_origin');
      expect(code(() => summaryRevisionPatch(r, { text: 't', basedOn: [fid(1)] }, { nowIso: NOW })), `summary ${origin}`).toBe('wrong_origin');
      expect(code(() => questionPatch(r, { question: 'Q?', atIso: NOW })), `question ${origin}`).toBe('wrong_origin');
      expect(code(() => hostRecord(origin, { question: 'Q?' })), `mint ${origin}`).toBe('wrong_origin');
    }
  });
  it('…and the store\'s two writes refuse them too, writing nothing', async () => {
    for (const origin of HOST_ORIGINS) {
      const r = hostRecord(origin);
      const db = makeCallsFirestore({ docs: { [`researchWork/${r.researchWorkId}`]: r } });
      await expect(appendFinding(db, { researchWorkId: r.researchWorkId, uid: UID, finding: input(), nowIso: NOW })).rejects.toMatchObject({ code: 'wrong_origin' });
      await expect(reviseSummary(db, { researchWorkId: r.researchWorkId, uid: UID, text: 't', basedOn: [fid(1)], nowIso: NOW })).rejects.toMatchObject({ code: 'wrong_origin' });
      expect(db.__access.writes, origin).toEqual([]);
    }
  });
});

describe('symbolKeys — the current findings\' symbols, then symbols[]; Shared Research records only (Q2/Q3)', () => {
  it('current findings first (record order), then the cohort; each once; a superseded finding\'s symbol no longer counts', () => {
    const call = (n, symbol, over = {}) => built(n, { symbol, source: { recordKind: 'call', recordId: `c-${n}`, label: 'c' }, ...over });
    const record = {
      symbols: [{ symbol: 'brk.b' }, { symbol: 'NVDA' }, { symbol: ' amd ' }, { symbol: '' }, { symbol: 'not a symbol!' }],
      findings: [call(1, 'TSM'), call(2, 'AMD'), call(3, null), built(4, { source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_BF.B', label: 'b' } }), call(5, 'MU', { supersedes: fid(1) })],
    };
    expect(symbolKeysOf(record)).toEqual(['AMD', 'BF-B', 'MU', 'BRK-B', 'NVDA']); // TSM was superseded by finding 5
    expect(symbolKeyOf('brk.b')).toBe('BRK-B');
    for (const bad of [null, '', '   ', 'A B', 'TOOLONGSYMBOL1', '$NVDA']) expect(symbolKeyOf(bad), String(bad)).toBeNull();
  });
  it('no id is parsed any more: a finding\'s symbol is its own field', () => {
    const f = { ...built(1), symbol: null }; // a stored finding whose symbol is null, whatever its source id says
    expect(symbolKeysOf({ findings: [f] })).toEqual([]);
  });
  it('at most SYMBOLS_MAX; a finding\'s symbol is kept before the cohort\'s', () => {
    const symbols = Array.from({ length: SYMBOLS_MAX + 30 }, (_, i) => ({ symbol: `S${i}` }));
    const keys = symbolKeysOf({ symbols, findings: [built(1)] });
    expect(keys).toHaveLength(SYMBOLS_MAX);
    expect(keys[0]).toBe('NVDA');
  });
  it('EVERY write to a Shared Research record writes them fresh: mint, question, turn, close (with its subject), finding, summary', () => {
    const r0 = srRecord({ question: null, funnel: { stages: {}, symbols: [{ symbol: 'tsm', outcome: null, reason: null }] } });
    expect(r0.symbolKeys).toEqual(['TSM']);
    const r1 = { ...r0, ...findingAppendPatch(r0, built(1), { nowIso: NOW }) };
    expect(r1.symbolKeys).toEqual(['NVDA', 'TSM']);
    expect(questionPatch(r1, { question: 'Why?', atIso: NOW }).symbolKeys).toEqual(['NVDA', 'TSM']);
    const r2 = { ...r1, question: 'Why?' };
    expect(turnPatch(r2, { kind: 'completion', atIso: NOW, funnel: { stages: {}, symbols: [{ symbol: 'AVGO', outcome: null, reason: null }] } }).symbolKeys).toEqual(['NVDA', 'AVGO']);
    expect(turnPatch({ ...r2, symbolKeys: ['STALE'] }, { kind: 'failure', atIso: NOW }).symbolKeys).toEqual(['NVDA', 'TSM']);
    expect(closePatch({ ...r2, symbolKeys: ['STALE'] }, { state: 'completed', terminalReason: 'saved_to_list', atIso: NOW, funnel: manualFunnel(), subject: { watchlistId: 'wl-1' } }))
      .toMatchObject({ watchlistId: 'wl-1', symbolKeys: ['NVDA'] });
    expect(summaryRevisionPatch({ ...r2, symbolKeys: ['STALE'] }, { text: 'Holds.', basedOn: [fid(1)] }, { nowIso: NOW }).symbolKeys).toEqual(['NVDA', 'TSM']);
  });
  it('no host mint or patch EVER adds them — every host origin, every mint and patch, even a host record that somehow carries them', async () => {
    for (const origin of HOST_ORIGINS) {
      const rec = hostRecord(origin);
      expect(Object.keys(rec), `mint ${origin}`).not.toContain('symbolKeys');
      const carrying = { ...rec, symbolKeys: ['ZZZ'] };
      for (const r of [rec, carrying]) {
        const outs = [
          turnPatch(r, { kind: 'completion', atIso: NOW, funnel: HOST_FUNNEL[origin]() }),
          turnPatch(r, { kind: 'failure', atIso: NOW }),
          closePatch(r, { state: 'abandoned', terminalReason: 'user_close', atIso: NOW, funnel: HOST_FUNNEL[origin]() }),
          closePatch(r, { state: 'completed', terminalReason: 'saved_to_list', atIso: NOW, funnel: HOST_FUNNEL[origin](), subject: { watchlistId: 'wl-9', hypothesisVersion: 1 } }),
          subjectPatch(r, { watchlistId: 'wl-9' }),
        ];
        for (const o of outs) expect(Object.keys(o), `${origin} patch`).not.toContain('symbolKeys');
      }
      const db = makeCallsFirestore({ docs: { [`researchWork/${rec.researchWorkId}`]: rec } });
      expect(await recordTurnOutcome(db, { researchWorkId: rec.researchWorkId, uid: UID, kind: 'failure', elapsedMs: 1, atIso: NOW, label: 't' })).toBe('recorded');
      expect(Object.keys(stored(db, `researchWork/${rec.researchWorkId}`)), `stored ${origin}`).not.toContain('symbolKeys');
    }
  });
  it('the census: no non-test file under api/ or src/ but the research model names symbolKeys (no other writer can exist)', () => {
    const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const walk = (dir, out = []) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(js|jsx|mjs|cjs)$/.test(e.name) && !/\.test\.|__fixtures__/.test(p)) out.push(relative(REPO, p).replace(/\\/g, '/'));
      }
      return out;
    };
    const files = [...walk(resolve(REPO, 'api')), ...walk(resolve(REPO, 'src'))];
    expect(files.length).toBeGreaterThan(500);
    expect(files.filter((f) => /\bsymbolKeys\b/.test(readFileSync(resolve(REPO, f), 'utf8')))).toEqual(['api/_utils/researchRecords/model.js']);
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
  it('the 10th lands; the 11th is refused with summary_revisions_full (the cap the size rule set)', () => {
    let r = r2();
    for (let i = 1; i <= SUMMARY_REVISIONS_MAX; i++) r = { ...r, ...summaryRevisionPatch(r, { text: `rev ${i}`, basedOn: [fid(1)] }, { nowIso: NOW }) };
    expect(r.summary.rev).toBe(SUMMARY_REVISIONS_MAX);
    expect(r.summaryRevisions).toHaveLength(SUMMARY_REVISIONS_MAX);
    expect(code(() => summaryRevisionPatch(r, { text: 'one more', basedOn: [fid(1)] }, { nowIso: NOW }))).toBe('summary_revisions_full');
  });
  it('a revision the caller did not see is a typed conflict when it says what it saw', () => {
    const r = { ...r2(), ...summaryRevisionPatch(r2(), { text: 'v1', basedOn: [fid(1)] }, { nowIso: NOW }) };
    expect(code(() => summaryRevisionPatch(r, { text: 'v2', basedOn: [fid(1)], expectedRev: 0 }, { nowIso: NOW }))).toBe('summary_conflict');
    expect(summaryRevisionPatch(r, { text: 'v2', basedOn: [fid(1)], expectedRev: 1 }, { nowIso: NOW }).summary.rev).toBe(2);
  });
  it('text: 1,000 characters accepted, 1,001 refused (clarification 3)', () => {
    expect(summaryRevisionPatch(r2(), { text: 'z'.repeat(SUMMARY_TEXT_MAX_LEN), basedOn: [fid(1)] }, { nowIso: NOW }).summary.text).toHaveLength(1000);
    for (const text of ['z'.repeat(SUMMARY_TEXT_MAX_LEN + 1), '', '  ', null]) expect(code(() => summaryRevisionPatch(r2(), { text, basedOn: [fid(1)] }, { nowIso: NOW }))).toBe('invalid_summary_text');
  });
  it('basedOn (Q5): 1–25 current findings, each once — empty, 26, a repeat or a malformed id is invalid_based_on; unknown and superseded have their own codes', () => {
    const r30 = withFindings(srRecord(), 30, { source: { recordKind: 'call', recordId: 'c-1', label: 'c' } });
    const ids = (n) => Array.from({ length: n }, (_, i) => fid(i + 1));
    expect(summaryRevisionPatch(r30, { text: 't', basedOn: ids(BASED_ON_MAX) }, { nowIso: NOW }).summary.basedOn).toHaveLength(25);
    for (const basedOn of [[], ids(BASED_ON_MAX + 1), [fid(1), fid(1)], ['f_1'], 'f', undefined]) {
      expect(code(() => summaryRevisionPatch(r30, { text: 't', basedOn }, { nowIso: NOW })), JSON.stringify(basedOn)?.slice(0, 40)).toBe('invalid_based_on');
    }
    expect(code(() => summaryRevisionPatch(r30, { text: 't', basedOn: [fid(77)] }, { nowIso: NOW }))).toBe('based_on_unknown');
    const corrected = { ...r30, ...findingAppendPatch(r30, built(31, { supersedes: fid(2) }), { nowIso: NOW }) };
    expect(code(() => summaryRevisionPatch(corrected, { text: 't', basedOn: [fid(1), fid(2)] }, { nowIso: NOW }))).toBe('based_on_superseded');
    expect(summaryRevisionPatch(corrected, { text: 't', basedOn: [fid(1), fid(31)] }, { nowIso: NOW }).summary.rev).toBe(1);
  });
  it('a closed record never moves; a summary that disagrees with its revisions is unreadable', () => {
    expect(code(() => summaryRevisionPatch({ ...r2(), state: 'completed' }, { text: 't', basedOn: [fid(1)] }, { nowIso: NOW }))).toBe('record_closed');
    expect(code(() => summaryRevisionPatch({ ...r2(), summary: { rev: 3 }, summaryRevisions: [] }, { text: 't', basedOn: [fid(1)] }, { nowIso: NOW }))).toBe('summary_unreadable');
  });
  it('a corrupt stored record is REFUSED, never overwritten (review A6): a list field that is not a list, a summary that is not the last revision', () => {
    const r = { ...r2(), ...summaryRevisionPatch(r2(), { text: 'v1', basedOn: [fid(1)] }, { nowIso: NOW }) };
    for (const bad of ['corrupt', { a: 1 }, 7]) {
      expect(code(() => findingAppendPatch({ ...r, findings: bad }, built(9), { nowIso: NOW })), JSON.stringify(bad)).toBe('record_unreadable');
      expect(code(() => summaryRevisionPatch({ ...r, summaryRevisions: bad, summary: null }, { text: 't', basedOn: [fid(1)] }, { nowIso: NOW })), JSON.stringify(bad)).toBe('record_unreadable');
      expect(code(() => summaryRevisionPatch({ ...r, findings: bad }, { text: 't', basedOn: [fid(1)] }, { nowIso: NOW })), JSON.stringify(bad)).toBe('record_unreadable');
    }
    expect(code(() => summaryRevisionPatch({ ...r, summary: null }, { text: 't', basedOn: [fid(1)] }, { nowIso: NOW }))).toBe('summary_unreadable');
    expect(code(() => summaryRevisionPatch({ ...r, summary: { ...r.summary, text: 'edited' } }, { text: 't', basedOn: [fid(1)] }, { nowIso: NOW }))).toBe('summary_unreadable');
    const alphabetized = Object.fromEntries(Object.keys(r.summary).sort().map((k) => [k, r.summary[k]]));
    expect(summaryRevisionPatch({ ...r, summary: alphabetized }, { text: 'v2', basedOn: [fid(1)] }, { nowIso: NOW }).summary.rev).toBe(2);
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
  it('the scanned files carry no escaped quote inside a quoted literal (the extractor would stop at it and miss the rest)', () => {
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
      await reviseSummary(db, { researchWorkId: 'sr_s1', uid: UID, text: 'first to commit', basedOn: [fid(1)], nowIso: NOW });
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
      await reviseSummary(db, { researchWorkId: 'sr_s1', uid: UID, text: 'won', basedOn: [fid(1)], expectedRev: 0, nowIso: NOW });
    };
    await expect(reviseSummary(db, { researchWorkId: 'sr_s1', uid: UID, text: 'lost', basedOn: [fid(1)], expectedRev: 0, nowIso: NOW })).rejects.toMatchObject({ code: 'summary_conflict' });
    expect(stored(db, 'researchWork/sr_s1').summaryRevisions.map((s) => s.text)).toEqual(['won']);
  });
  it('reviseSummary on a foreign record is refused and writes nothing', async () => {
    const db = seed();
    await expect(reviseSummary(db, { researchWorkId: 'sr_s1', uid: 'intruder', text: 't', basedOn: [fid(1)], nowIso: NOW })).rejects.toMatchObject({ code: 'record_not_found' });
    expect(db.__access.writes).toEqual([]);
  });
});
