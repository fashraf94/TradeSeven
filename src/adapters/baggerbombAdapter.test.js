// src/adapters/baggerbombAdapter.test.js
//
// Phase A acceptance (Pass 1 spec §6): the phase-derivation matrix across
// weekday-open / after-hours / weekend / holiday / early-close / completed /
// pre-open-with-no-evals, plus the field decisions ruled in
// PASS1_PHASE0_STOP_RULINGS_AND_GO.md §7.
//
// Every case is driven by an INJECTED `now` and an INJECTED `marketState`.
// src/utils/marketSchedule.js's getMarketState() is zero-arity and reads the
// wall clock through a non-exported getETDate(), so passing its RESULT in is
// what makes weekend/holiday/early-close reachable without mocking the module
// (there is no vi.mock-of-marketSchedule precedent anywhere in src/).

import { describe, it, expect } from 'vitest';
import {
  buildBaggerbombAdapter,
  derivePhase,
  toIso,
  PHASE,
  PROXIMITY_STALE_MS,
} from './baggerbombAdapter';

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Market-state fixtures. Shape mirrors getMarketState()'s real return
// (src/utils/marketSchedule.js:162-168): { isOpen, state, nextOpenTime,
// nextCloseTime, isEarlyClose }.
//
// CRITICAL: nextOpenTime / nextCloseTime are ET WALL-CLOCK Dates, not instants.
// getMarketState() builds them from getETDate(), which re-parses an ET string
// in the browser's zone — so their LOCAL FIELDS are the ET wall clock and their
// epoch is meaningless. These fixtures are therefore constructed with the
// LOCAL-field constructor (new Date(y, m, d, h, min)), matching what the real
// producer emits. An earlier version used new Date('...Z'), a shape the
// producer never returns, which is why the timezone defect passed its tests.
const MS = {
  open: {
    isOpen: true, state: 'OPEN',
    nextOpenTime: new Date(2026, 8, 2, 9, 30),   // Wed 9:30 ET (wall clock)
    nextCloseTime: new Date(2026, 8, 1, 16, 0),  // Tue 16:00 ET
    isEarlyClose: false,
  },
  preMarket: {
    isOpen: false, state: 'PRE_MARKET',
    nextOpenTime: new Date(2026, 8, 1, 9, 30),   // Tue 9:30 ET
    nextCloseTime: new Date(2026, 8, 1, 16, 0),
    isEarlyClose: false,
  },
  afterHours: {
    isOpen: false, state: 'CLOSED_AFTERHOURS',
    nextOpenTime: new Date(2026, 8, 2, 9, 30),
    nextCloseTime: new Date(2026, 8, 2, 16, 0),
    isEarlyClose: false,
  },
  weekend: {
    isOpen: false, state: 'CLOSED_WEEKEND',
    nextOpenTime: new Date(2026, 8, 7, 9, 30),   // Mon 9:30 ET
    nextCloseTime: new Date(2026, 8, 7, 16, 0),
    isEarlyClose: false,
  },
  holiday: {
    isOpen: false, state: 'CLOSED_HOLIDAY',
    nextOpenTime: new Date(2026, 8, 8, 9, 30),   // Tue 9:30 ET
    nextCloseTime: new Date(2026, 8, 8, 16, 0),
    isEarlyClose: false,
  },
  // 2026-11-27, day after Thanksgiving — 1:00 PM ET close.
  earlyCloseOpen: {
    isOpen: true, state: 'OPEN',
    nextOpenTime: new Date(2026, 10, 30, 9, 30),
    nextCloseTime: new Date(2026, 10, 27, 13, 0), // 13:00 ET
    isEarlyClose: true,
  },
};

const NOW = '2026-09-01T17:00:00Z'; // Tue, 13:00 ET — mid-session

function makeBattle(over = {}) {
  return {
    id: 'battle-1',
    status: 'active',
    activatedAt: '2026-09-01T13:30:00.000Z',
    scoreState: {
      currentScore: 42,
      tradeCount: 3,
      evaluationCount: 7,
      lastScoredAt: '2026-09-01T16:47:00.000Z',
    },
    portfolio: {
      star: [{ symbol: 'PLTR' }],
      core: [{ symbol: 'NVDA', swapPrice: 120.5, swappedInAt: '2026-09-01T15:00:00.000Z' }],
      support: [{ symbol: 'SOFI' }],
      startingPrices: { PLTR: 30, NVDA: 118, SOFI: 9 },
    },
    statusFeed: [
      { timestamp: '2026-09-01T16:00:00.000Z', message: 'earlier', action: 'hold' },
      { timestamp: '2026-09-01T16:47:00.000Z', message: 'Holding PLTR into the close.', action: 'hold' },
    ],
    ...over,
  };
}

