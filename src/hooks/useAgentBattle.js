import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Subscribe to an agent's active battle document from the agentBattles collection.
 * Returns the full battle doc and extracts statusFeed for convenience.
 *
 * @param {string|null} agentBattleId - The agentBattle document ID (from agent.activeBattleId)
 * @returns {{ battle: Object|null, statusFeed: Array, loading: boolean, error: string|null }}
 */
const useAgentBattle = (agentBattleId) => {
  console.log('[useAgentBattle] Subscribing to:', agentBattleId);
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!agentBattleId) {
      setBattle(null);
      setLoading(false);
      return;
    }

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
      },
      (err) => {
        console.error('[useAgentBattle] Subscription error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [agentBattleId]);

  const statusFeed = battle?.statusFeed || [];
  const executionMode = battle?.executionMode || 'copilot';
  const pendingProposal = battle?.pendingProposal || null;

  return { battle, statusFeed, executionMode, pendingProposal, loading, error };
};

export default useAgentBattle;
