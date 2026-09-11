// scripts/phase0-eval-timeouts-readonly.js
//
// Phase 0 — eval-path timeouts and the `vwapDev` stamp: the READ-ONLY census
// the discovery report could not run (no credentials in the session).
// Report: docs/audits/20260911_PHASE0_EVAL_TIMEOUTS_VWAPDEV.md (§2 Q1, §4 Q3).
//
// READ-ONLY BY CONSTRUCTION. Firestore: one `doc().get()` (--battle) or one
// range query `.where().where().get()` (--from/--to). GCS (--gcs only):
// `bucket.getFiles()` + `file.download()`. There is no `set`, `update`,
// `delete`, `runTransaction`, `arrayUnion`, `increment` or `save` call in this
// file — grep it before running it.
//
// CREDENTIALS — the existing loaders only, never a fourth:
//   Firestore  scripts/loadLocalEnv.js (.env.local → process.env, on import)
//              + api/_utils/firebaseAdmin.js getFirebaseAdmin()
//   GCS        api/scripts/gemma-latency-report.js getBucket(): the JSON in
//              GCS_CREDENTIALS, the SAME variable shadowLogger.js writes with
//              (api/_utils/shadowLogger.js:25). Optional; only with --gcs.
//   (The brief named `api/_utils/gcsCredentials.js` / GCS_CREDENTIALS_FILE —
//   no such loader exists at HEAD fcace00; see the report's preamble.)
//
// USAGE (repo root, after `npm install`; .env.local carrying FIREBASE_* and,
// for --gcs, GCS_CREDENTIALS):
//   node scripts/phase0-eval-timeouts-readonly.js --from 2026-09-01 --to 2026-09-10
//   node scripts/phase0-eval-timeouts-readonly.js --battle <agentBattleId>
//   … add --gcs   to also tally shadow/evaluations/{day}/*.jsonl for the days
//   … add --json  to print the raw tallies as JSON after the tables
//
// NOT RUN AGAINST LIVE DATA in the discovery session (BUILD_RULES §3; the
// session's §6 rule: STOP rather than improvise access). It was syntax-checked
// (`node --check`) and its pure tallies were exercised on fixture entries only.
// The credential-bearing modules are imported DYNAMICALLY inside main() so the
// pure helpers can be imported in an environment without node_modules.
//
// WHAT IT COUNTS, per battle (every field is read, never derived twice):
//   evaluations[]                   agent-evaluate.js:2801 (cap 150) — the checks
//   evaluations[].haikuError        :2693 { failureClass, message, timestamp, evalId } | null
//   evaluations[].evidence          :2712-2750 — the post-flip marker (tickStamps.js:333)
//   evaluations[].evidence[sym].vwapDev   tickStamps.js:194
//   cronState.cronErrors[]          :2846-2853 (cap 20)
//   statusFeed[] action 'eval_degraded'   :2762-2772 (cap 100 for agent battles, :681)
//   cronState.totalHaikuCalls / totalTokens / consecutiveEvalFailures   :2822-2840
//   cronState.intradayMomentum      agentCronState.js:39 — momentumData.vwap at the LAST tick
//   cronState.vwapTicks             agentCronState.js:38
//   shadow/evaluations/{day}/*.jsonl   shadowLogger.js:52 — failureClass, tokenUsage.input
//
// The 15-minute slot offset printed per timeout is `timestamp − floor(timestamp
// to :00/:15/:30/:45)`. It is the ONLY per-check wall-time proxy the record
// affords: `evaluation.timestamp` is captured AFTER the Haiku call returns or
// fails (agent-evaluate.js:2085), so for the first battle of a tick the offset
// bounds (cron start jitter + pre-call fetches + prompt build + the call).

import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SLOT_MS = 15 * 60 * 1000;
export const AGENT_BATTLES = 'agentBattles';
export const SHADOW_STREAM = 'evaluations';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

// ==================== PURE ====================

/** Epoch ms from an ISO string, a Date, a number, a Firestore Timestamp-like ({toMillis}) or a {seconds}; else null. */
export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v.toMillis === 'function') return toMs(v.toMillis());
  if (v instanceof Date) return toMs(v.getTime());
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return null;
}

/** Seconds past the enclosing 15-minute cron slot, or null. */
export function slotOffsetSec(ms) {
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - Math.floor(ms / SLOT_MS) * SLOT_MS) / 1000);
}

/** The record's failure class, or 'success' when haikuError is null/absent. */
export function classOf(entry) {
  const cls = entry?.haikuError?.failureClass;
  return typeof cls === 'string' && cls ? cls : 'success';
}

