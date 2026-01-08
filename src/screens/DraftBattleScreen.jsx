import React, { useState, useEffect } from 'react';

const DraftBattleScreen = ({
  containerStyle,
  user,
  currentDraft,
  setCurrentDraft,
  setScreen,
  logger = console,
}) => {
  const [standings, setStandings] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [assetComparison, setAssetComparison] = useState(null);
  const [repairStatus, setRepairStatus] = useState(null); // 'repairing', 'success', 'error'

  const currentUserId = user?.odUserId || user?.username;
  const battleType = currentDraft?.type || 'stocks';

  // Check if prices need repair (all $100)
  const needsPriceRepair = currentDraft?.lockedPrices &&
    Object.values(currentDraft.lockedPrices).length > 0 &&
    Object.values(currentDraft.lockedPrices).every(p => p === 100);

  // FORCE REPAIR: Manual button to fix locked prices
  const forceRepairPrices = async () => {
    if (!currentDraft) {
      logger.log('[ForceRepair] No current draft to repair');
      return;
    }

    setRepairStatus('repairing');
    logger.log('[ForceRepair] Starting forced price repair for:', currentDraft.code || currentDraft.id);
    logger.log('[ForceRepair] Current locked prices:', currentDraft.lockedPrices);

    try {
      const stockAPIModule = await import('../services/eodhdAPI');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase/config');

      // Collect all symbols from all players
      const allSymbols = new Set();
      currentDraft.players?.forEach(player => {
        player.picks?.forEach(symbol => allSymbols.add(symbol));
      });
      const symbolList = Array.from(allSymbols);
      logger.log('[ForceRepair] Assets to fix:', symbolList);

      // Fetch real prices using batch API
      let newLockedPrices = {};

      if (battleType === 'crypto') {
        logger.log('[ForceRepair] Fetching crypto prices...');
        const priceData = await stockAPIModule.getAllCryptoPrices(symbolList);
        logger.log('[ForceRepair] Price data received:', priceData);

        for (const symbol of symbolList) {
          const coinGeckoId = stockAPIModule.symbolToCoinGeckoId(symbol);
          const data = priceData[coinGeckoId];

          if (data?.price && data.price > 0) {
            newLockedPrices[symbol] = data.price;
            logger.log(`[ForceRepair] ${symbol} (${coinGeckoId}): $${data.price}`);
          } else {
            // Use fallback
            const fallback = stockAPIModule.FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
            newLockedPrices[symbol] = fallback;
            logger.log(`[ForceRepair] ${symbol} (${coinGeckoId}): $${fallback} (fallback)`);
          }
        }
      } else {
        logger.log('[ForceRepair] Fetching stock prices...');
        const priceData = await stockAPIModule.getAllStockPrices(symbolList);

        for (const symbol of symbolList) {
          const data = priceData[symbol.toUpperCase()];
          newLockedPrices[symbol] = data?.price || stockAPIModule.FALLBACK_STOCK_PRICES[symbol] || 100;
        }
      }

      logger.log('[ForceRepair] New locked prices:', newLockedPrices);

      // Direct Firebase update
      if (currentDraft.id) {
        logger.log('[ForceRepair] Updating Firebase document:', currentDraft.id);
        const draftRef = doc(db, 'drafts', currentDraft.id);
        await updateDoc(draftRef, {
          lockedPrices: newLockedPrices,
          lockedPricesRepairedAt: serverTimestamp(),
          pricesRepaired: true
        });
        logger.log('[ForceRepair] ✅ Firebase updated successfully!');
      }

      // Update local state
      const repairedDraft = {
        ...currentDraft,
        lockedPrices: newLockedPrices,
        pricesRepaired: true
      };
      setCurrentDraft(repairedDraft);

      setRepairStatus('success');
      logger.log('[ForceRepair] ✅ Repair complete! Prices are now correct.');

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setRepairStatus(null), 3000);

    } catch (error) {
      logger.error('[ForceRepair] Failed:', error);
      setRepairStatus('error');
      setTimeout(() => setRepairStatus(null), 5000);
    }
  };

  // REPAIR: Fix battles with bad locked prices ($100 for everything)
  useEffect(() => {
    const repairLockedPrices = async () => {
      if (!currentDraft?.lockedPrices || !currentDraft?.players) return;

      // Check if locked prices look wrong (all exactly $100)
      const prices = Object.values(currentDraft.lockedPrices);
      const allSamePrice = prices.length > 0 && prices.every(p => p === 100);

      if (!allSamePrice) {
        console.log('[DraftBattle] Locked prices look valid, skipping repair');
        return;
      }

      console.log('[DraftBattle] ⚠️ Detected bad locked prices (all $100), attempting repair...');

      try {
        const stockAPIModule = await import('../services/eodhdAPI');
        const draftServiceModule = await import('../services/draftService');

        // Collect all symbols
        const allSymbols = new Set();
        currentDraft.players.forEach(player => {
          (player.picks || []).forEach(symbol => allSymbols.add(symbol));
        });
        const symbolList = Array.from(allSymbols);

        // Fetch real prices
        let newLockedPrices = {};

        if (battleType === 'crypto') {
          const priceData = await stockAPIModule.getAllCryptoPrices(symbolList);

          for (const symbol of symbolList) {
            const coinGeckoId = stockAPIModule.symbolToCoinGeckoId(symbol);
            const data = priceData[coinGeckoId];
            newLockedPrices[symbol] = data?.price ||
              stockAPIModule.FALLBACK_CRYPTO_PRICES[coinGeckoId] || 1;
          }
        } else {
          const priceData = await stockAPIModule.getAllStockPrices(symbolList);

          for (const symbol of symbolList) {
            const data = priceData[symbol.toUpperCase()];
            newLockedPrices[symbol] = data?.price ||
              stockAPIModule.FALLBACK_STOCK_PRICES[symbol] || 100;
          }
        }

        console.log('[DraftBattle] Repaired locked prices:', newLockedPrices);

        // Update the local draft state
        const repairedDraft = {
          ...currentDraft,
          lockedPrices: newLockedPrices,
          lockedPricesRepaired: true
        };
        setCurrentDraft(repairedDraft);

        // Try to persist the fix to Firebase (best effort)
        try {
          if (draftServiceModule.storeDraftLockedPrices && currentDraft.id) {
            await draftServiceModule.storeDraftLockedPrices(currentDraft.id);
            console.log('[DraftBattle] ✅ Repaired prices saved to Firebase');
          }
        } catch (saveError) {
          console.warn('[DraftBattle] Could not save repaired prices to Firebase:', saveError);
        }
      } catch (error) {
        console.error('[DraftBattle] Failed to repair locked prices:', error);
      }
    };

    repairLockedPrices();
  }, [currentDraft?.id]); // Only run when draft changes

  // Calculate standings from draft data - BATCH FETCHING VERSION
  useEffect(() => {
    const calculateStandings = async () => {
      if (!currentDraft?.players) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const stockAPIModule = await import('../services/eodhdAPI');

        // STEP 1: Collect ALL unique symbols from ALL players (ONE batch call)
        const allSymbols = new Set();
        currentDraft.players.forEach(player => {
          (player.picks || []).forEach(symbol => {
            // For crypto, we need lowercase IDs (or symbols that will be converted)
            allSymbols.add(battleType === 'crypto' ? symbol.toLowerCase() : symbol.toUpperCase());
          });
        });

        const symbolList = Array.from(allSymbols);
        console.log(`[DraftBattle] Fetching ${symbolList.length} unique assets in 1 batch call`);

        // STEP 2: Clear cache to ensure we get FRESH prices (not cached from when battle started)
        if (stockAPIModule.clearCache) {
          stockAPIModule.clearCache();
          console.log('[DraftBattle] Cache cleared to fetch fresh prices');
        }

        // Batch fetch ALL prices at once (1 API call instead of 36!)
        // getAllCryptoPrices now handles symbol→CoinGecko ID conversion automatically
        let allPrices = {};
        if (battleType === 'crypto') {
          allPrices = await stockAPIModule.getAllCryptoPrices(symbolList);
        } else {
          allPrices = await stockAPIModule.getAllStockPrices(symbolList);
        }

        // STEP 3: Calculate each player's performance using cached prices
        const playerPerformances = currentDraft.players.map((player) => {
          let totalGain = 0;
          const portfolioWithGains = [];

          for (const symbol of player.picks || []) {
            // Normalize symbol for lookup
            // For crypto, convert symbol to CoinGecko ID (BTC → bitcoin)
            let lookupKey;
            if (battleType === 'crypto') {
              lookupKey = stockAPIModule.symbolToCoinGeckoId
                ? stockAPIModule.symbolToCoinGeckoId(symbol)
                : symbol.toLowerCase();
            } else {
              lookupKey = symbol.toUpperCase();
            }

            // Get current price from batch result
            const priceData = allPrices[lookupKey];
            const currentPrice = priceData?.price || 0;

            // Get locked price (from draft completion)
            const lockedPrice = Number(currentDraft.lockedPrices?.[symbol] ||
                             currentDraft.lockedPrices?.[lookupKey] ||
                             currentPrice) || 0;

            // Calculate gain with sanity checks
            let gain = 0;
            if (lockedPrice > 0 && currentPrice > 0) {
              gain = ((currentPrice - lockedPrice) / lockedPrice) * 100;

              // Sanity check - gains over 500% or under -90% are likely data errors
              if (gain > 500 || gain < -90) {
                console.warn(`[DraftBattle] Suspicious gain for ${symbol}: ${(Number(gain) || 0).toFixed(2)}% (locked: $${lockedPrice}, current: $${currentPrice})`);
                gain = 0; // Reset to 0 for display
              }
            }

            portfolioWithGains.push({
              symbol,
              gain: parseFloat(gain.toFixed(2)),
              lockedPrice,
              currentPrice
            });

            // Equal weight (11.1% each for 9 assets)
            totalGain += gain / 9;
          }

          // Find best and worst assets
          const sorted = [...portfolioWithGains].sort((a, b) => b.gain - a.gain);

          return {
            odUserId: player.odUserId,
            displayName: player.displayName,
            isMe: player.odUserId === currentUserId,
            isCPU: player.isCPU || false,
            totalGain: parseFloat(totalGain.toFixed(2)),
            portfolio: portfolioWithGains,
            bestAsset: sorted[0] || { symbol: '-', gain: 0 },
            worstAsset: sorted[sorted.length - 1] || { symbol: '-', gain: 0 },
            previousRank: player.previousRank || 0
          };
        });

        // Sort by total gain (descending)
        const sorted = playerPerformances.sort((a, b) => b.totalGain - a.totalGain);

        // Assign ranks
        sorted.forEach((player, index) => {
          player.currentRank = index + 1;
        });

        setStandings(sorted);

        // Calculate asset comparison
        const myPlayer = sorted.find(p => p.isMe);
        if (myPlayer) {
          const myBest = myPlayer.bestAsset;
          const opponentBests = sorted
            .filter(p => !p.isMe)
            .map(p => p.bestAsset)
            .sort((a, b) => b.gain - a.gain);

          setAssetComparison({
            myBest,
            opponentBest: opponentBests[0],
            iWin: myBest?.gain > (opponentBests[0]?.gain || 0)
          });
        }

      } catch (error) {
        console.error('[DraftBattle] Error calculating standings:', error);
      }

      setLoading(false);
    };

    calculateStandings();

    // Refresh every 60 seconds (was 30s - EODHD has 100k calls/day limit)
    const refreshInterval = setInterval(calculateStandings, 60000);
    return () => clearInterval(refreshInterval);
  }, [currentDraft, currentUserId, battleType]);

  // Calculate time remaining
  useEffect(() => {
    const updateTimer = () => {
      if (!currentDraft?.battleEndTime) return;

      const end = new Date(currentDraft.battleEndTime);
      const now = new Date();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Battle ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 60000);
    return () => clearInterval(timerInterval);
  }, [currentDraft?.battleEndTime]);

  // Toggle card expansion
  const toggleExpand = (odUserId) => {
    setExpandedCards(prev => ({
      ...prev,
      [odUserId]: !prev[odUserId]
    }));
  };

  // Get movement indicator
  const getMovementIndicator = (player) => {
    if (!player.previousRank || player.previousRank === player.currentRank) {
      return { icon: '─', color: '#8b949e' };
    }
    if (player.currentRank < player.previousRank) {
      return { icon: '↑', color: '#10b981' };
    }
    return { icon: '↓', color: '#ef4444' };
  };

  // Get rank badge style
  const getRankBadge = (rank) => {
    switch (rank) {
      case 1: return { bg: 'linear-gradient(135deg, #ffd700 0%, #ffb800 100%)', text: '🥇 1ST' };
      case 2: return { bg: 'linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%)', text: '🥈 2ND' };
      case 3: return { bg: 'linear-gradient(135deg, #cd7f32 0%, #b87333 100%)', text: '🥉 3RD' };
      default: return { bg: '#21262d', text: `${rank}TH` };
    }
  };

  // Safety check
  if (!currentDraft) {
    return (
      <div style={containerStyle}>
        <div style={{
          minHeight: '100vh',
          background: '#0d1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px'
        }}>
          <p style={{ color: '#ffffff', marginBottom: '16px' }}>No active draft battle</p>
          <button
            onClick={() => setScreen('dashboard')}
            style={{
              padding: '12px 24px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ minHeight: '100vh', background: '#0d1117' }}>
        {/* Header */}
        <div style={{
          background: '#161b22',
          borderBottom: '2px solid #21262d',
          padding: '12px 16px',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={() => setScreen('dashboard')}
              style={{
                color: '#8b949e',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '8px'
              }}
            >
              ← Back
            </button>
            <h1 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🐍 Draft Battle
            </h1>
            <div style={{ width: '50px' }}></div>
          </div>
        </div>

        {/* Battle Info Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          padding: '12px 16px',
          textAlign: 'center'
        }}>
          <div style={{
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '14px',
            marginBottom: '4px'
          }}>
            {currentDraft?.code || 'DRAFT'} • Ends in {timeRemaining || 'Calculating...'}
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'center',
            gap: '16px'
          }}>
            <span>{battleType === 'stocks' ? '📈 Stocks' : '🪙 Crypto'}</span>
            <span>•</span>
            <span>Free Agents: {currentDraft?.freeAgents ?
              Object.values(currentDraft.freeAgents).flat().length : 0}</span>
          </div>
        </div>

        {/* Price Repair Warning Banner - Shows when all prices are $100 */}
        {needsPriceRepair && (
          <div style={{
            background: '#7f1d1d',
            borderBottom: '2px solid #ef4444',
            padding: '12px 16px',
            textAlign: 'center'
          }}>
            <div style={{
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '8px'
            }}>
              ⚠️ Locked prices are incorrect (all $100). Click below to repair.
            </div>
            <button
              onClick={forceRepairPrices}
              disabled={repairStatus === 'repairing'}
              style={{
                padding: '8px 20px',
                background: repairStatus === 'repairing' ? '#6b7280' :
                           repairStatus === 'success' ? '#10b981' :
                           repairStatus === 'error' ? '#ef4444' : '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: repairStatus === 'repairing' ? 'wait' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {repairStatus === 'repairing' ? '⏳ Repairing...' :
               repairStatus === 'success' ? '✅ Prices Fixed!' :
               repairStatus === 'error' ? '❌ Failed - Try Again' :
               '🔧 Repair Prices Now'}
            </button>
          </div>
        )}

        {/* Success message when repair is done but prices still show repair button */}
        {repairStatus === 'success' && !needsPriceRepair && (
          <div style={{
            background: '#064e3b',
            padding: '12px 16px',
            textAlign: 'center',
            color: '#6ee7b7',
            fontSize: '14px'
          }}>
            ✅ Prices repaired successfully! Gains should now be accurate.
          </div>
        )}

        {/* Main Content */}
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>📊</div>
              Calculating standings...
            </div>
          ) : (
            <>
              {/* Standings Cards */}
              {standings.map((player) => {
                const isExpanded = player.isMe || expandedCards[player.odUserId];
                const movement = getMovementIndicator(player);
                const rankBadge = getRankBadge(player.currentRank);

                return (
                  <div
                    key={player.odUserId}
                    onClick={() => !player.isMe && toggleExpand(player.odUserId)}
                    style={{
                      background: player.isMe
                        ? 'linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)'
                        : '#161b22',
                      border: player.isMe
                        ? '2px solid #00d9ff'
                        : '1px solid #21262d',
                      borderRadius: '16px',
                      padding: '16px',
                      marginBottom: '12px',
                      cursor: player.isMe ? 'default' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Card Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: isExpanded ? '16px' : '0'
                    }}>
                      {/* Left: Player Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Rank Badge */}
                        <div style={{
                          background: rankBadge.bg,
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: player.currentRank <= 3 ? '#000' : '#fff'
                        }}>
                          {rankBadge.text}
                        </div>

                        {/* Player Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {player.isCPU && <span style={{ fontSize: '14px' }}>🤖</span>}
                          {player.isMe && <span style={{ fontSize: '14px' }}>👤</span>}
                          <span style={{
                            color: player.isMe ? '#00d9ff' : '#ffffff',
                            fontWeight: player.isMe ? 'bold' : '600',
                            fontSize: '15px'
                          }}>
                            {player.isMe ? 'YOU' : player.displayName}
                          </span>
                        </div>

                        {/* Movement Indicator */}
                        <span style={{
                          color: movement.color,
                          fontWeight: 'bold',
                          fontSize: '16px'
                        }}>
                          {movement.icon}
                        </span>
                      </div>

                      {/* Right: Gain + Expand */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          color: (Number(player.totalGain) || 0) >= 0 ? '#10b981' : '#ef4444',
                          fontWeight: 'bold',
                          fontSize: '18px'
                        }}>
                          {(Number(player.totalGain) || 0) >= 0 ? '+' : ''}{(Number(player.totalGain) || 0).toFixed(2)}%
                        </span>

                        {!player.isMe && (
                          <span style={{
                            color: '#8b949e',
                            fontSize: '18px',
                            transition: 'transform 0.2s',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                          }}>
                            ▼
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div>
                        {/* Divider */}
                        <div style={{
                          height: '1px',
                          background: player.isMe ? 'rgba(0, 217, 255, 0.2)' : '#21262d',
                          marginBottom: '16px'
                        }} />

                        {/* Portfolio Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
                          gap: '8px',
                          marginBottom: '16px'
                        }}>
                          {player.portfolio.map((asset, assetIdx) => (
                            <div
                              key={assetIdx}
                              style={{
                                background: '#0d1117',
                                border: '1px solid #21262d',
                                borderRadius: '8px',
                                padding: '10px 8px',
                                textAlign: 'center'
                              }}
                            >
                              <div style={{
                                color: '#ffffff',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                marginBottom: '4px'
                              }}>
                                {asset.symbol}
                              </div>
                              <div style={{
                                color: (Number(asset.gain) || 0) >= 0 ? '#10b981' : '#ef4444',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                {(Number(asset.gain) || 0) >= 0 ? '+' : ''}{(Number(asset.gain) || 0).toFixed(2)}%
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Best/Worst Assets */}
                        <div style={{
                          display: 'flex',
                          gap: '12px',
                          marginBottom: player.isMe ? '16px' : '0'
                        }}>
                          <div style={{
                            flex: 1,
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                              🔥 BEST
                            </div>
                            <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '14px' }}>
                              {player.bestAsset?.symbol} {(Number(player.bestAsset?.gain) || 0) >= 0 ? '+' : ''}{(Number(player.bestAsset?.gain) || 0).toFixed(2)}%
                            </div>
                          </div>
                          <div style={{
                            flex: 1,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            padding: '10px',
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                              ❄️ WORST
                            </div>
                            <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>
                              {player.worstAsset?.symbol} {(Number(player.worstAsset?.gain) || 0) >= 0 ? '+' : ''}{(Number(player.worstAsset?.gain) || 0).toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons (only for your card) */}
                        {player.isMe && (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScreen('freeAgency');
                              }}
                              style={{
                                flex: 1,
                                padding: '12px',
                                background: 'transparent',
                                border: '2px solid #8b5cf6',
                                borderRadius: '8px',
                                color: '#8b5cf6',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              🔄 Free Agency
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScreen('draftResults');
                              }}
                              style={{
                                flex: 1,
                                padding: '12px',
                                background: 'transparent',
                                border: '1px solid #21262d',
                                borderRadius: '8px',
                                color: '#8b949e',
                                fontWeight: '600',
                                fontSize: '14px',
                                cursor: 'pointer'
                              }}
                            >
                              📋 All Picks
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Asset Comparison Section */}
              {assetComparison && (
                <div style={{
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: '16px',
                  padding: '16px',
                  marginTop: '8px'
                }}>
                  <h3 style={{
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    ⚔️ ASSET SHOWDOWN
                  </h3>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    {/* Your Best */}
                    <div style={{
                      flex: 1,
                      background: assetComparison.iWin
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                      border: assetComparison.iWin
                        ? '1px solid rgba(16, 185, 129, 0.3)'
                        : '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                        YOUR BEST
                      </div>
                      <div style={{
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        marginBottom: '2px'
                      }}>
                        {assetComparison.myBest?.symbol}
                      </div>
                      <div style={{
                        color: '#10b981',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        +{(Number(assetComparison.myBest?.gain) || 0).toFixed(2)}%
                      </div>
                      {assetComparison.iWin && (
                        <div style={{
                          color: '#10b981',
                          fontSize: '11px',
                          marginTop: '4px'
                        }}>
                          🏆 WINNING
                        </div>
                      )}
                    </div>

                    {/* VS */}
                    <div style={{
                      color: '#6e7681',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      VS
                    </div>

                    {/* Opponent Best */}
                    <div style={{
                      flex: 1,
                      background: !assetComparison.iWin
                        ? 'rgba(16, 185, 129, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                      border: !assetComparison.iWin
                        ? '1px solid rgba(16, 185, 129, 0.3)'
                        : '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '10px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '4px' }}>
                        THEIR BEST
                      </div>
                      <div style={{
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        marginBottom: '2px'
                      }}>
                        {assetComparison.opponentBest?.symbol || '-'}
                      </div>
                      <div style={{
                        color: (Number(assetComparison.opponentBest?.gain) || 0) >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {(Number(assetComparison.opponentBest?.gain) || 0) >= 0 ? '+' : ''}
                        {(Number(assetComparison.opponentBest?.gain) || 0).toFixed(2)}%
                      </div>
                      {!assetComparison.iWin && (
                        <div style={{
                          color: '#f59e0b',
                          fontSize: '11px',
                          marginTop: '4px'
                        }}>
                          ⚠️ WATCH OUT
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Refresh Indicator */}
              <div style={{
                textAlign: 'center',
                color: '#6e7681',
                fontSize: '11px',
                marginTop: '16px',
                padding: '8px'
              }}>
                Prices update every minute
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftBattleScreen;
