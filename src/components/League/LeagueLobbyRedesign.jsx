// src/components/League/LeagueLobbyRedesign.jsx
//
// Community landing, built around the bracket FUNNEL. The spectacle is the
// welcome mat; "Enter tournament" is one layer in. One layout, three fill
// levels (no separate empty state). No skill tiers — divisions are rounds ×
// groups. Transcribed from the Claude Design prototype (league-lobby.jsx).

import React from 'react';
import { rankPod } from './leagueFixtures';
import { LTOKENS, LX, alpha } from './leagueTokens';
import { Eyebrow, Mono, Icon, LIcon, AgentAvatar, Score, StatusBadge } from './LeagueParts';
import { Funnel, PodCard } from './LeaguePod';

function EnterButton({ accent, onEnter }) {
  return (
    <button
      className="lg-tap"
      onClick={onEnter}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px', borderRadius: 16,
        background: `linear-gradient(120deg, ${alpha(accent, 0.22)}, ${alpha(accent, 0.08)})`,
        border: `1px solid ${alpha(accent, 0.45)}`, boxShadow: `0 8px 28px ${alpha(accent, 0.18)}, inset 0 1px 0 ${alpha('#ffffff', 0.06)}`,
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${alpha(accent, 0.4)}` }}>
        <LIcon name="play" size={17} color={LTOKENS.bg} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>Enter tournament</div>
        <Mono style={{ fontSize: 11, color: alpha(accent, 0.95) }}>Claim a seat · top 2 of your group advance</Mono>
      </div>
      <Icon name="arrowR" size={20} color={accent} />
    </button>
  );
}

function Stat({ n, label, dot, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: muted ? LTOKENS.ink3 : dot, flexShrink: 0 }} />
      <Mono style={{ fontSize: 15, fontWeight: 700, color: muted ? LTOKENS.ink3 : LTOKENS.ink }}>{n}</Mono>
      <Mono style={{ fontSize: 11, color: LTOKENS.ink3 }}>{label}</Mono>
    </div>
  );
}

function LobbyHero({ st, accent }) {
  const big = st.energy === 'high';
  const liveCount = [...st.rounds.r1, ...st.rounds.r2, st.rounds.r3].filter((p) => p.status === 'live').length;
  const humans = Object.values(st.field).filter((p) => p.kind === 'human').length;
  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      {big && <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', width: 280, height: 160, background: `radial-gradient(circle, ${alpha(accent, 0.14)}, transparent 70%)`, pointerEvents: 'none' }} />}
      <div style={{ position: 'relative' }}>
        <Eyebrow color={accent} style={{ marginBottom: big ? 11 : 9 }}>TradeSeven · League</Eyebrow>
        <div style={{ fontSize: big ? 30 : 24, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{st.headline}</div>
        {(big || st.energy === 'mid') && <div style={{ fontSize: 13.5, color: LTOKENS.ink2, lineHeight: 1.5, marginTop: 9, maxWidth: 340 }}>{st.sub}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 13, flexWrap: 'wrap' }}>
          <Stat n={liveCount} label={liveCount === 1 ? 'pod live' : 'pods live'} dot={LX.energy} />
          <Stat n={humans} label="players" dot={LX.human} muted={humans === 0} />
          <Stat n={16 - humans} label="CPU agents" dot={LX.cpu} />
        </div>
      </div>
    </div>
  );
}

// "live now · people you follow" presence rail
function FollowRail({ items, onSpectate }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <LIcon name="users" size={13} color={LTOKENS.ink3} />
        <Eyebrow color={LTOKENS.ink3}>Live now · people you follow</Eyebrow>
      </div>
      <div className="lg-scroll" style={{ display: 'flex', gap: 9, overflowX: 'auto', margin: '0 -18px', padding: '0 18px 4px' }}>
        {items.map(({ player, pod }) => (
          <button
            key={player.id}
            className="lg-tap"
            onClick={() => onSpectate(pod, player.id)}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px 8px 8px', borderRadius: 13, flexShrink: 0, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}
          >
            <AgentAvatar agent={player} size={34} live />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: LTOKENS.ink }}>{player.name}</span>
                <Score v={player.score} size={12} />
              </div>
              <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3 }}>{pod.name} · {pod.watchers} watching</Mono>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// "Your group" — named pod as micro-community. Surfaced prominently.
function YourGroup({ st, accent, onPick }) {
  const pod = st.rounds.r1.find((p) => p.id === st.yourGroup.id);
  if (!pod) return null;
  const ranked = rankPod(pod);
  const me = ranked.find((s) => s.you);
  const mates = pod.seats.filter((s) => s && !s.you);
  return (
    <div style={{ borderRadius: 18, padding: '14px 15px', marginBottom: 18, background: `linear-gradient(160deg, ${alpha(accent, 0.1)}, ${LTOKENS.surface} 62%)`, border: `1px solid ${alpha(accent, 0.3)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Eyebrow color={accent}>Your group · {pod.name}</Eyebrow>
        <StatusBadge status={pod.status} clock={pod.status === 'live' ? pod.clock : null} compact />
      </div>
      <div style={{ fontSize: 13, color: LTOKENS.ink2, lineHeight: 1.45, marginBottom: 12 }}>
        You&apos;re in the <b style={{ color: LTOKENS.ink }}>{pod.name}</b> pod with {mates.map((m, i) => (
          <span key={m.id}>{i > 0 ? (i === mates.length - 1 ? ' and ' : ', ') : ''}<span style={{ color: m.kind === 'cpu' ? LX.cpu : LTOKENS.ink }}>{m.kind === 'cpu' ? `${m.name} (CPU)` : (m.owner || m.name)}</span></span>
        ))}. Top two advance to Round 2.
      </div>
      {me && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, background: LTOKENS.bg, border: `1px solid ${alpha(accent, 0.25)}` }}>
          <Mono style={{ fontSize: 12, fontWeight: 700, color: me.advancing ? accent : LX.neg }}>#{me.rank}</Mono>
          <span style={{ fontSize: 12.5, color: LTOKENS.ink, fontWeight: 600 }}>{me.name} (you)</span>
          <Mono style={{ fontSize: 9.5, color: me.advancing ? LX.energy : LTOKENS.ink3, letterSpacing: '0.06em' }}>{me.advancing ? 'ADVANCING' : 'ON THE BUBBLE'}</Mono>
          <div style={{ marginLeft: 'auto' }}><Score v={me.pscore} size={15} /></div>
        </div>
      )}
      <button className="lg-tap" onClick={() => onPick(pod)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 11, padding: '10px', borderRadius: 10, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair2}` }}>
        <Mono style={{ fontSize: 11, color: accent, fontWeight: 600, letterSpacing: '0.04em' }}>Open the group standing</Mono>
        <Icon name="arrowR" size={14} color={accent} />
      </button>
    </div>
  );
}

// the front door to the live participant flow (board commit / battle / claims /
// draft). LeagueHome passes onOpenMyGame; LeagueScreen pushes it full-screen.
function MyGameBar({ onOpenMyGame }) {
  return (
    <button
      className="lg-tap"
      onClick={onOpenMyGame}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 14px', borderRadius: 13, marginBottom: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: LX.energy, boxShadow: `0 0 6px ${LX.energy}`, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: LTOKENS.ink }}>Open my game</span>
      <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>your live battle · claims · draft</Mono>
      <Icon name="arrowR" size={16} color={LX.energy} style={{ marginLeft: 'auto' }} />
    </button>
  );
}

// ── The lobby shell (content; LeagueHome owns the scroll wrapper) ───────────
export default function Lobby({ st, accent, onEnter, onPickPod, onSpectate, onOpenMyGame }) {
  return (
    <div style={{ padding: '16px 18px calc(env(safe-area-inset-bottom, 0px) + 120px)', maxWidth: 720, margin: '0 auto' }}>
      {onOpenMyGame && <MyGameBar onOpenMyGame={onOpenMyGame} />}
      <EnterButton accent={accent} onEnter={onEnter} />
      <div style={{ height: 22 }} />
      <LobbyHero st={st} accent={accent} />

      <FollowRail items={st.followLive} onSpectate={onSpectate} />

      {/* THE FUNNEL — the hero. resting state of the whole bracket. */}
      <div style={{ borderRadius: 20, padding: '16px 12px 14px', marginBottom: 18, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 14 }}>
          <Eyebrow color={LTOKENS.ink3}>The bracket · 16 → 8 → 4 → 1</Eyebrow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: LX.energy, boxShadow: `0 0 6px ${LX.energy}` }} />
            <Mono style={{ fontSize: 9.5, color: LX.energy, letterSpacing: '0.06em' }}>YOUR PATH</Mono>
          </div>
        </div>
        <Funnel st={st} onPick={onPickPod} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>Tap any pod to open its live four-player standing</Mono>
        </div>
      </div>

      {/* YOUR GROUP — the named pod as your micro-community. */}
      <YourGroup st={st} accent={accent} onPick={onPickPod} />

      {/* THE FIELD — always-on weekly base-layer groups of four. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <Eyebrow color={LTOKENS.ink3}>The field · weekly base-layer groups</Eyebrow>
      </div>
      <div style={{ fontSize: 11.5, color: LTOKENS.ink3, lineHeight: 1.4, marginBottom: 12 }}>
        Always-on groups of four that everyone plays. These feed the leaderboard — they don&apos;t ladder into the bracket.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {st.baseGames.map((pod) => <PodCard key={pod.id} pod={pod} accent={accent} onSpectate={(seat) => onSpectate(pod, seat.id)} />)}
      </div>

      <div style={{ textAlign: 'center', marginTop: 26 }}>
        <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Empty seats run as CPU · your group locks Monday
        </Mono>
      </div>
    </div>
  );
}
