// /src/components/Dashboard/LiveFeed.jsx
// PVP tab bottom section - shows live activity from the community
// 3 content types: Open Lobby (cyan), Winning Portfolio (green), Top Stock (amber)
// "Peek" behavior: shows ~1.5 items with overflow scroll

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, X } from 'lucide-react';
import { getUsername, isBaggerBombBattle, isTrainingBattle, getUserPortfolio } from '../../utils/battleHelpers';

// Feed item accent colors by type
const FEED_ACCENTS = {
  lobby: '#00d9ff',     // Cyan - open lobbies
  win: '#10b981',       // Green - winning portfolios
  stock: '#f59e0b',     // Amber - top stocks
};

// Determine game type info from a battle object
function getBattleTypeInfo(battle) {
  if (!battle) return { icon: '⚔️', label: 'Builder 1v1' };

  if (isBaggerBombBattle(battle)) {
    return { icon: '💣', label: 'BaggerBomb' };
  }
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    return { icon: '🐍', label: 'Snake Draft' };
  }
  return { icon: '⚔️', label: 'Builder 1v1' };
}

// Get player count display for a lobby
function getPlayerCountDisplay(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const current = battle.players?.length || 1;
    return `${current}/4 players`;
  }
  // 1v1 battles: creator is waiting, so 1/2
  const hasOpponent = battle.opponent && getUsername(battle.opponent);
  return hasOpponent ? '2/2 players' : '1/2 players';
}

// Get winner info from a completed battle
function getWinnerInfo(battle) {
  if (!battle.result) return null;

  const winnerName = typeof battle.result.winner === 'string'
    ? battle.result.winner
    : null;

  if (!winnerName || winnerName === 'tie') return null;

  const isCreatorWinner = getUsername(battle.creator) === winnerName;
  const returnPct = isCreatorWinner
    ? battle.result.creatorReturn
    : battle.result.opponentReturn;

  return { username: winnerName, returnPct, isCreatorWinner };
}

// Generate feed items from all data sources
function generateFeedItems(waitingBattles, completedBattles, stocksData, user) {
  const items = [];

  // 1. Open Lobbies from waiting battles
  (waitingBattles || []).forEach(battle => {
    const creator = getUsername(battle.creator);
    if (creator === user?.username) return; // Skip own lobbies

    const typeInfo = getBattleTypeInfo(battle);
    const playerCount = getPlayerCountDisplay(battle);

    items.push({
      id: `lobby-${battle.id}`,
      type: 'lobby',
      icon: typeInfo.icon,
      primaryText: `${creator || 'Player'} created a ${typeInfo.label} lobby`,
      secondaryText: playerCount,
      actionButton: 'JOIN',
      battle,
      timestamp: battle.createdAt ? new Date(battle.createdAt).getTime() : Date.now(),
    });
  });

  // 2. Recent wins from completed battles (PVP + Training)
  const recentCompleted = (completedBattles || []).slice(0, 15);
  recentCompleted.forEach(battle => {
    const winnerInfo = getWinnerInfo(battle);
    if (!winnerInfo) return;

    const typeInfo = getBattleTypeInfo(battle);
    const isTraining = isTrainingBattle(battle);
    const gameLabel = isTraining ? `${typeInfo.label} AI` : typeInfo.label;

    const returnStr = winnerInfo.returnPct !== undefined
      ? `${winnerInfo.returnPct >= 0 ? '+' : ''}${Number(winnerInfo.returnPct).toFixed(1)}% return`
      : '';

    items.push({
      id: `win-${battle.id}`,
      type: 'win',
      icon: '🏆',
      primaryText: `${winnerInfo.username} won ${gameLabel}`,
      secondaryText: returnStr,
      returnPct: winnerInfo.returnPct,
      actionButton: 'VIEW',
      battle,
      timestamp: battle.completedAt
        ? new Date(battle.completedAt).getTime()
        : battle.endDate
          ? new Date(battle.endDate).getTime()
          : Date.now(),
    });
  });

  // 3. Top performing stocks
  if (stocksData && stocksData.length > 0) {
    const topGainers = [...stocksData]
      .filter(s => s.percentChange > 0)
      .sort((a, b) => b.percentChange - a.percentChange)
      .slice(0, 3);

    topGainers.forEach((stock, idx) => {
      items.push({
        id: `stock-${stock.symbol}`,
        type: 'stock',
        icon: '📈',
        primaryText: `${stock.symbol} is ${idx === 0 ? "today's top performer" : 'surging today'}`,
        secondaryText: `+${Number(stock.percentChange).toFixed(1)}%${stock.name ? ` • ${stock.name}` : ''}`,
        actionButton: null,
        timestamp: Date.now() - idx, // Keep ordering among stocks
      });
    });
  }

  // Sort: pin top stock first, then interleave by recency
  const stockItems = items.filter(i => i.type === 'stock');
  const otherItems = items.filter(i => i.type !== 'stock')
    .sort((a, b) => b.timestamp - a.timestamp);

  // Interleave: top stock first, then alternate others
  const result = [];
  if (stockItems.length > 0) result.push(stockItems[0]);

  // Add other items, inserting remaining stocks every 5 items
  let stockIdx = 1;
  otherItems.forEach((item, idx) => {
    result.push(item);
    if ((idx + 1) % 5 === 0 && stockIdx < stockItems.length) {
      result.push(stockItems[stockIdx++]);
    }
  });

  // Append any remaining stock items
  while (stockIdx < stockItems.length) {
    result.push(stockItems[stockIdx++]);
  }

  return result.slice(0, 20);
}

