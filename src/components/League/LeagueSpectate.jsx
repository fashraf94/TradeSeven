// src/components/League/LeagueSpectate.jsx
//
// Read-only battle view, FOUR players and the TWO-LAYER seat: a human's 3-stock
// pick layer + their agent's 6-stock auto-managed book, under one combined
// score. Transcribed from the Claude Design prototype (league-spectate.jsx).
//
// HONESTY (single lock rule): isReasoningLocked(pod) is the ONE definition of
// "locked". A live/upcoming pod's private reasoning is NEVER referenced in the
// DOM — REASONING is read only inside the unlocked branch. (When wired to real
// data, the server WHY-projection enforces the same gate; useSpectatedTournament-
// Battles already omits reasoning for live pods.)

import React from 'react';
import { rankPod, isReasoningLocked } from './leagueFixtures';
import { LTOKENS, LX, alpha } from './leagueTokens';
import {
  Eyebrow, Mono, Icon, LIcon, Tag, AgentAvatar, KindMark, Score, StatusBadge, Watchers, PortfolioMini, SectionLabel,
} from './LeagueParts';
import { CutLine } from './LeaguePod';

// fixture reasoning — only ever rendered for a SETTLED pod (the film room).
const REASONING = {
  atlas: "Leaned the defensive rotation early; flipped the NVDA pick to short on the CPI print while the agent held the long book steady.",
  vela: "Faded the euphoria in semis and claimed the staples capitulation overnight. Trimmed into strength twice.",
  orion: "Played the regime, not the tickers. Crude backwardation plus a flight-to-safety bid carried both layers.",
  lyra: "Rode momentum a session too long — should've cut the SMCI squeeze risk. Picks lagged, the agent book saved it.",
  cygnus: "Capital first. Sat small through the drawdown, never averaged down, banked the recovery.",
  draco: "Top-down energy call was right but I sized the COIN pick too heavy; the crypto drawdown ate the edge.",
  mira: "Pressed the chip leaders on the pick layer; let the agent diversify under me. High variance, paid off.",
  rigel: "Mean-reversion on the picks, defensive agent book. Low ceiling, high floor — exactly the plan.",
  helios: "Bought confirmed strength, cut weakness fast. Guardrails kept the NVDA short from getting away.",
  ember: "Faded the extremes a touch early. Reversion thesis held by the close.",
  basalt: "Defensive book, low variance. Goal was to not lose — accomplished.",
  quartz: "Macro tilt into energy + gold. Cleanest read of the week.",
  cobalt: "Chased momentum into a rotation. Wrong regime — the high-beta book bled.",
  nova: "Reversion calls were early; the tape never gave the snap-back in time.",
  sirius: "Energy + duration barbell. Steady, unspectacular, advanced anyway.",
  vega: "Sentinel book did its job on defense but the picks had no upside to bank.",
};

// fake-but-stable head-to-head history vs you
const RIVALRY = { vela: '2–1', orion: '2–1', cygnus: '1–1', mira: '0–2', lyra: '1–0', draco: '1–1' };

function bookChange(b) {
  if (!b || !b.length) return 0;
  const eq = 100 / b.length;
  return +b.reduce((s, h) => s + ((h.w != null ? h.w : eq) / 100) * h.c * (h.dir === 'short' ? -1 : 1), 0).toFixed(1);
}

