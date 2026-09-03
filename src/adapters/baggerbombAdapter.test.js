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
import { battleTypeLabel } from '../utils/commandCenterLiveBattles';
import {
  buildBaggerbombAdapter,
  derivePhase,
  deriveDueAt,
  deriveLastCheckOfSession,
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
    // Every real battle carries this (createAgentBattle stamps agentContext),
    // and the Desk's F-1 eyebrow reads the agent name from it.
    agentContext: { agentName: 'Aurora' },
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
    expect(a.game).toEqual({
      id: 'battle-1', type: 'baggerbomb', label: 'BaggerBomb', agentName: 'Aurora',
    });
    expect(a.score).toEqual({ current: 42, tradeCount: 3 });
  });

  describe('game identity is DERIVED, never constant (F-1)', () => {
    // It was hardcoded to baggerbomb/BaggerBomb, which was a lie whenever the
    // Desk was handed a ranked battle — and before F-1 it could be, because the
    // shells selected by index and sortLiveBattles puts ranked first.
    it('a ranked battle (groupId present) reports itself as ranked', () => {
      const ranked = makeBattle({ groupId: 'grp-1' });
      const a = build(ranked, makeCache(), AGENT, NOW, MS.open);
      expect(a.game.type).toBe('ranked');
      expect(a.game.label).toBe('Ranked');
    });

    it('a casual battle (no groupId) reports itself as BaggerBomb', () => {
      const a = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(a.game.type).toBe('baggerbomb');
      expect(a.game.label).toBe('BaggerBomb');
    });

    it('the label matches what the Manage card would print for the same battle', () => {
      // One classification, so the Desk eyebrow and the card cannot disagree.
      const ranked = makeBattle({ groupId: 'grp-1' });
      expect(build(ranked, makeCache(), AGENT, NOW, MS.open).game.label)
        .toBe(battleTypeLabel(ranked));
      expect(build(makeBattle(), makeCache(), AGENT, NOW, MS.open).game.label)
        .toBe(battleTypeLabel(makeBattle()));
    });

    it('carries the agent name for the eyebrow, preferring the frozen battle snapshot', () => {
      expect(build(makeBattle(), makeCache(), AGENT, NOW, MS.open).game.agentName).toBe('Aurora');
      const noSnapshot = makeBattle({ agentContext: undefined });
      expect(build(noSnapshot, makeCache(), { name: 'Live Name' }, NOW, MS.open).game.agentName)
        .toBe('Live Name');
      expect(build(noSnapshot, makeCache(), null, NOW, MS.open).game.agentName).toBeNull();
    });
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

  // Phase A (D-62): the ONE derivation of "next", exported so the Battle View
  // turn line's late state can read the due instant that nextDecisionAt
  // deliberately withholds once it is past. nextDecisionAt consumes it, so
  // the goldens above are the proof the extraction changed nothing.
  describe('deriveDueAt — the due instant, past or not', () => {
    it('is the last check + 15 minutes, as a TRUE ISO instant', () => {
      expect(deriveDueAt('2026-09-01T16:47:00.000Z', MS.open)).toBe('2026-09-01T17:02:00.000Z');
    });

    it('is returned even when already past — that is its whole reason to exist', () => {
      // nextDecisionAt for this battle at 16:30Z is null (starved cron); the
      // due instant is still a fact about the schedule and still 14:15Z.
      expect(deriveDueAt('2026-09-01T14:00:00.000Z', MS.open)).toBe('2026-09-01T14:15:00.000Z');
      const starved = makeBattle({ scoreState: { evaluationCount: 9, lastScoredAt: '2026-09-01T14:00:00.000Z' } });
      expect(build(starved, makeCache(), AGENT, '2026-09-01T16:30:00Z', MS.open).nextDecisionAt).toBeNull();
    });

    it('null with no last check — never a fabricated time', () => {
      expect(deriveDueAt(null, MS.open)).toBeNull();
      expect(deriveDueAt(undefined, MS.open)).toBeNull();
      expect(deriveDueAt('not a date', MS.open)).toBeNull();
    });

    it('null when the candidate lands at or past the session close (nothing can be late after the bell)', () => {
      expect(deriveDueAt('2026-09-01T19:50:00.000Z', MS.open)).toBeNull();   // 15:50 → 16:05 ET
      expect(deriveDueAt('2026-09-01T19:45:00.000Z', MS.open)).toBeNull();   // 15:45 → 16:00 ET, at the close
      expect(deriveDueAt('2026-09-01T19:44:00.000Z', MS.open)).toBe('2026-09-01T19:59:00.000Z');
    });

    it('early-close day: the 1pm ET close clamps it', () => {
      expect(deriveDueAt('2026-11-27T17:55:00.000Z', MS.earlyCloseOpen)).toBeNull();            // 12:55 → 13:10 ET
      expect(deriveDueAt('2026-11-27T17:00:00.000Z', MS.earlyCloseOpen)).toBe('2026-11-27T17:15:00.000Z');
    });

    it('with no market state there is no close to clamp to — the arithmetic stands', () => {
      expect(deriveDueAt('2026-09-01T19:50:00.000Z', null)).toBe('2026-09-01T20:05:00.000Z');
    });

    it('the close clamp compares ET minutes on both sides of the March DST switch', () => {
      // 2026-03-06 is EST (UTC−5); 2026-03-09 is EDT (UTC−4). The same ET
      // wall-clock check sits at different UTC offsets and must clamp the same.
      const est = { ...MS.open, nextCloseTime: new Date(2026, 2, 6, 16, 0) };
      const edt = { ...MS.open, nextCloseTime: new Date(2026, 2, 9, 16, 0) };
      expect(deriveDueAt('2026-03-06T20:50:00.000Z', est)).toBeNull();                          // 15:50 EST
      expect(deriveDueAt('2026-03-06T20:40:00.000Z', est)).toBe('2026-03-06T20:55:00.000Z');    // 15:40 EST
      expect(deriveDueAt('2026-03-09T19:50:00.000Z', edt)).toBeNull();                          // 15:50 EDT
      expect(deriveDueAt('2026-03-09T19:40:00.000Z', edt)).toBe('2026-03-09T19:55:00.000Z');    // 15:40 EDT
    });

    it('nextDecisionAt is deriveDueAt gated on phase and "not yet past" — one function, not two', () => {
      const a = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(a.nextDecisionAt).toBe(deriveDueAt(a.lastCheckedAt, MS.open));
    });
  });

  describe('lastCheckOfSession — the D-71 discriminator, derived ONCE for both surfaces', () => {
    it('LIVE with no due slot inside the session is the last check of the day', () => {
      // 15:50 ET + 15 = 16:05 ET, past the 16:00 close.
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-01T19:50:00.000Z', MS.open)).toBe(true);
      // 15:45 ET + 15 = 16:00 ET — AT the close, which deriveDueAt clamps too.
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-01T19:45:00.000Z', MS.open)).toBe(true);
    });

    it('MUTATION ROW — a slot still inside the session is NOT the last check, however late it is', () => {
      // The starved-cron case: the slot exists and was missed. Late, not done.
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-01T19:44:00.000Z', MS.open)).toBe(false);
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-01T14:00:00.000Z', MS.open)).toBe(false);
    });

    it('no check at all is not a last check — the Desk says one is coming instead', () => {
      expect(deriveLastCheckOfSession(PHASE.LIVE, null, MS.open)).toBe(false);
      expect(deriveLastCheckOfSession(PHASE.LIVE, undefined, MS.open)).toBe(false);
    });

    it('every non-LIVE phase is false — the closed and complete lines carry their own sentence', () => {
      for (const phase of [PHASE.PRE_OPEN, PHASE.LIVE_CLOSED, PHASE.POST_CLOSE]) {
        expect(deriveLastCheckOfSession(phase, '2026-09-01T19:50:00.000Z', MS.open)).toBe(false);
      }
    });

    it('an early close clamps earlier — a 12:55 ET check is the last one of a 13:00 session', () => {
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-11-27T17:55:00.000Z', MS.earlyCloseOpen)).toBe(true);
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-11-27T17:00:00.000Z', MS.earlyCloseOpen)).toBe(false);
    });

    it('MUTATION ROW (review L1-F1 / L3-F1) — YESTERDAY\'s last check is not today\'s', () => {
      // The clamp inside deriveDueAt compares ET minutes-past-midnight and is
      // blind to the DATE, so a prior-session stamp at/after (close − 15 min)
      // also yields null. `scoreState.lastScoredAt` is a running stamp that is
      // never reset at the day rollover, so on day 2+ of a multi-day battle
      // this is the state from the open until the day's first tick lands —
      // and without the calendar-day conjunct both surfaces opened the morning
      // claiming `Checked 3:50 PM · last check today` about yesterday.
      const wed = { ...MS.open, nextOpenTime: new Date(2026, 8, 3, 9, 30), nextCloseTime: new Date(2026, 8, 2, 16, 0) };
      // Tue 15:50 ET — the last check of TUESDAY's session.
      expect(deriveDueAt('2026-09-01T19:50:00.000Z', wed)).toBeNull();
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-01T19:50:00.000Z', wed)).toBe(false);
      // …while WEDNESDAY's own 15:50 check is the last of the session.
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-02T19:50:00.000Z', wed)).toBe(true);
    });

    it('with no market state there is no session to be the last check of', () => {
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-01T19:50:00.000Z', null)).toBe(false);
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-01T19:50:00.000Z', {})).toBe(false);
    });

    it('the calendar day is ET, not UTC — an instant whose UTC day differs still resolves to its ET day', () => {
      // Review FIX-2 caught the earlier version of this row as vacuous: every
      // IN-SESSION ET instant (13:30-20:00 UTC) shares its UTC calendar day,
      // so it could not exercise the distinction at all. This one can:
      // 2026-09-02T01:00Z is Sep 1 at 9 PM ET — Sep 2 in UTC, Sep 1 in ET.
      const sep1 = { ...MS.open, nextCloseTime: new Date(2026, 8, 1, 16, 0) };
      const sep2 = { ...MS.open, nextCloseTime: new Date(2026, 8, 2, 16, 0) };
      // Against Sep 1's close it IS that session's day (a UTC comparison would
      // read Sep 2 and answer false).
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-02T01:00:00.000Z', sep1)).toBe(true);
      // Against Sep 2's close it is not (a UTC comparison would read Sep 2 and
      // wrongly answer true — the L1-F1 defect, in the opposite direction).
      expect(deriveLastCheckOfSession(PHASE.LIVE, '2026-09-02T01:00:00.000Z', sep2)).toBe(false);
    });

    it('the adapter exposes the field, so neither surface re-derives the null', () => {
      const a = build(makeBattle(), makeCache(), AGENT, NOW, MS.open);
      expect(a.lastCheckOfSession).toBe(deriveLastCheckOfSession(a.phase, a.lastCheckedAt, MS.open));
      expect(a.lastCheckOfSession).toBe(false);
      const late = build(
        makeBattle({ scoreState: { evaluationCount: 25, lastScoredAt: '2026-09-01T19:50:00.000Z' } }),
        makeCache(), AGENT, '2026-09-01T19:55:00.000Z', MS.open,
      );
      expect(late.lastCheckOfSession).toBe(true);
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
