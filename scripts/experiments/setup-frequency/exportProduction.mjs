#!/usr/bin/env node
// scripts/experiments/setup-frequency/exportProduction.mjs
//
// Setup frequency count — THE PRODUCTION READ (prompt §1 rules 4 and 8). READ-ONLY BY CONSTRUCTION: exportAll
// receives a RESTRICTED READER (count, a field-masked query, a field-masked getAll), never the database handle; main()
// creates the handle and passes it only to restrictedReader. The handle is the process's one Admin app, so other
// modules loaded here (marketDataCache.js, through the store's pure modules) have write functions on it; nothing in
// this folder calls one. lib.mjs writeVerbGrep runs first: a lexical check of this folder's own files for the plain
// write-call forms, not a proof (it cannot see bracket or indirect calls, or writes inside imported modules) — the
// restricted reader is the structural guard (review SF-L3-3, SF-L3-4).
//
// What it reads, each field-masked:
//   setupEvidence/*                 every stored record (the reproduction check, §2; the contemporaneous class)
//   setupEvidenceSweepState/*       the sweep's per-session state (which sessions it covered)
//   agentBattles (createdAt ≥ 15 Sep 2026, as an ISO string and as a Timestamp) — the battle lists (§4.1)
//   agents/*                        human agents' equipped lists, both loadouts (src/constants/perGameLoadout.js)
//   watchlists/{id}                 the equipped lists' tickers, reduced to symbols at once (§4.2)
//   indexIntelligence/stockRankings today's scores for the archetype overlays (§5), reduced to four fields per stock
//   rankingSnapshots/*              which dated snapshots exist, and the field names their per-stock entries carry
//
// NO ACCOUNT IDS, NO PLAYER TEXT, NO LIST NAMES LEAVE THIS SCRIPT. Owners are "founder", "FT_QA" (the two uids read
// in memory from the archived week-1 dump, --labels) or an ordinal; battles and lists are ordinals; no account, agent,
// battle or watchlist id is written (a record's key and a ranking snapshot's id, `{etDate}_{runLabel}`, are dates and
// symbols). A watchlist's name, thesis and notes are never selected. Before and after writing, the text is scanned for
// every owner, agent, battle and watchlist id read (8 characters or more) and for any 28-character token shaped like an
// account id; a hit deletes the file and fails the run (review SF-L3-7: the scan's reach, stated).
//
// CREDENTIALS: FIREBASE_ADMIN_CREDENTIALS parsed in place from the main checkout's .env.local (--env), never printed.
//
// USAGE: node scripts/experiments/setup-frequency/exportProduction.mjs [--run <dir>] [--env <.env.local>] [--labels <dump>]
// setupEvidenceImportGuard.test.js lists this file by exact name (it reads the store's collection).

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvFile } from '../../calibration/export-agent-battles.js';
import { UID_SHAPE } from '../trader-game-replay/exportReplay.mjs';
import { leagueLoadoutOf, baggerbombLoadoutOf, bookIdOf } from '../../../src/constants/perGameLoadout.js';
import { TOURNAMENT_GAME_MODE } from '../../../src/constants/leagueTournament.js';
import { ALL_TICKERS } from '../../../api/_utils/rankingConfig.js';
import { lastCompletedSessionAt } from './storeReplay.mjs';
import { argOf, die, runDirOf, writeVerbGrep } from './lib.mjs';

const SINCE = '2026-09-15';
const DEFAULT_ENV = 'C:/Users/fashr/portfolio-duel/.env.local';
const DEFAULT_LABELS = 'C:/Users/fashr/Documents/FantasyTrades/reads-raw-archive/cockpit-live-week1-read-d5abe2/reads-raw/cockpit-week1/cockpit-week1-raw.json';
const SWEEP_HOST = 'setup-evidence-sweep';

const RECORD_FIELDS = ['schemaVersion', 'key', 'status', 'capturedAt', 'evidenceClass', 'writer.host', 'refusal', 'entry.verdict', 'entry.reason', 'entry.pattern', 'entry.patternsSatisfied', 'entry.regime', 'entry.missing', 'entry.checks', 'entry.factsUsed', 'evidence.ok', 'evidence.bars', 'evidence.adjustment'];
const STATE_FIELDS = ['schemaVersion', 'session', 'providerRequests', 'runs', 'firstRunAt', 'lastRunAt', 'completedAt', 'runMs', 'latest'];
const BATTLE_FIELDS = ['createdAt', 'gameMode', 'groupId', 'ownerId', 'isCpu', 'status', 'agentContext.initialPortfolio', 'agentContext.archetype', 'portfolio.bench', 'trades', 'watchlist.hotBench', 'scoreState.tradeCount', 'timing.tradingDays'];
const AGENT_FIELDS = ['ownerId', 'isCpu', 'status', 'deletedAt', 'equippedWatchlistId', 'loadouts.baggerbomb', 'archetype'];
const RANKING_FIELDS = ['symbol', 'sectorName', 'fundamentalScore', 'atrPercentile'];

