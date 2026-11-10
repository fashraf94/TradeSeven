// test/rules/huddleQueue.rules.mjs
//
// Huddle S1 — THE QUEUE, THE WORKER AND ONE JOB AGAINST THE REAL FIRESTORE EMULATOR
// (spec V1.1 §3.3, §5.3, §9 "two workers racing one queue row (exactly one publishes); a
// stale generation attempting to publish (nothing written)"; Amendment A §A3, §A6, §A11
// "the worker recovering an unfinished enqueue stage"; Amendment B §B4, §B5 "crash after
// publish, before queue done: the reclaim marks done, not failed"; "a worker holding a
// stale generation attempts each finalizer: all refused"). The model, the speech and the
// storage are injected stand-ins; Firestore is real. Each row works under its own date.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { enqueuePlayers, selectClaimable, claimRow, markDone, markAttemptFailed, withOwnedClaim, QUEUE_LEASE_MS, MAX_ATTEMPTS } from '../../api/_utils/huddle/queue.js';
import { runHuddleJob } from '../../api/_utils/huddle/job.js';
import { drainQueue, runWorkerInvocation, runReconcilePass, IN_FLIGHT, DRAIN_RESERVE_MS } from '../../api/_utils/huddle/worker.js';
import { buildSessionEvents } from '../../api/_utils/huddle/events.js';
import { packItem } from '../../api/_utils/evidence/packItem.js';
import { getSessionForDate } from '../../api/_utils/marketSchedule.js';
import { sessionOf, sessionWindowOf } from '../../api/_utils/huddle/records.js';

const MIN = 60_000;
let app;
let db;
let n = 0;
// distinct trading dates per row, so rows never see each other's queue
const DATES = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
const nextDate = () => DATES[(n++) % DATES.length];

beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error('huddleQueue needs the local Firestore emulator');
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `huddle-queue-${Date.now()}`);
  db = getFirestore(app);
});
afterAll(async () => { if (app) await deleteApp(app); });

const row = async (uid, etDate) => (await db.doc(`huddleQueue/${uid}_${etDate}`).get()).data();
const rec = async (uid, etDate) => (await db.doc(`huddles/${uid}/days/${etDate}`).get()).data();

/** A gather stand-in: two names in the universe, a close each, one headline, one ISM event. */
function fakeGather(etDate) {
  const events = buildSessionEvents({ etDate, window: sessionWindowOf(sessionOf(etDate)), macroEvents: [{ date: etDate, time: '10:00 AM ET', category: 'ISM Manufacturing' }], earnings: [] });
  const headline = packItem({ kind: 'headline', fact: 'finance.yahoo.com reported: AAA raises guidance', recordKind: 'symbolDayEvidence.news', recordId: 'n1', label: 'finance.yahoo.com via EODHD', at: `${etDate}T02:00:00.000Z` });
  const close = packItem({ kind: 'close', fact: 'AAA closed at 50.00.', recordKind: 'symbolDayEvidence.price', recordId: `${etDate}_AAA`, label: 'EODHD daily bars', at: etDate });
  return async () => ({
    agentId: 'a1', archetype: 'contrarian', battles: [], universe: new Set(['AAA', 'BBB']),
    names: [{ ticker: 'AAA', source: 'activeBattle', exposure: 20, hasClose: true }, { ticker: 'BBB', source: 'watchlist', exposure: 0, hasClose: true }],
    closes: new Map([['AAA', 50], ['BBB', 40]]), events, window: sessionWindowOf(sessionOf(etDate)), eventsListed: { listed: 1, earningsListed: 0, earningsTotal: 0 },
    tape: { regime: 'risk-on' }, evidence: [headline, close], priorPlan: null, sourceFailures: [], watchlistTickers: ['BBB'],
    _ids: { headline: headline.id, close: close.id },
  });
}
const script = (ids, over = {}) => ({
  names: [{ ticker: 'AAA', read: 'Strong into today.', evidenceIds: [ids.headline] }],
  yesterday: null,
  tape: { sentences: [{ text: 'The tape closed firm, with the ISM data due today.', evidenceIds: [] }] },
  namesBeat: { sentences: [{ text: 'Yahoo Finance reported AAA raised guidance overnight.', evidenceIds: [ids.headline] }] },
  armor: { sentences: [{ text: 'Your Contrarian would rather watch than chase a crowded move.', evidenceIds: [] }] },
  mentionedTickers: ['AAA'],
  planProposal: { stances: [{ kind: 'CHASE', ticker: 'AAA', level: 52 }, { kind: 'HOLD', ticker: 'BBB', level: null }], lines: [{ kind: 'NO_ADDS_BEFORE', eventId: null, ticker: null, level: null }] },
  ...over,
});
function jobDeps(etDate, { answers } = {}) {
  const gather = fakeGather(etDate);
  let ids = null;
  const calls = [];
  return {
    calls,
    deps: {
      gatherForPlayer: async (...a) => { const g = await gather(...a); ids = g._ids; return g; },
      callScriptModel: async () => { calls.push('script'); const next = answers ? answers.shift() : script(ids); return { ok: true, output: typeof next === 'function' ? next(ids) : next, stopReason: 'end_turn', usage: { input: 1, output: 1 } }; },
      synthesize: async ({ text }) => ({ ok: true, mp3: Buffer.from('mp3'), voiceId: 'v', keys: ['alignment', 'audio_base64'], alignment: { characters: [...text], character_start_times_seconds: [...text].map((_, i) => i / 10), character_end_times_seconds: [...text].map((_, i) => (i + 1) / 10) } }),
      storeHuddleAudio: async ({ uid, etDate: d, claimGeneration }) => ({ gcsPath: `huddle/${uid}/${d}/${claimGeneration}/audio.mp3`, alignmentPath: `huddle/${uid}/${d}/${claimGeneration}/alignment.json` }),
    },
  };
}

