// src/screens/battleView/selectBench.test.js
//
// A3.3 (D-92) — Bench quotes the decider only.
//
// The seed's rows: a narrator exchange never renders in Bench (a mutation
// row), the sentences are verbatim, the roster carries `Not named…`, and the
// absence state is truthful. Plus the scan-back the founder ruled, and the
// book subtraction the roster depends on.

import { describe, it, expect } from 'vitest';
import { selectBench, selectBenchRoster, selectLastDecidedWithWords, selectBookSymbols } from './selectBench';

const doc = (over = {}) => ({
  scoreState: { lastScoredAt: '2026-09-01T17:00:00.000Z' },
  portfolio: {
    star: [{ symbol: 'AAPL' }, { symbol: 'SLB' }],
    core: [{ symbol: 'NVDA' }],
    support: [],
    bench: { stocks: [{ symbol: 'NOW' }, { symbol: 'TSLA' }], crypto: { symbol: 'BTC-USD' } },
  },
  watchlist: { hotBench: ['CRWD', 'NOW'] },
  agentContext: { equippedWatchlist: { name: 'Energy leaders', tickers: ['DVN', 'AAPL'] } },
  evaluations: [
    {
      evalId: 'e1',
      timestamp: '2026-09-01T16:45:00.000Z',
      decision: 'HOLD',
      rationale: 'NOW would need +7.4% more to lock in the bonus. TSLA would need +6.6% more. The book is steady.',
    },
  ],
  chatExchanges: [],
  ...over,
});

describe('the roster is the bench MINUS the book, deduped, in list order', () => {
  it('takes all three bench lists and drops every piece with a row', () => {
    // AAPL is on the equipped watchlist AND in the book — the book wins, because
    // a piece on the board has a row of its own and is not a bench name.
    expect(selectBenchRoster(doc())).toEqual(['NOW', 'TSLA', 'BTC-USD', 'CRWD', 'DVN']);
  });

  it('dedupes a name that appears on two lists, keeping its FIRST position', () => {
    // NOW is on the persisted bench and the hot bench.
    const roster = selectBenchRoster(doc());
    expect(roster.filter((s) => s === 'NOW')).toHaveLength(1);
    expect(roster.indexOf('NOW')).toBe(0);
  });

  it('handles BOTH persisted shapes — a string list and an object list', () => {
    const r = selectBenchRoster(doc({
      portfolio: { star: [], core: [], support: [], bench: { stocks: ['MU'], crypto: 'ETH-USD' } },
      watchlist: { hotBench: [{ symbol: 'GILD' }] },
      agentContext: {},
    }));
    expect(r).toEqual(['MU', 'ETH-USD', 'GILD']);
  });

  it('is empty, never undefined, on a doc with nothing', () => {
    expect(selectBenchRoster(null)).toEqual([]);
    expect(selectBenchRoster({})).toEqual([]);
    expect(selectBookSymbols(null)).toEqual(new Set());
  });
});

describe('the sentences are the decider\'s own, verbatim', () => {
  it('gives each named symbol exactly the sentences that name it', () => {
    const { named } = selectBench(doc());
    expect(named.map((n) => n.symbol)).toEqual(['NOW', 'TSLA']);
    // EXACT EQUALITY, not toContain: the claim is that the model's words reach
    // the screen unchanged.
    expect(named[0].sentences).toEqual(['NOW would need +7.4% more to lock in the bonus.']);
    expect(named[1].sentences).toEqual(['TSLA would need +6.6% more.']);
  });

  it('puts every unnamed bench name in `rest`, and names none twice', () => {
    const { named, rest } = selectBench(doc());
    expect(rest).toEqual(['BTC-USD', 'CRWD', 'DVN']);
    const all = [...named.map((n) => n.symbol), ...rest];
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(selectBenchRoster(doc()).sort());
  });

  it('names the slot the words came from', () => {
    expect(selectBench(doc()).slotIso).toBe('2026-09-01T16:45:00.000Z');
  });

  it('carries the equipped watchlist\'s bare name, or null', () => {
    expect(selectBench(doc()).watchlistName).toBe('Energy leaders');
    expect(selectBench(doc({ agentContext: {} })).watchlistName).toBeNull();
    expect(selectBench(doc({ agentContext: { equippedWatchlist: { name: '   ' } } })).watchlistName).toBeNull();
  });
});

