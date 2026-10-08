// api/cron/agent-batch-review.playerFields.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part B — the daily review tolerates
// every shape an owner can store in the two owner-writable fields it reads:
// `battleLedger` (the day's debates) and `dailyGrades` (the day's grades).
// Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// Before this build a ledger that was not a list, a null entry, a non-string
// timestamp, or a grade list holding null threw inside processBattleReview,
// and the battle's review for the day was never written. Well-formed values
// render the review prompt byte for byte as before (pinned below).
//
// Dependency-surface guard (BUILD_RULES §4): the module under test is imported
// for real; only its outside calls (the model, the market data, the voice
// model, Firebase) are doubled.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const model = vi.hoisted(() => ({ calls: [] }));
const voice = vi.hoisted(() => ({ prompts: [] }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor() {
      this.messages = {
        create: async (args) => {
          model.calls.push(args);
          return { content: [{ type: 'tool_use', name: 'submit_batch_review', input: { selfGrade: 'B', lessonLearned: 'Lesson.', daySummary: 'Summary.' } }] };
        },
      };
    }
  },
}));
vi.mock('../_utils/marketDataCache.js', () => ({ getStockAnalysisData: vi.fn(async () => ({ price: { current: 100 } })) }));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: vi.fn(async () => '{"response":"Debrief."}'),
  parseVoiceLayerResponse: vi.fn(() => ({ response: 'Debrief.' })),
}));
vi.mock('../_utils/voiceLayerPrompt.js', async (importOriginal) => {
  const real = await importOriginal();
  // The REAL prompt builder, recorded: it must not throw on what the review hands it.
  return { ...real, buildVoiceLayerPrompt: (args) => { const out = real.buildVoiceLayerPrompt(args); voice.prompts.push({ args, out }); return out; } };
});
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (...v) => ({ __arrayUnion: v }), serverTimestamp: () => 'ts' } }));

const { processBattleReview, REVIEW_PLAYER_LINE_MAX } = await import('./agent-batch-review.js');

const TODAY = '2026-09-09';
const NOW = `${TODAY}T20:30:00.000Z`;

function makeDb(battle) {
  const writes = [];
  const agent = { name: 'Agent', archetype: 'analyst', agentContext: {} };
  const db = {
    collection: (col) => ({
      doc: (id) => ({
        get: async () => (col === 'agents' ? { exists: true, id, data: () => agent } : { exists: true, id, data: () => battle }),
        update: async (payload) => { writes.push({ col, id, payload }); },
        set: async (payload) => { writes.push({ col, id, payload }); },
      }),
    }),
  };
  return { db, writes };
}

