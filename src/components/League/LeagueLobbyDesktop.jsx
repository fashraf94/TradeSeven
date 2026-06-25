// src/components/League/LeagueLobbyDesktop.jsx
//
// The DESKTOP League lobby — the bracket funnel is the hero (center stage); the
// League Pod docks into the right rail on click; your group and live-follows ride
// the left. Transcribed from the Claude Design desktop export (league-desk.jsx
// LeagueDeskApp/LeagueDeskLobby), minus the design-harness chrome (the macOS
// window frame, the scale-to-fit stage, and the Tweaks panel — the same posture
// the mobile port took when it dropped the iOS device frame). It fills the
// desktop content area App already offsets past the 220px sidebar.
//
// FIXTURES-FIRST: data comes from the single useLeagueState() seam — the exact
// shape the mobile lobby consumes. Modes/Enter/Join/Spectate reuse the existing
// League primitives so desktop can't drift from mobile.
//
// THE TRAINING ADDITION: when LEAGUE_TRAINING_POD_ENABLED, a Ranked | Training
// tab rides the top bar. Training is purple (practice, no stakes), reuses the
// proven training stack (subscribeMyTrainingPod for the Active Training Game
// re-entry card; quickPlayTraining + the already-threaded onOpenTrainingPod for
// the cold-start), and writes NO competitive state. Flag OFF → the tournament
// surface only, pixel-faithful to the Claude Design baseline.

import React from 'react';
import './league.css';
import useLeagueState from '../../hooks/useLeagueState';
import { useUser } from '../../contexts/UserContext';
import { subscribeMyTrainingPod } from '../../services/tournamentGroupService';
import { logLeagueSignal } from '../../services/leagueSignals';
import { LEAGUE_TRAINING_POD_ENABLED } from '../../config/featureFlags';
import { LTOKENS, LX, alpha } from './leagueTokens';
import { Eyebrow, Mono } from './LeagueParts';
import Spectate from './LeagueSpectate';
import {
  DeskEnter, DeskStat, DeskYourGroup, DeskFollowRail, DeskLeaderboard, DeskPodPanel,
  DeskFunnel, LDActionModal, LDJoinModal, LDFocus, DeskTabBar, DeskTrainingPanel, TRAIN,
} from './LeagueDeskParts';

const ACCENT = LX.energy; // teal — the league energy accent (tournament surface)

// dev hooks (inert in normal use):
//   ?f=forming|filling|open        → fill level
//   ?leagueTrainingPod=0|1         → force the Training tab off/on (overrides the flag)
const SP = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const DEV_FILL = ['forming', 'filling', 'open'].includes(SP.get('f')) ? SP.get('f') : 'open';
const TRAINING_ON = SP.get('leagueTrainingPod') === '1'
  || (LEAGUE_TRAINING_POD_ENABLED && SP.get('leagueTrainingPod') !== '0');

// Scoped layout CSS — the 3-column grid + reflow. Mirrors the CommandDashboardDesktop
// house pattern (media queries in a <style> block, hardcoded tokens). Injected once.
const LD_STYLE = `
  .ld-root { min-height: 100vh; background: ${LTOKENS.bg}; color: ${LTOKENS.ink}; display: flex; flex-direction: column; font-family: var(--app-font, 'Space Grotesk', system-ui, sans-serif); }
  .ld-topbar { flex-shrink: 0; padding: 18px 30px; border-bottom: 1px solid ${LTOKENS.hair}; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .ld-stats { display: flex; align-items: center; gap: 20px; padding-left: 24px; border-left: 1px solid ${LTOKENS.hair}; }
  .ld-grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 320px minmax(0, 1fr) 384px; gap: 26px; padding: 22px 30px 26px; }
  .ld-grid-training { grid-template-columns: minmax(0, 1fr) 384px; }
  .ld-rail-left { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; }
  .ld-center { height: 100%; overflow: auto; display: flex; flex-direction: column; }
  .ld-funnel-wrap { overflow: auto; flex: 1; min-height: 0; }
  .ld-rail-right { height: 100%; min-height: 0; border-radius: 18px; padding: 16px; background: ${LTOKENS.surface}; transition: border-color .2s ease; }
  /* mid-size desktop — drop the left rail under the center, keep funnel + right rail */
  @media (max-width: 1180px) {
    .ld-grid { grid-template-columns: minmax(0, 1fr) 340px; }
    .ld-rail-left { grid-row: 2; grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; height: auto; }
    .ld-rail-left > * { flex: 1; min-width: 260px; }
    .ld-grid-training { grid-template-columns: minmax(0, 1fr) 340px; }
  }
  @media (max-width: 900px) {
    .ld-grid, .ld-grid-training { grid-template-columns: minmax(0, 1fr); }
    .ld-rail-right { min-height: 420px; }
  }
`;

