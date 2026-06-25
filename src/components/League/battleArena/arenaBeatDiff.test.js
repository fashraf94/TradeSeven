// src/components/League/battleArena/arenaBeatDiff.test.js
import { describe, it, expect } from 'vitest';
import { beatKey, firstUnseenBeat } from './arenaBeatDiff';

describe('beatKey', () => {
  it('is deterministic from kind + star + text', () => {
    const b = { kind: 'hit', star: 'PLTR', text: 'PLTR hit BaggerBomb' };
    expect(beatKey(b)).toBe('hit:PLTR:PLTR hit BaggerBomb');
    expect(beatKey(b)).toBe(beatKey({ ...b })); // stable across identical events
  });
  it('tolerates a null star / missing text / null beat', () => {
    expect(beatKey({ kind: 'lead', star: null, text: 'Vela leads' })).toBe('lead::Vela leads');
    expect(beatKey({ kind: 'hit' })).toBe('hit::');
    expect(beatKey(null)).toBe('');
  });
});

describe('firstUnseenBeat', () => {
  const beats = [
    { kind: 'hit', star: 'PLTR', text: 'PLTR hit' },
    { kind: 'swap', star: 'MSTR', text: 'swap' },
  ];
  it('returns the freshest beat not in the seen set', () => {
    const r = firstUnseenBeat(beats, new Set());
    expect(r.beat).toBe(beats[0]);
    expect(r.key).toBe('hit:PLTR:PLTR hit');
  });
  it('returns null when every beat has been seen', () => {
    const seen = new Set(beats.map(beatKey));
    expect(firstUnseenBeat(beats, seen)).toBeNull();
  });
  it('does NOT get masked by a sticky top-of-list beat — surfaces the newer beat behind it', () => {
    // deriveBeats floats a lead change to index 0 with a sentinel timestamp; it
    // stays there while a NEW hit beat lands at index 1. A last-key-only check
    // would mask the hit; firstUnseenBeat must surface it.
    const lead = { kind: 'lead', star: null, text: 'Vela took the lead' };
    const hit = { kind: 'hit', star: 'AAPL', text: 'AAPL hit BaggerBomb' };
    const seen = new Set([beatKey(lead)]); // lead already fired
    const r = firstUnseenBeat([lead, hit], seen);
    expect(r.beat).toBe(hit); // the newer hit fires, not masked by the sticky lead
  });
  it('returns null for an empty / non-array list or a missing set', () => {
    expect(firstUnseenBeat([], new Set())).toBeNull();
    expect(firstUnseenBeat(null, new Set())).toBeNull();
    expect(firstUnseenBeat([{ kind: 'hit', star: 'X', text: 'x' }], null)).toBeNull();
  });
});
