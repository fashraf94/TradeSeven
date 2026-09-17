// scripts/vwap-exit-dating-census.js
//
// VWAP Exit Dating Census — READ-ONLY.
//
// Sibling of the Exit Dials Q5 live census (`exit-dials-live-census.js`, which
// lives on `origin/claude/stoic-cray-wwhf0n` and is NOT on `main`); this script
// reuses that script's Firestore walk and credential pattern verbatim in shape:
// one `.get()` over `agentBattles`, then an in-memory pass over `trades[]`.
//
// THE QUESTION
// ------------
// A parallel arc found `momentumData.vwap` was populated with the PRIOR
// session's VWAP from 2026-05-06 → 2026-06-12, and empty (inert) before and
// after. The exit-dials census counted 96 `vwap_failure` exits across 468
// battles. If all 96 land inside that window, the two findings agree. Any exit
// AFTER 2026-06-12 contradicts the "inert after" half — the lag is not
// constant — and that is the finding to surface loudly.
//
// WHAT IT REPORTS (per the three asks)
// ------------------------------------
//  1. EXIT DATE, bucketed at the two boundaries:
//        before 2026-05-06 · 2026-05-06→2026-06-12 (inclusive) · after 2026-06-12
//     Counts per bucket, plus the full dated list for the third bucket printed
//     individually. Exit date is the ET calendar date of `trades[].swappedOutAt`
//     (an ISO string — agentSwapExecution.js:165,265). ET via `Intl` /
//     `America/New_York`, never a hand-rolled offset (BUILD_RULES §6).
//     NOTE: `trades[].swapDay` is a battle-day INDEX, not a date
//     (agent-evaluate.js:677,1004) — it is reported but never bucketed on.
//
//  2. THE WRITER. Two populations that mean different things, and they live in
//     DIFFERENT parts of the battle doc:
//       (a) the risk-manager FLOOR — `trades[].exitReason === 'vwap_failure'`,
//           stamped from `riskResult.reason` at agent-evaluate.js:1577 with
//           `source: 'risk_manager'` (buildSwapReceiptSource, agentRiskManager.js:569;
//           the `swapSource` ternary at agent-evaluate.js:1556 sends only
//           'stagnation' to 'archetype', so a vwap_failure fire is always
//           'risk_manager'). The engine fired. This is the population of 96.
//       (b) a MODEL SWAP CITING THE RULE NAME — the tool schema's `cited_rules`
//           enumerates "vwap_failure" as a standard strategy name
//           (agentEvalToolSchema.js:119). That self-report lands on
//           `statusFeed[].citedRules` with `source: 'haiku'`
//           (agent-evaluate.js:2789,2809) — NOT on `trades[]`. The model said
//           VWAP drove it. That is a claim, not a fire.
//     Every model swap path stamps `exitReason` 'haiku_decision' or
//     'guardrail_*' (agent-evaluate.js:2468,2747,3338,3544; the R11
//     deterministic pass is guarded to 'guardrail_*' at :3799), so a
//     `trades[]` row carrying exitReason 'vwap_failure' with a non-risk_manager
//     `source` is structurally unexpected — the script flags any such row.
//     `trades[].trade_reasoning.citedRules` is also scanned (schema:98) for the
//     name, since that object rides onto the trade record.
//
//  3. HOW STALE THE VWAP ACTUALLY WAS, in days. Two vintages, never conflated:
//       - AT THE EXIT TICK (exact, per-trade): the exit tick's own
//         `momentumData.vwap[sym].sessionDate`, frozen onto
//         `trades[].snapshot.symbolOut.intraday.sessionDate` by
//         buildTechnicalSnapshot (buildTechnicalSnapshot.js:104; risk-path
//         snapshot built at agent-evaluate.js:1619). THIS is the number the ask
//         wants — staleness = exitDateET − sessionDate, in calendar days.
//       - AT THE LAST TICK (residue, whole-battle): `cronState.intradayMomentum`
//         is OVERWRITTEN on every flush (agentCronState.js:39), so what survives
//         on the doc is the battle's FINAL tick, not the exit tick. It is
//         reported as a clearly-labelled fallback for trades whose snapshot is
//         missing, and is NEVER mixed into the exit-tick staleness histogram.
//
// GATE CONTEXT (verified, for reading the output — not asserted by the script):
// `isVwapSessionUsable` (agentVwapFloor.js:36) publishes NO vwap entry unless
// `sessionDate === todayET && sessionCandleCount >= 3`, applied at
// agent-evaluate.js:986. With that gate live, staleness > 0 is unreachable. It
// first appears in history at `eaf2a0e2` (2026-09-02) — AFTER both boundaries —
// so it explains neither the 2026-05-06 start nor the 2026-06-12 end.
//
// STRICTLY READ-ONLY: `.get()` calls plus a local JSON report. No Firestore
// writes, no writer imported.
//
// Needs the same creds as the serverless functions — FIREBASE_PROJECT_ID /
// FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, from .env.local in the repo
// root via ./loadLocalEnv.js. Same single credential path as the sibling
// census; the FIREBASE_ADMIN_CREDENTIALS blob form is deliberately NOT a
// second path here.
//
// USAGE (from the repo root):
//   node scripts/vwap-exit-dating-census.js
//   node scripts/vwap-exit-dating-census.js --out /tmp/vwap-exit-dating.json
//   node scripts/vwap-exit-dating-census.js --battle-limit 2000
//
// EXIT CODES: 0 ok · 4 credentials not ready (from requireFirebaseCreds) ·
//             1 unexpected failure.

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds, PROJECT_ROOT } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';

