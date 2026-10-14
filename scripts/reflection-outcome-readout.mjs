// scripts/reflection-outcome-readout.mjs
//
// Reflection outage fix (package P-OUT-1, founder ruling O4, 10 Oct 2026) —
// the READ-ONLY readout of reflection outcomes. Since the fix, the
// pending-reflections cron writes, on every completed battle it reflects, the
// LATEST attempt's outcome (`reflectionOutcome`: outcome ok | failed,
// failureClass from a fixed vocabulary, errorName, elapsedMs, stopReason,
// usage, model, attempt, at), the attempt count (`reflectionAttempts`) and,
// after the third failure, `reflectionNoLesson: true`. Since part 2 (P-OUT-2,
// ruling O7) the record also says whether the account itself refused the call
// (`accountWide`); such a refusal does not use up a try, so "still retrying"
// carries a sub-count, "waiting on the account". This prints counts of
// those outcomes by class and by day for a date range, so the next outage is
// a five-minute read instead of a reproduction. Build report:
// docs/audits/20261010_BUILD_REFLECTION_OUTAGE_FIX.md (§ "How to confirm it").
//
// WHAT IT COUNTS: one row per battle — its latest attempt. Earlier attempts of
// the same battle are mirrored in the reflection shadow line (GCS), not here.
// A battle is in the range when its latest attempt's `at` falls on a UTC day
// in [--from, --to]. Battles reflected before the fix carry no record and are
// not counted.
//
// READ-ONLY BY CONSTRUCTION (the growth replay's §7 discipline): Firestore is
// used for `.collection() / .where() / .select() / .get()` only; the test
// (scripts/reflection-outcome-readout.test.js) walks this file's syntax tree
// and pins every member call to a reviewed read-only allowlist, and runs the
// §7 write-call grep over it. It prints COUNTS ONLY — no battle, agent or
// owner id, and no player or agent text (the record holds none). Credentials
// (scripts/loadLocalEnv.js + getFirebaseAdmin()) load only inside main();
// importing the module touches nothing.
//
// USAGE (repo root of the primary checkout, where .env.local lives):
//   node scripts/reflection-outcome-readout.mjs [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--json <data.json>]
//     --from defaults to 7 days before --to; --to defaults to today (UTC).

