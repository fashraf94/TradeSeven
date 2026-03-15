// /src/components/Dashboard/PriorityBattleCard.jsx
// Wrapper around ClashCard for the most urgent battle in The Loop
// Adds "ENDING SOON" label when < 2 hours remaining

import React from 'react';
import ClashCard from './ClashCard';

function getEndTime(battle) {
  return battle.endDate || battle.battleEndTime ||
    battle.timing?.endDate || battle.timeline?.endDate || null;
}

export default function PriorityBattleCard({ battle, battleType, user, onPress }) {
  const endTime = getEndTime(battle);
  const remaining = endTime ? Math.max(0, new Date(endTime).getTime() - Date.now()) : null;
  const isEndingSoon = remaining !== null && remaining < 7200000 && remaining > 0; // < 2 hours

  return (
    <div style={{ position: 'relative' }}>
      {/* Ending Soon badge */}
      {isEndingSoon && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '12px',
          zIndex: 5,
          padding: '3px 10px',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: '700',
          color: '#ffffff',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
        }}>
          ENDING SOON
        </div>
      )}

      <ClashCard
        battle={battle}
        battleType={battleType}
        user={user}
        onPress={onPress}
        isMostUrgent={true}
      />
    </div>
  );
}