const isoOf = (v) => {
  if (typeof v === 'string') return Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null;
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
  return null;
};
const typeOf = (v) => (typeof v === 'string' ? 'string' : v && typeof v.toDate === 'function' ? 'timestamp' : v === undefined ? 'absent' : typeof v);
const assetOf = (a) => ({ symbol: a?.symbol ?? null, sector: a?.sector ?? null, crypto: a?.isCrypto === true });

/** THE RESTRICTED READER: the only Firestore surface the export sees. */
function restrictedReader(db, Timestamp) {
  return {
    timestampOf: (iso) => Timestamp.fromDate(new Date(iso)),
    count: async (col) => (await db.collection(col).count().get()).data().count,
    query: async (col, { where = [], fields = null, orderBy = null, limit = null } = {}) => {
      let q = db.collection(col);
      for (const [f, op, v] of where) q = q.where(f, op, v);
      if (orderBy) q = q.orderBy(orderBy[0], orderBy[1]);
      if (limit) q = q.limit(limit);
      if (fields) q = q.select(...fields);
      const snap = await q.get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    getAll: async (col, ids, fields) => {
      if (ids.length === 0) return [];
      const snaps = await db.getAll(...ids.map((id) => db.collection(col).doc(id)), { fieldMask: fields });
      return snaps.map((s) => ({ id: s.id, exists: s.exists, data: s.exists ? s.data() : null }));
    },
  };
}

/** The two labelled uids from the archived dump, in memory only. */
function labelledOwners(dumpPath) {
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
  const out = {};
  for (const b of dump.battles || []) {
    const uid = b?.doc?.ownerId;
    if ((b.acct === 'founder' || b.acct === 'FT_QA') && typeof uid === 'string') out[uid] = b.acct;
  }
  if (Object.values(out).sort().join() !== 'FT_QA,founder') die('the labels dump does not name exactly one founder and one FT_QA uid');
  return out;
}

/** An owner label: founder, FT_QA, or an ordinal in first-seen order. */
function ownerLabeller(labelled) {
  const ordinals = {};
  let next = 1;
  return (uid) => {
    if (typeof uid !== 'string' || uid === '') return 'none';
    if (labelled[uid]) return labelled[uid];
    if (!ordinals[uid]) { ordinals[uid] = `owner-${String(next).padStart(2, '0')}`; next += 1; }
    return ordinals[uid];
  };
}

function reduceRecord(data) {
  const checks = Array.isArray(data.entry?.checks) ? data.entry.checks : [];
  const ext = checks.find((c) => c.id === 'extension');
  const facts = {};
  for (const [k, f] of Object.entries(data.entry?.factsUsed || {})) facts[k] = f?.value ?? null;
  return {
    session: data.key?.session ?? null,
    symbol: data.key?.symbol ?? null,
    ruleSet: data.key?.ruleSet ?? null,
    schemaVersion: data.schemaVersion ?? null,
    status: data.status ?? null,
    capturedAt: isoOf(data.capturedAt),
    barsClass: data.evidenceClass?.bars ?? null,
    writer: data.writer?.host === SWEEP_HOST ? 'sweep' : data.writer?.host == null ? 'none' : 'other',
    verdict: data.entry?.verdict ?? null,
    reason: data.entry?.reason ?? null,
    pattern: data.entry?.pattern ?? null,
    patternsSatisfied: data.entry?.patternsSatisfied ?? null,
    regime: data.entry?.regime ?? null,
    missing: data.entry?.missing ?? null,
    extLimit: ext && Number.isFinite(ext.rhs) ? ext.rhs : null,
    facts,
    refusal: data.refusal ? { reason: data.refusal.reason ?? null, date: data.refusal.detail?.date ?? null } : null,
    adjustment: data.evidence?.adjustment?.metadata ?? null,
    bars: Array.isArray(data.evidence?.bars) ? data.evidence.bars.map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume, adjustedClose: b.adjustedClose ?? null })) : null,
  };
}

