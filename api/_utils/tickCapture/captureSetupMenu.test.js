// api/_utils/tickCapture/captureSetupMenu.test.js
//
// Measured Trend Evidence Slice 2 — the optional `setupMenu` block on the permanent record (spec V2
// §5; the kickoff's Correction C). The writer composes, sanitizes and sheds the BASE record exactly as
// it would without the block, then admits the block in its own pass: the whole permanent record with
// it must fit the existing budget, else the minimal error form, else nothing. A block the sanitizer
// would reject is contained as the error form — never the body's `rejectedFields`, never the shared
// fault text. The context's setter is inert on the NOOP and never writes `faulted`.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCaptureDocuments, admitOptionalSetupMenu, approxBytes, resolveBodyHolder, finalizeTickCapture } from './captureWriter.js';
import { createTickCaptureContext, NOOP_TICK_CAPTURE, runWithTickCaptureScope } from './captureContext.js';
import { buildUniverse, findFreeText } from './captureSerializer.js';
import { TICK_CAPTURE_BODY_DOC_MAX_BYTES, TICK_CAPTURE_DEADLINE_MS } from './captureConfig.js';
import { composeSetupMenuBlock } from '../setupMenuLabels/compose.js';
import { candidatesOf } from '../setupMenuLabels/pool.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';

const NOW = Date.parse('2026-09-09T15:00:05.000Z');
const FROZEN = Date.parse('2026-09-09T15:00:00.000Z');
const SYMBOLS = ['AAPL', 'BRK.B', 'BRK-B', 'RDS-A', 'MSFT'];

/** A live context with a few ordinary facts, and (optionally) a request body of `bodyBytes`. */
async function tick({ block = undefined, requestBytes = 0 } = {}) {
  return runWithTickCaptureScope(async () => {
    const ctx = createTickCaptureContext({ battleId: 'battle-1', tickSeq: 7, agentId: 'agent-1', ownerId: 'owner-1', enabled: true });
    ctx.identify({ evalId: 'eval_007', day: 1, battlePhase: 'live' });
    ctx.universe({ heldSymbols: ['NVDA'], benchSymbols: ['AMD'], candidateSymbols: SYMBOLS });
    ctx.decision({ original: 'HOLD', final: 'HOLD' });
    ctx.exit('no_trigger');
    if (requestBytes > 0) ctx.bindBodyHolder({ dispatched: true, requestBody: 'x'.repeat(requestBytes), responseTextPromise: Promise.resolve({ ok: true, text: '{"model":"m"}' }), status: 200 });
    if (block !== undefined) ctx.setupMenu(block);
    return ctx;
  });
}

async function docs(ctx, opts = {}) {
  const bodyFacts = await resolveBodyHolder(ctx.state.bodyHolder);
  return buildCaptureDocuments(ctx.state, { nowMs: NOW, bodyFacts, timingAtComposition: () => ({ preCommitMs: 12, bodyMs: 3 }), ...opts });
}
const withoutBlock = (permanent) => { const { setupMenu, ...rest } = permanent; return rest; };

function blockOf(hot = SYMBOLS, results = {}) {
  const ruleSet = describeRuleSet();
  const pool = {
    session: '2026-09-08', calendarMissing: false, ruleSet, selector: 'carried', rebuilt: false, frozenAtMs: FROZEN,
    list: candidatesOf({ hotBenchSymbols: hot, assetMapKeys: [], benchAtFreeze: ['AAPL'], heldAtFreeze: [], classify: (s) => (s.includes('.') ? 'symbol_form' : null) }),
  };
  return composeSetupMenuBlock(pool, { readsStartedAtMs: FROZEN + 1, observedAtMs: FROZEN + 900, stateRead: false, stateBySymbol: new Map(), results: new Map(Object.entries(results)), readsIssued: 3, readsShared: 0 });
}

