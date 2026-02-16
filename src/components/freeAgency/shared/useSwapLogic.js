import { useState, useEffect, useMemo, useCallback } from 'react';
import { isSwapLocked } from '../../../utils/baggerBombUtils';

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
  const [selectionOrder, setSelectionOrder] = useState(null); // 'add-first' | 'drop-first' | null

  // Price data
  const [livePrices, setLivePrices] = useState({});

  // UI state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(null);
  const [swapError, setSwapError] = useState(null);
  const [swapBlockedMessage, setSwapBlockedMessage] = useState(null);

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

  // Orange Zone swap lock — compute lock status for all roster assets
  const orangeZoneLocked = useMemo(() => {
    const result = {};
    const lockedPrices = currentDraft?.lockedPrices;
    const draftThresholds = currentDraft?.thresholds;
    if (!lockedPrices || !draftThresholds || !livePrices || Object.keys(livePrices).length === 0) return result;

    allRosterAssets.forEach(asset => {
      const symbol = asset.symbol;
      if (!symbol) return;
      const lockedPrice = lockedPrices[symbol];
      const livePrice = typeof livePrices[symbol] === 'object' ? livePrices[symbol]?.price : livePrices[symbol];
      const thresholdData = draftThresholds[symbol];
      const threshold = typeof thresholdData === 'object' ? thresholdData?.threshold : thresholdData;
      if (!lockedPrice || !livePrice || !threshold || threshold <= 0) return;

      const priceChange = ((livePrice - lockedPrice) / lockedPrice) * 100;
      const multiplier = priceChange / threshold;
      const lockStatus = isSwapLocked(multiplier, threshold);
      if (lockStatus.locked) result[symbol] = lockStatus;
    });
    return result;
  }, [allRosterAssets, currentDraft, livePrices]);

  // Get free agents for selected category
  const filteredFreeAgents = useMemo(() => {
    return freeAgents[selectedCategory] || [];
  }, [freeAgents, selectedCategory]);

  // Can user make a swap right now?
  const canSwap = useMemo(() => {
    return isWindowOpen && swapsRemaining > 0;
  }, [isWindowOpen, swapsRemaining]);

  // Active category filter (from either selection)
  const activeCategory = useMemo(() => {
    return selectedAdd?.category || selectedDrop?.category || null;
  }, [selectedAdd, selectedDrop]);

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

  // Fetch live prices for all assets (free agents + roster)
  useEffect(() => {
    const allSymbols = new Set();
    ['steady', 'risky', 'defensive'].forEach(cat => {
      (freeAgents[cat] || []).forEach(a => { if (a.symbol) allSymbols.add(a.symbol.toUpperCase()); });
      (playerRoster[cat] || []).forEach(a => { if (a.symbol) allSymbols.add(a.symbol.toUpperCase()); });
    });

    if (allSymbols.size === 0) return;

    const fetchPrices = async () => {
      try {
        const { getMultipleStockPrices, getMultipleCryptoPrices } = await import('../../../services/eodhdAPI');
        const prices = portfolioType === 'crypto'
          ? await getMultipleCryptoPrices(Array.from(allSymbols))
          : await getMultipleStockPrices(Array.from(allSymbols));
        setLivePrices(prices);
      } catch (err) {
        logger.error('[FreeAgency] Failed to fetch prices:', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [freeAgents, playerRoster, logger]);

  // ===========================================
  // SELECTION HANDLERS (Bidirectional: Add or Drop first)
  // ===========================================

  // User selects a FREE AGENT to ADD (can be first or second selection)
  const handleSelectAdd = useCallback((asset) => {
    if (!canSwap) return;

    // If same asset clicked, deselect
    if (selectedAdd?.symbol === asset.symbol) {
      setSelectedAdd(null);
      // If this was the first selection, clear everything
      if (selectionOrder === 'add-first') {
        setSelectedDrop(null);
        setSelectionOrder(null);
      }
      return;
    }

    setSelectedAdd(asset);
    setSelectedCategory(asset.category); // Update category tab to match

    // Track selection order if this is the first selection
    if (!selectedDrop) {
      setSelectionOrder('add-first');
    }

    // Clear drop selection if it's a different category
    if (selectedDrop && selectedDrop.category !== asset.category) {
      setSelectedDrop(null);
    }

    logger.log('[FreeAgency] Selected to add:', asset.symbol);
  }, [canSwap, selectedAdd, selectedDrop, selectionOrder, logger]);

  // User selects a ROSTER ASSET to DROP (can be first or second selection)
  const handleSelectDrop = useCallback((asset) => {
    if (!canSwap) return;

    // Orange Zone swap lock — block stocks near a threshold
    if (orangeZoneLocked[asset.symbol]?.locked) {
      setSwapBlockedMessage(`${asset.symbol} is in the danger zone — too close to a threshold to swap!`);
      return;
    }

    // If a free agent is already selected, ensure same category
    if (selectedAdd && asset.category !== selectedAdd.category) {
      logger.warn('[FreeAgency] Category mismatch - cannot select');
      return;
    }

    // If same asset clicked, deselect
    if (selectedDrop?.symbol === asset.symbol) {
      setSelectedDrop(null);
      // If this was the first selection, clear everything
      if (selectionOrder === 'drop-first') {
        setSelectedAdd(null);
        setSelectionOrder(null);
      }
      return;
    }

    setSelectedDrop(asset);
    setSelectedCategory(asset.category); // Update category tab to match

    // Track selection order if this is the first selection
    if (!selectedAdd) {
      setSelectionOrder('drop-first');
    }

    // Clear add selection if it's a different category
    if (selectedAdd && selectedAdd.category !== asset.category) {
      setSelectedAdd(null);
    }

    logger.log('[FreeAgency] Selected to drop:', asset.symbol);
  }, [canSwap, selectedAdd, selectedDrop, selectionOrder, orangeZoneLocked, logger]);

  const handleCancelSelection = useCallback(() => {
    setSelectedAdd(null);
    setSelectedDrop(null);
    setSelectionOrder(null);
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
    livePrices,

    // Loading/Error states
    loading,
    error,
    isSwapping,
    swapSuccess,
    setSwapSuccess,  // Exposed for SwapSuccessToast dismiss
    swapError,
    swapBlockedMessage,
    setSwapBlockedMessage,
    orangeZoneLocked,

    // Selection state
    selectedDrop,
    selectedAdd,
    selectedCategory,
    setSelectedCategory,
    selectionOrder,
    activeCategory,
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
