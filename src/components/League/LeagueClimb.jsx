// src/components/League/LeagueClimb.jsx
//
// The Altitude Climb screen — the colorful five-day pod standing: top bar,
// headline, the altitude chart card, the vivid standing, the finish (training)
// or verdict (ranked), and the two sheets. Ported from league-climb-app.jsx
// (the iOS frame / scaling / Tweaks harness dropped — this renders as the
// redesign's centered mobile column). Props { mode:'live'|'final',
// ctx:'training'|'ranked', onBack }. Fixtures-backed (next-arc, dev/dark).

import React from 'react';
import './league.css';
import { LTOKENS, alpha } from './leagueTokens';
import { Mono, Icon, LIcon, Tag, SectionLabel, StatusBadge } from './LeagueParts';
import { AltitudeClimb, ClimbLegend } from './LeagueClimbChart';
import {
  ClimbStanding, ClimbFinish, ClimbVerdict, ClimbDaySheet, ClimbPlayerSheet,
} from './LeagueClimbStanding';
import { clbRankAt } from './leagueClimbFixtures';

export default function LeagueClimb({ mode = 'live', ctx = 'training', onBack }) {
  const live = mode === 'live';
  const [focusLine, setFocusLine] = React.useState(null);
  const [drawKey, setDrawKey] = React.useState(0);
  const [daySheet, setDaySheet] = React.useState(null);
  const [playerSheet, setPlayerSheet] = React.useState(null);

  // replay the ascent when the state/context changes (the keyed wrapper remounts)
  React.useEffect(() => { setDrawKey((k) => k + 1); setFocusLine(null); }, [mode, ctx]);

  const lastIdx = live ? 3 : 4;
  const ranked = clbRankAt(lastIdx);
  const leader = ranked[0];
  const you = ranked.find((s) => s.you);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', maxWidth: 448, margin: '0 auto', background: LTOKENS.bg, color: LTOKENS.ink, overflow: 'hidden' }}>
      {/* the arena's colored aura — this is the game view, it lights up */}
      <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', width: 360, height: 240,
        background: `radial-gradient(circle, ${alpha(you.color, 0.1)}, transparent 66%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div key={drawKey} style={{ position: 'relative', zIndex: 1, padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 40px)' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button className="lg-tap" onClick={onBack} style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: LTOKENS.ink2 }}>
            <LIcon name="arrowL" size={17} color={LTOKENS.ink2} />
            <Mono style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>League</Mono>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={ctx === 'training' ? LTOKENS.teal : LTOKENS.gold}>{ctx === 'training' ? 'Training' : 'Ranked · East'}</Tag>
            <StatusBadge status={live ? 'live' : 'final'} clock={live ? 14400 : null} compact />
          </div>
        </div>

        {/* eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <LIcon name="ranked" size={14} color={LTOKENS.ink3} stroke={2} />
          <Mono style={{ fontSize: 10.5, color: LTOKENS.ink3, letterSpacing: '0.12em', textTransform: 'uppercase' }}>The climb · five daily closes</Mono>
        </div>

        {/* headline */}
        <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.08, marginBottom: 7 }}>
          {live
            ? <>Day&nbsp;4 — <span style={{ color: you.color }}>climbing</span></>
            : ctx === 'training'
              ? <>Summit reached. <span style={{ color: you.color }}>You finished #{you.rank}.</span></>
              : <>The summit. <span style={{ color: LTOKENS.gold }}>The verdict.</span></>}
        </div>
        <div style={{ fontSize: 12.5, color: LTOKENS.ink2, lineHeight: 1.5, marginBottom: 18 }}>
          {live
            ? <>Four climbers, one altitude each, traced gate to gate. Today is live until <b style={{ color: LTOKENS.ink }}>4:00 PM ET</b> — one gate still to climb. Heights move as the tape moves.</>
            : ctx === 'training'
              ? <>The full shape of the week — every surge, the dip, the overtake at the summit. This is <b style={{ color: LTOKENS.ink }}>training</b>: solo practice, no stakes, no cut.</>
              : <>Five gates climbed. The summit is the cut: <b style={{ color: LTOKENS.ink }}>top two advance.</b> The whole ascent in one glance.</>}
        </div>

        {/* ── the altitude climb card ── */}
        <div style={{ borderRadius: 18, padding: '14px 8px 10px', marginBottom: 8,
          background: `linear-gradient(180deg, ${LTOKENS.surface}, ${alpha(LTOKENS.surface, 0.55)})`,
          border: `1px solid ${LTOKENS.hair}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px -20px rgba(0,0,0,0.85)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 6px' }}>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>↑ Altitude</Mono>
            <button className="lg-tap" onClick={() => setDrawKey((k) => k + 1)} style={{ all: 'unset', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999,
              background: LTOKENS.raised, border: `1px solid ${LTOKENS.hair}` }}>
              <Icon name="refresh" size={11} color={LTOKENS.ink2} />
              <Mono style={{ fontSize: 9, color: LTOKENS.ink2, letterSpacing: '0.04em' }}>Replay climb</Mono>
            </button>
          </div>
          <AltitudeClimb mode={mode} focusLine={focusLine}
            onDay={(i) => setDaySheet(i)} onPlayer={(id) => setPlayerSheet(id)} />
          <ClimbLegend mode={mode} focusLine={focusLine} onFocus={setFocusLine} />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3, letterSpacing: '0.03em' }}>Tap a gate for that close · tap a climber for their full ascent</Mono>
          </div>
        </div>

        {/* hero read */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18, marginTop: 14, padding: '11px 13px', borderRadius: 12,
          background: alpha(live ? you.color : leader.color, 0.08), border: `1px solid ${alpha(live ? you.color : leader.color, 0.24)}` }}>
          <LIcon name={live ? 'eyeR' : 'crown'} size={15} color={live ? you.color : LTOKENS.gold} stroke={2} />
          <div style={{ fontSize: 12, color: LTOKENS.ink2, lineHeight: 1.4 }}>
            {live
              ? <><b style={{ color: you.color }}>You&apos;re #{you.rank}</b> with one gate to climb — {leader.name} is {(leader.pscore - you.pscore).toFixed(1)} higher. One strong close flips it.</>
              : <><b style={{ color: leader.color }}>{leader.name}</b> led the climb wire-to-wire; <b style={{ color: you.color }}>you</b> surged past Helios at the summit for #{you.rank}.</>}
          </div>
        </div>

        {/* ── the vivid standing ── */}
        <SectionLabel label={live ? 'On the slope · live' : ctx === 'training' ? 'Final order · your climb' : 'Final standing · the cut'} color={LTOKENS.ink3}
          right={ctx === 'ranked' ? <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>top 2 advance</Mono> : <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>no stakes</Mono>} />
        <ClimbStanding mode={mode} ctx={ctx} onPlayer={(id) => setPlayerSheet(id)} />

        {/* ── finish (training) / verdict (ranked) ── */}
        {!live && <div style={{ marginTop: 18 }}>{ctx === 'training' ? <ClimbFinish /> : <ClimbVerdict />}</div>}

        {/* footer — note the two layers, NEVER the weighting */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 18 }}>
          <Icon name="layers" size={13} color={LTOKENS.ink3} style={{ marginTop: 1 }} />
          <Mono style={{ fontSize: 9.5, color: LTOKENS.ink3, lineHeight: 1.5, letterSpacing: '0.02em' }}>
            Each climber rides one altitude — their three-pick hand and six-stock agent book, combined into a single score of record. Tap a climber to split it. {live ? 'Opponents’ reasoning stays sealed until the climb completes.' : 'The pod’s film room is unlocked.'}
          </Mono>
        </div>
      </div>

      {daySheet != null && <ClimbDaySheet dayIdx={daySheet} mode={mode} onClose={() => setDaySheet(null)} onPlayer={(id) => setPlayerSheet(id)} />}
      {playerSheet && <ClimbPlayerSheet playerId={playerSheet} mode={mode} ctx={ctx} onClose={() => setPlayerSheet(null)} />}
    </div>
  );
}
