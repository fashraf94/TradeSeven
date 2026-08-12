// src/components/League/battleArena/LeagueBattleArenaLive.jsx
//
// League Battle View V2 — the EMBEDDED, real-data entry (Phase 3). Distinct from
// LeagueBattleArena.jsx (the fixed-position standalone fixtures preview): this one
// mounts INSIDE a host screen's content area as a full-width scale-to-fit block
// (position:relative, reserving scale*AD_H of column height — never a fixed
// overlay). It is the desktop battle takeover the host early-returns into.
//
// It owns no data fetching beyond useArenaModel — the host hands it the already-
// subscribed `group` + your `battle` + `compositeContext`. Owner-only.
//
// Reads are live and writes are wired: the real `handlers` (flipPick/placeClaim)
// flow into ArenaDesktop, so a flip optimistically reverses then rolls back on a
// server reject, and the claim doorway is the real drop+add sheet.

import React from 'react';
import './battleArena.css';
import { LTOKENS, alpha } from '../leagueTokens';
import { ArenaDesktop } from './ArenaDesktop';
import { ArenaMobile } from './ArenaMobile';
import { AD_W, AD_H } from './arenaLayout';
import { deriveArenaState, deriveArenaTerminalKind, normalizeArenaMode } from './arenaStateMap';
import { useArenaModel } from './useArenaModel';
import { buildScoreHistory } from './buildScoreHistory';
import { LEAGUE_SCORE_HISTORY_ON } from '../../../config/featureFlags';

// Agent Presence now lives on the battle axis itself (the per-seat heads inside
// ClimbArena), not as a corner overlay. The provisional overlay this file used to mount
// was removed when Placement 1 landed — the arena renders the presence in-place.

export default function LeagueBattleArenaLive({ group, battle, mode, uid, compositeContext, onBack = null, viewport = 'desktop', battleChain = [] }) {
  const { model, handlers, ready } = useArenaModel({ group, battle, mode, uid, compositeContext });
  const state = deriveArenaState(group);
  // League Score History (flag-gated): the Level 1 timeline + per-day swap ledger
  // for the Film Room recap, from the SAME banked group + the caller's OWN daily
  // battle chain. Null off-gate → the arena is byte-identical (no recap, no entry
  // point). Swap totals reconcile with the live strip's SWAPS by construction (§9).
  //
  // Chain fallback: a host that only threads the current `battle` (the training
  // and card-render hosts) still gets a §9-correct recap — the recap's CURRENT
  // day is then the same doc the live strip reads, so its today-subtotal matches
  // the strip's SWAPS. Prior days are simply absent (not a wrong number, not a
  // false "no swaps" while the strip shows a term). Hosts that thread the full
  // chain (the ranked participant flow) get every day.
  const effectiveChain = React.useMemo(
    () => (Array.isArray(battleChain) && battleChain.length > 0 ? battleChain : (battle ? [battle] : [])),
    [battleChain, battle],
  );
  const history = React.useMemo(
    () => (LEAGUE_SCORE_HISTORY_ON ? buildScoreHistory({ group, battleChain: effectiveChain, uid }) : null),
    [group, effectiveChain, uid],
  );
  // L-A: a voided cohort reads terminal ('complete'); the distinct kind drives the
  // client's "voided — no result" pill so it never reads as a real finish.
  const voided = deriveArenaTerminalKind(group) === 'voided';
  const md = normalizeArenaMode(mode);
  const mobile = viewport === 'mobile';
  const primary = md === 'ranked' ? LTOKENS.gold : LTOKENS.teal;

  // All hooks run UNCONDITIONALLY (rules of hooks) — `viewport` can flip on a
  // resize across the 768px line, so the desktop scale-to-fit measuring stays
  // mounted even in the mobile branch (its `fit` is simply unused there).
  const ref = React.useRef(null);
  const [fit, setFit] = React.useState({ scale: 1, offset: 0 });
  React.useEffect(() => {
    const compute = () => {
      const el = ref.current;
      if (!el) return;
      const w = el.clientWidth || AD_W;
      const s = Math.max(0.2, Math.min(1, w / AD_W));
      setFit({ scale: s, offset: Math.max(0, (w - s * AD_W) / 2) });
    };
    compute();
    const raf = requestAnimationFrame(compute);
    let ro;
    if (typeof ResizeObserver !== 'undefined' && ref.current) { ro = new ResizeObserver(compute); ro.observe(ref.current); }
    window.addEventListener('resize', compute);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('resize', compute); };
  }, []);

  // MOBILE — a full-bleed, page-scrolling container (NO scale-to-fit, NO
  // overflow:hidden): ArenaMobile pins its own hero and scrolls its tabs in page
  // flow. The desktop scale-to-fit block below is left untouched.
  if (mobile) {
    return (
      <div style={{ width: '100%', minHeight: '100%', background: '#050609',
        backgroundImage: `radial-gradient(circle at 50% 0%, ${alpha(primary, 0.06)}, transparent 55%)` }}>
        {ready && model ? (
          <ArenaMobile key={state + md} state={state} mode={md} data={model} handlers={handlers} onBack={onBack} voided={voided} history={history} />
        ) : (
          <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LTOKENS.ink3, fontFamily: 'monospace', fontSize: 12 }}>
            Loading the arena…
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative', background: '#050609', borderRadius: 16, overflow: 'hidden',
      backgroundImage: `radial-gradient(circle at 50% 0%, ${alpha(primary, 0.06)}, transparent 55%)` }}>
      {ready && model ? (
        <div style={{ height: Math.ceil(fit.scale * AD_H), overflow: 'hidden' }}>
          <div style={{ width: AD_W, height: AD_H, transform: `scale(${fit.scale})`, transformOrigin: 'top left', marginLeft: fit.offset }}>
            <ArenaDesktop key={state + md} state={state} mode={md} data={model} handlers={handlers} onBack={onBack} voided={voided} history={history} />
          </div>
        </div>
      ) : (
        <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: LTOKENS.ink3, fontFamily: 'monospace', fontSize: 12 }}>
          Loading the arena…
        </div>
      )}
    </div>
  );
}
