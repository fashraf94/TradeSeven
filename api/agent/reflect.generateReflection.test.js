// api/agent/reflect.generateReflection.test.js
//
// Reflection outage fix (package P-OUT-1, founder rulings O1–O4) — the unit
// battery for generateReflection with the Anthropic SDK mocked (the SDK's REAL
// error classes are kept, so the classifier sees what production sees).
// Root cause: docs/audits/20261010_PHASE0_REFLECTION_OUTAGE_ROOT_CAUSE.md R1–R3.
//
//   • every failure class — timeout, token-ceiling cut, no tool call, missing
//     key, HTTP error, connection error — comes back NAMED, and writes no
//     memory entry, no feedback document, and runs no consolidation gate;
//   • the deadline ABORTS the request and settles on time even when the SDK
//     never observes the abort (a retry backoff);
//   • a valid answer writes the memory entry exactly as before;
//   • the casual-clone forward obeys the same rules;
//   • the request no longer asks for the game-design questionnaire.

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
vi.mock('../_utils/shadowLogger.js', () => ({
  logReflection: vi.fn(async (r) => { shadow.lines.push(structuredClone(r)); return true; }),
}));
const consolidation = vi.hoisted(() => ({ calls: [] }));
vi.mock('../_utils/agentConsolidationApply.js', () => ({
  consolidateAgentEvolution: vi.fn(async (...args) => { consolidation.calls.push(args); return { success: true }; }),
}));

const { generateReflection } = await import('./reflect.js');
const { REFLECTION_TOOL, buildReflectionSystemPrompt, buildReflectionUserMessage } = await import('../_utils/agentReflectionUtils.js');
const { REFLECTION_TIMEOUT_MS, REFLECTION_MAX_TOKENS, REFLECTION_MODEL } = await import('../_utils/reflectionOutcome.js');
const { InternalServerError, RateLimitError, APIConnectionError, APIUserAbortError } = await import('@anthropic-ai/sdk');

// ── an in-memory Firestore that records EVERY write, including collection.add ──
function makeDb(seed) {
  const store = new Map(Object.entries(seed).map(([p, d]) => [p, structuredClone(d)]));
  const writes = [];
  const snapOf = (path) => {
    const has = store.has(path);
    return { exists: has, id: path.split('/').pop(), data: () => (has ? structuredClone(store.get(path)) : undefined) };
  };
  const apply = (path, patch) => {
    if (!store.has(path)) throw new Error(`NOT_FOUND ${path}`);
    store.set(path, { ...store.get(path), ...structuredClone(patch) });
  };
  const refOf = (path) => ({
    path,
    id: path.split('/').pop(),
    async get() { return snapOf(path); },
    async update(patch) { writes.push({ op: 'update', path, data: structuredClone(patch) }); apply(path, patch); },
    async set(data) { writes.push({ op: 'set', path, data: structuredClone(data) }); store.set(path, structuredClone(data)); },
  });
  const collOf = (cpath) => ({
    doc: (id) => refOf(`${cpath}/${id}`),
    async add(data) {
      const path = `${cpath}/auto-${writes.length}`;
      writes.push({ op: 'add', path, data: structuredClone(data) });
      store.set(path, structuredClone(data));
      return refOf(path);
    },
  });
  const db = {
    collection: collOf,
    async runTransaction(fn) {
      const staged = [];
      const result = await fn({
        get: async (ref) => snapOf(ref.path),
        update: (ref, patch) => { staged.push([ref.path, patch]); },
      });
      for (const [path, patch] of staged) { writes.push({ op: 'tx.update', path, data: structuredClone(patch) }); apply(path, patch); }
      return result;
    },
  };
  return { db, store, writes };
}

