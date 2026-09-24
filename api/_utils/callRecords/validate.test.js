// api/_utils/callRecords/validate.test.js
//
// Cockpit Build 0 — the calls validator (spec V1.3 §3.2): the mapping table,
// the caps, the ordinals, removal in source order, and the invalidation
// reason precedence. Every row asserts the exact removal list, so a reason
// that silently changes, or a row that silently survives, goes red.

import { describe, it, expect } from 'vitest';
import {
  validateDeclarations, invalidationReason, kindOfShot, DECLARATION_CAPS, CALL_KINDS, REMOVAL_REASONS,
  INVALIDATION_REASONS, jsonBytes, removedRecordFields, RECORD_BOOKKEEPING_ALLOWANCE_BYTES,
} from './validate.js';
import { makeDeclarations, makeMaximalDeclarations } from '../__fixtures__/tickStampsHarness.js';
import { CALL_KINDS as CAPTURE_CALL_KINDS } from '../tickCapture/captureConfig.js';

const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM'];
const shot = (over = {}) => ({
  symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO',
  condition: { side: 'above', level: 163.5 }, horizonPhrase: 'this_session', defaultAction: 'act',
  said: 'AMD into Support if it holds.', ...over,
});
const fork = (over = {}) => ({
  slot: 'support', swapOut: 'KO', options: [{ symbol: 'AMD', why: 'strength' }, { symbol: 'JPM', why: 'defense' }],
  said: 'Support slot: AMD or JPM?', ...over,
});
const ask = (over = {}) => ({ question: 'Hold AMD through the print?', options: ['yes', 'no'], ...over });
const run = (block, ctx = {}) => validateDeclarations(block, { universe: UNIVERSE, ...ctx });

describe('absent, null and non-object blocks', () => {
  it('absent or null → phase none, nothing born, nothing removed', () => {
    for (const block of [undefined, null]) {
      expect(run(block)).toEqual({ validated: null, removed: [], calls: [], phase: 'none' });
    }
  });

  it('a non-object block → malformed_block: nothing born, no record', () => {
    for (const block of ['declarations', 42, true, [], [shot()]]) {
      expect(run(block)).toEqual({ validated: null, removed: [{ source: 'block', index: null, reason: 'malformed_block' }], calls: [], phase: 'none' });
    }
  });

  it('an object with nothing in it → none (no typed content survives)', () => {
    expect(run({})).toEqual({ validated: null, removed: [], calls: [], phase: 'none' });
    expect(run({ calledShots: [], watching: [], playerAsk: null, fork: null }).phase).toBe('none');
  });
});

describe('THE MAPPING — the three kinds, and nothing else', () => {
  it('entry → called_shot · exit+act → confirmation · exit+hold → called_shot · fork → pick', () => {
    const r = run({
      calledShots: [
        shot(),
        shot({ symbol: 'TSLA', direction: 'exit', slot: 'star', counterpart: undefined, defaultAction: 'act', condition: { side: 'below', level: 240 } }),
        shot({ symbol: 'KO', direction: 'exit', defaultAction: 'hold', condition: { side: 'below', level: 60 } }),
      ],
      fork: fork(),
    });
    expect(r.calls.map((c) => [c.n, c.kind, c.source])).toEqual([
      [0, 'called_shot', 'calledShots'], [1, 'confirmation', 'calledShots'], [2, 'called_shot', 'calledShots'], [3, 'pick', 'fork'],
    ]);
    expect(r.phase).toBe('expected');
    for (const c of r.calls) expect(CALL_KINDS).toContain(c.kind);
  });

  it('CALL_KINDS is the contract §1 set, from ONE source shared with capture', () => {
    expect(CALL_KINDS).toEqual(['called_shot', 'confirmation', 'pick']);
    expect(CALL_KINDS).toBe(CAPTURE_CALL_KINDS);
    expect(kindOfShot({ direction: 'entry', defaultAction: 'hold' })).toBe('called_shot');
  });

  it('watching and playerAsk go to the record only — no call is born from them', () => {
    const r = run({ watching: ['JPM', 'AMD'], playerAsk: ask() });
    expect(r.phase).toBe('expected');
    expect(r.calls).toEqual([]);
    expect(r.validated).toEqual({ calledShots: [], watching: ['JPM', 'AMD'], playerAsk: { question: 'Hold AMD through the print?', options: ['yes', 'no'] }, fork: null });
  });
});

