// src/components/Dashboard/deployCeremony/ceremonyTiming.js
//
// Deploy Ceremony — stage-duration instrumentation. RECORD ONLY.
//
// WHY THIS EXISTS. The ceremony runs 20–30s. The founder's report is that the
// first two stages felt stalled while the latter half felt fine — even though
// stage 4 is LONGER than stage 1. Duration alone therefore does not predict the
// complaint, so pacing cannot be specced from feel; it needs the actual split.
// Two decisions are blocked on that split:
//
//   A. Is pre-warming `ensure-casual-clone` worth it? It only helps stage 1, so
//      the clone round trip settles it on its own — ~200ms and pre-warming is
//      dead; seconds and it is the cheapest win available, being the only part
//      of the opening stretch that is pure overhead rather than model work.
//   B. Where does the pacing fix go? A stage that exited AT ITS FLOOR was never
//      a wait — the pipeline beat the ceremony and there is nothing to fix. A
//      stage that ran materially PAST its floor was a real wait, and that is the
//      stage that needs motion which lasts.
//
// (B) is why raw duration is not the interesting number: stage 3 is almost
// entirely floor and felt fine. Each stage is classified FLOOR-bound (exited
// within TOLERANCE_MS of the floor the machine actually applied) or SERVER-bound
// (exited past it). The floors live in useCeremonyStageMachine (MIN_FLOOR_MS)
// and are PASSED IN at each exit rather than copied here — a second copy of the
// floors is the drift this classification would silently get wrong.
//
// THREE CONSTRAINTS, binding:
//
//   1. RECORD ONLY. Nothing may gate on a timestamp. Every export returns
//      undefined and mutates nothing outside this module. The moment a
//      measurement influences a transition, instrumentation has become
//      behavior.
//   2. IT MUST NOT BE ABLE TO THROW. Every export is wrapped by `safe()`. These
//      calls sit directly in the deploy path, so the guard is load-bearing, not
//      defensive: a timing bug can never break a deploy.
//   3. NO FEATURE FLAG. Console-only, no writes, no user-visible effect — a flag
//      plus the DARK_BY_DESIGN registry entry it would need (BUILD_RULES §2)
//      would be process for nothing, and this keeps paying on every future
//      preview deploy.
//
// STAGE COUNT IS NOT HARD-CODED. Rows are keyed by whatever index the machine
// hands us and rendered as S{i+1}, so if a fourth theater phase ever lands
// (`verifying`) it appears in the table and the summary with no change here.
//
// KNOWN LIMIT, stated on purpose: a run emits only at a TERMINAL phase — reveal
// or error. A ceremony the user DISMISSES mid-run emits nothing. The 90s
// watchdog resolves a genuine stall to an error, so the stall case IS captured;
// a manual back-out is not. Closing that needs a call site in DeployCeremony's
// onDismiss and was left out of this task's scope deliberately.

// A stage that exits within this much of its floor was gated by the CEREMONY,
// not by the server. The machine re-evaluates on a 100ms interval, so a purely
// floor-bound stage lands at floor + up to ~100ms of granularity; 150ms covers
// that without swallowing a real wait (the smallest floor is 2000ms).
const TOLERANCE_MS = 150;

// Same clock the stage machine measures its floors with, so a duration computed
// here and a floor check made there can never disagree about elapsed time.
const now = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

// The current run. Module-scoped because exactly one ceremony is on screen at a
// time; a retry calls startRun() again and replaces it.
let run = null;

function newRun(t) {
  return {
    startedAt: new Date().toISOString(),   // wall clock, for pasting into a thread
    t0: t,                                 // handleDeploy — the user's action
    firstTargetAt: null, firstTargetId: null,   // setDeployTarget #1 (ranked)
    cloneRequestAt: null,                       // ensure-casual-clone issued
    cloneResolvedAt: null, cloneId: null,       // setDeployTarget #2 (clone)
    cloneFallbackAt: null, cloneFallbackReason: null,
    postIssuedAt: null, postResolvedAt: null, postStatus: null,
    stages: [],                            // sparse by stage index
    endedAt: null, endKind: null,          // 'reveal' | 'error:<kind>'
    emitted: false,
  };
}

