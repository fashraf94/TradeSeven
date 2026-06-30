// src/components/League/battleArena/LeagueBattleArena.jsx
//
// League Battle View V2 — the desktop arena PREVIEW entry. The dev/dark surface
// behind `?battleViewV2=1` (the `?leagueClimb=1` precedent): a fixed obsidian
// stage that scales the fixed-geometry ArenaDesktop to fit the viewport, replays
// when the state/context switches, and hands "League" (onBack) back to the normal
// tab. Fixtures-backed (Phase 2) — the live-data read-site lands in a later phase.
//
// Props: { state:'awaiting'|'live'|'complete', mode:'training'|'ranked', onBack }.

import React from 'react';
import './battleArena.css';
import { LTOKENS, alpha } from '../leagueTokens';
import { ArenaDesktop } from './ArenaDesktop';
import { AD_W, AD_H } from './arenaLayout';
import { ARENA_STATES, normalizeArenaMode } from './arenaStateMap';

export default function LeagueBattleArena({ state = 'live', mode = 'ranked', onBack }) {
  const st = ARENA_STATES.includes(state) ? state : 'live';
  const md = normalizeArenaMode(mode);
  const ref = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const fit = () => {
      const el = ref.current;
      const w = (el && el.clientWidth) || window.innerWidth;
      const h = (el && el.clientHeight) || window.innerHeight;
      if (!w || !h) return;
      setScale(Math.max(0.05, Math.min(1, (w - 40) / AD_W, (h - 40) / AD_H)));
    };
    fit();
    const raf = requestAnimationFrame(fit);
    const id = setTimeout(fit, 200);
    let ro;
    if (typeof ResizeObserver !== 'undefined' && ref.current) { ro = new ResizeObserver(fit); ro.observe(ref.current); }
    window.addEventListener('resize', fit);
    return () => { cancelAnimationFrame(raf); clearTimeout(id); if (ro) ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  const primary = md === 'ranked' ? LTOKENS.gold : LTOKENS.teal;
  return (
    <div ref={ref} style={{ position: 'fixed', inset: 0, background: '#050609', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: LTOKENS.ink, backgroundImage: `radial-gradient(circle at 50% 0%, ${alpha(primary, 0.06)}, transparent 55%)`, overflow: 'hidden' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        <div style={{ width: AD_W, height: AD_H, borderRadius: 16, overflow: 'hidden', position: 'relative',
          background: LTOKENS.bg, border: `1px solid ${LTOKENS.hair2}`, boxShadow: '0 40px 120px rgba(0,0,0,0.6)' }}>
          <ArenaDesktop key={st + md} state={st} mode={md} onBack={onBack} />
        </div>
      </div>
    </div>
  );
}
