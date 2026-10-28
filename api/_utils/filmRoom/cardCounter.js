// api/_utils/filmRoom/cardCounter.js
//
// Film Room B2 item 6 — THE COUNTER (Build B spec §2 "the counter", §5;
// shared contract §4; Amendment G RG-4): the logic behind
// GET /api/film-room/counter, apart from the route so it is testable over the
// tape suites' in-memory Firestore.
//
//   THE READ    the owner's tape days in a window, through the Admin SDK's
//               collection-group query on `tape` — `ownerId == uid` and
//               `from ≤ etDate ≤ to` (firestore.indexes.json: the tape
//               COLLECTION_GROUP composite on ownerId ASC, etDate ASC) — with
//               the FIELD MASK `tags`, `etDate`, `ownerId`, `agentId`,
//               `battleId` (RG-4 adds the last two). Nothing else of a tape
//               day leaves Firestore here: no check, no score, no price.
//   THE COUNTS  per agent, per situation, per ET TRADING WEEK (keyed by the
//               week's Monday, an ET calendar date): the number of stored tag
//               ITEMS (the spec's "tags per situation per week") and the
//               number of MOMENTS the helper derives from them. Every count is
//               derived; nothing is stored.
//   RECURRENCES for each open Watch card (route `watch`, at `card`, not
//               shelved — RG-4: recurrences belong to the card's AGENT): every
//               moment of the card's situation, on any holding, on a battle
//               day of the same agent whose first tagged check falls after the
//               card's creation — each with its battle, day, symbol and
//               from–to, so `since-last-time` can link to it. The card's own
//               source moment is never a recurrence.
// The cards and their shelving come from the ledger's read (cardStore.js
// readCards): computed against the agent's current archetype, never written.

import { momentsOf, sameMoment, MOMENT_KEYS } from '../../../src/utils/filmRoomMoments.js';
import { etDateOf, isEtDate, nextCalendarDate } from '../../../src/utils/tapeSchedule.js';
import { TAPE_SUBCOLLECTION } from '../../../src/constants/filmTape.js';
import { readCards, isOpen } from './cardStore.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);
const msOf = (v) => { if (typeof v !== 'string') return null; const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; };

/**
 * RG-4 — the fields the counter reads of a tape day, and no other. B2.1 B3 (Amendment H RH-6) adds the situations'
 * coverage STATUS alone (`coverage.tags.status`, never its note or sources): a day whose situations are unavailable
 * gives one answer everywhere — it is neither counted nor listed as a recurrence, only counted as unavailable.
 */
export const COUNTER_FIELD_MASK = Object.freeze(['tags', 'etDate', 'ownerId', 'agentId', 'battleId', 'coverage.tags.status']);
/**
 * The default window: the last 120 calendar days of ET dates, ending today — this build's own choice of a bounded
 * read (no ruling fixes it; ruling 18's "120 days of film" limits DRILLS, not counting — review R1-2). It is floored at
 * the earliest open Watch card's creation day (buildCounter), so a Watch card's recurrences are never cut by it.
 */
export const COUNTER_WINDOW_DAYS = 120;
/** The longest window a caller may name, in calendar days. */
export const COUNTER_WINDOW_MAX_DAYS = 400;

/** The Monday of `etDate`'s week, as an ET calendar date — the key of its ET trading week. Pure. */
export function tradingWeekOf(etDate) {
  if (!isEtDate(etDate)) return null;
  const [y, m, d] = etDate.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const back = (probe.getUTCDay() + 6) % 7;   // Monday → 0 … Sunday → 6
  return new Date(Date.UTC(y, m - 1, d - back, 12)).toISOString().slice(0, 10);
}

/** The ET dates `days` calendar days before `to`. */
function daysBefore(to, days) {
  const [y, m, d] = to.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days, 12)).toISOString().slice(0, 10);
}
/** Calendar days from `from` to `to`, inclusive of both ends. */
function spanDays(from, to) {
  const ms = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d, 12); };
  return Math.round((ms(to) - ms(from)) / 86_400_000) + 1;
}

