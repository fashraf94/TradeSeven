// api/agent/research.test.js
//
// POST /api/agent/research — Phase C §2 (D-116 → D-122).
//
// The ordered pipeline, each check falsifiable: the flag, auth, the body, the
// owner, the battle's state, the agent's binding, the universe, the cap, the two
// data reads, the code-composed card, the one transaction. No model call reaches
// anything, no message is charged, and the persisted exchange carries NO
// grounding marker (D-121).
//
// The fake Firestore is file-directive.test.js's: `runTransaction` runs the
// body, buffers its writes, and — when a test injects a competing write between
// the read and the commit — discards the buffer and RE-RUNS the body against the
// changed doc, the way the real client retries on contention. §4's race battery
// builds on the same harness.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  showIt: true,
  uid: 'owner-1',
  battle: null,
  marketData: null,
  marketThrows: false,
  marketCalls: [],
  cacheDoc: null,
  rankingsDoc: null,
  gemmaCalls: [],
  anthropicCalls: [],
  reads: 0,
  attempts: 0,
  committed: [],
  injectBeforeCommit: null,
}));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    return { uid: state.uid };
  },
}));
// The flag is settable per row; everything else in the module is the real thing.
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SHOW_IT_ENABLED() { return state.showIt; },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: async (symbol, opts) => {
    state.marketCalls.push({ symbol, opts });
    if (state.marketThrows) throw new Error('EODHD down');
    return state.marketData;
  },
}));
// The route imports no model client; these spies prove no call reaches one
// through any path either (§2: NO MODEL CALL).
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: async (o) => { state.gemmaCalls.push(o); return '{}'; },
  callGemmaVoiceWithRetry: async (o) => { state.gemmaCalls.push(o); return { success: true, content: '{}' }; },
  parseVoiceLayerResponse: (c) => JSON.parse(c),
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { constructor() { state.anthropicCalls.push('constructed'); } },
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }) },
}));

function docSnap(data, id) { return { exists: data != null, id, data: () => (data == null ? undefined : { ...data }) }; }
function readDoc(col, id) {
  state.reads += 1;
  if (col === 'agentBattles') return docSnap(state.battle && state.battle.__id === id ? state.battle : null, id);
  if (col === 'voiceLayerCache') return docSnap(state.cacheDoc, id);
  if (col === 'indexIntelligence') return docSnap(state.rankingsDoc, id);
  return docSnap(null, id);
}
function applyWrite(w) {
  if (w.col !== 'agentBattles') return;
  const b = state.battle;
  for (const [k, v] of Object.entries(w.data)) {
    if (v && v.__op === 'arrayUnion') b[k] = [...(b[k] || []), ...v.items];
    else b[k] = v;
  }
}
const db = {
  collection: (col) => ({ doc: (id) => ({ __col: col, __id: id, get: async () => readDoc(col, id) }) }),
  runTransaction: async (fn) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      state.attempts += 1;
      const buffer = [];
      const tx = {
        get: async (ref) => {
          if (buffer.length > 0) throw new Error('transaction read after write');
          return readDoc(ref.__col, ref.__id);
        },
        update: (ref, data) => buffer.push({ col: ref.__col, id: ref.__id, data, op: 'update' }),
        set: (ref, data) => buffer.push({ col: ref.__col, id: ref.__id, data, op: 'set' }),
      };
      const result = await fn(tx);
      if (state.injectBeforeCommit && attempt === 1) {
        state.injectBeforeCommit();
        state.injectBeforeCommit = null;
        continue;
      }
      for (const w of buffer) { applyWrite(w); state.committed.push(w); }
      return result;
    }
    throw new Error('transaction contention exhausted');
  },
};
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => db }));

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module
// under test is the runtime guard that its api → src imports stay Node-clean.
// Never mock it.
const { default: handler, RESEARCH_STATUS, buildResearchExchange } = await import('./research.js');
const { RESEARCH_CAP } = await import('../../src/data/researchCap.js');

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const post = async (body, method = 'POST') => { const res = mkRes(); await handler({ method, body }, res); return res; };
const BODY = { agentId: 'agent-1', battleId: 'battle-1', symbol: 'MPC' };

