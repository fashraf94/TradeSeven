// api/_utils/huddle/job.js
//
// Huddle S1 — ONE PLAYER'S JOB (spec V1.1 §5.3 "Per job"; Amendments A §A2, §A7; B §B4;
// C §C10, §C12). Claimed by the worker; every step is idempotent per (uid, etDate,
// claimGeneration) and a stale generation never publishes:
//   mark `generating` (owned) → gather → script (one regeneration) → validate and render
//   (the plan validated against the closed templates; the plan beat narrated by CODE) →
//   speech with timestamps → store (the generation in the GCS path) → publish AND done in
//   one owned transaction, which re-reads the record and aborts if it is already `ready`
//   or its plan already `confirmed` / `skipped` (immutability, A §A2).
// Every outbound request carries the job's AbortSignal, tied to its deadline (AR-10).
// Speech or storage that fails publishes the huddle transcript-only with the reason; a
// script failure fails the attempt (retried up to the cap).

import { huddleDayRef, RECORD_STATUS, PLAN_STATUS } from './records.js';
import { withOwnedClaim, markAttemptFailed } from './queue.js';
import { gatherForPlayer } from './gather.js';
import { buildPlanAtGeneration } from './planRecord.js';
import { narratePlan } from './planTemplates.js';
import { eventLabelsOf } from './confirmPlan.js';
import {
  SYSTEM_PROMPT, buildUserPrompt, callScriptModel, validateScript, scriptClean, regenerationNoteOf, proposalOf, HUDDLE_SCRIPT_MODEL, MODEL_BEATS,
} from './scriptPrompt.js';
import { joinBeats, beatTimings, synthesizeWithTimestamps, alignmentDurationMs } from './speech.js';
import { storeHuddleAudio } from './audioStore.js';
import { archetypeWordsOf } from './archetypeWords.js';

export const JOB_BUDGET_MS = 120_000;
const BEAT_TITLE = Object.freeze({ yesterday: "Yesterday's plan", tape: 'The tape', names: 'Your names', armor: "The armor's take", plan: 'The game plan' });
/** The archetype's name and one-line disposition (archetypeWords.js, shared with the confirm route's preview). */
export { archetypeWordsOf };
const WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' });

const iso = (ms) => new Date(ms).toISOString();
const sentenceText = (beat) => (beat?.sentences || []).map((s) => s.text).filter(Boolean).join(' ');

/** The beats as published (pure): model beats that passed, in order, then the code-narrated plan beat. */
export function assembleBeats({ validated, dropped, planText }) {
  const out = [];
  for (const id of MODEL_BEATS) {
    if (dropped.has(id)) continue;
    const beat = validated.beats[id];
    if (!beat || !(beat.sentences || []).length) continue;
    out.push({ id, text: sentenceText(beat), source: 'model', sentences: beat.sentences.map((s) => ({ text: s.text, evidenceIds: s.evidenceIds || [] })) });
  }
  out.push({ id: 'plan', text: planText, source: 'code', sentences: [{ text: planText, evidenceIds: [] }] });
  return out;
}

/** The transcript: beat labels, and each sentence marked with its sources (A §A7). */
export function transcriptOf(beats, evidence) {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return beats.map((b) => `${BEAT_TITLE[b.id]}\n${b.sentences.map((s) => {
    const labels = [...new Set((s.evidenceIds || []).map((id) => byId.get(id)?.source?.label).filter(Boolean))];
    return labels.length ? `${s.text} [${labels.join('; ')}]` : s.text;
  }).join(' ')}`).join('\n\n');
}

/** Text cards (S1: text only): one per beat, one per name. */
export function cardsOf(beats, names) {
  const cards = beats.map((b) => ({ beatId: b.id, kind: 'text', title: BEAT_TITLE[b.id], lines: b.sentences.map((s) => s.text), evidenceIds: [...new Set(b.sentences.flatMap((s) => s.evidenceIds || []))] }));
  for (const n of names) cards.push({ beatId: 'names', kind: 'text', title: n.ticker, lines: n.read ? [n.read] : [], evidenceIds: n.evidenceIds });
  return cards;
}

/**
 * @returns {Promise<{ outcome: 'published'|'already_ready'|'stale_generation'|'failed', reason?: string, timings?: object }>}
 */
