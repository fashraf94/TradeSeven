// api/_utils/setupMenuLabels/compose.js
//
// Slice 2 — THE BLOCK, PURE (spec V2 §5, amended by Corrections C and D). One `setupMenu` block for
// the tick's permanent record: the frozen pool's identity, and per candidate its label, composed ONCE
// from what was available at that instant. Never throws past its boundary: any internal error yields
// the error form, `{ blockStatus: 'error', errorCode: 'compose_failed', …identity }`.
//
// PRE-VALIDATED. Every value is checked against the closed lists (constants.js, mirrored in
// captureConfig.js) and the serializer's own syntaxes before it is placed, so the real sanitizer has
// nothing to reject: a `reason` that is not an id becomes `other`, a non-finite number becomes null,
// an unreadable instant null. The writer still sanitizes the block in its own pass (captureWriter.js)
// and, should anything be rejected after all, records the error form instead (Correction C).
//
// THE TIMES. `readsStartedAt` and `observedAt` bound THIS tick's observation (its read start and its seal).
// A read it shares from the run memo (`readsShared`) may have been issued by an earlier tick of the same handler
// invocation, before this tick's freeze: its VALUE is then as of that earlier lookup and can be stale by up to the
// invocation's length (TIME_BUDGET_MS, ~290 s) — an `absent` may since have been written. The state read is shared
// the same way (one per run), so a later battle's s2 fields describe the run's first state read (review SM1-4). V2's
// `settleWaitMs` (always 0 under Correction A) and `readMs` (derivable from the two instants) are not recorded.
//
// THE MEANINGS (Correction D):
//   capturedBeforeFreeze — the snapshot's `capturedAt` (the provider response time: snapshotDocOf
//     sets it to the fetch's `fetchedAt`) compared with `frozenAt`. A comparison of capture time
//     ONLY: it does not say the snapshot was in the database, or readable, at the decision.
//   inBenchAtFreeze / heldAtFreeze — membership of the frozen sets (pool.js), not dispatch.
//   s2Entry — null: Slice 2's state, or this key's entry in it, could not be read (unreadable, unrecognised,
//     malformed or unsettled); false: read, no
//     entry for the key (never reserved, or pruned); true: an entry exists. Then s2Reservations is
//     that entry's count of non-refunded RESERVATIONS — not provider requests, not failures — and
//     s2LastOutcome / s2LastAt the last outcome Slice 2 recorded for it (historical: `pending` is a
//     past outcome, never a live lease). s2Exhausted is asserted only from the reservation count.
//   Missing snapshot (`absent`), refused final snapshot (`refused`, verdict `unknown` with the
//   refusal's reason) and an evaluator `unknown` verdict (`labelled`, verdict `unknown` with its
//   typed reason) stay three distinct statuses.

import {
  MAX_RESERVATIONS_PER_KEY_PER_SESSION, SETUP_BARS_CLASSES, SETUP_LABEL_STATUSES, SETUP_MENU_BLOCK_STATUSES,
  SETUP_MENU_MAX_BYTES, SETUP_MENU_SELECTORS, SETUP_PATTERNS, SETUP_REGIMES, SETUP_S2_OUTCOMES,
  SETUP_SNAPSHOT_STATUSES, SETUP_VERDICTS, SNAPSHOT_SCHEMA_VERSION,
} from './constants.js';

/** The serializer's id and instant syntaxes (captureSerializer.js ID_RE / ISO_RE, restated; compose.test.js proves the real sanitizer agrees). */
const ID_RE = /^[A-Za-z0-9_:.+\-/]{1,120}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2}))?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const idOrNull = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : null);
const reasonOf = (v) => (v === null || v === undefined ? null : (typeof v === 'string' && ID_RE.test(v) ? v : 'other'));
const enumOrNull = (v, list) => (typeof v === 'string' && list.includes(v) ? v : null);
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const boolOrNull = (v) => (typeof v === 'boolean' ? v : null);
const instantMsOf = (v) => {
  if (typeof v !== 'string' || !ISO_RE.test(v)) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
};
const isoOf = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null);

/** Approximate serialized size (the writer's own approxBytes rule: UTF-8 bytes of JSON). */
export function approxBytes(value) {
  try { return new TextEncoder().encode(JSON.stringify(value) ?? '').length; } catch { return 0; }
}

