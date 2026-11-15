// scripts/eval-capacity-read.mjs
//
// THE EVALUATOR CAPACITY READ (docs/audits/20261115_PHASE0_EVAL_FANOUT.md, Part B). Over a range of ET
// sessions it prints, from production records only:
//
//   B1 runs     agentEvalRuns: median / p90 / max of battlesTotal, modelCalls, wallMs, budgetSkipped, deferred,
//               lockSkipped (and triggered, evaluated, dormant); the five largest runs in full (counts only — never
//               the deferred ids); wall time by model calls; sessions short of 26 run records (a platform-killed
//               run leaves none); least-squares fits of wallMs on modelCalls (one regressor, and two: model calls
//               and the other evaluated battles); the zero-battle runs (the pre-loop work alone).
//   B1b mix     each tick record assigned to its run by time; per run, agent-mode and League model checks, CPU-seat
//               ticks and human ticks without a model call; a four-regressor fit so each kind gets its own pace; the
//               agent-mode checks per run, and the runs that held two or more, in full (start time and counts only).
//   B2 ticks   the evaluation entries (agentBattles.evaluations[]: tickMs, buildMs, callMs), split by whether the
//               tick dispatched a model call (callMs present) or not; for model-calling ticks the remainder
//               tickMs − buildMs − callMs and the share of tickMs spent in the call; the permanent tick records
//               (agentBattles/{id}/ticks: callEnvelope tokens and callMs, exitReason, capture cost); ticks per
//               battle-day; the per-tick universe size (held ∪ bench ∪ hot-bench names).
//   E2 eodhd    the intraday poller's own unit ledger (intradayBudget/{etDate}.unitsRequested, the only per-day
//               EODHD count any consumer keeps — docs/audits/20261007_EODHD_CALL_CENSUS.md Q-09).
//
// It is the build's before/after instrument: rerun it over the same window before and after any change.
//
// IT NEVER NEEDS A UID AND PRINTS NO ID. No owner, agent or battle id is selected from any query except the
// battle document id, which is used only to address its own subcollection and is never kept in a result. The
// run records' `deferredBattleIds` are read as a COUNT only. Ticks are read with a field mask that leaves out
// battleId, agentId and ownerId.
//
// READ-ONLY BY CONSTRUCTION. Firestore Admin SDK `.get()` only — no set, update, delete, create, transaction,
// batch or bulk writer. No external API call (no Anthropic, no EODHD). The only file written is --json's path.
//
// USAGE (repo root; the Firebase Admin env vars must be in the shell or in .env.local / .env at the repo root):
//   node scripts/eval-capacity-read.mjs --from 2026-10-16 --to 2026-11-13 [--json <out.json>]
//   --from / --to: ET dates, inclusive. Default --from 2026-10-16 (the first session at the 40 s model ceiling),
//   default --to the last weekday before today (ET). Weekends are skipped; a market holiday prints as a session
//   with no runs.
//
// The tallies are pure exported functions; Firestore and the env loader are imported lazily inside main().

export const SESSION_TZ = 'America/New_York';
/** The first session at the 40 s SDK timeout (commit e5ce2970, 2026-10-15 11:53 CDT; agentEvalTransport.js:21). */
export const DEFAULT_FROM = '2026-10-16';
/** Run records a full session should hold: one per 15-minute slot inside market hours (readiness report §A2). */
export const RUNS_PER_SESSION = 26;

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

/** The last weekday strictly before the ET date of `nowMs`. */
export function lastCompletedSession(nowMs) {
  let t = Date.parse(`${etDay(nowMs)}T12:00:00Z`) - 86_400_000;
  for (;;) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) return new Date(t).toISOString().slice(0, 10);
    t -= 86_400_000;
  }
}

export function percentile(values, p) {
  const a = values.filter(finite).sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p;
  const lo = Math.floor(i); const hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}

/** n, median, p90, max, mean of the finite values. */
export function dist(values) {
  const a = values.filter(finite);
  if (!a.length) return { n: 0, median: null, p90: null, max: null, mean: null };
  return { n: a.length, median: percentile(a, 0.5), p90: percentile(a, 0.9), max: Math.max(...a), mean: a.reduce((s, v) => s + v, 0) / a.length };
}

/**
 * Ordinary least squares y = b0 + b1·x1 (+ b2·x2). Returns the coefficients, r (one regressor) or R² (two), and n.
 * Pure; null when the system is singular or n is too small.
 */
export function ols(rows, xKeys, yKey) {
  const pts = rows.filter((r) => finite(r[yKey]) && xKeys.every((k) => finite(r[k])));
  const k = xKeys.length + 1;
  if (pts.length < k + 1) return null;
  // Normal equations XᵀX b = Xᵀy, solved by Gaussian elimination with partial pivoting.
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (const p of pts) {
    const x = [1, ...xKeys.map((key) => p[key])];
    for (let i = 0; i < k; i += 1) {
      for (let j = 0; j < k; j += 1) A[i][j] += x[i] * x[j];
      A[i][k] += x[i] * p[yKey];
    }
  }
  for (let c = 0; c < k; c += 1) {
    let piv = c;
    for (let r = c + 1; r < k; r += 1) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-9) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < k; r += 1) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j += 1) A[r][j] -= f * A[c][j];
    }
  }
  const b = A.map((row, i) => row[k] / row[i]);
  const ys = pts.map((p) => p[yKey]);
  const yMean = ys.reduce((s, v) => s + v, 0) / ys.length;
  let ssRes = 0; let ssTot = 0;
  for (const p of pts) {
    const yHat = b[0] + xKeys.reduce((s, key, i) => s + b[i + 1] * p[key], 0);
    ssRes += (p[yKey] - yHat) ** 2;
    ssTot += (p[yKey] - yMean) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
  return { n: pts.length, intercept: b[0], slopes: Object.fromEntries(xKeys.map((key, i) => [key, b[i + 1]])), r2, r: xKeys.length === 1 && r2 !== null ? Math.sign(b[1]) * Math.sqrt(Math.max(0, r2)) : null };
}

