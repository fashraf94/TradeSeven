// api/_utils/callRecords/exitNotHeld.test.js
//
// Cockpit exit-not-held — contract Amendment E rev 2 (docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_E.md).
//
//   the helper   answers.js heldInAnyTier / isExitNotHeld — the ONE any-tier test E-1 (the mint's frozen
//                book), E-2's endpoint (the fresh parent) and E-2's displays (the screen's battle) all ask
//   E-1          an exit call (called shot or Confirmation) whose symbol is in NO tier of the frozen seam
//                book is born `invalidated`, `invalidatedReason: 'exit_not_held'`; a stock held in ANOTHER
//                tier than the call's `slot` is NOT dropped (the League slot label is a guess — the count,
//                docs/audits/20261029_COCKPIT_EXIT_NOT_HELD.md); a price-line reason wins; an unknown seam
//                proves nothing
//   E-1 rev 3    the seam's book predates the check's OWN trade, so an exit on that trade's committed
//                incoming stock (`committedSymbolIn`, the executor's result) is not dropped; a trade that
//                did not commit (the CVX shape) has none, and a null matches nothing
//
// The endpoint and the displays have their rows beside their own suites (call-response.test.js,
// exitNotHeld.display.jsdom.test.jsx).

import { describe, it, expect } from 'vitest';
import { buildMintCandidate, canonicalCall, EXIT_NOT_HELD_REASON, MUTABLE_CALL_FIELDS } from './candidate.js';
import { freezeSwapBook } from './swappable.js';
import { heldInAnyTier, isExitNotHeld } from './answers.js';
import { INVALIDATION_REASONS } from './validate.js';
import { FROZEN_NOW, makeTickBattle } from '../__fixtures__/tickStampsHarness.js';

const PROMPT_MS = Date.parse(FROZEN_NOW);
const MINT = PROMPT_MS + 20_000;

/** The tick fixture's book — star NVDA TSLA · core MSFT AMZN · support KO PG BTC — with a bench (AMD, JPM, DHR) the stocks can come from. */
const battle = () => {
  const b = makeTickBattle();
  b.portfolio = {
    ...b.portfolio,
    bench: {
      stocks: [
        { symbol: 'AMD', name: 'AMD', isCrypto: false, sector: 'Technology' },
        { symbol: 'JPM', name: 'JPMorgan', isCrypto: false, sector: 'Financial Services' },
        { symbol: 'DHR', name: 'Danaher', isCrypto: false, sector: 'Healthcare' },
      ],
      crypto: null,
    },
  };
  b.watchlist = { hotBench: [] };
  return b;
};
const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM', 'DHR'];
const HELD = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC'];
const PX = { NVDA: 123.4, TSLA: 244.9, MSFT: 412.3, AMZN: 186.2, KO: 62, PG: 166.1, BTC: 67450, AMD: 162, JPM: 201.1, DHR: 258.7 };
const observation = ({ omit = [] } = {}) => ({
  observedAtMs: PROMPT_MS,
  source: 'model_prompt',
  symbols: Object.fromEntries(Object.entries(PX).filter(([s]) => !omit.includes(s)).map(([s, px]) => [s, { px, fetchedAtMs: PROMPT_MS - 1000 }])),
});
// TSLA is held in `star`; AMD is on the bench (held in no tier). The line sits 2% under the symbol's own price, so the price line is plausible for whichever name is named.
const exitShot = (over = {}) => ({
  symbol: 'TSLA', direction: 'exit', slot: 'star', condition: { side: 'below', level: Math.round(PX[over.symbol ?? 'TSLA'] * 0.98 * 100) / 100 }, horizonPhrase: 'this_session', defaultAction: 'act',
  said: 'Cutting it below the line today.', ...over,
});
const mint = ({ shots = [exitShot()], book = freezeSwapBook(battle()), obs = observation(), mintedMode = 'on', committedSymbolIn = null } = {}) => buildMintCandidate({
  battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAtMs: MINT,
  raw: { calledShots: shots, watching: [], playerAsk: null, fork: null },
  universe: UNIVERSE, observation: obs, promptBuiltAt: FROZEN_NOW, tickId: null, battle: battle(),
  held: [...HELD], mintedMode, book, anticipationCandidates: null, rankMap: null, committedSymbolIn,
});
const firstCall = (opts) => mint(opts).calls[0];

