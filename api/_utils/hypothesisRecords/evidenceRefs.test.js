// api/_utils/hypothesisRecords/evidenceRefs.test.js
//
// The Research Record Extension (7 Nov 2026; contract
// docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md §3) — the idea version:
//   · two more evidence-ref kinds beside { kind: 'researchWork', id } — an
//     evidence item and an exchange — each exactly its keys; a malformed one
//     refused everywhere a ref is accepted;
//   · refs stay SERVER-merged: serverEvidenceRefsOf refuses a malformed list
//     whole, and createPlayerVersion merges the server's refs after the
//     research refs (no route passes any: routes.test in api/forge pins that);
//   · the origin `shared_research`, derived from the server-written list
//     marker, checked before every existing branch — every existing case
//     unchanged.

import { describe, it, expect } from 'vitest';
import { makeCallsFirestore, stored } from '../__fixtures__/callsFirestore.js';
import {
  ORIGINS, SHARED_RESEARCH_LIST_MARKER, EVIDENCE_REF_KINDS, EVIDENCE_REF_KEYS, isEvidenceRef, canonicalEvidenceRef,
  evidenceItemRefOf, exchangeRefOf, mergeEvidenceRefs, serverEvidenceRefsOf, buildContent, originOf, contentOf,
} from './model.js';
import { createPlayerVersion } from './store.js';

const UUID = '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c';
const UUID2 = '0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b';
const research = { kind: 'researchWork', id: 'sr_s-1' };
const item = { kind: 'evidenceItem', recordKind: 'symbolDayEvidence', recordId: '2026-11-06_AVGO', itemId: 'news-77' };
const whole = { kind: 'evidenceItem', recordKind: 'fantasyTimesStories', recordId: 'story-2026-11-06-avgo', itemId: null };
const exch = { kind: 'exchange', hostCollection: 'sharedResearchSessions', hostId: 's-1', exchangeId: UUID };
const content = (over = {}) => ({
  statement: 'Networking is next', horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [],
  evidenceRefs: [], publishedAt: null, origin: 'manual', ...over,
});
const code = (fn) => { try { fn(); } catch (e) { return e.code ?? `untyped: ${e.message}`; } return 'no refusal'; };

