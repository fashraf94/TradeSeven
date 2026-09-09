// api/agent/research.cap.test.js
//
// Phase C §4 / V1.1 ruling 2-3 (D-118, D-122) — THE CAP UNDER RACES.
//
// Sol C-2's five required tests, verbatim from the ruling:
//   1. two simultaneous taps with one slot remaining produce ONE card;
//   2. a failed transaction consumes NO slot;
//   3. two browser tabs cannot create a fourth card;
//   4. no optimistic client increment survives a failed route;
//   5. the exhausted state and the pre-tap `3 of 3` state have an explicit
//      enabled/disabled contract.
//
// (4) and (5) are the CLIENT's halves and live in
// src/screens/battleView/showItDoor.jsdom.test.jsx; (4) is also asserted here
// from the server side — the route's answer to a fourth tap is the thing the
// client is forbidden to pre-empt.
//
// The fake Firestore is file-directive.test.js's: a transaction buffers its
// writes and, on injected contention, DISCARDS the buffer and re-runs the body
// against the changed doc, the way the real client retries. That retry is what
// makes "the count is re-read inside the transaction" a testable claim rather
// than a comment.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  showIt: true,
  uid: 'owner-1',
  battle: null,
  txThrows: false,
  reads: 0,
  attempts: 0,
  committed: [],
  injectBeforeCommit: null,
  pauseInTx: null,
}));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: state.uid }) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SHOW_IT_ENABLED() { return state.showIt; },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: async () => ({
    daily: [{ date: '2026-09-08', close: 150, high: 152, low: 148, volume: 7e6 }],
    price: { current: 151.27, timestamp: 1788962400 },
  }),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }) },
}));

// A SNAPSHOT IS TAKEN AT READ TIME, not when `data()` is called. The first draft
// spread the LIVE battle inside `data()`, so a parked transaction still saw
// writes that landed while it was parked — which quietly made the concurrency
// row untestable (it read the post-commit doc and refused for the wrong reason).
function docSnap(data, id) {
  const frozen = data == null ? null : { ...data };
  return { exists: frozen != null, id, data: () => (frozen == null ? undefined : frozen) };
}
function readDoc(col, id) {
  state.reads += 1;
  if (col === 'agentBattles') return docSnap(state.battle && state.battle.__id === id ? state.battle : null, id);
  return docSnap(null, id);
}
function applyWrite(w) {
  if (w.col !== 'agentBattles') return;
  const b = state.battle;
  for (const [k, v] of Object.entries(w.data)) {
    if (v && v.__op === 'arrayUnion') b[k] = [...(b[k] || []), ...v.items];
    else b[k] = v;
  }
}
// THE FAKE MODELS FIRESTORE'S READ-SET CONFLICT DETECTION (review C-4 / E-6).
//
// The first draft of this harness committed every transaction body
// unconditionally, so "two simultaneous taps" could not distinguish the
// in-transaction re-read from the pre-check: eight genuinely interleaved bodies
// all read the same count and all committed. A real Firestore transaction
// serialises on the documents it READ — if any of them changed between the read
// and the commit, the commit is rejected and the body re-runs. `docVersion`
// below is that: every write bumps it, every `tx.get` records it, and a commit
// whose recorded version is stale is discarded and retried.
let docVersion = 0;
const db = {
  collection: (col) => ({ doc: (id) => ({ __col: col, __id: id, get: async () => readDoc(col, id) }) }),
  runTransaction: async (fn) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      state.attempts += 1;
      const buffer = [];
      const readVersions = new Map();
      const tx = {
        get: async (ref) => {
          if (buffer.length > 0) throw new Error('transaction read after write');
          readVersions.set(`${ref.__col}/${ref.__id}`, docVersion);
          // The snapshot is taken FIRST, then the body is parked: a transaction
          // that reads and only then discovers the doc moved is the interleaving
          // worth testing. Parking before the read would just hand it the
          // already-updated doc, which proves nothing about the precondition.
          const snap = readDoc(ref.__col, ref.__id);
          if (state.pauseInTx) { const p = state.pauseInTx; state.pauseInTx = null; await p(); }
          return snap;
        },
        update: (ref, data) => buffer.push({ col: ref.__col, id: ref.__id, data, op: 'update' }),
      };
      const result = await fn(tx);
      if (state.injectBeforeCommit && attempt === 1) {
        state.injectBeforeCommit();
        state.injectBeforeCommit = null;
        continue;
      }
      if (state.txThrows) throw new Error('commit failed');
      // The precondition: nothing this body READ may have moved under it.
      const stale = buffer.length > 0 && [...readVersions.values()].some((v) => v !== docVersion);
      if (stale) continue;                       // discard the buffer, re-run
      for (const w of buffer) { applyWrite(w); state.committed.push(w); }
      if (buffer.length > 0) docVersion += 1;
      return result;
    }
    throw new Error('transaction contention exhausted');
  },
};
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));