// one layer panel (user picks / agent book)
function LayerPanel({ title, sub, book, accent, kind }) {
  const pnl = bookChange(book);
  return (
    <div style={{ flex: 1, minWidth: 0, borderRadius: 14, padding: '12px 13px', background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <LIcon name={kind === 'user' ? 'user' : 'cpu'} size={13} color={kind === 'user' ? LX.human : LX.cpu} stroke={2} />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>{title}</div>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>{sub}</Mono>
          </div>
        </div>
        <Score v={pnl} size={13} />
      </div>
      <PortfolioMini book={book} accent={accent} />
    </div>
  );
}

// locked / unlocked film room for the focused player
function FilmRoom({ player, locked }) {
  if (locked) {
    return (
      <div style={{ borderRadius: 16, padding: 16, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <Icon name="lock" size={15} color={LTOKENS.ink3} />
          <Eyebrow color={LTOKENS.ink3}>Film room · locked</Eyebrow>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[92, 70, 84].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: LTOKENS.ink3, flexShrink: 0 }} />
              <div style={{ height: 9, width: `${w}%`, borderRadius: 5, background: `repeating-linear-gradient(90deg, ${LTOKENS.raised}, ${LTOKENS.raised} 7px, ${LTOKENS.surface} 7px, ${LTOKENS.surface} 12px)` }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, paddingTop: 13, borderTop: `1px solid ${LTOKENS.hair}` }}>
          <Icon name="clock" size={14} color={LTOKENS.ink2} style={{ marginTop: 1 }} />
          <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.45 }}>
            You can watch every position and score live — but {player.name}&apos;s <b style={{ color: LTOKENS.ink }}>private reasoning stays sealed until the group completes.</b> Come back for the film room.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ borderRadius: 16, padding: 16, background: `linear-gradient(160deg, ${alpha(LTOKENS.gold, 0.06)}, ${LTOKENS.surface} 60%)`, border: `1px solid ${alpha(LTOKENS.gold, 0.22)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <Icon name="trophy" size={15} color={LTOKENS.gold} stroke={2} />
        <Eyebrow color={LTOKENS.gold}>Film room · unlocked</Eyebrow>
      </div>
      <div style={{ display: 'flex', gap: 11 }}>
        <AgentAvatar agent={player} size={30} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: LTOKENS.ink }}>{player.name}</span>
            <KindMark agent={player} />
          </div>
          <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.5 }}>{REASONING[player.id]}</div>
        </div>
      </div>
    </div>
  );
}

// compact selectable row in the focus standing
function FocusRow({ seat, on, accent, onClick, dim, base }) {
  return (
    <div
      className="lg-tap"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', margin: '0 -8px', borderRadius: 10, cursor: 'pointer',
        background: on ? alpha(accent, 0.1) : 'transparent', border: `1px solid ${on ? alpha(accent, 0.3) : 'transparent'}`,
        opacity: dim && !seat.advancing && !on ? 0.62 : 1,
      }}
    >
      <Mono style={{ fontSize: 12, fontWeight: 700, width: 14, textAlign: 'center', color: !base && seat.advancing ? LX.energy : LTOKENS.ink3 }}>{seat.rank}</Mono>
      <AgentAvatar agent={seat} size={28} />
      <span style={{ fontSize: 13, fontWeight: 600, color: LTOKENS.ink }}>{seat.name}</span>
      {seat.you && <Tag color={accent}>You</Tag>}
      <KindMark agent={seat} style={{ transform: 'scale(0.92)' }} />
      <div style={{ marginLeft: 'auto' }}><Score v={seat.pscore} size={14} /></div>
    </div>
  );
}

export default function Spectate({ pod, focusId, accent, onBack, onEnter }) {
  const ranked = rankPod(pod).filter((s) => !s.tbd);
  const live = pod.status === 'live';
  const base = !!pod.base;
  const locked = isReasoningLocked(pod);
  const [focus, setFocus] = React.useState(focusId || ranked[0]?.id);
  const player = ranked.find((s) => s.id === focus) || ranked[0];

  if (!player) return null; // a pod with no seated players is never spectatable
  const rival = !player.you && RIVALRY[player.id];

  return (
    <div style={{ position: 'relative', padding: '16px 18px calc(env(safe-area-inset-bottom, 0px) + 120px)', maxWidth: 720, margin: '0 auto', color: LTOKENS.ink }}>
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 320, height: 240, background: `radial-gradient(circle, ${alpha(player.color, 0.13)}, transparent 66%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button className="lg-tap" onClick={onBack} style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: LTOKENS.ink2 }}>
            <LIcon name="arrowL" size={17} color={LTOKENS.ink2} />
            <Mono style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Lobby</Mono>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={base ? LX.human : LTOKENS.ink3}>{base ? 'Weekly' : pod.round === 3 ? 'Final Four' : `Round ${pod.round}`} · {pod.name}</Tag>
            <StatusBadge status={pod.status} clock={live ? pod.clock : null} compact />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <LIcon name="eyeR" size={14} color={LTOKENS.ink3} />
          <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Spectating · read-only{live ? ' · live' : ' · final'}</Mono>
          <span style={{ marginLeft: 'auto' }}><Watchers n={pod.watchers} /></span>
        </div>

        {/* the four-player standing — context. tap to switch focus. bracket
            games show the cut line; base-layer (weekly) games don't. */}
        <div style={{ borderRadius: 16, padding: '6px 13px 8px', marginBottom: 18, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
          {base ? (
            ranked.map((s) => <FocusRow key={s.id} seat={s} on={s.id === focus} accent={accent} onClick={() => setFocus(s.id)} base />)
          ) : (
            <>
              {ranked.slice(0, 2).map((s) => <FocusRow key={s.id} seat={s} on={s.id === focus} accent={accent} onClick={() => setFocus(s.id)} />)}
              <CutLine />
              {ranked.slice(2).map((s) => <FocusRow key={s.id} seat={s} on={s.id === focus} accent={accent} onClick={() => setFocus(s.id)} dim />)}
            </>
          )}
        </div>

        {/* focused player — the TWO LAYERS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AgentAvatar agent={player} size={42} live={live} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: LTOKENS.ink }}>{player.name}</span>
              {player.you && <Tag color={accent}>You</Tag>}
              <KindMark agent={player} />
            </div>
            <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3 }}>{player.archName} · {player.kind === 'human' ? player.owner : 'CPU agent'}</Mono>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Score v={player.pscore} size={22} />
            <Mono style={{ fontSize: 8.5, color: LTOKENS.ink3, display: 'block', marginTop: 2, letterSpacing: '0.06em' }}>COMBINED</Mono>
          </div>
        </div>

        {/* rivalry */}
        {rival && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 12px', borderRadius: 11, background: alpha(LX.alert, 0.08), border: `1px solid ${alpha(LX.alert, 0.22)}` }}>
            <LIcon name="ranked" size={14} color={LX.alert} stroke={2} />
            <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.4 }}>
              You&apos;ve faced <b style={{ color: LTOKENS.ink }}>{player.name}</b> {(+rival.split('–')[0] + +rival.split('–')[1])}× — {player.name} leads <b style={{ color: LTOKENS.ink }}>{rival}</b>.
            </div>
          </div>
        )}

        <SectionLabel label="Two layers · one combined score" color={LTOKENS.ink3} right={<Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>3 picks + 6-stock book</Mono>} />
        <div className="lg-spec-layers" style={{ display: 'flex', gap: 11, marginBottom: 22 }}>
          <LayerPanel title="The human's picks" sub="3 STOCKS · CLAIMS & FLIPS" book={player.userBook} accent={player.color} kind="user" />
          <LayerPanel title="The agent's book" sub="6 STOCKS · AUTO-MANAGED" book={player.agentBook} accent={player.color} kind="agent" />
        </div>

        <SectionLabel label="Why they moved" color={LTOKENS.ink3} />
        <FilmRoom player={player} locked={locked} />

        {/* learn-from-loss social hook (only when you're eliminated) */}
        {player.you && !player.advancing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, padding: '11px 13px', borderRadius: 12, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
            <LIcon name="users" size={14} color={accent} />
            <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.4 }}>
              <b style={{ color: LTOKENS.ink }}>3 players beat your agent this week.</b> See how they traded in the film room.
            </div>
          </div>
        )}

        {/* you watched — now play */}
        <div style={{ marginTop: 24, padding: '17px 16px', borderRadius: 18, textAlign: 'center', background: `linear-gradient(160deg, ${alpha(accent, 0.12)}, ${LTOKENS.surface} 64%)`, border: `1px solid ${alpha(accent, 0.3)}` }}>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em' }}>This is what you&apos;d play.</div>
          <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.45, marginTop: 6 }}>
            Your 3 picks, your agent&apos;s 6-stock book, one combined score in a group of four. Top two advance — empty seats run as CPU.
          </div>
          {/* Re-pointed at the entry (P3): onEnter closes Spectate back onto the
              League center — the slot picker for a no-game viewer. Label names
              the DESTINATION, not a claim the button doesn't perform (P3b,
              /code-review triage #9 — an in-game viewer lands on their funnel). */}
          <button className="lg-tap" onClick={onEnter} style={{ all: 'unset', cursor: 'pointer', marginTop: 14, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', padding: 14, borderRadius: 13, background: accent, color: LTOKENS.bg, fontWeight: 700, fontSize: 14.5, boxShadow: `0 8px 24px ${alpha(accent, 0.3)}` }}>
            <LIcon name="play" size={15} color={LTOKENS.bg} /> Go to the draft slots
          </button>
        </div>
      </div>
    </div>
  );
}
