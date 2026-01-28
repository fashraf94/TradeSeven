// /src/components/Dashboard/LiveFeed.jsx
// PVP tab bottom section - shows live activity from the community
// 3 content types: Open Lobby (cyan), Winning Portfolio (green), Top Stock (amber)
// "Peek" behavior: shows ~1.5 items with overflow scroll

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { getUsername } from '../../utils/battleHelpers';

// Feed item accent colors by type
const FEED_ACCENTS = {
  lobby: '#00d9ff',     // Cyan - open lobbies
  win: '#10b981',       // Green - winning portfolios
  stock: '#f59e0b',     // Amber - top stocks
};

// Generate feed items from available data
function generateFeedItems(waitingBattles, completedBattles, user) {
  const items = [];

  // Open Lobbies from waiting battles (most relevant)
  waitingBattles.forEach(battle => {
    const creator = getUsername(battle.creator);
    if (creator === user.username) return; // Skip own lobbies

    items.push({
      id: `lobby-${battle.id}`,
      type: 'lobby',
      icon: '⚔️',
      primary: creator || 'Player',
      action: 'created lobby',
      detail: battle.challengeCode || '',
      actionButton: 'JOIN',
      battleId: battle.id,
      battle,
    });
  });

  // Recent wins from completed battles
  completedBattles.slice(0, 5).forEach(battle => {
    if (!battle.result) return;
    const winner = getUsername(battle.result?.winner);
    if (!winner) return;

    const returnPct = getUsername(battle.creator) === winner
      ? battle.result.creatorReturn
      : battle.result.opponentReturn;

    items.push({
      id: `win-${battle.id}`,
      type: 'win',
      icon: '🏆',
      primary: winner,
      action: 'won Builder 1v1',
      detail: returnPct !== undefined ? `${returnPct >= 0 ? '+' : ''}${returnPct}%` : '',
      actionButton: 'VIEW',
      battleId: battle.id,
      battle,
    });
  });

  // Interleave items for variety (lobby, win, lobby, win...)
  const lobbies = items.filter(i => i.type === 'lobby');
  const wins = items.filter(i => i.type === 'win');
  const interleaved = [];
  const maxLen = Math.max(lobbies.length, wins.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < lobbies.length) interleaved.push(lobbies[i]);
    if (i < wins.length) interleaved.push(wins[i]);
  }

  return interleaved.slice(0, 8); // Cap at 8 items
}

function FeedItem({ item, onAction }) {
  const accent = FEED_ACCENTS[item.type] || '#00d9ff';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
      background: '#0d1117',
      borderRadius: '10px',
      borderLeft: `3px solid ${accent}`,
      minHeight: '52px',
    }}>
      {/* Icon */}
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          color: '#e6edf3',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontWeight: '700', color: accent }}>{item.primary}</span>
          {' '}{item.action}
          {item.detail && (
            <span style={{ fontWeight: '600', color: '#e6edf3' }}> {item.detail}</span>
          )}
        </div>
      </div>

      {/* Action button */}
      {item.actionButton && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction(item);
          }}
          style={{
            padding: '5px 12px',
            background: `${accent}15`,
            border: `1px solid ${accent}40`,
            borderRadius: '6px',
            color: accent,
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s',
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

export default function LiveFeed({
  waitingBattles = [],
  completedBattles = [],
  user,
  colors,
  setCurrentBattle,
  setScreen,
  copyToClipboard,
}) {
  const feedItems = useMemo(
    () => generateFeedItems(waitingBattles, completedBattles, user),
    [waitingBattles, completedBattles, user]
  );

  if (feedItems.length === 0) return null;

  const handleAction = (item) => {
    if (item.type === 'lobby' && item.battle) {
      // Copy challenge code for joining
      if (item.battle.challengeCode && copyToClipboard) {
        copyToClipboard(item.battle.challengeCode);
      }
    } else if (item.type === 'win' && item.battle) {
      setCurrentBattle(item.battle);
      setScreen('battle');
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
          LIVE FEED
        </span>
      </div>

      {/* Feed items with peek scroll */}
      <div style={{
        maxHeight: '180px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <style>{`.live-feed-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div className="live-feed-scroll" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {feedItems.map((item) => (
            <FeedItem key={item.id} item={item} onAction={handleAction} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
