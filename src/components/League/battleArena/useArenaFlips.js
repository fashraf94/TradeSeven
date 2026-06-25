// src/components/League/battleArena/useArenaFlips.js
//
// League Battle View V2 — the per-pick FLIP controller (Phase 4). Extracted
// VERBATIM from DockYourThree so the desktop dock AND the mobile Your-Portfolio
// panel share ONE money-adjacent flip path — the optimistic-write + server-
// authoritative ROLLBACK contract, not two copies that can drift.
//
// Optimistic + server-authoritative: show the new direction immediately, then ROLL
// BACK if the server rejects (no phantom flip that never banked). The celebratory
// drama (surge token + caption via onFlipDrama) fires ONLY after the server
// confirms — a rejected flip never plays the "it worked" animation. The
// authoritative group subscription reconciles a confirmed flip's leg; the prune
// effect then drops the now-redundant override (the phantom-direction bug guard).
//
// PREVIEW mode: when `onFlip` is null (the fixtures `?battleViewV2=1` surface),
// there is no server — fire the drama immediately and keep the optimistic leg.
//
// State is per-component-instance (each consumer gets its own dirs/flipError/
// in-flight ref). The desktop dock and the mobile panel never mount together, so
// the "one flip at a time" guard is correctly scoped per panel.

import React from 'react';

/**
 * @param {Array<{tk:string, dir:string}>} stars  the live star rows (authoritative dir)
 * @param {(tk:string,newDir:string)=>Promise<any>|null} onFlip  server write (null = preview)
 * @param {(tk:string,newDir:string)=>void} [onFlipDrama]  fire the on-board drama
 * @returns {{ dirOf:(s:{tk:string,dir:string})=>string, doFlip:(tk:string,nd:string)=>Promise<void>, flipError:(string|null) }}
 */
export function useArenaFlips(stars, onFlip, onFlipDrama) {
  // optimistic flip OVERRIDES keyed by ticker; anything unset falls back to the
  // live star's direction, so a pick swapped in by a claim never reads undefined.
  const [dirs, setDirs] = React.useState({});
  const [flipError, setFlipError] = React.useState(null);
  const flipInFlight = React.useRef(false); // one flip at a time (FlipsTab discipline)
  const dirOf = (s) => dirs[s.tk] ?? s.dir;

  // Prune a reconciled override once the authoritative star.dir catches up to it
  // (a confirmed immediate flip). Without this an override would shadow star.dir
  // forever, hiding later leg changes from other paths (a claim swap, a queued
  // flip executing at open) — the phantom-direction bug.
  React.useEffect(() => {
    setDirs((d) => {
      let changed = false;
      const n = { ...d };
      for (const s of stars) { if (n[s.tk] != null && n[s.tk] === s.dir) { delete n[s.tk]; changed = true; } }
      return changed ? n : d;
    });
  }, [stars]);

  const doFlip = async (tk, nd) => {
    if (flipInFlight.current) return;
    setDirs((d) => ({ ...d, [tk]: nd })); // optimistic direction (immediate)
    setFlipError(null);
    if (!onFlip) { if (onFlipDrama) onFlipDrama(tk, nd); return; } // preview: drama now, no server
    flipInFlight.current = true;
    try {
      await onFlip(tk, nd); // the server write (rejects on a server error)
      if (onFlipDrama) onFlipDrama(tk, nd); // confirmed → fire the drama
    } catch (err) {
      setDirs((d) => { const n = { ...d }; delete n[tk]; return n; }); // rollback to the live leg
      setFlipError(err?.message || 'Flip failed — try again.'); // already-mapped by useArenaModel
    } finally {
      flipInFlight.current = false;
    }
  };

  return { dirOf, doFlip, flipError };
}
