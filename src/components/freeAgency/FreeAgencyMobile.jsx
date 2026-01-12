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
 * Features:
 * - Header with back button and swaps remaining badge
 * - Window status indicator
 * - Horizontal scrolling roster section
 * - Category-filtered free agent grid
 * - Swap preview bar (fixed bottom)
 * - Confirmation modal
 * - Swap history feed
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
  canSwap,
  showConfirmModal,
  setShowConfirmModal,
  handleSelectDrop,
  handleSelectAdd,
  handleCancelSelection,
  handleConfirmSwap,
  handleBack,
  loadData,
}) => {
  // State for asset research modal
  const [assetForResearch, setAssetForResearch] = useState(null);

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
        paddingBottom: selectedAdd ? '180px' : '100px', // Extra space for SwapPreview
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

        {/* Free Agent Grid - Step 1: Select to Add */}
        <FreeAgentGrid
          freeAgents={freeAgents}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedAdd={selectedAdd}
          onSelectAdd={handleSelectAdd}
          onMoreInfo={(asset) => setAssetForResearch(asset)}
          canSwap={canSwap}
        />

        {/* Roster Section - Step 2: Select to Drop */}
        <RosterSection
          roster={playerRoster}
          selectedDrop={selectedDrop}
          selectedAdd={selectedAdd}
          onSelectDrop={handleSelectDrop}
          onMoreInfo={(asset) => setAssetForResearch(asset)}
          canSwap={canSwap}
        />

        {/* Swap History */}
        <SwapHistory
          history={swapHistory}
          currentUserId={currentUserId}
        />
      </main>

      {/* Swap Preview Bar (shows when free agent selected) */}
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
            // Try multiple possible price fields
            price: assetForResearch.price
              || assetForResearch.currentPrice
              || assetForResearch.close
              || assetForResearch.lastPrice
              || 0,
            percentChange: assetForResearch.priceChange
              || assetForResearch.percentChange
              || assetForResearch.change
              || assetForResearch.gain
              || 0,
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
