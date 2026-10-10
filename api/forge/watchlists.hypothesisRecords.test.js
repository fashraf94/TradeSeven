// api/forge/watchlists.hypothesisRecords.test.js
//
// Pilot P1a — the owner routes and the save path, end to end through the
// transactions (pilot spec V1.4 §2.1, §2.2, §2.5; the build prompt's
// acceptance rows 1–6):
//   1  the gate — off for the caller: every new route 404 { error: 'disabled' }
//      with zero store access; the save path writes what it wrote before
//   2  allocation — version conflict, opId idempotent replay, opId conflict,
//      no overwrite
//   3  content immutability — no route changes content (checked on EVERY
//      write of EVERY test, afterEach); an edit of an ever-committed or
//      activated version is a new version
//   4  every transition, every illegal pair, fresh-read compare-and-set (a
//      stale concurrent transition loses cleanly)
//   5  reaffirm — the new version is ready; the old keeps its status and clock
//      and gains successorVersion
//   6  horizon capture for the four origins, plus a player override
//
// The store is the general optimistic double (api/_utils/__fixtures__/callsFirestore.js),
// with auto-id allocation added for the save path's `collection('watchlists').doc()`.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeCallsFirestore, stored } from '../_utils/__fixtures__/callsFirestore.js';
import {
  HYPOTHESIS_STATUSES, LIFECYCLE_FIELDS, CONTENT_FIELDS, contentHashOf, PLAYER_TRANSITIONS, legalTransition,
  REAFFIRM_SUCCESSOR_STATUSES,
} from '../_utils/hypothesisRecords/model.js';

const state = vi.hoisted(() => ({ flagOn: true, user: { uid: 'owner-1' }, authCalls: 0 }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flagOn; } };
});
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    state.authCalls += 1;
    if (!state.user) { res.status(401).json({ error: 'auth required' }); return null; }
    return state.user;
  },
}));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async () => {} }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { default: createHandler } = await import('./watchlists.js');
const { default: versionsHandler } = await import('./watchlists/[id]/hypothesis-versions.js');
const { default: transitionHandler } = await import('./watchlists/[id]/hypothesis-transition.js');

const OWNER = 'owner-1';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
let savedEnv;

// ── store + request helpers ────────────────────────────────────────────────
function makeDb(docs = {}) {
  const db = makeCallsFirestore({ docs });
  const collection = db.collection;
  let n = 0;
  db.collection = (name) => {
    const c = collection(name);
    return { ...c, doc: (id) => c.doc(id ?? `auto-wl-${++n}`) };
  };
  // The Admin SDK's Transaction.getAll refuses zero arguments (@google-cloud/firestore
  // validateMinNumberOfArguments('Transaction.getAll', …, 1)); the double does not — so it is
  // enforced here (Pilot P1b mutation lens, ST03: a reaffirm of a CURRENT due version reads no
  // newer version and must never call getAll()).
  const runTx = db.runTransaction.bind(db);
  db.runTransaction = (cb, opts) => runTx(async (tx) => {
    const getAll = tx.getAll;
    tx.getAll = (...refs) => {
      if (refs.length < 1) throw new Error('Function "Transaction.getAll()" requires at least 1 argument.');
      return getAll(...refs);
    };
    return cb(tx);
  }, opts);
  activeDb = db;
  return db;
}
function makeRes() {
  const out = { statusCode: null, body: null };
  out.status = (code) => ({ json: (payload) => { out.statusCode = code; out.body = payload; return out; } });
  return out;
}
async function call(handler, { method = 'POST', id = 'wl-1', body = {}, query = {} } = {}) {
  const res = makeRes();
  await handler({ method, headers: {}, query: { id, ...query }, body }, res);
  return res;
}
const versions = (opts) => call(versionsHandler, opts);
const transition = (body, id = 'wl-1') => call(transitionHandler, { id, body });
const vPath = (n, wl = 'wl-1') => `watchlists/${wl}/hypothesisVersions/v${n}`;

const NOW = '2026-10-07T14:00:00.000Z';
const list = (over = {}) => ({
  watchlistId: 'wl-1', userId: OWNER, agentId: null, sourceSessionId: null, sourceDropId: null, thesis: '', activationConditions: [],
  invalidationConditions: [], tickers: [{ symbol: 'NVDA' }], name: 'AI', notes: '', status: 'committed', createdAt: NOW, updatedAt: NOW, committedAt: NOW, ...over,
});
const version = (n, over = {}) => ({
  version: n, watchlistId: 'wl-1', userId: OWNER, opId: `seed-${n}`, opFingerprint: 'f'.repeat(64), createdAt: NOW,
  statement: `idea v${n}`, horizonEnum: 'swing', horizonSource: 'parse', activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'signaldrop',
  status: 'researched', stateChangedAt: NOW, stateSource: 'research', stateReason: 'dialogue_completed', missingEvidence: null, successorVersion: null,
  firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null, ...over,
});
const withHash = (v) => ({ ...v, contentHash: contentHashOf(v) });
/** A list holding versions 1..n (the last current) — each a valid stored record. */
function seedList(listOver = {}, versionOvers = [{}]) {
  const docs = { 'watchlists/wl-1': list({ currentHypothesisVersion: versionOvers.length, hypothesisVersionCount: versionOvers.length, ...listOver }) };
  versionOvers.forEach((o, i) => { docs[vPath(i + 1)] = withHash(version(i + 1, o)); });
  return makeDb(docs);
}

