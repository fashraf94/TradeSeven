// api/_utils/tickCapture/captureWriter.test.js
//
// Document composition, the size cap, and the ONE atomic batch (C-1, C-4, C-9).
// Unit rows on the writer itself; the end-to-end rows drive the real cron.

import { describe, it, expect, vi } from 'vitest';
import {
  approxBytes, buildCaptureDocuments, finalizeTickCapture, resolveBodyHolder,
  sha256Hex, truncateUtf8, utf8Length, withDeadline,
} from './captureWriter.js';
import { TICK_CAPTURE_BODY_DOC_MAX_BYTES } from './captureConfig.js';
import { createTickCaptureContext, runWithTickCaptureScope } from './captureContext.js';
import {
  TICK_CAPTURE_BODY_RETENTION_DAYS, TICK_CAPTURE_DEADLINE_MS,
  TICK_CAPTURE_MIN_REMAINING_BUDGET_MS, TICK_CAPTURE_TEXT_FIELD_MAX_BYTES,
} from './captureConfig.js';

const NOW_MS = Date.UTC(2026, 8, 9, 15, 0, 0);

const EMPTY_BODY = {
  dispatched: false,
  request: { body: null, bytes: null, sha256: null, truncated: false },
  response: { body: null, bytes: null, sha256: null, truncated: false, status: null, returnedModel: null },
  copyError: null,
};

function liveState(fill = () => {}) {
  const ctx = createTickCaptureContext({ battleId: 'battle-1', tickSeq: 4, agentId: 'agent-1', enabled: true });
  ctx.universe({ heldSymbols: ['NVDA', 'KO'], benchSymbols: ['AMD'] });
  fill(ctx);
  return ctx;
}

function makeDb({ fail = null } = {}) {
  const committed = [];
  const db = {
    collection: () => ({ doc: () => ({ collection: (sub) => ({ doc: (id) => ({ path: `agentBattles/battle-1/${sub}/${id}` }) }) }) }),
    batch() {
      const staged = [];
      return {
        set(ref, data) { staged.push({ path: ref.path, data }); },
        async commit() {
          if (fail === 'throw') throw new Error('injected write failure');
          if (fail === 'hang') await new Promise(() => {});
          committed.push(staged);
        },
      };
    },
    __committed: committed,
  };
  return db;
}

describe('the two documents, and what lives in each', () => {
  it('composes both with the same tickId, and the body carries expireAt = capturedAt + 120 days (C-4)', () => {
    const ctx = liveState((c) => { c.exit('completed'); c.stage('finalized'); });
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(permanent.tickId).toBe('battle-1:4');
    expect(body.tickId).toBe('battle-1:4');
    expect(permanent.capturedAt).toBe(new Date(NOW_MS).toISOString());
    expect(body.expireAt).toBeInstanceOf(Date);
    expect(body.expireAt.getTime() - NOW_MS).toBe(TICK_CAPTURE_BODY_RETENTION_DAYS * 86_400_000);
    expect(TICK_CAPTURE_BODY_RETENTION_DAYS).toBe(120);
  });

  it('the permanent record carries NO free text — every string leaf is admissible', () => {
    const ctx = liveState((c) => {
      c.exit('completed');
      c.decision({ final: 'SWAP', finalSymbolOut: 'KO', finalSymbolIn: 'AMD' });
      c.model({ outcome: 'ok', message: 'this message is free text and belongs in the body' });
      c.guardrail({ faultClass: 'guardrail_error', message: 'sector cap breach on NVDA' });
      c.validationErrors(['AMD below haiku_decision hurdle floor (bench_negative) — swap blocked']);
    });
    const { permanent, body, freeTextPaths } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(freeTextPaths).toEqual([]);
    // the messages went to the TTL body, and ONLY there
    expect(body.faults.model).toContain('free text');
    expect(body.faults.guardrail).toBe('sector cap breach on NVDA');
    expect(JSON.stringify(permanent)).not.toContain('free text');
    expect(JSON.stringify(permanent)).not.toContain('sector cap breach');
    // but the COUNT is on the record
    expect(permanent.decision.validationErrorCount).toBe(1);
  });

  it('a NON-UNIVERSE symbol lands in the body\'s rejectedFields, not the permanent document', () => {
    const ctx = liveState((c) => { c.exit('completed'); c.decision({ final: 'SWAP', finalSymbolIn: 'TSLA' }); });
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(permanent.decision.finalSymbolIn).toBeNull();
    expect(permanent.capture.rejectedFieldCount).toBe(1);
    expect(body.rejectedFields).toEqual([{ path: 'decision.finalSymbolIn', reason: 'not_symbol', value: 'TSLA' }]);
  });

  it('the ORIGINAL decision is read by name off the pre-replacement copy', () => {
    const ctx = liveState((c) => {
      c.exit('completed');
      c.originalToolResult({ decision: 'HOLD', symbolOut: null, symbolIn: null, rationale: 'holding' });
      c.finalToolResult({ decision: 'SWAP', symbolOut: 'KO', symbolIn: 'AMD' });
      c.decision({ final: 'SWAP', finalSymbolOut: 'KO', finalSymbolIn: 'AMD', replacedByDeterministic: true });
    });
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(permanent.decision.original).toBe('HOLD');
    expect(permanent.decision.final).toBe('SWAP');
    expect(permanent.decision.replacedByDeterministic).toBe(true);
    expect(body.originalToolResult.rationale).toBe('holding');
  });

  it('every C-6 check the tick never reached defaults to `not_evaluated`, never to "passed"', () => {
    const ctx = liveState((c) => { c.exit('no_trigger'); c.check('lock', { status: 'evaluated', result: 'passed' }); });
    const { permanent } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(permanent.checks.lock).toMatchObject({ status: 'evaluated', result: 'passed' });
    expect(permanent.checks.hurdle).toMatchObject({ status: 'not_evaluated', result: null });
    expect(permanent.checks.reservation.status).toBe('not_evaluated');
  });
});