const DAILY = Array.from({ length: 21 }, (_, i) => ({
  date: `2026-09-${String(8 - (i % 8)).padStart(2, '0')}`,
  close: 150 + i, high: 152 + i, low: 148 + i, volume: 7e6,
}));

function makeBattle(over = {}) {
  return {
    __id: 'battle-1',
    ownerId: 'owner-1',
    agentId: 'agent-1',
    status: 'active',
    gameMode: 'baggerbomb_agent',
    activatedAt: '2026-09-08T13:30:00.000Z',
    portfolio: {
      star: [{ symbol: 'NVDA', swapPrice: 141.02, swappedInAt: '2026-09-08T15:15:00.000Z' }],
      core: [], support: [],
      bench: { stocks: [{ symbol: 'MPC' }] },
    },
    watchlist: { hotBench: ['RKLB'] },
    chatExchanges: [],
    chatBudgetUsed: 2,
    ...over,
  };
}
const research = (n = 1) => Array.from({ length: n }, () => ({ messageType: 'research', symbol: 'X' }));
const battleWrites = () => state.committed.filter((w) => w.col === 'agentBattles');
const writtenExchanges = () => state.battle.chatExchanges.filter((e) => e.messageType === 'research');

beforeEach(() => {
  state.showIt = true;
  state.uid = 'owner-1';
  state.battle = makeBattle();
  state.marketData = { daily: DAILY };
  state.marketThrows = false;
  state.marketCalls = [];
  state.cacheDoc = {
    updatedAt: '2026-09-11T20:00:00.000Z',
    portfolioBriefs: [{ symbol: 'NVDA', price: 141.9, fundamentals: { trailingPE: { value: 40 }, computedAt: Date.UTC(2026, 8, 5) } }],
    benchBriefs: [{ symbol: 'MPC', price: 151.27, fundamentals: { trailingPE: { value: 14.2, sectorMedian: 19.6 }, computedAt: Date.UTC(2026, 8, 5) } }],
  };
  state.rankingsDoc = { stocks: [{ symbol: 'RKLB', fundamentals: { revenueGrowthPct: 31.2, computedAt: Date.UTC(2026, 8, 5) } }] };
  state.gemmaCalls = [];
  state.anthropicCalls = [];
  state.reads = 0;
  state.attempts = 0;
  state.committed = [];
  state.injectBeforeCommit = null;
});

describe('the gate, in order', () => {
  it('404s while the flag is dark — before any read, before auth’s uid is used', async () => {
    state.showIt = false;
    const res = await post(BODY);
    expect(res.statusCode).toBe(404);
    expect(state.reads).toBe(0);
    expect(state.attempts).toBe(0);
  });

  it('405s a GET', async () => {
    expect((await post(BODY, 'GET')).statusCode).toBe(405);
  });

  it('401s without a caller', async () => {
    state.uid = null;
    expect((await post(BODY)).statusCode).toBe(401);
    expect(state.reads).toBe(0);
  });

  it('400s on a missing or blank field, never reading a document', async () => {
    for (const body of [{}, { agentId: 'a' }, { ...BODY, symbol: '   ' }, { ...BODY, battleId: '' }]) {
      const res = await post(body);
      expect(res.statusCode).toBe(400);
    }
    expect(state.reads).toBe(0);
  });

  it('404s an absent battle, 403s a caller who is not the owner', async () => {
    state.battle = null;
    expect((await post(BODY)).statusCode).toBe(404);
    state.battle = makeBattle();
    state.uid = 'someone-else';
    expect((await post(BODY)).statusCode).toBe(403);
    expect(state.attempts).toBe(0);
  });

  it('409s a battle that is not active, 403s an agent that is not this battle’s', async () => {
    state.battle = makeBattle({ status: 'completed' });
    expect((await post(BODY)).statusCode).toBe(409);
    state.battle = makeBattle();
    expect((await post({ ...BODY, agentId: 'other-agent' })).statusCode).toBe(403);
  });

  it('404s a symbol outside the battle’s universe — never trusting the client’s name (hazard 6)', async () => {
    const res = await post({ ...BODY, symbol: 'TSLA' });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/TSLA is not in this battle/);
    expect(state.marketCalls).toEqual([]);   // no external call for a name we refuse
    expect(state.attempts).toBe(0);
  });

  it('accepts any casing and persists the UNIVERSE’s spelling', async () => {
    const res = await post({ ...BODY, symbol: 'mpc' });
    expect(res.statusCode).toBe(200);
    expect(res.body.card.symbol).toBe('MPC');
    expect(writtenExchanges()[0].symbol).toBe('MPC');
  });
});

