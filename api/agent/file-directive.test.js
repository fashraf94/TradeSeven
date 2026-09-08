// api/agent/file-directive.test.js
//
// POST /api/agent/file-directive — the deterministic route (voice-layer
// grounding §6.1; spec §10's rows): filed / replaced-prior / rejected /
// conflict (a stale expectedDirectiveThreadId) / budget-exhausted; the
// transaction's eight checks each falsifiable; a concurrent double-tap
// charges once; the route 404s at 'off'; the persisted shape equals the
// shipped write's; no model call; the budget is server-derived from the
// battle's game mode (ruling 6, D-105) and charged inside the same
// transaction.
//
// The fake Firestore models what the route relies on: `runTransaction` runs
// the body, buffers its writes, and — when a test injects a competing write
// between the read and the commit — discards the buffer and RE-RUNS the body
// against the changed doc, the way the real client retries on contention.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TOURNAMENT_GAME_MODE } from '../../src/constants/leagueTournament.js';

const state = vi.hoisted(() => ({
  mode: 'on',
  modeCalls: [],
  uid: 'owner-1',
  battle: null,
  agent: null,
  group: { status: 'active' },
  budgetDocs: {},
  resolveImpl: () => ({ groupId: 'group-xyz', dayN: 3 }),
  gemmaCalls: [],
  injectBeforeCommit: null,
  attempts: 0,
  committed: [],
}));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: state.uid }) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getVoiceGroundingMode: (uid) => { state.modeCalls.push(uid); return state.mode; },
}));
vi.mock('../_utils/agentChatBudget.js', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveBudgetDay: async (_db, battle) => state.resolveImpl(battle),
}));
// The route never imports the model client; the spy proves no call reaches it
// through any path either.
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: async (o) => { state.gemmaCalls.push(o); return '{}'; },
  callGemmaVoiceWithRetry: async (o) => { state.gemmaCalls.push(o); return { success: true, content: '{}' }; },
  parseVoiceLayerResponse: (c) => JSON.parse(c),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) },
}));

// ---- the fake Firestore ----
function docSnap(data, id) { return { exists: data != null, id, data: () => (data == null ? undefined : { ...data }) }; }
function readDoc(col, id) {
  if (col === 'agentBattles') return docSnap(state.battle && state.battle.__id === id ? state.battle : null, id);
  if (col === 'agents') return docSnap(state.agent && state.agent.__id === id ? state.agent : null, id);
  if (col === 'tournamentGroups') return docSnap(state.group, id);
  if (col === 'agentChatBudget') return docSnap(state.budgetDocs[id] ?? null, id);
  return docSnap(null, id);
}
function applyWrite(w) {
  if (w.col === 'agentBattles') {
    const b = state.battle;
    for (const [k, v] of Object.entries(w.data)) {
      if (v && v.__op === 'arrayUnion') b[k] = [...(b[k] || []), ...v.items];
      else if (v && v.__op === 'increment') b[k] = (b[k] || 0) + v.n;
      else b[k] = v;
    }
  } else if (w.col === 'agentChatBudget') {
    state.budgetDocs[w.id] = { ...(state.budgetDocs[w.id] || {}), ...w.data };
  }
}
const db = {
  collection: (col) => ({ doc: (id) => ({ __col: col, __id: id, get: async () => readDoc(col, id) }) }),
  runTransaction: async (fn) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state.attempts += 1;
      const buffer = [];
      const tx = {
        // Firestore's contract: every read precedes every write in a
        // transaction. The fake enforces it (review R-29), so a `tx.get`
        // moved after a `tx.update` / `tx.set` reds here, not in production.
        get: async (ref) => {
          if (buffer.length > 0) throw new Error('transaction read after write');
          return readDoc(ref.__col, ref.__id);
        },
        update: (ref, data) => buffer.push({ col: ref.__col, id: ref.__id, data, op: 'update' }),
        set: (ref, data, opts) => buffer.push({ col: ref.__col, id: ref.__id, data, opts, op: 'set' }),
      };
      const result = await fn(tx);
      if (state.injectBeforeCommit && attempt === 1) {
        // Contention: another writer landed between the read and the commit.
        state.injectBeforeCommit();
        state.injectBeforeCommit = null;
        continue; // the buffer is discarded; the body re-runs against the changed doc
      }
      for (const w of buffer) { applyWrite(w); state.committed.push(w); }
      return result;
    }
    throw new Error('transaction contention exhausted');
  },
};
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module under test is the runtime guard that its api → src imports stay Node-clean. Never mock it.
const { default: handler, buildFiledExchange, FILING_STATUS } = await import('./file-directive.js');
const { buildDirectiveSlot, buildDirectiveRecord, BATTLE_CHAT_BUDGET } = await import('../_utils/directiveFiling.js');

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const post = async (body) => { const res = mkRes(); await handler({ method: 'POST', body }, res); return res; };
const BODY = { agentId: 'agent-1', battleId: 'battle-1', adjustmentId: 'DV-02', expectedDirectiveThreadId: null };
const DV02 = 'Widen the spread (target more sectors)';