describe('malformed — the row, never its siblings', () => {
  const required = ['symbol', 'direction', 'slot', 'condition', 'horizonPhrase', 'defaultAction', 'said'];
  for (const field of required) {
    it(`a shot missing required \`${field}\` is removed malformed; its siblings survive and keep their order`, () => {
      const broken = shot({ symbol: 'JPM' });
      delete broken[field];
      const r = run({ calledShots: [shot({ symbol: 'NVDA' }), broken, shot({ symbol: 'MSFT' })] });
      expect(r.removed).toEqual([{ source: 'calledShots', index: 1, reason: 'malformed' }]);
      expect(r.calls.map((c) => [c.n, c.row.symbol])).toEqual([[0, 'NVDA'], [1, 'MSFT']]);
    });
  }

  it('wrong-typed or out-of-enum fields are malformed', () => {
    const bad = [
      shot({ symbol: 7 }), shot({ symbol: '  ' }), shot({ direction: 'buy' }), shot({ slot: 'bench' }), shot({ slot: 'Support' }),
      shot({ counterpart: 9 }), shot({ condition: { side: 'up', level: 1 } }), shot({ condition: { side: 'above', level: '163' } }),
      shot({ condition: { side: 'above' } }), shot({ condition: 'above 163' }), shot({ horizonPhrase: 'tomorrow' }),
      shot({ defaultAction: 'maybe' }), shot({ said: '' }), shot({ said: 12 }), 'a string row', null,
    ];
    const r = run({ calledShots: bad });
    expect(r.removed).toEqual(bad.map((_, index) => ({ source: 'calledShots', index, reason: 'malformed' })));
    expect(r.phase).toBe('none');
  });

  it('`explicit` without a valid expiresAtMs is malformed; with one it is kept, and expiresAtMs rides only with explicit', () => {
    const r = run({ calledShots: [
      shot({ horizonPhrase: 'explicit' }),
      shot({ horizonPhrase: 'explicit', expiresAtMs: 'soon' }),
      shot({ horizonPhrase: 'explicit', expiresAtMs: Infinity }),
      shot({ horizonPhrase: 'explicit', expiresAtMs: 1_900_000_000_000 }),
      shot({ horizonPhrase: 'this_session', expiresAtMs: 1_900_000_000_000 }),
    ] });
    expect(r.removed.map((x) => [x.index, x.reason])).toEqual([[0, 'malformed'], [1, 'malformed'], [2, 'malformed']]);
    expect(r.calls[0].row.expiresAtMs).toBe(1_900_000_000_000);
    expect(r.calls[1].row).not.toHaveProperty('expiresAtMs');
  });

  it('a PRESENT non-finite level is NOT malformed — the shot is born (it mints invalidated)', () => {
    const r = run({ calledShots: [shot({ condition: { side: 'above', level: Infinity } }), shot({ condition: { side: 'below', level: NaN } })] });
    expect(r.removed).toEqual([]);
    expect(r.calls).toHaveLength(2);
  });

  it('a null counterpart / playerAsk symbol is treated as absent', () => {
    const r = run({ calledShots: [shot({ counterpart: null })], playerAsk: ask({ symbol: null }) });
    expect(r.removed).toEqual([]);
    expect(r.calls[0].row).not.toHaveProperty('counterpart');
    expect(r.validated.playerAsk).not.toHaveProperty('symbol');
  });

  it('a BLANK optional string (counterpart, playerAsk symbol) is absent too — the key dropped, the row kept (review A-3)', () => {
    for (const blank of ['', '   ']) {
      const r = run({ calledShots: [shot({ counterpart: blank })], playerAsk: ask({ symbol: blank }) });
      expect(r.removed).toEqual([]);
      expect(r.calls[0].row).not.toHaveProperty('counterpart');
      expect(r.validated.calledShots[0]).not.toHaveProperty('counterpart');
      expect(r.validated.playerAsk).not.toHaveProperty('symbol');
    }
    // A blank REQUIRED string is still malformed.
    expect(run({ calledShots: [shot({ symbol: '' })] }).removed).toEqual([{ source: 'calledShots', index: 0, reason: 'malformed' }]);
  });

  it('a string with a LONE surrogate is malformed wherever text is required — it cannot be stored as UTF-8; a surrogate PAIR is text (review E-4)', () => {
    const lone = ['\uD83D', '\uDE00', 'AMD \uD83D holds', 'x\uDE00y'];
    const r = run({ calledShots: [...lone.map((said) => shot({ said })), shot({ said: 'AMD \uD83D\uDE00 holds' })] });
    expect(r.removed).toEqual(lone.map((_, index) => ({ source: 'calledShots', index, reason: 'malformed' })));
    expect(r.calls.map((c) => c.row.said)).toEqual(['AMD \uD83D\uDE00 holds']);
    expect(run({ calledShots: [shot({ counterpart: 'K\uDC00O' })] }).removed).toEqual([{ source: 'calledShots', index: 0, reason: 'malformed' }]);
    expect(run({ watching: ['NVDA\uD800'] }).removed).toEqual([{ source: 'watching', index: 0, reason: 'malformed' }]);
    expect(run({ playerAsk: ask({ options: ['yes', 'n\uDFFFo'] }) }).removed).toEqual([{ source: 'playerAsk', index: null, reason: 'malformed' }]);
    expect(run({ fork: fork({ said: '\uDBFF?' }) }).removed).toEqual([{ source: 'fork', index: null, reason: 'malformed' }]);
  });

  it('a wrong-typed array field is malformed as a whole field', () => {
    const r = run({ calledShots: 'x', watching: { a: 1 }, playerAsk: ask() });
    expect(r.removed).toEqual([
      { source: 'calledShots', index: null, reason: 'malformed' },
      { source: 'watching', index: null, reason: 'malformed' },
    ]);
    expect(r.phase).toBe('expected');
  });
});

