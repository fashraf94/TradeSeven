#!/usr/bin/env node
// scripts/calibration/motive-baseline-summary.js
//
// Tier-1 swapMotive baseline summary — the R9 evidence pull (Exit-Behavior
// Rebalance: the pre-treatment motive baseline that informs the rollback
// trigger's N at the Asks 1+3 flip).
//
// READ ONLY. Walks agentBattles' trades[] and aggregates, over MODEL swaps
// (exitReason === 'haiku_decision'):
//   - the declared-motive distribution (defensive_cut / profit_take /
//     momentum_rotation / upgrade),
//   - the profit_take attempt rate under the current prohibition,
//   - the undeclared rate (swapMotive === null — asked, not answered) and the
//     legacy rate (field absent — predates Tier 1),
// plus the deterministic-reason split for context (stops/risk/gameplan swaps
// carry no motive by design).
//
// CONCURRENCY-NORMALIZED RATE (added Aug 2026, founder request): raw swap
// counts inflate as concurrency ramps, so the R9 trigger must key on a RATE,
// not a count. The denominator is BATTLE-DAYS — distinct (battle × trading-date)
// pairs on which a battle was active — NOT calendar days. A trading-date is a
// US market-open day (weekend + NYSE-holiday excluded via src/utils/
// marketHolidays.js, the codebase's own calendar). We report:
//   - total swaps / battle-day and MODEL swaps / battle-day, split by mode
//     (flat6 league [baggerbomb_tournament] vs casual [baggerbomb_agent]);
//   - the MODEL-swap rate for the trailing N trading days as a per-day table,
//     so drift is visible before a threshold is set against the level.
//
// Battle span: activatedAt→completedAt (both ISO on agentBattles docs); an
// ACTIVE battle is counted through today ET (capped at expiresAt if earlier).
// Trading-dates are resolved in America/New_York (the battle timezone). Caveat:
// a crypto swap (casual mode only; flat6 has no crypto) can land on a weekend/
// holiday — it counts in the numerator but its date is not a battle-day, so it
// is reported separately (offMarketSwaps) and excluded from the per-day table.
// Holiday data covers 2026 only; weekends are always excluded (a window outside
// 2026 warns).
//
// Run exactly like export-agent-battles (the void pre-check pattern):
//   node scripts/calibration/motive-baseline-summary.js --since 2026-08-19
// Credentials: FIREBASE_ADMIN_CREDENTIALS in .env.local or the environment.
// Flags: --since YYYY-MM-DD (swappedOutAt lower bound, default 2026-08-19 —
//        the Ask 3 merge date), --until YYYY-MM-DD, --status active|completed|all
//        (default all), --trailing N (drift table length, default 5),
//        --json out.json (optional file dump).
//
// The DB code is guarded behind the CLI entrypoint (bottom); the pure helpers
// and aggregate() import with no firebase-admin, so the co-located test
// exercises the battle-day math without a database.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
// The SAME env parser the void pre-check uses — not a re-implementation
// (it strips both quote styles; a copied narrower variant broke
// single-quoted FIREBASE_ADMIN_CREDENTIALS in review).
import { parseEnvFile } from './export-agent-battles.js';
// The engine's own mode discriminator (flat6 vs tiered/casual) — not a string
// literal; a legacy/absent gameMode resolves to tiered by construction, exactly
// as the scorers do.
import { resolveModeConfig } from '../../src/constants/agentGameModes.js';
// The codebase's authoritative NYSE calendar — the founder asked for
// trading-dates, not calendar days.
import { isMarketHoliday } from '../../src/utils/marketHolidays.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '../..');

const die = (msg) => { console.error(`ERROR: ${msg}`); process.exit(1); };

