// scripts/census-planted-proposals.mjs
//
// Integrity build — client-forged proposal data (7 Oct 2026). The DETECTION
// census: did anyone use the hole this build closes? Report:
// docs/audits/20261007_BUILD_INTEGRITY_PROPOSAL_FORGERY.md (how and when to run it).
//
// THE HOLE: an owner could write `executionMode` and `pendingProposal` on their
// own battle (firestore.rules, the agentBattles update allowlist). The proposal
// handler's launch guard keyed on that `executionMode`, so a planted 'copilot'
// plus a planted approved (or expired co-pilot) proposal reached the executor,
// and the proposal's `evaluationMetadata` — spread onto the trade row after the
// executor's computed fields — could set `lockedPoints`, prices, symbols, ids.
//
// THE DATE: no server path has CREATED a proposal since the model path's
// launch guard landed — commit 84254065 ("launch guards on proposal pathway",
// 2026-05-19 22:56 UTC), merged to main in PR #421 (merge commit fcbd71c5,
// 2026-05-20 17:17:29 UTC). Every proposal that EXECUTED after that instant was
// therefore written by a client. (A proposal still pending at the deploy could
// resolve minutes after it — read rows on 20 May with that in mind.)
//
// WHAT AN EXPLOIT LEAVES, AND WHAT THE ATTACKER COULD SHAPE (base code before
// this build): the executed proposal's `statusFeed` beat — source
// 'proposal_system', action 'swap', "Coach approved: Swap …" / "Auto-executed:
// Swap …" — is the SERVER's (its timestamp too); the `proposalHistory` row was
// the client's own record copied whole (approved: the record itself; expired:
// the record with the server's resolution/resolvedAt on top), so its
// `systemNote`, `executionFailed`, `resolvedAt` (approved) and ids could all be
// planted; the trade row's every field could be overridden by the metadata.
// So the census reads:
//   1. PROPOSAL EXECUTIONS AFTER THE GUARD — every proposal_system swap beat
//      (the strongest evidence), and every history row resolved 'approved' or
//      'auto_executed' — INCLUDING rows that claim a launch-guard clear or a
//      failed execution: those are listed as executions when a same-pair trade
//      sits beside them (a planted note cannot hide a trade that happened), and
//      as clears / failures otherwise. A row whose time cannot be read is listed
//      (time unknown), never skipped. Each with the trade rows it matches (same
//      incoming symbol, swapped out within five minutes).
//   2. TRADE ROWS CARRYING A FOREIGN KEY — any key outside the executor's
//      computed fields plus the metadata allowlist (api/_utils/executorMetadata.js).
//   2b. TRADE ROWS THAT CONTRADICT THEMSELVES — a gain that does not follow from
//      the row's own prices, or a row swapped out before the row it follows.
//      (A careful forger can keep a row consistent: read 1 is the main signal.)
// Since no server path creates proposals, ANY proposal row after the date —
// an execution, a clear, a failure — means a client planted one, so every read
// sets the verdict.
// LIMITS: the beat is the only server-owned evidence and the feed keeps 100
// beats on an agent battle (50 without an agentId) — about one to two trading
// days; `trades[]` keeps 50 rows and `proposalHistory[]` 50, and every planted
// proposal appends a launch-guard row, so an attacker can push older rows out
// (a planted proposal on an auto-pilot battle could already do so before this
// build). Run it promptly; it covers what the battle documents still hold.
//
// READ-ONLY BY CONSTRUCTION — `.select()`, `.get()`, `getAll()` only;
// scripts/census-planted-proposals.test.js walks this file's syntax tree and
// pins every member call to a reviewed allowlist. The only files it writes are
// --out and --json. Credentials (scripts/loadLocalEnv.js + getFirebaseAdmin())
// load only inside main(); importing the module touches nothing. The founder runs it.
//
// USAGE (repo root):
//   node scripts/census-planted-proposals.mjs [--since=<ISO>] [--out <report.md>] [--json <data.json>]
//     --since=<ISO> (or `--since <ISO>`): count executions at/after this instant
//     instead of the guard's merge. Exit code 2 when any read finds anything.

