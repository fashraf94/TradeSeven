// api/_utils/callRecords/entryAlreadyHeld.test.js
//
// Cockpit entry-already-held — contract Amendment F (docs/CALL_RECORD_FIELD_CONTRACT_V1_4_AMENDMENT_F.md),
// the entry-side mirror of Amendment E (exitNotHeld.test.js).
//
//   the helper   answers.js isEntryAlreadyHeld — the ONE entry-side held test the endpoint (the fresh parent)
//                and the displays (the screen's battle document) both ask, built on heldInAnyTier
//   F-1          composeCall: `heldAtMint` is also true for an ENTRY whose symbol is the check's own committed
//                `symbolIn` (the E rev 3 parameter, already passed; null matches nothing) — the seam's book
//                predates the check's own trade, so the stock it just bought was minted as an ordinary entry
//   model-visible  the only change is DATA-DEPENDENT: such a call renders through the existing upside line in
//                the chat calls block, and that line's bytes equal the call line's for the same record
//
// The endpoint and the displays have their rows beside their own suites (call-response.test.js,
// call-response.2b.test.js, entryAlreadyHeld.display.jsdom.test.jsx).

import { describe, it, expect } from 'vitest';
import { buildMintCandidate, canonicalCall, MUTABLE_CALL_FIELDS } from './candidate.js';
import { freezeSwapBook } from './swappable.js';
import { heldInAnyTier, isEntryAlreadyHeld, isExitNotHeld, classifyAnswer, tileAnswersFor, isUpsideCall } from './answers.js';
import { renderCallsRow, buildCallsBlock } from './callsBlock.js';
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
const observation = () => ({
  observedAtMs: PROMPT_MS,
  source: 'model_prompt',
  symbols: Object.fromEntries(Object.entries(PX).map(([s, px]) => [s, { px, fetchedAtMs: PROMPT_MS - 1000 }])),
});
// An ENTRY: the line sits 2% over the symbol's own price, so the price line is plausible for whichever name is named.
// AMD is on the bench (held in no tier); the counterpart KO is held in `support`, so it is usable at the seam.
const entryShot = (over = {}) => ({
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: Math.round(PX[over.symbol ?? 'AMD'] * 1.02 * 100) / 100 }, horizonPhrase: 'this_session', defaultAction: 'act',
  said: 'Waiting for the line to break.', ...over,
});
const exitShot = (over = {}) => ({
  symbol: 'TSLA', direction: 'exit', slot: 'star', condition: { side: 'below', level: Math.round(PX[over.symbol ?? 'TSLA'] * 0.98 * 100) / 100 }, horizonPhrase: 'this_session', defaultAction: 'act',
  said: 'Cutting it below the line today.', ...over,
});
const mint = ({ shots = [entryShot()], book = freezeSwapBook(battle()), obs = observation(), mintedMode = 'on', committedSymbolIn = null, held = [...HELD] } = {}) => buildMintCandidate({
  battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAtMs: MINT,
  raw: { calledShots: shots, watching: [], playerAsk: null, fork: null },
  universe: UNIVERSE, observation: obs, promptBuiltAt: FROZEN_NOW, tickId: null, battle: battle(),
  held, mintedMode, book, anticipationCandidates: null, rankMap: null, committedSymbolIn,
});
const firstCall = (opts) => mint(opts).calls[0];
const ALL_ANSWERS = ['go', 'hold', 'go_now', 'pick', 'agree', 'disagree', 'replace'];

