// src/screens/filmRoomV2/filmRoomCards.js
//
// Film Room B2 — THE CARD'S CLIENT SIDE (Build B spec §6, §7; Amendment G
// RG-2 … RG-5): the two endpoints as the screen calls them, the pure readers
// the regions render from, and the one hook that holds the cards state.
//
//   THE GATE   resolveFilmRoomCardsForBattle (src/utils/filmRoomGate.js): the
//              cards mode per battle owner, the same cached cockpit-status
//              verdict v2 reads; while it has not resolved, cards are OFF and
//              the screen is the current v2 byte for byte.
//   THE READS  GET /api/film-room/counter?agentId= — once per screen life for
//              the battle's agent (named by the battle document, before any
//              day's tape — review L1-6), again after a create or a retire, or
//              after a retire the server refused as stale; never a Firestore
//              read of the ledger from the client (v2 reads only the tape). A
//              re-read that fails keeps what was read (review L4-4).
//   THE WRITES POST /api/film-room/card — create and retire, each under ONE
//              op id per form or receipt (a client UUID in the forge-id
//              class), so a re-tap after a lost answer replays the same
//              operation and the store answers idempotently (review L4-9).
// The moments come from the one shared helper (src/utils/filmRoomMoments.js),
// so the screen lists exactly what the endpoint accepts.

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { readFilmRoomVerdict, resolveFilmRoomCardsForBattle, filmRoomBattleId } from '../../utils/filmRoomGate';
import { momentsOf, momentAnchor } from '../../utils/filmRoomMoments';
import { numberAt } from './filmRoomModel';

export const FILM_ROOM_CARD_PATH = '/api/film-room/card';
export const FILM_ROOM_COUNTER_PATH = '/api/film-room/counter';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// ── the endpoints ───────────────────────────────────────────────────────────

async function bearer() {
  try {
    const user = getAuth().currentUser;
    return user ? await user.getIdToken() : null;
  } catch {
    return null;
  }
}

