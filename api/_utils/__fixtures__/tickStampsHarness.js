// api/_utils/__fixtures__/tickStampsHarness.js
//
// Phase B — the tick stamps: the END-TO-END CRON HARNESS fixtures.
//
// The two agent-evaluate.tickStamps.*.test.js suites drive the REAL
// processAgentBattle through the full-Haiku path — lock → scores → risk layer →
// trigger gate (forced_open) → the fenced prompt build → the MOCKED model →
// the decision → the evaluation entry → finalUpdate — against the in-memory
// doc store below. The vi.mock declarations live in each test file (vitest
// hoists them per file); this module holds only the pure factories both share:
// the frozen clock, the seven-position book, the quote table, the rankings and
// technical docs, the intraday candles, the doc store, the model responses and
// the Firestore storage-size rule the size rows use.
//
// ZERO product imports (the voiceGroundingFixtures.js precedent): nothing here
// can drag a browser dep into the cron's Node graph, and the harness cannot
// drift with a helper it would otherwise be testing.
//
// THE DOC vs THE OBJECT. `makeTickDb` keeps the persisted battle in
// `db.__store.battle`, a deep copy of the object the test hands the cron; every
// snapshot `data()` returns a fresh deep copy. So a test can mutate THE DOC
// mid-tick (the mid-tick filing fixture) and observe that the cron's in-memory
// `battle` — the object the prompt was rendered from — is what the stamp names.
//
// THE RECORDED WRITE is a deep copy taken AT THE MOMENT OF THE WRITE (review
// D-1): `db.__updates` holds what Firestore would have received, so a stamp
// applied to `evaluation` after `battleRef.update(finalUpdate)` is invisible
// to the recorded payload exactly as it would be in production. And, like the
// Admin SDK with `ignoreUndefinedProperties` unset, the mock write REJECTS any
// `undefined` value in the payload (review D-9) — every end-to-end row guards
// the whole finalUpdate against a stray `undefined` for free.

export const FROZEN_NOW = '2026-09-09T15:00:00.000Z'; // Wed Sep 9 2026, 11:00 AM ET (market open)
export const FROZEN_DAY_ET = '2026-09-09';
export const RANKINGS_COMPUTED_AT_MS = Date.UTC(2026, 8, 9, 14, 30, 0); // 10:30 ET today — an intraday recompute
export const TECH_UPDATED_AT_MS = Date.UTC(2026, 8, 9, 14, 29, 55);     // the same intraday run wrote the technical docs 5 s earlier
export const FUND_COMPUTED_AT_MS = Date.UTC(2026, 8, 4, 6, 15, 0);      // Fri Sep 4, 06:15 UTC — the newest HELD fundamentals vintage
export const FUND_COMPUTED_AT_OLDER_MS = Date.UTC(2026, 8, 1, 6, 15, 0); // an older per-ticker vintage (mixed-vintage case)
export const FUND_COMPUTED_AT_BENCH_MS = Date.UTC(2026, 8, 8, 6, 15, 0); // bench AMD is FRESHER than any held name — the FUNDAMENTALS
                                                                          // block's header date (held + bench) is this one

export const OLD_THREAD = 'thread-tf02-0001';   // the directive on the battle when the tick begins
export const NEWER_THREAD = 'thread-tf02-0002'; // a filing that lands on the DOC mid-tick

/** The seven held positions (2 star + 2 core + 3 support — the tiered book). */
export const HELD = Object.freeze(['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC']);
/** The bench: never stamped. */
export const BENCH = Object.freeze(['AMD', 'JPM']);