describe('fork and playerAsk — the options rules', () => {
  it('a fork with fewer than two options, or an option outside the battle universe, is removed', () => {
    expect(run({ fork: fork({ options: [{ symbol: 'AMD', why: 'x' }] }) }).removed).toEqual([{ source: 'fork', index: null, reason: 'too_few_options' }]);
    expect(run({ fork: fork({ options: [{ symbol: 'AMD', why: 'x' }, { symbol: 'HOOD', why: 'y' }] }) }).removed).toEqual([{ source: 'fork', index: null, reason: 'outside_universe' }]);
    // Exact membership — the universe's own spelling, never a case fold.
    expect(run({ fork: fork({ options: [{ symbol: 'amd', why: 'x' }, { symbol: 'JPM', why: 'y' }] }) }).removed[0].reason).toBe('outside_universe');
  });

  it('a fork option missing `why`, a fork without swapOut or said, is malformed', () => {
    for (const bad of [fork({ options: [{ symbol: 'AMD' }, { symbol: 'JPM', why: 'y' }] }), fork({ swapOut: undefined }), fork({ said: '' }), fork({ slot: 'bench' })]) {
      expect(run({ fork: bad }).removed).toEqual([{ source: 'fork', index: null, reason: 'malformed' }]);
    }
  });

  it('a playerAsk with fewer than two options is removed; a non-string option is malformed', () => {
    expect(run({ playerAsk: ask({ options: ['only'] }) }).removed).toEqual([{ source: 'playerAsk', index: null, reason: 'too_few_options' }]);
    expect(run({ playerAsk: ask({ options: ['a', 3] }) }).removed).toEqual([{ source: 'playerAsk', index: null, reason: 'malformed' }]);
  });
});

