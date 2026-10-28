// api/_utils/filmRoom/cardStore.js
//
// Film Room B2 item 4 — THE LEDGER (Build B spec §4; shared contract §5;
// Amendment G RG-8): `agents/{agentId}/plays/{entryId}`. A card and, in the
// camp's later builds, a play are ONE entry at different stages. This build
// writes stages `card`, `nominated` (route `drill`) and `retired`; the later
// stages belong to the camp. Writes are SERVER-ONLY (the Admin SDK, through
// POST /api/film-room/card); the owner reads, by the document's own ownerId
// (firestore.rules). The gate is the ROUTE's job (cardsGate.js); nothing here
// reads the flag.
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
//            open-card cap (S9: the caller's own cards at `card` or
//            `nominated` that are not shelved) → 409 cap_reached, naming the
//            cap. Then `tx.create` — never an overwrite.
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

import { canonicalContentHash } from '../canonicalHash.js';
import { CARD_SLOTS, CARD_SLOTS_VERSION } from '../../../src/data/cardSlots.js';

export const PLAYS_SUBCOLLECTION = 'plays';
export const CARD_SCHEMA_VERSION = 1;
/** A card's three routes (spec §4): Watch, Practice (`drill`), Set. */
export const CARD_ROUTES = Object.freeze(['watch', 'drill', 'set']);
/** The stages this build writes. The camp's `drilled → drafted → proven → installed` are not here. */
export const CARD_STAGES = Object.freeze(['card', 'nominated', 'retired']);
/** The stages an entry is OPEN at (it counts toward S9 when it is not shelved). */
export const OPEN_STAGES = Object.freeze(['card', 'nominated']);
/** Who moves a card in this build: the player, through the card endpoint. */
export const BY_PLAYER = 'player';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);

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
  cap_reached: 'The open-card cap for this agent is reached. Retire a card first.',
  shelved: 'This card is shelved: it was made under another archetype and cannot move until the agent returns to it.',
  illegal_transition: 'That change is not allowed from the card\'s current stage.',
  agent_unresolved: 'This agent records no archetype, so no card can be filed under it.',
  archetype_changed: 'This day was taped under another archetype than the agent\'s current one, so a card from it would be shelved at birth. Nothing was filed.',
});
const fail = (status, code, extra) => new CardRouteError(status, code, CARD_ROUTE_COPY[code], extra);

export const agentRefOf = (db, agentId) => db.collection('agents').doc(agentId);
export const playsColOf = (db, agentId) => agentRefOf(db, agentId).collection(PLAYS_SUBCOLLECTION);
export const playRefOf = (db, agentId, entryId) => playsColOf(db, agentId).doc(entryId);

/** The agent as its owner may see it: missing → agent_not_found; another owner → forbidden; no archetype → agent_unresolved. */
function ownedAgent(snap, uid) {
  if (!snap?.exists) throw fail(404, 'agent_not_found');
  const data = typeof snap.data === 'function' ? snap.data() : snap.data;
  if (!isObj(data) || data.ownerId !== uid) throw fail(403, 'forbidden');
  const archetype = str(data.archetype);
  if (!archetype) throw fail(409, 'agent_unresolved');
  return { data, archetype };
}

const docsOf = (snap) => (snap?.docs || []).map((d) => (typeof d.data === 'function' ? d.data() : d.data)).filter(isObj);

// ── shelving and the cap — computed, never written ──────────────────────────

/** Ruling 5: an entry made under another archetype than the agent's current one is shelved. Computed at read. */
export const isShelved = (entry, currentArchetype) => entry?.archetypeCodeId !== currentArchetype;
/** Open: at `card` or `nominated`, and not shelved — what S9 counts (RG-8). */
export const isOpen = (entry, currentArchetype) => OPEN_STAGES.includes(entry?.stage) && !isShelved(entry, currentArchetype);
/** The entries with their computed `shelved` beside them (a read-time field, never stored). */
export const withShelving = (entries, currentArchetype) => entries.map((e) => ({ ...e, shelved: isShelved(e, currentArchetype) }));
/** How many of the entries count against S9. */
export const openCardCount = (entries, currentArchetype) => entries.filter((e) => isOpen(e, currentArchetype)).length;
/** S9 as it stands. */
export const OPEN_CARD_CAP = CARD_SLOTS.S9.openCardsPerAgent;

/** The stage a route starts at: Practice nominates; Watch and Set file a card. */
export const stageForRoute = (route) => (route === 'drill' ? 'nominated' : 'card');