/** Freeze a plain value and everything in it: the block handed to the record can never be patched later. */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/** Does this stored document serve (session, symbol, rule set) under the one snapshot schema this slice knows? Pure. */
export function snapshotServes(snapshot, { session, symbol, ruleSet }) {
  if (!isPlainObject(snapshot) || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return false;
  const key = snapshot.key;
  if (!isPlainObject(key) || key.session !== session || key.symbol !== symbol || !isPlainObject(key.ruleSet)) return false;
  const rs = key.ruleSet;
  if (rs.setupVersion !== ruleSet?.setupVersion || rs.thresholdsHash !== ruleSet?.thresholdsHash || rs.semanticsId !== ruleSet?.semanticsId) return false;
  if (!isPlainObject(snapshot.entry)) return false;
  if (snapshot.status !== 'ok' && snapshot.status !== 'refused') return false;
  return instantMsOf(snapshot.capturedAt) !== null;
}

const NULL_LABEL = Object.freeze({
  verdict: null, reason: null, pattern: null, regime: null,
  asOf: null, barsClass: null, capturedAt: null, capturedBeforeFreeze: null, snapshotStatus: null,
});
const NULL_S2 = Object.freeze({ s2Entry: null, s2Reservations: null, s2LastOutcome: null, s2LastAt: null, s2Exhausted: null });

/** The label fields of a snapshot that serves the key. Pure. */
function labelOf(snapshot, frozenAtMs) {
  const entry = snapshot.entry;
  const capturedMs = instantMsOf(snapshot.capturedAt);
  const refused = snapshot.status === 'refused';
  return {
    status: refused ? 'refused' : 'labelled',
    verdict: refused ? 'unknown' : enumOrNull(entry.verdict, SETUP_VERDICTS),
    reason: refused ? reasonOf(snapshot.refusal?.reason ?? entry.reason ?? null) : reasonOf(entry.reason ?? null),
    pattern: refused ? null : enumOrNull(entry.pattern, SETUP_PATTERNS),
    regime: enumOrNull(entry.regime, SETUP_REGIMES),
    asOf: typeof snapshot.asOf === 'string' && DATE_RE.test(snapshot.asOf) ? snapshot.asOf : null,
    barsClass: enumOrNull(snapshot.evidenceClass?.bars, SETUP_BARS_CLASSES),
    capturedAt: isoOf(capturedMs),
    // Provider capture time vs the freeze instant — NOT database availability at the decision (Correction D.1).
    capturedBeforeFreeze: capturedMs !== null && Number.isFinite(frozenAtMs) ? capturedMs < frozenAtMs : null,
    snapshotStatus: enumOrNull(snapshot.status, SETUP_SNAPSHOT_STATUSES),
  };
}

/** Slice 2's own history for one key, from its state entry. Pure. */
function s2Of({ stateRead, entry, session }) {
  if (stateRead !== true) return { ...NULL_S2 };
  if (!isPlainObject(entry)) return { ...NULL_S2, s2Entry: false };
  if (entry.malformed === true) return { ...NULL_S2 }; // an entry this code cannot read is unreadable, never "no entry" or zero (review SM1-1)
  const n = Number.isInteger(entry.n) && entry.n >= 0 ? entry.n : null;
  return {
    s2Entry: true,
    s2Reservations: n,
    s2LastOutcome: enumOrNull(entry.lastOutcome, SETUP_S2_OUTCOMES),
    s2LastAt: isoOf(numOrNull(entry.lastAt)),
    s2Exhausted: n === null ? null : (entry.session === session && n >= MAX_RESERVATIONS_PER_KEY_PER_SESSION),
  };
}

const COUNT_OF_STATUS = Object.freeze({
  labelled: 'labelled', refused: 'refused', absent: 'absent', excluded: 'excluded', symbol_form: 'symbolForm',
  stale_snapshot: 'stale', read_failed: 'failed', read_unsettled: 'unsettled',
});
const emptyCounts = () => ({ labelled: 0, refused: 0, absent: 0, excluded: 0, symbolForm: 0, stale: 0, failed: 0, unsettled: 0 });

/** The identity fields every form of the block carries, each re-validated. */
function identityOf(pool) {
  return {
    session: idOrNull(pool?.session),
    setupVersion: idOrNull(pool?.ruleSet?.setupVersion),
    thresholdsHash: idOrNull(pool?.ruleSet?.thresholdsHash),
    semanticsId: idOrNull(pool?.ruleSet?.semanticsId),
    frozenAt: isoOf(numOrNull(pool?.frozenAtMs)),
  };
}

/** The error form: identity and a code, nothing else. Pure; cannot throw. */
export function errorBlockOf(pool, errorCode) {
  let identity;
  try { identity = identityOf(pool); } catch { identity = {}; }
  return deepFreeze({ blockStatus: 'error', errorCode: idOrNull(errorCode) ?? 'compose_failed', ...identity });
}

/**
 * Compose the block. Pure; never throws.
 *
 * @param {object} pool the frozen pool: { session|null, calendarMissing, ruleSet, selector, rebuilt, frozenAtMs,
 *   list: candidatesOf(...) }
 * @param {object|null} obs what the reads produced by now: { readsStartedAtMs, observedAtMs, stateRead,
 *   stateBySymbol: Map<symbol, entry|null>, results: Map<symbol, { ok: true, value } | { ok: false }>,
 *   readsIssued, readsShared } — null for the pool fact before any read started
 * @param {{ maxBytes?: number }} [limits]
 */
export function composeSetupMenuBlock(pool, obs, { maxBytes = SETUP_MENU_MAX_BYTES } = {}) {
  try {
    const identity = identityOf(pool);
    const frozenAtMs = numOrNull(pool.frozenAtMs);
    const list = pool.list;
    const results = obs?.results instanceof Map ? obs.results : new Map();
    const stateBySymbol = obs?.stateBySymbol instanceof Map ? obs.stateBySymbol : new Map();
    const stateRead = obs?.stateRead === true;

    const candidates = list.candidates.map((c) => {
      const base = {
        symbol: c.symbol,
        source: c.source === 'catalyst' ? 'catalyst' : 'hotbench',
        inBenchAtFreeze: c.inBenchAtFreeze === true,
        heldAtFreeze: c.heldAtFreeze === true,
      };
      if (c.status === 'excluded' || c.status === 'symbol_form') return { ...base, status: c.status, ...NULL_LABEL, ...NULL_S2 };
      const s2 = s2Of({ stateRead, entry: stateBySymbol.get(c.symbol), session: pool.session });
      const r = results.get(c.symbol);
      if (!r) return { ...base, status: 'read_unsettled', ...NULL_LABEL, ...s2 };
      if (r.ok !== true) return { ...base, status: 'read_failed', ...NULL_LABEL, ...s2 };
      if (r.value === null || r.value === undefined) return { ...base, status: 'absent', ...NULL_LABEL, ...s2 };
      if (!snapshotServes(r.value, { session: pool.session, symbol: c.symbol, ruleSet: pool.ruleSet })) return { ...base, status: 'stale_snapshot', ...NULL_LABEL, ...s2 };
      const label = labelOf(r.value, frozenAtMs);
      return { ...base, ...label, ...s2 };
    });

    const block = {
      blockStatus: 'ok',
      errorCode: null,
      ...identity,
      selector: enumOrNull(pool.selector, SETUP_MENU_SELECTORS),
      rebuilt: boolOrNull(pool.rebuilt),
      readsStartedAt: isoOf(numOrNull(obs?.readsStartedAtMs)),
      observedAt: isoOf(numOrNull(obs?.observedAtMs)),
      stateRead,
      presentedCount: numOrNull(list.presentedCount) ?? 0,
      uniqueCount: numOrNull(list.uniqueCount) ?? 0,
      omittedCount: numOrNull(list.omittedCount) ?? 0,
      unrecordableCount: numOrNull(list.unrecordableCount) ?? 0,
      truncatedCount: 0,
      readsIssued: numOrNull(obs?.readsIssued) ?? 0,
      readsShared: numOrNull(obs?.readsShared) ?? 0,
      counts: emptyCounts(),
      candidates,
    };

    // The byte cap: candidates dropped from the tail until the block fits, counted.
    while (block.candidates.length > 0 && approxBytes(block) > maxBytes) {
      block.candidates.pop();
      block.truncatedCount += 1;
    }
    for (const c of block.candidates) block.counts[COUNT_OF_STATUS[c.status]] += 1;

    // Precedence: error > calendar_missing > truncated > reads_unsettled > ok (the lower facts stay in their counters).
    block.blockStatus = pool.calendarMissing === true ? 'calendar_missing'
      : block.truncatedCount > 0 ? 'truncated'
        : block.counts.unsettled > 0 ? 'reads_unsettled'
          : 'ok';
    if (!SETUP_MENU_BLOCK_STATUSES.includes(block.blockStatus)) return errorBlockOf(pool, 'compose_failed');
    for (const c of block.candidates) if (!SETUP_LABEL_STATUSES.includes(c.status)) return errorBlockOf(pool, 'compose_failed');
    return deepFreeze(block);
  } catch {
    return errorBlockOf(pool, 'compose_failed');
  }
}
