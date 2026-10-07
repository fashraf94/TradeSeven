// api/_utils/__fixtures__/researchHostHarness.js
//
// Pilot P2 — a shared harness for the research hosts' route suites (the
// screener chat, the watchlist dialogue and its abandon route, the analysis
// sessions, the watchlist create and save paths): the general optimistic
// Firestore double (callsFirestore.js) with per-collection auto ids, a
// request/response pair, and fixtures every host accepts.
//
// It imports ONLY modules that exist on `main` before the P2 build, so the
// gate-off golden suite (api/forge/researchRecords.gateOff.test.js) can be run
// unchanged against main's own code — that is how its goldens are proven.

import { makeCallsFirestore } from './callsFirestore.js';

export const OWNER = 'owner-1';
export const OTHER = 'owner-2';
export const NOW = '2026-10-07T14:00:00.000Z';
export const ALLOWLIST_ENV = 'COCKPIT_ALLOWLIST_UIDS';

/** The double, with `collection(name).doc()` minting `<name>-auto-<n>` per collection (deterministic). */
export function makeHostDb(docs = {}) {
  const db = makeCallsFirestore({ docs });
  const collection = db.collection;
  const counters = {};
  db.collection = (name) => {
    const c = collection(name);
    return { ...c, doc: (id) => c.doc(id ?? `${name}-auto-${(counters[name] = (counters[name] || 0) + 1)}`) };
  };
  return db;
}

export function makeRes() {
  const out = { statusCode: null, body: null };
  out.status = (code) => { out.statusCode = code; return out; };
  out.json = (payload) => { out.body = payload; return out; };
  out.setHeader = () => out;
  return out;
}

export async function call(handler, { method = 'POST', body = {}, query = {} } = {}) {
  const res = makeRes();
  await handler({ method, headers: {}, query, body }, res);
  return res;
}

// ── fixtures ────────────────────────────────────────────────────────────────

const stock = (symbol, compositeScore, extra = {}) => ({
  symbol, sectorName: 'Technology', industryName: 'Semiconductors', compositeScore, baggerBombFit: compositeScore - 10,
  momentumScore: compositeScore - 20, technicalScore: compositeScore - 5, return1W: 1, return1M: compositeScore / 10, return3M: compositeScore / 5,
  returnYTD: 12, return12M: 30, sma200_position: compositeScore - 50, atrPercentile: 40, nr7Flag: false, ...extra,
});
/** A six-stock universe: four pass `compositeScore >= 60`. */
export const STOCKS = Object.freeze([
  stock('NVDA', 95), stock('AMD', 85), stock('AVGO', 75), stock('MU', 65), stock('INTC', 45), stock('QCOM', 55),
]);
export const rankingsDoc = () => ({ stocks: STOCKS.map((s) => ({ ...s })), updatedAt: '2026-10-07T12:00:00.000Z', mode: 'baggerbomb', industries: {} });

export const AGENT_ID = 'agent-1';
export const agentDoc = () => ({ ownerId: OWNER, name: 'Astra', archetype: 'trend_follower' });

export const DROP_ID = 'drop-1';
export const CONTENT_HASH = 'c'.repeat(64);
export const parseResult = (timeHorizon = 'swing') => ({
  contentHash: CONTENT_HASH,
  parse: {
    extractedText: 'AI capex keeps rising and the chip names are the picks and shovels.',
    topic: 'AI capex', tickers: ['NVDA'], impliedTickers: ['AMD'], confidence: 0.8,
    contentType: 'casual_text', signalDirection: 'bullish', timeHorizon, referencedDate: '', dataPoints: [], suspectedInjection: false,
  },
  validation: { validated: [{ symbol: 'NVDA' }], unsupported: [] },
  shouldBailout: false,
  shouldHardCheckpoint: false,
});
export const signalDropDoc = (timeHorizon = 'swing') => ({ dropId: DROP_ID, userId: OWNER, contentHash: CONTENT_HASH, parse: parseResult(timeHorizon).parse });