export function parseArgs(argv) {
  const out = { from: null, to: null, battle: null, gcs: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--gcs') out.gcs = true;
    else if (a === '--json') out.json = true;
    else if (a === '--from') out.from = argv[++i] ?? null;
    else if (a === '--to') out.to = argv[++i] ?? null;
    else if (a === '--battle') out.battle = argv[++i] ?? null;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!out.battle) {
    if (!DATE_KEY.test(out.from || '') || !DATE_KEY.test(out.to || '')) {
      throw new Error('need --battle <id>, or --from YYYY-MM-DD --to YYYY-MM-DD');
    }
    if (out.from > out.to) throw new Error('--from must not be after --to');
  }
  return out;
}

/**
 * One battle's census from its doc data. Reads only; every number is a count
 * of what the doc carries.
 */
export function tallyBattle(id, data) {
  const evals = Array.isArray(data?.evaluations) ? data.evaluations : [];
  const byClass = {};
  let stamped = 0;
  let firstStampedAt = null;
  let stampedWithPositions = 0;
  let vwapAllNullChecks = 0;
  let vwapAnyValueChecks = 0;
  const timeouts = [];

  for (const e of evals) {
    const cls = classOf(e);
    byClass[cls] = (byClass[cls] || 0) + 1;
    const hasEvidence = !!e && typeof e.evidence === 'object' && e.evidence !== null;
    if (hasEvidence) {
      stamped++;
      if (firstStampedAt == null) firstStampedAt = e.timestamp ?? null;
      const rows = Object.values(e.evidence);
      if (rows.length > 0) {
        stampedWithPositions++;
        if (rows.every((r) => r == null || r.vwapDev == null)) vwapAllNullChecks++;
        else vwapAnyValueChecks++;
      }
    }
    if (cls === 'timeout') {
      timeouts.push({
        evalId: e?.evalId ?? null,
        timestamp: e?.timestamp ?? null,
        slotOffsetSec: slotOffsetSec(toMs(e?.timestamp)),
        message: e?.haikuError?.message ?? null,
        stamped: hasEvidence,
      });
    }
  }

  const cs = data?.cronState && typeof data.cronState === 'object' ? data.cronState : {};
  const cronErrorsByClass = {};
  for (const ce of Array.isArray(cs.cronErrors) ? cs.cronErrors : []) {
    const k = typeof ce?.failureClass === 'string' && ce.failureClass ? ce.failureClass : 'unclassified';
    cronErrorsByClass[k] = (cronErrorsByClass[k] || 0) + 1;
  }
  const feed = Array.isArray(data?.statusFeed) ? data.statusFeed : [];
  const evalDegraded = feed.filter((f) => f?.action === 'eval_degraded').length;

  const im = cs.intradayMomentum && typeof cs.intradayMomentum === 'object' ? cs.intradayMomentum : null;
  const intradayMomentum = im
    ? Object.fromEntries(Object.entries(im).map(([sym, v]) => [sym, {
      sessionDate: v?.sessionDate ?? null,
      vwapDeviation: v?.vwapDeviation ?? null,
    }]))
    : null;

  const timeoutCount = byClass.timeout || 0;
  const otherTransport = Object.entries(byClass)
    .filter(([k]) => !['success', 'timeout', 'budget_skipped', 'truncated_response'].includes(k))
    .reduce((n, [, c]) => n + c, 0);
  const totalHaikuCalls = Number.isFinite(cs.totalHaikuCalls) ? cs.totalHaikuCalls : null;
  const tokensIn = Number.isFinite(cs.totalTokens?.input) ? cs.totalTokens.input : null;
  // Attempts that RECEIVED a response (tokens recorded): attempts minus the
  // classes where no response arrived. truncated_response did receive one.
  const respondedCalls = totalHaikuCalls == null ? null : Math.max(0, totalHaikuCalls - timeoutCount - otherTransport);
  const avgInputTokens = respondedCalls && tokensIn != null ? Math.round(tokensIn / respondedCalls) : null;

  return {
    id,
    status: data?.status ?? null,
    gameMode: data?.gameMode ?? null,
    activatedAt: data?.activatedAt ?? null,
    completedAt: data?.completedAt ?? null,
    checks: evals.length,
    byClass,
    stamped,
    firstStampedAt,
    stampedWithPositions,
    vwapAllNullChecks,
    vwapAnyValueChecks,
    timeouts,
    cron: {
      totalHaikuCalls,
      totalTokensInput: tokensIn,
      totalTokensOutput: Number.isFinite(cs.totalTokens?.output) ? cs.totalTokens.output : null,
      respondedCalls,
      avgInputTokens,
      consecutiveEvalFailures: cs.consecutiveEvalFailures ?? null,
      lastEvalStartedAt: cs.lastEvalStartedAt ?? null,
      lastEvaluatedAt: cs.lastEvaluatedAt ?? null,
      intradayMomentum,
      vwapTicks: cs.vwapTicks && typeof cs.vwapTicks === 'object' ? cs.vwapTicks : null,
    },
    cronErrorsByClass,
    evalDegraded,
  };
}

