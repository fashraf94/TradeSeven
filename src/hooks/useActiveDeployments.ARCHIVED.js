// useActiveDeployments - Subscribes to an agent's active/market-closed battles.
// Differs from useAgentBattleId: returns the full battle docs (not just ids)
// and doesn't limit to 1.

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

const ACTIVE_STATUSES = ['active', 'market_closed'];

const useActiveDeployments = (agentId) => {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!agentId || !auth.currentUser) {
      setDeployments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'agentBattles'),
      where('agentId', '==', agentId),
      where('ownerId', '==', auth.currentUser.uid),
      where('status', 'in', ACTIVE_STATUSES),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Newest first
        docs.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        setDeployments(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useActiveDeployments] Query error:', err.message);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [agentId]);

  // TODO: Add seasonEntries query when Season Mode ships.
  // Will query seasonEntries where agentId matches and status is active.

  return { deployments, loading, error };
};

export default useActiveDeployments;
