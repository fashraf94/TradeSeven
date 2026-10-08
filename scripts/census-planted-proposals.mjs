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
// TWO READS, per battle:
//   1. PROPOSAL EXECUTIONS AFTER THE GUARD — the server's own record that a
//      proposal ran: a `statusFeed` beat with source 'proposal_system' and
//      action 'swap' ("Coach approved: Swap …" / "Auto-executed: Swap …"), and
//      a `proposalHistory` row resolved 'approved' (no executionFailed) or
//      'auto_executed' WITHOUT the launch guard's systemNote; each with the
//      trade rows it matches (same incoming symbol, swapped out within five
//      minutes of the beat). A beat with no matching row still counts — a
//      forged row can carry another symbol and time. The beat's timestamp is the
//      server's; an APPROVED row's resolvedAt was written by the client (it can be
//      backdated), so the beats are the stronger evidence. Also listed: proposals the
//      launch guard CLEARED after it landed (systemNote 'launch_guard_clear') —
//      a planted proposal that did not get through, or a pre-guard leftover.
//   2. TRADE ROWS CARRYING A FOREIGN KEY — any key outside the executor's
//      computed fields plus the metadata allowlist (api/_utils/executorMetadata.js),
//      by key, with the battles and rows that carry it. A forged row may also
//      carry only known keys with forged VALUES: read 1 is the signal for those.
//
// RETENTION: `trades[]` keeps 50 rows, the feed 100 beats, `proposalHistory[]`
// 50 rows — the census covers what the battle documents still hold.
//
// READ-ONLY BY CONSTRUCTION — `.select()`, `.get()`, `getAll()` only;
// scripts/census-planted-proposals.test.js pins every member call in this file
// to a reviewed allowlist. The only files it writes are --out and --json.
// Credentials (scripts/loadLocalEnv.js + getFirebaseAdmin()) load only inside
// main(); importing the module touches nothing. The founder runs it.
//
// USAGE (repo root):
//   node scripts/census-planted-proposals.mjs [--since=<ISO>] [--out <report.md>] [--json <data.json>]
//     --since=<ISO> (or `--since <ISO>`): count executions at/after this instant
//     instead of the guard's merge. Exit code 2 when read 1 or read 2 finds anything.

import { writeFileSync } from 'node:fs';
import { EXECUTOR_COMPUTED_KEYS, EXECUTOR_METADATA_KEYS } from '../api/_utils/executorMetadata.js';

/** The model path's launch guard landed on main: PR #421's merge commit fcbd71c5 (carrying 84254065). */
export const LAUNCH_GUARD_LANDED = '2026-05-20T17:17:29.000Z';
/** A trade row may carry these keys and nothing else. */
export const TRADE_ROW_KEYS = Object.freeze([...EXECUTOR_COMPUTED_KEYS, ...EXECUTOR_METADATA_KEYS]);
/** How close a trade's swappedOutAt must sit to a proposal beat to be its row. */
export const MATCH_WINDOW_MS = 5 * 60 * 1000;

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

/** Is this history row a proposal the server filed as executed (not a launch-guard clear, not a failure)? */
export function isExecutedProposalRow(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.systemNote === 'launch_guard_clear' || row.executionFailed === true) return false;
  return row.resolution === 'approved' || row.resolution === 'auto_executed';
}

/** The trade rows a proposal beat matches: the same incoming symbol, swapped out within the window. */
export function tradesForBeat(beat, trades) {
  const at = toMs(beat?.timestamp);
  return (Array.isArray(trades) ? trades : []).filter((t) => t?.symbolIn === beat?.symbolIn
    && at != null && toMs(t?.swappedOutAt) != null && Math.abs(toMs(t.swappedOutAt) - at) <= MATCH_WINDOW_MS);
}

/** The keys of a trade row outside TRADE_ROW_KEYS. */
export function foreignKeysOf(trade) {
  return trade && typeof trade === 'object' && !Array.isArray(trade) ? Object.keys(trade).filter((k) => !KNOWN.has(k)) : [];
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
  const foreignKeys = {};
  const windows = [];
  let tradeRows = 0;
  const after = (ms) => ms != null && ms >= sinceMs;

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
      if (!isProposalExecutionBeat(beat) || !after(toMs(beat.timestamp))) continue;
      executions.push({
        battleId, kind: 'feed beat', at: beat.timestamp, symbolOut: beat.symbolOut ?? null, symbolIn: beat.symbolIn ?? null,
        message: String(beat.message ?? ''), trades: tradesForBeat(beat, trades).map(short),
      });
    }
    for (const row of history) {
      const at = toMs(row?.resolvedAt) ?? toMs(row?.createdAt);
      if (!after(at)) continue;
      if (row?.systemNote === 'launch_guard_clear') {
        guardClears.push({ battleId, at: row.resolvedAt ?? null, proposalId: row.proposalId ?? null, symbolOut: row.symbolOut ?? null, symbolIn: row.symbolIn ?? null });
        continue;
      }
      if (isExecutedProposalRow(row)) {
        executions.push({ battleId, kind: 'history row', at: row.resolvedAt ?? null, symbolOut: row.symbolOut ?? null, symbolIn: row.symbolIn ?? null, message: `resolution '${row.resolution}'`, trades: [] });
      }
    }
    trades.forEach((trade, index) => {
      for (const key of foreignKeysOf(trade)) {
        const slot = (foreignKeys[key] ||= { rows: 0, battles: [], samples: [] });
        slot.rows += 1;
        if (!slot.battles.includes(battleId)) slot.battles.push(battleId);
        if (slot.samples.length < 5) slot.samples.push({ battleId, index, ...short(trade), value: JSON.stringify(trade[key])?.slice(0, 120) ?? 'undefined' });
      }
    });
  }

  return {
    battles: entries.length, tradeRows, sinceMs, executions, guardClears, foreignKeys, windows,
    flagged: executions.length > 0 || Object.keys(foreignKeys).length > 0,
  };
}

