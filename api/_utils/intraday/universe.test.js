// api/_utils/intraday/universe.test.js — contract §4 universe and actionable set.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNIVERSE_STOCKS, INDEX_SYMBOLS, actionableFromBattles, toVendorStock, toVendorCrypto, isCryptoAsset } from './universe.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('the universe', () => {
  it('is the 255 real-time symbols of compute-index-intelligence (5 index + 11 sector ETFs + 239 stocks)', () => {
    expect(UNIVERSE_STOCKS).toHaveLength(255);
    expect(new Set(UNIVERSE_STOCKS).size).toBe(255);
    expect(Object.isFrozen(UNIVERSE_STOCKS)).toBe(true);
  });
  it('INDEX_SYMBOLS is pinned to compute-index-intelligence.js INDEX_SYMBOLS', () => {
    const src = readFileSync(path.resolve(HERE, '../../cron/compute-index-intelligence.js'), 'utf8');
    const block = src.slice(src.indexOf('const INDEX_SYMBOLS = ['), src.indexOf('];', src.indexOf('const INDEX_SYMBOLS = [')));
    const found = [...block.matchAll(/symbol:\s*'([A-Z]+)'/g)].map((m) => m[1]);
    expect(found).toEqual([...INDEX_SYMBOLS]);
  });
  it('vendor symbols: dots → hyphens + .US; crypto → -USD.CC', () => {
    expect(toVendorStock('BRK.B')).toBe('BRK-B.US');
    expect(toVendorStock('AAPL')).toBe('AAPL.US');
    expect(toVendorCrypto('BTC')).toBe('BTC-USD.CC');
    expect(toVendorCrypto('BTC-USD.CC')).toBe('BTC-USD.CC');
  });
});

describe('the actionable set — held ∪ bench across active battles, recomputed each sweep', () => {
  it('unions star/core/support and bench stocks + bench crypto across battles; crypto by flag or pool membership', () => {
    const battles = [
      { portfolio: { star: [{ symbol: 'NVDA' }], core: [{ symbol: 'MSFT' }], support: [{ symbol: 'KO' }, { symbol: 'BTC', isCrypto: true }], bench: { stocks: [{ symbol: 'AMD' }], crypto: { symbol: 'ETH' } } } },
      { portfolio: { star: [{ symbol: 'nvda ' }], core: [], support: [{ symbol: 'sol' }], bench: { stocks: [{ symbol: 'JPM' }, null], crypto: null } } },
      { portfolio: null },
    ];
    expect(actionableFromBattles(battles)).toEqual({ stocks: ['AMD', 'JPM', 'KO', 'MSFT', 'NVDA'], crypto: ['BTC', 'ETH', 'SOL'] });
    expect(isCryptoAsset({ symbol: 'DOGE' })).toBe(true);
    expect(isCryptoAsset({ symbol: 'AAPL' })).toBe(false);
    expect(actionableFromBattles([])).toEqual({ stocks: [], crypto: [] });
  });
});
