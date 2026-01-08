// /src/screens/DraftRoomScreen.jsx

import React, { useState } from 'react';

/**
 * DraftRoomScreen - Main drafting room for picking assets
 *
 * @param {Object} props
 * @param {Object} props.draftState - Current draft state from subscription
 * @param {Object} props.currentDraft - Current draft object
 * @param {Object} props.user - Current user object
 * @param {Function} props.setScreen - Handler to change screen
 * @param {number} props.draftTimeRemaining - Time remaining for current pick
 * @param {number|null} props.autopickCountdown - Countdown before autopick
 * @param {string} props.selectedDraftCategory - Currently selected draft category
 * @param {Function} props.setSelectedDraftCategory - Handler to change category
 * @param {Object|null} props.draftAssetInfoModal - Asset to show in info modal
 * @param {Function} props.setDraftAssetInfoModal - Handler for asset info modal
 * @param {boolean} props.isRosterExpanded - Whether roster drawer is expanded
 * @param {Function} props.setIsRosterExpanded - Handler for roster expansion
 * @param {number|null} props.rosterTouchStart - Touch start position
 * @param {Function} props.setRosterTouchStart - Handler for touch start
 * @param {number|null} props.rosterTouchEnd - Touch end position
 * @param {Function} props.setRosterTouchEnd - Handler for touch end
 * @param {Array} props.stocksData - Stock data for metrics
 * @param {Array} props.userNotes - User's research notes
 * @param {Object} props.colors - Design tokens
 * @param {Object} props.containerStyle - Container style from App
 * @param {React.Component} props.DraftAdvisor - DraftAdvisor component
 * @param {Function} props.getStockSector - Helper to get stock sector
 * @param {Function} props.getSectorColor - Helper to get sector color
 */