const n = (v) => (v == null ? '—' : String(v));
const day = (iso) => (typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : '—');

/** The Q1 row: one line per battle. */
export function formatBattleRow(t) {
  const other = Object.entries(t.byClass)
    .filter(([k]) => !['success', 'timeout', 'budget_skipped', 'truncated_response'].includes(k))
    .map(([k, c]) => `${k}:${c}`)
    .join(' ') || '0';
  const imKeys = t.cron.intradayMomentum ? Object.keys(t.cron.intradayMomentum).length : '—';
  return `| ${t.id} | ${day(t.activatedAt)} | ${n(t.status)} | ${t.checks} | ${t.byClass.timeout || 0} | ${t.byClass.budget_skipped || 0} | ${t.byClass.truncated_response || 0} | ${other} | ${t.byClass.success || 0} | ${t.stamped}/${t.checks} | ${day(t.firstStampedAt)} | ${t.vwapAllNullChecks}/${t.stampedWithPositions} | ${imKeys} | ${n(t.cron.totalHaikuCalls)} | ${n(t.cron.avgInputTokens)} | ${n(t.cron.consecutiveEvalFailures)} | ${t.evalDegraded} |`;
}

export const BATTLE_TABLE_HEADER = [
  '| battle | activated (UTC) | status | checks | timeout | budget_skipped | truncated | other | success | stamped/checks | first stamped | vwapDev all-null / stamped-with-positions | intradayMomentum keys (last tick) | totalHaikuCalls | avg input tokens per responded call | consecutiveEvalFailures | eval_degraded beats |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
].join('\n');

/** The per-timeout listing — the `message` column is the SDK-vs-abort discriminator (report §3.3). */
export function formatTimeoutRows(tallies) {
  const rows = [];
  for (const t of tallies) {
    for (const x of t.timeouts) {
      rows.push(`| ${t.id} | ${n(x.evalId)} | ${n(x.timestamp)} | ${n(x.slotOffsetSec)} | ${x.stamped ? 'yes' : 'no'} | ${x.message == null ? '—' : String(x.message).replace(/\|/g, '\\|')} |`);
    }
  }
  return rows;
}

export const TIMEOUT_TABLE_HEADER = [
  '| battle | evalId | timestamp | seconds past the :15 slot | stamped | haikuError.message |',
  '|---|---|---|---|---|---|',
].join('\n');

/** The Q3 listing — what the LAST tick persisted of momentumData.vwap. */
export function formatIntradayRows(t) {
  const im = t.cron.intradayMomentum;
  if (im == null) return [`| ${t.id} | (cronState.intradayMomentum absent) | | |`];
  const entries = Object.entries(im);
  if (entries.length === 0) return [`| ${t.id} | {} — no symbol published at the last tick | | |`];
  return entries.map(([sym, v]) => `| ${t.id} | ${sym} | ${n(v.sessionDate)} | ${n(v.vwapDeviation)} |`);
}

export const INTRADAY_TABLE_HEADER = [
  '| battle | symbol | sessionDate | vwapDeviation |',
  '|---|---|---|---|',
].join('\n');

export function percentile(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const idx = Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1));
  return xs[idx];
}

/** Shadow-stream tally: per battleId, per UTC day. */
export function tallyShadow(records, dateKey, wanted, acc = {}) {
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    const battleId = typeof r.battleId === 'string' ? r.battleId : null;
    if (!battleId) continue;
    if (wanted && !wanted.has(battleId)) continue;
    const key = `${battleId} ${dateKey}`;
    const slot = acc[key] || (acc[key] = { battleId, dateKey, records: 0, byClass: {}, inputTokens: [] });
    slot.records++;
    const cls = typeof r.failureClass === 'string' && r.failureClass ? r.failureClass : 'success';
    slot.byClass[cls] = (slot.byClass[cls] || 0) + 1;
    const tin = r.tokenUsage?.input;
    if (Number.isFinite(tin)) slot.inputTokens.push(tin);
  }
  return acc;
}

export function formatShadowRows(acc) {
  return Object.values(acc)
    .sort((a, b) => (a.dateKey + a.battleId).localeCompare(b.dateKey + b.battleId))
    .map((s) => {
      const cls = Object.entries(s.byClass).map(([k, c]) => `${k}:${c}`).join(' ');
      return `| ${s.battleId} | ${s.dateKey} | ${s.records} | ${cls} | ${n(percentile(s.inputTokens, 50))} | ${n(percentile(s.inputTokens, 90))} | ${n(percentile(s.inputTokens, 100))} |`;
    });
}

