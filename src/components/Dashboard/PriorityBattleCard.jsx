// /src/components/Dashboard/PriorityBattleCard.jsx
// Wrapper around ClashCard for the most urgent battle in The Loop
// Adds "ENDING SOON" label when < 2 hours remaining

import React from 'react';
import ClashCard from './ClashCard';
import { useTheme } from '../../contexts/ThemeContext';

function getEndTime(battle) {
  return battle.endDate || battle.battleEndTime ||
    battle.timing?.endDate || battle.timeline?.endDate || null;
}

export default function PriorityBattleCard({ battle, battleType, user, onPress }) {
  const { tokens } = useTheme();
  const endTime = getEndTime(battle);
  const remaining = endTime ? Math.max(0, new Date(endTime).getTime() - Date.now()) : null;
  const isEndingSoon = remaining !== null && remaining < 7200000 && remaining > 0;

  return (
    <div style={{
      position: 'relative',
      boxShadow: tokens.glowPurpleCard,
    }}>
      {isEndingSoon && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '12px',
          zIndex: 5,
          padding: '3px 10px',
          background: 'rgba(239,68,68,0.15)',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: '700',
          color: tokens.red,
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          ENDING SOON
        </div>
      )}

      <ClashCard
        battle={battle}
        battleType={battleType === 'trainingDraft' ? 'draft' : battleType}
        user={user}
        onPress={onPress}
        isMostUrgent={true}
      />
    </div>
  );
}