// Dependency-surface guard (BUILD_RULES §4). Never mock it.
const { default: handler, RESEARCH_STATUS } = await import('./research.js');
const { RESEARCH_CAP, countResearchUsed } = await import('../../src/data/researchCap.js');

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const post = async (body = BODY) => { const res = mkRes(); await handler({ method: 'POST', body }, res); return res; };
const BODY = { agentId: 'agent-1', battleId: 'battle-1', symbol: 'MPC' };

const card = (n) => ({ messageType: 'research', symbol: `X${n}`, card: {} });
function makeBattle(usedCards = 0) {
  return {
    __id: 'battle-1', ownerId: 'owner-1', agentId: 'agent-1', status: 'active',
    portfolio: { star: [], core: [], support: [], bench: { stocks: [{ symbol: 'MPC' }] } },
    chatExchanges: Array.from({ length: usedCards }, (_, i) => card(i)),
  };
}
const used = () => countResearchUsed(state.battle.chatExchanges);

beforeEach(() => {
  state.showIt = true;
  state.uid = 'owner-1';
  state.battle = makeBattle(0);
  state.txThrows = false;
  state.reads = 0;
  state.attempts = 0;
  state.committed = [];
  state.injectBeforeCommit = null;
  state.pauseInTx = null;
  docVersion = 0;
});

describe('1. two simultaneous taps with ONE slot remaining produce ONE card', () => {
  it('GENUINELY CONCURRENT: both taps are in flight together, one card is written', async () => {
    state.battle = makeBattle(2);            // one slot left
    // Tap A is suspended INSIDE its transaction, after its read. Tap B then runs
    // start to finish and commits. A resumes: its commit is rejected because the
    // doc moved under its read, its body re-runs, and the re-read finds the cap
    // spent. This is the interleaving Sol's test names, and it exercises the
    // in-transaction re-read rather than the pre-check.
    let release;
    let signalParked;
    const held = new Promise((r) => { release = r; });
    const parked = new Promise((r) => { signalParked = r; });
    state.pauseInTx = () => { signalParked(); return held; };

    const a = post();
    await parked;                            // A is INSIDE its transaction, after its read
    const b = await post();                  // B runs start to finish and commits
    release();
    const first = await a;                   // A resumes into a doc that moved

    expect(b.statusCode).toBe(200);
    expect(first.statusCode).toBe(409);
    expect(first.body.status).toBe(RESEARCH_STATUS.EXHAUSTED);
    expect(state.attempts).toBeGreaterThanOrEqual(3);   // A really did re-run
    expect(used()).toBe(RESEARCH_CAP);
  });

  it('sequentially, the second tap is refused too — the doc holds exactly three', async () => {
    state.battle = makeBattle(2);
    const first = await post();
    const second = await post();
    expect(first.statusCode).toBe(200);
    expect(first.body.used).toBe(3);
    expect(second.statusCode).toBe(409);
    expect(used()).toBe(RESEARCH_CAP);
  });

  it('a competing write landing BETWEEN the read and the commit re-runs the body and refuses', async () => {
    state.battle = makeBattle(2);
    // The other tab's card lands after this transaction read its count and
    // before it committed. The retry re-reads and finds the cap spent.
    state.injectBeforeCommit = () => { state.battle.chatExchanges.push(card(99)); };
    const res = await post();
    expect(state.attempts).toBe(2);          // the body really re-ran
    expect(res.statusCode).toBe(409);
    expect(res.body.status).toBe(RESEARCH_STATUS.EXHAUSTED);
    expect(used()).toBe(RESEARCH_CAP);       // three, not four
    expect(state.committed).toEqual([]);     // and this request wrote nothing
  });
});