/** The 25 keys the cron composed on every entry BEFORE Phase B (agent-evaluate.js `const evaluation = {…}`), in source order. */
export const PRE_PHASE_B_ENTRY_KEYS = Object.freeze([
  'evalId', 'timestamp', 'day', 'battlePhase', 'decision', 'symbolOut', 'symbolIn', 'tier',
  'rationale', 'hypothesis', 'conviction', 'riskAssessment', 'ignoredDirectiveIds',
  'directiveThreadId', 'trade_reasoning', 'citedForgeRules', 'overriddenForgeRules', 'triggers',
  'scores', 'validationErrors', 'downgraded', 'marketPosture', 'guardrailOverrides',
  'guardrailSourceNote', 'haikuError',
]);

export function makeDirective(overrides = {}) {
  return {
    text: 'Require stronger confirmation before entering',
    expiry: 'end_of_battle',
    directiveThreadId: OLD_THREAD,
    createdAt: '2026-09-09T14:20:00.000Z',
    adjustmentId: 'TF-02',
    canonicalTextVersion: 1,
    ...overrides,
  };
}

/**
 * A regular (non-tournament, non-CPU) autopilot BaggerBomb battle on its
 * activation day, first evaluation (evaluations: [] → the trigger gate fires
 * forced_open), with a directive current. Every migration field is present so
 * the cron writes no migration update.
 */
export function makeTickBattle(overrides = {}) {
  return {
    id: 'battle-tick-1',
    ownerId: 'owner-uid-1',
    agentId: 'agent-1',
    status: 'active',
    gameMode: 'baggerbomb_agent',
    duration: 'fullday',
    createdAt: '2026-09-09T13:30:00.000Z',
    activatedAt: '2026-09-09T13:30:00.000Z',
    expiresAt: '2026-09-10T00:00:00.000Z',
    timing: {
      tradingDays: [FROZEN_DAY_ET],
      currentTradingDay: 1,
      timezone: 'America/New_York',
      localOpen: '09:30',
      localClose: '16:00',
    },
    executionMode: 'autopilot',
    pendingProposal: null,
    proposalHistory: [],
    battleLedger: [],
    statusFeed: [],
    gameplanMeeting: null,
    gameplanMeetingHistory: [],
    chatExchanges: [],
    chatBudgetUsed: 0,
    dailyReviews: [],
    dailyGrades: {},
    strategyPreset: 'balanced',
    trades: [],
    evaluations: [],
    scoreState: {
      currentScore: 0, activeScore: 0, bankedScore: 0, opponentScore: 0, peakScore: 0,
      tradeCount: 0, evaluationCount: 0, holdCount: 0,
      bankedBadgePoints: { total: 0 },
    },
    thresholdHistory: {},
    cronState: {
      evaluatingAt: null,
      vwapTicks: {}, intradayMomentum: {}, stagnationTicks: {},
      lastTickPrice: {}, lastTickTimestamp: {}, vwapFireGuard: {},
      seenStoryIds: [],
      // A gameplan meeting already ran today (the detector's one-per-ET-day
      // cap keys on this exact toLocaleDateString form). Without it the
      // fixture's Consumer Cyclical drag (TSLA) trips the meeting trigger —
      // one of the five early returns that write NO entry (discovery A4).
      lastGameplanDate: '9/9/2026',
      totalHaikuCalls: 0,
      totalTokens: { input: 0, output: 0 },
      consecutiveHolds: 0,
      consecutiveEvalFailures: 0,
    },
    agentContext: {
      agentName: 'Photo Agent',
      archetype: 'analyst',
      riskTolerance: 50,
      evaluationInterval: 15,
      strategyBrief: 'Photograph brief.',
      innerMonologue: { strategy: 'Photograph strategy.' },
      activeRules: [],
      equippedBundleIds: [],
      deployedGuardrails: [],
      standingLeans: [],
    },
    portfolio: {
      star: [
        { symbol: 'NVDA', name: 'NVIDIA', baseATR: 3.1, isCrypto: false, sector: 'Technology' },
        { symbol: 'TSLA', name: 'Tesla', baseATR: 4, isCrypto: false, sector: 'Consumer Cyclical' },
      ],
      core: [
        { symbol: 'MSFT', name: 'Microsoft', baseATR: 1.9, isCrypto: false, sector: 'Technology' },
        { symbol: 'AMZN', name: 'Amazon', baseATR: 2.2, isCrypto: false, sector: 'Consumer Cyclical' },
      ],
      support: [
        { symbol: 'KO', name: 'Coca-Cola', baseATR: 1.1, isCrypto: false, sector: 'Consumer Defensive' },
        { symbol: 'PG', name: 'P&G', baseATR: 1, isCrypto: false, sector: 'Consumer Defensive' },
        { symbol: 'BTC', name: 'Bitcoin', baseATR: 5, isCrypto: true, sector: 'Crypto' },
      ],
      bench: {
        stocks: [
          { symbol: 'AMD', name: 'AMD', baseATR: 3.4, isCrypto: false, sector: 'Technology' },
          { symbol: 'JPM', name: 'JPMorgan', baseATR: 1.6, isCrypto: false, sector: 'Financial Services' },
        ],
        crypto: null,
      },
      startingPrices: {
        NVDA: 120.5, TSLA: 250.1, MSFT: 410, AMZN: 185, KO: 62.2, PG: 165.3, BTC: 67000,
        AMD: 160.4, JPM: 199.9,
      },
    },
    opponent: {
      portfolio: { star: [], core: [], support: [], bench: { stocks: [], crypto: null }, startingPrices: {} },
      username: 'CPU Opponent',
    },
    directive: makeDirective(),
    controlEpochLog: [],
    ...overrides,
  };
}

