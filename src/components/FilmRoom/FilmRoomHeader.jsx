import React from 'react';
import { ChevronLeft, Film } from 'lucide-react';

export default function FilmRoomHeader({ onBack, tokens, totalDays, children }) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        borderBottom: `1px solid ${tokens.borderDefault || 'rgba(255,255,255,0.05)'}`,
        padding: '12px 16px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            color: tokens.teal || '#5eead4',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 6px',
          }}
        >
          <ChevronLeft size={16} />
          <span>Back</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Film size={14} color={tokens.amber || '#f59e0b'} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: tokens.textPrimary || '#e2e8f0',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Film Room
          </span>
          {totalDays > 1 && (
            <span style={{ fontSize: 11, color: tokens.textFaint || '#64748b', marginLeft: 4 }}>
              · {totalDays} days
            </span>
          )}
        </div>

        <div style={{ width: 60 }} />
      </div>

      {children}
    </div>
  );
}
