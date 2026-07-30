// api/fantasytimes/pollBatch.handler.test.js
// Phase 2 N6 — the poll-batch handler harness + the P2-43 TDZ adjudication
// (founder-authorized fix, V1.3 §0 "pending veto" resolved into this build).
//
// THE ADJUDICATION. Two prior claims contradicted each other about the
// `const results` shadow that used to sit at the top of the ended-branch
// (pre-fix poll-batch.js:95, shadowing the accumulator at :66):
//   • Phase 1 review: "observability-only" — responses lie, pipeline fine.
//   • Phase 2 discovery: "stalls Doug's pipeline on every still-processing
//     batch."
// This file settles it BY EXPERIMENT (A6): the suite asserts the fixed
// behavior, and was first run against the PRE-fix handler (scratchpad copy,
// July 30 2026). The pre-fix red pattern is the verdict:
//
//   PRE-FIX, still-processing batch: `results.push` at the old :80 sat in
//   the temporal dead zone of the shadowing declaration at :95 (same block
//   scope) → ReferenceError "Cannot access 'results' before initialization",
//   caught by the per-batch catch → response entry became
//   {batchId, error: "Cannot access 'results' before initialization"}.
//   The batch doc was NEVER touched — status stayed 'processing', so the
//   next poll retried it normally. Control flow was identical to the
//   intended `continue`; only the response entry lied.
//
//   PRE-FIX, ended batch: stories were created and the batch doc was
//   updated to 'completed' BEFORE the old :251 trailing push ran — that
//   push hit the SDK results stream (async iterable, no .push) →
//   TypeError "results.push is not a function", caught per-batch → the
//   response reported an error for a batch that had fully succeeded.
//
//   VERDICT: observability-only. In the pre-fix red run, every PERSISTENCE
//   assertion below (stories created, batch docs completed / left
//   processing) already PASSED; only the RESPONSE-shape assertions failed.
//   The "stalls Doug's pipeline" claim is REFUTED: the two-poll sequence
//   test landed the story pre-fix too. What the defect actually cost was
//   truthful cron monitoring — every poll response reported errors.
//
// The persistence vs response assertions are deliberately SEPARATE `it`
// blocks so the red pattern itself reads as the adjudication.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeMockDb } from '../_utils/__fixtures__/masteryMockDb.js';

// ── Mocks (handler-level: transport, auth, firestore, visuals) ────────────
const h = vi.hoisted(() => ({
  retrieveByBatchId: new Map(), // batchId → processing_status
  resultsByBatchId: new Map(),  // batchId → array of raw result rows
  retrieveCalls: [],
}));

// Faithful SDK shape: batches.results() resolves to an ASYNC ITERABLE with
// no .push (JSONLDecoder). A plain array would have .push and would have
// silently changed the pre-fix characterization at the old :251.
async function* resultStream(items) {
  for (const item of items) yield item;
}

vi.mock('../_utils/wireModelCall.js', () => ({
  wireBatchRetrieve: vi.fn(async (batchId) => {
    h.retrieveCalls.push(batchId);
    return { processing_status: h.retrieveByBatchId.get(batchId) ?? 'ended' };
  }),
  wireBatchResults: vi.fn(async (batchId) =>
    resultStream(h.resultsByBatchId.get(batchId) ?? [])
  ),
}));

vi.mock('../_utils/security.js', () => ({
  applySecurityMiddleware: () => false,
}));

const dbRef = { db: null };
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => dbRef.db,
}));

vi.mock('../_utils/fantasyTimesPrompts.js', () => ({
  REPORTER_PROFILES: {
    doug: { name: 'Doug Hale', beat: 'Earnings', expiryHours: 24 },
  },
}));

const artDirectorCalls = [];
vi.mock('../_utils/fantasyTimesVisuals.js', () => ({
  getDefaultVisual: () => ({ visualType: 'headline_stat', visualConfig: { kind: 'test' } }),
  shouldOverrideVisual: () => false,
  callArtDirector: async (...args) => { artDirectorCalls.push(args); },
}));