import { writeFileSync } from 'node:fs';
import path from 'node:path';

const TARGET_EXIT_REASON = 'vwap_failure';
const RULE_NAME = 'vwap_failure';

// The two boundaries from the parallel arc. WINDOW is inclusive at both ends.
const WINDOW_START = '2026-05-06';
const WINDOW_END = '2026-06-12';

function die(msg) { console.error(`\nFATAL: ${msg}`); process.exit(1); }

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace. Exits 4; never prints secret values.
requireFirebaseCreds();

// ── date helpers ────────────────────────────────────────────────────────
// ET calendar date for an instant. Intl / America/New_York per BUILD_RULES §6 —
// never a hand-rolled offset, so the May→June DST-stable window is honest.
const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Coerce the several shapes `swappedOutAt` can legitimately carry → Date|null. */
function toDate(v) {
  if (v == null) return null;
  if (typeof v?.toDate === 'function') {            // Firestore Timestamp
    try { const d = v.toDate(); return Number.isNaN(d.getTime()) ? null : d; } catch { return null; }
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  if (typeof v === 'string') { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  return null;
}

/** YYYY-MM-DD in ET, or null. */
function etDate(v) {
  const d = toDate(v);
  if (!d) return null;
  const p = {};
  for (const { type, value } of ET_PARTS.formatToParts(d)) p[type] = value;
  if (!p.year || !p.month || !p.day) return null;
  return `${p.year}-${p.month}-${p.day}`;
}

/** Calendar-day difference a − b for two YYYY-MM-DD strings, or null. */
function dayDiff(a, b) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b || '')) return null;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

/** Bucket a YYYY-MM-DD exit date at the two boundaries. */
function bucketOf(date) {
  if (!date) return 'undated';
  if (date < WINDOW_START) return 'before';
  if (date <= WINDOW_END) return 'window';
  return 'after';
}

const asArray = (v) => (Array.isArray(v) ? v : []);
const citesRule = (arr) => asArray(arr).some((r) => typeof r === 'string' && r.trim().toLowerCase() === RULE_NAME);