describe('2. a failed transaction consumes NO slot', () => {
  it('a commit that throws writes nothing and leaves the count where it was', async () => {
    state.battle = makeBattle(1);
    state.txThrows = true;
    const res = await post();
    expect(res.statusCode).toBe(500);
    expect(used()).toBe(1);                  // unchanged
    expect(state.committed).toEqual([]);
    // …and the next tap still has its slot.
    state.txThrows = false;
    const ok = await post();
    expect(ok.statusCode).toBe(200);
    expect(ok.body.used).toBe(2);
  });

  it('a request refused at the gate consumes no slot either', async () => {
    state.battle = makeBattle(1);
    expect((await post({ ...BODY, symbol: 'TSLA' })).statusCode).toBe(404);
    expect((await post({ ...BODY, agentId: 'other' })).statusCode).toBe(403);
    expect(used()).toBe(1);
  });
});

describe('3. two browser tabs cannot create a fourth card', () => {
  it('four taps IN FLIGHT AT ONCE leave exactly three cards', async () => {
    // No pre-check can save this one: all four requests read the battle before
    // any of them commits, so every one of them passes the fast-fail. Only the
    // transaction's read-set precondition keeps the fourth out.
    const results = await Promise.all([post(), post(), post(), post()]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(RESEARCH_CAP);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(1);
    expect(used()).toBe(RESEARCH_CAP);
  });

  it('a tab holding a STALE count of 0 is still refused — the route, not the client, is the authority', async () => {
    // The tab's door still reads `1 of 3` because its snapshot has not landed.
    // The request it sends is identical to a first tap; the route refuses it.
    state.battle = makeBattle(RESEARCH_CAP);
    const res = await post();
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ status: RESEARCH_STATUS.EXHAUSTED, used: 3, remaining: 0, cap: 3 });
    expect(used()).toBe(RESEARCH_CAP);
  });
});

describe('4. the counts the client reconciles to (the server half)', () => {
  it('every answer carries used / remaining / cap, so no client has to derive them', async () => {
    state.battle = makeBattle(0);
    expect((await post()).body).toMatchObject({ used: 1, remaining: 2, cap: 3 });
    expect((await post()).body).toMatchObject({ used: 2, remaining: 1, cap: 3 });
    expect((await post()).body).toMatchObject({ used: 3, remaining: 0, cap: 3 });
    expect((await post()).body).toMatchObject({ used: 3, remaining: 0, cap: 3 });
  });

  it('a FAILED route returns no count at all — there is nothing for a client to adopt', async () => {
    state.battle = makeBattle(0);
    state.txThrows = true;
    const res = await post();
    expect(res.body.used).toBeUndefined();
    expect(res.body.remaining).toBeUndefined();
    expect(used()).toBe(0);
  });
});

describe('the cap is DERIVED, not stored (D-118)', () => {
  it('no counter key is ever written — the only field the route touches is chatExchanges', async () => {
    await post();
    await post();
    for (const w of state.committed) expect(Object.keys(w.data)).toEqual(['chatExchanges']);
    expect(state.battle.researchUsed).toBeUndefined();
    expect(state.battle.chatBudgetUsed).toBeUndefined();
  });
});
