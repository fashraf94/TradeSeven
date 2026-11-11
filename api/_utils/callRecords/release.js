// api/_utils/callRecords/release.js
//
// THE COCKPIT'S OWN RELEASE SWITCH — a staged share of players, agent-mode
// battles only, with a kill switch that needs no redeploy (build prompt
// BUILD_PROMPT_COCKPIT_RELEASE_SWITCH; report
// docs/audits/20261110_COCKPIT_RELEASE_READINESS.md §C2, §C3, §7, §9).
//
// WHAT IT IS. A second way for a battle to resolve calls mode 'on', beside the
// allowlist (allowlist.js, unchanged): the battle is in the RELEASE COHORT.
// mode.js resolveCallRecordsMode composes the two; this module holds the parts
// that are pure or I/O:
//
//   the control document   cockpitConfig/release  — `{ shareBp: integer 0–10000,
//                          disabled: boolean, salt: string }`. House convention:
//                          `<domain>Config/<doc>`, the masteryConfig/epochRegistry
//                          precedent (masteryConfig.js:128-129). Server-write-only
//                          and unreadable from clients: firestore.rules denies every
//                          path no rule names ("Default deny everything else",
//                          firestore.rules:1494-1499, the same cover masteryConfig
//                          rests on), asserted by test/rules/cockpitReleaseDenials.rules.mjs.
//                          Written by hand in the Console. THIS BUILD NEVER CREATES
//                          IT: its absence is the dark state.
//   the view               what a read of the document means, as a plain object:
//                          { status, active, shareBp, salt, readAtMs }. `active` is
//                          true only for a present, well-formed, not-disabled document.
//   the cohort test        isInReleaseCohort(battle, view): ALL of
//                            gameMode === 'baggerbomb_agent' (TIERED_GAME_MODE; League
//                              and every other mode is out — founder ruling 1),
//                            not a CPU seat (battle.isCpu !== true AND the owner id is not a CPU
//                              seat's — isCpuUserId, the League's own codec, as Huddle's isCpuBattle also reads),
//                            a non-empty string owner id,
//                            an active view,
//                            bucketOf(ownerId, salt) < shareBp.
//   the bucket             uint32 (big-endian) of the first 4 bytes of
//                          sha256(ownerId + salt), mod 10,000. Stable per owner, grows
//                          with shareBp (raising it only adds owners), re-drawn by a new salt.
//
// WHEN IT IS READ (ensureReleaseView, below — modelled on masteryConfig.js
// readMasteryFlagView): once per evaluator run and once per sweep run
// (`force: true`), and cached for 60 s on request paths. The resolver stays
// SYNCHRONOUS and reads the cached view (getReleaseView).
//
// FAIL CLOSED, EVERYWHERE. A missing document, a malformed one, a disabled one,
// a read error, a read that does not answer within the bound, a view that was
// never loaded, and a view older than RELEASE_VIEW_MAX_AGE_MS: each is an EMPTY
// cohort — the allowlist alone decides, exactly as before this build. Nothing
// here throws.
//
// DEPENDENCY SURFACE (BUILD_RULES §4): TIERED_GAME_MODE comes from
// src/constants/agentGameModes.js, whose only import is leagueTournament.js (both
// Node-clean). release.test.js imports this module UNMOCKED as the runtime guard
// that they stay so. No module under src/ imports this file (it uses node:crypto).

import { createHash } from 'node:crypto';
import { TIERED_GAME_MODE } from '../../../src/constants/agentGameModes.js';
import { isCpuUserId } from '../../../src/constants/leagueTournament.js';

/** The control document's place: cockpitConfig/release. */
export const RELEASE_COLLECTION = 'cockpitConfig';
export const RELEASE_DOC = 'release';