/** `{ ok, status, body }` for one request; never throws (a failure is `{ ok: false, status: 0, body: null }`). */
async function ask(url, init) {
  try {
    const token = await bearer();
    if (!token) return { ok: false, status: 0, body: null };
    const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

/** The counter for the battle's agent. */
export const requestCounter = (agentId) => ask(`${FILM_ROOM_COUNTER_PATH}?agentId=${encodeURIComponent(agentId)}`, { method: 'GET' });
/** One card operation (create or retire). */
export const postCard = (body) => ask(FILM_ROOM_CARD_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
/** A fresh op id in the forge-id class (letters, digits, - and _). */
export function newOpId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `op_${crypto.randomUUID()}`;
  } catch { /* fall through */ }
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** The default seams: the gate's verdict reader, the two endpoints, the op id. Tests pass their own. */
export const defaultCardsApi = Object.freeze({ readVerdict: readFilmRoomVerdict, readCounter: requestCounter, postCard, newOpId });

// ── the pure readers ────────────────────────────────────────────────────────

/** The day's stored tag items, or null when the tape stores none (a day the tagger could not tag). */
export const tagItemsOf = (tape) => (Array.isArray(tape?.tags?.items) ? tape.tags.items : null);
/**
 * The day's situations as the screen may show them: 'absent' — the tape has no `coverage.tags` section or no stored
 * items (written before the tagger ran; R14 says so as an absence — review L3-1); 'unavailable' — the tagger ran and
 * said so (RE-1); 'ready'. Every region reads the one state (the prepared case, the check detail — review L1-3).
 */
export function tagsStateOf(tape) {
  const section = tape?.coverage?.tags;
  if (!isObj(section)) return 'absent';
  return section.status === 'unavailable' || tagItemsOf(tape) === null ? 'unavailable' : 'ready';
}
/** The day's moments, from the stored items alone (the shared helper). */
export const momentsOfTape = (tape) => momentsOf(tagItemsOf(tape) ?? []);
/** A moment's key on the screen: "stalled:ACN:4-5". */
export const momentKey = (m) => `${m.situationId}:${m.symbol}:${m.fromTickSeq ?? 'x'}-${m.toTickSeq ?? 'x'}`;
export { momentAnchor };

/**
 * The tag items at one check (the check's tickSeq), each with its index in
 * `tags.items` and the moment it belongs to.
 */
export function tagsAtCheck(tape, index) {
  const items = tagItemsOf(tape);
  const check = tape?.checks?.[index];
  if (tagsStateOf(tape) !== 'ready' || !items || !check || !Number.isInteger(check.tickSeq)) return [];
  const moments = momentsOfTape(tape);
  const out = [];
  items.forEach((it, k) => {
    if (!isObj(it) || it.tickSeq !== check.tickSeq) return;
    const moment = moments.find((m) => m.situationId === it.situationId && m.symbol === it.symbol && m.fromTickSeq !== null && it.tickSeq >= m.fromTickSeq && it.tickSeq <= m.toTickSeq) ?? null;
    out.push({ item: it, k, moment });
  });
  return out;
}

/**
 * RG-3 — the PATH a tag's count renders from, and its basis: on the recorded
 * basis the count is the live rule's own record at the check
 * (`checks[i].stagnation[sym].ticks`, declared recorded), which the tagger
 * copied into the item; on the recomputed basis it is the item's own count
 * (`tags.items[k].count`, declared derived). The recorded path is used only
 * when the record is there and holds the item's count — the number and its
 * class come from one path either way (BUILD_RULES §9). `basis` is the day's
 * declared holding basis for the symbol; `source` says which path was taken
 * ('record' or 'item' — review L3-11b).
 */
export function countPathOf(tape, { k, index, symbol }) {
  const basis = tape?.tags?.inputs?.holdingBasis?.[symbol] ?? 'recomputed';
  const recorded = ['checks', index, 'stagnation', symbol, 'ticks'];
  const derived = ['tags', 'items', k, 'count'];
  if (basis === 'recorded') {
    const rec = numberAt(tape, recorded);
    const item = numberAt(tape, derived);
    if (rec && item && rec.value === item.value) return { path: recorded, basis, source: 'record' };
  }
  return { path: derived, basis, source: 'item' };
}

/**
 * The ledger as the receipt and the lists read it: the counter's cards, with a just-filed card added when the counter
 * does not hold it yet. Where the counter holds the card, ITS row stands whole — the counter is the fresher read
 * (review L4-10).
 */
export function ledgerOf(counter, extra = null) {
  const cards = Array.isArray(counter?.cards) ? [...counter.cards] : [];
  if (isObj(extra) && extra.entryId && !cards.some((c) => c.entryId === extra.entryId)) cards.unshift({ ...extra, shelved: false });
  return cards;
}

/** The lists of My cards: active (open), shelved, retired — and 'other' for a stage this release does not know (never counted as active; review L3-10). */
export function groupCards(cards) {
  const active = []; const shelved = []; const retired = []; const other = [];
  for (const c of cards) {
    if (c.stage === 'retired') retired.push(c);
    else if (c.stage !== 'card' && c.stage !== 'nominated') other.push(c);
    else if (c.shelved) shelved.push(c);
    else active.push(c);
  }
  return { active, shelved, retired, other };
}

/** The open Watch cards the header follows (RG-4), with their recurrences from the counter. */
export function watchCardsOf(counter, cards) {
  return cards.filter((c) => c.route === 'watch' && c.stage === 'card' && !c.shelved).map((c) => ({ card: c, recurrences: Array.isArray(counter?.recurrences?.[c.entryId]) ? counter.recurrences[c.entryId] : [] }));
}

// ── the hook ────────────────────────────────────────────────────────────────

/**
 * The cards state for one screen: whether cards resolve on for the battle,
 * the counter for its agent, and the two writes.
 *
 * @param {{ battle: object, agentId: string|null, api?: object }} p
 */
export function useFilmRoomCards({ battle, agentId, api = defaultCardsApi }) {
  const [on, setOn] = useState(false);
  const [counter, setCounter] = useState({ status: 'idle', data: null });
  const alive = useRef(true);
  const battleId = filmRoomBattleId(battle);
  const ownerId = typeof battle?.ownerId === 'string' ? battle.ownerId : null;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // the gate, per battle owner — 'off' and 'on' without a request; 'allowlist' the cached verdict
  useEffect(() => {
    let live = true;
    setOn(false);
    if (!battleId) return undefined;
    Promise.resolve(resolveFilmRoomCardsForBattle(battle, { readVerdict: api.readVerdict }))
      .then((v) => { if (live && alive.current) setOn(v === true); })
      .catch(() => { if (live && alive.current) setOn(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleId, ownerId, api]);

  const refresh = useCallback(async () => {
    if (!on || !agentId) return;
    setCounter((c) => (c.data ? c : { status: 'loading', data: null }));
    const r = await api.readCounter(agentId);
    if (!alive.current) return;
    if (r && r.ok && isObj(r.body)) setCounter({ status: 'ready', data: r.body });
    else setCounter((c) => ({ status: 'error', data: c.data }));   // a failed re-read keeps what was read (review L4-4)
  }, [on, agentId, api]);

  useEffect(() => { if (on && agentId) refresh(); }, [on, agentId, refresh]);

  /** A fresh op id; the form and the receipt each mint ONE and keep it (review L4-9). */
  const mintOpId = useCallback(() => api.newOpId(), [api]);

  const create = useCallback(async ({ opId, battleId: b, etDate, moment, questionId, questionVersion, note, route }) => {
    const r = await api.postCard({ op: 'create', opId: opId || api.newOpId(), battleId: b, etDate, agentId, moment: { situationId: moment.situationId, symbol: moment.symbol, fromTickSeq: moment.fromTickSeq, toTickSeq: moment.toTickSeq }, questionId, questionVersion, note, route });
    if (r && r.ok && isObj(r.body) && isObj(r.body.card)) { await refresh(); return { ok: true, card: r.body.card }; }
    return { ok: false, code: r?.body?.error ?? (r?.status === 404 ? 'disabled' : 'default') };
  }, [api, agentId, refresh]);

  const retire = useCallback(async (card, opId = null) => {
    const r = await api.postCard({ op: 'retire', opId: opId || api.newOpId(), agentId, entryId: card.entryId, expectedVersion: card.version });
    if (r && r.ok && isObj(r.body) && isObj(r.body.card)) { await refresh(); return { ok: true, card: r.body.card }; }
    const code = r?.body?.error ?? (r?.status === 404 ? 'disabled' : 'retireDefault');
    // the card moved elsewhere (another tab): re-read, so the receipt shows the ledger's row (review L4-10)
    if (code === 'version_conflict' || code === 'illegal_transition') await refresh();
    return { ok: false, code };
  }, [api, agentId, refresh]);

  return { on, counter, refresh, create, retire, mintOpId };
}