import { writeFileSync } from 'node:fs';
import { EXECUTOR_COMPUTED_KEYS, EXECUTOR_METADATA_KEYS } from '../api/_utils/executorMetadata.js';

/** The model path's launch guard landed on main: PR #421's merge commit fcbd71c5 (carrying 84254065). */
export const LAUNCH_GUARD_LANDED = '2026-05-20T17:17:29.000Z';
/** A trade row may carry these keys and nothing else. */
export const TRADE_ROW_KEYS = Object.freeze([...EXECUTOR_COMPUTED_KEYS, ...EXECUTOR_METADATA_KEYS]);
/** How close a trade's swappedOutAt must sit to a proposal beat or row to be its trade. */
export const MATCH_WINDOW_MS = 5 * 60 * 1000;
/** How far a row's gain may sit from the one its own prices imply (the executor rounds to 0.001). */
export const GAIN_TOLERANCE_PCT = 0.01;

const KNOWN = new Set(TRADE_ROW_KEYS);

export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

/** Is this feed beat the server's own record of an executed proposal? */
export function isProposalExecutionBeat(beat) {
  return beat?.source === 'proposal_system' && beat?.action === 'swap';
}

/** Is this history row resolved as executed (whatever note or marker it also carries)? */
export function isExecutedResolution(row) {
  return !!row && typeof row === 'object' && (row.resolution === 'approved' || row.resolution === 'auto_executed');
}

/** The trades with this incoming symbol swapped out within the window of `atMs`. */
function tradesNear(symbolIn, atMs, trades) {
  if (atMs == null) return [];
  return (Array.isArray(trades) ? trades : []).filter((t) => t?.symbolIn === symbolIn
    && toMs(t?.swappedOutAt) != null && Math.abs(toMs(t.swappedOutAt) - atMs) <= MATCH_WINDOW_MS);
}

/** The trade rows a proposal beat matches: the same incoming symbol, swapped out within the window. */
export function tradesForBeat(beat, trades) {
  return tradesNear(beat?.symbolIn, toMs(beat?.timestamp), trades);
}

/** The keys of a trade row outside TRADE_ROW_KEYS. */
export function foreignKeysOf(trade) {
  return trade && typeof trade === 'object' && !Array.isArray(trade) ? Object.keys(trade).filter((k) => !KNOWN.has(k)) : [];
}

/**
 * Does the row's gain contradict its own prices? The executor writes
 * `lockedGainPct` as the move from entryPrice to exitPrice (negated for a
 * short; either sign accepted, for rows written before the C-2 sign fix).
 */
export function gainContradictsPrices(trade) {
  const entry = trade?.entryPrice;
  const exit = trade?.exitPrice;
  const gain = trade?.lockedGainPct;
  if (!(typeof entry === 'number' && entry > 0) || !Number.isFinite(exit) || !Number.isFinite(gain)) return false;
  const implied = ((exit - entry) / entry) * 100;
  return Math.min(Math.abs(gain - implied), Math.abs(gain + implied)) > GAIN_TOLERANCE_PCT;
}

const short = (t) => ({
  symbolOut: t?.symbolOut ?? null, symbolIn: t?.symbolIn ?? null, swappedOutAt: t?.swappedOutAt ?? null,
  lockedPoints: t?.lockedPoints ?? null, entryPrice: t?.entryPrice ?? null, exitPrice: t?.exitPrice ?? null,
  evaluationId: t?.evaluationId ?? null, entryMode: t?.entryMode ?? null,
});

