// api/forge/researchRecordExtension.routes.test.js
//
// The Research Record Extension (7 Nov 2026; contract
// docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md §3, §5) — NO ROUTE
// ACCEPTS A CLIENT-SUPPLIED ORIGIN OR REF. Every route that writes an idea
// version or a list is driven with the new fields planted in its body (an
// origin, refs of every kind, the Shared Research list marker, the server-only
// parameter's own name), and what it stores is exactly what the same request
// without them stores. A source census pins who may NAME the marker and the
// server-only ref parameter at all: the model that defines them and the store
// that takes server refs — no route, no client module.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { makeCallsFirestore, stored } from '../_utils/__fixtures__/callsFirestore.js';
import { SHARED_RESEARCH_LIST_MARKER } from '../_utils/hypothesisRecords/model.js';

const state = vi.hoisted(() => ({ user: { uid: 'owner-1' } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return true; } };
});
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => state.user }));
vi.mock('../_utils/shadowLogger.js', () => ({ logSignalDrops: async () => {}, logConversation: async () => true }));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));

const { default: createHandler } = await import('./watchlists.js');
const { default: patchHandler } = await import('./watchlists/[id].js');
const { default: versionsHandler } = await import('./watchlists/[id]/hypothesis-versions.js');
const { default: transitionHandler } = await import('./watchlists/[id]/hypothesis-transition.js');

const OWNER = 'owner-1';
const ENV = 'COCKPIT_ALLOWLIST_UIDS';
const NOW = '2026-11-07T14:00:00.000Z';
const UUID = '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c';

/** Everything a client might try to plant: an origin, refs of every kind, the list marker, the server-only parameter's name. */
const PLANTED = Object.freeze({
  origin: 'shared_research',
  evidenceRefs: [
    { kind: 'researchWork', id: 'sr_forged-1' },
    { kind: 'evidenceItem', recordKind: 'symbolDayEvidence', recordId: '2026-11-06_NVDA', itemId: 'news-1' },
    { kind: 'exchange', hostCollection: 'sharedResearchSessions', hostId: 'forged', exchangeId: UUID },
  ],
  serverEvidenceRefs: [{ kind: 'exchange', hostCollection: 'sharedResearchSessions', hostId: 'forged', exchangeId: UUID }],
  [SHARED_RESEARCH_LIST_MARKER]: 'forged-session',
  publishedAt: '2026-11-01',
});

function makeDb(docs = {}) {
  const db = makeCallsFirestore({ docs });
  const collection = db.collection;
  let n = 0;
  db.collection = (name) => {
    const c = collection(name);
    return { ...c, doc: (id) => c.doc(id ?? `auto-wl-${++n}`) };
  };
  activeDb = db;
  return db;
}
function makeRes() {
  const out = { statusCode: null, body: null };
  out.status = (code) => { out.statusCode = code; return out; };
  out.json = (payload) => { out.body = payload; return out; };
  out.setHeader = () => out;
  return out;
}
async function call(handler, { method = 'POST', id = 'wl-1', body = {} } = {}) {
  const res = makeRes();
  await handler({ method, headers: {}, query: { id }, body }, res);
  return res;
}
const list = (over = {}) => ({
  watchlistId: 'wl-1', userId: OWNER, agentId: null, sourceSessionId: null, sourceDropId: null, thesis: '', activationConditions: [],
  invalidationConditions: [], tickers: [{ symbol: 'NVDA' }], name: 'AI', notes: '', status: 'committed', createdAt: NOW, updatedAt: NOW, committedAt: NOW, ...over,
});
const vPath = (n) => `watchlists/wl-1/hypothesisVersions/v${n}`;
/** The same request twice — once clean, once with PLANTED — and both stores' documents. */
async function pairOf(docs, run, body) {
  const clean = makeDb(structuredClone(docs));
  const a = await run(body);
  const planted = makeDb(structuredClone(docs));
  const b = await run({ ...PLANTED, ...body });
  return { clean, planted, a, b };
}

