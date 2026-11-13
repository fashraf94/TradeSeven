// api/_utils/filmRoom/cardStore.js
//
// Film Room B2 item 4 — THE LEDGER (Build B spec §4; shared contract §5;
// Amendment G RG-8): `agents/{agentId}/plays/{entryId}`. A card and, in the
// camp's later builds, a play are ONE entry at different stages. Film Room
// Build C (spec docs/specs/FILM_ROOM_BUILD_C_LOOP_SPEC_V1_20261112.md §3)
// moves the ledger to STAGE VOCABULARY v2 — `card → nominated → testing →
// tested → installed → retired` — read from ONE export
// (src/data/cardStages.js, re-exported here whole); every entry written from
// C1 on records `stageVocabVersion: 2`, and an entry without it reads as v1
// and is never rewritten. The player's ops write `card`, `nominated` and
// `retired`; `testing`, `tested`, `installed` and a server retire are the
// Practice Field's, through the transition helper below
// (applyServerTransition). Writes are SERVER-ONLY (the Admin SDK); the owner
// reads, by the document's own ownerId (firestore.rules). The gate is the
// ROUTE's job (cardsGate.js); nothing here reads the flag.
//
// THE WRITE PATTERN follows api/_utils/hypothesisRecords/store.js: every write
// is ONE transaction, all reads before any write; idempotent by op id, with an
// expected-version check:
//   create   the entry's id IS the create op id (a client id in the forge-id
//            class), so a replay finds its own entry: the same op id with the
//            same request fingerprint is the entry again, an IDEMPOTENT
//            success; the same op id with a different request, or on an entry
//            whose own ownerId is missing or another user's (Amendment I
//            RI-1) → 409 op_conflict, with nothing of the entry. Then the
//            open-card cap (S9: the caller's own OPEN cards — the one
//            export's isOpenStage — that are not shelved) → 409 cap_reached,
//            naming the cap. Then `tx.create` — never an overwrite.
//   retire   a compare-and-set on `version`: `expectedVersion` ≠ the stored
//            version → 409 version_conflict; a shelved entry cannot move stage
//            (409 shelved); `retired` → `retired` is no transition (409
//            illegal_transition). The retire op id is kept on the stage row,
//            so its replay is recognised the same way.
//
// SHELVING IS COMPUTED AT READ, NEVER WRITTEN (spec §4, ruling 5): an entry
// whose `archetypeCodeId` is not the agent's CURRENT `archetype` reads as
// shelved — excluded from the cap, unable to move stage, and back by itself
// when the archetype returns. No write, so nothing can drift.
//
// ONE DOOR (contract §7; RE-5): nothing here is reached from any model path
// (oneDoor.census.test.js walks them), and nothing here reads a meeting row.
//
// THE AGENT (Build B Amendment K RK-1): the ledger is learning, so it follows
// the platform's attribution rule — a card lives under the battle's
// ATTRIBUTION agent: a casual clone's parent (the player's ranked agent),
// the battle's own agent otherwise, by the platform's one resolver
// (api/_utils/casualClone.js). Nothing is ever filed, retired or counted under
// a casual clone: a clone the resolver cannot resolve is refused, 503
// attribution_unavailable. The tape keeps the battle's own agentId.

import { canonicalContentHash } from '../canonicalHash.js';
import { resolveAttributionAgentId, resolveRecordTargetId } from '../casualClone.js';
import { casualCloneDocId, isCasualCloneId } from '../../../src/constants/leagueTournament.js';
import { CARD_SLOTS, CARD_SLOTS_VERSION } from '../../../src/data/cardSlots.js';
// Build A2 (R4; per-game loadouts, ruling D1): with PER_GAME_LOADOUT_ENABLED on there is no one "current" archetype —
// BaggerBomb and League may wear different ones at once — so an entry is active when its archetype is EITHER loadout's
// (the attribution agent is the ranked record, which holds both), and shelved otherwise; and a create is refused only
// when the tape day's archetype differs from the battle's own (it never should). The predicate only, behind the flag;
// the Film Room arc owns the rest of this file.
import { PER_GAME_LOADOUT_ENABLED } from '../../../src/config/perGameLoadoutFlags.js';
import { loadoutArchetypesOf } from '../../../src/constants/perGameLoadout.js';
// Build C §3: the stage vocabulary v2, from its one export — re-exported whole, so every server reader takes it from here
import { CARD_STAGE_VOCAB_VERSION, CARD_ROUTES, NOMINATING_ROUTE, NOMINATION_STATES, NOMINATION_EXPIRY_SESSIONS, WITHDRAWABLE_STATES, isOpenStage, isRetirableByPlayer, nominationMayMove } from '../../../src/data/cardStages.js';
// Build C §4 (refinement R-C1-3): the nomination record's shape is the Practice Field's builder, reached through the seam;
// Amendment A CA-2: so is its withdrawal's
import { buildNominationDoc, buildWithdrawal, bookIsForAgent, NOMINATION_SOURCE_KIND, NOMINATION_QUEUED } from './practiceFieldSeam.js';
import { isValidForgeId } from '../idValidation.js';

export * from '../../../src/data/cardStages.js';

export const PLAYS_SUBCOLLECTION = 'plays';
export const CARD_SCHEMA_VERSION = 1;
/** Build C §4: the book's nominations, `mandates/{bookId}/nominations/{nominationId}` — the one book path the Film Room writes, in its own transactions. */
export const BOOKS_COLLECTION = 'mandates';
export const NOMINATIONS_SUBCOLLECTION = 'nominations';
/** Who moves a card: the player, through the card endpoint. */
export const BY_PLAYER = 'player';
/** Build C §3: a server write through the transition helper — `stageHistory[].by`, with the writer named beside it. */
export const BY_SERVER = 'server';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);

/**
 * Build C §3 (C1 review A-5): a replay is looked up among its own writer's rows. A player op (retire, nominate, park)
 * answers only to a player row under its op id, and a server transition only to a server row, so a client-chosen op
 * id can never pre-empt the Practice Field's own transition (its nomination id IS the player's nominate op id), nor
 * the reverse.
 */
const playerReplayOf = (history, opId) => history.find((h) => h?.opId === opId && h?.by !== BY_SERVER) ?? null;
const serverReplayOf = (history, opId) => history.find((h) => h?.opId === opId && h?.by === BY_SERVER) ?? null;

/** A typed route failure: the route answers `status` with `{ error: code, message, ...extra }`. */
export class CardRouteError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.cardRoute = true;
  }
}

