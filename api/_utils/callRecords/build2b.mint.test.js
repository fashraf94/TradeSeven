// api/_utils/callRecords/build2b.mint.test.js
//
// Cockpit Build 2b — THE MINT FIELDS (contract Amendment D, D-3 / D-7 / D-9;
// spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-3, §11 "D-3", "D-7", "D-9"):
//   D-3  replacementOptions — order and fill (the agent's two lists, deduped,
//        then the bench by rank, unranked last), the cap of 4, the agent
//        filling all four, [] and null; the usable-price rule (options only:
//        the same name stays a legal counterpart and a legal pick at filing);
//        immutability in the canonical form.
//   D-7  the counterpart knock-ons — a watchlist-only or cross-class exit
//        counterpart is nulled; an entry counterpart in another tier is nulled
//        (the AMGN / PFE shape), its call_go text loses "for PFE" and its acted
//        match's other leg is unconstrained.
//   D-9  invalidatedReason for each mint reason, null otherwise.

import { describe, it, expect } from 'vitest';
import { buildMintCandidate, canonicalCall, MUTABLE_CALL_FIELDS, replacementOptionsFor, REPLACEMENT_OPTIONS_MAX } from './candidate.js';
import { freezeSwapBook } from './swappable.js';
import { renderCallActionText, isCallActionEligible } from './callActions.js';
import { matchesWholeTrade } from './flip.js';
import { FROZEN_NOW, makeTickBattle } from '../__fixtures__/tickStampsHarness.js';

const PROMPT_MS = Date.parse(FROZEN_NOW);
const MINT = PROMPT_MS + 20_000;
const LOCK_AFTER = new Date(PROMPT_MS + 3_600_000).toISOString();

/** A book: NVDA TSLA | MSFT AMZN | KO PG BTC; bench AMD JPM DHR CEG(locked) PM + ETH crypto; hot bench PLTR; watchlist SHOP. */
const battle = (over = {}) => {
  const b = makeTickBattle();
  b.portfolio = {
    ...b.portfolio,
    bench: {
      stocks: [
        { symbol: 'AMD', name: 'AMD', isCrypto: false, sector: 'Technology' },
        { symbol: 'JPM', name: 'JPMorgan', isCrypto: false, sector: 'Financial Services' },
        { symbol: 'DHR', name: 'Danaher', isCrypto: false, sector: 'Healthcare' },
        { symbol: 'CEG', name: 'Constellation', isCrypto: false, sector: 'Utilities', cooldownUntil: LOCK_AFTER },
        { symbol: 'PM', name: 'Philip Morris', isCrypto: false, sector: 'Consumer Defensive' },
      ],
      crypto: { symbol: 'ETH-USD.CC', name: 'Ethereum', isCrypto: true },
    },
    ...(over.portfolio || {}),
  };
  b.watchlist = { hotBench: ['PLTR'] };
  b.agentContext = { ...b.agentContext, equippedWatchlist: { watchlistId: 'w-1', tickers: ['SHOP'] } };
  return b;
};
const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM', 'DHR', 'CEG', 'PM', 'ETH-USD.CC', 'PLTR', 'SHOP', 'PFE', 'AMGN'];
const HELD = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC'];
const PX = { NVDA: 123.4, TSLA: 244.9, MSFT: 412.3, AMZN: 186.2, KO: 62, PG: 166.1, BTC: 67450, AMD: 162, JPM: 201.1, DHR: 258.7, CEG: 236.9, PM: 121.4, 'ETH-USD.CC': 3100, AMGN: 318.9 };
const observation = ({ omit = [] } = {}) => ({
  observedAtMs: PROMPT_MS,
  source: 'model_prompt',
  symbols: Object.fromEntries(Object.entries(PX).filter(([s]) => !omit.includes(s)).map(([s, px]) => [s, { px, fetchedAtMs: PROMPT_MS - 1000 }])),
});
const exitShot = (over = {}) => ({
  symbol: 'TSLA', direction: 'exit', slot: 'star', condition: { side: 'below', level: 240 }, horizonPhrase: 'this_session', defaultAction: 'act',
  said: 'Cutting TSLA below $240 today.', ...over,
});
const mint = ({ shots = [exitShot()], watching = [], candidates = null, rankMap = null, book = freezeSwapBook(battle()), obs = observation() } = {}) => buildMintCandidate({
  battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAtMs: MINT,
  raw: { calledShots: shots, watching, playerAsk: null, fork: null },
  universe: UNIVERSE, observation: obs, promptBuiltAt: FROZEN_NOW, tickId: null, battle: battle(),
  held: [...HELD], mintedMode: 'on', book, anticipationCandidates: candidates, rankMap,
});
const firstCall = (opts) => mint(opts).calls[0];
const cand = (...symbols) => symbols.map((symbol) => ({ symbol, direction: 'up', signalSummary: 's', threshold: 't' }));