export async function exportAll(reader, { labelled, log }) {
  const exportedAt = new Date().toISOString();
  const ownerLabel = ownerLabeller(labelled);
  const seenIds = [...Object.keys(labelled)];
  const out = { exportedAt, since: SINCE, counts: {}, notes: {} };

  // 1. The store's records and the sweep's state.
  out.counts.setupEvidence = await reader.count('setupEvidence');
  const records = await reader.query('setupEvidence', { fields: RECORD_FIELDS });
  out.records = records.map((r) => reduceRecord(r.data));
  out.counts.setupEvidenceRead = records.length;
  const states = await reader.query('setupEvidenceSweepState', { fields: STATE_FIELDS });
  out.sweepState = states.map((s) => s.data);
  log(`setupEvidence: ${out.counts.setupEvidence} counted, ${records.length} read; sweep state documents: ${states.length}`);

  // 2. Battles created since SINCE: the field's stored type decides the query; both are run and joined.
  out.counts.agentBattles = await reader.count('agentBattles');
  const probe = await reader.query('agentBattles', { orderBy: ['createdAt', 'desc'], limit: 5, fields: ['createdAt'] });
  out.notes.createdAtTypes = probe.map((p) => typeOf(p.data.createdAt));
  const byString = await reader.query('agentBattles', { where: [['createdAt', '>=', SINCE]], fields: BATTLE_FIELDS });
  const byStamp = await reader.query('agentBattles', { where: [['createdAt', '>=', reader.timestampOf(`${SINCE}T00:00:00Z`)]], fields: BATTLE_FIELDS });
  out.counts.battlesByStringQuery = byString.length;
  out.counts.battlesByTimestampQuery = byStamp.length;
  const joined = {};
  for (const b of [...byString, ...byStamp]) joined[b.id] = b.data;
  const battles = Object.entries(joined).map(([id, data]) => ({ id, data, createdAt: isoOf(data.createdAt) })).filter((b) => b.createdAt).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  out.battles = battles.map((b, i) => {
    const d = b.data;
    seenIds.push(b.id);
    if (typeof d.ownerId === 'string') seenIds.push(d.ownerId);
    const ip = d.agentContext?.initialPortfolio || {};
    const at = lastCompletedSessionAt(Date.parse(b.createdAt));
    return {
      n: `battle-${String(i + 1).padStart(3, '0')}`,
      owner: ownerLabel(d.ownerId),
      createdAt: b.createdAt,
      gameMode: d.gameMode ?? null,
      league: d.gameMode === TOURNAMENT_GAME_MODE || (typeof d.groupId === 'string' && d.groupId !== ''),
      cpu: d.isCpu === true,
      status: d.status ?? null,
      archetype: d.agentContext?.archetype ?? null,
      session: at.ok ? at.session : null,
      firstDay: Array.isArray(d.timing?.tradingDays) ? d.timing.tradingDays[0] ?? null : null,
      book: ['star', 'core', 'support'].flatMap((tier) => (Array.isArray(ip[tier]) ? ip[tier] : []).map(assetOf)),
      bench: (Array.isArray(d.portfolio?.bench?.stocks) ? d.portfolio.bench.stocks : []).map(assetOf),
      benchCrypto: d.portfolio?.bench?.crypto?.symbol ?? null,
      trades: (Array.isArray(d.trades) ? d.trades : []).map((t) => ({ in: t?.symbolIn ?? null, out: t?.symbolOut ?? null, crypto: t?.isCrypto === true })),
      tradeCount: Number.isInteger(d.scoreState?.tradeCount) ? d.scoreState.tradeCount : null,
      hotBench: (Array.isArray(d.watchlist?.hotBench) ? d.watchlist.hotBench : []).filter((s) => typeof s === 'string'),
    };
  });
  log(`agentBattles: ${out.counts.agentBattles} in all; since ${SINCE}: ${byString.length} by string, ${byStamp.length} by Timestamp, ${battles.length} joined`);

  // 3. Human agents and the lists equipped on them (both loadouts).
  const agents = await reader.query('agents', { fields: AGENT_FIELDS });
  out.counts.agents = agents.length;
  const lists = {};
  const statusTally = {};
  let human = 0;
  for (const a of agents) {
    const d = a.data;
    seenIds.push(a.id);
    if (typeof d.ownerId === 'string') seenIds.push(d.ownerId);
    const cpu = d.isCpu === true || (typeof d.ownerId === 'string' && d.ownerId.startsWith('cpu-'));
    if (cpu) continue;
    human += 1;
    const statusKey = `${d.status ?? 'none'}${d.deletedAt ? '+deleted' : ''}`;
    statusTally[statusKey] = (statusTally[statusKey] || 0) + 1;
    const books = [['league', bookIdOf(leagueLoadoutOf(d).book)], ['baggerbomb', bookIdOf(baggerbombLoadoutOf(d).book)]];
    for (const [loadout, id] of books) {
      if (!id) continue;
      seenIds.push(id);
      lists[id] = lists[id] || { owners: [], loadouts: [], agents: 0, agentStatuses: [] };
      const l = lists[id];
      const owner = ownerLabel(d.ownerId);
      if (!l.owners.includes(owner)) l.owners.push(owner);
      if (!l.loadouts.includes(loadout)) l.loadouts.push(loadout);
      l.agents += 1;
      l.agentStatuses.push(statusKey);
    }
  }
  out.counts.humanAgents = human;
  out.notes.humanAgentStatuses = statusTally;
  const listIds = Object.keys(lists).sort();
  const docs = await reader.getAll('watchlists', listIds, ['tickers', 'deletedAt', 'status']);
  out.equipped = docs.map((w, i) => ({
    n: `list-${String(i + 1).padStart(2, '0')}`,
    owners: lists[w.id].owners,
    loadouts: lists[w.id].loadouts,
    agents: lists[w.id].agents,
    agentStatuses: lists[w.id].agentStatuses,
    exists: w.exists,
    deleted: Boolean(w.data?.deletedAt),
    status: w.data?.status ?? null,
    symbols: (Array.isArray(w.data?.tickers) ? w.data.tickers : []).map((t) => (typeof t?.symbol === 'string' ? t.symbol : null)).filter(Boolean),
  }));
  log(`agents: ${agents.length} (human ${human}); equipped lists: ${listIds.length}`);

  // 4. Today's scores (the one feed document the deploy step reads, api/agent/decide.js:344) and the dated snapshots.
  const [feed] = await reader.getAll('indexIntelligence', ['stockRankings'], ['stocks', 'computedAt', 'mode']);
  const stocks = Array.isArray(feed?.data?.stocks) ? feed.data.stocks : [];
  out.rankings = stocks.map((s) => { const r = {}; for (const f of RANKING_FIELDS) r[f] = s?.[f] ?? null; return r; });
  out.rankingsMeta = { exists: feed?.exists === true, computedAt: isoOf(feed?.data?.computedAt), mode: feed?.data?.mode ?? null, count: stocks.length };
  const snaps = await reader.query('rankingSnapshots', { fields: [] });
  out.snapshots = { ids: snaps.map((s) => s.id).sort(), stockFields: null, axesFields: null };
  if (snaps.length > 0) {
    const latest = out.snapshots.ids[out.snapshots.ids.length - 1];
    const sample = ALL_TICKERS[0];
    const [doc] = await reader.getAll('rankingSnapshots', [latest], [`stocks.${sample}`]);
    const entry = doc?.data?.stocks?.[sample] || null;
    out.snapshots.stockFields = entry ? Object.keys(entry).sort() : null;
    out.snapshots.axesFields = entry?.axes && typeof entry.axes === 'object' ? Object.keys(entry.axes).sort() : null;
  }
  log(`indexIntelligence/stockRankings: ${stocks.length} stocks (computedAt ${out.rankingsMeta.computedAt}); rankingSnapshots: ${snaps.length}`);
  return { out, seenIds };
}