// ---------------------------------------------------------------- B1: the run records

/** One run record → the numbers this read uses. The deferred ids are COUNTED, never kept. Pure. */
export function runRow(r) {
  const startMs = toMs(r?.startedAt);
  const battlesTotal = finite(r?.battlesTotal) ? r.battlesTotal : 0;
  const modelCalls = finite(r?.modelCalls) ? r.modelCalls : 0;
  const evaluated = finite(r?.evaluated) ? r.evaluated : 0;
  return {
    day: etDay(startMs),
    startMs: finite(startMs) ? startMs : null,
    startedAt: finite(startMs) ? new Date(startMs).toISOString() : null,
    wallMs: finite(r?.wallMs) ? r.wallMs : null,
    battlesTotal,
    evaluated,
    triggered: finite(r?.triggered) ? r.triggered : 0,
    modelCalls,
    budgetSkipped: finite(r?.budgetSkipped) ? r.budgetSkipped : 0,
    deferred: finite(r?.deferred) ? r.deferred : (Array.isArray(r?.deferredBattleIds) ? r.deferredBattleIds.length : 0),
    lockSkipped: finite(r?.lockSkipped) ? r.lockSkipped : 0,
    dormant: finite(r?.dormant) ? r.dormant : 0,
    // Battles the loop evaluated without dispatching a model call (no trigger, CPU seat, budget-skipped, failed build).
    nonModelEvaluated: Math.max(0, evaluated - modelCalls),
  };
}

const RUN_FIELDS = ['battlesTotal', 'modelCalls', 'wallMs', 'budgetSkipped', 'deferred', 'lockSkipped', 'triggered', 'evaluated', 'dormant', 'nonModelEvaluated'];

/** B1 over run rows already reduced by runRow and filtered to the window. Pure. */
export function runsRead(rows, days, { confirmWindow = null } = {}) {
  const perField = Object.fromEntries(RUN_FIELDS.map((f) => [f, dist(rows.map((r) => r[f]))]));
  const perDay = days.map((d) => {
    const dr = rows.filter((r) => r.day === d);
    return { day: d, runs: dr.length, short: dr.length > 0 && dr.length < RUNS_PER_SESSION, maxBattles: Math.max(0, ...dr.map((r) => r.battlesTotal)), maxModelCalls: Math.max(0, ...dr.map((r) => r.modelCalls)), maxWallMs: dr.length ? Math.max(...dr.map((r) => r.wallMs ?? 0)) : null, deferredRuns: dr.filter((r) => r.deferred > 0).length, budgetSkippedRuns: dr.filter((r) => r.budgetSkipped > 0).length };
  });
  const byCalls = [];
  const maxCalls = Math.max(0, ...rows.map((r) => r.modelCalls));
  for (let c = 0; c <= maxCalls; c += 1) {
    const w = rows.filter((r) => r.modelCalls === c).map((r) => r.wallMs);
    const d = dist(w);
    if (d.n) byCalls.push({ modelCalls: c, ...d, perCallMedianMs: c > 0 && d.median !== null ? d.median / c : null });
  }
  const largest = [...rows].sort((a, b) => (b.wallMs ?? 0) - (a.wallMs ?? 0)).slice(0, 5);
  const confirmRows = confirmWindow ? rows.filter((r) => r.day >= confirmWindow.from && r.day <= confirmWindow.to) : null;
  return {
    runs: rows.length,
    perField,
    perDay,
    byCalls,
    largest,
    runsWithDeferred: rows.filter((r) => r.deferred > 0).length,
    runsWithBudgetSkipped: rows.filter((r) => r.budgetSkipped > 0).length,
    runsWithLockSkipped: rows.filter((r) => r.lockSkipped > 0).length,
    zeroBattleRuns: dist(rows.filter((r) => r.battlesTotal === 0).map((r) => r.wallMs)),
    soloModelRuns: dist(rows.filter((r) => r.battlesTotal === 1 && r.modelCalls === 1).map((r) => r.wallMs)),
    fits: {
      wallOnCalls: ols(rows, ['modelCalls'], 'wallMs'),
      wallOnCallsAndOthers: ols(rows, ['modelCalls', 'nonModelEvaluated'], 'wallMs'),
      wallOnCallsWithCalls: ols(rows.filter((r) => r.modelCalls > 0), ['modelCalls'], 'wallMs'),
      confirm: confirmRows ? { window: confirmWindow, runs: confirmRows.length, fit: ols(confirmRows, ['modelCalls'], 'wallMs') } : null,
    },
  };
}

// ---------------------------------------------------------------- B1b: what each run held, by kind of tick

/** A tick belongs to the run that started last before it, if it lands inside that run's wall time (+ this slack). */
export const RUN_ASSIGN_SLACK_MS = 5_000;
const MIX_KEYS = ['agentModel', 'leagueModel', 'cpuTicks', 'humanNoModel'];

