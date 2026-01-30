import React, { Suspense } from 'react';
import DesktopBackground from '../components/DesktopBackground';

const BattleViewScreen = ({
  containerStyle,
  isDesktop,
  currentBattle,
  user,
  battlePrices,
  battleTimer,
  onBack,
  ActiveRiskChallengeIndicator,
  LoadingFallback,
  BaggerBombBattleViewRedesign,
  BaggerBombBattleViewConnected,
}) => {
  // Debug: Log battle routing decision
  console.log('🎮 BATTLE ROUTING DEBUG:', {
    screen: 'battle',
    hasBattle: !!currentBattle,
    battleVersion: currentBattle?._v,
    isTraining: currentBattle?.isTraining,
    hasCreatorObj: !!currentBattle?.creator,
    battleType: currentBattle?.portfolioType
  });

  // Check if this is a BaggerBomb (V2 or V3) battle - route to new connected view
  if (currentBattle._v === 2 || currentBattle._v === 3) {
    // Use the new connected component for non-training battles
    if (BaggerBombBattleViewConnected && currentBattle.id && !currentBattle.isTraining) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <BaggerBombBattleViewConnected
            battleId={currentBattle.id}
            userId={user?.odUserId || user?.username}
            onBack={onBack}
          />
        </Suspense>
      );
    }
    // Fall back to redesign view for training battles or when connected component is not available
    return (
      <Suspense fallback={<LoadingFallback />}>
        <BaggerBombBattleViewRedesign
          battle={currentBattle}
          user={user}
          onBack={onBack}
          isTraining={currentBattle.isTraining || false}
        />
      </Suspense>
    );
  }

  // Classic (V1) battle view continues below...
  const isCreator = currentBattle.creator === user.username;
  const opponent = isCreator ? currentBattle.opponent : currentBattle.creator;
  const myPortfolio = (isCreator ? currentBattle.creatorPortfolio : currentBattle.opponentPortfolio) || [];
  const theirPortfolio = (isCreator ? currentBattle.opponentPortfolio : currentBattle.creatorPortfolio) || [];

  // Calculate current values and gains
  let myValue = 0;
  (myPortfolio || []).forEach(asset => {
    if (!asset) return;
    const shares = asset.amount / asset.price;
    const currentPrice = battlePrices[asset.symbol] || asset.price;
    myValue += shares * currentPrice;
  });

  let theirValue = 0;
  (theirPortfolio || []).forEach(asset => {
    if (!asset) return;
    const shares = asset.amount / asset.price;
    const currentPrice = battlePrices[asset.symbol] || asset.price;
    theirValue += shares * currentPrice;
  });

  const myGain = ((myValue - 1000000) / 1000000) * 100;
  const theirGain = ((theirValue - 1000000) / 1000000) * 100;
  const isWinning = myGain > theirGain;
  const difference = Math.abs(myGain - theirGain);
  const valueDifference = Math.abs(myValue - theirValue);

  // Pre-calculate gain percentages for highlighting
  const myPortfolioWithGains = myPortfolio.map(asset => {
    const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
    const currentPrice = battlePrices[asset.symbol] || startingPrice;
    const gainPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
    return { ...asset, gainPercent };
  });

  const theirPortfolioWithGains = theirPortfolio.map(asset => {
    const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
    const currentPrice = battlePrices[asset.symbol] || startingPrice;
    const gainPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
    return { ...asset, gainPercent };
  });

  // Helper function to determine border highlighting for portfolio assets
  const getAssetBorderStyle = (portfolio, currentAsset) => {
    // Sort portfolio by gain percentage (descending)
    const sortedByGain = [...portfolio].sort((a, b) => {
      const gainA = a.gainPercent || 0;
      const gainB = b.gainPercent || 0;
      return gainB - gainA;
    });

    const currentGainPercent = currentAsset.gainPercent || 0;
    const currentIndex = sortedByGain.findIndex(a => a.symbol === currentAsset.symbol);

    // Separate positive and negative performers
    const positivePerformers = sortedByGain.filter(a => (a.gainPercent || 0) > 0);
    const negativePerformers = sortedByGain.filter(a => (a.gainPercent || 0) < 0);

    // TOP 3 WINNERS (Green) - Must be positive
    if (currentGainPercent > 0 && currentIndex < 3) {
      return {
        border: '3px solid #22c55e',
        boxShadow: '0 0 12px rgba(34, 197, 94, 0.3)',
        backgroundColor: 'rgba(34, 197, 94, 0.05)'
      };
    }

    // TOP 3 LOSERS (Red) - Must be negative
    if (currentGainPercent < 0 && currentIndex >= sortedByGain.length - 3) {
      return {
        border: '3px solid #ef4444',
        boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)'
      };
    }

    // BIGGEST LAGGARD (Orange) - Lowest positive gain
    if (positivePerformers.length > 0 && negativePerformers.length > 0) {
      const smallestPositiveGain = positivePerformers[positivePerformers.length - 1];
      if (currentAsset.symbol === smallestPositiveGain.symbol && currentGainPercent > 0) {
        return {
          border: '3px solid #ff8c00',
          boxShadow: '0 0 12px rgba(255, 140, 0, 0.3)',
          backgroundColor: 'rgba(255, 140, 0, 0.05)'
        };
      }
    }

    // DEFAULT - No highlighting
    return {
      border: '2px solid #21262d',
      boxShadow: 'none',
      backgroundColor: 'transparent'
    };
  };

  return (
    <div style={containerStyle}>
      {/* Animated Desktop Background */}
      <DesktopBackground isDesktop={isDesktop} />

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1
      }}>
        {/* COMPACT DARK HEADER */}
        <div style={{
          background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
          borderBottom: '2px solid #21262d',
          padding: '12px 16px',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{
            maxWidth: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            {/* Back Button */}
            <button
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#00d9ff',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '6px'
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>

            {/* Status and Score Diff */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: isWinning ? '#22c55e' : '#ef4444'
              }}>
                {isWinning ? 'LEADING' : 'TRAILING'}
              </span>
              <span style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: isWinning ? '#22c55e' : '#ef4444'
              }}>
                {isWinning ? '+' : '-'}{difference.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Time Remaining */}
          <div style={{
            textAlign: 'center',
            fontSize: '12px',
            color: '#8b949e',
            fontWeight: '500'
          }}>
            {battleTimer.formatTimeRemaining(currentBattle)} remaining
          </div>
        </div>

        {/* Training Battle Indicator */}
        {currentBattle.isTrainingBattle && (
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7C3AED 100%)',
            color: 'white',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontWeight: '600',
            fontSize: '13px'
          }}>
            <span>🎓</span>
            Training Battle • 1 Hour • Reduced XP
          </div>
        )}

        {/* ⭐ ACTIVE RISK CHALLENGE INDICATOR */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <ActiveRiskChallengeIndicator />
        </div>

        {/* COMPARISON CARD */}
        <div style={{ padding: '16px', backgroundColor: '#0d1117' }}>
          <div style={{
            background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
            border: '2px solid #21262d',
            borderRadius: '16px',
            padding: '20px 16px',
            marginBottom: '16px'
          }}>
            {/* Players Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              {/* YOU */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1
              }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  background: 'linear-gradient(135deg, #00d9ff 0%, #0099cc 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  border: '2px solid #00d9ff',
                  marginBottom: '8px'
                }}>
                  👤
                </div>
                <span style={{
                  fontSize: '11px',
                  color: '#8b949e',
                  fontWeight: '600'
                }}>
                  YOU
                </span>
              </div>

              {/* VS */}
              <div style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#6e7681',
                padding: '0 16px'
              }}>
                VS
              </div>

              {/* OPPONENT */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1
              }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  background: currentBattle.isTrainingBattle
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  border: `2px solid ${currentBattle.isTrainingBattle ? '#8b5cf6' : '#ef4444'}`,
                  marginBottom: '8px'
                }}>
                  {currentBattle.isTrainingBattle ? '🤖' : '👤'}
                </div>
                <span style={{
                  fontSize: '11px',
                  color: '#8b949e',
                  fontWeight: '600'
                }}>
                  {currentBattle.isTrainingBattle ? 'CPU' : 'OPP'}
                </span>
              </div>
            </div>

            {/* Scores Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <div style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: myGain >= 0 ? '#22c55e' : '#ef4444',
                flex: 1,
                textAlign: 'center'
              }}>
                {myGain >= 0 ? '+' : ''}{myGain.toFixed(2)}%
              </div>

              <div style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: theirGain >= 0 ? '#22c55e' : '#ef4444',
                flex: 1,
                textAlign: 'center'
              }}>
                {theirGain >= 0 ? '+' : ''}{theirGain.toFixed(2)}%
              </div>
            </div>

            {/* Visual Bar */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#21262d',
                borderRadius: '4px',
                overflow: 'hidden',
                display: 'flex'
              }}>
                <div style={{
                  height: '100%',
                  width: '50%',
                  background: isWinning
                    ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                    : '#21262d',
                  transition: 'all 0.3s ease'
                }} />
                <div style={{
                  height: '100%',
                  width: '50%',
                  background: !isWinning
                    ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'
                    : '#21262d',
                  transition: 'all 0.3s ease'
                }} />
              </div>

              {/* Leading By Text */}
              <div style={{
                textAlign: 'center',
                marginTop: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: isWinning ? '#22c55e' : '#ef4444'
              }}>
                {isWinning
                  ? `LEADING BY ${difference.toFixed(2)}%`
                  : `TRAILING BY ${difference.toFixed(2)}%`
                }
                {' '}
                <span style={{ color: '#8b949e' }}>
                  (${valueDifference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </div>
            </div>

            {/* Portfolio Values */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#8b949e',
                flex: 1,
                textAlign: 'center'
              }}>
                ${myValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              <div style={{
                fontSize: '14px',
                color: '#8b949e',
                flex: 1,
                textAlign: 'center'
              }}>
                ${theirValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE PORTFOLIOS */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '0 16px 24px 16px',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* YOUR PORTFOLIO */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0
          }}>
            {/* Header */}
            <div style={{
              backgroundColor: '#00d9ff',
              padding: '10px 12px',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '16px' }}>👤</span>
              <span style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#0d1117'
              }}>
                YOU
              </span>
            </div>

            {/* Portfolio List */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #21262d',
              borderTop: 'none',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px',
              overflow: 'auto',
              flex: 1,
              padding: '4px'
            }}>
              {myPortfolioWithGains.map((asset, index) => {
                const currentPrice = battlePrices[asset.symbol] || asset.price;
                const gainPercent = asset.gainPercent;
                const weight = (asset.amount / 1000000) * 100;
                const borderStyle = getAssetBorderStyle(myPortfolioWithGains, asset);

                return (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      marginBottom: '4px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      ...borderStyle
                    }}
                  >
                    {/* Symbol and Gain */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#ffffff'
                      }}>
                        {asset.symbol}
                      </span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: gainPercent >= 0 ? '#22c55e' : '#ef4444'
                      }}>
                        {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
                      </span>
                    </div>

                    {/* Allocation and Price */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        color: '#8b949e'
                      }}>
                        {weight.toFixed(1)}%
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#8b949e'
                      }}>
                        ${currentPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OPPONENT PORTFOLIO */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0
          }}>
            {/* Header */}
            <div style={{
              backgroundColor: currentBattle.isTrainingBattle ? '#8b5cf6' : '#ef4444',
              padding: '10px 12px',
              borderTopLeftRadius: '12px',
              borderTopRightRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '16px' }}>
                {currentBattle.isTrainingBattle ? '🤖' : '👤'}
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#ffffff'
              }}>
                {currentBattle.isTrainingBattle ? 'CPU' : 'OPP'}
              </span>
            </div>

            {/* Portfolio List */}
            <div style={{
              backgroundColor: '#161b22',
              border: '2px solid #21262d',
              borderTop: 'none',
              borderBottomLeftRadius: '12px',
              borderBottomRightRadius: '12px',
              overflow: 'auto',
              flex: 1,
              padding: '4px'
            }}>
              {theirPortfolioWithGains.map((asset, index) => {
                const currentPrice = battlePrices[asset.symbol] || asset.price;
                const gainPercent = asset.gainPercent;
                const weight = (asset.amount / 1000000) * 100;
                const borderStyle = getAssetBorderStyle(theirPortfolioWithGains, asset);

                return (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      marginBottom: '4px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                      ...borderStyle
                    }}
                  >
                    {/* Symbol and Gain */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#ffffff'
                      }}>
                        {asset.symbol}
                      </span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: gainPercent >= 0 ? '#22c55e' : '#ef4444'
                      }}>
                        {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%
                      </span>
                    </div>

                    {/* Allocation and Price */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        color: '#8b949e'
                      }}>
                        {weight.toFixed(1)}%
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#8b949e'
                      }}>
                        ${currentPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleViewScreen;
