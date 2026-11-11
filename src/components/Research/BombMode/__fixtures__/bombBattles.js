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

/**
 * The selector's MEASURED answer for a held position (selectBombRecord's
 * measured shape, as the Battle View hands it to the modal in
 * bombContext.record), hand-built. Since the 2026-11-07 ruling on spec
 * §0.4(a) a legacy record draws only the preview, so the red-zone, clock and
 * banked-moment rows run on a measured record. The selector's own measured
 * branch is pinned on the real corrected-battle harness (selectBombRecord.test.js;
 * the modal's committedRow rows).
 *   fill, thresholdPct  the targets are fill × (1 + multiplier × thresholdPct / 100)
 *   crossedTiers        the committed context's crossed tiers
 *   lastScoredAt        scoreState.lastScoredAt; scored: the check's currentPrice at its providerAsOf
 */
const MULTIPLIERS = Object.freeze({ bagger: 1, doubleBagger: 1.5, tenBagger: 2, bust: -1, crash: -1.5, meltdown: -2 });
export function measuredRecord({
  symbol, positionId, tier = 'star', slot = 0, fill, thresholdPct, crossedTiers = [],
  lastScoredAt = '2026-10-14T17:00:40.000Z', scored = null, expiresAt = '2026-10-20T20:00:00.000Z',
  enteredAt = '2026-10-13T13:45:00.000Z', quoteAsOf = null, checkDots = [], details = null,
}) {
  // BD-9: the selector's entry instant is the fill quote's provider time when the
  // fixture names one (quoteAsOf), else — as before — the receipt's enteredAt.
  const entryAtMs = Date.parse(quoteAsOf ?? enteredAt);
  return {
    symbol,
    tier,
    slot,
    positionId,
    battleExpiresAtMs: Date.parse(expiresAt),
    lastScoredAtMs: Date.parse(lastScoredAt),
    model: 'measured',
    entry: { price: fill, atMs: entryAtMs },
    measured: {
      measured: true,
      baselinePrice: fill,
      targets: Object.entries(MULTIPLIERS).map(([key, m]) => ({ key, price: fill * (1 + (m * thresholdPct) / 100) })),
      crossedTiers: [...crossedTiers],
    },
    scored: scored ? { ...scored, source: 'stockRewardContexts' } : null,
    checkDots: checkDots.filter((d) => d.atMs >= entryAtMs),
    ...(details ? { details } : {}),
  };
}

/**
 * THE FOUNDER'S AMZN (Tue Nov 10, 2026; battle read in the build report §1.1),
 * in PRODUCTION SHAPE: fill $270.22 at 3.954943 %, entered 11:16:05 AM ET on a
 * fill quote EODHD timestamps 11:00 AM; the 1:00 check scored $268.09 on a quote
 * the provider stamps 12:44 PM, observed at 1:00:28 PM, committed 1:00:59 PM —
 * the ~16-minute lag BD-I1 found, so a row can tell the quote's minute from the
 * check. Rungs: +15 $280.91, +30 $286.25, +50 $291.59; Bust $259.53, Crash
 * $254.19, Meltdown $248.85.
 */
export const AMZN_SCORING_PCT = 3.954943;
export function amznRecord(over = {}) {
  return measuredRecord({
    symbol: 'AMZN',
    positionId: 'pos-amzn',
    tier: 'core',
    fill: 270.22,
    thresholdPct: AMZN_SCORING_PCT,
    crossedTiers: [],
    enteredAt: '2026-11-10T16:16:05.359Z',
    quoteAsOf: '2026-11-10T16:00:00.000Z',
    lastScoredAt: '2026-11-10T18:00:58.906Z',
    expiresAt: '2026-11-11T01:00:00.000Z',
    scored: { price: 268.09, atMs: Date.parse('2026-11-10T17:44:00.000Z'), checkAtMs: Date.parse('2026-11-10T18:00:28.000Z') },
    checkDots: [
      { atMs: Date.parse('2026-11-10T17:45:59.686Z'), px: 268.97 },
      { atMs: Date.parse('2026-11-10T18:00:58.906Z'), px: 268.09 },
    ],
    ...over,
  });
}

/**
 * A held EOG at the legacy fixture's own rung prices, so the rows keep their
 * numbers: the fill is that fixture's previous close ($155.60) and the targets
 * its 3.6 % ladder (+15 at $161.20, +30 at $164.00, +50 at $166.80); +15 banked
 * (its maxMultiplier 1.12), last scored at 1:00:40 with $160.19 at 1:00:31, and
 * its two check dots since entry.
 */
export function measuredEogRecord(over = {}) {
  return measuredRecord({
    symbol: 'EOG',
    positionId: 'pos-eog',
    fill: 155.6,
    thresholdPct: 3.6,
    crossedTiers: ['bagger'],
    scored: { price: 160.19, atMs: Date.parse('2026-10-14T17:00:31.000Z') },
    checkDots: [
      { atMs: Date.parse('2026-10-14T16:45:00.000Z'), px: 159.8 },
      { atMs: Date.parse('2026-10-14T17:00:00.000Z'), px: 160.19 },
    ],
    ...over,
  });
}
