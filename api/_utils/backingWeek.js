// api/_utils/backingWeek.js
//
// Backing Beta PR 1 — THE WINDOW, as pure functions (spec V1.3 §2 backing week,
// §4 window; rulings D-c amended, D-h, D-x; addendum §2 Q2 + A-C6).
//
// PURE BY CONSTRUCTION: every function here takes a group doc (a plain object)
// and/or an instant and returns a value. No Firestore, no `db`, no I/O beyond
// the NYSE holiday calendar the Monday derivation already consults. PR 2's
// lazy pool materialization and PR 3's settlement compose these; nothing in
// PR 1 calls them.
//
// THE ONE RULE THIS MODULE EXISTS TO ENFORCE (A-C6, §4): `closesAt` is derived
// from a MONDAY DATE, never from the week label. `baseLayerWeek` is a one-way,
// re-stampable ISO-week string with NO INVERSE anywhere in the codebase
// (addendum §2 Q2 searched for one: not found), and three sites rewrite it
// after formation for pods that lingered past their stamped Monday. A close
// computed from the label would therefore move when the label was re-stamped.
// So:
//   · slot pods  — `battleStartWeek.mondayEtDate`, stamped at claim;
//   · lobby pods — `deriveBattleStartWeek(createdAt).mondayEtDate`.
// Both come from THE WRITERS' OWN EXPORTED PAIR in liveDraftFormation.js
// (deriveBattleStartWeek / deriveBaseLayerWeek), never reimplemented (§12
// fence note) — read and write agree by construction, the same discipline
// currentBaseLayerWeek applies on the client side.
//
// DST: every instant is built through `etWallClockInstantIso` (the exported
// dual-offset round-trip in liveDraftFormation.js), so a backing week is the
// seven ET CALENDAR days Mon 00:00 → Sun 23:59:59 — 167h, 168h or 169h of real
// time depending on the Sunday. NEVER `start + 7 * 24h`: the spring-forward
// week is an hour short and the fall-back week an hour long, and a fixed-hours
// close would land an hour off in both (BUILD_RULES §6 — Intl, never
// hand-rolled offsets).
//
// ET calendar arithmetic ('YYYY-MM-DD' via UTC-noon) is kept local, the
// liveDraftFormation.js / trainingLifecycle.js precedent stated in that file's
// own header: "pure date math, not scoring". The HOLIDAY LIST and the Monday
// RULE are both reused, never re-copied — the only thing duplicated here is a
// three-line date shift.
//
// Imports the zero-import constants module from src/ under the revised June
// 2026 import rule (BUILD_RULES §4); the co-located test's real import of THIS
// module is the dependency-surface guard (it explodes in the Node test env if a
// browser dep ever enters the graph) — never mock it.

import { deriveBattleStartWeek, deriveBaseLayerWeek, etWallClockInstantIso } from './liveDraftFormation.js';
import { POOL_EXCLUDED_SLOT_IDS, POOL_MIN_WINDOW_MS } from '../../src/constants/backing.js';

const ET_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The reasons `poolEligible` returns. Plain strings PR 2 surfaces; exported so
 * the endpoint and its tests name them from one source rather than by literal
 * (§9 display-agreement applied to a status word).
 */
export const POOL_INELIGIBLE = Object.freeze({
  NOT_FORMING: 'not_forming',
  DEV_POD: 'dev_pod',
  TRAINING_POD: 'training_pod',
  SLOT_EXCLUDED: 'slot_excluded',
  NO_BATTLE_MONDAY: 'no_battle_monday',
  WINDOW_TOO_SHORT: 'window_too_short',
});

// ==================== LOCAL ET CALENDAR ARITHMETIC ====================

