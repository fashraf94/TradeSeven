// scripts/cockpit-release-read.mjs
//
// THE STAGE READ for the cockpit's release switch (build prompt
// BUILD_PROMPT_COCKPIT_RELEASE_SWITCH; docs/audits/20261110_COCKPIT_RELEASE_READINESS.md
// §C3 "Stages and trips", §10). Run it after each stage of the share. Per ET session in
// a date range it prints the report's §C3 trips:
//
//   evaluator   runs with budgetSkipped or deferred > 0, and runs with wallMs > 200 s
//               (agentEvalRuns); the largest run's battles, model calls and wall time
//   checks      `on` timeouts, 400s and invalid_tool_result against the `off` baseline
//               of the same session (the tick records), flagged when `on` is above it
//   answers     commands (directive answers), acknowledgments, heard, acted and
//               no_matching_trade — from the call and callEvent records of `on` battles
//   cohort      the count of release-cohort battles: agent mode, outside the allowlist,
//               by OWNER ORDINAL (owner1, owner2 …), never by id
//   sweep lag   calls the sweep settled: stamp − deadline, median / p90 / max; and the
//               queue rows overdue at the read
//   cost        the `on` checks' model cost at Haiku 4.5 list price, and the extra the
//               declarations tool is estimated to add (the report's structural figure)
//
// IT NEVER NEEDS A UID. Which checks are `on` is read from their own records — a tick's
// `schemaVersion` (2 = calls active, 1 = off) and the date the global mode went 'on' —
// not from who the owner is. Owners appear only as ordinals assigned in memory. The
// allowlist (COCKPIT_ALLOWLIST_UIDS) is OPTIONAL: when it is in the shell, the cohort
// count excludes allowlisted owners; when it is not, the cohort count falls back to the
// control document's own bucket test, and says which basis it used. No uid, owner id,
// agent id or battle id is printed.
//
// READ-ONLY BY CONSTRUCTION. Firestore Admin SDK `.get()` only — no set, update,
// delete, create, runTransaction, batch or bulkWriter (scripts/cockpit-release-read.test.js
// greps it). The only file written is --out (the tables).
//
// USAGE (repo root):
//   node scripts/cockpit-release-read.mjs --from 2026-11-12 --to 2026-11-14 [--out <tables.md>]
//   --from / --to: ET dates, inclusive (default: today's ET date). Weekends are skipped.
//
// The tallies are pure exported functions (scripts/cockpit-release-read.test.js);
// Firestore, the env loader and the release module are imported lazily inside main().

export const WALL_TRIP_MS = 200_000;
/** The global flip to CALL_RECORDS_MODE 'on' (PR #931 merge, 2026-10-05T22:35:34Z): a schemaVersion-2 tick before it is `shadow`. */
export const ON_ERA_START_MS = Date.parse('2026-10-05T22:35:34Z');
/** Haiku 4.5 list price per million tokens (`claude-haiku-4-5-20251001`, the evaluator's model; claude-api skill table cached 2026-11-03). */
export const HAIKU_PRICE_PER_MTOK = Object.freeze({ input: 1.0, output: 5.0 });
/** The declarations tool's estimated extra per `on` check — the report's schema-size estimate (§A1: +1,744 input and +200 output tokens). */
export const ON_EXTRA_USD_PER_CHECK = 0.00274;
export const SESSION_TZ = 'America/New_York';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

/** Firestore Timestamp, millis, ISO string → millis, or null. */
export function toMs(v) {
  if (finite(v)) return v;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (v && finite(v._seconds)) return v._seconds * 1000 + Math.round((v._nanoseconds ?? 0) / 1e6);
  return null;
}

