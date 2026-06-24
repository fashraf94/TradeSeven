// src/components/League/battleArena/ArenaMobile.jsx
//
// League Battle View V2 — THE MOBILE ARENA. The desktop dock doesn't shrink to a
// phone, so the SAME model (buildArenaModel) is rearranged for a narrow screen: a
// PINNED hero (top strip + climb, sticky as the body scrolls) above a THREE-TAB
// body — Your Portfolio (your three) · Agent Portfolio (the agent's six) · Chat
// (the agent's voice). A beat that fires on a tab you're not viewing pulses that
// tab's dot (arenaBeatTab).
//
// It is a presentational sibling of ArenaDesktop — same `data ?? fixtureModel`
// fallback, the SAME useArenaEngine wiring, and the SAME flip/claim writes through
// the shared handlers. The flip path reuses useArenaFlips (the optimistic-write +
// server-authoritative ROLLBACK contract), NOT a local optimistic-only stub.
//
// Reduced-motion safe (all looping motion is CSS the global guard neutralizes; the
// transient surge/fly/beat effects are JS-gated in their primitives).

import React from 'react';
import { Mono, Eyebrow, LIcon, Icon } from '../LeagueParts';
import { LTOKENS, alpha } from '../leagueTokens';
import { ArenaTopStrip, BeatCaption, ArenaOrb, MeterKey } from './ArenaPrimitives';
import { ClimbArena } from './ClimbArena';
import { StarCell } from './StarCell';
import { FlipControl, AgentDock, AgentMoveChip } from './CommandDock';
import { VoiceLane } from './VoiceLane';
import { FreeAgencyDoorway, OpponentSnapshot, FilmRoomOverlay } from './ArenaOverlays';
import { useArenaEngine } from './useArenaEngine';
import { useArenaFlips } from './useArenaFlips';
import { beatTabs } from './arenaBeatTab';
import { frameDayIdx } from './arenaStateMap';
import { liveDayIdx } from './buildArenaModel';
import { buildFixtureModel } from './buildFixtureModel';
import { OWN_AGENT, OWN_YOU } from './arenaTheme';
import { prefersReducedMotion } from './arenaEngineCore';