import { writeFileSync } from 'node:fs';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const isDay = (s) => typeof s === 'string' && DAY_RE.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`));
const dayOf = (iso) => (typeof iso === 'string' && Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString().slice(0, 10) : null);
const bump = (obj, key, by = 1) => { obj[key] = (obj[key] || 0) + by; };
const sortedKeys = (obj) => Object.keys(obj).sort();

/**
 * The readout from battle rows (`{ reflectionOutcome, reflectionNoLesson,
 * pendingReflection }` — ids are never read). Pure.
 */
export function computeReflectionOutcomeReadout(rows, { fromDay, toDay }) {
  const out = {
    fromDay, toDay,
    battles: 0, ok: 0, failed: 0,
    failedByClass: {},
    byDay: {},
    latestAttempt: {},
    noLesson: 0,
    retrying: 0,
    waitingOnAccount: 0, // of `retrying`: the latest attempt was an account-wide refusal (P-OUT-2, O7)
    endedOtherwise: 0,
    okElapsedMs: { max: null, total: 0, n: 0 },
    maxOutputTokens: null,
  };
  for (const row of rows) {
    const rec = row?.reflectionOutcome;
    if (!rec || typeof rec !== 'object') continue;
    const day = dayOf(rec.at);
    if (!day || day < fromDay || day > toDay) continue;
    out.battles += 1;
    const d = out.byDay[day] || (out.byDay[day] = { ok: 0, failed: 0, classes: {} });
    if (rec.outcome === 'ok') {
      out.ok += 1; d.ok += 1;
      if (Number.isFinite(rec.elapsedMs)) {
        out.okElapsedMs.max = Math.max(out.okElapsedMs.max ?? 0, rec.elapsedMs);
        out.okElapsedMs.total += rec.elapsedMs; out.okElapsedMs.n += 1;
      }
    } else {
      const cls = typeof rec.failureClass === 'string' && rec.failureClass ? rec.failureClass : 'unknown';
      out.failed += 1; d.failed += 1;
      bump(out.failedByClass, cls); bump(d.classes, cls);
      if (row.reflectionNoLesson === true) out.noLesson += 1;
      else if (row.pendingReflection === true) {
        out.retrying += 1;
        if (rec.accountWide === true) out.waitingOnAccount += 1;
      } else out.endedOtherwise += 1; // e.g. the agent was deleted after a failed attempt
    }
    bump(out.latestAttempt, Number.isInteger(rec.attempt) ? String(rec.attempt) : '?');
    const outTok = rec.usage?.output_tokens;
    if (Number.isFinite(outTok)) out.maxOutputTokens = Math.max(out.maxOutputTokens ?? 0, outTok);
  }
  return out;
}

/** Plain-text tables, counts only. */
export function renderReflectionOutcomeReadout(r, { readAt }) {
  const L = [];
  const p = (s = '') => L.push(s);
  p(`Reflection outcomes, latest attempt per battle — ${r.fromDay} to ${r.toDay} (UTC days), read ${readAt}`);
  p('');
  p(`Battles: ${r.battles}   ok: ${r.ok}   failed: ${r.failed}   (of the failed: finished without a lesson ${r.noLesson}, still retrying ${r.retrying} [of which waiting on the account ${r.waitingOnAccount}], ended otherwise ${r.endedOtherwise})`);
  if (r.okElapsedMs.n > 0) p(`Successful calls: slowest ${(r.okElapsedMs.max / 1000).toFixed(1)} s, average ${(r.okElapsedMs.total / r.okElapsedMs.n / 1000).toFixed(1)} s`);
  if (r.maxOutputTokens != null) p(`Largest answer: ${r.maxOutputTokens} output tokens`);
  p('');
  p('Failed, by class:');
  const classes = sortedKeys(r.failedByClass);
  if (classes.length === 0) p('  (none)');
  for (const c of classes) p(`  ${c.padEnd(14)} ${r.failedByClass[c]}`);
  p('');
  p('Latest attempt number:');
  const attempts = sortedKeys(r.latestAttempt);
  if (attempts.length === 0) p('  (none)');
  for (const a of attempts) p(`  attempt ${a}: ${r.latestAttempt[a]}`);
  p('');
  p('By day:');
  const days = sortedKeys(r.byDay);
  if (days.length === 0) p('  (no outcome records in this range)');
  for (const day of days) {
    const d = r.byDay[day];
    const cls = sortedKeys(d.classes).map((c) => `${c} ${d.classes[c]}`).join(', ');
    p(`  ${day}  ok ${d.ok}  failed ${d.failed}${cls ? `  (${cls})` : ''}`);
  }
  return L.join('\n');
}

export function parseArgs(argv, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const toDay = argv.includes('--to') ? argOf('--to') : today;
  if (!isDay(toDay)) throw new Error(`--to needs a YYYY-MM-DD day, got "${toDay}"`);
  const fromDay = argv.includes('--from') ? argOf('--from') : new Date(Date.parse(`${toDay}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
  if (!isDay(fromDay)) throw new Error(`--from needs a YYYY-MM-DD day, got "${fromDay}"`);
  if (fromDay > toDay) throw new Error(`--from (${fromDay}) is after --to (${toDay})`);
  return { fromDay, toDay, jsonPath: argOf('--json') };
}

/** The Firestore reader main() uses — reads only, and never an id. */
export function firestoreReader(db) {
  return {
    async readOutcomeRows() {
      const snap = await db.collection('agentBattles')
        .where('status', '==', 'completed')
        .select('reflectionOutcome', 'reflectionNoLesson', 'pendingReflection')
        .get();
      return snap.docs.map((d) => d.data());
    },
  };
}

export async function runReflectionOutcomeReadout(reader, range) {
  return computeReflectionOutcomeReadout(await reader.readOutcomeRows(), range);
}

async function main() {
  const { fromDay, toDay, jsonPath } = parseArgs(process.argv.slice(2));
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const readAt = new Date().toISOString();
  const result = await runReflectionOutcomeReadout(firestoreReader(getFirebaseAdmin()), { fromDay, toDay });
  console.log(renderReflectionOutcomeReadout(result, { readAt }));
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ readAt, ...result }, null, 2));
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(err); process.exit(1); });
