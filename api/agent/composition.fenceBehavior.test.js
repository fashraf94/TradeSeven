// api/agent/composition.fenceBehavior.test.js
//
// Composition PR 3 — ledger item B8: the per-writer BEHAVIORAL fence suite.
// PR 2 proved fence-on behavior for 2 of the censused writers and covered the
// rest with order-checked static wiring proof (lens-1 C5 residue). This suite
// drives EVERY server writer class in compositionWriterCensus.json under
// (a) a CLOSED epoch and (b) a MISMATCHED epoch (present doc, state !== 'open'
// — e.g. a mid-transition 'draining' or corrupted value; the helpers are
// fail-closed on present-but-not-open as of PR 3, aligning them with the
// rules layer's `data.state == 'open'`), and asserts the ledger's four
// outcomes: rejection sentinel, ZERO writes, no compiled-build mutation, no
// success response.
//
// Non-vacuity: the `epoch_closed` error code is produced by NOTHING except
// the fence — a row that asserts it cannot pass unless the writer genuinely
// reached and tripped the fence.
//
// CLI scripts (rule-compat-cleanup, mastery-preflip-normalize,
// ws1-observe-walk, migration-scan) execute main() at import and need Admin
// creds, so their class is covered by the direct helper rows below
// (assertWriteEpochOpen closed/mismatched) × the census wiring proof — the
// same composition PR 2 used, now with both helper arms behaviorally pinned.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CENSUS = JSON.parse(readFileSync(resolve(HERE, '../_utils/compositionWriterCensus.json'), 'utf8'));

const flagState = { fence: true, mode: 'off' };
vi.mock('../_utils/compositionConfig.js', () => ({
  get COMPOSITION_ENFORCEMENT_MODE() { return flagState.mode; },
  get COMPOSITION_EPOCH_FENCE_ENABLED() { return flagState.fence; },
  get COMPOSITION_MIGRATION_FEED_ENABLED() { return false; },
  get COMPOSITION_COMPILED_IDENTITY_ENABLED() { return false; },
}));

let activeFirestore = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeFirestore }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: 'owner-1' }) }));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async () => {} }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { validateWriteEpochInTx, assertWriteEpochOpen } = await import('../_utils/compositionWriteEpoch.js');
const { ensureDeployableCompiledBuild } = await import('../_utils/deployBuildValidation.js');
const { ensureCasualClone } = await import('../_utils/casualClone.js');
const { softDeleteReplacedTraitRuleDocs } = await import('../_utils/archetypeSeeding.js');

// ── the fake: agents + arbitrary subcollections + the epoch doc, with write
//    and compiled-build counters ────────────────────────────────────────────
function makeFake({ agentDocs = {}, subDocs = {}, topDocs = {}, epochDoc = null } = {}) {
  const state = { agentDocs, subDocs, topDocs, epochDoc, writes: 0, compiledBuildWrites: 0, epochReads: 0 };
  const bump = (name) => { state.writes += 1; if (name === 'compiledBuilds') state.compiledBuildWrites += 1; };

  const subRef = (agentId, name, docId) => ({
    id: docId,
    path: `agents/${agentId}/${name}/${docId}`,
    get: async () => {
      const d = state.subDocs[`${agentId}/${name}/${docId}`];
      return { exists: d !== undefined, data: () => d, id: docId };
    },
    set: async (data) => { bump(name); state.subDocs[`${agentId}/${name}/${docId}`] = data; },
    update: async (u) => { bump(name); state.subDocs[`${agentId}/${name}/${docId}`] = { ...state.subDocs[`${agentId}/${name}/${docId}`], ...u }; },
    create: async (data) => { bump(name); state.subDocs[`${agentId}/${name}/${docId}`] = data; },
  });

  const agentRef = (id) => ({
    id,
    path: `agents/${id}`,
    firestore: db, // archetypeSeeding reaches the db through the ref
    get: async () => ({ exists: !!state.agentDocs[id], data: () => state.agentDocs[id], id }),
    update: async (u) => { state.writes += 1; state.agentDocs[id] = { ...state.agentDocs[id], ...u }; },
    set: async (d) => { state.writes += 1; state.agentDocs[id] = d; },
    create: async (d) => { state.writes += 1; state.agentDocs[id] = d; },
    collection: (name) => ({
      doc: (docId = `auto-${state.writes}`) => subRef(id, name, docId),
      where: () => ({ get: async () => ({ docs: [], empty: true, size: 0 }) }),
      get: async () => ({ docs: [], empty: true, size: 0 }),
    }),
  });

  const epochRef = { get: async () => { state.epochReads += 1; return { exists: !!state.epochDoc, data: () => state.epochDoc }; } };

  const db = {
    collection: (name) => {
      if (name === 'agents') return { doc: (id) => agentRef(id), where: () => ({ get: async () => ({ docs: [], empty: true }) }) };
      if (name === 'composition') return { doc: (docId) => { if (docId !== 'writeEpoch') throw new Error(`wrong epoch doc id: ${docId}`); return epochRef; } };
      return { doc: (docId) => ({
        get: async () => {
          const d = state.topDocs[`${name}/${docId}`];
          return { exists: d !== undefined, data: () => d, id: docId };
        },
        set: async (data) => { state.writes += 1; state.topDocs[`${name}/${docId}`] = data; },
        update: async (u) => { state.writes += 1; state.topDocs[`${name}/${docId}`] = { ...state.topDocs[`${name}/${docId}`], ...u }; },
      }) };
    },
    runTransaction: async (fn) => fn({
      get: async (ref) => ref.get(),
      getAll: async (...refs) => Promise.all(refs.map((r) => r.get())),
      update: async (ref, u) => ref.update(u),
      set: async (ref, d) => ref.set(d),
      create: async (ref, d) => ref.create(d),
    }),
    batch: () => ({ _ops: [], set(ref, d) { this._ops.push(() => ref.set(d)); }, update(ref, u) { this._ops.push(() => ref.update(u)); }, commit: async function () { for (const op of this._ops) await op(); } }),
  };
  return { db, state };
}