describe('THE CAPS — removed as oversize, never rewritten', () => {
  const c = (n) => 'c'.repeat(n);
  it('said ≤ 280 · why ≤ 140 · question ≤ 200 · option ≤ 60 (code points), each at the boundary and one past', () => {
    expect(run({ calledShots: [shot({ said: c(280) })] }).removed).toEqual([]);
    expect(run({ calledShots: [shot({ said: c(281) })] }).removed[0].reason).toBe('oversize');
    // A 280-emoji `said` is 280 code points — not 560 UTF-16 units.
    expect(run({ calledShots: [shot({ said: '🚀'.repeat(280) })] }).removed).toEqual([]);
    expect(run({ fork: fork({ options: [{ symbol: 'AMD', why: c(140) }, { symbol: 'JPM', why: 'y' }] }) }).removed).toEqual([]);
    expect(run({ fork: fork({ options: [{ symbol: 'AMD', why: c(141) }, { symbol: 'JPM', why: 'y' }] }) }).removed[0].reason).toBe('oversize');
    expect(run({ playerAsk: ask({ question: c(200) }) }).removed).toEqual([]);
    expect(run({ playerAsk: ask({ question: c(201) }) }).removed[0].reason).toBe('oversize');
    expect(run({ playerAsk: ask({ options: [c(60), 'b'] }) }).removed).toEqual([]);
    expect(run({ playerAsk: ask({ options: [c(61), 'b'] }) }).removed[0].reason).toBe('oversize');
  });

  it('≤ 6 shots: the 7th valid shot is removed oversize (source order), and a malformed one never uses a place', () => {
    const shots = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((s) => shot({ symbol: s }));
    shots.splice(2, 0, shot({ slot: 'nope' }));
    const r = run({ calledShots: shots });
    expect(r.removed).toEqual([{ source: 'calledShots', index: 2, reason: 'malformed' }, { source: 'calledShots', index: 7, reason: 'oversize' }]);
    expect(r.calls.map((x) => x.row.symbol)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  it('≤ 6 watching · ≤ 4 fork options · ≤ 4 ask options', () => {
    const r = run({ watching: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] });
    expect(r.removed).toEqual([{ source: 'watching', index: 6, reason: 'oversize' }, { source: 'watching', index: 7, reason: 'oversize' }]);
    const five = ['AMD', 'JPM', 'NVDA', 'MSFT', 'KO'].map((symbol) => ({ symbol, why: 'x' }));
    expect(run({ fork: fork({ options: five }) }).removed).toEqual([{ source: 'fork', index: null, reason: 'oversize' }]);
    expect(run({ fork: fork({ options: five.slice(0, 4) }) }).removed).toEqual([]);
    expect(run({ playerAsk: ask({ options: ['a', 'b', 'c', 'd', 'e'] }) }).removed).toEqual([{ source: 'playerAsk', index: null, reason: 'oversize' }]);
  });

  it('the declarations document ≤ 16 KB: a row that would cross the cap is removed oversize; later rows that fit survive', () => {
    const huge = shot({ symbol: 'X'.repeat(17_000) });
    const r = run({ calledShots: [shot({ symbol: 'NVDA' }), huge, shot({ symbol: 'MSFT' })], watching: ['JPM'] });
    expect(r.removed).toEqual([{ source: 'calledShots', index: 1, reason: 'oversize' }]);
    expect(r.calls.map((x) => [x.n, x.row.symbol])).toEqual([[0, 'NVDA'], [1, 'MSFT']]);
    expect(jsonBytes(r.validated)).toBeLessThanOrEqual(DECLARATION_CAPS.declarationsDocBytes);
  });

  it('the cap is the record AS STORED: the bounded removal list and the identity allowance count, and bookkeeping never evicts a valid row (review E-2)', () => {
    const junk = Array.from({ length: 1_200 }, () => ({}));
    const r = run({ calledShots: [shot({ symbol: 'NVDA' }), ...junk, shot({ symbol: 'MSFT' })], watching: ['JPM', ...Array(1_250).fill(0)] });
    expect(r.calls.map((c) => c.row.symbol)).toEqual(['NVDA', 'MSFT']);
    expect(r.validated.watching).toEqual(['JPM']);
    expect(r.removed.every((x) => x.reason === 'malformed')).toBe(true);
    expect(r.removed).toHaveLength(1_200 + 1_250);
    const stored = jsonBytes({ ...r.validated, ...removedRecordFields(r.removed) }) + RECORD_BOOKKEEPING_ALLOWANCE_BYTES;
    expect(stored).toBeLessThanOrEqual(DECLARATION_CAPS.declarationsDocBytes);
  });

  it('removedRecordFields: the first 16 removals listed in source order, the rest counted per (source, reason) — never an overflow key when nothing overflows', () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({ source: 'watching', index: i, reason: 'malformed' })),
      ...Array.from({ length: 3 }, (_, i) => ({ source: 'calledShots', index: i, reason: 'oversize' })),
      { source: 'fork', index: null, reason: 'too_few_options' },
    ];
    const out = removedRecordFields([...rows].reverse());
    expect(out.removed).toEqual([...rows.slice(20, 23), ...rows.slice(0, 13)]);
    expect(out.removedOverflow).toEqual([{ source: 'watching', reason: 'malformed', count: 7 }, { source: 'fork', reason: 'too_few_options', count: 1 }]);
    expect(removedRecordFields(rows.slice(0, 16))).toEqual({ removed: rows.slice(0, 16) });
    expect(removedRecordFields([])).toEqual({ removed: [] });
  });

  it('the largest block the caps admit survives whole (the output-size fixture is a VALID block)', () => {
    const r = run(makeMaximalDeclarations());
    expect(r.removed).toEqual([]);
    expect(r.calls).toHaveLength(7);
    expect(jsonBytes(r.validated)).toBeLessThan(DECLARATION_CAPS.declarationsDocBytes);
  });

  it('a surviving row is kept EXACTLY as declared (projection onto typed fields; no value edited)', () => {
    const declared = makeDeclarations();
    const r = run(declared);
    expect(r.validated.calledShots).toEqual(declared.calledShots);
    expect(r.validated.watching).toEqual(declared.watching);
    const extra = run({ calledShots: [{ ...shot(), confidence: 99, note: 'model free text' }] });
    expect(extra.calls[0].row).toEqual(shot());
  });
});