/** The census over `{ [battleId]: battleDoc }` or a Map. Pure: no I/O, no clock. */
export function computePlantedProposalCensus(battles, { sinceMs = Date.parse(LAUNCH_GUARD_LANDED) } = {}) {
  const entries = battles instanceof Map ? [...battles.entries()] : Object.entries(battles || {});
  const executions = [];
  const guardClears = [];
  const failedApprovals = [];
  const foreignKeys = {};
  const contradictions = [];
  const windows = [];
  let tradeRows = 0;
  const after = (ms) => ms == null || ms >= sinceMs; // an unreadable time is listed, never skipped

  for (const [battleId, battle] of entries) {
    const trades = Array.isArray(battle?.trades) ? battle.trades : [];
    const feed = Array.isArray(battle?.statusFeed) ? battle.statusFeed : [];
    const history = Array.isArray(battle?.proposalHistory) ? battle.proposalHistory : [];
    tradeRows += trades.length;
    const tradeTimes = trades.map((t) => toMs(t?.swappedOutAt)).filter((ms) => ms != null);
    const feedTimes = feed.map((b) => toMs(b?.timestamp)).filter((ms) => ms != null);
    const iso = (list, pick) => (list.length ? new Date(pick(...list)).toISOString() : null);
    windows.push({
      battleId, status: battle?.status ?? null, executionMode: battle?.executionMode ?? null,
      trades: trades.length, tradesFrom: iso(tradeTimes, Math.min), beats: feed.length, beatsFrom: iso(feedTimes, Math.min), proposalHistory: history.length,
    });

    for (const beat of feed) {
      if (!isProposalExecutionBeat(beat)) continue;
      const at = toMs(beat.timestamp);
      if (!after(at)) continue;
      executions.push({
        battleId, kind: 'feed beat', at: at == null ? 'time unknown' : beat.timestamp, symbolOut: beat.symbolOut ?? null, symbolIn: beat.symbolIn ?? null,
        message: String(beat.message ?? ''), trades: tradesForBeat(beat, trades).map(short),
      });
    }
    for (const row of history) {
      if (!isExecutedResolution(row)) continue;
      const atMs = toMs(row.resolvedAt) ?? toMs(row.createdAt);
      if (!after(atMs)) continue;
      const at = atMs == null ? 'time unknown' : (row.resolvedAt ?? row.createdAt);
      const near = tradesNear(row.symbolIn, atMs, trades).map(short);
      const base = { battleId, at, proposalId: row.proposalId ?? null, symbolOut: row.symbolOut ?? null, symbolIn: row.symbolIn ?? null };
      if (row.systemNote === 'launch_guard_clear') {
        // The guard itself writes exactly resolution 'auto_executed' by 'system';
        // its note on any other resolution was planted (review IV4-I4-5).
        const genuine = row.resolution === 'auto_executed' && row.resolvedBy === 'system';
        if (near.length) executions.push({ ...base, kind: 'history row — claims a launch-guard clear, but a same-pair trade sits beside it', message: `resolution '${row.resolution}'`, trades: near });
        else if (!genuine) executions.push({ ...base, kind: 'history row — carries the launch guard\'s note on a resolution the guard never writes', message: `resolution '${row.resolution}'`, trades: near });
        else guardClears.push(base);
      } else if (row.executionFailed === true) {
        if (near.length) executions.push({ ...base, kind: 'history row — marked failed, but a same-pair trade sits beside it', message: `resolution '${row.resolution}'`, trades: near });
        else failedApprovals.push(base);
      } else {
        executions.push({ ...base, kind: 'history row', message: `resolution '${row.resolution}'`, trades: near });
      }
    }
    let prevMs = null;
    trades.forEach((trade, index) => {
      for (const key of foreignKeysOf(trade)) {
        const slot = (foreignKeys[key] ||= { rows: 0, battles: [], samples: [] });
        slot.rows += 1;
        if (!slot.battles.includes(battleId)) slot.battles.push(battleId);
        if (slot.samples.length < 5) slot.samples.push({ battleId, index, ...short(trade), value: JSON.stringify(trade[key])?.slice(0, 120) ?? 'undefined' });
      }
      const ms = toMs(trade?.swappedOutAt);
      if (gainContradictsPrices(trade)) contradictions.push({ battleId, index, why: 'gain does not follow from its prices', ...short(trade), lockedGainPct: trade.lockedGainPct });
      if (ms != null && prevMs != null && ms < prevMs) contradictions.push({ battleId, index, why: 'swapped out before the row it follows', ...short(trade), lockedGainPct: trade?.lockedGainPct ?? null });
      if (ms != null) prevMs = ms;
    });
  }

  return {
    battles: entries.length, tradeRows, sinceMs, executions, guardClears, failedApprovals, foreignKeys, contradictions, windows,
    flagged: executions.length > 0 || guardClears.length > 0 || failedApprovals.length > 0
      || Object.keys(foreignKeys).length > 0 || contradictions.length > 0,
  };
}

