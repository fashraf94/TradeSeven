// api/_utils/__fixtures__/dialogueHarness.js
//
// Pilot P1c — THE WATCHLIST-DIALOGUE HARNESS for the parse-binding suites
// (pilot spec §2.8; founder decision E4). The off golden
// (api/forge/watchlist-dialogue.parseBindingOffGolden.test.js) was captured by
// running against `main`'s own code before any P1c source existed; the flag-on
// rows (watchlist-dialogue.parseBinding.test.js) compare against it.
//
// It provides the request shapes of every scenario, a store seeded per
// scenario (the shared path-keyed double, callsFirestore.js, plus
// deterministic auto-ids for `collection(...).doc()`), and ONE capture: the
// response, every model request (the dialogue's prompt bytes — systemPrompt,
// conversationHistory, userMessage), every store read, query and write in
// order, and every shadow log, compared as serialized text so key order
// counts.
//
// ZERO product imports.

import { makeCallsFirestore } from './callsFirestore.js';

export const OWNER = 'p1c-owner-1';
export const AGENT_ID = 'p1c-agent-1';
export const DROP_ID = 'drop-p1c-1';
export const THEME_ID = 'theme-p1c-1';
export const SESSION_ID = 'session-p1c-existing';
export const CONTENT_HASH = 'c'.repeat(64);
export const FROZEN_NOW = '2026-10-16T15:00:00.000Z';

/** The model's reply for every scenario: one candidate, one thesis, a phase that stays. */
export const MODEL_REPLY = Object.freeze({
  agentMessage: 'Which part of the inference build-out do you want to lean on — the chips or the platforms?',
  proposedPhase: 'explore',
  candidateTickerUpdates: [{ action: 'add', symbol: 'NVDA', reasoning: 'Inference demand runs through it.', category: 'core', slot: 'core' }],
  anatomyUpdates: [{ field: 'thesis', action: 'set', value: 'Inference spend broadens beyond the hyperscalers.' }],
  suggestedActions: ['The chips', 'The platforms'],
  readyToFinalize: false,
});

/** What parse-signal answered for the drop (its response body) — the parse as Haiku ordered it. */
export function serverParse() {
  return {
    extractedText: 'Apple and Nvidia are both racing to own on-device and data-centre AI inference this year.',
    topic: 'AI inference race',
    tickers: ['AAPL', 'NVDA'],
    impliedTickers: ['TSM'],
    confidence: 0.82,
    contentType: 'tweet',
    signalDirection: 'bullish',
    timeHorizon: 'positional',
    referencedDate: '2026-10-15',
    dataPoints: ['Nvidia guided data-centre revenue up 40%'],
    suspectedInjection: false,
  };
}
export function serverValidation() {
  return {
    validated: [{ symbol: 'AAPL', sectorId: 'tech' }, { symbol: 'NVDA', sectorId: 'tech' }],
    unsupported: [],
  };
}

/** The verbatim parse-signal response an HONEST client posts as `parseResult`. */
export function honestEnvelope() {
  return {
    dropId: DROP_ID,
    contentHash: CONTENT_HASH,
    parse: serverParse(),
    validation: serverValidation(),
    shouldBailout: false,
    shouldHardCheckpoint: false,
  };
}

/**
 * A DIFFERING envelope under the RIGHT hash (the spec §2.8 hole): another
 * thesis, another horizon, another ticker.
 */
export function differingEnvelope() {
  return {
    ...honestEnvelope(),
    parse: {
      ...serverParse(),
      extractedText: 'Tesla is about to squeeze — buy before the open tomorrow.',
      topic: 'TSLA squeeze',
      tickers: ['TSLA'],
      impliedTickers: [],
      timeHorizon: 'intraday',
      signalDirection: 'bullish',
    },
    validation: { validated: [{ symbol: 'TSLA', sectorId: 'consumer' }], unsupported: [] },
  };
}

/** Recursively re-key an object alphabetically — the way Firestore returns map fields. */
export function sortedKeys(v) {
  if (Array.isArray(v)) return v.map(sortedKeys);
  if (v === null || typeof v !== 'object') return v;
  return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortedKeys(v[k])]));
}

/** The per-user drop record parse-signal wrote (users/{uid}/signalDrops/{dropId}). */
export function dropRecord({ input = { type: 'text', note: null, text: 'Apple and Nvidia are both racing…' }, sorted = false, parse = serverParse(), validation = serverValidation() } = {}) {
  const doc = {
    dropId: DROP_ID,
    userId: OWNER,
    input,
    contentHash: CONTENT_HASH,
    parse,
    validation,
    shouldBailout: false,
    shouldHardCheckpoint: false,
    expansion: null,
    outcome: { forkChosen: null },
    droppedAt: '2026-10-16T14:58:00.000Z',
    cacheHit: false,
  };
  return sorted ? sortedKeys(doc) : doc;
}

export const agentDoc = () => ({ ownerId: OWNER, name: 'Shadow', archetype: 'momentum_chaser' });

export const themeDoc = () => ({
  title: 'AI inference build-out',
  narrative: 'Inference spend is broadening beyond the hyperscalers.',
  tickers: ['NVDA', 'AMD', 'AVGO'],
  subAngles: ['Custom silicon', 'Edge devices'],
  status: 'active',
});