const BATTLE_ID = 'battle-1';
const AGENT_ID = 'agent-1';
const priorMemory = (n) => Array.from({ length: n }, (_, i) => ({
  gameId: `old-${i}`, gameMode: 'baggerbomb', result: 'win', score: i, opponentScore: 0,
  lesson: `old lesson ${i}`, adjustment: 'a', hypothesisGrades: [], confidenceCalibration: 'c', date: '2026-09-01T00:00:00.000Z',
}));
const BATTLE = {
  status: 'completed', agentId: AGENT_ID, ownerId: 'owner-1', gameMode: 'baggerbomb_tournament', duration: 'fullday',
  scoreState: { currentScore: 12.345, opponentScore: 0 },
  evaluations: [{ evalId: 'e1', timestamp: '2026-10-09T14:00:00Z', decision: 'HOLD', conviction: 6, hypothesis: 'NVDA keeps leading' }],
  trades: [], statusFeed: [], chatExchanges: [],
};
const AGENT = { name: 'Nova', archetype: 'analyst', ownerId: 'owner-1', stats: { gamesPlayed: 3 }, memory: priorMemory(5) };
const seed = ({ battle = BATTLE, agent = AGENT, extra = {} } = {}) => makeDb({
  [`agentBattles/${BATTLE_ID}`]: battle,
  [`agents/${AGENT_ID}`]: agent,
  ...extra,
});

const VALID_SELF_REFLECTION = {
  lesson: 'Conviction without a stop cost me the afternoon.',
  adjustment: 'Set a trailing stop on the star slot.',
  hypothesisGrades: [{ hypothesis: 'NVDA keeps leading', grade: 'correct', reason: 'It led all session.' }],
  confidenceCalibration: 'Slightly overconfident.',
};
const toolResponse = (input, over = {}) => ({
  model: 'claude-sonnet-4-6',
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_reflection', input }],
  usage: { input_tokens: 3_800, output_tokens: 900 },
  ...over,
});

// The writes no failure may ever make.
const memoryWrites = (writes) => writes.filter((w) => w.path.startsWith('agents/'));
const feedbackWrites = (writes) => writes.filter((w) => w.path.startsWith('gameDesignFeedback/'));

beforeEach(() => {
  sdk.calls.length = 0;
  sdk.create = null;
  shadow.lines.length = 0;
  consolidation.calls.length = 0;
});
afterEach(() => { vi.useRealTimers(); });

function expectNamedFailure(result, writes, failureClass) {
  expect(result.outcome).toBe('failed');
  expect(result.record).toMatchObject({ outcome: 'failed', failureClass, attempt: expect.any(Number) });
  expect(memoryWrites(writes)).toEqual([]);   // no memory entry — never a fake lesson
  expect(feedbackWrites(writes)).toEqual([]); // no feedback document
  expect(writes).toEqual([]);                 // nothing at all
  expect(consolidation.calls).toEqual([]);    // the consolidation gate never ran
  expect(shadow.lines).toHaveLength(1);
  expect(shadow.lines[0]).toMatchObject({ outcome: 'failed', failureClass, selfReflection: null });
}

describe('the deadline — a timeout is named, cancels the request, and settles on time', () => {
  it('the abort signal fires at the deadline; the result is a named timeout with no writes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let seenSignal = null;
    sdk.create = (_body, opts) => new Promise((_, reject) => {
      seenSignal = opts.signal;
      opts.signal.addEventListener('abort', () => reject(new APIUserAbortError()));
    });
    const { db, writes } = seed();
    let settled = false;
    const pending = generateReflection(db, BATTLE_ID, { attempt: 2 }).then((r) => { settled = true; return r; });
    await vi.advanceTimersByTimeAsync(REFLECTION_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    expect(seenSignal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(seenSignal.aborted).toBe(true); // the request is cancelled, not left running
    expectNamedFailure(result, writes, 'timeout');
    expect(result.record).toMatchObject({ elapsedMs: REFLECTION_TIMEOUT_MS, stopReason: null, usage: null, model: REFLECTION_MODEL, attempt: 2 });
    expect(result.record.errorName).toBe('ReflectionDeadlineError');
  });

  it('settles at the deadline even when the SDK never observes the abort (a retry backoff)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    sdk.create = () => new Promise(() => {}); // ignores the signal entirely
    const { db, writes } = seed();
    const pending = generateReflection(db, BATTLE_ID);
    await vi.advanceTimersByTimeAsync(REFLECTION_TIMEOUT_MS);
    const result = await pending;
    expectNamedFailure(result, writes, 'timeout');
  });
});