describe('the queue (§3.3; A §A2; B §B4)', () => {
  it('two workers racing one row: exactly one claims, and exactly one publishes', async () => {
    const etDate = nextDate();
    const session = sessionOf(etDate);
    await enqueuePlayers(db, { etDate, uids: ['race1'], nowMs: session.openMs - 90 * MIN });
    const now = session.openMs - 60 * MIN;
    const claims = await Promise.all([claimRow(db, { uid: 'race1', etDate, nowMs: now }), claimRow(db, { uid: 'race1', etDate, nowMs: now })]);
    expect(claims.filter((c) => c.kind === 'claimed')).toHaveLength(1);
    expect(claims.filter((c) => c.kind === 'not_selectable')).toHaveLength(1);
    const gen = claims.find((c) => c.kind === 'claimed').generation;
    const { deps } = jobDeps(etDate);
    const clock = () => now + MIN;
    const [a, b] = await Promise.all([
      runHuddleJob(db, { uid: 'race1', etDate, generation: gen, session, shared: null, deps, clock }),
      runHuddleJob(db, { uid: 'race1', etDate, generation: gen - 1, session, shared: null, deps, clock }),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(['published', 'stale_generation']);
    expect((await rec('race1', etDate)).status).toBe('ready');
    expect(await row('race1', etDate)).toMatchObject({ status: 'done', claimGeneration: gen + 1 });
  });

  it('a stale generation attempting each finalizer — publish, done, failed — is refused, and writes nothing', async () => {
    const etDate = nextDate();
    const session = sessionOf(etDate);
    await enqueuePlayers(db, { etDate, uids: ['stale1'] });
    const now = session.openMs - 60 * MIN;
    const c = await claimRow(db, { uid: 'stale1', etDate, nowMs: now });
    const before = await row('stale1', etDate);
    const clock = () => now + MIN;
    expect((await markDone(db, { uid: 'stale1', etDate, generation: c.generation - 1, nowMs: clock })).outcome).toBe('stale_generation');
    expect((await markAttemptFailed(db, { uid: 'stale1', etDate, generation: c.generation + 5, reason: 'x', nowMs: clock })).outcome).toBe('stale_generation');
    expect((await withOwnedClaim(db, { uid: 'stale1', etDate, generation: 999, nowMs: clock, label: 'publish' }, (tx) => { tx.set(db.doc(`huddles/stale1/days/${etDate}`), { status: 'ready' }); })).outcome).toBe('stale_generation');
    // an owner whose lease has expired is refused too
    expect((await markDone(db, { uid: 'stale1', etDate, generation: c.generation, nowMs: () => now + QUEUE_LEASE_MS + 1 })).outcome).toBe('stale_generation');
    expect(await row('stale1', etDate)).toEqual(before);
    expect(await rec('stale1', etDate)).toBeUndefined();
    // ...and a done row bumps the generation, so the former owner can never pass again
    expect((await markDone(db, { uid: 'stale1', etDate, generation: c.generation, nowMs: clock })).outcome).toBe('written');
    expect((await markDone(db, { uid: 'stale1', etDate, generation: c.generation, nowMs: clock })).outcome).toBe('stale_generation');
  });

  it('crash after publish, before done: the reclaim of the expired claim marks it done, never failed — attempts notwithstanding', async () => {
    const etDate = nextDate();
    await db.doc(`huddleQueue/crash1_${etDate}`).set({ uid: 'crash1', etDate, status: 'claimed', attempts: MAX_ATTEMPTS, claimGeneration: 3, leaseUntil: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    await db.doc(`huddles/crash1/days/${etDate}`).set({ status: 'ready', uid: 'crash1', etDate });
    expect((await claimRow(db, { uid: 'crash1', etDate, nowMs: Date.now() })).kind).toBe('repaired_done');
    expect(await row('crash1', etDate)).toMatchObject({ status: 'done', claimGeneration: 4 });
  });

  it('the attempt cap: a reclaim at three attempts with no ready record marks the row and the record failed', async () => {
    const etDate = nextDate();
    await db.doc(`huddleQueue/cap1_${etDate}`).set({ uid: 'cap1', etDate, status: 'claimed', attempts: MAX_ATTEMPTS, claimGeneration: 3, leaseUntil: 1, lastError: 'script_model_error_500', createdAt: '2026-01-01T00:00:00.000Z' });
    expect((await claimRow(db, { uid: 'cap1', etDate, nowMs: Date.now() })).kind).toBe('failed_cap');
    expect(await row('cap1', etDate)).toMatchObject({ status: 'failed', claimGeneration: 4 });
    expect((await rec('cap1', etDate))).toMatchObject({ status: 'failed', generation: { failReason: 'script_model_error_500' } });
  });

  it('enqueue is idempotent by row key, and selection finds pending rows and expired claims only', async () => {
    const etDate = nextDate();
    expect((await enqueuePlayers(db, { etDate, uids: ['s1', 's2'] })).created).toBe(2);
    expect((await enqueuePlayers(db, { etDate, uids: ['s1', 's2', 's3'] })).created).toBe(1);
    const now = Date.now();
    await claimRow(db, { uid: 's1', etDate, nowMs: now });
    expect((await selectClaimable(db, { etDate, nowMs: now })).map((r) => r.uid).sort()).toEqual(['s2', 's3']);
    expect((await selectClaimable(db, { etDate, nowMs: now + QUEUE_LEASE_MS + 1 })).map((r) => r.uid).sort()).toEqual(['s1', 's2', 's3']);
  });
});

describe('one job (V1.1 §5.3; A §A7; R-11)', () => {
  it('publishes a ready record: model beats, the CODE-narrated plan beat, templates-only plan with the dissent applied, timings, cards, transcript', async () => {
    const etDate = nextDate();
    const session = sessionOf(etDate);
    await enqueuePlayers(db, { etDate, uids: ['job1'] });
    const now = session.openMs - 60 * MIN;
    const c = await claimRow(db, { uid: 'job1', etDate, nowMs: now });
    const { deps } = jobDeps(etDate);
    const out = await runHuddleJob(db, { uid: 'job1', etDate, generation: c.generation, session, shared: null, deps, clock: () => now + MIN });
    expect(out.outcome).toBe('published');
    const r = await rec('job1', etDate);
    expect(r.status).toBe('ready');
    expect(r.script.beats.map((b) => [b.id, b.source])).toEqual([['tape', 'model'], ['names', 'model'], ['armor', 'model'], ['plan', 'code']]);
    // the contrarian dissent turned CHASE into WATCH; the null-eventId line was dropped by the template
    expect(r.plan.current.stances.map((s) => `${s.kind} ${s.ticker}`)).toEqual(['WATCH AAA', 'HOLD BBB']);
    expect(r.plan.dissent).toHaveLength(1);
    expect(r.generation.drops.map((d) => d.reason)).toContain('event_unknown');
    expect(r.script.beats.at(-1).text).toBe("Here's what I'd carry in today: watch AAA; hold BBB.");
    expect(r.audio).toMatchObject({ gcsPath: `huddle/job1/${etDate}/${c.generation}/audio.mp3`, timed: true });
    expect(r.script.beats[0].startMs).toBe(0);
    expect(r.transcript).toContain('The game plan');
    expect(r.cards.map((cd) => cd.title)).toContain('AAA');
    expect(r.evidence).toHaveLength(2);
    // Amendment E §E4: the speech attempts (one retry inside the job) are timed too
    expect(Object.keys(r.generation.timings).sort()).toEqual(['gatherMs', 'scriptMs', 'speechAttempts', 'speechMs', 'storeMs', 'totalMs']);
    expect(r.generation.timings.speechAttempts).toBe(1);
    expect(r.generation.sourcesSkipped).toEqual([]);
    expect(await row('job1', etDate)).toMatchObject({ status: 'done' });
  });

  it("review L2-6 / L1-3: a published huddle joins the reconcile set; after the close the worker's pass expires its unanswered plan and the row leaves the set", async () => {
    const etDate = nextDate();
    const session = sessionOf(etDate);
    await enqueuePlayers(db, { etDate, uids: ['rec1'] });
    const now = session.openMs - 60 * MIN;
    const c = await claimRow(db, { uid: 'rec1', etDate, nowMs: now });
    const { deps } = jobDeps(etDate);
    expect((await runHuddleJob(db, { uid: 'rec1', etDate, generation: c.generation, session, shared: null, deps, clock: () => now + MIN })).outcome).toBe('published');
    expect(await row('rec1', etDate)).toMatchObject({ status: 'done', reconcile: true });
    // before the close: visited and stamped, still proposed, still in the set
    // Amendment E §E7: the pass keeps to the cohort (HUDDLE_PLAYER_UIDS, fail closed); this row's is its one player
    await runReconcilePass(db, { etDate, nowMs: session.openMs + 60 * MIN, cohort: new Set(['rec1']) });
    expect((await rec('rec1', etDate)).plan.status).toBe('proposed');
    expect(await row('rec1', etDate)).toMatchObject({ reconcile: true, reconciledAt: new Date(session.openMs + 60 * MIN).toISOString() });
    // after the close: expired, and the row leaves the set
    await runReconcilePass(db, { etDate, nowMs: session.closeMs + MIN, cohort: new Set(['rec1']) });
    expect((await rec('rec1', etDate)).plan.status).toBe('expired');
    expect(await row('rec1', etDate)).toMatchObject({ reconcile: false });
  });

  it('a names beat without evidence is regenerated once; still failing, the beat is dropped and the drop recorded', async () => {
    const etDate = nextDate();
    const session = sessionOf(etDate);
    await enqueuePlayers(db, { etDate, uids: ['job2'] });
    const now = session.openMs - 60 * MIN;
    const c = await claimRow(db, { uid: 'job2', etDate, nowMs: now });
    const bad = (ids) => script(ids, { namesBeat: { sentences: [{ text: 'AAA looks strong.', evidenceIds: [] }] } });
    const { deps, calls } = jobDeps(etDate, { answers: [bad, bad] });
    await runHuddleJob(db, { uid: 'job2', etDate, generation: c.generation, session, shared: null, deps, clock: () => now + MIN });
    expect(calls).toHaveLength(2);
    const r = await rec('job2', etDate);
    expect(r.script.beats.map((b) => b.id)).not.toContain('names');
    expect(r.generation.drops).toContainEqual({ stage: 'script', beat: 'names', reasons: ['missing_evidence'] });
    expect(r.generation.regenerated).toBe(true);
  });

  it('a ticker outside the universe after the regeneration fails the attempt (AR-12): the row goes back to pending, no record is ready', async () => {
    const etDate = nextDate();
    const session = sessionOf(etDate);
    await enqueuePlayers(db, { etDate, uids: ['job3'] });
    const now = session.openMs - 60 * MIN;
    const c = await claimRow(db, { uid: 'job3', etDate, nowMs: now });
    const outside = (ids) => script(ids, { mentionedTickers: ['AAA', 'TSLA'] });
    const { deps } = jobDeps(etDate, { answers: [outside, outside] });
    const out = await runHuddleJob(db, { uid: 'job3', etDate, generation: c.generation, session, shared: null, deps, clock: () => now + MIN });
    expect(out).toMatchObject({ outcome: 'failed' });
    expect(out.reason).toMatch(/^ticker_outside_universe/);
    expect(await row('job3', etDate)).toMatchObject({ status: 'pending', attempts: 1 });
    expect((await rec('job3', etDate)).status).toBe('generating');
  });

  it('no voice id: published transcript-only, the reason recorded', async () => {
    const etDate = nextDate();
    const session = sessionOf(etDate);
    await enqueuePlayers(db, { etDate, uids: ['job4'] });
    const now = session.openMs - 60 * MIN;
    const c = await claimRow(db, { uid: 'job4', etDate, nowMs: now });
    const { deps } = jobDeps(etDate);
    deps.synthesize = async () => ({ ok: false, reason: 'no_voice_id' });
    await runHuddleJob(db, { uid: 'job4', etDate, generation: c.generation, session, shared: null, deps, clock: () => now + MIN });
    const r = await rec('job4', etDate);
    expect(r).toMatchObject({ status: 'ready', audio: null });
    expect(r.generation.sourceFailures).toContain('speech:no_voice_id');
  });
});

describe('the worker (A §A3, §A6)', () => {
  it('drains with 4 in flight, replenishing as each finishes, and starts nothing with less than 130 s left', async () => {
    const etDate = nextDate();
    const uids = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
    await enqueuePlayers(db, { etDate, uids });
    let inFlight = 0;
    let peak = 0;
    let fakeNow = getSessionForDate(etDate).openMs - 55 * MIN; // 8:35 AM ET
    // A barrier, not a sleep: the first jobs wait until IN_FLIGHT are running (capped at 3 s), so the peak does not depend on
    // how fast the emulator answers the claims (a 20 ms sleep let the first job finish before the fourth lane started).
    let release;
    const allIn = new Promise((r) => { release = r; });
    const runJob = async (_db, { uid }) => {
      inFlight += 1; peak = Math.max(peak, inFlight);
      if (inFlight === IN_FLIGHT) release();
      await Promise.race([allIn, new Promise((r) => setTimeout(r, 3000))]);
      inFlight -= 1;
      return { outcome: 'published', uid };
    };
    const start = fakeNow;
    const out = await drainQueue(db, { etDate, session: sessionOf(etDate), shared: null, invocationStartMs: start, clock: () => fakeNow, runJob, cohort: new Set([...uids, 'd7']) });
    expect(out.started).toBe(6);
    expect(peak).toBe(IN_FLIGHT);
    // with the reserve gone nothing starts
    await enqueuePlayers(db, { etDate, uids: ['d7'] });
    const late = await drainQueue(db, { etDate, session: sessionOf(etDate), shared: null, invocationStartMs: start - (300_000 - DRAIN_RESERVE_MS) - 1, clock: () => fakeNow, runJob, cohort: new Set([...uids, 'd7']) });
    expect(late.started).toBe(0);
  });

  it('recovers an unfinished enqueue stage itself (brief done, enqueue not), then drains', async () => {
    const etDate = nextDate();
    const at = getSessionForDate(etDate).openMs - 50 * MIN;
    await db.doc(`huddleRuns/${etDate}`).set({ etDate, briefStage: 'done', enqueueStage: 'pending' });
    const started = [];
    const out = await runWorkerInvocation(db, {
      clock: () => at,
      cohort: new Set(['r1', 'r2']),
      deps: {
        enqueue: { buildSharedLayer: async () => ({ tape: null, macroEvents: [], earnings: [], earningsTotal: 0, sources: {} }), enumerateActivePlayers: async () => ({ uids: ['r1', 'r2'], counts: {}, skippedCpu: 0 }) },
        runJob: async (_db, { uid }) => { started.push(uid); return { outcome: 'published' }; },
      },
    });
    expect(out).toMatchObject({ outcome: 'drained', recovered: true, started: 2 });
    expect(started.sort()).toEqual(['r1', 'r2']);
    expect((await db.doc(`huddleRuns/${etDate}`).get()).data()).toMatchObject({ enqueueStage: 'done', playersEnqueued: 2 });
    // a second invocation does not enqueue again
    const again = await runWorkerInvocation(db, { clock: () => at + 2 * MIN, cohort: new Set(['r1', 'r2']), deps: { runJob: async () => ({ outcome: 'published' }) } });
    expect(again.recovered).toBe(false);
  });

  it('E7: the drain claims only the cohort\'s rows; a row of a player outside it stays pending', async () => {
    const etDate = nextDate();
    await enqueuePlayers(db, { etDate, uids: ['in1', 'out1'] });
    const at = getSessionForDate(etDate).openMs - 50 * MIN;
    const ran = [];
    const out = await drainQueue(db, { etDate, session: sessionOf(etDate), shared: null, invocationStartMs: at, clock: () => at, runJob: async (_db, { uid }) => { ran.push(uid); return { outcome: 'published' }; }, cohort: new Set(['in1']) });
    expect(out.started).toBe(1);
    expect(ran).toEqual(['in1']);
    expect(await row('out1', etDate)).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('a non-trading day exits at once', async () => {
    const out = await runWorkerInvocation(db, { clock: () => Date.parse('2026-11-08T15:00:00Z') });
    expect(out).toEqual({ etDate: '2026-11-08', outcome: 'not_a_trading_day' });
  });
});
