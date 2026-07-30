// api/_utils/wireEditorialRun.js
// FantasyTimes Wire — the N3 weekly editorial run (Spec V1.2 N3.1–N3.6;
// V1.3 D-P2-12/D-P2-15, Amendments E/F; V1.5 R4-M5; Calibration Addendum
// §§4–5 FINAL LOCK).
//
// STORE (D-P2-15, flat): wireEditorial/{isoWeek} = { isoWeek,
// scheduledSlotDate, canonicalRunId, runs: { [runId]: … }, updatedAt }.
// Runs are IMMUTABLE once terminal: creating an existing runId is rejected,
// completing a terminal run is rejected — the only legal transition is
// pending_judge → one terminal status. Cap 5 runs/week; pruning removes
// failed/insufficient first and NEVER the canonical run. canonicalRunId is
// set by the first run to reach 'complete' and never changes.
//
// LIFECYCLE:
//   ensureEditorialRun (host entry, Sundays):
//     canonical set            → done (no-op)
//     a pending_judge run      → RESUME: replay its persisted manifest
//                                (P2-9 — never re-derive from the frame)
//     else                     → derive frame → sample → persist manifest
//                                TRANSACTIONALLY (F-M8: before any model
//                                call) → execute
//   execute: fetch stories + generating-day buckets → adapters → epoch
//   homogeneity → judge (budget-aware; wireModelCall transport) →
//   hallucination-checked advisory flags → audit rows → aggregates
//   (recompute-verified, P2-12) → N3.4 verdict → memo → complete.
//   Budget exhaustion mid-judge leaves the run PENDING (resumable next
//   tick); a judge/API failure terminates it 'failed' with NO partial memo
//   (P2-17) and a later tick starts a fresh runId (cap permitting).
//
// AMENDMENT F (P2-34): {scheduledSlotDate, isoWeek} persist on the week doc
// at first attempt; every later write keys off the CAPTURED isoWeek — a
// retry racing past UTC Sunday midnight files under the original week
// because nothing downstream ever re-derives the week from `now`.
//
// AUDIT ROWS (N3.5): one structured row per sampled story — operands
// COPIED (a memo must outlive the Wire's 30-day retention), bounded prose
// excerpts, per-basis calculations, dimension verdicts incl. advisory,
// failure codes. Aggregates are recomputed from rows and verified before
// the run is written; the memo renders from rows and aggregates only.

import {
  WIRE_COLLECTION,
  WIRE_EDITORIAL_COLLECTION,
  WIRE_EDITORIAL_REVIEW_VERSION,
  WIRE_EDITORIAL_ADAPTER_VERSION,
} from './wireContracts.js';
import {
  isoWeekOf,
  editorialSessionsFor,
  deriveEditorialFrame,
  sampleEditorialFrame,
  buildEditorialManifest,
} from './wireEditorialSampling.js';
import { adaptStory, consensusJoinDate, EDITORIAL_VERDICTS } from './wireEditorialAdapters.js';
import { runJudgePass, EditorialBudgetExceeded } from './wireEditorialJudge.js';

const LOG_PREFIX = '[WireEditorial]';
export const EDITORIAL_RUN_CAP = 5;
export const EDITORIAL_MIN_BUDGET_MS = 20_000;
export const EDITORIAL_DERIVATION_THRESHOLD = 0.05; // §4: 5% over VERIFIED
export const EDITORIAL_FLOOR_VERIFIED = 5;          // §5: ≥5 VERIFIED stories
export const EDITORIAL_FLOOR_SHAPES = 2;            // §5: ≥2 contributing shapes

const { VERIFIED_CORRECT, VERIFIED_WRONG } = EDITORIAL_VERDICTS;

const TERMINAL_STATUSES = Object.freeze(['complete', 'failed', 'insufficient']);
const HEADLINE_EXCERPT_CAP = 120;

// ── Store operations (D-P2-15; P2-13/P2-37) ───────────────────────────────

const weekRef = (db, isoWeek) => db.collection(WIRE_EDITORIAL_COLLECTION).doc(isoWeek);