describe('the HTTP body copies, their digests and the size cap', () => {
  const holder = (over = {}) => ({
    dispatched: true,
    requestBody: '{"model":"m","messages":[]}',
    status: 200,
    responseTextPromise: Promise.resolve({ ok: true, text: '{"model":"claude-x","content":[]}' }),
    ...over,
  });

  it('records both bodies with their SHA-256, the status and the returned model', async () => {
    const facts = await resolveBodyHolder(holder());
    expect(facts.request.sha256).toBe(sha256Hex('{"model":"m","messages":[]}'));
    expect(facts.response.status).toBe(200);
    // derived from OUR OWN copied bytes, never the SDK's parsed object
    expect(facts.response.returnedModel).toBe('claude-x');
    expect(facts.copyError).toBeNull();
  });

  it('a MALFORMED response body is still captured; it simply names no model', async () => {
    const facts = await resolveBodyHolder(holder({ responseTextPromise: Promise.resolve({ ok: true, text: '{"content":[{' }) }));
    expect(facts.response.body).toBe('{"content":[{');
    expect(facts.response.sha256).toBe(sha256Hex('{"content":[{'));
    expect(facts.response.returnedModel).toBeNull();
  });

  it('a NON-2xx body is captured with its status', async () => {
    const facts = await resolveBodyHolder(holder({ status: 429, responseTextPromise: Promise.resolve({ ok: true, text: '{"type":"error"}' }) }));
    expect(facts.response.status).toBe(429);
    expect(facts.response.body).toBe('{"type":"error"}');
  });

  it('a FAILED copy is RECORDED, never reconstructed from the parsed object', async () => {
    const facts = await resolveBodyHolder(holder({ responseTextPromise: Promise.resolve({ ok: false, error: 'stream already read' }) }));
    expect(facts.response.body).toBeNull();
    expect(facts.response.sha256).toBeNull();
    expect(facts.copyError).toBe('stream already read');
  });

  it('a tick that never dispatched reports body status `skipped`, not `copy_failed`', () => {
    const ctx = liveState((c) => c.exit('no_trigger'));
    const { permanent } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(permanent.body.status).toBe('skipped');
    expect(permanent.model.dispatched).toBe(false);
  });

  it('an OVERSIZE body is truncated, marked, and its digest stays the WHOLE body\'s', async () => {
    const huge = 'x'.repeat(TICK_CAPTURE_TEXT_FIELD_MAX_BYTES + 5_000);
    const facts = await resolveBodyHolder(holder({ responseTextPromise: Promise.resolve({ ok: true, text: huge }) }));
    const ctx = liveState((c) => c.exit('completed'));
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: facts });
    expect(body.response.truncated).toBe(true);
    expect(utf8Length(body.response.body)).toBe(TICK_CAPTURE_TEXT_FIELD_MAX_BYTES);
    // THE DIGEST AND BYTE COUNT ARE THE ORIGINAL'S — a truncated copy must
    // never claim the whole body's hash.
    expect(permanent.body.responseSha256).toBe(sha256Hex(huge));
    expect(permanent.body.responseBytes).toBe(huge.length);
    expect(permanent.body.status).toBe('truncated');
    expect(permanent.body.incomplete).toBe('response_truncated');
  });

  it('truncateUtf8 never splits a code point', () => {
    const s = '€'.repeat(10);           // 3 bytes each
    const cut = truncateUtf8(s, 7);     // lands mid-character
    expect(utf8Length(cut)).toBe(6);
    expect(cut).toBe('€€');
  });
});