describe('absent unless set (row 5.8 at the writer)', () => {
  it('F4 a null block is the omission the composer returns: the key is removed and the record has no block', async () => {
    const ctx = await tick({ block: blockOf() });
    expect(Object.hasOwn(ctx.state, 'setupMenu')).toBe(true);
    ctx.setupMenu(null);
    expect(Object.hasOwn(ctx.state, 'setupMenu')).toBe(false);
    expect(Object.hasOwn((await docs(ctx)).permanent, 'setupMenu')).toBe(false);
    expect(ctx.state.faulted).toBeNull();
  });
  it('a tick that set no block has no `setupMenu` key and no state key', async () => {
    const ctx = await tick();
    expect(Object.hasOwn(ctx.state, 'setupMenu')).toBe(false);
    expect(Object.hasOwn((await docs(ctx)).permanent, 'setupMenu')).toBe(false);
  });
  it('1.6 capture off: the NOOP has the method, it does nothing, and the NOOP stays frozen', () => {
    expect(typeof NOOP_TICK_CAPTURE.setupMenu).toBe('function');
    expect(NOOP_TICK_CAPTURE.setupMenu(blockOf())).toBeUndefined();
    expect(Object.isFrozen(NOOP_TICK_CAPTURE)).toBe(true);
    expect(NOOP_TICK_CAPTURE.enabled).toBe(false);
  });
});

describe('admitted whole, the base record untouched (rows 5.3, 5.6)', () => {
  it('a valid block (dotted symbols as values) is attached as composed; every other field equals the no-block record, the body is identical, nothing rejected', async () => {
    const block = blockOf(SYMBOLS, { AAPL: { ok: true, value: null }, 'BRK-B': { ok: true, value: null } });
    const plain = await docs(await tick());
    const withBlock = await docs(await tick({ block }));
    expect(withBlock.permanent.setupMenu).toEqual(block);
    expect(withBlock.permanent.setupMenu.candidates.map((c) => c.symbol)).toEqual(SYMBOLS);
    expect(withoutBlock(withBlock.permanent)).toEqual(plain.permanent);
    expect(withBlock.body).toEqual(plain.body);
    expect(withBlock.rejected).toEqual([]);
    expect(withBlock.freeTextPaths).toEqual([]);
    expect(findFreeText(withBlock.permanent, { universe: buildUniverse({ heldSymbols: ['NVDA'], benchSymbols: ['AMD'], candidateSymbols: SYMBOLS }) })).toEqual([]);
    // Ordinary timing observations unchanged.
    expect(withBlock.permanent.capture).toEqual(plain.permanent.capture);
  });
});

describe('Correction C — the whole record\'s budget decides', () => {
  it('C-2 a permanent record close to its budget: the block does not fit and is DROPPED — the base record and body exactly as without it', async () => {
    const block = blockOf();
    const plain = await docs(await tick());
    const budget = Math.max(approxBytes(plain.permanent), approxBytes(plain.body)) + 40; // room for nothing but a sliver
    const near = await docs(await tick({ block }), { maxDocBytes: budget });
    const nearPlain = await docs(await tick(), { maxDocBytes: budget });
    expect(Object.hasOwn(near.permanent, 'setupMenu')).toBe(false);
    expect(near.permanent).toEqual(nearPlain.permanent);
    expect(near.body).toEqual(nearPlain.body);
  });
  it('C-2 with room for the error form but not the block: the minimal error form `record_budget`, still within the budget', async () => {
    const block = blockOf();
    const plain = await docs(await tick());
    const budget = approxBytes(plain.permanent) + 300;
    expect(approxBytes(plain.body)).toBeLessThanOrEqual(budget);
    const near = await docs(await tick({ block }), { maxDocBytes: budget });
    expect(near.permanent.setupMenu).toMatchObject({ blockStatus: 'error', errorCode: 'record_budget', session: '2026-09-08' });
    expect(near.permanent.setupMenu.candidates).toBeUndefined();
    expect(approxBytes(near.permanent)).toBeLessThanOrEqual(budget);
    expect(withoutBlock(near.permanent)).toEqual((await docs(await tick(), { maxDocBytes: budget })).permanent);
  });
  it('C-3 a normal body near the budget is NEVER shed to keep the block: the body is as without it, and the block yields', async () => {
    const block = blockOf();
    const base = await docs(await tick({ requestBytes: 4_000 }));
    // The body fits; the permanent record plus the block would not.
    const budget = approxBytes(base.body) + 10;
    expect(approxBytes(base.permanent) + approxBytes(block)).toBeGreaterThan(budget);
    const plain = await docs(await tick({ requestBytes: 4_000 }), { maxDocBytes: budget });
    const withBlock = await docs(await tick({ requestBytes: 4_000, block }), { maxDocBytes: budget });
    expect(plain.body.shedFields).toBeUndefined();
    expect(withBlock.body).toEqual(plain.body);
    expect(withBlock.permanent.body).toEqual(plain.permanent.body);
    expect(withBlock.permanent.setupMenu?.candidates).toBeUndefined();
  });
  it('C-3 the same body with the real budget keeps the block and sheds nothing', async () => {
    const block = blockOf();
    const withBlock = await docs(await tick({ requestBytes: 4_000, block }));
    expect(withBlock.permanent.setupMenu).toEqual(block);
    expect(withBlock.body.shedFields).toBeUndefined();
    expect(TICK_CAPTURE_BODY_DOC_MAX_BYTES).toBe(700 * 1024); // the budget is the existing one, unchanged
  });
});