/**
 * The window of ET dates the counter reads: the caller's `from`/`to` when
 * both are dates in order and the span is within the cap, else the default
 * ending on the ET date of `nowMs`. `{ error }` for a malformed request.
 */
export function windowOf(nowMs, { from = null, to = null } = {}) {
  const today = etDateOf(nowMs);
  if (from === null && to === null) return { from: daysBefore(today, COUNTER_WINDOW_DAYS), to: today };
  if (!isEtDate(from) || !isEtDate(to)) return { error: 'invalid_window' };
  if (from > to) return { error: 'invalid_window' };
  if (spanDays(from, to) > COUNTER_WINDOW_MAX_DAYS) return { error: 'window_too_long' };
  return { from, to };
}

const byDay = (a, b) => (a.etDate < b.etDate ? -1 : a.etDate > b.etDate ? 1 : a.battleId < b.battleId ? -1 : 1);

/**
 * The owner's tape days in the window, read once with the field mask: `days`, each `{ battleId, etDate, agentId,
 * items }` — only days that STORE tag items and whose situations are not unavailable (a day the tagger could not tag,
 * a skipped mode, a failed day store none and are left out) — and `unavailable`, each `{ battleId, etDate, agentId }`:
 * the days whose `coverage.tags` is unavailable (B2.1 B3, RH-6), items or none. Both oldest first.
 */
export async function readOwnerTapeWindow(db, { uid, from, to }) {
  const snap = await db.collectionGroup(TAPE_SUBCOLLECTION)
    .where('ownerId', '==', uid).where('etDate', '>=', from).where('etDate', '<=', to)
    .select(...COUNTER_FIELD_MASK).get();
  const days = [];
  const unavailable = [];
  for (const d of snap?.docs || []) {
    const data = typeof d.data === 'function' ? d.data() : d.data;
    if (!isObj(data) || data.ownerId !== uid) continue;
    if (!isEtDate(data.etDate) || !str(data.agentId) || !str(data.battleId)) continue;
    // RH-6: one answer everywhere — an unavailable day offers no moment, so it is neither counted nor a recurrence
    if (data.coverage?.tags?.status === 'unavailable') { unavailable.push({ battleId: data.battleId, etDate: data.etDate, agentId: data.agentId }); continue; }
    const items = Array.isArray(data.tags?.items) ? data.tags.items : null;
    if (!items) continue;
    days.push({ battleId: data.battleId, etDate: data.etDate, agentId: data.agentId, items });
  }
  return { days: days.sort(byDay), unavailable: unavailable.sort(byDay) };
}

/** The usable days alone (readOwnerTapeWindow's `days`). */
export async function readOwnerTapeDays(db, range) {
  return (await readOwnerTapeWindow(db, range)).days;
}

/** RH-6 — how many days in the window could not be read, per agent: `{ [agentId]: n }`. Derived. */
export function unavailableDaysOf(unavailable) {
  const out = {};
  for (const d of unavailable) out[d.agentId] = (out[d.agentId] ?? 0) + 1;
  return out;
}

/**
 * Weekly counts per agent, per situation, per ET trading week:
 * `{ [agentId]: { [situationId]: { [mondayEtDate]: { tags, moments } } } }`. Derived. Keyed by EVERY agent of the
 * caller with a tape day in the window — the owner's own data, as spec §5's "the owner's tape days" reads; the asked
 * `agentId` scopes the ledger and the recurrences, not this table (review L2-8). No screen reads it in this build.
 */
