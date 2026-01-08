// /src/screens/TrainingTDScreen.jsx

import React, { Suspense } from 'react';
import { useUser } from '../contexts/UserContext';

/**
 * TrainingTDScreen - BaggerBomb training mode portfolio builder
 * Extracted from App.jsx Phase 6
 *
 * This is a wrapper that renders the PortfolioBuilderBaggerBomb component
 * with training mode enabled (vs CPU)
 */
const TrainingTDScreen = ({
  onBack,
  onBattleCreated,
  stocksData = [],
  cryptoData = [],
  containerStyle,
  isDesktop,
  DesktopBackground,
  PortfolioBuilderBaggerBomb,
  LoadingFallback,
  // Training battle functions
  handleCreateBaggerBombTrainingBattle,
  setScreen,
  setBuilderMode,
  setTrainingBattleType
}) => {
  const { user } = useUser();

  const handleSubmit = async (portfolioData) => {
    // Create BaggerBomb training battle against CPU
    await handleCreateBaggerBombTrainingBattle?.(portfolioData);
    onBattleCreated?.();
  };

  const handleBack = () => {
    onBack?.();
    setBuilderMode?.('create');
    setTrainingBattleType?.('classic');
  };

  return (
    <div style={containerStyle}>
      {isDesktop && DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

      <div style={{ minHeight: '100vh', background: '#0d1117', position: 'relative', zIndex: 1 }}>
        {/* Training Mode Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>🤖</span>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
            Training Mode • BaggerBomb vs CPU
          </span>
        </div>

        <Suspense fallback={LoadingFallback ? <LoadingFallback /> : <div style={{ padding: '48px', textAlign: 'center', color: '#8b949e' }}>Loading...</div>}>
          {PortfolioBuilderBaggerBomb && (
            <PortfolioBuilderBaggerBomb
              user={user}
              stockPrices={stocksData.reduce((acc, s) => {
                acc[s.symbol] = { price: s.price, percentChange: s.percentChange };
                return acc;
              }, {})}
              cryptoPrices={cryptoData.reduce((acc, c) => {
                acc[c.symbol] = { price: c.price, percentChange: c.percentChange };
                return acc;
              }, {})}
              thresholds={{}}
              onSubmit={handleSubmit}
              onBack={handleBack}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default TrainingTDScreen;
