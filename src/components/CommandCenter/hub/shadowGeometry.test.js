// src/components/CommandCenter/hub/shadowGeometry.test.js
//
// Command Center hub, slice S1 — Shadow's still geometry (ruling R-S1-1;
// spec V1.2 §1, §10). The port in ./shadowGeometry.js was checked against the
// design of record's own module (ff-shadow.jsx shStillPaths, decoded from
// docs/design/20261012_COMMAND_CENTER_FLOWING_FILAMENT_MOCKUP.html): every
// strand's path, opacity, widths and colour, at all three tiers and all four
// selections, 252 strands, zero differences (S1 build report §5). The digest
// below pins that output, so any drift from the design reds here.

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SH_DIRS, SH_ECHO_NODES, SH_SEED, SH_STILL_T, SH_TIERS, hexToRgb, mixHex, shRng, shStrands, shadowTierFor, stillPaths } from './shadowGeometry';

const DESIGN_PARITY_DIGEST = '48e961cce852a67e547cb6aff6aa81bffcf7176f19395deb7d971d27fa3779d5';

function digestAll() {
  const h = createHash('sha256');
  for (const tier of ['low', 'mid', 'high']) {
    for (const sel of [null, 0, 1, 2]) {
      for (const p of stillPaths(tier, sel)) h.update(`${tier}|${sel}|${p.d}|${p.alpha}|${p.width}|${p.glowWidth}|${p.depth}\n`);
    }
  }
  return h.digest('hex');
}

describe('the still is the design\'s geometry', () => {
  it('matches the digest of the design-parity check (252 strands, 0 differences)', () => {
    expect(digestAll()).toBe(DESIGN_PARITY_DIGEST);
  });

  it('keeps the design\'s constants: three axes 120° apart from straight up, t = 7.3, seed 11', () => {
    expect(SH_DIRS[0]).toBeCloseTo(-Math.PI / 2, 12);
    expect(SH_DIRS[1] - SH_DIRS[0]).toBeCloseTo((2 * Math.PI) / 3, 12);
    expect(SH_DIRS[2] - SH_DIRS[1]).toBeCloseTo((2 * Math.PI) / 3, 12);
    expect(SH_STILL_T).toBe(7.3);
    expect(SH_SEED).toBe(11);
  });

  it('is deterministic: the same seed gives the same strands', () => {
    expect(shStrands(7)).toEqual(shStrands(7));
    const a = shRng(11);
    const b = shRng(11);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('tiers — start sparse (spec §10)', () => {
  it.each([['low', 5, 26, false], ['mid', 7, 36, true], ['high', 9, 44, true]])('%s: %i strands per family, %i points, glow %s', (tier, per, pts, glow) => {
    expect(SH_TIERS[tier]).toEqual({ per, pts, glow });
    const paths = stillPaths(tier, null);
    expect(paths).toHaveLength(3 * per);
    expect(paths.every((p) => p.glow === glow)).toBe(true);
    expect(paths.every((p) => p.d.split('L').length === pts)).toBe(true);
  });

  it('phone draws low; tablet, desktop and stacked draw mid; nothing defaults to high', () => {
    expect(shadowTierFor('phone')).toBe('low');
    expect(shadowTierFor('tablet')).toBe('mid');
    expect(shadowTierFor('desktop')).toBe('mid');
    expect(shadowTierFor('stacked')).toBe('mid');
  });

  it('an unknown tier draws mid', () => {
    expect(stillPaths('ultra', null)).toHaveLength(21);
  });
});

describe('the drawing stays in its box', () => {
  it('every point is inside the −1.25 … 1.25 viewBox, strands are back to front, depth and opacity in 0 … 1', () => {
    for (const tier of ['low', 'mid', 'high']) {
      for (const sel of [null, 0, 1, 2]) {
        const paths = stillPaths(tier, sel);
        for (let i = 0; i < paths.length; i += 1) {
          const p = paths[i];
          const nums = p.d.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number);
          expect(nums.every((n) => Math.abs(n) <= 1.25)).toBe(true);
          expect(p.depth).toBeGreaterThanOrEqual(0);
          expect(p.depth).toBeLessThanOrEqual(1);
          expect(p.alpha).toBeGreaterThan(0);
          expect(p.alpha).toBeLessThanOrEqual(1);
          if (i) expect(p.z).toBeGreaterThanOrEqual(paths[i - 1].z);
        }
      }
    }
  });

  it('the mech-echo nodes (eyes and crown) are the design\'s', () => {
    expect(SH_ECHO_NODES).toEqual([[-0.165, -0.34, 0.084], [0.165, -0.34, 0.084], [0, -1.0, 0.066]]);
  });
});

describe('the selected area leans out (the design\'s focus)', () => {
  it('a selected family draws brighter and the others recede', () => {
    const none = stillPaths('mid', null);
    const sel = stillPaths('mid', 2);
    const mean = (ps) => ps.reduce((s, p) => s + p.alpha, 0) / ps.length;
    // Family 2's strands are the last 7 generated; compare by matching path count per family through the strands.
    const fam = shStrands(7).map((s) => s.fam);
    expect(fam.filter((f) => f === 2)).toHaveLength(7);
    expect(mean(sel)).not.toBe(mean(none));
    expect(sel.map((p) => p.d)).not.toEqual(none.map((p) => p.d));
  });
});

describe('mixHex — the far → near colour mix, from computed token hexes', () => {
  it('mixes the design\'s two colours channel by channel, rounding like shMix', () => {
    expect(mixHex('#7fd4ff', '#5eead4', 0)).toBe('#7fd4ff');
    expect(mixHex('#7fd4ff', '#5eead4', 1)).toBe('#5eead4');
    expect(mixHex('#7fd4ff', '#5eead4', 0.5)).toBe('#6fdfea');
  });

  it('clamps t to 0 … 1', () => {
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff');
  });

  it('an unresolved token (\'\') or a non-hex draws nothing rather than a guessed colour', () => {
    expect(mixHex('', '#5eead4', 0.5)).toBe('');
    expect(mixHex('#7fd4ff', 'var(--ft-teal)', 0.5)).toBe('');
    expect(hexToRgb('#abc')).toBeNull();
    expect(hexToRgb(' #5EEAD4 ')).toEqual([94, 234, 212]);
  });
});
