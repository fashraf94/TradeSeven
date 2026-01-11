import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HOLO_COLORS, GLOW_EFFECTS, RANK_CONFIG, CATEGORY_CONFIG, HOLO_BACKGROUND, HOLO_ANIMATIONS } from '../constants/holoTheme';
import { AltitudeMap, CommandConsole } from '../components/draft';

/**
 * DraftBattleScreenV2 - Altitude Map Redesign
 * Phase 3: Command Console & Integration
 *
 * This is a redesigned version of DraftBattleScreen with a new "Altitude Map" visual concept.
 * Core business logic is preserved exactly from the original.
 *
 * Props interface matches original DraftBattleScreen exactly.
 */
const DraftBattleScreenV2 = ({
  containerStyle,
  user,
  currentDraft,
  setCurrentDraft,
  setScreen,
  logger = console,
}) => {
  // ============================================
  // STATE - Preserved from original
  // ============================================
  const [standings, setStandings] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [assetComparison, setAssetComparison] = useState(null);
  const [repairStatus, setRepairStatus] = useState(null);

  // NEW STATE for Altitude Map (Phase 2+)
  const [isScoutMode, setIsScoutMode] = useState(false);
  const [scoutedPlayer, setScoutedPlayer] = useState(null);
  const [scoutTransition, setScoutTransition] = useState(false);

  // Refs for cleanup
  const refreshIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // ============================================
  // DERIVED VALUES - Preserved from original
  // ============================================
  const currentUserId = user?.odUserId || user?.username;
  const battleType = currentDraft?.type || 'stocks';

  // Check if prices need repair (all $100)
  const needsPriceRepair = currentDraft?.lockedPrices &&
    Object.values(currentDraft.lockedPrices).length > 0 &&
    Object.values(currentDraft.lockedPrices).every(p => p === 100);

  // ============================================
  // FORCE REPAIR - Copied exactly from original (lines 27-115)
  // ============================================
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
        logger.log('[ForceRepair] Firebase updated successfully!');
      }

      // Update local state
      const repairedDraft = {
        ...currentDraft,
        lockedPrices: newLockedPrices,
        pricesRepaired: true
      };
      setCurrentDraft(repairedDraft);

      setRepairStatus('success');
      logger.log('[ForceRepair] Repair complete! Prices are now correct.');

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setRepairStatus(null), 3000);

    } catch (error) {
      logger.error('[ForceRepair] Failed:', error);
      setRepairStatus('error');
      setTimeout(() => setRepairStatus(null), 5000);
    }
  };

  // ============================================
  // AUTO REPAIR EFFECT - Copied exactly from original (lines 117-191)
  // ============================================
  useEffect(() => {
    const repairLockedPrices = async () => {
      if (!currentDraft?.lockedPrices || !currentDraft?.players) return;

      // Check if locked prices look wrong (all exactly $100)
      const prices = Object.values(currentDraft.lockedPrices);
      const allSamePrice = prices.length > 0 && prices.every(p => p === 100);

      if (!allSamePrice) {
        console.log('[DraftBattleV2] Locked prices look valid, skipping repair');
        return;
      }

      console.log('[DraftBattleV2] Detected bad locked prices (all $100), attempting repair...');

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

        console.log('[DraftBattleV2] Repaired locked prices:', newLockedPrices);

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
            console.log('[DraftBattleV2] Repaired prices saved to Firebase');
          }
        } catch (saveError) {
          console.warn('[DraftBattleV2] Could not save repaired prices to Firebase:', saveError);
        }
      } catch (error) {
        console.error('[DraftBattleV2] Failed to repair locked prices:', error);
      }
    };

    repairLockedPrices();
  }, [currentDraft?.id]);

  // ============================================
  // CALCULATE STANDINGS - Copied exactly from original (lines 193-336)
  // ============================================
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
        console.log(`[DraftBattleV2] Fetching ${symbolList.length} unique assets in 1 batch call`);

        // STEP 2: Clear cache to ensure we get FRESH prices (not cached from when battle started)
        if (stockAPIModule.clearCache) {
          stockAPIModule.clearCache();
          console.log('[DraftBattleV2] Cache cleared to fetch fresh prices');
        }

        // Batch fetch ALL prices at once (1 API call instead of 36!)
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

          for (let pickIndex = 0; pickIndex < (player.picks || []).length; pickIndex++) {
            const symbol = player.picks[pickIndex];
            // Get category for this asset from player's pickCategories
            const category = player.pickCategories?.[pickIndex] || 'steady';

            // Normalize symbol for lookup
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
                console.warn(`[DraftBattleV2] Suspicious gain for ${symbol}: ${(Number(gain) || 0).toFixed(2)}% (locked: $${lockedPrice}, current: $${currentPrice})`);
                gain = 0; // Reset to 0 for display
              }
            }

            portfolioWithGains.push({
              symbol,
              gain: parseFloat(gain.toFixed(2)),
              lockedPrice,
              currentPrice,
              category,
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
        console.error('[DraftBattleV2] Error calculating standings:', error);
      }

      setLoading(false);
    };

    calculateStandings();

    // Refresh every 60 seconds
    refreshIntervalRef.current = setInterval(calculateStandings, 60000);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [currentDraft, currentUserId, battleType]);

  // ============================================
  // TIMER UPDATE - Copied exactly from original (lines 338-368)
  // ============================================
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
    timerIntervalRef.current = setInterval(updateTimer, 60000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [currentDraft?.battleEndTime]);

  // ============================================
  // HELPER FUNCTIONS - Preserved from original
  // ============================================
  const toggleExpand = (odUserId) => {
    setExpandedCards(prev => ({
      ...prev,
      [odUserId]: !prev[odUserId]
    }));
  };

  const getMovementIndicator = (player) => {
    if (!player.previousRank || player.previousRank === player.currentRank) {
      return { icon: '-', color: HOLO_COLORS.textSecondary };
    }
    if (player.currentRank < player.previousRank) {
      return { icon: '+', color: HOLO_COLORS.green };
    }
    return { icon: '-', color: HOLO_COLORS.red };
  };

  // ============================================
  // SCOUT VIEW HANDLERS (NEW for Phase 4)
  // ============================================
  const handleScoutPlayer = (player) => {
    if (player.isMe) return; // Can't scout yourself
    setScoutTransition(true);
    setTimeout(() => {
      setScoutedPlayer(player);
      setIsScoutMode(true);
      setScoutTransition(false);
    }, 500);
  };

  const handleExitScout = () => {
    setScoutTransition(true);
    setTimeout(() => {
      setScoutedPlayer(null);
      setIsScoutMode(false);
      setScoutTransition(false);
    }, 300);
  };

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================
  const handleBack = () => setScreen('dashboard');
  const handleFreeAgency = () => setScreen('freeAgency');
  const handleViewAll = () => setScreen('draftResults');

  // ============================================
  // SAFETY CHECK - No draft
  // ============================================
  if (!currentDraft) {
    return (
      <div style={{
        ...containerStyle,
        minHeight: '100vh',
        background: HOLO_BACKGROUND,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px'
      }}>
        <p style={{ color: HOLO_COLORS.textPrimary, marginBottom: '16px' }}>
          No active draft battle
        </p>
        <button
          onClick={handleBack}
          style={{
            padding: '12px 24px',
            background: `linear-gradient(135deg, ${HOLO_COLORS.cyan}33 0%, ${HOLO_COLORS.green}33 100%)`,
            border: `1px solid ${HOLO_COLORS.cyan}`,
            color: HOLO_COLORS.textPrimary,
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back to Dashboard
        </button>
        <style>{HOLO_ANIMATIONS}</style>
      </div>
    );
  }

  // Find my player for the Command Console (memoized)
  const userStanding = useMemo(() => {
    return standings.find(p => p.isMe) || null;
  }, [standings]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div style={{
      ...containerStyle,
      minHeight: '100vh',
      background: HOLO_BACKGROUND,
      color: HOLO_COLORS.textPrimary,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* HEADER */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10, 14, 20, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${HOLO_COLORS.borderSubtle}`,
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: HOLO_COLORS.textSecondary,
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
            }}
          >
            &#8592;
          </button>
          <span style={{
            fontSize: '16px',
            fontWeight: 600,
            color: HOLO_COLORS.cyan,
            textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
          }}>
            DRAFT BATTLE
          </span>
          <div style={{ width: '40px' }} />
        </div>
      </header>

      {/* STATUS BAR */}
      <div style={{
        background: `linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 136, 0.1) 100%)`,
        borderBottom: `1px solid ${HOLO_COLORS.borderGlow}`,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
      }}>
        <span style={{ color: HOLO_COLORS.textSecondary }}>
          {currentDraft?.code || 'DRAFT'}
        </span>
        <span style={{
          color: HOLO_COLORS.cyan,
          fontFamily: 'monospace',
          fontWeight: 600,
        }}>
          Ends in {timeRemaining || '...'}
        </span>
        <span style={{ color: HOLO_COLORS.textSecondary }}>
          {battleType === 'crypto' ? 'Crypto' : 'Stocks'}
        </span>
      </div>

      {/* PRICE REPAIR WARNING */}
      {needsPriceRepair && (
        <div style={{
          background: 'rgba(127, 29, 29, 0.9)',
          borderBottom: `2px solid ${HOLO_COLORS.red}`,
          padding: '12px 16px',
          textAlign: 'center'
        }}>
          <div style={{
            color: '#fca5a5',
            fontSize: '13px',
            marginBottom: '8px'
          }}>
            Locked prices are incorrect (all $100). Click below to repair.
          </div>
          <button
            onClick={forceRepairPrices}
            disabled={repairStatus === 'repairing'}
            style={{
              padding: '8px 20px',
              background: repairStatus === 'repairing' ? '#6b7280' :
                         repairStatus === 'success' ? HOLO_COLORS.green :
                         repairStatus === 'error' ? HOLO_COLORS.red : '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: repairStatus === 'repairing' ? 'wait' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {repairStatus === 'repairing' ? 'Repairing...' :
             repairStatus === 'success' ? 'Prices Fixed!' :
             repairStatus === 'error' ? 'Failed - Try Again' :
             'Repair Prices Now'}
          </button>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {repairStatus === 'success' && !needsPriceRepair && (
        <div style={{
          background: 'rgba(6, 78, 59, 0.9)',
          padding: '12px 16px',
          textAlign: 'center',
          color: '#6ee7b7',
          fontSize: '14px'
        }}>
          Prices repaired successfully! Gains should now be accurate.
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main style={{
        flex: 1,
        padding: '16px',
        paddingBottom: '240px', // Space for Command Console
        overflowY: 'auto',
        minHeight: 'calc(100vh - 180px)',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            gap: '16px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: `3px solid ${HOLO_COLORS.borderSubtle}`,
              borderTop: `3px solid ${HOLO_COLORS.cyan}`,
              borderRadius: '50%',
              animation: 'holoSpin 1s linear infinite',
            }} />
            <span style={{ color: HOLO_COLORS.textSecondary }}>
              Calculating battle standings...
            </span>
          </div>
        ) : (
          <div>
            {/* ALTITUDE MAP - Phase 2 Implementation */}
            <AltitudeMap
              standings={standings}
              currentUserId={currentUserId}
              onScoutPlayer={handleScoutPlayer}
              containerHeight={Math.max(450, standings.length * 140)}
            />

            {/* Refresh indicator */}
            <div style={{
              textAlign: 'center',
              color: HOLO_COLORS.textMuted,
              fontSize: '11px',
              marginTop: '24px',
              padding: '8px',
              borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  background: HOLO_COLORS.green,
                  borderRadius: '50%',
                  animation: 'holoPulse 2s ease-in-out infinite',
                }} />
                Prices update every minute
              </span>
            </div>
          </div>
        )}
      </main>

      {/* COMMAND CONSOLE - Phase 3 Implementation */}
      <CommandConsole
        userStanding={userStanding}
        scoutedPlayer={scoutedPlayer}
        isScoutMode={isScoutMode}
        onExitScout={handleExitScout}
        onFreeAgency={handleFreeAgency}
        onViewAll={handleViewAll}
      />

      {/* Scout Transition Overlay */}
      {scoutTransition && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(245, 158, 11, 0.1)',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: HOLO_COLORS.amber,
            boxShadow: GLOW_EFFECTS.amber,
            animation: 'holoScanDown 0.5s ease-out',
          }} />
        </div>
      )}

      {/* Global Animations */}
      <style>{HOLO_ANIMATIONS}</style>
    </div>
  );
};

export default DraftBattleScreenV2;