let saved;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  saved = process.env[ENV];
  process.env[ENV] = OWNER;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  if (saved === undefined) delete process.env[ENV]; else process.env[ENV] = saved;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('no route accepts a client-supplied origin or ref', () => {
  it('POST a version (create): the planted origin, refs and marker change nothing — origin derived, refs the server\'s', async () => {
    const run = (body) => call(versionsHandler, { body });
    const { clean, planted, a, b } = await pairOf({ 'watchlists/wl-1': list() }, run, { opId: 'op-1', expectedVersion: 0, statement: 'Grid capex' });
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(stored(planted, vPath(1))).toEqual(stored(clean, vPath(1)));
    expect(stored(planted, vPath(1))).toMatchObject({ origin: 'manual', evidenceRefs: [], publishedAt: null });
    expect(b.body).toEqual(a.body);
  });
  it('reaffirm (the transition route): the planted fields change nothing — the due version\'s content and the server\'s refs', async () => {
    const due = {
      version: 1, watchlistId: 'wl-1', userId: OWNER, opId: 'op-0', opFingerprint: 'f'.repeat(64), createdAt: NOW,
      statement: 'Grid capex', horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual',
      status: 'review_due', stateChangedAt: NOW, stateSource: 'review_pass', stateReason: 'horizon_elapsed', missingEvidence: null, successorVersion: null,
      firstDeployedAt: NOW, lastDeployedAt: NOW, lastDeployedBattleId: 'b-1', reviewDueAt: NOW,
    };
    const { contentHashOf } = await import('../_utils/hypothesisRecords/model.js');
    due.contentHash = contentHashOf(due);
    const docs = { 'watchlists/wl-1': list({ currentHypothesisVersion: 1, hypothesisVersionCount: 1 }), [vPath(1)]: due };
    const run = (body) => call(transitionHandler, { body });
    const { clean, planted, a, b } = await pairOf(docs, run, { version: 1, action: 'reaffirm', opId: 'op-r', expectedVersion: 1 });
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(stored(planted, vPath(2))).toEqual(stored(clean, vPath(2)));
    expect(stored(planted, vPath(2))).toMatchObject({ origin: 'manual', evidenceRefs: [] });
  });
  it('a lifecycle transition (ready) never touches content, whatever the body carries', async () => {
    const { contentHashOf } = await import('../_utils/hypothesisRecords/model.js');
    const v1 = {
      version: 1, watchlistId: 'wl-1', userId: OWNER, opId: 'op-0', opFingerprint: 'f'.repeat(64), createdAt: NOW,
      statement: 'Grid capex', horizonEnum: 'swing', horizonSource: 'player', activation: [], invalidation: [], evidenceRefs: [], publishedAt: null, origin: 'manual',
      status: 'researched', stateChangedAt: NOW, stateSource: 'player', stateReason: 'player_marked_researched', missingEvidence: null, successorVersion: null,
      firstDeployedAt: null, lastDeployedAt: null, lastDeployedBattleId: null, reviewDueAt: null,
    };
    v1.contentHash = contentHashOf(v1);
    const docs = { 'watchlists/wl-1': list({ currentHypothesisVersion: 1, hypothesisVersionCount: 1 }), [vPath(1)]: v1 };
    const { clean, planted, a, b } = await pairOf(docs, (body) => call(transitionHandler, { body }), { version: 1, action: 'ready', expectedStatus: 'researched' });
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(stored(clean, vPath(1)).status).toBe('ready');
    expect(stored(planted, vPath(1))).toEqual(stored(clean, vPath(1)));
    expect(stored(planted, vPath(1)).contentHash).toBe(v1.contentHash);
  });
  it('POST a list (manual and screener create): the marker is never stored — the list stays manual / screener', async () => {
    for (const body of [{ name: 'Mine', tickers: [{ symbol: 'NVDA' }] }, { name: 'Screened', tickers: [{ symbol: 'NVDA' }], sourceScreenSpec: { filters: [] } }]) {
      const { clean, planted, a, b } = await pairOf({}, (bd) => call(createHandler, { body: bd }), body);
      expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
      const listId = a.body.watchlistId ?? a.body.watchlist?.watchlistId ?? 'auto-wl-1';
      const stClean = stored(clean, `watchlists/${listId}`);
      const stPlanted = stored(planted, `watchlists/${listId}`);
      expect(stClean).toMatchObject({ userId: OWNER }); // the list was found (the comparison below is never two nulls)
      expect(stPlanted).toEqual(stClean);
      expect(stPlanted).not.toHaveProperty(SHARED_RESEARCH_LIST_MARKER);
      expect(stPlanted).not.toHaveProperty('origin');
    }
  });
  it('PATCH a list: the marker (or an origin) in the body is never written', async () => {
    const { clean, planted, a, b } = await pairOf({ 'watchlists/wl-1': list({ status: 'draft' }) }, (body) => call(patchHandler, { method: 'PATCH', body }), { name: 'Renamed' });
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(stored(clean, 'watchlists/wl-1').name).toBe('Renamed');
    expect(stored(planted, 'watchlists/wl-1')).toEqual(stored(clean, 'watchlists/wl-1'));
    expect(stored(planted, 'watchlists/wl-1')).not.toHaveProperty(SHARED_RESEARCH_LIST_MARKER);
  });
});

describe('who may NAME the marker and the server-only ref parameter (source census)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const REPO = resolve(HERE, '../..');
  const walk = (dir, out = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(js|jsx|mjs)$/.test(e.name) && !/\.test\.|\.rules\.mjs$/.test(e.name)) out.push(relative(REPO, p).replace(/\\/g, '/'));
    }
    return out;
  };
  const files = [...walk(resolve(REPO, 'api')), ...walk(resolve(REPO, 'src'))];
  const naming = (needle) => files.filter((f) => new RegExp(`\\b${needle}\\b`).test(readFileSync(resolve(REPO, f), 'utf8'))).sort();
  it('the scan is alive', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(files).toContain('api/forge/watchlists.js');
  });
  it(`'${SHARED_RESEARCH_LIST_MARKER}' is named by the idea model alone, and the adoption fixture (its first writer is the Shared Research route — not this build)`, () => {
    expect(naming(SHARED_RESEARCH_LIST_MARKER)).toEqual([
      'api/_utils/hypothesisRecords/__fixtures__/sharedResearchAdoption.js', // the follow-up's builder fixture: a list as the route will save it
      'api/_utils/hypothesisRecords/model.js',
    ]);
  });
  it('the server-only ref parameter is named by the idea store alone — no route passes refs', () => {
    expect(naming('serverEvidenceRefs')).toEqual(['api/_utils/hypothesisRecords/store.js']);
  });
});
