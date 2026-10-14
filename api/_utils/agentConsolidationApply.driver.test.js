// api/_utils/agentConsolidationApply.driver.test.js
//
// Reflection outage fix, part 2 (P-OUT-2, founder rulings O5 and O8) — the
// consolidation DRIVER (consolidateAgentEvolution) with the Anthropic SDK
// mocked (its REAL error classes kept, so the classifier sees what production
// sees):
//   • the driver's own floor: fewer than 3 real lessons → no call, no write,
//     one shadow line with counts;
//   • the call gets the part-1 fix: the deadline ABORTS the request and settles
//     on time; only stop_reason 'tool_use' is parsed; 'max_tokens' is named;
//   • every failure line carries the part-1 vocabulary and NO agent text;
//   • a valid answer applies exactly as before.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ create: null, calls: [] }));
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal();
  class FakeAnthropic {
    constructor() {
      this.messages = { create: (body, opts) => { sdk.calls.push({ body, opts }); return sdk.create(body, opts); } };
    }
  }
  return { ...real, default: FakeAnthropic };
});
const shadow = vi.hoisted(() => ({ lines: [] }));
vi.mock('./shadowLogger.js', () => ({
  logConsolidation: vi.fn(async (r) => { shadow.lines.push(structuredClone(r)); return true; }),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (value) => ({ __op: 'arrayUnion', value }) },
  Timestamp: { now: () => ({ toMillis: () => 1_700_000_000_000, seconds: 1_700_000_000, nanoseconds: 0 }) },
}));

const { consolidateAgentEvolution, CONSOLIDATION_TIMEOUT_MS, CONSOLIDATION_MAX_TOKENS } = await import('./agentConsolidationApply.js');
const { SUBMIT_CONSOLIDATION_TOOL } = await import('./agentConsolidationToolSchema.js');
const { APIError, InternalServerError, APIUserAbortError } = await import('@anthropic-ai/sdk');

// Planted in everything the model or the agent wrote: no failure line may carry it.
const SECRET = 'SECRET-AGENT-TEXT';

const real = (n) => ({ gameId: `g${n}`, result: 'win', score: n, opponentScore: 0, lesson: `${SECRET} lesson ${n}`, adjustment: `${SECRET} adj ${n}`, date: '2026-10-01T00:00:00.000Z' });
const legacy = (n) => ({ gameId: `l${n}`, result: 'loss', score: -n, opponentScore: 0, lesson: 'Reflection generation failed.', adjustment: 'N/A', date: '2026-10-01T00:00:00.000Z' });
const marker = (n) => ({ gameId: `m${n}`, gameMode: 'baggerbomb', result: 'loss', score: -n, opponentScore: 0, lesson: '', noLesson: true, date: '2026-10-01T00:00:00.000Z' });

const AGENT = {
  name: 'Nova', archetype: 'analyst', evolutionCycle: 0, stats: { gamesPlayed: 5 },
  consolidatedInsight: `${SECRET} prior insight`,
  lessons: [{ id: 'lesson_1', text: `${SECRET} pending`, consumed: false, consumedInConsolidation: null }],
  memory: [real(1), legacy(2), real(3), marker(4), real(5)], // 3 real lessons: at the floor
};

const VALID_OUTPUT = {
  disciplines: {
    selection: [],
    execution: [{ id: 'disc_1', statement: `${SECRET} I do not chase the final hour.`, formedInCycle: 1, reinforcedInCycles: [], confidence: 0.5, source: 'consolidation', category: 'execution' }],
  },
  consolidatedInsightText: `${SECRET} insight`,
  cycleNarrative: `${SECRET} narrative`,
  evolutionEvent: { headline: `${SECRET} headline`, narrative: `${SECRET} event narrative` },
  lessonsAbsorbed: ['lesson_1'],
  lessonsCarriedForward: [],
  cycleSummary: { cyclesCompleted: 1, keyShift: `${SECRET} shift`, confidenceLevel: 'forming' },
};
const toolResponse = (input, over = {}) => ({
  model: 'claude-sonnet-4-6',
  stop_reason: 'tool_use',
  content: [{ type: 'text', text: `${SECRET} preamble` }, { type: 'tool_use', id: 'tu_1', name: 'submit_consolidation', input }],
  usage: { input_tokens: 5_400, output_tokens: 1_600, cache_read_input_tokens: 0 },
  ...over,
});

