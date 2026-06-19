// src/components/League/draft/draftIcons.jsx
//
// Line glyphs for the League draft board, ported from the design's Icon + DIcon
// sets (components.jsx / draft-parts.jsx). One component, sized via props.

import React from 'react';
import { TOKENS } from './draftTokens';

export function Icon({ name, size = 18, color = 'currentColor', stroke = 1.7, style }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    bolt:    <path {...p} d="M13 2L4 13h6l-1 9 9-12h-6l1-8z" fill={color} stroke="none" />,
    trend:   <path {...p} d="M3 17l5-6 4 3 6-8M16 6h5v5" />,
    refresh: <g {...p}><path d="M20 11a8 8 0 10-1.8 6.3M20 4v6h-6" /></g>,
    grid:    <g {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></g>,
    shield:  <path {...p} d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
    anchor:  <g {...p}><circle cx="12" cy="5" r="2.4" /><path d="M12 7.4V21M5 13a7 7 0 0014 0M5 13H3m16 0h2" /></g>,
    search:  <g {...p}><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></g>,
    check:   <path {...p} d="M4 12.5l5 5L20 6" />,
    x:       <path {...p} d="M6 6l12 12M18 6L6 18" />,
    chevD:   <path {...p} d="M5 9l7 7 7-7" />,
    chevR:   <path {...p} d="M9 5l7 7-7 7" />,
    arrowR:  <path {...p} d="M5 12h14M13 6l6 6-6 6" />,
    arrowL:  <path {...p} d="M19 12H5M11 18l-6-6 6-6" />,
    clock:   <g {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></g>,
    cpu:     <g {...p}><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M10.5 10.5h3v3h-3z" /><path d="M9 4v2M12 4v2M15 4v2M9 18v2M12 18v2M15 18v2M4 9h2M4 12h2M4 15h2M18 9h2M18 12h2M18 15h2" /></g>,
    user:    <g {...p}><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></g>,
    snipe:   <g {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></g>,
    target:  <g {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" /></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}>
      {paths[name] || null}
    </svg>
  );
}

export default Icon;

// re-export a token consumers occasionally need inline with icons
export { TOKENS };
