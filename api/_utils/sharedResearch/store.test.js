// api/_utils/sharedResearch/store.test.js
//
// Shared Research B1 — the store's transactions (spec §5, §6.3, §6.6, §6.11,
// §6.12, §15 S-4), on an ATOMIC in-memory Firestore double
// (__fixtures__/srFirestore.js: a throw writes nothing). The emulator suite
// proves the rules (test/rules/sharedResearchSessions.rules.mjs).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real, unmocked import of
// store.js (and through it src/constants/sharedResearch.js and
// src/constants/perGameLoadout.js) is the runtime guard for its graph.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeSrFirestore } from './__fixtures__/srFirestore.js';
import { makeInMemoryDb } from '../__fixtures__/inMemoryFirestore.js';
import {
  beginFraming, recordFrame, noteFrameFailure, openFromItem, openFromFraming, beginStep, recordStep, failStep, closeInvestigation, adoptIdea,
  normalizeAdoption, rankedAgentOfDocs, attributionOf, globalStepCeiling, GLOBAL_STEPS_ENV, SHARED_RESEARCH_ADAPTER, listOpen, readPrevious,
} from './store.js';
import { exchangeOf, openSessionOf, framingSessionOf, etDateOf, latestLinesOf } from './session.js';
import { companiesOf } from './companies.js';
import { carriedFor, previewRevOf, adoptPreviewOf } from './adoptPreview.js';
import { buildFinding, ResearchRecordError } from '../researchRecords/model.js';
import { buildSharedResearchVersion, HypothesisInputError } from '../hypothesisRecords/model.js';
import { resolveRankedAgent } from '../trainingClone.js';
import { adoptionInput, adoptedVersion } from '../hypothesisRecords/__fixtures__/sharedResearchAdoption.js';
import { shopPayRecord, SP_LINES, SP_NAMES, OWNER, SESSION_ID, RECORD_ID, dataCenterRecord, fid, withFindings, baseRecord } from './__fixtures__/records.js';

const NOW = '2026-11-12T15:00:00.000Z';
const TODAY = etDateOf(NOW);
const RANKED = { ownerId: OWNER, name: 'Rook', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: null } } };
const CLONE = { ownerId: OWNER, isCasualClone: true, rankedAgentId: 'agent-1', archetype: 'degen' };
const STAMP = { agentId: 'agent-1', archetypeCodeId: 'contrarian', baggerbombArchetypeCodeId: 'momentum_chaser', identityVersion: 2, at: NOW };
const ITEM = { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: 'story-1' }, question: 'Who earns from the switchgear backlog?', direction: null, topic: null, names: ['ETN'] };

