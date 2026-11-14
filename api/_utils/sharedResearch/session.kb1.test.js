// api/_utils/sharedResearch/session.kb1.test.js
//
// KB-1 — WHAT THE SESSION RECORDS (Amendment A §A4.2–§A4.4; the KB-1 build
// prompt, Parts 2–4, Part 7 rows 3–5 at the unit level). The stamp written by
// framingSessionOf / openSessionOf; exchangeOf's five new fields, written only
// when given; the method change between partner turns; methodsUsed over the
// kept findings; the retained retrieval and its hash; the worst-case size.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  exchangeOf, framingSessionOf, openSessionOf, methodChangeOf, methodsUsedOf, retainedRetrievalOf, seenSha256Of, exchangeMethodOf,
  sessionViewOf, EXCHANGE_TEXT_MAX, OBSERVATION_MAX, DIRECTION_MAX,
} from './session.js';
import { BASELINE, methodStampOf, methodRefOf } from './method.js';
import { REPLY_MAX, FRAME_QUESTION_MAX, FRAME_CHECK_MAX, STEP_FINDINGS_MAX, COMPANIES_MAX } from './stepSchema.js';
import { STEP_BUDGET } from '../../../src/constants/sharedResearch.js';
import { SOURCE_URL_MAX_LEN } from '../researchRecords/model.js';
import { ITEMS_MAX, HIGHLIGHTS_PER_ITEM } from './promptBudget.js';
import { QUERY_MAX } from './retrieval.js';

const NOW = '2026-11-13T15:00:00.000Z';
const KB = Object.freeze({ id: 'KB-IDEA-EVALUATION-001', version: '0.1', sha256: 'b0688fb33cdd5b16835a5a70f7fcef7ca79d00facced233d1529d26b4e77854e', source: 'kb' });
const uuid = (n) => `9a8b7c6d-5e4f-4a3b-8c2d-${String(n).padStart(12, '0')}`;
const fid = (n) => `f_${uuid(n)}`;
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
/** Every value in a document, depth first — Firestore refuses an undefined field. */
const undefinedPaths = (v, at = '') => (v === undefined ? [at] : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => undefinedPaths(x, `${at}.${k}`)) : []);
const partner = (kind, method, extra = {}) => exchangeOf({ who: 'partner', kind, text: 'x', at: NOW, method: method ? methodRefOf(method) : null, ...extra });

describe('the stamp (Part 2)', () => {
  it('framingSessionOf and openSessionOf write the stamp they are given, once; with none, the baseline stamp', () => {
    const stamp = methodStampOf(KB, { consumer: 'shared_research.observation', selectedAt: NOW });
    const f = framingSessionOf({ sessionId: 's', userId: 'u', requestId: 'r', observation: 'o', playerExchange: {}, nowIso: NOW, method: stamp });
    expect(f.method).toEqual({ ...KB, consumer: 'shared_research.observation', selectedAt: NOW });
    const o = openSessionOf({ sessionId: 's', userId: 'u', requestId: 'r', entry: { kind: 'item' }, exchanges: [], attribution: null, researchWorkId: 'sr_s', nowIso: NOW });
    expect(o.method).toEqual({ id: 'baseline', version: 'v0', sha256: BASELINE.sha256, source: 'baseline', consumer: null, selectedAt: NOW });
    for (const s of [f, o]) expect(undefinedPaths(s)).toEqual([]);
    // The client never sees it.
    expect(sessionViewOf(f)).not.toHaveProperty('method');
  });
});