export const CARD_ROUTE_COPY = Object.freeze({
  not_found: 'That card does not exist.',
  agent_not_found: 'That agent does not exist.',
  forbidden: 'Not authorized for this agent.',
  op_conflict: 'This request id was already used for a different change.',
  version_conflict: 'The card changed since you loaded it. Reload and try again.',
  // Amendment A CA-23: after CA-1, CA-2 and CA-5 a full set may hold nothing the player can retire — the words say what
  // stops a card counting, never "Retire a card first"
  cap_reached: 'The open-card cap for this agent is reached. A card stops counting once it is retired, parked, equipped or not taken.',
  shelved: 'This card is shelved: it was made under another archetype and cannot move until the agent returns to it.',
  illegal_transition: 'That change is not allowed from the card\'s current stage.',
  invalid_transition: 'That transition or its payload is not one the ledger takes.',
  nomination_mismatch: 'That record is not the one this card is bound to.',
  // Build C §4 precondition 4: the body names nothing of any book
  book_not_open: 'This card cannot be offered now. Nothing was changed.',
  invalid_route: 'That route is not one a card can be filed on.',
  calendar_unavailable: 'The expiry of this offer could not be placed on the market calendar. Nothing was changed; try again later.',
  agent_unresolved: 'This agent records no archetype, so no card can be filed under it.',
  archetype_changed: 'This day was taped under another archetype than the agent\'s current one, so a card from it would be shelved at birth. Nothing was filed.',
  attribution_unavailable: 'The agent these cards belong to could not be resolved. Nothing was changed; try again.',
  // Amendment A CA-2: a nominated card's record could not be read or withdrawn — fail closed, the card not retired
  nomination_unavailable: 'This card\'s offer could not be checked. Nothing was changed. Try again.',
});
const fail = (status, code, extra) => new CardRouteError(status, code, CARD_ROUTE_COPY[code], extra);

export const agentRefOf = (db, agentId) => db.collection('agents').doc(agentId);
export const playsColOf = (db, agentId) => agentRefOf(db, agentId).collection(PLAYS_SUBCOLLECTION);
export const playRefOf = (db, agentId, entryId) => playsColOf(db, agentId).doc(entryId);
export const nominationRefOf = (db, bookId, nominationId) => db.collection(BOOKS_COLLECTION).doc(bookId).collection(NOMINATIONS_SUBCOLLECTION).doc(nominationId);

/** Build C §4 precondition 4: the book the route read through the seam (`{ bookId, status }`) is open — status 'active'. */
export const isBookOpen = (book) => isObj(book) && typeof book.bookId === 'string' && book.bookId.length > 0 && book.status === 'active';

/** Amendment A CA-12: the book document the transaction re-reads, `mandates/{bookId}` (an idea book is a Mandate book of its own kind). */
export const bookRefOf = (db, bookId) => db.collection(BOOKS_COLLECTION).doc(bookId);
/** CA-12: the only kind of book a nomination may land in (contract V2 §3). */
export const IDEA_BOOK_KIND = 'idea_book';

/**
 * Amendment A CA-12 — THE BOOK, RE-READ INSIDE THE TRANSACTION, at the existing book precondition's place: the route's
 * pre-read (`book`, through the seam, for the counter's sake too) must say open, and then `mandates/{bookId}` read
 * THROUGH THIS TRANSACTION must exist, be the caller's (`userId`), an idea book (`kind: 'idea_book'`), `status:
 * 'active'`, and for the attribution agent by the seam's pure `bookIsForAgent` (T1a owns it; a throw or any answer but
 * `true` fails closed). A change to the book between the pre-read and the commit conflicts and is judged again on the
 * retry. Any failure is 409 book_not_open, nothing written, the body naming nothing of any book; an ordinary failed
 * read is the same refusal (with a server trace); a contention abort (gRPC ABORTED) is rethrown as it came.
 */
async function requireOpenBookIn(tx, db, { book, uid, agentId }) {
  if (!isBookOpen(book) || !pathIdOk(book.bookId)) throw fail(409, 'book_not_open');
  let doc;
  try {
    const snap = await tx.get(bookRefOf(db, book.bookId));
    doc = snap?.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
  } catch (err) {
    if (err?.cardRoute || err?.code === GRPC_ABORTED) throw err;
    console.error('[film-room/cards] book re-read failed:', err?.message ?? err);
    throw fail(409, 'book_not_open');
  }
  if (!isObj(doc) || doc.userId !== uid || doc.kind !== IDEA_BOOK_KIND || doc.status !== 'active') throw fail(409, 'book_not_open');
  let forAgent = false;
  try {
    forAgent = bookIsForAgent(doc, agentId) === true;
  } catch (err) {
    console.error('[film-room/cards] bookIsForAgent failed:', err?.message ?? err);
    forAgent = false;
  }
  if (!forAgent) throw fail(409, 'book_not_open');
}

// ── the attribution agent (RK-1) ────────────────────────────────────────────

/**
 * RK-1 — the agent a card is filed, replayed and retired under: the attribution agent of `agentId` (a battle's own
 * agent, or the one the screen names), by the platform's async resolver — a casual clone's parent, verified owned by
 * the clone's owner; anything else unchanged. The resolver never throws: a clone it cannot resolve (no clone
 * document, no rankedAgentId, a parent another owner holds, a failed read) comes back as the clone itself, and
 * nothing is ever filed under a clone, so that answer is refused — 503 attribution_unavailable, before any write.
 */
export async function attributionAgentOf(db, agentId) {
  const resolved = await resolveAttributionAgentId(db, { agentId });
  if (isCasualCloneId(resolved)) throw fail(503, 'attribution_unavailable', { agentId });
  return resolved;
}

/**
 * RK-1 — the counter's attribution: ONE read of the owner's own clone document (`agents/casual-agent-{uid}`), then
 * the platform's pure resolver (resolveRecordTargetId) for every agent id the counter meets — the asked agent and
 * each tape day's. Only the owner's clone maps to its parent; any other id maps to itself (the resolver handed no
 * clone document), so another owner's clone is never counted as the owner's agent. A clone document that is
 * missing, names no rankedAgentId or is not the owner's leaves the clone mapped to itself. A read that fails is
 * refused (503 attribution_unavailable), never answered as "no recurrence".
 *
 * @returns {Promise<{ cloneId: string, targetOf: (agentId: string) => string }>}
 */
export async function ownerAttributionOf(db, uid) {
  const cloneId = casualCloneDocId(uid);
  let clone = null;
  try {
    const snap = await agentRefOf(db, cloneId).get();
    const data = snap?.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    clone = isObj(data) && data.ownerId === uid ? data : null;
  } catch (err) {
    console.error('[film-room/cards] clone read failed:', err?.message ?? err);
    throw fail(503, 'attribution_unavailable');
  }
  return { cloneId, targetOf: (agentId) => resolveRecordTargetId(agentId, agentId === cloneId ? clone : null) };
}

/** The agent as its owner may see it: missing → agent_not_found; another owner → forbidden; no archetype → agent_unresolved. */
function ownedAgent(snap, uid) {
  if (!snap?.exists) throw fail(404, 'agent_not_found');
  const data = typeof snap.data === 'function' ? snap.data() : snap.data;
  if (!isObj(data) || data.ownerId !== uid) throw fail(403, 'forbidden');
  const archetype = str(data.archetype);
  if (!archetype) throw fail(409, 'agent_unresolved');
  // `shelf`: what shelving compares an entry with — the agent's archetype, or (A2, R4) both loadouts' archetypes
  return { data, archetype, shelf: PER_GAME_LOADOUT_ENABLED ? loadoutArchetypesOf(data) : archetype };
}

const docsOf = (snap) => (snap?.docs || []).map((d) => (typeof d.data === 'function' ? d.data() : d.data)).filter(isObj);

// ── shelving and the cap — computed, never written ──────────────────────────

