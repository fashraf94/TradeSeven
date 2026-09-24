// api/_utils/backingTeamLabels.js
//
// Backing pre-flip cleanup — D-af (Amendment C §C1): A TEAM IS NAMED BY ITS
// PRIMARY AGENT. The ONE server-side resolver every backing endpoint that names
// a team goes through: the pod list (pod rows, seats, the viewer's stakes), the
// results reader (the winner line, the team rows, the viewer's stakes), the
// team labels reader (Your Backing and the strip's in-play half), the stake
// reply (the confirmation) and the team card (its single-label uses). The
// client renders `label` and never composes a name from an id.
//
// THE CHAIN, in order — `teamLabelFor({ odUserId, agentId? })` → `{ label, secondary }`:
//   · a CPU seat → its agent name (`cpuDisplayName`, the one home of the CPU
//     label format — tournamentLeaderboard.js over tournamentCpu.js
//     `cpuAgentName`), no secondary. CPU seats already carry agent names (§C1).
//   · a human seat → the AGENT'S NAME: settlement's recorded `agentId` when the
//     team carries one (§C1 "after settlement, the agentId settlement recorded
//     on each team"), else the owner's CURRENT PRIMARY AGENT through the owner
//     lookup board production uses, clones excluded (`primaryAgentDocFrom`).
//     The player's display name rides along as `secondary`.
//   · no agent name → the PLAYER'S DISPLAY NAME as the label (no secondary).
//     The display name is the pod's own formation-time `seatNames` entry when
//     the caller has one (the team card's DOM-7 precedent: the name the pod
//     gave the seat), else the profile's `users/{uid}.profile.displayName`,
//     then `.profile.username` — the NESTED shape the one writer of that
//     document writes (see `readProfileNames`; the top-level fields are a
//     legacy fallback — this build's review record, RAWID-1).
//   · neither → `UNNAMED_TEAM_LABEL` ("Unnamed team"), verbatim from §C1.
// A recorded `agentId` whose document is gone (or nameless) falls to the
// player's display name, never to the owner's CURRENT agent: a settled team
// is not relabelled with an agent that never played its week.
//
// THE TWO LAYERS, NAMED APART — `layersFor(seat)` → `{ player, agent }`: the
// same rungs, unfolded, for a surface that names the player and the agent
// separately (Your Backing's reveal, through the team labels reader). A lone
// `label` cannot say which layer it is (RAWID-R-2), so such a surface reads
// the layers, never the label.
//
// IN PLAY, BEFORE SETTLEMENT, the label is the owner's primary agent AT READ
// TIME — §C1 names the before-the-draft and after-settlement sources only.
// It can differ from the agent the pod's battle records (the reveal's) only if
// the owner acquires a second agent whose id sorts first mid-week: an agent's
// `name` cannot be updated (firestore.rules) and onboarding creates one agent,
// so that takes a crafted client create (this build's review record,
// RAWID-6). Settlement then freezes the recorded agent.
//
// NEVER A RAW ACCOUNT ID, ANYWHERE, IN ANY STATE (§C1). No rung of the chain
// can answer an id: every candidate name is refused when it equals a known id
// or has an account id's shape (`looksLikeAccountId` — a 28-character Firebase
// uid, a `cpu-{n}` seat id), which is exactly the hole the pre-flip helpers
// fell through (`resolveDisplayNames` and the client's `seatDisplayName` both
// answer the uid when a profile is missing — the PR 5 review record's HON-17
// winner line). A read that FAILS degrades the same way a missing document
// does: logged, and the chain moves down a rung. This module never throws into
// its caller.
//
// BATCHED PER RESPONSE — no per-row reads. The caller hands every seat its
// response will name to `resolveTeamLabels` ONCE; the resolver de-duplicates
// and reads: the recorded agents by id (one `getAll`), the owners' agents
// (`agents where ownerId in [≤30]` per chunk — the automatic single-field
// index, no composite), and the profiles by id (one `getAll`). Every
// `teamLabelFor` call after that is pure. `getAll` is used when the handle has
// it (the Admin SDK always does) and falls back to parallel gets otherwise —
// the intradayStore.js precedent, which is also what keeps the test doubles
// honest without a second implementation.
//
// THE OWNER LOOKUP IS BOARD PRODUCTION'S (§C1 "the same owner lookup board
// production uses, clones excluded"): tournamentAgentBoards.js
// `resolveGroupAgents` queries `agents where ownerId == uid` and takes the
// FIRST document, in the query's document-id order, that is neither a
// training clone nor a casual clone. `primaryAgentDocFrom` is that selection,
// sorted by id explicitly (an `in` query merges several owners' results, so
// the order is restated rather than inherited) and additionally refusing the
// clone ID prefixes (`isCloneAgentId`) the team card's owner lookup already
// refused — "clones excluded" by flag and by id. Tournament code is not
// touched: this module is board production's selection PLUS that id-prefix
// belt, and its test pins it against `resolveGroupAgents` itself. The two
// differ in ONE owner shape (this build's review record, WIRING-10): a
// flagless `casual-agent-{uid}` document sorting first — a pre-rules client
// squat (casualClone.js), which firestore.rules now forbids — board production
// plays it, the label names the real agent. Aligning board production is
// tournament code, reported for separate tasking.
//
// READS ONLY. Imports the zero-import constants modules from src/ under the
// revised June 2026 import rule (BUILD_RULES §4); the co-located test's real
// import of THIS module is the dependency-surface guard — never mock it.

