// api/_utils/voiceLayerAnticipation.grounding.test.js
//
// Voice-layer grounding §5 — the check's note, code-composed (R4, F1, F7, F10;
// hazards 22, 27, 28; Phase 0 item 1). Spec §10: "anticipation: event-only
// text, no threshold token in the exchange, one per (symbol, direction, day),
// no model call (a mocked client asserts zero calls)". The rulings sharpen
// two rows: the "no threshold" test keys on the FIELD, never the substring
// (a true signal sentence may say "threshold"), and the dedupe key is the ET
// day from formatEtDate, never a UTC slice.

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'off', reads: [], updates: [], gemmaCalls: [], logs: [], battle: null }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getVoiceGroundingMode: () => state.mode,
}));
vi.mock('./gemmaClient.js', () => ({
  callGemmaVoiceWithRetry: async (opts) => { state.gemmaCalls.push(opts); return { success: true, content: '{"response":"Eyeing NOW on the bench."}' }; },
  parseVoiceLayerResponse: (c) => JSON.parse(c),
}));
vi.mock('./shadowLogger.js', () => ({ logAnticipation: async (r) => { state.logs.push(r); return true; } }));
vi.mock('./voiceLayerPrompt.js', () => ({
  buildAnticipationPrompt: () => 'ANTICIPATION_PROMPT',
  getAgentPhase: () => 'discovery',
}));
vi.mock('./termUniverse.js', () => ({ TERM_TOKENS: [] }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (v) => ({ __arrayUnion: v }) } }));

const { generateAnticipation, anticipationAlreadyNoted } = await import('./voiceLayerAnticipation.js');
const { dedupeAnticipationQueue, composeAnticipationNote, passesReplyLint, REPLY_LINT_RE } = await import('./voiceLayerGrounding.js');

// Tue Sep 8 2026, 11:47 AM ET — the dispatch instant.
const FROZEN_NOW = '2026-09-08T15:47:00.000Z';

function makeBattle(overrides = {}) {
  return {
    ownerId: 'owner-1',
    agentId: 'agent-1',
    status: 'active',
    executionMode: 'autopilot',
    agentContext: { archetype: 'momentum_chaser' },
    evaluations: [
      { evalId: 'eval_004', timestamp: '2026-09-08T15:15:33.000Z', decision: 'SWAP' }, // 11:15 ET
    ],
    chatExchanges: [],
    ...overrides,
  };
}

function makeDb() {
  const snap = (data, id) => ({ exists: data != null, id, data: () => data });
  const doc = (col, id) => ({
    get: async () => {
      state.reads.push(`${col}/${id}`);
      if (col === 'agentBattles') return snap(state.battle, id);
      if (col === 'agents') return snap({ name: 'Vega', archetype: 'momentum_chaser', stats: { gamesPlayed: 3 } }, id);
      return snap(null, id);
    },
    update: async (u) => { state.updates.push(u); },
  });
  return { collection: (col) => ({ doc: (id) => doc(col, id) }) };
}

const CANDIDATE = {
  symbol: 'NOW',
  direction: 'potential_entry',
  signalSummary: 'Relative strength building against XLK and volume is confirming.',
  threshold: 'If it holds above the 20-day on the next test, I would rotate it into Core.',
  rationale: 'Cleanest setup on the bench.',
  signalSource: 'relative_strength',
};

const run = (candidate = CANDIDATE, extra = {}) => generateAnticipation({
  db: makeDb(), battleId: 'battle-1', agentId: 'agent-1', anticipationCandidate: candidate, evalId: 'eval_004', ownerId: 'owner-1', ...extra,
});
const written = () => state.updates.map((u) => u.chatExchanges.__arrayUnion);

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(FROZEN_NOW)); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => {
  state.mode = 'off';
  state.reads = [];
  state.updates = [];
  state.gemmaCalls = [];
  state.logs = [];
  state.battle = makeBattle();
});