/**
 * Assign each tick record to its run (runs never overlap: one per 15-minute slot, wall ≤ 300 s) and count, per run,
 * agent-mode model checks, League model checks, CPU-seat ticks and human ticks without a model call. Then fit the
 * run's wall time on the four counts, so each kind of tick gets its own pace. Pure.
 */
export function mixRead(runs, ticks) {
  const ordered = runs.filter((r) => finite(r.startMs) && finite(r.wallMs)).sort((a, b) => a.startMs - b.startMs)
    .map((r) => ({ ...r, agentModel: 0, leagueModel: 0, cpuTicks: 0, humanNoModel: 0 }));
  let unassigned = 0;
  for (const t of ticks) {
    if (!finite(t.capturedAtMs)) { unassigned += 1; continue; }
    let lo = 0; let hi = ordered.length - 1; let idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (ordered[mid].startMs <= t.capturedAtMs) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    const run = idx >= 0 ? ordered[idx] : null;
    if (!run || t.capturedAtMs > run.startMs + run.wallMs + RUN_ASSIGN_SLACK_MS) { unassigned += 1; continue; }
    if (t.isCpu) run.cpuTicks += 1;
    else if (t.dispatched && t.gameMode === 'baggerbomb_tournament') run.leagueModel += 1;
    else if (t.dispatched) run.agentModel += 1;
    else run.humanNoModel += 1;
  }
  const consistent = ordered.filter((r) => r.agentModel + r.leagueModel === r.modelCalls).length;
  const only = (pred) => ordered.filter((r) => MIX_KEYS.every((k) => pred(k, r[k])));
  const soloAgent = only((k, v) => (k === 'agentModel' ? v === 1 : v === 0));
  const soloLeagueDays = ordered.filter((r) => r.leagueModel > 0 && r.agentModel === 0);
  const noModelWithBattles = ordered.filter((r) => r.modelCalls === 0 && r.battlesTotal > 0);
  return {
    runs: ordered.length,
    ticksUnassigned: unassigned,
    runsConsistent: consistent,
    totals: Object.fromEntries(MIX_KEYS.map((k) => [k, ordered.reduce((s, r) => s + r[k], 0)])),
    fit: ols(ordered, MIX_KEYS, 'wallMs'),
    fitAgentOnly: ols(ordered.filter((r) => r.leagueModel === 0), ['agentModel', 'cpuTicks', 'humanNoModel'], 'wallMs'),
    soloAgentRuns: dist(soloAgent.map((r) => r.wallMs)),
    leagueOnlyRunsPerCall: dist(soloLeagueDays.map((r) => r.wallMs / r.leagueModel)),
    agentRunsByCalls: [1, 2, 3, 4].map((c) => ({ calls: c, ...dist(ordered.filter((r) => r.agentModel === c && r.leagueModel === 0).map((r) => r.wallMs)) })).filter((d) => d.n),
    // Every run, League or not: how many agent-mode model checks it held, and the runs that held two or more in full.
    agentModelHistogram: ordered.reduce((h, r) => { h[r.agentModel] = (h[r.agentModel] || 0) + 1; return h; }, {}),
    multiAgentRuns: ordered.filter((r) => r.agentModel >= 2).map((r) => ({ startedAt: r.startedAt, wallMs: r.wallMs, agentModel: r.agentModel, leagueModel: r.leagueModel, cpuTicks: r.cpuTicks, humanNoModel: r.humanNoModel })),
    noModelRunsWallPerBattle: dist(noModelWithBattles.map((r) => r.wallMs / r.battlesTotal)),
    noModelRunsHumanOnly: dist(noModelWithBattles.filter((r) => r.cpuTicks === 0 && r.humanNoModel > 0).map((r) => r.wallMs / r.humanNoModel)),
  };
}

// ---------------------------------------------------------------- B2: the evaluation entries and the tick records

/** One evaluation entry → its timing, or null outside the window / without a tickMs. Pure; carries no id or text. */
export function entryRow(e, gameMode, dayset) {
  const day = etDay(toMs(e?.timestamp));
  if (!day || !dayset.has(day)) return null;
  if (!finite(e?.tickMs)) return null;
  const model = finite(e?.callMs);
  const tsMs = toMs(e?.timestamp);
  const builtMs = toMs(e?.promptBuiltAt);
  const hold = e?.decision === 'HOLD';
  return {
    day,
    gameMode: gameMode || null,
    model,
    hold,
    evalId: typeof e?.evalId === 'string' ? e.evalId : null, // the in-memory join key to the tick record; never printed
    tickMs: e.tickMs,
    buildMs: finite(e?.buildMs) ? e.buildMs : null,
    callMs: model ? e.callMs : null,
    failureClass: e?.haikuError?.failureClass ?? null,
    // The tick's time outside the prompt build and the model call (model-calling ticks only).
    remainderMs: model && finite(e?.buildMs) ? e.tickMs - e.buildMs - e.callMs : null,
    callShare: model && e.tickMs > 0 ? e.callMs / e.tickMs : null,
    // The instants the split needs: the model call's end (prompt built + the call), and the entry's `timestamp`,
    // stamped with no await between the call's return and it (agent-evaluate.js :3250–:3614).
    callEndMs: model && finite(builtMs) ? builtMs + e.callMs : null,
    buildStartMs: model && finite(builtMs) && finite(e?.buildMs) ? builtMs - e.buildMs : null,
    timestampMs: finite(tsMs) ? tsMs : null,
    // PRE-CALL (lock → build start), an ESTIMATE valid on a HOLD tick only: there no await sits between the entry's
    // `timestamp` and the final write (the swap and receipt awaits run on a model swap; the intraday view and the
    // shadow capture are dark), so `timestamp − tickMs` is the admission instant to within synchronous CPU.
    preCallMs: model && hold && finite(tsMs) && finite(builtMs) && finite(e?.buildMs) ? (builtMs - e.buildMs) - (tsMs - e.tickMs) : null,
  };
}

