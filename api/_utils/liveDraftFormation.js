// api/_utils/liveDraftFormation.js
//
// League — Competitive Live Draft, Phase 1 (the FORMATION LAYER). Behind the
// LEAGUE_LIVE_DRAFT flag (the slot endpoints 404 flag-off; nothing here runs
// unless a slot is claimed). This module owns:
//
//   (1) SLOT → INSTANT resolution (nextSlotFireInstant) — the next future ET
//       wall-clock occurrence of a configured slot, DST-safe via the
//       `Intl America/New_York` idiom (getEtParts + the dual-offset round-trip,
//       the trainingLifecycle etOpenInstantIso precedent). Never a baked-in UTC
//       hour, so a DST transition never shifts a slot.
//   (2) battleStartWeek DERIVATION (deriveBattleStartWeek) — the NEXT Monday-open
//       at-or-after the slot: Sun→next-day Monday, Wed→the following Monday,
//       Mon-pre-open→that same Monday. A pure, holiday-aware Monday anchor,
//       DELIBERATELY DISTINCT from training's next-market-open-any-day anchor
//       (nextMarketOpenAnchor). Shaped { mondayEtDate, anchorEtDate, anchorIso }
//       so Phase 2's completion handoff can ride the existing date-based
//       AWAITING_OPEN→BATTLE flip (anchorDateReached reads anchorEtDate).
//   (3) LAZY GROUP creation + CLAIM/RELEASE (claimSlotSeat / releaseSlotSeat) —
//       the first claim creates a FORMING slot group at a DETERMINISTIC id
//       (crash-safe get-or-create, the formGroupFromLobby precedent), stamped
//       with scheduledDraftAt (S2 self-sufficiency — the standalone fire cron
//       finds it by this field alone) + battleStartWeek. Subsequent claims join
//       up to GROUP_SIZE seats; a release frees a seat; the LAST human leaving
//       DELETES the group (restoring "0 humans = never materializes" — expiry is
//       structural, no cleanup job, no expiry state). Every mutation is a single
//       fresh-read transaction (the flip.js pattern) so a concurrent
//       claim/release on the last seat can neither strand a ghost group nor
//       double-create.
//   (4) OCCUPANCY read (getSlotOccupancy) — per-slot human counts + names for
//       the Phase-4 picker; a cheap per-occurrence doc read, no new subscription.
//
// SEAT MODEL: a slot group holds HUMANS ONLY pre-fire (players.length 1–4, no
// CPUs). CPU-fill happens at FIRE (Phase 2), matching the founder's model. This
// also gives a safety property for free: a 1–3-human slot group has
// players.length !== GROUP_SIZE, so the shared eligibility query
// (fetchEligibleGroupsByStatus) already excludes it from the Monday single-shot
// resolve AND every status==='battle' consumer. The one case that still passes
// the size filter — a FULL 4-human FORMING slot group — is excluded from the
// Monday pipeline by an explicit isLiveDraft guard (tournamentOrchestrator.js).
//
// USERPOOL: deferred to fire (userPool:[] at creation). The claim path takes no
// network (a clean transaction); Phase 2's fire cron fetches the ranked universe
// and stamps it just before draft-init — a fresh board, and the load-tolerant
// place for the fetch.
//
// FIRE-FIREWALL SAFETY: a slot group is FORMING and competitive (never
// isTraining). It carries baselinePolicy IFF LEAGUE_CANONICAL_OPEN_CAPTURE is on
// — identical to formGroupFromLobby — so from BATTLE onward it is byte-identical
// to a single-shot-formed group. It NEVER touches the sweep / banking / scorers
// (all gate on status==='battle'; a FORMING/DRAFTING/AWAITING_OPEN group is
// invisible to them).
//
// Imports the zero-import schema module from src/ under the revised June 2026
// import rule (BUILD_RULES §4); the co-located test's real import of THIS module
// is the dependency-surface guard. The NYSE holiday calendar is REUSED from
// marketSchedule.js (never a third copy of the list, §6).