import { cpuNFromUserId, isCloneAgentId, isCpuUserId } from '../../src/constants/leagueTournament.js';
import { UNNAMED_TEAM_LABEL } from '../../src/constants/backing.js';
import { cpuDisplayName } from './tournamentLeaderboard.js';

/** The agents collection this module READS (never writes). */
export const AGENTS_COLLECTION = 'agents';

/** The profiles collection this module READS (never writes). */
export const USERS_COLLECTION = 'users';

/** Firestore's `in` disjunction limit: the owner lookup is chunked to it. */
export const OWNER_LOOKUP_CHUNK = 30;

/** A Firebase Auth uid: 28 alphanumerics (email/password, Google, anonymous). */
const FIREBASE_UID = /^[A-Za-z0-9]{28}$/;

/**
 * Could this text be an ACCOUNT ID rather than a name? True for a non-string or
 * blank value, any of the `ids` the caller names (the seat's own odUserId, the
 * agent's id), a well-formed CPU seat id (`cpu-{n}`), or a Firebase uid's shape.
 *
 * A BELT, and deliberately a blunt one: a person whose chosen username is
 * exactly 28 alphanumerics would be answered by the next rung instead. That
 * cost is a label; the alternative is an id on a screen.
 */
export function looksLikeAccountId(text, ids = []) {
  if (typeof text !== 'string') return true;
  const t = text.trim();
  if (t.length === 0) return true;
  if (ids.includes(t)) return true;
  if (cpuNFromUserId(t) != null) return true;
  return FIREBASE_UID.test(t);
}

/** A candidate name, trimmed, or null when it is not one (see `looksLikeAccountId`). */
function usableName(text, ids) {
  return looksLikeAccountId(text, ids) ? null : text.trim();
}

/** A document's data, whether the snapshot's `data` is the SDK's method or a plain object. */
function dataOf(doc) {
  if (!doc) return null;
  const data = typeof doc.data === 'function' ? doc.data() : doc.data;
  return data && typeof data === 'object' ? data : null;
}

/**
 * The owner's PRIMARY agent among the documents `agents where ownerId == uid`
 * returned — board production's selection (see the header): the first by
 * document id that is not a training clone, not a casual clone, and not a
 * clone by id. Null when every document is a clone, or there is none.
 *
 * @param {Array<{id: string, data: Function|Object}>} docs
 * @returns {{id: string, data: Object}|null}
 */
export function primaryAgentDocFrom(docs) {
  const sorted = (Array.isArray(docs) ? docs : [])
    .filter((d) => d && typeof d.id === 'string')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const doc of sorted) {
    const data = dataOf(doc) ?? {};
    if (data.isTrainingClone === true || data.isCasualClone === true || isCloneAgentId(doc.id)) continue;
    return { id: doc.id, data };
  }
  return null;
}

/** Firestore document ids: non-empty, path-safe. A value that is not one is never read. */
function readableId(id) {
  return typeof id === 'string' && id.length > 0 && !id.includes('/');
}

/** `getAll` when the handle has it (the Admin SDK), parallel gets otherwise. */
async function getDocs(db, refs) {
  if (refs.length === 0) return [];
  if (typeof db.getAll === 'function') return db.getAll(...refs);
  return Promise.all(refs.map((ref) => ref.get()));
}

const unique = (list) => [...new Set(list)];

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** agentId → the agent's data, for the ids settlement recorded. A failed read resolves nothing. */
async function readAgentsById(db, ids) {
  const out = new Map();
  if (ids.length === 0) return out;
  try {
    const col = db.collection(AGENTS_COLLECTION);
    const snaps = await getDocs(db, ids.map((id) => col.doc(id)));
    snaps.forEach((snap, i) => { if (snap?.exists) out.set(ids[i], dataOf(snap) ?? {}); });
  } catch (err) {
    console.warn('[backingTeamLabels] recorded agents unreadable (labels degrade to player names):', err?.message);
  }
  return out;
}

