// api/_utils/mandateSectorCapUnits.test.js
//
// T0a — the Mandate's sector cap in the right units (concept V6.1 ruling 25;
// Astra C5-05 / B5). The archetype table's sectorConcentrationCap is a COUNT of
// the battle's six equal picks; the book's gate compares a FRACTION of book
// value. Before T0a the vintage copied the count, so a cap of 3 allowed 300%.
// These rows drive the six REAL vintage payloads (buildVintagePayload) through
// the real gate and the real prompt assembler — each row fails on the pre-fix
// code, where the gate config carried the raw count.
//
// Resolution-point refusals (vintage_uncorrected) live beside each harness:
// mandateCreationService / mandateEscape / mandateRollover / mandateBatchTransport
// tests, api/cron/mandate-evaluate.test.js and mandateIntegrationHarness.test.js.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildVintagePayload, computeVintageHash } from './mandateVintage.js';
import { listArchetypeIds } from './archetypeRegistry.js';
import {
  checkSectorCap,
  translateSectorCapSlots,
  isSectorCapCorrected,
  isValidSectorCapFraction,
  SECTOR_CAP_SLOT_DENOMINATOR,
  SECTOR_CAP_CONVERSION_VERSION,
  VINTAGE_UNCORRECTED,
} from './mandateSectorCap.js';
import { evaluateGate } from './mandateGate.js';
import { assembleMandatePrompt } from './mandatePromptAssembly.js';
// BUILD_RULES §4 dependency-surface guard: this import of a src/ module is the
// runtime guard that its graph stays Node-clean (leagueTournament.js holds a
// zero-import invariant). Never mock it.
import { AGENT_PICKS_PER_AGENT } from '../../src/constants/leagueTournament.js';

// The fenced table's counts (api/_utils/agentArchetypeConfig.js:66/95/122/151/182/214,
// read, never edited) and the translation V6.1 ruling 25 approved.
const EXPECTED = {
  momentum_chaser: { slots: 3, cap: 1 / 2, pct: '50.0%' },
  analyst: { slots: 3, cap: 1 / 2, pct: '50.0%' },
  diversifier: { slots: 2, cap: 1 / 3, pct: '33.3%' },
  contrarian: { slots: 3, cap: 1 / 2, pct: '50.0%' },
  degen: { slots: 4, cap: 2 / 3, pct: '66.7%' },
  guardian: { slots: 2, cap: 1 / 3, pct: '33.3%' },
};
const IDS = Object.keys(EXPECTED);

// SHA-256 of the fenced archetype table at main c37baa0d (the committed blob,
// LF). Byte-identity proof that T0a did not touch the fence. A founder-gated
// fence edit (BUILD_RULES §1) updates this pin in the same commit.
const FENCED_TABLE = 'api/_utils/agentArchetypeConfig.js';
const FENCED_TABLE_SHA256 = '0c37a212459bba19c6ed321c96004c76cdaa742fab917790979e209e5305d93b';