/** The ET calendar date of an instant ("2026-11-12"), or null. */
export function etDay(ms) {
  if (!finite(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: SESSION_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The weekdays from `from` to `to` inclusive (ET dates, YYYY-MM-DD). */
export function sessionDays(from, to) {
  const days = [];
  const end = Date.parse(`${to}T12:00:00Z`);
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= end; t += 86_400_000) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function percentile(values, p) {
  const a = values.filter(finite).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p;
  const lo = Math.floor(i); const hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}

/**
 * A model-call check's arm from ITS OWN record: not a dispatched model call → null;
 * schemaVersion 1 → 'off'; 2 → 'on' from the global flip, 'shadow' before it.
 */
export function classifyTick(tick) {
  if (!tick || tick.model?.dispatched !== true) return null;
  const v = tick.schemaVersion ?? tick.v;
  if (v === 1) return 'off';
  if (v === 2) { const ms = toMs(tick.capturedAt ?? tick.at); return finite(ms) && ms >= ON_ERA_START_MS ? 'on' : 'shadow'; }
  return null;
}

/** Owner ordinals ("owner1" …), assigned in memory in sorted order; the ids themselves are never kept in any result. */
export function ordinalsOf(ownerIds) {
  const map = new Map();
  [...new Set((ownerIds || []).filter((o) => typeof o === 'string' && o.length > 0))].sort().forEach((o, i) => map.set(o, `owner${i + 1}`));
  return map;
}

// ---------------------------------------------------------------- the tallies

/** Evaluator runs per session: the trips from agentEvalRuns. */
export function evaluatorRead(runs, days) {
  const out = {};
  for (const d of days) out[d] = { day: d, runs: 0, budgetSkippedRuns: 0, deferredRuns: 0, overWallRuns: 0, maxWallMs: null, maxBattles: 0, maxModelCalls: 0, tripped: false };
  for (const r of Array.isArray(runs) ? runs : []) {
    const d = etDay(toMs(r?.startedAt));
    const row = out[d];
    if (!row) continue;
    row.runs += 1;
    if ((r.budgetSkipped || 0) > 0) row.budgetSkippedRuns += 1;
    if ((r.deferred || 0) > 0) row.deferredRuns += 1;
    if (finite(r.wallMs)) { if (r.wallMs > WALL_TRIP_MS) row.overWallRuns += 1; row.maxWallMs = row.maxWallMs === null ? r.wallMs : Math.max(row.maxWallMs, r.wallMs); }
    row.maxBattles = Math.max(row.maxBattles, r.battlesTotal || 0);
    row.maxModelCalls = Math.max(row.maxModelCalls, r.modelCalls || 0);
  }
  for (const row of Object.values(out)) row.tripped = row.budgetSkippedRuns > 0 || row.deferredRuns > 0 || row.overWallRuns > 0;
  return days.map((d) => out[d]);
}

const rate = (n, d) => (d > 0 ? n / d : null);

/** Dispatched model-call checks per session and arm: timeouts, 400s, invalid_tool_result; `on` flagged above the `off` baseline. */
export function checksRead(ticks, days) {
  const blank = () => ({ n: 0, timeout: 0, e400: 0, invalid: 0, other: 0 });
  const out = {};
  for (const d of days) out[d] = { day: d, on: blank(), off: blank(), shadow: blank() };
  for (const t of Array.isArray(ticks) ? ticks : []) {
    const arm = classifyTick(t);
    if (!arm) continue;
    const row = out[etDay(toMs(t.capturedAt ?? t.at))];
    if (!row) continue;
    const a = row[arm];
    a.n += 1;
    if (t.model?.outcome === 'failed') {
      const k = t.model?.failureClass;
      if (k === 'timeout') a.timeout += 1; else if (k === '400') a.e400 += 1; else if (k === 'invalid_tool_result') a.invalid += 1; else a.other += 1;
    }
  }
  return days.map((d) => {
    const row = out[d];
    const flags = {};
    for (const k of ['timeout', 'e400', 'invalid']) {
      const onRate = rate(row.on[k], row.on.n);
      const offRate = rate(row.off[k], row.off.n);
      // Above the `off` baseline of the same session; with no `off` check that session there is no baseline (null), and a
      // failure on an `on` check with no baseline is flagged for a human to read, never passed silently.
      flags[k] = onRate === null ? 'none' : (offRate === null ? (row.on[k] > 0 ? 'no baseline' : 'ok') : (onRate > offRate ? 'ABOVE' : 'ok'));
    }
    return { ...row, flags, tripped: Object.values(flags).some((f) => f === 'ABOVE') };
  });
}

/** The answer chain per session, from `on` battles' calls and callEvents. */
export function answersRead({ calls, events }, days) {
  const out = {};
  for (const d of days) out[d] = { day: d, commands: 0, acknowledgments: 0, heard: 0, acted: 0, noMatchingTrade: 0 };
  const byId = new Map((Array.isArray(calls) ? calls : []).map((c) => [c?.callId, c]));
  for (const e of Array.isArray(events) ? events : []) {
    const row = out[etDay(toMs(e?.at))];
    if (!row) continue;
    if (e.kind === 'answered') {
      const kind = byId.get((e.callIds || [])[0])?.playerResponse?.kind;
      if (kind === 'directive') row.commands += 1; else row.acknowledgments += 1;
    } else if (e.kind === 'heard') row.heard += 1;
    else if (e.kind === 'acted') row.acted += 1;
    else if (e.kind === 'no_matching_trade') row.noMatchingTrade += 1;
  }
  return days.map((d) => out[d]);
}

/**
 * The release-cohort battle count per session: `on`, agent mode, not a CPU seat, by owner ordinal.
 * `inCohort(battle)` is the control document's own test (release.js isInReleaseCohort) and
 * `allowlist` an optional Set of owner ids — both supplied by main(); neither is ever printed.
 * basis: 'outside the allowlist' (allowlist supplied) | 'bucket under the share' (control active) | 'not determinable'.
 */
export function cohortRead(battleDays, { allowlist = null, inCohort = null } = {}) {
  const basis = allowlist ? 'outside the allowlist' : (inCohort ? 'bucket under the share' : 'not determinable');
  const days = Object.keys(battleDays).sort();
  return {
    basis,
    perDay: days.map((d) => {
      const rows = battleDays[d] || [];
      const agent = rows.filter((b) => b.gameMode === 'baggerbomb_agent' && b.isCpu !== true && typeof b.ownerId === 'string' && b.ownerId.length > 0);
      const members = agent.filter((b) => (allowlist ? !allowlist.has(b.ownerId) : (inCohort ? inCohort(b) : false)));
      const owners = new Map();
      for (const b of members) owners.set(b.ordinal, (owners.get(b.ordinal) || 0) + 1);
      return {
        day: d, onAgentBattles: agent.length, cohortBattles: basis === 'not determinable' ? null : members.length,
        owners: [...owners.entries()].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([ordinal, battles]) => ({ ordinal, battles })),
      };
    }),
  };
}

/**
 * Sweep lag per session: for calls the sweep settled, stateChangedAt − the call's deadline (never negative); and the overdue
 * queue rows now. `deadlineOf(call)` is the sweep's own `callDeadlineMs` (sweep.js — a `next_check` call settles at the session
 * close by design, so its deadline is the H2 cutoff, not horizon.expiresAt) supplied by main(); the default reads horizon.expiresAt.
 */
export function sweepLagRead({ calls, queue, nowMs, deadlineOf = (c) => toMs(c?.horizon?.expiresAt) }, days) {
  const lags = {};
  for (const d of days) lags[d] = [];
  for (const c of Array.isArray(calls) ? calls : []) {
    if (c?.stateSource !== 'sweep') continue;
    const at = toMs(c.stateChangedAt);
    const due = deadlineOf(c);
    const bucket = lags[etDay(at)];
    if (!bucket || !finite(at) || !finite(due)) continue;
    bucket.push(Math.max(0, at - due));
  }
  const overdue = (Array.isArray(queue) ? queue : []).filter((r) => finite(toMs(r?.nextExpiresAt)) && toMs(r.nextExpiresAt) > 0 && toMs(r.nextExpiresAt) < nowMs).length;
  return {
    overdueQueueRows: overdue,
    perDay: days.map((d) => ({ day: d, swept: lags[d].length, medianMs: percentile(lags[d], 0.5), p90Ms: percentile(lags[d], 0.9), maxMs: lags[d].length ? Math.max(...lags[d]) : null })),
  };
}

/** The `on` checks' model cost per session, and the extra the declarations tool is estimated to add. */
export function costRead(ticks, days) {
  const out = {};
  for (const d of days) out[d] = { day: d, onChecks: 0, inputTokens: 0, outputTokens: 0 };
  for (const t of Array.isArray(ticks) ? ticks : []) {
    if (classifyTick(t) !== 'on') continue;
    const row = out[etDay(toMs(t.capturedAt ?? t.at))];
    if (!row) continue;
    row.onChecks += 1;
    row.inputTokens += finite(t.callEnvelope?.inputTokens) ? t.callEnvelope.inputTokens : 0;
    row.outputTokens += finite(t.callEnvelope?.outputTokens) ? t.callEnvelope.outputTokens : 0;
  }
  return days.map((d) => {
    const r = out[d];
    return {
      ...r,
      modelUsd: (r.inputTokens / 1e6) * HAIKU_PRICE_PER_MTOK.input + (r.outputTokens / 1e6) * HAIKU_PRICE_PER_MTOK.output,
      extraUsd: r.onChecks * ON_EXTRA_USD_PER_CHECK,
    };
  });
}

// ---------------------------------------------------------------- rendering

const dash = (v) => (v === null || v === undefined ? '—' : String(v));
const secs = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`);
const mins = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 60000).toFixed(1)} min`);
const usd = (v) => `$${v.toFixed(v < 1 ? 4 : 2)}`;
const pct = (n, d) => (d > 0 ? `${((100 * n) / d).toFixed(1)} %` : '—');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

/** The whole read as Markdown. Pure. */
export function renderStage(read) {
  const L = [];
  L.push('## Cockpit release stage read (`scripts/cockpit-release-read.mjs`)', '');
  L.push(`Read at ${new Date(read.readAtMs).toISOString()} · ET sessions ${read.days.join(', ')} · control document: ${read.control}. No uid, owner id, agent id or battle id is printed; owners are ordinals.`, '');
  const trips = [];
  for (const e of read.evaluator) if (e.tripped) trips.push(`${e.day}: evaluator (${e.budgetSkippedRuns} budget-skipped run(s), ${e.deferredRuns} deferred, ${e.overWallRuns} over ${WALL_TRIP_MS / 1000} s)`);
  for (const c of read.checks) if (c.tripped) trips.push(`${c.day}: \`on\` checks above the \`off\` baseline (${Object.entries(c.flags).filter(([, f]) => f === 'ABOVE').map(([k]) => k).join(', ')})`);
  for (const c of read.checks) for (const [k, f] of Object.entries(c.flags)) if (f === 'no baseline') trips.push(`${c.day}: \`on\` ${k} with no \`off\` baseline that session — read it`);
  L.push(`**Trips:** ${trips.length ? trips.join('; ') : 'none'}.`, '');
  L.push('### Evaluator runs (agentEvalRuns)', '');
  L.push(table(['ET day', 'Runs', 'budgetSkipped > 0', 'deferred > 0', `wallMs > ${WALL_TRIP_MS / 1000} s`, 'Max wall', 'Max battles', 'Max model calls'],
    read.evaluator.map((e) => [e.day, e.runs, e.budgetSkippedRuns, e.deferredRuns, e.overWallRuns, secs(e.maxWallMs), e.maxBattles, e.maxModelCalls])), '');
  L.push('### Model-call checks — `on` against the `off` baseline of the same session', '');
  L.push(table(['ET day', '`on` checks', '`on` timeout / 400 / invalid', '`off` checks', '`off` timeout / 400 / invalid', 'Flags (timeout · 400 · invalid)'],
    read.checks.map((c) => [c.day, c.on.n, `${c.on.timeout} / ${c.on.e400} / ${c.on.invalid} (${pct(c.on.timeout + c.on.e400 + c.on.invalid, c.on.n)})`, c.off.n, `${c.off.timeout} / ${c.off.e400} / ${c.off.invalid} (${pct(c.off.timeout + c.off.e400 + c.off.invalid, c.off.n)})`, `${c.flags.timeout} · ${c.flags.e400} · ${c.flags.invalid}`])), '');
  L.push('### Answers (commands, heard, acted, no_matching_trade — `on` battles)', '');
  L.push(table(['ET day', 'Commands', 'Acknowledgments', 'Heard', 'Acted', 'No matching trade'], read.answers.map((a) => [a.day, a.commands, a.acknowledgments, a.heard, a.acted, a.noMatchingTrade])), '');
  L.push(`### Release-cohort battles (agent mode, ${read.cohort.basis}, by owner ordinal)`, '');
  L.push(table(['ET day', '`on` agent-mode battles', 'Cohort battles', 'By owner ordinal'],
    read.cohort.perDay.map((c) => [c.day, c.onAgentBattles, dash(c.cohortBattles), c.owners.length ? c.owners.map((o) => `${o.ordinal} ×${o.battles}`).join(' · ') : '—'])), '');
  L.push('### Sweep lag (calls the sweep settled: stamp − deadline)', '');
  L.push(`Queue rows overdue at the read: **${read.sweep.overdueQueueRows}**.`, '');
  L.push(table(['ET day', 'Swept', 'Median', 'p90', 'Max'], read.sweep.perDay.map((s) => [s.day, s.swept, mins(s.medianMs), mins(s.p90Ms), mins(s.maxMs)])), '');
  L.push(`### Cost line (Haiku 4.5 list price $${HAIKU_PRICE_PER_MTOK.input} in / $${HAIKU_PRICE_PER_MTOK.output} out per MTok; the declarations tool's extra at the report's estimate, $${ON_EXTRA_USD_PER_CHECK} per \`on\` check)`, '');
  L.push(table(['ET day', '`on` checks', 'Input tokens', 'Output tokens', 'Model cost', 'Estimated extra from `on`'], read.cost.map((c) => [c.day, c.onChecks, c.inputTokens.toLocaleString('en-US'), c.outputTokens.toLocaleString('en-US'), usd(c.modelUsd), usd(c.extraUsd)])), '');
  return L.join('\n');
}

// ---------------------------------------------------------------- the run (reads only)

async function main() {
  const { writeFileSync } = await import('node:fs');
  const path = (await import('node:path')).default;
  const { PROJECT_ROOT } = await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const { ensureReleaseView, getReleaseView } = await import('../api/_utils/callRecords/release.js');
  const { isInReleaseCohort } = await import('../api/_utils/callRecords/release.js');
  const { readCockpitAllowlist } = await import('../api/_utils/callRecords/allowlist.js');
  const { callDeadlineMs } = await import('../api/_utils/callRecords/sweep.js');
  const args = process.argv.slice(2);
  const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const today = etDay(Date.now());
  const from = argOf('--from') || today;
  const to = argOf('--to') || from;
  const days = sessionDays(from, to);
  if (!days.length) throw new Error('--from/--to name no weekday');
  const db = getFirebaseAdmin();
  const readAtMs = Date.now();
  const floorIso = new Date(Date.parse(`${days[0]}T00:00:00Z`) - 86_400_000).toISOString();
  const ceilIso = new Date(Date.parse(`${days[days.length - 1]}T00:00:00Z`) + 2 * 86_400_000).toISOString();

  // 1. the evaluator's run records
  const runs = (await db.collection('agentEvalRuns').where('startedAt', '>=', floorIso).where('startedAt', '<=', ceilIso).get()).docs.map((d) => d.data());
  // 2. the battles whose session falls in range (masked: no portfolio, chat or evaluation text is read)
  const battleDocs = (await db.collection('agentBattles').where('expiresAt', '>=', floorIso).where('expiresAt', '<=', ceilIso)
    .select('ownerId', 'gameMode', 'isCpu', 'status', 'expiresAt').get()).docs;
  const ordinal = ordinalsOf(battleDocs.map((d) => d.data().ownerId));
  // 3. the control document (cohort basis) and the optional allowlist
  await ensureReleaseView(db, { force: true, timeoutMs: 10_000 });
  const control = getReleaseView();
  const list = readCockpitAllowlist();
  const allowlist = list.length ? new Set(list) : null;
  const inCohort = control.active ? (b) => isInReleaseCohort(b, control) : null;

  const ticks = []; const calls = []; const events = []; const battleDays = {};
  for (const d of days) battleDays[d] = [];
  for (const doc of battleDocs) {
    const b = doc.data();
    if (b.isCpu === true) continue; // CPU seats never call the model and never resolve `on`
    const ref = db.collection('agentBattles').doc(doc.id);
    const ts = (await ref.collection('ticks').select('schemaVersion', 'capturedAt', 'model', 'callEnvelope').get()).docs.map((t) => t.data());
    ticks.push(...ts);
    const onDays = new Set(ts.filter((t) => classifyTick(t) === 'on').map((t) => etDay(toMs(t.capturedAt))));
    for (const d of onDays) if (battleDays[d]) battleDays[d].push({ gameMode: b.gameMode, isCpu: b.isCpu, ownerId: b.ownerId, ordinal: ordinal.get(b.ownerId) });
    if (onDays.size) {
      calls.push(...(await ref.collection('calls').get()).docs.map((c) => c.data()));
      events.push(...(await ref.collection('callEvents').get()).docs.map((e) => e.data()));
    }
  }
  const queue = (await db.collection('callSweepQueue').select('nextExpiresAt').get()).docs.map((q) => q.data());

  const read = {
    readAtMs, days,
    control: control.active ? `active, ${control.shareBp} bp` : `${control.status} (the cohort is empty)`,
    evaluator: evaluatorRead(runs, days),
    checks: checksRead(ticks, days),
    answers: answersRead({ calls, events }, days),
    cohort: cohortRead(battleDays, { allowlist, inCohort }),
    sweep: sweepLagRead({ calls, queue, nowMs: readAtMs, deadlineOf: callDeadlineMs }, days),
    cost: costRead(ticks, days),
  };
  const out = renderStage(read);
  if (argOf('--out')) writeFileSync(path.resolve(PROJECT_ROOT, argOf('--out')), out); else process.stdout.write(out + '\n');
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch((err) => { console.error(err?.message || err); process.exit(1); });
}
