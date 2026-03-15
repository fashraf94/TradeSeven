// /src/components/Dashboard/BattleRow.jsx
// Compact 64px row for secondary battles in The Loop mobile feed

import React, { useState, useEffect } from 'react';
import { Swords, Layers, Bot } from 'lucide-react';

const TYPE_ICONS = {
  classic: Swords,
  draft: Layers,
  training: Bot,
  trainingDraft: Bot,
};

const TYPE_COLORS = {
  classic: '#00d9ff',
  draft: '#22c55e',
  training: '#9333ea',
  trainingDraft: '#9333ea',
};

const TYPE_LABELS = {
  classic: 'Classic',
  draft: 'Draft',
  training: 'Training',
  trainingDraft: 'Training',
};

function getEndTime(battle) {
  return battle.endDate || battle.battleEndTime ||
    battle.timing?.endDate || battle.timeline?.endDate || null;
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return 'Ended';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getOpponentName(battle, user) {
  const username = user?.username;
  // V3/V4
  if (battle.creator && battle.opponent) {
    const isCreator = (battle.creator?.odUserId || battle.creator?.uid) === (user?.odUserId || user?.username) ||
      battle.creator?.username === username;
    return isCreator
      ? (battle.opponent?.username || 'Opponent')
      : (battle.creator?.username || 'Creator');
  }
  // Draft
  if (battle.players) {
    const other = battle.players.find(p => p.username !== username);
    return other?.username || 'Opponent';
  }
  return 'Opponent';
}

export default function BattleRow({ battle, battleType, user, colors, onPress }) {
  const [now, setNow] = useState(Date.now());
  const Icon = TYPE_ICONS[battleType] || Swords;
  const accent = TYPE_COLORS[battleType] || '#00d9ff';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const endTime = getEndTime(battle);
  const remaining = endTime ? Math.max(0, new Date(endTime).getTime() - now) : null;
  const opponent = getOpponentName(battle, user);
  const isUrgent = remaining !== null && remaining < 3600000 && remaining > 0;

  return (
    <div
      onClick={onPress}
      style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        background: 'rgba(22, 27, 34, 0.8)',
        borderRadius: '12px',
        border: `1px solid ${isUrgent ? 'rgba(239, 68, 68, 0.3)' : 'rgba(48, 54, 61, 0.6)'}`,
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Type icon */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: `${accent}15`,
        border: `1px solid ${accent}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} color={accent} />
      </div>

      {/* Middle: opponent + type label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#e6edf3',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          vs {opponent}
        </div>
        <div style={{
          fontSize: '11px',
          color: accent,
          fontWeight: '500',
          textTransform: 'capitalize',
        }}>
          {TYPE_LABELS[battleType] || battleType}
        </div>
      </div>

      {/* Right: time remaining */}
      <div style={{
        fontSize: '13px',
        fontWeight: '600',
        color: isUrgent ? '#ef4444' : '#8b949e',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {remaining !== null ? formatTimeRemaining(remaining) : 'Active'}
      </div>
    </div>
  );
}