describe('T0a — the translation table (all six archetypes)', () => {
  it('the registry lists exactly the six archetypes the table covers', () => {
    expect([...listArchetypeIds()].sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s: the slot count becomes a share of book value, with its metadata', (id) => {
    const { slots, cap } = EXPECTED[id];
    const payload = buildVintagePayload(id);
    // the registry still carries the fenced COUNT (null nowhere today)
    expect(payload.archetypeContent.physics.sectorConcentrationCap).toBe(slots);
    expect(payload.gateConfig).toMatchObject({
      sectorCapSlots: slots,
      sectorCapDenominator: 6,
      sectorConcentrationCap: cap,
      sectorCapConversionVersion: 1,
    });
    expect(isValidSectorCapFraction(payload.gateConfig.sectorConcentrationCap)).toBe(true);
    expect(isSectorCapCorrected(payload.gateConfig)).toBe(true);
  });

  it.each(IDS)('%s: the corrected vintage has a NEW content hash (never the pre-T0a address)', (id) => {
    const payload = buildVintagePayload(id);
    // Rebuild the pre-T0a payload: the raw count in sectorConcentrationCap, no metadata.
    const legacy = JSON.parse(JSON.stringify(payload));
    delete legacy.gateConfig.sectorCapSlots;
    delete legacy.gateConfig.sectorCapDenominator;
    delete legacy.gateConfig.sectorCapConversionVersion;
    legacy.gateConfig.sectorConcentrationCap = EXPECTED[id].slots;
    expect(computeVintageHash(payload)).not.toBe(computeVintageHash(legacy));
  });

  it('the denominator is the battle\'s six-pick book (AGENT_PICKS_PER_AGENT)', () => {
    expect(SECTOR_CAP_SLOT_DENOMINATOR).toBe(AGENT_PICKS_PER_AGENT);
    expect(SECTOR_CAP_CONVERSION_VERSION).toBe(1);
  });
});

describe('T0a — translateSectorCapSlots (construction, fail-closed)', () => {
  it.each([1, 2, 3, 4, 5, 6])('%i of 6 → %i/6', (n) => {
    expect(translateSectorCapSlots(n)).toEqual({
      sectorCapSlots: n, sectorCapDenominator: 6, sectorConcentrationCap: n / 6, sectorCapConversionVersion: 1,
    });
  });

  it('the three counts in use map to exactly 1/3, 1/2, 2/3', () => {
    expect(translateSectorCapSlots(2).sectorConcentrationCap).toBe(1 / 3);
    expect(translateSectorCapSlots(3).sectorConcentrationCap).toBe(1 / 2);
    expect(translateSectorCapSlots(4).sectorConcentrationCap).toBe(2 / 3);
  });

  it('null stays null ("no sector cap") and is still stamped', () => {
    expect(translateSectorCapSlots(null)).toEqual({
      sectorCapSlots: null, sectorCapDenominator: 6, sectorConcentrationCap: null, sectorCapConversionVersion: 1,
    });
  });

  it.each([0, -1, -3, 2.5, 7, 12, Number.NaN, Infinity, '3', undefined, true, {}])(
    'a malformed count (%s) is a construction error',
    (bad) => { expect(() => translateSectorCapSlots(bad)).toThrow(/malformed sector-cap slot count/); },
  );
});

describe('T0a — admission predicate', () => {
  it.each([undefined, null, {}, { sectorConcentrationCap: 3 }, { sectorCapConversionVersion: 0 },
    { sectorCapConversionVersion: '1' }, { sectorCapConversionVersion: 2 }])(
    'an unstamped or foreign-version gate config (%j) is uncorrected',
    (gc) => { expect(isSectorCapCorrected(gc)).toBe(false); },
  );

  it('the typed refusal reason is vintage_uncorrected', () => {
    expect(VINTAGE_UNCORRECTED).toBe('vintage_uncorrected');
  });
});

// ── The boundary: exact cents on a non-dyadic book ──────────────────────────
// T = $123,456.78 divides by 6 exactly ($20,576.13), so n/6 × T is a whole cent.
const T = 123456.78;
const SIXTH_CENTS = 2057613;
const CURRENT_CENTS = 3000011; // $30,000.11 already in the sector
const usd = (cents) => cents / 100;

describe.each(IDS)('T0a — %s: the cap binds at its fraction (checkSectorCap, real vintage cap)', (id) => {
  const cap = buildVintagePayload(id).gateConfig.sectorConcentrationCap;
  const limitCents = EXPECTED[id].slots * SIXTH_CENTS;
  const run = (currentCents, addCents) => checkSectorCap({
    sector: 'Technology', addUsd: usd(addCents), sectorExposureUsd: { Technology: usd(currentCents), Energy: 9876.54 }, totalValue: T, cap,
  });

  it('existing exposure + spend exactly at the limit passes', () => {
    const r = run(CURRENT_CENTS, limitCents - CURRENT_CENTS);
    expect(r.passed).toBe(true);
    expect(r.weightAfter).toBeCloseTo(EXPECTED[id].cap, 12);
  });

  it('one cent above the limit fails', () => {
    const r = run(CURRENT_CENTS, limitCents - CURRENT_CENTS + 1);
    expect(r).toMatchObject({ passed: false, reason: 'sector_cap_exceeded', sector: 'Technology', cap });
  });

  it('existing exposure counts: a sector already at the limit refuses one more cent', () => {
    expect(run(0, 1).passed).toBe(true);
    expect(run(limitCents, 1).passed).toBe(false);
  });

  it('the proposed spend counts: the whole limit from an empty sector passes, a cent more fails', () => {
    expect(run(0, limitCents).passed).toBe(true);
    expect(run(0, limitCents + 1).passed).toBe(false);
  });

  it('other sectors do not count toward this one', () => {
    const r = checkSectorCap({
      sector: 'Technology', addUsd: usd(limitCents), sectorExposureUsd: { Energy: 60000.01 }, totalValue: T, cap,
    });
    expect(r.passed).toBe(true);
  });
});

// ── Unequal positions, through the real gate ───────────────────────────────
// Unequal Technology holdings, each under the 35% single-position cap. LIGHT
// holds 28.5% in Technology; HEAVY holds 64.4% (for the 2/3 cap, whose
// headroom on LIGHT would exceed the single-position cap instead).
const SNAP = {
  tickKey: '2026-11-12_open30',
  symbols: {
    AAPL: { complete: true, price: 187.31, sector: 'Technology' },
    MSFT: { complete: true, price: 412.77, sector: 'Technology' },
    NVDA: { complete: true, price: 131.29, sector: 'Technology' },
    AMD: { complete: true, price: 157.83, sector: 'Technology' },
    XOM: { complete: true, price: 113.47, sector: 'Energy' },
    NOSECTOR: { complete: true, price: 42.17 },
  },
};
const LIGHT = {
  positions: {
    AAPL: { shares: 61, costBasisTotal: 11000, sector: 'Technology' },   // $11,425.91
    MSFT: { shares: 43, costBasisTotal: 17000, sector: 'Technology' },   // $17,749.11
  },
  cash: 73281.76,
  tech: 29175.02,
};
const HEAVY = {
  positions: {
    AAPL: { shares: 150, costBasisTotal: 27000, sector: 'Technology' },  // $28,096.50
    MSFT: { shares: 61, costBasisTotal: 25000, sector: 'Technology' },   // $25,178.97
    NVDA: { shares: 97, costBasisTotal: 12000, sector: 'Technology' },   // $12,735.13
    XOM: { shares: 40, costBasisTotal: 4500, sector: 'Energy' },         // $4,538.80
  },
  cash: 31907.38,
  tech: 66010.60,
};
const BOOK_TOTAL = 102456.78; // both books

describe.each(IDS)('T0a — %s: unequal positions through evaluateGate', (id) => {
  const gateConfig = buildVintagePayload(id).gateConfig;
  const cap = EXPECTED[id].cap;
  const book = cap > 0.5 ? HEAVY : LIGHT;
  const headroom = cap * BOOK_TOTAL - book.tech;
  const buy = (sizeUsd, ticker = 'AMD') => evaluateGate({
    decision: { verb: 'BUY', ticker, sizeUsd }, positions: book.positions, cash: book.cash, snapshot: SNAP, gateConfig,
  });

  it('a new tech name sized a dollar under the sector headroom is admitted', () => {
    const r = buy(Math.floor(headroom) - 1);
    expect(r.passed).toBe(true);
    expect(r.rule).toBe('buy');
  });

  it('a dollar over the sector headroom is refused by the sector cap (not another gate)', () => {
    const r = buy(Math.ceil(headroom) + 1);
    expect(r).toMatchObject({ passed: false, rule: 'sector_cap', reason: 'sector_cap_exceeded', cap });
    expect(r.weightAfter).toBeGreaterThan(cap);
  });

  it('an absent sector classification fails closed', () => {
    const r = buy(100, 'NOSECTOR');
    expect(r).toMatchObject({ passed: false, rule: 'sector_cap', reason: 'unknown_sector' });
  });

  it('the raw slot count (the pre-T0a cap) is refused as malformed, never read as 200–400%', () => {
    const r = evaluateGate({
      decision: { verb: 'BUY', ticker: 'XOM', sizeUsd: 100 }, positions: book.positions, cash: book.cash, snapshot: SNAP,
      gateConfig: { ...gateConfig, sectorConcentrationCap: EXPECTED[id].slots },
    });
    expect(r).toMatchObject({ passed: false, rule: 'sector_cap', reason: 'malformed_cap' });
  });
});

describe('T0a — checkSectorCap consumer validation', () => {
  const base = { sector: 'Technology', addUsd: 100, sectorExposureUsd: { Technology: 1000 }, totalValue: T };

  it.each([2, 3, 4, 0, -0.1, 1.0000001, Number.NaN, Infinity, -Infinity, '0.5', undefined, {}])(
    'a cap of %s is malformed and fails closed',
    (cap) => { expect(checkSectorCap({ ...base, cap })).toMatchObject({ passed: false, reason: 'malformed_cap' }); },
  );

  it.each([1 / 6, 1 / 3, 1 / 2, 2 / 3, 1])('a cap of %s is a valid fraction', (cap) => {
    expect(checkSectorCap({ ...base, cap }).reason).not.toBe('malformed_cap');
  });

  it('a cap of exactly 1 admits a whole-book sector and nothing above it', () => {
    expect(checkSectorCap({ ...base, sectorExposureUsd: {}, addUsd: T, cap: 1 }).passed).toBe(true);
    expect(checkSectorCap({ ...base, sectorExposureUsd: {}, addUsd: T + 0.01, cap: 1 }).passed).toBe(false);
  });

  it('zero or negative book value fails closed', () => {
    expect(checkSectorCap({ ...base, totalValue: 0, cap: 1 / 3 })).toMatchObject({ passed: false, reason: 'no_total_value' });
    expect(checkSectorCap({ ...base, totalValue: -5, cap: 1 / 3 })).toMatchObject({ passed: false, reason: 'no_total_value' });
  });

  it('null policy: a null cap means no sector cap and passes any concentration', () => {
    expect(checkSectorCap({ ...base, addUsd: 1e9, cap: null })).toMatchObject({ passed: true, reason: 'no_cap', cap: null });
    const nullGate = { ...buildVintagePayload('diversifier').gateConfig, ...translateSectorCapSlots(null) };
    const r = evaluateGate({
      decision: { verb: 'BUY', ticker: 'AMD', sizeUsd: 1000 }, positions: HEAVY.positions, cash: HEAVY.cash, snapshot: SNAP, gateConfig: nullGate,
    });
    expect(r.passed).toBe(true); // 65% tech + more: no sector cap applies
  });
});

// ── The prompt ──────────────────────────────────────────────────────────────
const PROMPT_BOOK = {
  portfolio: { cash: 100000, positions: {}, totalValue: 100000, initialValue: 100000, quarterDrawdownFromPeak: 0 },
  quarterStartAt: new Date('2026-10-01T00:00:00Z'),
};
const PROMPT_NOW = new Date('2026-11-12T15:05:00Z');
const percentsIn = (text) => [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));

