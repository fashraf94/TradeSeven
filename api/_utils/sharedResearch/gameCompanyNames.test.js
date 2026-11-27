// api/_utils/sharedResearch/gameCompanyNames.test.js
//
// Research universe Build 3b (review L2-1): the 228 game companies' names, as data. Pinned to the game list: every game
// symbol once, and nothing else; each a name. It is data only, read by sessionUniverse.js for ambiguity alone.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { GAME_COMPANY_NAMES } from './gameCompanyNames.js';
import { ALL_TICKERS } from '../rankingConfig.js';

const SRC = readFileSync(fileURLToPath(new URL('./gameCompanyNames.js', import.meta.url)), 'utf8');

describe('GAME_COMPANY_NAMES', () => {
  it('holds exactly the 228 game symbols, each once, frozen', () => {
    expect(Object.keys(GAME_COMPANY_NAMES).sort()).toEqual([...ALL_TICKERS].sort());
    expect(Object.keys(GAME_COMPANY_NAMES)).toHaveLength(228);
    expect(Object.isFrozen(GAME_COMPANY_NAMES)).toBe(true);
  });
  it('each value is a company name: a trimmed, non-empty string that is not its own symbol', () => {
    for (const [symbol, name] of Object.entries(GAME_COMPANY_NAMES)) {
      expect(typeof name === 'string' && name.trim() === name && name.length > 1, symbol).toBe(true);
      expect(name, symbol).not.toBe(symbol);
    }
  });
  it('is data only: no import, no code beyond the one frozen object', () => {
    expect(SRC).not.toMatch(/^\s*import\b/m);
    expect(SRC).not.toMatch(/\brequire\(/);
    expect(SRC.match(/^export /gm)).toHaveLength(1);
  });
});