describe('the any-tier helper (answers.js) — held in ANY tier of the book', () => {
  it('heldInAnyTier: true in each of the three tiers (the crypto row included), false for a bench name or a stranger', () => {
    const doc = battle();
    for (const symbol of ['NVDA', 'MSFT', 'KO', 'BTC']) expect(heldInAnyTier(doc, symbol), symbol).toBe(true);
    for (const symbol of ['AMD', 'JPM', 'CVX']) expect(heldInAnyTier(doc, symbol), symbol).toBe(false);
  });

  it('the seam\'s frozen book (freezeSwapBook) and a raw battle document answer alike', () => {
    const doc = battle();
    const frozen = freezeSwapBook(doc);
    for (const symbol of [...HELD, 'AMD', 'CVX']) expect(heldInAnyTier(frozen, symbol), symbol).toBe(heldInAnyTier(doc, symbol));
  });

  it('a book that cannot say proves nothing: null, no portfolio, no tier arrays, an empty symbol', () => {
    for (const book of [null, undefined, {}, { portfolio: null }, { portfolio: {} }, { portfolio: { bench: { stocks: [] } } }, 'x']) {
      expect(heldInAnyTier(book, 'TSLA')).toBeNull();
    }
    expect(heldInAnyTier(battle(), '')).toBeNull();
    expect(heldInAnyTier(battle(), null)).toBeNull();
    // A readable but EMPTY book is a book that holds nothing.
    expect(heldInAnyTier({ portfolio: { star: [], core: [], support: [] } }, 'TSLA')).toBe(false);
  });

  it('a hole in a tier array (a null or missing row) is skipped, never a throw: held rows around it still count (review NH-L5-4)', () => {
    const sparse = { portfolio: { star: [null, { symbol: 'TSLA' }], core: [undefined, {}], support: [{ symbol: 'KO' }, null] } };
    expect(heldInAnyTier(sparse, 'TSLA')).toBe(true);
    expect(heldInAnyTier(sparse, 'KO')).toBe(true);
    expect(heldInAnyTier(sparse, 'AMD')).toBe(false);
    expect(isExitNotHeld({ kind: 'confirmation', direction: 'exit', symbol: 'AMD', slot: 'star' }, sparse)).toBe(true);
    expect(isExitNotHeld({ kind: 'confirmation', direction: 'exit', symbol: 'TSLA', slot: 'support' }, sparse)).toBe(false);
  });

  it('isExitNotHeld: only an EXIT shot or Confirmation on a stock the readable book does not hold', () => {
    const doc = battle();
    expect(isExitNotHeld({ kind: 'called_shot', direction: 'exit', symbol: 'AMD', slot: 'star' }, doc)).toBe(true);
    expect(isExitNotHeld({ kind: 'confirmation', direction: 'exit', symbol: 'AMD', slot: 'star' }, doc)).toBe(true);
    // held: in its own slot, and in ANOTHER tier than the one it names (the League guess) — both held
    expect(isExitNotHeld({ kind: 'called_shot', direction: 'exit', symbol: 'TSLA', slot: 'star' }, doc)).toBe(false);
    expect(isExitNotHeld({ kind: 'called_shot', direction: 'exit', symbol: 'TSLA', slot: 'support' }, doc)).toBe(false);
    // not an exit: an entry on a bench name, a pick
    expect(isExitNotHeld({ kind: 'called_shot', direction: 'entry', symbol: 'AMD', slot: 'star' }, doc)).toBe(false);
    expect(isExitNotHeld({ kind: 'pick', direction: null, symbol: null, swapOut: 'KO' }, doc)).toBe(false);
    expect(isExitNotHeld({ kind: 'called_shot', direction: 'exit', symbol: 'AMD', slot: 'star' }, null)).toBe(false);
    expect(isExitNotHeld(null, doc)).toBe(false);
    expect(isExitNotHeld(undefined, doc)).toBe(false);
  });
});

