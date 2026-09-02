// src/hooks/useDeployTargetProgress.js
//
// Live deploy state for the DEPLOY TARGET document.
//
// The server writes deployProgress / lastDeployedAt / lastDecision to
// agents/{deployAgentId} (decide.js:150 derives agentRef from the POSTed
// agentId), and on the casual-clone path that id is the clone's — not the ranked
// agent's. The ceremony used to read deployProgress off the ranked agent doc,
// which subscribeToUserAgent explicitly excludes clones from, so it watched a
// document that could never receive progress and stalled at stage 1 on every
// clone-path deploy. This hook watches the document the deploy actually writes.
//
// Keyed ONLY on the id it is handed — it never reads auth.currentUser. That is
// deliberate: the useActiveDeployments / useAgentBattleId standing-bug class
// comes from hooks that re-derive their subject from ambient auth state and then
// race it. useAgent avoids that by keying on a passed userId; this keys on a
// passed agentId, for the same reason.

import { useEffect, useState } from 'react';
import { subscribeToAgentDoc } from '../services/agentService';

export default function useDeployTargetProgress(targetAgentId) {
  // The snapshot is held together with the id it belongs to, so a payload can
  // never be attributed to a target it did not come from. `delivered` is tracked
  // separately from `doc` because a legitimately-empty doc (a freshly minted
  // clone, or an unreadable one) is still a real observation of the target.
  const [snap, setSnap] = useState({ id: null, doc: null, delivered: false });

  useEffect(() => {
    if (!targetAgentId) {
      setSnap({ id: null, doc: null, delivered: false });
      return undefined;
    }
    // Clear first: the previous target's progress must never be read as this
    // one's, even for the frame before the new subscription's first snapshot.
    setSnap({ id: targetAgentId, doc: null, delivered: false });
    const unsubscribe = subscribeToAgentDoc(targetAgentId, (agentDoc) => {
      setSnap({ id: targetAgentId, doc: agentDoc, delivered: true });
    });
    return () => unsubscribe();
    // Tear down and re-subscribe whenever the target changes.
  }, [targetAgentId]);

  // Effects run AFTER render, so one render can observe a new targetAgentId
  // while `snap` still holds the old target's payload. Comparing the ids closes
  // that window rather than leaking a stale-target payload for a frame.
  const fresh = snap.delivered && snap.id === targetAgentId && !!targetAgentId;

  return {
    deployProgress: fresh ? (snap.doc?.deployProgress ?? null) : null,
    lastDeployedAt: fresh ? (snap.doc?.lastDeployedAt ?? null) : null,
    lastDecision: fresh ? (snap.doc?.lastDecision ?? null) : null,
    // TRUE means "a snapshot for THIS target has been observed", not merely
    // "an id exists". The stage machine gates its baseline capture on this, and
    // a baseline taken before the first snapshot would be captured from nulls —
    // letting the first real payload's (possibly stale) deployId look like a
    // change and get pinned as ours. That is the exact failure the baseline
    // re-scoping exists to prevent, so readiness has to mean observed.
    targetKnown: fresh,
  };
}
