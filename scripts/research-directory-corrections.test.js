// scripts/research-directory-corrections.test.js
//
// Research universe Build 2, PR A: THE NAMED CORRECTIONS LIST (rulings RU-6, RU-7, RU-8, RU-11, RU-13, RU-14).
// Three parts: the list itself (exactly what the rulings name, well formed, data only); the generator applying each
// kind of correction on fixtures (stale, no effect, a restored symbol that still fails a filter, the run report, the
// header, the entered / left / changed list); and the committed directory carrying every correction. No row makes a
// network call.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TICKERS, RETIRED_STOCKS } from '../api/_utils/rankingConfig.js';
import { RESEARCH_DIRECTORY, RESEARCH_DIRECTORY_META } from '../api/_utils/researchDirectory.js';
import { DIRECTORY_CORRECTIONS } from './research-directory-corrections.mjs';
import {
  HOUSE_SECTOR_IDS, KEPT_EXCHANGES, LEAVE_OUT_KINDS, NO_CORRECTIONS, buildDirectory, diffDirectories,
  parseDirectoryModuleEntries, renderDirectoryModule, runMain, validateCorrections,
} from './build-research-directory.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIST_SRC = readFileSync(path.join(HERE, 'research-directory-corrections.mjs'), 'utf8');

const row = (code, mv, over = {}) => ({ code, name: `${code} Corp`, market_capitalization: mv, sector: 'Technology', industry: 'Software', exchange: 'US', ...over });
const listing = (Code, Exchange = 'NYSE', Type = 'Common Stock', Name = `${Code} Corp`) => ({ Code, Name, Country: 'USA', Exchange, Currency: 'USD', Type, Isin: null });
const entry = (symbol, extra = {}) => ({ symbol, ruling: 'RU-7', reason: 'a reason', ...extra });

// -- 1. The list --------------------------------------------------------------------------------------------------

