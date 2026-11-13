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
//              re-read that fails keeps what was read (review L4-4), with a
//              successful write's own result put in where it is newer than
//              the row kept (Amendment I RI-2).
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
// Build C §3: the stage vocabulary v2, from its one export (the store reads the same module)
import { CARD_STAGES, CREATE_ROW_STAGES, STORED_ROUTE_ALIASES, isOpenStage, isFollowedWatch } from '../../data/cardStages';
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

/** RI-2: `a` is a later version of the entry than `b` — both versions whole numbers, `a`'s the greater. */
const newerThan = (a, b) => Number.isInteger(a?.version) && Number.isInteger(b?.version) && a.version > b.version;

/**
 * The ledger as the receipt and the lists read it: the counter's cards, with a write's own result (a create's or a
 * retire's) added when the counter does not hold the entry yet, and put in place of the counter's row when it is
 * NEWER by `version` (Amendment I RI-2, Astra B1): a refresh that failed after a successful write never puts an older
 * stage back on screen. Otherwise the counter's row stands whole — the fresher read (review L4-10). The result
 * carries no computed `shelved`; it reads false, since the store accepts neither write on a shelved card (a create
 * under another archetype is refused, RH-5; a shelved card's retire is refused).
 */
export function ledgerOf(counter, extra = null) {
  const cards = Array.isArray(counter?.cards) ? [...counter.cards] : [];
  if (!isObj(extra) || !extra.entryId) return cards;
  const at = cards.findIndex((c) => c.entryId === extra.entryId);
  if (at < 0) cards.unshift({ ...extra, shelved: false });
  // Build C (park): a write on a card the counter already holds keeps the row's computed shelving — the store parks a
  // shelved tested card (parking moves no stage), and no write ever changes an archetype
  else if (newerThan(extra, cards[at])) cards[at] = { ...extra, shelved: cards[at].shelved === true };
  return cards;
}

/**
 * The lists of My cards (Build C §3, the one export's stages and open predicate): active (open), shelved, parked (a
 * tested card the player parked), equipped (`installed`), retired — and 'other' for a stage the vocabulary does not
 * know (never counted as active; review L3-10).
 */
export function groupCards(cards) {
  const active = []; const shelved = []; const parked = []; const equipped = []; const retired = []; const other = [];
  for (const c of cards) {
    if (c.stage === 'retired') retired.push(c);
    else if (!CARD_STAGES.includes(c.stage)) other.push(c);
    else if (c.shelved) shelved.push(c);
    else if (isOpenStage(c)) active.push(c);
    else if (c.stage === 'installed') equipped.push(c);
    else parked.push(c);   // the one stage left that is neither open nor installed: `tested`, parked
  }
  return { active, shelved, parked, equipped, retired, other };
}

/**
 * Build C §5 — THE CHAIN of one card, newest first: one line per row of the entry's own `stageHistory` (what the
 * ledger holds, and nothing it does not — exit criterion 11), each `{ kind, at, k }` (k: the row's index):
 *   filed      the create's row, recognised by its SHAPE (C1 fix round, Astra F3 — isCreateRow), never by its index
 *              alone: the first row, no event, not a server's, at a stage a create writes (CREATE_ROW_STAGES) — and
 *              `offered` beside it when the create was the Offer route's (`nominated`). A first row that is not one
 *              (an unknown event, a server's row) is judged as any other row, so it never becomes a "Filed" line
 *   offered    a player row at `nominated` (the nominate op)
 *   stage      on a v1 Practice entry (stored route `drill`, never written in production), its `nominated` row: it was
 *              kept for the Practice Field, never offered to the agent, so it says the stage's own word (C1 review A-7)
 *   nomination a server row copying the book's nomination state (`event: 'nomination'`, its `state`); `latest` marks
 *              the last such row — the one whose state the entry's `nomination` copy holds, and whose reason it keeps
 *   testing · tested · installed · retired   a row at that stage (`by` kept: a server retire carries the offer's state)
 *   parked     a player row `event: 'parked'`
 *   stage      a row at a stage the vocabulary does not know (its own word, `stage`)
 * A row that is not an object, or that names nothing the chain knows, gives no line — the chain never invents a state.
 */
/** Astra F3: a create's row, by its shape — the first row, no event, not a server's, at a stage a create writes. */
export const isCreateRow = (h, k) => k === 0 && isObj(h) && h.event === undefined && h.by !== 'server' && CREATE_ROW_STAGES.includes(h.stage);