// ── formatting ─────────────────────────────────────────────────────────────
const secs = (ms) => (ms == null || !Number.isFinite(ms) ? '—' : `${(ms / 1000).toFixed(1)}s`);
const span = (a, b) => (a == null || b == null ? null : b - a);

// ── derivation ─────────────────────────────────────────────────────────────

// Measurement A. The clone outcome is DERIVED rather than reported, so the
// deploy path needs no extra call site for the branches it already has. On the
// fallback path setDeployTarget #2 never fires — that is a distinct OUTCOME
// here, never a null duration, because "the clone came back in 0.9s and was
// unusable" and "we never asked" are different answers to the pre-warm question.
function cloneOutcome(r) {
  if (r.cloneResolvedAt != null) return 'resolved';
  if (r.cloneFallbackAt != null) return 'fallback';
  if (r.cloneRequestAt != null) return 'incomplete';  // deploy died mid-round-trip
  if (r.postIssuedAt != null) return 'off';           // POST reached with no attempt → flag off
  return 'n/a';                                       // never got that far (e.g. no auth token)
}
const cloneMs = (r) => span(r.cloneRequestAt, r.cloneResolvedAt ?? r.cloneFallbackAt);

// A stage still open when the run ended is measured to the end of the run — the
// stall case, and the one most worth seeing.
const stageMs = (s, r) => span(s.enteredAt, s.exitedAt ?? r.endedAt);

// Measurement B. `floorMs` is what the machine ACTUALLY applied; `nominalFloorMs`
// is what MIN_FLOOR_MS says. They differ only when the user pressed skip, which
// zeroes the floors — that is neither a floor-bound stage nor a real wait, so it
// gets its own verdict rather than being scored as SERVER.
function classify(s, r) {
  if (s.exitedAt == null) return 'open';
  if (s.floorMs < s.nominalFloorMs) return 'skipped';
  const ms = stageMs(s, r);
  if (ms == null) return 'open';
  return ms - s.floorMs <= TOLERANCE_MS ? 'floor' : 'SERVER';
}

// ── output ─────────────────────────────────────────────────────────────────

// One copy-pasteable line. The format is load-bearing: console tables are
// unreadable on mobile and this has to survive being pasted into a design
// conversation, so the whole run fits on one line and SERVER is shouted.
//
//   CEREMONY 24.1s | clone 1.4s | S1 8.9s SERVER | S2 10.2s SERVER | S3 2.5s floor | S4 2.6s floor
function summaryLine(r) {
  const parts = [`CEREMONY ${secs(span(r.t0, r.endedAt))}${r.endKind && r.endKind !== 'reveal' ? ` ${r.endKind.toUpperCase()}` : ''}`];
  const outcome = cloneOutcome(r);
  const ms = cloneMs(r);
  parts.push(ms == null ? `clone ${outcome}` : `clone ${secs(ms)}${outcome === 'resolved' ? '' : ` ${outcome}`}`);
  r.stages.forEach((s, i) => { if (s) parts.push(`S${i + 1} ${secs(stageMs(s, r))} ${classify(s, r)}`); });
  return parts.join(' | ');
}

// The table carries what the line cannot: the pre-POST breakdown. `auth token`
// is split out on purpose — getIdToken sits BETWEEN the two setDeployTarget
// calls, so the raw gap between them is NOT the clone round trip, and answering
// the pre-warm question off that gap would credit pre-warming with time it
// cannot recover.
function tableRows(r) {
  const rows = [];
  const push = (phase, ms, verdict, detail) => rows.push({
    phase, ms: ms == null ? null : Math.round(ms), s: secs(ms), verdict: verdict || '', detail: detail || '',
  });
  push('deploy → target', span(r.t0, r.firstTargetAt), '', r.firstTargetId || '');
  push('auth token', span(r.firstTargetAt, r.cloneRequestAt), '', 'getIdToken');
  push('ensure-casual-clone', cloneMs(r), cloneOutcome(r), r.cloneId || r.cloneFallbackReason || '');
  push('POST decide', span(r.postIssuedAt, r.postResolvedAt), '', r.postStatus == null ? '' : `HTTP ${r.postStatus}`);
  r.stages.forEach((s, i) => {
    if (s) push(`S${i + 1}`, stageMs(s, r), classify(s, r), `floor ${s.floorMs}ms`);
  });
  push('TOTAL', span(r.t0, r.endedAt), r.endKind || '', r.startedAt);
  return rows;
}