function makeAgent(agent = AGENT) {
  const writes = [];
  const agentRef = {
    id: 'agent-1',
    path: 'agents/agent-1',
    async get() { return { exists: true, id: 'agent-1', data: () => structuredClone(agent) }; },
    async update(patch) { writes.push({ op: 'update', patch }); },
  };
  const db = {
    async runTransaction(fn) {
      return fn({
        get: async () => ({ exists: true, data: () => structuredClone(agent) }),
        update: (_ref, patch) => { writes.push({ op: 'tx.update', patch }); },
      });
    },
  };
  return { db, agentRef, writes };
}

// The only keys a failure line may carry: classes, a class name, timings, counts, the model id.
const FAILURE_LINE_KEYS = new Set(['agentId', 'success', 'reason', 'outcome', 'failureClass', 'accountWide', 'errorName', 'elapsedMs', 'stopReason', 'usage', 'model', 'durationMs', 'validationErrorCount', 'realLessons', 'totalEntries']);
function expectCleanFailureLine(line) {
  expect(line.success).toBe(false);
  for (const k of Object.keys(line)) expect(FAILURE_LINE_KEYS.has(k), `unexpected key on a failure line: ${k}`).toBe(true);
  expect(JSON.stringify(line)).not.toContain(SECRET);
}

beforeEach(() => {
  sdk.calls.length = 0;
  sdk.create = null;
  shadow.lines.length = 0;
});
afterEach(() => { vi.useRealTimers(); });

describe('the numbers (chosen by measurement; build report §3)', () => {
  it('deadline 60 s (>= 1.5 x the slowest 36.1 s call), ceiling 4,096 (>= 2 x the largest 1,655-token answer)', () => {
    expect(CONSOLIDATION_TIMEOUT_MS).toBe(60_000);
    expect(CONSOLIDATION_TIMEOUT_MS).toBeGreaterThanOrEqual(Math.ceil(1.5 * 36_078));
    expect(CONSOLIDATION_MAX_TOKENS).toBe(4096);
    expect(CONSOLIDATION_MAX_TOKENS).toBeGreaterThanOrEqual(2 * 1_655);
  });
});

describe('the driver\'s own floor (O5)', () => {
  it('fewer than 3 real lessons → no call, no write, one shadow line with the counts and no text', async () => {
    sdk.create = vi.fn(async () => toolResponse(VALID_OUTPUT));
    const { db, agentRef, writes } = makeAgent({ ...AGENT, memory: [real(1), legacy(2), marker(3), real(4)] });
    const result = await consolidateAgentEvolution(db, agentRef);
    expect(result).toEqual({ success: false, reason: 'insufficient_real_lessons' });
    expect(sdk.calls).toEqual([]);
    expect(writes).toEqual([]);
    expect(shadow.lines).toEqual([{ agentId: 'agent-1', success: false, reason: 'insufficient_real_lessons', realLessons: 2, totalEntries: 4 }]);
    expectCleanFailureLine(shadow.lines[0]);
  });

  it('exactly 3 real lessons → the call is made, with only the real lessons in the request', async () => {
    sdk.create = async () => toolResponse(VALID_OUTPUT);
    const { db, agentRef } = makeAgent();
    expect(await consolidateAgentEvolution(db, agentRef)).toEqual({ success: true });
    expect(sdk.calls).toHaveLength(1);
    const { system } = sdk.calls[0].body;
    expect(system).not.toContain('Reflection generation failed.');
    expect(system.match(/^Game \d+ /gm)).toEqual(['Game 1 ', 'Game 3 ', 'Game 5 ']);
  });
});