describe('every other failure class is named and writes nothing', () => {
  it('a response cut at the token ceiling is max_tokens — NEVER parsed, even with a lesson in the partial input', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION }, { stop_reason: 'max_tokens' });
    const { db, writes } = seed();
    const result = await generateReflection(db, BATTLE_ID);
    expectNamedFailure(result, writes, 'max_tokens');
    expect(result.record).toMatchObject({ stopReason: 'max_tokens', usage: { input_tokens: 3_800, output_tokens: 900 }, errorName: null });
  });

  it.each(['refusal', 'end_turn', 'pause_turn', 'model_context_window_exceeded'])(
    'stop_reason %s is not a completed tool call: no_tool_use, never parsed, even with a lesson in the block (review RV-1)',
    async (stopReason) => {
      sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION }, { stop_reason: stopReason });
      const { db, writes } = seed();
      const result = await generateReflection(db, BATTLE_ID);
      expectNamedFailure(result, writes, 'no_tool_use');
      expect(result.record.stopReason).toBe(stopReason);
    },
  );

  it('no tool call is no_tool_use', async () => {
    sdk.create = async () => ({ model: 'claude-sonnet-4-6', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here is my reflection.' }], usage: { input_tokens: 10, output_tokens: 5 } });
    const { db, writes } = seed();
    expectNamedFailure(await generateReflection(db, BATTLE_ID), writes, 'no_tool_use');
  });

  it.each([
    ['an empty input', {}],
    ['a game-design-only input', { gameDesignFeedback: { wouldPlayAgain: true } }],
    ['a selfReflection with no lesson', { selfReflection: { ...VALID_SELF_REFLECTION, lesson: undefined } }],
    ['a selfReflection with a blank lesson', { selfReflection: { ...VALID_SELF_REFLECTION, lesson: '   ' } }],
  ])('%s is missing_keys', async (_label, input) => {
    sdk.create = async () => toolResponse(input);
    const { db, writes } = seed();
    expectNamedFailure(await generateReflection(db, BATTLE_ID), writes, 'missing_keys');
  });

  it.each([
    ['a 529 overload', 'http_529', 'InternalServerError', () => new InternalServerError(529, { type: 'error', error: { type: 'overloaded_error' } }, 'overloaded', new Headers())],
    ['a 429 rate limit', 'http_429', 'RateLimitError', () => new RateLimitError(429, { type: 'error' }, 'rate', new Headers())],
    ['a connection error', 'connection', 'APIConnectionError', () => new APIConnectionError({ message: 'socket hang up' })],
    ['an unclassifiable throw', 'unknown', 'TypeError', () => new TypeError('boom')],
  ])('%s is named %s with its error class (%s)', async (_label, failureClass, errorName, makeErr) => {
    sdk.create = async () => { throw makeErr(); };
    const { db, writes } = seed();
    const result = await generateReflection(db, BATTLE_ID);
    expectNamedFailure(result, writes, failureClass);
    expect(result.record.errorName).toBe(errorName);
  });

  it('a failure at a 5-game milestone runs NO consolidation and burns no milestone', async () => {
    sdk.create = async () => { throw new InternalServerError(500, {}, 'x', new Headers()); };
    const { db, writes, store } = seed({ agent: { ...AGENT, stats: { gamesPlayed: 5 } } });
    const result = await generateReflection(db, BATTLE_ID);
    expectNamedFailure(result, writes, 'http_500');
    expect(store.get(`agents/${AGENT_ID}`)).not.toHaveProperty('lastConsolidatedGamesPlayed');
    expect(store.get(`agents/${AGENT_ID}`)).not.toHaveProperty('pendingConsolidation');
  });

  it('a memory write that throws after a valid answer is a failed attempt (class unknown), never a silent success', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION });
    const { db, writes } = seed({ agent: { ...AGENT, stats: { gamesPlayed: 5 } } });
    const realCollection = db.collection;
    db.collection = (name) => {
      const c = realCollection(name);
      if (name !== 'agents') return c;
      return { ...c, doc: (id) => ({ ...c.doc(id), update: async () => { const e = new Error('DEADLINE_EXCEEDED'); e.name = 'FirebaseError'; throw e; } }) };
    };
    const result = await generateReflection(db, BATTLE_ID);
    expect(result).toMatchObject({ outcome: 'failed', record: { failureClass: 'unknown', errorName: 'FirebaseError', stopReason: 'tool_use' } });
    expect(writes).toEqual([]);
    expect(consolidation.calls).toEqual([]);
    expect(shadow.lines[0]).toMatchObject({ outcome: 'failed', selfReflection: null });
  });
});