describe('the evidence-ref kinds — each exactly its keys', () => {
  it('the three kinds and their canonical keys', () => {
    expect(EVIDENCE_REF_KINDS).toEqual(['researchWork', 'evidenceItem', 'exchange']);
    expect(EVIDENCE_REF_KEYS).toEqual({
      researchWork: ['kind', 'id'],
      evidenceItem: ['kind', 'recordKind', 'recordId', 'itemId'],
      exchange: ['kind', 'hostCollection', 'hostId', 'exchangeId'],
    });
  });
  it('each valid kind validates — a news item, a whole record (itemId null), an exchange of every host collection', () => {
    for (const r of [research, item, whole, exch]) expect(isEvidenceRef(r), JSON.stringify(r)).toBe(true);
    for (const hostCollection of ['watchlistSessions', 'researchSessions', 'analysisSessions', 'sharedResearchSessions']) {
      expect(isEvidenceRef({ ...exch, hostCollection }), hostCollection).toBe(true);
    }
    expect(evidenceItemRefOf({ recordKind: 'call', recordId: 'c-1' })).toEqual({ kind: 'evidenceItem', recordKind: 'call', recordId: 'c-1', itemId: null });
    expect(exchangeRefOf({ hostCollection: 'researchSessions', hostId: 'rs-9', exchangeId: UUID2 })).toEqual({ kind: 'exchange', hostCollection: 'researchSessions', hostId: 'rs-9', exchangeId: UUID2 });
  });
  it('a malformed ref of each kind is refused', () => {
    const bad = {
      'an unknown kind': { kind: 'tweet', id: 'x' },
      'researchWork with an extra key': { ...research, note: 'x' },
      'researchWork with a bad id': { kind: 'researchWork', id: 'zz_1' },
      'evidenceItem without itemId (canonical form: null for a whole record)': { kind: 'evidenceItem', recordKind: 'call', recordId: 'c-1' },
      'evidenceItem with an extra key': { ...item, url: 'https://x' },
      'evidenceItem of an unknown record kind': { ...item, recordKind: 'tweets' },
      'evidenceItem whose symbolDayEvidence id is not {etDate}_{SYMBOL}': { ...item, recordId: 'AVGO' },
      'evidenceItem with an empty itemId': { ...item, itemId: '' },
      'evidenceItem with an over-long itemId': { ...item, itemId: 'n'.repeat(257) },
      'exchange of a collection that hosts no research': { ...exch, hostCollection: 'workshopSessions' },
      'exchange with a malformed host id': { ...exch, hostId: 'a/b' },
      'exchange whose id is not a v4 UUID': { ...exch, exchangeId: 'ex-1' },
      'exchange whose id is upper case': { ...exch, exchangeId: UUID.toUpperCase() },
      'exchange missing its id': { kind: 'exchange', hostCollection: 'sharedResearchSessions', hostId: 's-1' },
      'a string': 'sr_s-1',
      'null': null,
    };
    for (const [name, r] of Object.entries(bad)) {
      expect(isEvidenceRef(r), name).toBe(false);
      expect(code(() => canonicalEvidenceRef(r)), name).toBe('invalid_evidence_refs');
      expect(code(() => buildContent(content({ evidenceRefs: [research, r] }))), name).toBe('invalid_evidence_refs');
    }
    expect(code(() => evidenceItemRefOf({ recordKind: 'symbolDayEvidence', recordId: 'AVGO' }))).toBe('invalid_evidence_refs');
    expect(code(() => exchangeRefOf({ hostCollection: 'watchlistSessions', hostId: 'w', exchangeId: 'x' }))).toBe('invalid_evidence_refs');
  });
  it('buildContent stores each ref in canonical key order; a researchWork ref is exactly what it always was', () => {
    const c = buildContent(content({ evidenceRefs: [{ id: 'sr_s-1', kind: 'researchWork' }, { itemId: 'news-77', recordId: '2026-11-06_AVGO', recordKind: 'symbolDayEvidence', kind: 'evidenceItem' }, exch] }));
    expect(c.evidenceRefs).toEqual([research, item, exch]);
    expect(c.evidenceRefs.map(Object.keys)).toEqual([['kind', 'id'], ['kind', 'recordKind', 'recordId', 'itemId'], ['kind', 'hostCollection', 'hostId', 'exchangeId']]);
  });
});

describe('the follow-up\'s ref rules (V2 §2 Q1, Q10b)', () => {
  const FID = 'f_00000000-0000-4000-8000-000000000001';
  it('an evidenceItem names a finding: recordKind researchWork, the record id, itemId the findingId (or null for the whole record)', () => {
    const finding = { kind: 'evidenceItem', recordKind: 'researchWork', recordId: 'sr_s-1', itemId: FID };
    expect(isEvidenceRef(finding)).toBe(true);
    expect(isEvidenceRef({ ...finding, itemId: null })).toBe(true);
    for (const itemId of ['news-1', 'f_1', FID.toUpperCase()]) expect(isEvidenceRef({ ...finding, itemId }), itemId).toBe(false);
    for (const recordId of ['sr_', 'not-a-record']) expect(isEvidenceRef({ ...finding, recordId }), recordId).toBe(false);
  });
  it('an evidenceItem never names an exchange (it has its own kind) or a retrieval (cite the finding holding its url)', () => {
    expect(isEvidenceRef({ kind: 'evidenceItem', recordKind: 'exchange', recordId: UUID, itemId: null })).toBe(false);
    expect(isEvidenceRef({ kind: 'evidenceItem', recordKind: 'retrieval', recordId: 'r-1', itemId: null })).toBe(false);
    expect(code(() => evidenceItemRefOf({ recordKind: 'retrieval', recordId: 'r-1' }))).toBe('invalid_evidence_refs');
    for (const recordKind of ['stockRankings', 'peerRankings']) expect(isEvidenceRef({ kind: 'evidenceItem', recordKind, recordId: 'doc-1', itemId: 'NVDA' }), recordKind).toBe(true);
  });
  it('the server may put at most 30 refs on one version: 30 accepted, 31 refused (too_many_evidence_refs)', () => {
    const refs = (n) => Array.from({ length: n }, (_, i) => ({ kind: 'researchWork', id: `sr_s-${i}` }));
    expect(serverEvidenceRefsOf(refs(30))).toHaveLength(30);
    expect(code(() => serverEvidenceRefsOf(refs(31)))).toBe('too_many_evidence_refs');
  });
});

