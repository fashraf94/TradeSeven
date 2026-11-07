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
// The integrity fixture only (the census itself never imports these): pointers as the observer writes them, over real snapshots.
import { buildPointer } from '../api/_utils/activationEvidence/pointer.js';
import { snapshotFor } from '../api/_utils/activationEvidence/__fixtures__/activationSnapshots.js';
import { snapshotIdOf } from '../api/_utils/setupEvidence/key.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(resolve(HERE, 'census-activation-evidence.mjs'), 'utf8').replace(/\r\n/g, '\n');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const RS = currentRuleSet();

// ---------------------------------------------------------------- read-only by construction

describe('read-only by construction', () => {
  it('its static imports are the observer\'s pure modules, the store\'s pure key and session modules and a constants module, nothing else', () => {
    const imports = [...CODE.matchAll(/^import [\s\S]*? from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual([
      'node:fs', 'node:url',
      '../api/_utils/activationEvidence/scope.js', '../api/_utils/activationEvidence/discover.js', '../api/_utils/activationEvidence/schedule.js',
      '../api/_utils/activationEvidence/tick.js', '../api/_utils/activationEvidence/lifetimes.js', '../api/_utils/activationEvidence/constants.js',
      '../api/_utils/setupEvidence/sessionAt.js', '../api/_utils/setupEvidence/key.js',
      '../src/constants/leagueTournament.js', // isCasualCloneId, for the integrity section's attribution rules (a module with no imports)
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
      // language, added with the integrity section (review-fix prompt §2): all read-only
      'every', 'entries', 'hasOwn', 'isNaN', 'toMillis',
    ];
    expect(calls.filter((c) => !ALLOWED.includes(c))).toEqual([]);
    expect(calls.length).toBeGreaterThan(20);
    expect(CODE).not.toMatch(/runTransaction|bulkWriter|recursiveDelete|writeBatch|FieldValue|\.batch\(|\.update\(|\.create\(|\.delete\(|\.add\(/);
    // `.set(` appears only on a WeakMap (each pointer's stored field names) and a Map (the outstanding keys), never on a
    // reference: with those two calls removed, no `.set(` is left anywhere, whatever its receiver (review PFB-3: a chained
    // `db.doc(p).set(` has no identifier receiver).
    expect([...CODE.matchAll(/(\w+)\.set\(/g)].map((m) => m[1])).toEqual(['storedFields', 'outstanding']);
    expect(CODE.replace(/\b(?:storedFields|outstanding)\.set\(/g, '')).not.toMatch(/\.set\s*\(/);
  });
  it('the one unmasked read is the pointer query (whole pointers, for the integrity section\'s exact field set); every other read names its fields', () => {
    expect([...CODE.matchAll(/fields: WHOLE_DOCUMENT/g)]).toHaveLength(1);
    expect(CODE).toMatch(/collection: `agentBattles\/\$\{id\}\/\$\{ACTIVATIONS_SUBCOLLECTION\}`, limit: 500, fields: WHOLE_DOCUMENT \}/);
    expect(CODE).toMatch(/const WHOLE_DOCUMENT = null;/);
    expect(CODE).not.toMatch(/fields: null/);
  });
  it('the restricted reader is three read methods over the handle, frozen, and every query is field-masked unless its fields are null', async () => {
    const seen = [];
    const query = { where: (...a) => { seen.push(['where', ...a]); return query; }, orderBy: (...a) => { seen.push(['orderBy', ...a]); return query; }, limit: (n) => { seen.push(['limit', n]); return query; }, select: (...f) => { seen.push(['select', ...f]); return query; }, get: async () => ({ docs: [{ id: 'x', data: () => ({}) }] }) };
    const db = { collection: () => query, doc: (p) => ({ path: p }), getAll: async (...a) => { seen.push(['getAll', a.length, a[a.length - 1]]); return [{ exists: false }]; }, set: () => { throw new Error('never'); }, runTransaction: () => { throw new Error('never'); } };
    const r = restrictedReader(db);
    expect(Object.keys(r)).toEqual(['get', 'getAll', 'query']);
    expect(Object.isFrozen(r)).toBe(true);
    await r.query({ collection: 'agentBattles', where: [['ownerId', '==', 'u']], limit: 3, fields: [] });
    await r.get('agentBattles/x', ['status']);
    expect(seen).toEqual([['where', 'ownerId', '==', 'u'], ['limit', 3], ['select'], ['getAll', 2, { fieldMask: ['status'] }]]);
    seen.length = 0;
    await r.query({ collection: 'agentBattles/b/activations', limit: 500, fields: null });
    expect(seen).toEqual([['limit', 500]]); // whole documents: no select
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
      return rows.slice(0, limit).map((r) => ({ id: r.id, data: fields === null ? structuredClone(r.d) : pick(r.d, fields) }));
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
    expect(R.cohort).toEqual({ battles: 5, inFlight: 1, candidatesRead: 7, candidatesTruncated: 0, readFailed: 0 });
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
    expect(R.outstandingKeys.readFailed).toBe(0);
    expect(R.outstandingKeys.keys).toBe(R.outstandingKeys.readFailed + R.outstandingKeys.finalExists + R.outstandingKeys.liveLease + R.outstandingKeys.observationAwaiting.n + R.outstandingKeys.attemptsNoObservation.n + R.outstandingKeys.neverAttempted);
    // 5. The newest-session cutoff.
    expect(R.newestSessionCutoff.finals).toEqual({ n: 1, readFailed: 0, minutesAfterClose: { n: 1, min: 40, p50: 40, max: 40 }, barsClass: { contemporaneous: 1 } });
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
    for (const h of ['## Cohort', '## 1. Pointers', '## 2. Battles', '## 3. Activations', '## 4. Outstanding keys', '## 5. The newest-session cutoff', '## 6. writer.commit', '## 7. Pointer integrity']) expect(md).toContain(h);
    expect(md).toMatch(/Written: \d+ of \d+ resolvable/);
    expect(md).toContain('LOWER BOUND');
    expect(md).toMatch(/read_failed .*: 0 › final exists/);
  });
  // Review 5: every bucket label read from a stored document is on its list, or `other` — a stored string is never echoed.
  it('review 5: sentinels in missing.detail, activatedAtSource, attributionStatus, activatingTick.source, kind and the bars class → `other`, never echoed', async () => {
    const docs = fixture();
    const pointerPaths = Object.keys(docs).filter((p) => p.startsWith(`agentBattles/${B_MAIN}/activations/`));
    const nullOne = pointerPaths.find((p) => docs[p].snapshotRef === null);
    const evidenced = pointerPaths.filter((p) => docs[p].snapshotRef !== null && docs[p].kind === 'creation');
    const swapIn = pointerPaths.find((p) => docs[p].kind === 'swap_in');
    docs[nullOne].missing.detail = 'SENTINEL_DETAIL_9';
    docs[evidenced[0]].activatedAtSource = 'SENTINEL_SRC_4';
    docs[evidenced[1]].attributionStatus = 'SENTINEL_ATTR_2';
    docs[swapIn].activatingTick.source = 'SENTINEL_TICK_3';
    docs['agentBattles/SENTB_GAP/activations/SENTINEL_POS_1'].kind = 'SENTINEL_KIND_5';
    const nvdaFinal = Object.keys(docs).find((p) => p.startsWith('setupEvidence/'));
    docs[nvdaFinal].evidenceClass.bars = 'SENTINEL_BARS_8';
    const files = {};
    const out = [];
    const R = await censusMain({ argv: ['--session', SESSION, '--out', 'r.md', '--json', 'r.json'], reader: fakeReader(docs), owners: [OWNER], writeFile: (p, s) => { files[p] = s; }, log: (s) => out.push(s), nowMs: NOW });
    expect(R.pointers.nullByDetail).toEqual({ missing_bar: 1, other: 1 });
    expect(R.pointers.activatedAtSource.other).toBe(1);
    expect(R.pointers.attribution.other).toBe(1);
    expect(R.pointers.activatingTick).toEqual({ other: 1 }); // the gap battle's swap-in no longer reads as a swap-in (its kind is the sentinel)
    expect(R.pointers.byKindRoute['other/corrected']).toBe(1);
    expect(R.newestSessionCutoff.finals.barsClass).toEqual({ other: 1 });
    for (const [name, text] of Object.entries({ md: files['r.md'], json: files['r.json'], stdout: out.join('\n') })) {
      for (const s of ['SENTINEL', 'DETAIL_9', 'SRC_4', 'ATTR_2', 'TICK_3', 'KIND_5', 'BARS_8']) expect([name, s, text.includes(s)]).toEqual([name, s, false]);
    }
  });
});

// ---------------------------------------------------------------- review 3: a failed read is never evidence of absence

describe('review 3: a failed read is never evidence of absence', () => {
  const opts = { owners: [OWNER], session: SESSION, sessions: 1, nowMs: NOW };
  it('a claims read that fails → every outstanding key is read_failed, never neverAttempted; a finals read that fails → the same', async () => {
    const healthy = await runCensus(fakeReader(fixture()), opts);
    expect(healthy.outstandingKeys.neverAttempted).toBeGreaterThan(0); // the healthy fixture has keys no claim names
    expect(healthy.outstandingKeys.readFailed).toBe(0);
    for (const failing of ['setupEvidenceClaims/', 'setupEvidence/']) {
      const R = await runCensus(fakeReader(fixture(), { fail: (p) => p.startsWith(failing) }), opts);
      expect([failing, R.outstandingKeys.keys]).toEqual([failing, healthy.outstandingKeys.keys]);
      expect([failing, R.outstandingKeys.readFailed]).toEqual([failing, R.outstandingKeys.keys]);
      expect([failing, R.outstandingKeys.neverAttempted, R.outstandingKeys.finalExists, R.outstandingKeys.liveLease, R.outstandingKeys.observationAwaiting.n, R.outstandingKeys.attemptsNoObservation.n])
        .toEqual([failing, 0, 0, 0, 0, 0]);
      expect([failing, R.newestSessionCutoff.outstanding.n, R.newestSessionCutoff.outstanding.readFailed > 0]).toEqual([failing, 0, true]);
    }
  });
  it('a pointer read that fails → that battle\'s coverage is unknown: never written, outstanding or abandoned, and out of both sides of the headline', async () => {
    const failMain = (p) => p === `agentBattles/${B_MAIN}/activations`;
    const healthy = await runCensus(fakeReader(fixture()), opts);
    const R = await runCensus(fakeReader(fixture(), { fail: failMain }), opts);
    // The main battle: six resolvable activations (a symbol_form one aside), five written, one outstanding.
    expect(R.activations.coverageUnknown).toEqual({ battles: 1, activations: 6, gapStarts: 0 });
    expect(R.activations.resolvable).toBe(healthy.activations.resolvable);
    expect(R.activations.written).toBe(healthy.activations.written - 5);
    expect(R.activations.outstanding).toBe(healthy.activations.outstanding - 1);
    expect(R.headline.discoverableResolvable).toBe(healthy.headline.discoverableResolvable - 6);
    expect(R.headline.coverageUnknown).toBe(6);
    expect(R.headline.pointersWithEvidence).toBe(healthy.headline.pointersWithEvidence - 4);
    // Past the horizon, the main battle's unwritten one is not abandoned either.
    const LATER = Date.parse('2026-11-10T13:00:00.000Z');
    const healthyLater = await runCensus(fakeReader(fixture()), { ...opts, nowMs: LATER });
    const later = await runCensus(fakeReader(fixture(), { fail: failMain }), { ...opts, nowMs: LATER });
    expect(later.activations.abandoned.unwritten).toBe(healthyLater.activations.abandoned.unwritten - 1);
    expect(later.activations.outstanding).toBe(0);
    // A gap battle: its starting lifetimes are neither written nor unresolved, but unknown.
    const gapFail = await runCensus(fakeReader(fixture(), { fail: (p) => p === 'agentBattles/SENTB_GAP/activations' }), opts);
    expect(healthy.activations.gapStartsWritten + healthy.activations.unresolved.gap).toBe(gapFail.activations.coverageUnknown.gapStarts);
    expect([gapFail.activations.gapStartsWritten, gapFail.activations.unresolved.gap]).toEqual([0, undefined]);
    expect(renderMarkdown(R)).toMatch(/Coverage unknown .*: 6 resolvable activation\(s\) and 0 gap starting lifetime\(s\), in 1 battle\(s\)/);
  });
});

// ---------------------------------------------------------------- pointer integrity (review-fix prompt §2)

const I_BATTLE = 'SENTINEL_BATTLE_INT';
const I_AGENT = 'SENTINEL_AGENT_I';
/** One ended battle whose pointers are what the observer writes: buildPointer over the store's own snapshot documents. */
async function integrityFixture() {
  const docs = {};
  const b = legacyBattle({ status: 'completed', ownerId: OWNER, agentId: I_AGENT });
  legacySwap(b, { tier: 'core', slot: 0, symbolIn: 'JPM', at: '2026-11-05T15:02:11.412Z', evaluationId: 'SENTINEL_EVAL_I' });
  docs[`agentBattles/${I_BATTLE}`] = b;
  const paths = {};
  for (const a of discoverActivations(b).activations) {
    const k = activationKeyOf(a, RS);
    const isNull = a.symbol === 'XOM';
    let evidence = null;
    if (!isNull) {
      evidence = await snapshotFor({ session: k.session, symbol: a.symbol, fetchedAt: '2026-11-05T16:00:00.000Z' });
      docs[`setupEvidence/${evidence.snapshotId}`] = structuredClone(evidence.snapshot);
    }
    const activation = a.kind === 'swap_in' ? { ...a, activatingTick: { tickSeq: 12, evalId: 'eval_012', evaluationId: null, source: 'tick_action' } } : a;
    const p = buildPointer({
      battle: b, battleId: I_BATTLE, activation, session: k.session, attribution: { attributionAgentId: I_AGENT, attributionStatus: 'resolved' }, ruleSet: RS,
      evidence, missingDetail: isNull ? 'missing_bar' : null, observedAt: isNull ? '2026-11-06T01:30:05.000Z' : '2026-11-05T16:00:01.000Z',
    });
    paths[a.symbol] = `agentBattles/${I_BATTLE}/activations/${a.activationId}`;
    docs[paths[a.symbol]] = structuredClone(p);
  }
  return { docs, paths, snapshotOf: (symbol) => `setupEvidence/${docs[paths[symbol]].snapshotRef ?? snapshotIdOf({ session: docs[paths[symbol]].asOf, symbol, ruleSet: RS })}` };
}

describe('pointer integrity — identity, evidence, shape, timeliness', () => {
  const opts = { owners: [OWNER], session: SESSION, sessions: 1, nowMs: NOW };
  it('correct pointers (buildPointer over the store\'s own snapshots) → zero mismatches; every pointer checked', async () => {
    const { docs } = await integrityFixture();
    const R = await runCensus(fakeReader(docs), opts);
    expect(R.integrity).toMatchObject({
      pointers: 7, mismatches: 0,
      identity: { checked: 7, notCheckable: 0, byField: {} },
      evidence: { checked: 6, readFailed: 0, byField: {} },
      nullPointers: { checked: 1, snapshotNowExists: 0, readFailed: 0, unkeyable: 0 },
      shape: { byField: {} },
    });
    expect(R.integrity.timeliness).toEqual({
      withEvidenceMinutesAfterActivation: expect.objectContaining({ n: 6 }), nullMinutesAfterCutoff: { n: 1, min: 0.1, p50: 0.1, max: 0.1 },
      nullBeforeCutoff: 0, nullNoCutoff: 0, unreadableInstants: 0,
    });
    const md = renderMarkdown(R);
    expect(md).toContain('**Mismatches: 0** field mismatch(es), in 0 of 7 pointer(s).');
    for (const s of ['SENTINEL', 'NVDA', 'JPM', 'XOM', 'star:', '__', 'setupEvidence/']) expect([s, md.includes(s), JSON.stringify(R).includes(s)]).toEqual([s, false, false]);
  });

  // One wrong field of each kind → counted under that field (and only where the same wrong value must also show).
  const P = (symbol, f) => ({ docs, paths }) => f(docs[paths[symbol]], docs);
  const cases = [
    // identity
    ['identity: activationId', P('NVDA', (p) => { p.activationId = 'star:0:2026-11-05T14:30:02.119Z'; }), { identity: { activationId: 1 } }],
    ['identity: kind', P('NVDA', (p) => { p.kind = 'swap_in'; }), { identity: { kind: 1 } }],
    ['identity: symbol (the snapshot it names is then another key)', P('NVDA', (p) => { p.symbol = 'NVDX'; }), { identity: { symbol: 1 }, evidence: { key: 1 } }],
    ['identity: tier', P('NVDA', (p) => { p.tier = 'core'; }), { identity: { tier: 1 } }],
    ['identity: slot', P('NVDA', (p) => { p.slot = 5; }), { identity: { slot: 1 } }],
    ['identity: activatedAt', P('NVDA', (p) => { p.activatedAt = '2026-11-05T14:30:02.119Z'; }), { identity: { activatedAt: 1 } }],
    ['identity: activatedAtSource', P('NVDA', (p) => { p.activatedAtSource = 'trade_row'; }), { identity: { activatedAtSource: 1 } }],
    ['identity: asOf (the snapshot it names is then another key)', P('NVDA', (p) => { p.asOf = '2026-11-03'; }), { identity: { asOf: 1 }, evidence: { key: 1 } }],
    ['identity: firstTradingDay', P('NVDA', (p) => { p.firstTradingDay = '2026-11-04'; }), { identity: { firstTradingDay: 1 } }],
    // evidence
    ['evidence: the snapshot named is absent', ({ docs, snapshotOf }) => { delete docs[snapshotOf('NVDA')]; }, { evidence: { snapshotAbsent: 1 } }],
    ['evidence: the snapshot\'s key names another session', ({ docs, snapshotOf }) => { docs[snapshotOf('NVDA')].key.session = '2026-11-03'; }, { evidence: { key: 1 } }],
    ['evidence: the snapshot\'s rule set differs', ({ docs, snapshotOf }) => { docs[snapshotOf('NVDA')].key.ruleSet.thresholdsHash = '000000000000'; }, { evidence: { ruleSet: 1 } }],
    ['evidence: entry not deep-equal to the snapshot\'s', P('NVDA', (p) => { p.entry = { ...p.entry, extra: 1 }; }), { evidence: { entry: 1 } }],
    ['evidence: a wrong anchorSwingLow', P('NVDA', (p) => { p.anchorSwingLow = { value: 1.23, provenance: 'own_entry' }; }), { evidence: { anchorSwingLow: 1 } }],
    ['evidence: a wrong evidenceTiming', P('NVDA', (p) => { p.evidenceTiming = { ...p.evidenceTiming, predatesActivation: !p.evidenceTiming.predatesActivation }; }), { evidence: { evidenceTiming: 1 } }],
    // shape
    ['shape: an extra field', P('NVDA', (p) => { p.extra = 1; }), { shape: { fieldSet: 1 } }],
    ['shape: a missing field (archetype, so its identity check counts too)', P('NVDA', (p) => { delete p.archetype; }), { shape: { fieldSet: 1 }, identity: { archetype: 1 } }],
    ['shape: schemaVersion 2', P('NVDA', (p) => { p.schemaVersion = 2; }), { shape: { schemaVersion: 1 } }],
    ['shape: activatingTick.evaluationId not null', P('JPM', (p) => { p.activatingTick.evaluationId = 'SENTINEL_EVAL_I'; }), { shape: { 'activatingTick.evaluationId': 1 } }],
    ['shape: missing set beside an entry', P('NVDA', (p) => { p.missing = { reason: 'snapshot_unavailable', detail: 'missing_bar' }; }), { shape: { missingExactlyWhenNoEntry: 1 } }],
    ['shape: no snapshotRef beside an entry', P('NVDA', (p) => { p.snapshotRef = null; }), { shape: { snapshotRef: 1 } }],
    ['shape: unresolved on a ranked battle agent', P('NVDA', (p) => { p.attributionStatus = 'unresolved'; }), { shape: { 'attribution.unresolvedNotCasualClone': 1 } }],
    ['shape: unresolved with an attribution agent other than the battle\'s', P('NVDA', (p) => { p.battleAgentId = 'casual-agent-owner-x'; p.attributionStatus = 'unresolved'; }), { shape: { 'attribution.unresolvedAgentNotBattleAgent': 1 }, identity: { battleAgentId: 1 } }],
    ['shape: stream.attributionAgentId differs', P('NVDA', (p) => { p.stream.attributionAgentId = 'someone-else'; }), { shape: { 'stream.attributionAgentId': 1 } }],
    // review PFB-7: the attribution rules the other way, and the fields fixed on the battle document
    ['shape: resolved on a casual clone\'s own id', P('NVDA', (p) => { p.battleAgentId = 'casual-agent-z'; p.attributionAgentId = 'casual-agent-z'; p.stream.attributionAgentId = 'casual-agent-z'; }), { shape: { 'attribution.resolvedOnCloneOwnId': 1 }, identity: { battleAgentId: 1 } }],
    ['shape: resolved on a ranked battle, to another agent', P('NVDA', (p) => { p.attributionAgentId = 'agent-elsewhere'; p.stream.attributionAgentId = 'agent-elsewhere'; }), { shape: { 'attribution.rankedOnOtherAgent': 1 } }],
    ['shape: an attributionStatus off its list', P('NVDA', (p) => { p.attributionStatus = 'SENTINEL_STATUS'; }), { shape: { 'attribution.status': 1 } }],
    ['identity: battleId', P('NVDA', (p) => { p.battleId = 'another-battle'; }), { identity: { battleId: 1 } }],
    ['identity: archetype', P('NVDA', (p) => { p.archetype = 'contrarian'; }), { identity: { archetype: 1 } }],
    ['identity: stream.clone', P('NVDA', (p) => { p.stream.clone = 'casual'; }), { identity: { 'stream.clone': 1 } }],
    ['identity: stream.gameMode', P('NVDA', (p) => { p.stream.gameMode = null; }), { identity: { 'stream.gameMode': 1 } }],
  ];
  it.each(cases)('%s → counted under that field', async (_label, mutate, expected) => {
    const fx = await integrityFixture();
    mutate(fx);
    const R = await runCensus(fakeReader(fx.docs), opts);
    const want = { identity: {}, evidence: {}, shape: {}, ...expected };
    expect({ identity: R.integrity.identity.byField, evidence: R.integrity.evidence.byField, shape: R.integrity.shape.byField }).toEqual(want);
    const total = Object.values(want).reduce((n, m) => n + Object.values(m).reduce((x, y) => x + y, 0), 0);
    expect(R.integrity.mismatches).toBe(total);
    expect(R.integrity.pointersWithMismatch).toBe(1); // each case breaks one pointer, however many fields it shows in
  });
  // Review PFB-1: activatedAtSource depends on the slot's state for one row of contract §4.1.
  async function correctedFixture() {
    const docs = {};
    const b = correctedBattle({ status: 'completed', ownerId: OWNER, agentId: I_AGENT });
    const paths = {};
    for (const a of discoverActivations(b).activations) { // the observer writes every pointer while the starting positions are held
      const k = activationKeyOf(a, RS);
      const evidence = await snapshotFor({ session: k.session, symbol: a.symbol, fetchedAt: '2026-11-05T16:00:00.000Z' });
      docs[`setupEvidence/${evidence.snapshotId}`] = structuredClone(evidence.snapshot);
      paths[a.symbol] = `agentBattles/${I_BATTLE}/activations/${a.activationId}`;
      docs[paths[a.symbol]] = structuredClone(buildPointer({ battle: b, battleId: I_BATTLE, activation: a, session: k.session, attribution: { attributionAgentId: I_AGENT, attributionStatus: 'resolved' }, ruleSet: RS, evidence, observedAt: '2026-11-05T16:00:01.000Z' }));
    }
    docs[`agentBattles/${I_BATTLE}`] = b;
    return { docs, paths, b };
  }
  it('PFB-1: a corrected starting position written while held (position_swappedInAt) and sold since (now outgoing_receipt) → zero mismatches', async () => {
    const fx = await correctedFixture();
    expect(fx.docs[fx.paths.NVDA].activatedAtSource).toBe('position_swappedInAt');
    correctedSwap(fx.b, { tier: 'star', slot: 0, symbolIn: 'JPM', at: '2026-11-05T17:02:00.000Z', positionId: 'p-jpm' }); // sold after the pointer was written
    expect(discoverActivations(fx.b).activations.find((a) => a.symbol === 'NVDA').activatedAtSource).toBe('outgoing_receipt');
    const R = await runCensus(fakeReader(fx.docs), opts);
    expect(R.integrity).toMatchObject({ pointers: 6, mismatches: 0, pointersWithMismatch: 0, identity: { checked: 6, byField: {} } });
  });
  it('PFB-1: the other way round is wrong — a still-held position whose pointer says outgoing_receipt is counted', async () => {
    const fx = await correctedFixture();
    fx.docs[fx.paths.NVDA].activatedAtSource = 'outgoing_receipt';
    const R = await runCensus(fakeReader(fx.docs), opts);
    expect([R.integrity.identity.byField, R.integrity.mismatches]).toEqual([{ activatedAtSource: 1 }, 1]);
  });
  it('an owner listed twice is one owner: no measure counts a battle twice (review PFB-8)', async () => {
    const once = await runCensus(fakeReader(fixture()), opts);
    const twice = await runCensus(fakeReader(fixture()), { ...opts, owners: [OWNER, OWNER] });
    expect({ ...twice, at: null }).toEqual({ ...once, at: null });
  });
  it('a null pointer whose snapshot exists now is reported (allowed), never a mismatch; one observed before its cutoff shows in timeliness', async () => {
    const fx = await integrityFixture();
    const k = fx.snapshotOf('XOM');
    fx.docs[k] = (await snapshotFor({ session: fx.docs[fx.paths.XOM].asOf, symbol: 'XOM', fetchedAt: '2026-11-06T02:00:00.000Z' })).snapshot;
    fx.docs[fx.paths.XOM].observedAt = '2026-11-06T01:00:00.000Z';
    const R = await runCensus(fakeReader(fx.docs), opts);
    expect(R.integrity.nullPointers).toEqual({ checked: 1, snapshotNowExists: 1, readFailed: 0, unkeyable: 0 });
    expect(R.integrity.mismatches).toBe(0);
    expect(R.integrity.timeliness).toMatchObject({ nullBeforeCutoff: 1, nullMinutesAfterCutoff: { n: 1, min: -30, max: -30 } });
  });
  it('a snapshot read that fails is counted as such: never a mismatch, never an absence', async () => {
    const fx = await integrityFixture();
    const R = await runCensus(fakeReader(fx.docs, { fail: (p) => p.startsWith('setupEvidence/') }), opts);
    expect(R.integrity).toMatchObject({ mismatches: 0, evidence: { checked: 0, readFailed: 6, byField: {} }, nullPointers: { checked: 0, readFailed: 1 } });
  });
});
