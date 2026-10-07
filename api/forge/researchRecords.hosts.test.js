// api/forge/researchRecords.hosts.test.js
//
// Pilot P2 — the research record through its HOSTS, gate ON for the caller
// (the P2 build prompt's acceptance rows 2–7; row 1 — gate off, byte-identical
// to main — is api/forge/researchRecords.gateOff.test.js):
//   2  one record per host document; a retried mint returns the same id
//   3  the funnel per origin: present stages correct and cumulative, absent
//      stages null (never 0), each symbol once per stage, outcomes disjoint
//      and covering the cohort once the record closes; zero is a valid close
//   4  telemetry: successes, failures and discarded turns all counted; a
//      failed turn's answer unchanged; tokens 'unknown' unless supplied;
//      measured elapsed time
//   5  the screener → list link
//   6  manual: all stages null, completed / player_authored
//   7  abandon: abandoned, open candidates cancelled
//
// The real prompt builder, screener and cohort digest run; only the model's
// HTTP call is replaced (a reply may carry provider `usage` and a `during`
// hook that runs while the "model" is thinking — to advance the clock, or to
// land a competing write).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stored, storedUnder } from '../_utils/__fixtures__/callsFirestore.js';
import {
  OWNER, OTHER, NOW, ALLOWLIST_ENV, AGENT_ID, DROP_ID, makeHostDb, call, rankingsDoc, agentDoc, parseResult, signalDropDoc,
  screenReply, dialogueReply, analysisReply, dialogueSession, screenerSession, savedList, analysisSession,
} from '../_utils/__fixtures__/researchHostHarness.js';
import { RESEARCH_STAGES, STAGES_BY_ORIGIN, SYMBOL_OUTCOMES } from '../_utils/researchRecords/model.js';
import { mintWithHost } from '../_utils/researchRecords/store.js';

const state = vi.hoisted(() => ({ flagOn: true, replies: [], calls: [], logThrows: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flagOn; } };
});
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({
  logSignalDrops: async () => {},
  // A synchronous throw AFTER the turn persisted (review R2-4's probe).
  logConversation: (...args) => { if (state.logThrows) throw new Error('logger down'); return Promise.resolve(args.length > 0); },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) },
}));
vi.mock('../_utils/gemmaClient.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    callGemmaVoiceWithRetry: async (opts) => {
      const { signal, ...args } = opts || {};
      state.calls.push(args);
      const reply = state.replies.shift();
      if (typeof reply?.during === 'function') await reply.during();
      const { during, ...result } = reply || {};
      return result;
    },
  };
});

const { default: screenerHandler } = await import('../screener/chat.js');
const { default: dialogueHandler } = await import('./watchlist-dialogue.js');
const { default: abandonHandler } = await import('./watchlist-dialogue-abandon.js');
const { default: analysisHandler } = await import('./watchlist-analysis.js');
const { default: watchlistsHandler } = await import('./watchlists.js');

const ok = (content, extra = {}) => ({ success: true, content, ...extra });
const failed = (extra = {}) => ({ success: false, error: 'OpenRouter 500: upstream', fallbackResponse: null, ...extra });
const later = (ms) => () => { vi.setSystemTime(new Date(Date.now() + ms)); };
const records = () => storedUnder(activeDb, 'researchWork');
const rec = (id) => stored(activeDb, `researchWork/${id}`);
const SCREENER_SESSION = 'researchSessions-auto-1';
const SCREENER_RW = `rs_${SCREENER_SESSION}`;
const DIALOGUE_SESSION = 'watchlistSessions-auto-1';
const DIALOGUE_RW = `ws_${DIALOGUE_SESSION}`;
const ANALYSIS_SESSION = 'analysisSessions-auto-1';
const ANALYSIS_RW = `as_${ANALYSIS_SESSION}`;

function setDb(docs = {}) { activeDb = makeHostDb(docs); return activeDb; }
const screenFirst = (reply = ok(screenReply())) => { state.replies.push(reply); return call(screenerHandler, { body: { userMessage: 'strongest chips please' } }); };
const screenNext = (reply, sessionId = SCREENER_SESSION) => { state.replies.push(reply); return call(screenerHandler, { body: { userMessage: 'and now?', sessionId } }); };
const dialogueFirst = (reply = ok(dialogueReply())) => {
  state.replies.push(reply);
  return call(dialogueHandler, { body: { agentId: AGENT_ID, message: 'What fits?', parseResult: parseResult('positional'), dropId: DROP_ID } });
};
const dialogueNext = (reply, sessionId = DIALOGUE_SESSION) => { state.replies.push(reply); return call(dialogueHandler, { body: { agentId: AGENT_ID, sessionId, message: 'More?' } }); };
const dialogueDocs = () => ({ [`agents/${AGENT_ID}`]: agentDoc(), [`users/${OWNER}/signalDrops/${DROP_ID}`]: signalDropDoc('positional') });