function makeReqRes(body) {
  const req = { method: 'POST', body };
  const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
  return { req, res };
}

// A maximal plausible agent so every endpoint survives its pre-fence reads.
const AGENT = {
  ownerId: 'owner-1', archetype: 'degen', settingsRev: 3,
  equippedBundleIds: ['bundle-1'], equippedTraits: [], activeRules: [],
  standingLeans: [{ adjustmentId: 'SP-01', version: 1 }],
  dials: { tempo: 'measured' }, equippedWatchlistId: 'w-1',
};
const SUBDOCS = {
  'agent-1/bundles/bundle-1': {
    status: 'forged', ruleIds: ['rd1'], ruleHardness: {},
    ruleSnapshots: [{ id: 'rd1', sourceRef: 'tech-volume-surge', paramValues: {}, params: {} }],
  },
};

// The eleven censused endpoints, each with a body + fixture that PROVABLY
// reaches its write path (review F2: the open-arm control below drives every
// row to a 200 WITH writes, so no closed-arm zero-writes assertion can be
// vacuous). overrides: {agent, subDocs, topDocs} merged over the base fixture.
const ENDPOINT_ROWS = [
  ['api/agent/equip-bundle.js', { agentId: 'agent-1', bundleId: 'bundle-1' }, {}],
  ['api/agent/unequip-bundle.js', { agentId: 'agent-1', bundleId: 'bundle-1' },
    { subDocs: { 'agent-1/bundles/bundle-1': { status: 'equipped', ruleIds: ['rd1'], ruleHardness: {}, ruleSnapshots: [{ id: 'rd1', sourceRef: 'tech-volume-surge', paramValues: {}, params: {} }] } } }],
  ['api/agent/equip-lean.js', { agentId: 'agent-1', adjustmentId: 'SP-02', version: 1 },
    { agent: { standingLeans: [] } }],
  ['api/agent/unequip-lean.js', { agentId: 'agent-1', adjustmentId: 'SP-01' }, {}],
  ['api/agent/equip-watchlist.js', { agentId: 'agent-1', watchlistId: 'w-2' },
    { topDocs: { 'watchlists/w-2': { name: 'W2', userId: 'owner-1', status: 'committed', tickers: ['AAPL', 'MSFT'], thesis: 't' } } }],
  ['api/agent/unequip-watchlist.js', { agentId: 'agent-1' }, {}],
  ['api/agent/change-archetype.js', { agentId: 'agent-1', archetype: 'contrarian' }, {}],
  ['api/agent/update-agent-settings.js', { agentId: 'agent-1', set: { equippedTraits: [{ traitId: 'trait-bargain-hunter' }] } }, {}],
  ['api/agent/set-tempo-dial.js', { agentId: 'agent-1', tempo: 'aggressive' }, {}],
  ['api/agent/set-rule-hardness.js', { agentId: 'agent-1', bundleId: 'bundle-1', ruleId: 'rd1', value: 'hard' },
    { subDocs: { 'agent-1/bundles/bundle-1': { status: 'draft', ruleIds: ['rd1'], ruleHardness: {}, ruleSnapshots: [{ id: 'rd1', sourceRef: 'tech-volume-surge', paramValues: {}, params: {} }] } } }],
  ['api/agent/reforge-bundle.js', { agentId: 'agent-1', bundleId: 'bundle-1' }, {}],
];

function fixtureFor(overrides = {}, epochDoc = null) {
  return makeFake({
    agentDocs: { 'agent-1': { ...AGENT, ...(overrides.agent ?? {}) } },
    subDocs: { ...SUBDOCS, ...(overrides.subDocs ?? {}) },
    topDocs: { ...(overrides.topDocs ?? {}) },
    epochDoc,
  });
}

