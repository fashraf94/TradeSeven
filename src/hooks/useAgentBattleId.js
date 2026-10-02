// useAgentBattleId - Resolves agentId → agentBattleId
// Queries the agentBattles collection for the active battle belonging to this agent.
//
// Shadow vs CPU quote integrity (SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md §3.1
// C-2, B-4, B-5, B-6, C-4; build record
// docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md) adds ONE
// returned field, `lookup`, and ONE optional argument, `{ confirmCache }`. The
// legacy fields — agentBattleId, loading, error — keep their values, timing and
// effects exactly: the ID survives an agent change and an error, and loading is
// never re-armed. That is why an unchanged ID proves nothing about whether the
// CURRENT agent's lookup has settled, and why `lookup` exists.
//
// THE OPT-IN. `{ confirmCache: true }` is what the gated screen passes (C-4:
// flag on, query path) and it is the only call that reads `lookup`. It turns on
// BOTH the metadata events on the existing listener (C-4) and the C-2 evidence.
// Without it — every flag-off call, and the direct-ID route — this is the
// shipped hook exactly: no evidence state is written, no render-phase
// adjustment runs and no `lookup` is returned, so render passes, commits,
// listener calls and the return shape all match the pre-build captures
// (ON-ID 9, OFF-6; review off-state F2 and known residual #4). A gated caller
// that forgot to opt in sees no `lookup` and the screen fails closed (pending).

import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

/** Evidence equality, so an unchanged repeated snapshot never forces a render. */
function sameEvidence(a, b) {
  return !!a && !!b
    && a.generation === b.generation
    && Object.is(a.agentId, b.agentId)
    && a.status === b.status
    && a.battleId === b.battleId
    && a.fromCache === b.fromCache
    && (a.error?.code ?? null) === (b.error?.code ?? null)
    && (a.error?.message ?? null) === (b.error?.message ?? null);
}

const useAgentBattleId = (agentId, { confirmCache } = {}) => {
  const [agentBattleId, setAgentBattleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const gated = confirmCache === true;

  // C-2: which agent the evidence is for, and the lookup GENERATION, which
  // advances exactly when the requested agent changes. Tracked with React's
  // "adjust state while rendering" pattern rather than a render-phase ref, so a
  // discarded concurrent render cannot leave it half-applied (a stuck pending).
  // The adjustment re-renders the caller once before commit (B-6): no commit,
  // no effect, no subscription change. A value — never an updater — so a
  // StrictMode double render cannot advance it twice. Gated only: flag-off the
  // tracked pair is never written, so the caller renders exactly as before.
  // The generation also advances when the opt-in flips, so an un-gated phase
  // (the gated screen's direct-ID route calls this with null and no opt-in)
  // retires the generation: a return to the same agent never settles on the
  // retired listener's evidence (C-2; review delta D-1).
  const [track, setTrack] = useState(() => ({ agentId, gated, generation: 1 }));
  let current = track;
  if (track.gated !== gated || (gated && !Object.is(track.agentId, agentId))) {
    current = { agentId, gated, generation: track.generation + 1 };
    setTrack(current);
  }
  const [evidence, setEvidence] = useState(null);

  useEffect(() => {
    // The generation this listener belongs to, and whether it is still the
    // live one. Every evidence write is stamped with both and made in the same
    // synchronous block as the legacy setters it accompanies, so it batches
    // with them; writes from a retired closure are dropped (the listener is
    // unsubscribed anyway — this covers callbacks already queued). Without the
    // opt-in nothing is written at all.
    const generation = track.generation;
    let active = true;
    const stamp = (status, extra = {}) => {
      if (!active || !gated) return;
      const next = { agentId, generation, status, battleId: null, fromCache: null, error: null, ...extra };
      setEvidence((prev) => (sameEvidence(prev, next) ? prev : next));
    };

    if (!agentId) {
      setAgentBattleId(null);
      setLoading(false);
      stamp('idle');
      return;
    }

    if (!auth.currentUser) {
      setAgentBattleId(null);
      setLoading(false);
      // B-4: nothing was looked up, so this is never "No active battle". A
      // later sign-in does not rerun this effect (disclosed limitation).
      stamp('error', { error: { code: 'no-auth', message: null } });
      return;
    }

    const q = query(
      collection(db, 'agentBattles'),
      where('agentId', '==', agentId),
      where('ownerId', '==', auth.currentUser.uid),
      where('status', '==', 'active'),
      limit(1)
    );

    const onNext = (snapshot) => {
      if (!snapshot.empty) {
        setAgentBattleId(snapshot.docs[0].id);
      } else {
        setAgentBattleId(null);
      }
      setLoading(false);
      setError(null);
      if (!active || !gated) return;
      if (!snapshot.empty) {
        // A non-empty result is `success` whether or not it came from cache;
        // the document subscription and admission still decide what is shown.
        stamp('success', { battleId: snapshot.docs[0].id, fromCache: snapshot.metadata?.fromCache === true });
      } else if (snapshot.metadata?.fromCache === false) {
        // B-5: only a server-CONFIRMED empty result is `empty`.
        stamp('empty', { fromCache: false });
      } else {
        // B-5 / C-4: an empty result from cache is unconfirmed — unless this
        // generation already holds a confirmed empty, which a later from-cache
        // metadata event (going offline) does not downgrade (sticky).
        const next = { agentId, generation, status: 'error', battleId: null, fromCache: true, error: { code: 'unconfirmed-empty', message: null } };
        setEvidence((prev) => {
          if (prev && prev.generation === generation && Object.is(prev.agentId, agentId) && prev.status === 'empty') return prev;
          return sameEvidence(prev, next) ? prev : next;
        });
      }
    };
    const onError = (err) => {
      console.error('[useAgentBattleId] Query error:', err.message);
      setError(err.message);
      setLoading(false);
      stamp('error', { error: { code: err?.code ?? null, message: err?.message ?? null } });
    };

    // C-4: the EXISTING listener, asked for metadata-only events when — and
    // only when — the gated screen passes confirmCache. Otherwise it is created
    // exactly as before: same arguments, same arity, no options object.
    const unsubscribe = gated
      ? onSnapshot(q, { includeMetadataChanges: true }, onNext, onError)
      : onSnapshot(q, onNext, onError);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [agentId, track.generation, gated]);

  if (!gated) return { agentBattleId, loading, error };

  // Evidence counts only for the CURRENT agent and generation; anything else —
  // including a retired lookup that returned the very same ID — is pending.
  const settled = evidence !== null
    && evidence.generation === current.generation
    && Object.is(evidence.agentId, current.agentId);
  const lookup = {
    agentId: current.agentId,
    generation: current.generation,
    status: settled ? evidence.status : 'pending',
    battleId: settled ? evidence.battleId : null,
    fromCache: settled ? evidence.fromCache : null,
    error: settled ? evidence.error : null,
  };

  return { agentBattleId, loading, error, lookup };
};

export default useAgentBattleId;