/** Every id read, and any token shaped like an account id: none may appear in the written text. */
export function leakedIn(text, seenIds) {
  const hits = seenIds.filter((id) => typeof id === 'string' && id.length >= 8 && text.includes(id)).length;
  const shaped = (text.match(UID_SHAPE) || []).length;
  return { hits, shaped };
}

async function main() {
  writeVerbGrep();
  const argv = process.argv;
  const runDir = runDirOf(argv);
  const env = parseEnvFile(argOf(argv, '--env') || DEFAULT_ENV);
  if (!env.FIREBASE_ADMIN_CREDENTIALS) die('FIREBASE_ADMIN_CREDENTIALS is not in the env file');
  let serviceAccount;
  try { serviceAccount = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS); } catch { die('FIREBASE_ADMIN_CREDENTIALS is not valid JSON'); }
  const labelled = labelledOwners(argOf(argv, '--labels') || DEFAULT_LABELS);
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  const reader = restrictedReader(getFirestore(), Timestamp);
  const { out, seenIds } = await exportAll(reader, { labelled, log: (l) => console.log(l) });
  const file = path.join(runDir, 'export.json');
  const text = `${JSON.stringify(out, null, 1)}\n`;
  const leak = leakedIn(text, seenIds);
  if (leak.hits > 0 || leak.shaped > 0) die(`the export would carry ${leak.hits} id(s) and ${leak.shaped} account-shaped token(s); nothing written`);
  writeFileSync(file, text);
  const after = leakedIn(readFileSync(file, 'utf8'), seenIds);
  if (after.hits > 0 || after.shaped > 0) { unlinkSync(file); die('the written export failed the id scan and was deleted'); }
  console.log(`export → ${file} (exportedAt ${out.exportedAt}); id scan: 0 ids, 0 account-shaped tokens`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => die(err?.stack || err?.message));
}
