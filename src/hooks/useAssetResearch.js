// useAssetResearch - Hook for managing asset research modal state
// Provides a consistent interface for opening research modals across components

import { useState, useCallback } from 'react';

/**
 * useAssetResearch - Hook for managing AssetResearchModal state
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.showActionButton - Show action button in modal (default: false)
 * @param {string} options.actionLabel - Label for action button (default: 'Add to Portfolio')
 * @param {Function} options.onAction - Callback when action button clicked
 * @param {Function} options.onOpen - Callback when modal opens
 * @param {Function} options.onClose - Callback when modal closes
 *
 * @returns {Object} Research modal state and controls
 *
 * @example
 * const { researchAsset, showResearch, hideResearch, isOpen, getModalProps } = useAssetResearch({
 *   showActionButton: true,
 *   actionLabel: 'Add to Portfolio',
 *   onAction: (asset) => handleAddAsset(asset),
 * });
 *
 * // In JSX:
 * <button onClick={() => showResearch(asset)}>Research</button>
 * {isOpen && <AssetResearchModal {...getModalProps()} />}
 */
export function useAssetResearch(options = {}) {
  const {
    showActionButton = false,
    actionLabel = 'Add to Portfolio',
    onAction = null,
    onOpen = null,
    onClose = null,
  } = options;

  const [researchAsset, setResearchAsset] = useState(null);

  /**
   * Open the research modal for an asset
   * @param {Object} asset - Asset to research
   */
  const showResearch = useCallback((asset) => {
    setResearchAsset(asset);
    if (onOpen) {
      onOpen(asset);
    }
  }, [onOpen]);

  /**
   * Close the research modal
   */
  const hideResearch = useCallback(() => {
    const closedAsset = researchAsset;
    setResearchAsset(null);
    if (onClose) {
      onClose(closedAsset);
    }
  }, [onClose, researchAsset]);

  /**
   * Handle action button click
   */
  const handleAction = useCallback(() => {
    if (onAction && researchAsset) {
      onAction(researchAsset);
    }
    hideResearch();
  }, [onAction, researchAsset, hideResearch]);

  /**
   * Get props to spread on AssetResearchModal
   * @param {Object} overrides - Optional prop overrides
   * @returns {Object} Modal props
   */
  const getModalProps = useCallback((overrides = {}) => {
    if (!researchAsset) return null;

    const baseProps = {
      asset: {
        symbol: researchAsset.symbol,
        name: researchAsset.name,
        price: researchAsset.price || researchAsset.currentPrice || 0,
        percentChange: researchAsset.percentChange || researchAsset.change || 0,
        threshold: researchAsset.baseATR || researchAsset.threshold || 0,
      },
      sector: researchAsset.sector,
      onClose: hideResearch,
      showActionButton,
    };

    // Add action config if action button is enabled
    if (showActionButton && onAction) {
      baseProps.actionConfig = {
        label: actionLabel,
        onClick: handleAction,
        variant: 'primary',
      };
    }

    return { ...baseProps, ...overrides };
  }, [researchAsset, hideResearch, showActionButton, actionLabel, handleAction, onAction]);

  return {
    // State
    researchAsset,           // Current asset being researched (or null)
    isOpen: !!researchAsset, // Boolean indicating if modal is open

    // Controls
    showResearch,            // Function to open modal with an asset
    hideResearch,            // Function to close modal

    // Helper
    getModalProps,           // Get props to spread on AssetResearchModal
  };
}

/**
 * useScoreBreakdown - Hook for managing score breakdown modal state
 *
 * @param {Object} options - Configuration options
 * @param {Function} options.onOpen - Callback when modal opens
 * @param {Function} options.onClose - Callback when modal closes
 *
 * @returns {Object} Breakdown modal state and controls
 */
export function useScoreBreakdown(options = {}) {
  const { onOpen = null, onClose = null } = options;

  const [breakdownAsset, setBreakdownAsset] = useState(null);

  const showBreakdown = useCallback((asset) => {
    setBreakdownAsset(asset);
    if (onOpen) {
      onOpen(asset);
    }
  }, [onOpen]);

  const hideBreakdown = useCallback(() => {
    const closedAsset = breakdownAsset;
    setBreakdownAsset(null);
    if (onClose) {
      onClose(closedAsset);
    }
  }, [onClose, breakdownAsset]);

  /**
   * Get props to spread on ScoreBreakdownPopover
   * @param {Object} overrides - Optional prop overrides
   * @returns {Object} Modal props
   */
  const getModalProps = useCallback((overrides = {}) => {
    if (!breakdownAsset) return null;

    return {
      asset: breakdownAsset,
      onClose: hideBreakdown,
      ...overrides,
    };
  }, [breakdownAsset, hideBreakdown]);

  return {
    breakdownAsset,
    isOpen: !!breakdownAsset,
    showBreakdown,
    hideBreakdown,
    getModalProps,
  };
}

/**
 * useCombinedResearch - Hook that combines both research and breakdown modals
 * Useful when both modals are used together
 *
 * @param {Object} options - Combined options for both hooks
 * @returns {Object} Combined state and controls
 */
export function useCombinedResearch(options = {}) {
  const research = useAssetResearch(options.research || {});
  const breakdown = useScoreBreakdown(options.breakdown || {});

  return {
    // Research modal
    researchAsset: research.researchAsset,
    isResearchOpen: research.isOpen,
    showResearch: research.showResearch,
    hideResearch: research.hideResearch,
    getResearchModalProps: research.getModalProps,

    // Breakdown modal
    breakdownAsset: breakdown.breakdownAsset,
    isBreakdownOpen: breakdown.isOpen,
    showBreakdown: breakdown.showBreakdown,
    hideBreakdown: breakdown.hideBreakdown,
    getBreakdownModalProps: breakdown.getModalProps,
  };
}
