// src/constants/perGameLoadout.js
//
// Build A2 — the per-game loadout MODEL, one module for the server and the browser (founder rulings D1, FD-1, FD-2,
// FD-3, FD-11; build report docs/audits/20261106_BUILD_ARMORY_A2.md §2). Pure: no clock, no I/O. Its only imports are
// two zero-import modules (src/constants/leagueTournament.js, src/utils/marketCalendar.js), so api/ may import it
// under the June 2026 import rule (BUILD_RULES §4); api/_utils/perGameLoadout.test.js's real import of the server
// helper that imports this module is the dependency-surface guard.
//
// A loadout is an archetype and a book, per kind of game:
//   - BAGGERBOMB: the slot `agents/{rankedId}.loadouts.baggerbomb` = { archetype, book }, server-written. While it is
//     absent the BaggerBomb loadout IS the default, the ranked record's own fields (FD-11); the first loadout write of
//     either kind snapshots the slot from them (materializeBaggerbombSlot), so after the first change the two are
//     independent and a League change can never silently move BaggerBomb.
//   - LEAGUE: the ranked record's own fields, `archetype` / `equippedWatchlistId` / `equippedWatchlistName` (FD-2).
//     No new field.
// The book holds a reference, never the names (Phase 0 §8): { ref: { watchlistId } | null, name, pin: null }. `pin`
// stays null in A2.
//
// THE LEAGUE LOCK (FD-3) is derived, never stored: the player has a RANKED group in any state before COMPLETE,
// EXPIRED or VOIDED. That is exactly selectMyGroup's allowlist (FORMING, DRAFTING, AWAITING_OPEN, BATTLE; training
// pods excluded), so the lock IS `selectMyGroup(docs) !== null` — the server writers' refusal
// (api/_utils/perGameLoadout.js readLeagueLockInTx), the client's cards and the armory's lock line all read this one
// rule (BUILD_RULES §9). Training pods never lock it: their clone copies the loadout once at provisioning.
//
// The lock's end is the close of the week's last battle day: from the pod's first battle day (battleAnchorEtDateOf),
// WEEK_DAYS_REQUIRED trading days on the NYSE calendar of record, at that day's close (4:00 PM ET, 1:00 PM on an
// early close).

import { GROUP_STATUS, WEEK_DAYS_REQUIRED, selectMyGroup } from './leagueTournament.js';
import { getSessionForDate, MARKET_HOURS } from '../utils/marketCalendar.js';

/** The two kinds of game a loadout belongs to (D1). The writers' `loadout` field takes these words. */
export const LOADOUT_KINDS = Object.freeze({ BAGGERBOMB: 'baggerbomb', LEAGUE: 'league' });
export const LOADOUT_KIND_LIST = Object.freeze([LOADOUT_KINDS.BAGGERBOMB, LOADOUT_KINDS.LEAGUE]);

/**
 * The writers' `loadout` field, read: absent (undefined or null) is LEAGUE, today's behaviour; one of the two words is
 * itself; anything else is null (the writer answers 400).
 */
export function loadoutKindOf(raw) {
  if (raw === undefined || raw === null) return LOADOUT_KINDS.LEAGUE;
  return LOADOUT_KIND_LIST.includes(raw) ? raw : null;
}

const idOf = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);

/** A book: the reference and the name it was set with, or no book (`ref` null: the open market). */
export function bookFrom(watchlistId, name) {
  const id = idOf(watchlistId);
  return { ref: id ? { watchlistId: id } : null, name: id ? (typeof name === 'string' ? name : '') : null, pin: null };
}

/** The book's list id, or null for no book. */
export const bookIdOf = (book) => idOf(book?.ref?.watchlistId);

/** The League loadout: the ranked record's own fields (FD-2). */
export function leagueLoadoutOf(agent) {
  return {
    archetype: idOf(agent?.archetype),
    book: bookFrom(agent?.equippedWatchlistId, agent?.equippedWatchlistName),
  };
}

/** The BaggerBomb slot snapshotted from the ranked record's fields: what BaggerBomb wears while the slot is absent. */
export function materializeBaggerbombSlot(agent) {
  return leagueLoadoutOf(agent);
}

/** The stored BaggerBomb slot, read defensively (server-written only), or null while it is absent or unreadable. */
export function baggerbombSlotOf(agent) {
  const slot = agent?.loadouts?.baggerbomb;
  if (!slot || typeof slot !== 'object' || !idOf(slot.archetype)) return null;
  const book = slot.book && typeof slot.book === 'object' ? slot.book : null;
  return { archetype: slot.archetype, book: bookFrom(book?.ref?.watchlistId, book?.name) };
}

/**
 * The BaggerBomb loadout the next deploy carries: the slot, or the default while it is absent (FD-11). `isDefault`
 * says which, so a surface can say nothing different and a writer knows the slot still has to be snapshotted.
 */
export function baggerbombLoadoutOf(agent) {
  const slot = baggerbombSlotOf(agent);
  return slot ? { ...slot, isDefault: false } : { ...materializeBaggerbombSlot(agent), isDefault: true };
}

/** Both loadouts' archetypes, each once (the plays ledger's active set, R4). */
export function loadoutArchetypesOf(agent) {
  const out = [];
  for (const a of [leagueLoadoutOf(agent).archetype, baggerbombLoadoutOf(agent).archetype]) {
    if (a && !out.includes(a)) out.push(a);
  }
  return out;
}

