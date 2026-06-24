// src/components/League/battleArena/arenaBeatDiff.test.js
import { describe, it, expect } from 'vitest';
import { beatKey, nextUnseenBeat } from './arenaBeatDiff';

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

describe('nextUnseenBeat', () => {
  const beats = [
    { kind: 'hit', star: 'PLTR', text: 'PLTR hit' },
    { kind: 'swap', star: 'MSTR', text: 'swap' },
  ];
  it('returns the freshest beat when its key differs from the last seen', () => {
    const r = nextUnseenBeat(beats, null);
    expect(r.beat).toBe(beats[0]);
    expect(r.key).toBe('hit:PLTR:PLTR hit');
  });
  it('returns null when the freshest beat is the one already shown (no loop/replay)', () => {
    expect(nextUnseenBeat(beats, 'hit:PLTR:PLTR hit')).toBeNull();
  });
  it('returns null for an empty / non-array beat list', () => {
    expect(nextUnseenBeat([], null)).toBeNull();
    expect(nextUnseenBeat(null, null)).toBeNull();
  });
});