/** The cumulative-funnel and disjoint-outcome invariants every record holds (row 3). */
function expectFunnelInvariants(r) {
  const present = STAGES_BY_ORIGIN[r.origin];
  for (const k of RESEARCH_STAGES) {
    if (present.includes(k)) expect(Number.isSafeInteger(r.stages[k]) && r.stages[k] >= 0, `${k} is a count`).toBe(true);
    else expect(r.stages[k], `${k} is absent for ${r.origin} → null, never 0`).toBeNull();
  }
  const syms = r.symbols.map((s) => s.symbol);
  expect(new Set(syms).size, 'each symbol once').toBe(syms.length);
  for (const s of r.symbols) expect([null, ...SYMBOL_OUTCOMES]).toContain(s.outcome);
  if (r.state !== 'open') {
    expect(r.symbols.every((s) => SYMBOL_OUTCOMES.includes(s.outcome) && typeof s.reason === 'string'), 'a closed record decides every member').toBe(true);
  }
  // Cumulative: a later present stage never exceeds an earlier one, except eligible may count saved additions that skipped screening.
  const counts = present.map((k) => r.stages[k]);
  const additions = r.symbols.filter((s) => s.addedAtSave).length;
  for (let i = 1; i < counts.length; i++) {
    const slack = present[i] === 'eligible' ? additions : 0;
    expect(counts[i] <= counts[i - 1] + slack, `${present[i]} (${counts[i]}) ≤ ${present[i - 1]} (${counts[i - 1]})`).toBe(true);
  }
  expect(r.symbols.filter((s) => s.outcome === 'eligible').length).toBe(present.includes('eligible') ? r.stages.eligible : 0);
}

