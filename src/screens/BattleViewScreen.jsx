// /src/screens/BattleViewScreen.jsx

import React, { useState, Suspense } from 'react';
import { useUser } from '../contexts/UserContext';

/**
 * BattleViewScreen - View active battle progress
 * Extracted from App.jsx Phase 6
 *
 * Handles both Classic (V1) and BaggerBomb (V2) battle views
 */
const BattleViewScreen = ({
  onBack,
  currentBattle,
  battlePrices = {},
  battleTimer,
  colors,
  containerStyle,
  isDesktop,
  DesktopBackground,
  BaggerBombBattleViewRedesign,
  ActiveRiskChallengeIndicator,
  LoadingFallback
}) => {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('yours');

  if (!currentBattle) {
    return (
      <div style={{
        minHeight: '100vh',
        background: colors?.background || '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: colors?.textMuted || '#8b949e' }}>No battle selected</p>
      </div>
    );
  }

  // Check if this is a BaggerBomb (V2) battle - route to redesigned view
  if (currentBattle._v === 2 && BaggerBombBattleViewRedesign) {
    return (
      <Suspense fallback={LoadingFallback ? <LoadingFallback /> : <div>Loading...</div>}>
        <BaggerBombBattleViewRedesign
          battle={currentBattle}
          user={user}
          onBack={onBack}
          isTraining={currentBattle.isTraining || false}
        />
      </Suspense>
    );
  }

  // Classic (V1) battle view
  const isCreator = currentBattle.creator === user?.username;
  const opponent = isCreator ? currentBattle.opponent : currentBattle.creator;
  const myPortfolio = isCreator ? currentBattle.creatorPortfolio : currentBattle.opponentPortfolio;
  const theirPortfolio = isCreator ? currentBattle.opponentPortfolio : currentBattle.creatorPortfolio;

  // Calculate current values and gains
  let myValue = 0;
  (myPortfolio || []).forEach(asset => {
    const shares = asset.amount / asset.price;
    const currentPrice = battlePrices[asset.symbol] || asset.price;
    myValue += shares * currentPrice;
  });

  let theirValue = 0;
  (theirPortfolio || []).forEach(asset => {
    const shares = asset.amount / asset.price;
    const currentPrice = battlePrices[asset.symbol] || asset.price;
    theirValue += shares * currentPrice;
  });

  const myGain = ((myValue - 1000000) / 1000000) * 100;
  const theirGain = ((theirValue - 1000000) / 1000000) * 100;
  const isWinning = myGain > theirGain;
  const difference = Math.abs(myGain - theirGain);
  const valueDifference = Math.abs(myValue - theirValue);

  // Pre-calculate gain percentages for portfolio assets
  const myPortfolioWithGains = (myPortfolio || []).map(asset => {
    const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
    const currentPrice = battlePrices[asset.symbol] || startingPrice;
    const gainPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
    return { ...asset, gainPercent };
  });

  const theirPortfolioWithGains = (theirPortfolio || []).map(asset => {
    const startingPrice = currentBattle.startingPrices?.[asset.symbol] || asset.price;
    const currentPrice = battlePrices[asset.symbol] || startingPrice;
    const gainPercent = ((currentPrice - startingPrice) / startingPrice) * 100;
    return { ...asset, gainPercent };
  });

  const displayPortfolio = activeTab === 'yours' ? myPortfolioWithGains : theirPortfolioWithGains;

  return (
    <div style={containerStyle}>
      {isDesktop && DesktopBackground && <DesktopBackground isDesktop={isDesktop} />}

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
            {battleTimer?.formatTimeRemaining?.(currentBattle) || 'Battle in progress'} remaining
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

        {/* Active Risk Challenge Indicator */}
        {ActiveRiskChallengeIndicator && (
          <div style={{ padding: '16px 16px 0 16px' }}>
            <ActiveRiskChallengeIndicator />
          </div>
        )}

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
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: '#8b949e', fontSize: '11px' }}>Portfolio Value</div>
                <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                  ${myValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ color: '#8b949e', fontSize: '11px' }}>Portfolio Value</div>
                <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600' }}>
                  ${theirValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PORTFOLIO TABS */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <button
              onClick={() => setActiveTab('yours')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'yours' ? '#00d9ff' : '#161b22',
                color: activeTab === 'yours' ? '#0d1117' : '#8b949e',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Your Portfolio
            </button>
            <button
              onClick={() => setActiveTab('opponent')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'opponent' ? '#ef4444' : '#161b22',
                color: activeTab === 'opponent' ? '#ffffff' : '#8b949e',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {currentBattle.isTrainingBattle ? 'CPU' : 'Opponent'}
            </button>
          </div>

          {/* Portfolio List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayPortfolio.map((asset, index) => (
              <div
                key={asset.symbol || index}
                style={{
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>
                    {asset.symbol}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '12px' }}>
                    ${(asset.amount || 0).toLocaleString()}
                  </div>
                </div>
                <div style={{
                  color: (asset.gainPercent || 0) >= 0 ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  {(asset.gainPercent || 0) >= 0 ? '+' : ''}{(asset.gainPercent || 0).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleViewScreen;