/** Ruling 5: an entry made under another archetype than the agent's current one is shelved. Computed at read. */
export const isShelved = (entry, currentArchetype) => (Array.isArray(currentArchetype) ? !currentArchetype.includes(entry?.archetypeCodeId) : entry?.archetypeCodeId !== currentArchetype);
/**
 * Open: open by its stage (the one export's isOpenStage, as Amendment A CA-3 rules it — `card` or `testing`; `nominated`
 * unless its copy says declined, expired or withdrawn; `tested` with no `parkedAt`), and not shelved — what S9 counts
 * (RG-8).
 */
export const isOpen = (entry, currentArchetype) => isOpenStage(entry) && !isShelved(entry, currentArchetype);
/** The entries with their computed `shelved` beside them (a read-time field, never stored). */
export const withShelving = (entries, currentArchetype) => entries.map((e) => ({ ...e, shelved: isShelved(e, currentArchetype) }));
/** How many of the entries count against S9. */
export const openCardCount = (entries, currentArchetype) => entries.filter((e) => isOpen(e, currentArchetype)).length;
/** S9 as it stands. */
export const OPEN_CARD_CAP = CARD_SLOTS.S9.openCardsPerAgent;

/** The stage a route starts at (Build C §4): Offer nominates; Watch and Set file a card. */
export const stageForRoute = (route) => (route === NOMINATING_ROUTE ? 'nominated' : 'card');

/**
 * The entry as created (spec §4): written once — the identity, the archetype
 * it was created under, the situation and its version, the source moment, the
 * question and its version, the note verbatim, the route — and the envelope.
 * Build C §4: an Offer card is born `nominated`, its `nomination` (`{ bookId, nominationId, state: 'queued' }`) beside
 * it — `book` is the open book the route read; the record itself is written in the same transaction (createCard).
 */
export function buildCardDoc({ entryId, uid, agentId, opId, opFingerprint, nowIso, payload, book = null }) {
  const stage = stageForRoute(payload.route);
  return {
    schemaVersion: CARD_SCHEMA_VERSION,
    // Build C §3: written once, at create; an entry without it reads as v1 and is never rewritten
    stageVocabVersion: CARD_STAGE_VOCAB_VERSION,
    entryId,
    ownerId: uid,
    agentId,
    createdAt: nowIso,
    archetypeCodeId: payload.archetypeCodeId,
    situationId: payload.situationId,
    situationVersion: payload.situationVersion,
    source: { battleId: payload.battleId, etDate: payload.etDate, symbol: payload.symbol, fromTickSeq: payload.fromTickSeq, toTickSeq: payload.toTickSeq },
    questionId: payload.questionId,
    questionVersion: payload.questionVersion,
    note: payload.note,
    route: payload.route,
    slotsVersion: CARD_SLOTS_VERSION,
    stage,
    ...(stage === 'nominated' && book ? { nomination: { bookId: book.bookId, nominationId: entryId, state: 'queued' } } : {}),
    stageAt: nowIso,
    stageHistory: [{ stage, at: nowIso, by: BY_PLAYER, opId }],
    version: 1,
    opId,
    opFingerprint,
  };
}

/**
 * The create fingerprint hashes the CLIENT'S REQUEST (what the caller sent:
 * the moment, the question, the note, the route, the battle, the day), never
 * the server-resolved payload — so a replay of the same request after a
 * re-tag moved the stored items' version labels (RC-1) is still the idempotent
 * success, as hypothesisRecords/store.js hashes the request it was given
 * (review L1-4). `request` falls back to the payload for a caller that sends none.
 */
const createFingerprint = (agentId, request, payload) => canonicalContentHash({ kind: 'create', agentId, request: request ?? payload });
const retireFingerprint = (agentId, entryId, expectedVersion) => canonicalContentHash({ kind: 'retire', agentId, entryId, expectedVersion });

/**
 * A create's opening reads, inside its transaction: the caller's agent, the entry under the op id, the caller's open
 * count. An entry already filed under the op id is the REPLAY (`replay`, the idempotent answer) — answered only to the
 * entry's own owner and only for the same request (RI-1, Astra F1; otherwise 409 op_conflict, the body holding nothing
 * of the entry); none → `replay: null`.
 */
async function createReads(tx, db, { uid, agentId, opId, opFingerprint }) {
  const agent = ownedAgent(await tx.get(agentRefOf(db, agentId)), uid);
  const ref = playRefOf(db, agentId, opId);
  const existingSnap = await tx.get(ref);
  // the cap counts the caller's own entries only, as readCards does (Amendment I RI-1)
  const all = docsOf(await tx.get(playsColOf(db, agentId))).filter((e) => e.ownerId === uid);
  const open = openCardCount(all, agent.shelf);
  if (!existingSnap?.exists) return { agent, ref, open, replay: null };
  const existing = typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data;
  if (!isObj(existing) || existing.ownerId !== uid) throw fail(409, 'op_conflict', { entryId: opId });
  if (existing.opFingerprint === opFingerprint) return { agent, ref, open, replay: { idempotent: true, card: existing, open, cap: OPEN_CARD_CAP } };
  throw fail(409, 'op_conflict', { entryId: opId });
}

/**
 * B2.1 review SPR-C-3 — a create's REPLAY alone: the card already filed under this op id for this request (the same
 * idempotent answer createCard gives), or null when none is. The route asks it when its own source checks refuse, so a
 * lost answer re-tapped (review L4-9) gets its filed card back even after the day has changed since — the source
 * checks judge a NEW card, never one already filed.
 */
export async function replayCreate(db, { uid, agentId, opId, request }) {
  const opFingerprint = createFingerprint(agentId, request, null);
  return db.runTransaction(async (tx) => (await createReads(tx, db, { uid, agentId, opId, opFingerprint })).replay);
}

/**
 * Create a card. The route has already proved the moment, the question and the
 * note (api/film-room/card.js); here the ownership, the replay, the archetype,
 * the cap and the write happen in one transaction.
 *
 * THE ARCHETYPE (review L1-1 / L5-1): the card is created under the archetype
 * the TAPE DAY records (`tags.inputs.archetypeCodeId`, the battle's), and the
 * cap and the shelving read the agent's CURRENT archetype. A day taped under
 * an archetype the agent has since left would give a card shelved at birth —
 * one the cap never counts and nothing "returns" to — so such a create is
 * REFUSED (409 archetype_changed) rather than filed. Spec §4's shelving
 * paragraph presupposes a card that starts unshelved; this keeps it so. A
 * founder ruling on the alternative (stamping the agent's current archetype)
 * is asked in the build report.
 *
 * THE AGENT (RK-1): `agentId` is the battle's ATTRIBUTION agent, which the
 * route resolves (attributionAgentOf) — so the ownership, the cap, the
 * archetype and the entry's path are all the parent's for a casual clone's
 * battle, and the clone is never written.
 *
 * @param {object} db
 * @param {{ uid: string, agentId: string, opId: string, nowIso: string, request?: object,
 *           payload: { archetypeCodeId: string, situationId: string, situationVersion: number,
 *                      battleId: string, etDate: string, symbol: string, fromTickSeq: number|null, toTickSeq: number|null,
 *                      questionId: string, questionVersion: number, note: string, route: 'watch'|'offer'|'set' }, book?: { bookId: string, status: string }|null }} p
 * @returns {Promise<{ idempotent: boolean, card: object, open: number, cap: number }>}
 */
