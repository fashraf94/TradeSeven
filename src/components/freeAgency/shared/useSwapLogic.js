import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * useSwapLogic - Shared business logic hook for FreeAgency screens
 *
 * This hook encapsulates ALL business logic so both Mobile and Desktop layouts
 * can share the same logic while having optimized UI implementations.
 *
 * Features:
 * - Window status tracking (stocks: 3PM-11:59PM CT, crypto: 6PM-11:59PM CT)
 * - Swap limit tracking (2 per day per player)
 * - Category-locked swaps (steady ↔ steady, risky ↔ risky, etc.)
 * - Selection state management
 * - Swap execution with price locking
 */
const useSwapLogic = ({ currentDraft, user, onBack, logger = console }) => {
  // ===========================================
  // STATE
  // ===========================================
  const [freeAgents, setFreeAgents] = useState({ steady: [], risky: [], defensive: [] });
  const [playerRoster, setPlayerRoster] = useState({ steady: [], risky: [], defensive: [] });
  const [swapHistory, setSwapHistory] = useState([]);
  const [swapsRemaining, setSwapsRemaining] = useState(2);
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [timeInfo, setTimeInfo] = useState(null); // { type: 'opens'|'closes', hours, minutes }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection state
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [selectedAdd, setSelectedAdd] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('steady');

  // UI state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(null);
  const [swapError, setSwapError] = useState(null);

  // ===========================================
  // DERIVED VALUES
  // ===========================================
  const currentUserId = user?.odUserId || user?.username;
  const portfolioType = currentDraft?.type || 'stocks';

  // Flatten roster for easy access
  const allRosterAssets = useMemo(() => {
    return [
      ...playerRoster.steady,
      ...playerRoster.risky,
      ...playerRoster.defensive
    ];
  }, [playerRoster]);

  // Get free agents for selected category
  const filteredFreeAgents = useMemo(() => {
    return freeAgents[selectedCategory] || [];
  }, [freeAgents, selectedCategory]);

  // Can user make a swap right now?
  const canSwap = useMemo(() => {
    return isWindowOpen && swapsRemaining > 0;
  }, [isWindowOpen, swapsRemaining]);

  // ===========================================
  // DATA FETCHING
  // ===========================================
  const loadData = useCallback(async () => {
    if (!currentDraft?.id || !currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Dynamic import to avoid circular dependencies
      const freeAgencyService = await import('../../../services/freeAgencyService');

      // Check window status
      const windowOpen = freeAgencyService.isFreeAgencyWindowOpen(portfolioType);
      setIsWindowOpen(windowOpen);

      // Get time info
      if (windowOpen) {
        const closeTime = freeAgencyService.getTimeUntilWindowCloses(portfolioType);
        setTimeInfo({ type: 'closes', ...closeTime });
      } else {
        const openTime = freeAgencyService.getTimeUntilWindowOpens(portfolioType);
        setTimeInfo({ type: 'opens', ...openTime });
      }

      // Get swaps remaining
      const swapsUsed = await freeAgencyService.getPlayerSwapsToday(
        currentDraft.id,
        currentUserId,
        portfolioType
      );
      setSwapsRemaining(Math.max(0, 2 - swapsUsed));

      // Get free agents
      const agents = await freeAgencyService.getFreeAgents(currentDraft.id);
      setFreeAgents(agents || { steady: [], risky: [], defensive: [] });

      // Get player roster
      const roster = await freeAgencyService.getPlayerRoster(
        currentDraft.id,
        currentUserId
      );
      setPlayerRoster(roster || { steady: [], risky: [], defensive: [] });

      // Get swap history (all players)
      const history = await freeAgencyService.getSwapHistory(currentDraft.id);
      setSwapHistory(history || []);

      logger.log('[FreeAgency] Data loaded successfully');
    } catch (err) {
      logger.error('[FreeAgency] Error loading data:', err);
      setError(err.message || 'Failed to load free agency data');
    } finally {
      setLoading(false);
    }
  }, [currentDraft?.id, currentUserId, portfolioType, logger]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ===========================================
  // SELECTION HANDLERS (Reversed flow: Add first, then Drop)
  // ===========================================

  // Step 1: User selects a FREE AGENT to ADD
  const handleSelectAdd = useCallback((asset) => {
    if (!canSwap) return;

    // If same asset clicked, deselect
    if (selectedAdd?.symbol === asset.symbol) {
      setSelectedAdd(null);
      setSelectedDrop(null); // Also clear drop selection
      return;
    }

    setSelectedAdd(asset);
    setSelectedCategory(asset.category); // Lock to this category

    // Clear drop selection if it's a different category
    if (selectedDrop && selectedDrop.category !== asset.category) {
      setSelectedDrop(null);
    }

    logger.log('[FreeAgency] Selected to add:', asset.symbol);
  }, [canSwap, selectedAdd, selectedDrop, logger]);

  // Step 2: User selects a ROSTER ASSET to DROP (must match category)
  const handleSelectDrop = useCallback((asset) => {
    if (!canSwap) return;
    if (!selectedAdd) return; // Must select free agent first

    // Ensure same category as selected free agent
    if (asset.category !== selectedAdd.category) {
      logger.warn('[FreeAgency] Category mismatch - cannot select');
      return;
    }

    // If same asset clicked, deselect
    if (selectedDrop?.symbol === asset.symbol) {
      setSelectedDrop(null);
      return;
    }

    setSelectedDrop(asset);
    logger.log('[FreeAgency] Selected to drop:', asset.symbol);
  }, [canSwap, selectedAdd, selectedDrop, logger]);

  const handleCancelSelection = useCallback(() => {
    setSelectedAdd(null);
    setSelectedDrop(null);
    setShowConfirmModal(false);
  }, []);

  // ===========================================
  // SWAP EXECUTION
  // ===========================================
  const handleConfirmSwap = useCallback(async () => {
    if (!selectedDrop || !selectedAdd || isSwapping) return;

    setIsSwapping(true);
    setSwapError(null);

    try {
      const freeAgencyService = await import('../../../services/freeAgencyService');

      const result = await freeAgencyService.executeSwap(
        currentDraft.id,
        currentUserId,
        selectedDrop.symbol,
        selectedAdd.symbol
      );

      if (result.success) {
        logger.log('[FreeAgency] Swap successful:', selectedDrop.symbol, '→', selectedAdd.symbol);

        setSwapSuccess({
          dropped: selectedDrop,
          added: selectedAdd,
        });

        // Clear selections
        setSelectedDrop(null);
        setSelectedAdd(null);
        setShowConfirmModal(false);

        // Reload data
        await loadData();

        // Clear success message after 3 seconds
        setTimeout(() => setSwapSuccess(null), 3000);
      } else {
        throw new Error(result.error || 'Swap failed');
      }
    } catch (err) {
      logger.error('[FreeAgency] Swap failed:', err);
      setSwapError(err.message || 'Swap failed. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  }, [selectedDrop, selectedAdd, isSwapping, currentDraft?.id, currentUserId, loadData, logger]);

  // ===========================================
  // NAVIGATION
  // ===========================================
  const handleBack = useCallback(() => {
    // Navigate back to DraftBattleScreen
    if (onBack) {
      onBack();
    }
  }, [onBack]);

  // ===========================================
  // RETURN VALUES
  // ===========================================
  return {
    // Data
    freeAgents,
    playerRoster,
    allRosterAssets,
    filteredFreeAgents,
    swapHistory,
    swapsRemaining,
    isWindowOpen,
    timeInfo,
    portfolioType,
    currentUserId,

    // Loading/Error states
    loading,
    error,
    isSwapping,
    swapSuccess,
    setSwapSuccess,  // Exposed for SwapSuccessToast dismiss
    swapError,

    // Selection state
    selectedDrop,
    selectedAdd,
    selectedCategory,
    setSelectedCategory,
    canSwap,

    // UI state
    showConfirmModal,
    setShowConfirmModal,

    // Handlers
    handleSelectDrop,
    handleSelectAdd,
    handleCancelSelection,
    handleConfirmSwap,
    handleBack,

    // Utilities
    loadData,
  };
};

export default useSwapLogic;
