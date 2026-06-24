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
import { AD_W, AD_H } from './arenaLayout';
import { deriveArenaState, normalizeArenaMode } from './arenaStateMap';
import { useArenaModel } from './useArenaModel';

export default function LeagueBattleArenaLive({ group, battle, mode, uid, compositeContext, onBack = null }) {
  const { model, handlers, ready } = useArenaModel({ group, battle, mode, uid, compositeContext });
  const state = deriveArenaState(group);
  const md = normalizeArenaMode(mode);

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

  const primary = md === 'ranked' ? LTOKENS.gold : LTOKENS.teal;
  return (
    <div ref={ref} style={{ width: '100%', position: 'relative', background: '#050609', borderRadius: 16, overflow: 'hidden',
      backgroundImage: `radial-gradient(circle at 50% 0%, ${alpha(primary, 0.06)}, transparent 55%)` }}>
      {ready && model ? (
        <div style={{ height: Math.ceil(fit.scale * AD_H), overflow: 'hidden' }}>
          <div style={{ width: AD_W, height: AD_H, transform: `scale(${fit.scale})`, transformOrigin: 'top left', marginLeft: fit.offset }}>
            <ArenaDesktop key={state + md} state={state} mode={md} data={model} handlers={handlers} onBack={onBack} />
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