describe('a valid answer writes memory exactly as before', () => {
  it('appends the same entry shape to the rolling five-game window, records ok, and writes no feedback document', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION, gameDesignFeedback: { wouldPlayAgain: true } });
    const { db, writes, store } = seed();
    const result = await generateReflection(db, BATTLE_ID, { attempt: 3 });

    expect(result.outcome).toBe('ok');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: 'update', path: `agents/${AGENT_ID}` });
    const memory = store.get(`agents/${AGENT_ID}`).memory;
    expect(memory).toHaveLength(5);
    expect(memory.slice(0, 4)).toEqual(priorMemory(5).slice(-4)); // keep the last 4 + the new one
    expect(memory[4]).toEqual({
      gameId: BATTLE_ID,
      gameMode: 'baggerbomb_tournament',
      result: 'win',
      score: 12.35,
      opponentScore: 0,
      lesson: VALID_SELF_REFLECTION.lesson,
      adjustment: VALID_SELF_REFLECTION.adjustment,
      hypothesisGrades: VALID_SELF_REFLECTION.hypothesisGrades,
      confidenceCalibration: VALID_SELF_REFLECTION.confidenceCalibration,
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(feedbackWrites(writes)).toEqual([]);

    expect(result.record).toEqual({
      outcome: 'ok', failureClass: null, errorName: null,
      elapsedMs: expect.any(Number), stopReason: 'tool_use',
      usage: { input_tokens: 3_800, output_tokens: 900 }, model: 'claude-sonnet-4-6',
      attempt: 3, at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    // The shadow line mirrors the record and carries the lesson on a success only.
    expect(shadow.lines).toHaveLength(1);
    expect(shadow.lines[0]).toMatchObject({ ...result.record, selfReflection: VALID_SELF_REFLECTION, battleId: BATTLE_ID });
    expect(shadow.lines[0]).not.toHaveProperty('gameDesignFeedback');
  });

  it('sends the smaller request: the measured ceiling, the abort signal, the self-reflection-only tool', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION });
    const { db } = seed();
    await generateReflection(db, BATTLE_ID);
    expect(sdk.calls).toHaveLength(1);
    const { body, opts } = sdk.calls[0];
    expect(body).toMatchObject({
      model: 'claude-sonnet-4-6', max_tokens: REFLECTION_MAX_TOKENS, temperature: 0.3,
      thinking: { type: 'disabled' }, output_config: { effort: 'low' },
      tools: [REFLECTION_TOOL], tool_choice: { type: 'tool', name: 'submit_reflection' },
    });
    expect(REFLECTION_MAX_TOKENS).toBe(4096);
    expect(REFLECTION_TIMEOUT_MS).toBe(35_000);
    expect(opts.signal).toBeInstanceOf(AbortSignal);
    expect(opts.signal.aborted).toBe(false); // a success is never aborted
  });

  it('a success at a 5-game milestone still runs the consolidation gate, once', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION });
    const { db } = seed({ agent: { ...AGENT, stats: { gamesPlayed: 5 } } });
    const result = await generateReflection(db, BATTLE_ID);
    expect(result.outcome).toBe('ok');
    expect(consolidation.calls).toHaveLength(1);
  });
});

