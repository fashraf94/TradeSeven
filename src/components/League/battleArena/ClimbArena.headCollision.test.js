// src/components/League/battleArena/ClimbArena.headCollision.test.js
//
// Verifies the founder's non-negotiable: with the score label moved BELOW the head, a
// bigger head + its label must NOT collide with a neighbouring head when scores are
// BUNCHED (competitors at the same altitude). Heads sit in FIXED lanes (X by index), so
// when bunched they share a Y band and every label hangs at the same Y just below it —
// the only possible collision is HORIZONTAL, a label reaching into the neighbour lane.
// The guard is therefore: laneW > labelHalfWidth + neighbourHeadHalfWidth.
//
// `headSizeFor` + `COMPACT_AXIS_W` are IMPORTED from the layout module (no drift). The
// remaining lane/label model is mirrored from ClimbArena's compact path and must track it:
//   laneW=(w-axisW)/n; halo width = headSz+14 (the widest DRAWN element, for you/leader);
//   label centred under the head; ArenaCount is monospace JetBrains Mono (~0.6*fontSize per
//   char), fontSize = compact you?15:12.

import { describe, it, expect } from 'vitest';
import { headSizeFor, COMPACT_AXIS_W } from './climbHeadLayout';

const laneW = (w, n) => (w - COMPACT_AXIS_W) / n;
const halfHead = (you, lead) => (headSizeFor(you, lead, true) + 14) / 2; // halo = the widest drawn element
const halfLabel = (you, chars) => (chars * 0.6 * (you ? 15 : 12)) / 2;

// Worst realistic composite label: 6 chars (e.g. "-234.5" / "1234.5"). Real league
// composites are smaller (2–4 sig figs), so this is a stress bound, not the norm.
const CHARS = 6;

// The worst adjacency: the two LARGEST heads (you 54px, leader 48px) side by side, with a
// rival on each end — maximises head+label widths on shared lane boundaries.
const WORST = [
  { you: true, lead: false },
  { you: false, lead: true },
  { you: false, lead: false },
  { you: false, lead: false },
];

describe('ClimbArena — label-below clears the neighbour head when bunched', () => {
  // 280 = ArenaMobile's heroW floor (Math.max(280, clientWidth)); 360 = a typical phone.
  for (const w of [280, 360]) {
    it(`heroW=${w}: every bunched label clears both neighbour heads and labels`, () => {
      const n = WORST.length;
      const lw = laneW(w, n);
      for (let i = 0; i < n - 1; i += 1) {
        const a = WORST[i];
        const b = WORST[i + 1];
        // label(a) ↔ neighbour head(b), and label(b) ↔ neighbour head(a)
        expect(halfLabel(a.you, CHARS) + halfHead(b.you, b.lead)).toBeLessThan(lw);
        expect(halfLabel(b.you, CHARS) + halfHead(a.you, a.lead)).toBeLessThan(lw);
        // label(a) ↔ label(b) (two below-labels in adjacent lanes)
        expect(halfLabel(a.you, CHARS) + halfLabel(b.you, CHARS)).toBeLessThan(lw);
      }
    });
  }
});
