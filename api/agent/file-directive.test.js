// api/agent/file-directive.test.js
//
// POST /api/agent/file-directive — the deterministic route (voice-layer
// grounding §6.1; spec §10's rows): filed / replaced-prior / rejected /
// conflict (a stale expectedDirectiveThreadId) / budget-exhausted; the
// transaction's eight checks each falsifiable; a concurrent double-tap
// charges once; the route is live only where the caller resolves 'on' and 404s
// everywhere else ('off', 'shadow', and 'canary' for a uid off the allowlist);
// the persisted shape equals the
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
  canaryUids: '',
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
  reads: 0,
  committed: [],
}));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: state.uid }) }));
// The accessor is stubbed only to make the FLAG VALUE and the canary list
// settable per row — the RESOLUTION itself is the real one (featureFlags.js's
// resolveVoiceGroundingMode), so the 'canary' rows exercise the shipped
// allowlist rule rather than a test double's idea of it.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getVoiceGroundingMode: (uid) => {
      state.modeCalls.push(uid);
      return actual.resolveVoiceGroundingMode(state.mode, uid, state.canaryUids);
    },
  };
});
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
  // EVERY read goes through here — the plain `.get()` path and the transaction's
  // `tx.get` alike — so `state.reads` is what "before any read" is measured
  // against. `state.attempts` counts transactions only, which a read placed
  // ahead of the gate would slip past.
  state.reads += 1;
  if (col === 'agentBattles') return docSnap(state.battle && state.battle.__id === id ? state.battle : null, id);
  if (col === 'agents') return docSnap(state.agent && state.agent.__id === id ? state.agent : null, id);
  if (col === 'tournamentGroups') return docSnap(state.group, id);
  if (col === 'agentChatBudget') return docSnap(state.budgetDocs[id] ?? null, id);
  return docSnap(null, id);
}
// Firestore's arrayUnion is SET semantics on deep equality: "each specified
// element that doesn't already exist in the array will be added". The concat
// this fake used to do made a re-run of the body look like a duplicate even for
// a byte-identical element — the exact property the hoisted mint relies on.
const sameElement = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function arrayUnion(existing, items) {
  const next = [...(existing || [])];
  for (const item of items) if (!next.some((e) => sameElement(e, item))) next.push(item);
  return next;
}
function applyWrite(w) {
  if (w.col === 'agentBattles') {
    const b = state.battle;
    for (const [k, v] of Object.entries(w.data)) {
      if (v && v.__op === 'arrayUnion') b[k] = arrayUnion(b[k], v.items);
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
      if (state.applyThenRetry && attempt === 1) {
        // THE AMBIGUOUS COMMIT (review lens A, finding A-2). The commit LANDS
        // and its reply is lost, so the SDK re-runs the body — which now reads
        // this transaction's own write. @google-cloud/firestore does exactly
        // this on UNKNOWN / UNAVAILABLE / DEADLINE_EXCEEDED / INTERNAL /
        // CANCELLED: the codes that mean "the commit may have landed".
        state.applyThenRetry = false;
        for (const w of buffer) { applyWrite(w); state.committed.push(w); }
        continue;
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
// `breakResponse` makes the FIRST res.json() throw — the one thing that can
// fail after this route's commit (its own serialization), which is ruling 7's
// third outcome. The second call (from the catch) succeeds, so the row can read
// the body the catch produced.
const mkBrokenRes = () => {
  let thrown = false;
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) {
      if (!thrown) { thrown = true; throw new Error('response serialization failed'); }
      this.body = b;
      return this;
    },
  };
};
const post = async (body, { breakResponse = false } = {}) => {
  const res = breakResponse ? mkBrokenRes() : mkRes();
  await handler({ method: 'POST', body }, res);
  return res;
};
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
  state.canaryUids = '';
  state.modeCalls = [];
  state.uid = 'owner-1';
  state.battle = makeBattle();
  state.agent = { __id: 'agent-1', archetype: 'diversifier', name: 'Vega' };
  state.group = { status: 'active' };
  state.budgetDocs = {};
  state.resolveImpl = () => ({ groupId: 'group-xyz', dayN: 3 });
  state.gemmaCalls = [];
  state.injectBeforeCommit = null;
  state.applyThenRetry = false;
  state.attempts = 0;
  state.reads = 0;
  state.committed = [];
});

