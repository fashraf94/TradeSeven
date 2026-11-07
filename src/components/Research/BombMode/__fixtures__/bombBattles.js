// Research Modal Build A — test fixtures shaped from real agent-battle documents
// (field names and shapes from Phase 0 §B/§C and the writers cited in
// selectBombRecord.js; values invented). No production read.

export const ET_1015_1300 = Date.parse('2026-10-14T17:00:00.000Z'); // Wed Oct 14, 1:00 PM ET (EDT)

/** A legacy (unstamped) BaggerBomb agent battle holding EOG in star slot 0. */
export function legacyBattle(over = {}) {
  const base = {
    id: 'battle-legacy',
    status: 'active',
    ownerId: 'owner-1',
    gameMode: 'baggerbomb_agent',
    activatedAt: '2026-10-13T13:45:00.000Z',
    timing: { tradingDays: ['2026-10-13', '2026-10-14', '2026-10-15'] },
    expiresAt: '2026-10-15T20:00:00.000Z',
    portfolio: {
      star: [{ symbol: 'EOG', baseATR: 3.6, positionId: 'pos-eog' }],
      core: [{ symbol: 'XOM', baseATR: 2.2 }],
      support: [],
      startingPrices: { EOG: 154.76, XOM: 110.2 },
    },
    opponent: { portfolio: { star: [{ symbol: 'CVX', baseATR: 2.4 }], core: [], support: [] } },
    thresholdHistory: { EOG: { maxMultiplier: 1.12, minMultiplier: -0.31, badges: ['bagger'] } },
    cronState: { lastTickPrice: { EOG: 160.19 }, lastTickTimestamp: { EOG: Date.parse('2026-10-14T17:00:31.000Z') } },
    scoreState: { lastScoredAt: '2026-10-14T17:00:40.000Z' },
    evaluations: [
      { evalId: 'e1', timestamp: '2026-10-13T13:30:00.000Z', evidence: { EOG: { px: 153.9 } } },
      { evalId: 'e2', timestamp: '2026-10-14T16:45:00.000Z', evidence: { EOG: { px: 159.8 }, XOM: { px: 111 } } },
      { evalId: 'e3', timestamp: '2026-10-14T17:00:00.000Z', evidence: { EOG: { px: 160.19 } } },
      { evalId: 'e4', timestamp: '2026-10-14T17:15:00.000Z', evidence: { XOM: { px: 111.2 } } },
    ],
  };
  return { ...base, ...over };
}