const baseBattle = (over = {}) => ({
  id: 'battle-1', agentId: 'agent-1', ownerId: 'owner-1', status: 'active',
  timing: { tradingDays: [TODAY] },
  trades: [{ symbolOut: 'KO', symbolIn: 'AMD', tier: 'support', lockedGainPct: 1.2, lockedPoints: 2.5, trigger: 'risk', swapDay: 1 }],
  evaluations: [{ day: 1, decision: 'HOLD' }],
  proposalHistory: [], dailyReviews: [], statusFeed: [], chatExchanges: [],
  scoreState: { currentScore: 10, activeScore: 7.5, bankedScore: 2.5, bankedBadgePoints: { total: 0 } },
  agentContext: { agentName: 'Agent' },
  battleLedger: [], dailyGrades: {},
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  model.calls = [];
  voice.prompts = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

async function review(over) {
  const battle = baseBattle(over);
  const { db, writes } = makeDb(battle);
  const out = await processBattleReview(db, battle);
  const userMessage = model.calls.at(-1)?.messages?.[0]?.content ?? null;
  return { out, writes, userMessage };
}

const UNCONVERTIBLE = { toString: 1, valueOf: 2 };
const SHAPES = {
  null: null, number: 7, string: 'x', boolean: true, map: { a: { b: 1 } },
  'list of junk': [null, 7, 'x', ['y'], true],
  'array-like map': { length: 1, 0: { type: 'debate' } },
  huge: Array.from({ length: 20_000 }, (_, i) => ({ type: 'debate', timestamp: `${TODAY}T15:00:00.000Z`, targetSymbol: `S${i}`, userStance: 'agree', outcome: 'o'.repeat(50) })),
  'huge text': 'x'.repeat(300_000),
  'inherited names': { constructor: 'x', toString: 'y', [TODAY]: 'z' },
  'unconvertible object': UNCONVERTIBLE,
};

describe('battleLedger — every shape: the review is written', () => {
  for (const [label, value] of Object.entries(SHAPES)) {
    it(`battleLedger = ${label}`, async () => {
      const { out, writes } = await review({ battleLedger: value });
      expect(out?.status ?? 'reviewed').not.toBe('error');
      expect(writes.some((w) => Array.isArray(w.payload.dailyReviews))).toBe(true);
    });
  }

  it('entries with unconvertible fields and non-string timestamps render without throwing; the line count is capped', async () => {
    const entries = [
      { type: 'debate', timestamp: 7, targetSymbol: 'A' },
      { type: 'debate', timestamp: UNCONVERTIBLE, targetSymbol: 'B' },
      { type: 'debate', timestamp: `${TODAY}T15:00:00.000Z`, targetSymbol: UNCONVERTIBLE, userStance: ['a'], outcome: 'x'.repeat(5000) },
    ];
    const { userMessage } = await review({ battleLedger: entries });
    expect(userMessage).toContain('Debates: 1');
    expect(userMessage).toContain('- [object Object]: stance=a, outcome=' + 'x'.repeat(1000) + '\n');
    const many = await review({ battleLedger: SHAPES.huge });
    expect(many.userMessage).toContain('Debates: 20000');
    expect(many.userMessage.match(/stance=agree/g)).toHaveLength(REVIEW_PLAYER_LINE_MAX);
  });
});

describe('dailyGrades — every shape: the review is written and the debrief\'s REAL prompt builder never throws', () => {
  for (const [label, value] of Object.entries({ ...SHAPES, 'today\'s grades unconvertible': { [TODAY]: { trades: [null, { tradeIndex: UNCONVERTIBLE, grade: UNCONVERTIBLE, note: UNCONVERTIBLE, symbolOut: UNCONVERTIBLE }] } }, 'today not a map': { [TODAY]: 'x' }, 'trades not a list': { [TODAY]: { trades: 'x' } }, 'a grade list holding null': [null, { symbol: 'KO', grade: 'A' }] })) {
    it(`dailyGrades = ${label}`, async () => {
      const { out, writes } = await review({ dailyGrades: value });
      expect(out?.status ?? 'reviewed').not.toBe('error');
      expect(writes.some((w) => Array.isArray(w.payload.dailyReviews))).toBe(true);
      // The auto-debrief ran its real prompt build (and so wrote its exchange).
      expect(voice.prompts).toHaveLength(1);
      expect(writes.some((w) => w.payload.chatExchanges)).toBe(true);
    });
  }
});

describe('well-formed values: the review prompt is byte-identical to what it rendered before', () => {
  it('a debate and a graded trade render exactly the pre-build lines', async () => {
    const { userMessage } = await review({
      battleLedger: [{ type: 'debate', timestamp: `${TODAY}T15:00:00.000Z`, targetSymbol: 'AAPL', userStance: 'agree', outcome: 'right' }],
      dailyGrades: { [TODAY]: { trades: [{ tradeIndex: 0, symbolOut: 'KO', symbolIn: 'AMD', grade: 'great', note: 'clean exit' }, { tradeIndex: 1, grade: null }], submittedAt: NOW } },
    });
    expect(userMessage).toContain('Debates: 1\n- AAPL: stance=agree, outcome=right\n');
    expect(userMessage).toContain('USER GRADES:\n- Trade 1 (KO → AMD): great — Note: "clean exit"\n- Trade 2 (? → ?): no_opinion\n');
  });

  it('no grades for today still says so', async () => {
    const { userMessage } = await review({ dailyGrades: { '2026-09-08': { trades: [{ grade: 'A' }] } } });
    expect(userMessage).toContain('USER GRADES:\nNo grades submitted');
  });
});