export function parseArgs(argv) {
  const flags = { since: '2026-08-19', until: null, status: 'all', trailing: 5, json: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--since') flags.since = argv[++i];
    else if (argv[i] === '--until') flags.until = argv[++i];
    else if (argv[i] === '--status') flags.status = argv[++i];
    else if (argv[i] === '--trailing') { const n = Number(argv[++i]); flags.trailing = Number.isInteger(n) && n >= 1 ? n : 5; }
    else if (argv[i] === '--json') flags.json = argv[++i];
  }
  return flags;
}

export const MOTIVES = ['defensive_cut', 'profit_take', 'momentum_rotation', 'upgrade'];
export const MODE_KEYS = ['flat6', 'casual'];
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');
const per = (n, d) => (d > 0 ? (n / d).toFixed(3) : '—'); // swaps per battle-day

// flat6 league (baggerbomb_tournament) vs casual (baggerbomb_agent / legacy).
export const modeKey = (gameMode) => (resolveModeConfig(gameMode).label === 'flat6' ? 'flat6' : 'casual');

// Robust timestamp → epoch ms: agentBattles writes ISO strings (createdAt /
// activatedAt / completedAt / trades[].swappedOutAt), but older docs may carry
// Firestore Timestamps — coerce both (the aggregate-real-battles toEpochMs
// pattern).
export function toMs(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v);
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v._seconds === 'number') return v._seconds * 1000 + (v._nanoseconds || 0) / 1e6;
  if (typeof v.seconds === 'number') return v.seconds * 1000 + (v.nanoseconds || 0) / 1e6;
  return NaN;
}

// ET calendar date 'YYYY-MM-DD' (en-CA renders ISO order) — TZ-independent, so
// the script gives the same trading-date on a UTC server as on an ET laptop.
const ET_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function etDate(v) {
  const ms = toMs(v);
  if (Number.isNaN(ms)) return null;
  return ET_FMT.format(new Date(ms));
}

