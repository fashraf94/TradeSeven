// src/components/League/LeagueHome.jsx
//
// The redesigned League surface — state machine for the spectate-and-enter front
// end (lobby ⇄ spectate, with the pod sheet / action layer / join confirm as
// overlays). Ported from the Claude Design prototype's LeagueApp, minus the
// design-harness chrome (the iOS device frame, the scale-to-fit, and the Tweaks
// panel are gone). Renders as a centered mobile-width column; the document
// scrolls. The accent is fixed to the league energy teal (the prototype's
// tweakable accent was harness-only).
//
// FIXTURES-FIRST: data comes from the single useLeagueState() seam. The
// "Open my game" affordance (in the lobby) calls onOpenMyGame — LeagueScreen
// handles that as a full-screen push to the real participant flow.

import React from 'react';
import './league.css';
import useLeagueState from '../../hooks/useLeagueState';
import { logLeagueSignal } from '../../services/leagueSignals';
import { useUser } from '../../contexts/UserContext';
import { subscribeMyTrainingPod } from '../../services/tournamentGroupService';
import { LEAGUE_NEXT_ARC_ENABLED } from '../../config/featureFlags';
import { LTOKENS, LX } from './leagueTokens';
import Lobby, { LobbyTabbed } from './LeagueLobbyRedesign';
import Spectate from './LeagueSpectate';
import { PodSheet } from './LeaguePod';
import { ActionLayer, JoinConfirm } from './LeagueAction';

const ACCENT = LX.energy; // teal — the league energy accent

// dev hooks for smoke testing (inert in normal use):
//   ?f=forming|filling|open                              → fill level
//   ?s=action|pod|spectate-live|spectate-final           → land on a state
const SP = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const DEV_FILL = ['forming', 'filling', 'open'].includes(SP.get('f')) ? SP.get('f') : 'open';
const DEV_S = SP.get('s') || '';

// League Next-Arc Phase 2 — the persistent Training | Ranked tabs. Gate evaluated
// ONCE (module constant, stable across renders) = the sub-flag OR the dev-preview
// param ?leagueTabs=1 (the Phase-1 ?leagueRealData=1 idiom; layer &leagueRealData=1
// to preview the tabs over the real adapter). Flag OFF + no param → the byte-
// identical single-column lobby. Do NOT flip the flag here (the PR #510 lesson).
const TABS_ENABLED = LEAGUE_NEXT_ARC_ENABLED || SP.get('leagueTabs') === '1';