/** The census as a Markdown report. */
export function renderPlantedProposalCensus(result, { readAt = null } = {}) {
  const L = [];
  const p = (s = '') => L.push(s);
  const tbl = (head, rows) => { p(`| ${head.join(' | ')} |`); p(`|${head.map(() => '---').join('|')}|`); for (const r of rows) p(`| ${r.join(' | ')} |`); };
  const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  p('# Planted-proposal census (integrity build — client-forged proposal data)');
  p();
  p(`Read at: ${readAt ?? 'n/a'} · battles read: ${result.battles} · trade rows: ${result.tradeRows} · executions counted from ${new Date(result.sinceMs).toISOString()} (the launch guard landed ${LAUNCH_GUARD_LANDED} — PR #421, fcbd71c5 / 84254065)`);
  p();
  p(`**Verdict:** ${result.flagged ? 'FOUND — read §1 and §2.' : 'nothing found in the retained window.'}`);
  p();
  p('## 1. Proposals that executed after the launch guard landed');
  p();
  p('No server path has created a proposal since the guard landed, so each row below is a client-written proposal that reached the executor (or, on 20 May only, a pre-guard leftover). The matched trade rows show what landed on `trades[]` — compare `lockedPoints` and the prices with the market at that time.');
  p();
  if (result.executions.length) {
    tbl(['Battle', 'Evidence', 'At', 'Out → In', 'Message', 'Matched trade rows (lockedPoints · entry → exit · evaluationId)'],
      result.executions.map((e) => [cell(e.battleId), e.kind, cell(e.at), `${cell(e.symbolOut)} → ${cell(e.symbolIn)}`, cell(e.message.slice(0, 80)),
        e.trades.length ? e.trades.map((t) => `${t.lockedPoints} · ${t.entryPrice} → ${t.exitPrice} · ${t.evaluationId}`).join('; ') : (e.kind === 'feed beat' ? 'none matched (forged symbol/time, or aged out)' : '—')]));
  } else {
    p('None in the retained window.');
  }
  p();
  p('### 1b. Proposals the launch guard cleared after it landed (not executed)');
  p();
  if (result.guardClears.length) {
    tbl(['Battle', 'At', 'proposalId', 'Out → In'], result.guardClears.map((g) => [cell(g.battleId), cell(g.at), cell(g.proposalId), `${cell(g.symbolOut)} → ${cell(g.symbolIn)}`]));
    p();
    p('Each is a proposal on a battle the guard treated as auto-pilot — written by a client after the guard landed, or a leftover pending at the deploy. Nothing executed.');
  } else {
    p('None.');
  }
  p();
  p('## 2. Trade rows carrying a key outside the executor\'s fields and the metadata allowlist');
  p();
  const keys = Object.entries(result.foreignKeys);
  if (keys.length) {
    tbl(['Key', 'Rows', 'Battles', 'Samples (battle #row: value · out → in · lockedPoints)'],
      keys.map(([k, v]) => [cell(k), String(v.rows), cell(v.battles.join(', ')), v.samples.map((s) => `${s.battleId} #${s.index}: ${cell(s.value)} · ${s.symbolOut} → ${s.symbolIn} · ${s.lockedPoints}`).join('; ')]));
    p();
    p('A key here reached the row through the executor\'s metadata spread — before the integrity build only the proposal paths spread a client-written object there. A key older code wrote legitimately would show on many rows across many battles; a planted one on few.');
  } else {
    p('None — every retained row carries only the executor\'s fields and allowlisted metadata keys.');
  }
  p();
  p('## 3. Retained windows');
  p();
  tbl(['Battle', 'Status', 'executionMode', 'Trade rows', 'Trades from', 'Feed beats', 'Beats from', 'proposalHistory rows'],
    result.windows.map((w) => [cell(w.battleId), cell(w.status), cell(w.executionMode), String(w.trades), cell(w.tradesFrom), String(w.beats), cell(w.beatsFrom), String(w.proposalHistory)]));
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
  console.error(`[census-planted-proposals] battles=${result.battles} rows=${result.tradeRows} executions=${result.executions.length} guard-clears=${result.guardClears.length} foreign-keys=${Object.keys(result.foreignKeys).length}`);
  if (result.flagged) process.exitCode = 2;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(err); process.exit(1); });