describe('the request no longer asks for the game-design questionnaire (O1)', () => {
  it('the tool requires selfReflection only, and its shape is unchanged', () => {
    expect(REFLECTION_TOOL.input_schema.required).toEqual(['selfReflection']);
    expect(Object.keys(REFLECTION_TOOL.input_schema.properties)).toEqual(['selfReflection']);
    expect(REFLECTION_TOOL.input_schema.properties.selfReflection).toEqual({
      type: 'object',
      required: ['lesson', 'adjustment', 'hypothesisGrades', 'confidenceCalibration'],
      properties: {
        lesson: { type: 'string', description: 'Key takeaway from this battle. Max 50 words.' },
        adjustment: { type: 'string', description: 'What you would change next time. Max 50 words.' },
        hypothesisGrades: {
          type: 'array',
          items: {
            type: 'object',
            required: ['hypothesis', 'grade', 'reason'],
            properties: {
              hypothesis: { type: 'string', description: 'The hypothesis text' },
              grade: { type: 'string', enum: ['correct', 'incorrect', 'inconclusive'] },
              reason: { type: 'string', description: 'Brief reason for grade. Max 30 words.' },
            },
          },
          description: 'Grade each hypothesis you made during the battle.',
        },
        confidenceCalibration: { type: 'string', description: 'Were you overconfident, underconfident, or well-calibrated? Max 30 words.' },
      },
    });
  });

  it('neither prompt asks for a game-design evaluation', () => {
    const text = `${REFLECTION_TOOL.description}\n${buildReflectionSystemPrompt()}\n${buildReflectionUserMessage(BATTLE, AGENT)}`;
    expect(text).not.toMatch(/game design|gameDesignFeedback|mechanicHighlight|wouldPlayAgain|playtester/i);
    expect(buildReflectionUserMessage(BATTLE, AGENT)).toContain('--- SELF-REFLECTION INSTRUCTIONS ---');
  });
});

describe('the casual-clone forward obeys the same rules', () => {
  const CLONE_ID = 'casual-agent-owner-1';
  const PARENT_ID = 'ranked-1';
  const casualSeed = () => makeDb({
    [`agentBattles/${BATTLE_ID}`]: { ...BATTLE, agentId: CLONE_ID, gameMode: 'baggerbomb' },
    [`agents/${CLONE_ID}`]: { ...AGENT, rankedAgentId: PARENT_ID, memory: [] },
    [`agents/${PARENT_ID}`]: { ...AGENT, memory: priorMemory(2) },
  });

  it('a failure writes nothing to the parent or the clone', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION }, { stop_reason: 'max_tokens' });
    const { db, writes } = casualSeed();
    expectNamedFailure(await generateReflection(db, BATTLE_ID), writes, 'max_tokens');
  });

  it('a success lands on the PARENT\'s window through the transactional forward', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION });
    const { db, writes, store } = casualSeed();
    const result = await generateReflection(db, BATTLE_ID);
    expect(result.outcome).toBe('ok');
    expect(writes.map((w) => `${w.op} ${w.path}`)).toEqual([`tx.update agents/${PARENT_ID}`]);
    const memory = store.get(`agents/${PARENT_ID}`).memory;
    expect(memory).toHaveLength(3);
    expect(memory[2]).toMatchObject({ gameId: BATTLE_ID, lesson: VALID_SELF_REFLECTION.lesson });
    expect(store.get(`agents/${CLONE_ID}`).memory).toEqual([]);
  });
});