let savedEnv;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  savedEnv = process.env[ALLOWLIST_ENV];
  process.env[ALLOWLIST_ENV] = `${OWNER},${OTHER}`;
  state.flagOn = true;
  state.calls = [];
  state.replies = [];
  state.logThrows = false;
  activeDb = null;
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ALLOWLIST_ENV]; else process.env[ALLOWLIST_ENV] = savedEnv;
  vi.useRealTimers();
  expect(state.replies, 'every queued model reply was consumed').toEqual([]);
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 2 — one record per host document; a retried mint returns the same id', () => {
  it('screener: the new session and its record land in ONE commit; the session names the record; later turns mint nothing', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    const res = await screenFirst();
    expect(res.statusCode).toBe(200);
    expect(res.body.sessionId).toBe(SCREENER_SESSION);
    expect(Object.keys(records())).toEqual([SCREENER_RW]);
    expect(stored(activeDb, `researchSessions/${SCREENER_SESSION}`).researchWorkId).toBe(SCREENER_RW);
    expect(rec(SCREENER_RW)).toMatchObject({
      researchWorkId: SCREENER_RW, userId: OWNER, origin: 'screener', host: { collection: 'researchSessions', id: SCREENER_SESSION },
      createdAt: NOW, watchlistId: null, hypothesisVersion: null, state: 'open', terminalReason: null, endedAt: null, schemaVersion: 1,
    });
    // ONE transaction carried both writes: the session set and the record create are adjacent in the commit.
    const writes = activeDb.__access.writes.map((w) => `${w.op} ${w.path}`);
    expect(writes).toEqual([`set researchSessions/${SCREENER_SESSION}`, `create researchWork/${SCREENER_RW}`]);
    await screenNext(ok(screenReply()));
    await screenNext(ok(screenReply()));
    expect(Object.keys(records())).toEqual([SCREENER_RW]);
  });
  it('dialogue (paste and theme) and analysis: one record each, its id derived from the session', async () => {
    setDb(dialogueDocs());
    await dialogueFirst();
    expect(Object.keys(records())).toEqual([DIALOGUE_RW]);
    expect(stored(activeDb, `watchlistSessions/${DIALOGUE_SESSION}`).researchWorkId).toBe(DIALOGUE_RW);
    expect(rec(DIALOGUE_RW)).toMatchObject({ origin: 'signaldrop', host: { collection: 'watchlistSessions', id: DIALOGUE_SESSION } });

    setDb({ [`agents/${AGENT_ID}`]: agentDoc(), 'discoverThemes/t-1': { title: 'Grid buildout', narrative: 'Power demand.', tickers: ['NVDA'], status: 'active' } });
    state.replies.push(ok(dialogueReply()));
    await call(dialogueHandler, { body: { agentId: AGENT_ID, message: 'Dive in', themeId: 't-1', dropId: 'theme-drop-1' } });
    expect(rec(DIALOGUE_RW)).toMatchObject({ origin: 'theme' });

    setDb({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() });
    await call(analysisHandler, { body: { watchlistId: 'wl-1' } });
    expect(Object.keys(records())).toEqual([ANALYSIS_RW]);
    expect(stored(activeDb, `analysisSessions/${ANALYSIS_SESSION}`).researchWorkId).toBe(ANALYSIS_RW);
  });
  it('a retried mint (the record already committed) answers the SAME id and writes nothing', async () => {
    const db = setDb();
    const record = { researchWorkId: 'rs_s-1', userId: OWNER, origin: 'screener', state: 'open' };
    const hostRef = db.collection('researchSessions').doc('s-1');
    expect(await mintWithHost(db, { hostRef, hostDoc: { userId: OWNER, n: 1 }, record })).toEqual({ researchWorkId: 'rs_s-1', minted: true });
    const writesAfterFirst = db.__access.writes.length;
    expect(await mintWithHost(db, { hostRef, hostDoc: { userId: OWNER, n: 2 }, record: { ...record, state: 'completed' } })).toEqual({ researchWorkId: 'rs_s-1', minted: false });
    expect(db.__access.writes.length).toBe(writesAfterFirst);
    expect(stored(db, 'researchSessions/s-1')).toEqual({ userId: OWNER, n: 1 });
    expect(stored(db, 'researchWork/rs_s-1').state).toBe('open');
  });
  it('a mint whose transaction retries on contention still makes ONE record', async () => {
    const db = setDb();
    let bumped = false;
    db.__hooks.afterTxBody = async ({ attempt }) => {
      if (attempt === 1 && !bumped) { bumped = true; await db.collection('researchWork').doc('rs_s-1').set({ researchWorkId: 'rs_s-1', userId: OWNER, origin: 'screener', state: 'open', landed: 'concurrently' }); }
    };
    const out = await mintWithHost(db, { hostRef: db.collection('researchSessions').doc('s-1'), hostDoc: { userId: OWNER }, record: { researchWorkId: 'rs_s-1', userId: OWNER } });
    expect(out).toEqual({ researchWorkId: 'rs_s-1', minted: false });
    expect(Object.keys(storedUnder(db, 'researchWork'))).toEqual(['rs_s-1']);
  });
  it('gate off for the caller → no record and no stamp on any host', async () => {
    for (const enter of [() => { state.flagOn = false; }, () => { state.flagOn = true; process.env[ALLOWLIST_ENV] = OTHER; }]) {
      enter();
      setDb({ ...dialogueDocs(), 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() });
      await screenFirst();
      await dialogueFirst();
      await call(analysisHandler, { body: { watchlistId: 'wl-1' } });
      await call(watchlistsHandler, { body: {} });
      expect(records()).toEqual({});
      for (const p of [`researchSessions/${SCREENER_SESSION}`, `watchlistSessions/${DIALOGUE_SESSION}`, `analysisSessions/${ANALYSIS_SESSION}`, 'watchlists/watchlists-auto-1']) {
        expect(stored(activeDb, p), p).not.toBeNull();
        expect('researchWorkId' in stored(activeDb, p), p).toBe(false);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 3 — the funnel per origin', () => {
  it('screener, open: the latest stock screen — 6 screened · 4 matched · 3 returned · 0 kept; no selection or investigation stage', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst();
    const r = rec(SCREENER_RW);
    expect(r.stages).toEqual({ universeSize: 6, matchedPreLimit: 4, shortlisted: 3, selectedForInvestigation: null, investigationsCompleted: null, eligible: 0 });
    expect(r.symbols).toEqual(['NVDA', 'AMD', 'AVGO'].map((symbol) => ({ symbol, outcome: null, reason: null })));
    expectFunnelInvariants(r);
    // A second screen moves the open record to IT; the first stays in telemetry.screens.
    await screenNext(ok(screenReply({ screenSpec: { filters: [{ field: 'compositeScore', op: 'gte', value: 80 }], limit: 5 } })));
    const r2 = rec(SCREENER_RW);
    expect(r2.stages).toMatchObject({ universeSize: 6, matchedPreLimit: 2, shortlisted: 2, eligible: 0 });
    expect(r2.telemetry.screens.map((s) => [s.matchedPreLimit, s.returned, s.symbols.join(',')])).toEqual([[4, 3, 'NVDA,AMD,AVGO'], [2, 2, 'NVDA,AMD']]);
  });
  it('screener: a clarifying turn and an industry roll-up leave the stock funnel alone; zero matches is a recorded screen (0 matched · 0 returned)', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst(ok(JSON.stringify({ message: 'Which sector?', readyToScreen: false, screenSpec: null })));
    expect(rec(SCREENER_RW).stages).toMatchObject({ universeSize: 0, matchedPreLimit: 0, shortlisted: 0, eligible: 0 });
    await screenNext(ok(screenReply({ screenSpec: { filters: [{ field: 'compositeScore', op: 'gte', value: 999 }] } })));
    const r = rec(SCREENER_RW);
    expect(r.stages).toMatchObject({ universeSize: 6, matchedPreLimit: 0, shortlisted: 0, eligible: 0 });
    expect(r.symbols).toEqual([]);
    await screenNext(ok(screenReply({ screenSpec: { screenType: 'industries', filters: [] } })));
    expect(rec(SCREENER_RW).stages).toMatchObject({ universeSize: 6, matchedPreLimit: 0, shortlisted: 0 });
    expect(rec(SCREENER_RW).telemetry.screens.map((s) => s.resultType)).toEqual(['stocks', 'industries']);
  });
  it('screener, saved: the screen whose results were saved (not the latest) — kept / not saved, completed, cumulative', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst(); // NVDA AMD AVGO (4 matched)
    await screenNext(ok(screenReply({ screenSpec: { filters: [{ field: 'compositeScore', op: 'lt', value: 60 }], limit: 5 } }))); // INTC QCOM
    const res = await call(watchlistsHandler, { body: { tickers: [{ symbol: 'nvda' }, { symbol: 'AMD' }, { symbol: 'NVDA' }], name: 'Chips', sourceScreenSpec: { filters: [] }, screenerSessionId: SCREENER_SESSION } });
    expect(res.statusCode).toBe(200);
    const r = rec(SCREENER_RW);
    expect(r).toMatchObject({ state: 'completed', terminalReason: 'saved_to_list', endedAt: NOW, watchlistId: res.body.watchlistId, hypothesisVersion: null });
    expect(r.stages).toEqual({ universeSize: 6, matchedPreLimit: 4, shortlisted: 3, selectedForInvestigation: null, investigationsCompleted: null, eligible: 2 });
    expect(r.symbols).toEqual([
      { symbol: 'NVDA', outcome: 'eligible', reason: 'saved_to_list' },
      { symbol: 'AMD', outcome: 'eligible', reason: 'saved_to_list' },
      { symbol: 'AVGO', outcome: 'rejected', reason: 'not_saved' },
    ]);
    expectFunnelInvariants(r);
  });
  it('dialogue: candidates proposed · not removed · saved — and nothing else', async () => {
    setDb(dialogueDocs());
    await dialogueFirst();
    let r = rec(DIALOGUE_RW);
    expect(r.stages).toEqual({ universeSize: null, matchedPreLimit: null, shortlisted: 2, selectedForInvestigation: 2, investigationsCompleted: null, eligible: 0 });
    expectFunnelInvariants(r);
    await dialogueNext(ok(dialogueReply({ candidateTickerUpdates: [{ action: 'remove', symbol: 'AMD' }, { action: 'propose', symbol: 'AVGO', reasoning: 'networking' }, { action: 'keep', symbol: 'NVDA' }] })));
    r = rec(DIALOGUE_RW);
    expect(r.stages).toMatchObject({ shortlisted: 3, selectedForInvestigation: 2, eligible: 0 });
    expect(r.symbols).toEqual([
      { symbol: 'NVDA', outcome: null, reason: null },
      { symbol: 'AMD', outcome: 'rejected', reason: 'removed' }, // the host records no actor — never "player_removed"
      { symbol: 'AVGO', outcome: null, reason: null },
    ]);
    const save = await call(watchlistsHandler, { body: { sessionId: DIALOGUE_SESSION, agentId: AGENT_ID, dropId: DROP_ID } });
    expect(save.statusCode).toBe(200);
    r = rec(DIALOGUE_RW);
    expect(r).toMatchObject({ state: 'completed', terminalReason: 'saved_to_list', endedAt: NOW, watchlistId: save.body.watchlistId, hypothesisVersion: 1 });
    expect(r.stages).toMatchObject({ shortlisted: 3, selectedForInvestigation: 2, eligible: 2 });
    expect(r.symbols.map((s) => `${s.symbol}:${s.outcome}:${s.reason}`)).toEqual(['NVDA:eligible:saved_to_list', 'AMD:rejected:removed', 'AVGO:eligible:saved_to_list']);
    expectFunnelInvariants(r);
  });
  it('zero qualifying is an honest COMPLETED record (spec §3 case H): a save with every candidate removed', async () => {
    setDb({ 'watchlistSessions/ws-1': dialogueSession({
      researchWorkId: 'ws_ws-1',
      candidateTickers: [{ symbol: 'INTC', status: 'removed' }, { symbol: 'AMD', status: 'removed' }],
    }) });
    await activeDb.collection('researchWork').doc('ws_ws-1').set({
      schemaVersion: 1, researchWorkId: 'ws_ws-1', userId: OWNER, origin: 'signaldrop', host: { collection: 'watchlistSessions', id: 'ws-1' }, createdAt: NOW,
      watchlistId: null, hypothesisVersion: null, stages: {}, symbols: [], symbolsTruncated: false, budget: null, telemetry: {}, state: 'open', terminalReason: null, endedAt: null, updatedAt: NOW,
    });
    const res = await call(watchlistsHandler, { body: { sessionId: 'ws-1', agentId: AGENT_ID, dropId: DROP_ID } });
    expect(res.body.tickerCount).toBe(0);
    const r = rec('ws_ws-1');
    expect(r).toMatchObject({ state: 'completed', terminalReason: 'saved_to_list' });
    expect(r.stages).toMatchObject({ shortlisted: 2, selectedForInvestigation: 0, eligible: 0 });
    expectFunnelInvariants(r);
  });
  it('analysis: the cohort digest\'s own counts — selected = the list, investigated = covered; off-universe is data_missing and flagged', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() });
    const res = await call(analysisHandler, { body: { watchlistId: 'wl-1' } });
    expect(res.body.digest).toMatchObject({ size: 3, covered: 2, offUniverse: ['ZZZZ'] });
    const r = rec(ANALYSIS_RW);
    expect(r.stages).toEqual({ universeSize: null, matchedPreLimit: null, shortlisted: null, selectedForInvestigation: 3, investigationsCompleted: 2, eligible: null });
    expect(r.symbols).toEqual([
      { symbol: 'NVDA', outcome: null, reason: null },
      { symbol: 'AMD', outcome: null, reason: null },
      { symbol: 'ZZZZ', outcome: 'data_missing', reason: 'off_universe', offUniverse: true },
    ]);
    expect(r.state).toBe('open'); // the analysis host has no terminal writer, and none is added
    expectFunnelInvariants(r);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 4 — telemetry', () => {
  it('a success counts, with the measured model time; tokens are the provider\'s own when supplied', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst(ok(screenReply(), { usage: { input: 1200, output: 80 }, during: later(1500) }));
    expect(rec(SCREENER_RW).telemetry).toMatchObject({
      attempts: 1, completions: 1, failures: 0, cancellations: 0, elapsedMs: 1500,
      firstTurnAt: '2026-10-07T14:00:01.500Z', lastTurnAt: '2026-10-07T14:00:01.500Z', tokens: { input: 1200, output: 80 },
    });
    expect(state.calls[0].includeUsage).toBe(true); // a recorded turn opts into usage
    await screenNext(ok(screenReply(), { usage: { input: 1300, output: 90 }, during: later(500) }));
    expect(rec(SCREENER_RW).telemetry).toMatchObject({ attempts: 2, completions: 2, elapsedMs: 2000, tokens: { input: 2500, output: 170 } });
  });
  it('tokens are \'unknown\' when a turn\'s usage is not supplied — and stay unknown', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst(ok(screenReply())); // no usage
    expect(rec(SCREENER_RW).telemetry.tokens).toBe('unknown');
    await screenNext(ok(screenReply(), { usage: { input: 5, output: 5 } }));
    expect(rec(SCREENER_RW).telemetry.tokens).toBe('unknown');
  });
  it('a FAILED turn is counted (attempt, failure, elapsed, tokens unknown) in a separate write — its answer is exactly the gate-off answer', async () => {
    const seed = () => ({ 'indexIntelligence/stockRankings': rankingsDoc() });
    // gate OFF baseline of the same turn
    state.flagOn = false;
    setDb(seed());
    await screenFirst(ok(screenReply()));
    const offAnswer = await screenNext(failed({ during: later(700) }));
    // gate ON
    state.flagOn = true;
    vi.setSystemTime(new Date(NOW));
    setDb(seed());
    await screenFirst(ok(screenReply(), { usage: { input: 1, output: 1 } }));
    const onAnswer = await screenNext(failed({ during: later(700) }));
    expect(onAnswer.statusCode).toBe(offAnswer.statusCode);
    expect(onAnswer.body).toEqual(offAnswer.body);
    expect(rec(SCREENER_RW).telemetry).toMatchObject({ attempts: 2, completions: 1, failures: 1, cancellations: 0, elapsedMs: 700, tokens: 'unknown' });
    // The failure never touched the session (no budget burn) — and was its own write.
    expect(stored(activeDb, `researchSessions/${SCREENER_SESSION}`).messagesUsed).toBe(1);
  });
  it('a timed-out turn and an unparseable reply are failures too (504 / 200 answers unchanged)', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst();
    const timedOut = await screenNext(failed({ aborted: true, error: 'Request aborted' }));
    expect(timedOut.statusCode).toBe(504);
    const garbled = await screenNext(ok('no json here'));
    expect(garbled.body.errorReason).toBe('parse_plaintext_passthrough');
    expect(rec(SCREENER_RW).telemetry).toMatchObject({ attempts: 3, completions: 1, failures: 2 });
  });
  it('a turn the model answered but the host discarded (a lost concurrency check) is a CANCELLATION', async () => {
    setDb(dialogueDocs());
    await dialogueFirst();
    const res = await dialogueNext(ok(dialogueReply(), {
      usage: { input: 10, output: 2 },
      // The session is abandoned while the model is thinking.
      during: async () => { await activeDb.collection('watchlistSessions').doc(DIALOGUE_SESSION).update({ status: 'abandoned' }); },
    }));
    expect(res.statusCode).toBe(409);
    expect(rec(DIALOGUE_RW).telemetry).toMatchObject({ attempts: 2, completions: 1, failures: 0, cancellations: 1 });
  });
  it('a failure-record write that itself fails never changes the answer', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst();
    const realRun = activeDb.runTransaction.bind(activeDb);
    activeDb.runTransaction = async () => { throw new Error('14 UNAVAILABLE'); };
    const res = await screenNext(failed());
    activeDb.runTransaction = realRun;
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ error: true, screened: false, sessionId: SCREENER_SESSION });
  });
  it('the budget is the host\'s own persisted-message budget', async () => {
    setDb(dialogueDocs());
    await dialogueFirst();
    expect(rec(DIALOGUE_RW).budget).toEqual({ currency: 'persisted_messages', allotted: 20, used: 1 });
    await dialogueNext(ok(dialogueReply({ candidateTickerUpdates: [] })));
    expect(rec(DIALOGUE_RW).budget).toEqual({ currency: 'persisted_messages', allotted: 20, used: 2 });
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() });
    await call(analysisHandler, { body: { watchlistId: 'wl-1' } });
    expect(rec(ANALYSIS_RW).budget).toEqual({ currency: 'persisted_messages', allotted: 30, used: 0 });
    expect(rec(ANALYSIS_RW).telemetry).toMatchObject({ attempts: 0, tokens: { input: 0, output: 0 } }); // an open turn calls no model
  });
  it('analysis turns: success and failure on a continuing session', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() });
    await call(analysisHandler, { body: { watchlistId: 'wl-1' } });
    state.replies.push(ok(analysisReply(), { usage: { input: 3, output: 4 }, during: later(250) }));
    await call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: ANALYSIS_SESSION, userMessage: 'What do these share?' } });
    state.replies.push(failed());
    await call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: ANALYSIS_SESSION, userMessage: 'And the laggards?' } });
    expect(rec(ANALYSIS_RW).telemetry).toMatchObject({ attempts: 2, completions: 1, failures: 1, elapsedMs: 250, tokens: 'unknown' });
    expect(rec(ANALYSIS_RW).budget.used).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 5 — the screener → list link', () => {
  const create = (over = {}) => call(watchlistsHandler, {
    body: { tickers: [{ symbol: 'NVDA' }, { symbol: 'AMD' }], name: 'Chips', sourceScreenSpec: { filters: [] }, screenerSessionId: SCREENER_SESSION, ...over },
  });
  it('gate on: the list names the screener session and the record its save closes; a SECOND list from the same session names the session but no record (reviews R1-1 / R4-4)', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst();
    const first = await create();
    expect(stored(activeDb, `watchlists/${first.body.watchlistId}`)).toMatchObject({ sourceSessionId: SCREENER_SESSION, researchWorkId: SCREENER_RW, sourceDropId: null });
    const closed = rec(SCREENER_RW);
    const second = await create({ tickers: [{ symbol: 'AVGO' }] });
    // The record describes the FIRST save; the second list never borrows its numbers.
    expect(stored(activeDb, `watchlists/${second.body.watchlistId}`)).toMatchObject({ sourceSessionId: SCREENER_SESSION, researchWorkId: null });
    expect(rec(SCREENER_RW)).toEqual(closed); // subject set once; a closed record never moves
  });
  it('gate off: sourceSessionId null exactly as before, and no researchWorkId key', async () => {
    state.flagOn = false;
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc(), 'researchSessions/rs-1': screenerSession({ researchWorkId: 'rs_rs-1' }) });
    const res = await create({ screenerSessionId: 'rs-1' });
    const doc = stored(activeDb, `watchlists/${res.body.watchlistId}`);
    expect(doc.sourceSessionId).toBeNull();
    expect('researchWorkId' in doc).toBe(false);
  });
  it('another player\'s session, a malformed id, or none → no link (the plain list); a session with no record → linked, researchWorkId null', async () => {
    setDb({ 'researchSessions/theirs': screenerSession({ userId: OTHER, researchWorkId: 'rs_theirs' }), 'researchSessions/old': screenerSession() });
    for (const screenerSessionId of ['theirs', 'bad/id', undefined]) {
      const res = await create({ screenerSessionId });
      const doc = stored(activeDb, `watchlists/${res.body.watchlistId}`);
      expect(doc.sourceSessionId, String(screenerSessionId)).toBeNull();
      expect('researchWorkId' in doc).toBe(false);
    }
    const res = await create({ screenerSessionId: 'old' });
    expect(stored(activeDb, `watchlists/${res.body.watchlistId}`)).toMatchObject({ sourceSessionId: 'old', researchWorkId: null });
    expect(records()).toEqual({});
  });
  it('the response is the response it always was', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst();
    const res = await create();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ watchlistId: res.body.watchlistId, status: 'draft', tickerCount: 2, createdAt: NOW, idempotent: false });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 6 — manual', () => {
  it('a manual list mints its own record: every stage null, no cohort, completed / player_authored, at creation', async () => {
    setDb();
    const res = await call(watchlistsHandler, { body: {} });
    const id = `wl_${res.body.watchlistId}`;
    expect(stored(activeDb, `watchlists/${res.body.watchlistId}`).researchWorkId).toBe(id);
    expect(rec(id)).toEqual({
      schemaVersion: 1, researchWorkId: id, userId: OWNER, origin: 'manual', host: null, createdAt: NOW,
      watchlistId: res.body.watchlistId, hypothesisVersion: null,
      stages: { universeSize: null, matchedPreLimit: null, shortlisted: null, selectedForInvestigation: null, investigationsCompleted: null, eligible: null },
      symbols: [], symbolsTruncated: false, budget: null,
      telemetry: { attempts: 0, completions: 0, failures: 0, cancellations: 0, elapsedMs: 0, firstTurnAt: null, lastTurnAt: null, tokens: { input: 0, output: 0 } },
      state: 'completed', terminalReason: 'player_authored', endedAt: NOW, updatedAt: NOW,
    });
    expect(res.body).toEqual({ watchlistId: res.body.watchlistId, status: 'draft', tickerCount: 0, createdAt: NOW, idempotent: false });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 7 — abandon', () => {
  it('user_close: the record ends abandoned (the host\'s own reason), open candidates cancelled, removed ones stay rejected', async () => {
    setDb(dialogueDocs());
    await dialogueFirst();
    await dialogueNext(ok(dialogueReply({ candidateTickerUpdates: [{ action: 'remove', symbol: 'AMD' }] })));
    vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z'));
    const res = await call(abandonHandler, { body: { sessionId: DIALOGUE_SESSION, agentId: AGENT_ID, reason: 'user_close' } });
    expect(res.body).toMatchObject({ status: 'abandoned', idempotent: false });
    const r = rec(DIALOGUE_RW);
    expect(r).toMatchObject({ state: 'abandoned', terminalReason: 'user_close', endedAt: '2026-10-07T15:00:00.000Z', watchlistId: null });
    expect(r.symbols).toEqual([
      { symbol: 'NVDA', outcome: 'cancelled', reason: 'user_close' },
      { symbol: 'AMD', outcome: 'rejected', reason: 'removed' },
    ]);
    expect(r.stages).toMatchObject({ shortlisted: 2, selectedForInvestigation: 1, eligible: 0 });
    expectFunnelInvariants(r);
    // Idempotent re-abandon: the record does not move again.
    vi.setSystemTime(new Date('2026-10-07T16:00:00.000Z'));
    await call(abandonHandler, { body: { sessionId: DIALOGUE_SESSION, agentId: AGENT_ID, reason: 'user_close' } });
    expect(rec(DIALOGUE_RW)).toEqual(r);
  });
  it('finalize_intent leaves the record open (the save closes it)', async () => {
    setDb(dialogueDocs());
    await dialogueFirst();
    await call(abandonHandler, { body: { sessionId: DIALOGUE_SESSION, agentId: AGENT_ID, reason: 'finalize_intent' } });
    expect(rec(DIALOGUE_RW).state).toBe('open');
    const save = await call(watchlistsHandler, { body: { sessionId: DIALOGUE_SESSION, agentId: AGENT_ID, dropId: DROP_ID } });
    expect(save.statusCode).toBe(200);
    expect(rec(DIALOGUE_RW)).toMatchObject({ state: 'completed', terminalReason: 'saved_to_list' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('§2 review fixes — turn accounting and a closed record', () => {
  it('a throw AFTER the turn persisted is not also a failure (review R2-4)', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst();
    state.logThrows = true; // the post-persist logger throws synchronously
    const res = await screenNext(ok(screenReply()));
    expect(res.statusCode).toBe(500); // the host's own catch-all answer, as on main
    expect(rec(SCREENER_RW).telemetry).toMatchObject({ attempts: 2, completions: 2, failures: 0 });
  });
  it('a persist step that throws without saying whether it committed is NOT counted — the outcome is unknown (reviews R1-11 / R2-6)', async () => {
    setDb(dialogueDocs());
    await dialogueFirst();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = rec(DIALOGUE_RW);
    // The turn's transaction commits, then its promise rejects (an ambiguous commit).
    activeDb.__hooks.afterCommit = async () => { activeDb.__hooks.afterCommit = null; const e = new Error('4 DEADLINE_EXCEEDED'); e.code = 4; throw e; };
    const res = await dialogueNext(ok(dialogueReply({ candidateTickerUpdates: [] })));
    expect(res.statusCode).toBe(500);
    // The committed turn counted once as a completion; the ambiguous error added no failure.
    expect(rec(DIALOGUE_RW).telemetry).toMatchObject({ attempts: before.telemetry.attempts + 1, completions: before.telemetry.completions + 1, failures: 0 });
    expect(console.warn.mock.calls.some(([m]) => /turn outcome unknown/.test(m))).toBe(true);
  });
  it('a CLOSED record never moves: screener turns after the save leave it exactly as it closed (review R1-1)', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc() });
    await screenFirst();
    await call(watchlistsHandler, { body: { tickers: [{ symbol: 'NVDA' }], name: 'x', sourceScreenSpec: { filters: [] }, screenerSessionId: SCREENER_SESSION } });
    const closed = rec(SCREENER_RW);
    vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z'));
    await screenNext(ok(screenReply()));
    await screenNext(failed());
    expect(rec(SCREENER_RW)).toEqual(closed);
    expect(stored(activeDb, `researchSessions/${SCREENER_SESSION}`).messagesUsed).toBe(2); // the host itself carries on
  });
  it('analysis is cumulative over its session: a member the player drops mid-session stays counted (review R1-8)', async () => {
    setDb({ 'indexIntelligence/stockRankings': rankingsDoc(), 'watchlists/wl-1': savedList() }); // NVDA, AMD, ZZZZ (off-universe)
    await call(analysisHandler, { body: { watchlistId: 'wl-1' } });
    await activeDb.collection('watchlists').doc('wl-1').update({ tickers: [{ symbol: 'AMD' }, { symbol: 'AVGO' }] });
    state.replies.push(ok(analysisReply()));
    await call(analysisHandler, { body: { watchlistId: 'wl-1', sessionId: ANALYSIS_SESSION, userMessage: 'And now?' } });
    const r = rec(ANALYSIS_RW);
    expect(r.stages).toMatchObject({ selectedForInvestigation: 4, investigationsCompleted: 3 });
    expect(r.symbols.map((s) => `${s.symbol}:${s.outcome}`)).toEqual(['NVDA:null', 'AMD:null', 'ZZZZ:data_missing', 'AVGO:null']);
  });
});