export async function createCard(db, { uid, agentId, opId, payload, nowIso, request = null, verifySource = null, battleArchetype = null, book = null }) {
  // Build C §4: a route outside the vocabulary — `drill` included, read as `offer` but never written again — is refused
  // here too, whatever the caller parsed, so nothing ever writes it
  if (!CARD_ROUTES.includes(payload?.route)) throw fail(400, 'invalid_route');
  const offer = payload.route === NOMINATING_ROUTE;
  const opFingerprint = createFingerprint(agentId, request, payload);
  return db.runTransaction(async (tx) => {
    const { agent, ref, open, replay } = await createReads(tx, db, { uid, agentId, opId, opFingerprint });
    if (replay) return replay;
    // Amendment I RI-3 (Astra B3): the source day is re-read and its coverage and exact moment checked again HERE,
    // inside the transaction that files the card (the route hands its checks in — api/film-room/card.js
    // verifySourceIn — so this store imports no tape module): a re-write between the route's read and this commit
    // refuses rather than filing a card for a moment the tape no longer holds. A read, so it precedes the write.
    if (verifySource) await verifySource(tx);
    if (PER_GAME_LOADOUT_ENABLED ? payload.archetypeCodeId !== battleArchetype : payload.archetypeCodeId !== agent.archetype) throw fail(409, 'archetype_changed', { archetypeCodeId: payload.archetypeCodeId, current: PER_GAME_LOADOUT_ENABLED ? battleArchetype : agent.archetype });
    // Build C §4 precondition 4, for the Offer route: the owner's book, read by the route through the seam BEFORE this
    // transaction (`book`), is open — judged after the replay, so a lost answer re-tapped after the book closed still
    // gets its card back. No book → 409 book_not_open, nothing written, the body naming nothing of any book.
    // Amendment A CA-12: and the book itself, re-read in this transaction (after replay, source and archetype; before
    // the cap and the id-conflict check)
    if (offer) await requireOpenBookIn(tx, db, { book, uid, agentId });
    if (open >= OPEN_CARD_CAP) throw fail(409, 'cap_reached', { cap: OPEN_CARD_CAP, open });
    const card = buildCardDoc({ entryId: opId, uid, agentId, opId, opFingerprint, nowIso, payload, book: offer ? book : null });
    // one transaction, both halves (exit criterion 12): for an Offer card, the record under the op id — refused if that
    // id was already used for another nomination in the book (a read, so before any write) — and the entry at
    // `nominated` beside it
    const nominationRef = offer ? nominationRefOf(db, book.bookId, opId) : null;
    if (nominationRef && (await tx.get(nominationRef))?.exists) throw fail(409, 'op_conflict', { entryId: opId });
    const nomination = nominationRef ? nominationDocOf({ entryId: opId, card, nowIso }) : null;
    tx.create(ref, card);
    if (nominationRef) tx.set(nominationRef, nomination);
    // the count the predicate gives (flag off a new card is always open, so +1; A2's R4 can file one shelved)
    return { idempotent: false, card, open: open + (isOpen(card, agent.shelf) ? 1 : 0), cap: OPEN_CARD_CAP };
  });
}

/** A plain object: an object literal's prototype (or none) — never an array, a class instance, a boxed value. */
const isPlainObject = (v) => v !== null && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v));

/**
 * C1 fix round, Astra F2 (exit criterion 12: the record is ITS entry's) — what is wrong with the builder's output, or
 * null when nothing is: the shared invariants the Film Room relies on, never the Practice Field's whole schema. A plain
 * object; `state: 'queued'`; `source` a plain object of kind `film_room_card` naming EXACTLY the entry, situation,
 * question and question version it was given; `queuedAt` and `expiresAt` instants; `stateHistory` an array. Any other
 * field the Practice Field adds passes through untouched.
 */
export function nominationRecordDefectOf(record, { entryId, situationId, questionId, questionVersion }) {
  if (!isPlainObject(record)) return 'record';
  if (record.state !== NOMINATION_QUEUED) return 'state';
  const s = record.source;
  if (!isPlainObject(s) || s.kind !== NOMINATION_SOURCE_KIND) return 'source.kind';
  if (s.entryId !== entryId || s.situationId !== situationId || s.questionId !== questionId || s.questionVersion !== questionVersion) return 'source';
  if (!isoOk(record.queuedAt)) return 'queuedAt';
  if (!isoOk(record.expiresAt)) return 'expiresAt';
  if (!Array.isArray(record.stateHistory)) return 'stateHistory';
  return null;
}

/**
 * The nomination record for an entry, by the Practice Field's builder (the seam); a walk off the calendar → 503. The
 * output is checked before either half is written (Astra F2): a malformed record is a server fault — thrown as such
 * (the route's 500, with its trace), so nothing of either half is committed.
 */
function nominationDocOf({ entryId, card, nowIso }) {
  const given = { entryId, situationId: card.situationId, questionId: card.questionId, questionVersion: card.questionVersion };
  let record;
  try {
    record = buildNominationDoc({ ...given, nowIso, expiresAfterSessions: NOMINATION_EXPIRY_SESSIONS });
  } catch (err) {
    if (err?.code === 'calendar_unavailable') throw fail(503, 'calendar_unavailable');
    throw err;
  }
  const defect = nominationRecordDefectOf(record, given);
  if (defect) {
    const err = new Error(`the nomination builder's record is malformed (${defect}); nothing was written`);
    err.code = 'nomination_malformed';
    throw err;
  }
  return record;
}

const nominateFingerprint = (agentId, entryId, expectedVersion) => canonicalContentHash({ kind: 'nominate', agentId, entryId, expectedVersion });

/**
 * Build C §4 — NOMINATE: offer a card to the agent. The preconditions in the spec's order, each with its refusal:
 *   the entry is the caller's, under the attribution agent the route resolved (404 not_found; 403 forbidden — RK-1);
 *   a replay of the same op id is the IDEMPOTENT answer (another request under it → 409 op_conflict);
 *   the version the caller saw (409 version_conflict);
 *   the entry is at `card` and not shelved (409 illegal_transition — the spec's one refusal for both);
 *   THE SOURCE the card was filed from (C1 fix round, Astra F1; exit criterion 8 covers a nomination as it covers a
 *   create): `verifySource(tx, entry, agentId)`, the route's own source checks handed in as create's are (api/film-room/
 *   card.js verifyEntrySourceIn), so this store imports no tape module — the battle's owner and attribution, the tape's
 *   coverage, the exact stored moment, its situation version and its archetype, each read THROUGH THE TRANSACTION, so a
 *   change between that read and the commit conflicts and is judged again; a changed or unavailable source refuses with
 *   the route's existing source error and neither half is written. Judged after the stage and before the book, as a
 *   create judges its source before its book; a successful replay above answers before it, whatever the tape says now;
 *   the owner's book is open — `book`, read by the route through the seam BEFORE this transaction and judged here,
 *   in its place in the order (409 book_not_open, the body naming nothing of any book).
 * Then ONE transaction writes both halves: the nomination record at `mandates/{bookId}/nominations/{opId}` (the
 * Practice Field's builder; the op id is the nomination id, refused 409 op_conflict if the book already holds one under
 * it) and the entry's move to `nominated` with `nomination: { bookId, nominationId, state: 'queued' }`, a player row in
 * `stageHistory`, `version + 1`. Never the note, the question, the route or the source.
 *
 * @returns {Promise<{ idempotent: boolean, card: object }>}
 */