describe('D-3 — replacementOptions: order and fill', () => {
  it('the agent\'s own names first — candidates in stamp order, then the watch list, without repeats — then the bench by rank; a locked or off-list name never appears', () => {
    const call = firstCall({ candidates: cand('CEG', 'DHR', 'AMD'), watching: ['JPM', 'DHR', 'SHOP'], rankMap: { AMD: 5, JPM: 2, DHR: 9, PM: 1, PLTR: 3 } });
    expect(call.counterpart).toBeNull();
    expect(call.replacementOptions).toEqual([
      { symbol: 'DHR', source: 'agent', rank: 9 },
      { symbol: 'AMD', source: 'agent', rank: 5 },
      { symbol: 'JPM', source: 'agent', rank: 2 },
      { symbol: 'PM', source: 'bench', rank: 1 },
    ]);
  });

  it('the agent may fill all four; the cap is four', () => {
    const call = firstCall({ candidates: cand('DHR', 'AMD', 'JPM', 'PM'), rankMap: { PM: 1 } });
    expect(call.replacementOptions.map((o) => [o.symbol, o.source])).toEqual([['DHR', 'agent'], ['AMD', 'agent'], ['JPM', 'agent'], ['PM', 'agent']]);
    expect(REPLACEMENT_OPTIONS_MAX).toBe(4);
  });

  it('the bench by technicalRank ascending; unranked names follow in roster order; rank null when none', () => {
    const call = firstCall({ rankMap: { JPM: 2, PM: 1 } });
    expect(call.replacementOptions).toEqual([
      { symbol: 'PM', source: 'bench', rank: 1 },
      { symbol: 'JPM', source: 'bench', rank: 2 },
      { symbol: 'AMD', source: 'bench', rank: null },
      { symbol: 'DHR', source: 'bench', rank: null },
    ]);
    // A non-integer rank is no rank.
    expect(firstCall({ rankMap: { AMD: 1.5 } }).replacementOptions[0]).toEqual({ symbol: 'AMD', source: 'bench', rank: null });
  });

  it('[] when the call qualifies and no name passes (an empty bench, every name locked)', () => {
    const empty = freezeSwapBook(battle({ portfolio: { bench: { stocks: [], crypto: null } } }));
    expect(firstCall({ book: empty }).replacementOptions).toEqual([]);
    const allLocked = freezeSwapBook(battle({ portfolio: { bench: { stocks: [{ symbol: 'AMD', isCrypto: false, cooldownUntil: LOCK_AFTER }], crypto: null } } }));
    expect(firstCall({ book: allLocked }).replacementOptions).toEqual([]);
    // An unknown book (null) proves no name: still a qualifying exit, so [].
    expect(firstCall({ book: null }).replacementOptions).toEqual([]);
  });

  it('null on every call that does not qualify: an entry, an exit with a usable counterpart, an invalidated exit, a pick', () => {
    const c = mint({
      shots: [
        { symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 163 }, horizonPhrase: 'this_session', defaultAction: 'act', said: 'x' },
        exitShot({ counterpart: 'JPM' }),
        exitShot({ condition: { side: 'below', level: 2 } }),
      ],
    });
    expect(c.calls.map((x) => x.replacementOptions)).toEqual([null, null, null]);
    expect(c.calls[1].counterpart).toBe('JPM');
    expect(c.calls[2].state).toBe('invalidated');
    const pick = buildMintCandidate({
      battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAtMs: MINT,
      raw: { calledShots: [], watching: [], playerAsk: null, fork: { slot: 'support', swapOut: 'KO', options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }], said: 'AMD or JPM?' } },
      universe: UNIVERSE, observation: observation(), promptBuiltAt: FROZEN_NOW, tickId: null, battle: battle(), held: [...HELD], mintedMode: 'on', book: freezeSwapBook(battle()), anticipationCandidates: null, rankMap: null,
    }).calls[0];
    expect(pick.kind).toBe('pick');
    expect(pick.replacementOptions).toBeNull();
  });

  it('a hold-default exit with no counterpart qualifies too (the "Exit instead" step)', () => {
    const call = firstCall({ shots: [exitShot({ defaultAction: 'hold' })], rankMap: { PM: 1 } });
    expect(call.replacementOptions[0]).toEqual({ symbol: 'PM', source: 'bench', rank: 1 });
  });
});