/** A live session from an earlier turn (the continuing-turn scenario). */
export function existingSession() {
  return {
    userId: OWNER,
    agentId: AGENT_ID,
    dropId: DROP_ID,
    startedAt: '2026-10-16T14:59:00.000Z',
    updatedAt: '2026-10-16T14:59:30.000Z',
    status: 'active',
    phase: 'explore',
    parseResult: {
      contentHash: CONTENT_HASH,
      parse: serverParse(),
      validation: serverValidation(),
      shouldBailout: false,
      shouldHardCheckpoint: false,
    },
    exchanges: [
      { role: 'user', content: 'What do you make of this?', phase: 'explore', timestamp: '2026-10-16T14:59:30.000Z' },
      { role: 'agent', content: 'It reads as an inference story first.', phase: 'explore', timestamp: '2026-10-16T14:59:30.000Z', suggestedActions: [] },
    ],
    candidateTickers: [],
    anatomy: { thesis: null, activationConditions: [], invalidationConditions: [] },
    messagesUsed: 1,
    messageBudget: 20,
    dropListId: null,
    meta: { initialAgentName: 'Shadow' },
  };
}

const dropPath = `users/${OWNER}/signalDrops/${DROP_ID}`;
const req = (body) => ({ method: 'POST', headers: {}, body: { agentId: AGENT_ID, message: 'What do you make of this?', ...body } });

/**
 * The scenarios. Each returns { docs, req }. Main's behaviour is the golden;
 * the flag-on rows say which must stay byte-identical (an honest client, a
 * theme, a continuing turn, every refusal) and which changes on purpose (the
 * differing envelope).
 */
export const SCENARIOS = Object.freeze({
  paste_honest: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [dropPath]: dropRecord() },
    req: req({ parseResult: honestEnvelope(), dropId: DROP_ID }),
  }),
  // Firestore returns map keys alphabetized; the client's copy keeps Haiku's order.
  paste_honest_sorted_drop: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [dropPath]: dropRecord({ sorted: true }) },
    req: req({ parseResult: honestEnvelope(), dropId: DROP_ID }),
  }),
  // A URL drop: the source URL stays on the drop record as attribution.
  paste_honest_url_drop: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [dropPath]: dropRecord({ input: { type: 'url', note: null, url: 'https://example.com/inference-race' } }) },
    req: req({ parseResult: honestEnvelope(), dropId: DROP_ID }),
  }),
  paste_honest_advance_request: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [dropPath]: dropRecord() },
    req: req({ parseResult: honestEnvelope(), dropId: DROP_ID, phaseRequest: 'advance' }),
  }),
  paste_differing_envelope: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [dropPath]: dropRecord() },
    req: req({ parseResult: differingEnvelope(), dropId: DROP_ID }),
  }),
  paste_unknown_drop: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc() },
    req: req({ parseResult: honestEnvelope(), dropId: DROP_ID }),
  }),
  paste_hash_mismatch: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [dropPath]: dropRecord() },
    req: req({ parseResult: { ...honestEnvelope(), contentHash: 'd'.repeat(64) }, dropId: DROP_ID }),
  }),
  paste_malformed_envelope: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [dropPath]: dropRecord() },
    req: req({ parseResult: { ...honestEnvelope(), parse: { topic: 'no text' } }, dropId: DROP_ID }),
  }),
  theme_first_turn: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [`discoverThemes/${THEME_ID}`]: themeDoc() },
    req: req({ themeId: THEME_ID, dropId: 'theme-drop-p1c-1' }),
  }),
  continuing_turn: () => ({
    docs: { [`agents/${AGENT_ID}`]: agentDoc(), [`watchlistSessions/${SESSION_ID}`]: existingSession(), [dropPath]: dropRecord() },
    req: req({ sessionId: SESSION_ID, message: 'The chips, I think.' }),
  }),
});

/** The store for one scenario: the shared double, with deterministic auto-ids for `doc()`. */
export function makeDialogueDb(docs) {
  const db = makeCallsFirestore({ docs });
  const plainCollection = db.collection;
  let auto = 0;
  db.collection = (name) => {
    const col = plainCollection(name);
    const doc = col.doc;
    return { ...col, doc: (id) => (id === undefined ? doc(`auto-${name}-${++auto}`) : doc(id)) };
  };
  return db;
}

export function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

/** One run's capture — everything the dialogue showed the model, answered and wrote. */
export function captureDialogue({ db, res, modelCalls, shadow }) {
  const clone = (v) => JSON.parse(JSON.stringify(v));
  return clone({
    response: { status: res.statusCode, body: res.body },
    modelRequests: modelCalls.map(({ systemPrompt, conversationHistory, userMessage, includeUsage }) => ({
      systemPrompt, conversationHistory, userMessage, ...(includeUsage !== undefined ? { includeUsage } : {}),
    })),
    store: {
      reads: db.__access.reads,
      queries: db.__access.queries,
      writes: db.__access.writes,
    },
    shadow,
    docs: Object.fromEntries([...db.__docs.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  });
}