export async function nominateCard(db, { uid, agentId, entryId, opId, expectedVersion, nowIso, book = null, verifySource = null }) {
  // F1: a new nomination never commits without its source judged — a caller that hands no verifier is a bug, refused
  // before any read
  if (typeof verifySource !== 'function') throw new Error('nominateCard: verifySource is required');
  const opFingerprint = nominateFingerprint(agentId, entryId, expectedVersion);
  return db.runTransaction(async (tx) => {
    const agent = ownedAgent(await tx.get(agentRefOf(db, agentId)), uid);
    const ref = playRefOf(db, agentId, entryId);
    const snap = await tx.get(ref);
    if (!snap?.exists) throw fail(404, 'not_found');
    const entry = typeof snap.data === 'function' ? snap.data() : snap.data;
    if (!isObj(entry) || entry.ownerId !== uid) throw fail(403, 'forbidden');
    const history = Array.isArray(entry.stageHistory) ? entry.stageHistory : [];
    const replay = playerReplayOf(history, opId);
    if (replay) {
      if (replay.opFingerprint === opFingerprint) return { idempotent: true, card: entry };
      throw fail(409, 'op_conflict', { entryId });
    }
    if (expectedVersion !== entry.version) throw fail(409, 'version_conflict', { currentVersion: entry.version });
    if (entry.stage !== 'card' || isShelved(entry, agent.shelf)) throw fail(409, 'illegal_transition', { stage: entry.stage });
    // F1: the filed source, judged again inside this transaction (reads only, so before every write)
    await verifySource(tx, entry, agentId);
    // Amendment A CA-12: the book re-read in this transaction, at the precondition's place
    await requireOpenBookIn(tx, db, { book, uid, agentId });
    const nominationRef = nominationRefOf(db, book.bookId, opId);
    if ((await tx.get(nominationRef))?.exists) throw fail(409, 'op_conflict', { entryId });
    const nomination = nominationDocOf({ entryId, card: entry, nowIso });
    const patch = {
      stage: 'nominated',
      stageAt: nowIso,
      nomination: { bookId: book.bookId, nominationId: opId, state: 'queued' },
      stageHistory: [...history, { stage: 'nominated', at: nowIso, by: BY_PLAYER, opId, opFingerprint }],
      version: entry.version + 1,
    };
    tx.set(nominationRef, nomination);
    tx.update(ref, patch);
    return { idempotent: false, card: { ...entry, ...patch } };
  });
}

/** gRPC ABORTED: a transaction's contention, which the Admin SDK retries — rethrown as it came, never mapped. */
const GRPC_ABORTED = 10;
const unavailableNomination = () => fail(503, 'nomination_unavailable');

/**
 * Amendment A CA-1 / CA-2 / CA-5 — what a player retire the one export's isRetirableByPlayer refuses says: the stage,
 * and beside it what holds the card — the copy's nomination state (an accepted nomination), or the waiting offer's state.
 * A testing card says its stage and nothing else.
 */
function retireRefusalOf(entry) {
  if (entry.stage === 'nominated') return { stage: 'nominated', nominationState: entry.nomination?.state ?? null };
  if (entry.stage === 'tested') return { stage: 'tested', offerState: entry.offer?.state ?? null };
  return { stage: entry.stage };
}

/** The source reference of a nomination record, field by field — the five the record names its card by. */
const sameSource = (a, b) => isPlainObject(a) && isPlainObject(b) && ['kind', 'entryId', 'situationId', 'questionId', 'questionVersion'].every((k) => a[k] === b[k]);

/**
 * CA-2 — the record's withdrawal, by the Practice Field's builder (the seam's buildWithdrawal), checked before any write:
 * a plain object, `state: 'withdrawn'`, and the record's OWN source reference. A builder that throws, or an output that
 * is not that, fails closed — 503 nomination_unavailable, nothing written, the card not retired.
 */
function withdrawalOf(record, nowIso) {
  let out;
  try {
    out = buildWithdrawal(record, { nowIso });
  } catch (err) {
    if (err?.code === GRPC_ABORTED) throw err;
    console.error('[film-room/cards] withdrawal builder failed:', err?.message ?? err);
    throw unavailableNomination();
  }
  if (!isPlainObject(out) || out.state !== 'withdrawn' || !sameSource(out.source, record.source)) {
    console.error('[film-room/cards] withdrawal builder returned a malformed record; nothing was written');
    throw unavailableNomination();
  }
  return out;
}

/**
 * Retire a card: a compare-and-set on the version the caller saw. Its checks, in order: the owner, the replay (a
 * successful retire's replay answers, whatever happened since), the version, shelving, the open predicate
 * (isOpenStage), then Amendment A's player rule (isRetirableByPlayer, the one export's — the receipt reads it too):
 *   CA-1  a `testing` card is refused, 409 illegal_transition `{ stage: 'testing' }` — its idea runs with it as its source;
 *   CA-5  a `tested` card with an offer waiting is refused, `{ stage: 'tested', offerState }` — the offer is answered in
 *         the Forge;
 *   CA-2  a `nominated` card whose copy says `accepted` is refused, `{ stage: 'nominated', nominationState: 'accepted' }`.
 * CA-2 — RETIRING A NOMINATED CARD WITHDRAWS IT: for a `nominated` entry holding a `nomination`, this transaction reads
 * the book's record at the entry's own `nomination.bookId` / `nominationId` before any write, and THE RECORD, not the
 * copy, decides —
 *   accepted                         409 illegal_transition `{ stage: 'nominated', nominationState: 'accepted' }`; nothing written;
 *   queued · considered · deferred   the record moves to `withdrawn` (the seam's buildWithdrawal, checked) and the entry
 *                                    retires, its copy's state `withdrawn` — both in this one transaction;
 *   declined · expired · withdrawn   the entry retires, its copy's state the record's; nothing written to the book;
 *   no document                      the entry retires; nothing written to the book.
 * It fails closed: a record read that fails, a record whose state is not one of NOMINATION_STATES, a builder that throws
 * or returns anything but a plain `withdrawn` record with the record's own source → 503 nomination_unavailable, nothing
 * written, the card not retired. A contention abort (gRPC ABORTED) is rethrown as it came, so the SDK retries. The book's
 * status is not read: a withdrawal is the player's answer, whatever state the book is in (CA-12). A v1 entry with no
 * `nomination` (stored route `drill`) retires as before.
 *
 * @returns {Promise<{ idempotent: boolean, card: object }>}
 */
