// src/components/Tournament/LeaderboardCard.jsx
//
// P6b — the seasonal leaderboard surface (Spec §1.5; dev-screen mounted now,
// League home at P9). Month nav by doc key (chevrons over 'YYYY-MM',
// boundary-clamped via monthNavState), signed rows sorted where they fall
// (negatives red — the cautionary-learning ruling, honest not shameful), CPU
// chips, you-row teal highlight, row → tier-2 spectator entry via
// currentGroupId. The consensus/contrarian cards read the C-1 derived feeds.
// Tokens-native; static (reduced-motion-safe by construction).

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeLeaderboard } from '../../services/tournamentGroupService';
import { leaderboardDocId, shiftMonthKey } from '../../constants/leagueTournament';
import { etMonthKey, monthNavState } from '../../utils/tournamentSurfaces';

export default function LeaderboardCard({ uid, dev = false, initialMonthKey, onOpenGroup }) {
  const { tokens } = useTheme();
  const currentMonthKey = useMemo(() => etMonthKey(), []);
  const [monthKey, setMonthKey] = useState(initialMonthKey || currentMonthKey);
  const [doc, setDoc] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    return subscribeLeaderboard(leaderboardDocId(monthKey, { dev }), (d) => { setDoc(d); setLoaded(true); });
  }, [monthKey, dev]);

  const { canNewer, canOlder } = monthNavState({ monthKey, currentMonthKey, docExists: !!doc });
  const rows = useMemo(
    () => Object.values(doc?.entries || {}).sort((a, b) => (b.points ?? 0) - (a.points ?? 0)),
    [doc],
  );

  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 14 };
  const chev = (enabled) => ({
    background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default',
    color: enabled ? tokens.textPrimary : tokens.textFaint, padding: 4, opacity: enabled ? 1 : 0.4,
    display: 'inline-flex', alignItems: 'center',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={16} color={tokens.medalGold} />
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Leaderboard{dev ? ' (dev)' : ''}</div>
          <button style={chev(canOlder)} disabled={!canOlder}
            onClick={() => canOlder && setMonthKey(shiftMonthKey(monthKey, -1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, minWidth: 64, textAlign: 'center' }}>
            {monthKey}
          </span>
          <button style={chev(canNewer)} disabled={!canNewer}
            onClick={() => canNewer && setMonthKey(shiftMonthKey(monthKey, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>

        {!loaded ? (
          <div style={{ fontSize: 12, color: tokens.textMuted }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: tokens.textMuted }}>No board for {monthKey} yet.</div>
        ) : rows.map((entry, i) => {
          const mine = entry.odUserId === uid;
          const clickable = !!entry.currentGroupId && !!onOpenGroup;
          return (
            <button key={entry.odUserId} disabled={!clickable}
              onClick={() => clickable && onOpenGroup(entry.currentGroupId)}
              style={{
                display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '4px 8px',
                borderRadius: 6, border: 'none', textAlign: 'left', width: '100%',
                cursor: clickable ? 'pointer' : 'default',
                background: mine ? 'rgba(20,184,166,0.12)' : 'transparent',
              }}>
              <span style={{ color: tokens.textFaint, fontVariantNumeric: 'tabular-nums', width: 22 }}>#{i + 1}</span>
              <span style={{ flex: 1, fontWeight: mine ? 800 : 500, color: mine ? '#14b8a6' : tokens.textPrimary }}>
                {mine ? 'You' : entry.displayName}
                {entry.isCpu && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}> CPU</span>}
              </span>
              <span style={{ fontSize: 10, color: tokens.textFaint }}>{Object.keys(entry.weeks || {}).length} wk</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: (entry.points ?? 0) < 0 ? '#ef4444' : tokens.textPrimary }}>
                {(entry.points ?? 0) >= 0 ? '+' : ''}{entry.points}
              </span>
            </button>
          );
        })}
      </div>

      {doc?.feeds && <LeaderboardFeeds feeds={doc.feeds} />}
    </div>
  );
}

/** The C-1 consensus + contrarian cards (open cards — named). */
function LeaderboardFeeds({ feeds }) {
  const { tokens } = useTheme();
  const consensus = feeds.consensus || [];
  const contrarian = feeds.contrarian || [];
  if (consensus.length === 0 && contrarian.length === 0) return null;
  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 };
  const row = { display: 'flex', gap: 8, fontSize: 12, color: tokens.textMuted, padding: '2px 0' };

  return (
    <>
      {consensus.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Consensus · the crowd's favorites</div>
          {consensus.map(c => (
            <div key={c.symbol} style={row}>
              <span style={{ flex: 1, fontWeight: 700, color: tokens.textPrimary }}>{c.symbol}</span>
              <span>{c.userHolders} user{c.userHolders === 1 ? '' : 's'} · {c.agentHolders} agent{c.agentHolders === 1 ? '' : 's'}</span>
            </div>
          ))}
        </div>
      )}
      {contrarian.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Contrarian · the lonely winners</div>
          {contrarian.map(c => (
            <div key={c.symbol} style={row}>
              <span style={{ fontWeight: 700, color: tokens.textPrimary }}>{c.symbol}</span>
              <span style={{ flex: 1, color: tokens.textFaint }}>{(c.names || []).join(', ')}</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>+{c.bestComposite}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
