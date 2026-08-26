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
import { FuseHero } from './FuseHero';
import { FUSE_HERO_ON, FUSE_HERO_ROWS } from './fuseHeroGate';
import { MOBILE_HERO_MIN, heroReservePx } from './mobileHeroHeight';
import { DecompositionStrip } from './DecompositionStrip';
import { StarCell } from './StarCell';
import { FlipControl, AgentDock, AgentMoveChip, DepartedChip } from './CommandDock';
import { VoiceLane } from './VoiceLane';
import { FreeAgencyDoorway, OpponentSnapshot, FilmRoomOverlay, DepartedLedger } from './ArenaOverlays';
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

export function ArenaMobile({ state, mode, headline = 'mult', onBack = null, data = null, handlers = null, voided = false, history = null }) {
  const live = state === 'live';
  const done = state === 'complete';
  const calm = state === 'awaiting';
  // League Score History (flag-gated): the recap is reachable during a LIVE
  // battle (a "week so far" entry) as well as at completion (the MComplete
  // doorway). Null/empty off-gate → no entry, no overlay change (byte-identical).
  const hasRecap = !!history && (((history.timeline?.length) || 0) > 0 || (history.swapCount || 0) > 0);

  // Same fixtures fallback as ArenaDesktop — MEMOIZED on [state] (identity-stable,
  // so the preview beat-loop doesn't restart each render).
  const fixtureModel = React.useMemo(() => buildFixtureModel(state), [state]);
  const D = data ?? fixtureModel;
  // Points-led cards flip WITH the decomposition (model-driven); `headline` prop is
  // the fixtures fallback. Off-gate → 'mult' (byte-identical to today).
  const dockHeadline = D.headline ?? headline;

  // Identical engine wiring to ArenaDesktop (object signature; live vs preview).
  const eng = useArenaEngine({
    active: live, voice: D.voice, ask: D.ask,
    beats: data ? null : D.beats,
    live: !!data, liveBeats: data ? D.beats : null,
    battleId: D.battleId ?? null, agentId: D.agentId ?? null, // two-way ask identity (live only)
    closeStart: calm ? (D.pod.toOpen ?? 0) : (D.pod.nextClose ?? 0),
    wireStart: D.wire.closes ?? 0,
  });

  // The flip controller lives HERE (not inside MYourPanel) so an in-flight flip's
  // optimistic override + rollback + error survive a tab switch — MYourPanel
  // unmounts when you leave the You tab, which would otherwise drop a server
  // rejection's "Flip failed" before it surfaced (desktop's dock never unmounts).
  const flips = useArenaFlips(D.userStars, handlers?.onFlip, eng.flip);

  const [tab, setTab] = React.useState('you');   // you · agent · chat
  const [pulse, setPulse] = React.useState({});  // { tabId: beatStar.key } — unseen beats
  const [opp, setOpp] = React.useState(null);
  const [filmOpen, setFilmOpen] = React.useState(false);
  const [faOpen, setFaOpen] = React.useState(false);
  const [departedView, setDepartedView] = React.useState(null); // 'swap' | 'drop' | null
  React.useEffect(() => { setTab('you'); setPulse({}); setOpp(null); setFilmOpen(false); setFaOpen(false); setDepartedView(null); }, [state, mode]);

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
  const [heroH, setHeroH] = React.useState(calm ? HERO_H_CALM : HERO_H);
  React.useEffect(() => {
    const compute = () => {
      const el = heroRef.current;
      if (el && el.clientWidth) setHeroW(Math.max(280, el.clientWidth));
      // Phase 6: the CSS (svh) owns the height; the component reads back what it
      // resolved to, so the SVG viewport always matches the real box.
      if (el && el.clientHeight) setHeroH(Math.max(MOBILE_HERO_MIN, el.clientHeight));
    };
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
        <ArenaTopStrip mode={mode} state={state} pod={D.pod} closeClock={closeClock} onBack={onBack} compact voided={voided} />
        {/* Phase 6 / G2: the fuse hero is sized in svh via .bv2-fuse-hero-m so it
            can never clip when Safari's chrome is showing. The class is applied
            ONLY on the fuse arm — ClimbArena keeps its fixed height, unchanged. */}
        <div ref={heroRef} className={FUSE_HERO_ON ? 'bv2-fuse-hero-m' : undefined}
          style={{ position: 'relative', marginTop: 10,
            // H2: the row target drives the reserved budget; ?heroRows= lets the
            // two candidate heights be compared on one device.
            ...(FUSE_HERO_ON ? { '--fh-reserve': `${heroReservePx(FUSE_HERO_ROWS ?? 2)}px` } : null) }}>
          {/* Branch A: the top half — and ONLY the top half — swaps on the fuse
              flag. Dark today, so this renders ClimbArena exactly as before. */}
          {FUSE_HERO_ON ? (
            <FuseHero state={state} mode={mode} seats={D.seats} climb={D.climb} youId={D.youId} dayIdx={lastIdx}
              w={heroW} h={heroH} surge={live ? eng.surge : null} onPlayer={done ? null : setOpp} compact youLiveScore={D.youLiveScore} liveComposites={D.liveComposites} voided={voided} trail={D.trail} initialScope={D.initialScope} />
          ) : (
            <ClimbArena state={state} mode={mode} seats={D.seats} climb={D.climb} youId={D.youId} dayIdx={lastIdx}
              w={heroW} h={calm ? HERO_H_CALM : HERO_H} surge={live ? eng.surge : null} onPlayer={done ? null : setOpp} compact youLiveScore={D.youLiveScore} liveComposites={D.liveComposites} voided={voided} />
          )}
          {live && eng.beat && (
            <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <BeatCaption beat={eng.beat} compact />
            </div>
          )}
        </div>
        {/* the decomposition strip — spans both layers, so it sits ABOVE the per-layer
            tabs (six / three), always visible with the orb. Null off-gate. */}
        {D.decomposition && (
          <div style={{ marginTop: 8 }}>
            <DecompositionStrip decomposition={D.decomposition} compact />
          </div>
        )}
        {hasRecap && !done && (
          <button className="bv2-tap" onClick={() => setFilmOpen(true)} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', marginTop: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 10,
            background: alpha(LTOKENS.gold, 0.1), border: `1px solid ${alpha(LTOKENS.gold, 0.34)}` }}>
            <LIcon name="crown" size={13} color={LTOKENS.gold} stroke={2} />
            <Mono style={{ fontSize: 11, fontWeight: 700, color: LTOKENS.ink }}>The week so far · history</Mono>
            <Icon name="chevR" size={13} color={LTOKENS.gold} />
          </button>
        )}
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
          <MComplete mode={mode} youRank={D.youRank} onFilm={() => setFilmOpen(true)} voided={voided} />
        ) : tab === 'you' ? (
          <MYourPanel stars={D.userStars} wire={D.wire} live={live} calm={calm} done={done}
            headline={dockHeadline} cellBump={cellBump} flips={flips} onClaim={() => setFaOpen(true)}
            departed={D.userDeparted} onOpenDeparted={() => setDepartedView('drop')} />
        ) : tab === 'agent' ? (
          <MAgentPanel stars={D.agentStars} move={D.agentMove} calm={calm} done={done} headline={dockHeadline}
            cellBump={cellBump} flareKey={live ? eng.flareKey : 0}
            departed={D.agentDeparted} onOpenDeparted={() => setDepartedView('swap')} />
        ) : calm ? (
          <div style={{ marginTop: 6, borderRadius: 16, padding: '14px 15px', background: alpha(LTOKENS.bg, 0.72), border: `1px solid ${alpha(OWN_AGENT, 0.22)}` }}>
            <VoiceLane lines={[{ ...D.voice.wait, t: 'now', _k: 0 }]} archName={D.voice.arch} color={OWN_AGENT} live={false} max={1} />
            <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${LTOKENS.hair}` }}><MeterKey /></div>
          </div>
        ) : (
          <AgentDock compact live lines={eng.lines} archName={D.voice.arch} ask={D.ask} onAsk={eng.askAgent}
            askLive={eng.askLive} remaining={eng.remaining} asking={eng.asking} chatReady={eng.chatReady} style={{ marginTop: 6 }} />
        )}
      </div>

      {/* overlays pin to the VIEWPORT (fixed) — the mobile root is a tall scroller,
          so an absolute modal would center off-screen on the full scroll height. */}
      {filmOpen && <FilmRoomOverlay onClose={() => setFilmOpen(false)} fixed history={history} />}
      {faOpen && (
        <FreeAgencyDoorway onClose={() => setFaOpen(false)} claim={data ? D.claim : null} onClaim={handlers?.onClaim} maxWidth={SHEET_FIT} fixed />
      )}
      {oppSeat && <OpponentSnapshot seat={oppSeat} composite={D.climb[opp]?.[lastIdx] ?? 0} onClose={() => setOpp(null)} maxWidth={SHEET_FIT} fixed />}
      {departedView && (departedView === 'swap' ? D.agentDeparted : D.userDeparted) && (
        <DepartedLedger kind={departedView} departed={departedView === 'swap' ? D.agentDeparted : D.userDeparted}
          onClose={() => setDepartedView(null)} maxWidth={SHEET_FIT} fixed />
      )}
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

// the AGENT PORTFOLIO tab — watch-only, teal, the agent's six in a 2-col grid.
// Exported so the render-smoke can mount it directly (the tab is behind state that
// renderToString can't reach). `flareKey` bumps the orb's swap-flare ring per agent
// swap, matching the desktop DockAgentSix drama.
export function MAgentPanel({ stars, move, calm, done, headline, cellBump, flareKey = 0, departed = null, onOpenDeparted }) {
  return (
    <div style={{ marginTop: 6, borderRadius: 16, padding: '13px 13px', background: alpha('#0A1520', 0.5), border: `1px solid ${LTOKENS.hair}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <ArenaOrb state={calm ? 'ready' : 'live'} size={22} color={OWN_AGENT} />
          {!calm && flareKey > 0 && !prefersReducedMotion() && (
            <span key={flareKey} className="bv2-flare" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${OWN_AGENT}`, pointerEvents: 'none' }} />
          )}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow color={OWN_AGENT}>Your agent&rsquo;s six</Eyebrow>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <Icon name="eye" size={10} color={LTOKENS.ink3} />
            <Mono style={{ fontSize: 9, color: LTOKENS.ink3 }}>watch-only · it manages these</Mono>
          </span>
        </div>
        {!calm && <AgentMoveChip move={move} color={OWN_AGENT} />}
        {!calm && <DepartedChip kind="swap" departed={departed} onOpen={onOpenDeparted} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {stars.map((s) => (
          <StarCell key={s.tk} star={s} complete={done} dormant={calm} dense headline={headline} owner={OWN_AGENT} bump={cellBump(s.tk)} style={{ minWidth: 0 }} />
        ))}
      </div>
    </div>
  );
}

// the YOUR PORTFOLIO tab — your stake + controls, blue. The flip controller
// (`flips`) is owned by ArenaMobile and passed in, so an in-flight flip's
// optimistic override + rollback + error survive this panel unmounting on a tab
// switch (the desktop dock never unmounts).
function MYourPanel({ stars, wire, live, calm, done, headline, cellBump, flips, onClaim, departed = null, onOpenDeparted }) {
  const c = OWN_YOU;
  const open = live && wire?.open;
  const { dirOf, doFlip, flipError } = flips;
  // Canonical-round pending marker + close-only claim messaging (Deliverables 3-4).
  const pending = stars.filter((s) => s?.settleState === 'pending').length;
  // Gate on `live` — a finished round isn't reopening (neutral WIRE CLOSED).
  const closedForMarket = live && wire?.canonical && wire?.reason === 'market_hours';
  return (
    <div style={{ marginTop: 6, borderRadius: 16, padding: '13px 13px',
      background: `linear-gradient(160deg, ${alpha(c, 0.08)}, ${alpha(LTOKENS.bg, 0.5)} 60%)`,
      border: `1px solid ${alpha(c, 0.32)}`, boxShadow: `0 14px 40px -22px ${alpha(c, 0.4)}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(c, 0.16), border: `1px solid ${alpha(c, 0.45)}` }}>
          <LIcon name="long" size={12} color={c} stroke={2.4} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* div wrapper (not span): Eyebrow renders a block <div>, invalid inside a span */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Eyebrow color={c}>Your three</Eyebrow>
            {pending > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 5,
                background: alpha(LTOKENS.ink3, 0.12), border: `1px solid ${LTOKENS.hair2}` }}>
                <Icon name="clock" size={9} color={LTOKENS.ink3} stroke={2.2} />
                <Mono style={{ fontSize: 8.5, fontWeight: 700, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>{pending} pick{pending === 1 ? '' : 's'} pending</Mono>
              </span>
            )}
            <DepartedChip kind="drop" departed={departed} onOpen={onOpenDeparted} style={{ marginLeft: 0 }} />
          </div>
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
            {open ? `FREE AGENCY · ${wire.claimsUsed}/${wire.claimsTotal}`
              : closedForMarket ? 'CLAIMS OPEN AFTER CLOSE' : 'WIRE CLOSED'}
          </Mono>
          {open && <LIcon name="arrowUpRight" size={11} color={LTOKENS.bg} stroke={2.4} />}
        </span>
      </button>
    </div>
  );
}

