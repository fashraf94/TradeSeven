// src/components/Tournament/awaitingOpen/AwaitingOpenShell.jsx
//
// Awaiting-the-Open redesign — the page shell and its atmosphere (build spec
// §4 / §7). Layout only: it owns the column, the section rhythm and the
// background wash, and renders whatever sections it is given. The sections
// themselves land phase by phase behind AWAITING_OPEN_REDESIGN_ENABLED.
//
// Atmosphere: two low-alpha radial gradients — teal from the top-left, the
// ownership blue from the top-right — on a viewport-fixed layer behind the
// content, so the wash reads as depth on the page rather than as a band inside
// the column. It is decorative and inert (pointerEvents: none).
//
// HAZARD (inherited, deliberate): the layer carries NO transform / filter /
// contain / will-change / perspective, and neither does the content wrapper.
// The host's desktop awaiting-open path is a bounded-height scroll frame
// (LeagueTrainingBattleView.jsx:101-103) and any such property on an ancestor
// would trap the position:fixed AssetResearchModal inside it instead of letting
// it escape to the viewport.
//
// Bottom-nav clearance is the host's: its page padding already reserves
// `env(safe-area-inset-bottom) + 130px` (LeagueTrainingBattleView.jsx:84) over a
// 64px fixed nav, so nothing in this column can sit under it.

import React from 'react';
import { FONT_VARS } from '../../League/draft/draftTokens';
import { alpha } from './awaitTokens';
import { useAwaitPalette, useAwaitCSS } from './awaitPrimitives';

export default function AwaitingOpenShell({ children, desktop = false }) {
  const pal = useAwaitPalette();
  useAwaitCSS(pal);

  return (
    <div style={{ position: 'relative', ...FONT_VARS }}>
      {/* atmosphere — decorative, inert, behind everything */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle at 10% -10%, ${alpha(pal.teal, 0.07)}, transparent 44%), `
            + `radial-gradient(circle at 94% 6%, ${alpha(pal.you, 0.045)}, transparent 38%)`,
        }}
      />

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', gap: desktop ? 14 : 12, minWidth: 0,
      }}>
        {children}
      </div>
    </div>
  );
}