export default function LeagueHome({ onOpenMyGame, onOpenTrainingPod, hasAgent, agentLoadout }) {
  const { state: st, isFixtures } = useLeagueState(DEV_FILL);
  const { user } = useUser();
  const uid = user?.uid;

  const aLivePod = React.useMemo(
    () => [...st.rounds.r1, ...st.rounds.r2, st.rounds.r3].find((p) => p.status === 'live') || st.rounds.r1[0],
    [st],
  );

  const [screen, setScreen] = React.useState(DEV_S.startsWith('spectate') ? 'spectate' : 'lobby');
  const [spec, setSpec] = React.useState(null);          // { pod, focusId }
  const [podSheet, setPodSheet] = React.useState(DEV_S === 'pod' ? st.rounds.r1[0] : null);
  const [action, setAction] = React.useState(DEV_S === 'action');
  const [joined, setJoined] = React.useState(null);
  // Persistent lobby tab — orthogonal to `screen`; only rendered (via LobbyTabbed)
  // when TABS_ENABLED and screen === 'lobby'. Preserved across the spectate
  // round-trip (spectate is a `screen` change, not an unmount).
  const [tab, setTab] = React.useState('ranked'); // 'ranked' | 'training'

  // Active training pod (Slice 5b-i, D) — the Training-tab re-entry data. A
  // dedicated member-scoped subscription (NOT the fixtures-gated useLeagueState),
  // selected by the shared selectMyTrainingPod predicate: null → the Training tab
  // shows the start CTA, non-null → it shows the re-entry bar instead (R1). Gated
  // on TABS_ENABLED so the flag-off lobby opens no extra listener.
  const [activeTrainingPod, setActiveTrainingPod] = React.useState(null);
  React.useEffect(() => {
    if (!TABS_ENABLED || !uid) { setActiveTrainingPod(null); return undefined; }
    return subscribeMyTrainingPod(uid, setActiveTrainingPod);
  }, [uid]);

  // seed a dev spectate target once (smoke testing only)
  React.useEffect(() => {
    if (DEV_S === 'spectate-live') {
      const pod = st.rounds.r1.find((p) => p.status === 'live') || aLivePod;
      setSpec({ pod, focusId: pod.seats.find((s) => s && s.you)?.id || pod.seats.find((s) => s)?.id });
    } else if (DEV_S === 'spectate-final') {
      const pod = { ...st.rounds.r1[0], status: 'final' };
      setSpec({ pod, focusId: pod.seats.find((s) => s)?.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signal = (event, payload) => logLeagueSignal(event, payload, { isFixtures });

  const openSpectate = (pod, focusId) => { setPodSheet(null); setSpec({ pod, focusId }); setScreen('spectate'); signal('spectate-open', { podId: pod.id, focusId }); };
  const openPod = (pod) => { setPodSheet(pod); signal('pod-tap', { podId: pod.id }); };
  const enter = () => { setAction(true); signal('enter-tournament', {}); };
  const pickMode = (m) => { setAction(false); setJoined(m); signal('enter-mode', { mode: m }); };
  // Only open Spectate on a pod that actually has a seated player — the honest
  // empty bracket (base-layer-only / cold-start) yields an all-null-seat pod,
  // and Spectate would crash on it (rankPod filters TBDs → empty → ranked[0]
  // deref). Mirrors the desktop guard (LeagueLobbyDesktop.watchWhileWaiting).
  const watchWhileWaiting = () => {
    setJoined(null);
    const seat = aLivePod?.seats?.find((s) => s);
    if (seat) openSpectate(aLivePod, seat.id);
  };
  const backToLobby = () => { setScreen('lobby'); setSpec(null); };
  // tab-switch: front-end navigation telemetry (joins enter-mode/enter-tournament;
  // NOT a §4 trading-signal). Emitted only on a real switch, never on mount.
  const switchTab = (next) => { if (next === tab) return; signal('tab-switch', { from: tab, to: next }); setTab(next); };

  // Flag-on → the persistent Training|Ranked tabs; flag-off → today's lobby,
  // byte-identical (same <Lobby> invocation, untouched).
  const lobby = TABS_ENABLED
    ? <LobbyTabbed st={st} accent={ACCENT} tab={tab} onSwitchTab={switchTab} onEnter={enter} onPickPod={openPod} onSpectate={openSpectate} onOpenMyGame={onOpenMyGame} onOpenTrainingPod={onOpenTrainingPod} activeTrainingPod={activeTrainingPod} hasAgent={hasAgent} agentLoadout={agentLoadout} uid={uid} />
    : <Lobby st={st} accent={ACCENT} onEnter={enter} onPickPod={openPod} onSpectate={openSpectate} onOpenMyGame={onOpenMyGame} />;

  const body = screen === 'spectate' && spec
    ? <Spectate pod={spec.pod} focusId={spec.focusId} accent={ACCENT} onBack={backToLobby} onEnter={enter} />
    : lobby;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', maxWidth: 448, margin: '0 auto', background: LTOKENS.bg, color: LTOKENS.ink }}>
      {body}
      {podSheet && screen === 'lobby' && (
        <PodSheet pod={podSheet} accent={ACCENT} onClose={() => setPodSheet(null)} onSpectate={(seat) => openSpectate(podSheet, seat.id)} />
      )}
      {action && <ActionLayer accent={ACCENT} onClose={() => setAction(false)} onPick={pickMode} />}
      {joined && <JoinConfirm mode={joined} onClose={() => setJoined(null)} onWatch={watchWhileWaiting} />}
    </div>
  );
}