// Weekend + NYSE-holiday check on a 'YYYY-MM-DD' string. Weekday is read off a
// noon-UTC anchor (weekday depends only on the calendar date, and UTC has no
// DST rollover), so this is TZ-independent.
export function isMarketOpenDateStr(ds) {
  if (!ds) return false;
  const dow = new Date(`${ds}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !isMarketHoliday(ds);
}

// Market-open ET dates in [startStr, endStr] inclusive.
export function* eachMarketDate(startStr, endStr) {
  if (!startStr || !endStr || startStr > endStr) return;
  let cur = new Date(`${startStr}T12:00:00Z`);
  const endMs = new Date(`${endStr}T12:00:00Z`).getTime();
  while (cur.getTime() <= endMs) {
    const ds = cur.toISOString().slice(0, 10);
    if (isMarketOpenDateStr(ds)) yield ds;
    cur = new Date(cur.getTime() + 24 * 3600 * 1000);
  }
}

const strMax = (a, b) => (a > b ? a : b);
const strMin = (a, b) => (a < b ? a : b);

// Pure core: battle docs (data objects) → the full aggregate, including the
// concurrency-normalized rate and the trailing drift window. `nowMs` fixes
// "today ET" so the denominator (active battles counted through today) is
// deterministic under test.
export function aggregate(docDatas, flags, nowMs = Date.now()) {
  const todayET = etDate(nowMs);
  const untilStr = flags.until || todayET;
  const sinceMs = Date.parse(`${flags.since}T00:00:00Z`);
  const untilMs = flags.until ? Date.parse(`${flags.until}T23:59:59Z`) : Infinity;

  const agg = {
    window: { since: flags.since, until: untilStr },
    battlesScanned: docDatas.length,
    swapsInWindow: 0,
    modelSwaps: { total: 0, byMotive: Object.fromEntries(MOTIVES.map(m => [m, 0])), undeclaredNull: 0, legacyAbsent: 0 },
    deterministicSwaps: { total: 0, byExitReason: {}, withNonNullMotive: 0 }, // the F3 pre-flip contamination check
    otherOrUnknownReason: { total: 0, byExitReason: {} },
    // Concurrency-normalized rate (R9 denominator).
    rate: {
      trailingDays: flags.trailing,
      windowTradingDays: 0,
      battleDays: { total: 0, byMode: { flat6: 0, casual: 0 } },
      swapsByMode: { flat6: { total: 0, model: 0 }, casual: { total: 0, model: 0 } },
      offMarketSwaps: 0,
      battlesActiveInWindow: 0,
      battlesUnresolvedSpan: 0,
      perDate: {}, // date -> { bd:{flat6,casual}, model:{flat6,casual}, swaps }
      trailing: null,
    },
  };

  const perDate = (d) => (agg.rate.perDate[d] ||= { bd: { flat6: 0, casual: 0 }, model: { flat6: 0, casual: 0 }, swaps: 0 });

  for (const data of docDatas) {
    const mode = modeKey(data.gameMode);

    // ---- Denominator: battle-days (distinct battle × trading-date) ----
    const startStr = etDate(data.activatedAt ?? data.createdAt);
    if (!startStr) {
      agg.rate.battlesUnresolvedSpan += 1;
    } else {
      // Completed → completedAt; active → today ET, capped at expiresAt if it
      // parses earlier (a battle can't be active past its own expiry).
      let endStr = data.completedAt ? etDate(data.completedAt) : todayET;
      if (!data.completedAt) {
        const expStr = etDate(data.expiresAt);
        if (expStr && expStr < endStr) endStr = expStr;
      }
      if (!endStr) endStr = todayET;
      const effStart = strMax(startStr, flags.since);
      const effEnd = strMin(endStr, untilStr);
      let daysThisBattle = 0;
      for (const d of eachMarketDate(effStart, effEnd)) {
        agg.rate.battleDays.total += 1;
        agg.rate.battleDays.byMode[mode] += 1;
        perDate(d).bd[mode] += 1;
        daysThisBattle += 1;
      }
      if (daysThisBattle > 0) agg.rate.battlesActiveInWindow += 1;
    }

    // ---- Numerator: swaps windowed on swappedOutAt ----
    const trades = Array.isArray(data.trades) ? data.trades : [];
    for (const t of trades) {
      const ts = Date.parse(t?.swappedOutAt);
      if (Number.isNaN(ts) || ts < sinceMs || ts > untilMs) continue;
      agg.swapsInWindow += 1;
      agg.rate.swapsByMode[mode].total += 1;
      const dstr = etDate(t.swappedOutAt);
      const onMarketDate = dstr && isMarketOpenDateStr(dstr);
      if (dstr && !onMarketDate) agg.rate.offMarketSwaps += 1;
      else if (dstr) perDate(dstr).swaps += 1;

      const reason = t?.exitReason;
      if (reason === 'haiku_decision') {
        agg.modelSwaps.total += 1;
        agg.rate.swapsByMode[mode].model += 1;
        if (onMarketDate) perDate(dstr).model[mode] += 1;
        if (!('swapMotive' in t)) agg.modelSwaps.legacyAbsent += 1;
        else if (t.swapMotive === null) agg.modelSwaps.undeclaredNull += 1;
        else if (MOTIVES.includes(t.swapMotive)) agg.modelSwaps.byMotive[t.swapMotive] += 1;
        else agg.modelSwaps.byMotive[String(t.swapMotive)] = (agg.modelSwaps.byMotive[String(t.swapMotive)] || 0) + 1;
      } else if (typeof reason === 'string') {
        agg.deterministicSwaps.total += 1;
        agg.deterministicSwaps.byExitReason[reason] = (agg.deterministicSwaps.byExitReason[reason] || 0) + 1;
        if ('swapMotive' in t && t.swapMotive != null) agg.deterministicSwaps.withNonNullMotive += 1;
      } else {
        agg.otherOrUnknownReason.total += 1;
        const key = reason == null ? '(missing)' : String(reason);
        agg.otherOrUnknownReason.byExitReason[key] = (agg.otherOrUnknownReason.byExitReason[key] || 0) + 1;
      }
    }
  }

  // ---- Trailing drift table (last N market dates in the window) ----
  const marketDatesInWindow = [...eachMarketDate(flags.since, untilStr)];
  agg.rate.windowTradingDays = marketDatesInWindow.length;
  const lastN = marketDatesInWindow.slice(-flags.trailing);
  const trailing = {
    dates: lastN,
    perDay: [],
    aggregate: { model: 0, battleDays: 0, byMode: { flat6: { model: 0, bd: 0 }, casual: { model: 0, bd: 0 } } },
  };
  for (const d of lastN) {
    const e = agg.rate.perDate[d] || { bd: { flat6: 0, casual: 0 }, model: { flat6: 0, casual: 0 }, swaps: 0 };
    const bdTot = e.bd.flat6 + e.bd.casual;
    const mdlTot = e.model.flat6 + e.model.casual;
    trailing.perDay.push({ date: d, battleDays: bdTot, modelSwaps: mdlTot });
    trailing.aggregate.model += mdlTot;
    trailing.aggregate.battleDays += bdTot;
    for (const k of MODE_KEYS) { trailing.aggregate.byMode[k].model += e.model[k]; trailing.aggregate.byMode[k].bd += e.bd[k]; }
  }
  agg.rate.trailing = trailing;

  return agg;
}

function report(agg) {
  const m = agg.modelSwaps;
  const declared = MOTIVES.reduce((a, k) => a + m.byMotive[k], 0);
  console.log('\n================ TIER-1 MOTIVE BASELINE (pre-treatment, R9) ================');
  console.log(`swaps in window: ${agg.swapsInWindow} (model ${m.total} | deterministic ${agg.deterministicSwaps.total} | other ${agg.otherOrUnknownReason.total})`);
  console.log('\nMODEL swaps (exitReason = haiku_decision):');
  for (const k of MOTIVES) console.log(`  ${k.padEnd(18)} ${String(m.byMotive[k]).padStart(5)}  (${pct(m.byMotive[k], m.total)})`);
  // Non-enum motive strings (validator escapes, pre-enum experiments): print
  // them too — an invisible bucket would make the rows silently not sum to
  // the model total, and this pull informs the R9 trigger decision.
  const nonEnum = Object.keys(m.byMotive).filter((k) => !MOTIVES.includes(k));
  for (const k of nonEnum) console.log(`  ${`OFF-ENUM ${k}`.padEnd(18)} ${String(m.byMotive[k]).padStart(5)}  (${pct(m.byMotive[k], m.total)})  ← not a Tier-1 enum value`);
  console.log(`  ${'undeclared (null)'.padEnd(18)} ${String(m.undeclaredNull).padStart(5)}  (${pct(m.undeclaredNull, m.total)})  ← asked, not answered`);
  console.log(`  ${'legacy (absent)'.padEnd(18)} ${String(m.legacyAbsent).padStart(5)}  (${pct(m.legacyAbsent, m.total)})  ← predates Tier 1`);
  console.log(`\n  profit_take attempt rate under the prohibition: ${pct(m.byMotive.profit_take, m.total)} of model swaps (${pct(m.byMotive.profit_take, declared || 1)} of declared)`);
  console.log('\nDETERMINISTIC swaps by reason (no motive by design):');
  for (const [k, v] of Object.entries(agg.deterministicSwaps.byExitReason).sort()) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(`  stale non-null motive on deterministic swaps (the F3 pre-flip contamination count): ${agg.deterministicSwaps.withNonNullMotive}`);
  if (agg.otherOrUnknownReason.total) {
    console.log('\nOTHER/unknown exitReason rows:');
    for (const [k, v] of Object.entries(agg.otherOrUnknownReason.byExitReason).sort()) console.log(`  ${k.padEnd(24)} ${v}`);
  }

  // ---- Concurrency-normalized rate ----
  const r = agg.rate;
  const bd = r.battleDays;
  const sm = r.swapsByMode;
  const totalSwaps = sm.flat6.total + sm.casual.total;
  console.log('\n============= CONCURRENCY-NORMALIZED RATE (R9 denominator) =============');
  console.log(`window trading days: ${r.windowTradingDays}   battle-days: ${bd.total} (flat6 ${bd.byMode.flat6} | casual ${bd.byMode.casual})`);
  console.log(`battles active in window: ${r.battlesActiveInWindow}   unresolved span (no activatedAt/createdAt): ${r.battlesUnresolvedSpan}`);
  console.log(`off-market-dated swaps (crypto weekend/holiday; casual-only, excluded from per-day rates): ${r.offMarketSwaps}`);
  console.log('\nSWAPS PER BATTLE-DAY (stable under concurrency ramp — key the R9 trigger here, not on counts):');
  console.log(`  all swaps:   ${per(totalSwaps, bd.total)}  (flat6 ${per(sm.flat6.total, bd.byMode.flat6)} | casual ${per(sm.casual.total, bd.byMode.casual)})`);
  console.log(`  MODEL swaps: ${per(m.total, bd.total)}  (flat6 ${per(sm.flat6.model, bd.byMode.flat6)} | casual ${per(sm.casual.model, bd.byMode.casual)})`);

  // ---- Trailing drift table ----
  const t = r.trailing;
  console.log(`\nTRAILING ${t.dates.length} TRADING DAYS — MODEL-swap rate drift check:`);
  console.log(`  ${'date'.padEnd(12)} ${'battle-days'.padStart(11)} ${'model swaps'.padStart(11)} ${'model/bd'.padStart(9)}`);
  for (const row of t.perDay) {
    console.log(`  ${row.date.padEnd(12)} ${String(row.battleDays).padStart(11)} ${String(row.modelSwaps).padStart(11)} ${per(row.modelSwaps, row.battleDays).padStart(9)}`);
  }
  const ta = t.aggregate;
  console.log(`  trailing aggregate: model/bd = ${per(ta.model, ta.battleDays)}  (flat6 ${per(ta.byMode.flat6.model, ta.byMode.flat6.bd)} | casual ${per(ta.byMode.casual.model, ta.byMode.casual.bd)})`);
  console.log(`  vs full-window MODEL/bd = ${per(m.total, bd.total)} — compare for drift before setting a threshold.`);
}

async function main() {
  const flags = parseArgs(process.argv);
  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const creds = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local or the environment');
  let serviceAccount;
  try { serviceAccount = JSON.parse(creds); } catch (err) { die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`); }

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  console.log(`firebase-admin initialized for project: ${serviceAccount.project_id} (READ ONLY)`);

  // Single-field filter at most (no composite index); the date window is
  // applied client-side on trades[].swappedOutAt — mirrors export-agent-battles.
  let q = db.collection('agentBattles');
  if (flags.status && flags.status !== 'all') q = q.where('status', '==', flags.status);
  const snap = await q.get();

  const nowMs = Date.now();
  const untilStr = flags.until || etDate(nowMs);
  console.log(`battles scanned: ${snap.size}; window: ${flags.since} → ${untilStr}`);
  if (flags.since.slice(0, 4) !== '2026' || untilStr.slice(0, 4) !== '2026') {
    console.warn('WARNING: window extends outside 2026 — holiday data covers 2026 only (weekends still excluded); trading-date counts outside 2026 may treat holidays as open.');
  }

  const agg = aggregate(snap.docs.map((d) => d.data()), flags, nowMs);
  report(agg);

  if (flags.json) {
    writeFileSync(flags.json, JSON.stringify(agg, null, 2) + '\n');
    console.log(`\nJSON written: ${flags.json}`);
  }
}

// Runner only — guarded so the co-located test imports the pure helpers and
// aggregate() without a DB (the export-agent-battles convention).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => die(err.stack || String(err)));
}
