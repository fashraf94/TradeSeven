// /src/screens/JoinTDScreen.jsx

import React, { Suspense } from 'react';
import { useUser } from '../contexts/UserContext';

/**
 * JoinTDScreen - Join BaggerBomb battle with portfolio builder
 * Extracted from App.jsx Phase 6
 *
 * This is a wrapper that renders the PortfolioBuilderBaggerBomb component
 * with join mode enabled
 */
const JoinTDScreen = ({
  onBack,
  onJoinSuccess,
  joinCode = '',
  stocksData = [],
  cryptoData = [],
  containerStyle,
  isDesktop,
  DesktopBackground,
  PortfolioBuilderBaggerBomb,
  LoadingFallback,
  // Battle join functions
  joinBaggerBombBattle,
  setBattles,
  battles,
  saveBattlesSafe,
  setCurrentBattle,
  setScreen,
  setJoinCode,
  setJoinBattleType
}) => {
  const { user } = useUser();

  const handleSubmit = async (portfolioData) => {
    try {
      // PortfolioBuilderBaggerBomb uses 'roster' not 'portfolio'
      const portfolio = portfolioData.roster || portfolioData.portfolio || [];
      const bench = portfolioData.bench || [];

      if (!Array.isArray(portfolio) || portfolio.length === 0) {
        alert('Please build your portfolio before joining.');
        return;
      }

      // CRITICAL: Firebase does NOT allow undefined values
      const odUserId = user?.odUserId || user?.uid || user?.email || 'anonymous';
      const opponentData = {
        odUserId: odUserId,
        uid: odUserId,
        username: user?.username || user?.email?.split('@')[0] || 'Player',
        odUsername: user?.username || user?.email?.split('@')[0] || 'Player',
        portfolioName: portfolioData.portfolioName || 'Portfolio',
        portfolio: portfolio,
        bench: bench,
        portfolioType: 'baggerbomb',
        allocations: portfolioData.allocations || {}
      };

      console.log('🎮 Join BaggerBomb with data:', {
        portfolioLength: portfolio.length,
        benchLength: bench.length,
        opponentData
      });

      const joinedBattle = await joinBaggerBombBattle?.(joinCode, opponentData);

      if (joinedBattle) {
        // Add to local battles list
        const updatedBattles = [...(battles || []), joinedBattle];
        setBattles?.(updatedBattles);
        saveBattlesSafe?.(updatedBattles);

        // Navigate to battle view
        setCurrentBattle?.(joinedBattle);
        setScreen?.('battle');
        setJoinCode?.('');
        setJoinBattleType?.('classic');
        onJoinSuccess?.(joinedBattle);
      } else {
        alert('Could not find a battle with that code. Make sure the code is correct and the battle hasn\'t started yet.');
      }
    } catch (error) {
      console.error('Error joining BaggerBomb battle:', error);
      alert('Error joining battle: ' + (error.message || 'Unknown error'));
    }
  };

  const handleBack = () => {
    onBack?.();
    setJoinBattleType?.('classic');
  };

  return (
    <div style={containerStyle}>
      {isDesktop && DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

      <div style={{ minHeight: '100vh', background: '#0d1117', position: 'relative', zIndex: 1 }}>
        {/* Join Mode Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>💣</span>
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>
            Join BaggerBomb Battle • Code: {joinCode}
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

export default JoinTDScreen;
