import {
  collection, doc, addDoc, updateDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from '../firebase/config';

const AGENTS_COLLECTION = 'agents';

// ============================================
// READ OPERATIONS
// ============================================

export const subscribeToUserAgent = (ownerId, callback) => {
  const q = query(
    collection(db, AGENTS_COLLECTION),
    where('ownerId', '==', ownerId),
    limit(1)
  );

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
      return;
    }
    const docSnap = snapshot.docs[0];
    callback({ id: docSnap.id, ...docSnap.data() });
  }, (error) => {
    console.error('Agent subscription error:', error);
    callback(null);
  });
};

export const getAgentById = async (agentId) => {
  try {
    const docRef = doc(db, AGENTS_COLLECTION, agentId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.error('Error fetching agent:', error);
    return null;
  }
};

export const getLeaderboard = async (limitCount = 50) => {
  try {
    // Primary query: agents with 5+ games
    const q = query(
      collection(db, AGENTS_COLLECTION),
      where('stats.gamesPlayed', '>=', 5),
      orderBy('stats.gamesPlayed', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    let agents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fallback: if no agents qualify, show all agents (pre-beta mode)
    if (agents.length === 0) {
      const fallbackQ = query(
        collection(db, AGENTS_COLLECTION),
        orderBy('stats.gamesPlayed', 'desc'),
        limit(limitCount)
      );
      const fallbackSnapshot = await getDocs(fallbackQ);
      agents = fallbackSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        _preBeta: true,
      }));
    }

    // Sort by avgScore client-side (primary), win % as tiebreaker
    return agents.sort((a, b) => {
      const avgDiff = (b.stats?.avgScore || 0) - (a.stats?.avgScore || 0);
      if (avgDiff !== 0) return avgDiff;
      const bGp = b.stats?.gamesPlayed || 1;
      const aGp = a.stats?.gamesPlayed || 1;
      return ((b.stats?.wins || 0) / bGp) - ((a.stats?.wins || 0) / aGp);
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
};

// ============================================
// CREATE OPERATIONS
// ============================================

export const createAgent = async (ownerId, agentData) => {
  try {
    const agentDoc = {
      ownerId,
      name: agentData.name,
      archetype: agentData.archetype,
      archetypeDrift: null,
      config: agentData.config || { risk: 50, concentration: 50, momentum: 50 },
      personality: agentData.personality || {},
      avatarColors: agentData.avatarColors || ['#5eead4', '#a855f7'],
      memory: [],
      consolidatedInsight: '',
      directives: [],
      stats: {
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        totalScore: 0,
        avgScore: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
      evolutionCycle: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastDeployedAt: null,
    };

    const docRef = await addDoc(collection(db, AGENTS_COLLECTION), agentDoc);
    return docRef.id;
  } catch (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
};

// ============================================
// UPDATE OPERATIONS
// ============================================

export const updateAgent = async (agentId, updates) => {
  try {
    const docRef = doc(db, AGENTS_COLLECTION, agentId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    throw error;
  }
};

export const addDirective = async (agentId, directive) => {
  const newDirective = {
    id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: directive.text,
    source: directive.source,
    expiresAt: directive.expiresAt || null,
    createdAt: new Date().toISOString(),
  };

  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await updateDoc(docRef, {
    directives: arrayUnion(newDirective),
    updatedAt: serverTimestamp(),
  });

  return newDirective;
};

export const removeDirective = async (agentId, directive) => {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await updateDoc(docRef, {
    directives: arrayRemove(directive),
    updatedAt: serverTimestamp(),
  });
};

export const addMemoryReflection = async (agentId, reflection) => {
  const agent = await getAgentById(agentId);
  if (!agent) throw new Error('Agent not found');

  const newReflection = {
    ...reflection,
    date: new Date().toISOString(),
  };

  let updatedMemory = [...(agent.memory || []), newReflection];
  if (updatedMemory.length > 5) {
    updatedMemory = updatedMemory.slice(-5);
  }

  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await updateDoc(docRef, {
    memory: updatedMemory,
    updatedAt: serverTimestamp(),
  });
};

export const updateConsolidatedInsight = async (agentId, insight, newCycle) => {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await updateDoc(docRef, {
    consolidatedInsight: insight,
    evolutionCycle: newCycle,
    memory: [],
    updatedAt: serverTimestamp(),
  });
};

export const updateAgentStats = async (agentId, result, score) => {
  const agent = await getAgentById(agentId);
  if (!agent) throw new Error('Agent not found');

  const stats = agent.stats || {};
  const newGamesPlayed = (stats.gamesPlayed || 0) + 1;
  const newWins = (stats.wins || 0) + (result === 'win' ? 1 : 0);
  const newLosses = (stats.losses || 0) + (result === 'loss' ? 1 : 0);
  const newTotalScore = (stats.totalScore || 0) + score;
  const newAvgScore = Math.round(newTotalScore / newGamesPlayed);

  let newStreak = stats.currentStreak || 0;
  if (result === 'win') {
    newStreak = newStreak >= 0 ? newStreak + 1 : 1;
  } else {
    newStreak = newStreak <= 0 ? newStreak - 1 : -1;
  }
  const newBestStreak = Math.max(stats.bestStreak || 0, Math.abs(newStreak));

  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await updateDoc(docRef, {
    stats: {
      wins: newWins,
      losses: newLosses,
      gamesPlayed: newGamesPlayed,
      totalScore: newTotalScore,
      avgScore: newAvgScore,
      currentStreak: newStreak,
      bestStreak: newBestStreak,
    },
    updatedAt: serverTimestamp(),
  });
};

// ============================================
// SEED / DEV UTILITIES
// ============================================

export const seedTestAgent = async (ownerId) => {
  const testAgent = {
    ownerId,
    name: 'Viper',
    archetype: 'momentum_chaser',
    archetypeDrift: null,
    config: { risk: 72, concentration: 45, momentum: 88 },
    personality: {
      traits: ['aggressive on momentum', 'cautious during rotations', 'energy-sector affinity'],
      creationAnswers: {
        q1_reaction: 'Buy the dip aggressively',
        q2_loss: 'Analyze what went wrong and adjust',
        q3_sectors: 'Tech and Energy',
        q4_risk: 'High risk, high reward',
        q5_style: 'Fast and decisive',
      }
    },
    avatarColors: ['#5eead4', '#a855f7'],
    memory: [
      { gameId: 'game_005', gameMode: 'baggerbomb', result: 'win', score: 156, lesson: 'Diversified Core strategy validated. Best score yet.', adjustment: 'Keep diversifying Core, single conviction Star', date: '2026-03-15T16:30:00Z' },
      { gameId: 'game_004', gameMode: 'baggerbomb', result: 'win', score: 98, lesson: 'XOM Star pick after Doug energy brief paid off.', adjustment: 'FantasyTimes integration is valuable for Star picks', date: '2026-03-14T16:30:00Z' },
    ],
    consolidatedInsight: 'I perform best with diversified Core picks and a single high-conviction Star. Tech in Star works during momentum phases but costs me during rotations. Energy and financials as Core anchors give consistent base points. My losses come from overconcentration, not bad individual picks.',
    directives: [
      { id: 'dir_001', text: 'Avoid all-tech Star tier', source: 'coaching', expiresAt: null, createdAt: '2026-03-12T20:00:00Z' },
      { id: 'dir_002', text: 'Check sector rotation before picks', source: 'coaching', expiresAt: null, createdAt: '2026-03-12T20:05:00Z' },
      { id: 'dir_003', text: 'Diversified Core works', source: 'pinned', expiresAt: null, createdAt: '2026-03-15T17:00:00Z' },
      { id: 'dir_004', text: 'Cautious NVDA — oversupply risk', source: 'strategy_session', expiresAt: '2026-03-21T23:59:59Z', createdAt: '2026-03-16T10:00:00Z' },
    ],
    stats: {
      wins: 5,
      losses: 3,
      gamesPlayed: 8,
      totalScore: 752,
      avgScore: 94,
      currentStreak: 2,
      bestStreak: 3,
    },
    evolutionCycle: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastDeployedAt: null,
  };

  const docRef = await addDoc(collection(db, AGENTS_COLLECTION), testAgent);
  console.log('Test agent seeded with ID:', docRef.id);
  return docRef.id;
};

// ============================================
// AGENT BATTLE OPERATIONS (Sprint 3)
// ============================================

const BATTLES_COLLECTION = 'agentBattles';

export const updateExecutionMode = async (battleId, mode) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, {
    executionMode: mode,
    updatedAt: serverTimestamp(),
  });
};

export const resolveProposal = async (battleId, currentProposal, resolution, userReason = null) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  const resolved = {
    ...currentProposal,
    resolvedAt: new Date().toISOString(),
    resolution,
    resolvedBy: 'coach',
    userReason,
  };
  await updateDoc(docRef, {
    pendingProposal: resolved,
    updatedAt: serverTimestamp(),
  });
};

export const appendBattleLedger = async (battleId, entry) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, {
    battleLedger: arrayUnion({ ...entry, timestamp: new Date().toISOString() }),
    updatedAt: serverTimestamp(),
  });
};

export const updateStrategyPreset = async (battleId, preset) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, {
    strategyPreset: preset,
    updatedAt: serverTimestamp(),
  });
};

export const resolveGameplanMeeting = async (battleId, resolution) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  const snap = await getDoc(docRef);
  const meeting = snap.data()?.gameplanMeeting;
  if (!meeting) return;
  await updateDoc(docRef, {
    gameplanMeeting: {
      ...meeting,
      status: resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'coach',
    },
    updatedAt: serverTimestamp(),
  });
};