describe('finalizeTickCapture — the boundary', () => {
  it('writes BOTH documents in ONE batch', async () => {
    const ctx = liveState((c) => c.exit('completed'));
    const db = makeDb();
    const result = await finalizeTickCapture(db, ctx, { nowMs: NOW_MS, remainingBudgetMs: 60_000 });
    expect(result.disposition).toBe('written');
    expect(db.__committed).toHaveLength(1);
    expect(db.__committed[0].map((w) => w.path)).toEqual([
      'agentBattles/battle-1/ticks/battle-1:4',
      'agentBattles/battle-1/tickBodies/battle-1:4',
    ]);
  });

  it('a failed commit applies NEITHER document and reports `write_failed` — never throws', async () => {
    const ctx = liveState((c) => c.exit('completed'));
    const db = makeDb({ fail: 'throw' });
    const result = await finalizeTickCapture(db, ctx, { nowMs: NOW_MS, remainingBudgetMs: 60_000 });
    expect(result.disposition).toBe('write_failed');
    expect(db.__committed).toEqual([]);
  });

  it('a commit that never settles is `timed_out` — UNKNOWN, not failed (the race cannot cancel it)', async () => {
    vi.useFakeTimers();
    try {
      const ctx = liveState((c) => c.exit('completed'));
      const pending = finalizeTickCapture(makeDb({ fail: 'hang' }), ctx, { nowMs: NOW_MS, remainingBudgetMs: 60_000 });
      await vi.advanceTimersByTimeAsync(TICK_CAPTURE_DEADLINE_MS + 10);
      expect((await pending).disposition).toBe('timed_out');
    } finally { vi.useRealTimers(); }
  });

  it('below the minimum remaining budget it SKIPS — no write attempted, a countable gap', async () => {
    const ctx = liveState((c) => c.exit('completed'));
    const db = makeDb();
    const result = await finalizeTickCapture(db, ctx, {
      nowMs: NOW_MS,
      remainingBudgetMs: TICK_CAPTURE_MIN_REMAINING_BUDGET_MS - 1,
    });
    expect(result.disposition).toBe('skipped_budget');
    expect(db.__committed).toEqual([]);
    // ANTI-VACUOUS: one millisecond more of budget and the SAME context writes.
    const db2 = makeDb();
    const ok = await finalizeTickCapture(db2, ctx, { nowMs: NOW_MS, remainingBudgetMs: TICK_CAPTURE_MIN_REMAINING_BUDGET_MS });
    expect(ok.disposition).toBe('written');
    expect(db2.__committed).toHaveLength(1);
  });

  it('the NOOP context writes nothing and reports `skipped`', async () => {
    const db = makeDb();
    const result = await finalizeTickCapture(db, createTickCaptureContext({ battleId: 'b', tickSeq: 1, enabled: false }), {});
    expect(result.disposition).toBe('skipped');
    expect(db.__committed).toEqual([]);
  });

  it('the two founder-adjustable timing constants are the ones the record reports', async () => {
    const ctx = liveState((c) => c.exit('completed'));
    const db = makeDb();
    await finalizeTickCapture(db, ctx, { nowMs: NOW_MS, remainingBudgetMs: 44_000 });
    const permanent = db.__committed[0][0].data;
    expect(permanent.capture.deadlineMs).toBe(TICK_CAPTURE_DEADLINE_MS);
    expect(permanent.capture.minRemainingBudgetMs).toBe(TICK_CAPTURE_MIN_REMAINING_BUDGET_MS);
    expect(permanent.capture.remainingBudgetMs).toBe(44_000);
    expect(TICK_CAPTURE_DEADLINE_MS).toBe(3_000);
    expect(TICK_CAPTURE_MIN_REMAINING_BUDGET_MS).toBe(10_000);
  });
});