export function chainOf(card) {
  const history = Array.isArray(card?.stageHistory) ? card.stageHistory : [];
  const lines = [];
  let lastNomination = -1;
  const v1Practice = Object.prototype.hasOwnProperty.call(STORED_ROUTE_ALIASES, card?.route);
  const nominatedLine = (h, k) => (v1Practice ? { kind: 'stage', stage: 'nominated', at: h.at, k } : { kind: 'offered', at: h.at, k });
  history.forEach((h, k) => {
    if (!isObj(h)) return;
    if (isCreateRow(h, k)) {
      lines.push({ kind: 'filed', at: h.at, k });
      if (h.stage === 'nominated') lines.push(nominatedLine(h, k));
      return;
    }
    if (h.event === 'parked') { lines.push({ kind: 'parked', at: h.at, k }); return; }
    if (h.event === 'nomination') {
      if (typeof h.state === 'string' && h.state) { lastNomination = lines.length; lines.push({ kind: 'nomination', state: h.state, at: h.at, k }); }
      return;
    }
    if (h.event !== undefined) return;   // an event the chain does not know: no line (C1 review B-7)
    if (h.stage === 'nominated') { lines.push(nominatedLine(h, k)); return; }
    if (CARD_STAGES.includes(h.stage) && h.stage !== 'card') { lines.push({ kind: h.stage, at: h.at, k, by: h.by }); return; }
    // a stage the vocabulary does not know: its own word. A `card` row that is not the create's (above) gives no line —
    // only a create writes `card`, so nothing is invented from one (Astra F3)
    if (typeof h.stage === 'string' && h.stage && !CARD_STAGES.includes(h.stage)) lines.push({ kind: 'stage', stage: h.stage, at: h.at, k });
  });
  if (lastNomination >= 0) lines[lastNomination] = { ...lines[lastNomination], latest: true };
  return lines.reverse();
}

/**
 * The C1 refinement R-C1-1 — the "since last time" list: every card PAST the `card` stage, each with its newest chain
 * line (chainOf's first), newest state first (ties by entry id). No "last visit" mark is stored: the list is the
 * ledger's state, read whole each time. A card with no chain line (no history the chain knows) is left out.
 */
export function latestOf(cards) {
  const msOf = (v) => { const ms = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(ms) ? ms : -Infinity; };
  return (Array.isArray(cards) ? cards : [])
    .filter((c) => isObj(c) && c.stage !== 'card')
    .map((c) => ({ card: c, line: chainOf(c)[0] ?? null }))
    .filter((x) => x.line)
    .sort((a, b) => (msOf(b.line.at) - msOf(a.line.at)) || (a.card.entryId < b.card.entryId ? -1 : 1));
}

/** The open Watch cards the header follows (RG-4; the one export's isFollowedWatch), with their recurrences from the counter. */
export function watchCardsOf(counter, cards) {
  return cards.filter((c) => isFollowedWatch(c) && !c.shelved).map((c) => ({ card: c, recurrences: Array.isArray(counter?.recurrences?.[c.entryId]) ? counter.recurrences[c.entryId] : [] }));
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

  // RI-2 (Astra B1): a successful write's own result goes into the cards kept on screen where it is newer than the
  // counter's row — after a refresh that failed (the error stays said beside it); after one that answered, the
  // counter already holds the row and nothing changes
  const keepResult = useCallback((card) => {
    if (!alive.current) return;
    setCounter((c) => {
      if (!c.data) return c;
      const was = Array.isArray(c.data.cards) ? c.data.cards : [];
      const cards = ledgerOf(c.data, card);
      return cards.length === was.length && cards.every((x, i) => x === was[i]) ? c : { ...c, data: { ...c.data, cards } };
    });
  }, []);

  /** A fresh op id; the form and the receipt each mint ONE and keep it (review L4-9). */
  const mintOpId = useCallback(() => api.newOpId(), [api]);

  const create = useCallback(async ({ opId, battleId: b, etDate, moment, questionId, questionVersion, note, route }) => {
    const r = await api.postCard({ op: 'create', opId: opId || api.newOpId(), battleId: b, etDate, agentId, moment: { situationId: moment.situationId, symbol: moment.symbol, fromTickSeq: moment.fromTickSeq, toTickSeq: moment.toTickSeq }, questionId, questionVersion, note, route });
    if (r && r.ok && isObj(r.body) && isObj(r.body.card)) { await refresh(); keepResult(r.body.card); return { ok: true, card: r.body.card }; }
    return { ok: false, code: r?.body?.error ?? (r?.status === 404 ? 'disabled' : 'default') };
  }, [api, agentId, refresh, keepResult]);

  const retire = useCallback(async (card, opId = null) => {
    const r = await api.postCard({ op: 'retire', opId: opId || api.newOpId(), agentId, entryId: card.entryId, expectedVersion: card.version });
    if (r && r.ok && isObj(r.body) && isObj(r.body.card)) { await refresh(); keepResult(r.body.card); return { ok: true, card: r.body.card }; }
    const code = r?.body?.error ?? (r?.status === 404 ? 'disabled' : 'retireDefault');
    // the card moved elsewhere (another tab): re-read, so the receipt shows the ledger's row (review L4-10)
    if (code === 'version_conflict' || code === 'illegal_transition') await refresh();
    return { ok: false, code };
  }, [api, agentId, refresh, keepResult]);

  /** Build C (refinement R-C1-2): park a tested card, from its receipt — the retire's pattern, one op id per receipt. */
  const park = useCallback(async (card, opId = null) => {
    const r = await api.postCard({ op: 'park', opId: opId || api.newOpId(), agentId, entryId: card.entryId, expectedVersion: card.version });
    if (r && r.ok && isObj(r.body) && isObj(r.body.card)) { await refresh(); keepResult(r.body.card); return { ok: true, card: r.body.card }; }
    const code = r?.body?.error ?? (r?.status === 404 ? 'disabled' : 'parkDefault');
    if (code === 'version_conflict' || code === 'illegal_transition') await refresh();
    return { ok: false, code };
  }, [api, agentId, refresh, keepResult]);

  return { on, counter, refresh, create, retire, park, mintOpId };
}