describe('D-3 rev 2 — the usable-price rule (options only)', () => {
  it('a name the minting check\'s observation does not admit is skipped — agent and bench alike', () => {
    const call = firstCall({ candidates: cand('DHR', 'AMD'), rankMap: { PM: 1, JPM: 2 }, obs: observation({ omit: ['DHR', 'PM'] }) });
    expect(call.replacementOptions.map((o) => o.symbol)).toEqual(['AMD', 'JPM']);
    // The hot bench is never in the model observation (observe.js examines held + the persisted bench): never an option.
    expect(firstCall({ candidates: cand('PLTR') }).replacementOptions.map((o) => o.symbol)).not.toContain('PLTR');
  });

  it('the SAME name stays a legal counterpart at mint and a legal pick at filing — D-7 and filing never read the price', () => {
    const obs = observation({ omit: ['DHR'] });
    expect(firstCall({ shots: [exitShot({ counterpart: 'DHR' })], obs }).counterpart).toBe('DHR');
    const qualifying = firstCall({ obs });
    expect(qualifying.replacementOptions.map((o) => o.symbol)).not.toContain('DHR');
    expect(isCallActionEligible('call_replace', qualifying, battle(), { pickSymbol: 'DHR', atMs: PROMPT_MS })).toEqual({ ok: true });
  });

  it('replacementOptionsFor reads the observation\'s own admission — a present entry is admitted, an absent one is not', () => {
    const book = freezeSwapBook(battle());
    const seam = { book, atMs: PROMPT_MS, candidates: [], watching: [], rankOf: () => null };
    expect(replacementOptionsFor({ symbol: 'TSLA', slot: 'star' }, { ...seam, observation: { symbols: {} } })).toEqual([]);
    expect(replacementOptionsFor({ symbol: 'TSLA', slot: 'star' }, { ...seam, observation: null })).toEqual([]);
  });
});

describe('D-3 / D-9 — both fields are immutable: in the canonical form, never in MUTABLE_CALL_FIELDS', () => {
  it('a change to either field changes the canonical form publication compares', () => {
    expect(MUTABLE_CALL_FIELDS).not.toContain('replacementOptions');
    expect(MUTABLE_CALL_FIELDS).not.toContain('invalidatedReason');
    const call = firstCall({ rankMap: { PM: 1 } });
    const canon = canonicalCall(call);
    expect(canon).toContain('"replacementOptions":[');
    expect(canon).toContain('"invalidatedReason":null');
    expect(canonicalCall({ ...call, replacementOptions: [] })).not.toBe(canon);
    expect(canonicalCall({ ...call, invalidatedReason: 'no_observation' })).not.toBe(canon);
    // The mutable state still never enters it.
    expect(canonicalCall({ ...call, state: 'hit' })).toBe(canon);
  });
});