describe('F7 (Astra round 1) — ONE absolute deadline, and honest timing', () => {
  it('body resolution and the commit SHARE one budget — the worst case is the deadline, not twice it', async () => {
    vi.useFakeTimers();
    try {
      // A body read that consumes most of the deadline must leave the commit
      // only what is left. Previously each stage got a fresh full allowance.
      const ctx = liveState((c) => c.exit('completed'));
      const slowBody = new Promise((resolve) => setTimeout(() => resolve({ ok: true, text: '{}' }), TICK_CAPTURE_DEADLINE_MS - 200));
      ctx.bindBodyHolder({ dispatched: true, requestBody: '{}', status: 200, responseTextPromise: slowBody });
      const db = makeDb({ fail: 'hang' });
      // Observed rather than awaited: under two independent allowances the
      // commit is still waiting at this point, and awaiting would hang the row
      // rather than fail it.
      let settled = null;
      const pending = finalizeTickCapture(db, ctx, { nowMs: NOW_MS, remainingBudgetMs: 60_000 });
      pending.then((r) => { settled = r; });
      await vi.advanceTimersByTimeAsync(TICK_CAPTURE_DEADLINE_MS + 50);
      expect(settled, 'capture must be finished within ONE deadline, not two').not.toBeNull();
      expect(settled.disposition).toBe('timed_out');
      // drain whatever is left so no fake timer leaks into the next row
      await vi.advanceTimersByTimeAsync(TICK_CAPTURE_DEADLINE_MS * 3);
      await pending;
    } finally { vi.useRealTimers(); }
  });

  it('the recorded time is named for what it measures, and the total is reported to the caller', async () => {
    const ctx = liveState((c) => c.exit('completed'));
    const db = makeDb();
    const result = await finalizeTickCapture(db, ctx, { nowMs: NOW_MS, remainingBudgetMs: 60_000 });
    const permanent = db.__committed[0][0].data;
    // The in-document number cannot include its own commit — it is written
    // INSIDE the document being committed. So it must not be called the total.
    expect(permanent.capture).not.toHaveProperty('ms');
    expect(permanent.capture.preCommitMs).toBeGreaterThanOrEqual(0);
    // The TOTAL, which does include the commit, comes back to the caller.
    expect(result.ms).toBeGreaterThanOrEqual(0);
    expect(result.totalMs).toBeGreaterThanOrEqual(result.preCommitMs ?? 0);
  });
});