/**
 * Join an entry to its tick record (same battle, same evalId) and take the after-call tail: the model call's end →
 * the tick record's `capturedAt`, which is stamped when the capture is finalized, the last act of the tick's
 * `finally` (captureWriter.js :202) — so the tail holds the post-call work, the final battle write, the calls phase,
 * narrations, anticipations and the capture itself. Pure.
 */
export function joinTail(entry, tick) {
  if (!entry?.model || !finite(entry.callEndMs) || !finite(tick?.capturedAtMs)) return { ...entry, tailMs: null, afterWriteMs: null };
  return {
    ...entry,
    tailMs: tick.capturedAtMs - entry.callEndMs,
    // On a HOLD tick the final write is issued at `timestamp` (to within CPU): what follows it is the write's own
    // round trip, the calls phase, the voice dispatch and the capture — all outside `tickMs`.
    afterWriteMs: entry.hold && finite(entry.timestampMs) ? tick.capturedAtMs - entry.timestampMs : null,
  };
}

const timing = (rows) => ({
  n: rows.length,
  tickMs: dist(rows.map((r) => r.tickMs)),
  buildMs: dist(rows.map((r) => r.buildMs)),
  callMs: dist(rows.map((r) => r.callMs)),
  remainderMs: dist(rows.map((r) => r.remainderMs)),
  preCallMs: dist(rows.map((r) => r.preCallMs)),
  tailMs: dist(rows.map((r) => r.tailMs)),
  afterWriteMs: dist(rows.map((r) => r.afterWriteMs)),
  holds: rows.filter((r) => r.hold).length,
  joined: rows.filter((r) => finite(r.tailMs)).length,
  callShare: dist(rows.map((r) => r.callShare)),
  // The share of the tick's WHOLE in-loop time (admission → capture end, i.e. tickMs + the after-write part) spent in
  // the model call; HOLD ticks only, where the after-write part is measurable.
  callShareOfLoop: dist(rows.map((r) => (r.hold && finite(r.afterWriteMs) && r.tickMs + r.afterWriteMs > 0 ? r.callMs / (r.tickMs + r.afterWriteMs) : null))),
  loopMs: dist(rows.map((r) => (r.hold && finite(r.afterWriteMs) ? r.tickMs + r.afterWriteMs : null))),
  callShareOfSums: (() => {
    const t = rows.filter((r) => finite(r.callMs)).reduce((s, r) => s + r.tickMs, 0);
    const c = rows.filter((r) => finite(r.callMs)).reduce((s, r) => s + r.callMs, 0);
    return t > 0 ? c / t : null;
  })(),
});

/** B2 over entry rows (entryRow) and tick rows (tickRow). Pure. */
export function ticksRead(entries, ticks) {
  const model = entries.filter((r) => r.model);
  const nonModel = entries.filter((r) => !r.model);
  const modes = [...new Set(model.map((r) => r.gameMode || 'unknown'))].sort();
  const failures = {};
  for (const r of nonModel) failures[r.failureClass || 'none'] = (failures[r.failureClass || 'none'] || 0) + 1;
  const dispatched = ticks.filter((t) => t.dispatched);
  const exitReasons = {};
  for (const t of ticks) exitReasons[t.exitReason || 'unknown'] = (exitReasons[t.exitReason || 'unknown'] || 0) + 1;
  const battleDays = new Map();
  for (const t of ticks) {
    if (t.isCpu) continue;
    const key = `${t.battleKey}|${t.day}`;
    const b = battleDays.get(key) || { ticks: 0, dispatched: 0 };
    b.ticks += 1; if (t.dispatched) b.dispatched += 1;
    battleDays.set(key, b);
  }
  return {
    entries: { modelCalling: timing(model), nonModel: { ...timing(nonModel), failureClasses: failures }, byGameMode: Object.fromEntries(modes.map((m) => [m, timing(model.filter((r) => (r.gameMode || 'unknown') === m))])) },
    tickRecords: {
      n: ticks.length,
      exitReasons,
      dispatched: dispatched.length,
      inputTokens: dist(dispatched.map((t) => t.inputTokens)),
      outputTokens: dist(dispatched.map((t) => t.outputTokens)),
      callMs: dist(dispatched.map((t) => t.callMs)),
      tokensByGameMode: Object.fromEntries([...new Set(dispatched.map((t) => t.gameMode || 'unknown'))].sort().map((m) => {
        const rows = dispatched.filter((t) => (t.gameMode || 'unknown') === m);
        return [m, { inputTokens: dist(rows.map((t) => t.inputTokens)), outputTokens: dist(rows.map((t) => t.outputTokens)) }];
      })),
      outcomes: dispatched.reduce((o, t) => { const k = t.outcome === 'failed' ? `failed:${t.failureClass || '?'}` : (t.outcome || 'unknown'); o[k] = (o[k] || 0) + 1; return o; }, {}),
      universeByGameMode: Object.fromEntries([...new Set(ticks.filter((t) => !t.isCpu).map((t) => t.gameMode || 'unknown'))].sort().map((m) => [m, dist(ticks.filter((t) => !t.isCpu && (t.gameMode || 'unknown') === m).map((t) => t.universeSize))])),
      universeCpu: dist(ticks.filter((t) => t.isCpu).map((t) => t.universeSize)),
      capturePreCommitMs: dist(ticks.map((t) => t.preCommitMs)),
      captureBodyMs: dist(ticks.map((t) => t.bodyMs)),
      perBattleDay: { battleDays: battleDays.size, ticks: dist([...battleDays.values()].map((b) => b.ticks)), modelChecks: dist([...battleDays.values()].filter((b) => b.dispatched > 0).map((b) => b.dispatched)) },
    },
  };
}