/** shareBp is basis points of owners: 10,000 = everyone in the cohort's modes. */
export const RELEASE_BP_MAX = 10_000;
/** A view read on a request path is reused this long. */
export const RELEASE_VIEW_TTL_MS = 60_000;
/** A FAILED read is remembered only this long (never longer than the TTL): a hung store is not retried per request. */
export const RELEASE_FAILURE_TTL_MS = 15_000;
/** The synchronous reader treats a view older than this as never loaded (a handler that forgot to refresh fails closed). */
export const RELEASE_VIEW_MAX_AGE_MS = 600_000;
/**
 * The bound on one control-document read: 1,500 ms — the house precedent for a bounded read on a request path
 * (callsBlock.js CALLS_BLOCK_TIMEOUT_MS, sweep.js SWEEP_TX_MS), below the run-record write's 2,000 ms
 * (agent-evaluate.js EVAL_RUN_WRITE_TIMEOUT_MS) and well inside cockpit-status's 5 s maxDuration.
 * A tighter bound would turn an ordinary Firestore slow moment into an empty cohort (and a cached empty
 * cohort for RELEASE_FAILURE_TTL_MS) for a cohort player's first answer after an idle spell.
 */
export const RELEASE_READ_TIMEOUT_MS = 1_500;
/** The game mode the cohort admits — nothing else (League is its own later arc). */
export const RELEASE_COHORT_GAME_MODE = TIERED_GAME_MODE;

/** What a read can come to. Only 'ok' is a live cohort. */
export const RELEASE_STATUSES = Object.freeze(['ok', 'disabled', 'absent', 'malformed', 'error', 'timeout', 'unread']);

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function emptyView(status, readAtMs = null) {
  return Object.freeze({ status, active: false, shareBp: 0, salt: '', readAtMs });
}

/** The view no handler has loaded: an empty cohort. */
export const RELEASE_EMPTY_VIEW = emptyView('unread');

/**
 * What the document's data means. Pure. Never throws. The shape is exactly
 * `{ shareBp: integer 0–10000, disabled: boolean, salt: string }`; any other
 * field is ignored (a Console note is harmless), any of the three wrong is
 * malformed → empty.
 *
 * @param {unknown} data  the document's data, or null/undefined for an absent document
 * @param {number|null} [readAtMs]
 * @returns {{ status: string, active: boolean, shareBp: number, salt: string, readAtMs: number|null }}
 */
export function parseReleaseDocument(data, readAtMs = null) {
  try {
    if (data === null || data === undefined) return emptyView('absent', readAtMs);
    if (!isPlain(data)) return emptyView('malformed', readAtMs);
    // OWN fields only: an inherited property is not something a Console write made.
    for (const k of ['shareBp', 'disabled', 'salt']) if (!Object.prototype.hasOwnProperty.call(data, k)) return emptyView('malformed', readAtMs);
    const { shareBp, disabled, salt } = data;
    if (!Number.isInteger(shareBp) || shareBp < 0 || shareBp > RELEASE_BP_MAX) return emptyView('malformed', readAtMs);
    if (typeof disabled !== 'boolean') return emptyView('malformed', readAtMs);
    if (typeof salt !== 'string') return emptyView('malformed', readAtMs);
    if (disabled) return Object.freeze({ status: 'disabled', active: false, shareBp, salt, readAtMs });
    return Object.freeze({ status: 'ok', active: true, shareBp, salt, readAtMs });
  } catch {
    // A throwing getter on the data: not a document this module can read.
    return emptyView('malformed', readAtMs);
  }
}

/**
 * The owner's bucket in [0, 10000): the first four bytes of sha256(ownerId +
 * salt) as a big-endian uint32, mod 10,000. Pure and total for strings; a
 * non-string owner or salt has no bucket (null).
 */
export function bucketOf(ownerId, salt) {
  if (typeof ownerId !== 'string' || typeof salt !== 'string') return null;
  const digest = createHash('sha256').update(ownerId + salt).digest();
  return digest.readUInt32BE(0) % RELEASE_BP_MAX;
}

