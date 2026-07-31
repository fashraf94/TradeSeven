// api/_utils/wireEditorialSampling.js
// FantasyTimes Wire — N3.2 deterministic editorial sampling (Spec V1.2 N3.2,
// M6 + F-M8; V1.3 Amendments C/E/F).
//
// THE CONTRACT. The weekly editorial reviews a deterministic sample of the
// week's Wire entries. Everything here is PURE: same (isoWeek,
// reviewVersion, frame set) → same sample, independent of frame array
// order. The seed is `isoWeek + reviewVersion` (N3.2); selection is
// hash-ranking (sha256 over seed + storyId), so no PRNG state and no
// dependence on iteration order.
//
// Amendment E: the review week is the EXPLICIT ISO week filtered by
// isTradingSession() — never a fixed-count backward walk. A NYSE-holiday
// week yields 4 sessions and no session ever spills into two periods
// (P2-33).
//
// Amendment C: activeReporters is DERIVED (WIRE_ACTIVE_REPORTERS =
// allowlist keys) — minimumSize = max(3 × activeReporters,
// |producedEventTypes|), ceiling 20.
//
// Coverage mandate (N3.4 "no active reporter or produced eventType
// omitted" + N3.2 "index_move always included when produced"): every
// produced (reporter × eventType) stratum contributes at least one sampled
// story. Reporter allowlists are disjoint, so covering every produced
// stratum covers every produced reporter AND every produced eventType —
// index_move included whenever produced. If the mandate cannot be
// satisfied inside the ceiling, the result is `insufficient` — NEVER a
// silently dropped stratum (P2-10).
//
// The manifest this module emits is persisted BEFORE the model call
// (F-M8); a rerun replays the persisted manifest and never re-derives from
// the frame (P2-9) — the frame legitimately grows when a late replay lands
// in a past marketDate.

import { createHash } from 'node:crypto';
import { WIRE_ACTIVE_REPORTERS, WIRE_EDITORIAL_REVIEW_VERSION } from './wireContracts.js';
import { isTradingSession } from './wireCalendar.js';
import { classifyWireEntry, isRenderableState } from './wireEntryGuard.js';

export const EDITORIAL_SAMPLE_CEILING = 20;

// ── ISO-8601 week derivation (pure string math over UTC dates) ────────────

const DAY_MS = 86_400_000;

function utcMidnight(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) {
    throw new Error(`wireEditorialSampling: invalid date ${String(dateStr)}`);
  }
  return new Date(`${dateStr}T00:00:00Z`);
}

const toDateStr = (ms) => new Date(ms).toISOString().slice(0, 10);

/** ISO-8601 week id ('YYYY-Www') for a UTC date string. ISO weeks run
 *  Mon→Sun; the week's year is the year of its Thursday. A Sunday therefore
 *  belongs to the ISO week whose Mon–Fri just passed — exactly the week the
 *  Sunday editorial slot reviews. */