function findPod(st, id) {
  return [...st.rounds.r1, ...st.rounds.r2, st.rounds.r3, ...st.baseGames].find((p) => p.id === id) || null;
}

// The front door to the live participant flow (board commit / battle / claims /
// draft). Shown on BOTH the Ranked and Training surfaces (mobile parity: the
// mobile lobby renders this regardless of tab) so a player with an active game
// can always jump back in — including when the training tab is flag-off.
function MyGameBar({ onOpen }) {
  return (
    <button className="lg-tap" onClick={onOpen} style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 13, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}` }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: LX.energy, boxShadow: `0 0 6px ${LX.energy}`, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: LTOKENS.ink }}>Open my game</span>
      <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>your live battle · claims · draft</Mono>
    </button>
  );
}

export default function LeagueLobbyDesktop({ onOpenMyGame, onOpenTrainingPod, hasAgent, agentLoadout }) {
  const { state: st, isFixtures } = useLeagueState(DEV_FILL);
  const { user } = useUser();
  const uid = user?.uid;

  const [tab, setTab] = React.useState('ranked');         // 'ranked' | 'training'
  // Store the docked pod by ID and derive it from the live state each render, so
  // the docked panel always reflects the current data (and never stales) without
  // a setState-in-effect that could loop if the real adapter returns a fresh
  // object reference each render.
  const [selectedPodId, setSelectedPodId] = React.useState(null);
  const [action, setAction] = React.useState(false);
  const [joined, setJoined] = React.useState(null);        // 'quick' | 'ranked' | null
  const [spec, setSpec] = React.useState(null);            // { pod, focusId }

  // Active Training Game (build spec §4) — a member-scoped real-time listener,
  // the SAME proven subscription the mobile training tab uses. uid is derived
  // from auth via UserContext, so the effect re-subscribes on auth change (no
  // stale-subscription bug). Gated so the flag-off lobby opens no extra listener.
  const [activeTrainingPod, setActiveTrainingPod] = React.useState(null);
  React.useEffect(() => {
    if (!TRAINING_ON || !uid) { setActiveTrainingPod(null); return undefined; }
    return subscribeMyTrainingPod(uid, setActiveTrainingPod);
  }, [uid]);

  const aLivePod = React.useMemo(
    () => [...st.rounds.r1, ...st.rounds.r2, st.rounds.r3].find((p) => p.status === 'live') || st.rounds.r1[0],
    [st],
  );

  // Derived (never stale): the docked pod from the live state, or null.
  const selectedPod = selectedPodId ? findPod(st, selectedPodId) : null;

  const signal = (event, payload) => logLeagueSignal(event, payload, { isFixtures });

  const pickPod = (pod) => { setSpec(null); setSelectedPodId(pod.id); signal('pod-tap', { podId: pod.id }); };
  const closePod = () => setSelectedPodId(null);
  const openSpectate = (pod, focusId) => { if (!pod) return; setSpec({ pod, focusId }); signal('spectate-open', { podId: pod.id, focusId }); };
  const enter = () => { setAction(true); signal('enter-tournament', {}); };
  const pickMode = (m) => { setAction(false); setJoined(m); signal('enter-mode', { mode: m }); };
  // Only open Spectate on a pod that actually has a seated player — a sparse
  // real-data fallback pod (all-null seats) would otherwise crash Spectate
  // (rankPod filters out TBDs → empty → ranked[0] deref).
  const watchWhileWaiting = () => {
    setJoined(null);
    const seat = aLivePod?.seats?.find((s) => s);
    if (seat) openSpectate(aLivePod, seat.id);
  };
  // Switching tabs dismisses any open tournament overlay so a ranked modal can't
  // linger over the (purple) training surface.
  const switchTab = (next) => {
    if (next === tab) return;
    signal('tab-switch', { from: tab, to: next });
    setAction(false); setJoined(null); setSpec(null);
    setTab(next);
  };

  const liveCount = React.useMemo(() => [...st.rounds.r1, ...st.rounds.r2, st.rounds.r3].filter((p) => p.status === 'live').length, [st]);
  const humans = React.useMemo(() => Object.values(st.field).filter((p) => p.kind === 'human').length, [st]);
  const onTraining = TRAINING_ON && tab === 'training';

  return (
    <div className="ld-root" style={{ position: 'relative', backgroundImage: `radial-gradient(circle at 50% 0%, ${alpha(onTraining ? TRAIN.base : ACCENT, 0.06)}, transparent 55%)` }}>
      <style>{LD_STYLE}</style>

      {/* top bar — identity, headline, hero stats, tabs, CTA */}
      <div className="ld-topbar">
        <div style={{ minWidth: 0 }}>
          <Eyebrow color={onTraining ? TRAIN.lt : ACCENT} style={{ marginBottom: 5 }}>TradeSeven · League</Eyebrow>
          <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {onTraining ? 'Training Pod' : st.headline}
          </div>
        </div>
        <div className="ld-stats">
          <DeskStat n={liveCount} label={liveCount === 1 ? 'pod live' : 'pods live'} dot={LX.energy} />
          <DeskStat n={humans} label="players" dot={LX.human} muted={humans === 0} />
          <DeskStat n={16 - humans} label="CPU agents" dot={LX.cpu} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          {TRAINING_ON && <DeskTabBar tab={tab} onSwitchTab={switchTab} accent={ACCENT} />}
          {!onTraining && <DeskEnter accent={ACCENT} onEnter={enter} />}
        </div>
      </div>

      {/* body */}
      {onTraining ? (
        <div className="ld-grid ld-grid-training">
          {/* MAIN — the training surface (active-game re-entry card or cold-start) */}
          <div className="lg-scroll" style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {onOpenMyGame && <MyGameBar onOpen={onOpenMyGame} />}
            <DeskTrainingPanel
              onOpenTrainingPod={onOpenTrainingPod}
              activeTrainingPod={activeTrainingPod}
              hasAgent={hasAgent}
              agentLoadout={agentLoadout}
            />
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <Mono style={{ fontSize: 9, letterSpacing: '0.14em', color: LTOKENS.ink3, textTransform: 'uppercase', lineHeight: 1.6 }}>
                Practice the parallel-layer battle · nothing on the line
              </Mono>
            </div>
          </div>
          {/* RIGHT — the season leaderboard, for context */}
          <div className="ld-rail-right">
            <DeskLeaderboard st={st} accent={ACCENT} />
          </div>
        </div>
      ) : (
        <div className="ld-grid">
          {/* LEFT — your group + live follows */}
          <div className="lg-scroll ld-rail-left">
            {onOpenMyGame && <MyGameBar onOpen={onOpenMyGame} />}
            <DeskYourGroup st={st} accent={ACCENT} onOpen={pickPod} />
            <DeskFollowRail items={st.followLive} accent={ACCENT} onSpectate={openSpectate} />
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <Mono style={{ fontSize: 9, letterSpacing: '0.14em', color: LTOKENS.ink3, textTransform: 'uppercase', lineHeight: 1.6 }}>
                Empty seats run as CPU · your group locks Monday
              </Mono>
            </div>
          </div>

          {/* CENTER — THE BRACKET, the hero */}
          <div className="lg-scroll ld-center">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '0 2px' }}>
              <Eyebrow color={LTOKENS.ink3}>The bracket · 16 → 8 → 4 → champion</Eyebrow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: LX.energy, boxShadow: `0 0 7px ${LX.energy}` }} />
                <Mono style={{ fontSize: 10, color: LX.energy, letterSpacing: '0.08em' }}>YOUR PATH TO THE TROPHY</Mono>
              </div>
            </div>
            <div className="ld-funnel-wrap">
              <DeskFunnel st={st} accent={ACCENT} onPick={pickPod} selectedId={selectedPod ? selectedPod.id : null} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <Mono style={{ fontSize: 10, color: LTOKENS.ink3, letterSpacing: '0.04em' }}>Click any pod to open its live four-player standing</Mono>
            </div>
          </div>

          {/* RIGHT — leaderboard, swaps to the docked League Pod on click */}
          <div className="ld-rail-right" style={{ border: `1px solid ${selectedPod ? alpha(ACCENT, 0.3) : LTOKENS.hair}` }}>
            {selectedPod
              ? <DeskPodPanel pod={selectedPod} accent={ACCENT} onClose={closePod} onSpectate={(seat) => openSpectate(selectedPod, seat.id)} />
              : <DeskLeaderboard st={st} accent={ACCENT} />}
          </div>
        </div>
      )}

      {/* overlays */}
      {action && <LDActionModal accent={ACCENT} onClose={() => setAction(false)} onPick={pickMode} />}
      {joined && <LDJoinModal mode={joined} onClose={() => setJoined(null)} onWatch={watchWhileWaiting} />}
      {spec && (
        <LDFocus width={760} onClose={() => setSpec(null)}>
          <div style={{ height: '86vh', maxHeight: 880, borderRadius: 24, overflow: 'hidden', border: `1px solid ${LTOKENS.hair2}`, boxShadow: '0 30px 90px rgba(0,0,0,0.6)', position: 'relative' }}>
            <Spectate pod={spec.pod} focusId={spec.focusId} accent={ACCENT} onBack={() => setSpec(null)} onEnter={() => { setSpec(null); setAction(true); }} />
          </div>
        </LDFocus>
      )}
    </div>
  );
}