describe('the cap', () => {
  it('pre-check: a fourth tap is refused BEFORE the external call is spent', async () => {
    state.battle = makeBattle({ chatExchanges: research(RESEARCH_CAP) });
    const res = await post(BODY);
    expect(res.statusCode).toBe(409);
    expect(res.body.status).toBe(RESEARCH_STATUS.EXHAUSTED);
    expect(res.body.remaining).toBe(0);
    expect(state.marketCalls).toEqual([]);
    expect(state.attempts).toBe(0);
  });

  it('the third tap is allowed and the response’s counts are the ones the client reconciles to', async () => {
    state.battle = makeBattle({ chatExchanges: research(2) });
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: RESEARCH_STATUS.SHOWN, used: 3, remaining: 0, cap: 3 });
  });

  it('counts ONLY research exchanges — a conversation does not spend a read', async () => {
    state.battle = makeBattle({
      chatExchanges: [
        { messageType: 'user_initiated', userMessage: 'hi' },
        { messageType: 'directive_filed' },
        { messageType: 'anticipation' },
      ],
    });
    const res = await post(BODY);
    expect(res.body.used).toBe(1);
  });
});

describe('the data reads', () => {
  it('asks for the DAILY SERIES ONLY — the price field is uncached EODHD (hazard 2, review A-7b)', async () => {
    await post(BODY);
    expect(state.marketCalls).toEqual([{ symbol: 'MPC', opts: { fields: ['daily'] } }]);
    // Spec §6: "no EODHD call unless the cache is cold". Requesting `price`
    // made that false on every single tap.
    expect(JSON.stringify(state.marketCalls)).not.toMatch(/price/);
  });

  it('takes the QUOTE from the cache brief, at the cache doc’s vintage', async () => {
    const res = await post(BODY);
    expect(res.body.card.technicals.facts).toContain('Last $151.27');
    expect(res.body.card.technicals.label).toMatch(/last quote \w{3} \d{1,2}:\d{2} [AP]M ET/);
  });

  it('falls back to the newest daily CLOSE, said to be a close, when the battle has no brief for the name', async () => {
    state.cacheDoc = null;
    const res = await post(BODY);
    expect(res.body.card.technicals.facts.join(' ')).toMatch(/· daily close/);
    expect(res.body.card.technicals.label).not.toMatch(/last quote/);
  });

  it('takes the fundamentals off the cache brief and never calls the screener', async () => {
    const res = await post(BODY);
    expect(res.body.card.fundamentals.facts).toContain('P/E 14.2 · sector median 19.6');
  });

  it('falls through to the rankings mirror for a hot-bench name with no brief (hazard 15)', async () => {
    const res = await post({ ...BODY, symbol: 'RKLB' });
    expect(res.statusCode).toBe(200);
    expect(res.body.card.fundamentals.facts).toContain('Revenue growth 31.2%');
  });

  it('says nothing rather than guessing when neither source holds the name', async () => {
    state.cacheDoc = null;
    state.rankingsDoc = { stocks: [] };
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.card.fundamentals).toBeNull();
  });

  it('still writes a card when the market data path fails outright — with the CACHED quote and no indicators', async () => {
    state.marketThrows = true;
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    // No indicators (the daily series never arrived) but the cache's own dated
    // quote is still a true thing to show, and it says when it is from.
    expect(res.body.card.technicals.facts).toEqual(['Last $151.27']);
    expect(res.body.card.technicals.label).toMatch(/last quote/);
    expect(res.body.card.technicals.label).not.toMatch(/daily indicators/);
    expect(res.body.card.standing.line).toBe('On the bench');
  });

  it('has NO technicals section at all when neither the series nor a cached quote exists', async () => {
    state.marketThrows = true;
    state.cacheDoc = null;
    const res = await post(BODY);
    expect(res.statusCode).toBe(200);
    expect(res.body.card.technicals).toBeNull();
  });
});