/** The census as a Markdown report. */
export function renderPlantedProposalCensus(result, { readAt = null } = {}) {
  const L = [];
  const p = (s = '') => L.push(s);
  const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const tbl = (head, rows) => { p(`| ${head.join(' | ')} |`); p(`|${head.map(() => '---').join('|')}|`); for (const r of rows) p(`| ${r.map(cell).join(' | ')} |`); };
  const tradesCell = (e) => (e.trades.length
    ? e.trades.map((t) => `${t.lockedPoints} · ${t.entryPrice} → ${t.exitPrice} · ${t.evaluationId}`).join('; ')
    : (e.kind === 'feed beat' ? 'none matched (forged symbol/time, or aged out)' : '—'));
  p('# Planted-proposal census (integrity build — client-forged proposal data)');
  p();
  p(`Read at: ${readAt ?? 'n/a'} · battles read: ${result.battles} · trade rows: ${result.tradeRows} · executions counted from ${new Date(result.sinceMs).toISOString()} (the launch guard landed ${LAUNCH_GUARD_LANDED} — PR #421, fcbd71c5 / 84254065)`);
  p();
  p(`**Verdict:** ${result.flagged ? 'FOUND — read §1, §1b, §1c, §2 and §2b.' : 'nothing found in the retained window.'}`);
  p();
  p('## 1. Proposals that executed after the launch guard landed');
  p();
  p('No server path has created a proposal since the guard landed, so each row below is a client-written proposal the cron acted on (or, on 20 May only, a pre-guard leftover). The feed beat is the server\'s own record; a history row was the client\'s record copied whole, so its notes and times can be planted — a row that claims a launch-guard clear or a failure is listed here when a same-pair trade sits beside it. The matched trade rows show what landed on `trades[]` — compare `lockedPoints` and the prices with the market at that time. (An approved proposal that lapsed because its bench stock was gone also files `approved`: its beat says "could not execute" and no trade matches.)');
  p();
  if (result.executions.length) {
    tbl(['Battle', 'Evidence', 'At', 'Out → In', 'Message', 'Matched trade rows (lockedPoints · entry → exit · evaluationId)'],
      result.executions.map((e) => [e.battleId, e.kind, e.at, `${e.symbolOut ?? '—'} → ${e.symbolIn ?? '—'}`, e.message.slice(0, 80), tradesCell(e)]));
  } else {
    p('None in the retained window.');
  }
  p();
  p('### 1b. Proposals the launch guard cleared after it landed (not executed)');
  p();
  if (result.guardClears.length) {
    tbl(['Battle', 'At', 'proposalId', 'Out → In'], result.guardClears.map((g) => [g.battleId, g.at, g.proposalId, `${g.symbolOut ?? '—'} → ${g.symbolIn ?? '—'}`]));
    p();
    p('Each is a proposal written by a client after the guard landed (or a leftover pending at the deploy), cleared without a trade beside it — an attempt that did not get through. Many of them on one battle can also be an attempt to push older rows out of the 50-row history.');
  } else {
    p('None.');
  }
  p();
  p('### 1c. Approved proposals marked failed, with no trade beside them');
  p();
  if (result.failedApprovals.length) {
    tbl(['Battle', 'At', 'proposalId', 'Out → In'], result.failedApprovals.map((g) => [g.battleId, g.at, g.proposalId, `${g.symbolOut ?? '—'} → ${g.symbolIn ?? '—'}`]));
    p();
    p('Still a planted proposal (no server path creates one); the failure marker itself may have been planted — check the feed for a "Coach approved" / "Auto-executed" beat on that day.');
  } else {
    p('None.');
  }
  p();
  p('## 2. Trade rows carrying a key outside the executor\'s fields and the metadata allowlist');
  p();
  const keys = Object.entries(result.foreignKeys);
  if (keys.length) {
    tbl(['Key', 'Rows', 'Battles', 'Samples (battle #row: value · out → in · lockedPoints)'],
      keys.map(([k, v]) => [k, String(v.rows), v.battles.join(', '), v.samples.map((s) => `${s.battleId} #${s.index}: ${s.value} · ${s.symbolOut} → ${s.symbolIn} · ${s.lockedPoints}`).join('; ')]));
    p();
    p('A key here reached the row through the executor\'s metadata spread — before the integrity build only the proposal paths spread a client-written object there. A key older code wrote legitimately would show on many rows across many battles; a planted one on few.');
  } else {
    p('None — every retained row carries only the executor\'s fields and allowlisted metadata keys.');
  }
  p();
  p('### 2b. Trade rows that contradict themselves');
  p();
  if (result.contradictions.length) {
    tbl(['Battle', '#row', 'Why', 'Out → In', 'entry → exit', 'lockedGainPct', 'lockedPoints', 'swappedOutAt'],
      result.contradictions.map((c) => [c.battleId, String(c.index), c.why, `${c.symbolOut} → ${c.symbolIn}`, `${c.entryPrice} → ${c.exitPrice}`, String(c.lockedGainPct), String(c.lockedPoints), c.swappedOutAt]));
  } else {
    p('None.');
  }
  p();
  p('## 3. Retained windows');
  p();
  tbl(['Battle', 'Status', 'executionMode', 'Trade rows', 'Trades from', 'Feed beats', 'Beats from', 'proposalHistory rows'],
    result.windows.map((w) => [w.battleId, w.status, w.executionMode, String(w.trades), w.tradesFrom, String(w.beats), w.beatsFrom, String(w.proposalHistory)]));
  return L.join('\n');
}