const HERO_W_FALLBACK = 360;     // SSR / pre-measure width (renderToString runs no effects)
const HERO_H = 384;              // live / complete hero height
const HERO_H_CALM = 404;         // awaiting reads a touch taller (the rest frame)
// overlays cap their fixed width to the phone; on desktop this never narrows them.
const SHEET_FIT = 'min(460px, calc(100% - 28px))';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ArenaMobile({ state, mode, headline = 'mult', onBack = null, data = null, handlers = null }) {
  const live = state === 'live';
  const done = state === 'complete';
  const calm = state === 'awaiting';

  // Same fixtures fallback as ArenaDesktop — MEMOIZED on [state] (identity-stable,
  // so the preview beat-loop doesn't restart each render).
  const fixtureModel = React.useMemo(() => buildFixtureModel(state), [state]);
  const D = data ?? fixtureModel;

  // Identical engine wiring to ArenaDesktop (object signature; live vs preview).
  const eng = useArenaEngine({
    active: live, voice: D.voice, ask: D.ask,
    beats: data ? null : D.beats,
    live: !!data, liveBeats: data ? D.beats : null,
    closeStart: calm ? (D.pod.toOpen ?? 0) : (D.pod.nextClose ?? 0),
    wireStart: D.wire.closes ?? 0,
  });

  const [tab, setTab] = React.useState('you');   // you · agent · chat
  const [pulse, setPulse] = React.useState({});  // { tabId: beatStar.key } — unseen beats
  const [opp, setOpp] = React.useState(null);
  const [filmOpen, setFilmOpen] = React.useState(false);
  const [faOpen, setFaOpen] = React.useState(false);
  React.useEffect(() => { setTab('you'); setPulse({}); setOpp(null); setFilmOpen(false); setFaOpen(false); }, [state, mode]);

  const lastIdx = data ? liveDayIdx(D.climb) : frameDayIdx(state);
  const beatStar = live ? eng.beatStar : null;
  const cellBump = (tk) => (beatStar && beatStar.tk === tk ? beatStar.key : 0);

  // book membership for the pulse router (content-stable on the star rows)
  const agentTks = React.useMemo(() => new Set((D.agentStars || []).map((s) => s.tk)), [D.agentStars]);
  const yourTks = React.useMemo(() => new Set((D.userStars || []).map((s) => s.tk)), [D.userStars]);

  // measure the hero width so the climb SVG fits the actual phone (renderToString
  // keeps the fallback — effects don't run there).
  const heroRef = React.useRef(null);
  const [heroW, setHeroW] = React.useState(HERO_W_FALLBACK);
  React.useEffect(() => {
    const compute = () => { const el = heroRef.current; if (el && el.clientWidth) setHeroW(Math.max(280, el.clientWidth)); };
    compute();
    const raf = requestAnimationFrame(compute);
    let ro;
    if (typeof ResizeObserver !== 'undefined' && heroRef.current) { ro = new ResizeObserver(compute); ro.observe(heroRef.current); }
    window.addEventListener('resize', compute);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('resize', compute); };
  }, []);

  // route a beat to the tab(s) it belongs to; pulse any that aren't the ACTIVE tab.
  // Keyed on the persistent beatStar.key (fires once per new star-beat); `tab` is
  // read via a ref so switching tabs never re-fires a pulse for an old beat.
  const tabRef = React.useRef(tab); tabRef.current = tab;
  React.useEffect(() => {
    if (!live || !eng.beatStar) return;
    const dests = beatTabs(eng.beatStar, { agentTks, yourTks });
    if (!dests.length) return;
    setPulse((p) => {
      const n = { ...p };
      let changed = false;
      for (const d of dests) if (d !== tabRef.current) { n[d] = eng.beatStar.key; changed = true; }
      return changed ? n : p;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live ? (eng.beatStar ? eng.beatStar.key : 0) : 0]);

  const goTab = (id) => { setTab(id); setPulse((p) => ({ ...p, [id]: 0 })); };
  // deferred bell countdown → show "LIVE", not a frozen 00:00 (ArenaDesktop:68 parity)
  const closeClock = data && D.pod.nextClose == null ? null : eng.closeClock;
  const oppSeat = opp ? D.seats.find((s) => s.id === opp) : null;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: LTOKENS.bg, position: 'relative' }}>
      {/* PINNED TOP — sticky so the hero + tab bar stay put while the body scrolls */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: LTOKENS.bg, padding: '14px 14px 0' }}>
        <ArenaTopStrip mode={mode} state={state} pod={D.pod} closeClock={closeClock} onBack={onBack} compact />
        <div ref={heroRef} style={{ position: 'relative', marginTop: 10 }}>
          <ClimbArena state={state} mode={mode} seats={D.seats} climb={D.climb} youId={D.youId} dayIdx={lastIdx}
            w={heroW} h={calm ? HERO_H_CALM : HERO_H} surge={live ? eng.surge : null} onPlayer={done ? null : setOpp} compact />
          {live && eng.beat && (
            <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <BeatCaption beat={eng.beat} compact />
            </div>
          )}
        </div>
        {!done && (
          <div style={{ display: 'flex', gap: 7, padding: '12px 0 10px' }}>
            <MTab id="you" label="Your Portfolio" color={OWN_YOU} active={tab} pulse={pulse.you} onClick={goTab} />
            <MTab id="agent" label="Agent Portfolio" color={OWN_AGENT} active={tab} pulse={pulse.agent} onClick={goTab} />
            <MTab id="chat" label="Chat" color={OWN_AGENT} active={tab} pulse={pulse.chat} onClick={goTab} />
          </div>
        )}
      </div>

      {/* THE BODY — flows in page scroll under the sticky hero; clears the bottom nav */}
      <div style={{ padding: '4px 14px calc(env(safe-area-inset-bottom, 0px) + 140px)' }}>
        {done ? (
          <MComplete mode={mode} youRank={D.youRank} onFilm={() => setFilmOpen(true)} />
        ) : tab === 'you' ? (
          <MYourPanel stars={D.userStars} wire={D.wire} live={live} calm={calm} done={done}
            headline={headline} cellBump={cellBump} onFlip={handlers?.onFlip} onFlipDrama={eng.flip} onClaim={() => setFaOpen(true)} />
        ) : tab === 'agent' ? (
          <MAgentPanel stars={D.agentStars} move={D.agentMove} calm={calm} done={done} headline={headline} cellBump={cellBump} />
        ) : calm ? (
          <div style={{ marginTop: 6, borderRadius: 16, padding: '14px 15px', background: alpha(LTOKENS.bg, 0.72), border: `1px solid ${alpha(OWN_AGENT, 0.22)}` }}>
            <VoiceLane lines={[{ ...D.voice.wait, t: 'now', _k: 0 }]} archName={D.voice.arch} color={OWN_AGENT} live={false} max={1} />
            <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LTOKENS.hair}` }}><MeterKey /></div>
          </div>
        ) : (
          <AgentDock compact live lines={eng.lines} archName={D.voice.arch} ask={D.ask} onAsk={eng.askAgent} style={{ marginTop: 6 }} />
        )}
      </div>

      {done && filmOpen && <FilmRoomOverlay onClose={() => setFilmOpen(false)} />}
      {faOpen && (
        <FreeAgencyDoorway onClose={() => setFaOpen(false)} claim={data ? D.claim : null} onClaim={handlers?.onClaim} maxWidth={SHEET_FIT} />
      )}
      {oppSeat && <OpponentSnapshot seat={oppSeat} composite={D.climb[opp]?.[lastIdx] ?? 0} onClose={() => setOpp(null)} maxWidth={SHEET_FIT} />}
    </div>
  );
}

// a tab button — pulses when an unseen beat fired on its zone
function MTab({ id, label, color, active, pulse, onClick }) {
  const on = active === id;
  return (
    <button className="bv2-tap" onClick={() => onClick(id)} style={{ all: 'unset', flex: 1, boxSizing: 'border-box', cursor: 'pointer', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 6px', borderRadius: 11, textAlign: 'center',
      background: on ? alpha(color, 0.14) : alpha(LTOKENS.bg, 0.5), border: `1px solid ${on ? alpha(color, 0.5) : LTOKENS.hair}` }}>
      <Mono style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em', color: on ? color : LTOKENS.ink2, whiteSpace: 'nowrap' }}>{label}</Mono>
      {pulse > 0 && !on && (
        <span className={prefersReducedMotion() ? '' : 'bv2-livedot'} style={{ position: 'absolute', top: 6, right: 8, width: 7, height: 7, borderRadius: '50%', background: color }} />
      )}
    </button>
  );
}

// the AGENT PORTFOLIO tab — watch-only, teal, the agent's six in a 2-col grid
function MAgentPanel({ stars, move, calm, done, headline, cellBump }) {
  return (
    <div style={{ marginTop: 6, borderRadius: 16, padding: '13px 13px', background: alpha('#0A1520', 0.5), border: `1px solid ${LTOKENS.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <ArenaOrb state={calm ? 'ready' : 'live'} size={22} color={OWN_AGENT} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow color={OWN_AGENT}>Your agent&rsquo;s six</Eyebrow>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <Icon name="eye" size={10} color={LTOKENS.ink3} />
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>watch-only · it manages these</Mono>
          </span>
        </div>
        {!calm && <AgentMoveChip move={move} color={OWN_AGENT} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {stars.map((s) => (
          <StarCell key={s.tk} star={s} complete={done} dormant={calm} dense headline={headline} owner={OWN_AGENT} bump={cellBump(s.tk)} style={{ minWidth: 0 }} />
        ))}
      </div>
    </div>
  );
}

// the YOUR PORTFOLIO tab — your stake + controls, blue. Reuses the SAME flip
// controller as the desktop dock (optimistic + server-authoritative rollback).
function MYourPanel({ stars, wire, live, calm, done, headline, cellBump, onFlip, onFlipDrama, onClaim }) {
  const c = OWN_YOU;
  const open = live && wire?.open;
  const { dirOf, doFlip, flipError } = useArenaFlips(stars, onFlip, onFlipDrama);
  return (
    <div style={{ marginTop: 6, borderRadius: 16, padding: '13px 13px',
      background: `linear-gradient(160deg, ${alpha(c, 0.08)}, ${alpha(LTOKENS.bg, 0.5)} 60%)`,
      border: `1px solid ${alpha(c, 0.32)}`, boxShadow: `0 14px 40px -22px ${alpha(c, 0.4)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(c, 0.16), border: `1px solid ${alpha(c, 0.45)}` }}>
          <LIcon name="long" size={12} color={c} stroke={2.4} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow color={c}>Your three</Eyebrow>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <LIcon name="flip" size={10} color={c} stroke={2} />
            <Mono style={{ fontSize: 9, color: alpha(c, 0.85) }}>yours to act · flip or claim</Mono>
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {stars.map((s) => (
          <StarCell key={s.tk} star={s} complete={done} dormant={calm} dir={dirOf(s)} owner={c} dense headline={headline} bump={cellBump(s.tk)}
            footer={live ? <FlipControl dir={dirOf(s)} onFlip={(nd) => doFlip(s.tk, nd)} color={c} compact /> : null} />
        ))}
      </div>
      {flipError && (
        <Mono style={{ display: 'block', marginTop: 8, fontSize: 9.5, fontWeight: 600, color: '#F2766B' }}>{flipError}</Mono>
      )}
      <button className="bv2-tap" onClick={open ? onClaim : undefined} disabled={!open}
        style={{ all: 'unset', boxSizing: 'border-box', width: '100%', marginTop: 11, cursor: open ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', borderRadius: 10,
          background: open ? c : LTOKENS.surface, border: open ? 'none' : `1px solid ${LTOKENS.hair}`, opacity: open ? 1 : 0.7 }}>
        <Icon name="plus" size={13} color={open ? LTOKENS.bg : LTOKENS.ink3} stroke={2.4} />
        <Mono style={{ fontSize: 12, fontWeight: 700, color: open ? LTOKENS.bg : LTOKENS.ink3 }}>Claim a name</Mono>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, opacity: 0.82 }}>
          <Mono style={{ fontSize: 9, fontWeight: 700, color: open ? LTOKENS.bg : LTOKENS.ink3 }}>
            {open ? `FREE AGENCY · ${wire.claimsUsed}/${wire.claimsTotal}` : 'WIRE CLOSED'}
          </Mono>
          {open && <LIcon name="arrowUpRight" size={11} color={LTOKENS.bg} stroke={2.4} />}
        </span>
      </button>
    </div>
  );
}

// the COMPLETE verdict — derived from the real rank/mode (NOT canned copy); the
// Film Room button opens the existing placeholder overlay (dossiers are deferred).
function MComplete({ mode, youRank, onFilm }) {
  const advanced = youRank <= 2;
  const tone = mode === 'ranked' ? (advanced ? LTOKENS.teal : '#F2766B') : OWN_AGENT;
  return (
    <div style={{ marginTop: 14, borderRadius: 16, padding: '15px 16px',
      background: `linear-gradient(150deg, ${alpha(tone, 0.13)}, ${alpha(LTOKENS.bg, 0.7)} 70%)`, border: `1px solid ${alpha(tone, 0.34)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <LIcon name={mode === 'ranked' && advanced ? 'ranked' : 'flag'} size={15} color={tone} stroke={2} />
        <Eyebrow color={tone}>{mode === 'ranked' ? (advanced ? 'You advanced' : 'Run ended') : 'Training · finish'}</Eyebrow>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink }}>
        {ordinal(youRank)} of four{mode === 'ranked' && advanced ? ' — next round' : ''}
      </div>
      <Mono style={{ display: 'block', fontSize: 10.5, color: LTOKENS.ink2, lineHeight: 1.6, marginTop: 8 }}>
        Final badges are on the board above; rivals&rsquo; books were sealed until now. The Film Room opens the whole week.
      </Mono>
      <button className="bv2-tap" onClick={onFilm} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', marginTop: 13, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '12px', borderRadius: 12,
        background: alpha(LTOKENS.gold, 0.16), border: `1px solid ${alpha(LTOKENS.gold, 0.45)}` }}>
        <ArenaOrb state="review" size={22} color={LTOKENS.gold} />
        <Mono style={{ fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>Break the seal · Film Room</Mono>
        <Icon name="chevR" size={14} color={LTOKENS.gold} />
      </button>
    </div>
  );
}