import { getEtParts, toIso } from './tournamentTime.js';
import { isMarketHoliday } from './marketSchedule.js';
import {
  GROUP_STATUS,
  GROUP_SIZE,
  TOURNAMENT_GROUPS_COLLECTION,
  BASELINE_POLICY,
  createClaimSystemState,
  isoWeekString,
} from '../../src/constants/leagueTournament.js';
import { LEAGUE_CANONICAL_OPEN_CAPTURE } from '../../src/config/featureFlags.js';
import { LIVE_DRAFT_SLOTS, ET_WEEKDAY_NAMES, slotById } from '../../src/config/liveDraftSlots.js';

const LOG_PREFIX = '[LiveDraftFormation]';

// 9:30 AM ET market open, minutes since ET midnight — mirrors tournamentTime.js
// (module-private there) and trainingLifecycle.js:85.
const MARKET_OPEN_MIN = 9 * 60 + 30;

// The deterministic group-doc id namespace: `lds_<slotId>_<fireEtDate>`. Encodes
// the slot OCCURRENCE, so concurrent claims for the same occurrence transact on
// ONE doc (race-safe create-or-join) and a fresh occurrence gets a fresh group.
// Matches isValidForgeId ([A-Za-z0-9_-], ≤200).
export const LIVE_DRAFT_GROUP_ID_PREFIX = 'lds_';

// Sentinel prefix for the claim/release errors the endpoints map to HTTP.
export const SLOT_SENTINEL_PREFIX = '__live_draft_slot:';
function slotError(code) {
  return new Error(SLOT_SENTINEL_PREFIX + code);
}

/** The deterministic slot-group doc id for one occurrence. */
export function slotGroupId(slotId, fireEtDate) {
  return `${LIVE_DRAFT_GROUP_ID_PREFIX}${slotId}_${fireEtDate}`;
}

// ==================== PURE ET DATE MATH (DST-immune) ====================
//
// All helpers operate on 'YYYY-MM-DD' ET-calendar strings via UTC-noon
// arithmetic, so they never touch a wall-clock instant and are DST-immune;
// getEtParts (Intl) owns the only instant→ET conversion. Mirrors the
// trainingLifecycle.js anchor helpers (kept local — pure date math, not scoring;
// the holiday LIST itself is reused from marketSchedule.js, never re-copied).