describe('E-1 — an exit call on a stock held in no tier of the frozen book mints invalidated, exit_not_held', () => {
  it('not held anywhere (a bench name): born invalidated with the reason on the call and in minted[]; no options; not newly open', () => {
    const c = mint({ shots: [exitShot({ symbol: 'AMD', slot: 'star' })] });
    const call = c.calls[0];
    expect(call.state).toBe('invalidated');
    expect(call.invalidatedReason).toBe('exit_not_held');
    expect(call.invalidatedReason).toBe(EXIT_NOT_HELD_REASON);
    expect(call.replacementOptions).toBeNull();
    expect(call.stateSource).toBe('mint');
    expect(c.record.minted).toEqual([{ callId: call.callId, n: 0, kind: 'confirmation', state: 'invalidated', reason: 'exit_not_held' }]);
    expect(c.newOpen).toEqual([]);
    // The record is kept (the Film Room shows what the agent said) and the reason is IMMUTABLE: in the canonical form.
    expect(call.said).toBe('Cutting it below the line today.');
    expect(MUTABLE_CALL_FIELDS).not.toContain('invalidatedReason');
    expect(c.canonical.calls[call.callId]).toContain('"invalidatedReason":"exit_not_held"');
    expect(canonicalCall({ ...call, invalidatedReason: null })).not.toBe(c.canonical.calls[call.callId]);
  });

  it('both kinds: a hold-default called shot and an act-default Confirmation', () => {
    const shot = firstCall({ shots: [exitShot({ symbol: 'AMD', defaultAction: 'hold' })] });
    const confirmation = firstCall({ shots: [exitShot({ symbol: 'AMD', defaultAction: 'act' })] });
    expect([shot.kind, shot.state, shot.invalidatedReason]).toEqual(['called_shot', 'invalidated', 'exit_not_held']);
    expect([confirmation.kind, confirmation.state, confirmation.invalidatedReason]).toEqual(['confirmation', 'invalidated', 'exit_not_held']);
  });

  it('held in ANOTHER tier than the call names: NOT dropped — the League slot label is a guess (the control for the 60)', () => {
    for (const slot of ['core', 'support']) {
      const call = firstCall({ shots: [exitShot({ symbol: 'TSLA', slot })] }); // TSLA sits in `star`
      expect(call.state, slot).toBe('open');
      expect(call.invalidatedReason, slot).toBeNull();
      expect(Array.isArray(call.replacementOptions), slot).toBe(true);
    }
  });

  it('held in its own slot (the control): open, exactly as before', () => {
    const call = firstCall({ shots: [exitShot({ symbol: 'TSLA', slot: 'star' })] });
    expect(call.state).toBe('open');
    expect(call.invalidatedReason).toBeNull();
    expect(Array.isArray(call.replacementOptions)).toBe(true);
  });

  it('a crypto position (support) counts as held', () => {
    const call = firstCall({ shots: [exitShot({ symbol: 'BTC', slot: 'support', condition: { side: 'below', level: 66000 } })] });
    expect(call.state).toBe('open');
  });

  it('a reason that already invalidates at mint wins: the price line is judged first, exit_not_held only for a call that would otherwise mint valid', () => {
    const noPrice = firstCall({ shots: [exitShot({ symbol: 'AMD' })], obs: observation({ omit: ['AMD'] }) });
    expect([noPrice.state, noPrice.invalidatedReason]).toEqual(['invalidated', 'no_observation']);
    const implausible = firstCall({ shots: [exitShot({ symbol: 'AMD', condition: { side: 'below', level: 1000 } })] });
    expect([implausible.state, implausible.invalidatedReason]).toEqual(['invalidated', 'level_implausible']);
    // and the three existing reasons are still the validator's alone
    expect(INVALIDATION_REASONS).toEqual(['no_observation', 'level_non_finite', 'level_implausible']);
  });

  it('an unknown seam (no frozen book) proves nothing: the same call mints open', () => {
    const call = firstCall({ shots: [exitShot({ symbol: 'AMD' })], book: null });
    expect(call.state).toBe('open');
    expect(call.invalidatedReason).toBeNull();
  });

  it('only exits: an ENTRY on a stock that is not held (the normal case) is untouched', () => {
    const call = firstCall({ shots: [{ symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 170 }, horizonPhrase: 'this_session', defaultAction: 'act', said: 'AMD above 170.' }] });
    expect(call.state).toBe('open');
    expect(call.invalidatedReason).toBeNull();
  });

  it('a mixed block: only the not-held exit is dropped; ordinals, the held exit and the entry keep their ids and states', () => {
    const c = mint({
      shots: [
        exitShot({ symbol: 'AMD', slot: 'star' }),
        exitShot({ symbol: 'TSLA', slot: 'star' }),
        { symbol: 'JPM', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 205 }, horizonPhrase: 'this_session', defaultAction: 'act', said: 'JPM above 205.' },
      ],
    });
    expect(c.calls.map((x) => [x.callId, x.symbol, x.state, x.invalidatedReason])).toEqual([
      ['battle-tick-1:eval_001:call:0', 'AMD', 'invalidated', 'exit_not_held'],
      ['battle-tick-1:eval_001:call:1', 'TSLA', 'open', null],
      ['battle-tick-1:eval_001:call:2', 'JPM', 'open', null],
    ]);
    expect(c.newOpen.map((x) => x.symbol)).toEqual(['TSLA', 'JPM']);
  });

  it('the same at the shadow mode: the rule belongs to the mint, not to the answers (off mints nothing at all)', () => {
    const call = firstCall({ shots: [exitShot({ symbol: 'AMD' })], mintedMode: 'shadow' });
    expect([call.mintedMode, call.state, call.invalidatedReason]).toEqual(['shadow', 'invalidated', 'exit_not_held']);
  });
});

