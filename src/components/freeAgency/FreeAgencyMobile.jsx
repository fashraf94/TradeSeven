import React, { useState } from 'react';
import { HOLO_COLORS, HOLO_BACKGROUND, HOLO_ANIMATIONS } from '../../constants/holoTheme';
import WindowStatus from './shared/WindowStatus';
import SwapsRemaining from './shared/SwapsRemaining';
import RosterSection from './shared/RosterSection';
import FreeAgentGrid from './shared/FreeAgentGrid';
import SwapPreview from './shared/SwapPreview';
import SwapHistory from './shared/SwapHistory';
import SwapConfirmModal from './shared/SwapConfirmModal';
import FreeAgencyLoadingSkeleton from './shared/FreeAgencyLoadingSkeleton';
import FreeAgencyErrorState from './shared/FreeAgencyErrorState';
import SwapSuccessToast from './shared/SwapSuccessToast';
import { AssetResearchModal } from '../draft';

/**
 * FreeAgencyMobile - Mobile-optimized layout for Free Agency
 *
 * BIDIRECTIONAL FLOW: Users can start swap from either direction:
 * - Select a roster asset to drop first, then pick a free agent to add
 * - OR select a free agent to add first, then pick a roster asset to drop
 *
 * Layout (top to bottom):
 * - Header with back button and swaps remaining badge
 * - Window status indicator
 * - Guidance text (dynamic based on selection state)
 * - Roster section (user's assets - always active)
 * - Free agent grid (available players - always active)
 * - Swap history feed
 * - Swap preview bar (fixed bottom - shows when any selection made)
 * - Confirmation modal
 *
 * Features:
 * - Category locking (when one is selected, other filters to match)
 * - Loading skeleton and error states
 * - Success toast notification
 */