describe('a lesson already recorded is a success without a second call (review RV-4, RV-7, RV-8)', () => {
  const recordedMemory = () => [...priorMemory(2), { ...priorMemory(1)[0], gameId: BATTLE_ID }];

  it('a retry after a lost battle write makes no call, writes nothing, and reports ok with no call metrics', async () => {
    sdk.create = vi.fn(async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION }));
    const { db, writes } = seed({ agent: { ...AGENT, memory: recordedMemory() } });
    const result = await generateReflection(db, BATTLE_ID, { attempt: 2 });
    expect(result).toMatchObject({ outcome: 'ok', reason: 'already_recorded' });
    expect(result.record).toMatchObject({ outcome: 'ok', failureClass: null, elapsedMs: null, stopReason: null, usage: null, model: null, attempt: 2 });
    expect(sdk.calls).toEqual([]);
    expect(writes).toEqual([]);
    expect(shadow.lines).toEqual([]); // no call, no shadow line
  });

  it('an ambiguous memory write (committed, then reported failed) still consolidates at its milestone on the retry', async () => {
    sdk.create = async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION });
    const { db, store } = seed({ agent: { ...AGENT, stats: { gamesPlayed: 5 } } });
    // The agent update APPLIES, then throws once — as a DEADLINE_EXCEEDED on a committed write would.
    const realCollection = db.collection;
    let thrown = false;
    db.collection = (name) => {
      const c = realCollection(name);
      if (name !== 'agents') return c;
      return { ...c, doc: (id) => { const ref = c.doc(id); return { ...ref, update: async (patch) => { await ref.update(patch); if (!thrown) { thrown = true; const e = new Error('DEADLINE_EXCEEDED'); e.name = 'FirebaseError'; throw e; } } }; } };
    };
    const first = await generateReflection(db, BATTLE_ID, { attempt: 1 });
    expect(first).toMatchObject({ outcome: 'failed', record: { failureClass: 'unknown', errorName: 'FirebaseError' } });
    expect(consolidation.calls).toEqual([]);
    expect(store.get(`agents/${AGENT_ID}`).memory.filter((m) => m.gameId === BATTLE_ID)).toHaveLength(1);

    const second = await generateReflection(db, BATTLE_ID, { attempt: 2 });
    expect(second).toMatchObject({ outcome: 'ok', reason: 'already_recorded' });
    expect(consolidation.calls).toHaveLength(1); // the milestone is not lost
    expect(store.get(`agents/${AGENT_ID}`).memory.filter((m) => m.gameId === BATTLE_ID)).toHaveLength(1); // never duplicated
  });

  it('a casual retry checks the PARENT\'s window (where the lesson lands), not the clone\'s', async () => {
    sdk.create = vi.fn(async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION }));
    const { db, writes } = makeDb({
      [`agentBattles/${BATTLE_ID}`]: { ...BATTLE, agentId: 'casual-agent-owner-1', gameMode: 'baggerbomb' },
      [`agents/casual-agent-owner-1`]: { ...AGENT, rankedAgentId: 'ranked-1', memory: [] },
      [`agents/ranked-1`]: { ...AGENT, memory: recordedMemory() },
    });
    expect(await generateReflection(db, BATTLE_ID, { attempt: 2 })).toMatchObject({ outcome: 'ok', reason: 'already_recorded' });
    expect(sdk.calls).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('the recovery pass (modelCall false) never calls: a landed lesson is ok, a missing one is failed/unknown', async () => {
    sdk.create = vi.fn(async () => toolResponse({ selfReflection: VALID_SELF_REFLECTION }));
    const landed = seed({ agent: { ...AGENT, memory: recordedMemory() } });
    expect(await generateReflection(landed.db, BATTLE_ID, { attempt: 3, modelCall: false })).toMatchObject({ outcome: 'ok', reason: 'already_recorded' });
    const missing = seed();
    const result = await generateReflection(missing.db, BATTLE_ID, { attempt: 3, modelCall: false });
    expect(result).toMatchObject({ outcome: 'failed', record: { outcome: 'failed', failureClass: 'unknown', errorName: null, model: null, attempt: 3 } });
    expect(sdk.calls).toEqual([]);
    expect([...landed.writes, ...missing.writes]).toEqual([]);
  });
});

describe('nothing to reflect is a skip, never a call', () => {
  it.each([
    ['the battle is gone', 'battle_missing', () => makeDb({ [`agents/${AGENT_ID}`]: AGENT })],
    ['the agent is gone', 'agent_missing', () => makeDb({ [`agentBattles/${BATTLE_ID}`]: BATTLE })],
    ['the battle is not completed', 'not_completed', () => seed({ battle: { ...BATTLE, status: 'active' } })],
  ])('%s → skipped (%s)', async (_label, reason, make) => {
    const { db, writes } = make();
    expect(await generateReflection(db, BATTLE_ID)).toEqual({ outcome: 'skipped', reason });
    expect(sdk.calls).toEqual([]);
    expect(writes).toEqual([]);
  });
});
