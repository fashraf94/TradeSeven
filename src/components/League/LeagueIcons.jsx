// src/components/League/LeagueIcons.jsx
//
// League glyph sets, transcribed from the Claude Design prototype
// (components.jsx `Icon` + league-parts.jsx `LIcon`). Inline line-SVGs so the
// funnel/cut-line/honesty vocabulary renders exactly as designed (lucide's
// trophy/crown/cut shapes differ). Only the glyphs the League surfaces actually
// use are carried.

import React from 'react';

// base line icons
export function Icon({ name, size = 18, color = 'currentColor', stroke = 1.7, style }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    arrowR: <path {...p} d="M5 12h14M13 6l6 6-6 6" />,
    check: <path {...p} d="M4 12.5l5 5L20 6" />,
    x: <path {...p} d="M6 6l12 12M18 6L6 18" />,
    clock: <g {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></g>,
    trophy: <g {...p}><path d="M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 18h6M12 14v4" /></g>,
    lock: <g {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></g>,
    chevR: <path {...p} d="M9 6l6 6-6 6" />,
    chevD: <path {...p} d="M6 9l6 6 6-6" />,
    refresh: <g {...p}><path d="M20 11a8 8 0 10-2.3 6.3" /><path d="M20 20v-5h-5" /></g>,
    layers: <g {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3.5 13L12 18l8.5-5" /></g>,
    // Battle View V2 additions (the nine-star dock + climb hero use these).
    plus: <path {...p} d="M12 6v12M6 12h12" />,
    eye: <g {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></g>,
    chat: <g {...p}><path d="M5 5h14a2 2 0 012 2v7a2 2 0 01-2 2h-7l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></g>,
    // Seated Status enrichment — the loadout "Edit in Forge" affordance.
    pencil: <g {...p}><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}>{paths[name]}</svg>;
}

// extra League glyphs the base set doesn't carry
export function LIcon({ name, size = 16, color = 'currentColor', stroke = 1.7, style }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    crown: <path {...p} d="M4 18h16M4 18l-1.5-9 5 4L12 6l4.5 7 5-4L20 18" />,
    cpu: <g {...p}><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10.5 10.5h3v3h-3z" /><path d="M9 4v2M12 4v2M15 4v2M9 18v2M12 18v2M15 18v2M4 9h2M4 12h2M4 15h2M18 9h2M18 12h2M18 15h2" /></g>,
    user: <g {...p}><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></g>,
    users: <g {...p}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0111 0" /><path d="M16 6.2a3 3 0 010 5.6M21 19a5.5 5.5 0 00-4-5.3" /></g>,
    long: <path {...p} d="M5 16l5-5 3 3 6-7M19 7h-4M19 7v4" />,
    short: <path {...p} d="M5 8l5 5 3-3 6 7M19 17h-4M19 17v-4" />,
    play: <path {...p} d="M7 4.5v15l13-7.5-13-7.5z" fill={color} stroke="none" />,
    ranked: <g {...p}><path d="M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M9 18h6M12 14v4" /></g>,
    eyeR: <g {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></g>,
    arrowL: <path {...p} d="M19 12H5M11 18l-6-6 6-6" />,
    flag: <g {...p}><path d="M5 21V4M5 4h11l-2 3.5L16 11H5" /></g>,
    // Battle View V2 additions (the nine-star dock + climb hero + agent voice).
    bolt: <path {...p} d="M13 2L4 13h6l-1 9 9-12h-6l1-8z" fill={color} stroke="none" />,
    pulse: <path {...p} d="M2 12h4l3-8 6 16 3-8h4" />,
    flip: <g {...p}><path d="M17 4l3 3-3 3" /><path d="M20 7H7a3 3 0 0 0-3 3" /><path d="M7 20l-3-3 3-3" /><path d="M4 17h13a3 3 0 0 0 3-3" /></g>,
    spark: <path {...p} d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" />,
    arrowUp: <path {...p} d="M12 19V5M6 11l6-6 6 6" />,
    arrowUpRight: <path {...p} d="M7 17L17 7M8 7h9v9" />,
    scissors: <g {...p}><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M8.5 7.5L20 18M8.5 16.5L20 6" /></g>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}>{paths[name]}</svg>;
}