let env;
let n = 0;
const mintFid = () => `f_40000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const opening = () => [buildFinding({
  kind: 'coverage', symbol: null, fact: 'Switchgear lead times stretch.', source: { recordKind: 'fantasyTimesStories', recordId: 'story-1', label: 'FantasyTimes · Kim · Sector Strategist' },
  at: '2026-11-12T13:00:00.000Z', asOf: '2026-11-12T13:00:00.000Z', status: 'unverified', statusReason: 'reporter_content',
}, { findingId: mintFid(), nowIso: NOW })];
const writesCount = () => env.writes.length;
const codeOf = async (p) => { try { await p; return null; } catch (e) { return e.code; } };

beforeEach(() => {
  env = makeSrFirestore({ 'agents/agent-1': RANKED, [`agents/casual-agent-${OWNER}`]: CLONE });
});
afterEach(() => { delete process.env[GLOBAL_STEPS_ENV]; });

describe('open — item / drop (spec §6.3)', () => {
  const open = (requestId = 'req-1', itemRef = ITEM.itemRef, nowIso = NOW) => openFromItem(env.db, {
    uid: OWNER, requestId, sessionId: `s-${requestId}`, entry: { ...ITEM, itemRef }, exchanges: [], findings: opening(), nowIso,
  });
  const closeAs = (sessionId, reason, at) => closeInvestigation(env.db, { uid: OWNER, sessionId, reason, closeExchange: exchangeOf({ who: 'player', kind: 'close', text: 'Closed.', at }), nowIso: at });
  const at = (h) => `2026-11-12T${String(h).padStart(2, '0')}:00:00.000Z`;

  it('one transaction: the host open with its stamp, the record minted with the question and the opening, the quota +1', async () => {
    const out = await open();
    expect(out).toMatchObject({ existing: false, replay: false, day: { investigationsOpened: 1 } });
    const s = env.doc('sharedResearchSessions/s-req-1');
    expect(s).toMatchObject({ status: 'open', userId: OWNER, requestId: 'req-1', itemKey: 'fantasyTimesStories/story-1', researchWorkId: 'sr_s-req-1', attribution: STAMP });
    expect(env.doc('researchWork/sr_s-req-1')).toMatchObject({ origin: 'shared_research', question: ITEM.question, state: 'open', watchlistId: null });
    expect(env.doc('researchWork/sr_s-req-1').findings).toHaveLength(1);
    expect(env.doc(`sharedResearchQuota/${OWNER}`)).toMatchObject({ etDate: TODAY, investigationsOpened: 1 });
  });

  it('a retry on the same requestId finds the session it made and writes nothing: one host, one record, the quota +1 once', async () => {
    await open();
    const before = writesCount();
    const again = await open();
    expect(again).toMatchObject({ replay: true });
    expect(writesCount()).toBe(before);
    expect([...env.store.keys()].filter((k) => k.startsWith('sharedResearchSessions/'))).toHaveLength(1);
    expect([...env.store.keys()].filter((k) => k.startsWith('researchWork/'))).toHaveLength(1);
    expect(env.doc(`sharedResearchQuota/${OWNER}`).investigationsOpened).toBe(1);
  });

  it('an open investigation on the same item answers `existing` — a new request, nothing written', async () => {
    await open('req-1');
    const before = writesCount();
    expect(await open('req-2')).toMatchObject({ existing: true, session: { sessionId: 's-req-1' } });
    expect(writesCount()).toBe(before);
  });

  it('spec §16 FQ-1: only an OPEN investigation answers `existing`; once it ended, a new one opens and carries `previous`', async () => {
    const first = await open('req-1', ITEM.itemRef, at(10));
    expect(first.previous).toBeNull();
    await closeAs('s-req-1', 'concluded', at(11));
    const second = await open('req-2', ITEM.itemRef, at(12));
    expect(second).toMatchObject({ existing: false, replay: false, session: { sessionId: 's-req-2' } });
    expect(second.previous).toEqual({ sessionId: 's-req-1', endedAt: at(11), terminalReason: 'concluded' });
    // while the second is open it is the `existing` one; its own previous is the first
    expect(await open('req-3', ITEM.itemRef, at(13))).toMatchObject({ existing: true, session: { sessionId: 's-req-2' }, previous: { sessionId: 's-req-1' } });
    // abandoned ends it too; the newest ended one is the previous
    await closeAs('s-req-2', 'abandoned', at(14));
    env.store.set(`sharedResearchQuota/${OWNER}`, { etDate: TODAY, investigationsOpened: 0, framingsRun: 0 });
    const fourth = await open('req-4', ITEM.itemRef, at(15));
    expect(fourth).toMatchObject({ existing: false, session: { sessionId: 's-req-4' } });
    expect(fourth.previous).toEqual({ sessionId: 's-req-2', endedAt: at(14), terminalReason: 'user_close' });
    // a replay answers its own session; `previous` is never itself
    expect(await open('req-4', ITEM.itemRef, at(16))).toMatchObject({ replay: true, session: { sessionId: 's-req-4' }, previous: { sessionId: 's-req-2' } });
  });

  it('spec §16 FQ-1: an investigation saved as an idea has ended too (terminalReason saved_to_list)', async () => {
    await open('req-1', ITEM.itemRef, at(10));
    const rw = env.doc('researchWork/sr_s-req-1');
    env.store.set('researchWork/sr_s-req-1', { ...rw, state: 'completed', terminalReason: 'saved_to_list', endedAt: at(11), watchlistId: 'w1' });
    env.store.set('sharedResearchSessions/s-req-1', { ...env.doc('sharedResearchSessions/s-req-1'), status: 'completed', updatedAt: at(11) });
    const out = await open('req-2', ITEM.itemRef, at(12));
    expect(out).toMatchObject({ existing: false, session: { sessionId: 's-req-2' }, previous: { sessionId: 's-req-1', endedAt: at(11), terminalReason: 'saved_to_list' } });
  });

  it('spec §16 FQ-1, the GET: readPrevious is the newest ended one created before this one — never itself, never a later one; none for an observation', async () => {
    await open('req-1', ITEM.itemRef, at(10));
    await closeAs('s-req-1', 'concluded', at(11));
    await open('req-2', ITEM.itemRef, at(12));
    await closeAs('s-req-2', 'abandoned', at(13));
    await open('req-3', ITEM.itemRef, at(14));
    const prev = (sid) => readPrevious(env.db, { uid: OWNER, session: env.doc(`sharedResearchSessions/${sid}`) });
    expect(await prev('s-req-3')).toEqual({ sessionId: 's-req-2', endedAt: at(13), terminalReason: 'user_close' });
    expect(await prev('s-req-2')).toEqual({ sessionId: 's-req-1', endedAt: at(11), terminalReason: 'concluded' });
    expect(await prev('s-req-1')).toBeNull();
    env.store.set('sharedResearchSessions/fs1', framingSessionOf({ sessionId: 'fs1', userId: OWNER, requestId: 'f', observation: 'o', playerExchange: exchangeOf({ who: 'player', kind: 'observation', text: 'o', at: NOW }), nowIso: NOW }));
    expect(await prev('fs1')).toBeNull();
  });

  it('daily_limit at 3: the fourth open is refused and writes nothing', async () => {
    env.store.set(`sharedResearchQuota/${OWNER}`, { etDate: TODAY, investigationsOpened: 3, framingsRun: 0 });
    expect(await codeOf(open())).toBe('daily_limit');
    expect(env.store.has('sharedResearchSessions/s-req-1')).toBe(false);
    // yesterday's three do not count today
    env.store.set(`sharedResearchQuota/${OWNER}`, { etDate: '2026-11-11', investigationsOpened: 3, framingsRun: 0 });
    expect((await open()).day.investigationsOpened).toBe(1);
  });
});

describe('§15 S-4 — the stamp is the ranked agent, never a clone', () => {
  it('stamped from the ranked agent document read in the transaction', async () => {
    await openFromItem(env.db, { uid: OWNER, requestId: 'r', sessionId: 's1', entry: ITEM, exchanges: [], findings: opening(), nowIso: NOW });
    expect(env.doc('sharedResearchSessions/s1').attribution).toEqual(STAMP);
  });
  it('no ranked agent (a casual clone only) → 503 attribution_unavailable, nothing written; a clone id is never stamped', async () => {
    env.store.delete('agents/agent-1');
    const before = writesCount();
    const err = await openFromItem(env.db, { uid: OWNER, requestId: 'r', sessionId: 's1', entry: ITEM, exchanges: [], findings: opening(), nowIso: NOW }).catch((e) => e);
    expect([err.status, err.code]).toEqual([503, 'attribution_unavailable']);
    expect(writesCount()).toBe(before);
  });
  it('the rule is resolveRankedAgent\'s, exactly (parity over training clones, casual clones and order)', async () => {
    const shapes = [
      { a: { ownerId: 'o', isTrainingClone: true }, b: { ownerId: 'o', name: 'B' } },
      { a: { ownerId: 'o', isCasualClone: true }, b: { ownerId: 'o', isTrainingClone: true } },
      { a: { ownerId: 'o', name: 'A' }, b: { ownerId: 'o', name: 'B' } },
    ];
    for (const s of shapes) {
      const { db } = makeInMemoryDb({ 'agents/a': s.a, 'agents/b': s.b });
      const theirs = await resolveRankedAgent(db, 'o');
      const ours = rankedAgentOfDocs((await db.collection('agents').where('ownerId', '==', 'o').get()).docs);
      expect(ours).toEqual(theirs);
    }
  });
  it('the stamp records what the document holds — never inferred', () => {
    expect(attributionOf({ id: 'x', ownerId: OWNER }, NOW)).toMatchObject({ agentId: 'x', archetypeCodeId: null, identityVersion: 2, at: NOW });
  });
});

describe('frame (spec §6.3)', () => {
  const ex = () => exchangeOf({ who: 'player', kind: 'observation', text: 'Reviews delay deals.', at: NOW });
  it('creates the session framing and counts the framing — the player\'s and the app\'s', async () => {
    const out = await beginFraming(env.db, { uid: OWNER, requestId: 'f1', observation: 'Reviews delay deals.', playerExchange: ex(), sessionId: 'fs1', nowIso: NOW });
    expect(out).toMatchObject({ run: true, day: { framingsRun: 1 } });
    expect(env.doc('sharedResearchSessions/fs1')).toMatchObject({ status: 'framing', researchWorkId: null, frame: null });
    expect(env.doc('sharedResearchQuota/_global')).toMatchObject({ framings: 1, steps: 0 });
  });
  it('the same requestId: in flight → no second call; failed → re-runs (and counts); framed → no second call (review A2)', async () => {
    await beginFraming(env.db, { uid: OWNER, requestId: 'f1', observation: 'o', playerExchange: ex(), sessionId: 'fs1', nowIso: NOW });
    const inFlight = await beginFraming(env.db, { uid: OWNER, requestId: 'f1', observation: 'o', playerExchange: ex(), sessionId: 'fs-other', nowIso: NOW });
    expect(inFlight).toMatchObject({ run: false, session: { sessionId: 'fs1' } });
    expect(env.doc(`sharedResearchQuota/${OWNER}`).framingsRun).toBe(1);
    await noteFrameFailure(env.db, { uid: OWNER, sessionId: 'fs1', reason: 'model_error_500', nowIso: NOW });
    const again = await beginFraming(env.db, { uid: OWNER, requestId: 'f1', observation: 'o', playerExchange: ex(), sessionId: 'fs-other', nowIso: NOW });
    expect(again).toMatchObject({ run: true, session: { sessionId: 'fs1' } }); // failed → re-run
    expect(env.doc('sharedResearchSessions/fs1').lastError).toBeNull();
    await recordFrame(env.db, { uid: OWNER, sessionId: 'fs1', frame: { question: 'Q?', check: 'c', notEstablished: 'n' }, partnerExchange: exchangeOf({ who: 'partner', kind: 'frame', text: 'Q?', at: NOW }), attempts: 1, nowIso: NOW });
    const framed = await beginFraming(env.db, { uid: OWNER, requestId: 'f1', observation: 'o', playerExchange: ex(), sessionId: 'fs-x', nowIso: NOW });
    expect(framed.run).toBe(false);
    expect(env.doc(`sharedResearchQuota/${OWNER}`).framingsRun).toBe(2);
  });
  it('framing_limit at 10', async () => {
    env.store.set(`sharedResearchQuota/${OWNER}`, { etDate: TODAY, investigationsOpened: 0, framingsRun: 10 });
    expect(await codeOf(beginFraming(env.db, { uid: OWNER, requestId: 'f1', observation: 'o', playerExchange: ex(), sessionId: 'fs1', nowIso: NOW }))).toBe('framing_limit');
    expect(env.store.has('sharedResearchSessions/fs1')).toBe(false);
  });
  it('a framed observation opens: the record minted with the confirmed question; a retry writes nothing; the quota +1 once', async () => {
    const pex = ex();
    env.store.set('sharedResearchSessions/fs1', { ...framingSessionOf({ sessionId: 'fs1', userId: OWNER, requestId: 'f1', observation: 'o', playerExchange: pex, nowIso: NOW }), frame: { question: 'Q?', check: 'c', notEstablished: 'n' } });
    const findings = [buildFinding({ kind: 'observation', symbol: null, fact: 'Reviews delay deals.', source: { recordKind: 'exchange', recordId: pex.exchangeId, label: 'Your words' }, at: NOW, asOf: null, status: 'unverified', statusReason: 'player_words' }, { findingId: mintFid(), nowIso: NOW })];
    const out = await openFromFraming(env.db, { uid: OWNER, sessionId: 'fs1', question: 'Who earns from slow reviews?', direction: 'security tools', findings, nowIso: NOW });
    expect(out.session).toMatchObject({ status: 'open', researchWorkId: 'sr_fs1', attribution: STAMP, entry: { direction: 'security tools' } });
    expect(env.doc('researchWork/sr_fs1')).toMatchObject({ question: 'Who earns from slow reviews?' });
    const before = writesCount();
    expect((await openFromFraming(env.db, { uid: OWNER, sessionId: 'fs1', question: 'X?', direction: null, findings, nowIso: NOW })).replay).toBe(true);
    expect(writesCount()).toBe(before);
    expect(env.doc(`sharedResearchQuota/${OWNER}`).investigationsOpened).toBe(1);
  });
});

// ── steps ────────────────────────────────────────────────────────────────────

function seedOpen({ record = dataCenterRecord('refresh'), sessionId = SESSION_ID, stepsUsed = 0, lines = null } = {}) {
  const s = openSessionOf({ sessionId, userId: OWNER, requestId: 'r', entry: { kind: 'item', itemRef: ITEM.itemRef, question: record.question, names: [] }, exchanges: lines ? [{ exchangeId: 'x', who: 'partner', kind: 'step', text: 't', at: NOW, lines }] : [], attribution: STAMP, researchWorkId: record.researchWorkId, nowIso: NOW });
  env.store.set(`sharedResearchSessions/${sessionId}`, { ...s, stepsUsed });
  env.store.set(`researchWork/${record.researchWorkId}`, record);
  return { session: s, record };
}
const STEP = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const rel = () => buildFinding({
  kind: 'relationship', symbol: 'ETN', fact: 'Supplier · Eaton sells switchgear to data-center builders.',
  source: { recordKind: 'retrieval', recordId: 'https://n.example/e', label: 'n.example · Eaton', url: 'https://n.example/e' },
  at: '2026-11-06T00:00:00.000Z', asOf: '2026-11-06T00:00:00.000Z', status: 'verified', statusReason: null,
}, { findingId: mintFid(), nowIso: NOW });

describe('step (spec §6.3)', () => {
  it('begin: running; the app\'s daily ceiling answers 503 budget_paused BEFORE any call, and nothing is marked running', async () => {
    seedOpen();
    env.store.set('sharedResearchQuota/_global', { etDate: TODAY, steps: 150, framings: 0 });
    const err = await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'next', nowIso: NOW }).catch((e) => e);
    expect([err.status, err.code]).toEqual([503, 'budget_paused']);
    expect(env.doc(`sharedResearchSessions/${SESSION_ID}`).lastStep).toBeNull();
  });
  it('the ceiling is read at call time from SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY', async () => {
    seedOpen();
    env.store.set('sharedResearchQuota/_global', { etDate: TODAY, steps: 150, framings: 0 });
    process.env[GLOBAL_STEPS_ENV] = '151';
    expect(globalStepCeiling()).toBe(151);
    expect((await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'next', nowIso: NOW })).replay).toBe(false);
    process.env[GLOBAL_STEPS_ENV] = 'nonsense';
    expect(globalStepCeiling()).toBe(150);
  });
  it('recordStep: findings appended in order, symbolKeys refreshed, stepsUsed +1, lastStep completed, the partner exchange, the tally, the app\'s steps +1', async () => {
    seedOpen();
    await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'next', nowIso: NOW });
    const f = rel();
    const partner = exchangeOf({ who: 'partner', kind: 'step', text: 'Found Eaton.', at: NOW, stepId: STEP, lines: { support: f.findingId, complication: null, missing: null } });
    await recordStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, findings: [f], summary: null, expectedRev: 0, turn: { elapsedMs: 1200, usage: { input: 9000, output: 800 } }, partnerExchange: partner, retrieval: { calls: 1, costDollars: 0.005, elapsedMs: 700 }, query: 'q', nowIso: NOW });
    const r = env.doc(`researchWork/${RECORD_ID}`);
    expect(r.findings.at(-1).findingId).toBe(f.findingId);
    expect(r.symbolKeys).toContain('ETN');
    expect(r.telemetry).toMatchObject({ completions: 1, tokens: { input: 9000, output: 800 } });
    const s = env.doc(`sharedResearchSessions/${SESSION_ID}`);
    expect(s).toMatchObject({ stepsUsed: 1, lastStep: { stepId: STEP, status: 'completed', query: 'q' }, retrieval: { calls: 1, costDollars: 0.005, elapsedMs: 700 } });
    expect(s.exchanges.at(-1).exchangeId).toBe(partner.exchangeId);
    expect(env.doc('sharedResearchQuota/_global').steps).toBe(1);
    // the same stepId again is a replay — no model call
    expect((await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'next', nowIso: NOW })).replay).toBe(true);
  });
  it('a summary_conflict (the summary moved since the turn read it) throws and writes nothing — the caller records a cancellation', async () => {
    seedOpen();
    await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'next', nowIso: NOW });
    const before = env.doc(`researchWork/${RECORD_ID}`);
    const err = await recordStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, findings: [rel()], summary: { text: 'Eaton sells switchgear.', basedOn: [fid('d1')] }, expectedRev: 1, turn: { elapsedMs: 1, usage: null }, partnerExchange: exchangeOf({ who: 'partner', kind: 'step', text: 'x', at: NOW }), retrieval: null, nowIso: NOW }).catch((e) => e);
    expect(err).toBeInstanceOf(ResearchRecordError);
    expect(err.code).toBe('summary_conflict');
    expect(env.doc(`researchWork/${RECORD_ID}`)).toEqual(before);
    expect(env.doc(`sharedResearchSessions/${SESSION_ID}`).stepsUsed).toBe(0);
  });
  it('failStep: lastStep failed, nothing appended', async () => {
    seedOpen();
    await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'next', nowIso: NOW });
    const before = env.doc(`researchWork/${RECORD_ID}`);
    expect(await failStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, reason: 'model_error_500', nowIso: NOW })).toBe(true);
    expect(env.doc(`sharedResearchSessions/${SESSION_ID}`).lastStep).toMatchObject({ status: 'failed', error: 'model_error_500' });
    expect(env.doc(`researchWork/${RECORD_ID}`)).toEqual(before);
  });
  it('a direction step writes the player\'s exchange once, even when retried', async () => {
    seedOpen();
    const d = exchangeOf({ who: 'player', kind: 'direction', text: 'look at orders', at: NOW, stepId: STEP });
    await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'direction', directionExchange: d, nowIso: NOW });
    await failStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, reason: 'x', nowIso: NOW });
    await beginStep(env.db, { uid: OWNER, sessionId: SESSION_ID, stepId: STEP, intent: 'direction', directionExchange: d, nowIso: NOW });
    expect(env.doc(`sharedResearchSessions/${SESSION_ID}`).exchanges.filter((e) => e.kind === 'direction')).toHaveLength(1);
  });
});

describe('close (spec §4.5)', () => {
  const close = (reason, sessionId = SESSION_ID) => closeInvestigation(env.db, { uid: OWNER, sessionId, reason, closeExchange: exchangeOf({ who: 'player', kind: 'close', text: reason, at: NOW }), nowIso: NOW });
  it('concluded → completed / concluded, no subject; again → its state, nothing written', async () => {
    seedOpen();
    await close('concluded');
    expect(env.doc(`researchWork/${RECORD_ID}`)).toMatchObject({ state: 'completed', terminalReason: 'concluded', watchlistId: null });
    expect(env.doc(`sharedResearchSessions/${SESSION_ID}`).status).toBe('completed');
    const before = writesCount();
    expect((await close('concluded')).closed).toBe(false);
    expect(writesCount()).toBe(before);
  });
  it('abandoned → abandoned / user_close', async () => {
    seedOpen();
    await close('abandoned');
    expect(env.doc(`researchWork/${RECORD_ID}`)).toMatchObject({ state: 'abandoned', terminalReason: 'user_close' });
  });
  it('a framing session closes host-only, abandoned; it cannot conclude', async () => {
    env.store.set('sharedResearchSessions/fs1', framingSessionOf({ sessionId: 'fs1', userId: OWNER, requestId: 'f', observation: 'o', playerExchange: exchangeOf({ who: 'player', kind: 'observation', text: 'o', at: NOW }), nowIso: NOW }));
    expect(await codeOf(close('concluded', 'fs1'))).toBe('session_not_open');
    await close('abandoned', 'fs1');
    expect(env.doc('sharedResearchSessions/fs1').status).toBe('abandoned');
  });
});

describe('adopt (spec §6.6)', () => {
  const companiesFor = (rec) => companiesOf(rec, { names: SP_NAMES });
  /** The token the GET's preview gave for `rec` with the session's stored lines (spec §16 FQ-7). */
  const revOf = (rec, lines = latestLinesOf(env.doc(`sharedResearchSessions/${SESSION_ID}`))) => previewRevOf(rec, { companies: companiesFor(rec), lines });
  const adopt = (over = {}) => {
    const record = env.doc(`researchWork/${RECORD_ID}`);
    const draft = adoptPreviewOf(record, { companies: companiesFor(record), lines: SP_LINES }).companies.find((c) => c.symbol === 'SHOP').fragment;
    return adoptIdea(env.db, {
      uid: OWNER, sessionId: SESSION_ID, previewRev: revOf(record), companiesFor, adapter: SHARED_RESEARCH_ADAPTER, mintId: () => '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d', exchangeOf, nowIso: NOW,
      input: normalizeAdoption({ statement: draft, horizonEnum: 'positional', symbols: ['SHOP'] }), ...over,
    });
  };

  it('one transaction: the list COMMITTED with the stamp, v1 exactly the builder\'s, the record closed with its subject, the session completed', async () => {
    seedOpen({ record: shopPayRecord(), lines: SP_LINES });
    const out = await adopt();
    expect(out).toMatchObject({ version: 1, researchWorkId: RECORD_ID, idempotent: false });
    const list = env.doc(`watchlists/${out.watchlistId}`);
    expect(list).toMatchObject({
      watchlistId: out.watchlistId, userId: OWNER, status: 'committed', committedAt: NOW, researchWorkId: RECORD_ID,
      currentHypothesisVersion: 1, hypothesisVersionCount: 1, attribution: STAMP, agentId: null, name: '', thesis: '',
    });
    expect(list[SHARED_RESEARCH_ADAPTER.listMarker]).toBe(SESSION_ID);
    expect(list.tickers).toEqual([{ symbol: 'SHOP', reasoning: 'Shopify owns Shop Pay, its accelerated checkout.', category: 'research', addedBy: 'user', addedAt: NOW }]);
    const record = shopPayRecord();
    const kept = carriedFor(record, { supported: companiesFor(record).supported, lines: SP_LINES, symbols: ['SHOP'] });
    const confirm = env.doc(`sharedResearchSessions/${SESSION_ID}`).exchanges.at(-1);
    expect(confirm).toMatchObject({ who: 'player', kind: 'confirm', text: 'Saved as an idea · Shopify Inc. · positional' });
    const expected = buildSharedResearchVersion({
      list, watchlistId: out.watchlistId, record, userId: OWNER, sessionId: SESSION_ID, statement: list && env.doc(`watchlists/${out.watchlistId}/hypothesisVersions/v1`).statement,
      horizonEnum: 'positional', activation: [], invalidation: [], keptFindingIds: kept, confirmExchangeId: confirm.exchangeId, nowIso: NOW,
    });
    expect(env.doc(`watchlists/${out.watchlistId}/hypothesisVersions/v1`)).toEqual(expected);
    expect(env.doc(`researchWork/${RECORD_ID}`)).toMatchObject({ state: 'completed', terminalReason: 'saved_to_list', watchlistId: out.watchlistId, hypothesisVersion: 1 });
    expect(env.doc(`sharedResearchSessions/${SESSION_ID}`)).toMatchObject({ status: 'completed', adoption: { watchlistId: out.watchlistId, version: 1, at: NOW } });
  });

  it('idempotent: a retry on a saved record answers the existing version and writes nothing', async () => {
    seedOpen({ record: shopPayRecord(), lines: SP_LINES });
    const first = await adopt();
    const before = writesCount();
    const record = shopPayRecord();
    const again = await adoptIdea(env.db, { uid: OWNER, sessionId: SESSION_ID, previewRev: revOf(record, SP_LINES), companiesFor, adapter: SHARED_RESEARCH_ADAPTER, mintId: () => 'x', exchangeOf, nowIso: NOW, input: normalizeAdoption({ statement: 'Shopify.', horizonEnum: 'swing', symbols: ['SHOP'] }) });
    expect(again).toEqual({ watchlistId: first.watchlistId, version: 1, researchWorkId: RECORD_ID, idempotent: true });
    expect(writesCount()).toBe(before);
  });

  it('preview_stale: a token for another state of the record is refused 409 with the new preview, nothing written', async () => {
    seedOpen({ record: shopPayRecord(), lines: SP_LINES });
    const before = writesCount();
    const p4 = shopPayRecord().findings.find((f) => f.findingId === fid('p4'));
    const grown = { ...shopPayRecord(), findings: [...shopPayRecord().findings, { ...p4, findingId: fid('zz') }] };
    const err = await adopt({ previewRev: revOf(grown, SP_LINES) }).catch((e) => e);
    expect([err.status, err.code]).toEqual([409, 'preview_stale']);
    expect(err.extra.adoptPreview.previewRev).toBe(revOf(shopPayRecord(), SP_LINES));
    expect(writesCount()).toBe(before);
    // the old object shape, and a made-up token, are never the preview
    for (const echo of [{ summaryRev: 0, findingsCount: shopPayRecord().findings.length }, `pr1.${'0'.repeat(32)}`]) {
      expect(await codeOf(adopt({ previewRev: echo }))).toBe('preview_stale');
    }
  });

  it('preview_stale when ONLY the summary revision moved (the findings count unchanged)', async () => {
    seedOpen({ record: shopPayRecord(), lines: SP_LINES });
    const revised = { ...shopPayRecord(), summary: { text: 'Shopify earns from faster checkout.', basedOn: [fid('p1')], rev: 1 } };
    const err = await adopt({ previewRev: revOf(revised, SP_LINES) }).catch((e) => e);
    expect([err.status, err.code]).toEqual([409, 'preview_stale']);
  });

  it('spec §16 FQ-7: preview_stale when ONLY the carried set moved — a step that added no finding moved a line', async () => {
    seedOpen({ record: shopPayRecord(), lines: SP_LINES });
    const token = revOf(shopPayRecord(), SP_LINES); // what the GET's preview gave
    // a quiet step: no finding, no summary revision — only its lines (the complication now Apple's relationship)
    const s = env.doc(`sharedResearchSessions/${SESSION_ID}`);
    const moved = { ...SP_LINES, complication: fid('a1') };
    env.store.set(`sharedResearchSessions/${SESSION_ID}`, { ...s, exchanges: [...s.exchanges, { exchangeId: 'y', who: 'partner', kind: 'step', text: 'Nothing new.', at: NOW, lines: moved }] });
    expect(revOf(shopPayRecord())).not.toBe(token);
    const before = writesCount();
    const err = await adopt({ previewRev: token }).catch((e) => e);
    expect([err.status, err.code]).toEqual([409, 'preview_stale']);
    expect(err.extra.adoptPreview.previewRev).toBe(revOf(shopPayRecord(), moved));
    expect(writesCount()).toBe(before);
    // with the new token, Save goes through and carries Apple's relationship as the complication
    const out = await adopt({ previewRev: err.extra.adoptPreview.previewRev });
    expect(out).toMatchObject({ version: 1, idempotent: false });
  });

  it('the transaction re-checks the revision: a record that moves after the pre-check is refused preview_stale, nothing written', async () => {
    seedOpen({ record: shopPayRecord(), lines: SP_LINES });
    env.hooks.atTxStart = (store) => {
      const r = store.get(`researchWork/${RECORD_ID}`);
      store.set(`researchWork/${RECORD_ID}`, { ...r, findings: [...r.findings, { ...r.findings[0], findingId: 'f_60000000-0000-4000-8000-000000000001', supersedes: null }] });
    };
    const before = writesCount();
    const err = await adopt().catch((e) => e);
    expect([err.status, err.code]).toEqual([409, 'preview_stale']);
    expect(writesCount()).toBe(before);
    expect([...env.store.keys()].some((k) => k.startsWith('watchlists/'))).toBe(false);
  });

  it('the builder\'s refusal is the player\'s answer: 29 kept findings → too_many_evidence_refs, nothing written', async () => {
    let r = withFindings(baseRecord({ question: 'Q?' }), [['rel', { kind: 'relationship', symbol: 'SHOP', fact: 'Product owner · Shopify owns Shop Pay.', source: { recordKind: 'retrieval', recordId: 'https://x.example/r', label: 'x', url: 'https://x.example/r' }, at: NOW, asOf: null, status: 'verified', statusReason: null }]], NOW);
    r = withFindings(r, Array.from({ length: 28 }, (_, i) => [`e${String(i).padStart(2, '0')}`, { kind: 'earnings_fact', symbol: 'SHOP', fact: `Fact number ${i}.`, source: { recordKind: 'retrieval', recordId: `https://x.example/${i}`, label: 'x', url: `https://x.example/${i}` }, at: NOW, asOf: null, status: 'verified', statusReason: null }]), NOW);
    seedOpen({ record: r });
    const before = writesCount();
    const err = await adoptIdea(env.db, { uid: OWNER, sessionId: SESSION_ID, previewRev: revOf(r), companiesFor, adapter: SHARED_RESEARCH_ADAPTER, mintId: () => '7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d', exchangeOf, nowIso: NOW, input: normalizeAdoption({ statement: 'Shopify owns Shop Pay.', horizonEnum: 'longterm', symbols: ['SHOP'] }) }).catch((e) => e);
    expect(err).toBeInstanceOf(HypothesisInputError);
    expect(err.code).toBe('too_many_evidence_refs');
    expect(writesCount()).toBe(before);
    expect(env.doc(`researchWork/${RECORD_ID}`).state).toBe('open');
  });

  it('the builder ignores the extra `attribution` today: its pinned output is unchanged by it', () => {
    expect(buildSharedResearchVersion({ ...adoptionInput(), attribution: STAMP })).toEqual(adoptedVersion());
  });

  it('only the three horizons; a selection names supported companies only', async () => {
    expect(() => normalizeAdoption({ statement: 'x', horizonEnum: 'intraday', symbols: ['SHOP'] })).toThrow();
    expect(() => normalizeAdoption({ statement: 'x', horizonEnum: 'unspecified', symbols: ['SHOP'] })).toThrow();
    seedOpen({ record: shopPayRecord(), lines: SP_LINES });
    expect(await codeOf(adopt({ input: normalizeAdoption({ statement: 'Nvidia.', horizonEnum: 'swing', symbols: ['NVDA'] }) }))).toBe('names_not_supported');
  });
});

