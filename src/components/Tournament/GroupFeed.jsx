// src/components/Tournament/GroupFeed.jsx
//
// P6b — the group-feed renderer, extracted from LeagueScreen so the League
// home AND the dev screen share one feed surface (the founder smoke watches
// the double_down entry here). Tokens-native; static text, inherently
// reduced-motion-safe. Cases: flip, board_auto_commit, and the P6b
// double_down — BOTH sides, with the ruling that an ABSENT `side` reads as
// agent (the agent-side sibling omits it).

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { feedEventText } from '../../utils/tournamentSurfaces';

export default function GroupFeed({ feed, uid, limit = 8, title = 'Group feed' }) {
  const { tokens } = useTheme();
  const events = [...(feed || [])].reverse().slice(0, limit);
  if (events.length === 0) return null;

  return (
    <div style={{
      background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`,
      borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      {events.map((event, i) => {
        const isDD = event.type === 'double_down';
        return (
          <div key={`${event.timestamp ?? ''}-${i}`}
            style={{ fontSize: 12, color: tokens.textMuted, display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ color: tokens.textFaint, fontVariantNumeric: 'tabular-nums' }}>
              {String(event.timestamp ?? '').slice(5, 16).replace('T', ' ')}
            </span>
            <span style={{ flex: 1, color: isDD ? '#a855f7' : tokens.textMuted, fontWeight: isDD ? 700 : 400 }}>
              {feedEventText(event, uid)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