// Get winner's portfolio holdings for the modal
function getWinnerPortfolio(battle) {
  if (!battle?.result) return [];

  const winnerName = typeof battle.result.winner === 'string'
    ? battle.result.winner
    : null;

  if (!winnerName || winnerName === 'tie') return [];

  // Try getUserPortfolio helper first
  const portfolio = getUserPortfolio(battle, winnerName);
  if (portfolio && portfolio.length > 0) return portfolio;

  // Fallback: determine from creator/opponent
  const isCreatorWinner = getUsername(battle.creator) === winnerName;

  if (isCreatorWinner) {
    // V1: creatorPortfolio at top level
    if (battle.creatorPortfolio) return battle.creatorPortfolio;
    // V2: inside creator object
    if (typeof battle.creator === 'object' && battle.creator.portfolio) return battle.creator.portfolio;
  } else {
    if (battle.opponentPortfolio) return battle.opponentPortfolio;
    if (typeof battle.opponent === 'object' && battle.opponent.portfolio) return battle.opponent.portfolio;
  }

  return [];
}

// Calculate individual asset return from starting prices
function getAssetReturn(asset, battle) {
  if (!battle?.startingPrices && !battle?.state?.startingPrices) return null;

  const startingPrices = battle.startingPrices || battle.state?.startingPrices || {};
  const startPrice = startingPrices[asset.symbol];

  if (!startPrice || !asset.price) return null;

  return ((asset.price - startPrice) / startPrice * 100);
}

