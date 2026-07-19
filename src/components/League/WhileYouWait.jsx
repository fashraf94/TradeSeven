// src/components/League/WhileYouWait.jsx
//
// The Seated Waiting Room — "While you wait" — the active-game center for a
// player who already holds a competitive seat. It REPLACES the old bracket-
// funnel / forthcoming-bracket panel (both seated sub-states) as the primary
// content of the seated center, on BOTH viewports, keeping the honest one-line
// bracket footnote per the display-honesty precedent (the SlotCenter footnote).
//
// REUSE-ONLY (build spec, 2026-07-19): every action here already exists —
//   • Training pod START  → quickPlayTraining() (the same client action the
//     Training tab's CTA runs; the mirror guard explicitly permits it while the
//     player holds a slot seat — the P4b test locks it), routed via the already-
//     threaded onOpenTrainingPod. The server is the sole authority; the hasAgent
//     gate is courtesy. NEVER two training CTAs at once (R1): an active pod shows
//     RETURN instead of START.
//   • Training pod RETURN → onOpenTrainingPod(activeTrainingPod) (App branches on
//     status: DRAFTING → draft room, else → battle view).
//   • BaggerBomb (agent vs CPU) → onOpenBaggerBomb: the SAME shared agent-deploy
//     sequence the Command Center runs (deployAgent -> /api/agent/decide -> the
//     Battle View). The caller passes null (CTA hidden) when the agent is
//     battle-locked (activeBattleId set — incl. a League pod in BATTLE), so the
//     button never renders when the deploy can't fire. onOpenBaggerBomb may be
//     async (a slow cognition call) — the row shows a busy state while it runs.
//   • Spectate            → onSpectate(pod, focusId) (the existing overlay), on
//     the first live pod; the row hides when nothing is live.
//
// No new endpoint / subscription / game machinery; client-only; dark-only tokens
// from the shared map (LTOKENS/LX) — no useTheme(), no new palette. The archetype
// prediction market is the future occupant of this space; this is the cheap V1.

import React from 'react';
import { LTOKENS, LX, alpha } from './leagueTokens';
import { Eyebrow, Mono, Icon, LIcon } from './LeagueParts';
import { quickPlayTraining, mapLobbyError } from '../../services/tournamentLobbyActions';
import { GROUP_STATUS } from '../../constants/leagueTournament';

// A secondary action row — the MyGameBar vocabulary (full-width all:unset button,
// surface fill, hairline border, glyph · label · sublabel · arrow).
function SecondaryRow({ icon, label, sub, accent, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className="lg-tap"
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', cursor: disabled ? 'wait' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
        borderRadius: 13, background: LTOKENS.surface, border: `1px solid ${LTOKENS.hair}`, opacity: disabled ? 0.7 : 1,
      }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: alpha(accent, 0.14), border: `1px solid ${alpha(accent, 0.3)}` }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: LTOKENS.ink }}>{label}</div>
        <Mono style={{ fontSize: 10, color: LTOKENS.ink3 }}>{sub}</Mono>
      </div>
      <Icon name="arrowR" size={16} color={LTOKENS.ink3} />
    </button>
  );
}