// the COMPLETE verdict — derived from the real rank/mode (NOT canned copy); the
// Film Room button opens the existing placeholder overlay (dossiers are deferred).
function MComplete({ mode, youRank, onFilm, voided = false }) {
  const advanced = youRank <= 2;
  const tone = mode === 'ranked' ? (advanced ? LTOKENS.teal : '#F2766B') : OWN_AGENT;
  // L-A follow-up (B): mobile twin of the desktop suppression — a VOIDED cohort
  // shows NO placement/standing (which would contradict "no result recorded" and
  // is computed from contaminated numbers); the Film Room stays for review only.
  if (voided) {
    return (
      <div style={{ marginTop: 14, borderRadius: 16, padding: '15px 16px',
        background: `linear-gradient(150deg, ${alpha(LTOKENS.ink3, 0.11)}, ${alpha(LTOKENS.bg, 0.7)} 70%)`, border: `1px solid ${LTOKENS.hair2}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <LIcon name="flag" size={15} color={LTOKENS.ink3} stroke={2} />
          <Eyebrow color={LTOKENS.ink3}>Run voided</Eyebrow>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: LTOKENS.ink }}>
          No result recorded.
        </div>
        <Mono style={{ display: 'block', fontSize: 10.5, color: LTOKENS.ink2, lineHeight: 1.6, marginTop: 8 }}>
          This run was voided — no standing stands. The Film Room is open for review only.
        </Mono>
        <button className="bv2-tap" onClick={onFilm} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', marginTop: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '12px', borderRadius: 12,
          background: alpha(LTOKENS.gold, 0.16), border: `1px solid ${alpha(LTOKENS.gold, 0.45)}` }}>
          <ArenaOrb state="review" size={22} color={LTOKENS.gold} />
          <Mono style={{ fontSize: 12.5, fontWeight: 700, color: LTOKENS.ink }}>Open the Film Room</Mono>
          <Icon name="chevR" size={14} color={LTOKENS.gold} />
        </button>
      </div>
    );
  }
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