describe('exchangeOf — the five new fields (Part 3)', () => {
  it('writes method, methodChange, findingIds, retrieval and methodsUsed only when given', () => {
    const bare = exchangeOf({ who: 'partner', kind: 'step', text: 't', at: NOW }, { mintId: () => 'x' });
    expect(Object.keys(bare)).toEqual(['exchangeId', 'who', 'kind', 'text', 'at']);
    const full = exchangeOf({
      who: 'partner', kind: 'step', text: 't', at: NOW,
      method: methodRefOf(KB), methodChange: { from: 'a@1', to: 'b@2', reason: null }, findingIds: [], retrieval: { readAt: NOW, items: [] }, methodsUsed: [],
    }, { mintId: () => 'x' });
    expect(full).toMatchObject({ method: KB, methodChange: { from: 'a@1', to: 'b@2', reason: null }, findingIds: [], retrieval: { readAt: NOW, items: [] }, methodsUsed: [] });
    expect(undefinedPaths(full)).toEqual([]);
    // sessionViewOf passes none of them through.
    const view = sessionViewOf({ sessionId: 's', status: 'open', exchanges: [full] });
    expect(Object.keys(view.exchanges[0]).sort()).toEqual(['at', 'kind', 'text', 'who']);
  });
});

describe('methodChangeOf (row 3)', () => {
  const frameBaseline = partner('frame', BASELINE);
  const stepKb = partner('step', KB);
  it('no previous partner turn → null (a story\'s first step; a frame)', () => {
    expect(methodChangeOf([], KB, null)).toBeNull();
    expect(methodChangeOf([exchangeOf({ who: 'player', kind: 'observation', text: 'o', at: NOW })], BASELINE, 'audience')).toBeNull();
  });
  it('the same method as the previous partner turn → null', () => {
    expect(methodChangeOf([frameBaseline], BASELINE, null)).toBeNull();
    expect(methodChangeOf([frameBaseline, stepKb], KB, null)).toBeNull();
  });
  it('a revocation: the previous turn on the KB method, this one on the baseline → the change, with the refusal', () => {
    expect(methodChangeOf([stepKb], BASELINE, 'not_authorized')).toEqual({ from: 'KB-IDEA-EVALUATION-001@0.1', to: 'baseline@v0', reason: 'not_authorized' });
  });
  it('back on the KB method after a baseline turn → the change, with no reason (no refusal put it there)', () => {
    expect(methodChangeOf([stepKb, partner('step', BASELINE)], KB, null)).toEqual({ from: 'baseline@v0', to: 'KB-IDEA-EVALUATION-001@0.1', reason: null });
  });
  it('the previous PARTNER turn counts — a player\'s direction or a confirm after it does not', () => {
    const direction = exchangeOf({ who: 'player', kind: 'direction', text: 'd', at: NOW, stepId: uuid(1) });
    expect(methodChangeOf([stepKb, direction], BASELINE, 'audience')).toEqual({ from: 'KB-IDEA-EVALUATION-001@0.1', to: 'baseline@v0', reason: 'audience' });
  });
  it('an exchange written before KB-1 (no method, or no source) reads as the baseline', () => {
    const legacy = exchangeOf({ who: 'partner', kind: 'frame', text: 'q', at: NOW });
    expect(exchangeMethodOf(legacy)).toEqual(methodRefOf(BASELINE));
    expect(exchangeMethodOf({ ...legacy, method: { id: KB.id, version: KB.version } })).toEqual(methodRefOf(BASELINE));
    expect(methodChangeOf([legacy], BASELINE, null)).toBeNull();
    expect(methodChangeOf([legacy], KB, null)).toEqual({ from: 'baseline@v0', to: 'KB-IDEA-EVALUATION-001@0.1', reason: null });
  });
  it('other bytes under the same id and version are a change too (compared by hash)', () => {
    expect(methodChangeOf([stepKb], { ...KB, sha256: '0'.repeat(64) }, null)).toEqual({ from: 'KB-IDEA-EVALUATION-001@0.1', to: 'KB-IDEA-EVALUATION-001@0.1', reason: null });
  });
});

describe('methodsUsedOf (row 4)', () => {
  it('the distinct methods of the turns whose findingIds hold a kept finding, first seen over the kept findings; open\'s findings contribute none', () => {
    const exchanges = [
      partner('frame', KB),
      partner('step', KB, { findingIds: [fid(1), fid(2)] }),
      partner('step', BASELINE, { findingIds: [fid(3)] }),
      partner('step', KB, { findingIds: [fid(4)] }),
    ];
    expect(methodsUsedOf(exchanges, [fid(3), fid(1), fid(4)])).toEqual([methodRefOf(BASELINE), methodRefOf(KB)]);
    expect(methodsUsedOf(exchanges, [fid(2), fid(4)])).toEqual([methodRefOf(KB)]);
    expect(methodsUsedOf(exchanges, [fid(99)])).toEqual([]); // a finding written at open: no turn
    expect(methodsUsedOf(exchanges, [])).toEqual([]);
    // A player's exchange never contributes, whatever it holds.
    expect(methodsUsedOf([{ who: 'player', kind: 'confirm', findingIds: [fid(1)], method: methodRefOf(KB) }], [fid(1)])).toEqual([]);
  });
});