// portfolioBriefs mirror api/cron/voice-layer-cache.js:262-272.
function makeCache(over = {}) {
  return {
    battleId: 'battle-1',
    updatedAt: '2026-09-01T16:50:00.000Z',
    portfolioBriefs: [
      {
        symbol: 'PLTR',
        thresholdProximity: {
          currentMultiplier: 1.6,
          baseATR: 2.1,
          redZone: {
            targetThreshold: 'bagger',
            targetMultiple: 2.0,
            direction: 'positive',
            zoneProgressPercent: 80,
          },
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
      },
      {
        symbol: 'NVDA',
        thresholdProximity: {
          currentMultiplier: -0.9,
          baseATR: 1.5,
          redZone: {
            targetThreshold: 'bust',
            targetMultiple: -1.0,
            direction: 'negative',
            zoneProgressPercent: 90,
          },
          swapLock: { locked: true, direction: 'negative', distancePercent: 1.2, message: 'locked' },
        },
      },
      {
        symbol: 'SOFI',
        thresholdProximity: {
          currentMultiplier: 0.2,
          baseATR: 0.8,
          redZone: {
            targetThreshold: 'bagger',
            targetMultiple: 2.0,
            direction: 'positive',
            zoneProgressPercent: 10,
          },
          swapLock: { locked: false, direction: null, distancePercent: null, message: null },
        },
      },
    ],
    ...over,
  };
}

const AGENT = { archetype: 'momentum_chaser', activeBattleId: 'battle-1' };

const build = (battle, cache, agent, now, ms) =>
  buildBaggerbombAdapter(battle, cache, agent, now, ms);

// ─── Phase derivation matrix (spec §6 acceptance) ─────────────────────────────

describe('derivePhase — the four states', () => {
  it('weekday, market OPEN, evals have run → LIVE', () => {
    expect(derivePhase(makeBattle(), MS.open)).toBe(PHASE.LIVE);
  });

  it('after-hours with at least one eval → LIVE_CLOSED', () => {
    expect(derivePhase(makeBattle(), MS.afterHours)).toBe(PHASE.LIVE_CLOSED);
  });

  it('weekend with evals behind it → LIVE_CLOSED', () => {
    expect(derivePhase(makeBattle(), MS.weekend)).toBe(PHASE.LIVE_CLOSED);
  });

  it('holiday with evals behind it → LIVE_CLOSED', () => {
    expect(derivePhase(makeBattle(), MS.holiday)).toBe(PHASE.LIVE_CLOSED);
  });

  it('early-close day while still open → LIVE (the close time differs, the phase does not)', () => {
    expect(derivePhase(makeBattle(), MS.earlyCloseOpen)).toBe(PHASE.LIVE);
  });

  it('completed battle → POST_CLOSE, whatever the market is doing', () => {
    for (const ms of Object.values(MS)) {
      expect(derivePhase(makeBattle({ status: 'completed' }), ms)).toBe(PHASE.POST_CLOSE);
    }
  });

  it('active battle created pre-market, no eval yet → PRE_OPEN', () => {
    const fresh = makeBattle({
      scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 0, lastScoredAt: null },
      statusFeed: [],
    });
    expect(derivePhase(fresh, MS.preMarket)).toBe(PHASE.PRE_OPEN);
  });

  it('PRE_OPEN keys on evaluationCount, NOT on statusFeed', () => {
    // The marker the spec originally named does not exist: no eval-sourced
    // statusFeed entry is ever written, and a quiet HOLD tick appends nothing.
    // A battle with a NON-empty feed but zero evals is still PRE_OPEN, and a
    // battle with an EMPTY feed but evals behind it is not.
    const feedButNoEvals = makeBattle({
      scoreState: { evaluationCount: 0, lastScoredAt: null },
      statusFeed: [{ timestamp: NOW, message: 'watchlist refresh', action: 'watchlist_refresh' }],
    });
    expect(derivePhase(feedButNoEvals, MS.preMarket)).toBe(PHASE.PRE_OPEN);

    const evalsButNoFeed = makeBattle({
      scoreState: { evaluationCount: 4, lastScoredAt: '2026-09-01T16:00:00.000Z' },
      statusFeed: [],
    });
    expect(derivePhase(evalsButNoFeed, MS.afterHours)).toBe(PHASE.LIVE_CLOSED);
  });

  it('lastScoredAt alone is enough to leave PRE_OPEN', () => {
    const b = makeBattle({ scoreState: { evaluationCount: 0, lastScoredAt: '2026-09-01T16:00:00.000Z' } });
    expect(derivePhase(b, MS.afterHours)).toBe(PHASE.LIVE_CLOSED);
  });
});