/**
 * One tick record → the numbers this read uses, or null outside the window. `battleKey` is an in-memory ordinal of
 * the battle (never its id), used only to count ticks per battle-day. Pure.
 */
export function tickRow(t, { battleKey, isCpu, gameMode = null, dayset }) {
  const capturedAtMs = toMs(t?.capturedAt);
  const day = etDay(capturedAtMs);
  if (!day || !dayset.has(day)) return null;
  return {
    day, battleKey, isCpu: isCpu === true, capturedAtMs, gameMode,
    // held ∪ bench ∪ hot-bench (+ catalyst) names of the tick (captureWriter.js :204, :262) — the price fan-out's
    // symbol set WITHOUT the CPU opponent's book and the three macro symbols (agent-evaluate.js :1198–:1203).
    universeSize: finite(t?.universeSize) ? t.universeSize : null,
    evalId: typeof t?.evalId === 'string' ? t.evalId : null, // the in-memory join key; never printed
    exitReason: t?.exitReason ?? null,
    dispatched: t?.model?.dispatched === true,
    outcome: t?.model?.outcome ?? null,
    failureClass: t?.model?.failureClass ?? null,
    inputTokens: finite(t?.callEnvelope?.inputTokens) ? t.callEnvelope.inputTokens : null,
    outputTokens: finite(t?.callEnvelope?.outputTokens) ? t.callEnvelope.outputTokens : null,
    callMs: finite(t?.callEnvelope?.callMs) ? t.callEnvelope.callMs : null,
    preCommitMs: finite(t?.capture?.preCommitMs) ? t.capture.preCommitMs : null,
    bodyMs: finite(t?.capture?.bodyMs) ? t.capture.bodyMs : null,
  };
}

// ---------------------------------------------------------------- E2: the poller's unit ledger

/** intradayBudget docs (one per ET date) → units per session in the window. Pure. */
export function budgetRead(docsByDay, days) {
  const perDay = days.map((d) => {
    const doc = docsByDay[d] || null;
    return {
      day: d,
      unitsRequested: finite(doc?.unitsRequested) ? doc.unitsRequested : null,
      sweeps: finite(doc?.sweeps) ? doc.sweeps : null,
      unitsBySource: doc?.unitsBySource && typeof doc.unitsBySource === 'object' ? doc.unitsBySource : null,
    };
  });
  return { perDay, units: dist(perDay.map((r) => r.unitsRequested)) };
}

// ---------------------------------------------------------------- rendering