function makeBattle(over = {}) {
  return {
    __id: 'battle-1', ownerId: 'owner-1', agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent',
    agentContext: { archetype: 'diversifier' }, chatExchanges: [], chatBudgetUsed: 2, directive: null, ...over,
  };
}
const battleWrite = () => state.committed.find((w) => w.col === 'agentBattles');
const budgetWrites = () => state.committed.filter((w) => w.col === 'agentChatBudget');

beforeEach(() => {
  state.mode = 'on';
  state.modeCalls = [];
  state.uid = 'owner-1';
  state.battle = makeBattle();
  state.agent = { __id: 'agent-1', archetype: 'diversifier', name: 'Vega' };
  state.group = { status: 'active' };
  state.budgetDocs = {};
  state.resolveImpl = () => ({ groupId: 'group-xyz', dayN: 3 });
  state.gemmaCalls = [];
  state.injectBeforeCommit = null;
  state.attempts = 0;
  state.committed = [];
});

describe('file-directive — the gate and the body', () => {
  it("check 7: the route does not exist at 'off' for this caller — 404 before any read", async () => {
    state.mode = 'off';
    const res = await post(BODY);
    expect(res.statusCode).toBe(404);
    expect(state.modeCalls).toEqual(['owner-1']);
    expect(state.attempts).toBe(0);
  });

  it.each(['shadow', 'on'])("'%s': the route is live", async (mode) => {
    state.mode = mode;
    expect((await post(BODY)).statusCode).toBe(200);
  });

  it('405 on non-POST', async () => {
    const res = mkRes();
    await handler({ method: 'GET', body: BODY }, res);
    expect(res.statusCode).toBe(405);
  });

  it('400 when agentId / battleId / adjustmentId is missing', async () => {
    expect((await post({ ...BODY, agentId: '' })).statusCode).toBe(400);
    expect((await post({ ...BODY, battleId: undefined })).statusCode).toBe(400);
    expect((await post({ ...BODY, adjustmentId: null })).statusCode).toBe(400);
  });

  it('expectedDirectiveThreadId is NULLABLE AND REQUIRED: absent → 400; null → accepted; a non-string → 400', async () => {
    const absent = { agentId: 'agent-1', battleId: 'battle-1', adjustmentId: 'DV-02' };
    expect((await post(absent)).statusCode).toBe(400);
    expect((await post({ ...absent, expectedDirectiveThreadId: 42 })).statusCode).toBe(400);
    expect((await post({ ...absent, expectedDirectiveThreadId: '' })).statusCode).toBe(400);
    expect((await post({ ...absent, expectedDirectiveThreadId: null })).statusCode).toBe(200);
  });
});