/**
 * The quote table this tick fetched (getStockAnalysisData(...).price per
 * symbol). NVDA sits at +2.41 % from entry = +0.78x ATR (0.22x from the 1.0x
 * BaggerBomb line — exactly the LOCK_PROXIMITY edge; the risk manager rules
 * it), TSLA at −2.08 % = −0.52x (a HOLD), everything else small.
 */
export function makePriceTable() {
  return {
    NVDA: { current: 123.4, previousClose: 121.0, changePercent: 1.98 },
    TSLA: { current: 244.9, previousClose: 249.0, changePercent: -1.65 },
    MSFT: { current: 412.3, previousClose: 409.5, changePercent: 0.68 },
    AMZN: { current: 186.2, previousClose: 184.0, changePercent: 1.2 },
    KO: { current: 62.0, previousClose: 62.3, changePercent: -0.48 },
    PG: { current: 166.1, previousClose: 165.0, changePercent: 0.67 },
    BTC: { current: 67450, previousClose: 66800, changePercent: 0.97 },
    AMD: { current: 162.0, previousClose: 159.5, changePercent: 1.57 },
    JPM: { current: 201.1, previousClose: 200.2, changePercent: 0.45 },
    SPY: { current: 560.2, previousClose: 556.0, changePercent: 0.76 },
    QQQ: { current: 480.1, previousClose: 477.3, changePercent: 0.59 },
    'BTC-USD.CC': { current: 67450, previousClose: 66800, changePercent: 0.97 },
  };
}

function rankingRow(symbol, { bBandwidthPercentile, nr7Flag, dailyRange, sectorName, fundamentals = null }) {
  const row = { symbol, name: symbol, baseATR: 2.5, atrPercentile: 0.3, baggerBombFit: 50, sectorName, bBandwidthPercentile, nr7Flag, dailyRange };
  if (fundamentals) row.fundamentals = fundamentals;
  return row;
}

/**
 * indexIntelligence/stockRankings — `computedAt` is a Firestore Timestamp in
 * production; the cron reads it through `.toMillis()`, so the fixture carries
 * that method and nothing else. Per-ticker fundamentals carry the mirror's
 * epoch-ms `computedAt` (compute-index-intelligence.js writes ms); NVDA's is
 * the newest, KO's is older (the mixed-vintage case), AMZN and BTC carry none.
 */
