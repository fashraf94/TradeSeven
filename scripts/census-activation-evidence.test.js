// scripts/census-activation-evidence.test.js
//
// ID-1 Build 2 — the census (build prompt V3 §6): read-only by construction,
// aggregates only on every channel, and each measure on a fixture.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { censusMain, fatalLine, parseArgs, restrictedReader, runCensus, renderMarkdown, windowSessionsOf, dist } from './census-activation-evidence.mjs';
import { legacyBattle, legacySwap, correctedBattle, correctedSwap, tickOf } from '../api/_utils/activationEvidence/__fixtures__/activationBattles.js';
import { discoverActivations, activationKeyOf, currentRuleSet } from '../api/_utils/activationEvidence/discover.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'census-activation-evidence.mjs'), 'utf8').replace(/\r\n/g, '\n');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const RS = currentRuleSet();

// ---------------------------------------------------------------- read-only by construction

describe('read-only by construction', () => {
  it('its static imports are the observer\'s pure modules and the store\'s pure key and session modules, nothing else', () => {
    const imports = [...CODE.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual([
      'node:fs', 'node:url',
      '../api/_utils/activationEvidence/scope.js', '../api/_utils/activationEvidence/discover.js', '../api/_utils/activationEvidence/schedule.js',
      '../api/_utils/activationEvidence/tick.js', '../api/_utils/activationEvidence/lifetimes.js', '../api/_utils/activationEvidence/constants.js',
      '../api/_utils/setupEvidence/sessionAt.js', '../api/_utils/setupEvidence/key.js',
    ]);
  });
  it('the credentials and the allowlist load only inside main(), lazily; nothing write-capable is ever named', () => {
    const dynamic = [...CODE.matchAll(/await import\('([^']+)'\)/g)];
    expect(dynamic.map((m) => m[1])).toEqual(['./loadLocalEnv.js', '../api/_utils/firebaseAdmin.js', '../api/_utils/callRecords/allowlist.js']);
    const mainAt = CODE.indexOf('async function main()');
    expect(dynamic.every((m) => m.index > mainAt)).toBe(true);
    expect(CODE).toMatch(/if \(invokedDirectly\) main\(\)/);
    expect(CODE).not.toMatch(/attribution\.js|writer\.js|state\.js|tenant\.js|gate\.js|getOrAcquireSnapshot|resolveAttributionAgentId|casualClone|setupEvidence\/index\.js|setupEvidence\/store\.js|setupEvidence\/acquire\.js/);
  });
  it('every member call in the source is on a reviewed read-only list — a write, a batch or a transaction fails here', () => {
    const calls = [...new Set([...CODE.replace(/'[^'\n]*'|`[^`]*`/g, '""').matchAll(/\.([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]))].sort();
    const ALLOWED = [
      // Firestore, inside restrictedReader only — reads
      'collection', 'doc', 'getAll', 'where', 'orderBy', 'limit', 'select', 'get', 'data',
      // the restricted reader's own surface
      'query',
      // language
      'catch', 'exit', 'error', 'filter', 'floor', 'forEach', 'freeze', 'has', 'includes', 'indexOf', 'isInteger', 'isFinite',
      'isArray', 'now', 'join', 'keys', 'log', 'map', 'max', 'parse', 'push', 'replace', 'round', 'set', 'slice', 'some', 'sort', 'split', 'stringify', 'test', 'toISOString', 'unshift', 'values', 'abs',
    ];
    expect(calls.filter((c) => !ALLOWED.includes(c))).toEqual([]);
    expect(calls.length).toBeGreaterThan(20);
    expect(CODE).not.toMatch(/runTransaction|bulkWriter|recursiveDelete|writeBatch|FieldValue|\.batch\(|\.update\(|\.create\(|\.delete\(|\.add\(/);
    // `.set(` appears only on a Map (the outstanding keys), never on a reference.
    expect([...CODE.matchAll(/(\w+)\.set\(/g)].map((m) => m[1])).toEqual(['outstanding']);
  });
  it('the restricted reader is three read methods over the handle, frozen, and every query is field-masked', async () => {
    const seen = [];
    const query = { where: (...a) => { seen.push(['where', ...a]); return query; }, orderBy: (...a) => { seen.push(['orderBy', ...a]); return query; }, limit: (n) => { seen.push(['limit', n]); return query; }, select: (...f) => { seen.push(['select', ...f]); return query; }, get: async () => ({ docs: [{ id: 'x', data: () => ({}) }] }) };
    const db = { collection: () => query, doc: (p) => ({ path: p }), getAll: async (...a) => { seen.push(['getAll', a.length, a[a.length - 1]]); return [{ exists: false }]; }, set: () => { throw new Error('never'); }, runTransaction: () => { throw new Error('never'); } };
    const r = restrictedReader(db);
    expect(Object.keys(r)).toEqual(['get', 'getAll', 'query']);
    expect(Object.isFrozen(r)).toBe(true);
    await r.query({ collection: 'agentBattles', where: [['ownerId', '==', 'u']], limit: 3, fields: [] });
    await r.get('agentBattles/x', ['status']);
    expect(seen).toEqual([['where', 'ownerId', '==', 'u'], ['limit', 3], ['select'], ['getAll', 2, { fieldMask: ['status'] }]]);
  });
});

// ---------------------------------------------------------------- a fake reader over a document map

const pick = (obj, fields) => {
  const out = {};
  for (const f of fields) {
    const parts = f.split('.');
    let v = obj;
    for (const p of parts) v = v === null || v === undefined ? undefined : v[p];
    if (v === undefined) continue;
    let o = out;
    parts.slice(0, -1).forEach((p) => { o = o[p] ||= {}; });
    o[parts[parts.length - 1]] = structuredClone(v);
  }
  return out;
};
const valueAt = (obj, f) => f.split('.').reduce((v, p) => (v == null ? undefined : v[p]), obj);
function fakeReader(docs, { fail = null } = {}) {
  const snap = (path, fields) => { if (fail?.(path)) throw Object.assign(new Error(`read failed at ${path}`), { code: 'unavailable' }); const d = docs[path]; return { exists: d !== undefined, data: d === undefined ? null : pick(d, fields) }; };
  return {
    get: async (path, fields) => snap(path, fields),
    getAll: async (paths, fields) => paths.map((p) => snap(p, fields)),
    query: async ({ collection, where = [], orderBy = null, limit, fields }) => {
      if (fail?.(collection)) throw Object.assign(new Error(`query failed at ${collection}`), { code: 'unavailable' });
      const prefix = `${collection}/`;
      let rows = Object.entries(docs).filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map(([p, d]) => ({ id: p.slice(prefix.length), d }));
      for (const [f, op, v] of where) rows = rows.filter((r) => { const x = valueAt(r.d, f); return op === '==' ? x === v : op === '>=' ? x >= v : op === '<=' ? x <= v : false; });
      if (orderBy) rows.sort((a, b) => (valueAt(a.d, orderBy[0]) < valueAt(b.d, orderBy[0]) ? -1 : 1) * (orderBy[1] === 'desc' ? -1 : 1));
      return rows.slice(0, limit).map((r) => ({ id: r.id, data: pick(r.d, fields) }));
    },
  };
}

// ---------------------------------------------------------------- the fixture: one window, every measure

const OWNER = 'SENTINEL_OWNER_7f3a';
const B_MAIN = 'SENTINEL_BATTLE_91c2';
const SESSION = '2026-11-05';
const NOW = Date.parse('2026-11-06T13:00:00.000Z');
const SENTINELS = [OWNER, B_MAIN, 'SENTINEL_SYM', 'SENTSYMA', 'SENTINEL_AGENT', 'SENTINEL_POS', 'SENTB_GAP', 'SENTB_AFTER', 'SENTB_LIVE', 'SENTB_OUT', 'SENTB_NODAYS', 'NVDA', 'MSFT', 'AAPL', 'agentBattles/', 'setupEvidence', '__'];

function pointerFor(battleId, a, { evidence = true, detail = 'missing_bar' } = {}) {
  const k = activationKeyOf(a, RS);
  return [`agentBattles/${battleId}/activations/${a.activationId}`, {
    schemaVersion: 1, activationId: a.activationId, kind: a.kind, tier: a.tier, slot: a.slot, symbol: a.symbol, activatedAtSource: a.activatedAtSource,
    snapshotRef: evidence ? k.snapshotId : null, entry: evidence ? { verdict: 'qualified' } : null, missing: evidence ? null : { reason: 'snapshot_unavailable', detail },
    attributionStatus: 'resolved', activatingTick: a.kind === 'swap_in' ? { tickSeq: 12, evalId: 'eval_012', evaluationId: 'SENTINEL_EVAL', source: 'tick_action' } : null,
  }];
}
function fixture() {
  const docs = {};
  const put = (path, d) => { docs[path] = d; };
  const completed = { status: 'completed', ownerId: OWNER, agentId: 'SENTINEL_AGENT_1' };

  // 1. The main battle: five creations written, one swap-in written with its tick, one creation outstanding,
  // whose key holds BOTH a live lease and an observation (counted once, as a live lease); a SENTINEL_SYM slot (symbol_form).
  const main = legacyBattle({ ...completed });
  main.portfolio.support[1] = { ...main.portfolio.support[1], symbol: 'SENTINEL_SYM' }; main.agentContext.initialPortfolio.support[1].symbol = 'SENTINEL_SYM';
  legacySwap(main, { tier: 'star', slot: 1, symbolIn: 'SENTSYMA', at: '2026-11-05T15:02:11.412Z', evaluationId: 'SENTINEL_EVAL' });
  put(`agentBattles/${B_MAIN}`, main);
  const acts = discoverActivations(main).activations;
  const outstandingA = acts.find((a) => a.symbol === 'AAPL');
  for (const a of acts) if (a !== outstandingA && a.symbol !== 'SENTINEL_SYM') put(...pointerFor(B_MAIN, a, { evidence: a.symbol !== 'KO' })); // the observer never writes a symbol_form one
  put(`agentBattles/${B_MAIN}/ticks/${B_MAIN}:12`, tickOf(12, '2026-11-05T15:03:00.000Z', [main.trades[0]]));
  const kAapl = activationKeyOf(outstandingA, RS).snapshotId;
  put(`setupEvidenceClaims/${kAapl}`, { lease: { token: 'SENTINEL_TOKEN', claimedAt: new Date(NOW - 30_000).toISOString(), host: 'SENTINEL_HOST' }, observation: { reason: 'insufficient_history', detailHash: 'h', observedAt: new Date(NOW - 20 * 60_000).toISOString() }, attempts: 3, lastAttemptAt: new Date(NOW - 30_000).toISOString() });

  // 2. A gap battle: two rows retained of nine; a creation pointer for star[0] and a swap-in pointer whose row was evicted.
  const gap = correctedBattle({ ...completed });
  correctedSwap(gap, { tier: 'star', slot: 0, symbolIn: 'JPM', at: '2026-11-05T15:00:00.000Z', positionId: 'SENTINEL_POS_1' });
  correctedSwap(gap, { tier: 'star', slot: 0, symbolIn: 'CVX', at: '2026-11-05T16:00:00.000Z', positionId: 'SENTINEL_POS_2' });
  gap.trades.shift();
  gap.scoreState.tradeCount = 9;
  put('agentBattles/SENTB_GAP', gap);
  put('agentBattles/SENTB_GAP/activations/pos-star-0', { kind: 'creation', tier: 'star', slot: 0, activationId: 'pos-star-0', snapshotRef: 'x', attributionStatus: 'resolved', activatedAtSource: 'outgoing_receipt' });
  put('agentBattles/SENTB_GAP/activations/SENTINEL_POS_1', { kind: 'swap_in', tier: 'star', slot: 0, activationId: 'SENTINEL_POS_1', snapshotRef: null, missing: { detail: 'missing_bar' }, attributionStatus: 'unresolved', activatingTick: { source: 'unavailable' }, activatedAtSource: 'trade_row' });

  // 3. After-close creations: one final 40 minutes after the close, one outstanding with two attempts, the last 60 minutes after it.
  const after = legacyBattle({ ...completed, activatedAt: '2026-11-05T21:05:00.000Z' });
  put('agentBattles/SENTB_AFTER', after);
  const afterActs = discoverActivations(after).activations;
  const kNvda = activationKeyOf(afterActs.find((a) => a.symbol === 'NVDA'), RS).snapshotId;
  const kMsft = activationKeyOf(afterActs.find((a) => a.symbol === 'MSFT'), RS).snapshotId;
  put(`setupEvidence/${kNvda}`, { capturedAt: '2026-11-05T21:40:00.000Z', sourceMeta: { fetchedAt: '2026-11-05T21:40:00.000Z' }, evidenceClass: { bars: 'contemporaneous' }, writer: { commit: 'abc123def456' } });
  put(`setupEvidenceClaims/${kMsft}`, { lease: null, observation: null, attempts: 2, lastAttemptAt: '2026-11-05T22:00:00.000Z' });

  // 4. In flight, excluded, and a battle with no readable trading days.
  put('agentBattles/SENTB_LIVE', legacyBattle({ ...completed, status: 'active', expiresAt: '2026-11-07T01:00:00.000Z' })); // not yet expired: in flight
  put('agentBattles/SENTB_OUT', legacyBattle({ ...completed, agentContext: { archetype: 'contrarian' } }));
  put('agentBattles/SENTB_NODAYS', legacyBattle({ ...completed, timing: {} }));
  put('agentBattles/SENTB_NODAYS_OUT', legacyBattle({ ...completed, timing: {}, gameMode: 'baggerbomb_tournament' })); // out of scope: not counted undetermined
  return docs;
}

// ---------------------------------------------------------------- the measures

describe('the window and the arguments', () => {
  it('counts trading sessions back by the calendar, refuses a non-session, and parses its flags loudly', () => {
    expect(windowSessionsOf('2026-11-06', 5)).toEqual(['2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].slice(1));
    expect(windowSessionsOf('2026-11-27', 2)).toEqual(['2026-11-25', '2026-11-27']); // Thanksgiving skipped
    expect(() => windowSessionsOf('2026-11-07', 1)).toThrow(/trading session/);
    expect(parseArgs(['--session', '2026-11-05', '--sessions=5', '--out', 'r.md', '--json', 'r.json'])).toEqual({ session: '2026-11-05', sessions: 5, outPath: 'r.md', jsonPath: 'r.json' });
    expect(() => parseArgs(['--session', 'yesterday'])).toThrow();
    expect(() => parseArgs(['--sessions', '0'])).toThrow();
    expect(() => parseArgs(['--since', 'x'])).toThrow();
    expect(dist([3, 1, 2])).toEqual({ n: 3, min: 1, p50: 2, max: 3 });
  });
});

describe('each measure, on one fixture', () => {
  it('cohort, pointers, battles, activations, outstanding keys, the newest-session cutoff and writer.commit', async () => {
    const R = await runCensus(fakeReader(fixture()), { owners: [OWNER], session: SESSION, sessions: 1, nowMs: NOW });
    expect(R.window).toEqual({ firstSession: SESSION, lastSession: SESSION, sessions: 1 });
    expect(R.cohort).toEqual({ battles: 5, inFlight: 1, candidatesRead: 7, candidatesTruncated: 0 });
    // 2. Battles: four ended cohort battles read, one excluded; the gap battle; the no-days battle counted over the candidates.
    expect(R.battles).toEqual({ inCohort: 4, excluded: { archetype: 1 }, gapBattles: 1, finalizationUndetermined: 1, malformed: 0 });
    // 1. Pointers: the main battle's five, plus the gap battle's two.
    expect(R.pointers.total).toBe(7);
    expect(R.pointers.byKindRoute).toEqual({ 'creation/legacy': 4, 'swap_in/legacy': 1, 'creation/corrected': 1, 'swap_in/corrected': 1 });
    expect([R.pointers.withEvidence, R.pointers.null, R.pointers.nullByDetail]).toEqual([5, 2, { missing_bar: 2 }]);
    expect(R.pointers.attribution).toEqual({ resolved: 6, unresolved: 1 });
    expect(R.pointers.writtenBeyondRetainedHistory).toBe(2); // the evicted swap-in, and the gap's starting position (its slot's checks start at the retained row)
    // 3. Activations.
    expect(R.activations.lowerBound).toBe(true);
    expect(R.activations.unresolved).toMatchObject({ symbol_form: 1, gap: 5 });
    expect(R.activations.gapStartsWritten).toBe(1);
    expect(R.activations.unreconstructableAtMost).toBe(8 - 1); // nine trades, one retained row, one evicted swap-in written
    expect(R.activations.tickJoin.tick_action).toBe(1);
    expect(R.activations.abandoned).toEqual({});
    expect(R.headline.discoverableResolvable).toBe(R.activations.resolvable);
    expect(R.headline.rate).toBe(Math.round((R.activations.writtenWithEvidence / R.activations.resolvable) * 1000) / 1000);
    // 4. Outstanding keys: the AAPL key holds a live lease AND an observation — once, as a live lease.
    expect(R.outstandingKeys.liveLease).toBe(1);
    expect(R.outstandingKeys.observationAwaiting.n).toBe(0);
    expect(R.outstandingKeys.attemptsNoObservation).toMatchObject({ n: 1, attempts: { n: 1, min: 2, max: 2 } });
    expect(R.outstandingKeys.finalExists).toBe(1); // the after-close NVDA final, its pointer not yet written
    expect(R.outstandingKeys.keys).toBe(R.outstandingKeys.finalExists + R.outstandingKeys.liveLease + R.outstandingKeys.observationAwaiting.n + R.outstandingKeys.attemptsNoObservation.n + R.outstandingKeys.neverAttempted);
    // 5. The newest-session cutoff.
    expect(R.newestSessionCutoff.finals).toEqual({ n: 1, minutesAfterClose: { n: 1, min: 40, p50: 40, max: 40 }, barsClass: { contemporaneous: 1 } });
    expect(R.newestSessionCutoff.outstanding).toMatchObject({ attempts: expect.objectContaining({ max: 2 }), lastAttemptAfterCloseMinutes: { n: 1, min: 60, p50: 60, max: 60 } });
    // 6. writer.commit.
    expect(R.writerCommit.seen).toBe(true);
  });
  it('past the horizon, the unwritten resolvable activations are abandoned, by reason, and no longer outstanding', async () => {
    const R = await runCensus(fakeReader(fixture()), { owners: [OWNER], session: SESSION, sessions: 1, nowMs: Date.parse('2026-11-10T13:00:00.000Z') });
    expect(R.activations.abandoned.unwritten).toBeGreaterThan(0);
    expect(R.activations.outstanding).toBe(0);
  });
  it('another owner\'s battles are never in the cohort', async () => {
    const docs = fixture();
    docs['agentBattles/other'] = legacyBattle({ status: 'completed', ownerId: 'someone-else' });
    const R = await runCensus(fakeReader(docs), { owners: [OWNER], session: SESSION, sessions: 1, nowMs: NOW });
    expect(R.cohort.candidatesRead).toBe(7);
  });
});

// ---------------------------------------------------------------- aggregates only, on every channel

describe('aggregates only — the sentinel sweep', () => {
  afterEach(() => vi.restoreAllMocks());
  it('no id, symbol or path reaches the Markdown, the JSON, stdout or stderr — a forced read error included', async () => {
    const out = [];
    const err = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => err.push(a.join(' ')));
    vi.spyOn(console, 'warn').mockImplementation((...a) => err.push(a.join(' ')));
    const files = {};
    const reader = fakeReader(fixture(), { fail: (p) => p.includes('/ticks') || p.startsWith('setupEvidenceClaims/') });
    const R = await censusMain({ argv: ['--session', SESSION, '--out', 'r.md', '--json', 'r.json'], reader, owners: [OWNER], writeFile: (p, s) => { files[p] = s; }, log: (s) => out.push(s), nowMs: NOW });
    expect(Object.keys(R.errors).length).toBeGreaterThan(0); // the forced errors were counted, by class and code
    expect(Object.keys(R.errors)).toEqual(['Error:unavailable']);
    const channels = { md: files['r.md'], json: files['r.json'], stdout: out.join('\n'), stderr: err.join('\n'), fatal: fatalLine(Object.assign(new Error(`boom ${B_MAIN} ${OWNER}`), { code: 'SENTINEL_SYM' })) };
    for (const [name, text] of Object.entries(channels)) for (const s of SENTINELS) expect([name, s, text.includes(s)]).toEqual([name, s, false]);
    expect(channels.md).toContain('Headline');
  });
  it('a fatal error prints its class and code only', () => {
    expect(fatalLine(Object.assign(new TypeError(`x ${OWNER}`), { code: 10 }))).toBe('census failed: TypeError:10');
  });
  it('the report renders every measure with its denominator', async () => {
    const md = renderMarkdown(await runCensus(fakeReader(fixture()), { owners: [OWNER], session: SESSION, sessions: 1, nowMs: NOW }));
    for (const h of ['## Cohort', '## 1. Pointers', '## 2. Battles', '## 3. Activations', '## 4. Outstanding keys', '## 5. The newest-session cutoff', '## 6. writer.commit']) expect(md).toContain(h);
    expect(md).toMatch(/Written: \d+ of \d+ resolvable/);
    expect(md).toContain('LOWER BOUND');
  });
});