function etDateToUtcNoon(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToEtString(dt) {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** The ET calendar date `n` days from `etDate` (n may be negative). */
function addEtDays(etDate, n) {
  const dt = etDateToUtcNoon(etDate);
  dt.setUTCDate(dt.getUTCDate() + n);
  return utcDateToEtString(dt);
}

/** Day-of-week for an ET calendar date: 0=Sun … 6=Sat (timezone-independent). */
function etDateDow(etDate) {
  return etDateToUtcNoon(etDate).getUTCDay();
}

/** Is this ET calendar date a trading day (Mon–Fri, not a NYSE holiday)? */
function etDateIsTradingDay(etDate) {
  const dow = etDateDow(etDate);
  if (dow === 0 || dow === 6) return false;
  return !isMarketHoliday(etDate);
}

/**
 * The UTC instant (ISO) of a given ET wall-clock time (hour:minute) on an ET
 * date. Tries both DST offsets and keeps the one that round-trips back to the
 * same ET date + minutes through getEtParts — no offset math, no tz library
 * (the trainingLifecycle etOpenInstantIso idiom, parameterized on time).
 */
export function etWallClockInstantIso(etDate, hour, minute) {
  const targetMin = hour * 60 + minute;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  for (const offset of ['-04:00', '-05:00']) {
    const candidate = new Date(`${etDate}T${hh}:${mm}:00.000${offset}`);
    const p = getEtParts(candidate);
    if (p.date === etDate && p.minutes === targetMin) return candidate.toISOString();
  }
  // Unreachable for real slot times (none sit in the 2–3am DST gap); honest
  // fallback rather than a throw.
  return new Date(`${etDate}T${hh}:${mm}:00.000-05:00`).toISOString();
}

// ==================== (1) SLOT → NEXT FIRE INSTANT ====================

/**
 * The NEXT future fire instant of `slot` relative to `now`: the earliest ET
 * date on/after today whose ET weekday matches the slot AND whose ET wall-clock
 * instant is strictly after `now`. Returns `{ fireIso, fireEtDate }`.
 * Scans up to 14 ET days (covers any weekly slot with margin).
 */
export function nextSlotFireInstant(slot, now = new Date()) {
  const wnum = ET_WEEKDAY_NAMES.indexOf(slot.weekday);
  if (wnum < 0) throw new Error(`${LOG_PREFIX} bad slot weekday "${slot.weekday}" for slot "${slot.id}"`);
  const startEtDate = getEtParts(now).date;
  const nowMs = now.getTime();
  for (let offset = 0; offset <= 14; offset++) {
    const etDate = addEtDays(startEtDate, offset);
    if (etDateDow(etDate) !== wnum) continue;
    const fireIso = etWallClockInstantIso(etDate, slot.hourEt, slot.minuteEt);
    if (new Date(fireIso).getTime() > nowMs) return { fireIso, fireEtDate: etDate };
  }
  // Unreachable within 14 days for a weekly slot — surfaced, never silent.
  throw new Error(`${LOG_PREFIX} no upcoming instant for slot "${slot.id}" within 14 days of ${startEtDate}`);
}

// ==================== (2) battleStartWeek DERIVATION ====================

/**
 * The battle-start anchor for a slot fired at `fireIso`: the FIRST Monday-open
 * at-or-after the slot. Rule (founder-locked):
 *   - fire on Monday BEFORE the 9:30 open  → that same Monday
 *   - fire on Monday at/after the open      → the following Monday
 *   - fire any other day                    → the upcoming Monday
 * Holiday-aware: if the target Monday is a NYSE holiday, the anchor advances to
 * that week's first trading day (Tue…), so "battle starts the week's first open"
 * holds. Returns `{ mondayEtDate, anchorEtDate, anchorIso }`:
 *   mondayEtDate — the target Monday (the "week" label).
 *   anchorEtDate — that week's first trading day (== mondayEtDate unless the
 *                  Monday is a holiday); the date a date-based flip compares.
 *   anchorIso    — the 09:30 ET instant of anchorEtDate (display).
 * PURE (no I/O beyond the holiday calendar) and DST-immune.
 */
export function deriveBattleStartWeek(fireIso) {
  const { date, minutes } = getEtParts(new Date(fireIso));
  const dow = etDateDow(date); // 0=Sun … 6=Sat
  let mondayEtDate;
  if (dow === 1) {
    // Fire lands on a Monday: same Monday if strictly pre-open, else next week.
    mondayEtDate = minutes < MARKET_OPEN_MIN ? date : addEtDays(date, 7);
  } else {
    const daysUntilMonday = (1 - dow + 7) % 7; // 1..6 for Tue..Sun
    mondayEtDate = addEtDays(date, daysUntilMonday);
  }
  let anchorEtDate = mondayEtDate;
  let guard = 0;
  while (!etDateIsTradingDay(anchorEtDate) && guard++ < 14) {
    anchorEtDate = addEtDays(anchorEtDate, 1);
  }
  return { mondayEtDate, anchorEtDate, anchorIso: etWallClockInstantIso(anchorEtDate, 9, 30) };
}

/**
 * The EFFECTIVE battle anchor for a pod at `now` (fire or completion time), with
 * the stale-anchor guard. battleStartWeek is stamped at CLAIM (Phase 1); a pod
 * that fires/completes LATE — a cron gap, or a group that lingered in FORMING
 * past its stamped Monday — would otherwise carry a PAST anchor and flip straight
 * to BATTLE on a stale/mid-week date. So: if the stamped anchor's date is still
 * on-or-after today, use it UNCHANGED (this preserves the inline Monday-pre-open
 * path — today's Monday is not stale); if it is strictly in the PAST (or absent),
 * RE-DERIVE the next Monday-open at-or-after `now`. Returns
 * `{ anchorEtDate, anchorIso, battleStartWeek, restamped }` — when `restamped`,
 * the caller should also re-stamp group.battleStartWeek so the doc stays honest.
 */
export function effectiveBattleAnchor(group, now = new Date()) {
  const nowEtDate = getEtParts(now).date;
  const stamped = group?.battleStartWeek;
  if (stamped && typeof stamped.anchorEtDate === 'string' && typeof stamped.anchorIso === 'string'
      && stamped.anchorEtDate >= nowEtDate) {
    return { anchorEtDate: stamped.anchorEtDate, anchorIso: stamped.anchorIso, battleStartWeek: stamped, restamped: false };
  }
  const fresh = deriveBattleStartWeek(toIso(now));
  return { anchorEtDate: fresh.anchorEtDate, anchorIso: fresh.anchorIso, battleStartWeek: fresh, restamped: true };
}

// ==================== (3) LAZY GROUP + CLAIM / RELEASE ====================

function groupRefFor(db, groupId) {
  return db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(groupId);
}

/**
 * The initial slot-group doc — humans-only (this one seat), FORMING, self-
 * sufficient for the fire pass. NOT the 4-player createTournamentGroupDoc
 * factory (a slot group is partial pre-fire + carries slot fields); the shared
 * containers (claimSystem) are reused, never re-shaped.
 */
function buildInitialSlotGroupDoc({ odUserId, displayName, slotId, scheduledDraftAt, battleStartWeek, now }) {
  const nowIso = toIso(now);
  return {
    status: GROUP_STATUS.FORMING,
    roundNumber: 1,
    baseLayerWeek: isoWeekString(now),
    isLiveDraft: true,
    slotId,
    scheduledDraftAt,          // ISO UTC — the fire instant (S2: the fire cron finds it by this)
    battleStartWeek,           // { mondayEtDate, anchorEtDate, anchorIso } — the Monday anchor
    ...(LEAGUE_CANONICAL_OPEN_CAPTURE ? { baselinePolicy: BASELINE_POLICY.CANONICAL_OPEN } : {}),
    groupMembers: [odUserId],
    players: [{ odUserId, picks: [] }],
    seatNames: { [odUserId]: displayName ?? null },
    userPool: [],              // stamped fresh at FIRE (Phase 2), not at claim
    claimSystem: createClaimSystemState(),
    dailyScores: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Claim a seat in `slotId`'s NEXT occurrence. Transactional get-or-create on the
 * occurrence's deterministic group doc:
 *   - no doc            → create a FORMING slot group with this one human.
 *   - FORMING + member  → idempotent (no double-seat).
 *   - FORMING + < 4     → join.
 *   - FORMING + full    → `slot_full`.
 *   - not FORMING       → `draft_already_started` (the slot has fired).
 * Returns `{ groupId, slotId, scheduledDraftAt, battleStartWeek, humanCount,
 * created, joined, alreadyClaimed }`. Throws SLOT_SENTINEL_PREFIX errors
 * (unknown_slot / slot_full / draft_already_started / not_a_slot_group).
 */
export async function claimSlotSeat(db, { slotId, odUserId, displayName = null, now = new Date() } = {}) {
  const slot = slotById(slotId);
  if (!slot) throw slotError('unknown_slot');
  if (typeof odUserId !== 'string' || odUserId.length === 0) throw slotError('bad_user');

  const { fireIso, fireEtDate } = nextSlotFireInstant(slot, now);
  const battleStartWeek = deriveBattleStartWeek(fireIso);
  const groupId = slotGroupId(slotId, fireEtDate);
  const ref = groupRefFor(db, groupId);
  const nowIso = toIso(now);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      const doc = buildInitialSlotGroupDoc({
        odUserId, displayName, slotId, scheduledDraftAt: fireIso, battleStartWeek, now,
      });
      tx.set(ref, doc);
      return {
        groupId, slotId, scheduledDraftAt: fireIso, battleStartWeek,
        humanCount: 1, created: true, joined: false, alreadyClaimed: false,
      };
    }

    const group = snap.data();
    if (group.isLiveDraft !== true) throw slotError('not_a_slot_group');
    if (group.status !== GROUP_STATUS.FORMING) throw slotError('draft_already_started');

    const members = group.groupMembers || [];
    if (members.includes(odUserId)) {
      return {
        groupId, slotId, scheduledDraftAt: group.scheduledDraftAt ?? fireIso,
        battleStartWeek: group.battleStartWeek ?? battleStartWeek,
        humanCount: members.length, created: false, joined: false, alreadyClaimed: true,
      };
    }
    if (members.length >= GROUP_SIZE) throw slotError('slot_full');

    tx.update(ref, {
      groupMembers: [...members, odUserId],
      players: [...(group.players || []), { odUserId, picks: [] }],
      seatNames: { ...(group.seatNames || {}), [odUserId]: displayName ?? null },
      updatedAt: nowIso,
    });
    return {
      groupId, slotId, scheduledDraftAt: group.scheduledDraftAt ?? fireIso,
      battleStartWeek: group.battleStartWeek ?? battleStartWeek,
      humanCount: members.length + 1, created: false, joined: true, alreadyClaimed: false,
    };
  });
}

/**
 * Release a seat pre-fire. Transactional fresh-read on the group doc:
 *   - no doc / not a member → idempotent no-op (already gone / never seated).
 *   - not FORMING           → `draft_already_started` (can't leave a fired draft).
 *   - last human leaving     → DELETE the group (structural expiry).
 *   - otherwise             → drop the seat.
 * Returns `{ groupId, released, deleted, humanCount, reason }`. Throws
 * SLOT_SENTINEL_PREFIX errors (draft_already_started / not_a_slot_group).
 */
export async function releaseSlotSeat(db, groupId, { odUserId, now = new Date() } = {}) {
  if (typeof groupId !== 'string' || groupId.length === 0) throw slotError('bad_group');
  if (typeof odUserId !== 'string' || odUserId.length === 0) throw slotError('bad_user');
  const ref = groupRefFor(db, groupId);
  const nowIso = toIso(now);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { groupId, released: false, deleted: false, humanCount: 0, reason: 'group_not_found' };

    const group = snap.data();
    if (group.isLiveDraft !== true) throw slotError('not_a_slot_group');
    if (group.status !== GROUP_STATUS.FORMING) throw slotError('draft_already_started');

    const members = group.groupMembers || [];
    if (!members.includes(odUserId)) {
      return { groupId, released: false, deleted: false, humanCount: members.length, reason: 'not_a_member' };
    }

    const remaining = members.filter((id) => id !== odUserId);
    if (remaining.length === 0) {
      // Last human out — the group never materializes. Structural expiry, not a
      // cleanup job: delete the doc so a re-claim recreates it fresh.
      tx.delete(ref);
      return { groupId, released: true, deleted: true, humanCount: 0, reason: null };
    }

    const seatNames = { ...(group.seatNames || {}) };
    delete seatNames[odUserId];
    tx.update(ref, {
      groupMembers: remaining,
      players: (group.players || []).filter((p) => p.odUserId !== odUserId),
      seatNames,
      updatedAt: nowIso,
    });
    return { groupId, released: true, deleted: false, humanCount: remaining.length, reason: null };
  });
}