/** 'YYYY-MM-DD' → the UTC-noon Date of that ET calendar day (DST-immune). */
function etDateToUtcNoon(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The ET calendar date `n` days from `etDate` (n may be negative). */
function addEtDays(etDate, n) {
  const dt = etDateToUtcNoon(etDate);
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** An instant-ish value → epoch ms, or NaN. Never throws. */
function msOf(value) {
  if (value == null) return NaN;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  return NaN;
}

/** An instant-ish value → ISO string, or null. Never throws. */
function isoOf(value) {
  const ms = msOf(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * The ET wall-clock instant of the LAST WHOLE SECOND of `etDate` — 23:59:59 ET.
 * Built from the 23:59 wall clock plus 59s rather than by offset math: 23:59
 * is nowhere near a DST boundary (US transitions fire at 02:00 ET), so the
 * added minute is real time in both directions.
 *
 * The final sub-second sliver (23:59:59.001–23:59:59.999) reads as CLOSED,
 * because a pool is open while `now < closesAt`. Deliberately conservative:
 * the clock close can be a fraction early, never late.
 */
function etDayEndIso(etDate) {
  return new Date(new Date(etWallClockInstantIso(etDate, 23, 59)).getTime() + 59_000).toISOString();
}

// ==================== (1) THE BATTLE MONDAY ====================

/**
 * The ET calendar date ('YYYY-MM-DD') of the Monday whose week this pod
 * BATTLES — the anchor every other function here hangs off (§4, A-C6).
 *
 *   · SLOT PODS carry `battleStartWeek.mondayEtDate`, stamped at claim by
 *     `deriveBattleStartWeek` and re-stamped by the stale-anchor guard. Read it
 *     directly: it is the writer's own value, so pool and pod can never disagree.
 *   · LOBBY PODS carry no Monday date (addendum §2 Q2), so it is derived from
 *     `createdAt` through the SAME exported helper the lobby writer uses
 *     (`battleWeekKeyFor` → `deriveBattleStartWeek`): Monday before 09:30 ET →
 *     that same Monday; Monday at/after 09:30 → the following Monday; any other
 *     day → the upcoming Monday.
 *
 * HOLIDAY MONDAYS: `deriveBattleStartWeek` also returns `anchorEtDate`, which
 * walks forward off a holiday to the week's first trading day. We take
 * `mondayEtDate`, NOT the anchor — §4 is explicit that a holiday Monday moves
 * the first battle to Tuesday while the label and the close DO NOT MOVE.
 *
 * @returns {string|null} null when neither source is derivable — a malformed or
 *   dateless pod gets no pool (`poolEligible` → `no_battle_monday`) rather than
 *   a guessed window.
 */
export function battleMondayEtDateFor(group) {
  const stamped = group?.battleStartWeek?.mondayEtDate;
  if (typeof stamped === 'string' && ET_DATE_RE.test(stamped)) return stamped;

  const createdIso = isoOf(group?.createdAt);
  if (createdIso == null) return null;
  try {
    const { mondayEtDate } = deriveBattleStartWeek(createdIso);
    return typeof mondayEtDate === 'string' && ET_DATE_RE.test(mondayEtDate) ? mondayEtDate : null;
  } catch {
    // A createdAt the ET formatter cannot read is a malformed pod, not a crash
    // for the caller: the pod simply gets no pool.
    return null;
  }
}

// ==================== (2) THE BACKING WEEK ====================

/**
 * The backing week that funds the pods battling on `mondayEtDate`: the SEVEN ET
 * CALENDAR DAYS before it — Monday 00:00 ET through Sunday 23:59:59 ET (§2).
 *
 * `weekKey` is the ISO-8601 week label OF THE BATTLE MONDAY — the same value the
 * group's `baseLayerWeek` carries when correctly stamped — produced by the
 * writers' own `deriveBaseLayerWeek`, so a pool's week key and its pod's label
 * agree by construction. It labels the week the pods PLAY, not the week the
 * backing happens, which is what makes "every stake on a pool is drawn from the
 * same allowance" (§2) true.
 *
 * @param {string} mondayEtDate 'YYYY-MM-DD', the battle Monday.
 * @returns {{weekKey: string, startIso: string, closeIso: string}|null}
 */
export function backingWeekFor(mondayEtDate) {
  if (typeof mondayEtDate !== 'string' || !ET_DATE_RE.test(mondayEtDate)) return null;
  const startEtDate = addEtDays(mondayEtDate, -7); // the Monday before
  const closeEtDate = addEtDays(mondayEtDate, -1); // the Sunday before
  return {
    weekKey: deriveBaseLayerWeek({ mondayEtDate }),
    startIso: etWallClockInstantIso(startEtDate, 0, 0),
    closeIso: etDayEndIso(closeEtDate),
  };
}

/**
 * The backing week in progress at `now`: the one whose close is the NEXT Sunday
 * 23:59:59 ET at or after `now` (§2). This is the week the wallet's lazy
 * allowance grant keys on — `lastAllowanceWeek !== weekKey` → grant (D-h).
 *
 * On a Monday it names the week that STARTS that Monday, not the one that closed
 * the night before: the allowance is the week you are living in. (That is
 * deliberately NOT `deriveBattleStartWeek(now)`, which on a Monday before 09:30
 * ET still names that same Monday — a week whose backing closed last night. The
 * pod-list endpoint in PR 2 wants that other behavior, §5's parenthetical; the
 * wallet wants this one.)
 */
export function currentBackingWeek(now = new Date()) {
  const nowMs = msOf(now);
  if (!Number.isFinite(nowMs)) return null;
  const nowIso = new Date(nowMs).toISOString();
  // The ET calendar date of `now`, via the same Intl round-trip everything else
  // uses — deriveBattleStartWeek's own first step, reached without duplicating
  // the Monday rule.
  let sunday;
  try {
    const { mondayEtDate } = deriveBattleStartWeek(nowIso);
    // mondayEtDate is the next Monday-open at/after now; the Sunday before it is
    // this week's close candidate.
    sunday = addEtDays(mondayEtDate, -1);
  } catch {
    return null;
  }
  // A Monday-pre-open `now` yields yesterday's Sunday, whose close has passed;
  // so does the sub-second tail of a Sunday 23:59:59. Advance a week in either
  // case — one step is always enough (the candidate is never more than a week
  // behind).
  if (new Date(etDayEndIso(sunday)).getTime() < nowMs) sunday = addEtDays(sunday, 7);
  return backingWeekFor(addEtDays(sunday, 1));
}

// ==================== (3) OPEN AND CLOSE ====================

/**
 * When this pod's pool CLOSES, and why (§4, D-x): the earlier of
 *   · the CLOCK — Sunday 23:59:59 ET before the battle Monday; and
 *   · the FIRE — a live-draft pod's `scheduledDraftAt`, the moment seats freeze
 *     and before any pick is written.
 *
 * The fire close is what makes slot pods honest: their human draft completes at
 * the slot (Wed 19:00 / Sat 12:00 / Sun 19:00 ET), days or hours before the
 * Sunday clock, and the picks land on the authed-readable group doc — so a
 * clock close would leave the window open over visible drafts (A-C1/A3).
 *
 * The CLOCK is the legible deadline; the battle doc is the truth (§4's belt,
 * built in PR 2). This function is the clock half only.
 *
 * @returns {{closesAt: string, closeReason: 'clock'|'fire'}|null} null when no
 *   battle Monday is derivable.
 */
export function closesAtFor(group) {
  const week = backingWeekFor(battleMondayEtDateFor(group));
  if (week == null) return null;

  const clockMs = new Date(week.closeIso).getTime();
  if (group?.isLiveDraft !== true) return { closesAt: week.closeIso, closeReason: 'clock' };

  const fireMs = msOf(group?.scheduledDraftAt);
  // A live-draft pod with no readable fire instant falls back to the clock
  // rather than losing its close entirely — the conservative direction, and the
  // battle-doc belt still backstops it.
  if (!Number.isFinite(fireMs) || fireMs >= clockMs) return { closesAt: week.closeIso, closeReason: 'clock' };
  return { closesAt: new Date(fireMs).toISOString(), closeReason: 'fire' };
}

/**
 * When this pod's pool OPENS (§4): the LATER of pod formation and the backing
 * week's start. Pools open no earlier than their backing week, which is what
 * guarantees every stake on a pool is drawn from one allowance (§2) — a pod
 * formed three weeks out does not get a three-week window.
 *
 * A pod with no readable `createdAt` opens at the week start; there is no
 * formation instant to be later than.
 *
 * @returns {string|null} null when no battle Monday is derivable.
 */
export function opensAtFor(group) {
  const week = backingWeekFor(battleMondayEtDateFor(group));
  if (week == null) return null;
  const createdMs = msOf(group?.createdAt);
  const startMs = new Date(week.startIso).getTime();
  return Number.isFinite(createdMs) && createdMs > startMs
    ? new Date(createdMs).toISOString()
    : week.startIso;
}

// ==================== (4) THE POOL PREDICATE ====================

/**
 * Does this pod get a pool at `now`? (§4, §5, D-c amended, D-x.)
 *
 * Every clause, in the order the reasons are returned:
 *   1. `status === 'forming'` — the only status a pool opens in. There is NO
 *      `active` status (A-C3); the live status is `battle`, and `drafting` /
 *      `awaiting_open` mean a slot pod has already drafted.
 *   2. `isDev !== true` — dev pods never materialize a production pool. (The
 *      DEV NAMESPACE is a separate mechanism: §6 routes dev groups to `dev-`
 *      pool and wallet ids. This predicate is the production pod list's own
 *      exclusion, D-DEVFIELD; a dev-namespaced caller reverses it deliberately.)
 *   3. `isTraining !== true` — training pods complete with zero ladder effects
 *      (addendum §2 Q1) and have nothing to settle against.
 *   4. `slotId` not in POOL_EXCLUDED_SLOT_IDS — the Mon 08:45 exclusion (D-x).
 *   5. a derivable battle Monday.
 *   6. `closesAt − max(now, opensAt) ≥ POOL_MIN_WINDOW_MS` — the 24-hour rule.
 *      Measured from `max(now, opensAt)` so a pod formed inside its own window
 *      and a pod READ late are refused by the same arithmetic. A close already
 *      in the past is this clause's degenerate case: `msRemaining` goes negative
 *      and the reason is the same `window_too_short`. Callers that need to tell
 *      "closed" from "too short" read `msRemaining` rather than a second reason
 *      word — one predicate, one reason (§9).
 *
 * @returns {{eligible: boolean, reason: string|null, closesAt?: string,
 *   closeReason?: string, opensAt?: string, weekKey?: string, msRemaining?: number}}
 *   `reason` is null exactly when `eligible` is true. The window fields are
 *   present whenever a battle Monday was derivable — including on the
 *   `window_too_short` refusal, which is the case PR 2 must explain.
 */
export function poolEligible(group, now = new Date()) {
  if (group?.status !== 'forming') return { eligible: false, reason: POOL_INELIGIBLE.NOT_FORMING };
  if (group?.isDev === true) return { eligible: false, reason: POOL_INELIGIBLE.DEV_POD };
  if (group?.isTraining === true) return { eligible: false, reason: POOL_INELIGIBLE.TRAINING_POD };
  if (POOL_EXCLUDED_SLOT_IDS.includes(group?.slotId)) {
    return { eligible: false, reason: POOL_INELIGIBLE.SLOT_EXCLUDED };
  }

  const mondayEtDate = battleMondayEtDateFor(group);
  const week = backingWeekFor(mondayEtDate);
  if (week == null) return { eligible: false, reason: POOL_INELIGIBLE.NO_BATTLE_MONDAY };

  const close = closesAtFor(group);
  const opensAt = opensAtFor(group);
  const nowMs = msOf(now);
  if (!Number.isFinite(nowMs)) return { eligible: false, reason: POOL_INELIGIBLE.NO_BATTLE_MONDAY };

  const fromMs = Math.max(nowMs, new Date(opensAt).getTime());
  const msRemaining = new Date(close.closesAt).getTime() - fromMs;
  const window = {
    closesAt: close.closesAt,
    closeReason: close.closeReason,
    opensAt,
    weekKey: week.weekKey,
    msRemaining,
  };

  if (msRemaining < POOL_MIN_WINDOW_MS) {
    return { eligible: false, reason: POOL_INELIGIBLE.WINDOW_TOO_SHORT, ...window };
  }
  return { eligible: true, reason: null, ...window };
}
