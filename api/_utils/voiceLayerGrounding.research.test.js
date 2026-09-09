// api/_utils/voiceLayerGrounding.research.test.js
//
// Phase C §1 (D-116) — the research chip: a STRUCTURED REQUEST, never a model's
// classification. The normalizer admits `{ kind:'research', symbol }` only when
// the caller hands it the battle (which chat.js does only under SHOW_IT_ENABLED)
// and only when the symbol is in that battle's universe.
//
// THIS FILE'S IMPORT OF voiceLayerGrounding.js IS THE DEPENDENCY-SURFACE GUARD
// (BUILD_RULES §4) for the module's new `src/data/battleUniverse.js` import: it
// runs in the Node test environment and explodes if a browser dependency ever
// enters that graph. It must NEVER be mocked.

import { describe, it, expect } from 'vitest';
import { normalizeSuggestedActions, RESEARCH_CHIP_BLOCK } from './voiceLayerGrounding.js';

const BATTLE = {
  portfolio: {
    star: [{ symbol: 'NVDA' }],
    core: [{ symbol: 'MSFT' }],
    support: [],
    bench: { stocks: [{ symbol: 'MPC' }] },
  },
  watchlist: { hotBench: ['RKLB'] },
  agentContext: { equippedWatchlist: { tickers: ['LLY'] } },
};

const research = (symbol) => [{ kind: 'research', symbol }];

describe('the research chip — the flag gate at the call site', () => {
  it('is DROPPED when no battle is handed over (the flag-dark path)', () => {
    expect(normalizeSuggestedActions(research('MPC'), 'analyst')).toBeNull();
    expect(normalizeSuggestedActions(research('MPC'), 'analyst', {})).toBeNull();
  });

  it('survives with the battle, carrying the kind and the symbol and nothing else', () => {
    expect(normalizeSuggestedActions(research('MPC'), 'analyst', { battle: BATTLE }))
      .toEqual([{ kind: 'research', symbol: 'MPC' }]);
  });
});

describe('the universe check (hazard 6 — never trust a model-supplied symbol)', () => {
  it('admits a book name, a bench name, a hot-bench name and an equipped name', () => {
    for (const symbol of ['NVDA', 'MSFT', 'MPC', 'RKLB', 'LLY']) {
      expect(normalizeSuggestedActions(research(symbol), 'analyst', { battle: BATTLE }))
        .toEqual([{ kind: 'research', symbol }]);
    }
  });

  it('DROPS a name outside the universe — the chip disappears rather than 404ing later', () => {
    expect(normalizeSuggestedActions(research('TSLA'), 'analyst', { battle: BATTLE })).toBeNull();
  });

  it('drops every non-string symbol', () => {
    for (const junk of [null, undefined, '', '  ', 7, {}, ['MPC']]) {
      expect(normalizeSuggestedActions(research(junk), 'analyst', { battle: BATTLE })).toBeNull();
    }
  });

  it('carries the UNIVERSE’S spelling, not the model’s bytes', () => {
    expect(normalizeSuggestedActions(research('  mpc '), 'analyst', { battle: BATTLE }))
      .toEqual([{ kind: 'research', symbol: 'MPC' }]);
  });

  it('drops a duplicate name, as a duplicate directive id is dropped', () => {
    const out = normalizeSuggestedActions(
      [{ kind: 'research', symbol: 'MPC' }, { kind: 'research', symbol: 'mpc' }],
      'analyst',
      { battle: BATTLE },
    );
    expect(out).toEqual([{ kind: 'research', symbol: 'MPC' }]);
  });
});

describe('the cap, at the mint (review B, closing note)', () => {
  const spent = (n) => ({ ...BATTLE, chatExchanges: Array.from({ length: n }, () => ({ messageType: 'research' })) });

  it('mints a research chip while a read is left', () => {
    expect(normalizeSuggestedActions(research('MPC'), 'analyst', { battle: spent(2) }))
      .toEqual([{ kind: 'research', symbol: 'MPC' }]);
  });

  it('DROPS it once the cap is spent — a chip is never a promise the route will refuse', () => {
    expect(normalizeSuggestedActions(research('MPC'), 'analyst', { battle: spent(3) })).toBeNull();
    expect(normalizeSuggestedActions(research('MPC'), 'analyst', { battle: spent(4) })).toBeNull();
  });

  it('the OTHER kinds still mint when the research cap is spent', () => {
    expect(normalizeSuggestedActions(
      ['What moved semis?', { kind: 'research', symbol: 'MPC' }],
      'analyst',
      { battle: spent(3) },
    )).toEqual([{ kind: 'ask', text: 'What moved semis?' }]);
  });
});

describe('the other kinds are untouched', () => {
  it('an ask chip and a bare string still normalize exactly as they did', () => {
    expect(normalizeSuggestedActions(['What moved semis?'], 'analyst', { battle: BATTLE }))
      .toEqual([{ kind: 'ask', text: 'What moved semis?' }]);
    expect(normalizeSuggestedActions([{ kind: 'ask', text: ' hi ' }], 'analyst', { battle: BATTLE }))
      .toEqual([{ kind: 'ask', text: 'hi' }]);
  });

  it('an unknown kind is still dropped, battle or no battle', () => {
    expect(normalizeSuggestedActions([{ kind: 'equip', symbol: 'MPC' }], 'analyst', { battle: BATTLE })).toBeNull();
  });

  it('mixed kinds keep their order', () => {
    const out = normalizeSuggestedActions(
      ['ask one', { kind: 'research', symbol: 'MPC' }, 'ask two'],
      'analyst',
      { battle: BATTLE },
    );
    expect(out).toEqual([
      { kind: 'ask', text: 'ask one' },
      { kind: 'research', symbol: 'MPC' },
      { kind: 'ask', text: 'ask two' },
    ]);
  });
});

describe('the block that OFFERS the third kind', () => {
  it('names the kind and its one field', () => {
    expect(RESEARCH_CHIP_BLOCK).toContain('"kind": "research"');
    expect(RESEARCH_CHIP_BLOCK).toContain('"symbol"');
  });

  it('forbids previewing the card and forbids a verdict — the model offers a screen, not an answer', () => {
    expect(RESEARCH_CHIP_BLOCK).toContain('offering a screen, not an answer');
    expect(RESEARCH_CHIP_BLOCK).toMatch(/not a recommendation to buy, sell, hold or exit/);
    expect(RESEARCH_CHIP_BLOCK).toContain('do NOT preview a number');
  });
});