describe('retainedRetrievalOf (row 5)', () => {
  const items = [
    { index: 0, url: 'https://a.example.com/x', host: 'a.example.com', title: 'NVDA falls at noon', highlights: ['One.', 'Two.'], publishedDate: '2026-10-30T00:00:00.000Z' },
    { index: 1, url: 'https://b.example.com/y', host: 'b.example.com', title: 'Undated piece', highlights: [], publishedDate: null },
    { index: 2, url: 'https://c.example.com/z', host: 'c.example.com', title: 'Third', highlights: ['Only one.'] },
  ];
  const findings = [
    { findingId: fid(1), source: { recordKind: 'retrieval', url: 'https://a.example.com/x' } },
    { findingId: fid(2), source: { recordKind: 'exchange', recordId: uuid(1) } },
    { findingId: fid(3), source: { recordKind: 'retrieval', url: 'https://a.example.com/x' } },
    { findingId: fid(4), source: { recordKind: 'retrieval', url: 'https://c.example.com/z' } },
  ];
  it('every item, in order, with its title and highlights as given, its hash, its date (null when none) and the findings citing it', () => {
    const r = retainedRetrievalOf({ readAt: NOW, items, findings });
    expect(r.readAt).toBe(NOW);
    expect(r.items).toEqual([
      { index: 0, url: items[0].url, host: 'a.example.com', title: 'NVDA falls at noon', highlights: ['One.', 'Two.'], publishedDate: '2026-10-30T00:00:00.000Z', seenSha256: sha('NVDA falls at noon\nOne.\nTwo.'), findingIds: [fid(1), fid(3)] },
      { index: 1, url: items[1].url, host: 'b.example.com', title: 'Undated piece', highlights: [], publishedDate: null, seenSha256: sha('Undated piece\n'), findingIds: [] },
      { index: 2, url: items[2].url, host: 'c.example.com', title: 'Third', highlights: ['Only one.'], publishedDate: null, seenSha256: sha('Third\nOnly one.'), findingIds: [fid(4)] },
    ]);
    // The hash recomputes from the retained text, over the title AND the highlights (one changed highlight moves it).
    for (const it of r.items) expect(seenSha256Of(it.title, it.highlights)).toBe(it.seenSha256);
    expect(seenSha256Of('NVDA falls at noon', ['One.', 'Two!'])).not.toBe(r.items[0].seenSha256);
    expect(seenSha256Of('NVDA falls at noon', [])).not.toBe(r.items[0].seenSha256);
    expect(undefinedPaths(r)).toEqual([]);
  });
});

