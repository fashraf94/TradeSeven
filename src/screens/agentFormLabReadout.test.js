// src/screens/agentFormLabReadout.test.js
//
// Build S0 — the lab readout's lines, in the S7 smoke readout's exact format
// (docs/audits/20261025_BUILD_COMMAND_CENTER_HUB_S7.md §13): "fps N · cost X ms" and
// "W s: F fps · avg A · p95 P ms · late L%". Late is a gap over the rate's threshold (25 ms live, 50 ms
// half); a gap that ends on a resumed frame (a hidden page, a lost context, a stopped loop) is not counted.

import { describe, expect, it } from 'vitest';
import { readoutLine, lastSecondLine } from './agentFormLabReadout';

const frames = (n, every, cost = 2, start = 0) => Array.from({ length: n }, (_, i) => ({ t: start + i * every, cost, resumed: i === 0 }));

describe('the lab readout (S7 format)', () => {
  it('a steady 60 fps run: S7\'s two lines', () => {
    const s = frames(601, 1000 / 60);
    expect(lastSecondLine(s, s.at(-1).t)).toBe('fps 61 · cost 2.00 ms');
    expect(readoutLine(s, s.at(-1).t, 60000, 25).text).toBe('10 s: 60.0 fps · avg 2.00 · p95 2.00 ms · late 0.0%');
  });

  it('late counts gaps over the threshold; p95 is the 95th percentile of cost', () => {
    const s = frames(101, 16);
    s[50].t += 30; for (let i = 51; i < s.length; i += 1) s[i].t += 30; // one 46 ms gap
    s.forEach((x, i) => { x.cost = i < 95 ? 1 : 9; });
    const line = readoutLine(s, s.at(-1).t, 60000, 25).text;
    expect(line).toMatch(/· late 1\.0%$/);
    expect(line).toMatch(/· p95 9\.00 ms ·/);
  });

  it('at half rate the intended cadence is 33 ms: late means over 50 ms, so a steady half rate reads 0 % late', () => {
    const s = frames(181, 1000 / 30);
    expect(readoutLine(s, s.at(-1).t, 60000, 50).text).toBe('6 s: 30.0 fps · avg 2.00 · p95 2.00 ms · late 0.0%');
    expect(readoutLine(s, s.at(-1).t, 60000, 25).text).toMatch(/late 100\.0%$/);
  });

  it('a gap across a hidden page (a resumed frame) is neither late nor time', () => {
    const before = frames(61, 1000 / 60), after = frames(61, 1000 / 60, 2, before.at(-1).t + 30000);
    const s = [...before, ...after];
    expect(readoutLine(s, s.at(-1).t, 60000, 25).text).toBe('2 s: 60.0 fps · avg 2.00 · p95 2.00 ms · late 0.0%');
  });

  it('the window keeps only its own samples, and an empty one says so', () => {
    const s = frames(400, 1000);
    expect(readoutLine(s, s.at(-1).t, 60000, 25).text.startsWith('60 s: 1.0 fps')).toBe(true);
    expect(readoutLine(s, s.at(-1).t, 300000, 25).text.startsWith('300 s:')).toBe(true);
    expect(readoutLine([], 0, 60000, 25).text).toBe('collecting…');
  });
});