describe('D-9 — why a call was dropped', () => {
  it('each mint reason lands on the call; an open call carries null', () => {
    const c = mint({
      shots: [
        exitShot({ condition: { side: 'below', level: 2 } }),
        exitShot({ symbol: 'NVDA', condition: { side: 'below', level: Number.POSITIVE_INFINITY } }),
        exitShot({ symbol: 'MSFT' }),
        exitShot({ symbol: 'AMZN', condition: { side: 'below', level: 180 } }),
      ],
      obs: observation({ omit: ['MSFT'] }),
    });
    expect(c.calls.map((x) => [x.symbol, x.state, x.invalidatedReason])).toEqual([
      ['TSLA', 'invalidated', 'level_implausible'],
      ['NVDA', 'invalidated', 'level_non_finite'],
      ['MSFT', 'invalidated', 'no_observation'],
      ['AMZN', 'open', null],
    ]);
    // The record's minted[] keeps the same reason — one source.
    expect(c.record.minted.map((m) => m.reason)).toEqual(['level_implausible', 'level_non_finite', 'no_observation', null]);
  });
});

describe('D-7 — the counterpart knock-ons (pinned)', () => {
  it('an exit whose counterpart is on the equipped watchlist only → null, counterpartRaw set; it gets the options', () => {
    const call = firstCall({ shots: [exitShot({ counterpart: 'SHOP' })], rankMap: { PM: 1 } });
    expect(call).toMatchObject({ counterpart: null, counterpartRaw: 'SHOP' });
    expect(call.replacementOptions.length).toBeGreaterThan(0);
    expect(renderCallActionText('call_go', { ...call, horizon: { basis: 'this_session', expiresAt: PROMPT_MS + 3_600_000 } }, { nowMs: PROMPT_MS })).toMatch(/go ahead and exit\.$/);
  });

  it('an exit whose counterpart is another asset class (crypto for a stock) → null, counterpartRaw set', () => {
    expect(firstCall({ shots: [exitShot({ counterpart: 'ETH-USD.CC' })] })).toMatchObject({ counterpart: null, counterpartRaw: 'ETH-USD.CC' });
    // The same class is kept: crypto for crypto.
    expect(firstCall({ shots: [exitShot({ symbol: 'BTC', slot: 'support', counterpart: 'ETH-USD.CC', condition: { side: 'below', level: 66000 } })] }).counterpart).toBe('ETH-USD.CC');
  });

  it('the AMGN / PFE shape: an ENTRY in core whose counterpart PFE is held in support → null; call_go loses "for PFE"; the acted match\'s other leg is unconstrained', () => {
    const b = battle({ portfolio: { support: [{ symbol: 'KO', isCrypto: false }, { symbol: 'PFE', isCrypto: false }, { symbol: 'BTC', isCrypto: true }] } });
    const entry = { symbol: 'AMGN', direction: 'entry', slot: 'core', counterpart: 'PFE', condition: { side: 'above', level: 320 }, horizonPhrase: 'this_session', defaultAction: 'act', said: 'AMGN into core above $320.' };
    const call = firstCall({ shots: [entry], book: freezeSwapBook(b) });
    expect(call).toMatchObject({ counterpart: null, counterpartRaw: 'PFE', replacementOptions: null });
    const text = renderCallActionText('call_go', { ...call, horizon: { basis: 'this_session', expiresAt: PROMPT_MS + 3_600_000 } }, { nowMs: PROMPT_MS });
    expect(text).toMatch(/go ahead and bring it in\.$/);
    expect(text).not.toContain('PFE');
    expect(matchesWholeTrade(call, { symbolIn: 'AMGN', symbolOut: 'MSFT', tier: 'core', slotIndex: 0 })).toBe(true);
    // The same counterpart held IN the call's own tier is kept (the filing's counterpart_not_held test).
    const sameTier = battle({ portfolio: { core: [{ symbol: 'MSFT', isCrypto: false }, { symbol: 'PFE', isCrypto: false }] } });
    expect(firstCall({ shots: [entry], book: freezeSwapBook(sameTier) }).counterpart).toBe('PFE');
  });

  it('records already minted stay as written: the mint reads only its own seam (no reader rewrites a stored counterpart)', () => {
    const stored = { ...firstCall({ shots: [exitShot({ counterpart: 'SHOP' })] }), counterpart: 'SHOP' };
    // A stored (pre-2b) counterpart is the record's own fact; eligibility at filing now judges it (counterpart_unavailable).
    expect(isCallActionEligible('call_go', { ...stored, defaultAction: 'hold' }, battle(), { atMs: PROMPT_MS })).toEqual({ ok: false, reason: 'counterpart_unavailable' });
  });
});
