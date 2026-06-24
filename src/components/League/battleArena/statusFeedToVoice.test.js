// src/components/League/battleArena/statusFeedToVoice.test.js
import { describe, it, expect } from 'vitest';
import { statusFeedToVoice, relTime } from './statusFeedToVoice';

const NOW = Date.parse('2026-06-16T18:00:00.000Z');

describe('relTime', () => {
  it('labels sub-minute as "now", then m / h / d', () => {
    expect(relTime(NOW - 30 * 1000, NOW)).toBe('now');
    expect(relTime(NOW - 32 * 60 * 1000, NOW)).toBe('32m');
    expect(relTime(NOW - 3 * 3600 * 1000, NOW)).toBe('3h');
    expect(relTime(NOW - 2 * 86400 * 1000, NOW)).toBe('2d');
  });
  it('returns "" when the timestamp or now is unusable', () => {
    expect(relTime(undefined, NOW)).toBe('');
    expect(relTime(NOW, undefined)).toBe('');
  });
});

describe('statusFeedToVoice', () => {
  it('maps statusFeed newest-first into voice lines with kind/ticker/time', () => {
    const battle = {
      statusFeed: [
        { timestamp: NOW - 2 * 3600 * 1000, message: 'Holding the line', action: 'hold' },
        { timestamp: NOW - 60 * 60 * 1000, message: 'Swapped SOFI for MSTR', action: 'swap', symbolIn: 'MSTR' },
      ],
    };
    const v = statusFeedToVoice(battle, NOW, 'Speculator');
    expect(v.arch).toBe('Speculator');
    expect(v.live[0]).toMatchObject({ kind: 'trade', text: 'Swapped SOFI for MSTR', ticker: 'MSTR', t: '1h' });
    expect(v.live[1]).toMatchObject({ kind: 'read', text: 'Holding the line', t: '2h' });
    expect(v.live.every((l) => Number.isFinite(l._k))).toBe(true);
  });
  it('defaults the greet/wait copy and yields an empty live lane for no feed', () => {
    const v = statusFeedToVoice({ statusFeed: [] }, NOW);
    expect(v.live).toEqual([]);
    expect(v.greet.kind).toBe('greeting');
    expect(v.wait.kind).toBe('anticipation');
    expect(v.arch).toBe('Your agent'); // fallback when no archName supplied
  });
  it('drops empty-text entries and survives a null battle', () => {
    expect(statusFeedToVoice(null, NOW).live).toEqual([]);
    const v = statusFeedToVoice({ statusFeed: [{ timestamp: NOW, action: 'hold' }] }, NOW);
    expect(v.live).toEqual([]); // no message/text → dropped
  });
});
