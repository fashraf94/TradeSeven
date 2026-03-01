// /src/components/Dashboard/PvpCommandCenter.jsx
// PVP tab — Positions (active picks with live prices) + Lobbies (joinable games)

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWebSocketPrices } from '../../hooks/useWebSocketPrices';
import { aggregatePvpPositions } from '../../utils/pvpPositionAggregator';
import { getUsername, isBaggerBombBattle } from '../../utils/battleHelpers';
import { useIsMobile } from '../../hooks';

// Source badge styling per game type
const SOURCE_STYLES = {
  BB: { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
  SD: { bg: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' },
  '1v1': { bg: 'rgba(0,217,255,0.2)', color: '#00d9ff', border: '1px solid rgba(0,217,255,0.3)' },
};

const SOURCE_BORDER_COLORS = { BB: '#f59e0b', SD: '#10b981', '1v1': '#00d9ff' };

const TIER_LABELS = { star: '⭐ Star', core: '💎 Core', support: '🛡️ Support' };

// ============================================
// Segmented Control
// ============================================
function SegmentedControl({ activeView, onChangeView }) {
  const segments = [
    { key: 'positions', label: '⚔️ Positions' },
    { key: 'lobbies', label: '🏟️ Lobbies' },
  ];

  return (
    <div style={{
      display: 'inline-flex',
      background: '#0d1117',
      border: '1px solid #21262d',
      borderRadius: '10px',
      padding: '3px',
      marginBottom: '12px',
    }}>
      {segments.map(seg => {
        const isActive = activeView === seg.key;
        return (
          <motion.button
            key={seg.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChangeView(seg.key)}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: isActive ? '1px solid rgba(0,217,255,0.4)' : '1px solid transparent',
              background: isActive ? 'rgba(0,217,255,0.15)' : 'transparent',
              color: isActive ? '#00d9ff' : '#6e7681',
              transition: 'all 0.15s ease',
              outline: 'none',
            }}
          >
            {seg.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ============================================
// Position Row
// ============================================
function PositionRow({ position, index, onTap, isMobile }) {
  const {
    symbol, name, currentPrice, entryPrice, pnlPercent,
    gameType, tier, threshold, progressPercent,
  } = position;

  const borderColor = SOURCE_BORDER_COLORS[gameType] || '#21262d';
  const sourceStyle = SOURCE_STYLES[gameType] || SOURCE_STYLES['1v1'];
  const pnlColor = pnlPercent >= 0 ? '#10b981' : '#ef4444';
  const pnlSign = pnlPercent >= 0 ? '+' : '';

  // Threshold progress bar color
  let progressColor = '#6e7681';
  let progressGlow = 'none';
  if (progressPercent != null) {
    if (progressPercent > 80) {
      progressColor = '#10b981';
      progressGlow = '0 0 6px rgba(16,185,129,0.5)';
    } else if (progressPercent >= 50) {
      progressColor = '#f59e0b';
    }
  }

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={() => onTap(position)}
      style={{
        borderLeft: `3px solid ${borderColor}`,
        background: index % 2 === 0 ? '#0d1117' : '#0f1318',
        padding: isMobile ? '10px 10px' : '10px 14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '8px' : '12px',
        minHeight: '56px',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Left: Symbol + Name + Badges */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#e6edf3' }}>
            {symbol}
          </span>
          {/* Source badge */}
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 5px',
            borderRadius: '4px', background: sourceStyle.bg,
            color: sourceStyle.color, border: sourceStyle.border,
          }}>
            {gameType}
          </span>
          {/* Tier badge (BB only) */}
          {tier && TIER_LABELS[tier] && (
            <span style={{ fontSize: '9px', color: '#6e7681' }}>
              {TIER_LABELS[tier]}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '10px', color: '#6e7681', marginTop: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
      </div>

      {/* Right: Price + P&L + Entry + Threshold */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'flex-end' }}>
          <span style={{
            fontSize: '13px', color: '#e6edf3', fontFamily: 'monospace',
          }}>
            ${currentPrice != null ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </span>
          <span style={{
            fontSize: '14px', fontWeight: 700, color: pnlColor,
          }}>
            {pnlPercent != null ? `${pnlSign}${pnlPercent.toFixed(2)}%` : '—'}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: '#6e7681', marginTop: '2px' }}>
          Entry: ${entryPrice > 0 ? entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </div>

        {/* BaggerBomb threshold progress */}
        {progressPercent != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '10px', color: progressColor }}>
              ⚡ {Math.min(Math.round(progressPercent), 999)}% to 💣
            </span>
            <div style={{
              width: '80px', height: '3px', background: 'rgba(255,255,255,0.08)',
              borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(progressPercent, 100)}%`,
                height: '100%', borderRadius: '2px',
                background: progressColor,
                boxShadow: progressGlow,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// Lobby helpers (adapted from LiveFeed.jsx)
// ============================================
function getBattleTypeInfo(battle) {
  if (!battle) return { icon: '⚔️', label: 'Builder 1v1' };
  if (isBaggerBombBattle(battle)) return { icon: '💣', label: 'BaggerBomb' };
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') return { icon: '🐍', label: 'Snake Draft' };
  return { icon: '⚔️', label: 'Builder 1v1' };
}

function getPlayerCountDisplay(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const current = battle.players?.length || 1;
    return `${current}/4 players`;
  }
  if (battle._v === 3 || battle._v === 4) {
    return battle.state?.status === 'waiting' ? '1/2 players · Waiting' : '2/2 players';
  }
  const hasOpponent = battle.opponent && getUsername(battle.opponent);
  return hasOpponent ? '2/2 players' : '1/2 players';
}

function getCreatorName(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const host = battle.players?.find(p => p.isHost);
    return host?.odUsername || host?.displayName || 'Player';
  }
  if (battle._v === 3 || battle._v === 4) return battle.creator?.username || 'Player';
  return getUsername(battle.creator) || 'Player';
}

function getLobbyUserId(battle) {
  if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
    const host = battle.players?.find(p => p.isHost);
    return host?.odUserId;
  }
  if (battle._v === 3 || battle._v === 4) return battle.creator?.odUserId;
  return battle.creator?.odUserId || battle.creator?.uid;
}

function getCreatedAt(battle) {
  if (battle.timing?.createdAt) return new Date(battle.timing.createdAt).getTime();
  if (battle.createdAt?.toDate) return battle.createdAt.toDate().getTime();
  if (battle.createdAt) return new Date(battle.createdAt).getTime();
  return Date.now();
}

// ============================================
// Lobby Item Component
// ============================================
function LobbyItem({ lobby, onAction, isMobile }) {
  const typeInfo = getBattleTypeInfo(lobby);

  return (
    <div style={{
      background: '#161b22',
      borderLeft: '4px solid #00d9ff',
      borderRadius: '8px',
      padding: isMobile ? '10px 12px' : '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: isMobile ? '10px' : '12px',
      minHeight: isMobile ? '50px' : '60px',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      <span style={{ fontSize: isMobile ? '16px' : '18px', flexShrink: 0, lineHeight: isMobile ? '20px' : '24px' }}>
        {typeInfo.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: isMobile ? '12px' : '13px', color: '#e6edf3', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {getCreatorName(lobby)} created a {typeInfo.label} lobby
        </div>
        <div style={{
          fontSize: isMobile ? '11px' : '12px', color: '#8b949e', marginTop: '2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {getPlayerCountDisplay(lobby)}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onAction(lobby); }}
        style={{
          padding: isMobile ? '6px 10px' : '5px 14px',
          minHeight: '32px',
          background: 'rgba(0,217,255,0.08)',
          border: '1px solid rgba(0,217,255,0.25)',
          borderRadius: '6px',
          color: '#00d9ff',
          fontSize: isMobile ? '10px' : '11px',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s',
          alignSelf: 'center',
          outline: 'none',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,217,255,0.18)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,217,255,0.08)'; }}
      >
        [JOIN]
      </button>
    </div>
  );
}

// ============================================
// Main PvpCommandCenter
// ============================================
export default function PvpCommandCenter({
  user,
  colors,
  activeBattles = [],
  activeDraftBattles = [],
  stocksData = [],
  cryptoData = [],
  lobbyBattles = [],
  // Navigation
  setCurrentBattle,
  setCurrentDraft,
  setScreen,
  setActiveBattleId,
  // Lobby join
  onJoinLobby,
  setBattleToJoin,
  setJoinCode,
  setJoinBattleType,
  setDraftState,
  copyToClipboard,
}) {
  const { isMobile } = useIsMobile();
  const uid = user?.odUserId || user?.uid;

  // --- Aggregate PVP positions ---
  const rawPositions = useMemo(() => {
    if (!uid) return [];
    return aggregatePvpPositions({ uid, activeBattles, activeDraftBattles });
  }, [uid, activeBattles, activeDraftBattles]);

  // --- Default tab based on whether positions exist ---
  const [activeView, setActiveView] = useState(() =>
    rawPositions.length > 0 ? 'positions' : 'lobbies'
  );

  // --- Extract unique symbols for WS subscription ---
  const symbols = useMemo(() => [...new Set(rawPositions.map(p => p.symbol))], [rawPositions]);

  // --- WebSocket prices ---
  const { prices: wsPrices } = useWebSocketPrices(symbols, { enabled: symbols.length > 0 });

  // --- REST price maps for fallback ---
  const restPriceMap = useMemo(() => {
    const map = {};
    if (Array.isArray(stocksData)) stocksData.forEach(s => { map[s.symbol] = s.price; });
    if (Array.isArray(cryptoData)) cryptoData.forEach(c => { map[c.symbol] = c.price; });
    return map;
  }, [stocksData, cryptoData]);

  // --- Enrich positions with live prices and P&L ---
  const positions = useMemo(() => {
    return rawPositions.map(pos => {
      const currentPrice = wsPrices[pos.symbol] || restPriceMap[pos.symbol] || null;
      const pnlPercent = (pos.entryPrice > 0 && currentPrice != null)
        ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100
        : null;

      let progressPercent = null;
      if (pos.gameType === 'BB' && pos.threshold && pnlPercent != null) {
        progressPercent = (Math.abs(pnlPercent) / pos.threshold) * 100;
      }

      return { ...pos, currentPrice, pnlPercent, progressPercent };
    });
  }, [rawPositions, wsPrices, restPriceMap]);

  // --- Group positions by game, sort within and across groups ---
  const groupedPositions = useMemo(() => {
    const groups = new Map();

    positions.forEach(pos => {
      if (!groups.has(pos.gameId)) {
        groups.set(pos.gameId, {
          gameId: pos.gameId,
          gameType: pos.gameType,
          battle: pos.battle,
          battleType: pos.battleType,
          positions: [],
          bestPnl: 0,
        });
      }
      const group = groups.get(pos.gameId);
      group.positions.push(pos);
      if (Math.abs(pos.pnlPercent || 0) > Math.abs(group.bestPnl)) {
        group.bestPnl = pos.pnlPercent || 0;
      }
    });

    // Sort positions within each group by |P&L| descending
    groups.forEach(group => {
      group.positions.sort((a, b) => Math.abs(b.pnlPercent || 0) - Math.abs(a.pnlPercent || 0));
    });

    // Sort groups by most extreme |P&L| (most action first)
    return Array.from(groups.values())
      .sort((a, b) => Math.abs(b.bestPnl) - Math.abs(a.bestPnl));
  }, [positions]);

  // --- Helper: get opponent name for group header ---
  const getOpponentName = (battle) => {
    const isCreator = battle.creatorId === uid ||
                      battle.creator?.uid === uid ||
                      battle.creator?.odUserId === uid;
    if (battle.isSnakeDraft || battle.battleType === 'snake-draft') {
      return `${battle.players?.length || 0} players`;
    }
    return isCreator
      ? (battle.opponent?.odUsername || battle.opponent?.username || 'Opponent')
      : (battle.creator?.odUsername || battle.creator?.username || 'Opponent');
  };

  // --- Position tap → navigate to battle ---
  const handlePositionTap = (position) => {
    if (position.battleType === 'draft') {
      setCurrentDraft(position.battle);
      setScreen('draftBattle');
    } else {
      setCurrentBattle(position.battle);
      if (position.battle._v >= 3) {
        setActiveBattleId(position.battle.id);
      }
      setScreen('battle');
    }
  };

  // --- Lobby items (filter out own lobbies) ---
  const lobbyItems = useMemo(() => {
    const currentUserId = user?.odUserId || user?.uid || user?.username;
    const seenIds = new Set();
    const items = [];

    // V3/V4 BaggerBomb + Snake Draft lobbies
    (lobbyBattles || []).forEach(battle => {
      const creatorId = getLobbyUserId(battle);
      if (creatorId === currentUserId) return;
      const id = `lobby-${battle.id}`;
      if (seenIds.has(id)) return;
      seenIds.add(id);
      items.push({ ...battle, _lobbyId: id });
    });

    // Sort by creation time (newest first)
    items.sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
    return items;
  }, [lobbyBattles, user]);

  // --- Lobby join handler ---
  const handleJoinLobby = (lobby) => {
    // V3/V4 BaggerBomb or Snake Draft — use onJoinLobby from parent
    if (lobby._v === 3 || lobby._v === 4 || lobby.isSnakeDraft || lobby.battleType === 'snake-draft') {
      if (onJoinLobby) {
        onJoinLobby(lobby);
        return;
      }
      // Fallback for Snake Draft
      if (lobby.isSnakeDraft || lobby.battleType === 'snake-draft') {
        if (setCurrentDraft && setScreen) {
          setCurrentDraft(lobby);
          setScreen('draftLobby');
        }
        return;
      }
    }

    // BaggerBomb V1/V2
    if (isBaggerBombBattle(lobby)) {
      if (setJoinCode && setJoinBattleType && setScreen) {
        setJoinCode(lobby.challengeCode || '');
        setJoinBattleType('baggerbomb');
        setScreen('joinPortfolioBuilderTD');
      }
      return;
    }

    // Classic 1v1 fallback
    if (setJoinCode && setJoinBattleType && setScreen) {
      setJoinCode(lobby.challengeCode || '');
      setJoinBattleType('classic');
      setScreen('builder');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      style={{
        marginBottom: '24px',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
      }}>
        <span style={{ fontSize: '14px' }}>📡</span>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#8b949e',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          PVP Command Center
        </span>
      </div>

      {/* Segmented Control */}
      <SegmentedControl activeView={activeView} onChangeView={setActiveView} />

      {/* Content */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #21262d',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        {activeView === 'positions' ? (
          /* ─── Positions View (grouped by game) ─── */
          groupedPositions.length > 0 ? (
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {groupedPositions.map((group, groupIdx) => {
                const groupColor = SOURCE_BORDER_COLORS[group.gameType] || '#00d9ff';
                const groupLabel = group.gameType === 'BB' ? '💣 BaggerBomb'
                  : group.gameType === 'SD' ? '🏟️ Snake Draft'
                  : '⚔️ Classic 1v1';
                const opponentLabel = getOpponentName(group.battle);

                return (
                  <div key={group.gameId}>
                    {/* Group Header */}
                    <div style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      borderLeft: `3px solid ${groupColor}`,
                      background: 'rgba(255,255,255,0.02)',
                      marginTop: groupIdx > 0 ? '2px' : 0,
                    }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 600, color: groupColor,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {groupLabel}
                      </span>
                      <span style={{ fontSize: '10px', color: '#6e7681' }}>
                        vs {opponentLabel}
                      </span>
                      <span style={{ fontSize: '10px', color: '#6e7681', marginLeft: 'auto' }}>
                        {group.positions.length} position{group.positions.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Position rows within group */}
                    {group.positions.map((pos, idx) => (
                      <PositionRow
                        key={`${pos.gameId}-${pos.symbol}-${idx}`}
                        position={pos}
                        index={idx}
                        onTap={handlePositionTap}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚔️</div>
              <div style={{ fontSize: '13px', color: '#8b949e' }}>
                No active PVP positions
              </div>
              <div style={{ fontSize: '12px', color: '#6e7681', marginTop: '4px' }}>
                Start a game to track your picks here.
              </div>
            </div>
          )
        ) : (
          /* ─── Lobbies View ─── */
          lobbyItems.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              background: '#21262d',
              maxHeight: '50vh',
              overflowY: 'auto',
            }}>
              {lobbyItems.map(lobby => (
                <LobbyItem
                  key={lobby._lobbyId || lobby.id}
                  lobby={lobby}
                  onAction={handleJoinLobby}
                  isMobile={isMobile}
                />
              ))}
            </div>
          ) : (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏟️</div>
              <div style={{ fontSize: '13px', color: '#8b949e' }}>
                No open lobbies right now
              </div>
              <div style={{ fontSize: '12px', color: '#6e7681', marginTop: '4px' }}>
                Create a game to get started!
              </div>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}