export function makeRankingsDoc() {
  return {
    computedAt: { toMillis: () => RANKINGS_COMPUTED_AT_MS },
    stocks: [
      rankingRow('NVDA', { bBandwidthPercentile: 15, nr7Flag: true, dailyRange: 3.2, sectorName: 'Technology',
        fundamentals: { computedAt: FUND_COMPUTED_AT_MS, trailingPE: { value: 41.2 }, marketCapClass: 'large', earningsRevisions30d: 2.1 } }),
      rankingRow('TSLA', { bBandwidthPercentile: 88, nr7Flag: false, dailyRange: 9.8, sectorName: 'Consumer Cyclical',
        fundamentals: { computedAt: FUND_COMPUTED_AT_MS, trailingPE: { value: 62.5 }, marketCapClass: 'large' } }),
      rankingRow('MSFT', { bBandwidthPercentile: 42, nr7Flag: false, dailyRange: 4.1, sectorName: 'Technology',
        fundamentals: { computedAt: FUND_COMPUTED_AT_MS, trailingPE: { value: 33.0 }, marketCapClass: 'large' } }),
      rankingRow('AMZN', { bBandwidthPercentile: 55, nr7Flag: false, dailyRange: 3.0, sectorName: 'Consumer Cyclical' }),
      rankingRow('KO', { bBandwidthPercentile: 12, nr7Flag: true, dailyRange: 0.6, sectorName: 'Consumer Defensive',
        fundamentals: { computedAt: FUND_COMPUTED_AT_OLDER_MS, trailingPE: { value: 24.1 }, marketCapClass: 'large' } }),
      rankingRow('PG', { bBandwidthPercentile: 30, nr7Flag: false, dailyRange: 1.4, sectorName: 'Consumer Defensive',
        fundamentals: { computedAt: FUND_COMPUTED_AT_MS, trailingPE: { value: 26.3 }, marketCapClass: 'large' } }),
      // BTC: no ranking row at all — the null-honesty case for bbPct / nr7.
      rankingRow('AMD', { bBandwidthPercentile: 20, nr7Flag: true, dailyRange: 4.4, sectorName: 'Technology',
        fundamentals: { computedAt: FUND_COMPUTED_AT_BENCH_MS, trailingPE: { value: 45.0 }, marketCapClass: 'large' } }),
      rankingRow('JPM', { bBandwidthPercentile: 60, nr7Flag: false, dailyRange: 2.2, sectorName: 'Financial Services',
        fundamentals: { computedAt: FUND_COMPUTED_AT_MS, trailingPE: { value: 12.4 }, marketCapClass: 'large' } }),
    ],
  };
}

/**
 * stockTechnicalScores docs (classifyStockRegime inputs + the rsPercentile the
 * BENCH block renders; each carries the writer's `updatedAt` serverTimestamp —
 * a Firestore Timestamp in production, a { toMillis } stand-in here — which
 * is the vintage `vintages.techAt` stamps). Regimes by construction of the
 * classifier:
 *   NVDA directional_expansion · TSLA distressed · MSFT directional_contraction
 *   AMZN choppy · KO choppy · PG directional_contraction · BTC — NO DOC (null case)
 *   AMD / JPM (bench) carry docs so the harness proves bench regimes are NOT stamped.
 */