export function isoWeekOf(dateStr) {
  const d = utcMidnight(dateStr);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1..Sun=7
  const thursday = new Date(d.getTime() + (4 - dow) * DAY_MS);
  const isoYear = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.floor((thursday.getTime() - jan1.getTime()) / DAY_MS / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** The 7 dates (Mon..Sun) of the ISO week containing dateStr. */
export function isoWeekDates(dateStr) {
  const d = utcMidnight(dateStr);
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  const monday = d.getTime() - (dow - 1) * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => toDateStr(monday + i * DAY_MS));
}

/**
 * The review week's TRADING sessions (Amendment E): the explicit ISO week
 * filtered by isTradingSession — holidays drop out, nothing back-fills from
 * a prior week (P2-33).
 */
export function editorialSessionsFor(dateStr) {
  return isoWeekDates(dateStr).filter((day) => isTradingSession(day));
}

// ── Frame derivation ───────────────────────────────────────────────────────

/**
 * Build the sampling frame from fetched Wire day docs: every non-quarantined,
 * guard-renderable entry in the week's sessions (the N1.4 guard applies to
 * the editorial exactly as to every other consumer — an entry the build
 * cannot trust is not reviewable evidence).
 *
 * @param {Map<string, object>} days — marketDate → day-doc data
 * @param {string[]} sessions — the week's session dates
 * @returns {Array<{storyId, reporter, eventType, marketDate, publishedAt}>}
 */
export function deriveEditorialFrame(days, sessions) {
  const frame = [];
  for (const date of sessions) {
    const day = days.get(date);
    if (!day) continue;
    for (const entry of day.entries || []) {
      if (entry.quarantined === true) continue;
      if (!isRenderableState(classifyWireEntry(entry).state)) continue;
      const facts = entry.agentFacts || {};
      if (!entry.storyId || !facts.eventType) continue;
      frame.push({
        storyId: entry.storyId,
        reporter: entry.reporter,
        eventType: facts.eventType,
        marketDate: date,
        publishedAt: entry.publishedAt ?? null,
      });
    }
  }
  return frame;
}

// ── Deterministic sampling ─────────────────────────────────────────────────

const rankOf = (seed, storyId) =>
  createHash('sha256').update(`${seed}\n${storyId}`).digest('hex');

/** Order-independent fingerprint of the frame SET (recorded on the manifest
 *  so a resume can report frame growth without ever re-deriving from it). */
export function frameFingerprint(frame) {
  const h = createHash('sha256');
  for (const id of frame.map((f) => f.storyId).sort()) h.update(`${id}\n`);
  return h.digest('hex');
}

/**
 * Deterministic stratified sample (N3.2).
 *
 * @param {Array} frame — from deriveEditorialFrame
 * @param {object} o
 * @param {string} o.isoWeek
 * @param {string} [o.reviewVersion]
 * @param {string[]} [o.activeReporters]
 * @param {number} [o.ceiling]
 * @returns {{ status: 'ok'|'insufficient', reason: string|null, sample: Array,
 *             minimumSize: number, targetSize: number, strata: string[],
 *             producedReporters: string[], producedEventTypes: string[] }}
 */
export function sampleEditorialFrame(frame, {
  isoWeek,
  reviewVersion = WIRE_EDITORIAL_REVIEW_VERSION,
  activeReporters = WIRE_ACTIVE_REPORTERS,
  ceiling = EDITORIAL_SAMPLE_CEILING,
}) {
  const seed = `${isoWeek}:${reviewVersion}`;
  const producedReporters = [...new Set(frame.map((f) => f.reporter))].sort();
  const producedEventTypes = [...new Set(frame.map((f) => f.eventType))].sort();
  const strata = [...new Set(frame.map((f) => `${f.reporter}|${f.eventType}`))].sort();
  const minimumSize = Math.max(3 * activeReporters.length, producedEventTypes.length);

  const base = {
    minimumSize, strata, producedReporters, producedEventTypes,
  };

  // The coverage mandate must fit inside the ceiling — otherwise the week is
  // INSUFFICIENT, never silently narrowed (P2-10). Two ways to overflow:
  // more produced strata than the ceiling admits, or a minimumSize mandate
  // (3 × activeReporters) the ceiling cannot hold (the Amendment C growth
  // scenario, which P2-35 turns into CI-red first).
  if (strata.length > ceiling || minimumSize > ceiling) {
    return {
      ...base,
      status: 'insufficient',
      reason: strata.length > ceiling
        ? `produced strata (${strata.length}) exceed the sample ceiling (${ceiling})`
        : `minimumSize (${minimumSize}) exceeds the sample ceiling (${ceiling})`,
      sample: [],
      targetSize: 0,
    };
  }

  // Rank every frame item once; all selection reads this ordering.
  const ranked = frame
    .map((item) => ({ item, rank: rankOf(seed, item.storyId) }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));

  // Pass 1 — coverage: the rank-lowest item of every produced stratum.
  const picked = new Map(); // storyId → item
  for (const stratum of strata) {
    const first = ranked.find(({ item }) => `${item.reporter}|${item.eventType}` === stratum);
    if (first) picked.set(first.item.storyId, first.item);
  }

  // Pass 2 — fill to target by global rank order.
  const targetSize = Math.min(ceiling, Math.max(minimumSize, picked.size), frame.length);
  for (const { item } of ranked) {
    if (picked.size >= targetSize) break;
    if (!picked.has(item.storyId)) picked.set(item.storyId, item);
  }

  // Emit in rank order (deterministic, and the judge chunking inherits it).
  const sample = ranked.filter(({ item }) => picked.has(item.storyId)).map(({ item }) => item);
  return { ...base, status: 'ok', reason: null, sample, targetSize };
}

/**
 * The persisted manifest (F-M8): everything a resume needs to replay the
 * sample verbatim — and nothing that invites re-derivation.
 */
export function buildEditorialManifest(frame, sampling, { isoWeek, reviewVersion = WIRE_EDITORIAL_REVIEW_VERSION }) {
  return {
    seed: { isoWeek, reviewVersion },
    frameFingerprint: frameFingerprint(frame),
    frameSize: frame.length,
    minimumSize: sampling.minimumSize,
    ceiling: EDITORIAL_SAMPLE_CEILING,
    targetSize: sampling.targetSize,
    strata: sampling.strata,
    producedReporters: sampling.producedReporters,
    producedEventTypes: sampling.producedEventTypes,
    samplingStatus: sampling.status,
    samplingReason: sampling.reason,
    sample: sampling.sample.map((s) => ({
      storyId: s.storyId, reporter: s.reporter, eventType: s.eventType,
      marketDate: s.marketDate, publishedAt: s.publishedAt,
    })),
  };
}