export default function WhileYouWait({
  viewport = 'mobile',
  accent = LX.energy,
  status = null,
  st = null,
  activeTrainingPod = null,
  onOpenTrainingPod = null,
  hasAgent,
  onOpenBaggerBomb = null,
  onSpectate = null,
}) {
  const desktop = viewport === 'desktop';
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  const inFlight = React.useRef(false);
  const [bbBusy, setBbBusy] = React.useState(false);
  const bbInFlight = React.useRef(false);

  // A live pod to spectate, if any — the "Watch a live game" target. Reads the
  // same rounds/base-layer shape the rest of the surface reads; the row hides
  // when nothing is live (never a dead "watch" that leads nowhere).
  const liveWatchPod = React.useMemo(() => {
    const pods = [
      ...(st?.rounds?.r1 || []),
      ...(st?.rounds?.r2 || []),
      st?.rounds?.r3,
      ...(st?.baseGames || []),
    ];
    return pods.find((p) => p && p.status === 'live') || null;
  }, [st]);
  const watchFocusId = liveWatchPod
    ? (liveWatchPod.seats?.find((s) => s && s.you)?.id || liveWatchPod.seats?.find((s) => s)?.id || null)
    : null;

  // START a practice pod — the same quickPlayTraining action the Training tab
  // runs: one-in-flight, the courtesy no_agent gate (the server is the authority),
  // and the already_active re-entry hop. Routed via the existing onOpenTrainingPod.
  const startPod = async () => {
    if (inFlight.current) return;
    if (hasAgent === false) { setError(mapLobbyError({ code: 'no_agent' })); return; }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await quickPlayTraining();
      onOpenTrainingPod?.({ id: res.groupId, status: res.status ?? GROUP_STATUS.DRAFTING });
    } catch (err) {
      if (err?.code === 'already_active' && err?.data?.groupId) {
        onOpenTrainingPod?.({ id: err.data.groupId, status: err.data.status });
      } else {
        setError(mapLobbyError(err));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // Deploy the agent vs CPU — the caller (App) owns the shared deploy sequence and
  // navigates to the Battle View on success (which unmounts this module). We only
  // guard re-entry and show a busy state while the (slow) cognition call runs.
  const runBaggerBomb = async () => {
    if (!onOpenBaggerBomb || bbInFlight.current) return;
    bbInFlight.current = true;
    setBbBusy(true);
    try {
      await onOpenBaggerBomb();
    } finally {
      bbInFlight.current = false;
      setBbBusy(false);
    }
  };

  // R1: exactly one training CTA. An active pod REPLACES the start with a return.
  const hasPod = !!activeTrainingPod;
  const heroTitle = hasPod
    ? 'Return to your Training Pod'
    : (busy ? 'Starting your pod…' : 'Sharpen up in a Training Pod');
  const heroSub = hasPod
    ? 'your practice battle · CPU opponents'
    : 'no-stakes group of four · start anytime';
  const heroAction = hasPod ? () => onOpenTrainingPod?.(activeTrainingPod) : startPod;

  // Headline swap — the one status read already in scope (activeGroup.status). A
  // BATTLE player isn't waiting for anything, so the room reads "Between sessions".
  const inBattle = status === GROUP_STATUS.BATTLE;
  const headline = inBattle ? 'Between sessions' : 'While you wait';
  const eyebrow = inBattle ? 'Your game is live' : 'Your seat is locked in';
  const sub = inBattle
    ? 'Your battle runs in the background — practice a round between checks.'
    : 'Your seat is locked in for this week’s pod. Keep your instincts sharp before the draft.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 560, margin: '0 auto', marginBottom: desktop ? 0 : 18 }}>
      {/* headline — status-aware (While you wait · Between sessions) */}
      <div style={{ padding: '0 2px', marginBottom: 2 }}>
        <Eyebrow color={accent} style={{ marginBottom: 6 }}>{eyebrow}</Eyebrow>
        <div style={{ fontSize: desktop ? 22 : 20, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{headline}</div>
        <div style={{ fontSize: 13, color: LTOKENS.ink2, lineHeight: 1.5, marginTop: 7, maxWidth: 420 }}>{sub}</div>
      </div>

      {/* HERO — the training pod (start OR return; never both) */}
      <button
        type="button"
        className="lg-tap"
        onClick={heroAction}
        disabled={busy}
        style={{
          all: 'unset', boxSizing: 'border-box', width: '100%', cursor: busy ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 13, padding: desktop ? '18px 20px' : '16px 16px',
          borderRadius: 16, opacity: busy ? 0.7 : 1,
          background: `linear-gradient(120deg, ${alpha(accent, 0.22)}, ${alpha(accent, 0.07)})`,
          border: `1px solid ${alpha(accent, 0.45)}`, boxShadow: `0 8px 28px ${alpha(accent, 0.18)}`,
        }}
      >
        <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${alpha(accent, 0.4)}` }}>
          <LIcon name="play" size={19} color={LTOKENS.bg} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Mono style={{ fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: alpha(accent, 0.95) }}>Solo · Training Pod</Mono>
          <div style={{ fontSize: desktop ? 17 : 16, fontWeight: 700, color: LTOKENS.ink, letterSpacing: '-0.01em', marginTop: 3 }}>{heroTitle}</div>
          <Mono style={{ fontSize: 11, color: LTOKENS.ink3, marginTop: 2 }}>{heroSub}</Mono>
        </div>
        <Icon name="arrowR" size={20} color={accent} />
      </button>

      {/* the one quiet honesty line under the hero */}
      <Mono style={{ fontSize: 11, color: LTOKENS.ink3, letterSpacing: '0.02em', paddingLeft: 2 }}>
        Practice runs never touch the leaderboard.
      </Mono>

      {error && (
        <div role="alert" style={{ fontSize: 12, color: LX.neg, lineHeight: 1.4, paddingLeft: 2 }}>{error}</div>
      )}

      {/* secondaries — reuse-only nav */}
      {onOpenBaggerBomb && (
        <SecondaryRow
          icon={<LIcon name="bolt" size={16} color={accent} />}
          label={bbBusy ? 'Deploying your agent…' : 'Play a BaggerBomb round'}
          sub={bbBusy ? 'reading the market · vs CPU' : 'deploy your agent · vs CPU'}
          accent={accent}
          onClick={runBaggerBomb}
          disabled={bbBusy}
        />
      )}
      {liveWatchPod && onSpectate && (
        <SecondaryRow
          icon={<LIcon name="eyeR" size={16} color={accent} />}
          label="Watch a live game"
          sub="spectate a live pod"
          accent={accent}
          onClick={() => onSpectate(liveWatchPod, watchFocusId)}
        />
      )}

      {/* the honest one-line bracket footnote (display-honesty precedent copy) */}
      <div style={{ textAlign: 'center', paddingTop: 4 }}>
        <Mono style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: LTOKENS.ink3 }}>
          The monthly bracket opens when the season locks
        </Mono>
      </div>
    </div>
  );
}