/** Read every battle through a READ-ONLY reader and compute the census. */
export async function runPlantedProposalCensus(reader, { sinceMs = Date.parse(LAUNCH_GUARD_LANDED) } = {}) {
  const index = await reader.listBattles();
  const battles = await reader.readBattles(index.map((b) => b.id));
  return computePlantedProposalCensus(battles, { sinceMs });
}

/** The Firestore reader main() uses — reads only. */
export function firestoreReader(db) {
  return {
    async listBattles() {
      const snap = await db.collection('agentBattles').select('status').get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async readBattles(ids) {
      const pairs = [];
      for (let i = 0; i < ids.length; i += 50) {
        const refs = ids.slice(i, i + 50).map((id) => db.collection('agentBattles').doc(id));
        for (const snap of await db.getAll(...refs)) if (snap.exists) pairs.push([snap.id, snap.data()]);
      }
      return new Map(pairs);
    },
  };
}

export function parseArgs(argv) {
  const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const inline = argv.find((a) => a.startsWith('--since='));
  const sinceText = inline ? inline.slice('--since='.length) : (argv.includes('--since') ? argOf('--since') : null);
  if ((inline || argv.includes('--since')) && !sinceText) throw new Error('--since needs an ISO instant');
  const sinceMs = sinceText != null ? Date.parse(sinceText) : Date.parse(LAUNCH_GUARD_LANDED);
  if (!Number.isFinite(sinceMs)) throw new Error(`--since needs an ISO instant, got "${sinceText}"`);
  return { outPath: argOf('--out'), jsonPath: argOf('--json'), sinceMs };
}

async function main() {
  const { outPath, jsonPath, sinceMs } = parseArgs(process.argv.slice(2));
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const readAt = new Date().toISOString();
  const result = await runPlantedProposalCensus(firestoreReader(getFirebaseAdmin()), { sinceMs });
  const md = renderPlantedProposalCensus(result, { readAt });
  if (outPath) writeFileSync(outPath, md + '\n');
  else console.log(md);
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ readAt, ...result }, null, 2));
  console.error(`[census-planted-proposals] battles=${result.battles} rows=${result.tradeRows} executions=${result.executions.length} guard-clears=${result.guardClears.length} foreign-keys=${Object.keys(result.foreignKeys).length} contradictions=${result.contradictions.length}`);
  if (result.flagged) process.exitCode = 2;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(err); process.exit(1); });