describe('Continue your research (GET ?list=open)', () => {
  it('the caller\'s open Shared Research investigations, newest first, at most three', async () => {
    for (const [i, at] of [['1', '2026-11-12T10:00:00.000Z'], ['2', '2026-11-12T11:00:00.000Z'], ['3', '2026-11-12T12:00:00.000Z'], ['4', '2026-11-12T13:00:00.000Z']]) {
      const rec = baseRecord({ question: `Q${i}?`, sessionId: `ls${i}`, createdAt: at });
      env.store.set(`researchWork/${rec.researchWorkId}`, rec);
      env.store.set(`sharedResearchSessions/ls${i}`, { ...openSessionOf({ sessionId: `ls${i}`, userId: OWNER, requestId: i, entry: { kind: 'item' }, exchanges: [], attribution: STAMP, researchWorkId: rec.researchWorkId, nowIso: at }) });
    }
    env.store.set('researchWork/sr_ls4', { ...env.doc('researchWork/sr_ls4'), state: 'completed', terminalReason: 'concluded' });
    const rows = await listOpen(env.db, { uid: OWNER });
    expect(rows.map((r) => r.sessionId)).toEqual(['ls3', 'ls2', 'ls1']);
    expect(rows[0]).toEqual({ sessionId: 'ls3', question: 'Q3?', state: 'open', lastTurnAt: null, findingsCount: 0 });
  });
});
