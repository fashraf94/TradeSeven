// src/hooks/useClaimsFreeAgency.js
// Custom hook for claim-based free agency state management
// Mirrors useSwapLogic.js patterns — manages data, selection, and real-time subscriptions

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as claimService from '../services/claimFreeAgencyService';
import * as freeAgencyService from '../services/freeAgencyService';

const useClaimsFreeAgency = (currentDraft, user, setScreen, logger = console) => {
  const draftId = currentDraft?.id;
  const currentUserId = user?.odUserId;
  const portfolioType = currentDraft?.type || 'stocks';

  // ===========================================
  // STATE
  // ===========================================

  // Data (fetched)
  const [freeAgents, setFreeAgents] = useState({ steady: [], risky: [], defensive: [] });
  const [playerRoster, setPlayerRoster] = useState({ steady: [], risky: [], defensive: [] });
  const [livePrices, setLivePrices] = useState({});
  const [allClaims, setAllClaims] = useState([]);
  const [waiverPriority, setWaiverPriority] = useState([]);

  // Window
  const [windowStatus, setWindowStatus] = useState({ isOpen: false, opensAt: null, closesAt: null, nextProcessingAt: null });
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0, label: '' });

  // Selection (for submitting new claim)
  const [selectedDrop, setSelectedDrop] = useState(null);
  const [selectedAdd, setSelectedAdd] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('steady');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Refs
  const unsubscribeRef = useRef(null);

  // ===========================================
  // DERIVED VALUES
  // ===========================================

  // Enrich roster with gain % (same pattern as useSwapLogic.js:86-104)
  const enrichedRoster = useMemo(() => {
    const lockedPrices = currentDraft?.lockedPrices || {};
    const enrichCategory = (assets) => assets.map(asset => {
      const symbol = asset.symbol?.toUpperCase();
      const liveData = livePrices[symbol];
      const livePrice = typeof liveData === 'object' ? liveData?.price : liveData;
      const lockedPrice = lockedPrices[symbol];
      let gain = 0;
      if (livePrice && lockedPrice && lockedPrice > 0) {
        gain = ((livePrice - lockedPrice) / lockedPrice) * 100;
      }
      return { ...asset, gain, price: livePrice || 0 };
    });
    return {
      steady: enrichCategory(playerRoster.steady || []),
      risky: enrichCategory(playerRoster.risky || []),
      defensive: enrichCategory(playerRoster.defensive || []),
    };
  }, [playerRoster, livePrices, currentDraft?.lockedPrices]);

  // Current user's pending claims
  const pendingClaims = useMemo(() => {
    return allClaims
      .filter(c => c.odUserId === currentUserId && c.status === 'pending')
      .sort((a, b) => a.rank - b.rank);
  }, [allClaims, currentUserId]);

  // Recent claim results (approved/denied) for current user
  const claimResults = useMemo(() => {
    return allClaims
      .filter(c => c.odUserId === currentUserId && (c.status === 'approved' || c.status === 'denied'))
      .sort((a, b) => {
        const aTime = a.processedAt || '';
        const bTime = b.processedAt || '';
        return bTime.localeCompare(aTime);
      });
  }, [allClaims, currentUserId]);

  // Claims remaining (max 2 per cycle)
  const claimsRemaining = useMemo(() => {
    return Math.max(0, 2 - pendingClaims.length);
  }, [pendingClaims]);

  // Can submit a new claim?
  const canSubmit = useMemo(() => {
    return windowStatus.isOpen && claimsRemaining > 0;
  }, [windowStatus.isOpen, claimsRemaining]);

  // Active category from selection (for filtering)
  const activeCategory = useMemo(() => {
    if (selectedDrop) return selectedDrop.category;
    if (selectedAdd) return selectedAdd.category;
    return null;
  }, [selectedDrop, selectedAdd]);

  // Filtered free agents for display
  const filteredFreeAgents = useMemo(() => {
    const cat = activeCategory || selectedCategory;
    return freeAgents[cat] || [];
  }, [freeAgents, activeCategory, selectedCategory]);

  // User's position in waiver priority
  const userPriorityPosition = useMemo(() => {
    if (!waiverPriority.length || !currentUserId) return 0;
    const idx = waiverPriority.indexOf(currentUserId);
    return idx >= 0 ? idx + 1 : 0;
  }, [waiverPriority, currentUserId]);

  // Latest processing log entry
  const latestProcessingLog = useMemo(() => {
    const log = currentDraft?.claimSystem?.processingLog || [];
    return log.length > 0 ? log[log.length - 1] : null;
  }, [currentDraft?.claimSystem?.processingLog]);

  // ===========================================
  // DATA LOADING
  // ===========================================

  const loadData = useCallback(async () => {
    if (!draftId || !currentUserId) return;

    try {
      setError(null);

      // Fetch roster and free agents
      const [roster, agents] = await Promise.all([
        freeAgencyService.getPlayerRoster(draftId, currentUserId),
        freeAgencyService.getFreeAgents(draftId),
      ]);

      if (roster) setPlayerRoster(roster);
      if (agents) setFreeAgents(agents);

      // Window status
      const status = claimService.getClaimWindowStatus(currentDraft);
      setWindowStatus(status);

      // Waiver priority
      const priority = claimService.calculateWaiverPriority(currentDraft);
      setWaiverPriority(priority);

    } catch (err) {
      logger.error('[ClaimFA] Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [draftId, currentUserId, currentDraft, logger]);

  // Initial load + auto-refresh every 60s
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ===========================================
  // LIVE PRICES (same pattern as useSwapLogic.js:193-218)
  // ===========================================

  useEffect(() => {
    const allSymbols = new Set();
    ['steady', 'risky', 'defensive'].forEach(cat => {
      (freeAgents[cat] || []).forEach(a => { if (a.symbol) allSymbols.add(a.symbol.toUpperCase()); });
      (playerRoster[cat] || []).forEach(a => { if (a.symbol) allSymbols.add(a.symbol.toUpperCase()); });
    });

    if (allSymbols.size === 0) return;

    const fetchPrices = async () => {
      try {
        const { getMultipleStockPrices, getMultipleCryptoPrices } = await import('../services/eodhdAPI');
        const prices = portfolioType === 'crypto'
          ? await getMultipleCryptoPrices(Array.from(allSymbols))
          : await getMultipleStockPrices(Array.from(allSymbols));
        setLivePrices(prices);
      } catch (err) {
        logger.error('[ClaimFA] Failed to fetch prices:', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [freeAgents, playerRoster, portfolioType, logger]);

  // ===========================================
  // REAL-TIME CLAIMS SUBSCRIPTION
  // ===========================================

  useEffect(() => {
    if (!draftId) return;

    unsubscribeRef.current = claimService.subscribeToClaimsForDraft(draftId, (claims) => {
      setAllClaims(claims);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [draftId]);

  // ===========================================
  // COUNTDOWN TIMER (1s interval)
  // ===========================================

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      let targetDate;
      let label;

      if (windowStatus.isOpen) {
        targetDate = windowStatus.closesAt;
        label = 'Closes in';
      } else {
        // If we're between close and processing, show processing countdown
        const processingTime = windowStatus.nextProcessingAt;
        if (processingTime && processingTime > now) {
          targetDate = processingTime;
          label = 'Processing in';
        } else {
          targetDate = windowStatus.opensAt;
          label = 'Opens in';
        }
      }

      if (!targetDate) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, label: '' });
        return;
      }

      const diff = new Date(targetDate) - now;
      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, label });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ hours, minutes, seconds, label });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [windowStatus]);

  // ===========================================
  // SELECTION HANDLERS
  // ===========================================

  const handleSelectDrop = useCallback((asset) => {
    if (!canSubmit) return;

    // Toggle deselection
    if (selectedDrop?.symbol === asset.symbol) {
      setSelectedDrop(null);
      return;
    }

    setSelectedDrop(asset);
    setSelectedCategory(asset.category);

    // Clear mismatched add selection
    if (selectedAdd && selectedAdd.category !== asset.category) {
      setSelectedAdd(null);
    }

    // If both now selected, show confirm
    if (selectedAdd && selectedAdd.category === asset.category) {
      setShowConfirmModal(true);
    }
  }, [canSubmit, selectedDrop, selectedAdd]);

  const handleSelectAdd = useCallback((asset) => {
    if (!canSubmit) return;

    // Toggle deselection
    if (selectedAdd?.symbol === asset.symbol) {
      setSelectedAdd(null);
      return;
    }

    setSelectedAdd(asset);
    setSelectedCategory(asset.category);

    // Clear mismatched drop selection
    if (selectedDrop && selectedDrop.category !== asset.category) {
      setSelectedDrop(null);
    }

    // If both now selected, show confirm
    if (selectedDrop && selectedDrop.category === asset.category) {
      setShowConfirmModal(true);
    }
  }, [canSubmit, selectedDrop, selectedAdd]);

  const handleCancelSelection = useCallback(() => {
    setSelectedDrop(null);
    setSelectedAdd(null);
    setShowConfirmModal(false);
  }, []);

  // ===========================================
  // CLAIM SUBMISSION
  // ===========================================

  const handleConfirmClaim = useCallback(async () => {
    if (!selectedDrop || !selectedAdd || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const rank = pendingClaims.length + 1;

      await claimService.submitClaim(
        draftId,
        currentUserId,
        user?.odUsername || user?.displayName || 'Player',
        selectedDrop.symbol,
        selectedAdd.symbol,
        selectedDrop.category,
        rank
      );

      setSubmitSuccess({
        dropSymbol: selectedDrop.symbol,
        addSymbol: selectedAdd.symbol,
      });

      // Clear selections
      setSelectedDrop(null);
      setSelectedAdd(null);
      setShowConfirmModal(false);

      // Reload data
      await loadData();

      // Auto-dismiss success after 3s
      setTimeout(() => setSubmitSuccess(null), 3000);

    } catch (err) {
      logger.error('[ClaimFA] Submit claim failed:', err);
      setSubmitError(err.message || 'Failed to submit claim');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDrop, selectedAdd, isSubmitting, pendingClaims.length, draftId, currentUserId, user, loadData, logger]);

  // ===========================================
  // CLAIM CANCELLATION
  // ===========================================

  const handleCancelClaim = useCallback(async (claimId) => {
    try {
      await claimService.cancelClaim(draftId, claimId, currentUserId);
      // Real-time subscription will update allClaims automatically
    } catch (err) {
      logger.error('[ClaimFA] Cancel claim failed:', err);
      setSubmitError(err.message || 'Failed to cancel claim');
    }
  }, [draftId, currentUserId, logger]);

  // ===========================================
  // NAVIGATION
  // ===========================================

  const handleBack = useCallback(() => {
    setScreen('draftBattle');
  }, [setScreen]);

  // ===========================================
  // RETURN
  // ===========================================

  return {
    // Data
    freeAgents,
    playerRoster: enrichedRoster,
    filteredFreeAgents,
    allClaims,
    pendingClaims,
    claimResults,
    waiverPriority,
    livePrices,
    portfolioType,
    currentUserId,

    // Window
    windowStatus,
    countdown,

    // Selection
    selectedDrop,
    selectedAdd,
    selectedCategory,
    activeCategory,
    showConfirmModal,
    canSubmit,
    claimsRemaining,
    userPriorityPosition,

    // Processing
    latestProcessingLog,

    // UI state
    loading,
    error,
    isSubmitting,
    submitSuccess,
    submitError,

    // Handlers
    handleSelectDrop,
    handleSelectAdd,
    handleCancelSelection,
    handleConfirmClaim,
    handleCancelClaim,
    handleBack,
    loadData,

    // Setters
    setSelectedCategory,
    setShowConfirmModal,
    setSubmitSuccess,
    setSubmitError,
  };
};

export default useClaimsFreeAgency;
