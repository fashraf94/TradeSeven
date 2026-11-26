// api/_utils/researchUniverse.test.js
//
// Research universe Build 1: the accessor (build prompt sections 3.2 and 4).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES section 4): this file's static import of researchUniverse.js IS the runtime
// guard that the module stays Node-clean (pure data and rankingConfig.js only), so src/ may import it in a later
// build. It must never be mocked here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  RESEARCH_DIRECTORY_COUNT, isResearchStock, researchIndustryOf, researchNameOf, researchSectorOf, researchUniverse,
} from './researchUniverse.js';
import { RESEARCH_DIRECTORY, RESEARCH_DIRECTORY_META } from './researchDirectory.js';
import {
  ALL_TICKERS, INDUSTRY_ETFS, RETIRED_STOCKS, SECTOR_ETFS, STOCK_UNIVERSE, TICKER_TO_SECTOR,
} from './rankingConfig.js';
import { gameUniverse, resolveSymbol } from './sharedResearch/companies.js';

const SRC = readFileSync(fileURLToPath(new URL('./researchUniverse.js', import.meta.url)), 'utf8');
const SECTOR_IDS = Object.keys(STOCK_UNIVERSE);
const DIRECTORY = Object.keys(RESEARCH_DIRECTORY);
const NOT_HELD = ['SPY', 'QQQ', 'RSP', 'VIX', 'XLK', 'SMH', 'IWM', 'NOTAREALSYM', '', ' AAPL', 'aapl', 'BRK.B', 'brk-b', null, undefined, 42, {}, ['AAPL']];
const PROTOTYPE_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 'isPrototypeOf'];