async function main() {
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx > -1 ? process.argv[outIdx + 1]
    : path.join(PROJECT_ROOT, 'vwap-exit-dating-census-report.json');
  const limIdx = process.argv.indexOf('--battle-limit');
  const battleLimit = limIdx > -1 ? Number(process.argv[limIdx + 1]) : 0; // 0 = all

  const db = getFirebaseAdmin();

  let battlesQuery = db.collection('agentBattles');
  if (battleLimit > 0) battlesQuery = battlesQuery.limit(battleLimit);
  const battlesSnap = await battlesQuery.get(); // READ-ONLY

  const scan = {
    battlesScanned: 0,
    battlesWithTrades: 0,
    tradesScanned: 0,
    vwapFailureExits: 0,
    statusFeedEntriesScanned: 0,
    battlesMissing: 0,   // vwap_failure trades whose battle doc lacks cronState
  };

  // (1) buckets · (2) writers · (3) staleness
  const buckets = { before: 0, window: 0, after: 0, undated: 0 };
  const bucketRows = { before: [], window: [], after: [], undated: [] };
  const writerCounts = {};          // trades[].source → n
  const writerByBucket = {};        // source → { before, window, after, undated }
  const anomalies = [];             // exitReason vwap_failure w/ unexpected source
  const staleness = { measured: 0, byDays: {}, noSnapshot: 0, snapshotNoSessionDate: 0, undatedExit: 0 };
  const lastTickFallback = { measured: 0, byDays: {}, unavailable: 0 };

  // (2b) the model-self-report population — statusFeed[].citedRules
  const cited = {
    entries: 0,
    byBucket: { before: 0, window: 0, after: 0, undated: 0 },
    bySource: {},
    byAction: {},
    rows: [],
    onTradeReasoning: 0,     // trades[].trade_reasoning.citedRules naming the rule
    tradeReasoningRows: [],
  };

  for (const d of battlesSnap.docs) {
    const b = d.data();
    scan.battlesScanned += 1;

    const trades = asArray(b.trades);
    if (trades.length > 0) scan.battlesWithTrades += 1;
    scan.tradesScanned += trades.length;

    // cronState.intradayMomentum — LAST TICK ONLY (agentCronState.js:39).
    const lastTickMomentum = (b.cronState && typeof b.cronState.intradayMomentum === 'object')
      ? b.cronState.intradayMomentum : null;
    if (!b.cronState) scan.battlesMissing += 1;

    for (const t of trades) {
      if (!t || typeof t !== 'object') continue;

      // ── the model self-report riding on the trade record (schema:98) ──
      if (citesRule(t.trade_reasoning?.citedRules)) {
        cited.onTradeReasoning += 1;
        const dt = etDate(t.swappedOutAt);
        cited.tradeReasoningRows.push({
          battleId: d.id, tradeId: t.id ?? null, exitDateET: dt, bucket: bucketOf(dt),
          exitReason: t.exitReason ?? null, source: t.source ?? null,
          symbolOut: t.symbolOut ?? null, symbolIn: t.symbolIn ?? null,
          citedRules: asArray(t.trade_reasoning?.citedRules),
        });
      }

      if (t.exitReason !== TARGET_EXIT_REASON) continue;
      scan.vwapFailureExits += 1;

      // ── (1) exit date + bucket ──
      const exitDateET = etDate(t.swappedOutAt);
      const bucket = bucketOf(exitDateET);
      buckets[bucket] += 1;

      // ── (2) writer ──
      const source = t.source ?? '(unstamped)';
      writerCounts[source] = (writerCounts[source] || 0) + 1;
      writerByBucket[source] = writerByBucket[source] || { before: 0, window: 0, after: 0, undated: 0 };
      writerByBucket[source][bucket] += 1;

      // ── (3) staleness at the EXIT TICK (exact) ──
      const snapSessionDate = t.snapshot?.symbolOut?.intraday?.sessionDate ?? null;
      let stalenessDays = null;
      if (!t.snapshot?.symbolOut?.intraday) staleness.noSnapshot += 1;
      else if (!snapSessionDate) staleness.snapshotNoSessionDate += 1;
      else if (!exitDateET) staleness.undatedExit += 1;
      else {
        stalenessDays = dayDiff(exitDateET, snapSessionDate);
        if (stalenessDays !== null) {
          staleness.measured += 1;
          staleness.byDays[stalenessDays] = (staleness.byDays[stalenessDays] || 0) + 1;
        }
      }

      // ── (3b) LAST-TICK residue, labelled, never merged into the above ──
      const lastTickSessionDate = (lastTickMomentum && t.symbolOut)
        ? (lastTickMomentum[t.symbolOut]?.sessionDate ?? null) : null;
      let lastTickStalenessDays = null;
      if (lastTickSessionDate && exitDateET) {
        lastTickStalenessDays = dayDiff(exitDateET, lastTickSessionDate);
        if (lastTickStalenessDays !== null) {
          lastTickFallback.measured += 1;
          lastTickFallback.byDays[lastTickStalenessDays] = (lastTickFallback.byDays[lastTickStalenessDays] || 0) + 1;
        }
      } else {
        lastTickFallback.unavailable += 1;
      }

      const row = {
        battleId: d.id,
        agentId: b.agentId ?? null,
        ownerId: b.ownerId ?? null,
        gameMode: b.gameMode ?? null,
        battleStatus: b.status ?? null,
        tradeId: t.id ?? null,
        symbolOut: t.symbolOut ?? null,
        symbolIn: t.symbolIn ?? null,
        exitDateET,
        exitInstant: typeof t.swappedOutAt === 'string' ? t.swappedOutAt : (toDate(t.swappedOutAt)?.toISOString() ?? null),
        bucket,
        // swapDay is a battle-day INDEX, not a date — carried, never bucketed on.
        swapDay: t.swapDay ?? null,
        tradingDay: t.tradingDay ?? null,
        // (2) writer
        source,
        archetype: t.archetype ?? null,
        hftKnobsSource: t.hftKnobsSource ?? null,
        trigger: t.trigger ?? null,
        swapMotive: t.swapMotive ?? null,
        entryPreset: t.entryPreset ?? null,
        // (3) staleness
        exitTickSessionDate: snapSessionDate,
        stalenessDays,
        exitTickVwap: t.snapshot?.symbolOut?.intraday?.vwap ?? null,
        exitTickVwapDeviation: t.snapshot?.symbolOut?.intraday?.vwapDeviation ?? null,
        exitTickCurrentPrice: t.snapshot?.symbolOut?.intraday?.currentPrice ?? null,
        // (3b) last-tick residue — DIFFERENT VINTAGE, labelled
        lastTickSessionDate,
        lastTickStalenessDays,
      };
      bucketRows[bucket].push(row);

      // Structurally unexpected writer for this exitReason.
      if (source !== 'risk_manager') anomalies.push(row);
    }

    // ── (2b) the model self-report on the status feed ──
    const feed = asArray(b.statusFeed);
    scan.statusFeedEntriesScanned += feed.length;
    for (const e of feed) {
      if (!e || typeof e !== 'object') continue;
      if (!citesRule(e.citedRules)) continue;
      cited.entries += 1;
      const dt = etDate(e.timestamp);
      const bk = bucketOf(dt);
      cited.byBucket[bk] += 1;
      const src = e.source ?? '(unstamped)';
      cited.bySource[src] = (cited.bySource[src] || 0) + 1;
      const act = e.action ?? '(none)';
      cited.byAction[act] = (cited.byAction[act] || 0) + 1;
      cited.rows.push({
        battleId: d.id,
        agentId: b.agentId ?? null,
        dateET: dt,
        bucket: bk,
        timestamp: typeof e.timestamp === 'string' ? e.timestamp : (toDate(e.timestamp)?.toISOString() ?? null),
        source: src,
        action: act,
        symbolOut: e.symbolOut ?? null,
        symbolIn: e.symbolIn ?? null,
        triggeredBy: e.triggeredBy ?? null,
        citedRules: asArray(e.citedRules),
      });
    }
  }

  const sortByDate = (rows) => rows.sort((x, y) => String(x.exitDateET ?? x.dateET).localeCompare(String(y.exitDateET ?? y.dateET)));
  for (const k of Object.keys(bucketRows)) sortByDate(bucketRows[k]);
  sortByDate(cited.rows);

  const verdict = {
    totalVwapFailureExits: scan.vwapFailureExits,
    allInsideWindow: buckets.before === 0 && buckets.after === 0 && buckets.undated === 0,
    exitsAfterWindowEnd: buckets.after,
    // The loud one: any post-2026-06-12 fire contradicts the "inert after" half.
    CONTRADICTS_INERT_AFTER: buckets.after > 0,
    exitsBeforeWindowStart: buckets.before,
    CONTRADICTS_INERT_BEFORE: buckets.before > 0,
    undatedExits: buckets.undated,
    nonRiskManagerWriters: anomalies.length,
    modelCitedRuleNameEntries: cited.entries,
    modelCitedAfterWindowEnd: cited.byBucket.after,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    question: 'VWAP exit dating — do the 96 vwap_failure exits fall inside 2026-05-06 → 2026-06-12?',
    boundaries: { windowStart: WINDOW_START, windowEnd: WINDOW_END, inclusive: true, timezone: 'America/New_York' },
    provenance: {
      exitDate: 'trades[].swappedOutAt (ISO) → ET calendar date; agentSwapExecution.js:165,265',
      floorWriter: "trades[].exitReason==='vwap_failure' + trades[].source; agent-evaluate.js:1577,1556",
      modelSelfReport: "statusFeed[].citedRules contains 'vwap_failure'; agent-evaluate.js:2789,2809; schema agentEvalToolSchema.js:119",
      exitTickSessionDate: 'trades[].snapshot.symbolOut.intraday.sessionDate; buildTechnicalSnapshot.js:104 — EXIT TICK',
      lastTickSessionDate: 'cronState.intradayMomentum[sym].sessionDate; agentCronState.js:39 — LAST TICK OF THE BATTLE, not the exit tick',
    },
    scan,
    buckets,
    writers: { counts: writerCounts, byBucket: writerByBucket, anomalies },
    stalenessAtExitTick: staleness,
    stalenessAtLastTick_residue: lastTickFallback,
    modelCitedRuleName: cited,
    rows: bucketRows,
    verdict,
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2));

  // ── console ───────────────────────────────────────────────────────────
  const p = (s) => console.log(s);
  p('\n===== VWAP EXIT DATING CENSUS (READ-ONLY) =====\n');
  p('SCAN');
  p(`  battles scanned ................ ${scan.battlesScanned}`);
  p(`  battles with trades[] .......... ${scan.battlesWithTrades}`);
  p(`  trades scanned ................. ${scan.tradesScanned}`);
  p(`  statusFeed entries scanned ..... ${scan.statusFeedEntriesScanned}`);
  p(`  vwap_failure exits ............. ${scan.vwapFailureExits}`);

  p('\n(1) EXIT DATE BUCKETS  [ET, boundaries inclusive]');
  // Dotted leader to a fixed column so the four counts line up whatever the
  // boundary dates are (the arrow is one char, so .length is the right measure).
  const leader = (label, w = 32) => `  ${label} ${'.'.repeat(Math.max(1, w - label.length))} `;
  p(`${leader(`before ${WINDOW_START}`)}${buckets.before}`);
  p(`${leader(`${WINDOW_START} \u2192 ${WINDOW_END}`)}${buckets.window}`);
  p(`${leader(`after ${WINDOW_END}`)}${buckets.after}`);
  p(`${leader('undated (no parseable exit)')}${buckets.undated}`);

  if (buckets.after > 0) {
    p(`\n  *** ${buckets.after} EXIT(S) AFTER ${WINDOW_END} — contradicts "inert after" ***`);
    p('  date        battle / trade                     sym   src            staleness');
    for (const r of bucketRows.after) {
      const st = r.stalenessDays === null ? '—' : `${r.stalenessDays}d`;
      p(`  ${String(r.exitDateET).padEnd(11)} ${String(r.battleId).slice(0, 22).padEnd(23)} ${String(r.tradeId ?? '—').padEnd(10)} ${String(r.symbolOut ?? '—').padEnd(5)} ${String(r.source).padEnd(14)} ${st}`);
    }
  } else {
    p(`\n  No exits after ${WINDOW_END}.`);
  }
  if (buckets.before > 0) {
    p(`\n  *** ${buckets.before} EXIT(S) BEFORE ${WINDOW_START} — contradicts "inert before" ***`);
    for (const r of bucketRows.before) {
      p(`  ${String(r.exitDateET).padEnd(11)} ${String(r.battleId).slice(0, 22).padEnd(23)} ${String(r.symbolOut ?? '—').padEnd(5)} ${r.source}`);
    }
  }
  if (buckets.undated > 0) {
    p(`\n  *** ${buckets.undated} UNDATED exit(s) — swappedOutAt missing/unparseable (NOT bucketed) ***`);
    for (const r of bucketRows.undated) p(`  ${String(r.battleId).slice(0, 22).padEnd(23)} ${String(r.symbolOut ?? '—').padEnd(5)} ${r.source}`);
  }

  p('\n(2) WRITER — risk-manager floor (fires on trades[])');
  p('  source            total   before   window    after  undated');
  for (const [k, v] of Object.entries(writerCounts).sort((a, b) => b[1] - a[1])) {
    const bb = writerByBucket[k];
    p(`  ${k.padEnd(16)} ${String(v).padStart(5)}   ${String(bb.before).padStart(6)}   ${String(bb.window).padStart(6)}   ${String(bb.after).padStart(6)}   ${String(bb.undated).padStart(6)}`);
  }
  if (anomalies.length > 0) {
    p(`\n  *** ${anomalies.length} vwap_failure exit(s) with a NON-risk_manager source — structurally unexpected ***`);
    for (const r of anomalies) p(`  ${String(r.exitDateET).padEnd(11)} ${String(r.battleId).slice(0, 22).padEnd(23)} source=${r.source}`);
  } else {
    p('\n  All vwap_failure exits carry source=risk_manager (as the code implies).');
  }

  p(`\n(2b) WRITER — model swap CITING the rule name "${RULE_NAME}"`);
  p('     (self-report on statusFeed[].citedRules — a claim, not an engine fire)');
  p(`  entries ........................ ${cited.entries}`);
  p(`  before / window / after / undated  ${cited.byBucket.before} / ${cited.byBucket.window} / ${cited.byBucket.after} / ${cited.byBucket.undated}`);
  if (Object.keys(cited.bySource).length) {
    p('  by source:');
    for (const [k, v] of Object.entries(cited.bySource).sort((a, b) => b[1] - a[1])) p(`    ${k.padEnd(20)} ${v}`);
  }
  if (Object.keys(cited.byAction).length) {
    p('  by action:');
    for (const [k, v] of Object.entries(cited.byAction).sort((a, b) => b[1] - a[1])) p(`    ${k.padEnd(20)} ${v}`);
  }
  p(`  also on trades[].trade_reasoning.citedRules  ${cited.onTradeReasoning}`);
  if (cited.byBucket.after > 0) {
    p(`\n  *** ${cited.byBucket.after} model citation(s) after ${WINDOW_END} ***`);
    for (const r of cited.rows.filter((x) => x.bucket === 'after')) {
      p(`  ${String(r.dateET).padEnd(11)} ${String(r.battleId).slice(0, 22).padEnd(23)} ${String(r.action).padEnd(10)} ${String(r.symbolOut ?? '—').padEnd(5)} ${r.source}`);
    }
  }

  p('\n(3) VWAP STALENESS AT THE EXIT TICK  [exitDate − snapshot sessionDate, ET days]');
  p('    source: trades[].snapshot.symbolOut.intraday.sessionDate (frozen at the exit tick)');
  p(`  measurable ..................... ${staleness.measured} of ${scan.vwapFailureExits}`);
  p(`  no intraday snapshot ........... ${staleness.noSnapshot}`);
  p(`  snapshot w/o sessionDate ....... ${staleness.snapshotNoSessionDate}`);
  p(`  undated exit ................... ${staleness.undatedExit}`);
  if (staleness.measured > 0) {
    p('  days stale   exits');
    for (const [k, v] of Object.entries(staleness.byDays).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      p(`  ${String(k).padStart(9)}   ${v}${k === '0' ? '   (same-session — fresh)' : ''}`);
    }
  }

  p('\n(3b) SAME, AT THE BATTLE\'S LAST TICK  — DIFFERENT VINTAGE, do not conflate');
  p('     cronState.intradayMomentum is overwritten every flush (agentCronState.js:39),');
  p('     so this dates the battle\'s FINAL tick, not the exit. Context only.');
  p(`  measurable ..................... ${lastTickFallback.measured}`);
  p(`  unavailable .................... ${lastTickFallback.unavailable}`);
  if (lastTickFallback.measured > 0) {
    p('  days stale   exits');
    for (const [k, v] of Object.entries(lastTickFallback.byDays).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      p(`  ${String(k).padStart(9)}   ${v}`);
    }
  }

  p('\nVERDICT');
  for (const [k, v] of Object.entries(verdict)) {
    const shown = typeof v === 'boolean' ? (v ? 'YES' : 'no') : v;
    p(`  ${k.padEnd(30)} ${shown}`);
  }
  if (verdict.CONTRADICTS_INERT_AFTER) {
    p('\n  >>> The two findings DISAGREE. vwap_failure fired after ' + WINDOW_END + ',');
    p('  >>> so `momentumData.vwap` was NOT inert after that date — the lag is not');
    p('  >>> constant. See the dated list above before relying on the window premise.');
  } else if (verdict.allInsideWindow && scan.vwapFailureExits > 0) {
    p('\n  >>> Every vwap_failure exit falls inside the window. The two findings agree.');
  }

  p(`\nFull report → ${outPath}\n`);
}

main().catch((err) => die(err?.stack || err?.message || String(err)));
