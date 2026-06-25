// src/utils/leagueBeats.test.js
import { describe, it, expect } from 'vitest';
import { deriveBeats } from './leagueBeats';
import { feedEventText } from './tournamentSurfaces';

describe('deriveBeats', () => {
  it('empty inputs → []', () => {
    expect(deriveBeats()).toEqual([]);
    expect(deriveBeats({})).toEqual([]);
  });

  it('lead: emits one beat when the series leader changes (tie-break via rankByScores)', () => {
    // b leads days 0-1, a overtakes on day 2 → exactly one lead change.
    const series = { a: [1, 2, 5], b: [3, 4, 3] };
    const beats = deriveBeats({ series, uid: 'a', seatNames: { a: 'Atlas' } });
    const lead = beats.filter((x) => x.kind === 'lead');
    expect(lead).toHaveLength(1);
    expect(lead[0].text).toBe('Atlas took the lead');
    expect(lead[0].tone).toBe('good'); // a === uid
    expect(lead[0].star).toBeNull();
  });

  it('flip: text is feedEventText verbatim (single home, not re-authored)', () => {
    const ev = { type: 'flip', symbol: 'NVDA', from: 'long', to: 'short', odUserId: 'u1', bankedLegScore: 12, timestamp: '2026-06-10T15:00:00Z' };
    const [beat] = deriveBeats({ feed: [ev], uid: 'u1' });
    expect(beat.kind).toBe('flip');
    expect(beat.text).toBe(feedEventText(ev, 'u1')); // 'You flipped NVDA long→short'
    expect(beat.pts).toBe(12);
    expect(beat.star).toBe('NVDA');
    expect(beat.tone).toBe('good');
  });

  it('swap: an agent trade close carries lockedPoints + the swapped pair', () => {
    const trades = [{ symbolOut: 'SOFI', symbolIn: 'MSTR', lockedPoints: -8, swapDay: 2, swappedOutAt: '2026-06-10T14:00:00Z' }];
    const [beat] = deriveBeats({ trades });
    expect(beat.kind).toBe('swap');
    expect(beat.text).toBe('swapped SOFI → MSTR');
    expect(beat.pts).toBe(-8);
    expect(beat.tone).toBe('bad');
    expect(beat.star).toBe('MSTR');
  });

  it('hit: a star transitioning quiet→hit emits a good beat (no transition = no beat)', () => {
    const prevStarStates = { u1: [{ tk: 'AAPL', state: 'quiet' }] };
    const starStates = { u1: [{ tk: 'AAPL', state: 'hit', badge: 'BaggerBomb', points: 15 }] };
    const beats = deriveBeats({ starStates, prevStarStates });
    const hit = beats.filter((b) => b.kind === 'hit');
    expect(hit).toHaveLength(1);
    expect(hit[0].text).toBe('AAPL hit BaggerBomb');
    expect(hit[0].pts).toBe(15);
    expect(hit[0].tone).toBe('good');
    // unchanged state → no beat
    expect(deriveBeats({ starStates, prevStarStates: starStates })).toEqual([]);
  });

  it('busted maps to the loudest down-beat kind (danger, bad)', () => {
    const beats = deriveBeats({
      starStates: { u1: [{ tk: 'COIN', state: 'busted', badge: 'Meltdown', points: -35 }] },
      prevStarStates: { u1: [{ tk: 'COIN', state: 'heating' }] },
    });
    expect(beats[0].kind).toBe('danger');
    expect(beats[0].tone).toBe('bad');
    expect(beats[0].text).toBe('COIN hit Meltdown');
  });

  it('claim: a resolved claim reads won/lost', () => {
    const beats = deriveBeats({
      claims: [{ odUserId: 'u1', addSymbol: 'GE', status: 'approved', processedAt: '2026-06-10T09:25:00Z' }],
      uid: 'u1',
    });
    expect(beats[0].kind).toBe('claim');
    expect(beats[0].text).toBe('You won the GE claim');
    expect(beats[0].star).toBe('GE');
    expect(beats[0].tone).toBe('good');
  });

  it('claim: a denied claim reads "lost" with a neutral tone', () => {
    const [beat] = deriveBeats({
      claims: [{ odUserId: 'u2', addSymbol: 'XOM', status: 'denied', processedAt: '2026-06-10T09:25:00Z' }],
    });
    expect(beat.kind).toBe('claim');
    expect(beat.text).toBe('u2 lost the XOM claim');
    expect(beat.tone).toBe('neutral');
  });

  it('claim: a still-PENDING claim is dropped, never rendered as "lost"', () => {
    expect(deriveBeats({ claims: [{ odUserId: 'u1', addSymbol: 'GE', status: 'pending' }] })).toEqual([]);
  });

  it('orders by a Firestore Timestamp (toMillis) the same as ISO strings', () => {
    const ts = (ms) => ({ toMillis: () => ms }); // a Firestore Timestamp shape
    const trades = [
      { symbolIn: 'OLD', symbolOut: 'X', lockedPoints: 1, swappedOutAt: ts(1000) },
      { symbolIn: 'NEW', symbolOut: 'Y', lockedPoints: 1, swappedOutAt: ts(5000) },
    ];
    const beats = deriveBeats({ trades });
    expect(beats.map((b) => b.star)).toEqual(['NEW', 'OLD']); // newer (5000) first, despite non-string ts
  });

  it('single-seat series emits no phantom lead beat', () => {
    expect(deriveBeats({ series: { solo: [1, 2, 3] } })).toEqual([]);
  });

  it('orders most-recent-first by timestamp', () => {
    const feed = [
      { type: 'flip', symbol: 'A', from: 'long', to: 'short', odUserId: 'u1', timestamp: '2026-06-10T10:00:00Z' },
      { type: 'flip', symbol: 'B', from: 'long', to: 'short', odUserId: 'u1', timestamp: '2026-06-10T12:00:00Z' },
    ];
    const beats = deriveBeats({ feed, uid: 'u1' });
    expect(beats.map((b) => b.star)).toEqual(['B', 'A']); // newer first
  });
});