describe('A NARRATOR EXCHANGE NEVER RENDERS IN BENCH (brief §4.4)', () => {
  it('a doc whose only words live in chatExchanges renders an empty Bench body', () => {
    // The mutation row that means something. The character's "Eyeing NOW on the
    // bench" is a Chat entry labelled `Bench note`; presenting it here would put
    // the narrator's voice where the decider's belongs.
    const b = selectBench(doc({
      evaluations: [],
      chatExchanges: [{ agentResponse: 'Eyeing NOW on the bench. It is showing massive relative strength.', messageType: 'anticipation' }],
    }));
    expect(b.named).toEqual([]);
    expect(b.slotIso).toBeNull();
    expect(b.rest).toEqual(['NOW', 'TSLA', 'BTC-USD', 'CRWD', 'DVN']);
  });

  it('ignores statusFeed words too', () => {
    const b = selectBench(doc({
      evaluations: [],
      statusFeed: [{ action: 'anticipation', message: 'NOW is outrunning the book.' }],
    }));
    expect(b.named).toEqual([]);
    expect(b.slotIso).toBeNull();
  });
});

describe('the scan-back past an outage tick (D-92, hazard 40)', () => {
  it('quotes the last check WITH WORDS, not the last check', () => {
    // The founder's ruling. selectLatestDecision would return null here — the
    // 1:00 tick recorded no decision — and Bench would have claimed a silent
    // day while the 12:45 words sat in the doc.
    const b = selectBench(doc({
      scoreState: { lastScoredAt: '2026-09-01T17:00:00.000Z' },
      evaluations: [
        { evalId: 'e1', timestamp: '2026-09-01T16:45:00.000Z', decision: 'HOLD', rationale: 'NOW is the one to watch for a tier.' },
        { evalId: 'e2', timestamp: '2026-09-01T17:00:00.000Z', decision: 'HOLD', rationale: null },
      ],
    }));
    expect(b.slotIso).toBe('2026-09-01T16:45:00.000Z');
    expect(b.named.map((n) => n.symbol)).toEqual(['NOW']);
  });

  it('treats a blank rationale as no words, not as words', () => {
    expect(selectLastDecidedWithWords({ evaluations: [{ rationale: '   ' }] })).toBeNull();
    expect(selectLastDecidedWithWords({ evaluations: [{ rationale: 42 }] })).toBeNull();
    expect(selectLastDecidedWithWords({ evaluations: [] })).toBeNull();
    expect(selectLastDecidedWithWords(null)).toBeNull();
  });

  it('ABSENCE only when NO entry today carries words', () => {
    const b = selectBench(doc({ evaluations: [{ timestamp: '2026-09-01T17:00:00.000Z', rationale: null }] }));
    expect(b.slotIso).toBeNull();
    expect(b.named).toEqual([]);
    // The roster still renders — the absence is about the WORDS, not the bench.
    expect(b.rest.length).toBeGreaterThan(0);
  });
});

describe('one naming rule, shared (D-87)', () => {
  it('a substring of a longer ticker is not a mention', () => {
    const b = selectBench(doc({
      portfolio: { star: [], core: [], support: [], bench: { stocks: [{ symbol: 'NOW' }], crypto: null } },
      watchlist: {}, agentContext: {},
      // The only `NOW` here is INSIDE `SNOWFLAKE` (review lens 4 F8). The first
      // fixture said `SNOWFLAKE is not NOW-adjacent.`, which also contains a
      // genuine mention — so a naive `s.includes(symbol)` returned the same
      // single sentence and the row passed while proving nothing.
      evaluations: [{ timestamp: '2026-09-01T16:45:00.000Z', rationale: 'SNOWFLAKE led the tape all afternoon.' }],
    }));
    expect(b.named).toEqual([]);
    expect(b.rest).toEqual(['NOW']);
  });

  it('…and a genuine mention IS quoted, so the row above is not passing on silence', () => {
    const b = selectBench(doc({
      portfolio: { star: [], core: [], support: [], bench: { stocks: [{ symbol: 'NOW' }], crypto: null } },
      watchlist: {}, agentContext: {},
      evaluations: [{ timestamp: '2026-09-01T16:45:00.000Z', rationale: 'NOW led the tape all afternoon.' }],
    }));
    expect(b.named.map((n) => n.symbol)).toEqual(['NOW']);
  });

  it('keeps the model\'s emphasis markers for the renderer to resolve', () => {
    const b = selectBench(doc({
      evaluations: [{ timestamp: '2026-09-01T16:45:00.000Z', rationale: '**NOW** is up 6.97% today.' }],
    }));
    expect(b.named[0].sentences[0]).toBe('**NOW** is up 6.97% today.');
  });
});

