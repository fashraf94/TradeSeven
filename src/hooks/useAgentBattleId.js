// useAgentBattleId - Resolves agentId → agentBattleId
// Queries the agentBattles collection for the active battle belonging to this agent.

import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const useAgentBattleId = (agentId) => {
  const [agentBattleId, setAgentBattleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!agentId) {
      setAgentBattleId(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'agentBattles'),
      where('agentId', '==', agentId),
      where('status', '==', 'active'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          setAgentBattleId(snapshot.docs[0].id);
        } else {
          setAgentBattleId(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useAgentBattleId] Query error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [agentId]);

  return { agentBattleId, loading, error };
};

export default useAgentBattleId;
