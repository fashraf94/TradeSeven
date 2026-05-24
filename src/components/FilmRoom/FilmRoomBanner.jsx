import React from 'react';
import { Film, ArrowRight } from 'lucide-react';

// Banner shown on AgentBattleScreen when the battle has at least one daily
// review filed. Both active multi-day and completed battles surface this so
// the post-battle review surface is reachable without leaving the screen.
export default function FilmRoomBanner({ onOpen, dailyReviewCount, status, tokens }) {
  const amber = tokens.amber || '#f59e0b';
  const isCompleted = status === 'completed';

  return (
    <button
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: 'calc(100% - 24px)',
        margin: '8px 12px 0',
        padding: '10px 14px',
        borderRadius: 10,
        border: `1px solid ${amber}33`,
        background: 'rgba(245, 158, 11, 0.08)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
      }}
    >
      <Film size={16} color={amber} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: amber,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Film Room
        </span>
        <span style={{ fontSize: 11, color: tokens.textMuted || '#94a3b8' }}>
          {isCompleted
            ? 'Review the full tape and ask the agent about it.'
            : dailyReviewCount > 0
            ? `Review Day ${dailyReviewCount} debrief and ask follow-ups.`
            : 'Open the tape.'}
        </span>
      </div>
      <ArrowRight size={14} color={amber} />
    </button>
  );
}