describe('refs stay server-merged', () => {
  it('mergeEvidenceRefs: first-seen order, each ref once by its canonical form, across kinds; a malformed entry is dropped', () => {
    const merged = mergeEvidenceRefs([research, item], [{ ...item }, { exchangeId: UUID, hostId: 's-1', hostCollection: 'sharedResearchSessions', kind: 'exchange' }, { kind: 'bogus' }], [exch, whole, research]);
    expect(merged).toEqual([research, item, exch, whole]);
    // Two items of one record are two refs; an item and its whole record are two refs.
    expect(mergeEvidenceRefs([item, { ...item, itemId: 'news-78' }, { ...item, itemId: null }])).toHaveLength(3);
  });
  it('serverEvidenceRefsOf: canonical refs; ONE malformed ref refuses the whole list (a citation is never silently dropped)', () => {
    expect(serverEvidenceRefsOf([exch, item])).toEqual([exch, item]);
    expect(serverEvidenceRefsOf([])).toEqual([]);
    expect(code(() => serverEvidenceRefsOf([exch, { ...item, recordKind: 'tweets' }]))).toBe('invalid_evidence_refs');
    expect(code(() => serverEvidenceRefsOf('not a list'))).toBe('invalid_evidence_refs');
  });

  const OWNER = 'owner-1';
  const NOW = '2026-11-07T14:00:00.000Z';
  const listDoc = (over = {}) => ({ watchlistId: 'wl-1', userId: OWNER, sourceSessionId: null, sourceDropId: null, tickers: [{ symbol: 'AVGO' }], status: 'committed', researchWorkId: 'wl_wl-1', ...over });
  const record = { researchWorkId: 'wl_wl-1', userId: OWNER, origin: 'manual', state: 'completed', watchlistId: 'wl-1', createdAt: NOW, telemetry: { completions: 0 } };
  const seed = (list = listDoc()) => makeCallsFirestore({ docs: { 'watchlists/wl-1': list, 'researchWork/wl_wl-1': record } });
  const create = (db, extra = {}) => createPlayerVersion(db, { uid: OWNER, watchlistId: 'wl-1', opId: 'op-1', expectedVersion: 0, payload: { statement: 'Networking is next' }, nowIso: NOW, ...extra });

  it('createPlayerVersion with NO server refs writes exactly what it always wrote (the research refs only)', async () => {
    const a = seed();
    const b = seed();
    await create(a);
    await create(b, { serverEvidenceRefs: [] });
    expect(stored(a, 'watchlists/wl-1/hypothesisVersions/v1')).toEqual(stored(b, 'watchlists/wl-1/hypothesisVersions/v1'));
    expect(stored(a, 'watchlists/wl-1/hypothesisVersions/v1').evidenceRefs).toEqual([{ kind: 'researchWork', id: 'wl_wl-1' }]);
  });
  it('the server\'s refs are merged AFTER the research refs, canonical, each once — and hashed', async () => {
    const db = seed();
    const out = await create(db, { serverEvidenceRefs: [{ exchangeId: UUID, hostId: 's-1', hostCollection: 'sharedResearchSessions', kind: 'exchange' }, item, exch] });
    const v = stored(db, 'watchlists/wl-1/hypothesisVersions/v1');
    expect(v.evidenceRefs).toEqual([{ kind: 'researchWork', id: 'wl_wl-1' }, exch, item]);
    expect(out.version.contentHash).toBe(v.contentHash);
  });
  it('a malformed server ref refuses the request BEFORE any read or write', async () => {
    const db = seed();
    await expect(create(db, { serverEvidenceRefs: [{ ...exch, exchangeId: 'nope' }] })).rejects.toMatchObject({ code: 'invalid_evidence_refs' });
    expect(db.__access.reads).toEqual([]);
    expect(db.__access.writes).toEqual([]);
  });
  it('a list carrying the Shared Research marker gets a shared_research v1 (derived; the payload carries none)', async () => {
    const db = seed(listDoc({ [SHARED_RESEARCH_LIST_MARKER]: 'srs-1' }));
    await create(db);
    expect(stored(db, 'watchlists/wl-1/hypothesisVersions/v1')).toMatchObject({ origin: 'shared_research', horizonEnum: 'unspecified', horizonSource: 'default' });
  });
});

