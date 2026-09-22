// src/services/backingService.js
//
// Backing Beta PR 4 — the client's ONE seam onto the backing layer (spec V1.3
// §12 PR 4). Two kinds of read, one kind of write, and every one of them
// server-authoritative:
//
//   · ENDPOINTS, through fetchWithAuth (the Bearer ID token): the pod list
//     (GET /api/tournament/backing-pools), the team card projection (GET
//     /api/tournament/team-card), the stake (POST /api/tournament/backing-
//     stake), the attestation (POST /api/eligibility/attest) and the pitch
//     (POST /api/team/pitch). A refusal comes back as a typed BackingApiError
//     carrying the endpoint's own reason word, which the copy module maps to a
//     plain sentence — the client never invents a reason.
//   · FIRESTORE READS the rules already grant: the viewer's OWN stakes
//     (backingStakes, owner-read — the query carries `userId == uid`, which is
//     what the rule admits), the public pool document (backingPools,
//     authed-read: the capped open-state pair while open, the reveal at
//     close), the viewer's own wallet (owner-read), their own attestation
//     (owner-read), and the pitch (authed-read). NO read of `agents`, ever —
//     every agent-derived field comes through the team-card projection (§5).
//   · NO CLIENT WRITE: every mutation is an endpoint. The rules blocks are
//     `write: if false` for every client, the owner included, and this module
//     has no setDoc to offer.
//
// Reachable only from the backing surfaces, which mount only while
// BACKING_BETA_ENABLED is true (read at call time in the hosts); the dark pin
// (backingDark.test.jsx) proves the flag-off League opens none of these.

import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { getGroup, fetchDisplayNames } from './tournamentGroupService';
import { groupToPod } from '../components/League/leagueAdapter';

export const BACKING_POOLS_URL = '/api/tournament/backing-pools';
export const BACKING_STAKE_URL = '/api/tournament/backing-stake';
export const TEAM_CARD_URL = '/api/tournament/team-card';
export const TEAM_PITCH_URL = '/api/team/pitch';
export const ATTEST_URL = '/api/eligibility/attest';
export const BATTLE_VIEW_URL = '/api/tournament/battle-view';

/** A refusal from a backing endpoint: the reason WORD, the HTTP status, the body. */
export class BackingApiError extends Error {
  constructor(code, status = 0, data = null) {
    super(code);
    this.name = 'BackingApiError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

async function readJson(res) {
  try { return await res.json(); } catch { return {}; }
}

async function call(url, options) {
  let res;
  try {
    res = await fetchWithAuth(url, options);
  } catch {
    throw new BackingApiError('network', 0, null);
  }
  const body = await readJson(res);
  if (!res.ok) {
    const code = typeof body?.error === 'string' && body.error.length > 0 ? body.error : 'server_error';
    throw new BackingApiError(code, res.status, body);
  }
  return body;
}

const post = (url, payload) => call(url, { method: 'POST', body: JSON.stringify(payload) });

// ==================== ENDPOINTS ====================

/** The pod list for the next battle Monday's week, sealed while open. */
export function fetchBackingPods() {
  return call(BACKING_POOLS_URL);
}

/** The projection-only team card for one seat. */
export function fetchTeamCard(groupId, odUserId) {
  const q = `groupId=${encodeURIComponent(groupId)}&odUserId=${encodeURIComponent(odUserId)}`;
  return call(`${TEAM_CARD_URL}?${q}`);
}

/**
 * Place a stake. `requestId` is the caller's idempotency key — FRESH per
 * Confirm (newRequestId below); the server makes it the stake's document id.
 * The reply is the server's sealed projection; "Backed" renders only from it.
 */
export function placeStake({ groupId, teamOdUserId, amount, requestId }) {
  return post(BACKING_STAKE_URL, { groupId, teamOdUserId, amount, requestId });
}

/** Record the eligibility attestation for the current terms version. */
export function attestEligibility(termsVersion) {
  return post(ATTEST_URL, { adultAttested: true, termsVersion });
}

/** Save (or, with an empty string, clear) the viewer's scouting pitch. */
export function savePitch(text) {
  return post(TEAM_PITCH_URL, { text });
}

/** A fresh, opaque request id for each Confirm — never reused across taps. */
export function newRequestId() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (c && typeof c.randomUUID === 'function') return `bk-${c.randomUUID()}`;
  return `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ==================== FIRESTORE READS (rules-granted) ====================

/** The viewer's own stakes for one backing week (the committed (userId, weekKey) composite). */
export function subscribeMyStakes(uid, weekKey, callback) {
  if (!uid || !weekKey) { callback([]); return () => {}; }
  const q = query(collection(db, 'backingStakes'), where('userId', '==', uid), where('weekKey', '==', weekKey));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.warn('[backingService] stakes subscription failed:', err?.message);
    callback([]);
  });
}

/** The public pool document for a pod — sealed while open, revealed at close. */
export function subscribePool(groupId, callback) {
  if (!groupId) { callback(null); return () => {}; }
  return onSnapshot(doc(db, 'backingPools', groupId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, (err) => {
    console.warn(`[backingService] pool ${groupId} subscription failed:`, err?.message);
    callback(null);
  });
}

/** The viewer's own wallet (allowance remaining, the week it is granted for). */
export function subscribeWallet(uid, callback) {
  if (!uid) { callback(null); return () => {}; }
  // A missing document is a record (no wallet yet); a failed read is not —
  // the caller gets the error as its second argument and shows no figure.
  return onSnapshot(doc(db, 'backingWallets', uid), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null, null);
  }, (err) => {
    console.warn('[backingService] wallet subscription failed:', err?.message);
    callback(null, err);
  });
}

/** The viewer's own attestation doc, or null when they have never attested. */
export async function readEligibility(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'eligibility', uid));
  return snap.exists() ? snap.data() : null;
}

/** A player's pitch doc — authed-read, so the profile editor and the card share one line. */
export function subscribePitch(uid, callback) {
  if (!uid) { callback(null); return () => {}; }
  return onSnapshot(doc(db, 'teamPitches', uid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  }, (err) => {
    console.warn('[backingService] pitch subscription failed:', err?.message);
    callback(null);
  });
}

// ==================== THE TAPE LINK ====================

/**
 * The completed week's pod, adapted for the existing spectator battle view:
 * the group doc (authed-read), the seat names, and the group's battles through
 * the WHY-projecting endpoint (a completed battle projects to itself). Returns
 * the Pod shape LeagueSpectate consumes, or null when the group is gone.
 */
export async function fetchTapePod(groupId, uid) {
  const group = await getGroup(groupId);
  if (!group) return null;
  const ids = (group.players || []).map((p) => p?.odUserId).filter(Boolean);
  const names = await fetchDisplayNames(ids);
  let battlesByOwner = {};
  try {
    const data = await call(`${BATTLE_VIEW_URL}?groupId=${encodeURIComponent(groupId)}`);
    battlesByOwner = data?.battles && typeof data.battles === 'object' ? data.battles : {};
  } catch (err) {
    console.warn('[backingService] battle view unavailable for the tape:', err?.message);
  }
  return groupToPod(group, { names, uid, base: true, battlesByOwner });
}