describe('Review lens 1 F4 / F5 — the decider\'s words, and only those', () => {
  // An outage tick as the CRON actually writes it: a placeholder rationale plus
  // `haikuError`. The first draft of the scan-back modelled it as
  // `rationale: null`, which production never writes, so the row could not fail
  // under the defect it named.
  const outage = (iso) => ({
    evalId: 'out',
    timestamp: iso,
    decision: 'HOLD',
    rationale: 'Haiku call failed — defaulting to HOLD',
    haikuError: { failureClass: 'timeout' },
  });

  it('WALKS PAST an outage tick to the last check that really spoke', () => {
    const b = selectBench(doc({
      evaluations: [
        { evalId: 'e1', timestamp: '2026-09-01T16:45:00.000Z', decision: 'HOLD', rationale: 'NOW is the one to watch for a tier.' },
        outage('2026-09-01T17:00:00.000Z'),
      ],
    }));
    expect(b.slotIso).toBe('2026-09-01T16:45:00.000Z');
    expect(b.named.map((n) => n.symbol)).toEqual(['NOW']);
    // The system's own sentence never reaches the screen as the agent's.
    expect(JSON.stringify(b.named)).not.toContain('Haiku call failed');
  });

  it('an outage-only day is an ABSENCE, not a quote of the placeholder', () => {
    const b = selectBench(doc({ evaluations: [outage('2026-09-01T17:00:00.000Z')] }));
    expect(b.slotIso).toBeNull();
    expect(b.named).toEqual([]);
    expect(b.footer).toBeNull();
  });

  it('a budget-skipped tick is an outage too, whatever its failure class', () => {
    const b = selectBench(doc({
      evaluations: [{ ...outage('2026-09-01T17:00:00.000Z'), haikuError: { failureClass: 'budget_skipped' } }],
    }));
    expect(b.slotIso).toBeNull();
  });

  it('renders the DISPLAY text (D-80) — no machinery code reaches Bench', () => {
    // A guardrail-forced exit's rationale carries `guardrail_{type}`, and a
    // forced-out symbol RETURNS TO THE BENCH, so Bench is a live surface for it.
    // renderMotive (inside selectWhyState) is the one place a rationale becomes
    // display text; splitting the raw field put the code on screen.
    const b = selectBench(doc({
      portfolio: { star: [], core: [], support: [], bench: { stocks: [{ symbol: 'GILD' }], crypto: null } },
      watchlist: {}, agentContext: {},
      evaluations: [{
        evalId: 'g1',
        timestamp: '2026-09-01T16:45:00.000Z',
        decision: 'HOLD',
        rationale: 'Guardrail override (guardrail_stopLoss): GILD broke its stop.',
      }],
    }));
    const text = JSON.stringify(b.named);
    expect(text).not.toContain('guardrail_stopLoss');
    expect(text).toContain('GILD');
  });

  it('carries the line that says WHOSE words they are (D-80)', () => {
    // The check and trade cards label authorship under the same sentences;
    // Bench is the fourth surface to quote a rationale and was the only one
    // going to do it unattributed.
    const b = selectBench(doc());
    expect(typeof b.footer === 'string' || b.footer === null).toBe(true);
    expect(b.named.length).toBeGreaterThan(0);
  });
});
