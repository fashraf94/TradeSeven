// src/components/League/leagueSeatPalette.guard.test.js
//
// THE DURABLE HALF of the crown-collision fix.
//
// The defect: HUMAN_PALETTE slot 2 was '#F0C75E' — byte-identical to
// LTOKENS.gold, the leader crown's colour. One human rival in eight wore the
// crown's own hue as identity, so when that seat led, gold carried two meanings
// at once. Re-stepping the slot fixes today; this guard is what stops the next
// palette edit walking back into gold.
//
// ΔE is Euclidean distance in OKLab ×100, matching the dataviz validator's
// metric exactly (its hard floor for two colours a normal-vision reader must
// tell apart is 15). Implemented here rather than imported so the guard has no
// production dependency and cannot be weakened by a change elsewhere.

import { describe, it, expect } from 'vitest';
import { seatColor } from './leagueAdapter';
import { LTOKENS, LX } from './leagueTokens';

const NORMAL_VISION_FLOOR = 15;

const hex2srgb = (h) => {
  const m = String(h).replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
const s2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin = (h) => hex2srgb(h).map(s2lin);
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
const deltaE = (a, b) => {
  const [p, q] = [oklab(lin(a)), oklab(lin(b))];
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

// Every hue seatColor can actually return: the CPU violet plus the human ramp,
// sampled through the PUBLIC api so a palette edit is covered however it is
// shaped internally.
function everySeatHue() {
  const hues = new Set([seatColor('cpu-1', true)]);
  for (let i = 0; i < 400; i += 1) hues.add(seatColor(`probe-user-${i}`, false));
  return [...hues];
}

describe('league seat palette — no seat hue may collide with the leader crown', () => {
  it('the guard is not vacuous: it samples the whole human ramp plus the CPU hue', () => {
    const hues = everySeatHue();
    expect(hues.length).toBeGreaterThanOrEqual(8);
    for (const h of hues) expect(h).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('every seat hue is perceptually clear of LTOKENS.gold (the crown)', () => {
    const bad = everySeatHue()
      .map((h) => ({ h, d: deltaE(h, LTOKENS.gold) }))
      .filter((x) => x.d < NORMAL_VISION_FLOOR);
    expect(
      bad,
      `seat hue(s) too close to the crown gold ${LTOKENS.gold} — a leading seat would wear the crown's own colour: `
      + bad.map((x) => `${x.h} ΔE ${x.d.toFixed(1)}`).join(', '),
    ).toEqual([]);
  });

  it('and clear of LX.cut, the cut line (gold carries that meaning too)', () => {
    const bad = everySeatHue().filter((h) => deltaE(h, LX.cut) < NORMAL_VISION_FLOOR);
    expect(bad, `seat hue(s) indistinguishable from the cut line: ${bad.join(', ')}`).toEqual([]);
  });

  it('the specific regression is dead: no seat hue is byte-identical to the crown', () => {
    const gold = LTOKENS.gold.toUpperCase();
    expect(everySeatHue().map((h) => h.toUpperCase())).not.toContain(gold);
  });

  it('the guard WOULD fire on the old palette (proof it can fail)', () => {
    // The exact value that shipped before this fix.
    expect(deltaE('#F0C75E', LTOKENS.gold)).toBeLessThan(NORMAL_VISION_FLOOR);
    // …and the replacement clears it with room to spare.
    expect(deltaE('#E86A92', LTOKENS.gold)).toBeGreaterThan(20);
  });
});
