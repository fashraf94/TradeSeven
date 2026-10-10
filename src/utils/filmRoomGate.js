// src/utils/filmRoomGate.js
//
// Film Room A2 — THE GATE (Amendment E BA-40,
// docs/specs/FILM_ROOM_BUILD_A_TAPE_SPEC_V1_2_AMENDMENT_E_20261008.md).
//
// FILM_ROOM_V2_MODE ('off' | 'allowlist' | 'on') resolves PER BATTLE OWNER:
//   'off'        v2 resolves on for nobody — no request is sent at all
//   'on'         v2 resolves on for every battle — no request either
//   'allowlist'  v2 resolves on only when the SERVER says this battle's owner
//                is on the cockpit's server-side allowlist: the existing
//                GET /api/agent/cockpit-status answers `allowlisted` for the
//                caller's OWN battle (a non-owner learns nothing but 403). The
//                client holds no uid and never recomputes the list — the
//                useCockpitStatus precedent ("the client never decides").
//
// ONE CACHED VERDICT per owner: the server's `allowlisted` answers for the
// battle's OWNER, so a definite answer is kept under the owner's uid when the
// battle names one (else under the battle id) — an owner with many battles is
// asked about once per page life, well inside cockpit-status's per-user window
// (review A2L2-6). The route and the hub helper share this cache. Every error,
// timeout, non-200 and malformed body reads `false` — the legacy screen and
// Stage 1, never a guess. A failed ask is NOT cached (the next open asks
// again); a definite answer is. The bound covers the WHOLE ask — the token,
// the request and the body (review A2L2-10).
//
// The mode is read at CALL time (the isCharacterPaneOn rule): a consumer never
// holds it in a module-scope const, so a featureFlags mock reaches every read.

import { getAuth } from 'firebase/auth';
import { FILM_ROOM_V2_MODE, FILM_ROOM_V2_MODES } from '../config/featureFlags';

/** The route the server answers on (the cockpit's own; no new endpoint). */
export const FILM_ROOM_VERDICT_PATH = '/api/agent/cockpit-status';
/** An answer that has not come in this long reads false — nobody waits on a hung request. */
export const FILM_ROOM_VERDICT_TIMEOUT_MS = 8_000;

const OFF = 'off';

/** The mode, when it is one of the walked states, else 'off'. Never throws. */
export function resolveFilmRoomV2Mode() {
  try {
    const modes = FILM_ROOM_V2_MODES;
    const mode = FILM_ROOM_V2_MODE;
    return Array.isArray(modes) && modes.includes(mode) ? mode : OFF;
  } catch {
    return OFF;
  }
}

/** The battle id the Film Room and the server key on (the legacy screen's own rule). */
export const filmRoomBattleId = (battle) => {
  const id = battle?.agentBattleId || battle?.id || null;
  return typeof id === 'string' && id ? id : null;
};

/**
 * Ask the server once. Resolves `{ ok, allowlisted }`: `ok` only for a 200
 * with a boolean `allowlisted`; anything else — no user, a refusal, a network
 * failure, a malformed body, no answer within the timeout — is
 * `{ ok: false, allowlisted: false }`. Never throws.
 */
export async function requestFilmRoomVerdict(battleId) {
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => { if (abort) abort.abort(); resolve({ ok: false, allowlisted: false }); }, FILM_ROOM_VERDICT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([askVerdict(battleId, abort), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function askVerdict(battleId, abort) {
  try {
    const user = getAuth().currentUser;
    if (!user) return { ok: false, allowlisted: false };
    const idToken = await user.getIdToken();
    const res = await fetch(`${FILM_ROOM_VERDICT_PATH}?battleId=${encodeURIComponent(battleId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
      ...(abort ? { signal: abort.signal } : {}),
    });
    if (!res.ok) return { ok: false, allowlisted: false };
    const body = await res.json().catch(() => null);
    if (typeof body?.allowlisted !== 'boolean') return { ok: false, allowlisted: false };
    return { ok: true, allowlisted: body.allowlisted };
  } catch {
    return { ok: false, allowlisted: false };
  }
}

const verdicts = new Map();     // cache key → boolean (definite answers only)
const inFlight = new Map();     // cache key → Promise<boolean>

/** Where an answer is kept: the owner's uid when the battle names one, else the battle id. */
const cacheKey = (battleId, ownerId) => (typeof ownerId === 'string' && ownerId ? `owner:${ownerId}` : `battle:${battleId}`);

/** The cached verdict for a battle (by its owner when known), or undefined when none has come in yet. */
export function cachedFilmRoomVerdict(battleId, { ownerId = null } = {}) {
  const k = cacheKey(battleId, ownerId);
  return verdicts.has(k) ? verdicts.get(k) : undefined;
}

/**
 * Is this battle's owner allowlisted? One request per owner (or per battle
 * when no owner is named) per page life; concurrent callers share it.
 * Resolves false on anything but a definite yes.
 *
 * @param {string} battleId
 * @param {{ ownerId?: string|null, request?: (id: string) => Promise<{ok: boolean, allowlisted: boolean}> }} [opts]  `request` is a test seam
 * @returns {Promise<boolean>}
 */
export function readFilmRoomVerdict(battleId, { ownerId = null, request = requestFilmRoomVerdict } = {}) {
  if (typeof battleId !== 'string' || !battleId) return Promise.resolve(false);
  const k = cacheKey(battleId, ownerId);
  if (verdicts.has(k)) return Promise.resolve(verdicts.get(k));
  if (inFlight.has(k)) return inFlight.get(k);
  const p = Promise.resolve()
    .then(() => request(battleId))
    .then((v) => {
      const yes = Boolean(v && v.ok === true && v.allowlisted === true);
      if (v && v.ok === true) verdicts.set(k, yes);
      return yes;
    })
    .catch(() => false)
    .finally(() => { inFlight.delete(k); });
  inFlight.set(k, p);
  return p;
}

/** Tests only. */
export function resetFilmRoomVerdicts() {
  verdicts.clear();
  inFlight.clear();
}

/**
 * Does v2 resolve on for this battle, given the mode and (in 'allowlist') the
 * verdict? Pure. `verdict` is the allowlist answer: true, false, or undefined
 * while none has come in — which reads as off.
 */
export function filmRoomV2On(mode, verdict) {
  if (mode === 'on') return true;
  if (mode === 'allowlist') return verdict === true;
  return false;
}

/**
 * The per-owner resolution for one battle, asynchronously: 'off' and 'on'
 * resolve without a request; 'allowlist' asks (once, cached).
 *
 * @returns {Promise<boolean>}
 */
export async function resolveFilmRoomV2ForBattle(battle, { readVerdict = readFilmRoomVerdict } = {}) {
  const mode = resolveFilmRoomV2Mode();
  if (mode !== 'allowlist') return filmRoomV2On(mode, undefined);
  const id = filmRoomBattleId(battle);
  if (!id) return false;
  let verdict = false;
  try { verdict = (await readVerdict(id, { ownerId: typeof battle?.ownerId === 'string' ? battle.ownerId : null })) === true; } catch { verdict = false; }
  return filmRoomV2On(mode, verdict);
}