const EPOCH_ARMS = [
  ['CLOSED', { state: 'closed', epochId: 'e-2' }],
  ['MISMATCHED (present, state=draining)', { state: 'draining', epochId: 'e-9' }],
];

beforeEach(() => { flagState.fence = true; flagState.mode = 'off'; activeFirestore = null; });

describe('B8 — census completeness: this suite drives every censused endpoint', () => {
  it('the ENDPOINT_ROWS list equals census.fencedEndpoints exactly', () => {
    expect(ENDPOINT_ROWS.map(([f]) => f).sort()).toEqual([...CENSUS.fencedEndpoints].sort());
  });
});

describe.each(EPOCH_ARMS)('B8 — %s epoch: every fenced endpoint rejects with nothing written', (_arm, epochDoc) => {
  it.each(ENDPOINT_ROWS)('%s → 409 epoch_closed, writes=0, no build mutation, no success', async (file, body, overrides) => {
    const { db, state } = fixtureFor(overrides, { ...epochDoc });
    activeFirestore = db;
    const { default: handler } = await import(`./${file.split('/').pop()}`);
    const { req, res } = makeReqRes(body);
    await handler(req, res);
    expect(res.statusCode, `${file}: ${JSON.stringify(res.body)}`).toBe(409);
    expect(res.body.error).toBe('epoch_closed');
    expect(state.writes).toBe(0);
    expect(state.compiledBuildWrites).toBe(0);
  });
});

describe.each(EPOCH_ARMS)('B8 — %s epoch: the non-endpoint server writer classes', (_arm, epochDoc) => {
  it('deploy gate (ensureDeployableCompiledBuild) → {proceed:false, reason:epoch_closed}, zero writes', async () => {
    const { db, state } = makeFake({ agentDocs: { 'agent-1': { ...AGENT } }, epochDoc: { ...epochDoc } });
    const out = await ensureDeployableCompiledBuild({ db, agentRef: db.collection('agents').doc('agent-1'), agentId: 'agent-1', gameMode: 'clash', enabled: true });
    expect(out.proceed).toBe(false);
    expect(out.reason).toBe('epoch_closed');
    expect(state.writes).toBe(0);
  });

  it('casualClone provisioner → rejects at entry, zero writes', async () => {
    const { db, state } = makeFake({ epochDoc: { ...epochDoc } });
    await expect(ensureCasualClone(db, { odUserId: 'owner-1' })).rejects.toMatchObject({ code: 'epoch_closed' });
    expect(state.writes).toBe(0);
  });

  it('archetypeSeeding.softDeleteReplacedTraitRuleDocs (the post-commit rules-store writer) → skips, zero writes', async () => {
    const { db, state } = makeFake({ agentDocs: { 'agent-1': { ...AGENT } }, epochDoc: { ...epochDoc } });
    const n = await softDeleteReplacedTraitRuleDocs(db.collection('agents').doc('agent-1'), 'degen', 'contrarian');
    expect(n).toBe(0);
    expect(state.writes).toBe(0);
  });

  it('the shared background/CLI guard (assertWriteEpochOpen) → throws epoch_closed', async () => {
    const { db } = makeFake({ epochDoc: { ...epochDoc } });
    await expect(assertWriteEpochOpen(db, { enabled: true })).rejects.toMatchObject({ code: 'epoch_closed' });
  });

  it('the transactional helper (validateWriteEpochInTx) → throws epoch_closed inside the tx', async () => {
    const { db } = makeFake({ epochDoc: { ...epochDoc } });
    await expect(db.runTransaction((tx) => validateWriteEpochInTx(tx, db, { enabled: true }))).rejects.toMatchObject({ code: 'epoch_closed' });
  });
});

describe('B8 — the arms are not vacuous: an OPEN epoch admits', () => {
  it('open epoch doc → validateWriteEpochInTx returns {state:open}, assertWriteEpochOpen resolves', async () => {
    const { db } = makeFake({ epochDoc: { state: 'open', epochId: 'e-1' } });
    await expect(db.runTransaction((tx) => validateWriteEpochInTx(tx, db, { enabled: true }))).resolves.toMatchObject({ state: 'open' });
    await expect(assertWriteEpochOpen(db, { enabled: true })).resolves.toBeNull();
  });

  it.each(ENDPOINT_ROWS)('open epoch → %s proceeds past the fence to a 200 WITH writes (the anti-vacuity control for its closed-arm rows)', async (file, body, overrides) => {
    const { db, state } = fixtureFor(overrides, { state: 'open', epochId: 'e-1' });
    activeFirestore = db;
    const { default: handler } = await import(`./${file.split('/').pop()}`);
    const { req, res } = makeReqRes(body);
    await handler(req, res);
    expect(res.statusCode, `${file}: ${JSON.stringify(res.body)}`).toBe(200);
    expect(state.writes, `${file} wrote nothing under an OPEN epoch — its closed-arm zero-writes rows would be vacuous`).toBeGreaterThan(0);
  });
});