export async function retireCard(db, { uid, agentId, entryId, opId, expectedVersion, nowIso }) {
  const opFingerprint = retireFingerprint(agentId, entryId, expectedVersion);
  return db.runTransaction(async (tx) => {
    const agent = ownedAgent(await tx.get(agentRefOf(db, agentId)), uid);
    const ref = playRefOf(db, agentId, entryId);
    const snap = await tx.get(ref);
    if (!snap?.exists) throw fail(404, 'not_found');
    const entry = typeof snap.data === 'function' ? snap.data() : snap.data;
    if (!isObj(entry) || entry.ownerId !== uid) throw fail(403, 'forbidden');
    const replay = playerReplayOf(Array.isArray(entry.stageHistory) ? entry.stageHistory : [], opId);
    if (replay) {
      if (replay.opFingerprint === opFingerprint) return { idempotent: true, card: entry };
      throw fail(409, 'op_conflict', { entryId });
    }
    if (expectedVersion !== entry.version) throw fail(409, 'version_conflict', { currentVersion: entry.version });
    if (isShelved(entry, agent.shelf)) throw fail(409, 'shelved', { archetypeCodeId: entry.archetypeCodeId });
    // Build C §3: the player retires an OPEN card, as before — open by the one export's predicate (isOpenStage, Amendment
    // A CA-3); `retired`, `installed`, a parked card and a nominated card the agent did not take are no transition
    if (!isOpenStage(entry)) throw fail(409, 'illegal_transition', { stage: entry.stage });
    // Amendment A CA-1 / CA-2 (the copy's side) / CA-5: the player's own rule, the one the receipt reads
    if (!isRetirableByPlayer(entry)) throw fail(409, 'illegal_transition', retireRefusalOf(entry));
    // CA-2: a nominated card's record, read before any write — the record decides
    const copy = entry.stage === 'nominated' && isObj(entry.nomination) ? entry.nomination : null;
    let recordRef = null;
    let withdrawal = null;
    let copyState = null;
    if (copy) {
      if (!pathIdOk(copy.bookId) || !pathIdOk(copy.nominationId)) throw unavailableNomination();
      recordRef = nominationRefOf(db, copy.bookId, copy.nominationId);
      let recordSnap;
      try {
        recordSnap = await tx.get(recordRef);
      } catch (err) {
        if (err?.cardRoute || err?.code === GRPC_ABORTED) throw err;
        console.error('[film-room/cards] nomination record read failed:', err?.message ?? err);
        throw unavailableNomination();
      }
      if (recordSnap?.exists) {
        const record = typeof recordSnap.data === 'function' ? recordSnap.data() : recordSnap.data;
        if (!isObj(record) || !NOMINATION_STATES.includes(record.state)) throw unavailableNomination();
        if (record.state === 'accepted') throw fail(409, 'illegal_transition', { stage: 'nominated', nominationState: 'accepted' });
        if (WITHDRAWABLE_STATES.includes(record.state)) {
          withdrawal = withdrawalOf(record, nowIso);
          copyState = 'withdrawn';
        } else {
          copyState = record.state;   // declined, expired, withdrawn: the copy takes the record's state
        }
      }
    }
    const patch = {
      stage: 'retired',
      stageAt: nowIso,
      ...(copyState ? { nomination: { ...copy, state: copyState } } : {}),
      stageHistory: [...entry.stageHistory, { stage: 'retired', at: nowIso, by: BY_PLAYER, opId, opFingerprint }],
      version: entry.version + 1,
    };
    // CA-2 / CA-20: the record's withdrawal, beside the entry's retire — both or neither, in this one transaction
    if (withdrawal) tx.set(recordRef, withdrawal);
    tx.update(ref, patch);
    return { idempotent: false, card: { ...entry, ...patch } };
  });
}

const parkFingerprint = (agentId, entryId, expectedVersion) => canonicalContentHash({ kind: 'park', agentId, entryId, expectedVersion });

/**
 * Build C §3 (refinement R-C1-2) — PARK a tested card: the player's, from the receipt, once a result is shown. A
 * compare-and-set on the version the caller saw: the entry must be `tested` with no `parkedAt` (409 illegal_transition
 * otherwise — an open card, a parked one); its replay is the idempotent answer. Writes `parkedAt` and nothing else of
 * the card: `version + 1` and a `stageHistory` row (`event: 'parked'`, the stage unchanged). A parked card counts open
 * no more (isOpenStage). Shelving is not judged: parking moves no stage.
 *
 * @returns {Promise<{ idempotent: boolean, card: object }>}
 */
export async function parkCard(db, { uid, agentId, entryId, opId, expectedVersion, nowIso }) {
  const opFingerprint = parkFingerprint(agentId, entryId, expectedVersion);
  return db.runTransaction(async (tx) => {
    ownedAgent(await tx.get(agentRefOf(db, agentId)), uid);
    const ref = playRefOf(db, agentId, entryId);
    const snap = await tx.get(ref);
    if (!snap?.exists) throw fail(404, 'not_found');
    const entry = typeof snap.data === 'function' ? snap.data() : snap.data;
    if (!isObj(entry) || entry.ownerId !== uid) throw fail(403, 'forbidden');
    const history = Array.isArray(entry.stageHistory) ? entry.stageHistory : [];
    const replay = playerReplayOf(history, opId);
    if (replay) {
      if (replay.opFingerprint === opFingerprint) return { idempotent: true, card: entry };
      throw fail(409, 'op_conflict', { entryId });
    }
    if (expectedVersion !== entry.version) throw fail(409, 'version_conflict', { currentVersion: entry.version });
    if (entry.stage !== 'tested' || entry.parkedAt) throw fail(409, 'illegal_transition', { stage: entry.stage });
    const patch = {
      parkedAt: nowIso,
      stageHistory: [...history, { stage: entry.stage, event: 'parked', at: nowIso, by: BY_PLAYER, opId, opFingerprint }],
      version: entry.version + 1,
    };
    tx.update(ref, patch);
    return { idempotent: false, card: { ...entry, ...patch } };
  });
}

// ── the server's transitions (Build C §3, §4): the Practice Field's one way in ──────────────────────────────────

/**
 * The server's transitions and the order they keep (spec §3: `nominated → testing → tested → installed`, `tested →
 * retired`): the stage each moves FROM, the stage it moves TO, and the ONE field of the entry it sets. `nomination`
 * moves no stage: it copies the book's nomination state onto the entry, which stays `nominated`. Amendment A:
 *   CA-5   `offered` moves no stage either: a Forge offer made from the card's tested idea, waiting at `tested`;
 *   CA-22  `tested` may also come straight from `nominated` (`directFrom`) — only with the Practice Field's own fact
 *          `noFill: true` that the accepted idea ended before its first fill — and then also sets the entry's `idea`
 *          from the accepted copy, the one named exception to the one-field patch.
 */
export const SERVER_TRANSITIONS = Object.freeze({
  nomination: Object.freeze({ from: 'nominated', to: 'nominated', field: 'nomination' }),
  testing: Object.freeze({ from: 'nominated', to: 'testing', field: 'idea' }),
  tested: Object.freeze({ from: 'testing', to: 'tested', field: 'result', directFrom: 'nominated' }),
  offered: Object.freeze({ from: 'tested', to: 'tested', field: 'offer' }),
  installed: Object.freeze({ from: 'tested', to: 'installed', field: 'offer' }),
  retired: Object.freeze({ from: 'tested', to: 'retired', field: 'offer' }),
});