// ── the universal content-immutability check (acceptance row 3) ──────────────
// Every write any test makes to a version document is a CREATE, or an UPDATE
// that names lifecycle fields only. No route rewrites a content field, the
// hash, or an identity field — ever.
afterEach(() => {
  if (!activeDb) return;
  for (const w of activeDb.__access.writes) {
    if (!w.path || !/\/hypothesisVersions\//.test(w.path)) continue;
    expect(['create', 'update'], `${w.op} on ${w.path}`).toContain(w.op);
    if (w.op === 'update') expect(Object.keys(w.data).every((k) => LIFECYCLE_FIELDS.includes(k)), `update keys ${Object.keys(w.data)} on ${w.path}`).toBe(true);
    if (w.op === 'create') expect(w.data.contentHash).toBe(contentHashOf(w.data));
  }
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  state.flagOn = true;
  state.user = { uid: OWNER };
  state.authCalls = 0;
  savedEnv = process.env[ENV];
  process.env[ENV] = `${OWNER},owner-2`;
  activeDb = null;
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV]; else process.env[ENV] = savedEnv;
  vi.useRealTimers();
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 1 — the gate', () => {
  const ROUTES = [
    ['GET versions', () => versions({ method: 'GET' })],
    ['GET one version', () => versions({ method: 'GET', query: { version: '1' } })],
    ['POST a version', () => versions({ body: { opId: 'op-1', expectedVersion: 1, statement: 'x' } })],
    ['POST a transition', () => transition({ version: 1, action: 'ready', expectedStatus: 'researched' })],
    ['POST a reaffirmation', () => transition({ version: 1, action: 'reaffirm', opId: 'op-1', expectedVersion: 1 })],
    ['DELETE (an unsupported method)', () => call(versionsHandler, { method: 'DELETE' })],
  ];
  for (const [label, go] of ROUTES) {
    it(`flag OFF: ${label} → 404 { error: 'disabled' } before auth, with ZERO store access`, async () => {
      state.flagOn = false;
      const db = seedList();
      const res = await go();
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'disabled' });
      expect(state.authCalls).toBe(0);
      expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
    });
    it(`flag on, caller OFF the allowlist: ${label} → the same 404, after auth, with ZERO store access`, async () => {
      process.env[ENV] = 'someone-else';
      const db = seedList();
      const res = await go();
      // Every method, the unsupported one included: the allowlist answers before the method check (review L3-1).
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'disabled' });
      expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
    });
  }
  it('flag on, an allowlisted caller with an unsupported method → 405 (the method is checked only once the gate is on)', async () => {
    seedList();
    const res = await call(versionsHandler, { method: 'DELETE' });
    expect(res.statusCode).toBe(405);
  });
  it('flag on, NO verified token → 401 before the allowlist (the gate is per verified uid; the house order)', async () => {
    state.user = null;
    const db = seedList();
    const res = await versions({ method: 'GET' });
    expect(res.statusCode).toBe(401);
    expect(db.__access).toEqual({ reads: [], writes: [], queries: [] });
  });
  it('an empty or missing allowlist resolves OFF for everyone', async () => {
    for (const v of [undefined, '', '  ,  ']) {
      if (v === undefined) delete process.env[ENV]; else process.env[ENV] = v;
      seedList();
      const res = await versions({ method: 'GET' });
      expect(res.body).toEqual({ error: 'disabled' });
    }
  });
});

// ── the save path ──────────────────────────────────────────────────────────
const SESSION_ID = 'sess-1';
const session = (over = {}) => ({
  userId: OWNER, agentId: 'agent-1', dropId: 'drop-1', status: 'active', phase: 'refine',
  parseResult: { contentHash: 'h', parse: { timeHorizon: 'swing' } },
  anatomy: { thesis: 'Rates fall and small caps rip', activationConditions: ['IWM > 220'], invalidationConditions: [] },
  candidateTickers: [{ symbol: 'IWM', reasoning: 'r', category: 'c', status: 'kept' }],
  ...over,
});
const save = () => call(createHandler, { method: 'POST', id: undefined, body: { sessionId: SESSION_ID, agentId: 'agent-1', dropId: 'drop-1' } });
const saveDb = (sessionOver) => makeDb({ [`watchlistSessions/${SESSION_ID}`]: session(sessionOver) });

// The save transaction's writes exactly as the pre-build handler made them
// (api/forge/watchlists.js at main 8c9ea5ef) — the gate-off golden.
const PRE_BUILD_SAVE_WRITES = [
  {
    op: 'set', path: 'watchlists/auto-wl-1',
    data: {
      watchlistId: 'auto-wl-1', userId: OWNER, agentId: 'agent-1', sourceSessionId: SESSION_ID, sourceDropId: 'drop-1',
      thesis: 'Rates fall and small caps rip', activationConditions: ['IWM > 220'], invalidationConditions: [],
      tickers: [{ symbol: 'IWM', reasoning: 'r', category: 'c', addedBy: 'agent', addedAt: NOW }],
      name: '', notes: '', status: 'draft', createdAt: NOW, updatedAt: NOW, committedAt: null,
    },
    merge: false,
  },
  { op: 'update', path: `watchlistSessions/${SESSION_ID}`, data: { status: 'completed', dropListId: 'auto-wl-1', updatedAt: NOW }, merge: false },
];
const PRE_BUILD_SAVE_RESPONSE = { watchlistId: 'auto-wl-1', status: 'draft', tickerCount: 1, createdAt: NOW, idempotent: false };

describe('row 1 — the save path with the gate off is the pre-build save, byte for byte', () => {
  it('flag OFF → the transaction writes exactly the pre-build list + session update; no version, no pointer; same response', async () => {
    state.flagOn = false;
    const db = saveDb();
    const res = await save();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(PRE_BUILD_SAVE_RESPONSE);
    expect(db.__access.writes).toEqual(PRE_BUILD_SAVE_WRITES);
    expect(JSON.stringify(db.__access.writes)).toBe(JSON.stringify(PRE_BUILD_SAVE_WRITES));
    expect([...db.__docs.keys()].some((p) => p.includes('hypothesis'))).toBe(false);
  });
  it('flag on, saver OFF the allowlist → identical to the flag-off save', async () => {
    process.env[ENV] = 'someone-else';
    const db = saveDb();
    const res = await save();
    expect(res.body).toEqual(PRE_BUILD_SAVE_RESPONSE);
    expect(JSON.stringify(db.__access.writes)).toBe(JSON.stringify(PRE_BUILD_SAVE_WRITES));
  });
});