/** The screener model's answer: a spec the real screenStocks runs (three of the four matches returned). */
export const screenReply = (over = {}) => JSON.stringify({
  message: 'Here are the strongest names.',
  readyToScreen: true,
  screenSpec: { filters: [{ field: 'compositeScore', op: 'gte', value: 60 }], rankBy: { field: 'compositeScore', direction: 'desc' }, limit: 3 },
  suggestedActions: ['Narrow it down'],
  ...over,
});

/** The dialogue model's answer: two proposals and a thesis. */
export const dialogueReply = (over = {}) => JSON.stringify({
  agentMessage: 'Two names fit the idea.',
  proposedPhase: 'explore',
  candidateTickerUpdates: [
    { action: 'propose', symbol: 'NVDA', reasoning: 'AI capex', category: 'semis', slot: 'core' },
    { action: 'propose', symbol: 'AMD', reasoning: 'second source', category: 'semis', slot: 'discovery' },
  ],
  anatomyUpdates: [{ field: 'thesis', action: 'set', value: 'AI capex keeps rising' }],
  suggestedActions: [{ label: 'Keep going', intent: 'none' }],
  readyToFinalize: false,
  ...over,
});

export const analysisReply = () => JSON.stringify({ message: 'They share semiconductor exposure.', suggestedActions: ['What else?'] });

/** A dialogue session as the dialogue route stores it (continuing turns, abandon, save). */
export const dialogueSession = (over = {}) => ({
  userId: OWNER, agentId: AGENT_ID, dropId: DROP_ID, startedAt: NOW, updatedAt: NOW, status: 'active', phase: 'explore',
  parseResult: parseResult('swing'), exchanges: [
    { role: 'user', content: 'Thoughts?', phase: 'explore', timestamp: NOW },
    { role: 'agent', content: 'Two names fit the idea.', phase: 'explore', timestamp: NOW, suggestedActions: [] },
  ],
  candidateTickers: [
    { symbol: 'NVDA', reasoning: 'AI capex', category: 'semis', slot: 'core', status: 'kept', proposedAt: NOW, proposedAtPhase: 'explore' },
    { symbol: 'AMD', reasoning: 'second source', category: 'semis', slot: 'discovery', status: 'proposed', proposedAt: NOW, proposedAtPhase: 'explore' },
    { symbol: 'INTC', reasoning: 'turnaround', category: 'semis', slot: 'cross_current', status: 'removed', proposedAt: NOW, proposedAtPhase: 'explore' },
  ],
  anatomy: { thesis: 'AI capex keeps rising', activationConditions: [], invalidationConditions: [] },
  messagesUsed: 1, messageBudget: 20, dropListId: null, meta: { initialAgentName: 'Astra' },
  ...over,
});

/** A screener session as the screener route stores it. */
export const screenerSession = (over = {}) => ({
  userId: OWNER, createdAt: NOW, updatedAt: NOW, messagesUsed: 1, messageBudget: 30,
  exchanges: [{ userMessage: 'strong chips', message: 'Here are the strongest names.', appliedSpec: { filters: [] }, matchCount: 4, timestamp: NOW }],
  latestSpec: { filters: [{ field: 'compositeScore', op: 'gte', value: 60 }], rankBy: { field: 'compositeScore', direction: 'desc' }, limit: 3 },
  status: 'active',
  ...over,
});

/** A saved list (the analysis host's subject). */
export const savedList = (over = {}) => ({
  watchlistId: 'wl-1', userId: OWNER, agentId: null, sourceSessionId: null, sourceDropId: null, thesis: '', activationConditions: [], invalidationConditions: [],
  tickers: [{ symbol: 'NVDA' }, { symbol: 'AMD' }, { symbol: 'ZZZZ' }], name: 'Chips', notes: '', status: 'committed',
  createdAt: NOW, updatedAt: NOW, committedAt: NOW,
  ...over,
});

/** An analysis session as the analysis route stores it. */
export const analysisSession = (over = {}) => ({
  userId: OWNER, watchlistId: 'wl-1', createdAt: NOW, updatedAt: NOW, messagesUsed: 1, messageBudget: 30,
  exchanges: [{ userMessage: 'What do these share?', message: 'Semis.', tier2Included: false, tier3Included: false, timestamp: NOW }],
  status: 'active',
  ...over,
});