describe('T0a — the prompt prints the fraction', () => {
  it.each(IDS)('%s: prints its cap as a percentage of the book, never above 100%%', (id) => {
    const vintage = { codeId: id, ...buildVintagePayload(id) };
    const p = assembleMandatePrompt({ vintage, book: PROMPT_BOOK, snapshot: SNAP, now: PROMPT_NOW });
    expect(p.system).toContain(`- Sector concentration cap: ${EXPECTED[id].pct}.`);
    const all = percentsIn(`${p.system}\n${p.messages.map((m) => m.content).join('\n')}`);
    expect(all.length).toBeGreaterThan(0);
    for (const v of all) expect(v).toBeLessThanOrEqual(100);
  });

  it('the three percentages are exactly 33.3%, 50.0% and 66.7%', () => {
    const printed = new Set(IDS.map((id) => {
      const p = assembleMandatePrompt({ vintage: { codeId: id, ...buildVintagePayload(id) }, book: PROMPT_BOOK, snapshot: SNAP, now: PROMPT_NOW });
      return p.system.match(/Sector concentration cap: ([^\n]+)\./)[1];
    }));
    expect([...printed].sort()).toEqual(['33.3%', '50.0%', '66.7%']);
  });

  it.each([2, 3, 4, undefined])('a malformed cap (%s) is never printed as a percentage', (bad) => {
    const base = buildVintagePayload('degen');
    const vintage = { codeId: 'degen', ...base, gateConfig: { ...base.gateConfig, sectorConcentrationCap: bad } };
    const p = assembleMandatePrompt({ vintage, book: PROMPT_BOOK, snapshot: SNAP, now: PROMPT_NOW });
    expect(p.system).toContain('- Sector concentration cap: unavailable (new entries are refused).');
    expect(p.system).not.toMatch(/Sector concentration cap: \d/);
    for (const v of percentsIn(p.system)) expect(v).toBeLessThanOrEqual(100);
  });

  it('a null cap prints "none"', () => {
    const base = buildVintagePayload('degen');
    const vintage = { codeId: 'degen', ...base, gateConfig: { ...base.gateConfig, sectorConcentrationCap: null } };
    const p = assembleMandatePrompt({ vintage, book: PROMPT_BOOK, snapshot: SNAP, now: PROMPT_NOW });
    expect(p.system).toContain('- Sector concentration cap: none.');
  });
});

describe('T0a — the fence is untouched', () => {
  it('the fenced archetype table is byte-identical to main c37baa0d (LF-normalised)', () => {
    const text = readFileSync(resolve(import.meta.dirname, '..', '..', FENCED_TABLE), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(text, 'utf8').digest('hex')).toBe(FENCED_TABLE_SHA256);
  });
});