describe('the entry-side helper (answers.js) — held in ANY tier of the book', () => {
  const entry = (symbol, over = {}) => ({ kind: 'called_shot', direction: 'entry', symbol, slot: 'support', ...over });

  it('true for an ENTRY on a stock held in any tier (the crypto row included), false for a bench name or a stranger', () => {
    const doc = battle();
    for (const symbol of ['NVDA', 'MSFT', 'KO', 'BTC']) {
      expect(isEntryAlreadyHeld(entry(symbol), doc), `shot ${symbol}`).toBe(true);
      // The mint labels every entry a called shot (validate.js kindOfShot), so a "Confirmation entry" cannot be minted today;
      // the helper tests direction, not kind, and this row only pins that indifference (review EA-L3-3).
      expect(isEntryAlreadyHeld(entry(symbol, { kind: 'confirmation' }), doc), `kind-indifferent ${symbol}`).toBe(true);
    }
    for (const symbol of ['AMD', 'JPM', 'CVX']) expect(isEntryAlreadyHeld(entry(symbol), doc), symbol).toBe(false);
  });

  it('ANY tier, never the call\'s own slot: held in another tier than the one it names is still held', () => {
    const doc = battle();
    for (const slot of ['star', 'core', 'support']) expect(isEntryAlreadyHeld(entry('MSFT', { slot }), doc), slot).toBe(true); // MSFT sits in core
  });

  it('the seam\'s frozen book (freezeSwapBook) and a raw battle document answer alike', () => {
    const doc = battle();
    const frozen = freezeSwapBook(doc);
    for (const symbol of [...HELD, 'AMD', 'CVX']) expect(isEntryAlreadyHeld(entry(symbol), frozen), symbol).toBe(isEntryAlreadyHeld(entry(symbol), doc));
  });

  it('false for an EXIT (held or not), a pick, and a non-call', () => {
    const doc = battle();
    expect(isEntryAlreadyHeld({ kind: 'called_shot', direction: 'exit', symbol: 'TSLA', slot: 'star' }, doc)).toBe(false); // held exit
    expect(isEntryAlreadyHeld({ kind: 'called_shot', direction: 'exit', symbol: 'AMD', slot: 'star' }, doc)).toBe(false); // not-held exit (E's)
    expect(isEntryAlreadyHeld({ kind: 'pick', direction: null, symbol: null, swapOut: 'KO' }, doc)).toBe(false);
    expect(isEntryAlreadyHeld({ kind: 'pick', direction: 'entry', symbol: 'MSFT' }, doc)).toBe(false);
    expect(isEntryAlreadyHeld(null, doc)).toBe(false);
    expect(isEntryAlreadyHeld(undefined, doc)).toBe(false);
    expect(isEntryAlreadyHeld('MSFT', doc)).toBe(false);
  });

  it('a call whose direction is neither entry nor exit is not asked; and the helper says nothing about upside calls (it stays true for one) (review EA-L6-3)', () => {
    const doc = battle();
    for (const direction of [undefined, null, '', 'sideways']) expect(isEntryAlreadyHeld({ kind: 'called_shot', direction, symbol: 'MSFT', slot: 'support' }, doc), String(direction)).toBe(false);
    expect(isEntryAlreadyHeld(entry('MSFT', { heldAtMint: true }), doc)).toBe(true);
    expect(isEntryAlreadyHeld(entry('AMD', { heldAtMint: true }), doc)).toBe(false);
  });

  it('a book that cannot say proves nothing: null, no portfolio, no tier arrays, an empty symbol — false, never a claim', () => {
    for (const book of [null, undefined, {}, { portfolio: null }, { portfolio: {} }, { portfolio: { bench: { stocks: [] } } }, 'x']) {
      expect(isEntryAlreadyHeld(entry('MSFT'), book), JSON.stringify(book)).toBe(false);
    }
    expect(isEntryAlreadyHeld(entry(''), battle())).toBe(false);
    expect(isEntryAlreadyHeld(entry(null), battle())).toBe(false);
    // A readable but EMPTY book is a book that holds nothing.
    expect(isEntryAlreadyHeld(entry('MSFT'), { portfolio: { star: [], core: [], support: [] } })).toBe(false);
  });

  it('a hole in a tier array (a null or missing row) is skipped, never a throw: held rows around it still count', () => {
    const sparse = { portfolio: { star: [null, { symbol: 'TSLA' }], core: [undefined, {}], support: [{ symbol: 'KO' }, null] } };
    expect(isEntryAlreadyHeld(entry('TSLA'), sparse)).toBe(true);
    expect(isEntryAlreadyHeld(entry('KO'), sparse)).toBe(true);
    expect(isEntryAlreadyHeld(entry('AMD'), sparse)).toBe(false);
  });

  it('it is built on heldInAnyTier and is the exit helper\'s mirror: for one book no call is both "not held" and "already held"', () => {
    const doc = battle();
    for (const direction of ['entry', 'exit']) {
      for (const symbol of [...HELD, 'AMD', 'JPM']) {
        const call = { kind: 'called_shot', direction, symbol, slot: 'support' };
        expect(isEntryAlreadyHeld(call, doc) && isExitNotHeld(call, doc), `${direction} ${symbol}`).toBe(false);
        expect(isEntryAlreadyHeld(call, doc), `${direction} ${symbol}`).toBe(direction === 'entry' && heldInAnyTier(doc, symbol) === true);
      }
    }
  });
});

