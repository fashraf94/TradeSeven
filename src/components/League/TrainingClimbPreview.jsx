// src/components/League/TrainingClimbPreview.jsx
//
// League Training tab — the ACTIVE-BATTLE re-entry surface, upgraded from a flat
// "Return to your training pod" card to the real five-day Altitude Climb. Tapping
// the climb enters the pod's live battle view (the original Issue-2 ask).
//
// REAL DATA, NOT FIXTURES: this reuses the Battle-View-V2 real-data path end to
// end — the pure `buildArenaModel` bridge (dailyScores → seats + climb series via
// `buildClimbSeries`) feeding the arena's `ClimbArena` hero. It renders the ACTUAL
// pod, never the fixtures-only standalone `LeagueClimb` (which would leak the demo
// pod onto a live surface — the class of bug PR #551 fixed). Owner-only and
// preview-lean: called with battle=null (a preview reads only seats + climb; your
// archetype / stars / claim wire are the battle view's job), so it opens no price
// socket and no claims listener — just the one-shot display-name resolve the live
// arena also does.
//
// Mounted DARK behind LEAGUE_TRAINING_CLIMB_PREVIEW_ENABLED (/ ?trainingClimbPreview=1),
// and only for GROUP_STATUS.BATTLE pods (see trainingClimbPreviewGate) — a
// pre-bell (DRAFTING/AWAITING_OPEN) pod keeps its existing card; a null pod is the
// untouched cold-start.

import React from 'react';
import './league.css'; // lg-tap + the lgLiveDot heartbeat keyframe
import './battleArena/battleArena.css'; // the climb's ambient bv2-* motion (reduced-motion-gated globally)
import { LTOKENS, alpha } from './leagueTokens';
import { Eyebrow, Mono, Icon, LIcon } from './LeagueParts';
import { ClimbArena } from './battleArena/ClimbArena';
import { buildArenaModel, liveDayIdx } from './battleArena/buildArenaModel';
import { deriveArenaState } from './battleArena/arenaStateMap';
import { fetchDisplayNames } from '../../services/tournamentGroupService';
import { isCpuUserId } from '../../constants/leagueTournament';

// Mirrors LeagueDeskParts `TRAIN` (kept local to avoid a circular import — that
// module imports THIS one). The training purple; ClimbArena keeps its own teal
// training tone internally, so this only tints the surrounding card chrome.
const TRAIN_PURPLE = '#8b5cf6';

export default function TrainingClimbPreview({ pod, uid, onOpen, viewport = 'desktop', accent = TRAIN_PURPLE }) {
  const compact = viewport === 'mobile';

  // Human display names — the SAME one-shot-per-membership resolve useArenaModel
  // does (CPUs excluded; degrade to odUserId on failure, never block the render).
  const [names, setNames] = React.useState({});
  const humanIdsKey = React.useMemo(
    () => (pod?.players || [])
      .map((p) => p?.odUserId)
      .filter((id) => id && !isCpuUserId(id))
      .sort()
      .join(','),
    [pod],
  );
  React.useEffect(() => {
    if (!humanIdsKey) return undefined;
    let alive = true;
    fetchDisplayNames(humanIdsKey.split(','))
      .then((n) => { if (alive) setNames(n || {}); })
      .catch(() => { /* names degrade to odUserId — non-fatal */ });
    return () => { alive = false; };
  }, [humanIdsKey]);

  // ClimbArena needs explicit pixel geometry — measure the card width, reserve a
  // fixed height. Effects don't run under SSR/renderToString, so the first paint
  // uses this default and the ResizeObserver refines it client-side (the same
  // measure-then-scale idiom as LeagueBattleArenaLive). The default is a
  // conservative 288 — narrower than the smallest common phone column — so the
  // first frame UNDER-shoots and grows to fit rather than over-shooting into a
  // one-frame horizontal overflow.
  const wrapRef = React.useRef(null);
  const [w, setW] = React.useState(288);
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const measure = () => { const el = wrapRef.current; if (el && el.clientWidth) setW(el.clientWidth); };
    measure();
    const raf = window.requestAnimationFrame ? window.requestAnimationFrame(measure) : null;
    let ro;
    if (typeof ResizeObserver !== 'undefined' && wrapRef.current) { ro = new ResizeObserver(measure); ro.observe(wrapRef.current); }
    window.addEventListener('resize', measure);
    return () => {
      if (raf && window.cancelAnimationFrame) window.cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [compact]);

  // The real-data bridge — the SAME pure transform the live arena uses, called
  // with battle=null (preview needs only seats + climb). Renders the ACTUAL pod.
  const model = React.useMemo(
    () => buildArenaModel({ group: pod, battle: null, claims: [], priceCtx: {}, displayNames: names, uid, mode: 'training' }),
    [pod, names, uid],
  );
  const state = deriveArenaState(pod);
  const dayIdx = liveDayIdx(model.climb);
  const h = compact ? 300 : 336;
  const hasSeats = (model.seats?.length || 0) > 0;

  return (
    <button
      type="button"
      className="lg-tap"
      onClick={onOpen}
      aria-label="Open your training pod's battle view"
      style={{
        all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'block',
        borderRadius: 18, border: `1px solid ${alpha(accent, 0.4)}`,
        background: `linear-gradient(160deg, ${alpha(accent, 0.1)}, ${LTOKENS.surface} 60%)`,
        padding: 12, boxShadow: `0 8px 28px ${alpha(accent, 0.14)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Eyebrow color={accent}>The climb · your training pod</Eyebrow>
          {/* LIVE marker — parity with the re-entry card this replaces (it carried a
              LIVE pill); gated to BATTLE by the caller, so the pod is always live here. */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999,
            background: alpha(accent, 0.14), border: `1px solid ${alpha(accent, 0.32)}` }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, animation: 'lgLiveDot 1.6s infinite' }} />
            <Mono style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: accent }}>LIVE</Mono>
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: accent }}>
          <Mono style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>ENTER</Mono>
          <Icon name="arrowR" size={14} color={accent} />
        </span>
      </div>

      <div ref={wrapRef} style={{ width: '100%' }}>
        {hasSeats && w > 0 && (
          <ClimbArena
            state={state}
            mode="training"
            seats={model.seats}
            climb={model.climb}
            youId={model.youId}
            w={w}
            h={h}
            dayIdx={dayIdx}
            compact={compact}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '0 2px' }}>
        <LIcon name="play" size={13} color={accent} stroke={2} />
        <Mono style={{ fontSize: 10.5, color: LTOKENS.ink2, letterSpacing: '0.02em' }}>
          Tap the climb to enter your training battle · CPU opponents, no stakes
        </Mono>
      </div>
    </button>
  );
}