/**
 * Is this battle in the release cohort? Pure given the view; never throws.
 * ALL of: an active view; the agent game mode; not a CPU seat; a non-empty
 * string owner id; bucket < shareBp. The allowlist is not consulted here.
 *
 * @param {object} battle
 * @param {{ active: boolean, shareBp: number, salt: string }} view
 */
export function isInReleaseCohort(battle, view) {
  try {
    if (!view || view.active !== true) return false;
    // The view's own fields are re-checked: a hand-built view (a script's argument) is not trusted by coercion.
    if (!Number.isInteger(view.shareBp) || view.shareBp < 0 || view.shareBp > RELEASE_BP_MAX || typeof view.salt !== 'string') return false;
    if (!battle || typeof battle !== 'object') return false;
    if (battle.gameMode !== RELEASE_COHORT_GAME_MODE) return false;
    if (battle.isCpu === true) return false;
    if (isCpuUserId(battle.ownerId)) return false; // a CPU seat by its owner id, whatever its isCpu flag says
    const owner = battle.ownerId;
    if (typeof owner !== 'string' || owner.length === 0) return false;
    const bucket = bucketOf(owner, view.salt);
    return bucket !== null && bucket < view.shareBp;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- the cached view

let cached = RELEASE_EMPTY_VIEW; // the last view read (or the empty one)
let cachedExpiresAtMs = 0;       // when a non-forced ensure may reuse it
let inflight = null;             // one shared read for concurrent non-forced callers
// Reads are numbered by START: a read that finishes AFTER a later-started one has already landed must not overwrite
// the newer view (a slow stale 'ok' must never undo a newer 'disabled' — the kill switch).
let seq = 0;
let appliedSeq = 0;
// One Firestore Admin handle per process in production, so the cache is not keyed by it.

/**
 * The cached view, SYNCHRONOUSLY — what the resolver reads. A view that was
 * never loaded, or is older than RELEASE_VIEW_MAX_AGE_MS, is the empty view.
 * Never throws.
 */
export function getReleaseView(opts) {
  try {
    const nowMs = opts && typeof opts.nowMs === 'number' && Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
    const at = cached.readAtMs;
    if (typeof at !== 'number' || !Number.isFinite(at)) return RELEASE_EMPTY_VIEW;
    const age = nowMs - at;
    // `!(age <= MAX)` also rejects NaN; a view dated well in the future (a clock stepped back) is not trusted either.
    if (!(age <= RELEASE_VIEW_MAX_AGE_MS) || age < -RELEASE_VIEW_TTL_MS) return RELEASE_EMPTY_VIEW;
    return cached;
  } catch {
    return RELEASE_EMPTY_VIEW;
  }
}

/** Tests only: forget the cached view and any shared read. */
export function resetReleaseView() {
  cached = RELEASE_EMPTY_VIEW;
  cachedExpiresAtMs = 0;
  inflight = null;
  appliedSeq = seq; // a read still in flight from before the reset can no longer land
}

/**
 * One bounded read of the document → a view. Never throws, never rejects. A read that misses its bound reports 'timeout'
 * NOW (the caller is never held past the bound) but is not abandoned: if it later lands with a document, `onLate(view)` is
 * handed that view, so a slow first RPC of a cold function instance corrects the cache when it arrives instead of 15 s later.
 */
async function readOnce(db, { timeoutMs, nowMs, onLate = null }) {
  let timer = null;
  try {
    const read = Promise.resolve().then(() => db.collection(RELEASE_COLLECTION).doc(RELEASE_DOC).get());
    const bound = new Promise((resolve) => { timer = setTimeout(() => resolve('__timeout__'), Math.max(1, timeoutMs)); });
    const snap = await Promise.race([read, bound]);
    if (snap === '__timeout__') {
      // The losing read may still land (hand the late document over) or reject (swallow it: never an unhandled rejection).
      read.then((late) => { try { if (onLate) onLate(parseReleaseDocument(late && late.exists ? late.data() : null, nowMs)); } catch { /* best effort */ } }, () => {});
      return emptyView('timeout', nowMs);
    }
    read.catch(() => {});
    const data = snap && snap.exists ? snap.data() : null;
    return parseReleaseDocument(data, nowMs);
  } catch {
    return emptyView('error', nowMs);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Make the cached view fresh enough for the resolver, and return it. Never
 * throws. Without `force` a view read within the TTL is reused (one shared read
 * for concurrent callers); `force: true` always reads (the evaluator and the
 * sweep, ONCE PER RUN). A failed read is cached for RELEASE_FAILURE_TTL_MS at most.
 *
 * @param {object} db  the Firestore Admin handle
 * @param {{ force?: boolean, retry?: boolean, ttlMs?: number, timeoutMs?: number, nowMs?: number }} [opts]
 */
export async function ensureReleaseView(db, opts) {
  try {
    // Every option is sanitised: a non-number, a non-finite or a non-positive value is the default, and the
    // bounds are clamped (a timer past 2^31 ms would fire at once and fail closed anyway).
    const o = opts && typeof opts === 'object' ? opts : {};
    const force = o.force === true;
    const ttlMs = typeof o.ttlMs === 'number' && Number.isFinite(o.ttlMs) && o.ttlMs > 0 ? Math.min(o.ttlMs, RELEASE_VIEW_MAX_AGE_MS) : RELEASE_VIEW_TTL_MS;
    const timeoutMs = typeof o.timeoutMs === 'number' && Number.isFinite(o.timeoutMs) && o.timeoutMs > 0 ? Math.min(o.timeoutMs, 30_000) : RELEASE_READ_TIMEOUT_MS;
    const now = typeof o.nowMs === 'number' && Number.isFinite(o.nowMs) ? o.nowMs : Date.now();
    if (!force) {
      if (cached.readAtMs !== null && now < cachedExpiresAtMs) return getReleaseView({ nowMs: now });
      if (inflight) return await inflight;
    }
    const mySeq = ++seq;
    const keepFor = (view) => (view.status === 'ok' || view.status === 'disabled' || view.status === 'absent' || view.status === 'malformed'
      ? ttlMs
      : Math.min(ttlMs, RELEASE_FAILURE_TTL_MS));
    // A read that timed out and lands later replaces the failure — only while that failure is still the standing view.
    const onLate = (late) => { if (appliedSeq === mySeq && cached.status === 'timeout') { cached = late; cachedExpiresAtMs = now + keepFor(late); } };
    // A FORCED read (the evaluator: once per run, with nothing to refresh it) is retried once on a failure before the run
    // gives up on the cohort; `retry: false` (the sweep, which has a budget to protect) opts out. Request paths read once.
    const retry = force && o.retry !== false;
    const run = (async () => {
      let view = await readOnce(db, { timeoutMs, nowMs: now, onLate }); // never rejects
      if (retry && (view.status === 'error' || view.status === 'timeout')) view = await readOnce(db, { timeoutMs, nowMs: now, onLate });
      if (mySeq > appliedSeq) {
        appliedSeq = mySeq;
        cached = view;
        cachedExpiresAtMs = now + keepFor(view);
        // A failed or malformed read is the one thing that silently empties the cohort: leave a line (the house `[calls]` style).
        if (view.status === 'error' || view.status === 'timeout' || view.status === 'malformed') {
          console.warn(`[release] control view ${view.status} — the release cohort is EMPTY (the allowlist alone decides) for ${Math.round(keepFor(view) / 1000)} s`);
        }
        return view;
      }
      return cached; // a later-started read already landed: its view stands
    })();
    if (force) return await run;
    const tracked = run.then((v) => { if (inflight === tracked) inflight = null; return v; });
    inflight = tracked;
    return await tracked;
  } catch {
    return RELEASE_EMPTY_VIEW;
  }
}