export function makeTechDocs() {
  const updatedAt = { toMillis: () => TECH_UPDATED_AT_MS };
  return Object.fromEntries(Object.entries({
    NVDA: { atrPercent: 4.2, factors: { aboveSMA20: true, aboveSMA50: true, aboveSMA200: true, rsi: 62, macdHistogram: 0.4, macdAboveSignal: true, upDayVolRatio: 1.5, rsPercentile: 88 } },
    TSLA: { atrPercent: 4.8, factors: { aboveSMA20: false, aboveSMA50: true, aboveSMA200: true, rsi: 41, macdHistogram: -0.6, macdAboveSignal: false, upDayVolRatio: 0.9, rsPercentile: 35 } },
    MSFT: { atrPercent: 1.4, factors: { aboveSMA20: true, aboveSMA50: true, aboveSMA200: true, rsi: 55, macdHistogram: 0.1, macdAboveSignal: true, upDayVolRatio: 1.0, rsPercentile: 64 } },
    AMZN: { atrPercent: 2.5, factors: { aboveSMA20: true, aboveSMA50: false, aboveSMA200: true, rsi: 58, macdHistogram: 0.2, macdAboveSignal: true, upDayVolRatio: 1.1, rsPercentile: 71 } },
    KO: { atrPercent: 1.1, factors: { aboveSMA20: false, aboveSMA50: false, aboveSMA200: true, rsi: 44, macdHistogram: -0.05, macdAboveSignal: false, upDayVolRatio: 0.8, rsPercentile: 22 } },
    PG: { atrPercent: 1.0, factors: { aboveSMA20: true, aboveSMA50: true, aboveSMA200: true, rsi: 52, macdHistogram: 0.02, macdAboveSignal: true, upDayVolRatio: 1.0, rsPercentile: 47 } },
    AMD: { atrPercent: 4.5, factors: { aboveSMA20: true, aboveSMA50: true, aboveSMA200: true, rsi: 66, macdHistogram: 0.5, macdAboveSignal: true, upDayVolRatio: 1.4, rsPercentile: 91 } },
    JPM: { atrPercent: 1.3, factors: { aboveSMA20: true, aboveSMA50: true, aboveSMA200: true, rsi: 57, macdHistogram: 0.05, macdAboveSignal: true, upDayVolRatio: 1.0, rsPercentile: 58 } },
  }).map(([symbol, doc]) => [symbol, { symbol, ...doc, updatedAt }]));
}

/**
 * Five 5-minute RTH candles for NVDA (09:30–09:50 ET on the frozen day, EODHD
 * UTC datetime form) — enough for the session gate (MIN_SESSION_CANDLES = 3)
 * and a real calculateVWAP: the closes rise, so the deviation is positive and
 * the VWAP floor never strikes.
 */
export function makeIntradayCandles() {
  return [
    { datetime: '2026-09-09 13:30:00', open: 121.0, high: 121.8, low: 120.6, close: 121.5, volume: 1_000_000 },
    { datetime: '2026-09-09 13:35:00', open: 121.5, high: 122.4, low: 121.3, close: 122.2, volume: 800_000 },
    { datetime: '2026-09-09 13:40:00', open: 122.2, high: 122.9, low: 122.0, close: 122.7, volume: 700_000 },
    { datetime: '2026-09-09 13:45:00', open: 122.7, high: 123.3, low: 122.5, close: 123.1, volume: 600_000 },
    { datetime: '2026-09-09 13:50:00', open: 123.1, high: 123.6, low: 122.9, close: 123.4, volume: 500_000 },
  ];
}

/** The model's HOLD tool input (submit_trade_decision). */
export function makeHoldResult(overrides = {}) {
  return {
    decision: 'HOLD',
    rationale: 'NVDA is pressing its first ATR line with the sector leading; nothing on the bench outranks what I hold. Holding the book as it stands.',
    hypothesis: 'Hypothesis: NVDA clears +1x ATR before the close and holds the star slot.',
    conviction: 58,
    riskAssessment: 'low',
    status_feed_update: 'Holding the book — NVDA leading, TSLA on watch.',
    pvp_context: null,
    cited_rules: [],
    cited_forge_rules: [],
    overridden_forge_rules: [],
    ignoredDirectiveIds: [],
    directiveThreadId: null,
    trade_reasoning: null,
    ...overrides,
  };
}

