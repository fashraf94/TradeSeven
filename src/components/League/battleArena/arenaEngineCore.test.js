// src/components/League/battleArena/arenaEngineCore.test.js
//
// Pure-function tests for the live arena engine's core (no React, no jsdom — the
// repo's pure-helper test posture). Covers seeding, the beat transitions, flip,
// ask, and the deterministic key counter.

import { describe, it, expect } from 'vitest';
import {
  seedVoiceLines, makeEngineState, applyBeat, applyFlip, applyAsk, clearBeat, tickClock,
} from './arenaEngineCore';

const VOICE = {
  greet: { kind: 'greeting', text: 'live' },
  live: [
    { kind: 'read', t: '1h', text: 'a' },
    { kind: 'trade', t: '2h', text: 'b' },
  ],
};

describe('seedVoiceLines', () => {
  it('puts the newest live line first and the greeting last, keyed', () => {
    const lines = seedVoiceLines(VOICE);
    expect(lines.map((l) => l.text)).toEqual(['b', 'a', 'live']);
    expect(lines[lines.length - 1]._k).toBe(0);  // greet
    expect(lines.every((l) => Number.isFinite(l._k))).toBe(true);
  });
  it('survives an absent/empty voice script', () => {
    expect(seedVoiceLines(undefined)).toEqual([]);
    expect(seedVoiceLines({})).toEqual([]);
  });
});

describe('applyBeat', () => {
  it('a hit beat with points sets the touched star and a fly-up surge', () => {
    const s0 = makeEngineState(VOICE);
    const s1 = applyBeat(s0, { kind: 'hit', text: 'PLTR hit', pts: 15, star: 'PLTR', tone: 'good' });
    expect(s1.beat.kind).toBe('hit');
    expect(s1.beatStar).toMatchObject({ tk: 'PLTR', kind: 'hit' });
    expect(s1.surge).toMatchObject({ pts: 15 });
    expect(s1._key).toBeGreaterThan(s0._key);
    expect(s0.beatStar).toBeNull(); // input untouched (immutability)
  });
  it('a swap beat bumps the flare and prepends the agent voice line, active', () => {
    const s0 = makeEngineState(VOICE);
    const voice = { kind: 'trade', t: 'now', text: 'in' };
    const s1 = applyBeat(s0, { kind: 'swap', text: 'swap', pts: null, star: 'MSTR', tone: 'neutral', voice });
    expect(s1.flareKey).toBe(s0.flareKey + 1);
    expect(s1.lines[0]).toMatchObject({ text: 'in', active: true });
    expect(s1.lines.slice(1).every((l) => l.active === false)).toBe(true);
  });
  it('a claim beat bumps the claim key and surges its points', () => {
    const s1 = applyBeat(makeEngineState(VOICE), { kind: 'claim', text: 'banked', pts: 2, star: 'GE', tone: 'good' });
    expect(s1.claimKey).toBe(1);
    expect(s1.surge).toMatchObject({ pts: 2 });
  });
  it('a lead beat (no star, no pts) sets only the caption', () => {
    const s1 = applyBeat(makeEngineState(VOICE), { kind: 'lead', text: 'Vela leads', pts: null, star: null, tone: 'neutral' });
    expect(s1.beat.kind).toBe('lead');
    expect(s1.beatStar).toBeNull();
    expect(s1.surge).toBeNull();
  });
  it('a null beat is a no-op', () => {
    const s0 = makeEngineState(VOICE);
    expect(applyBeat(s0, null)).toBe(s0);
  });
});

describe('applyFlip', () => {
  it('flips a pick: a direction token flies up and the star flares', () => {
    const s1 = applyFlip(makeEngineState(VOICE), 'VLO', 'short');
    expect(s1.surge).toMatchObject({ pts: 'SHORT' });
    expect(s1.beatStar).toMatchObject({ tk: 'VLO', kind: 'flip' });
    expect(s1.beat).toMatchObject({ kind: 'flip', star: 'VLO' });
    expect(s1.beat.text).toContain('VLO');
  });
});

describe('applyAsk', () => {
  it('prepends the answer in the agent voice, deactivating older lines', () => {
    const s1 = applyAsk(makeEngineState(VOICE), { q: 'why?', a: 'because' });
    expect(s1.lines[0]).toMatchObject({ kind: 'answer', q: 'why?', text: 'because', active: true });
    expect(s1.lines.slice(1).every((l) => !l.active)).toBe(true);
  });
  it('a missing qa is a no-op', () => {
    const s0 = makeEngineState(VOICE);
    expect(applyAsk(s0, null)).toBe(s0);
  });
});

describe('clearBeat / tickClock', () => {
  it('clearBeat drops the caption (and no-ops when already clear)', () => {
    const s1 = applyBeat(makeEngineState(VOICE), { kind: 'lead', text: 'x', pts: null, star: null });
    expect(clearBeat(s1).beat).toBeNull();
    const s0 = makeEngineState(VOICE);
    expect(clearBeat(s0)).toBe(s0);
  });
  it('tickClock counts down and floors at zero', () => {
    expect(tickClock(10)).toBe(9);
    expect(tickClock(1)).toBe(0);
    expect(tickClock(0)).toBe(0);
  });
});