describe('F8 (Astra round 1) — the size cap covers the WHOLE body', () => {
  const oversizeControls = () => ({
    directiveText: 'D'.repeat(400_000),
    standingLeanTexts: ['L'.repeat(400_000)],
    activeRuleTemplates: ['R'.repeat(400_000)],
  });

  it('a huge CONTROLS payload is bounded — request/response are not the only text fields', async () => {
    const ctx = liveState((c) => { c.exit('completed'); c.controlsText(oversizeControls()); });
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(approxBytes(body)).toBeLessThanOrEqual(TICK_CAPTURE_BODY_DOC_MAX_BYTES);
    expect(permanent.body.incomplete).toBeTruthy();
    expect(utf8Length(body.controlsAsRendered.directiveText ?? '')).toBeLessThanOrEqual(TICK_CAPTURE_TEXT_FIELD_MAX_BYTES);
  });

  it('huge FAULT and VALIDATION text is bounded too', async () => {
    const ctx = liveState((c) => {
      c.exit('completed');
      c.model({ outcome: 'failed', failureClass: 'timeout', message: 'M'.repeat(400_000) });
      c.guardrail({ faultClass: 'guardrail_error', message: 'G'.repeat(400_000) });
      c.validationErrors(Array.from({ length: 50 }, () => 'V'.repeat(40_000)));
    });
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(approxBytes(body)).toBeLessThanOrEqual(TICK_CAPTURE_BODY_DOC_MAX_BYTES);
    expect(permanent.body.incomplete).toBeTruthy();
  });

  it('a field capped on its own says `field_capped`, and names which fields were cut', async () => {
    const ctx = liveState((c) => { c.exit('completed'); c.controlsText(oversizeControls()); });
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(body.bodyIncomplete).toBe('field_capped');
    expect(permanent.body.incomplete).toBe('field_capped');
    expect(body.shedFields).toContain('controlsAsRendered.directiveText');
    expect(body.shedFields).toContain('controlsAsRendered.standingLeanTexts');
  });

  it('a document still over the cap AFTER field capping sheds in the DECLARED order and says `doc_budget`', async () => {
    // Twelve capped fields still add up past the document cap, so the shed
    // order has to run — largest-value guesswork is not the mechanism; a
    // declared order is, and it stops the moment the document fits.
    const many = {};
    for (let i = 0; i < 12; i++) many[`leanText${i}`] = 'L'.repeat(200_000);
    const ctx = liveState((c) => {
      c.exit('completed');
      c.controlsText(many);
      c.originalToolResult({ rationale: 'O'.repeat(200_000) });
      c.finalToolResult({ rationale: 'F'.repeat(200_000) });
    });
    const { permanent, body } = buildCaptureDocuments(ctx.state, { nowMs: NOW_MS, bodyFacts: EMPTY_BODY });
    expect(approxBytes(body)).toBeLessThanOrEqual(TICK_CAPTURE_BODY_DOC_MAX_BYTES);
    expect(permanent.body.incomplete).toBe('doc_budget');
    expect(body.shedFields).toContain('controlsAsRendered');
    // the EARLIER steps of the declared order went first
    expect(body.shedFields.indexOf('originalToolResult')).toBeLessThan(body.shedFields.indexOf('controlsAsRendered'));
  });

  it('an oversize document never reaches the batch over the cap', async () => {
    const ctx = liveState((c) => { c.exit('completed'); c.controlsText(oversizeControls()); });
    const db = makeDb();
    const result = await finalizeTickCapture(db, ctx, { nowMs: NOW_MS, remainingBudgetMs: 60_000 });
    expect(result.disposition).toBe('written');
    for (const write of db.__committed[0]) {
      expect(approxBytes(write.data)).toBeLessThanOrEqual(TICK_CAPTURE_BODY_DOC_MAX_BYTES);
    }
  });
});

describe('F9 (Astra round 1) — the digest is of the RECEIVED BYTES', () => {
  it('a body with a UTF-8 BOM hashes its bytes, not the decoded string', async () => {
    const { sha256Bytes } = await import('./captureWriter.js');
    const raw = new Uint8Array([0xEF, 0xBB, 0xBF, 0x7B, 0x7D]);   // BOM + "{}"
    // `.text()` strips the BOM; a digest taken after decoding therefore
    // describes something the wire never carried.
    const decoded = new TextDecoder('utf-8').decode(raw);
    expect(decoded).toBe('{}');
    expect(sha256Bytes(raw)).not.toBe(sha256Hex(decoded));

    const facts = await resolveBodyHolder({
      dispatched: true, requestBody: '{}', status: 200,
      responseTextPromise: Promise.resolve({ ok: true, bytes: raw, text: decoded }),
    });
    expect(facts.response.sha256).toBe(sha256Bytes(raw));
    expect(facts.response.bytes).toBe(raw.length);
    expect(facts.response.body).toBe(decoded);      // storage stays readable text
  });
});

describe('helpers', () => {
  it('withDeadline clears its timer on the winning path', async () => {
    await expect(withDeadline(Promise.resolve('ok'), 50, 'x')).resolves.toBe('ok');
    await expect(withDeadline(new Promise(() => {}), 5, 'x')).rejects.toThrow('x_timeout_5ms');
  });
  it('approxBytes survives a value it cannot serialize', () => {
    const cyclic = {}; cyclic.self = cyclic;
    expect(approxBytes(cyclic)).toBe(0);
  });
});
