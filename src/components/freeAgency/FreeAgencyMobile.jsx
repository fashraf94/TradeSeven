import React from 'react';
import { HOLO_COLORS, HOLO_BACKGROUND, HOLO_ANIMATIONS } from '../../constants/holoTheme';
import WindowStatus from './shared/WindowStatus';
import SwapsRemaining from './shared/SwapsRemaining';
import RosterSection from './shared/RosterSection';
import FreeAgentGrid from './shared/FreeAgentGrid';
import SwapPreview from './shared/SwapPreview';
import SwapHistory from './shared/SwapHistory';
import SwapConfirmModal from './shared/SwapConfirmModal';

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
}) => {

  return (
    <div style={{
      ...containerStyle,
      minHeight: '100vh',
      background: HOLO_BACKGROUND,
      color: HOLO_COLORS.textPrimary,
    }}>
      <style>{HOLO_ANIMATIONS}</style>

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
        paddingBottom: selectedDrop ? '180px' : '100px', // Extra space for SwapPreview
      }}>
        {/* Window Status */}
        <div style={{ marginBottom: '16px' }}>
          <WindowStatus
            isOpen={isWindowOpen}
            timeInfo={timeInfo}
            portfolioType={portfolioType}
          />
        </div>

        {/* Success Message */}
        {swapSuccess && (
          <div style={{
            padding: '12px',
            background: 'rgba(0, 255, 136, 0.15)',
            border: `1px solid ${HOLO_COLORS.green}`,
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
            animation: 'mobileSuccessFade 0.3s ease-out',
          }}>
            <span style={{ color: HOLO_COLORS.green, fontWeight: 600 }}>
              Swapped {swapSuccess.dropped.symbol} → {swapSuccess.added.symbol}
            </span>
          </div>
        )}

        {/* Error Message */}
        {(error || swapError) && (
          <div style={{
            padding: '12px',
            background: 'rgba(255, 51, 102, 0.15)',
            border: `1px solid ${HOLO_COLORS.red}`,
            borderRadius: '8px',
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            <span style={{ color: HOLO_COLORS.red }}>{error || swapError}</span>
          </div>
        )}

        {/* Roster Section - Select to Drop */}
        <RosterSection
          roster={playerRoster}
          selectedDrop={selectedDrop}
          onSelectDrop={handleSelectDrop}
          canSwap={canSwap}
        />

        {/* Free Agent Grid */}
        <FreeAgentGrid
          freeAgents={freeAgents}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          selectedDrop={selectedDrop}
          onSelectAdd={handleSelectAdd}
          canSwap={canSwap}
        />

        {/* Swap History */}
        <SwapHistory
          history={swapHistory}
          currentUserId={currentUserId}
        />
      </main>

      {/* Swap Preview Bar (shows when asset selected) */}
      <SwapPreview
        selectedDrop={selectedDrop}
        selectedAdd={selectedAdd}
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

      <style>{`
        @keyframes mobileSuccessFade {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default FreeAgencyMobile;
