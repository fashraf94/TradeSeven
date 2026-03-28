import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  subscribeToUserAgent,
  createAgent,
  addDirective,
  removeDirective,
  seedTestAgent
} from '../services/agentService';
import { getAgentLevel, getLevelConfig, getNextLevelInfo, AGENT_LEVELS } from '../constants/agentProgression';

const useAgent = (userId) => {
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [levelUpEvent, setLevelUpEvent] = useState(null);

  // Real-time Firestore subscription
  useEffect(() => {
    if (!userId) {
      setAgent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserAgent(userId, (agentData) => {
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

  // Unified level system (source of truth: agentProgression.js)
  const gamesPlayed = agent?.stats?.gamesPlayed || 0;
  const currentLevel = useMemo(() => getAgentLevel(gamesPlayed), [gamesPlayed]);
  const levelConfig = useMemo(() => getLevelConfig(gamesPlayed), [gamesPlayed]);
  const nextLevelInfo = useMemo(() => getNextLevelInfo(gamesPlayed), [gamesPlayed]);

  // Level-up detection
  const prevLevelRef = useRef(currentLevel);
  useEffect(() => {
    if (prevLevelRef.current && currentLevel !== prevLevelRef.current) {
      const prev = AGENT_LEVELS[prevLevelRef.current];
      const curr = AGENT_LEVELS[currentLevel];
      if (curr.minGames > prev.minGames) {
        setLevelUpEvent({
          from: prevLevelRef.current,
          to: currentLevel,
          unlocks: getNextLevelInfo(prev.minGames)?.unlocks || [],
        });
      }
    }
    prevLevelRef.current = currentLevel;
  }, [currentLevel]);

  // Backward-compatible maturityStage (derived from level)
  const maturityStage = useMemo(() => {
    if (!agent) return 'none';
    if (gamesPlayed === 0) return 'fresh';
    if (currentLevel === 'rookie') return 'growing';
    if (currentLevel === 'starter') return 'maturing';
    return 'veteran';
  }, [agent, gamesPlayed, currentLevel]);

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

  // Forge rules (from equipped bundles)
  const activeRules = useMemo(() => agent?.activeRules || [], [agent]);
  const equippedBundleIds = useMemo(() => agent?.equippedBundleIds || [], [agent]);

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
    currentLevel,
    levelConfig,
    nextLevelInfo,
    levelUpEvent,
    clearLevelUp: () => setLevelUpEvent(null),
    speech,
    deployText,
    activeRules,
    equippedBundleIds,
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