describe('review SM2-1 — the block yields near the capture deadline', () => {
  it('past its admission instant the block is omitted unexamined; the base record is as without it', async () => {
    const block = blockOf();
    const plain = await docs(await tick());
    const late = await docs(await tick({ block }), { optionalBlockNotAfterMs: Date.now() - 1 });
    expect(Object.hasOwn(late.permanent, 'setupMenu')).toBe(false);
    expect(late.permanent).toEqual(plain.permanent);
    expect(late.body).toEqual(plain.body);
    const inTime = await docs(await tick({ block }), { optionalBlockNotAfterMs: Date.now() + 60_000 });
    expect(inTime.permanent.setupMenu).toEqual(block);
  });
  it('finalizeTickCapture passes the margin: the shared deadline minus OPTIONAL_BLOCK_DEADLINE_MARGIN_MS', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('./captureWriter.js', import.meta.url), 'utf8');
    expect(src).toMatch(/optionalBlockNotAfterMs: deadlineAt - OPTIONAL_BLOCK_DEADLINE_MARGIN_MS,/);
    const { OPTIONAL_BLOCK_DEADLINE_MARGIN_MS } = await import('./captureWriter.js');
    expect(OPTIONAL_BLOCK_DEADLINE_MARGIN_MS).toBe(1_000);
  });
});

describe('Correction C — malformed and error-form blocks are contained locally', () => {
  it('C-4 a block the sanitizer would reject (a symbol outside the tick\'s universe; an unknown enum) becomes the error form `block_rejected` — never rejectedFields, never the rejected count', async () => {
    const plain = await docs(await tick());
    const good = blockOf();
    for (const bad of [
      { ...good, candidates: [{ ...good.candidates[0], symbol: 'NOTMINE' }] },
      { ...good, blockStatus: 'great' },
      { ...good, extra: 'free text' },
      { ...good, candidates: 'not an array' },
    ]) {
      const out = await docs(await tick({ block: bad }));
      expect(out.permanent.setupMenu).toMatchObject({ blockStatus: 'error', errorCode: 'block_rejected' });
      expect(out.body.rejectedFields).toEqual([]);
      expect(out.permanent.capture.rejectedFieldCount).toBe(0);
      expect(out.rejected).toEqual([]);
      expect(out.body).toEqual(plain.body);
      expect(withoutBlock(out.permanent)).toEqual(plain.permanent);
    }
  });
  it('C-4 identity fields that are themselves malformed: the two-field error form', () => {
    const permanent = { tickId: 'x' };
    expect(admitOptionalSetupMenu(permanent, { blockStatus: 'nope', session: 'has a space' }, { universe: new Set(), maxDocBytes: 10_000 })).toBe('error_form');
    expect(permanent.setupMenu).toEqual({ blockStatus: 'error', errorCode: 'block_rejected' });
  });
  it('C-5 the error fallback itself (the composer threw): admitted, and the record minus it equals the plain record (rows 1.7, 5.5)', async () => {
    const pool = { session: '2026-09-08', ruleSet: describeRuleSet(), frozenAtMs: FROZEN, list: { get candidates() { throw new Error('boom'); } } };
    const errorBlock = composeSetupMenuBlock(pool, null);
    expect(errorBlock).toMatchObject({ blockStatus: 'error', errorCode: 'compose_failed' });
    const plain = await docs(await tick());
    const out = await docs(await tick({ block: errorBlock }));
    expect(out.permanent.setupMenu).toEqual(errorBlock);
    expect(withoutBlock(out.permanent)).toEqual(plain.permanent);
    expect(out.body).toEqual(plain.body);
    expect(out.body.faults.capture).toBeNull();
  });
  it('a non-object block is no block', () => {
    for (const v of [null, undefined, 'x', 7, []]) {
      const p = {};
      expect(admitOptionalSetupMenu(p, v, {})).toBe('absent');
      expect(p).toEqual({});
    }
  });
});