/**
 * The entry as created (spec §4): written once — the identity, the archetype
 * it was created under, the situation and its version, the source moment, the
 * question and its version, the note verbatim, the route — and the envelope.
 */
export function buildCardDoc({ entryId, uid, agentId, opId, opFingerprint, nowIso, payload }) {
  const stage = stageForRoute(payload.route);
  return {
    schemaVersion: CARD_SCHEMA_VERSION,
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
 * @param {object} db
 * @param {{ uid: string, agentId: string, opId: string, nowIso: string, request?: object,
 *           payload: { archetypeCodeId: string, situationId: string, situationVersion: number,
 *                      battleId: string, etDate: string, symbol: string, fromTickSeq: number|null, toTickSeq: number|null,
 *                      questionId: string, questionVersion: number, note: string, route: 'watch'|'drill'|'set' } }} p
 * @returns {Promise<{ idempotent: boolean, card: object, open: number, cap: number }>}
 */
export async function createCard(db, { uid, agentId, opId, payload, nowIso, request = null, verifySource = null }) {
  const opFingerprint = createFingerprint(agentId, request, payload);
  return db.runTransaction(async (tx) => {
    const agent = ownedAgent(await tx.get(agentRefOf(db, agentId)), uid);
    const ref = playRefOf(db, agentId, opId);
    const existingSnap = await tx.get(ref);
    // the cap counts the caller's own entries only, as readCards does (Amendment I RI-1)
    const all = docsOf(await tx.get(playsColOf(db, agentId))).filter((e) => e.ownerId === uid);
    const open = openCardCount(all, agent.archetype);
    if (existingSnap?.exists) {
      const existing = typeof existingSnap.data === 'function' ? existingSnap.data() : existingSnap.data;
      // a replay answers only the entry's OWN owner (RI-1, Astra F1): a missing or another ownerId is refused as a
      // foreign op id is, and the body holds nothing of the entry
      if (!isObj(existing) || existing.ownerId !== uid) throw fail(409, 'op_conflict', { entryId: opId });
      if (existing.opFingerprint === opFingerprint) return { idempotent: true, card: existing, open, cap: OPEN_CARD_CAP };
      throw fail(409, 'op_conflict', { entryId: opId });
    }
    // Amendment I RI-3 (Astra B3): the source day is re-read and its coverage and exact moment checked again HERE,
    // inside the transaction that files the card (the route hands its checks in — api/film-room/card.js
    // verifySourceIn — so this store imports no tape module): a re-write between the route's read and this commit
    // refuses rather than filing a card for a moment the tape no longer holds. A read, so it precedes the write.
    if (verifySource) await verifySource(tx);
    if (payload.archetypeCodeId !== agent.archetype) throw fail(409, 'archetype_changed', { archetypeCodeId: payload.archetypeCodeId, current: agent.archetype });
    if (open >= OPEN_CARD_CAP) throw fail(409, 'cap_reached', { cap: OPEN_CARD_CAP, open });
    const card = buildCardDoc({ entryId: opId, uid, agentId, opId, opFingerprint, nowIso, payload });
    tx.create(ref, card);
    return { idempotent: false, card, open: open + 1, cap: OPEN_CARD_CAP };
  });
}

/**
 * Retire a card: a compare-and-set on the version the caller saw.
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
    const replay = (Array.isArray(entry.stageHistory) ? entry.stageHistory : []).find((h) => h?.opId === opId);
    if (replay) {
      if (replay.opFingerprint === opFingerprint) return { idempotent: true, card: entry };
      throw fail(409, 'op_conflict', { entryId });
    }
    if (expectedVersion !== entry.version) throw fail(409, 'version_conflict', { currentVersion: entry.version });
    if (isShelved(entry, agent.archetype)) throw fail(409, 'shelved', { archetypeCodeId: entry.archetypeCodeId });
    if (entry.stage === 'retired' || !OPEN_STAGES.includes(entry.stage)) throw fail(409, 'illegal_transition', { stage: entry.stage });
    const patch = {
      stage: 'retired',
      stageAt: nowIso,
      stageHistory: [...entry.stageHistory, { stage: 'retired', at: nowIso, by: BY_PLAYER, opId, opFingerprint }],
      version: entry.version + 1,
    };
    tx.update(ref, patch);
    return { idempotent: false, card: { ...entry, ...patch } };
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
    const cards = withShelving(all, agent.archetype).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return { agentId, archetypeCodeId: agent.archetype, cards, open: openCardCount(all, agent.archetype), cap: OPEN_CARD_CAP };
  }, { readOnly: true });
}
