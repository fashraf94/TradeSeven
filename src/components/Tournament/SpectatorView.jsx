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
import Flat6BattleView from './Flat6BattleView';
import useSpectatedTournamentBattles from '../../hooks/useSpectatedTournamentBattles';
import { subscribeBracket } from '../../services/tournamentGroupService';
import { parseBracketGameId } from '../../constants/leagueTournament';
import { spectatorBattleSummary } from '../../utils/tournamentSurfaces';

export default function SpectatorView({ group, uid, onBack }) {
  const { tokens } = useTheme();
  const [bracket, setBracket] = useState(null);
  const [showTheater, setShowTheater] = useState(false);
  const [showBattle, setShowBattle] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);

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

  // Spectator battle source: the group's battles, each PROJECTED server-side
  // for this viewer (WHY concealed for non-owner active reads). Fetched only
  // while the battle view is open.
  const { battles, loading: spectateLoading } = useSpectatedTournamentBattles(group?.id, showBattle);

  // Default the selection to your seat when present, else the leader.
  useEffect(() => {
    if (!showBattle || !summary?.players?.length) return;
    setSelectedOwner((cur) => {
      if (cur && summary.players.some(p => p.odUserId === cur)) return cur;
      const you = summary.players.find(p => p.isYou);
      return you ? you.odUserId : summary.players[0].odUserId;
    });
  }, [showBattle, summary]);

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

      {/* Tier 3: the real flat6 battle view (replaces the P6b honest degrade).
          Read-only spectator mode — WHAT live to all, WHY concealed server-side
          for non-owner active battles, full WHY at completion (V2.1 §9). */}
      <button style={cta(showBattle)} onClick={() => setShowBattle(s => !s)}>
        <Swords size={16} /> {showBattle ? 'Hide battle view' : 'Open battle view'}
      </button>
      {showBattle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* whose battle */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {summary.players.map((p) => {
              const active = p.odUserId === selectedOwner;
              return (
                <button key={p.odUserId} onClick={() => setSelectedOwner(p.odUserId)} style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${active ? tokens.teal : tokens.borderInput}`,
                  background: active ? tokens.bgApp : 'transparent',
                  color: p.isYou ? '#14b8a6' : tokens.textPrimary,
                }}>
                  {name(p)}{p.isCpu && <span style={{ fontSize: 9, color: '#94a3b8' }}> CPU</span>}
                </button>
              );
            })}
          </div>
          {(() => {
            const selPlayer = summary.players.find(p => p.odUserId === selectedOwner) || null;
            const selBattle = selectedOwner ? battles[selectedOwner] : null;
            if (!selBattle) {
              return (
                <div style={card}>
                  <span style={{ fontSize: 11, color: tokens.textMuted }}>
                    {spectateLoading ? 'Loading the battle…' : 'No battle for this player yet.'}
                  </span>
                </div>
              );
            }
            return (
              <Flat6BattleView
                battle={selBattle}
                isOwner={selectedOwner === uid}
                compositeContext={selPlayer ? { composite: selPlayer.composite, userPoints: selPlayer.userPoints } : null}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
