import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  subscribeToUserAgent,
  createAgent,
  addDirective,
  removeDirective,
  seedTestAgent
} from '../services/agentService';

const useAgent = (userId) => {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Real-time Firestore subscription
  useEffect(() => {
    console.log('[useAgent] userId:', userId);
    if (!userId) {
      console.log('[useAgent] No userId, returning null agent');
      setAgent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserAgent(userId, (agentData) => {
      console.log('[useAgent] subscription result:', agentData ? `agent found (id: ${agentData.id})` : 'no agent found');
      setAgent(agentData);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [userId]);

  // ============================================
  // COMPUTED STATE
  // ============================================

  const hasAgent = useMemo(() => agent !== null, [agent]);

  const maturityStage = useMemo(() => {
    if (!agent) return 'none';
    const games = agent.stats?.gamesPlayed || 0;
    if (games === 0) return 'fresh';
    if (games < 5) return 'growing';
    if (games < 25) return 'maturing';
    return 'veteran';
  }, [agent]);

  const speech = useMemo(() => {
    if (!agent) return '';
    switch (maturityStage) {
      case 'fresh':
        return "First time in the arena. I've studied the playbook — let's see what I'm made of.";
      case 'growing': {
        const lastMemory = agent.memory?.[agent.memory.length - 1];
        return lastMemory
          ? `Last game: ${lastMemory.result === 'win' ? 'won' : 'lost'}. ${lastMemory.lesson}`
          : "I'm learning. Each game teaches me something new.";
      }
      case 'maturing':
        return "I've seen this setup before. Going with my playbook.";
      case 'veteran':
        return "Ready.";
      default:
        return '';
    }
  }, [agent, maturityStage]);

  const deployText = useMemo(() => {
    switch (maturityStage) {
      case 'fresh': return 'Deploy to BaggerBomb';
      case 'growing': return 'Deploy to BaggerBomb';
      case 'maturing': return 'Deploy — I know the playbook';
      case 'veteran': return 'Deploy';
      default: return 'Deploy to BaggerBomb';
    }
  }, [maturityStage]);

  const activeDirectives = useMemo(() => {
    if (!agent?.directives) return [];
    const now = new Date();
    return agent.directives.filter(d => {
      if (!d.expiresAt) return true;
      return new Date(d.expiresAt) > now;
    });
  }, [agent]);

  const groupedDirectives = useMemo(() => {
    const groups = { coaching: [], pinned: [], strategy_session: [], system: [] };
    activeDirectives.forEach(d => {
      if (groups[d.source]) {
        groups[d.source].push(d);
      }
    });
    return groups;
  }, [activeDirectives]);

  const winRate = useMemo(() => {
    if (!agent?.stats?.gamesPlayed) return 0;
    return Math.round((agent.stats.wins / agent.stats.gamesPlayed) * 100);
  }, [agent]);

  const record = useMemo(() => {
    if (!agent?.stats) return '0-0';
    return `${agent.stats.wins}W-${agent.stats.losses}L`;
  }, [agent]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleCreateAgent = useCallback(async (agentData) => {
    if (!userId) return null;
    try {
      const agentId = await createAgent(userId, agentData);
      return agentId;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [userId]);

  const handleAddDirective = useCallback(async (directive) => {
    if (!agent?.id) return;
    try {
      await addDirective(agent.id, directive);
    } catch (err) {
      setError(err.message);
    }
  }, [agent]);

  const handleRemoveDirective = useCallback(async (directive) => {
    if (!agent?.id) return;
    try {
      await removeDirective(agent.id, directive);
    } catch (err) {
      setError(err.message);
    }
  }, [agent]);

  const handleSeedTestAgent = useCallback(async () => {
    if (!userId) {
      console.warn('[useAgent] seedTestAgent called with no userId — aborting to prevent orphan doc');
      return null;
    }
    try {
      const agentId = await seedTestAgent(userId);
      return agentId;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [userId]);

  // ============================================
  // RETURN
  // ============================================

  return {
    agent,
    loading,
    error,
    hasAgent,
    maturityStage,
    speech,
    deployText,
    activeDirectives,
    groupedDirectives,
    winRate,
    record,
    createAgent: handleCreateAgent,
    addDirective: handleAddDirective,
    removeDirective: handleRemoveDirective,
    seedTestAgent: handleSeedTestAgent,
  };
};

export default useAgent;