describe('the call — the part-1 fix (O8)', () => {
  it('sends the measured ceiling and the abort signal; a success is never aborted', async () => {
    sdk.create = async () => toolResponse(VALID_OUTPUT);
    const { db, agentRef } = makeAgent();
    await consolidateAgentEvolution(db, agentRef);
    const { body, opts } = sdk.calls[0];
    expect(body).toMatchObject({
      model: 'claude-sonnet-4-6', max_tokens: CONSOLIDATION_MAX_TOKENS, temperature: 0.3,
      thinking: { type: 'disabled' }, output_config: { effort: 'low' },
      tools: [SUBMIT_CONSOLIDATION_TOOL], tool_choice: { type: 'tool', name: 'submit_consolidation' },
    });
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(opts.signal.aborted).toBe(false);
  });

  it('the abort fires AT the deadline, not before; the result is a named timeout and nothing is written', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let seenSignal = null;
    sdk.create = (_body, opts) => new Promise((_, reject) => {
      seenSignal = opts.signal;
      opts.signal.addEventListener('abort', () => reject(new APIUserAbortError()));
    });
    const { db, agentRef, writes } = makeAgent();
    let settled = false;
    const pending = consolidateAgentEvolution(db, agentRef).then((r) => { settled = true; return r; });
    await vi.advanceTimersByTimeAsync(CONSOLIDATION_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    expect(seenSignal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(seenSignal.aborted).toBe(true); // the request is cancelled, not left running
    expect(result).toEqual({ success: false, reason: 'sonnet_call_failed' });
    expect(writes).toEqual([]);
    expect(shadow.lines).toHaveLength(1);
    expect(shadow.lines[0]).toMatchObject({
      reason: 'sonnet_call_failed', outcome: 'failed', failureClass: 'timeout', accountWide: false,
      errorName: 'ConsolidationDeadlineError', elapsedMs: CONSOLIDATION_TIMEOUT_MS, stopReason: null, usage: null, model: 'claude-sonnet-4-6',
    });
    expectCleanFailureLine(shadow.lines[0]);
  });

  it('settles at the deadline even when the SDK never observes the abort', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    sdk.create = () => new Promise(() => {});
    const { db, agentRef, writes } = makeAgent();
    const pending = consolidateAgentEvolution(db, agentRef);
    await vi.advanceTimersByTimeAsync(CONSOLIDATION_TIMEOUT_MS);
    expect(await pending).toEqual({ success: false, reason: 'sonnet_call_failed' });
    expect(writes).toEqual([]);
    expect(shadow.lines[0]).toMatchObject({ failureClass: 'timeout' });
  });

  it('an answer cut at the ceiling is max_tokens — never parsed, even with a valid tool block', async () => {
    sdk.create = async () => toolResponse(VALID_OUTPUT, { stop_reason: 'max_tokens' });
    const { db, agentRef, writes } = makeAgent();
    expect(await consolidateAgentEvolution(db, agentRef)).toEqual({ success: false, reason: 'max_tokens' });
    expect(writes).toEqual([]);
    expect(shadow.lines[0]).toMatchObject({ reason: 'max_tokens', outcome: 'failed', failureClass: 'max_tokens', stopReason: 'max_tokens', usage: { input_tokens: 5_400, output_tokens: 1_600 } });
    expectCleanFailureLine(shadow.lines[0]);
  });

  it.each(['refusal', 'end_turn', 'pause_turn', 'model_context_window_exceeded'])(
    'stop_reason %s with a valid tool block is no_tool_use — never parsed, never applied',
    async (stopReason) => {
      sdk.create = async () => toolResponse(VALID_OUTPUT, { stop_reason: stopReason });
      const { db, agentRef, writes } = makeAgent();
      expect(await consolidateAgentEvolution(db, agentRef)).toEqual({ success: false, reason: 'no_tool_use' });
      expect(writes).toEqual([]);
      expect(shadow.lines[0]).toMatchObject({ reason: 'no_tool_use', failureClass: 'no_tool_use', stopReason });
      expectCleanFailureLine(shadow.lines[0]);
    },
  );

  it('tool_use with no tool block is no_tool_use, and the response text never reaches the line', async () => {
    sdk.create = async () => ({ model: 'claude-sonnet-4-6', stop_reason: 'tool_use', content: [{ type: 'text', text: `${SECRET} only text` }], usage: { input_tokens: 1, output_tokens: 2 } });
    const { db, agentRef, writes } = makeAgent();
    expect(await consolidateAgentEvolution(db, agentRef)).toEqual({ success: false, reason: 'no_tool_use' });
    expect(writes).toEqual([]);
    expectCleanFailureLine(shadow.lines[0]);
  });

  it.each([
    ['a 529 overload', () => new InternalServerError(529, { type: 'error', error: { type: 'overloaded_error', message: `${SECRET} overloaded` } }, undefined, new Headers()), 'http_529', false, 'InternalServerError'],
    ['a 401 (account-wide)', () => APIError.generate(401, { type: 'error', error: { type: 'authentication_error', message: `${SECRET} bad key` } }, undefined, new Headers()), 'http_401', true, 'AuthenticationError'],
    ['the usage limit (account-wide)', () => APIError.generate(400, { type: 'error', error: { type: 'invalid_request_error', message: 'You have reached your specified API usage limits.' } }, undefined, new Headers()), 'http_400', true, 'BadRequestError'],
  ])('%s is sonnet_call_failed, class %s, with its error class name and never its message', async (_label, makeErr, failureClass, accountWide, errorName) => {
    sdk.create = async () => { throw makeErr(); };
    const { db, agentRef, writes } = makeAgent();
    expect(await consolidateAgentEvolution(db, agentRef)).toEqual({ success: false, reason: 'sonnet_call_failed' });
    expect(writes).toEqual([]);
    expect(shadow.lines[0]).toMatchObject({ reason: 'sonnet_call_failed', outcome: 'failed', failureClass, accountWide, errorName });
    expectCleanFailureLine(shadow.lines[0]);
  });

  it('an answer that fails validation keeps reason validation_failed; the line holds a count, not the output or the errors', async () => {
    sdk.create = async () => toolResponse({ ...VALID_OUTPUT, lessonsAbsorbed: [`${SECRET}_unknown_id`], cycleSummary: { ...VALID_OUTPUT.cycleSummary, confidenceLevel: `${SECRET}` } });
    const { db, agentRef, writes } = makeAgent();
    const result = await consolidateAgentEvolution(db, agentRef);
    expect(result).toMatchObject({ success: false, reason: 'validation_failed' });
    expect(result.errors.length).toBeGreaterThan(0); // the caller still gets the errors (console only)
    expect(writes).toEqual([]);
    expect(shadow.lines[0]).toMatchObject({ reason: 'validation_failed', outcome: 'failed', failureClass: 'missing_keys', stopReason: 'tool_use', validationErrorCount: result.errors.length });
    expectCleanFailureLine(shadow.lines[0]);
  });

  it('a Firestore apply that throws is firestore_apply_failed, class unknown, and the line holds no output', async () => {
    sdk.create = async () => toolResponse(VALID_OUTPUT);
    const { db, agentRef } = makeAgent();
    agentRef.update = async () => { const e = new Error(`${SECRET} DEADLINE_EXCEEDED`); e.name = 'FirebaseError'; throw e; };
    expect(await consolidateAgentEvolution(db, agentRef)).toEqual({ success: false, reason: 'firestore_apply_failed' });
    expect(shadow.lines[0]).toMatchObject({ reason: 'firestore_apply_failed', outcome: 'failed', failureClass: 'unknown', errorName: 'FirebaseError', stopReason: 'tool_use' });
    expectCleanFailureLine(shadow.lines[0]);
  });
});

