// DEPRECATED: Replaced by DashboardLoop/DashboardDesktop in March 2026 dashboard redesign. Kept for reference. Safe to delete.
// /src/components/Dashboard/YourActivity.jsx
// TRAIN & EARN tab bottom section - personal activity timeline
// Types: Completed Game, Win Streak, Challenge Completed, Personal Best
// "Peek" behavior: shows ~1.5 items with overflow scroll

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { getUsername } from '../../utils/battleHelpers';

// Activity type configs
const ACTIVITY_TYPES = {
  completed: { icon: '✓', color: '#10b981', label: 'completed' },
  streak: { icon: '🔥', color: '#f59e0b', label: 'streak' },
  challenge: { icon: '🎯', color: '#a855f7', label: 'challenge' },
  record: { icon: '⭐', color: '#00d9ff', label: 'record' },
};

function generateActivityItems(completedBattles, user) {
  const items = [];
  let consecutiveWins = 0;

  // Process completed battles (most recent first)
  completedBattles.slice(0, 10).forEach((battle, idx) => {
    const result = battle.result;
    if (!result) return;

    const won = result.winner === user.username || getUsername(result.winner) === user.username;
    const isTraining = battle.isTrainingBattle;
    const gameType = battle._v === 2 ? 'BaggerBomb' : 'Snake Draft';

    // Completed game item
    items.push({
      id: `complete-${battle.id}`,
      type: 'completed',
      text: `${gameType} ${isTraining ? 'AI' : ''} ${won ? 'completed' : 'finished'}`,
      detail: won ? 'Won!' : '',
      timestamp: battle.completedAt || battle.endDate,
    });

    // Track win streaks
    if (won) {
      consecutiveWins++;
      if (consecutiveWins >= 3 && consecutiveWins % 3 === 0) {
        items.push({
          id: `streak-${battle.id}`,
          type: 'streak',
          text: `${consecutiveWins}-win streak!`,
          detail: '',
          timestamp: battle.completedAt || battle.endDate,
        });
      }
    } else {
      consecutiveWins = 0;
    }
  });

  return items.slice(0, 8); // Cap at 8 items
}

function ActivityItem({ item }) {
  const config = ACTIVITY_TYPES[item.type] || ACTIVITY_TYPES.completed;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      background: '#0d1117',
      borderRadius: '10px',
      borderLeft: `3px solid ${config.color}`,
      minHeight: '44px',
    }}>
      {/* Icon */}
      <span style={{
        fontSize: '14px',
        flexShrink: 0,
        color: config.color,
        fontWeight: '700',
      }}>
        {config.icon}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: '13px',
          color: '#e6edf3',
          fontWeight: '500',
        }}>
          {item.text}
        </span>
        {item.detail && (
          <span style={{
            fontSize: '13px',
            color: config.color,
            fontWeight: '600',
            marginLeft: '4px',
          }}>
            {item.detail}
          </span>
        )}
      </div>
    </div>
  );
}

export default function YourActivity({
  completedBattles = [],
  user,
  colors,
}) {
  const activityItems = useMemo(
    () => generateActivityItems(completedBattles, user),
    [completedBattles, user]
  );

  if (activityItems.length === 0) return null;

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
        <Zap size={14} style={{ color: '#f59e0b' }} />
        <span style={{
          fontSize: '13px',
          fontWeight: '700',
          color: '#e6edf3',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
        }}>
          YOUR ACTIVITY
        </span>
      </div>

      {/* Activity items with peek scroll */}
      <div style={{
        maxHeight: '180px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <style>{`.activity-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div className="activity-scroll" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {activityItems.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
