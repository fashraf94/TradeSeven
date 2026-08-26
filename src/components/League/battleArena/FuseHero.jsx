// src/components/League/battleArena/FuseHero.jsx
//
// Branch A — THE FUSE HERO. The battleview's top half: x is the CLOCK, y is
// POINTS, and each of the four seats renders as a glowing line with a burning
// tip carrying its mech head and running value. Replaces the points-axis
// `ClimbArena` scatter. Authority: LEAGUE_BATTLEVIEW_ADJUDICATION_V1 (R1-R14)
// + the Branch A Build Spec and its Amendment A.
//
// ── PHASE 1 — STUB ─────────────────────────────────────────────────────────
// Ships DARK behind LEAGUE_FUSE_HERO_ENABLED and renders ONLY the empty framed
// box, at the exact dimensions `ClimbArena` occupies in both hosts, so the host
// branch can be wired and verified before any drawing lands. Deliberately inert:
// no data read, no timer, no network, no animation.
//
// Still to come, in order:
//   Phase 2 — the session accumulator feeding the TODAY axis (appends a
//             four-seat snapshot off `seatAltitude` -> `scoresAtLast` on ONE
//             shared clock; never `useLiveComposites` alone, which is
//             rivals-only by design — Amendment A3).
//   Phase 3 — desktop: fluid geometry, scales + labelled basement, the
//             continuous Catmull-Rom fuses with rung pulses (R11), tips with
//             mech heads + crown, the client-derived cut line
//             (`cutTotal = scoresAtLast[ranked[1]]` — Amendment A4, NEVER off
//             the mixed-basis `seats[].score`), y-label thinning, scope toggle.
//   Phase 6 — mobile/compact.
//
// PROP CONTRACT: mirrors `ClimbArena` (so the host swap stays drop-in) plus
// `scope` / `onScope`. Both hosts already pass the ClimbArena set; Phase 1
// consumes only `w` / `h`, and the remaining props are accepted-and-ignored
// rather than destructured, so the stub introduces no unused bindings.

import React from 'react';
import { LTOKENS } from '../leagueTokens';

export function FuseHero({ w, h }) {
  return (
    <div
      data-testid="fuse-hero"
      style={{
        position: 'relative',
        width: w,
        height: h,
        overflow: 'hidden',
        borderRadius: 18,
        background: LTOKENS.bg,
        border: `1px solid ${LTOKENS.hair}`,
      }}
    />
  );
}

export default FuseHero;