// Stashed so the run survives past the log and can be read after the fact —
// same pattern as window.mcDebug (src/utils/debug.js).
function emit(r) {
  if (r.emitted) return;
  r.emitted = true;
  const payload = { ...r, summary: summaryLine(r), rows: tableRows(r) };
  if (typeof window !== 'undefined') window.__ceremonyTiming = payload;
  console.log(payload.summary);
  if (typeof console.table === 'function') console.table(payload.rows);
}

// ── the guard (constraint 2) ───────────────────────────────────────────────
// Every export goes through this. The reporting `console.warn` is itself
// wrapped: if the console is what threw, there is nothing left to say and the
// deploy still must not notice.
function safe(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (err) {
      try { console.warn('[CeremonyTiming] suppressed:', err?.message || err); } catch { /* nothing left to do */ }
    }
    return undefined;
  };
}

// ── call sites ─────────────────────────────────────────────────────────────

// handleDeploy — the moment the user's deploy began, and the t0 the "felt
// stalled" complaint is measured from.
export const startRun = safe(() => { run = newRun(now()); });

// agentDeploy's setDeployTarget seam — BOTH calls arrive here. #1 is the ranked
// agent (always), #2 is the resolved clone (clone path only).
export const markDeployTarget = safe((id) => {
  if (!run) return;
  if (run.firstTargetAt == null) { run.firstTargetAt = now(); run.firstTargetId = id ?? null; return; }
  run.cloneResolvedAt = now();
  run.cloneId = id ?? null;
});

export const markCloneRequest = safe(() => { if (run) run.cloneRequestAt = now(); });
export const markCloneFallback = safe((reason) => {
  if (!run || run.cloneFallbackAt != null) return;
  run.cloneFallbackAt = now();
  run.cloneFallbackReason = reason == null ? 'unknown' : String(reason);
});

export const markPostIssued = safe(() => { if (run) run.postIssuedAt = now(); });
export const markPostResolved = safe((status) => {
  if (!run) return;
  run.postResolvedAt = now();
  run.postStatus = status ?? null;
});

// Stage entry. Stage 0 is entered exactly once per MACHINE MOUNT, which makes it
// the re-base point:
//   - no run, or a run that already ended → this is a new ceremony, start one.
//     (Ordering makes the first case unreachable in the app — handleDeploy runs
//     before the overlay mounts — but a mount that outran startRun would
//     otherwise record into nothing and lose the run silently.)
//   - a live run → keep its t0, but DROP the stage rows: a retry remounts the
//     machine, and rows left by the previous instance would otherwise be
//     reported as this pass's, with durations measured across the two.
export const markStageEnter = safe((index) => {
  if (index === 0) {
    if (!run || run.endedAt != null) run = newRun(now());
    else run.stages = [];
  }
  if (!run) return;
  run.stages[index] = { enteredAt: now(), exitedAt: null, floorMs: 0, nominalFloorMs: 0 };
});

// Stage exit. `floorMs` is the floor the machine applied on this transition,
// `nominalFloorMs` the unskipped MIN_FLOOR_MS value — see classify().
export const markStageExit = safe((index, floorMs, nominalFloorMs) => {
  const s = run && run.stages[index];
  if (!s) return;
  s.exitedAt = now();
  s.floorMs = Number.isFinite(floorMs) ? floorMs : 0;
  s.nominalFloorMs = Number.isFinite(nominalFloorMs) ? nominalFloorMs : s.floorMs;
});

export const markReveal = safe(() => {
  if (!run) return;
  run.endedAt = now();
  run.endKind = 'reveal';
  emit(run);
});

// A ceremony that ERRORS is exactly the case the founder is complaining about
// (the watchdog resolves a genuine stall here), so it emits too — labelled.
export const markError = safe((kind) => {
  if (!run || run.endedAt != null) return;
  run.endedAt = now();
  run.endKind = `error:${kind || 'unknown'}`;
  emit(run);
});