/** ownerId → the owner's primary agent `{id, data}`, through the chunked owner lookup. */
async function readPrimaryAgents(db, ownerIds) {
  const out = new Map();
  if (ownerIds.length === 0) return out;
  const wanted = new Set(ownerIds);
  const byOwner = new Map();
  try {
    const snaps = await Promise.all(chunks(ownerIds, OWNER_LOOKUP_CHUNK).map((chunk) => (
      db.collection(AGENTS_COLLECTION).where('ownerId', 'in', chunk).get()
    )));
    for (const snap of snaps) {
      snap.forEach((doc) => {
        const owner = dataOf(doc)?.ownerId;
        // Bucketed by the DOCUMENT's own ownerId, and only for an owner this
        // batch asked about — so a query handle that over-returns (a double
        // that ignores `in`) can still never attribute an agent to a seat
        // whose owner it does not name.
        if (!wanted.has(owner)) return;
        const list = byOwner.get(owner) ?? [];
        list.push(doc);
        byOwner.set(owner, list);
      });
    }
  } catch (err) {
    console.warn('[backingTeamLabels] owner lookup failed (labels degrade to player names):', err?.message);
    return out;
  }
  for (const [owner, docs] of byOwner) {
    const primary = primaryAgentDocFrom(docs);
    if (primary) out.set(owner, primary);
  }
  return out;
}

/**
 * uid → the player's display name, for the uids named.
 *
 * THE PRODUCTION SHAPE IS NESTED (this build's review record, RAWID-1): the
 * one writer of `users/{uid}` — src/firebase/authService.js, email sign-up and
 * Google sign-in alike — writes `profile: { username, displayName, … }`, and
 * the app reads it there (src/contexts/UserContext.jsx). `profile.displayName`
 * first — the name the product shows, the one a slot pod's `seatNames` carry —
 * then `profile.username`; the TOP-LEVEL fields are a legacy fallback only.
 * (The League's own `resolveDisplayNames` / `fetchDisplayNames` read the top
 * level — reported for separate tasking, RAWID-R-1.)
 */
async function readProfileNames(db, uids) {
  const out = new Map();
  if (uids.length === 0) return out;
  try {
    const col = db.collection(USERS_COLLECTION);
    const snaps = await getDocs(db, uids.map((uid) => col.doc(uid)));
    snaps.forEach((snap, i) => {
      if (!snap?.exists) return;
      const data = dataOf(snap) ?? {};
      const profile = data.profile && typeof data.profile === 'object' ? data.profile : {};
      const ids = [uids[i]];
      const name = usableName(profile.displayName, ids) ?? usableName(profile.username, ids)
        ?? usableName(data.displayName, ids) ?? usableName(data.username, ids);
      if (name != null) out.set(uids[i], name);
    });
  } catch (err) {
    console.warn('[backingTeamLabels] profiles unreadable (labels degrade to agent names or the neutral label):', err?.message);
  }
  return out;
}

const isCpuSeat = (seat) => seat?.isCpu === true || isCpuUserId(seat?.odUserId);

/**
 * The resolver's descriptor for ONE seat of a pod, read off the documents the
 * caller already holds — the ONE place every endpoint builds it, so a seat
 * gets the same label on the pod row, the results card, Your Backing and the
 * confirmation (BUILD_RULES §9):
 *   · `agentId` — settlement's recorded agent, from the pool's frozen
 *     `teams[]` (present only once a pool has settled, §6);
 *   · `seatName` — the pod's own formation-time `seatNames` entry, if any;
 *   · `isCpu` — the frozen team's flag, the seat's flag, or the id's shape.
 *
 * @param {{group?: Object|null, pool?: Object|null}} pod
 * @param {string} odUserId
 */
export function labelSeatOf({ group = null, pool = null } = {}, odUserId, isCpu = false) {
  const frozen = Array.isArray(pool?.teams) ? pool.teams.find((t) => t?.odUserId === odUserId) ?? null : null;
  const player = Array.isArray(group?.players) ? group.players.find((p) => p?.odUserId === odUserId) ?? null : null;
  const seatName = group?.seatNames && typeof group.seatNames === 'object' ? group.seatNames[odUserId] : null;
  return {
    odUserId,
    isCpu: isCpu === true || frozen?.isCpu === true || player?.isCpu === true || isCpuUserId(odUserId),
    agentId: typeof frozen?.agentId === 'string' && frozen.agentId.length > 0 ? frozen.agentId : null,
    seatName: typeof seatName === 'string' ? seatName : null,
  };
}

/**
 * Every seat descriptor ONE pod's projections can name: the live seats
 * (`players[]`), the pool's frozen teams, and `extraTeamIds` — the viewer's
 * own stakes, which can name a seat that has since left the pod.
 */
