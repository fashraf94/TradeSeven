import { withEpochToken, fetchBirthProvenance } from './compositionIdentityClient';
import {
  collection, doc, addDoc, updateDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const AGENTS_COLLECTION = 'agents';

// ============================================
// READ OPERATIONS
// ============================================

export const subscribeToUserAgent = (ownerId, callback) => {
  // No limit(1): a player may also own a training CLONE (Slice 3, same ownerId).
  // The dashboard/Forge surfaces always show the RANKED agent, so exclude clones.
  const q = query(
    collection(db, AGENTS_COLLECTION),
    where('ownerId', '==', ownerId)
  );

  return onSnapshot(q, (snapshot) => {
    const docSnap = snapshot.docs.find(d => d.data().isTrainingClone !== true && d.data().isCasualClone !== true);
    if (!docSnap) {
      callback(null);
      return;
    }
    callback({ id: docSnap.id, ...docSnap.data() });
  }, (error) => {
    console.error('Agent subscription error:', error);
    callback(null);
  });
};

// Deploy state lives on the DEPLOY TARGET doc, which on the casual-clone path is
// NOT the ranked agent: agentDeploy.js resolves a clone id and decide.js writes
// deployProgress / lastDeployedAt / lastDecision to agents/{deployAgentId}
// (decide.js:150 derives agentRef from the POSTed agentId). subscribeToUserAgent
// above deliberately EXCLUDES clone docs — correct for the Hub, sidebar and
// evolution timeline, which must always show the RANKED agent — so a caller that
// needs the deploy target's live state subscribes to that document BY ID here
// instead of loosening the exclusion.
//
// The principle: identity comes from the ranked agent; deploy state comes from
// the deploy target. These were the same document before the clone feature
// existed, which is how they came to be conflated.
export const subscribeToAgentDoc = (agentId, callback) => {
  return onSnapshot(doc(db, AGENTS_COLLECTION, agentId), (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }
    callback({ id: docSnap.id, ...docSnap.data() });
  }, (error) => {
    console.error('Agent doc subscription error:', error);
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
      // Single primary color chosen at onboarding; drives avatarColors above
      // and the dashboard accent downstream. Nullable for legacy/test creates.
      primaryColor: agentData.primaryColor ?? null,
      memory: [],
      consolidatedInsight: '',
      directives: [],
      activeRules: [],
      equippedBundleIds: [],
      // Phase 5B1 — watchlist equip slot. Nullable; no migration needed (the
      // equip endpoints treat an absent field as "not equipped"). Onboarding
      // creates the agent already equipped to its committed starter watchlist
      // (atomic, race-free — no post-create equip that the routing gate could
      // interrupt); other callers leave these null and equip later via
      // /api/agent/equip-watchlist.
      equippedWatchlistId: agentData.equippedWatchlistId ?? null,
      equippedWatchlistName: agentData.equippedWatchlistName ?? null,
      equippedAt: agentData.equippedAt ?? null,
      starterKitCompleted: false,
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

    // #1: epoch-bound; #6: birth provenance (both no-ops pre-genesis).
    const docRef = await addDoc(collection(db, AGENTS_COLLECTION),
      await withEpochToken({ ...agentDoc, ...(await fetchBirthProvenance()) }));
    return docRef.id;
  } catch (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
};

// ============================================
// UPDATE OPERATIONS
// ============================================

// Release 2 (settingsRev migration, founder ruling D3 2026-07-10): fields that
// feed the battle snapshot / deploy config may ONLY be written through the
// transactional server endpoints (equip-watchlist, equip-bundle, equip-lean,
// set-tempo-dial, change-archetype, …) — those bump agent.settingsRev so a
// mid-deploy config change is detectable, never silent. This client-side
// blind-merge writer refuses them loudly. Its one live caller writes the
// cosmetic starterKitCompleted flag, which stays allowed.
const SETTINGS_GUARDED_FIELDS = Object.freeze([
  'config', 'archetype', 'activeRules', 'equippedBundleIds', 'equippedTraits',
  'equippedWatchlistId', 'equippedWatchlistName', 'standingLeans', 'dials',
  'settingsRev', 'activeBattleId', 'deployedStrategy', 'consolidatedInsight',
]);

export const updateAgent = async (agentId, updates) => {
  const guarded = Object.keys(updates || {}).filter((k) =>
    SETTINGS_GUARDED_FIELDS.some((g) => k === g || k.startsWith(`${g}.`)),
  );
  if (guarded.length > 0) {
    throw new Error(
      `updateAgent: field(s) [${guarded.join(', ')}] are settings-guarded — use the transactional server endpoint instead (Release 2 settingsRev discipline).`,
    );
  }
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
  const docRef = doc(db, AGENTS_COLLECTION, agentId);

  // Duplicate guard: skip if a directive with the same text already exists
  const snap = await getDoc(docRef);
  const existing = snap.data()?.directives || [];
  if (existing.some(d => d.text === directive.text)) {
    console.warn('[addDirective] Duplicate directive skipped:', directive.text);
    return existing.find(d => d.text === directive.text);
  }

  const newDirective = {
    id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: directive.text,
    source: directive.source,
    expiresAt: directive.expiresAt || null,
    createdAt: new Date().toISOString(),
  };

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

export const toggleDirective = async (agentId, directiveId, isActive) => {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const directives = (snap.data().directives || []).map(d =>
    d.id === directiveId ? { ...d, isActive } : d
  );
  await updateDoc(docRef, { directives, updatedAt: serverTimestamp() });
};

export const pinDirective = async (agentId, directiveId, pinned) => {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const directives = (snap.data().directives || []).map(d =>
    d.id === directiveId ? { ...d, priority: pinned ? 1 : 0 } : d
  );
  await updateDoc(docRef, { directives, updatedAt: serverTimestamp() });
};

export const addCoachingRule = async (agentId, text) => {
  return addDirective(agentId, { text, source: 'coaching' });
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

// Sprint 1 — Dossier evolution timeline. Marks the latest evolution cycle as
// viewed by the user so the "Cycle N complete" indicator on the Evolution tab
// clears. NOT a dossier-funnel writer — purely a UX read-state marker.
export const markEvolutionCycleViewed = async (agentId, cycle) => {
  if (!agentId || typeof cycle !== 'number') return;
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await updateDoc(docRef, {
    lastViewedEvolutionCycle: cycle,
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
// WATCHLIST EQUIP (Phase 5B1)
// ============================================
// Thin clients for the equip endpoints. Unlike the rest of this service
// (which uses the Firebase client SDK directly), equip/unequip go through
// authenticated API endpoints so the server can validate watchlist ownership
// and commit state in a transaction. Each throws on a non-2xx response with an
// Error carrying `status` + `code`. Modeled on forgeWatchlistService.js.

// Exported since the Release 2 bundle-writer migration: forgeService's
// equip/unequip-bundle thin clients map endpoint errors through this SAME
// helper, so every /api/agent/* equip surface throws the one Error shape
// (message + status + code — callers can branch on code without
// string-matching human copy).
export async function toEquipError(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    // non-JSON error body — fall back to the status line
  }
  const err = new Error(data.message || `Request failed (${response.status})`);
  err.status = response.status;
  err.code = data.error || 'request_failed';
  // The full parsed body rides along (additive) — endpoints attach
  // decision details (leanCap, equippedCount, reconfirmOfStale, ...) the
  // surface uses for §9-honest copy.
  err.payload = data;
  return err;
}

/**
 * Equip a committed watchlist to an agent. Resolves with the API response
 * ({ agentId, equippedWatchlistId, equippedWatchlistName, equippedAt, idempotent }).
 */
export const equipWatchlist = async (agentId, watchlistId) => {
  const response = await fetchWithAuth('/api/agent/equip-watchlist', {
    method: 'POST',
    body: JSON.stringify({ agentId, watchlistId }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
};

/**
 * Clear the agent's equipped watchlist. Resolves with the API response
 * ({ agentId, equippedWatchlistId: null, idempotent }).
 */
export const unequipWatchlist = async (agentId) => {
  const response = await fetchWithAuth('/api/agent/unequip-watchlist', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
};

// ============================================
// ARCHETYPE CHANGE
// ============================================
// Thin client for the change-archetype endpoint — same pattern as the watchlist
// equips above (authenticated, battle-locked server-side, throws on non-2xx).

/**
 * Change an agent's archetype (its trading personality). Blocked server-side
 * (409 battle_active) while the agent has an active battle. Resolves with the
 * API response ({ agentId, archetype, idempotent }).
 */
export const changeArchetype = async (agentId, archetype) => {
  const response = await fetchWithAuth('/api/agent/change-archetype', {
    method: 'POST',
    body: JSON.stringify({ agentId, archetype }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
};

/**
 * R1(a) — the allowlisted settings write path (equippedTraits /
 * deployedStrategy). Routes through POST /api/agent/update-agent-settings so
 * agent.settingsRev bumps on every real write; identical values are
 * idempotent no-ops. Resolves with { agentId, fields, idempotent }.
 */
export const updateAgentSettings = async (agentId, set) => {
  const response = await fetchWithAuth('/api/agent/update-agent-settings', {
    method: 'POST',
    body: JSON.stringify({ agentId, set }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
};

// ============================================
// RELEASE 3 — STANDING LEANS + TEMPO DIAL (the Character tab controls)
// ============================================
// Thin clients for the already-merged Release 2 endpoints — same pattern as the
// watchlist/archetype equips above (authenticated, battle-locked server-side,
// throws the toEquipError shape so callers branch on err.code). None of these
// touch the agent doc directly: standingLeans + dials are SETTINGS_GUARDED_FIELDS
// (updateAgent refuses them), so every write goes through the server tx, which
// bumps settingsRev. No response echoes the new settingsRev — the caller re-reads
// via the live subscribeToUserAgent snapshot (never assume the write won a race).
//
// DARK / rollback note: while STANDING_LEANS_ENABLED / TEMPO_DIAL_ENABLED are
// false the endpoints answer 404 { error: 'not_found' }; callers must branch on
// err.code === 'not_found' to render "pending activation" rather than a generic
// error toast (the dark 404 is a pre-activation signal, not a failure).

/**
 * Equip a standing lean. `version` MUST be the canonicalTextVersion the UI
 * displayed (from src/data/archetypeAdjustments.js) — the server rejects a stale
 * pin with 409 deprecated_version (the re-confirm trigger). Resolves with
 * { agentId, adjustmentId, version, standingLeans, idempotent }. Failure codes to
 * branch on: not_in_menu (400), deprecated_version / conflicting_lean / lean_limit
 * / battle_active (409), forbidden (403), agent_not_found (404), not_found (dark).
 */
export const equipLean = async (agentId, adjustmentId, version) => {
  const response = await fetchWithAuth('/api/agent/equip-lean', {
    method: 'POST',
    body: JSON.stringify({ agentId, adjustmentId, version }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
};

/**
 * Unequip a standing lean (idempotent if not equipped). Resolves with
 * { agentId, adjustmentId, standingLeans, idempotent }.
 */
export const unequipLean = async (agentId, adjustmentId) => {
  const response = await fetchWithAuth('/api/agent/unequip-lean', {
    method: 'POST',
    body: JSON.stringify({ agentId, adjustmentId }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
};

/**
 * Set the tempo dial to a DESIRED position ('measured' | 'standard' |
 * 'aggressive'). The effective tempo is resolved server-side at eval time (fails
 * closed to 'standard' when the dial is off / band-version mismatches). Resolves
 * with { agentId, tempo, idempotent }. Failure codes: invalid_tempo (400),
 * battle_active (409), forbidden (403), agent_not_found (404), not_found (dark).
 */
export const setTempoDial = async (agentId, tempo) => {
  const response = await fetchWithAuth('/api/agent/set-tempo-dial', {
    method: 'POST',
    body: JSON.stringify({ agentId, tempo }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
};

/**
 * Emit the `watchlist_equip` shadow log for the onboarding "born-equipped" path.
 * That path equips the starter watchlist atomically at agent creation (it does
 * NOT call equipWatchlist), so it bypasses the equip endpoint's shadow-log
 * emission; this thin client posts to the telemetry-only endpoint that emits
 * the same entry. Throws on a non-2xx response so the caller can surface (not
 * swallow) the failure.
 */
export const logWatchlistEquip = async ({ agentId, watchlistId, equippedWatchlistName, equippedAt }) => {
  const response = await fetchWithAuth('/api/agent/log-watchlist-equip', {
    method: 'POST',
    body: JSON.stringify({ agentId, watchlistId, equippedWatchlistName, equippedAt }),
  });
  if (!response.ok) throw await toEquipError(response);
  return response.json();
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

export const updateReviewDecision = async (battleId, ruleId, decision) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, {
    [`reviewDecisions.${ruleId}`]: decision,
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

export const submitDailyGrades = async (battleId, dateStr, grades) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, {
    [`dailyGrades.${dateStr}`]: { trades: grades, submittedAt: new Date().toISOString() },
    updatedAt: serverTimestamp(),
  });
};

export const addFeedBookmark = async (battleId, entryId) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, {
    feedBookmarks: arrayUnion(entryId),
    updatedAt: serverTimestamp(),
  });
};

export const removeFeedBookmark = async (battleId, entryId) => {
  const docRef = doc(db, BATTLES_COLLECTION, battleId);
  await updateDoc(docRef, {
    feedBookmarks: arrayRemove(entryId),
    updatedAt: serverTimestamp(),
  });
};