describe('the context setter never writes the shared fault text', () => {
  it('a block is set (last call wins); a non-object is ignored; null (the omission, F4) removes it; `faulted` stays null', async () => {
    const ctx = await tick();
    const a = blockOf(['AAPL']);
    const b = blockOf(['MSFT']);
    ctx.setupMenu(a);
    ctx.setupMenu(b);
    ctx.setupMenu('text');
    ctx.setupMenu(undefined);
    ctx.setupMenu([b]);
    expect(ctx.state.setupMenu).toBe(b);
    ctx.setupMenu(null);
    expect(Object.hasOwn(ctx.state, 'setupMenu')).toBe(false);
    expect(ctx.state.faulted).toBeNull();
  });
});

// ---------------------------------------------------------------- correction round D1 (Astra's review of 4e99b1f8)
// SIMULATED CLOCK — an ordering counterexample, not a performance benchmark. The fake clock is moved by hand at the
// real admission boundary: the base record is composed with `remaining` ms of the capture deadline left, the optional
// block's admission costs 20 ms (charged the first time the sanitizer reads it), and the commit takes `commitMs`.
// The base cost is identical in both runs. Rows "(Astra)" are Astra's supplied counterexample
// (evidence/deadline.counterexample.test.js, SHA-256 fc49b383…), adapted; they PASS on the reviewed code too: they
// document what the reserve does not promise, which is what D1 corrects in the wording (captureWriter.js).
describe('D1 — the 1 s reserve reduces the deadline risk; it does not remove it (simulated clock)', () => {
  const T0 = Date.parse('2026-09-09T15:00:00Z');
  afterEach(() => vi.useRealTimers());
  async function capture({ optional, remaining = 1010, commitMs = 1000 }) {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    let optionalWork = 0;
    let landed = false;
    const staged = [];
    const ctx = runWithTickCaptureScope(() => createTickCaptureContext({ battleId: 'b1', tickSeq: 1, enabled: true }));
    ctx.exit('no_trigger');
    const block = { blockStatus: 'error', get errorCode() { if (optionalWork === 0) { optionalWork = 20; vi.setSystemTime(Date.now() + 20); } return 'compose_failed'; } };
    // Read once the base record is composed: the clock then stands `remaining` ms before the capture deadline.
    Object.defineProperty(ctx.state, 'setupMenu', { get() { vi.setSystemTime(T0 + TICK_CAPTURE_DEADLINE_MS - remaining); return optional ? block : undefined; } });
    const ref = { collection: () => ({ doc: () => ({}) }) };
    const db = { collection: () => ({ doc: () => ref }), batch: () => ({ set: (_ref, doc) => staged.push(doc), commit: () => new Promise((resolve) => setTimeout(() => { landed = true; resolve(); }, commitMs)) }) };
    const promise = finalizeTickCapture(db, ctx, { remainingBudgetMs: 20_000 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(commitMs);
    const result = await promise;
    vi.useRealTimers();
    return { disposition: result.disposition, optionalWork, attached: Boolean(staged[0]?.setupMenu), landed };
  }
  it('D1 (Astra) 1,010 ms left, 20 ms of optional work, a 1,000 ms commit: the base record is written; with the block it is timed_out', async () => {
    expect(TICK_CAPTURE_DEADLINE_MS).toBe(3_000); // the deadline is not enlarged
    expect(await capture({ optional: false })).toEqual({ disposition: 'written', optionalWork: 0, attached: false, landed: true });
    const optional = await capture({ optional: true });
    expect(optional).toMatchObject({ disposition: 'timed_out', optionalWork: 20, attached: true });
    // A timeout is not proof that the commit never landed: here it landed after the deadline.
    expect(optional.landed).toBe(true);
  });
  it('control (Astra): below the 1,000 ms reserve the block is dropped unexamined — no optional work, no block', async () => {
    expect(await capture({ optional: true, remaining: 999, commitMs: 500 })).toEqual({ disposition: 'written', optionalWork: 0, attached: false, landed: true });
  });
  it('control (Astra): a faster commit is written with the same optional cost', async () => {
    expect(await capture({ optional: true, commitMs: 500 })).toEqual({ disposition: 'written', optionalWork: 20, attached: true, landed: true });
  });
});