/** The model's autopilot SWAP tool input: KO (support) out, AMD (bench) in. */
export function makeSwapResult(overrides = {}) {
  return makeHoldResult({
    decision: 'SWAP',
    symbolOut: 'KO',
    symbolIn: 'AMD',
    tier: 'support',
    rationale: 'KO has gone dead money while the semis keep leading; AMD\'s relative strength is the cleanest on the bench and volume confirmed the push. Rotating the support slot into strength.',
    hypothesis: 'Hypothesis: AMD closes above its 20-day within two sessions and holds the support slot.',
    conviction: 72,
    riskAssessment: 'medium',
    status_feed_update: 'Rotating KO → AMD in support: relative strength and confirming volume.',
    ...overrides,
  });
}

/** The model's raw anticipation items: one full (with the `rationale` the stamp must cut), one minimal, one the queue drops (no symbol). */
export function makeAnticipationCandidates() {
  return [
    {
      symbol: 'AMD',
      direction: 'potential_entry',
      signalSummary: 'Relative strength building against the sector and volume is confirming.',
      threshold: 'If it holds above the 20-day on the next test, I would rotate it into Core.',
      rationale: 'Fuller context for the Voice Layer that the stamp must never persist.',
      signalSource: 'relative_strength',
    },
    {
      symbol: 'TSLA',
      direction: 'potential_exit',
      signalSummary: 'Below VWAP for two sessions with the MACD histogram widening negative.',
      threshold: 'If it loses the 50-day on volume, I would rotate it out.',
    },
    { direction: 'potential_entry', signalSummary: 'no symbol — the queue drops this item', threshold: 'never' },
  ];
}

/** An Anthropic messages.create response carrying one tool_use block. */
export function makeToolUseResponse(input, { inputTokens = 4321, outputTokens = 210 } = {}) {
  return {
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: 'submit_trade_decision', input }],
  };
}

// ---------------------------------------------------------------------------
// The in-memory doc store

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  (v.constructor === Object || v.constructor === undefined);

/** Deep-copy plain data; functions and class instances (a Timestamp-like) pass by reference. */
export function deepClone(v) {
  if (Array.isArray(v)) return v.map(deepClone);
  if (isPlainObject(v)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
    return out;
  }
  return v;
}

/** A firebase FieldValue sentinel (arrayUnion / increment / …) — not applied by this store. */
const isFieldValue = (v) => !!v && typeof v === 'object' && typeof v.isEqual === 'function';

