import React from 'react';
import { HOLO_COLORS, HOLO_BACKGROUND } from '../../constants/holoTheme';
import WindowStatus from './shared/WindowStatus';
import SwapsRemaining from './shared/SwapsRemaining';
import RosterGrid from './shared/RosterGrid';
import FreeAgentGridDesktop from './shared/FreeAgentGridDesktop';
import SwapPanelDesktop from './shared/SwapPanelDesktop';
import SwapHistory from './shared/SwapHistory';
import SwapConfirmModal from './shared/SwapConfirmModal';

/**
 * FreeAgencyDesktop - Desktop-optimized layout for Free Agency
 *
 * Features:
 * - Two-column layout (roster/swap left, marketplace right)
 * - 3x3 roster grid organized by category
 * - 2-column free agent marketplace
 * - Side panel for swap preview (not fixed bottom bar)
 * - Swap history visible alongside roster
 */
const FreeAgencyDesktop = ({
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
  error,
  isSwapping,
  swapSuccess,
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
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(10, 14, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        padding: '16px 24px',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left: Back + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={handleBack}
              style={{
                background: 'none',
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: '8px',
                color: HOLO_COLORS.textSecondary,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              ← Back to Battle
            </button>

            <div>
              <h1 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 700,
                color: HOLO_COLORS.purple,
                textShadow: `0 0 15px ${HOLO_COLORS.purple}66`,
              }}>
                Free Agency Marketplace
              </h1>
            </div>
          </div>

          {/* Right: Swaps Remaining */}
          <SwapsRemaining count={swapsRemaining} isWindowOpen={isWindowOpen} />
        </div>
      </header>

      {/* Window Status Banner */}
      <div style={{
        padding: '12px 24px',
        background: HOLO_COLORS.bgCard,
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <WindowStatus
            isOpen={isWindowOpen}
            timeInfo={timeInfo}
            portfolioType={portfolioType}
          />
        </div>
      </div>

      {/* Success/Error Messages */}
      {(swapSuccess || error) && (
        <div style={{
          padding: '12px 24px',
          background: swapSuccess ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 51, 102, 0.1)',
          borderBottom: `1px solid ${swapSuccess ? HOLO_COLORS.green : HOLO_COLORS.red}44`,
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            textAlign: 'center',
            color: swapSuccess ? HOLO_COLORS.green : HOLO_COLORS.red,
            fontWeight: 600,
          }}>
            {swapSuccess
              ? `✓ Successfully swapped ${swapSuccess.dropped.symbol} → ${swapSuccess.added.symbol}`
              : error
            }
          </div>
        </div>
      )}

      {/* Main Content - Two Column Layout */}
      <main style={{
        flex: 1,
        padding: '24px',
        overflowY: 'auto',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: '24px',
          minHeight: 'calc(100vh - 200px)',
        }}>
          {/* Left Column: Roster + Swap Panel + History */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}>
            {/* Roster Section */}
            <div style={{
              background: HOLO_COLORS.bgCard,
              border: `1px solid ${HOLO_COLORS.borderSubtle}`,
              borderRadius: '12px',
              padding: '20px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                color: HOLO_COLORS.textPrimary,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                Your Roster
                <span style={{
                  fontSize: '11px',
                  color: HOLO_COLORS.textMuted,
                  fontWeight: 400,
                }}>
                  (Select to drop)
                </span>
              </div>

              <RosterGrid
                roster={playerRoster}
                selectedDrop={selectedDrop}
                onSelectDrop={handleSelectDrop}
                canSwap={canSwap}
              />
            </div>

            {/* Swap Panel */}
            <SwapPanelDesktop
              selectedDrop={selectedDrop}
              selectedAdd={selectedAdd}
              onCancel={handleCancelSelection}
              onConfirm={() => setShowConfirmModal(true)}
              swapsRemaining={swapsRemaining}
              isSwapping={isSwapping}
            />

            {/* Swap History */}
            {swapHistory && swapHistory.length > 0 && (
              <div style={{
                background: HOLO_COLORS.bgCard,
                border: `1px solid ${HOLO_COLORS.borderSubtle}`,
                borderRadius: '12px',
                padding: '20px',
                flex: 1,
                minHeight: '150px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}>
                <SwapHistory
                  history={swapHistory}
                  currentUserId={currentUserId}
                />
              </div>
            )}
          </div>

          {/* Right Column: Free Agent Marketplace */}
          <div style={{
            background: HOLO_COLORS.bgCard,
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '500px',
          }}>
            <FreeAgentGridDesktop
              freeAgents={freeAgents}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              selectedDrop={selectedDrop}
              onSelectAdd={handleSelectAdd}
              canSwap={canSwap}
            />
          </div>
        </div>
      </main>

      {/* Confirmation Modal (same as mobile) */}
      <SwapConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSwap}
        selectedDrop={selectedDrop}
        selectedAdd={selectedAdd}
        swapsRemaining={swapsRemaining}
        isSwapping={isSwapping}
      />
    </div>
  );
};

export default FreeAgencyDesktop;
