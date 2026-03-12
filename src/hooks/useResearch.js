// /src/hooks/useResearch.js

import { useState, useCallback } from 'react';

/**
 * useResearch - Manages research mode state and actions
 *
 * @returns {Object} Research state and actions
 */
export const useResearch = () => {
  // ============================================
  // STATE (moved from App.jsx)
  // ============================================

  // Modal visibility
  const [showResearchMode, setShowResearchMode] = useState(false);

  // Browsing state
  const [researchAssetType, setResearchAssetType] = useState('stocks');
  const [researchSearchTerm, setResearchSearchTerm] = useState('');
  const [researchSortBy, setResearchSortBy] = useState('rank');
  const [researchViewMode, setResearchViewMode] = useState('guided'); // 'guided' | 'classic'

  // Selection state
  const [researchExpandedAsset, setResearchExpandedAsset] = useState(null);
  const [researchCompareAssets, setResearchCompareAssets] = useState([]);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState(null);
  const [selectedAssetType, setSelectedAssetType] = useState(null); // 'stock' | 'crypto'

  // Tabs and phases
  const [researchActiveTab, setResearchActiveTab] = useState('stocks'); // 'stocks' | 'crypto' | 'notes' | 'advisor'
  const [researchPhase, setResearchPhase] = useState('explore'); // 'explore' | 'conviction' | 'gameplan'

  // Data / fundamentals
  const [stockFundamentals, setStockFundamentals] = useState({});
  const [cryptoMetrics, setCryptoMetrics] = useState({});
  const [showMoreDepth, setShowMoreDepth] = useState({});
  const [fundamentalsLoading, setFundamentalsLoading] = useState({});
  const [cryptoMetricsLoading, setCryptoMetricsLoading] = useState({});

  // Notes system state
  const [userNotes, setUserNotes] = useState([]);
  const [weeklyProgress, setWeeklyProgress] = useState(null);
  const [notesExpanded, setNotesExpanded] = useState({});
  const [draftNotesExpanded, setDraftNotesExpanded] = useState(false);
  const [customNoteText, setCustomNoteText] = useState('');

  // Research rewards state
  const [researchStreak, setResearchStreak] = useState(0);
  const [showResearchComplete, setShowResearchComplete] = useState(false);

  // Game Plan state (AI-powered strategy from notes)
  const [gamePlanResponse, setGamePlanResponse] = useState(null);
  const [gamePlanLoading, setGamePlanLoading] = useState(false);

  // Conviction Check + Game Plan state
  const [convictionData, setConvictionData] = useState({
    mustHave: [],
    mustAvoid: [],
    confidence: null,
  });
  const [researchGamePlan, setResearchGamePlan] = useState(null);
  const [researchGamePlanLoading, setResearchGamePlanLoading] = useState(false);
  const [researchThesis, setResearchThesis] = useState(null);

  // Asset picker
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerType, setAssetPickerType] = useState(null); // 'mustHave' | 'mustAvoid'

  // Snake Draft Priority Ranker state
  const [draftStrategy, setDraftStrategy] = useState(null); // 'neutral-first' | 'aggressive-first' | 'balanced'
  const [tier1Picks, setTier1Picks] = useState({ steady: [], risky: [], defensive: [] });
  const [tier2Picks, setTier2Picks] = useState({ steady: [], risky: [], defensive: [] });
  const [draftRankerPhase, setDraftRankerPhase] = useState(null); // 'strategy' | 'tier1' | 'tier2' | 'review'

  // Loading state
  const [researchLoading, setResearchLoading] = useState(false);

  // ============================================
  // ACTIONS
  // ============================================

  const openResearch = useCallback(() => {
    setShowResearchMode(true);
  }, []);

  const closeResearch = useCallback(() => {
    setShowResearchMode(false);
  }, []);

  const toggleAssetCompare = useCallback((asset) => {
    setResearchCompareAssets(prev => {
      const isSelected = prev.some(a => a.symbol === asset.symbol);
      if (isSelected) {
        return prev.filter(a => a.symbol !== asset.symbol);
      }
      if (prev.length >= 3) {
        return prev; // Max 3 assets
      }
      return [...prev, asset];
    });
  }, []);

  const clearCompare = useCallback(() => {
    setResearchCompareAssets([]);
  }, []);

  const openAssetPicker = useCallback((type) => {
    setAssetPickerType(type);
    setShowAssetPicker(true);
  }, []);

  const closeAssetPicker = useCallback(() => {
    setShowAssetPicker(false);
    setAssetPickerType(null);
  }, []);

  const selectAssetFromPicker = useCallback((symbol) => {
    if (assetPickerType === 'mustHave') {
      setConvictionData(prev => ({
        ...prev,
        mustHave: prev.mustHave.includes(symbol) ? prev.mustHave : [...prev.mustHave, symbol],
      }));
    } else if (assetPickerType === 'mustAvoid') {
      setConvictionData(prev => ({
        ...prev,
        mustAvoid: prev.mustAvoid.includes(symbol) ? prev.mustAvoid : [...prev.mustAvoid, symbol],
      }));
    }
    closeAssetPicker();
  }, [assetPickerType, closeAssetPicker]);

  const removeMustHave = useCallback((symbol) => {
    setConvictionData(prev => ({
      ...prev,
      mustHave: prev.mustHave.filter(s => s !== symbol),
    }));
  }, []);

  const removeMustAvoid = useCallback((symbol) => {
    setConvictionData(prev => ({
      ...prev,
      mustAvoid: prev.mustAvoid.filter(s => s !== symbol),
    }));
  }, []);

  const setPhase = useCallback((phase) => {
    setResearchPhase(phase);
  }, []);

  const addNote = useCallback((note) => {
    const newNote = {
      ...note,
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    setUserNotes(prev => [...prev, newNote]);
    return newNote;
  }, []);

  const removeNote = useCallback((noteId) => {
    setUserNotes(prev => prev.filter(n => n.id !== noteId));
  }, []);

  const toggleNoteExpanded = useCallback((noteId) => {
    setNotesExpanded(prev => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  }, []);

  const toggleMoreDepth = useCallback((metricName) => {
    setShowMoreDepth(prev => ({
      ...prev,
      [metricName]: !prev[metricName],
    }));
  }, []);

  const resetResearch = useCallback(() => {
    setResearchSearchTerm('');
    setResearchExpandedAsset(null);
    setResearchCompareAssets([]);
    setSelectedAssetDetail(null);
    setSelectedAssetType(null);
    setResearchPhase('explore');
    setConvictionData({
      mustHave: [],
      mustAvoid: [],
      confidence: null,
    });
    setResearchGamePlan(null);
    setResearchThesis(null);
    setGamePlanResponse(null);
    // Reset Draft Ranker state
    setDraftRankerPhase(null);
    setDraftStrategy(null);
    setTier1Picks({ steady: [], risky: [], defensive: [] });
    setTier2Picks({ steady: [], risky: [], defensive: [] });
  }, []);

  const resetDraftRanker = useCallback(() => {
    setDraftRankerPhase(null);
    setDraftStrategy(null);
    setTier1Picks({ steady: [], risky: [], defensive: [] });
    setTier2Picks({ steady: [], risky: [], defensive: [] });
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Modal
    showResearchMode,
    setShowResearchMode,
    openResearch,
    closeResearch,

    // Browsing
    researchAssetType,
    setResearchAssetType,
    researchSearchTerm,
    setResearchSearchTerm,
    researchSortBy,
    setResearchSortBy,
    researchViewMode,
    setResearchViewMode,

    // Selection
    researchExpandedAsset,
    setResearchExpandedAsset,
    researchCompareAssets,
    setResearchCompareAssets,
    toggleAssetCompare,
    clearCompare,
    selectedAssetDetail,
    setSelectedAssetDetail,
    selectedAssetType,
    setSelectedAssetType,

    // Tabs/Phases
    researchActiveTab,
    setResearchActiveTab,
    researchPhase,
    setResearchPhase,
    setPhase,

    // Data / fundamentals
    stockFundamentals,
    setStockFundamentals,
    cryptoMetrics,
    setCryptoMetrics,
    showMoreDepth,
    setShowMoreDepth,
    toggleMoreDepth,
    fundamentalsLoading,
    setFundamentalsLoading,
    cryptoMetricsLoading,
    setCryptoMetricsLoading,

    // Notes system
    userNotes,
    setUserNotes,
    addNote,
    removeNote,
    weeklyProgress,
    setWeeklyProgress,
    notesExpanded,
    setNotesExpanded,
    toggleNoteExpanded,
    draftNotesExpanded,
    setDraftNotesExpanded,
    customNoteText,
    setCustomNoteText,

    // Research rewards
    researchStreak,
    setResearchStreak,
    showResearchComplete,
    setShowResearchComplete,

    // Game plan
    gamePlanResponse,
    setGamePlanResponse,
    gamePlanLoading,
    setGamePlanLoading,
    convictionData,
    setConvictionData,
    researchGamePlan,
    setResearchGamePlan,
    researchGamePlanLoading,
    setResearchGamePlanLoading,
    researchThesis,
    setResearchThesis,

    // Asset picker
    showAssetPicker,
    setShowAssetPicker,
    assetPickerType,
    setAssetPickerType,
    openAssetPicker,
    closeAssetPicker,
    selectAssetFromPicker,
    removeMustHave,
    removeMustAvoid,

    // Draft Ranker state
    draftStrategy,
    setDraftStrategy,
    tier1Picks,
    setTier1Picks,
    tier2Picks,
    setTier2Picks,
    draftRankerPhase,
    setDraftRankerPhase,

    // Loading
    researchLoading,
    setResearchLoading,

    // Utilities
    resetResearch,
    resetDraftRanker
  };
};

export default useResearch;