// ── The League lock (FD-3) ───────────────────────────────────────────────────────────────────────────────────────

const ET_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isEtDate = (value) => typeof value === 'string' && ET_DATE_RE.test(value);

/** 'YYYY-MM-DD' + n calendar days, on UTC-midnight calendar dates (DST-immune; no offsets). */
function addEtDays(etDate, n) {
  const [y, m, d] = etDate.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

const ET_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** An instant's ET calendar date and minutes since ET midnight, or null for an unreadable instant. */
function etPartsOf(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const parts = ET_PARTS.formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + parseInt(get('minute'), 10) };
}

/** ms since the epoch for a stored time: an ISO string, a Date, a number, or a Firestore timestamp (either SDK). */
function msOf(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') { const t = Date.parse(raw); return Number.isFinite(t) ? t : null; }
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw.getTime() : null;
  if (raw && typeof raw.toMillis === 'function') { try { return raw.toMillis(); } catch { return null; } }
  if (raw && typeof raw.seconds === 'number') return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
  return null;
}

const isTradingDay = (etDate) => getSessionForDate(etDate)?.isTradingDay === true;

/**
 * The battle week's first trading day for a pod formed at `ms`: the READ-side twin of the writer's
 * api/_utils/liveDraftFormation.js deriveBattleStartWeek (a Monday before 09:30 ET is that Monday, any later instant
 * the upcoming Monday; a holiday walks forward to the week's first trading day). perGameLoadout.test.js holds the two
 * in agreement across a calendar of instants, so they cannot drift (the currentBaseLayerWeek precedent).
 */
export function battleAnchorEtDateFromInstant(ms) {
  const parts = etPartsOf(ms);
  if (!parts) return null;
  const [y, m, d] = parts.date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const openMinutes = MARKET_HOURS.open.hour * 60 + MARKET_HOURS.open.minute;
  const monday = dow === 1
    ? (parts.minutes < openMinutes ? parts.date : addEtDays(parts.date, 7))
    : addEtDays(parts.date, (1 - dow + 7) % 7);
  let anchor = monday;
  for (let guard = 0; !isTradingDay(anchor); guard++) {
    if (guard >= 14 || getSessionForDate(anchor) === null) return null;
    anchor = addEtDays(anchor, 1);
  }
  return anchor;
}

/**
 * The pod's first battle day ('YYYY-MM-DD', ET), from the fields its writers stamp, in this order: the BATTLE handoff's
 * `startAnchor` (live-draft and training pods), the first banked day's `recordedDate`, the slot claim's
 * `battleStartWeek` (a pre-battle slot pod), else the lobby pod's formation instant through the writer's own rule
 * (a live-draft pod's scheduled draft, the backingWeek.js precedent). Null when none is readable.
 */
export function battleAnchorEtDateOf(group) {
  if (!group || typeof group !== 'object') return null;
  if (isEtDate(group.startAnchor?.anchorEtDate)) return group.startAnchor.anchorEtDate;
  if (isEtDate(group.dailyScores?.day1?.recordedDate)) return group.dailyScores.day1.recordedDate;
  if (isEtDate(group.battleStartWeek?.anchorEtDate)) return group.battleStartWeek.anchorEtDate;
  const at = group.isLiveDraft === true ? (msOf(group.scheduledDraftAt) ?? msOf(group.createdAt)) : msOf(group.createdAt);
  return at === null ? null : battleAnchorEtDateFromInstant(at);
}

/**
 * When the League week ends: the close of the WEEK_DAYS_REQUIRED-th trading day from the pod's first battle day, in ms
 * since the epoch. Null when the anchor is unreadable or the walk leaves the calendar's maintained years (the lock
 * still holds; the line then names no date).
 */
export function leagueWeekEndMsOf(group) {
  const anchor = battleAnchorEtDateOf(group);
  if (!anchor) return null;
  let day = anchor;
  let counted = 0;
  for (let guard = 0; guard < 31; guard++) {
    const session = getSessionForDate(day);
    if (!session) return null;
    if (session.isTradingDay) {
      counted += 1;
      if (counted === WEEK_DAYS_REQUIRED) return session.closeMs;
    }
    day = addEtDays(day, 1);
  }
  return null;
}

/** The statuses that hold the lock: selectMyGroup's allowlist, named for the rows. */
export const LEAGUE_LOCK_STATUSES = Object.freeze([GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING, GROUP_STATUS.AWAITING_OPEN, GROUP_STATUS.BATTLE]);

/** The lock for the player's active ranked group as selectMyGroup picked it (the client's subscribeMyGroup answer). */
export function leagueLockOfGroup(group) {
  if (!group) return { locked: false, groupId: null, status: null, endsAtMs: null };
  return { locked: true, groupId: group.id ?? null, status: group.status ?? null, endsAtMs: leagueWeekEndMsOf(group) };
}

/** THE LEAGUE LOCK (FD-3), from the player's group documents ({ id, ...group }): the one rule both sides read. */
export function leagueLockOf(groupDocs) {
  return leagueLockOfGroup(selectMyGroup(groupDocs));
}
