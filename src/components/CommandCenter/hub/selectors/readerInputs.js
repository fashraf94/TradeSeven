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
//
// ownedLiveList is the gate's own owned set (deployState.js ownedLiveBattles
// over the retained list) for the current identity: Games' live rows come
// from it, so a block always has its row (R-S3-8).

import { ownedLiveBattles } from './deployState';

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

/** The live documents the gate reads, for the current identity only — none when the retained list is another owner's or epoch's. */
export function ownedLiveList(poll, auth) {
  if (!auth || auth.signedIn !== true || !poll || poll.ownerUid !== auth.uid || poll.ownerEpoch !== auth.authEpoch) return [];
  return ownedLiveBattles(poll.liveBattles, auth.uid);
}