export const SHADOW_TABLE_HEADER = [
  '| battle | UTC day | shadow records | by failureClass | input tokens p50 | p90 | max |',
  '|---|---|---|---|---|---|---|',
].join('\n');

// ==================== IMPURE — the reads ====================

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  // Env + credentials through the EXISTING loaders (dynamic so the pure half
  // above imports without node_modules). loadLocalEnv.js loads .env.local on
  // import; requireFirebaseCreds exits 4 with an actionable line if anything
  // is missing — nothing is read before that check passes.
  const { requireFirebaseCreds } = await import('./loadLocalEnv.js');
  requireFirebaseCreds();
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const db = getFirebaseAdmin();

  const docs = [];
  if (args.battle) {
    const snap = await db.collection(AGENT_BATTLES).doc(args.battle).get();
    if (!snap.exists) {
      console.error(`${AGENT_BATTLES}/${args.battle}: not found`);
      process.exitCode = 2;
      return;
    }
    docs.push({ id: snap.id, data: snap.data() });
  } else {
    // activatedAt is an ISO string (agentBattleService.js:69, :140), so a
    // string range matches every doc createAgentBattle wrote. A doc whose
    // activatedAt is a Firestore Timestamp (a different type) would NOT match;
    // if the count looks low, read the suspects with --battle.
    const snap = await db.collection(AGENT_BATTLES)
      .where('activatedAt', '>=', `${args.from}T00:00:00.000Z`)
      .where('activatedAt', '<=', `${args.to}T23:59:59.999Z`)
      .get();
    for (const d of snap.docs) docs.push({ id: d.id, data: d.data() });
  }

  const tallies = docs
    .map(({ id, data }) => tallyBattle(id, data))
    .sort((a, b) => String(a.activatedAt).localeCompare(String(b.activatedAt)));

  console.log(`\n## Q1 — evaluation records per battle (source: ${AGENT_BATTLES}/{id} docs; ${tallies.length} battle(s))\n`);
  console.log(BATTLE_TABLE_HEADER);
  for (const t of tallies) console.log(formatBattleRow(t));

  console.log('\n## Q1 — every timeout record\n');
  console.log(TIMEOUT_TABLE_HEADER);
  const trows = formatTimeoutRows(tallies);
  if (trows.length === 0) console.log('| (none) | | | | | |');
  for (const r of trows) console.log(r);

  console.log('\n## Q3 — cronState.intradayMomentum at the last tick (momentumData.vwap as persisted)\n');
  console.log(INTRADAY_TABLE_HEADER);
  for (const t of tallies) for (const r of formatIntradayRows(t)) console.log(r);

  if (args.gcs) {
    const { getBucket, listDayFiles, downloadJsonl, dateKeysInRange } = await import('../api/scripts/gemma-latency-report.js');
    const bucket = getBucket();
    if (!bucket) {
      console.error('\n--gcs: GCS_CREDENTIALS not set — the shadow stream was not read (nothing else is affected).');
    } else {
      const from = args.battle ? day(tallies[0]?.activatedAt) : args.from;
      const to = args.battle ? day(tallies[0]?.completedAt ?? tallies[0]?.cron?.lastEvaluatedAt ?? tallies[0]?.activatedAt) : args.to;
      const wanted = new Set(tallies.map((t) => t.id));
      const acc = {};
      let filesRead = 0;
      let filesFailed = 0;
      for (const dateKey of dateKeysInRange(from, to)) {
        let files = [];
        try {
          files = await listDayFiles(bucket, dateKey, SHADOW_STREAM);
        } catch (err) {
          console.error(`shadow/${SHADOW_STREAM}/${dateKey}: list failed — ${err.message}`);
          continue;
        }
        for (const file of files) {
          try {
            tallyShadow(await downloadJsonl(file), dateKey, wanted, acc);
            filesRead++;
          } catch (err) {
            filesFailed++;
            console.error(`${file.name}: download failed — ${err.message}`);
          }
        }
      }
      console.log(`\n## Q1/Q2 — GCS shadow stream shadow/${SHADOW_STREAM}/{day}/*.jsonl (${filesRead} file(s) read, ${filesFailed} failed; filtered to the battles above)\n`);
      console.log(SHADOW_TABLE_HEADER);
      const srows = formatShadowRows(acc);
      if (srows.length === 0) console.log('| (no records for these battles in the range) | | | | | | |');
      for (const r of srows) console.log(r);
    }
  }

  if (args.json) {
    console.log('\n## raw\n');
    console.log(JSON.stringify(tallies, null, 2));
  }
}

// Only when RUN — importing this module (a self-test) must never start a read.
// realpath BOTH sides, the gemma-latency-report.js precedent (:486-498).
const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
})();
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[phase0-eval-timeouts-readonly] fatal:', err?.message || err);
    process.exitCode = 1;
  });
}