// Dark posture (all Phase 2 flags false), matching production today. The TDZ
// defect and its fix are FLAG-INDEPENDENT — the shadow sat outside every
// flag branch — so the adjudication runs on the plain-`.add` path.
const flagState = { metricsEnabled: false, writesEnabled: false, continuityEnabled: false };
vi.mock('../_utils/wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

vi.mock('../_utils/wireCalendar.js', () => ({
  resolveWireMarketDate: () => '2026-07-30',
}));

const publishCalls = [];
vi.mock('../_utils/wireWriteThrough.js', () => ({
  publishStoryWithWire: vi.fn(async (db, params) => {
    publishCalls.push(params);
    return { storyRef: await db.collection('fantasyTimesStories').add(params.storyDoc) };
  }),
}));

vi.mock('../_utils/wireMetrics.js', () => ({
  recordWireSample: vi.fn(async () => {}),
}));

const handler = (await import('./poll-batch.js')).default;

// ── Harness helpers ────────────────────────────────────────────────────────
vi.stubEnv('CLAUDE_API_KEY', 'test-key');

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

const cronReq = () => ({ method: 'GET', headers: { 'x-vercel-cron': '1' } });

// A report date safely in the future relative to the real clock — the
// handler compares against new Date() (stale-preview guard).
const futureDate = () => new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
const pastDate = () => new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);

function succeededResult(symbol, reportDate, overrides = {}) {
  return {
    custom_id: `earnings_preview_${symbol}_${reportDate}`,
    result: {
      type: 'succeeded',
      message: {
        stop_reason: 'tool_use',
        content: [{
          type: 'tool_use',
          input: {
            headline: `${symbol} earnings on deck`,
            subheadline: 'Preview',
            body: 'Preview body.',
            themes: ['earnings'],
            sentiment: 'neutral',
            recommended_action: 'EARNINGSGAME',
            epsEstimate: 1.23,
            revenueEstimate: 4.56,
            ...overrides,
          },
        }],
      },
    },
  };
}

function erroredResult(symbol, reportDate) {
  return {
    custom_id: `earnings_preview_${symbol}_${reportDate}`,
    result: { type: 'errored', error: { message: 'model exploded' } },
  };
}

const storyPaths = (db) => db.__paths('fantasyTimesStories/');

beforeEach(() => {
  dbRef.db = makeMockDb();
  h.retrieveByBatchId.clear();
  h.resultsByBatchId.clear();
  h.retrieveCalls.length = 0;
  publishCalls.length = 0;
  artDirectorCalls.length = 0;
  flagState.metricsEnabled = false;
  flagState.writesEnabled = false;
  flagState.continuityEnabled = false;
});

async function seedBatch(batchId, { status = 'processing', ...rest } = {}) {
  await dbRef.db.collection('fantasyTimesBatches').doc(batchId).set({
    batchId, status, submittedAt: new Date('2026-07-30T09:00:00Z'), ...rest,
  });
}

// ── Guards ─────────────────────────────────────────────────────────────────
describe('handler guards', () => {
  it('non-cron caller without the secret → 401', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it('no pending batches → clean 200 message', async () => {
    const res = makeRes();
    await handler(cronReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'No pending batches' });
  });
});

// ── P2-43: the adjudication rows ───────────────────────────────────────────
describe('P2-43 (persistence half): the pipeline never depended on the fix', () => {
  // These assertions PASSED against the pre-fix handler too — that pre-fix
  // green is the refutation of the "stalls the pipeline" claim.
  it('still-processing batch: batch doc untouched, zero stories', async () => {
    await seedBatch('b-alpha');
    h.retrieveByBatchId.set('b-alpha', 'in_progress');

    await handler(cronReq(), makeRes());

    expect(dbRef.db.__dump('fantasyTimesBatches/b-alpha').status).toBe('processing');
    expect(storyPaths(dbRef.db)).toHaveLength(0);
  });

  it('ended batch: story created + batch doc completed', async () => {
    await seedBatch('b-beta');
    h.retrieveByBatchId.set('b-beta', 'ended');
    h.resultsByBatchId.set('b-beta', [succeededResult('NVDA', futureDate())]);

    await handler(cronReq(), makeRes());

    const stories = storyPaths(dbRef.db).map((p) => dbRef.db.__dump(p));
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({
      reporter: 'doug',
      type: 'earnings_preview',
      tickers: ['NVDA'],
      primaryTicker: 'NVDA',
      batchId: 'b-beta',
      status: 'published',
      visualType: 'headline_stat',
    });
    const batchDoc = dbRef.db.__dump('fantasyTimesBatches/b-beta');
    expect(batchDoc.status).toBe('completed');
    expect(batchDoc.errors).toBeNull();
  });

  it('two-poll sequence (the discovery claim, refuted): processing then ended → story lands', async () => {
    await seedBatch('b-gamma');
    h.retrieveByBatchId.set('b-gamma', 'in_progress');
    await handler(cronReq(), makeRes()); // poll 1: still processing

    h.retrieveByBatchId.set('b-gamma', 'ended');
    h.resultsByBatchId.set('b-gamma', [succeededResult('AMD', futureDate())]);
    await handler(cronReq(), makeRes()); // poll 2: ended

    expect(storyPaths(dbRef.db)).toHaveLength(1);
    expect(dbRef.db.__dump('fantasyTimesBatches/b-gamma').status).toBe('completed');
  });
});

