// /src/screens/TDBuilderScreen.jsx

import React, { Suspense } from 'react';
import { useUser } from '../contexts/UserContext';

/**
 * TDBuilderScreen - BaggerBomb portfolio builder
 * Extracted from App.jsx Phase 6
 *
 * This is a wrapper that renders the PortfolioBuilderBaggerBomb component
 */
const TDBuilderScreen = ({
  onBack,
  onBattleCreated,
  stocksData = [],
  cryptoData = [],
  containerStyle,
  isDesktop,
  DesktopBackground,
  PortfolioBuilderBaggerBomb,
  LoadingFallback,
  // Battle creation functions
  createBaggerBombBattle,
  generateChallengeCode,
  setBattles,
  battles,
  saveBattlesSafe,
  setActiveBattleId,
  setScreen,
  setBattleScoringMode,
  debugBattles
}) => {
  const { user } = useUser();

  const handleSubmit = async (portfolioData) => {
    // Create BaggerBomb battle in Firestore using V2 schema
    const challengeCode = generateChallengeCode?.() || Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      console.log('🔥 Creating BaggerBomb Battle in Firestore...', portfolioData);

      // Portfolio assets - sanitize with strict type coercion
      const portfolioAssets = (portfolioData.roster || [])
        .filter(asset => asset && asset.symbol)
        .map(asset => ({
          symbol: String(asset.symbol || '').toUpperCase(),
          name: String(asset.name || asset.symbol || ''),
          price: Number(asset.price) || 0,
          amount: Number(asset.amount) || 0,
          position: String(asset.position || 'long')
        }));

      // Bench assets - sanitize with strict type coercion
      const benchAssets = (portfolioData.bench || [])
        .filter(asset => asset && asset.symbol)
        .map(asset => ({
          symbol: String(asset.symbol || '').toUpperCase(),
          name: String(asset.name || asset.symbol || ''),
          price: Number(asset.price) || 0,
          amount: 0,
          position: 'long'
        }));

      // Validate - no empty arrays allowed
      if (portfolioAssets.length === 0) {
        console.error('No portfolio assets provided');
        alert('Please add stocks and crypto to your portfolio');
        return;
      }

      console.log('📤 Sanitized data:', { portfolioAssets, benchAssets });

      // Use createBaggerBombBattle for V2 BaggerBomb Scoring battles
      const firestoreBattle = await createBaggerBombBattle?.({
        challengeCode,
        creator: {
          uid: String(user?.odUserId || user?.username || 'anonymous'),
          username: String(user?.username || 'Player')
        },
        portfolioName: String(portfolioData.portfolioName || 'BaggerBomb Portfolio').trim(),
        portfolioType: 'stocks',
        creatorPortfolio: portfolioAssets,
        creatorBench: benchAssets
      });

      console.log('✅ BaggerBomb Battle created with ID:', firestoreBattle?.id);

      // Create local battle object
      const newBattle = {
        id: firestoreBattle?.id,
        challengeCode: firestoreBattle?.challengeCode || challengeCode,
        creator: user?.username,
        creatorPortfolio: portfolioAssets,
        bench: benchAssets,
        portfolioName: portfolioData.portfolioName || 'BaggerBomb Portfolio',
        portfolioType: 'baggerbomb',
        _v: 2,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        firestoreId: firestoreBattle?.id
      };

      // Update state
      debugBattles?.('Before BaggerBomb battle creation', battles);
      setBattles?.(prevBattles => {
        const exists = prevBattles.some(b =>
          b.id === newBattle.id || b.firestoreId === newBattle.id
        );
        if (exists) {
          console.log('⚠️ BaggerBomb Battle already exists, skipping add');
          return prevBattles;
        }
        const updatedBattles = [...prevBattles, newBattle];
        debugBattles?.('After BaggerBomb battle creation', updatedBattles);
        saveBattlesSafe?.(updatedBattles);
        return updatedBattles;
      });
      setActiveBattleId?.(newBattle.id);
      setScreen?.('dashboard');
      onBattleCreated?.(newBattle);
    } catch (error) {
      console.error('❌ Failed to create BaggerBomb battle:', error);
      alert(`Failed to create BaggerBomb battle: ${error.message}`);
    }
  };

  const handleBack = () => {
    onBack?.();
    setBattleScoringMode?.('classic');
  };

  return (
    <div style={containerStyle}>
      {isDesktop && DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

      <div style={{ minHeight: '100vh', background: '#0d1117', position: 'relative', zIndex: 1 }}>
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

export default TDBuilderScreen;