describe('F-1 — an entry on the check\'s own committed incoming stock is an upside call (heldAtMint)', () => {
  it('bought here: an entry on the committed symbolIn mints heldAtMint:true — an upside call, open, answerable by no one', () => {
    const c = mint({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: 'AMD' });
    const call = c.calls[0];
    expect(call.heldAtMint).toBe(true);
    expect(isUpsideCall(call)).toBe(true);
    expect(call.state).toBe('open'); // still a live record: it resolves hit / expires like any other
    expect(c.newOpen.map((x) => x.symbol)).toEqual(['AMD']);
    for (const answer of ALL_ANSWERS) expect(classifyAnswer(call, answer, { v2: true }), `v2 ${answer}`).toBeNull();
    for (const answer of ALL_ANSWERS) expect(classifyAnswer(call, answer), answer).toBeNull();
    expect(tileAnswersFor(call, { v2: true })).toEqual([]);
  });

  it('whichever slot, whichever default, whichever kind: every entry on the bought stock', () => {
    for (const slot of ['star', 'core', 'support']) {
      for (const defaultAction of ['act', 'hold']) {
        const call = firstCall({ shots: [entryShot({ symbol: 'AMD', slot, defaultAction, counterpart: null })], committedSymbolIn: 'AMD' });
        expect(call.heldAtMint, `${slot} ${defaultAction}`).toBe(true);
      }
    }
    const withCounterpart = firstCall({ shots: [entryShot({ symbol: 'AMD', counterpart: 'KO' })], committedSymbolIn: 'AMD' });
    expect([withCounterpart.heldAtMint, withCounterpart.counterpart]).toEqual([true, 'KO']); // a named counterpart is kept as D-7 keeps it
  });

  it('held at the seam: an entry on a stock the seam\'s book holds is an upside call, exactly as before (committedSymbolIn null)', () => {
    const call = firstCall({ shots: [entryShot({ symbol: 'TSLA', slot: 'star', counterpart: null })], committedSymbolIn: null });
    expect(call.heldAtMint).toBe(true);
    // and the same entry with a trade that bought something else changes nothing for it
    expect(firstCall({ shots: [entryShot({ symbol: 'TSLA', slot: 'star', counterpart: null })], committedSymbolIn: 'AMD' }).heldAtMint).toBe(true);
  });

  it('not held, not bought here: an ordinary entry (heldAtMint false), answerable as before', () => {
    const call = firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: null });
    expect(call.heldAtMint).toBe(false);
    expect(classifyAnswer(call, 'go')).toBe('ack');
    expect(classifyAnswer(call, 'hold')).toBe('directive');
    // a trade that bought a DIFFERENT stock does not turn AMD into an upside call
    expect(firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: 'JPM' }).heldAtMint).toBe(false);
  });

  it('a null matches nothing: no symbolIn, an empty one, a non-string one — none makes an entry an upside call', () => {
    for (const committedSymbolIn of [null, '', 0, {}, false]) {
      const call = firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn });
      expect(call.heldAtMint, JSON.stringify(committedSymbolIn)).toBe(false);
    }
  });

  it('only the call\'s own symbol matches: an entry whose NAMED COUNTERPART is the committed symbolIn is an ordinary entry (review EA-L6-4)', () => {
    const call = firstCall({ shots: [entryShot({ symbol: 'AMD', counterpart: 'KO' })], committedSymbolIn: 'KO' });
    expect([call.heldAtMint, call.counterpart]).toEqual([false, 'KO']);
  });

  it('F-1 does not depend on a known held set (the amendment\'s "or"): held:null + the committed symbolIn is still an upside call, and held:null alone is not (review EA-L3-1)', () => {
    expect(firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: 'AMD', held: null }).heldAtMint).toBe(true);
    expect(firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: null, held: null }).heldAtMint).toBe(false);
  });

  it('an EXIT on the committed symbolIn still mints open (Amendment E rev 3) and is never an upside call', () => {
    const bought = firstCall({ shots: [exitShot({ symbol: 'AMD', slot: 'star' })], committedSymbolIn: 'AMD' });
    expect([bought.state, bought.invalidatedReason, bought.heldAtMint]).toEqual(['open', null, false]);
    expect(isUpsideCall(bought)).toBe(false);
    // and with no trade committed that same exit is still dropped (E-1)
    const blocked = firstCall({ shots: [exitShot({ symbol: 'AMD', slot: 'star' })], committedSymbolIn: null });
    expect([blocked.state, blocked.invalidatedReason, blocked.heldAtMint]).toEqual(['invalidated', 'exit_not_held', false]);
  });

  it('a mixed block: only the entry on the bought stock is upside; the other entry, the exit and ordinals keep their ids and states', () => {
    const c = mint({
      shots: [entryShot({ symbol: 'AMD' }), entryShot({ symbol: 'JPM', counterpart: null }), exitShot({ symbol: 'TSLA' })],
      committedSymbolIn: 'AMD',
    });
    expect(c.calls.map((x) => [x.callId, x.symbol, x.direction, x.heldAtMint, x.state])).toEqual([
      ['battle-tick-1:eval_001:call:0', 'AMD', 'entry', true, 'open'],
      ['battle-tick-1:eval_001:call:1', 'JPM', 'entry', false, 'open'],
      ['battle-tick-1:eval_001:call:2', 'TSLA', 'exit', false, 'open'],
    ]);
  });

  it('the rule belongs to the mint, not to one mode: at shadow the bought stock\'s entry is upside too (off mints nothing at all)', () => {
    const call = firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: 'AMD', mintedMode: 'shadow' });
    expect([call.mintedMode, call.heldAtMint]).toEqual(['shadow', true]);
  });

  it('heldAtMint is IMMUTABLE and in the canonical form: flipping it changes what publication compares', () => {
    const c = mint({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: 'AMD' });
    const call = c.calls[0];
    expect(MUTABLE_CALL_FIELDS).not.toContain('heldAtMint');
    expect(c.canonical.calls[call.callId]).toContain('"heldAtMint":true');
    expect(canonicalCall({ ...call, heldAtMint: false })).not.toBe(c.canonical.calls[call.callId]);
  });

  it('an unknown executor outcome leaves no incoming stock, so F-1 does not mark the call (F-2 still withdraws its answers at answer time)', () => {
    const call = firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: null });
    expect(call.heldAtMint).toBe(false);
    // the live book holds the stock once the trade committed: the answer-time test says so
    const afterTrade = battle();
    afterTrade.portfolio.support = [...afterTrade.portfolio.support, { symbol: 'AMD', name: 'AMD' }];
    expect(isEntryAlreadyHeld(call, afterTrade)).toBe(true);
  });
});

describe('model-visible: the only change is data-dependent, and the bytes do not move (callsBlock.js)', () => {
  const NOW = MINT + 60_000;

  it('an F-1 call renders through the upside line, and that row\'s bytes equal the row the same record rendered as an ordinary entry', () => {
    const call = firstCall({ shots: [entryShot({ symbol: 'AMD' })], committedSymbolIn: 'AMD' });
    expect(call.heldAtMint).toBe(true);
    const ordinary = { ...call, heldAtMint: false };
    expect(renderCallsRow(call, { nowMs: NOW })).toBe(renderCallsRow(ordinary, { nowMs: NOW }));
    expect(renderCallsRow(call, { nowMs: NOW })).toBe(`- ${call.callId} · AMD above $165.24 by today's close · open`);
    expect(buildCallsBlock({ open: [call], history: [] }, { nowMs: NOW })).toBe(buildCallsBlock({ open: [ordinary], history: [] }, { nowMs: NOW }));
  });
});