export function weeklyCounts(days) {
  const out = {};
  for (const day of days) {
    const week = tradingWeekOf(day.etDate);
    if (!week) continue;
    const perSituation = {};
    for (const it of day.items) if (isObj(it) && str(it.situationId)) perSituation[it.situationId] = (perSituation[it.situationId] ?? 0) + 1;
    if (!Object.keys(perSituation).length) continue;   // a day with no tag counts nothing, under no agent
    const moments = momentsOf(day.items);
    const a = (out[day.agentId] ??= {});
    for (const [situationId, tags] of Object.entries(perSituation)) {
      const s = (a[situationId] ??= {});
      const w = (s[week] ??= { tags: 0, moments: 0 });
      w.tags += tags;
      w.moments += moments.filter((m) => m.situationId === situationId).length;
    }
  }
  return out;
}

/** Is this card an open WATCH card — the kind the counter follows (RG-4)? `shelved` is the card's computed field. */
export const isOpenWatchCard = (card, archetype) => card?.route === 'watch' && isOpen(card, archetype) && card?.shelved !== true;

/**
 * The recurrences of one open Watch card over `days`: the moments of its
 * situation on the same agent's battle days whose first tagged check falls
 * after the card's creation — never its own source moment. Each carries its
 * battle, day and the moment's seven fields; nothing else (RG-6).
 */
export function recurrencesOf(card, days) {
  const since = msOf(card?.createdAt);
  if (since === null) return [];
  const out = [];
  for (const day of days) {
    if (day.agentId !== card.agentId) continue;
    for (const m of momentsOf(day.items)) {
      if (m.situationId !== card.situationId) continue;
      const from = msOf(m.from);
      if (from === null || from <= since) continue;
      if (day.battleId === card.source?.battleId && day.etDate === card.source?.etDate && sameMoment(m, { ...card.source, situationId: card.situationId })) continue;
      out.push({ battleId: day.battleId, etDate: day.etDate, ...Object.fromEntries(MOMENT_KEYS.map((k) => [k, m[k]])) });
    }
  }
  return out.sort((a, b) => (msOf(a.from) - msOf(b.from)) || (a.battleId < b.battleId ? -1 : 1));
}

/**
 * The counter's whole answer for one owner and one agent.
 *
 * @returns {Promise<{ agentId, archetypeCodeId, window: { from, to }, weekly, cards, open, cap, recurrences: { [entryId]: object[] }, unavailableDays: { [agentId]: number } }>}
 */
export async function buildCounter(db, { uid, agentId, nowMs, from = null, to = null }) {
  const asked = windowOf(nowMs, { from, to });
  if (asked.error) return { error: asked.error };
  // The ledger first: a Watch card older than the window would otherwise have its earlier recurrences silently
  // dropped and the screen would say none was recorded (review L1-2). The window's start is floored at the earliest
  // open Watch card's creation day — within the 400-day cap behind `to` — when the caller named no window.
  const ledger = await readCards(db, { uid, agentId });
  const window = { ...asked };
  if (from === null && to === null) {
    const earliest = ledger.cards.filter((c) => isOpenWatchCard(c, ledger.archetypeCodeId)).map((c) => etDateOf(c.createdAt)).filter(isEtDate).sort()[0] ?? null;
    const floor = daysBefore(window.to, COUNTER_WINDOW_MAX_DAYS - 1);
    if (earliest && earliest < window.from) window.from = earliest < floor ? floor : earliest;
  }
  const { days, unavailable } = await readOwnerTapeWindow(db, { uid, from: window.from, to: window.to });
  const recurrences = {};
  for (const card of ledger.cards) if (isOpenWatchCard(card, ledger.archetypeCodeId)) recurrences[card.entryId] = recurrencesOf(card, days);
  return {
    agentId, archetypeCodeId: ledger.archetypeCodeId, window, weekly: weeklyCounts(days),
    cards: ledger.cards, open: ledger.open, cap: ledger.cap, recurrences,
    // RH-6: the days in the window whose situations could not be read, per agent (the screen says so, RJ-7's style)
    unavailableDays: unavailableDaysOf(unavailable),
  };
}

/** The ET date after `etDate` — re-exported for the route's window arithmetic tests. */
export { nextCalendarDate };