describe('row 6 — the automatic v1 at dialogue save (gate on)', () => {
  it('a SignalDrop (paste) session → v1 researched / dialogue_completed, horizon from the parse (source parse), pointer 1/1 — in the SAME transaction', async () => {
    const db = saveDb();
    const res = await save();
    expect(res.body).toEqual(PRE_BUILD_SAVE_RESPONSE); // the response is unchanged
    const v1 = stored(db, 'watchlists/auto-wl-1/hypothesisVersions/v1');
    expect(v1).toMatchObject({
      version: 1, watchlistId: 'auto-wl-1', userId: OWNER, opId: `save_${SESSION_ID}`, createdAt: NOW,
      statement: 'Rates fall and small caps rip', horizonEnum: 'swing', horizonSource: 'parse', origin: 'signaldrop',
      activation: [], invalidation: [], evidenceRefs: [], publishedAt: null,
      status: 'researched', stateSource: 'research', stateReason: 'dialogue_completed', stateChangedAt: NOW,
      successorVersion: null, firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null,
    });
    expect(stored(db, 'watchlists/auto-wl-1')).toMatchObject({ ...PRE_BUILD_SAVE_WRITES[0].data, currentHypothesisVersion: 1, hypothesisVersionCount: 1 });
    // One transaction: the list set, the v1 create and the session update commit together.
    expect(db.__access.writes.map((w) => [w.op, w.path])).toEqual([
      ['set', 'watchlists/auto-wl-1'], ['create', 'watchlists/auto-wl-1/hypothesisVersions/v1'], ['update', `watchlistSessions/${SESSION_ID}`],
    ]);
    expect(db.__txAttempts).toBe(1);
  });
  it('every parse horizon is carried exactly', async () => {
    for (const h of ['intraday', 'swing', 'positional', 'longterm', 'unspecified']) {
      const db = saveDb({ parseResult: { parse: { timeHorizon: h } } });
      await save();
      expect(stored(db, 'watchlists/auto-wl-1/hypothesisVersions/v1')).toMatchObject({ horizonEnum: h, horizonSource: 'parse' });
    }
  });
  it('a THEME session → origin theme, unspecified / theme_default', async () => {
    const db = saveDb({ source: 'theme', themeId: 'th-1', parseResult: { contentHash: null, parse: { timeHorizon: 'unspecified' } } });
    await save();
    expect(stored(db, 'watchlists/auto-wl-1/hypothesisVersions/v1')).toMatchObject({ origin: 'theme', horizonEnum: 'unspecified', horizonSource: 'theme_default' });
  });
  it('an EMPTY thesis → no version and no pointer; the list is written as before', async () => {
    const db = saveDb({ anatomy: { thesis: '   ', activationConditions: [], invalidationConditions: [] } });
    await save();
    expect(stored(db, 'watchlists/auto-wl-1/hypothesisVersions/v1')).toBeNull();
    expect(stored(db, 'watchlists/auto-wl-1')).not.toHaveProperty('currentHypothesisVersion');
    expect(stored(db, 'watchlists/auto-wl-1')).not.toHaveProperty('hypothesisVersionCount');
  });
  it('a double-tap re-save is idempotent: no second version, no write', async () => {
    const db = saveDb();
    await save();
    const writes = db.__access.writes.length;
    const again = await save();
    expect(again.body).toMatchObject({ watchlistId: 'auto-wl-1', idempotent: true });
    expect(db.__access.writes.length).toBe(writes);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 6 — horizon capture for the manual and screener origins, and a player override (POST a version)', () => {
  const first = (body = {}) => versions({ body: { opId: 'op-1', expectedVersion: 0, statement: '  Grid capex  ', ...body } });
  it('MANUAL list v1 → draft / player_authored, unspecified / default, origin manual; pointer 1', async () => {
    const db = makeDb({ 'watchlists/wl-1': list() });
    const res = await first();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ watchlistId: 'wl-1', idempotent: false });
    expect(stored(db, vPath(1))).toMatchObject({
      version: 1, userId: OWNER, opId: 'op-1', statement: 'Grid capex', horizonEnum: 'unspecified', horizonSource: 'default', origin: 'manual',
      status: 'draft', stateSource: 'player', stateReason: 'player_authored',
    });
    expect(stored(db, 'watchlists/wl-1')).toMatchObject({ currentHypothesisVersion: 1, hypothesisVersionCount: 1 });
  });
  it('SCREENER list v1 → origin screener, unspecified / default', async () => {
    const db = makeDb({ 'watchlists/wl-1': list({ sourceScreenSpec: { filters: [{ field: 'rsi', op: 'lt', value: 30 }] } }) });
    await first();
    expect(stored(db, vPath(1))).toMatchObject({ origin: 'screener', horizonEnum: 'unspecified', horizonSource: 'default' });
  });
  it('a PLAYER pick → that enum with source player (unspecified included — a pick is a pick)', async () => {
    for (const h of ['longterm', 'unspecified']) {
      const db = makeDb({ 'watchlists/wl-1': list() });
      await first({ horizonEnum: h });
      expect(stored(db, vPath(1))).toMatchObject({ horizonEnum: h, horizonSource: 'player' });
    }
  });
  it('a session-derived list with no version yet (its thesis was empty at save) → the session\'s horizon and origin', async () => {
    // (A dialogue list names its session AND its drop — P2 tells it from a screener-linked list that way.)
    let db = makeDb({ 'watchlists/wl-1': list({ sourceSessionId: 's-1', sourceDropId: 'drop-1' }), 'watchlistSessions/s-1': session({ parseResult: { parse: { timeHorizon: 'positional' } } }) });
    await first();
    expect(stored(db, vPath(1))).toMatchObject({ origin: 'signaldrop', horizonEnum: 'positional', horizonSource: 'parse', status: 'draft' });
    db = makeDb({ 'watchlists/wl-1': list({ sourceSessionId: 's-1', sourceDropId: 'drop-1' }), 'watchlistSessions/s-1': session({ source: 'theme' }) });
    await first();
    expect(stored(db, vPath(1))).toMatchObject({ origin: 'theme', horizonEnum: 'unspecified', horizonSource: 'theme_default' });
  });
  it('a session-derived list whose session is gone → 409 origin_unresolved (an origin is never guessed)', async () => {
    const db = makeDb({ 'watchlists/wl-1': list({ sourceSessionId: 's-gone', sourceDropId: 'drop-1' }) });
    const res = await first();
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('origin_unresolved');
    expect(db.__access.writes).toEqual([]);
  });
  it('conditions are accepted typed and stored typed; malformed input is a typed 400', async () => {
    const db = makeDb({ 'watchlists/wl-1': list() });
    const res = await first({ activation: [{ symbol: 'nvda', side: 'above', level: 150, basis: 'daily_close' }] });
    expect(res.statusCode).toBe(200);
    expect(stored(db, vPath(1)).activation).toEqual([{ symbol: 'NVDA', side: 'above', level: 150, basis: 'daily_close' }]);
    for (const [body, code] of [
      [{ statement: '   ' }, 'invalid_statement'], [{ statement: 7 }, 'invalid_statement'], [{ horizonEnum: 'weekly' }, 'invalid_horizon'],
      [{ opId: 'a/b' }, 'invalid_op_id'], [{ expectedVersion: -1 }, 'invalid_expected_version'], [{ expectedVersion: '0' }, 'invalid_expected_version'],
      [{ activation: [{ symbol: 'NVDA', side: 'above', level: 0, basis: 'daily_close' }] }, 'invalid_condition'],
    ]) {
      const bad = await versions({ body: { opId: 'op-2', expectedVersion: 1, statement: 'x', ...body } });
      expect([bad.statusCode, bad.body.error]).toEqual([400, code]);
    }
  });
  it('ownership: another owner → 403; a soft-deleted or missing list → 404 — nothing written', async () => {
    let db = makeDb({ 'watchlists/wl-1': list({ userId: 'owner-2' }) });
    expect((await first()).statusCode).toBe(403);
    db = makeDb({ 'watchlists/wl-1': list({ deletedAt: NOW }) });
    expect((await first()).statusCode).toBe(404);
    db = makeDb({});
    expect((await first()).body.error).toBe('not_found');
    expect(db.__access.writes).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 2 — allocation', () => {
  const edit = (body = {}) => versions({ body: { opId: 'op-edit', expectedVersion: 1, statement: 'sharper idea', ...body } });
  it('VERSION CONFLICT: a stale expectedVersion → typed 409 version_conflict with the current pointer; nothing written', async () => {
    const db = seedList({}, [{}, {}]);
    const res = await edit({ expectedVersion: 1 });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'version_conflict', currentVersion: 2 });
    expect(db.__access.writes).toEqual([]);
  });
  it('opId IDEMPOTENT REPLAY: the same opId and payload → 200 idempotent with the SAME version; nothing written the second time', async () => {
    const db = seedList();
    const first = await edit();
    const writes = db.__access.writes.length;
    const again = await edit();
    expect(again.statusCode).toBe(200);
    expect(again.body.idempotent).toBe(true);
    expect(again.body.version).toEqual(first.body.version);
    expect(db.__access.writes.length).toBe(writes);
    expect(stored(db, vPath(3))).toBeNull();
  });
  it('the replay is still recognised after the version\'s lifecycle moved (the fingerprint is identity, never state)', async () => {
    const db = seedList();
    await edit();
    expect((await transition({ version: 2, action: 'cancel', expectedStatus: 'draft' })).statusCode).toBe(200);
    const again = await edit();
    expect(again.body).toMatchObject({ idempotent: true, version: { version: 2 } });
    expect(stored(db, 'watchlists/wl-1').currentHypothesisVersion).toBe(2);
  });
  it('opId CONFLICT: the same opId with a different payload → typed 409 op_conflict naming the existing version; nothing written', async () => {
    const db = seedList();
    await edit();
    const writes = db.__access.writes.length;
    for (const body of [{ statement: 'a different idea' }, { horizonEnum: 'longterm' }, { expectedVersion: 2 }]) {
      const res = await edit(body);
      expect(res.statusCode).toBe(409);
      expect(res.body).toMatchObject({ error: 'op_conflict', version: 2 });
    }
    expect(db.__access.writes.length).toBe(writes);
  });
  it('NO OVERWRITE: a version already at the next slot (a pointer that lags) is never replaced — the create fails, the stored version is intact', async () => {
    const db = seedList({ currentHypothesisVersion: 1, hypothesisVersionCount: 1 });
    db.__docs.set(vPath(2), withHash(version(2, { statement: 'already here', status: 'ready' })));
    const before = stored(db, vPath(2));
    const res = await edit();
    expect(res.statusCode).toBe(500);
    expect(stored(db, vPath(2))).toEqual(before);
    expect(stored(db, 'watchlists/wl-1').currentHypothesisVersion).toBe(1);
  });
  it('two racing creates on the same pointer: one wins, the other loses cleanly with version_conflict', async () => {
    const db = seedList();
    let raced = false;
    db.__hooks.afterTxBody = async () => {
      if (raced) return;
      raced = true;
      db.__hooks.afterTxBody = null;
      const r = await versions({ body: { opId: 'op-racer', expectedVersion: 1, statement: 'the racer' } });
      expect(r.statusCode).toBe(200);
    };
    const res = await edit();
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'version_conflict', currentVersion: 2 });
    expect(stored(db, vPath(2)).statement).toBe('the racer');
    expect(stored(db, vPath(3))).toBeNull();
  });
  it('a well-formed pointer naming a MISSING version → 500 pointer_corrupt, nothing written — never first-version defaults (review L5-7)', async () => {
    const db = makeDb({ 'watchlists/wl-1': list({ currentHypothesisVersion: 2, hypothesisVersionCount: 2 }), [vPath(1)]: withHash(version(1)) });
    const res = await versions({ body: { opId: 'op-1', expectedVersion: 2, statement: 'edit' } });
    expect([res.statusCode, res.body.error]).toEqual([500, 'pointer_corrupt']);
    expect(db.__access.writes).toEqual([]);
  });
  it('the statement is REQUIRED on create: a body with only a time-frame pick → 400 invalid_statement, nothing written (review L5-8)', async () => {
    const db = seedList();
    const res = await versions({ body: { opId: 'op-1', expectedVersion: 1, horizonEnum: 'longterm' } });
    expect([res.statusCode, res.body.error]).toEqual([400, 'invalid_statement']);
    expect(db.__access.writes).toEqual([]);
  });
  it('a corrupt parent pointer is a 500, never a silent reset to v1', async () => {
    const db = seedList({ currentHypothesisVersion: 'two' });
    const res = await edit();
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('pointer_corrupt');
    expect(db.__access.writes).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 3 — content is immutable; an edit is a new version', () => {
  for (const status of ['ready', 'activated', 'researched', 'retired']) {
    it(`"save as a new version" of a ${status} v1 (on a committed list) → v2 draft with the edit; v1's content, hash, status and clock untouched, successorVersion 2`, async () => {
      const db = seedList({}, [{ status, firstDeployedAt: status === 'activated' ? NOW : null }]);
      const before = stored(db, vPath(1));
      const res = await versions({ body: { opId: 'op-edit', expectedVersion: 1, statement: 'edited idea', horizonEnum: 'longterm' } });
      expect(res.statusCode).toBe(200);
      expect(stored(db, vPath(2))).toMatchObject({
        version: 2, statement: 'edited idea', horizonEnum: 'longterm', horizonSource: 'player', origin: 'signaldrop', status: 'draft', successorVersion: null,
      });
      expect(stored(db, vPath(1))).toEqual({ ...before, successorVersion: 2 });
      expect(stored(db, 'watchlists/wl-1')).toMatchObject({ currentHypothesisVersion: 2, hypothesisVersionCount: 2, status: 'committed' });
    });
  }
  it('an edit inherits what it does not send: horizon (with its source), conditions, origin', async () => {
    const db = seedList({}, [{ horizonEnum: 'positional', horizonSource: 'parse', activation: [{ symbol: 'IWM', side: 'above', level: 220, basis: 'daily_close' }], origin: 'theme' }]);
    await versions({ body: { opId: 'op-edit', expectedVersion: 1, statement: 'edited' } });
    expect(stored(db, vPath(2))).toMatchObject({
      horizonEnum: 'positional', horizonSource: 'parse', origin: 'theme', activation: [{ symbol: 'IWM', side: 'above', level: 220, basis: 'daily_close' }],
    });
  });
  it('while the current version is review_due, "save as new version" is refused (409 illegal_transition, use reaffirm)', async () => {
    const db = seedList({}, [{ status: 'review_due' }]);
    const res = await versions({ body: { opId: 'op-edit', expectedVersion: 1, statement: 'edited' } });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'illegal_transition', status: 'review_due', use: 'reaffirm' });
    expect(db.__access.writes).toEqual([]);
  });
  it('no route body field can reach a content field of an existing version (transition bodies carrying content are ignored)', async () => {
    const db = seedList();
    const before = stored(db, vPath(1));
    const res = await transition({ version: 1, action: 'ready', expectedStatus: 'researched', statement: 'hijack', horizonEnum: 'intraday', contentHash: 'x', origin: 'manual' });
    expect(res.statusCode).toBe(200);
    const after = stored(db, vPath(1));
    for (const k of [...CONTENT_FIELDS, 'contentHash']) expect(after[k]).toEqual(before[k]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 4 — every transition through the route, every illegal pair refused', () => {
  const ACTIONS = Object.keys(PLAYER_TRANSITIONS);
  for (const status of HYPOTHESIS_STATUSES) {
    for (const action of ACTIONS) {
      const legal = legalTransition(status, action);
      it(`${status} --${action}--> ${legal ? legal.to : '409 illegal_transition'}`, async () => {
        const db = seedList({}, [{ status, missingEvidence: status === 'waiting_for_evidence' ? 'Q3 guidance' : null }]);
        const before = stored(db, vPath(1));
        vi.setSystemTime(new Date('2026-10-08T15:00:00.000Z'));
        const res = await transition({ version: 1, action, expectedStatus: status, missingEvidence: 'Q3 guidance' });
        if (!legal) {
          expect(res.statusCode).toBe(409);
          expect(res.body).toMatchObject({ error: 'illegal_transition', status });
          expect(stored(db, vPath(1))).toEqual(before);
          return;
        }
        expect(res.statusCode).toBe(200);
        const expected = {
          ...before, status: legal.to, stateChangedAt: '2026-10-08T15:00:00.000Z', stateSource: 'player', stateReason: legal.reason,
          missingEvidence: legal.to === 'waiting_for_evidence' ? 'Q3 guidance' : null,
        };
        expect(stored(db, vPath(1))).toEqual(expected);
        expect(res.body.version).toEqual(expected);
      });
    }
  }
  it('waiting_for_evidence REQUIRES the missing evidence (typed 400); it is stored, and cleared on ready', async () => {
    const db = seedList();
    for (const missingEvidence of [undefined, '', '   ']) {
      const res = await transition({ version: 1, action: 'wait', expectedStatus: 'researched', missingEvidence });
      expect([res.statusCode, res.body.error]).toEqual([400, 'missing_evidence_required']);
    }
    await transition({ version: 1, action: 'wait', expectedStatus: 'researched', missingEvidence: '  the Q3 print  ' });
    expect(stored(db, vPath(1))).toMatchObject({ status: 'waiting_for_evidence', missingEvidence: 'the Q3 print', stateReason: 'awaiting_evidence' });
    await transition({ version: 1, action: 'ready', expectedStatus: 'waiting_for_evidence' });
    expect(stored(db, vPath(1))).toMatchObject({ status: 'ready', missingEvidence: null, stateReason: 'evidence_supplied' });
  });
  it('COMPARE-AND-SET: an expectedStatus that no longer matches → typed 409 status_conflict naming the fresh status; nothing written', async () => {
    const db = seedList({}, [{ status: 'rejected' }]);
    const res = await transition({ version: 1, action: 'ready', expectedStatus: 'researched' });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'status_conflict', status: 'rejected' });
    expect(db.__access.writes).toEqual([]);
  });
  it('a STALE CONCURRENT transition loses cleanly: the competitor commits first, the re-read finds the moved status, 409, no second write', async () => {
    const db = seedList();
    let raced = false;
    db.__hooks.afterTxBody = async () => {
      if (raced) return;
      raced = true;
      db.__hooks.afterTxBody = null;
      const r = await transition({ version: 1, action: 'reject', expectedStatus: 'researched' });
      expect(r.statusCode).toBe(200);
    };
    const res = await transition({ version: 1, action: 'ready', expectedStatus: 'researched' });
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'status_conflict', status: 'rejected' });
    expect(stored(db, vPath(1))).toMatchObject({ status: 'rejected', stateReason: 'player_rejected' });
    expect(db.__access.writes.filter((w) => w.path === vPath(1))).toHaveLength(1);
  });
  it('a SUPERSEDED version can only be closed: ready / wait refused, reject / cancel / retire allowed', async () => {
    let db = seedList({}, [{ status: 'researched', successorVersion: 2 }, { status: 'draft' }]);
    for (const action of ['ready', 'wait']) {
      const res = await transition({ version: 1, action, expectedStatus: 'researched', missingEvidence: 'x' });
      expect(res.statusCode).toBe(409);
      expect(res.body).toMatchObject({ error: 'illegal_transition', superseded: true });
    }
    for (const action of ['reject', 'cancel', 'retire']) {
      db = seedList({}, [{ status: 'researched', successorVersion: 2 }, { status: 'draft' }]);
      expect((await transition({ version: 1, action, expectedStatus: 'researched' })).statusCode).toBe(200);
    }
  });
  it('typed 400s for an unknown action, an unknown expectedStatus, a malformed version; 404 for a missing version', async () => {
    seedList();
    for (const [body, code] of [
      [{ version: 1, action: 'promote', expectedStatus: 'researched' }, 'invalid_action'],
      [{ version: 1, action: 'ready', expectedStatus: 'great' }, 'invalid_expected_status'],
      [{ version: 0, action: 'ready', expectedStatus: 'researched' }, 'invalid_version'],
      [{ version: '1', action: 'ready', expectedStatus: 'researched' }, null],
    ]) {
      const res = await transition(body);
      if (code) expect([res.statusCode, res.body.error]).toEqual([400, code]);
      else expect(res.statusCode).toBe(200);
    }
    seedList();
    const missing = await transition({ version: 9, action: 'retire', expectedStatus: 'researched' });
    expect([missing.statusCode, missing.body.error]).toEqual([404, 'version_not_found']);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('row 5 — reaffirmation', () => {
  const DUE = {
    status: 'review_due', stateChangedAt: '2026-10-21T21:00:00.000Z', stateSource: 'review_pass', stateReason: 'horizon_elapsed',
    firstDeployedAt: '2026-10-07T14:00:00.000Z', lastDeployedAt: '2026-10-07T14:00:00.000Z', lastDeployedBattleId: 'b-1', reviewDueAt: '2026-10-21T20:00:00.000Z',
  };
  const reaffirm = (body = {}) => transition({ version: 1, action: 'reaffirm', opId: 'op-re', expectedVersion: 1, ...body });

  it('SAME content → v{n+1} in ready (player / reaffirmed), identical content and hash, a fresh lifecycle with no clock; pointer moves', async () => {
    const db = seedList({}, [DUE]);
    const before = stored(db, vPath(1));
    vi.setSystemTime(new Date('2026-10-22T13:00:00.000Z'));
    const res = await reaffirm();
    expect(res.statusCode).toBe(200);
    expect(res.body.idempotent).toBe(false);
    const v2 = stored(db, vPath(2));
    for (const k of [...CONTENT_FIELDS, 'contentHash']) expect(v2[k]).toEqual(before[k]);
    expect(v2).toMatchObject({
      version: 2, opId: 'op-re', createdAt: '2026-10-22T13:00:00.000Z', status: 'ready', stateSource: 'player', stateReason: 'reaffirmed',
      stateChangedAt: '2026-10-22T13:00:00.000Z', successorVersion: null, firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null,
    });
    expect(stored(db, 'watchlists/wl-1')).toMatchObject({ currentHypothesisVersion: 2, hypothesisVersionCount: 2 });
  });
  it('the DUE version keeps its status, reason, content and clock EXACTLY — only successorVersion is added', async () => {
    const db = seedList({}, [DUE]);
    const before = stored(db, vPath(1));
    await reaffirm();
    expect(stored(db, vPath(1))).toEqual({ ...before, successorVersion: 2 });
  });
  it('EDITED content → the edit lands on the new version (a player horizon is source player); the due version is untouched', async () => {
    const db = seedList({}, [DUE]);
    const before = stored(db, vPath(1));
    await reaffirm({ statement: 'the sharper idea', horizonEnum: 'positional' });
    expect(stored(db, vPath(2))).toMatchObject({ statement: 'the sharper idea', horizonEnum: 'positional', horizonSource: 'player', status: 'ready' });
    expect(stored(db, vPath(1))).toEqual({ ...before, successorVersion: 2 });
  });
  it('only a review_due version reaffirms: from any other status → 409 illegal_transition, nothing written', async () => {
    for (const status of HYPOTHESIS_STATUSES.filter((s) => s !== 'review_due')) {
      const db = seedList({}, [{ status }]);
      const res = await reaffirm();
      expect([res.statusCode, res.body.error]).toEqual([409, 'illegal_transition']);
      expect(db.__access.writes).toEqual([]);
    }
  });
  // Pilot P1b — founder ruling B4 (P1a carry-forward 2, review L2-3) replaces P1a's "current and
  // successor-free only": a due version may be reaffirmed when EVERY newer version is pre-deploy.
  it('P1b acceptance row 7 (B4) — a superseded due version reaffirms when every newer version is pre-deploy: v{current+1} in ready from the DUE content, on the pointer; the chain pointer lands on the current version; the due version is untouched', async () => {
    expect([...REAFFIRM_SUCCESSOR_STATUSES].sort()).toEqual(['cancelled', 'draft', 'ready', 'rejected', 'researched', 'waiting_for_evidence']);
    for (const newer of REAFFIRM_SUCCESSOR_STATUSES) {
      const db = seedList({}, [{ ...DUE, successorVersion: 2 }, { status: newer, statement: 'an edit made while it ran' }]);
      const dueBefore = stored(db, vPath(1));
      const newerBefore = stored(db, vPath(2));
      const res = await transition({ version: 1, action: 'reaffirm', opId: `op-b4-${newer}`, expectedVersion: 2 });
      expect([res.statusCode, newer]).toEqual([200, newer]);
      const v3 = stored(db, vPath(3));
      for (const k of [...CONTENT_FIELDS, 'contentHash']) expect(v3[k], `${newer} · ${k}`).toEqual(dueBefore[k]);
      expect(v3).toMatchObject({ version: 3, status: 'ready', stateReason: 'reaffirmed', firstDeployedAt: null, reviewDueAt: null });
      expect(stored(db, 'watchlists/wl-1')).toMatchObject({ currentHypothesisVersion: 3, hypothesisVersionCount: 3 });
      expect(stored(db, vPath(1)), newer).toEqual(dueBefore); // successorVersion 2 kept — never rewritten
      expect(stored(db, vPath(2)), newer).toEqual({ ...newerBefore, successorVersion: 3 });
    }
  });
  it('P1b acceptance row 7 (B4) — refused (409 illegal_transition, naming the blocker, nothing written) when ANY newer version is not pre-deploy; a stale pointer is a version_conflict', async () => {
    for (const blocker of HYPOTHESIS_STATUSES.filter((st) => !REAFFIRM_SUCCESSOR_STATUSES.includes(st))) {
      const db = seedList({}, [DUE, { status: 'draft' }, { status: blocker }]);
      const res = await transition({ version: 1, action: 'reaffirm', opId: 'op-x', expectedVersion: 3 });
      expect([res.statusCode, res.body.error, blocker]).toEqual([409, 'illegal_transition', blocker]);
      expect(res.body.blockedBy).toEqual({ version: 3, status: blocker });
      expect(db.__access.writes).toEqual([]);
    }
    expect(HYPOTHESIS_STATUSES.filter((st) => !REAFFIRM_SUCCESSOR_STATUSES.includes(st)).sort()).toEqual(['activated', 'invalidated', 'retired', 'review_due']);
    const db = seedList({}, [DUE, { status: 'draft' }]);
    const stale = await transition({ version: 1, action: 'reaffirm', opId: 'op-y', expectedVersion: 1 });
    expect(stale.body).toMatchObject({ error: 'version_conflict', currentVersion: 2 });
    const beyond = await transition({ version: 3, action: 'reaffirm', opId: 'op-z', expectedVersion: 2 });
    expect([beyond.statusCode, beyond.body.error]).toEqual([404, 'version_not_found']);
    expect(db.__access.writes).toEqual([]);
  });
  it('B4 / review L2-3 — the bound matches the page the Forge shows: 99 newer versions → reaffirmable (the due version is on the 100-version page); 100 newer → refused, fail closed, nothing written', async () => {
    const drafts = (k) => Array.from({ length: k }, () => ({ status: 'draft' }));
    let db = seedList({}, [DUE, ...drafts(99)]);
    let res = await transition({ version: 1, action: 'reaffirm', opId: 'op-99', expectedVersion: 100 });
    expect(res.statusCode).toBe(200);
    expect(stored(db, vPath(101))).toMatchObject({ status: 'ready', stateReason: 'reaffirmed' });
    db = seedList({}, [DUE, ...drafts(100)]);
    res = await transition({ version: 1, action: 'reaffirm', opId: 'op-100', expectedVersion: 101 });
    expect([res.statusCode, res.body.error]).toEqual([409, 'illegal_transition']);
    expect(db.__access.writes).toEqual([]);
  });
  it('B4 — reaffirming the same due version again is legal (its newer version is the ready one it made) and mints the next version; the current-version-due case keeps P1a\'s shape', async () => {
    const db = seedList({}, [DUE]);
    await reaffirm();
    expect(stored(db, vPath(1)).successorVersion).toBe(2);
    const second = await transition({ version: 1, action: 'reaffirm', opId: 'op-re-2', expectedVersion: 2 });
    expect(second.statusCode).toBe(200);
    expect(stored(db, vPath(3))).toMatchObject({ status: 'ready', stateReason: 'reaffirmed' });
    expect(stored(db, vPath(1)).successorVersion).toBe(2);
    expect(stored(db, vPath(2)).successorVersion).toBe(3);
  });
  it('allocation rules hold for reaffirm: replay → idempotent; same opId other payload → op_conflict; stale pointer → version_conflict', async () => {
    const db = seedList({}, [DUE]);
    const first = await reaffirm();
    const writes = db.__access.writes.length;
    const replay = await reaffirm();
    expect(replay.body).toMatchObject({ idempotent: true, version: first.body.version });
    expect(db.__access.writes.length).toBe(writes);
    const conflict = await reaffirm({ statement: 'something else' });
    expect([conflict.statusCode, conflict.body.error]).toEqual([409, 'op_conflict']);
    const fresh = seedList({}, [DUE]);
    const stale = await transition({ version: 1, action: 'reaffirm', opId: 'op-x', expectedVersion: 0 });
    expect(stale.body).toMatchObject({ error: 'version_conflict', currentVersion: 1 });
    expect(fresh.__access.writes).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Pilot P1b — founder ruling B3: the GET names the FROZEN list the newest due
// version rode in (its deploying battle's own snapshot), for the Forge's
// [SYM] / [LIST] line. Only when the page holds a due version; a battle that
// cannot prove it (another owner, another version, unreadable) gives {}.
describe('P1b — the frozen list on the versions GET (deployedLists)', () => {
  const SIB = (n) => ({ watchlistId: 'wl-1', hypothesisVersion: n });
  const battleDoc = (over = {}) => ({
    ownerId: OWNER, status: 'completed',
    agentContext: { equippedWatchlist: { watchlistId: 'wl-1', name: 'AI capex', tickers: ['NVDA', 'AMD'], snapshotAt: NOW }, equippedHypothesis: SIB(1) },
    ...over,
  });
  const DUE_V = { status: 'review_due', stateReason: 'horizon_elapsed', firstDeployedAt: NOW, lastDeployedAt: NOW, lastDeployedBattleId: 'battle-9', reviewDueAt: NOW };
  it('no due version in the page → the P1a body exactly (no deployedLists key, no battle read)', async () => {
    const db = seedList({}, [{ status: 'activated', firstDeployedAt: NOW, lastDeployedBattleId: 'battle-9' }]);
    const res = await versions({ method: 'GET' });
    expect(Object.keys(res.body).sort()).toEqual(['currentVersion', 'research', 'versions', 'watchlistId']);
    expect(db.__access.reads.filter((r) => r.startsWith('agentBattles/'))).toEqual([]);
  });
  it('a due version deployed in the owner\'s battle that carried it → { [version]: { battleId, name, tickers } } from the battle, not the live list', async () => {
    const db = seedList({ name: 'Renamed live', tickers: [{ symbol: 'TSLA' }] }, [DUE_V]);
    db.__docs.set('agentBattles/battle-9', battleDoc());
    const res = await versions({ method: 'GET' });
    expect(res.body.deployedLists).toEqual({ 1: { battleId: 'battle-9', name: 'AI capex', tickers: ['NVDA', 'AMD'] } });
  });
  it('a battle that cannot prove it — another owner, another version, no snapshot, missing — gives {} (the line is then not rendered)', async () => {
    for (const battle of [battleDoc({ ownerId: 'someone-else' }), battleDoc({ agentContext: { ...battleDoc().agentContext, equippedHypothesis: SIB(2) } }),
      battleDoc({ agentContext: { equippedHypothesis: SIB(1) } }), null]) {
      const db = seedList({}, [DUE_V]);
      if (battle) db.__docs.set('agentBattles/battle-9', battle);
      const res = await versions({ method: 'GET' });
      expect([res.statusCode, res.body.deployedLists]).toEqual([200, {}]);
    }
  });
  it('an unreadable battle never fails the GET: {} and a 200', async () => {
    const db = seedList({}, [DUE_V]);
    const base = db.collection;
    db.collection = (name) => (name === 'agentBattles'
      ? { doc: () => ({ get: async () => { throw new Error('UNAVAILABLE'); } }) }
      : base(name));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await versions({ method: 'GET' });
    expect([res.statusCode, res.body.deployedLists]).toEqual([200, {}]);
    expect(res.body.versions).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe('the list and read routes', () => {
  it('GET → the list\'s versions newest first, with the parent pointer', async () => {
    seedList({}, [{ status: 'retired', successorVersion: 2 }, { status: 'retired', successorVersion: 3 }, { status: 'draft' }]);
    const res = await versions({ method: 'GET' });
    expect(res.statusCode).toBe(200);
    expect(res.body.currentVersion).toBe(3);
    expect(res.body.versions.map((v) => v.version)).toEqual([3, 2, 1]);
  });
  it('GET reads the pointer and the versions from ONE snapshot: a create landing between the reads never yields a stale pointer (review L2-4)', async () => {
    const db = seedList();
    let landed = false;
    db.__hooks.afterTxBody = async () => {
      if (landed) return;
      landed = true;
      db.__hooks.afterTxBody = null;
      await db.doc(vPath(2)).create(withHash(version(2, { status: 'draft' })));
      await db.doc('watchlists/wl-1').update({ currentHypothesisVersion: 2, hypothesisVersionCount: 2 });
    };
    const res = await versions({ method: 'GET' });
    expect(res.statusCode).toBe(200);
    expect(res.body.currentVersion).toBe(2);
    expect(res.body.versions[0].version).toBe(2);
  });
  it('GET on a list with no version → currentVersion 0 and an empty list', async () => {
    makeDb({ 'watchlists/wl-1': list() });
    const res = await versions({ method: 'GET' });
    // Pilot P2: the list's research summaries ride the same answer (none here).
    expect(res.body).toEqual({ watchlistId: 'wl-1', currentVersion: 0, versions: [], research: [] });
  });
  it('GET ?version=n → one version; a missing one → 404 version_not_found; a malformed one → 400', async () => {
    seedList({}, [{}, {}]);
    expect((await versions({ method: 'GET', query: { version: '2' } })).body.version.version).toBe(2);
    expect((await versions({ method: 'GET', query: { version: '7' } })).body.error).toBe('version_not_found');
    expect((await versions({ method: 'GET', query: { version: 'v2' } })).body.error).toBe('invalid_version');
  });
  it('GET of another owner\'s list → 403; never lists their versions', async () => {
    seedList({ userId: 'owner-2' });
    const res = await versions({ method: 'GET' });
    expect([res.statusCode, res.body.error]).toEqual([403, 'forbidden']);
  });
  it('an invalid watchlist id → 400 before any read', async () => {
    const db = seedList();
    const res = await call(versionsHandler, { method: 'GET', id: 'a/b' });
    expect([res.statusCode, res.body.error]).toEqual([400, 'invalid_watchlist_id']);
    expect(db.__access.reads).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// The BUILD_RULES §2 mutation lens (L5, the versions GET and reaffirm): each row below kills a mutant that survived
// the first pass; the mutant ids are the lens's (review report §9.2).

describe('mutation lens rows — the versions GET and reaffirm (H02, H07, ST07)', () => {
  const SIB = (n) => ({ watchlistId: 'wl-1', hypothesisVersion: n });
  const bdoc = (n, name) => ({ ownerId: OWNER, status: 'completed', agentContext: { equippedWatchlist: { watchlistId: 'wl-1', name, tickers: ['NVDA', 'AMD'], snapshotAt: NOW }, equippedHypothesis: SIB(n) } });
  const DUE = (battleId) => ({ status: 'review_due', stateReason: 'horizon_elapsed', firstDeployedAt: NOW, lastDeployedAt: NOW, lastDeployedBattleId: battleId, reviewDueAt: NOW });
  it('H07 — a superseded due version (newer draft) still gets its frozen list', async () => {
    const db = seedList({}, [DUE('battle-9'), { status: 'draft' }]);
    db.__docs.set('agentBattles/battle-9', bdoc(1, 'AI capex'));
    const res = await versions({ method: 'GET' });
    expect(res.body.deployedLists).toEqual({ 1: { battleId: 'battle-9', name: 'AI capex', tickers: ['NVDA', 'AMD'] } });
  });
  it('H02 — two due versions: the NEWEST one is named', async () => {
    const db = seedList({}, [DUE('battle-8'), DUE('battle-9')]);
    db.__docs.set('agentBattles/battle-8', bdoc(1, 'Old list'));
    db.__docs.set('agentBattles/battle-9', bdoc(2, 'AI capex'));
    const res = await versions({ method: 'GET' });
    expect(res.body.deployedLists).toEqual({ 2: { battleId: 'battle-9', name: 'AI capex', tickers: ['NVDA', 'AMD'] } });
  });
  it('ST07 — a hole in the numbering (a newer version missing) refuses the reaffirmation (409, nothing written), never a crash', async () => {
    const db = seedList({}, [{ status: 'review_due', stateReason: 'horizon_elapsed', firstDeployedAt: NOW, lastDeployedBattleId: 'b-1', reviewDueAt: NOW }, { status: 'draft' }, { status: 'draft' }]);
    db.__docs.delete(vPath(2));
    const res = await transition({ version: 1, action: 'reaffirm', opId: 'op-hole', expectedVersion: 3 });
    expect([res.statusCode, res.body.error]).toEqual([409, 'illegal_transition']);
    expect(db.__access.writes).toEqual([]);
  });
});