const s1 = (ms) => (ms === null || ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`);
const n0 = (v) => (v === null || v === undefined ? '—' : (Number.isInteger(v) ? String(v) : v.toFixed(1)));
const tok = (v) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('en-US'));
const pc = (v) => (v === null || v === undefined ? '—' : `${(100 * v).toFixed(1)} %`);
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const fitLine = (f, label) => (f ? `${label}: wallMs = ${s1(f.intercept)} + ${Object.entries(f.slopes).map(([k, v]) => `${s1(v)} × ${k}`).join(' + ')} (n = ${f.n}${f.r !== null ? `, r = ${f.r.toFixed(3)}` : ''}, R² = ${f.r2 === null ? '—' : f.r2.toFixed(3)})` : `${label}: not computable`);

/** The whole read as Markdown. Pure. */
export function render(read) {
  const L = [];
  const R = read.runs;
  L.push('## Evaluator capacity read (`scripts/eval-capacity-read.mjs`)', '');
  L.push(`Read at ${new Date(read.readAtMs).toISOString()} · ET sessions ${read.days[0]} → ${read.days[read.days.length - 1]} (${read.days.length} weekdays) · read-only (\`.get()\` only) · no id is printed.`, '');
  L.push('### B1. Runs (`agentEvalRuns`)', '');
  L.push(`${R.runs} run records. Runs with deferred > 0: **${R.runsWithDeferred}**; with budgetSkipped > 0: **${R.runsWithBudgetSkipped}**; with lockSkipped > 0: ${R.runsWithLockSkipped}.`, '');
  L.push(table(['Field', 'n', 'median', 'p90', 'max', 'mean'], RUN_FIELDS.map((f) => {
    const d = R.perField[f];
    const fmt = f === 'wallMs' ? s1 : n0;
    return [f, d.n, fmt(d.median), fmt(d.p90), fmt(d.max), fmt(d.mean)];
  })), '');
  L.push('**Wall time by model calls in the run**', '');
  L.push(table(['Model calls', 'Runs', 'Wall median', 'Wall p90', 'Wall max', 'Median ÷ calls'], R.byCalls.map((b) => [b.modelCalls, b.n, s1(b.median), s1(b.p90), s1(b.max), s1(b.perCallMedianMs)])), '');
  L.push('**Fits (least squares)**', '');
  L.push(`- ${fitLine(R.fits.wallOnCalls, 'All runs, one regressor')}`);
  L.push(`- ${fitLine(R.fits.wallOnCallsWithCalls, 'Runs with ≥ 1 model call, one regressor')}`);
  L.push(`- ${fitLine(R.fits.wallOnCallsAndOthers, 'All runs, two regressors (model calls; other evaluated battles)')}`);
  if (R.fits.confirm) L.push(`- ${fitLine(R.fits.confirm.fit, `Readiness-report window ${R.fits.confirm.window.from} → ${R.fits.confirm.window.to} (${R.fits.confirm.runs} runs), one regressor`)}`);
  L.push(`- Zero-battle runs (the pre-loop work alone, before the release read): n = ${R.zeroBattleRuns.n}, median ${s1(R.zeroBattleRuns.median)}, p90 ${s1(R.zeroBattleRuns.p90)}, max ${s1(R.zeroBattleRuns.max)}.`);
  L.push(`- One-battle, one-model-call runs: n = ${R.soloModelRuns.n}, median ${s1(R.soloModelRuns.median)}, p90 ${s1(R.soloModelRuns.p90)}, max ${s1(R.soloModelRuns.max)}.`, '');
  L.push('**The five largest runs (by wall time; counts only)**', '');
  L.push(table(['Started (UTC)', 'ET day', 'Wall', 'battlesTotal', 'evaluated', 'triggered', 'modelCalls', 'budgetSkipped', 'deferred', 'lockSkipped', 'dormant'],
    R.largest.map((r) => [r.startedAt, r.day, s1(r.wallMs), r.battlesTotal, r.evaluated, r.triggered, r.modelCalls, r.budgetSkipped, r.deferred, r.lockSkipped, r.dormant])), '');
  L.push('**Per session**', '');
  L.push(table(['ET day', 'Runs', `Short of ${RUNS_PER_SESSION}`, 'Max battles', 'Max model calls', 'Max wall', 'Deferred runs', 'Budget-skipped runs'],
    R.perDay.map((d) => [d.day, d.runs, d.short ? 'yes' : '', d.maxBattles, d.maxModelCalls, s1(d.maxWallMs), d.deferredRuns, d.budgetSkippedRuns])), '');
  const M = read.mix;
  L.push('### B1b. What each run held, by kind of tick (tick records assigned to their run by time)', '');
  L.push(`${M.runs} runs; tick records not inside any run: ${M.ticksUnassigned}; runs whose assigned model checks equal their \`modelCalls\`: ${M.runsConsistent} of ${M.runs}. Totals: agent-mode model checks ${M.totals.agentModel}, League model checks ${M.totals.leagueModel}, CPU-seat ticks ${M.totals.cpuTicks}, human ticks without a model call ${M.totals.humanNoModel}.`, '');
  const mixFit = (f, label) => (f ? `${label}: wallMs = ${s1(f.intercept)} + ${Object.entries(f.slopes).map(([k, v]) => `${s1(v)} × ${k}`).join(' + ')} (n = ${f.n}, R² = ${f.r2 === null ? '—' : f.r2.toFixed(3)})` : `${label}: not computable`);
  L.push(`- ${mixFit(M.fit, 'All runs, four regressors')}`);
  L.push(`- ${mixFit(M.fitAgentOnly, 'Runs with no League model check, three regressors')}`);
  L.push(`- Runs holding exactly one agent-mode model check and nothing else: n = ${M.soloAgentRuns.n}, median ${s1(M.soloAgentRuns.median)}, p90 ${s1(M.soloAgentRuns.p90)}, max ${s1(M.soloAgentRuns.max)}.`);
  L.push(`- Runs with League model checks and no agent-mode check, wall ÷ League checks: n = ${M.leagueOnlyRunsPerCall.n}, median ${s1(M.leagueOnlyRunsPerCall.median)}, p90 ${s1(M.leagueOnlyRunsPerCall.p90)} (CPU seats ride along).`);
  L.push(`- Runs with battles but no model call, wall ÷ battles: n = ${M.noModelRunsWallPerBattle.n}, median ${s1(M.noModelRunsWallPerBattle.median)}, p90 ${s1(M.noModelRunsWallPerBattle.p90)}, max ${s1(M.noModelRunsWallPerBattle.max)}; of those, human-only runs, wall ÷ human ticks: n = ${M.noModelRunsHumanOnly.n}, median ${s1(M.noModelRunsHumanOnly.median)}, max ${s1(M.noModelRunsHumanOnly.max)}.`, '');
  L.push(table(['Agent-mode model checks in the run (no League)', 'Runs', 'Wall median', 'Wall p90', 'Wall max'], M.agentRunsByCalls.map((d) => [d.calls, d.n, s1(d.median), s1(d.p90), s1(d.max)])), '');
  L.push(`Agent-mode model checks per run, all runs: ${Object.entries(M.agentModelHistogram).map(([k, v]) => `${k} → ${v} run(s)`).join(' · ')}.`, '');
  if (M.multiAgentRuns.length) {
    L.push(table(['Started (UTC)', 'Wall', 'Agent-mode model checks', 'League model checks', 'CPU ticks', 'Human ticks, no model'], M.multiAgentRuns.map((r) => [r.startedAt, s1(r.wallMs), r.agentModel, r.leagueModel, r.cpuTicks, r.humanNoModel])), '');
  }
  const T = read.ticks;
  L.push('### B2. Per tick', '');
  L.push('**Evaluation entries** (`agentBattles.evaluations[]`; an entry is written only on the triggered path, so a no-trigger or CPU tick has none). `tickMs` runs from the lock to just before the final battle write.', '');
  const trow = (label, t) => [label, t.n, `${s1(t.tickMs.median)} / ${s1(t.tickMs.p90)} / ${s1(t.tickMs.max)}`, `${s1(t.buildMs.median)} / ${s1(t.buildMs.p90)} / ${s1(t.buildMs.max)}`, `${s1(t.callMs.median)} / ${s1(t.callMs.p90)} / ${s1(t.callMs.max)}`, `${s1(t.remainderMs.median)} / ${s1(t.remainderMs.p90)} / ${s1(t.remainderMs.max)}`, `${pc(t.callShare.median)} (sums ${pc(t.callShareOfSums)})`];
  L.push(table(['Ticks', 'n', 'tickMs med / p90 / max', 'buildMs med / p90 / max', 'callMs med / p90 / max', 'tick − build − call med / p90 / max', 'callMs ÷ tickMs median (of sums)'], [
    trow('model-calling', T.entries.modelCalling),
    ...Object.entries(T.entries.byGameMode).map(([m, t]) => trow(`  ${m}`, t)),
    trow('no model call', T.entries.nonModel),
  ]), '');
  L.push(`No-model-call entries by failure class: ${Object.entries(T.entries.nonModel.failureClasses).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}.`, '');
  L.push('**Where a model-calling tick\'s time goes** (entry joined to its tick record by battle and evalId, in memory). *Pre-call* = lock → prompt-build start, an estimate on HOLD ticks only (no await between the entry\'s `timestamp` and the final write there). *Tail* = model call end → the tick record\'s `capturedAt` (the last act of the tick: post-call work, final write, calls phase, narrations, anticipations, capture). *After the write* = `timestamp` → `capturedAt` on HOLD ticks (all outside `tickMs`). *In-loop* = `tickMs` + after-the-write (lock → capture end; the lock transaction itself is not measured).', '');
  const srow = (label, t) => [label, `${t.n} (HOLD ${t.holds}, joined ${t.joined})`, `${s1(t.preCallMs.median)} / ${s1(t.preCallMs.p90)} / ${s1(t.preCallMs.max)}`, `${s1(t.tailMs.median)} / ${s1(t.tailMs.p90)} / ${s1(t.tailMs.max)}`, `${s1(t.afterWriteMs.median)} / ${s1(t.afterWriteMs.p90)} / ${s1(t.afterWriteMs.max)}`, `${s1(t.loopMs.median)} / ${s1(t.loopMs.p90)} / ${s1(t.loopMs.max)} (mean ${s1(t.loopMs.mean)})`, `${pc(t.callShareOfLoop.median)}`];
  L.push(table(['Ticks', 'n', 'pre-call (HOLD) med / p90 / max', 'tail med / p90 / max', 'after the write (HOLD) med / p90 / max', 'in-loop (HOLD) med / p90 / max', 'callMs ÷ in-loop (HOLD) median'], [
    srow('model-calling', T.entries.modelCalling),
    ...Object.entries(T.entries.byGameMode).map(([m, t]) => srow(`  ${m}`, t)),
  ]), '');
  const K = T.tickRecords;
  L.push('**Tick records** (`agentBattles/{id}/ticks`, every admitted tick)', '');
  L.push(`${K.n} tick records; exit reasons: ${Object.entries(K.exitReasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}.`, '');
  L.push(`Dispatched model calls: ${K.dispatched} (outcomes: ${Object.entries(K.outcomes).map(([k, v]) => `${k} ${v}`).join(' · ')}).`, '');
  L.push(table(['Per dispatched call', 'n', 'median', 'p90', 'max', 'mean'], [
    ['input tokens', K.inputTokens.n, tok(K.inputTokens.median), tok(K.inputTokens.p90), tok(K.inputTokens.max), tok(K.inputTokens.mean)],
    ['output tokens', K.outputTokens.n, tok(K.outputTokens.median), tok(K.outputTokens.p90), tok(K.outputTokens.max), tok(K.outputTokens.mean)],
    ['callMs (envelope)', K.callMs.n, s1(K.callMs.median), s1(K.callMs.p90), s1(K.callMs.max), s1(K.callMs.mean)],
    ...Object.entries(K.tokensByGameMode).flatMap(([m, d]) => [
      [`  ${m}: input tokens`, d.inputTokens.n, tok(d.inputTokens.median), tok(d.inputTokens.p90), tok(d.inputTokens.max), tok(d.inputTokens.mean)],
      [`  ${m}: output tokens`, d.outputTokens.n, tok(d.outputTokens.median), tok(d.outputTokens.p90), tok(d.outputTokens.max), tok(d.outputTokens.mean)],
    ]),
  ]), '');
  L.push(`Universe per tick (held ∪ bench ∪ hot-bench names; the price fan-out adds the CPU opponent's book and SPY, QQQ, BTC-USD.CC): ${Object.entries(K.universeByGameMode).map(([m, d]) => `${m} median ${n0(d.median)}, p90 ${n0(d.p90)}, max ${n0(d.max)} (n = ${d.n})`).join(' · ')}; CPU seats median ${n0(K.universeCpu.median)} (n = ${K.universeCpu.n}).`, '');
  L.push(`Capture cost per tick: preCommitMs median ${n0(K.capturePreCommitMs.median)} ms, p90 ${n0(K.capturePreCommitMs.p90)} ms, max ${n0(K.capturePreCommitMs.max)} ms; bodyMs median ${n0(K.captureBodyMs.median)} ms, p90 ${n0(K.captureBodyMs.p90)} ms, max ${n0(K.captureBodyMs.max)} ms.`, '');
  L.push(`Per battle-day (non-CPU battles): ${K.perBattleDay.battleDays} battle-days; ticks median ${n0(K.perBattleDay.ticks.median)} (max ${n0(K.perBattleDay.ticks.max)}); model checks on days with any, median ${n0(K.perBattleDay.modelChecks.median)} (p90 ${n0(K.perBattleDay.modelChecks.p90)}, max ${n0(K.perBattleDay.modelChecks.max)}).`, '');
  const B = read.budget;
  L.push('### E2. The intraday poller\'s unit ledger (`intradayBudget/{etDate}`)', '');
  L.push(`Sessions with a ledger: ${B.units.n} of ${read.days.length}; units requested per session median ${tok(B.units.median)}, p90 ${tok(B.units.p90)}, max ${tok(B.units.max)}.`, '');
  L.push(table(['ET day', 'Units requested', 'Sweeps', 'By source'], B.perDay.map((r) => [r.day, tok(r.unitsRequested), n0(r.sweeps), r.unitsBySource ? Object.entries(r.unitsBySource).map(([k, v]) => `${k} ${tok(v)}`).join(' · ') : '—'])), '');
  return L.join('\n');
}