describe('the origin `shared_research` — derived from the server-written marker, checked first', () => {
  it('ORIGINS gains it (huddle and reporter are not added yet); buildContent accepts it', () => {
    expect(ORIGINS).toEqual(['signaldrop', 'theme', 'screener', 'manual', 'shared_research']);
    expect(buildContent(content({ origin: 'shared_research' })).origin).toBe('shared_research');
    for (const origin of ['huddle', 'reporter', 'analysis']) expect(code(() => buildContent(content({ origin }))), origin).toBe('invalid_origin');
  });
  it('the marker wins over every existing branch', () => {
    const M = SHARED_RESEARCH_LIST_MARKER;
    expect(M).toBe('sourceSharedResearchSessionId');
    expect(originOf({ [M]: 'srs-1' })).toBe('shared_research');
    expect(originOf({ [M]: 'srs-1', sourceSessionId: 's-1', sourceDropId: 'd-1' }, { source: 'theme' })).toBe('shared_research');
    expect(originOf({ [M]: 'srs-1', sourceScreenSpec: { filters: [] } })).toBe('shared_research');
    expect(originOf({ [M]: 'srs-1', sourceSessionId: 'rs-1' })).toBe('shared_research');
  });
  it('without the marker (absent, null, empty or not a string) every existing case is exactly as before', () => {
    for (const marker of [undefined, null, '', 0, false, {}, ['srs-1']]) {
      const m = marker === undefined ? {} : { [SHARED_RESEARCH_LIST_MARKER]: marker };
      const label = JSON.stringify(marker) ?? 'absent';
      expect(originOf({ ...m, sourceSessionId: 's-1', sourceDropId: 'd-1' }, {}), label).toBe('signaldrop');
      expect(originOf({ ...m, sourceSessionId: 's-1', sourceDropId: 'd-1' }, { source: 'theme' }), label).toBe('theme');
      expect(originOf({ ...m, sourceSessionId: null, sourceScreenSpec: { filters: [] } }), label).toBe('screener');
      expect(originOf({ ...m, sourceSessionId: 'rs-1', sourceDropId: null, sourceScreenSpec: null }), label).toBe('screener');
      expect(originOf({ ...m, sourceSessionId: null, sourceScreenSpec: null }), label).toBe('manual');
      expect(originOf({ ...m }), label).toBe('manual');
    }
    expect(originOf(null)).toBe('manual');
  });
  it('contentOf / the hash cover the origin like any content field', () => {
    expect(contentOf(buildContent(content({ origin: 'shared_research' }))).origin).toBe('shared_research');
  });
});