/** The SDK's rule: no `undefined` anywhere in a write (sentinels are leaves). Throws with the offending paths. */
function assertWritable(payload, what) {
  const bad = [];
  const walk = (v, path) => {
    if (v === undefined) { bad.push(path || '<root>'); return; }
    if (v === null || typeof v !== 'object' || isFieldValue(v)) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(payload, '');
  if (bad.length) throw new Error(`tick harness: ${what} carries undefined (Firestore rejects it) at ${bad.join(', ')}`);
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Firestore update() semantics over the store: dotted keys are field paths; sentinels are recorded, not applied. */
function applyUpdate(target, payload) {
  for (const [k, v] of Object.entries(payload)) {
    if (isFieldValue(v)) continue;
    setPath(target, k, deepClone(v));
  }
}

/**
 * The db double the cron sees. Collections it touches on the full-Haiku path:
 *   agentBattles/{id}                 get (lock txn, regime txn, refreshBattleFromDoc) · update
 *   indexIntelligence/stockRankings   get
 *   indexIntelligence/{marketContext,SPY}  via db.getAll (absent by default → 'selective' posture)
 *   stockTechnicalScores/{sym}        via db.getAll
 *   fantasyTimesStories               where().where().orderBy().limit().get() → no stories
 *
 * @returns db with `__store` (the persisted docs — mutate `__store.battle` to
 *   simulate a write that lands mid-tick), `__updates` (every update payload,
 *   in order) and `__counts`.
 */
export function makeTickDb({ battle, rankingsDoc = null, techDocs = {}, marketContext = null, spyDoc = null }) {
  const store = { battle: deepClone(battle), rankingsDoc, techDocs, marketContext, spyDoc };
  const updates = [];
  const counts = { battleDocGets: 0, rankingsGets: 0, newsQueries: 0 };

  const snapOf = (id, data) => ({
    exists: data != null,
    id,
    data: () => (data == null ? undefined : deepClone(data)),
  });

  const makeRef = (col, id) => ({
    id,
    path: `${col}/${id}`,
    async get() {
      if (col === 'agentBattles') { counts.battleDocGets++; return snapOf(id, store.battle); }
      if (col === 'indexIntelligence' && id === 'stockRankings') { counts.rankingsGets++; return snapOf(id, store.rankingsDoc); }
      if (col === 'indexIntelligence' && id === 'marketContext') return snapOf(id, store.marketContext);
      if (col === 'indexIntelligence' && id === 'SPY') return snapOf(id, store.spyDoc);
      if (col === 'stockTechnicalScores') return snapOf(id, store.techDocs[id] ?? null);
      return snapOf(id, null);
    },
    async update(payload) {
      if (col !== 'agentBattles') throw new Error(`tick harness: unexpected update on ${col}/${id}`);
      assertWritable(payload, `update(${col}/${id})`);
      updates.push(deepClone(payload));
      applyUpdate(store.battle, payload);
    },
  });

  const emptyQuery = {
    where: () => emptyQuery,
    orderBy: () => emptyQuery,
    limit: () => emptyQuery,
    async get() { counts.newsQueries++; return { docs: [], empty: true, size: 0 }; },
  };

  const db = {
    collection(col) {
      return {
        doc: (id) => makeRef(col, id),
        where: () => emptyQuery,
        orderBy: () => emptyQuery,
        limit: () => emptyQuery,
        get: async () => ({ docs: [], empty: true, size: 0 }),
      };
    },
    async getAll(...refs) {
      return Promise.all(refs.map((r) => r.get()));
    },
    async runTransaction(cb) {
      return cb({
        get: (ref) => ref.get(),
        update: (ref, payload) => {
          assertWritable(payload, `transaction.update(${ref.path})`);
          updates.push(deepClone(payload));
          applyUpdate(store.battle, payload);
        },
      });
    },
    __store: store,
    __updates: updates,
    __counts: counts,
  };
  return db;
}

// ---------------------------------------------------------------------------
// The Firestore storage-size rule (the discovery §3 method): string = UTF-8
// bytes + 1; number 8; boolean / null 1; array = Σ elements; map = Σ (field
// name bytes + 1 + value). Used by the size rows only. UTF-8 lengths via
// TextEncoder (a browser + Node global — the repo's ESLint globals are the
// browser set, so no `Buffer`).
const utf8Bytes = (s) => new TextEncoder().encode(s).length;
export function firestoreBytes(v) {
  if (v === null || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return utf8Bytes(v) + 1;
  if (Array.isArray(v)) return v.reduce((sum, x) => sum + firestoreBytes(x), 0);
  if (typeof v === 'object') {
    return Object.entries(v).reduce((sum, [k, x]) => sum + utf8Bytes(k) + 1 + firestoreBytes(x), 0);
  }
  throw new Error(`firestoreBytes: unsupported value type ${typeof v}`);
}

/** UTF-8 byte length of a serialized value (for the JSON column of the size rows). */
export function jsonBytes(v) {
  return utf8Bytes(JSON.stringify(v));
}

/** Every path at which a value is `undefined` (Firestore rejects it) — [] when clean. */
export function undefinedPaths(v, prefix = '') {
  const out = [];
  if (v === undefined) return [prefix || '<root>'];
  if (Array.isArray(v)) v.forEach((x, i) => out.push(...undefinedPaths(x, `${prefix}[${i}]`)));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) out.push(...undefinedPaths(x, prefix ? `${prefix}.${k}` : k));
  return out;
}
