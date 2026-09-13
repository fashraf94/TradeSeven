// src/config/liveDraftSlots.js
//
// League — Competitive Live Draft: the weekly SLOT SCHEDULE (config-driven,
// founder-editable). This module is PURE DATA + trivial lookups — zero imports,
// browser- and Node-safe — so both the server claim path (api/_utils/
// liveDraftFormation.js) and the Phase-4 picker read ONE source of truth.
//
// FOUNDER-EDITABLE: to add/remove/retune slots, edit LIVE_DRAFT_SLOTS below.
// Nothing here is hardcoded downstream — the fire instant of each slot is
// derived at runtime from `weekday`/`hourEt`/`minuteEt` via the DST-safe
// `Intl America/New_York` idiom (api/_utils/liveDraftFormation.js), never a
// baked-in UTC hour, so a DST transition never shifts a slot's ET wall-clock.
//
// GATING: this config is inert unless LEAGUE_LIVE_DRAFT is on. Flag-off, no
// caller consults it (byte-identical bar).
//
// SLOT SHAPE:
//   id       — stable, URL/id-safe token ([A-Za-z0-9_-]); the occurrence's
//              group doc id is derived from it, so DO NOT reuse an id for a
//              different day/time once live.
//   label    — human copy for the picker ("Sun 7:00pm ET").
//   weekday  — ET weekday short name: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
//              | 'Sat' | 'Sun' (matches tournamentTime.getEtParts().weekday).
//   hourEt   — ET hour, 0–23 (wall-clock, NOT UTC).
//   minuteEt — ET minute, 0–59.
//   enabled  — OPTIONAL. Omitted means ENABLED (so every slot that predates
//              this field is byte-identical). Set `enabled: false` to take a
//              slot off the board WITHOUT deleting its definition — the id
//              stays reserved (ids must never be reused for a different
//              day/time once live) and the slot keeps appearing in the picker
//              feed marked unavailable, rather than vanishing. Honored at
//              THREE points, all of which read this one field:
//                1. claimSlotSeat  — refuses with `slot_disabled`
//                   (api/_utils/liveDraftFormation.js).
//                2. getSlotOccupancy — reports `enabled: false` on the row, so
//                   the picker closes its own claim door (same file).
//                3. findDueSlotGroups — skips a disabled slot's FORMING group,
//                   so a group claimed BEFORE the disable can never fire
//                   (api/_utils/liveDraftLifecycle.js).
//
// V1 density (founder-locked, 2026-07-17): sparse, weekend-weighted (~4/week).
// The Monday slot is 8:45am ET — the S3 margin so a fully-abandoned draft
// completes before the 9:30 open by construction
// (slot time + max draft duration + one fire-cron cadence < 9:30).

export const LIVE_DRAFT_SLOTS = Object.freeze([
  Object.freeze({ id: 'wed-1900', label: 'Wed 7:00pm ET', weekday: 'Wed', hourEt: 19, minuteEt: 0 }),
  Object.freeze({ id: 'sat-1200', label: 'Sat 12:00pm ET', weekday: 'Sat', hourEt: 12, minuteEt: 0 }),
  Object.freeze({ id: 'sun-1900', label: 'Sun 7:00pm ET', weekday: 'Sun', hourEt: 19, minuteEt: 0 }),
  // DISABLED 2026-09-12 — N1 mitigation. A pod that reaches `battle` after the
  // Monday duty marker is set gets no agent layer all week, and nothing notices
  // (N1 discovery report, verdict CONFIRMED; root cause tournamentOrchestrator.js
  // :519-526). This slot is the only currently-reachable trigger. RE-ENABLE
  // CONDITION: fix B (the inline flip hands the pod to the agent pipeline) merged
  // AND smoked on a real Monday. Do not re-enable on the strength of this PR.
  Object.freeze({ id: 'mon-0845', label: 'Mon 8:45am ET', weekday: 'Mon', hourEt: 8, minuteEt: 45, enabled: false }),
]);

/** The ET weekday short names, in getEtParts() order (Sun=0 … Sat=6). The
 *  single source that maps a slot's `weekday` name to a day-of-week number for
 *  the pure date math in liveDraftFormation.js. */
export const ET_WEEKDAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

/** Lookup a slot by its id, or null. */
export function slotById(id) {
  return LIVE_DRAFT_SLOTS.find((s) => s.id === id) ?? null;
}

/** True iff `id` names a configured slot — the id-shape gate for the endpoints.
 *  Deliberately independent of `enabled`: a disabled slot is still a KNOWN slot,
 *  so a claim on it earns the specific `slot_disabled` refusal rather than the
 *  misleading "isn't on the schedule" one. */
export function isKnownSlotId(id) {
  return typeof id === 'string' && LIVE_DRAFT_SLOTS.some((s) => s.id === id);
}

/** Is this slot claimable/fireable? DEFAULT-ENABLED: an ABSENT `enabled` means
 *  enabled, so a slot definition without the field behaves exactly as it did
 *  before the field existed. A null/absent slot is NOT enabled (an unknown id
 *  can never be claimed).
 *
 *  FAIL-SAFE on a malformed value: only `undefined` and `true` read as enabled.
 *  A typo'd disable — `enabled: null`, `enabled: 0`, `enabled: 'false'` — reads
 *  as DISABLED rather than silently shipping an enabled slot. Writing
 *  `slot.enabled !== false` here would invert that: the author would believe
 *  they had taken a slot off the board while it stayed live. For a safety
 *  mechanism, the wrong guess must be the harmless one. */
export function isSlotEnabled(slot) {
  if (slot == null) return false;
  return slot.enabled === undefined || slot.enabled === true;
}

/** `isSlotEnabled` by id — false for an unknown id. Callers that hold a group
 *  doc's `slotId` (rather than a slot object) use this. */
export function isSlotIdEnabled(id) {
  return isSlotEnabled(slotById(id));
}

/** True only when `id` names a KNOWN slot that is not enabled. The fire path
 *  skips on THIS, never on `!isSlotIdEnabled`, so a group carrying an absent or
 *  unrecognized `slotId` keeps its pre-existing behavior exactly (fail-open)
 *  while a founder-disabled slot is fail-closed. Derived from isSlotEnabled
 *  rather than re-testing `=== false`, so the two can never disagree about what
 *  "disabled" means. */
export function isSlotIdDisabled(id) {
  const slot = slotById(id);
  return slot != null && !isSlotEnabled(slot);
}