describe('P2-43 (response half): what the defect actually broke — and the fix restores', () => {
  // PRE-FIX RED (captured in the A6 experiment run):
  //   still-processing → batches[0] was
  //     { batchId, error: "Cannot access 'results' before initialization" }
  //   ended → batches[0] was
  //     { batchId, error: "results.push is not a function" }
  it('still-processing batch: response carries its status, not a ReferenceError', async () => {
    await seedBatch('b-alpha');
    h.retrieveByBatchId.set('b-alpha', 'in_progress');

    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.batches).toEqual([{ batchId: 'b-alpha', status: 'in_progress' }]);
  });

  it('ended batch: response carries the summary, not a TypeError', async () => {
    await seedBatch('b-beta');
    h.retrieveByBatchId.set('b-beta', 'ended');
    h.resultsByBatchId.set('b-beta', [succeededResult('NVDA', futureDate())]);

    const res = makeRes();
    await handler(cronReq(), res);

    expect(res.body.batches).toEqual([
      { batchId: 'b-beta', status: 'completed', storiesCreated: 1, failures: 0 },
    ]);
  });

  it('mixed poll: one processing + one ended batch → both entries truthful', async () => {
    await seedBatch('b-run');
    await seedBatch('b-wait');
    h.retrieveByBatchId.set('b-run', 'ended');
    h.retrieveByBatchId.set('b-wait', 'in_progress');
    h.resultsByBatchId.set('b-run', [succeededResult('MSFT', futureDate())]);

    const res = makeRes();
    await handler(cronReq(), res);

    const byId = Object.fromEntries(res.body.batches.map((b) => [b.batchId, b]));
    expect(byId['b-run']).toEqual({ batchId: 'b-run', status: 'completed', storiesCreated: 1, failures: 0 });
    expect(byId['b-wait']).toEqual({ batchId: 'b-wait', status: 'in_progress' });
  });
});

// ── finalStatus branches + stale guard (harness baseline) ─────────────────
describe('ended-batch outcome branches', () => {
  it('all results errored → status failed, errors recorded, no stories', async () => {
    await seedBatch('b-bad');
    h.retrieveByBatchId.set('b-bad', 'ended');
    h.resultsByBatchId.set('b-bad', [erroredResult('TSLA', futureDate())]);

    const res = makeRes();
    await handler(cronReq(), res);

    expect(storyPaths(dbRef.db)).toHaveLength(0);
    const batchDoc = dbRef.db.__dump('fantasyTimesBatches/b-bad');
    expect(batchDoc.status).toBe('failed');
    expect(batchDoc.errors).toHaveLength(1);
    expect(batchDoc.errors[0]).toMatch(/errored - model exploded/);
    expect(res.body.batches[0]).toMatchObject({ batchId: 'b-bad', status: 'failed', storiesCreated: 0, failures: 1 });
  });

  it('one success + one error → completed_with_errors', async () => {
    await seedBatch('b-mixed');
    h.retrieveByBatchId.set('b-mixed', 'ended');
    h.resultsByBatchId.set('b-mixed', [
      succeededResult('NVDA', futureDate()),
      erroredResult('TSLA', futureDate()),
    ]);

    const res = makeRes();
    await handler(cronReq(), res);

    expect(storyPaths(dbRef.db)).toHaveLength(1);
    expect(dbRef.db.__dump('fantasyTimesBatches/b-mixed').status).toBe('completed_with_errors');
    expect(res.body.batches[0]).toMatchObject({ status: 'completed_with_errors', storiesCreated: 1, failures: 1 });
  });

  it('stale preview (report date already passed) → skipped, batch still completes', async () => {
    await seedBatch('b-stale');
    h.retrieveByBatchId.set('b-stale', 'ended');
    h.resultsByBatchId.set('b-stale', [succeededResult('INTC', pastDate())]);

    const res = makeRes();
    await handler(cronReq(), res);

    expect(storyPaths(dbRef.db)).toHaveLength(0);
    expect(dbRef.db.__dump('fantasyTimesBatches/b-stale').status).toBe('completed');
    expect(res.body.batches[0]).toMatchObject({ status: 'completed', storiesCreated: 0, failures: 0 });
  });
});