/** A writer's name on a server row: a short identifier (`practice_field`, `practice_field.t2`). */
const WRITER_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
/** The longest agent reason the ledger keeps a copy of, in code points (the book bounds its own; this is the copy's guard). */
export const NOMINATION_REASON_MAX = 2000;
/** Amendment A CA-4: the longest thesis an accepted copy carries, and the longest closing note a result carries — code points. */
export const THESIS_MAX = 400;
export const CLOSING_NOTE_MAX = 600;
/** Code points, astral characters counted once — the text itself is kept exactly. */
const codePoints = (s) => [...s].length;
/** A bounded text, present: a non-empty string of at most `max` code points. */
const textOk = (v, max) => typeof v === 'string' && v.length > 0 && codePoints(v) <= max;
const idOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200;
const wordOk = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isoOk = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const pathIdOk = (v) => isValidForgeId(v) && !/^__.*__$/.test(v);
const invalid = (why) => fail(400, 'invalid_transition', { why });

/**
 * The field a transition sets, from its payload — exactly the fields spec §3 names, and nothing else of the payload.
 * Throws 400 invalid_transition on a payload the ledger does not take.
 */
function fieldOfTransition(to, payload) {
  const p = isObj(payload) ? payload : {};
  if (to === 'nomination') {
    // `queued` is the filing's, and `withdrawn` the player retire's alone (Amendment A CA-2): never a copied state
    if (!NOMINATION_STATES.includes(p.state) || p.state === 'queued' || p.state === 'withdrawn') throw invalid('state');
    if (!idOk(p.bookId) || !idOk(p.nominationId)) throw invalid('ids');
    if (p.reason != null && (typeof p.reason !== 'string' || codePoints(p.reason) > NOMINATION_REASON_MAX)) throw invalid('reason');
    if (p.consideredAt != null && !isoOk(p.consideredAt)) throw invalid('consideredAt');
    const copy = { bookId: p.bookId, nominationId: p.nominationId, state: p.state, reason: p.reason ?? null, consideredAt: p.consideredAt ?? null };
    // Amendment A CA-4: an ACCEPTED copy carries the idea it became (required — `testing` is bound to it, CA-11) and,
    // optionally, the idea's thesis (at most THESIS_MAX code points, kept exactly), which needs its own instant
    if (p.state === 'accepted') {
      if (!idOk(p.ideaId)) throw invalid('ideaId');
      if (p.thesis != null && !textOk(p.thesis, THESIS_MAX)) throw invalid('thesis');
      if (p.thesis != null && p.consideredAt == null) throw invalid('consideredAt');
      Object.assign(copy, { ideaId: p.ideaId, thesis: p.thesis ?? null });
    }
    return copy;
  }
  if (to === 'testing') {
    if (!idOk(p.bookId) || !idOk(p.ideaId)) throw invalid('ids');
    return { bookId: p.bookId, ideaId: p.ideaId };
  }
  if (to === 'tested') {
    if (!idOk(p.ideaId) || !idOk(p.resultRef)) throw invalid('ids');
    if (!wordOk(p.contractCondition) || !wordOk(p.economicResult)) throw invalid('result');
    // Amendment A CA-22: `noFill` is the Practice Field's own fact that nothing was filled — true, or absent (false)
    if (p.noFill != null && typeof p.noFill !== 'boolean') throw invalid('noFill');
    const result = { ideaId: p.ideaId, resultRef: p.resultRef, contractCondition: p.contractCondition, economicResult: p.economicResult, ...(p.noFill === true ? { noFill: true } : {}) };
    // Amendment A CA-4: the agent's closing note (at most CLOSING_NOTE_MAX code points, kept exactly) with its own instant
    if (p.closingNote != null) {
      if (!textOk(p.closingNote, CLOSING_NOTE_MAX)) throw invalid('closingNote');
      if (!isoOk(p.closingNoteAt)) throw invalid('closingNoteAt');
      Object.assign(result, { closingNote: p.closingNote, closingNoteAt: p.closingNoteAt });
    }
    return result;
  }
  // Amendment A CA-5 / CA-14: `offered`, `installed` and the server's `retired` each name the idea they come from
  if (to === 'offered') {
    if (!idOk(p.ideaId) || !idOk(p.offerId) || p.state !== 'offered') throw invalid('offer');
    return { ideaId: p.ideaId, offerId: p.offerId, state: 'offered' };
  }
  if (to === 'installed') {
    if (!idOk(p.ideaId)) throw invalid('ideaId');
    if (!idOk(p.offerId) || !wordOk(p.state)) throw invalid('offer');
    return { ideaId: p.ideaId, offerId: p.offerId, state: p.state };
  }
  // retired — the server's retire: the idea retired, with the Forge offer's state (or none, its id null)
  if (!idOk(p.ideaId)) throw invalid('ideaId');
  if (p.offerId != null && !idOk(p.offerId)) throw invalid('offer');
  if (!wordOk(p.state)) throw invalid('offer');
  return { ideaId: p.ideaId, offerId: p.offerId ?? null, state: p.state };
}

/**
 * The record a transition must be BOUND to (spec §3: bound to the idea's original run and the entry's owner): a
 * nomination copy names the entry's own nomination; `testing` the entry's own book AND the idea its ACCEPTED copy names
 * (Amendment A CA-11: the copy must be `accepted`, and `payload.ideaId` its `ideaId`); `tested` the entry's own idea.
 */
function boundOf(to, entry, field) {
  if (to === 'nomination') return entry.nomination?.bookId === field.bookId && entry.nomination?.nominationId === field.nominationId;
  if (to === 'testing') {
    const copy = isObj(entry.nomination) ? entry.nomination : null;
    return Boolean(copy) && copy.bookId === field.bookId && copy.state === 'accepted' && idOk(copy.ideaId) && copy.ideaId === field.ideaId;
  }
  // `tested` names the entry's own idea — or, straight from `nominated` (CA-22), the idea its accepted copy names
  if (to === 'tested') return entry.stage === SERVER_TRANSITIONS.tested.directFrom ? idOk(entry.nomination?.ideaId) && entry.nomination.ideaId === field.ideaId : idOk(entry.idea?.ideaId) && entry.idea.ideaId === field.ideaId;
  // CA-5 / CA-14: the idea must be present and the payload's (a missing idea never passes as undefined === undefined)
  const ideaBound = idOk(entry.idea?.ideaId) && entry.idea.ideaId === field.ideaId;
  if (to === 'offered') return ideaBound;
  // `installed` needs the waiting offer, by its id; the server's retire the offer's id when one exists, and null when none does
  const offerId = isObj(entry.offer) ? entry.offer.offerId : null;
  if (to === 'installed') return ideaBound && isObj(entry.offer) && idOk(offerId) && offerId === field.offerId;
  return ideaBound && (isObj(entry.offer) ? idOk(offerId) && offerId === field.offerId : field.offerId === null);
}