const DraftRoomScreen = ({
  draftState,
  currentDraft,
  user,
  setScreen,
  draftTimeRemaining,
  autopickCountdown,
  selectedDraftCategory,
  setSelectedDraftCategory,
  draftAssetInfoModal,
  setDraftAssetInfoModal,
  isRosterExpanded,
  setIsRosterExpanded,
  rosterTouchStart,
  setRosterTouchStart,
  rosterTouchEnd,
  setRosterTouchEnd,
  stocksData,
  userNotes,
  colors,
  containerStyle,
  DraftAdvisor,
  getStockSector,
  getSectorColor
}) => {
  const roomDraft = draftState || currentDraft;

  // Loading state
  if (!roomDraft) {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          background: '#0d1117',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #21262d',
              borderTop: '4px solid #8b5cf6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <div style={{ color: '#8b949e' }}>Loading draft...</div>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const currentUserId = user.odUserId || user.username;
  const isMyTurn = roomDraft?.currentPlayerId === currentUserId;
  const myPlayer = roomDraft?.players?.find(p => p.odUserId === currentUserId);
  const currentRound = Math.floor((roomDraft?.currentPickIndex || 0) / 4) + 1;

  const handlePick = async (asset) => {
    if (!isMyTurn) return;
    try {
      const draftService = await import('../services/draftService');
      await draftService.makePick(roomDraft.id, currentUserId, {
        ...asset,
        category: selectedDraftCategory
      });
    } catch (error) {
      console.error('Pick failed:', error);
      alert(error.message || 'Failed to make pick');
    }
  };

  const handleAutopick = async () => {
    try {
      const draftService = await import('../services/draftService');
      await draftService.handleAutopick(roomDraft.id, currentUserId);
    } catch (error) {
      console.error('Autopick failed:', error);
    }
  };

  const getTimerColor = () => {
    if (draftTimeRemaining > 60) return '#10b981';
    if (draftTimeRemaining > 30) return '#f59e0b';
    return '#ef4444';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const availableAssets = roomDraft?.availableAssets?.[selectedDraftCategory] || [];
  const canPickFromCategory = (cat) => (myPlayer?.categories?.[cat] || 0) < 3;

  // Handle autopick when timer hits 0
  if (draftTimeRemaining === 0 && isMyTurn) {
    handleAutopick();
  }

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '2px solid #21262d',
          padding: '12px 16px',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* EXIT BUTTON */}
            <button
              onClick={() => {
                if (window.confirm('Leave draft? Your turns will be auto-picked while you\'re away. You can rejoin anytime.')) {
                  setScreen('dashboard');
                }
              }}
              style={{
                color: '#8b949e',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Exit
            </button>

            {/* Round info */}
            <div style={{ color: '#8b949e', fontSize: '14px' }}>
              Round {currentRound}/9
            </div>

            {/* Timer */}
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: getTimerColor(),
              fontFamily: "'SF Mono', monospace"
            }}>
              ⏱️ {formatTime(draftTimeRemaining)}
            </div>
          </div>

          {/* Draft Code */}
          <div style={{
            textAlign: 'center',
            marginTop: '4px',
            color: '#6e7681',
            fontSize: '12px'
          }}>
            Code: {roomDraft?.code}
          </div>

          {/* Turn Indicator */}
          <div style={{
            textAlign: 'center',
            marginTop: '8px',
            padding: '8px',
            background: isMyTurn ? 'rgba(0, 217, 255, 0.2)' : 'rgba(139, 92, 246, 0.1)',
            borderRadius: '8px'
          }}>
            {isMyTurn ? (
              <span style={{
                color: '#00d9ff',
                fontWeight: 'bold',
                fontSize: '14px'
              }}>
                🎯 YOUR TURN - Pick an asset!
              </span>
            ) : draftState?.lastPick ? (
              <div>
                <span style={{ color: '#8b949e', fontSize: '13px' }}>
                  {draftState.lastPick.isCPU ? '🤖' : '👤'} {draftState.lastPick.displayName} picked
                </span>
                <span style={{
                  color: draftState.lastPick.category === 'steady' ? '#10b981'
                       : draftState.lastPick.category === 'risky' ? '#f59e0b'
                       : '#3b82f6',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  marginLeft: '8px'
                }}>
                  {draftState.lastPick.symbol}
                </span>
                <span style={{
                  color: '#6e7681',
                  fontSize: '12px',
                  marginLeft: '8px',
                  textTransform: 'capitalize'
                }}>
                  ({draftState.lastPick.category})
                </span>
              </div>
            ) : (
              <span style={{ color: '#8b949e', fontSize: '14px' }}>
                Waiting for {roomDraft?.players?.find(p => p.odUserId === roomDraft?.currentPlayerId)?.displayName || 'opponent'}...
              </span>
            )}
          </div>

          {/* Autopick Countdown */}
          {autopickCountdown !== null && (
            <div style={{
              textAlign: 'center',
              marginTop: '8px',
              padding: '8px 16px',
              background: 'rgba(245, 158, 11, 0.2)',
              borderRadius: '8px',
              color: '#f59e0b',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              🤖 Auto-picking in {autopickCountdown}...
            </div>
          )}
        </div>

        {/* Player Status Cards */}
        <div style={{
          background: '#161b22',
          padding: '12px 16px',
          borderBottom: '1px solid #21262d'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            marginBottom: '0',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            {roomDraft?.players?.map((player, idx) => {
              const isCurrentPicker = player.odUserId === roomDraft.currentPlayerId;
              const isMe = player.odUserId === currentUserId;

              return (
                <div
                  key={player.odUserId || idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: isMe ? 'rgba(0, 217, 255, 0.1)' : '#0d1117',
                    border: isCurrentPicker
                      ? '2px solid #00d9ff'
                      : isMe
                        ? '1px solid rgba(0, 217, 255, 0.3)'
                        : '1px solid #21262d',
                    textAlign: 'center',
                    position: 'relative',
                    boxShadow: isCurrentPicker ? '0 0 12px rgba(0, 217, 255, 0.3)' : 'none'
                  }}
                >
                  {/* Current picker indicator */}
                  {isCurrentPicker && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#00d9ff',
                      color: '#000',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      PICKING
                    </div>
                  )}

                  {/* Player name row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    marginBottom: '4px'
                  }}>
                    {player.isCPU && <span style={{ fontSize: '12px' }}>🤖</span>}
                    <span style={{
                      color: isMe ? '#00d9ff' : '#ffffff',
                      fontWeight: isMe ? 'bold' : '600',
                      fontSize: '13px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100px'
                    }}>
                      {isMe ? 'YOU' : player.displayName?.slice(0, 10) || `Player ${idx + 1}`}
                    </span>
                    {isCurrentPicker && <span style={{ fontSize: '10px' }}>⭐</span>}
                  </div>

                  {/* Category counts */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: '#10b981' }}>S:{player.categories?.steady || 0}</span>
                    <span style={{ color: '#f59e0b' }}>R:{player.categories?.risky || 0}</span>
                    <span style={{ color: '#3b82f6' }}>D:{player.categories?.defensive || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{
          background: '#0d1117',
          padding: '12px 16px',
          borderBottom: '1px solid #21262d'
        }}>
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'flex',
            gap: '8px'
          }}>
            {['steady', 'risky', 'defensive'].map(cat => {
              const catColors = {
                steady: '#10b981',
                risky: '#f59e0b',
                defensive: '#3b82f6'
              };
              const count = roomDraft?.availableAssets?.[cat]?.length || 0;
              const userCount = myPlayer?.categories?.[cat] || 0;
              const isFull = userCount >= 3;

              return (
                <button
                  key={cat}
                  onClick={() => !isFull && setSelectedDraftCategory(cat)}
                  disabled={isFull}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '10px',
                    border: selectedDraftCategory === cat ? `2px solid ${catColors[cat]}` : '2px solid #21262d',
                    background: selectedDraftCategory === cat ? `${catColors[cat]}20` : 'transparent',
                    color: isFull ? '#6e7681' : selectedDraftCategory === cat ? catColors[cat] : '#8b949e',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.5 : 1,
                    textTransform: 'capitalize'
                  }}
                >
                  {cat} ({count})
                  {isFull && ' ✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Asset Grid */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '10px'
          }}>
            {availableAssets.map(asset => (
              <div
                key={asset.symbol}
                onClick={() => setDraftAssetInfoModal(asset)}
                style={{
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: '12px',
                  padding: '12px 10px',
                  minHeight: '90px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  opacity: isMyTurn && canPickFromCategory(selectedDraftCategory) ? 1 : 0.6,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  marginBottom: '2px'
                }}>
                  {asset.symbol}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: '#8b949e',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '8px'
                }}>
                  {asset.name}
                </div>

                {/* PICK Button */}
                {isMyTurn && canPickFromCategory(selectedDraftCategory) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePick(asset);
                    }}
                    style={{
                      padding: '8px 16px',
                      minWidth: '70px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontWeight: '600',
                      fontSize: '12px',
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      userSelect: 'none',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    PICK
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Draft Advisor Panel */}
          {DraftAdvisor && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              marginTop: '16px'
            }}>
              <div style={{ width: '100%', maxWidth: '450px' }}>
                <DraftAdvisor
                  myPicks={myPlayer?.picks || []}
                  availableStocks={availableAssets}
                  availableSteady={roomDraft?.availableAssets?.steady || []}
                  availableRisky={roomDraft?.availableAssets?.risky || []}
                  availableDefensive={roomDraft?.availableAssets?.defensive || []}
                  categoryRequirements={{
                    steadyPicked: myPlayer?.categories?.steady || 0,
                    steadyRequired: 3,
                    riskyPicked: myPlayer?.categories?.risky || 0,
                    riskyRequired: 3,
                    defensivePicked: myPlayer?.categories?.defensive || 0,
                    defensiveRequired: 3
                  }}
                  draftPosition={roomDraft?.players?.findIndex(p => p.odUserId === currentUserId) + 1}
                  round={currentRound}
                  compareStocks={[]}
                  colors={colors}
                  notes={userNotes.map(n => ({ header: n.header || n.symbol, content: n.content || n.note }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Asset Info Modal */}
        {draftAssetInfoModal && (
          <AssetInfoModal
            asset={draftAssetInfoModal}
            stocksData={stocksData}
            selectedDraftCategory={selectedDraftCategory}
            isMyTurn={isMyTurn}
            canPickFromCategory={canPickFromCategory}
            handlePick={handlePick}
            setDraftAssetInfoModal={setDraftAssetInfoModal}
            getStockSector={getStockSector}
            getSectorColor={getSectorColor}
          />
        )}

        {/* Swipeable Portfolio Drawer */}
        <PortfolioDrawer
          myPlayer={myPlayer}
          isRosterExpanded={isRosterExpanded}
          setIsRosterExpanded={setIsRosterExpanded}
          rosterTouchStart={rosterTouchStart}
          setRosterTouchStart={setRosterTouchStart}
          rosterTouchEnd={rosterTouchEnd}
          setRosterTouchEnd={setRosterTouchEnd}
        />
      </div>
    </div>
  );
};

/**
 * AssetInfoModal - Detailed view of a single asset
 */
const AssetInfoModal = ({
  asset,
  stocksData,
  selectedDraftCategory,
  isMyTurn,
  canPickFromCategory,
  handlePick,
  setDraftAssetInfoModal,
  getStockSector,
  getSectorColor
}) => {
  const stockData = stocksData?.find(s => s.symbol === asset.symbol) || asset;
  const sector = stockData.sector || getStockSector?.(asset.symbol) || 'Technology';
  const sectorColor = getSectorColor?.(sector) || '#8b5cf6';

  const analystRating = stockData.analystRating || {};
  const totalAnalysts = (analystRating.buy || 0) + (analystRating.hold || 0) + (analystRating.sell || 0);
  const buyPercent = totalAnalysts > 0 ? ((analystRating.buy || 0) / totalAnalysts * 100) : null;
  const sentiment = buyPercent !== null
    ? buyPercent >= 60 ? 'Buy' : buyPercent >= 40 ? 'Hold' : 'Sell'
    : null;
  const sentimentColor = sentiment === 'Buy' ? '#10b981' : sentiment === 'Sell' ? '#ef4444' : '#f59e0b';

  return (
    <div
      onClick={() => setDraftAssetInfoModal(null)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0d1117',
          border: `1px solid ${sectorColor}`,
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '85vh',
          overflow: 'auto',
          position: 'relative',
          boxShadow: `0 0 40px ${sectorColor}40`
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          background: `linear-gradient(180deg, ${sectorColor}15 0%, #0d1117 100%)`,
          borderBottom: '1px solid #21262d',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{
                fontSize: '28px',
                fontWeight: '800',
                color: '#ffffff',
                letterSpacing: '1px',
                textShadow: `0 0 20px ${sectorColor}60`
              }}>
                {asset.symbol}
              </div>
              <div style={{ fontSize: '14px', color: '#8b949e', marginTop: '2px' }}>
                {asset.name}
              </div>
              <div style={{
                display: 'inline-block',
                marginTop: '8px',
                padding: '4px 10px',
                background: `${sectorColor}20`,
                border: `1px solid ${sectorColor}40`,
                borderRadius: '12px',
                fontSize: '11px',
                color: sectorColor,
                fontWeight: '600'
              }}>
                {sector}
              </div>
            </div>
            <button
              onClick={() => setDraftAssetInfoModal(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#8b949e',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>

          {/* Price Display */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: '#ffffff' }}>
              ${(stockData.price || asset.price)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {(stockData.percentChange !== undefined || asset.percentChange !== undefined) && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px',
                padding: '4px 10px',
                background: (stockData.percentChange || asset.percentChange) >= 0
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                borderRadius: '6px',
                fontSize: '15px',
                fontWeight: '600',
                color: (stockData.percentChange || asset.percentChange) >= 0 ? '#10b981' : '#ef4444',
              }}>
                {(stockData.percentChange || asset.percentChange) >= 0 ? '▲' : '▼'}
                {Math.abs(stockData.percentChange || asset.percentChange).toFixed(2)}% today
              </div>
            )}
          </div>
        </div>

        {/* Analyst Sentiment */}
        {sentiment && (
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #21262d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', marginBottom: '4px' }}>
                Analyst Rating
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: sentimentColor
              }}>
                {sentiment}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>
                {totalAnalysts} Analysts
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                <span style={{ color: '#10b981' }}>{analystRating.buy || 0} Buy</span>
                <span style={{ color: '#f59e0b' }}>{analystRating.hold || 0} Hold</span>
                <span style={{ color: '#ef4444' }}>{analystRating.sell || 0} Sell</span>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          borderBottom: '1px solid #21262d'
        }}>
          <div style={{ background: '#161b22', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase' }}>Market Cap</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#e6edf3' }}>
              {stockData.marketCap
                ? stockData.marketCap >= 1e12
                  ? `$${(stockData.marketCap / 1e12).toFixed(2)}T`
                  : `$${(stockData.marketCap / 1e9).toFixed(1)}B`
                : 'N/A'}
            </div>
          </div>
          <div style={{ background: '#161b22', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase' }}>P/E Ratio</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#e6edf3' }}>
              {stockData.pe ? stockData.pe.toFixed(1) : stockData.peRatio ? stockData.peRatio.toFixed(1) : 'N/A'}
            </div>
          </div>
          <div style={{ background: '#161b22', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase' }}>Revenue Growth</div>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: (stockData.revenueGrowth || 0) >= 0 ? '#10b981' : '#ef4444'
            }}>
              {stockData.revenueGrowth
                ? `${stockData.revenueGrowth >= 0 ? '+' : ''}${stockData.revenueGrowth.toFixed(1)}%`
                : 'N/A'}
            </div>
          </div>
          <div style={{ background: '#161b22', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase' }}>Profit Margin</div>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: (stockData.profitMargin || 0) >= 0 ? '#10b981' : '#ef4444'
            }}>
              {stockData.profitMargin
                ? `${stockData.profitMargin.toFixed(1)}%`
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Category Badge */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d' }}>
          <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '8px', textTransform: 'uppercase' }}>
            Draft Category
          </div>
          <span style={{
            display: 'inline-block',
            padding: '8px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            background: selectedDraftCategory === 'steady' ? 'rgba(16, 185, 129, 0.2)' :
                        selectedDraftCategory === 'risky' ? 'rgba(245, 158, 11, 0.2)' :
                        'rgba(59, 130, 246, 0.2)',
            color: selectedDraftCategory === 'steady' ? '#10b981' :
                   selectedDraftCategory === 'risky' ? '#f59e0b' : '#3b82f6',
            textTransform: 'uppercase'
          }}>
            {selectedDraftCategory === 'steady' ? '🛡️ Steady' : selectedDraftCategory === 'risky' ? '⚡ Risky' : '🏛️ Defensive'}
          </span>
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#8b949e', lineHeight: '1.5' }}>
            {selectedDraftCategory === 'steady'
              ? 'Steady picks provide reliable, consistent performance with lower volatility. Great foundation for your portfolio.'
              : selectedDraftCategory === 'risky'
              ? 'Risky picks have higher volatility and potential for big swings. High risk, high reward plays.'
              : 'Defensive picks offer protection during market downturns. Helps balance aggressive positions.'}
          </div>
        </div>

        {/* PICK Button */}
        {isMyTurn && canPickFromCategory(selectedDraftCategory) && (
          <div style={{ padding: '20px' }}>
            <button
              onClick={() => {
                handlePick(asset);
                setDraftAssetInfoModal(null);
              }}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: 'rgba(0, 217, 255, 0.15)',
                border: '1px solid rgba(0, 217, 255, 0.4)',
                borderRadius: '12px',
                color: '#00d9ff',
                fontWeight: '700',
                fontSize: '15px',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              PICK {asset.symbol}
            </button>
          </div>
        )}

        {/* Disabled state message */}
        {(!isMyTurn || !canPickFromCategory(selectedDraftCategory)) && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#8b949e',
            fontSize: '13px'
          }}>
            {!isMyTurn ? "Wait for your turn to pick" : `You've already filled your ${selectedDraftCategory} category`}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * PortfolioDrawer - Swipeable drawer showing user's roster
 */
const PortfolioDrawer = ({
  myPlayer,
  isRosterExpanded,
  setIsRosterExpanded,
  rosterTouchStart,
  setRosterTouchStart,
  rosterTouchEnd,
  setRosterTouchEnd
}) => {
  return (
    <div
      onTouchStart={(e) => {
        setRosterTouchEnd(null);
        setRosterTouchStart(e.targetTouches[0].clientY);
      }}
      onTouchMove={(e) => {
        setRosterTouchEnd(e.targetTouches[0].clientY);
      }}
      onTouchEnd={() => {
        if (!rosterTouchStart || !rosterTouchEnd) return;
        const distance = rosterTouchStart - rosterTouchEnd;
        const minSwipeDistance = 50;
        if (distance > minSwipeDistance && !isRosterExpanded) {
          setIsRosterExpanded(true);
        } else if (distance < -minSwipeDistance && isRosterExpanded) {
          setIsRosterExpanded(false);
        }
      }}
      onClick={() => setIsRosterExpanded(!isRosterExpanded)}
      style={{
        background: '#161b22',
        borderTop: '2px solid #21262d',
        position: 'sticky',
        bottom: 0,
        transition: 'all 0.3s ease-out',
        maxHeight: isRosterExpanded ? '70vh' : '80px',
        overflow: 'hidden',
        cursor: 'pointer'
      }}
    >
      {/* Drag Handle */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '8px 0 4px 0'
      }}>
        <div style={{
          width: '40px',
          height: '4px',
          background: '#6e7681',
          borderRadius: '2px'
        }} />
      </div>

      {/* Collapsed Header */}
      <div style={{
        padding: '8px 16px 12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <span style={{ color: '#ffffff', fontWeight: '600' }}>
            YOUR ROSTER ({myPlayer?.picks?.length || 0}/9)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#8b949e', fontSize: '13px' }}>
            {3 - (myPlayer?.categories?.steady || 0)}S, {3 - (myPlayer?.categories?.risky || 0)}R, {3 - (myPlayer?.categories?.defensive || 0)}D needed
          </span>
          <span style={{
            color: '#8b949e',
            transform: isRosterExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s'
          }}>
            ▲
          </span>
        </div>
      </div>

      {/* Expanded Roster View */}
      {isRosterExpanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '0 16px 24px 16px',
            maxWidth: '600px',
            margin: '0 auto'
          }}
        >
          {/* STEADY Section */}
          <CategorySection
            category="steady"
            color="#10b981"
            myPlayer={myPlayer}
          />

          {/* RISKY Section */}
          <CategorySection
            category="risky"
            color="#f59e0b"
            myPlayer={myPlayer}
          />

          {/* DEFENSIVE Section */}
          <CategorySection
            category="defensive"
            color="#3b82f6"
            myPlayer={myPlayer}
          />

          {/* Tap to collapse hint */}
          <div style={{
            textAlign: 'center',
            marginTop: '16px',
            color: '#6e7681',
            fontSize: '12px'
          }}>
            Tap or swipe down to collapse
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * CategorySection - Roster section for a single category
 */
const CategorySection = ({ category, color, myPlayer }) => {
  const picks = myPlayer?.picks?.filter((symbol, idx) =>
    myPlayer?.pickCategories?.[idx] === category
  ) || [];
  const count = myPlayer?.categories?.[category] || 0;
  const isFull = count >= 3;

  return (
    <div style={{ marginBottom: category === 'defensive' ? '0' : '20px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: color
        }} />
        <span style={{ color: color, fontWeight: '600', fontSize: '14px', textTransform: 'uppercase' }}>
          {category} ({count}/3)
        </span>
        {isFull && (
          <span style={{ color: color }}>✓</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[0, 1, 2].map(slot => {
          const symbol = picks[slot];
          return (
            <div
              key={`${category}-${slot}`}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: symbol ? `${color}15` : '#0d1117',
                border: symbol ? `2px solid ${color}` : '2px dashed #21262d',
                borderRadius: '8px',
                textAlign: 'center',
                minHeight: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {symbol ? (
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>
                  {symbol}
                </span>
              ) : (
                <span style={{ color: '#6e7681', fontSize: '20px' }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DraftRoomScreen;