describe('file-directive — the gate and the body', () => {
  // Check 7 follows the CHIPS: the route is live only for a caller the accessor
  // resolves to 'on' — the same value chat.js requires before it mints a chip
  // (`groundingMode === 'on' && mode === 'battle'`). At every other resolution
  // nothing the product mints can reach this route, so it does not exist there.
  it.each(['off', 'shadow'])("check 7: the route does not exist at '%s' for this caller — 404 before any read", async (mode) => {
    state.mode = mode;
    const res = await post(BODY);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('not_found');
    expect(state.modeCalls).toEqual(['owner-1']);
    expect(state.attempts).toBe(0);
    expect(state.reads).toBe(0);        // not one document was fetched
    expect(state.committed).toEqual([]);
  });

  it("check 7 is checked FIRST — a malformed body from a non-'on' caller still 404s, never a 400 that describes the route", async () => {
    // The `attempts` assertion above proves "before any read"; it cannot see
    // the ORDER against the body-validation branches, which a valid body
    // satisfies from either position. Move the gate below them and this row
    // reds: the route would answer a caller it does not exist for with a 400
    // naming its own required fields.
    state.mode = 'shadow';
    expect((await post({})).statusCode).toBe(404);
    expect((await post({ agentId: 'agent-1', battleId: 'battle-1', adjustmentId: 'DV-02' })).statusCode).toBe(404);
    expect(state.attempts).toBe(0);
    // …and at 'on' the same malformed bodies get the body contract, not a 404.
    state.mode = 'on';
    expect((await post({})).statusCode).toBe(400);
  });

  it("'canary' for a uid that is NOT on the allowlist: 404 — canary resolves to 'shadow' there", async () => {
    state.mode = 'canary';
    state.canaryUids = 'someone-else,another-one';
    const res = await post(BODY);
    expect(res.statusCode).toBe(404);
    expect(state.attempts).toBe(0);
    expect(state.reads).toBe(0);
    expect(state.committed).toEqual([]);
    // Fail-closed: an unset / empty list is nobody, not everybody.
    state.canaryUids = '';
    expect((await post(BODY)).statusCode).toBe(404);
    state.canaryUids = undefined;
    expect((await post(BODY)).statusCode).toBe(404);
  });

  it("'canary' for an ALLOWLISTED uid: live — the caller who gets the chips gets the route", async () => {
    state.mode = 'canary';
    state.canaryUids = ' other-uid , owner-1 ';
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(FILING_STATUS.FILED);
    expect(state.modeCalls).toEqual(['owner-1']); // the TOKEN's uid, never the body's
  });

  it("'on': live for everyone", async () => {
    state.mode = 'on';
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe(FILING_STATUS.FILED);
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
    // B2 ruling 7: the body now also attests. Nothing else about it moved.
    expect(res.body).toEqual({
      persisted: false, charged: false, reason: 'conflict',
      error: 'conflict', status: FILING_STATUS.CONFLICT, currentDirectiveThreadId: 'thread-A',
    });
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
    // `reason: 'off_menu'` is this route's own, older word for the same slot and
    // the clients already read it; it stands, and the attestation rides beside.
    expect(res.body).toEqual({
      persisted: false, charged: false,
      error: 'rejected', status: FILING_STATUS.REJECTED, reason: 'off_menu',
    });
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
    expect(res.body).toEqual({
      persisted: false, charged: false, reason: 'budget_exhausted',
      error: 'budget_exhausted', status: FILING_STATUS.BUDGET_EXHAUSTED, remaining: 0,
    });
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

  // B2 (spec §2): the shape's ONE home moved INWARD, not sideways. Both routes
  // used to call the two builders themselves; they now reach them through the
  // single transaction both import, which is the stronger form of the same
  // invariant — there is now one CALLER of the builders, not two. The row
  // follows the shape to its new home and keeps its teeth: the shared module
  // imports directiveFiling.js and calls both builders, each route reaches it
  // through that module, and neither route re-inlines the legacy literal.
  it('the persisted shape IS the chat turn\'s shape: ONE module builds it for both writers (one function, not two literals)', async () => {
    const { readFileSync } = await import('node:fs');
    const chat = readFileSync(new URL('./chat.js', import.meta.url), 'utf8');
    const route = readFileSync(new URL('./file-directive.js', import.meta.url), 'utf8');
    const shared = readFileSync(new URL('../_utils/directiveTransaction.js', import.meta.url), 'utf8');
    expect(shared).toContain("from './directiveFiling.js'");
    expect(shared).toContain('buildDirectiveRecord(');
    expect(shared).toContain('buildDirectiveSlot(');
    for (const src of [chat, route]) {
      expect(src).toContain("from '../_utils/directiveTransaction.js'");
      expect(src).toContain('runDirectiveTransaction(');
      // Neither route builds the record or the slot itself any more — the
      // shared transaction does, once, for both.
      expect(src).not.toContain('buildDirectiveRecord(');
      expect(src).not.toContain('buildDirectiveSlot(');
      // …and neither re-inlines the pre-directiveFiling.js literal.
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

// ============================================================================
// B2 — THE AMBIGUOUS COMMIT AND THE CHECK ORDER (adversarial review, lens A)
//
// `runTransaction` re-runs the body on a retryable commit error, and a commit
// that LANDED whose reply was lost surfaces as exactly that. These rows pin
// what the re-run must and must not do.
// ============================================================================

describe('file-directive — a commit that landed and lost its reply', () => {
  // THIS ROUTE IS PROTECTED BY ITS CAS, and that is why the duplicate half of
  // finding A-2 is pinned on the CHAT route (api/agent/chat.test.js), where
  // `replace-and-report` does not refuse and the defect is falsifiable. The row
  // here holds the other half of the same claim: the re-run writes nothing a
  // second time, which is what Phase 0 §6.3 asserts and what makes the two
  // routes separable.
  it('A-2 (the chip half): the re-run writes nothing twice, and strands no thread id', async () => {
    state.applyThenRetry = true;
    const res = await post(BODY);
    expect(state.attempts).toBe(2);
    // Exactly one exchange, carrying exactly one thread id — the slot's.
    expect(state.battle.chatExchanges).toHaveLength(1);
    expect(state.battle.chatExchanges[0].directiveThreadId).toBe(state.battle.directive.directiveThreadId);
    expect(res.statusCode).toBe(409); // the CAS sees its own id and refuses to write again
  });

  // A-1: that 409 is produced by a body that is re-reading its OWN landed
  // commit. It must not claim nothing was filed — the whole point of ruling 7.
  it('A-1: a refusal decided on a RE-RUN says it does not know, never `false`', async () => {
    state.applyThenRetry = true;
    const res = await post(BODY);
    expect(res.statusCode).toBe(409);
    expect(res.body.persisted).toBeNull();
    expect(res.body.charged).toBeNull();
    // …and the filing really did land and really did charge.
    expect(state.battle.chatExchanges).toHaveLength(1);
    expect(state.battle.chatBudgetUsed).toBe(3);
  });

  it('A-1b: a FIRST-attempt refusal still proves `false` — the honest claim is not weakened', async () => {
    state.battle = makeBattle({ directive: { text: 'x', directiveThreadId: 'thread-A', expiry: 'end_of_battle' } });
    const res = await post(BODY);
    expect(res.statusCode).toBe(409);
    expect(state.attempts).toBe(1);
    expect(res.body.persisted).toBe(false);
    expect(res.body.charged).toBe(false);
  });
});

describe('file-directive — the check order the extraction must preserve', () => {
  // A-4: the chip suite did not pin that check 4 (the CAS) runs BEFORE the
  // agent read, so moving the agent read above it stayed green — an
  // unguarded corner of the "its suite is the proof" claim.
  it('A-4: check 4 runs BEFORE the agent doc is read — a stale belief 409s even with no agent doc', async () => {
    state.battle = makeBattle({ directive: { text: 'x', directiveThreadId: 'thread-A', expiry: 'end_of_battle' } });
    state.agent = null; // the agent doc is gone
    const res = await post(BODY);
    // The CONFLICT wins: the belief was checked first, so the caller is told
    // what actually changed rather than that their agent vanished.
    expect(res.statusCode).toBe(409);
    expect(res.body.currentDirectiveThreadId).toBe('thread-A');
  });

  it('A-4b: …and with a MATCHING belief the missing agent doc is what answers', async () => {
    state.agent = null;
    const res = await post(BODY);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Agent not found');
  });
});

describe('file-directive — the commit-then-throw body carries what it committed', () => {
  // B-2 / C-4 / C-7: a body that says `persisted: true` and nothing else is
  // unusable — the chips never retire, the arena renders nothing, the belief
  // stays stale and the next tap 409s against the player's own filing.
  it('B-2: a throw after the commit answers 500 WITH the directive, the replaced thread and the counter', async () => {
    const res = await post(BODY, { breakResponse: true });
    expect(res.statusCode).toBe(500);
    expect(res.body.persisted).toBe(true);
    expect(res.body.charged).toBe(true);
    expect(res.body.reason).toBe('failed_after_commit');
    expect(res.body.status).toBe(FILING_STATUS.FILED);
    expect(res.body.directive.text).toBe(DV02);
    expect(res.body.directive.directiveThreadId).toBe(state.battle.directive.directiveThreadId);
    expect(res.body.remaining).toBe(BATTLE_CHAT_BUDGET.limit - 3);
  });
});