describe('the accessor is pure and imports only rankingConfig.js and researchDirectory.js', () => {
  it('has exactly those two imports', () => {
    const imports = [...SRC.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./rankingConfig.js', './researchDirectory.js']);
    expect(SRC).not.toMatch(/\bimport\s*\(|\brequire\s*\(/);
  });
  it('reads no clock, randomness, store, network or environment', () => {
    expect(SRC).not.toMatch(/Date\.|new Date|Math\.random|firestore|firebase|fetch\(|process\.|globalThis|window\./i);
  });
});

describe('researchUniverse has the shape of gameUniverse', () => {
  it('has the same keys, each a function of the same arity, and is frozen', () => {
    expect(Object.keys(researchUniverse)).toEqual(Object.keys(gameUniverse));
    for (const k of Object.keys(gameUniverse)) {
      expect(typeof researchUniverse[k]).toBe('function');
      expect(researchUniverse[k].length).toBe(gameUniverse[k].length);
    }
    expect(Object.isFrozen(researchUniverse)).toBe(true);
  });
  it('holds every one of the 228', () => {
    expect(ALL_TICKERS.length).toBe(228);
    for (const s of ALL_TICKERS) expect(researchUniverse.has(s)).toBe(true);
  });
  it('holds every directory entry', () => {
    for (const s of DIRECTORY) expect(researchUniverse.has(s)).toBe(true);
  });
  it.each(NOT_HELD.map((v) => [v]))('does not hold %j', (v) => {
    expect(researchUniverse.has(v)).toBe(false);
  });
  it.each(PROTOTYPE_KEYS.map((k) => [k]))('does not hold the prototype key %s', (k) => {
    expect(researchUniverse.has(k)).toBe(false);
    expect(isResearchStock(k)).toBe(false);
    expect(researchSectorOf(k)).toBeNull();
    expect(researchNameOf(k)).toBeNull();
    expect(researchIndustryOf(k)).toBeNull();
  });
  it('answers retired exactly as gameUniverse does', () => {
    for (const s of [...Object.keys(RETIRED_STOCKS), ...ALL_TICKERS, ...DIRECTORY.slice(0, 50), 'SMH', '', null]) {
      expect(researchUniverse.retired(s)).toBe(gameUniverse.retired(s));
    }
  });
  it('holds a retired stock only if the directory does', () => {
    for (const s of Object.keys(RETIRED_STOCKS)) expect(researchUniverse.has(s)).toBe(Object.hasOwn(RESEARCH_DIRECTORY, s));
  });
  it('works with resolveSymbol as the game universe does (normalise, then test)', () => {
    expect(resolveSymbol('glw', researchUniverse)).toBe('GLW');
    expect(resolveSymbol('brk.b', researchUniverse)).toBe('BRK-B');
    expect(resolveSymbol('aapl', researchUniverse)).toBe('AAPL');
    expect(resolveSymbol('SMH', researchUniverse)).toBeNull();
    expect(resolveSymbol('GLW')).toBeNull();
  });
});

describe('isResearchStock', () => {
  it('is true for every directory entry and false for every one of the 228', () => {
    for (const s of DIRECTORY) expect(isResearchStock(s)).toBe(true);
    for (const s of ALL_TICKERS) expect(isResearchStock(s)).toBe(false);
  });
  it.each(NOT_HELD.map((v) => [v]))('is false for %j', (v) => { expect(isResearchStock(v)).toBe(false); });
});

describe('researchSectorOf', () => {
  it('reads the house map for the 228', () => {
    for (const s of ALL_TICKERS) expect(researchSectorOf(s)).toBe(TICKER_TO_SECTOR[s]);
  });
  it('reads the directory otherwise, always one of the 11 sector ids', () => {
    for (const s of DIRECTORY) {
      expect(researchSectorOf(s)).toBe(RESEARCH_DIRECTORY[s][1]);
      expect(SECTOR_IDS).toContain(researchSectorOf(s));
    }
  });
  it('is null for the funds the house map labels with a sector (sector and industry funds), and for index symbols', () => {
    for (const s of [...SECTOR_ETFS, ...Object.values(INDUSTRY_ETFS).flat()]) {
      expect(TICKER_TO_SECTOR[s]).toBeDefined();
      expect(researchSectorOf(s)).toBeNull();
    }
    for (const s of ['SPY', 'QQQ', 'DIA', 'IWM', 'RSP', 'VIX']) expect(researchSectorOf(s)).toBeNull();
  });
  it('is null for a retired stock the directory does not hold, though the house map keeps its old sector', () => {
    for (const s of Object.keys(RETIRED_STOCKS)) {
      expect(TICKER_TO_SECTOR[s]).toBe(RETIRED_STOCKS[s]);
      expect(researchSectorOf(s)).toBe(Object.hasOwn(RESEARCH_DIRECTORY, s) ? RESEARCH_DIRECTORY[s][1] : null);
    }
  });
  it.each(NOT_HELD.map((v) => [v]))('is null for %j', (v) => { expect(researchSectorOf(v)).toBeNull(); });
});

describe('researchNameOf and researchIndustryOf read the directory only', () => {
  it('give the directory\'s name and industry for every entry', () => {
    for (const s of DIRECTORY) {
      expect(researchNameOf(s)).toBe(RESEARCH_DIRECTORY[s][0]);
      expect(researchIndustryOf(s)).toBe(RESEARCH_DIRECTORY[s][2]);
    }
  });
  it('are null for the 228 (the directory does not hold them)', () => {
    for (const s of ALL_TICKERS) {
      expect(researchNameOf(s)).toBeNull();
      expect(researchIndustryOf(s)).toBeNull();
    }
  });
  it.each(NOT_HELD.map((v) => [v]))('are null for %j', (v) => {
    expect(researchNameOf(v)).toBeNull();
    expect(researchIndustryOf(v)).toBeNull();
  });
});

describe('RESEARCH_DIRECTORY_COUNT', () => {
  it('is the directory\'s entry count and the count its header states', () => {
    expect(RESEARCH_DIRECTORY_COUNT).toBe(DIRECTORY.length);
    expect(RESEARCH_DIRECTORY_COUNT).toBe(RESEARCH_DIRECTORY_META.count);
  });
});

describe('the knowledge base\'s companies are research stocks', () => {
  // Their sectors are reported in docs/audits/20261126_BUILD_RESEARCH_DIRECTORY.md and deliberately not pinned.
  it.each([['GLW'], ['HPE'], ['ANET'], ['MRVL'], ['COHR'], ['CIEN'], ['VRT']])('%s is in the directory with a name and a house sector', (s) => {
    expect(isResearchStock(s)).toBe(true);
    expect(researchUniverse.has(s)).toBe(true);
    expect(researchNameOf(s)).toEqual(expect.any(String));
    expect(SECTOR_IDS).toContain(researchSectorOf(s));
  });
});