// ==================== (4) OCCUPANCY (picker read) ====================

/**
 * Per-slot occupancy for the week's slots (the Phase-4 picker): for each
 * configured slot, the NEXT occurrence's fire instant + human count + seated
 * names. A cheap per-occurrence doc read (one get per slot), no subscription.
 * Returns an array of
 * `{ slotId, label, weekday, scheduledDraftAt, battleStartWeek, groupId,
 *    humanCount, isFull, seats:[{ odUserId, name }] }`.
 */
export async function getSlotOccupancy(db, now = new Date()) {
  const rows = LIVE_DRAFT_SLOTS.map((slot) => {
    const { fireIso, fireEtDate } = nextSlotFireInstant(slot, now);
    return {
      slot,
      groupId: slotGroupId(slot.id, fireEtDate),
      scheduledDraftAt: fireIso,
      battleStartWeek: deriveBattleStartWeek(fireIso),
    };
  });

  const snaps = await Promise.all(rows.map((r) => groupRefFor(db, r.groupId).get()));

  return rows.map((r, i) => {
    const snap = snaps[i];
    const group = snap && snap.exists ? snap.data() : null;
    const members = group?.groupMembers || [];
    const seatNames = group?.seatNames || {};
    return {
      slotId: r.slot.id,
      label: r.slot.label,
      weekday: r.slot.weekday,
      scheduledDraftAt: r.scheduledDraftAt,
      battleStartWeek: r.battleStartWeek,
      groupId: r.groupId,
      humanCount: members.length,
      isFull: members.length >= GROUP_SIZE,
      seats: members.map((odUserId) => ({ odUserId, name: seatNames[odUserId] ?? null })),
    };
  });
}