describe('the code-composed note (§5) under \'on\'', () => {
  it('NO model call; only the battle is read; ONE exchange, event-only, from the evaluation\'s slot', async () => {
    state.mode = 'on';
    await run();
    expect(state.gemmaCalls).toHaveLength(0);
    expect(state.reads).toEqual(['agentBattles/battle-1']);
    expect(written()).toHaveLength(1);
    const ex = written()[0];
    expect(ex.agentResponse).toBe('At the 11:15 AM check my trading process flagged NOW on the bench as a potential entry. The signal it recorded: Relative strength building against XLK and volume is confirming.');
    expect(ex.messageType).toBe('anticipation');
    expect(ex.groundingVersion).toBe(1);
    expect(ex.suggestedActions).toBeNull();
    expect(ex.scratchpad).toBeNull();
    expect(ex.userMessage).toBeNull();
    expect(state.logs[0]).toMatchObject({ success: true, composed: 'code', systemPrompt: null, signalClauseDropped: false });
  });

  it('the exchange carries `anticipationContext { symbol, direction, evaluationId, slot }` — and NO `threshold` FIELD (keyed on the field, never the substring)', async () => {
    state.mode = 'on';
    // A TRUE signal sentence may say "threshold" — it is a named signal category.
    await run({ ...CANDIDATE, signalSummary: 'Within 0.2x ATR of the bagger threshold with volume confirming.' });
    const ex = written()[0];
    expect(ex.anticipationContext).toEqual({ symbol: 'NOW', direction: 'potential_entry', evaluationId: 'eval_004', slot: '11:15 AM' });
    expect('threshold' in ex.anticipationContext).toBe(false);
    expect('signalSummary' in ex.anticipationContext).toBe(false);
    // The action clause the decider wrote never reaches the text…
    expect(ex.agentResponse).not.toContain('I would rotate it into Core');
    expect(ex.agentResponse).not.toContain('holds above the 20-day');
    // …while the descriptive sentence that happens to say "threshold" does.
    expect(ex.agentResponse).toContain('The signal it recorded: Within 0.2x ATR of the bagger threshold with volume confirming.');
  });

  it('an exit candidate is "in the book as a potential exit"', async () => {
    state.mode = 'on';
    await run({ ...CANDIDATE, symbol: 'MOS', direction: 'potential_exit', signalSummary: 'Momentum fading and relative strength rolling over.' });
    expect(written()[0].agentResponse).toBe('At the 11:15 AM check my trading process flagged MOS in the book as a potential exit. The signal it recorded: Momentum fading and relative strength rolling over.');
    expect(written()[0].anticipationContext.direction).toBe('potential_exit');
  });

  it('the signal clause is DROPPED on a reply-lint hit and the event note stands (hazard 22)', async () => {
    state.mode = 'on';
    await run({ ...CANDIDATE, signalSummary: "I'm eyeing a breakout above the 20-day." });
    expect(written()[0].agentResponse).toBe('At the 11:15 AM check my trading process flagged NOW on the bench as a potential entry.');
    expect(state.logs[0]).toMatchObject({ signalClauseDropped: true });
  });

  it('no signalSummary → the event note alone; the slot falls back to the dispatch instant when the entry is not on the doc', async () => {
    state.mode = 'on';
    state.battle = makeBattle({ evaluations: [] });
    await run({ symbol: 'NOW', direction: 'potential_entry' });
    expect(written()[0].agentResponse).toBe('At the 11:45 AM check my trading process flagged NOW on the bench as a potential entry.');
    expect(written()[0].anticipationContext.slot).toBe('11:45 AM');
  });

  it('DEDUPE (hazard 27): a note for the same (symbol, direction) on the same ET day already on the doc → no write, a breadcrumb', async () => {
    state.mode = 'on';
    state.battle = makeBattle({
      chatExchanges: [{
        messageType: 'anticipation', agentResponse: 'earlier', timestamp: '2026-09-08T14:16:00.000Z', // 10:16 ET, same day
        anticipationContext: { symbol: 'NOW', direction: 'potential_entry', evaluationId: 'eval_001', slot: '10:15 AM' },
      }],
    });
    await run();
    expect(written()).toHaveLength(0);
    expect(state.gemmaCalls).toHaveLength(0);
    expect(state.logs[0]).toMatchObject({ success: false, errorStep: 'grounding_dedupe', errorReason: 'already_noted_2026-09-08' });
  });

  it('DEDUPE is keyed on the ET DAY: yesterday\'s note does not block today\'s; a UTC-day boundary does not split an ET day', async () => {
    state.mode = 'on';
    state.battle = makeBattle({
      chatExchanges: [{
        messageType: 'anticipation', agentResponse: 'yesterday', timestamp: '2026-09-07T20:16:00.000Z', // Mon 4:16 PM ET
        anticipationContext: { symbol: 'NOW', direction: 'potential_entry' },
      }],
    });
    await run();
    expect(written()).toHaveLength(1);
    // 2026-09-08T02:30:00Z is still Mon Sep 7 in ET (10:30 PM) — a UTC slice would call it "today".
    expect(anticipationAlreadyNoted(
      [{ messageType: 'anticipation', timestamp: '2026-09-08T02:30:00.000Z', anticipationContext: { symbol: 'NOW', direction: 'potential_entry' } }],
      { symbol: 'NOW', direction: 'potential_entry', etDay: '2026-09-08' },
    )).toBe(false);
    expect(anticipationAlreadyNoted(
      [{ messageType: 'anticipation', timestamp: '2026-09-08T02:30:00.000Z', anticipationContext: { symbol: 'NOW', direction: 'potential_entry' } }],
      { symbol: 'NOW', direction: 'potential_entry', etDay: '2026-09-07' },
    )).toBe(true);
  });

  it('DEDUPE is per direction: an exit note does not block an entry note for the same name', async () => {
    state.mode = 'on';
    state.battle = makeBattle({
      chatExchanges: [{ messageType: 'anticipation', timestamp: '2026-09-08T14:16:00.000Z', anticipationContext: { symbol: 'NOW', direction: 'potential_exit' } }],
    });
    await run();
    expect(written()).toHaveLength(1);
  });

  it('\'on\' without the owner passed: the gate answers from the doc, still before any model call', async () => {
    state.mode = 'on';
    await run(CANDIDATE, { ownerId: null });
    expect(state.gemmaCalls).toHaveLength(0);
    expect(written()).toHaveLength(1);
    expect(written()[0].groundingVersion).toBe(1);
  });
});