describe('the horizon check (injected) and the ordinals after removal', () => {
  it('a horizon failure removes the row with the resolver\'s reason, and ordinals are assigned after it', () => {
    const resolveHorizon = (phrase, expiresAtMs) => (
      phrase === 'explicit' && expiresAtMs < 100 ? { reason: 'explicit_invalid' }
        : phrase === 'next_check' ? { reason: 'no_slot_before_battle_end' }
          : { expiresAtMs: 1000, basis: phrase }
    );
    const r = run({
      calledShots: [shot({ symbol: 'A' }), shot({ symbol: 'B', horizonPhrase: 'explicit', expiresAtMs: 50 }), shot({ symbol: 'C' }), shot({ symbol: 'D', horizonPhrase: 'next_check' })],
      fork: fork(),
    }, { resolveHorizon });
    expect(r.removed).toEqual([
      { source: 'calledShots', index: 1, reason: 'explicit_invalid' },
      { source: 'calledShots', index: 3, reason: 'no_slot_before_battle_end' },
      { source: 'fork', index: null, reason: 'no_slot_before_battle_end' },
    ]);
    expect(r.calls.map((x) => [x.n, x.row.symbol])).toEqual([[0, 'A'], [1, 'C']]);
    expect(r.calls[0].horizon).toEqual({ expiresAtMs: 1000, basis: 'this_session' });
  });

  it('every removal reason used is in the typed vocabulary', () => {
    const r = run({ calledShots: [shot({ slot: 'x' }), shot({ said: 'x'.repeat(300) })], fork: fork({ options: [] }) });
    for (const x of r.removed) expect(REMOVAL_REASONS).toContain(x.reason);
  });

  it('a fully removed block stamps none — the reasons stay in the removal list', () => {
    const r = run({ calledShots: [shot({ slot: 'x' })], playerAsk: ask({ options: [] }) });
    expect(r.phase).toBe('none');
    expect(r.validated).toBeNull();
    expect(r.removed).toHaveLength(2);
  });
});

describe('invalidationReason — precedence no_observation → level_non_finite → level_implausible', () => {
  const obs = { symbols: { AMD: { px: 162, fetchedAtMs: 1 } } };
  it('no admitted observation of the symbol → no_observation, even when the level is ALSO non-finite', () => {
    expect(invalidationReason(shot({ symbol: 'JPM' }), obs)).toBe('no_observation');
    expect(invalidationReason(shot({ symbol: 'JPM', condition: { side: 'above', level: Infinity } }), obs)).toBe('no_observation');
    expect(invalidationReason(shot(), null)).toBe('no_observation');
    expect(invalidationReason(shot(), { symbols: { AMD: { px: 0 } } })).toBe('no_observation');
  });
  it('observed, non-finite level → level_non_finite, even when it would ALSO be implausible', () => {
    expect(invalidationReason(shot({ condition: { side: 'above', level: Infinity } }), obs)).toBe('level_non_finite');
    expect(invalidationReason(shot({ condition: { side: 'above', level: NaN } }), obs)).toBe('level_non_finite');
  });
  it('|level − px| / px > 0.25 → level_implausible; exactly 0.25 is plausible', () => {
    expect(invalidationReason(shot({ condition: { side: 'above', level: 162 * 1.25 } }), obs)).toBeNull();
    expect(invalidationReason(shot({ condition: { side: 'above', level: 162 * 1.2501 } }), obs)).toBe('level_implausible');
    expect(invalidationReason(shot({ condition: { side: 'below', level: 162 * 0.7499 } }), obs)).toBe('level_implausible');
    expect(invalidationReason(shot(), obs)).toBeNull();
  });
  it('the reasons are the typed vocabulary, in precedence order', () => {
    expect(INVALIDATION_REASONS).toEqual(['no_observation', 'level_non_finite', 'level_implausible']);
  });
});