describe('file-directive — the eight checks, each falsifiable', () => {
  it('404 when the battle is missing; 404 when the agent doc is missing', async () => {
    state.battle = null;
    expect((await post(BODY)).statusCode).toBe(404);
    state.battle = makeBattle();
    state.agent = null;
    expect((await post(BODY)).statusCode).toBe(404);
    expect(state.committed).toEqual([]);
  });

  it("check 1: the TOKEN's uid must own the battle (a body cannot say otherwise)", async () => {
    state.uid = 'someone-else';
    const res = await post({ ...BODY, ownerId: 'owner-1', uid: 'owner-1' });
    expect(res.statusCode).toBe(403);
    expect(state.committed).toEqual([]);
  });

  it('check 2: the battle must be active', async () => {
    state.battle = makeBattle({ status: 'completed' });
    const res = await post(BODY);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('battle_not_active');
  });

  it("check 3: the agent must belong to this battle — now the shared predicate chat.js and ensure-opener.js call too", async () => {
    state.agent = { __id: 'agent-2', archetype: 'diversifier' };
    const res = await post({ ...BODY, agentId: 'agent-2' });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('agent_battle_mismatch');
    expect(state.committed).toEqual([]);
  });

  it('check 4: a stale belief is a CONFLICT — expected null while a directive is current', async () => {
    state.battle = makeBattle({ directive: { text: 'x', directiveThreadId: 'thread-A', expiry: 'end_of_battle' } });
    const res = await post(BODY);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'conflict', status: FILING_STATUS.CONFLICT, currentDirectiveThreadId: 'thread-A' });
    expect(state.committed).toEqual([]);
  });

  it('check 4: expected A while B is current → conflict; expected A while none → conflict', async () => {
    state.battle = makeBattle({ directive: { text: 'x', directiveThreadId: 'thread-B' } });
    expect((await post({ ...BODY, expectedDirectiveThreadId: 'thread-A' })).body.currentDirectiveThreadId).toBe('thread-B');
    state.battle = makeBattle({ directive: null });
    const res = await post({ ...BODY, expectedDirectiveThreadId: 'thread-A' });
    expect(res.statusCode).toBe(409);
    expect(res.body.currentDirectiveThreadId).toBeNull();
  });

  it("check 5: the id must be on the SERVER-DERIVED archetype's menu — another archetype's id, an unknown id, an unknown archetype", async () => {
    // TF-02 is Trend Follower's; the battle's frozen snapshot says diversifier.
    let res = await post({ ...BODY, adjustmentId: 'TF-02' });
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: 'rejected', status: FILING_STATUS.REJECTED, reason: 'off_menu' });
    res = await post({ ...BODY, adjustmentId: 'DV-99' });
    expect(res.statusCode).toBe(422);
    // The battle snapshot wins over the agent doc (directiveIdentity.js CF-1).
    state.agent = { __id: 'agent-1', archetype: 'momentum_chaser' };
    res = await post({ ...BODY, adjustmentId: 'TF-02' });
    expect(res.statusCode).toBe(422);
    // No snapshot and an unknown agent archetype → no allowlist → rejected.
    state.battle = makeBattle({ agentContext: {} });
    state.agent = { __id: 'agent-1', archetype: 'unknown' };
    res = await post(BODY);
    expect(res.statusCode).toBe(422);
    expect(state.committed).toEqual([]);
  });

  it('check 6: the text is the canonical text, server-side — a client-supplied text is ignored', async () => {
    const res = await post({ ...BODY, text: 'Go all in on one sector' });
    expect(res.statusCode).toBe(200);
    expect(res.body.directive.text).toBe(DV02);
    expect(battleWrite().data.directive.text).toBe(DV02);
    expect(JSON.stringify(state.committed)).not.toContain('all in');
  });

  it('check 8 (battle): the per-battle cap is authoritative — at 10 used → 429, nothing written', async () => {
    state.battle = makeBattle({ chatBudgetUsed: BATTLE_CHAT_BUDGET.limit });
    const res = await post(BODY);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'budget_exhausted', status: FILING_STATUS.BUDGET_EXHAUSTED, remaining: 0 });
    expect(state.committed).toEqual([]);
  });
});