export async function runHuddleJob(db, { uid, etDate, generation, session, shared, invocationDeadlineMs, deps = {}, clock = () => Date.now() }) {
  const t0 = clock();
  const deadline = Math.min(t0 + JOB_BUDGET_MS, invocationDeadlineMs ?? Infinity);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - t0));
  const signal = controller.signal;
  const timings = {};
  const fail = async (reason) => {
    await markAttemptFailed(db, { uid, etDate, generation, reason, nowMs: clock });
    return { outcome: 'failed', reason, timings };
  };
  try {
    // ---- mark generating (owned; never over a ready record) ----
    const marked = await withOwnedClaim(db, { uid, etDate, generation, nowMs: clock, label: 'generating' }, async (tx) => {
      const dayRef = huddleDayRef(db, uid, etDate);
      const snap = await tx.get(dayRef);
      if (snap.exists && snap.data()?.status === RECORD_STATUS.READY) return 'ready';
      tx.set(dayRef, { uid, etDate, status: RECORD_STATUS.GENERATING, session, generation: { claimGeneration: generation, startedAt: iso(t0) }, updatedAt: iso(t0) }, { merge: true });
      return 'generating';
    });
    if (marked.outcome === 'stale_generation') return { outcome: 'stale_generation' };
    if (marked.value === 'ready') return { outcome: 'already_ready' };

    // ---- gather ----
    let t = clock();
    const gathered = await (deps.gatherForPlayer || gatherForPlayer)(db, { uid, etDate, session, shared, owner: `${uid}#${generation}`, signal, nowMs: t, deps: deps.gatherDeps });
    timings.gatherMs = clock() - t;

    // ---- script: one call, one regeneration ----
    t = clock();
    const [label, disposition] = archetypeWordsOf(gathered.archetype);
    const weekday = WEEKDAY.format(new Date(session.openMs ?? t));
    const call = deps.callScriptModel || callScriptModel;
    const userPrompt = (note) => buildUserPrompt({ etDate, weekday, gathered, archetypeLabel: label, archetypeDisposition: disposition, regenerationNote: note });
    const usage = [];
    let answer = await call({ system: SYSTEM_PROMPT, user: userPrompt(null), signal });
    if (answer.usage) usage.push(answer.usage);
    if (!answer.ok) return await fail(`script_${answer.reason}`);
    let validated = validateScript(answer.output, { universe: gathered.universe, evidence: gathered.evidence, exposureLeaders: gathered.exposureLeaders ?? [] });
    let regenerated = false;
    // the first answer's failures, kept on the record (Amendment E: the regeneration rate and its causes are the smoke's question)
    let regeneratedFor = null;
    if (!scriptClean(validated)) {
      regenerated = true;
      regeneratedFor = regenerationNoteOf(validated).slice(0, 400);
      const second = await call({ system: SYSTEM_PROMPT, user: userPrompt(regenerationNoteOf(validated)), signal });
      if (second.usage) usage.push(second.usage);
      if (!second.ok) return await fail(`script_${second.reason}`);
      answer = second;
      validated = validateScript(answer.output, { universe: gathered.universe, evidence: gathered.evidence, exposureLeaders: gathered.exposureLeaders ?? [] });
      if (validated.tickerFailures.length > 0) return await fail(`ticker_outside_universe:${validated.tickerFailures.join(',')}`.slice(0, 200));
    }
    const dropped = new Set(Object.entries(validated.beatFailures).filter(([, f]) => f.length > 0).map(([id]) => id));
    const drops = [
      ...[...dropped].map((id) => ({ stage: 'script', beat: id, reasons: validated.beatFailures[id] })),
      ...Object.entries(validated.nameFailures || {}).map(([ticker, reasons]) => ({ stage: 'script', name: ticker, reasons })),
    ];
    timings.scriptMs = clock() - t;

    // ---- the plan: templates only; its beat narrated by code ----
    const { plan, drops: planDrops } = buildPlanAtGeneration({ proposal: proposalOf(answer.output), universe: gathered.universe, closes: gathered.closes, events: gathered.events, archetype: gathered.archetype, window: gathered.window ?? null });
    const planText = narratePlan(plan.current, { eventLabels: eventLabelsOf({ plan }) });
    const beats = assembleBeats({ validated, dropped, planText });

    // ---- speech and store (transcript-only on failure, the reason recorded) ----
    t = clock();
    const sourceFailures = [...gathered.sourceFailures];
    const { text: spoken, spans } = joinBeats(beats);
    let audio = null;
    const speech = await (deps.synthesize || synthesizeWithTimestamps)({ text: spoken, signal });
    timings.speechMs = clock() - t;
    if (speech.ok) {
      const timed = beatTimings(spans, speech.alignment, spoken);
      if (timed) for (const tm of timed) Object.assign(beats.find((b) => b.id === tm.id), { startMs: tm.startMs, endMs: tm.endMs });
      // The duration is the alignment's last end time when it is a positive number, else unknown (null, never 0), and it is
      // read before storage, so a malformed alignment cannot throw after the upload (review L1-2).
      const durationMs = alignmentDurationMs(speech.alignment);
      t = clock();
      try {
        const stored = await (deps.storeHuddleAudio || storeHuddleAudio)({ uid, etDate, claimGeneration: generation, mp3: speech.mp3, alignment: speech.alignment });
        audio = { ...stored, durationMs, voiceId: speech.voiceId, model: 'eleven_multilingual_v2', timed: !!timed };
      } catch (err) {
        sourceFailures.push(`storage:${err?.message === 'storage_unavailable' ? 'unavailable' : 'error'}`);
      }
      timings.storeMs = clock() - t;
    } else {
      sourceFailures.push(`speech:${speech.reason}`);
    }

    // ---- publish and done, one owned transaction (immutability re-checked) ----
    timings.totalMs = clock() - t0;
    const record = {
      uid, etDate, status: RECORD_STATUS.READY, session,
      generation: {
        claimGeneration: generation, startedAt: iso(t0), finishedAt: iso(clock()), model: HUDDLE_SCRIPT_MODEL, tokenUsage: usage,
        regenerated, regeneratedFor, sourceFailures: [...new Set(sourceFailures)], sourcesSkipped: gathered.sourcesSkipped ?? [], drops: [...drops, ...planDrops], timings,
      },
      script: { beats: beats.map((b) => ({ id: b.id, text: b.text, source: b.source, startMs: b.startMs ?? null, endMs: b.endMs ?? null, sentences: b.sentences })) },
      transcript: transcriptOf(beats, gathered.evidence),
      audio,
      names: validated.names.map((n) => ({ ticker: n.ticker, source: gathered.names.find((g) => g.ticker === n.ticker)?.source ?? null, read: n.read, evidenceIds: n.evidenceIds })),
      evidence: gathered.evidence,
      events: { strip: gathered.events.strip.map((e) => ({ eventId: e.eventId, label: e.label, source: e.source, timed: e.timed })), ...gathered.eventsListed },
      cards: cardsOf(beats, validated.names),
      plan,
      measurement: { editCount: 0 },
      grade: null,
      updatedAt: iso(clock()),
    };
    const published = await withOwnedClaim(db, { uid, etDate, generation, nowMs: clock, label: 'publish' }, async (tx, row, rowRef) => {
      const dayRef = huddleDayRef(db, uid, etDate);
      const snap = await tx.get(dayRef);
      const current = snap.exists ? snap.data() : null;
      const now = iso(clock());
      if (current?.status === RECORD_STATUS.READY || [PLAN_STATUS.CONFIRMED, PLAN_STATUS.SKIPPED].includes(current?.plan?.status)) {
        tx.update(rowRef, { status: 'done', claimGeneration: generation + 1, leaseUntil: null, updatedAt: now });
        return 'immutable';
      }
      tx.set(dayRef, { ...record, createdAt: current?.createdAt ?? now });
      // reconcile: the worker's reconcile pass expires the plan at the close if nobody answers it (review L2-6)
      tx.update(rowRef, { status: 'done', claimGeneration: generation + 1, leaseUntil: null, reconcile: true, updatedAt: now });
      return 'published';
    });
    if (published.outcome === 'stale_generation') return { outcome: 'stale_generation', timings };
    return { outcome: published.value === 'published' ? 'published' : 'already_ready', timings };
  } catch (err) {
    const reason = signal.aborted ? 'job_deadline' : `job_error:${String(err?.message || err).slice(0, 120)}`;
    try { return await fail(reason); } catch { return { outcome: 'failed', reason, timings }; }
  } finally {
    clearTimeout(timer);
  }
}