describe('the worst-case session (row 5: Amendment A §A4.4)', () => {
  /**
   * 10 steps, 5 items each with every field at its maximum (a 1,024-character url, a 253-character host, a 300-character
   * title, 2 highlights of 600), every exchange at the longest B1 allows (observation, direction and the frame's question
   * 500; a step's reply 1,200; at most 12 + 6 + 1 findings a step; its 12 retrieval findings citing one item), the frame
   * at its bounds, a confirm with two methods and a close — serialized, in UTF-8 bytes (Firestore's unit).
   */
  function worstCase(ch) {
    const fill = (n) => ch.repeat(n);
    const stamp = methodStampOf(KB, { consumer: 'shared_research.observation', selectedAt: NOW, fallbackReason: 'acceptance_mismatch' });
    const s = framingSessionOf({
      sessionId: uuid(0), userId: 'u'.repeat(128), requestId: 'r'.repeat(64), observation: fill(OBSERVATION_MAX),
      playerExchange: exchangeOf({ who: 'player', kind: 'observation', text: fill(OBSERVATION_MAX), at: NOW }), nowIso: NOW, method: stamp,
    });
    s.frame = { question: fill(FRAME_QUESTION_MAX), check: fill(FRAME_CHECK_MAX), notEstablished: fill(FRAME_CHECK_MAX), at: NOW, attempts: 3 };
    s.entry = { ...s.entry, direction: fill(DIRECTION_MAX), topic: fill(120), names: Array.from({ length: 10 }, (_, i) => `SYM${i}`) };
    s.lastStep = { stepId: uuid(9), intent: 'direction', status: 'completed', startedAt: NOW, endedAt: NOW, error: null, query: fill(QUERY_MAX), summaryWithheld: true };
    s.attribution = { agentId: 'a'.repeat(40), archetypeCodeId: 'contrarian', baggerbombArchetypeCodeId: 'momentum_chaser', identityVersion: 2, at: NOW };
    s.adoption = { watchlistId: 'w'.repeat(20), version: 1, at: NOW };
    s.exchanges.push(exchangeOf({ who: 'partner', kind: 'frame', text: fill(FRAME_QUESTION_MAX), at: NOW, method: methodRefOf(KB) }));
    let n = 1;
    const host = 'h'.repeat(253);
    for (let step = 0; step < STEP_BUDGET; step++) {
      s.exchanges.push(exchangeOf({ who: 'player', kind: 'direction', text: fill(DIRECTION_MAX), at: NOW, stepId: uuid(step) }));
      const items = Array.from({ length: ITEMS_MAX }, (_, i) => {
        const url = `https://${host}/${'p'.repeat(SOURCE_URL_MAX_LEN - host.length - 9)}`;
        return { index: i, url: `${url.slice(0, -1)}${i}`, host, title: fill(300), highlights: Array.from({ length: HIGHLIGHTS_PER_ITEM }, () => fill(600)), publishedDate: NOW };
      });
      const retrievalFindings = Array.from({ length: STEP_FINDINGS_MAX }, () => ({ findingId: fid(n++), source: { recordKind: 'retrieval', url: items[0].url } }));
      const others = Array.from({ length: COMPANIES_MAX + 1 }, () => ({ findingId: fid(n++), source: { recordKind: 'exchange' } }));
      const findings = [...retrievalFindings, ...others];
      s.exchanges.push(exchangeOf({
        who: 'partner', kind: 'step', text: fill(REPLY_MAX), at: NOW, stepId: uuid(step), intent: 'direction',
        target: { symbol: 'GOOGL', relationshipFindingId: fid(1), openFindingId: fid(2) }, lines: { support: fid(3), complication: fid(4), missing: fid(5) },
        method: methodRefOf(KB), methodChange: { from: 'KB-IDEA-EVALUATION-001@0.1', to: 'baseline@v0', reason: 'acceptance_mismatch' },
        findingIds: findings.map((f) => f.findingId), retrieval: retainedRetrievalOf({ readAt: NOW, items, findings }),
      }));
    }
    s.exchanges.push(exchangeOf({ who: 'player', kind: 'confirm', text: fill(EXCHANGE_TEXT_MAX), at: NOW, methodsUsed: [methodRefOf(KB), methodRefOf(BASELINE)] }));
    s.exchanges.push(exchangeOf({ who: 'player', kind: 'close', text: fill(100), at: NOW }));
    return Buffer.byteLength(JSON.stringify(s), 'utf8');
  }
  it('with every field at its maximum length: under 400 KB', () => {
    const bytes = worstCase('a');
    expect(bytes).toBeLessThan(400_000);
    expect(bytes).toBeGreaterThan(190_000); // the builder is not vacuous: 50 retained items of ~2.8 KB
  });
  it('with every text character a 3-byte one (UTF-8\'s widest per UTF-16 unit): still under 400 KB — the margin is thin (report §6)', () => {
    const bytes = worstCase('€');
    expect(bytes).toBeLessThan(400_000);
    expect(bytes).toBeGreaterThan(380_000);
  });
});
