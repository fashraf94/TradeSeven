import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Subscribe to an agent's active battle document from the agentBattles collection.
 * Returns the full battle doc and extracts statusFeed for convenience.
 *
 * Shadow vs CPU quote integrity (SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md
 * §3.2; build record docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md):
 * `options.integrity` (passed only by the gated screen) adds ONE returned
 * field, `integrity` — an atomic envelope from the EXISTING single
 * subscription: the requested ID, the subscription generation, readiness or
 * error, the authoritative `snapshot.id`, and THAT callback's data. Without
 * the option the return shape, values, effects and listener call are exactly
 * the pre-build ones (no extra render pass either).
 *
 * Why an envelope: the legacy `battle` keeps the previous battle while a new
 * one loads and on error, its callbacks are not generation-guarded, and
 * `{ id: snapshot.id, ...snapshot.data() }` lets a data field named `id`
 * override the document id. The envelope never pairs a new ID with an old
 * callback's data, and a retired subscription cannot write it.
 *
 * `options.receive` (the gate's, with `integrity` only): a pure fold run on
 * EVERY callback of the subscription — `receive(previous, data)`, data null
 * for a missing document or an error — whose latest result rides in the
 * envelope as `received`. React may render several callbacks as one update;
 * the fold still sees each of them (R2). Absent, nothing is folded. It must be
 * stable (a module-level function: a new identity re-subscribes), pure and
 * total (a throw would leave the envelope behind the legacy fields).
 *
 * @param {string|null} agentBattleId - The agentBattle document ID (from agent.activeBattleId)
 * @param {{ integrity?: boolean, receive?: Function }} [options]
 * @returns {{ battle: Object|null, statusFeed: Array, loading: boolean, error: string|null, integrity?: Object }}
 */
const useAgentBattle = (agentBattleId, { integrity = false, receive = null } = {}) => {
  console.log('[useAgentBattle] Subscribing to:', agentBattleId);
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The subscription generation, advanced exactly when the requested ID
  // changes — and only when the envelope is enabled, so the legacy hook gains
  // no render pass. Adjusted during render with a VALUE (StrictMode-safe).
  const [track, setTrack] = useState(() => ({ requestedId: agentBattleId ?? null, generation: 1 }));
  let current = track;
  if (integrity && track.requestedId !== (agentBattleId ?? null)) {
    current = { requestedId: agentBattleId ?? null, generation: track.generation + 1 };
    setTrack(current);
  }
  const [envelope, setEnvelope] = useState(null);

  useEffect(() => {
    if (!agentBattleId) {
      setBattle(null);
      setLoading(false);
      return;
    }

    // Envelope writes are stamped with this subscription's generation and
    // dropped once it is retired (callbacks already queued included). The
    // legacy setters are untouched.
    const generation = track.generation;
    let active = true;
    // What this subscription has received, folded per callback (R2).
    let received = null;

    setLoading(true);
    const battleRef = doc(db, 'agentBattles', agentBattleId);

    const unsubscribe = onSnapshot(
      battleRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setBattle({ id: snapshot.id, ...snapshot.data() });
        } else {
          setBattle(null);
        }
        setLoading(false);
        setError(null);
        if (integrity && active) {
          const exists = snapshot.exists();
          const data = exists ? snapshot.data() : null;
          if (receive) received = receive(received, data);
          setEnvelope({
            generation,
            requestedId: agentBattleId,
            status: exists ? 'ready' : 'missing',
            snapshotId: snapshot.id,
            data,
            error: null,
            received,
          });
        }
      },
      (err) => {
        console.error('[useAgentBattle] Subscription error:', err.message);
        setError(err.message);
        setLoading(false);
        if (integrity && active) {
          if (receive) received = receive(received, null);
          setEnvelope({
            generation,
            requestedId: agentBattleId,
            status: 'error',
            snapshotId: null,
            data: null,
            error: { code: err?.code ?? null, message: err?.message ?? null },
            received,
          });
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [agentBattleId, track.generation, integrity, receive]);

  const statusFeed = battle?.statusFeed || [];
  const executionMode = battle?.executionMode || 'copilot';
  const pendingProposal = battle?.pendingProposal || null;
  const strategyPreset = battle?.strategyPreset || 'balanced';
  const gameplanMeeting = battle?.gameplanMeeting || null;
  const chatExchanges = battle?.chatExchanges || [];
  const chatBudgetUsed = battle?.chatBudgetUsed || 0;
  const feedBookmarks = battle?.feedBookmarks || [];

  const result = { battle, statusFeed, executionMode, pendingProposal, strategyPreset, gameplanMeeting, chatExchanges, chatBudgetUsed, feedBookmarks, loading, error };
  if (!integrity) return result;

  // Evidence counts only for the CURRENT requested ID and generation.
  const live = envelope !== null && envelope.generation === current.generation && envelope.requestedId === current.requestedId;
  result.integrity = {
    requestedId: current.requestedId,
    generation: current.generation,
    status: !current.requestedId ? 'idle' : live ? envelope.status : 'pending',
    snapshotId: live ? envelope.snapshotId : null,
    data: live ? envelope.data : null,
    error: live ? envelope.error : null,
    received: live ? envelope.received : null,
  };
  return result;
};

export default useAgentBattle;