const FreeAgencyMobile = ({
  containerStyle,
  // From useSwapLogic
  freeAgents,
  playerRoster,
  swapHistory,
  swapsRemaining,
  isWindowOpen,
  timeInfo,
  portfolioType,
  currentUserId,
  loading,
  error,
  isSwapping,
  swapSuccess,
  setSwapSuccess,
  swapError,
  selectedDrop,
  selectedAdd,
  selectedCategory,
  setSelectedCategory,
  selectionOrder,
  activeCategory,
  canSwap,
  showConfirmModal,
  setShowConfirmModal,
  handleSelectDrop,
  handleSelectAdd,
  handleCancelSelection,
  handleConfirmSwap,
  handleBack,
  loadData,
  livePrices = {},
}) => {
  // State for asset research modal
  const [assetForResearch, setAssetForResearch] = useState(null);

  // Dynamic guidance text based on selection state
  const getGuidanceText = () => {
    if (!selectedAdd && !selectedDrop) {
      return "Select a stock from your roster to drop, or a free agent to add";
    }
    if (selectedDrop && !selectedAdd) {
      return `Now select a ${selectedDrop.category} free agent to add`;
    }
    if (selectedAdd && !selectedDrop) {
      return `Now select a ${selectedAdd.category} stock to drop`;
    }
    return null; // Both selected, SwapPreview handles it
  };

  // Show loading skeleton
  if (loading) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
      }}>
        {/* Header placeholder */}
        <div style={{
          background: 'rgba(10, 14, 20, 0.95)',
          padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: HOLO_COLORS.purple,
            textShadow: `0 0 10px ${HOLO_COLORS.purple}66`,
          }}>
            Free Agency
          </div>
        </div>
        <FreeAgencyLoadingSkeleton isMobile={true} />
      </div>
    );
  }

  // Show error state (but not for swap errors - those show inline)
  if (error && !swapError) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
      }}>
        <FreeAgencyErrorState
          message={error}
          onRetry={loadData}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div style={{
      ...containerStyle,
      minHeight: '100vh',
      background: HOLO_BACKGROUND,
      color: HOLO_COLORS.textPrimary,
    }}>
      <style>{HOLO_ANIMATIONS}</style>

      {/* Success Toast */}
      <SwapSuccessToast
        swapSuccess={swapSuccess}
        onDismiss={() => setSwapSuccess && setSwapSuccess(null)}
      />

      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(10, 14, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Back Button */}
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: HOLO_COLORS.textSecondary,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ←
          </button>

          {/* Title */}
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: HOLO_COLORS.purple,
            textShadow: `0 0 10px ${HOLO_COLORS.purple}66`,
          }}>
            Free Agency
          </div>

          {/* Swaps Badge */}
          <SwapsRemaining count={swapsRemaining} isWindowOpen={isWindowOpen} />
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        padding: '16px',
        paddingBottom: (selectedAdd || selectedDrop) ? '180px' : '100px', // Extra space for SwapPreview
        overflowX: 'hidden',
      }}>
        {/* Window Status */}
        <div style={{ marginBottom: '16px' }}>
          <WindowStatus
            isOpen={isWindowOpen}
            timeInfo={timeInfo}
            portfolioType={portfolioType}
          />
        </div>

        {/* Swap Error Message */}
        {swapError && (
          <div style={{
            padding: '12px',
            background: 'rgba(255, 51, 102, 0.15)',
            border: `1px solid ${HOLO_COLORS.red}`,
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '13px',
          }}>
            <span style={{ color: HOLO_COLORS.red }}>⚠️ {swapError}</span>
          </div>
        )}

        {/* Guidance Text - show when swap is allowed and incomplete */}
        {canSwap && getGuidanceText() && (
          <div style={{
            padding: '10px 12px',
            background: `${HOLO_COLORS.purple}11`,
            border: `1px solid ${HOLO_COLORS.purple}33`,
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
            fontSize: '11px',
            color: HOLO_COLORS.purple,
          }}>
            {getGuidanceText()}
          </div>
        )}

        {/* Roster Section - Your Roster (now at top) */}
        <RosterSection
          roster={playerRoster}
          selectedDrop={selectedDrop}
          selectedAdd={selectedAdd}
          activeCategory={activeCategory}
          onSelectDrop={handleSelectDrop}
          onMoreInfo={(asset) => setAssetForResearch(asset)}
          canSwap={canSwap}
        />

        {/* Free Agent Grid - Free Agents */}
        <FreeAgentGrid
          freeAgents={freeAgents}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedAdd={selectedAdd}
          selectedDrop={selectedDrop}
          activeCategory={activeCategory}
          onSelectAdd={handleSelectAdd}
          onMoreInfo={(asset) => setAssetForResearch(asset)}
          canSwap={canSwap}
        />

        {/* Swap History */}
        <SwapHistory
          history={swapHistory}
          currentUserId={currentUserId}
        />
      </main>

      {/* Swap Preview Bar (shows when any selection made) */}
      <SwapPreview
        selectedAdd={selectedAdd}
        selectedDrop={selectedDrop}
        onCancel={handleCancelSelection}
        onConfirm={() => setShowConfirmModal(true)}
        swapsRemaining={swapsRemaining}
        isSwapping={isSwapping}
      />

      {/* Confirmation Modal */}
      <SwapConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSwap}
        selectedDrop={selectedDrop}
        selectedAdd={selectedAdd}
        swapsRemaining={swapsRemaining}
        isSwapping={isSwapping}
      />

      {/* Asset Research Modal */}
      {assetForResearch && (
        <AssetResearchModal
          asset={{
            symbol: assetForResearch.symbol,
            name: assetForResearch.name || assetForResearch.symbol,
            price: livePrices[assetForResearch.symbol?.toUpperCase()]?.price
              || assetForResearch.price || 0,
            percentChange: livePrices[assetForResearch.symbol?.toUpperCase()]?.percentChange
              || assetForResearch.percentChange || 0,
            sector: assetForResearch.sector,
          }}
          sector={assetForResearch.sector}
          category={assetForResearch.category}
          onClose={() => setAssetForResearch(null)}
          showActionButton={true}
          actionConfig={
            // Show "Select" button if this is a free agent and swap is allowed
            canSwap && !selectedAdd?.symbol
              ? {
                  label: `Select ${assetForResearch.symbol}`,
                  onClick: () => {
                    handleSelectAdd(assetForResearch);
                    setAssetForResearch(null);
                  },
                  variant: 'primary',
                  disabled: false,
                }
              : null
          }
        />
      )}
    </div>
  );
};

export default FreeAgencyMobile;