function nextRunId(runs) {
  const max = Object.keys(runs)
    .map((id) => Number((id.match(/^run-(\d{3})$/) || [])[1] || 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `run-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Transactionally create a new run carrying its manifest (F-M8: the
 * manifest is durable BEFORE any model call). Enforces the cap-5 /
 * prune-failed-first / never-prune-canonical / never-overwrite rules.
 */
export async function createEditorialRun(db, { isoWeek, slotDate, manifest, status = 'pending_judge', now = new Date() }) {
  return db.runTransaction(async (t) => {
    const snap = await t.get(weekRef(db, isoWeek));
    const doc = snap.exists ? snap.data() : {
      isoWeek,
      scheduledSlotDate: slotDate, // Amendment F: captured once, never re-derived
      canonicalRunId: null,
      runs: {},
    };
    if (doc.canonicalRunId) return { created: false, reason: 'canonical_exists' };

    const runs = { ...doc.runs };
    if (Object.keys(runs).length >= EDITORIAL_RUN_CAP) {
      // Prune failed/insufficient first (oldest first); canonical protected
      // by construction (a canonical run is 'complete', which never prunes).
      const prunable = Object.values(runs)
        .filter((r) => (r.status === 'failed' || r.status === 'insufficient') && r.runId !== doc.canonicalRunId)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      if (prunable.length === 0) return { created: false, reason: 'run_cap_exhausted' };
      delete runs[prunable[0].runId];
    }

    const runId = nextRunId(runs);
    if (runs[runId]) return { created: false, reason: 'run_exists' }; // immutability belt
    runs[runId] = {
      runId,
      status,
      createdAt: now.toISOString(),
      scheduledSlotDate: doc.scheduledSlotDate,
      reviewVersion: WIRE_EDITORIAL_REVIEW_VERSION,
      adapterVersion: WIRE_EDITORIAL_ADAPTER_VERSION,
      manifest,
      ...(status === 'insufficient'
        ? { completedAt: now.toISOString(), failure: { code: 'sampling_insufficient', detail: manifest.samplingReason } }
        : {}),
    };
    t.set(weekRef(db, isoWeek), { ...doc, runs, updatedAt: now.toISOString() });
    return { created: true, runId };
  });
}

/**
 * Transactionally complete a pending run. Terminal runs are immutable —
 * a second completion (or any write to an already-terminal run) is
 * rejected (P2-13/P2-37). The first 'complete' run becomes canonical.
 */
export async function completeEditorialRun(db, { isoWeek, runId, patch, now = new Date() }) {
  return db.runTransaction(async (t) => {
    const snap = await t.get(weekRef(db, isoWeek));
    if (!snap.exists) return { completed: false, reason: 'week_missing' };
    const doc = snap.data();
    const run = doc.runs?.[runId];
    if (!run) return { completed: false, reason: 'run_missing' };
    if (TERMINAL_STATUSES.includes(run.status)) return { completed: false, reason: 'immutable_run' };
    if (!TERMINAL_STATUSES.includes(patch.status)) return { completed: false, reason: 'not_terminal' };

    const runs = { ...doc.runs, [runId]: { ...run, ...patch, completedAt: now.toISOString() } };
    const canonicalRunId = doc.canonicalRunId ?? (patch.status === 'complete' ? runId : null);
    t.set(weekRef(db, isoWeek), { ...doc, runs, canonicalRunId, updatedAt: now.toISOString() });
    return { completed: true, canonical: canonicalRunId === runId };
  });
}

// ── Epoch homogeneity (P2-14 / F-M3) ───────────────────────────────────────

/** The per-entry gateEpoch tuple: every epoch axis a sampled entry carries.
 *  Run-level axes (adapterVersion, reviewVersion, judgeModelId) are
 *  constants WITHIN a run — un-injectable as mixed inputs, recorded as the
 *  P2-14 known holes in the test file. */
export function entryEpochOf(entry) {
  return JSON.stringify({
    generationVersion: entry?.generationConfig?.generationVersion ?? null,
    continuityEnabled: entry?.generationConfig?.continuityEnabled ?? null,
    schemaVersion: entry?.agentFacts?.schemaVersion ?? null,
    digestRendererVersion: entry?.agentFacts?.digestRendererVersion ?? null,
    validatorVersion: entry?.agentFacts?.validatorVersion ?? null,
  });
}

export function assessEpochHomogeneity(entries) {
  const distinct = [...new Set(entries.map(entryEpochOf))];
  return {
    homogeneous: distinct.length <= 1,
    epochs: distinct.map((s) => JSON.parse(s)),
  };
}

// ── Aggregates (P2-12: recomputable from rows, verified before write) ─────

export function computeEditorialAggregates(rows) {
  const verified = rows.filter((r) => r.storyVerdict === VERIFIED_CORRECT || r.storyVerdict === VERIFIED_WRONG);
  const wrong = verified.filter((r) => r.storyVerdict === VERIFIED_WRONG);
  const perReporter = {};
  for (const row of rows) {
    const s = (perReporter[row.reporter] ??= { sampled: 0, verified: 0, wrong: 0, notVerifiable: 0, advisoryFlags: 0 });
    s.sampled += 1;
    if (row.storyVerdict === VERIFIED_CORRECT || row.storyVerdict === VERIFIED_WRONG) s.verified += 1;
    if (row.storyVerdict === VERIFIED_WRONG) s.wrong += 1;
    if (row.storyVerdict === EDITORIAL_VERDICTS.NOT_VERIFIABLE) s.notVerifiable += 1;
    s.advisoryFlags += (row.advisoryFlags || []).length;
  }
  const nvReasons = {};
  for (const row of rows) {
    for (const reason of row.notVerifiableReasons || []) nvReasons[reason] = (nvReasons[reason] || 0) + 1;
  }
  return {
    sampled: rows.length,
    verifiedCount: verified.length,
    verifiedWrong: wrong.length,
    verifiedCorrect: verified.length - wrong.length,
    derivationErrorRate: verified.length > 0 ? wrong.length / verified.length : null,
    unverifiableCount: rows.length - verified.length,
    contributingShapes: [...new Set(verified.map((r) => r.shape))].sort(),
    criticalContradictions: rows.filter((r) => (r.criticalCodes || []).length > 0).length,
    wrongSubjectIndexMove: rows.filter((r) => (r.criticalCodes || []).includes('wrong_subject_index_move')).length,
    advisoryFlagCount: rows.reduce((n, r) => n + (r.advisoryFlags || []).length, 0),
    judgeDiscardedFlags: rows.reduce((n, r) => n + (r.judgeDiscardedFlags || 0), 0),
    perReporter,
    notVerifiableByReason: nvReasons,
  };
}

/** P2-12: every aggregate must be recomputable from the audit rows. */
export function verifyEditorialAggregates(run) {
  const recomputed = computeEditorialAggregates(run.auditRows || []);
  const stored = run.aggregates || {};
  const mismatches = [];
  for (const key of Object.keys(recomputed)) {
    if (JSON.stringify(recomputed[key]) !== JSON.stringify(stored[key])) mismatches.push(key);
  }
  return { ok: mismatches.length === 0, mismatches };
}

// ── The N3.4 verdict (pass rule fixed before implementation) ──────────────

export function computeEditorialVerdict({ aggregates, manifest, judgeComplete, epoch }) {
  const floor = {
    verifiedCount: aggregates.verifiedCount,
    requiredVerified: EDITORIAL_FLOOR_VERIFIED,
    contributingShapes: aggregates.contributingShapes.length,
    requiredShapes: EDITORIAL_FLOOR_SHAPES,
    met: aggregates.verifiedCount >= EDITORIAL_FLOOR_VERIFIED
      && aggregates.contributingShapes.length >= EDITORIAL_FLOOR_SHAPES,
  };
  const coverage = manifest.samplingStatus === 'ok';
  const gateEligible = floor.met && judgeComplete && epoch.homogeneous && coverage;
  const passed = gateEligible
    && aggregates.criticalContradictions === 0
    && aggregates.wrongSubjectIndexMove === 0
    && aggregates.derivationErrorRate !== null
    && aggregates.derivationErrorRate < EDITORIAL_DERIVATION_THRESHOLD;
  return {
    passed,
    gateEligible,
    floor,
    coverage,
    judgeComplete,
    epochHomogeneous: epoch.homogeneous,
    threshold: EDITORIAL_DERIVATION_THRESHOLD,
    derivationErrorRate: aggregates.derivationErrorRate,
    failureClauses: [
      ...(!floor.met ? ['floor'] : []),
      ...(!coverage ? ['coverage'] : []),
      ...(!judgeComplete ? ['judge_incomplete'] : []),
      ...(!epoch.homogeneous ? ['epoch_mixed'] : []),
      ...(aggregates.criticalContradictions > 0 ? ['critical_contradictions'] : []),
      ...(aggregates.wrongSubjectIndexMove > 0 ? ['wrong_subject_index_move'] : []),
      ...(aggregates.derivationErrorRate !== null && aggregates.derivationErrorRate >= EDITORIAL_DERIVATION_THRESHOLD ? ['derivation_rate'] : []),
    ],
  };
}

// ── Memo (rendered from rows + aggregates ONLY) ───────────────────────────

export function renderEditorialMemo(run) {
  const a = run.aggregates;
  const v = run.verdict;
  const lines = [
    `WIRE EDITORIAL — ${run.manifest.seed.isoWeek} · ${run.runId} · ${v.passed ? 'PASS' : 'FAIL'} (gateEligible: ${v.gateEligible})`,
    `Sampled ${a.sampled} · VERIFIED ${a.verifiedCount} (${a.verifiedCorrect} correct / ${a.verifiedWrong} wrong) · unverifiable ${a.unverifiableCount}`,
    `Derivation error: ${a.derivationErrorRate === null ? 'n/a (zero verified)' : (a.derivationErrorRate * 100).toFixed(1) + '%'} vs threshold ${(v.threshold * 100).toFixed(0)}% · shapes: ${a.contributingShapes.join(', ') || 'none'}`,
    `Floor: ${v.floor.verifiedCount}/${v.floor.requiredVerified} verified, ${v.floor.contributingShapes}/${v.floor.requiredShapes} shapes → ${v.floor.met ? 'met' : 'NOT MET'}`,
    `Critical contradictions: ${a.criticalContradictions} · wrong-subject index_move: ${a.wrongSubjectIndexMove} · advisory flags: ${a.advisoryFlagCount} (judge errors discarded: ${a.judgeDiscardedFlags})`,
    ...(v.failureClauses.length ? [`Failure clauses: ${v.failureClauses.join(', ')}`] : []),
    'Per reporter:',
    ...Object.entries(a.perReporter).map(([rep, s]) =>
      `  ${rep}: sampled ${s.sampled} · verified ${s.verified} · wrong ${s.wrong} · unverifiable ${s.notVerifiable} (${s.sampled > 0 ? Math.round((s.notVerifiable / s.sampled) * 100) : 0}%) · advisory ${s.advisoryFlags}`),
  ];
  return lines.join('\n');
}

// ── Execution ──────────────────────────────────────────────────────────────

async function fetchSampleContext(db, manifest) {
  const sample = manifest.sample;
  const dates = [...new Set(sample.map((s) => s.marketDate))];
  const daySnaps = await Promise.all(dates.map((d) => db.collection(WIRE_COLLECTION).doc(d).get()));
  const entriesByStory = new Map();
  daySnaps.forEach((snap) => {
    if (!snap.exists) return;
    for (const entry of snap.data().entries || []) entriesByStory.set(entry.storyId, entry);
  });

  const storySnaps = await Promise.all(sample.map((s) => db.collection('fantasyTimesStories').doc(s.storyId).get()));
  const stories = new Map();
  storySnaps.forEach((snap, i) => stories.set(sample[i].storyId, snap.exists ? snap.data() : null));

  // Generating-day consensus buckets — the writers' UTC join key (P2-40).
  const bucketDates = [...new Set(sample
    .map((s) => consensusJoinDate(entriesByStory.get(s.storyId)?.publishedAt ?? s.publishedAt))
    .filter(Boolean))];
  const bucketSnaps = await Promise.all(bucketDates.map((d) => db.collection('fantasyTimesConsensus').doc(d).get()));
  const buckets = new Map();
  bucketSnaps.forEach((snap, i) => buckets.set(bucketDates[i], snap.exists ? snap.data() : null));

  return { entriesByStory, stories, buckets };
}

export async function executeEditorialRun(db, { isoWeek, runId, manifest, now = new Date(), deadline, callModel }) {
  if (manifest.seed.isoWeek !== isoWeek) {
    // Amendment F belt: the persisted manifest IS the week of record.
    throw new Error(`${LOG_PREFIX} manifest week ${manifest.seed.isoWeek} != run week ${isoWeek}`);
  }
  const { entriesByStory, stories, buckets } = await fetchSampleContext(db, manifest);

  // Adapters + rows (deterministic half).
  const judged = [];
  const rows = manifest.sample.map((item) => {
    const entry = entriesByStory.get(item.storyId) ?? null;
    const storyDoc = stories.get(item.storyId) ?? null;
    const bucketDate = consensusJoinDate(entry?.publishedAt ?? item.publishedAt);
    const adapted = adaptStory({ entry, storyDoc, bucket: bucketDate ? buckets.get(bucketDate) ?? null : null });
    judged.push({ sampleItem: item, storyDoc, entry });
    return {
      storyId: item.storyId,
      reporter: item.reporter,
      eventType: item.eventType,
      marketDate: item.marketDate,
      consensusBucketDate: bucketDate,
      headlineExcerpt: String(storyDoc?.headline ?? '').slice(0, HEADLINE_EXCERPT_CAP),
      shape: adapted.shape,
      adapterVersion: adapted.adapterVersion,
      results: adapted.results,
      storyVerdict: adapted.storyVerdict,
      criticalCodes: adapted.criticalCodes,
      notVerifiableReasons: adapted.notVerifiableReasons,
      advisoryFlags: [],
      judgeDiscardedFlags: 0,
    };
  });

  const epoch = assessEpochHomogeneity(manifest.sample.map((s) => entriesByStory.get(s.storyId)).filter(Boolean));

  // Advisory judge (M13). Budget exhaustion propagates (run stays pending).
  const judge = await runJudgePass(judged, { deadline, callModel });
  const flagsById = judge.reviewsByStoryId;
  const discardedById = new Map();
  for (const d of judge.discardedFlags) discardedById.set(d.storyId, (discardedById.get(d.storyId) || 0) + 1);
  for (const row of rows) {
    row.advisoryFlags = flagsById.get(row.storyId) ?? [];
    row.judgeDiscardedFlags = discardedById.get(row.storyId) ?? 0;
  }

  const aggregates = computeEditorialAggregates(rows);
  const verdict = computeEditorialVerdict({ aggregates, manifest, judgeComplete: judge.complete, epoch });

  const runShape = {
    auditRows: rows,
    aggregates,
    verdict,
    gateEpoch: epoch.homogeneous ? (epoch.epochs[0] ?? null) : { mixed: true, epochs: epoch.epochs },
    judge: {
      complete: judge.complete,
      incompleteReason: judge.incompleteReason,
      judgeModelId: judge.judgeModelId,
      chunks: judge.chunks,
      discardedFlags: judge.discardedFlags,
    },
    frameFingerprintAtRun: manifest.frameFingerprint,
  };
  const memo = renderEditorialMemo({ runId, manifest, aggregates, verdict });

  const integrity = verifyEditorialAggregates({ auditRows: rows, aggregates });
  if (!integrity.ok) {
    // Cannot happen by construction (same pure function) — belt against a
    // future divergence; a run whose aggregates don't recompute is FAILED.
    return completeEditorialRun(db, {
      isoWeek, runId, now,
      patch: { status: 'failed', failure: { code: 'aggregate_mismatch', detail: integrity.mismatches } },
    }).then(() => ({ status: 'failed', reason: 'aggregate_mismatch' }));
  }

  await completeEditorialRun(db, {
    isoWeek, runId, now,
    patch: { status: 'complete', ...runShape, memo },
  });
  return { status: 'complete', runId, passed: verdict.passed, gateEligible: verdict.gateEligible };
}

// ── Host entry (D-P2-12: exported, Sunday+flag gated BY THE HOST) ─────────

/**
 * One Sunday-tick attempt. The HOST gates on flag + UTC-Sunday + remaining
 * budget (R4-M5: editorial runs LAST and may never consume the sweep's
 * floor); this function owns slot capture, run lifecycle, and resume.
 */
export async function runEditorialReview(db, { now = new Date(), deadline, callModel } = {}) {
  const slotDate = now.toISOString().slice(0, 10);
  // Amendment F: the week doc's CAPTURED scheduledSlotDate wins over `now`
  // on any retry; first attempt captures today's slot.
  const todaysWeek = isoWeekOf(slotDate);
  const existing = await weekRef(db, todaysWeek).get();
  const doc = existing.exists ? existing.data() : null;
  const isoWeek = doc?.isoWeek ?? todaysWeek;
  const effectiveSlotDate = doc?.scheduledSlotDate ?? slotDate;

  const resumePending = async (week, pending) => {
    try {
      const result = await executeEditorialRun(db, {
        isoWeek: week, runId: pending.runId, manifest: pending.manifest, now, deadline, callModel,
      });
      return { action: 'resumed', isoWeek: week, ...result };
    } catch (err) {
      if (err instanceof EditorialBudgetExceeded) {
        return { action: 'deferred_mid_run', isoWeek: week, runId: pending.runId, reason: err.code };
      }
      await completeEditorialRun(db, {
        isoWeek: week, runId: pending.runId, now,
        patch: { status: 'failed', failure: { code: 'judge_error', detail: String(err?.message || err) } },
      });
      return { action: 'failed', isoWeek: week, runId: pending.runId, error: String(err?.message || err) };
    }
  };

  // Amendment F (P2-34): a run whose Sunday budget ran out resumes under
  // its ORIGINAL week even when found from a later slot — the PREVIOUS ISO
  // week's pending run takes priority over starting this week's, and every
  // downstream write keys off the CAPTURED isoWeek, never `now`.
  const prevWeekDate = new Date(new Date(`${slotDate}T00:00:00Z`).getTime() - 7 * 86_400_000)
    .toISOString().slice(0, 10);
  const prevWeek = isoWeekOf(prevWeekDate);
  if (prevWeek !== isoWeek) {
    const prevSnap = await weekRef(db, prevWeek).get();
    const prevDoc = prevSnap.exists ? prevSnap.data() : null;
    const prevPending = Object.values(prevDoc?.runs ?? {}).find((r) => r.status === 'pending_judge');
    if (prevPending && !prevDoc?.canonicalRunId) {
      return resumePending(prevWeek, prevPending);
    }
  }

  if (doc?.canonicalRunId) return { action: 'done', isoWeek, canonicalRunId: doc.canonicalRunId };

  // Resume this week's pending run from its persisted manifest (P2-9).
  const pending = Object.values(doc?.runs ?? {}).find((r) => r.status === 'pending_judge');
  if (pending) return resumePending(isoWeek, pending);

  // Fresh run: frame → sample → manifest persisted BEFORE any model call.
  const sessions = editorialSessionsFor(effectiveSlotDate);
  const daySnaps = await Promise.all(sessions.map((d) => db.collection(WIRE_COLLECTION).doc(d).get()));
  const days = new Map();
  daySnaps.forEach((snap, i) => { if (snap.exists) days.set(sessions[i], snap.data()); });
  const frame = deriveEditorialFrame(days, sessions);
  const sampling = sampleEditorialFrame(frame, { isoWeek });
  const manifest = buildEditorialManifest(frame, sampling, { isoWeek });

  if (sampling.status === 'insufficient') {
    const created = await createEditorialRun(db, { isoWeek, slotDate: effectiveSlotDate, manifest, status: 'insufficient', now });
    return { action: 'insufficient', isoWeek, ...created, reason: sampling.reason };
  }

  const created = await createEditorialRun(db, { isoWeek, slotDate: effectiveSlotDate, manifest, now });
  if (!created.created) return { action: 'skipped', isoWeek, reason: created.reason };

  try {
    const result = await executeEditorialRun(db, {
      isoWeek, runId: created.runId, manifest, now, deadline, callModel,
    });
    return { action: 'ran', isoWeek, ...result };
  } catch (err) {
    if (err instanceof EditorialBudgetExceeded) {
      // Manifest persisted; the run resumes on a later tick (P2-9).
      return { action: 'deferred_mid_run', isoWeek, runId: created.runId, reason: err.code };
    }
    await completeEditorialRun(db, {
      isoWeek, runId: created.runId, now,
      patch: { status: 'failed', failure: { code: 'judge_error', detail: String(err?.message || err) } },
    });
    return { action: 'failed', isoWeek, runId: created.runId, error: String(err?.message || err) };
  }
}
