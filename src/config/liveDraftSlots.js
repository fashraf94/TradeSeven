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
//
// V1 density (founder-locked, 2026-07-17): sparse, weekend-weighted (~4/week).
// The Monday slot is 8:45am ET — the S3 margin so a fully-abandoned draft
// completes before the 9:30 open by construction
// (slot time + max draft duration + one fire-cron cadence < 9:30).

export const LIVE_DRAFT_SLOTS = Object.freeze([
  Object.freeze({ id: 'wed-1900', label: 'Wed 7:00pm ET', weekday: 'Wed', hourEt: 19, minuteEt: 0 }),
  Object.freeze({ id: 'sat-1200', label: 'Sat 12:00pm ET', weekday: 'Sat', hourEt: 12, minuteEt: 0 }),
  Object.freeze({ id: 'sun-1900', label: 'Sun 7:00pm ET', weekday: 'Sun', hourEt: 19, minuteEt: 0 }),
  Object.freeze({ id: 'mon-0845', label: 'Mon 8:45am ET', weekday: 'Mon', hourEt: 8, minuteEt: 45 }),
]);

/** The ET weekday short names, in getEtParts() order (Sun=0 … Sat=6). The
 *  single source that maps a slot's `weekday` name to a day-of-week number for
 *  the pure date math in liveDraftFormation.js. */
export const ET_WEEKDAY_NAMES = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

/** Lookup a slot by its id, or null. */
export function slotById(id) {
  return LIVE_DRAFT_SLOTS.find((s) => s.id === id) ?? null;
}

/** True iff `id` names a configured slot — the id-shape gate for the endpoints. */
export function isKnownSlotId(id) {
  return typeof id === 'string' && LIVE_DRAFT_SLOTS.some((s) => s.id === id);
}
