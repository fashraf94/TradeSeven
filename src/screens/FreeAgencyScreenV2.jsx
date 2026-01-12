import React, { useState, useEffect } from 'react';
import { useSwapLogic, FreeAgencyMobile, FreeAgencyDesktop } from '../components/freeAgency';
import { HOLO_COLORS, HOLO_BACKGROUND, HOLO_ANIMATIONS } from '../constants/holoTheme';

/**
 * FreeAgencyScreenV2 - Entry point for redesigned Free Agency
 *
 * Phase F3: Mobile + Desktop Layouts Complete
 * - Responsive layout detection (mobile vs desktop)
 * - Shared business logic hook powers both layouts
 * - Mobile layout for screens < 768px
 * - Desktop layout for screens >= 768px
 */
const FreeAgencyScreenV2 = ({
  containerStyle,
  currentDraft,
  user,
  setScreen,
  logger = console,
}) => {
  // Breakpoint: 768px for mobile/desktop switch
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

  // Shared logic hook - powers both layouts
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

  // Props for layout components
  const layoutProps = {
    containerStyle,
    currentDraft,
    user,
    ...swapLogic,
  };

  // Route to appropriate layout based on screen width
  return isMobile
    ? <FreeAgencyMobile {...layoutProps} />
    : <FreeAgencyDesktop {...layoutProps} />;
};

export default FreeAgencyScreenV2;
