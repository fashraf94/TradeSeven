// src/components/CommandCenter/hub/selectors/readerInputs.js
//
// Command Center hub, slice S3 (ruling R-S3-9; spec V1.2 §3, §3.1) — the
// readers' results in the S2a selector's input shapes (hub/hubModel.js, the
// S2a contract). Pure: each takes a reader's result and returns the shape, and
// none decides eligibility — deriveHubDeployState does.
//
//   auth       from the one identity source (services/authIdentity.js):
//              unresolved → null (checks), resolved signed out → signed_out,
//              signed in → { signedIn, uid, authEpoch }
//   agent      from useAgent's owner-tagged read (R-S3-4): the doc only when
//              ready, its own owner and epoch, the read's error
//   poll       from App's active poll (R-S3-3): the retained list with its
//              owner and epoch; `status` the current request's — 'loading'
//              while an explicit refresh runs (and for metadata of another
//              epoch, not yet reset), else the latest settled request's: a
//              background run never reads "Refreshing"
//   completed  from the ten-game window (R-S3-5), for the first-deployment
//              candidate only
//   loadout    loadoutAgentOf: the same agent read, for S5's Loadout (the S3
//              merge with S5), owner-masked, with the read's status and Retry
//
// ownedLiveList is the gate's own owned set (deployState.js ownedLiveBattles
// over the retained list) for the current identity: Games' live rows come
// from it, so a block always has its row (R-S3-8).

import { ownedLiveBattles } from './deployState';
import { cooldownFor } from './attemptReducer';

const LOADING = 'loading';

export function authInputOf(identity) {
  if (!identity || identity.resolved !== true) return null;
  return typeof identity.uid === 'string' && identity.uid
    ? Object.freeze({ signedIn: true, uid: identity.uid, authEpoch: identity.authEpoch })
    : Object.freeze({ signedIn: false });
}

export function agentInputOf(reader) {
  const status = reader?.status ?? LOADING;
  return Object.freeze({
    status,
    agent: status === 'ready' ? reader.agent ?? null : null,
    ownerUid: reader?.ownerUid ?? null,
    ownerEpoch: reader?.ownerEpoch ?? null,
    error: reader?.readError ?? null,
  });
}

/**
 * The Loadout's agent (slice S5), from the same owner-tagged read the deploy selector takes (the S3 merge with S5:
 * App hands the hub no agent). The document shows only when the read is ready and this identity's; a read of
 * another owner or epoch is still loading. `status` splits the no-document state (S5 report N-S5-6): 'error' is
 * "Agent unavailable · Retry", a ready read with no document is absence. Signed out there is no agent to read:
 * absence, as before. `retry` is the read's own Retry, handed through as given.
 */
export function loadoutAgentOf(agentInput, auth, retry) {
  if (!auth) return Object.freeze({ status: LOADING, agent: null, retry });
  if (auth.signedIn !== true) return Object.freeze({ status: 'ready', agent: null, retry });
  const mine = agentInput?.ownerUid === auth.uid && agentInput?.ownerEpoch === auth.authEpoch;
  if (!mine) return Object.freeze({ status: LOADING, agent: null, retry });
  const status = agentInput.status ?? LOADING;
  return Object.freeze({ status, agent: status === 'ready' ? agentInput.agent ?? null : null, retry });
}

export function pollInputOf(meta, list, identity) {
  if (!meta || typeof meta !== 'object') {
    return Object.freeze({ status: LOADING, liveBattles: null, ownerUid: null, ownerEpoch: null, lastSuccessfulAt: null, error: null, refreshing: false });
  }
  const thisEpoch = Boolean(identity) && meta.epoch === identity.authEpoch;
  return Object.freeze({
    status: !thisEpoch || meta.refreshing === true ? LOADING : meta.status,
    liveBattles: meta.ownerUid != null && Array.isArray(list) ? list : null,
    ownerUid: meta.ownerUid ?? null,
    ownerEpoch: meta.ownerEpoch ?? null,
    lastSuccessfulAt: meta.lastSuccessfulAt ?? null,
    error: meta.error ?? null,
    refreshing: meta.refreshing === true,
  });
}

export function completedInputOf(tenGames) {
  return Object.freeze({
    status: tenGames?.status ?? LOADING,
    rows: Array.isArray(tenGames?.battles) ? tenGames.battles : [],
    ownerUid: tenGames?.ownerUid ?? null,
    ownerEpoch: tenGames?.ownerEpoch ?? null,
  });
}

/**
 * Slice S2b (ruling R-S2b-2): the deploy provider's half of the selector's inputs, from its context snapshot
 * (src/contexts/DeployAttemptContext.jsx) — the attempt record, the hold record, the owner + target cooldown
 * (the attempt's resolved target, else the ranked agent's own id), the clock, and `modalOpen`: the hub's
 * sheets or the provider's own ceremony or due-idea screen. Without a snapshot, nothing: S3's inputs as they were.
 */
export function attemptInputsOf(snapshot, { auth, agentId = null, hubModalOpen = false, now = null } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.state) return null;
  const state = snapshot.state;
  const attempt = state.attempt ?? null;
  const target = attempt?.targetAgentId ?? agentId ?? null;
  return Object.freeze({
    attempt,
    hold: state.hold ?? null,
    cooldown: auth?.signedIn === true && target ? cooldownFor(state, auth.uid, target) : null,
    now,
    modalOpen: hubModalOpen === true || snapshot.overlayOpen === true,
  });
}

/** The live documents the gate reads, for the current identity only — none when the retained list is another owner's or epoch's. */
export function ownedLiveList(poll, auth) {
  if (!auth || auth.signedIn !== true || !poll || poll.ownerUid !== auth.uid || poll.ownerEpoch !== auth.authEpoch) return [];
  return ownedLiveBattles(poll.liveBattles, auth.uid);
}