// ============================================
// Winning Portfolio Modal
// ============================================
function WinningPortfolioModal({ battle, onClose }) {
  if (!battle) return null;

  const winnerInfo = getWinnerInfo(battle);
  if (!winnerInfo) return null;

  const typeInfo = getBattleTypeInfo(battle);
  const isTraining = isTrainingBattle(battle);
  const gameLabel = isTraining ? `${typeInfo.label} AI` : typeInfo.label;
  const portfolio = getWinnerPortfolio(battle);

  const returnColor = winnerInfo.returnPct >= 0 ? '#10b981' : '#ff3366';
  const returnStr = winnerInfo.returnPct !== undefined
    ? `${winnerInfo.returnPct >= 0 ? '+' : ''}${Number(winnerInfo.returnPct).toFixed(1)}%`
    : '';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '420px',
            maxHeight: '80vh',
            backgroundColor: '#161b22',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{
                fontSize: '15px',
                fontWeight: '700',
                color: '#e6edf3',
              }}>
                🏆 {winnerInfo.username}'s Winning Portfolio
              </div>
              <div style={{
                fontSize: '13px',
                color: '#8b949e',
                marginTop: '4px',
              }}>
                {gameLabel}
                {returnStr && (
                  <span style={{ color: returnColor, fontWeight: '600', marginLeft: '8px' }}>
                    {returnStr} return
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                color: '#8b949e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Portfolio table */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 20px',
          }}>
            {portfolio.length > 0 ? (
              <>
                {/* Table header */}
                <div style={{
                  display: 'flex',
                  padding: '6px 0 10px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  marginBottom: '4px',
                }}>
                  <span style={{ flex: 2, fontSize: '11px', color: '#6e7681', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Asset
                  </span>
                  <span style={{ flex: 1, fontSize: '11px', color: '#6e7681', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>
                    Allocation
                  </span>
                  <span style={{ flex: 1, fontSize: '11px', color: '#6e7681', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>
                    Return
                  </span>
                </div>

                {/* Table rows */}
                {portfolio.map((asset, idx) => {
                  const allocation = asset.allocation || (asset.amount ? ((asset.amount / 1000000) * 100) : null);
                  const assetReturn = getAssetReturn(asset, battle);

                  return (
                    <div
                      key={`${asset.symbol}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: idx < portfolio.length - 1 ? '1px solid rgba(255, 255, 255, 0.03)' : 'none',
                      }}
                    >
                      <div style={{ flex: 2 }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#e6edf3' }}>
                          {asset.symbol}
                        </span>
                        {asset.name && (
                          <span style={{ fontSize: '11px', color: '#6e7681', marginLeft: '6px' }}>
                            {asset.name}
                          </span>
                        )}
                      </div>
                      <span style={{ flex: 1, fontSize: '13px', color: '#8b949e', textAlign: 'right' }}>
                        {allocation != null ? `${Math.round(allocation)}%` : '—'}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: '13px',
                        fontWeight: '600',
                        textAlign: 'right',
                        color: assetReturn != null
                          ? (assetReturn >= 0 ? '#10b981' : '#ff3366')
                          : '#6e7681',
                      }}>
                        {assetReturn != null
                          ? `${assetReturn >= 0 ? '+' : ''}${assetReturn.toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '24px 0',
                color: '#6e7681',
                fontSize: '13px',
              }}>
                Portfolio details not available
              </div>
            )}
          </div>

          {/* Close button */}
          <div style={{
            padding: '12px 20px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 32px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#e6edf3',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              CLOSE
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// Feed Item Component
// ============================================
function FeedItem({ item, onAction }) {
  const accent = FEED_ACCENTS[item.type] || '#00d9ff';

  const returnColor = item.type === 'win' && item.returnPct !== undefined
    ? (item.returnPct >= 0 ? '#10b981' : '#ff3366')
    : null;

  return (
    <div style={{
      background: '#161b22',
      borderLeft: `4px solid ${accent}`,
      borderRadius: '8px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      minHeight: '60px',
    }}>
      {/* Icon */}
      <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: '24px' }}>
        {item.icon}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          color: '#e6edf3',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.primaryText}
        </div>
        {item.secondaryText && (
          <div style={{
            fontSize: '12px',
            color: returnColor || '#8b949e',
            marginTop: '2px',
            fontWeight: returnColor ? '600' : '400',
          }}>
            {item.secondaryText}
          </div>
        )}
      </div>

      {/* Action button */}
      {item.actionButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction(item);
          }}
          style={{
            padding: '5px 14px',
            background: `${accent}15`,
            border: `1px solid ${accent}40`,
            borderRadius: '6px',
            color: accent,
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s',
            alignSelf: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${accent}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${accent}15`;
          }}
        >
          [{item.actionButton}]
        </button>
      )}
    </div>
  );
}

// ============================================
// Main LiveFeed Component
// ============================================
export default function LiveFeed({
  waitingBattles = [],
  completedBattles = [],
  stocksData = [],
  user,
  colors,
  setCurrentBattle,
  setScreen,
  copyToClipboard,
  onJoinBattle,
  onViewPortfolio,
}) {
  const [selectedBattle, setSelectedBattle] = useState(null);

  const feedItems = useMemo(
    () => generateFeedItems(waitingBattles, completedBattles, stocksData, user),
    [waitingBattles, completedBattles, stocksData, user]
  );

  const handleAction = (item) => {
    if (item.type === 'lobby' && item.battle) {
      // Navigate to join flow
      if (onJoinBattle) {
        onJoinBattle(item.battle);
      } else if (setCurrentBattle && setScreen) {
        setCurrentBattle(item.battle);
        setScreen('join');
      } else if (item.battle.challengeCode && copyToClipboard) {
        copyToClipboard(item.battle.challengeCode);
      }
    } else if (item.type === 'win' && item.battle) {
      // Open portfolio modal
      if (onViewPortfolio) {
        onViewPortfolio(item.battle);
      }
      setSelectedBattle(item.battle);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      style={{ marginBottom: '24px' }}
    >
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
        padding: '0 4px',
      }}>
        <Radio size={14} style={{ color: '#00d9ff' }} />
        <span style={{
          fontSize: '13px',
          fontWeight: '700',
          color: '#e6edf3',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
        }}>
          📡 LIVE FEED
        </span>
      </div>

      {/* Feed items with peek scroll */}
      {feedItems.length > 0 ? (
        <div
          className="live-feed-scroll"
          style={{
            maxHeight: '140px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`.live-feed-scroll::-webkit-scrollbar { display: none; }`}</style>
          {feedItems.map((item) => (
            <FeedItem key={item.id} item={item} onAction={handleAction} />
          ))}
        </div>
      ) : (
        <div style={{
          background: '#161b22',
          borderRadius: '8px',
          padding: '24px 16px',
          textAlign: 'center',
          color: '#6e7681',
          fontSize: '13px',
        }}>
          The arena is quiet... Start a battle to see activity here!
        </div>
      )}

      {/* Winning Portfolio Modal */}
      {selectedBattle && (
        <WinningPortfolioModal
          battle={selectedBattle}
          onClose={() => setSelectedBattle(null)}
        />
      )}
    </motion.div>
  );
}