describe('the card and the exchange', () => {
  it('carries NO grounding marker — not 1, not 0 (D-121, Sol C-1)', async () => {
    await post(BODY);
    const ex = writtenExchanges()[0];
    expect(Object.prototype.hasOwnProperty.call(ex, 'groundingVersion')).toBe(false);
    expect(ex.groundingVersion).toBeUndefined();
  });

  it('carries no userMessage, no narrator words and no suggestedActions (hazard 4)', async () => {
    await post(BODY);
    const ex = writtenExchanges()[0];
    expect(ex.userMessage).toBeUndefined();
    expect(ex.agentResponse).toBe('');
    expect(ex.suggestedActions).toBeNull();
    expect(ex.messageType).toBe('research');
  });

  it('the response’s card IS the persisted card — one object, not two compositions', async () => {
    const res = await post(BODY);
    expect(res.body.card).toEqual(writtenExchanges()[0].card);
  });

  it('carries the platform-data label with the card itself (Sol C-4)', async () => {
    const res = await post(BODY);
    expect(res.body.card.platformDataLabel).toBe('Platform data · not what the check saw');
  });

  it('renders the standing from the position’s REAL persisted fields (review A-2)', async () => {
    const res = await post({ ...BODY, symbol: 'NVDA' });
    expect(res.body.card.standing.place).toBe('book');
    expect(res.body.card.standing.facts).toEqual(expect.arrayContaining(['star', 'Entry $141.02']));
    expect(res.body.card.standing.provenance).toBe('From the record · the board’s own numbers');
  });

  it('an ORIGINAL position takes the battle’s starting price, not nothing (review A-2)', async () => {
    state.battle = makeBattle({
      portfolio: {
        star: [{ symbol: 'NVDA' }], core: [], support: [],
        bench: { stocks: [{ symbol: 'MPC' }] },
        startingPrices: { NVDA: 118.44 },
      },
    });
    const res = await post({ ...BODY, symbol: 'NVDA' });
    expect(res.body.card.standing.facts).toContain('Entry $118.44');
  });

  it('omits MACD and SMA50 on the shipped short window rather than printing a default (hazard 1)', async () => {
    const res = await post(BODY);
    const joined = (res.body.card.technicals?.facts || []).join(' | ');
    expect(joined).toMatch(/RSI /);
    expect(joined).not.toMatch(/MACD|SMA50|N\/A/);
  });
});

describe('what the route never does', () => {
  it('calls no model, on any path', async () => {
    await post(BODY);
    await post({ ...BODY, symbol: 'NVDA' });
    expect(state.gemmaCalls).toEqual([]);
    expect(state.anthropicCalls).toEqual([]);
  });

  it('charges no message and touches no budget key (D-118)', async () => {
    const before = state.battle.chatBudgetUsed;
    await post(BODY);
    expect(state.battle.chatBudgetUsed).toBe(before);
    for (const w of battleWrites()) {
      expect(Object.keys(w.data)).toEqual(['chatExchanges']);
    }
  });

  it('writes to no collection but the battle doc', async () => {
    await post(BODY);
    expect(state.committed.every((w) => w.col === 'agentBattles')).toBe(true);
  });
});

describe('buildResearchExchange — the shape, directly', () => {
  it('is the persisted contract, with a fixed instant', () => {
    const ex = buildResearchExchange({
      card: { symbol: 'MPC' }, symbol: 'MPC', agentId: 'agent-1', now: new Date('2026-09-09T14:00:00.000Z'),
    });
    expect(ex).toEqual({
      messageType: 'research',
      researchId: expect.any(String),
      symbol: 'MPC',
      agentId: 'agent-1',
      card: { symbol: 'MPC' },
      agentResponse: '',
      suggestedActions: null,
      timestamp: '2026-09-09T14:00:00.000Z',
    });
  });

  it('CO-1: two exchanges for the SAME symbol at the SAME instant are NOT deep-equal', () => {
    // arrayUnion drops an element it considers already present. Without the id
    // these two would be one array element, and the route would report a slot
    // spent that the doc does not hold.
    const args = { card: { symbol: 'MPC' }, symbol: 'MPC', agentId: 'agent-1', now: new Date('2026-09-09T14:00:00.000Z') };
    const a = buildResearchExchange(args);
    const b = buildResearchExchange(args);
    expect(a).not.toEqual(b);
    expect(a.researchId).not.toBe(b.researchId);
    expect(a.researchId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
