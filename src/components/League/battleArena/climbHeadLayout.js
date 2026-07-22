// src/components/League/battleArena/climbHeadLayout.js
//
// Presence-head layout for the ClimbArena battle axis. Split out of ClimbArena.jsx so the
// view file exports ONLY a component (react-refresh/only-export-components) — the same
// discipline as faceEngine/faceEngineCore — and so the collision test can read the SAME
// numbers the component renders (no drift).
//
// The head renders LARGER than the orb it replaces (a legible mood read). The face optical
// centre sits ~10.3% of `size` BELOW the SVG bounding-box centre (viewBox 30 6 140 156:
// face-body centre y=100 vs box centre y=84 → 16/156), so a head placed at the orb's
// translate(-50%,-50%) anchor must be lifted by HEAD_FACE_LIFT*size for the FACE centre to
// inherit the orb's exact (x, Y(composite)) anchor — the non-negotiable P&L anchor. The
// score label is decoration offset from that; it is never the anchor.

export const HEAD_FACE_LIFT = 16 / 156; // ≈ 0.1026 — up-shift so the face centre = the anchor
export const LABEL_BELOW_GAP = 4;       // score-label gap below the head footprint (compact)

// Head render sizes (larger than the orb: orb was you 52/46/40 desktop, 44/40/36 compact).
export function headSizeFor(you, lead, compact) {
  return compact ? (you ? 54 : lead ? 48 : 44) : (you ? 64 : lead ? 58 : 50);
}