/**
 * Build C §3 — THE LEDGER'S TRANSITION HELPER, server-only, for the Practice Field: one transaction that moves an entry
 * along the server's legal order, or copies the book's nomination state onto it.
 *
 *   to          `nomination` (copies `{ state, reason, consideredAt, bookId, nominationId }` onto `entry.nomination` —
 *               an `accepted` copy also `ideaId` and an optional `thesis`, CA-4; the stage stays `nominated`; the move
 *               judged against the copy's current state by the nomination order, CA-11), `testing` (sets `idea`; only
 *               from an accepted copy, bound to its `ideaId`), `tested` (sets `result`, an optional `closingNote` with
 *               its `closingNoteAt`, CA-4; from `testing`, or straight from `nominated` with `noFill: true` and an
 *               accepted copy, setting `idea` from it too, CA-22), `offered` (sets `offer` at `tested`, the stage
 *               unchanged; one offer per card, bound to the idea, CA-5), `installed` (sets `offer`; needs the waiting
 *               offer by its id and the idea, CA-14) or `retired` (the server's retire, with `offer.state`; bound to the
 *               idea, and to the offer's id when one exists — `offerId: null` only when none does, CA-14).
 *   checks      the entry exists (404 not_found); it is `ownerId`'s and `agentId`'s (403 forbidden); its op id has not
 *               been used (a replay of the same transition is the IDEMPOTENT answer; another under that op id → 409
 *               op_conflict); it is at the transition's FROM stage (409 illegal_transition); the payload names the
 *               entry's own nomination, book or idea (409 nomination_mismatch).
 *   writes      the one field, the stage and its instant (a stage move), a `stageHistory` row `by: 'server'` with the
 *               writer named (`writer`), and `version + 1`. Never `note`, `question`, `route` or `source`; never
 *               `stageVocabVersion` (a v1 entry stays v1).
 * A SHELVED entry still transitions (spec §3, contract V2 §7): shelving is not read here.
 *
 * @param {object} db
 * @param {{ entryId: string, ownerId: string, agentId: string, to: string, by: string, payload: object, opId: string, nowIso?: string }} p
 * @returns {Promise<{ idempotent: boolean, entry: object }>}
 */
export async function applyServerTransition(db, { entryId, ownerId, agentId, to, by, payload, opId, nowIso = new Date().toISOString() }) {
  // C1 review A-1: `to` must be a STRING key of the table — an array or a String object would coerce to a key and then
  // miss every branch that compares `to` with ===
  const step = typeof to === 'string' && Object.prototype.hasOwnProperty.call(SERVER_TRANSITIONS, to) ? SERVER_TRANSITIONS[to] : null;
  if (!step) throw invalid('to');
  if (typeof by !== 'string' || !WRITER_NAME.test(by)) throw invalid('by');
  // C1 review A-10: the ids that build the document path are held to the forge-id class (no `/`, never a reserved
  // `__id__`), as the endpoint holds the player's; the instant must be one
  if (!pathIdOk(entryId) || !pathIdOk(agentId) || !idOk(ownerId) || !idOk(opId)) throw invalid('ids');
  if (!isoOk(nowIso)) throw invalid('nowIso');
  const field = fieldOfTransition(to, payload);
  const opFingerprint = canonicalContentHash({ kind: 'server', to, agentId, entryId, by, field });
  return db.runTransaction(async (tx) => {
    const ref = playRefOf(db, agentId, entryId);
    const snap = await tx.get(ref);
    if (!snap?.exists) throw fail(404, 'not_found');
    const entry = typeof snap.data === 'function' ? snap.data() : snap.data;
    if (!isObj(entry) || entry.ownerId !== ownerId || entry.agentId !== agentId) throw fail(403, 'forbidden');
    const history = Array.isArray(entry.stageHistory) ? entry.stageHistory : [];
    const replay = serverReplayOf(history, opId);
    if (replay) {
      if (replay.opFingerprint === opFingerprint) return { idempotent: true, entry };
      throw fail(409, 'op_conflict', { entryId });
    }
    // CA-22: `tested` straight from `nominated` only with the Practice Field's noFill fact and an accepted copy; noFill
    // from `testing` is no such move (a filled idea always sends testing first)
    const direct = Boolean(step.directFrom) && entry.stage === step.directFrom;
    if (entry.stage !== step.from && !direct) throw fail(409, 'illegal_transition', { stage: entry.stage });
    if (direct && field.noFill !== true) throw fail(409, 'illegal_transition', { stage: entry.stage });
    if (direct && entry.nomination?.state !== 'accepted') throw fail(409, 'illegal_transition', { stage: entry.stage, nominationState: entry.nomination?.state ?? null });
    if (to === 'tested' && !direct && field.noFill === true) throw fail(409, 'illegal_transition', { stage: entry.stage });
    if (!boundOf(to, entry, field)) throw fail(409, 'nomination_mismatch', { entryId });
    // CA-5: one offer per card — while the entry holds one, another `offered` is refused (its own replay answered above)
    if (to === 'offered' && entry.offer != null) throw fail(409, 'illegal_transition', { offerState: isObj(entry.offer) ? entry.offer.state ?? null : null });
    // Amendment A CA-11: THE NOMINATION ORDER, judged against the entry's current copy (after the replay, before any
    // write) — a late copy, or one out of order, is refused; a lost one does not block the next (queued answers directly)
    if (to === 'nomination' && !nominationMayMove(entry.nomination?.state, field.state)) throw fail(409, 'illegal_transition', { nominationState: entry.nomination?.state ?? null });
    const row = { stage: step.to, at: nowIso, by: BY_SERVER, writer: by, opId, opFingerprint };
    // CA-11 / CA-4: a nomination row keeps the copy's own state, reason and consideredAt (and an accepted copy's idea and
    // thesis), so each answer is quoted from its own row at its own time — a later copy never overwrites an earlier answer
    if (to === 'nomination') Object.assign(row, { event: 'nomination', state: field.state, reason: field.reason, consideredAt: field.consideredAt, ...(field.state === 'accepted' ? { ideaId: field.ideaId, thesis: field.thesis } : {}) });
    // CA-5: the offer's own row, so the chain never draws a second "Tested"; the stage's instant does not move
    if (to === 'offered') Object.assign(row, { event: 'offered', ideaId: field.ideaId, offerId: field.offerId });
    // CA-22: the stored fact on the row itself — the chain reads it, never a missing `testing` row
    if (to === 'tested' && field.noFill === true) row.noFill = true;
    const patch = {
      // CA-22, the named exception: straight from `nominated`, the idea the accepted copy names, in this one write
      ...(direct ? { idea: { bookId: entry.nomination.bookId, ideaId: entry.nomination.ideaId } } : {}),
      [step.field]: field,
      ...(step.to !== entry.stage ? { stage: step.to, stageAt: nowIso } : {}),
      stageHistory: [...history, row],
      version: entry.version + 1,
    };
    tx.update(ref, patch);
    return { idempotent: false, entry: { ...entry, ...patch } };
  });
}

/**
 * The owner's cards for one agent, newest first, each with its computed
 * `shelved`, and the agent's current archetype — read from ONE snapshot (a
 * read-only transaction), so a card created between two reads can never appear
 * beside a stale archetype.
 *
 * @returns {Promise<{ agentId: string, archetypeCodeId: string, cards: object[], open: number, cap: number }>}
 */
export async function readCards(db, { uid, agentId }) {
  return db.runTransaction(async (tx) => {
    const agent = ownedAgent(await tx.get(agentRefOf(db, agentId)), uid);
    const all = docsOf(await tx.get(playsColOf(db, agentId))).filter((e) => e.ownerId === uid);
    const cards = withShelving(all, agent.shelf).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return { agentId, archetypeCodeId: agent.archetype, cards, open: openCardCount(all, agent.shelf), cap: OPEN_CARD_CAP };
  }, { readOnly: true });
}
