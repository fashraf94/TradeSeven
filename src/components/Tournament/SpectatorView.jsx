// src/components/Tournament/SpectatorView.jsx
//
// P6b — the spectator hierarchy (Proposal C), tiers 2 and 3. From a
// leaderboard row you land here: the bracket/round context (one
// subscribeBracket), a group standings card (composite — the score of record
// — with CPU marks + you-highlight), the existing draft theater CTA, and a
// battle-view CTA that DEGRADES HONESTLY to P7: the player strip + agent/user
// lines from the data in hand, labeled — never a dead button, never a fake
// screen. Tokens-native; the theater owns its own (reduced-motion-aware)
// motion, this shell is static.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Swords, PlayCircle, Trophy } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import DraftPlaybackTheater from './DraftPlaybackTheater';
import { subscribeBracket } from '../../services/tournamentGroupService';
import { parseBracketGameId } from '../../constants/leagueTournament';
import { spectatorBattleSummary } from '../../utils/tournamentSurfaces';

export default function SpectatorView({ group, uid, onBack }) {
  const { tokens } = useTheme();
  const [bracket, setBracket] = useState(null);
  const [showTheater, setShowTheater] = useState(false);
  const [showBattle, setShowBattle] = useState(false);

  const parsed = group?.bracketGameId ? parseBracketGameId(group.bracketGameId) : null;
  const bracketId = parsed?.bracketId || null;

  useEffect(() => {
    if (!bracketId) { setBracket(null); return undefined; }
    return subscribeBracket(bracketId, setBracket);
  }, [bracketId]);

  const summary = useMemo(
    () => (group ? spectatorBattleSummary(group, { uid }) : null),
    [group, uid],
  );
  if (!group) return null;
  const game = bracket?.rounds?.[`r${parsed?.roundNumber}`]?.games?.[group.bracketGameId] || null;

  const card = { background: tokens.bgCard, border: `1px solid ${tokens.borderDivider}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 };
  const cta = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px',
    borderRadius: 10, border: `1px solid ${tokens.borderInput}`, cursor: 'pointer',
    background: active ? tokens.bgApp : 'transparent', color: tokens.textPrimary, fontWeight: 700, fontSize: 13,
  });
  const name = (p) => (p.isYou ? 'You' : p.odUserId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {onBack && (
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: tokens.textMuted, cursor: 'pointer', fontSize: 12, padding: 0 }}>
          <ChevronLeft size={14} /> Back to leaderboard
        </button>
      )}

      {/* Tier 2: bracket / round context */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={16} color={tokens.medalGold} />
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
            {parsed ? `Bracket round ${parsed.roundNumber}` : `Base week ${group.baseLayerWeek ?? ''}`}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: tokens.textMuted }}>
            {bracket ? String(bracket.status).toUpperCase() : group.id}
          </span>
        </div>
        {game?.advancers && (
          <div style={{ fontSize: 11, color: tokens.textMuted }}>
            Advancing: <span style={{ fontWeight: 700, color: '#10b981' }}>{game.advancers.map(id => (id === uid ? 'You' : id)).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Group standings (composite of record) */}
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Group standings</div>
        {summary.players.map((p, i) => (
          <div key={p.odUserId} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, padding: '3px 6px', borderRadius: 6, background: p.isYou ? 'rgba(20,184,166,0.12)' : 'transparent' }}>
            <span style={{ color: tokens.textFaint, width: 18 }}>#{i + 1}</span>
            <span style={{ flex: 1, fontWeight: p.isYou ? 800 : 500, color: p.isYou ? '#14b8a6' : tokens.textPrimary }}>
              {name(p)}{p.isCpu && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}> CPU</span>}
            </span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.composite < 0 ? '#ef4444' : tokens.textPrimary }}>
              {p.composite >= 0 ? '+' : ''}{p.composite}
            </span>
          </div>
        ))}
      </div>

      {/* Spectate the draft (the existing theater, by groupId) */}
      <button style={cta(showTheater)} onClick={() => setShowTheater(s => !s)}>
        <PlayCircle size={16} /> {showTheater ? 'Hide the draft replay' : 'Spectate the draft'}
      </button>
      {showTheater && <DraftPlaybackTheater groupId={group.id} group={group} uid={uid} />}

      {/* Tier 3: battle view — honest P7 degrade */}
      <button style={cta(showBattle)} onClick={() => setShowBattle(s => !s)}>
        <Swords size={16} /> {showBattle ? 'Hide battle view' : 'Open battle view'}
      </button>
      {showBattle && (
        <div style={card}>
          <div style={{ fontSize: 11, color: tokens.amber }}>
            Full battle view arrives with the tournament battle screen. Here's the standing from the data in hand:
          </div>
          {summary.players.map((p) => (
            <div key={p.odUserId} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0', borderTop: `1px solid ${tokens.borderDivider}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ flex: 1, fontWeight: 700, color: p.isYou ? '#14b8a6' : tokens.textPrimary }}>
                  {name(p)}{p.isCpu && <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8' }}> CPU</span>}
                </span>
                <span style={{ fontSize: 11, color: tokens.textMuted }}>
                  user {p.userPoints} · agent {p.agentPoints} · <b style={{ color: tokens.textPrimary }}>{p.composite >= 0 ? '+' : ''}{p.composite}</b>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.picks.length === 0
                  ? <span style={{ fontSize: 11, color: tokens.textFaint }}>no picks</span>
                  : p.picks.map(pick => (
                    <span key={pick.symbol} style={{ fontSize: 11, fontWeight: 700 }}>
                      {pick.symbol}
                      <span style={{ color: pick.direction === 'short' ? '#ef4444' : '#10b981' }}> {pick.direction === 'short' ? '↓' : '↑'}</span>
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