// ---------------------------------------------------------------- the run (reads only)

/** Everything the read reads — through `.get()` only — and the tallies over it. Exported so a fake handle can drive it. */
export async function gather(db, { days, readAtMs, confirmWindow = null }) {
  const dayset = new Set(days);
  const floorIso = new Date(Date.parse(`${days[0]}T00:00:00Z`) - 86_400_000).toISOString();
  const ceilIso = new Date(Date.parse(`${days[days.length - 1]}T00:00:00Z`) + 2 * 86_400_000).toISOString();
  // 1. the run records (the deferred ids are counted in runRow and dropped)
  const runDocs = (await db.collection('agentEvalRuns').where('startedAt', '>=', floorIso).where('startedAt', '<=', ceilIso).get()).docs;
  const runs = runDocs.map((d) => runRow(d.data())).filter((r) => r.day && dayset.has(r.day));
  // 2. the battles that could hold an entry in the window (masked: no owner, agent, portfolio or chat field)
  const horizonIso = new Date(Date.parse(`${days[days.length - 1]}T00:00:00Z`) + 21 * 86_400_000).toISOString();
  const battleDocs = (await db.collection('agentBattles').where('expiresAt', '>=', floorIso).where('expiresAt', '<=', horizonIso)
    .select('evaluations', 'gameMode', 'isCpu').get()).docs;
  const entries = []; const ticks = [];
  let ordinal = 0;
  for (const doc of battleDocs) {
    const b = doc.data();
    ordinal += 1; // the battle's in-memory key — never its id
    const battleEntries = [];
    for (const e of Array.isArray(b.evaluations) ? b.evaluations : []) {
      const row = entryRow(e, b.gameMode, dayset);
      if (row) battleEntries.push(row);
    }
    const tickDocs = (await db.collection('agentBattles').doc(doc.id).collection('ticks')
      .select('capturedAt', 'evalId', 'exitReason', 'model', 'callEnvelope', 'capture', 'universeSize').get()).docs;
    const ticksByEval = new Map();
    for (const t of tickDocs) {
      const row = tickRow(t.data(), { battleKey: ordinal, isCpu: b.isCpu, gameMode: b.gameMode, dayset });
      if (!row) continue;
      ticks.push(row);
      if (row.evalId && row.dispatched) ticksByEval.set(row.evalId, row);
    }
    // Join within this battle only (an evalId is a per-battle sequence), then drop the key.
    for (const e of battleEntries) {
      const joined = joinTail(e, e.evalId ? ticksByEval.get(e.evalId) : null);
      delete joined.evalId;
      entries.push(joined);
    }
  }
  for (const t of ticks) delete t.evalId;
  // 3. the poller's unit ledger, one document per ET date
  const budgetDocs = await db.getAll(...days.map((d) => db.collection('intradayBudget').doc(d)));
  const docsByDay = Object.fromEntries(budgetDocs.map((d, i) => [days[i], d.exists ? d.data() : null]));
  return { readAtMs, days, battlesRead: battleDocs.length, runs: runsRead(runs, days, { confirmWindow }), mix: mixRead(runs, ticks), ticks: ticksRead(entries, ticks), budget: budgetRead(docsByDay, days) };
}

async function main() {
  const { writeFileSync } = await import('node:fs');
  const path = (await import('node:path')).default;
  const { PROJECT_ROOT } = await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const args = process.argv.slice(2);
  const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const from = argOf('--from') || DEFAULT_FROM;
  const to = argOf('--to') || lastCompletedSession(Date.now());
  const days = sessionDays(from, to);
  if (!days.length) throw new Error('--from/--to name no weekday');
  const db = getFirebaseAdmin();
  // The cockpit readiness report's fit window (§A2: "the last 10 sessions", Oct 27 – Nov 9), re-fit here to confirm it.
  const confirmWindow = { from: '2026-10-27', to: '2026-11-09' };
  const read = await gather(db, { days, readAtMs: Date.now(), confirmWindow });
  process.stdout.write(`${render(read)}\n\nBattle documents read: ${read.battlesRead}.\n`);
  if (argOf('--json')) writeFileSync(path.resolve(PROJECT_ROOT, argOf('--json')), JSON.stringify(read, null, 2));
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch((err) => { console.error(err?.message || err); process.exit(1); });
}
