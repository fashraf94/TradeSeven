import { describe, it, expect } from 'vitest';
import { deriveSeed } from './myTournamentSeed';

describe('deriveSeed — humans-only field position', () => {
  const entries = {
    u_a: { odUserId: 'u_a', isCpu: false, points: 12 },
    u_b: { odUserId: 'u_b', points: 20 },                 // human (no isCpu flag)
    cpu_1: { odUserId: 'cpu_1', isCpu: true, points: 99 }, // excluded (top points)
    u_c: { odUserId: 'u_c', isCpu: false, points: 5 },
    cpu_2: { odUserId: 'cpu_2', isCpu: true, points: 30 }, // excluded
  };

  it('excludes CPUs from both the position and the field count', () => {
    // humans by points desc: u_b(20), u_a(12), u_c(5) → M = 3
    expect(deriveSeed(entries, 'u_b')).toEqual({ n: 1, m: 3 });
    expect(deriveSeed(entries, 'u_a')).toEqual({ n: 2, m: 3 });
    expect(deriveSeed(entries, 'u_c')).toEqual({ n: 3, m: 3 });
  });

  it('a CPU-heavy leader never inflates the human position', () => {
    expect(deriveSeed(entries, 'u_b').n).toBe(1); // cpu_1's top points are ignored
  });

  it('returns null when the user is absent from the field (honest empty)', () => {
    expect(deriveSeed(entries, 'nobody')).toBeNull();
  });

  it('returns null for missing uid / empty / undefined entries', () => {
    expect(deriveSeed(entries, undefined)).toBeNull();
    expect(deriveSeed({}, 'u_a')).toBeNull();
    expect(deriveSeed(undefined, 'u_a')).toBeNull();
  });

  it('treats a CPU seat requested by uid as unranked', () => {
    expect(deriveSeed(entries, 'cpu_1')).toBeNull();
  });

  it('missing points sort as 0', () => {
    const e = {
      a: { odUserId: 'a', points: 3 },
      b: { odUserId: 'b' },        // no points → 0
      c: { odUserId: 'c', points: -2 },
    };
    expect(deriveSeed(e, 'a')).toEqual({ n: 1, m: 3 });
    expect(deriveSeed(e, 'b')).toEqual({ n: 2, m: 3 });
    expect(deriveSeed(e, 'c')).toEqual({ n: 3, m: 3 });
  });
});