// Amendment E rev 3 — the seam's book is the book BEFORE the check's own trade (the swap commits after the
// prompt seam, before the mint). AMD is on the bench in that book; a check that buys AMD and declares an exit
// plan for it is writing about a stock that is in the book once the check ends.
describe('E-1 rev 3 — an exit on the check\'s own committed incoming stock is not dropped', () => {
  it('an exit on the committed symbolIn mints OPEN, whichever tier it names, with its options', () => {
    for (const slot of ['star', 'core', 'support']) {
      const call = firstCall({ shots: [exitShot({ symbol: 'AMD', slot })], committedSymbolIn: 'AMD' });
      expect([call.state, call.invalidatedReason], slot).toEqual(['open', null]);
      expect(Array.isArray(call.replacementOptions), slot).toBe(true);
    }
    const c = mint({ shots: [exitShot({ symbol: 'AMD', defaultAction: 'hold' })], committedSymbolIn: 'AMD' });
    expect(c.calls[0].state).toBe('open');
    expect(c.newOpen.map((x) => x.symbol)).toEqual(['AMD']);
  });

  it('the same exit with NO trade committed (the CVX shape: the swap was blocked) is still dropped', () => {
    const call = firstCall({ shots: [exitShot({ symbol: 'AMD' })], committedSymbolIn: null });
    expect([call.state, call.invalidatedReason]).toEqual(['invalidated', 'exit_not_held']);
  });

  it('a null matches nothing: no symbolIn, an empty one, a non-string one — none exempts a stock', () => {
    for (const committedSymbolIn of [null, '', 0, {}]) {
      const call = firstCall({ shots: [exitShot({ symbol: 'AMD' })], committedSymbolIn });
      expect(call.state, JSON.stringify(committedSymbolIn)).toBe('invalidated');
    }
  });

  it('only the committed stock itself: a trade that bought JPM does not exempt an exit on AMD', () => {
    const call = firstCall({ shots: [exitShot({ symbol: 'AMD' })], committedSymbolIn: 'JPM' });
    expect([call.state, call.invalidatedReason]).toEqual(['invalidated', 'exit_not_held']);
  });

  it('symbolIn only: a held stock stays judged by the book whatever the trade bought, and the price line still wins', () => {
    expect(firstCall({ shots: [exitShot({ symbol: 'TSLA' })], committedSymbolIn: 'AMD' }).state).toBe('open'); // held in the seam book
    const implausible = firstCall({ shots: [exitShot({ symbol: 'AMD', condition: { side: 'below', level: 1000 } })], committedSymbolIn: 'AMD' });
    expect([implausible.state, implausible.invalidatedReason]).toEqual(['invalidated', 'level_implausible']);
  });

  it('the exemption belongs to the mint, not to one mode: at shadow the bought stock\'s exit lives and the CVX shape is dropped (review NH-L5-3)', () => {
    const bought = firstCall({ shots: [exitShot({ symbol: 'AMD' })], committedSymbolIn: 'AMD', mintedMode: 'shadow' });
    expect([bought.mintedMode, bought.state, bought.invalidatedReason]).toEqual(['shadow', 'open', null]);
    const blocked = firstCall({ shots: [exitShot({ symbol: 'AMD' })], committedSymbolIn: null, mintedMode: 'shadow' });
    expect([blocked.mintedMode, blocked.state, blocked.invalidatedReason]).toEqual(['shadow', 'invalidated', 'exit_not_held']);
  });

  it('a mixed block: the bought stock\'s exit lives, an unrelated not-held exit is dropped, in one check', () => {
    const c = mint({ shots: [exitShot({ symbol: 'AMD' }), exitShot({ symbol: 'JPM' })], committedSymbolIn: 'AMD' });
    expect(c.calls.map((x) => [x.symbol, x.state, x.invalidatedReason])).toEqual([['AMD', 'open', null], ['JPM', 'invalidated', 'exit_not_held']]);
  });

  it('the parameter is REQUIRED beside held and book: omitted → throws; null is the explicit "no trade committed"', () => {
    const args = {
      battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAtMs: MINT, raw: { calledShots: [exitShot()], watching: [], playerAsk: null, fork: null },
      universe: UNIVERSE, observation: observation(), promptBuiltAt: FROZEN_NOW, tickId: null, battle: battle(), held: [...HELD], mintedMode: 'on',
      book: freezeSwapBook(battle()), anticipationCandidates: null, rankMap: null,
    };
    expect(() => buildMintCandidate(args)).toThrow(/committedSymbolIn/);
    expect(() => buildMintCandidate({ ...args, committedSymbolIn: null })).not.toThrow();
  });
});
