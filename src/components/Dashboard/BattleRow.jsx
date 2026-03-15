// /src/components/Dashboard/BattleRow.jsx
// Compact 64px row for secondary battles in The Loop mobile feed

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Swords, Layers, Bot } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import TapGlint from '../shared/TapGlint';

const TYPE_ICONS = {
  classic: Swords,
  draft: Layers,
  training: Bot,
  trainingDraft: Bot,
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
  if (battle.creator && battle.opponent) {
    const isCreator = (battle.creator?.odUserId || battle.creator?.uid) === (user?.odUserId || user?.username) ||
      battle.creator?.username === username;
    return isCreator
      ? (battle.opponent?.username || 'Opponent')
      : (battle.creator?.username || 'Creator');
  }
  if (battle.players) {
    const other = battle.players.find(p => p.username !== username);
    return other?.username || 'Opponent';
  }
  return 'Opponent';
}

export default function BattleRow({ battle, battleType, user, onPress }) {
  const { tokens } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [tapCount, setTapCount] = useState(0);
  const Icon = TYPE_ICONS[battleType] || Swords;

  const typeColors = {
    classic: tokens.teal,
    draft: tokens.emerald,
    training: tokens.purpleText,
    trainingDraft: tokens.purpleText,
  };
  const accent = typeColors[battleType] || tokens.teal;
  const isTrainingType = battleType === 'training' || battleType === 'trainingDraft';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const endTime = getEndTime(battle);
  const remaining = endTime ? Math.max(0, new Date(endTime).getTime() - now) : null;
  const opponent = getOpponentName(battle, user);
  const isUrgent = remaining !== null && remaining < 3600000 && remaining > 0;

  return (
    <motion.div
      onClick={() => { setTapCount(c => c + 1); onPress(); }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        background: tokens.bgCard,
        borderRadius: '12px',
        border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : tokens.borderDefault}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.4)',
        cursor: 'pointer',
      }}
    >
      <TapGlint triggerKey={tapCount} />
      {/* Type icon */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: tokens.bgIcon,
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
          fontWeight: '500',
          color: tokens.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          vs {opponent}
        </div>
        {isTrainingType ? (
          <span style={{
            display: 'inline-block',
            fontSize: '10px',
            fontWeight: '600',
            color: tokens.purpleText,
            background: 'rgba(147,51,234,0.15)',
            padding: '2px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginTop: '2px',
          }}>
            Training
          </span>
        ) : (
          <div style={{
            fontSize: '12px',
            color: tokens.textFaint,
            marginTop: '1px',
          }}>
            {TYPE_LABELS[battleType] || battleType}
          </div>
        )}
      </div>

      {/* Right: time remaining */}
      <motion.span
        key={remaining !== null ? formatTimeRemaining(remaining) : 'active'}
        initial={{ scale: 1.15, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          fontSize: '13px',
          fontWeight: '500',
          color: isUrgent ? tokens.red : tokens.textMuted,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {remaining !== null ? formatTimeRemaining(remaining) : 'Active'}
      </motion.span>
    </motion.div>
  );
}