describe('the list holds exactly what the rulings name', () => {
  const symbolsOf = (kind) => DIRECTORY_CORRECTIONS.leaveOut.filter((e) => e.kind === kind).map((e) => e.symbol).sort();
  it('RU-6: the 14 closed-end funds the vendor types Common Stock are left out', () => {
    expect(symbolsOf('closed_end_fund')).toEqual(['BCAT', 'BTT', 'CET', 'DXYZ', 'ECAT', 'FSCO', 'GAM', 'HQH', 'NBXG', 'PDO', 'PSUS', 'RVT', 'STEW', 'TY']);
    for (const e of DIRECTORY_CORRECTIONS.leaveOut.filter((x) => x.kind === 'closed_end_fund')) expect(e.ruling).toBe('RU-6');
  });
  it('RU-7: the two debentures and the shell are left out', () => {
    expect(symbolsOf('debt')).toEqual(['AFGE', 'DTW']);
    expect(symbolsOf('shell')).toEqual(['VYLR']);
  });
  it('RU-13: the second share classes of game stocks are left out, each naming a game stock that is one of the 228', () => {
    expect(symbolsOf('game_share_class')).toEqual(['BRK-A', 'FOX', 'LEN-B', 'NWSA']);
    const sibling = { 'BRK-A': 'BRK-B', FOX: 'FOXA', 'LEN-B': 'LEN', NWSA: 'NWS' };
    for (const e of DIRECTORY_CORRECTIONS.leaveOut.filter((x) => x.kind === 'game_share_class')) {
      expect(e.ruling).toBe('RU-13');
      expect(ALL_TICKERS).toContain(sibling[e.symbol]);
      expect(e.reason).toContain(`the game holds ${sibling[e.symbol]}`);
    }
  });
  it('RU-7: two sector fixes, LION to XLC Entertainment and XXI to XLF Capital Markets', () => {
    expect(DIRECTORY_CORRECTIONS.sectorFix.map(({ symbol, sector, industry }) => [symbol, sector, industry]))
      .toEqual([['LION', 'XLC', 'Entertainment'], ['XXI', 'XLF', 'Capital Markets']]);
  });
  it('RU-11: Moog class B and Farmer Mac class A are restored, and nothing else', () => {
    expect(DIRECTORY_CORRECTIONS.restore.map((e) => [e.symbol, e.ruling])).toEqual([['MOG-B', 'RU-11'], ['AGM-A', 'RU-11']]);
  });
  it('RU-8: one venue, BATS', () => {
    expect(DIRECTORY_CORRECTIONS.venues.map((v) => [v.exchange, v.ruling])).toEqual([['BATS', 'RU-8']]);
  });
  it('21 leave-outs in all, and no business development company among them (RU-6: they stay)', () => {
    expect(DIRECTORY_CORRECTIONS.leaveOut).toHaveLength(21);
    const bdcs = ['ARCC', 'BXSL', 'CSWC', 'FSK', 'GBDC', 'HTGC', 'MAIN', 'MSDL', 'OBDC', 'OCSL', 'OTF', 'TRIN', 'TSLX'];
    for (const s of bdcs) expect(DIRECTORY_CORRECTIONS.leaveOut.map((e) => e.symbol)).not.toContain(s);
  });
  it('is well formed against the real 228 (every entry has a ruling and a one-line reason)', () => {
    expect(validateCorrections(DIRECTORY_CORRECTIONS)).toBe(true);
    for (const list of Object.values(DIRECTORY_CORRECTIONS)) for (const e of list) expect(e.reason).not.toMatch(/\n/);
  });
  it('is a data-only module: no import, frozen all the way down', () => {
    expect(LIST_SRC).not.toMatch(/^\s*import\b|\bimport\s*\(|\brequire\s*\(|process\.|fetch\(/m);
    expect([...LIST_SRC.matchAll(/^export const (\w+)/gm)].map((m) => m[1])).toEqual(['DIRECTORY_CORRECTIONS']);
    expect(Object.isFrozen(DIRECTORY_CORRECTIONS)).toBe(true);
    for (const list of Object.values(DIRECTORY_CORRECTIONS)) {
      expect(Object.isFrozen(list)).toBe(true);
      for (const e of list) expect(Object.isFrozen(e)).toBe(true);
    }
  });
});

describe('validateCorrections refuses a malformed list (a run with one writes nothing)', () => {
  const base = () => ({ leaveOut: [], sectorFix: [], restore: [], venues: [] });
  it.each([
    ['a symbol named twice', { ...base(), leaveOut: [entry('ABC', { kind: 'shell' })], restore: [entry('ABC')] }, /already named/],
    ['one of the 228', { ...base(), leaveOut: [entry('AAPL', { kind: 'shell' })] }, /one of the 228/],
    ['an unknown leave-out kind', { ...base(), leaveOut: [entry('ABC', { kind: 'fund' })] }, /unknown kind/],
    ['a sector that is not a house id', { ...base(), sectorFix: [entry('ABC', { sector: 'Tech', industry: 'Software' })] }, /not a house sector id/],
    ['a sector fix with no industry', { ...base(), sectorFix: [entry('ABC', { sector: 'XLK', industry: ' ' })] }, /no industry/],
    ['no reason', { ...base(), restore: [entry('ABC', { reason: '' })] }, /no reason/],
    ['no ruling', { ...base(), restore: [entry('ABC', { ruling: undefined })] }, /no ruling/],
    ['a symbol not in house spelling', { ...base(), restore: [entry('brk.b')] }, /malformed symbol/],
    ['a venue already kept', { ...base(), venues: [{ exchange: 'NYSE', ruling: 'RU-8', reason: 'r' }] }, /already kept/],
    ['a list missing', { leaveOut: [], sectorFix: [], restore: [] }, /venues is not a list/],
  ])('%s', (_t, list, msg) => {
    expect(() => validateCorrections(list)).toThrow(msg);
    expect(() => buildDirectory({ screenerRows: [], exchangeList: [], corrections: list })).toThrow(/nothing written/);
  });
  it('the kinds are the four the list uses', () => {
    expect(LEAVE_OUT_KINDS).toEqual(['closed_end_fund', 'debt', 'shell', 'game_share_class']);
  });
});

// -- 2. The generator applies each kind ------------------------------------------------------------------------------

describe('the generator applies each kind of correction (fixtures)', () => {
  const ESL = [
    listing('GLW'), listing('CEF1'), listing('DBT1'), listing('SHL1'), listing('BRK-A'), listing('LION'), listing('DRP1', 'PINK'),
    listing('MOG-B', 'NYSE', 'Preferred Stock'), listing('PFX-A', 'NYSE', 'Preferred Stock'), listing('NSC-B', 'NYSE', 'Preferred Stock'),
    listing('NNM-B', 'NYSE', 'Preferred Stock', ''), listing('RCOM'), listing('OTB-B', 'OTCQX', 'Preferred Stock'),
    listing('CBOE', 'BATS'), listing('EZU', 'BATS', 'ETF'), listing('QXQX', 'OTCQX'), listing('BTSX', 'BATS'),
  ];
  const SCREENER = [
    row('GLW', 3e10), row('CEF1', 5e9, { sector: 'Financial Services', industry: 'Asset Management' }), row('DBT1', 5e9), row('SHL1', 5e9),
    row('BRK.A', 9e11, { sector: 'Financial Services' }), row('LION', 4e9, { sector: 'Financial Services', industry: 'Shell Companies' }),
    row('DRP1', 5e9), row('MOG-B', 1e10, { sector: 'Industrials', industry: 'Aerospace & Defense' }), row('PFX-A', 5e9),
    row('NSC-B', 5e9, { sector: '' }), row('NNM-B', 5e9, { name: '' }), row('RCOM', 5e9), row('OTB-B', 5e9),
    row('CBOE', 3.7e10, { sector: 'Financial Services', industry: 'Financial Data & Stock Exchanges' }), row('EZU', 7e9, { sector: '' }),
    row('QXQX', 5e9), row('BTSX', 2e9, { sector: 'Other' }),
  ];
  const CORRECTIONS = {
    leaveOut: [
      entry('CEF1', { kind: 'closed_end_fund', ruling: 'RU-6' }), entry('DBT1', { kind: 'debt' }), entry('SHL1', { kind: 'shell' }),
      entry('BRK-A', { kind: 'game_share_class', ruling: 'RU-13' }), entry('DRP1', { kind: 'shell' }), entry('GNE1', { kind: 'debt' }),
    ],
    sectorFix: [entry('LION', { sector: 'XLC', industry: 'Entertainment' }), entry('GNE2', { sector: 'XLF', industry: 'Capital Markets' })],
    restore: [entry('MOG-B', { ruling: 'RU-11' }), entry('NSC-B', { ruling: 'RU-11' }), entry('NNM-B', { ruling: 'RU-11' }),
      entry('RCOM', { ruling: 'RU-11' }), entry('OTB-B', { ruling: 'RU-11' }), entry('GNE3', { ruling: 'RU-11' })],
    venues: [{ exchange: 'BATS', ruling: 'RU-8', reason: 'r' }],
  };
  const out = buildDirectory({ screenerRows: SCREENER, exchangeList: ESL, corrections: CORRECTIONS });
  const kept = Object.fromEntries(out.entries.map((e) => [e.symbol, e]));
  const dropOf = (s) => out.dropped.filter((d) => d.symbol === s).map((d) => d.reason);
  const c = out.corrections;
  const appliedSyms = c.applied.filter((a) => a.symbol).map((a) => a.symbol).sort();

  it('accounts for every screener row: kept, dropped with a reason, or a game row', () => {
    expect(out.entries.length + out.dropped.length + out.gameRows.length).toBe(SCREENER.length);
  });
  it('leave-out: a kept row is dropped with the reason correction_leave_out and its kind', () => {
    for (const s of ['CEF1', 'DBT1', 'SHL1', 'BRK-A']) {
      expect(kept[s]).toBeUndefined();
      expect(dropOf(s)).toEqual(['correction_leave_out']);
    }
    expect(out.dropped.find((d) => d.symbol === 'CEF1').correction).toEqual({ kind: 'closed_end_fund', ruling: 'RU-6' });
    expect(c.applied.find((a) => a.symbol === 'BRK-A')).toMatchObject({ kind: 'leave_out:game_share_class', ruling: 'RU-13' });
  });
  it('leave-out of a row a filter dropped first has no effect, and the filter is named', () => {
    expect(dropOf('DRP1')).toEqual(['exchange']);
    expect(c.noEffect).toContainEqual(expect.objectContaining({ symbol: 'DRP1', droppedBy: 'exchange' }));
  });
  it('sector fix: the house sector id and the industry are replaced, and the change is reported', () => {
    expect(kept.LION).toMatchObject({ sector: 'XLC', industry: 'Entertainment' });
    expect(c.applied.find((a) => a.symbol === 'LION')).toMatchObject({ kind: 'sector_fix', from: ['XLF', 'Shell Companies'], to: ['XLC', 'Entertainment'] });
  });
  it('restore: a common share typed Preferred is kept; a preferred the list does not name is still dropped by type', () => {
    expect(kept['MOG-B']).toMatchObject({ sector: 'XLI', industry: 'Aerospace & Defense' });
    expect(dropOf('PFX-A')).toEqual(['type']);
    expect(c.applied.find((a) => a.symbol === 'MOG-B')).toMatchObject({ kind: 'restore', ruling: 'RU-11' });
  });
  it('restore: a restored symbol with no sector that maps is still dropped, and so is one with no name', () => {
    expect(kept['NSC-B']).toBeUndefined();
    expect(dropOf('NSC-B')).toEqual(['sector_unmapped']);
    expect(c.noEffect).toContainEqual(expect.objectContaining({ symbol: 'NSC-B', kind: 'restore', droppedBy: 'sector_unmapped' }));
    expect(dropOf('NNM-B')).toEqual(['no_name']);
    expect(c.noEffect).toContainEqual(expect.objectContaining({ symbol: 'NNM-B', droppedBy: 'no_name' }));
  });
  it('restore: relaxes the type filter only, so a restored symbol on an OTC venue is still dropped by its venue', () => {
    expect(dropOf('OTB-B')).toEqual(['exchange']);
    expect(c.noEffect).toContainEqual(expect.objectContaining({ symbol: 'OTB-B', droppedBy: 'exchange' }));
  });
  it('restore of a row the filters keep anyway has no effect, recorded so the monthly review removes it', () => {
    expect(kept.RCOM).toBeDefined();
    expect(c.noEffect).toContainEqual(expect.objectContaining({ symbol: 'RCOM', kind: 'restore', note: 'kept by the filters alone' }));
  });
  it('venue: common stock on BATS is kept and named; an ETF on BATS is still dropped by type; OTC is still dropped', () => {
    expect(kept.CBOE).toMatchObject({ exchange: 'BATS', sector: 'XLF' });
    expect(dropOf('EZU')).toEqual(['type']);
    expect(dropOf('QXQX')).toEqual(['exchange']);
    expect(dropOf('BTSX')).toEqual(['sector_unmapped']);
    expect(c.venueAdmitted).toEqual([{ symbol: 'CBOE', name: 'CBOE Corp', exchange: 'BATS', sector: 'XLF' }]);
    expect(c.applied.find((a) => a.kind === 'venue')).toEqual({ kind: 'venue', exchange: 'BATS', ruling: 'RU-8', admitted: ['CBOE'] });
  });
  it('a correction naming a symbol the fetch does not hold is reported stale, not an error', () => {
    expect(c.stale.map((s) => s.symbol).sort()).toEqual(['GNE1', 'GNE2', 'GNE3']);
    expect(c.stale.find((s) => s.symbol === 'GNE2')).toEqual({ kind: 'sector_fix', symbol: 'GNE2', ruling: 'RU-7' });
  });
  it('every correction is accounted for once: applied, stale or no effect', () => {
    const named = [...CORRECTIONS.leaveOut, ...CORRECTIONS.sectorFix, ...CORRECTIONS.restore].map((e) => e.symbol).sort();
    const accounted = [...appliedSyms, ...c.stale.map((s) => s.symbol), ...c.noEffect.map((s) => s.symbol)].sort();
    expect(accounted).toEqual(named);
  });
  it('with no corrections (the default), the filters alone decide, as in Build 1', () => {
    const plain = buildDirectory({ screenerRows: SCREENER, exchangeList: ESL });
    const plainKept = plain.entries.map((e) => e.symbol);
    expect(plainKept).toEqual(expect.arrayContaining(['CEF1', 'DBT1', 'SHL1', 'BRK-A', 'LION']));
    expect(plainKept).not.toContain('MOG-B');
    expect(plainKept).not.toContain('CBOE');
    expect(plain.entries.find((e) => e.symbol === 'LION').sector).toBe('XLF');
    expect(plain.corrections).toEqual({ applied: [], stale: [], noEffect: [], venueAdmitted: [] });
    expect(NO_CORRECTIONS).toEqual({ leaveOut: [], sectorFix: [], restore: [], venues: [] });
  });
});

describe('a run applies the real list and reports it (runMain, from a saved fetch, no network call)', () => {
  // 1,000 filler rows on NASDAQ clear the count stop; the named rows are the real list's own symbols.
  const filler = Array.from({ length: 1000 }, (_, i) => `Q${String.fromCharCode(65 + Math.floor(i / 26 / 26) % 26)}${String.fromCharCode(65 + Math.floor(i / 26) % 26)}${String.fromCharCode(65 + (i % 26))}`);
  const raw = {
    fetchedOn: '2026-11-26',
    floor: 1e9,
    spend: { counted: 0 },
    passes: [],
    screenerRows: [
      ...filler.map((s, i) => row(s, 2e9 + i * 1e6)),
      row('BCAT', 2e9, { sector: 'Financial Services' }), row('LION', 4e9, { sector: 'Financial Services', industry: 'Shell Companies' }),
      row('MOG-B', 1e10, { sector: 'Industrials', industry: 'Aerospace & Defense' }), row('CBOE', 3.7e10, { sector: 'Financial Services' }),
      row('MMC', 9e10, { sector: 'Financial Services', industry: 'Insurance Brokers' }), row('GLW', 3e10),
    ],
    exchangeList: [
      ...filler.map((s) => listing(s, 'NASDAQ')), listing('BCAT'), listing('LION'), listing('MOG-B', 'NYSE', 'Preferred Stock'),
      listing('CBOE', 'BATS'), listing('MMC'), listing('GLW'),
    ],
  };
  const previousText = renderDirectoryModule({
    entries: [
      { symbol: 'BCAT', name: 'BCAT Corp', sector: 'XLF', industry: 'Software' },
      { symbol: 'LION', name: 'LION Corp', sector: 'XLF', industry: 'Shell Companies' },
      { symbol: 'GLW', name: 'GLW Corp', sector: 'XLK', industry: 'Software' },
      { symbol: 'OLD1', name: 'Old One', sector: 'XLK', industry: 'Software' },
    ],
    generatedOn: '2026-10-26',
  });
  const written = {};
  const lines = [];
  const run = runMain({
    argv: ['--from-raw', '/saved/raw.json', '--run-dir', '/run'],
    readFile: (p) => {
      if (p === '/saved/raw.json') return JSON.stringify(raw);
      if (p === '/out/researchDirectory.js') return previousText;
      throw new Error(`unexpected read ${p}`);
    },
    writeFile: (p, t) => { written[p.replace(/\\/g, '/')] = t; },
    makeDir: () => {},
    outPath: '/out/researchDirectory.js',
    log: (l) => lines.push(l),
  });

  it('writes a directory with the leave-outs gone, the fix, the restore and the BATS row', async () => {
    await run;
    const entries = parseDirectoryModuleEntries(written['/out/researchDirectory.js']);
    expect(entries.BCAT).toBeUndefined();
    expect(entries.LION).toEqual(['LION Corp', 'XLC', 'Entertainment']);
    expect(entries['MOG-B']).toEqual(['MOG-B Corp', 'XLI', 'Aerospace & Defense']);
    expect(entries.CBOE).toEqual(['CBOE Corp', 'XLF', 'Software']);
    expect(Object.keys(entries)).toHaveLength(1005);
    expect(written['/out/researchDirectory.js']).toContain('// Corrections: the named list in scripts/research-directory-corrections.mjs');
  });
  it('the report lists every correction applied, the stale ones, and the BATS rows by name', async () => {
    await run;
    const report = JSON.parse(written['/run/run-report.json']);
    expect(report.corrections.applied.filter((a) => a.symbol).map((a) => a.symbol).sort()).toEqual(['BCAT', 'LION', 'MOG-B']);
    expect(report.corrections.venueAdmitted).toEqual([{ symbol: 'CBOE', name: 'CBOE Corp', exchange: 'BATS', sector: 'XLF' }]);
    const named = [...DIRECTORY_CORRECTIONS.leaveOut, ...DIRECTORY_CORRECTIONS.sectorFix, ...DIRECTORY_CORRECTIONS.restore].map((e) => e.symbol);
    expect(report.corrections.stale.map((s) => s.symbol).sort()).toEqual(named.filter((s) => !['BCAT', 'LION', 'MOG-B'].includes(s)).sort());
    expect(lines.some((l) => /^\[corrections\] 4 applied, 22 stale \(.*\), 0 with no effect; venue let in CBOE \(CBOE Corp\)$/.test(l))).toBe(true);
  });
  it('RU-14: reports every retired game symbol that appears in the directory', async () => {
    await run;
    const report = JSON.parse(written['/run/run-report.json']);
    expect(Object.hasOwn(RETIRED_STOCKS, 'MMC')).toBe(true);
    expect(report.retiredInDirectory).toEqual([{ symbol: 'MMC', name: 'MMC Corp', sector: 'XLF' }]);
    expect(lines).toContain('[retired] retired game symbols in the directory: MMC');
  });
  it('reports the count before and after and every row that entered, left or changed', async () => {
    await run;
    const d = JSON.parse(written['/run/run-report.json']).againstPrevious;
    expect([d.before, d.after]).toEqual([4, 1005]);
    expect(d.left.map((r) => r.symbol)).toEqual(['BCAT', 'OLD1']);
    expect(d.entered.map((r) => r.symbol)).toEqual(expect.arrayContaining(['CBOE', 'MMC', 'MOG-B']));
    expect(d.entered).toHaveLength(1003);
    expect(d.changed).toEqual([{ symbol: 'LION', from: ['LION Corp', 'XLF', 'Shell Companies'], to: ['LION Corp', 'XLC', 'Entertainment'] }]);
    expect(lines).toContain('[diff] 4 -> 1005: 1003 entered, 2 left, 1 changed');
  });
});

describe('the header and the diff helpers', () => {
  const entries = [{ symbol: 'AAA', name: 'A "q" Co', sector: 'XLK', industry: null }, { symbol: 'BRK-A', name: 'B\\s', sector: 'XLF', industry: 'Ins' }];
  it('names the corrections list only when corrections were applied', () => {
    expect(renderDirectoryModule({ entries, generatedOn: '2026-11-26', corrected: true })).toMatch(/^\/\/ Corrections: .*RU-6, RU-7, RU-8, RU-11, RU-13/m);
    expect(renderDirectoryModule({ entries, generatedOn: '2026-11-26' })).not.toContain('Corrections');
  });
  it('reads a generated module back to its entries, LF or CRLF', () => {
    const text = renderDirectoryModule({ entries, generatedOn: '2026-11-26' });
    const want = { AAA: ['A "q" Co', 'XLK', null], 'BRK-A': ['B\\s', 'XLF', 'Ins'] };
    expect(parseDirectoryModuleEntries(text)).toEqual(want);
    expect(parseDirectoryModuleEntries(text.replace(/\n/g, '\r\n'))).toEqual(want);
  });
  it('a first run (no previous directory) reports no before count and every row entered', () => {
    expect(diffDirectories(null, [{ symbol: 'AAA', name: 'n', sector: 'XLK', industry: null }])).toEqual({
      before: null, after: 1, entered: [{ symbol: 'AAA', name: 'n', sector: 'XLK', industry: null }], left: [], changed: [],
    });
  });
});

// -- 3. The committed directory -------------------------------------------------------------------------------------

describe('the committed directory carries every correction', () => {
  it('holds none of the 21 leave-outs', () => {
    for (const e of DIRECTORY_CORRECTIONS.leaveOut) expect(Object.hasOwn(RESEARCH_DIRECTORY, e.symbol)).toBe(false);
  });
  it('holds the two sector fixes as the list gives them', () => {
    for (const e of DIRECTORY_CORRECTIONS.sectorFix) {
      expect(RESEARCH_DIRECTORY[e.symbol][1]).toBe(e.sector);
      expect(RESEARCH_DIRECTORY[e.symbol][2]).toBe(e.industry);
    }
  });
  it('holds the two restored share classes and Cboe Global Markets (BATS)', () => {
    for (const s of ['MOG-B', 'AGM-A', 'CBOE']) expect(Object.hasOwn(RESEARCH_DIRECTORY, s)).toBe(true);
    expect(RESEARCH_DIRECTORY.CBOE[1]).toBe('XLF');
  });
  it('still holds every business development company (RU-6) and the four symbols the game uses otherwise (RU-12)', () => {
    for (const s of ['ARCC', 'BXSL', 'CSWC', 'FSK', 'GBDC', 'HTGC', 'MAIN', 'MSDL', 'OBDC', 'OCSL', 'OTF', 'TRIN', 'TSLX', 'CASH', 'LTC', 'BCH', 'SUI']) {
      expect(Object.hasOwn(RESEARCH_DIRECTORY, s)).toBe(true);
    }
  });
  it('holds no retired game symbol today (RU-14), and its header names the corrections list', () => {
    expect(Object.keys(RETIRED_STOCKS).filter((s) => Object.hasOwn(RESEARCH_DIRECTORY, s))).toEqual([]);
    expect(readFileSync(path.join(HERE, '..', 'api', '_utils', 'researchDirectory.js'), 'utf8')).toContain('// Corrections: the named list in scripts/research-directory-corrections.mjs');
  });
  it('is 2,241 entries, every sector a house id, from the Nov 26 fetch', () => {
    expect(RESEARCH_DIRECTORY_META).toEqual({ generatedOn: '2026-11-26', count: 2241, floorUsd: 1e9 });
    for (const [, sector] of Object.values(RESEARCH_DIRECTORY)) expect(HOUSE_SECTOR_IDS).toContain(sector);
    expect(KEPT_EXCHANGES).toEqual(['NYSE', 'NASDAQ', 'AMEX', 'NYSE MKT']);
  });
});