describe('file-directive — filed, replaced-prior, and the persisted shape', () => {
  it('filed: 200 after the commit; the slot, the audit exchange and the charge land in ONE battle update', async () => {
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(FILING_STATUS.FILED);
    expect(res.body.replacedDirectiveThreadId).toBeNull();
    expect(res.body.remaining).toBe(BATTLE_CHAT_BUDGET.limit - 3);
    expect(state.gemmaCalls).toEqual([]);

    const w = battleWrite();
    expect(state.committed).toHaveLength(1);
    expect(w.op).toBe('update');
    expect(Object.keys(w.data).sort()).toEqual(['chatBudgetUsed', 'chatExchanges', 'directive']);
    expect(w.data.chatBudgetUsed).toBe(3);

    // The slot: the shipped enforce-path shape — buildDirectiveSlot in directiveFiling.js, the ONE shape chat.js writes at its step 19 (review R-37).
    const slot = w.data.directive;
    expect(Object.keys(slot).sort()).toEqual(['adjustmentId', 'canonicalTextVersion', 'createdAt', 'directiveThreadId', 'expiry', 'text']);
    expect(slot).toMatchObject({ text: DV02, expiry: 'end_of_battle', adjustmentId: 'DV-02', canonicalTextVersion: 1 });
    expect(slot.directiveThreadId).toMatch(/[0-9a-f-]{36}/);
    expect(res.body.directive).toEqual(slot);

    // The audit exchange: directiveThreadId TOP-LEVEL and INSIDE directive
    // (ruling 5, hazard 18), the id and the version (item 9 note 4), the
    // marker, the type and the source.
    const ex = w.data.chatExchanges.items[0];
    expect(w.data.chatExchanges.__op).toBe('arrayUnion');
    expect(ex.directiveThreadId).toBe(slot.directiveThreadId);
    expect(ex.directive.directiveThreadId).toBe(slot.directiveThreadId);
    expect(Object.keys(ex.directive).sort()).toEqual(['adjustmentId', 'canonicalTextVersion', 'directiveThreadId', 'expiry', 'text']);
    expect(ex).toMatchObject({
      userMessage: null, agentResponse: '', hasDirective: true, suggestedActions: null, scratchpad: null,
      messageType: 'directive_filed', source: 'chip', groundingVersion: 1, mode: 'battle', elicitationTarget: 'directive_filed',
    });
    expect(ex.timestamp).toBe(slot.createdAt);
    expect('groupId' in ex).toBe(false);
  });

  it('replaced-prior: expected A while A is current → a NEW thread id, the prior one reported', async () => {
    state.battle = makeBattle({ directive: { text: 'Tighten the concentration cap (thinner per sector)', directiveThreadId: 'thread-A', expiry: 'end_of_battle', createdAt: '2026-09-08T14:00:00.000Z' } });
    const res = await post({ ...BODY, expectedDirectiveThreadId: 'thread-A' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(FILING_STATUS.REPLACED_PRIOR);
    expect(res.body.replacedDirectiveThreadId).toBe('thread-A');
    expect(res.body.directive.directiveThreadId).not.toBe('thread-A');
    // D-18 latest-wins by construction: the whole slot is set.
    expect(battleWrite().data.directive.text).toBe(DV02);
  });

  it('replaced-prior: a LEGACY slot with text but no thread id is replaced too — reported as such, with no thread to name (review R-19)', async () => {
    state.battle = makeBattle({ directive: { text: 'Old lean, pre-thread-id', expiry: 'end_of_battle' } });
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(FILING_STATUS.REPLACED_PRIOR);
    expect(res.body.replacedDirectiveThreadId).toBeNull();
    expect(battleWrite().data.directive.text).toBe(DV02);
  });

  it('the persisted shape IS the chat turn\'s shape: both writers build it from directiveFiling.js (one function, not two literals)', async () => {
    const { readFileSync } = await import('node:fs');
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    const route = readFileSync(new URL('./file-directive.js', import.meta.url), 'utf8');
    for (const src of [chat, route]) {
      expect(src).toContain("from '../_utils/directiveFiling.js'");
      expect(src).toContain('buildDirectiveRecord(');
      expect(src).toContain('buildDirectiveSlot(');
      expect(src).not.toContain("expiry: normalizedDirective.expiry || 'end_of_battle'");
    }
    // …and the shape itself, as the shipped ENFORCE row in chat.test.js photographs it.
    const normalized = { text: DV02, expiry: 'end_of_battle', adjustmentId: 'DV-02', canonicalTextVersion: 1 };
    expect(buildDirectiveSlot(normalized, 't', 'now')).toEqual({ text: DV02, expiry: 'end_of_battle', directiveThreadId: 't', createdAt: 'now', adjustmentId: 'DV-02', canonicalTextVersion: 1 });
    expect(buildDirectiveRecord(normalized, 't')).toEqual({ text: DV02, expiry: 'end_of_battle', directiveThreadId: 't', adjustmentId: 'DV-02', canonicalTextVersion: 1 });
    // The flag-off legacy shape (no id) stays byte-identical: no id, no version key.
    expect(buildDirectiveRecord({ text: 'lean tech' }, 't')).toEqual({ text: 'lean tech', expiry: 'end_of_battle', directiveThreadId: 't' });
    expect(buildDirectiveSlot({ text: 'lean tech', expiry: '3_games' }, 't', 'now')).toEqual({ text: 'lean tech', expiry: '3_games', directiveThreadId: 't', createdAt: 'now' });
  });

  it('the audit exchange builder is the one the route writes', () => {
    const ex = buildFiledExchange({ record: buildDirectiveRecord({ text: DV02, adjustmentId: 'DV-02', canonicalTextVersion: 1 }, 't-1'), directiveThreadId: 't-1', createdAt: 'now', groupId: 'g' });
    expect(ex.groupId).toBe('g');
    expect(ex.directive.directiveThreadId).toBe('t-1');
    expect(ex.directiveThreadId).toBe('t-1');
  });

  it('NO MODEL CALL: the route imports no model client, and the spy never fires', async () => {
    const { readFileSync } = await import('node:fs');
    const route = readFileSync(new URL('./file-directive.js', import.meta.url), 'utf8');
    expect(route).not.toContain('gemmaClient');
    expect(route).not.toContain('callGemmaVoice');
    await post(BODY);
    expect(state.gemmaCalls).toEqual([]);
  });
});

describe('file-directive — the budget is SERVER-DERIVED from the game mode (ruling 6, D-105)', () => {
  const LEAGUE = () => makeBattle({ gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz', chatBudgetUsed: 7 });

  it('a League tournament battle charges the League store inside the SAME transaction and never the battle counter', async () => {
    state.battle = LEAGUE();
    state.budgetDocs['group-xyz_owner-1_3'] = { count: 4 };
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.remaining).toBe(10 - 5);
    const w = battleWrite();
    expect(Object.keys(w.data).sort()).toEqual(['chatExchanges', 'directive']); // no chatBudgetUsed
    expect(state.battle.chatBudgetUsed).toBe(7);
    const [b] = budgetWrites();
    expect(b.id).toBe('group-xyz_owner-1_3');
    expect(b.data).toMatchObject({ groupId: 'group-xyz', uid: 'owner-1', dayN: 3, count: 5 });
    expect(b.opts).toEqual({ merge: true });
    expect(b.data.updatedAt).toMatch(/^2026-/);
    // The tournament exchange carries the group (Catalog #9).
    expect(w.data.chatExchanges.items[0].groupId).toBe('group-xyz');
    // Both writes landed as ONE commit (one transaction attempt).
    expect(state.attempts).toBe(1);
  });

  it('a League battle with the day\'s ten spent → 429, nothing written', async () => {
    state.battle = LEAGUE();
    state.budgetDocs['group-xyz_owner-1_3'] = { count: 10 };
    const res = await post(BODY);
    expect(res.statusCode).toBe(429);
    expect(state.committed).toEqual([]);
  });

  it('a League battle whose budget is UNKEYABLE files for free (the chat route\'s fail-open contract), remaining null', async () => {
    state.battle = LEAGUE();
    state.resolveImpl = () => null;
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.remaining).toBeNull();
    expect(budgetWrites()).toEqual([]);
    expect(Object.keys(battleWrite().data).sort()).toEqual(['chatExchanges', 'directive']);
  });

  it('the client cannot pick a budget: a leagueAsk flag on a standard battle changes nothing', async () => {
    const res = await post({ ...BODY, leagueAsk: true });
    expect(res.statusCode).toBe(200);
    expect(budgetWrites()).toEqual([]);
    expect(battleWrite().data.chatBudgetUsed).toBe(3);
  });
});

describe('file-directive — concurrency: a double-tap charges once', () => {
  it('two sequential taps with the same belief: the second is a conflict, one directive, one charge', async () => {
    const first = await post(BODY);
    expect(first.statusCode).toBe(200);
    const second = await post(BODY);
    expect(second.statusCode).toBe(409);
    expect(second.body.currentDirectiveThreadId).toBe(first.body.directive.directiveThreadId);
    expect(state.battle.chatBudgetUsed).toBe(3);
    expect(state.battle.chatExchanges).toHaveLength(1);
  });

  it('a truly concurrent tap: the loser\'s commit is retried against the winner\'s doc and returns conflict — one charge', async () => {
    // Between this tap's read and its commit, the OTHER tap lands.
    state.injectBeforeCommit = () => {
      state.battle.directive = { text: DV02, directiveThreadId: 'thread-winner', expiry: 'end_of_battle', createdAt: 'x' };
      state.battle.chatBudgetUsed = 3;
      state.battle.chatExchanges = [{ messageType: 'directive_filed', directiveThreadId: 'thread-winner' }];
    };
    const res = await post(BODY);
    expect(state.attempts).toBe(2);
    expect(res.statusCode).toBe(409);
    expect(res.body.currentDirectiveThreadId).toBe('thread-winner');
    expect(state.battle.chatBudgetUsed).toBe(3);
    expect(state.battle.chatExchanges).toHaveLength(1);
    expect(state.committed).toEqual([]);
  });

  it('a concurrent chat turn that spent the last message: the filing re-reads and is refused', async () => {
    state.battle = makeBattle({ chatBudgetUsed: 9 });
    state.injectBeforeCommit = () => { state.battle.chatBudgetUsed = 10; };
    const res = await post(BODY);
    expect(res.statusCode).toBe(429);
    expect(state.battle.chatBudgetUsed).toBe(10);
    expect(state.committed).toEqual([]);
  });
});
