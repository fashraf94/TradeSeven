// src/components/League/battleArena/arenaEngineCore.test.js
//
// Pure-function tests for the live arena engine's core (no React, no jsdom — the
// repo's pure-helper test posture). Covers seeding, the beat transitions, flip,
// ask, and the deterministic key counter.

import { describe, it, expect } from 'vitest';
import {
  seedVoiceLines, makeEngineState, applyBeat, applyFlip, applyAsk, clearBeat, tickClock,
  applyAsking, applyAnswer, setRemaining, applyFiling, applyFiled, applyFilingFailed,
} from './arenaEngineCore';
import { filedLabel, FILING_CONFLICT_LINE } from '../../../data/decisionRecord';
import { etTime } from '../../Dashboard/desk/deskCopy';

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

describe('two-way ask reducers (applyAsking / applyAnswer / setRemaining)', () => {
  it('initial state carries the counter (null) and the in-flight flag (false)', () => {
    const s = makeEngineState(VOICE);
    expect(s.remaining).toBeNull();
    expect(s.asking).toBe(false);
  });

  it('applyAsking marks a request in flight (idempotent)', () => {
    const s1 = applyAsking(makeEngineState(VOICE));
    expect(s1.asking).toBe(true);
    expect(applyAsking(s1)).toBe(s1); // already asking → same reference
  });

  it('applyAnswer prepends the real answer, clears asking, deactivates older lines', () => {
    const asking = applyAsking(makeEngineState(VOICE));
    const s = applyAnswer(asking, { q: 'the plan?', text: "We're leaning into semis." });
    expect(s.asking).toBe(false);
    expect(s.lines[0]).toMatchObject({ kind: 'answer', q: 'the plan?', text: "We're leaning into semis.", active: true, error: false });
    expect(s.lines.slice(1).every((l) => !l.active)).toBe(true);
  });

  it('applyAnswer with error:true flags a failure line (for the retry affordance)', () => {
    const s = applyAnswer(makeEngineState(VOICE), { q: 'plan?', text: 'try again', error: true });
    expect(s.lines[0]).toMatchObject({ kind: 'answer', error: true });
  });

  it('setRemaining sets a finite count and ignores non-finite (keeps last known)', () => {
    const s0 = makeEngineState(VOICE);
    expect(setRemaining(s0, 7).remaining).toBe(7);
    expect(setRemaining(s0, 0).remaining).toBe(0);
    const s7 = setRemaining(s0, 7);
    expect(setRemaining(s7, undefined)).toBe(s7); // no server value → unchanged reference
    expect(setRemaining(s7, NaN)).toBe(s7);
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

// ==================== Voice-layer grounding §6.2 / §6.3 — chips and the filing ====================

describe('chip reducers (applyAnswer chips + belief · applyFiling / applyFiled / applyFilingFailed)', () => {
  const CHIPS = [{ kind: 'directive', id: 'DV-02', text: 'Widen the spread (target more sectors)' }, { kind: 'ask', text: 'Why?' }];

  it('initial state: no chips, no filing, no failure line, no belief', () => {
    const s = makeEngineState(VOICE);
    expect(s.chips).toEqual([]);
    expect(s.filing).toBe(false);
    expect(s.filingError).toBeNull();
    expect(s.currentDirectiveThreadId).toBeNull();
  });

  it('a shipped answer (no chips, no belief) leaves the line shape and the belief untouched', () => {
    const s = applyAnswer(applyAsking(makeEngineState(VOICE)), { q: 'plan?', text: 'semis' });
    expect(Object.keys(s.lines[0]).sort()).toEqual(['_k', 'active', 'error', 'kind', 'q', 't', 'text']);
    expect(s.chips).toEqual([]);
    expect(s.currentDirectiveThreadId).toBeNull();
  });

  it('a grounded answer carries the minted chips, the status line and the server\'s belief', () => {
    const s = applyAnswer(makeEngineState(VOICE), { q: 'plan?', text: 'two ways', chips: CHIPS, statusLine: 'No change made to your strategy this turn.', currentDirectiveThreadId: 'thread-A' });
    expect(s.chips).toBe(CHIPS);
    expect(s.lines[0].statusLine).toBe('No change made to your strategy this turn.');
    expect(s.currentDirectiveThreadId).toBe('thread-A');
    // The next real answer REPLACES the chips (none minted → none shown) and can
    // move the belief to null (this turn filed nothing and the slot is empty).
    const s2 = applyAnswer(s, { q: 'and?', text: 'holding', currentDirectiveThreadId: null });
    expect(s2.chips).toEqual([]);
    expect(s2.currentDirectiveThreadId).toBeNull();
    expect('statusLine' in s2.lines[0]).toBe(false);
  });

  it('a FAILED answer keeps the last chips and the belief (a retry is one tap away)', () => {
    const s = applyAnswer(makeEngineState(VOICE), { q: 'plan?', text: 'two ways', chips: CHIPS, currentDirectiveThreadId: 'thread-A' });
    const failed = applyAnswer(s, { q: 'again?', text: 'try again', error: true });
    expect(failed.chips).toBe(CHIPS);
    expect(failed.currentDirectiveThreadId).toBe('thread-A');
  });

  it('applyFiling marks the filing in flight (idempotent) and clears the last failure line', () => {
    const s0 = { ...makeEngineState(VOICE), filingError: 'stale' };
    const s1 = applyFiling(s0);
    expect(s1.filing).toBe(true);
    expect(s1.filingError).toBeNull();
    expect(applyFiling(s1)).toBe(s1);
  });

  it('applyFiled prepends the RECEIPT — the route\'s text, the Battle View\'s `Filed {time}` — retires the chips, adopts the thread', () => {
    const s0 = applyAnswer(makeEngineState(VOICE), { q: 'plan?', text: 'two ways', chips: CHIPS, currentDirectiveThreadId: null });
    const s = applyFiled(applyFiling(s0), { text: 'Widen the spread (target more sectors)', createdAt: '2026-09-08T15:20:00.000Z', directiveThreadId: 'thread-B' });
    expect(s.filing).toBe(false);
    expect(s.chips).toEqual([]);
    expect(s.currentDirectiveThreadId).toBe('thread-B');
    expect(s.lines[0]).toMatchObject({ kind: 'directive', text: 'Widen the spread (target more sectors)', active: false });
    expect(s.lines[0].t).toBe(filedLabel(etTime('2026-09-08T15:20:00.000Z')));
    expect(s.lines[0].t).toBe('Filed 11:20 AM');
    expect(s.lines.slice(1).every((l) => !l.active)).toBe(true);
    expect(s._key).toBe(s0._key + 1);
  });

  it('applyFilingFailed holds the ruled line (never in the lane), keeps the chips; a 409 moves the belief to the server\'s', () => {
    const s0 = applyAnswer(makeEngineState(VOICE), { q: 'plan?', text: 'two ways', chips: CHIPS, currentDirectiveThreadId: 'thread-A' });
    const lanes = s0.lines.length;
    const f = applyFilingFailed(applyFiling(s0), { line: FILING_CONFLICT_LINE, currentDirectiveThreadId: 'thread-C' });
    expect(f.filing).toBe(false);
    expect(f.filingError).toBe(FILING_CONFLICT_LINE);
    expect(f.lines).toHaveLength(lanes);
    expect(f.chips).toBe(CHIPS);
    expect(f.currentDirectiveThreadId).toBe('thread-C');
    // No word from the server → the belief stays.
    const g = applyFilingFailed(applyFiling(s0), { line: 'x' });
    expect(g.currentDirectiveThreadId).toBe('thread-A');
    // A new ask clears the failure line.
    expect(applyAsking(f).filingError).toBeNull();
  });
});
