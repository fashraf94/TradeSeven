import React, { useState, useEffect } from 'react';
import {
  useSwapLogic,
  WindowStatus,
  SwapsRemaining,
  CategoryTabs,
} from '../components/freeAgency';
import { HOLO_COLORS, HOLO_BACKGROUND, HOLO_ANIMATIONS } from '../constants/holoTheme';

/**
 * FreeAgencyScreenV2 - Entry point for redesigned Free Agency
 *
 * Phase F1: Foundation
 * - Responsive layout detection (mobile vs desktop)
 * - Shared business logic hook
 * - Debug info display for verification
 *
 * Future phases will replace the placeholder with:
 * - FreeAgencyMobile (Phase F2)
 * - FreeAgencyDesktop (Phase F3)
 */
const FreeAgencyScreenV2 = ({
  containerStyle,
  currentDraft,
  user,
  setScreen,
  logger = console,
}) => {
  // Detect mobile vs desktop
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigation handler - goes back to DraftBattleScreen
  const handleBack = () => {
    setScreen('draftBattle');
  };

  // Initialize shared logic hook
  const swapLogic = useSwapLogic({
    currentDraft,
    user,
    onBack: handleBack,
    logger,
  });

  // Loading state
  if (swapLogic.loading) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: HOLO_COLORS.textSecondary,
      }}>
        <style>{HOLO_ANIMATIONS}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: `3px solid ${HOLO_COLORS.borderSubtle}`,
            borderTop: `3px solid ${HOLO_COLORS.cyan}`,
            borderRadius: '50%',
            animation: 'holoSpin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div>Loading Free Agency...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (swapLogic.error) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: HOLO_COLORS.red,
        padding: '20px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '18px', marginBottom: '12px' }}>
            Failed to load Free Agency
          </div>
          <div style={{ fontSize: '14px', color: HOLO_COLORS.textSecondary, marginBottom: '20px' }}>
            {swapLogic.error}
          </div>
          <button
            onClick={swapLogic.loadData}
            style={{
              padding: '10px 20px',
              background: 'rgba(0, 255, 255, 0.1)',
              border: `1px solid ${HOLO_COLORS.cyan}`,
              borderRadius: '8px',
              color: HOLO_COLORS.cyan,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Free agent counts for CategoryTabs
  const freeAgentCounts = {
    steady: swapLogic.freeAgents.steady?.length || 0,
    risky: swapLogic.freeAgents.risky?.length || 0,
    defensive: swapLogic.freeAgents.defensive?.length || 0,
  };

  // Temporary Phase F1 placeholder - shows debug info to verify hook is working
  return (
    <div style={{
      ...containerStyle,
      minHeight: '100vh',
      background: HOLO_BACKGROUND,
      color: HOLO_COLORS.textPrimary,
    }}>
      <style>{HOLO_ANIMATIONS}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: HOLO_COLORS.bgElevated,
      }}>
        <button
          onClick={handleBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: HOLO_COLORS.cyan,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '18px' }}>&#8592;</span> Back
        </button>

        <h1 style={{
          fontSize: '18px',
          fontWeight: 700,
          color: HOLO_COLORS.cyan,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Free Agency V2
        </h1>

        <SwapsRemaining
          count={swapLogic.swapsRemaining}
          isWindowOpen={swapLogic.isWindowOpen}
        />
      </div>

      {/* Content */}
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        {/* Layout indicator */}
        <div style={{
          padding: '12px 16px',
          background: `${HOLO_COLORS.cyan}15`,
          border: `1px solid ${HOLO_COLORS.cyan}44`,
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: HOLO_COLORS.cyan,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {isMobile ? 'Mobile Layout' : 'Desktop Layout'} - Phase F1 Foundation Complete
          </span>
        </div>

        {/* Window Status */}
        <div style={{ marginBottom: '16px' }}>
          <WindowStatus
            isOpen={swapLogic.isWindowOpen}
            timeInfo={swapLogic.timeInfo}
            portfolioType={swapLogic.portfolioType}
          />
        </div>

        {/* Category Tabs */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: HOLO_COLORS.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}>
            Free Agent Categories
          </div>
          <CategoryTabs
            selectedCategory={swapLogic.selectedCategory}
            onSelectCategory={swapLogic.setSelectedCategory}
            counts={freeAgentCounts}
            disabled={!swapLogic.canSwap}
          />
        </div>

        {/* Debug Info Panel */}
        <div style={{
          background: HOLO_COLORS.bgCard,
          border: `1px solid ${HOLO_COLORS.borderSubtle}`,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            color: HOLO_COLORS.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
          }}>
            Hook Debug Info
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}>
            <DebugRow label="Window Open" value={swapLogic.isWindowOpen ? 'Yes' : 'No'} isGood={swapLogic.isWindowOpen} />
            <DebugRow label="Swaps Left" value={swapLogic.swapsRemaining} isGood={swapLogic.swapsRemaining > 0} />
            <DebugRow label="Portfolio" value={swapLogic.portfolioType} />
            <DebugRow label="Can Swap" value={swapLogic.canSwap ? 'Yes' : 'No'} isGood={swapLogic.canSwap} />
            <DebugRow label="Roster Count" value={swapLogic.allRosterAssets.length} />
            <DebugRow label="History Count" value={swapLogic.swapHistory.length} />
            <DebugRow label="Steady FAs" value={freeAgentCounts.steady} />
            <DebugRow label="Risky FAs" value={freeAgentCounts.risky} />
            <DebugRow label="Defensive FAs" value={freeAgentCounts.defensive} />
            <DebugRow label="User ID" value={swapLogic.currentUserId?.slice(0, 12) + '...' || 'N/A'} />
          </div>
        </div>

        {/* Roster Preview */}
        {swapLogic.allRosterAssets.length > 0 && (
          <div style={{
            background: HOLO_COLORS.bgCard,
            border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              color: HOLO_COLORS.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}>
              Your Roster ({swapLogic.allRosterAssets.length} assets)
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {swapLogic.allRosterAssets.map((asset) => (
                <div
                  key={asset.symbol}
                  style={{
                    padding: '6px 10px',
                    background: HOLO_COLORS.bgElevated,
                    border: `1px solid ${HOLO_COLORS[asset.category] || HOLO_COLORS.borderSubtle}44`,
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: HOLO_COLORS[asset.category] || HOLO_COLORS.textPrimary,
                  }}
                >
                  {asset.symbol}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={handleBack}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(0, 255, 255, 0.1)',
            border: `1px solid ${HOLO_COLORS.cyan}`,
            borderRadius: '8px',
            color: HOLO_COLORS.cyan,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          &#8592; Back to Battle
        </button>
      </div>
    </div>
  );

  // Once F2 and F3 are complete, replace above with:
  // return isMobile
  //   ? <FreeAgencyMobile {...layoutProps} />
  //   : <FreeAgencyDesktop {...layoutProps} />;
};

// Helper component for debug rows
const DebugRow = ({ label, value, isGood }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
  }}>
    <span style={{ color: HOLO_COLORS.textMuted }}>{label}:</span>
    <span style={{
      color: isGood === true ? HOLO_COLORS.green :
             isGood === false ? HOLO_COLORS.red :
             HOLO_COLORS.textPrimary,
      fontWeight: 600,
    }}>
      {value}
    </span>
  </div>
);

export default FreeAgencyScreenV2;