describe('the shipped path under \'off\' / \'shadow\'', () => {
  it.each(['off', 'shadow'])("'%s': one model call, the shipped exchange shape (threshold on the context, no marker)", async (mode) => {
    state.mode = mode;
    await run();
    expect(state.gemmaCalls).toHaveLength(1);
    expect(written()).toHaveLength(1);
    const ex = written()[0];
    expect(ex.agentResponse).toBe('Eyeing NOW on the bench.');
    expect(ex.anticipationContext).toEqual({ symbol: 'NOW', direction: 'potential_entry', threshold: CANDIDATE.threshold, evaluationId: 'eval_004' });
    expect('groundingVersion' in ex).toBe(false);
  });
});

describe('the in-process queue dedupe (hazard 27) and the composer', () => {
  it('keeps the first candidate per (symbol, direction), in order, and drops the malformed', () => {
    const q = [
      { candidate: { symbol: 'NOW', direction: 'potential_entry' }, evalId: 'e1' },
      { candidate: { symbol: 'MOS', direction: 'potential_exit' }, evalId: 'e1' },
      { candidate: { symbol: 'NOW', direction: 'potential_entry', signalSummary: 'later' }, evalId: 'e2' },
      { candidate: { symbol: 'NOW', direction: 'potential_exit' }, evalId: 'e2' },
      { candidate: null, evalId: 'e2' },
      { candidate: { direction: 'potential_entry' }, evalId: 'e2' },
    ];
    expect(dedupeAnticipationQueue(q)).toEqual([q[0], q[1], q[3]]);
    expect(dedupeAnticipationQueue(null)).toEqual([]);
  });

  it('the composer: unknown direction names the symbol only; a clause gets a full stop; the lint is the spec\'s', () => {
    expect(composeAnticipationNote({ symbol: 'NOW', direction: null, slot: '11:15 AM' })).toBe('At the 11:15 AM check my trading process flagged NOW.');
    expect(composeAnticipationNote({ symbol: 'NOW', direction: 'potential_entry', slot: null, signalSummary: 'Volume confirming' })).toBe('At the last check my trading process flagged NOW on the bench as a potential entry. The signal it recorded: Volume confirming.');
    for (const bad of ["I'll rotate it in", "I'm rotating out", 'eyeing the break', 'Watching for the trigger', 'keep an eye on it', "I'd consider it for a swap"]) {
      expect(passesReplyLint(bad)).toBe(false);
    }
    expect(passesReplyLint('Relative strength building against XLK.')).toBe(true);
    expect(passesReplyLint("I'd consider the setup constructive.")).toBe(true); // no "swap" → not the lint's last clause
    expect(REPLY_LINT_RE.flags).toContain('i');
  });
});

describe('the dispatch site (agent-evaluate.js) — source rows', () => {
  it('passes the owner, and dedupes the queue in-process only when the note is code-composed', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../cron/agent-evaluate.js', import.meta.url), 'utf8');
    expect(src).toContain("const ownerGrounded = getVoiceGroundingMode(battle.ownerId) === 'on';");
    expect(src).toContain('const queue = ownerGrounded ? dedupeAnticipationQueue(pendingAnticipations) : pendingAnticipations;');
    expect(src).toContain('ownerId: battle.ownerId || null,');
    expect(src.split('generateAnticipation({').length - 1).toBe(1);
  });
});