// ─── Timestamp normalization ─────────────────────────────────────────────────

describe('toIso — the Firestore/ISO union', () => {
  it('passes an ISO string through', () => {
    expect(toIso('2026-09-01T16:00:00.000Z')).toBe('2026-09-01T16:00:00.000Z');
  });
  it('converts a Firestore Timestamp with toMillis()', () => {
    expect(toIso({ toMillis: () => 1756742400000 })).toBe(new Date(1756742400000).toISOString());
  });
  it('converts a raw {seconds} Timestamp', () => {
    expect(toIso({ seconds: 1756742400, nanoseconds: 0 })).toBe(new Date(1756742400000).toISOString());
  });
  it('converts a Date and an epoch', () => {
    expect(toIso(new Date('2026-09-01T16:00:00Z'))).toBe('2026-09-01T16:00:00.000Z');
    expect(toIso(1756742400000)).toBe(new Date(1756742400000).toISOString());
  });
  it('returns null for null / undefined / unparseable', () => {
    expect(toIso(null)).toBeNull();
    expect(toIso(undefined)).toBeNull();
    expect(toIso('not a date')).toBeNull();
    expect(toIso({})).toBeNull();
  });
});

// ─── The adapter object ──────────────────────────────────────────────────────

describe('buildBaggerbombAdapter', () => {
  it('returns null without a battle', () => {
    expect(build(null, makeCache(), AGENT, NOW, MS.open)).toBeNull();
  });

  it('carries game identity and the score from the same fields ManageStation uses', () => {
    const a = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
    expect(a.game).toEqual({ id: 'battle-1', type: 'baggerbomb', label: 'BaggerBomb' });
    expect(a.score).toEqual({ current: 42, tradeCount: 3 });
  });

  it('falls back to trades.length for tradeCount, as ManageStation does', () => {
    const b = makeBattle({
      scoreState: { currentScore: 1, evaluationCount: 1, lastScoredAt: NOW },
      trades: [{}, {}],
    });
    expect(build(b, makeCache(), AGENT, NOW, MS.open).score.tradeCount).toBe(2);
  });

  describe('book', () => {
    it('flattens the three tiers and tags each with its tier', () => {
      const { book } = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(book.map(p => [p.symbol, p.tier])).toEqual([
        ['PLTR', 'star'], ['NVDA', 'core'], ['SOFI', 'support'],
      ]);
    });

    it('prefers swapPrice over startingPrices for entry', () => {
      const { book } = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(book.find(p => p.symbol === 'NVDA').entry).toBe(120.5); // swapPrice
      expect(book.find(p => p.symbol === 'PLTR').entry).toBe(30);    // startingPrices
    });

    it('heldSince is swappedInAt when present, else the battle activation', () => {
      const { book } = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(book.find(p => p.symbol === 'NVDA').heldSince).toBe('2026-09-01T15:00:00.000Z');
      expect(book.find(p => p.symbol === 'PLTR').heldSince).toBe('2026-09-01T13:30:00.000Z');
    });

    it('omits pnlPct entirely — no live price reaches a pure adapter', () => {
      const { book } = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      for (const pos of book) expect(pos).not.toHaveProperty('pnlPct');
    });

    it('survives a missing portfolio and skips malformed positions', () => {
      expect(build(makeBattle({ portfolio: undefined }), makeCache(), AGENT, NOW, MS.open).book).toEqual([]);
      const messy = makeBattle({
        portfolio: { star: [null, { tier: 'star' }, { symbol: 'OK' }], startingPrices: {} },
      });
      expect(build(messy, makeCache(), AGENT, NOW, MS.open).book.map(p => p.symbol)).toEqual(['OK']);
    });
  });

  describe('scoreProximity', () => {
    it('ranks by distance to the target multiple and caps at three', () => {
      const { scoreProximity } = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      // NVDA |−1.0 − −0.9| = 0.1 ; PLTR |2.0 − 1.6| = 0.4 ; SOFI |2.0 − 0.2| = 1.8
      expect(scoreProximity.map(r => r.symbol)).toEqual(['NVDA', 'PLTR', 'SOFI']);
    });

    it('caps at three rows even with more candidates', () => {
      const cache = makeCache();
      cache.portfolioBriefs.push({
        symbol: 'AMD',
        thresholdProximity: {
          currentMultiplier: 1.95, baseATR: 1,
          redZone: { targetThreshold: 'bagger', targetMultiple: 2.0, direction: 'positive', zoneProgressPercent: 97 },
          swapLock: { locked: false },
        },
      });
      const { scoreProximity } = build(makeBattle(), cache, AGENT, NOW, MS.open);
      expect(scoreProximity).toHaveLength(3);
      expect(scoreProximity[0].symbol).toBe('AMD'); // distance 0.05
    });

    it('takes the direction WORD from the data, never from sign math', () => {
      const { scoreProximity } = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(scoreProximity.find(r => r.symbol === 'NVDA').direction).toBe('negative');
      expect(scoreProximity.find(r => r.symbol === 'PLTR').direction).toBe('positive');
    });

    it('omits a position whose thresholdProximity is absent (baseATR <= 0)', () => {
      const cache = makeCache({ portfolioBriefs: [{ symbol: 'PLTR' }, makeCache().portfolioBriefs[1]] });
      const { scoreProximity } = build(makeBattle(), cache, AGENT, NOW, MS.open);
      expect(scoreProximity.map(r => r.symbol)).toEqual(['NVDA']);
    });

    it('omits a position whose redZone is null — never a placeholder row', () => {
      const cache = makeCache();
      cache.portfolioBriefs[0].thresholdProximity.redZone = null;
      const { scoreProximity } = build(makeBattle(), cache, AGENT, NOW, MS.open);
      expect(scoreProximity.map(r => r.symbol)).toEqual(['NVDA', 'SOFI']);
    });

    it('is empty, not undefined, when the cache doc is missing entirely', () => {
      const a = build(makeBattle(), null, AGENT, NOW, MS.open);
      expect(a.scoreProximity).toEqual([]);
      expect(a.swapLock).toEqual([]);
      expect(a.proximityAsOf).toBeNull();
    });
  });

  describe('swapLock', () => {
    it('returns only locked positions, with the full object', () => {
      const { swapLock } = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(swapLock).toEqual([
        { symbol: 'NVDA', locked: true, direction: 'negative', distancePercent: 1.2, message: 'locked' },
      ]);
    });

    it('treats swapLock as an object, not a boolean flag', () => {
      // A brief whose swapLock is the literal `true` is NOT the shape
      // isSwapLocked() returns, and must not be read as locked.
      const cache = makeCache();
      cache.portfolioBriefs[0].thresholdProximity.swapLock = true;
      const { swapLock } = build(makeBattle(), cache, AGENT, NOW, MS.open);
      expect(swapLock.map(r => r.symbol)).toEqual(['NVDA']);
    });
  });

  describe('staleness gates LIVE only (rulings §6)', () => {
    const staleCache = () => makeCache({ updatedAt: '2026-09-01T16:00:00.000Z' }); // 60 min before NOW

    it('LIVE + stale cache → proximity suppressed, flagged stale', () => {
      const a = build(makeBattle(), staleCache(), AGENT, NOW, MS.open);
      expect(a.proximityStale).toBe(true);
      expect(a.scoreProximity).toEqual([]);
      expect(a.swapLock).toEqual([]);
      // still reports WHEN it was current, so the caller can say why
      expect(a.proximityAsOf).toBe('2026-09-01T16:00:00.000Z');
    });

    it('LIVE + fresh cache → proximity renders', () => {
      const a = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(a.proximityStale).toBe(false);
      expect(a.scoreProximity.length).toBeGreaterThan(0);
    });

    it('LIVE_CLOSED + very stale cache → still renders, with an as-of stamp', () => {
      // A Friday-evening-to-Monday gap is stale by construction: the cache
      // cron does not run on weekends. Blanking here would empty the dormant
      // Desk every evening and every weekend.
      const weekendStale = makeCache({ updatedAt: '2026-08-28T20:00:00.000Z' });
      const a = build(makeBattle(), weekendStale, AGENT, '2026-08-30T18:00:00Z', MS.weekend);
      expect(a.phase).toBe(PHASE.LIVE_CLOSED);
      expect(a.proximityStale).toBe(false);
      expect(a.scoreProximity.length).toBeGreaterThan(0);
      expect(a.proximityAsOf).toBe('2026-08-28T20:00:00.000Z');
    });

    it('POST_CLOSE + stale cache → still renders', () => {
      const a = build(makeBattle({ status: 'completed' }), staleCache(), AGENT, NOW, MS.afterHours);
      expect(a.phase).toBe(PHASE.POST_CLOSE);
      expect(a.proximityStale).toBe(false);
      expect(a.scoreProximity.length).toBeGreaterThan(0);
    });

    it('PRE_OPEN + stale cache → still renders (yesterday\'s close, stamped)', () => {
      const fresh = makeBattle({ scoreState: { evaluationCount: 0, lastScoredAt: null }, statusFeed: [] });
      const a = build(fresh, staleCache(), AGENT, NOW, MS.preMarket);
      expect(a.phase).toBe(PHASE.PRE_OPEN);
      expect(a.proximityStale).toBe(false);
    });

    it('the LIVE boundary is exactly 30 minutes', () => {
      const base = new Date('2026-09-01T17:00:00Z').getTime();
      const justInside = makeCache({ updatedAt: new Date(base - PROXIMITY_STALE_MS + 1000).toISOString() });
      const justOutside = makeCache({ updatedAt: new Date(base - PROXIMITY_STALE_MS - 1000).toISOString() });
      expect(build(makeBattle(), justInside, AGENT, NOW, MS.open).proximityStale).toBe(false);
      expect(build(makeBattle(), justOutside, AGENT, NOW, MS.open).proximityStale).toBe(true);
    });

    it('LIVE with a cache doc carrying no updatedAt is treated as stale', () => {
      const noStamp = makeCache({ updatedAt: null });
      expect(build(makeBattle(), noStamp, AGENT, NOW, MS.open).proximityStale).toBe(true);
    });

    it('normalizes a Firestore Timestamp updatedAt', () => {
      const ts = { toMillis: () => new Date('2026-09-01T16:50:00.000Z').getTime() };
      const a = build(makeBattle(), makeCache({ updatedAt: ts }), AGENT, NOW, MS.open);
      expect(a.proximityAsOf).toBe('2026-09-01T16:50:00.000Z');
      expect(a.proximityStale).toBe(false);
    });
  });

  describe('the clock', () => {
    it('lastCheckedAt comes from scoreState.lastScoredAt, not the statusFeed', () => {
      const b = makeBattle({
        scoreState: { evaluationCount: 2, lastScoredAt: '2026-09-01T16:47:00.000Z' },
        statusFeed: [{ timestamp: '2026-09-01T14:00:00.000Z', message: 'stale beat', action: 'hold' }],
      });
      expect(build(b, makeCache(), AGENT, NOW, MS.open).lastCheckedAt).toBe('2026-09-01T16:47:00.000Z');
    });

    it('LIVE: next decision is last check + 15 minutes', () => {
      const a = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(a.nextDecisionAt).toBe('2026-09-01T17:02:00.000Z');
    });

    it('LIVE: a next check that would land past the close is withheld, not faked', () => {
      // 15:50 ET + 15min = 16:05 ET, past the 16:00 close. There is no honest
      // "next check" inside this session, so the field is null and the posture
      // line degrades to "Checked 3:50 PM" with no invented follow-up.
      const late = makeBattle({
        scoreState: { evaluationCount: 9, lastScoredAt: '2026-09-01T19:50:00.000Z' },
      });
      const a = build(late, makeCache(), AGENT, '2026-09-01T19:55:00Z', MS.open);
      expect(a.nextDecisionAt).toBeNull();
    });

    it('LIVE: a next check already in the PAST is withheld — a starved cron never fabricates', () => {
      const starved = makeBattle({
        scoreState: { evaluationCount: 9, lastScoredAt: '2026-09-01T14:00:00.000Z' },
      });
      // now is two hours after the check + 15min would have landed
      const a = build(starved, makeCache(), AGENT, '2026-09-01T16:30:00Z', MS.open);
      expect(a.nextDecisionAt).toBeNull();
    });

    it('LIVE with no eval yet → null, never a fabricated time', () => {
      const fresh = makeBattle({ scoreState: { evaluationCount: 0, lastScoredAt: null } });
      expect(build(fresh, makeCache(), AGENT, NOW, MS.open).nextDecisionAt).toBeNull();
    });

    it('LIVE_CLOSED / PRE_OPEN: the next open is carried as ET WALL-CLOCK FIELDS, not an instant', () => {
      // This is the timezone fix. The next open is a wall clock; putting its
      // epoch in an ISO field and formatting it back through Intl rendered a
      // wrong time — and, far enough east, a wrong day — for every viewer
      // outside ET.
      const closed = build(makeBattle(), makeCache(), AGENT, NOW, MS.weekend);
      expect(closed.nextDecisionAt).toBeNull();
      expect(closed.nextOpenEt).toEqual({ weekdayIndex: 1, hour: 9, minute: 30 }); // Mon 9:30

      const fresh = makeBattle({ scoreState: { evaluationCount: 0, lastScoredAt: null } });
      const pre = build(fresh, makeCache(), AGENT, NOW, MS.preMarket);
      expect(pre.nextOpenEt).toEqual({ weekdayIndex: 2, hour: 9, minute: 30 }); // Tue 9:30
    });

    it('the wall-clock fields are read from LOCAL fields, so they do not shift with the viewer zone', () => {
      // The producer emits a Date whose local fields are the ET wall clock.
      // Reading .getDay()/.getHours() is stable under any TZ; reading .getTime()
      // and re-formatting through Intl is not. This asserts the former.
      const wc = build(makeBattle(), makeCache(), AGENT, NOW, MS.weekend).nextOpenEt;
      expect(wc.hour).toBe(MS.weekend.nextOpenTime.getHours());
      expect(wc.minute).toBe(MS.weekend.nextOpenTime.getMinutes());
      expect(wc.weekdayIndex).toBe(MS.weekend.nextOpenTime.getDay());
    });

    it('POST_CLOSE: there is no next decision', () => {
      const done = makeBattle({ status: 'completed' });
      expect(build(done, makeCache(), AGENT, NOW, MS.afterHours).nextDecisionAt).toBeNull();
    });

    it('early-close day: the 1pm ET close clamps the next check, not the usual 4pm', () => {
      const b = makeBattle({
        scoreState: { evaluationCount: 8, lastScoredAt: '2026-11-27T17:55:00.000Z' }, // 12:55 ET
      });
      const a = build(b, makeCache({ updatedAt: '2026-11-27T17:56:00.000Z' }), AGENT, '2026-11-27T17:57:00Z', MS.earlyCloseOpen);
      expect(a.phase).toBe(PHASE.LIVE);
      // 12:55 + 15min = 13:10 ET, past the 13:00 early close.
      expect(a.nextDecisionAt).toBeNull();
    });

    it('early-close day: a check comfortably before 1pm still gets its next tick', () => {
      const b = makeBattle({
        scoreState: { evaluationCount: 8, lastScoredAt: '2026-11-27T17:00:00.000Z' }, // 12:00 ET
      });
      const a = build(b, makeCache({ updatedAt: '2026-11-27T17:01:00.000Z' }), AGENT, '2026-11-27T17:02:00Z', MS.earlyCloseOpen);
      expect(a.nextDecisionAt).toBe('2026-11-27T17:15:00.000Z'); // 12:15 ET
    });
  });

  describe('statusFeedLatest', () => {
    it('is the last entry, verbatim', () => {
      const a = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(a.statusFeedLatest).toEqual({
        message: 'Holding PLTR into the close.',
        timestamp: '2026-09-01T16:47:00.000Z',
        action: 'hold',
      });
    });

    it('is null on an empty or missing feed', () => {
      expect(build(makeBattle({ statusFeed: [] }), makeCache(), AGENT, NOW, MS.open).statusFeedLatest).toBeNull();
      expect(build(makeBattle({ statusFeed: undefined }), makeCache(), AGENT, NOW, MS.open).statusFeedLatest).toBeNull();
    });

    it('falls back to `type` when an entry carries no `action`', () => {
      const b = makeBattle({ statusFeed: [{ timestamp: NOW, message: 'm', type: 'gameplan_meeting' }] });
      expect(build(b, makeCache(), AGENT, NOW, MS.open).statusFeedLatest.action).toBe('gameplan_meeting');
    });
  });

  describe('loadout', () => {
    it('derives benchLocked from the agent, as EquipBench/EquipStation do', () => {
      expect(build(makeBattle(), makeCache(), AGENT, NOW, MS.open).loadout.benchLocked).toBe(true);
      expect(build(makeBattle(), makeCache(), { archetype: 'x' }, NOW, MS.open).loadout.benchLocked).toBe(false);
    });

    it('prefers the live agent archetype, falling back to the frozen battle snapshot', () => {
      const b = makeBattle({ agentContext: { archetype: 'frozen_one' } });
      expect(build(b, makeCache(), AGENT, NOW, MS.open).loadout.archetype).toBe('momentum_chaser');
      expect(build(b, makeCache(), null, NOW, MS.open).loadout.archetype).toBe('frozen_one');
    });

    it('reads the watchlist label off the frozen snapshot', () => {
      const b = makeBattle({ agentContext: { equippedWatchlist: { name: 'Momentum 20' } } });
      expect(build(b, makeCache(), AGENT, NOW, MS.open).loadout.watchlistLabel).toBe('Momentum 20');
    });
  });

  describe('the alert feed is bounded to the last hour', () => {
    // BreakthroughAlerts keeps a MOUNT-scoped dedupe set and shows each entry
    // for 60 seconds. Inside AgentChat that is fine — it mounts when a battle
    // opens. On the Dashboard it mounts on every visit, so an unfiltered feed
    // replays an hours-old gameplan_meeting as freshly-arrived, every time.
    const feedAt = (iso) => [{ timestamp: iso, message: 'Gameplan Meeting: rotate', action: 'gameplan_meeting' }];

    it('carries a recent entry', () => {
      const b = makeBattle({ statusFeed: feedAt('2026-09-01T16:45:00.000Z') }); // 15 min before NOW
      expect(build(b, makeCache(), AGENT, NOW, MS.open).statusFeed).toHaveLength(1);
    });

    it('drops an entry older than the window — it is not news any more', () => {
      const b = makeBattle({ statusFeed: feedAt('2026-09-01T13:45:00.000Z') }); // 3h+ before NOW
      expect(build(b, makeCache(), AGENT, NOW, MS.open).statusFeed).toEqual([]);
    });

    it('the LATEST-entry line is NOT bounded — it is stamped, so it claims no freshness', () => {
      const b = makeBattle({ statusFeed: feedAt('2026-09-01T13:45:00.000Z') });
      const a = build(b, makeCache(), AGENT, NOW, MS.open);
      expect(a.statusFeed).toEqual([]);
      expect(a.statusFeedLatest?.message).toBe('Gameplan Meeting: rotate');
    });

    it('drops entries with no usable timestamp rather than guessing they are new', () => {
      const b = makeBattle({ statusFeed: [{ message: 'no stamp', action: 'gameplan_meeting' }] });
      expect(build(b, makeCache(), AGENT, NOW, MS.open).statusFeed).toEqual([]);
    });
  });

  it('is pure — the same inputs give the same output, and inputs are not mutated', () => {
    const battle = makeBattle();
    const cache = makeCache();
    const before = JSON.stringify({ battle, cache });
    const a = build(battle, cache, AGENT, NOW, MS.open);
    const b = build(battle, cache, AGENT, NOW, MS.open);
    expect(a).toEqual(b);
    expect(JSON.stringify({ battle, cache })).toBe(before);
  });

  it('never reads the wall clock — a different injected now changes staleness', () => {
    const cache = makeCache({ updatedAt: '2026-09-01T16:50:00.000Z' });
    expect(build(makeBattle(), cache, AGENT, '2026-09-01T17:00:00Z', MS.open).proximityStale).toBe(false);
    expect(build(makeBattle(), cache, AGENT, '2026-09-01T19:00:00Z', MS.open).proximityStale).toBe(true);
  });
});