export function podLabelSeats({ group = null, pool = null, extraTeamIds = [] } = {}) {
  const ids = [];
  for (const p of Array.isArray(group?.players) ? group.players : []) ids.push(p?.odUserId);
  for (const t of Array.isArray(pool?.teams) ? pool.teams : []) ids.push(t?.odUserId);
  for (const id of Array.isArray(extraTeamIds) ? extraTeamIds : []) ids.push(id);
  return unique(ids.filter((id) => typeof id === 'string' && id.length > 0)).map((id) => labelSeatOf({ group, pool }, id));
}

/**
 * Resolve every label a response will carry, in ONE batch of reads.
 *
 * @param {Object} db the Admin SDK handle
 * @param {Array<{odUserId: string, isCpu?: boolean, agentId?: string|null, seatName?: string|null}>} seats
 *   every team the response names: `agentId` is settlement's recorded agent
 *   (absent before settlement), `seatName` the pod's own `seatNames` entry.
 * @returns {Promise<{
 *   teamLabelFor: (seat: {odUserId: string, isCpu?: boolean, agentId?: string|null, seatName?: string|null}) => {label: string, secondary: string|null},
 *   layersFor: (seat: {odUserId: string, isCpu?: boolean, agentId?: string|null, seatName?: string|null}) => {player: string|null, agent: string|null},
 *   displayNameFor: (odUserId: string, seatName?: string|null) => string|null,
 *   primaryAgentFor: (odUserId: string) => {id: string, data: Object}|null,
 * }>}
 */
export async function resolveTeamLabels(db, seats) {
  const list = (Array.isArray(seats) ? seats : []).filter((s) => typeof s?.odUserId === 'string' && s.odUserId.length > 0);
  const humans = list.filter((s) => !isCpuSeat(s));

  const recordedIds = unique(humans.map((s) => s.agentId).filter(readableId));
  const ownerIds = unique(humans.filter((s) => !readableId(s.agentId)).map((s) => s.odUserId).filter(readableId));
  const profileIds = unique(humans
    .filter((s) => usableName(s.seatName, [s.odUserId]) == null)
    .map((s) => s.odUserId)
    .filter(readableId));

  const [agentsById, primaryByOwner, profileNames] = await Promise.all([
    readAgentsById(db, recordedIds),
    readPrimaryAgents(db, ownerIds),
    readProfileNames(db, profileIds),
  ]);

  /** The player's display name: the pod's seat name, else the profile's — never an id. */
  function displayNameFor(odUserId, seatName = null) {
    if (typeof odUserId !== 'string' || isCpuUserId(odUserId)) return null;
    return usableName(seatName, [odUserId]) ?? profileNames.get(odUserId) ?? null;
  }

  /** The owner's primary agent this batch resolved, `{ id, data }`, or null. */
  function primaryAgentFor(odUserId) {
    return primaryByOwner.get(odUserId) ?? null;
  }

  /**
   * The team's two layers NAMED APART (this build's review record,
   * RAWID-R-2): `player` — the player's display name — and `agent` — the
   * agent's name through the same belt (settlement's recorded agent, else the
   * owner's primary). A CPU seat is its own agent: both are its CPU name.
   * Either may be null; neither is ever an id. `{ label, secondary }` cannot
   * say which layer a lone label is, and a surface that names the layers
   * apart (Your Backing's reveal) must not guess. Pure.
   */
  function layersFor({ odUserId, isCpu = false, agentId = null, seatName = null } = {}) {
    if (typeof odUserId !== 'string' || odUserId.length === 0) return { player: null, agent: null };
    if (isCpu === true || isCpuUserId(odUserId)) {
      // `cpuDisplayName` answers a bare 'CPU' for a malformed id — a word, never the id.
      const name = cpuDisplayName(odUserId);
      return { player: name, agent: name };
    }
    const agent = readableId(agentId)
      ? { id: agentId, data: agentsById.get(agentId) ?? null }
      : primaryByOwner.get(odUserId) ?? null;
    return {
      player: displayNameFor(odUserId, seatName),
      agent: agent?.data ? usableName(agent.data.name, [odUserId, agent.id]) : null,
    };
  }

  /** The team's label and its secondary line — see the header's chain. Pure. */
  function teamLabelFor({ odUserId, isCpu = false, agentId = null, seatName = null } = {}) {
    if (typeof odUserId !== 'string' || odUserId.length === 0) return { label: UNNAMED_TEAM_LABEL, secondary: null };
    if (isCpu === true || isCpuUserId(odUserId)) return { label: cpuDisplayName(odUserId), secondary: null };
    const { player, agent } = layersFor({ odUserId, isCpu, agentId, seatName });
    if (agent != null) return { label: agent, secondary: player };
    if (player != null) return { label: player, secondary: null };
    return { label: UNNAMED_TEAM_LABEL, secondary: null };
  }

  return { teamLabelFor, layersFor, displayNameFor, primaryAgentFor };
}