describe('a valid answer applies exactly as before', () => {
  it('one atomic update with the same fields as applyConsolidation, and a success line with the call\'s fields', async () => {
    sdk.create = async () => toolResponse(VALID_OUTPUT);
    const { db, agentRef, writes } = makeAgent();
    expect(await consolidateAgentEvolution(db, agentRef)).toEqual({ success: true });
    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe('update');
    const patch = writes[0].patch;
    expect(Object.keys(patch).sort()).toEqual(['consolidatedInsight', 'disciplines', 'evolutionCycle', 'evolutionTimeline', 'lessons', 'pendingConsolidation', 'updatedAt']);
    expect(patch).toMatchObject({
      disciplines: VALID_OUTPUT.disciplines,
      consolidatedInsight: VALID_OUTPUT.consolidatedInsightText,
      evolutionCycle: 1,
      pendingConsolidation: false,
      lessons: [{ id: 'lesson_1', consumed: true, consumedInConsolidation: new Date(1_700_000_000_000).toISOString() }],
      evolutionTimeline: { __op: 'arrayUnion', value: expect.objectContaining({ type: 'consolidation', cycle: 1, headline: VALID_OUTPUT.evolutionEvent.headline }) },
    });
    expect(shadow.lines).toHaveLength(1);
    expect(shadow.lines[0]).toMatchObject({
      agentId: 'agent-1', success: true, cycle: 1, output: VALID_OUTPUT,
      outcome: 'ok', failureClass: null, accountWide: false, errorName: null, stopReason: 'tool_use',
      usage: { input_tokens: 5_400, output_tokens: 1_600 }, model: 'claude-sonnet-4-6',
    });
    expect(shadow.lines[0].input).toEqual({ systemPrompt: expect.any(String), userMessage: expect.any(String) });
  });

  it('the casual forward still uses the transactional apply', async () => {
    sdk.create = async () => toolResponse(VALID_OUTPUT);
    const { db, agentRef, writes } = makeAgent();
    expect(await consolidateAgentEvolution(db, agentRef, { transactionalApply: true })).toEqual({ success: true });
    expect(writes.map((w) => w.op)).toEqual(['tx.update']);
  });
});
