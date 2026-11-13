// src/data/practiceFieldSlots.test.js
//
// Practice Field T1a-1 — the founder slots, the funds and the sector bridge, each BOUND to the source it stands
// beside (build prompt §1). The three data modules have no imports, so nothing but these rows keeps them honest:
//   • slots B1–B9 are the contract's values exactly (shared contract V2 §13), and each slot's length comes from the
//     idea record's own window table (Amendment A F2) — never restated;
//   • every fund names a sector in the MANDATE's vocabulary, each sector fund is the house universe's own fund
//     for that sector, and the fund friction tier is the friction model's LOWEST-COST tier, at the model version
//     the module names;
//   • the sector bridge covers every house sector and lands on the Mandate's list, one to one.
//
// This file's imports of the api modules are a dependency-surface guard (BUILD_RULES §4): never mocked.

import { describe, it, expect } from 'vitest';
import {
  PRACTICE_FIELD_SLOTS, PRACTICE_FIELD_SLOTS_VERSION, PRACTICE_FIELD_SLOT_NAMES, PRACTICE_FIELD_SLOT_HORIZON,
  PRACTICE_FIELD_ORIGIN_KINDS, PRACTICE_FIELD_INITIATED_BY, PRACTICE_FIELD_SOURCELESS_ORIGIN,
} from './practiceFieldSlots.js';
import {
  PRACTICE_FIELD_FUNDS, PRACTICE_FIELD_FUNDS_VERSION, PRACTICE_FIELD_FUND_FRICTION_TIERS,
  PRACTICE_FIELD_FUND_FRICTION_MODEL_VERSION, PRACTICE_FIELD_BENCHMARK_SYMBOL, PRACTICE_FIELD_BROAD_MARKET,
} from './practiceFieldFunds.js';
import { PRACTICE_FIELD_SECTOR_BRIDGE, PRACTICE_FIELD_SECTOR_BRIDGE_VERSION } from './practiceFieldSectorBridge.js';
import { HORIZON_WINDOW_SESSIONS } from '../constants/hypothesisRecords.js';
import { STOCK_UNIVERSE, ALL_TICKERS } from '../../api/_utils/rankingConfig.js';
import { CANDIDATE_SECTOR_SEED } from '../../api/_utils/mandateCandidateUniverse.js';
import { MANDATE_FRICTION_TIERS, MANDATE_FRICTION_MODEL_VERSION, MANDATE_MAX_POSITIONS } from '../../api/_utils/mandateConfig.js';
import { slotSessions } from '../../api/_utils/practiceField/windows.js';
import { mandateSectorOf, frictionForSymbol, fundStaticClassifications } from '../../api/_utils/practiceField/symbols.js';

const MANDATE_SECTORS = [...new Set(Object.values(CANDIDATE_SECTOR_SEED))].sort();

describe('the founder slots B1–B9 (shared contract V2 §13)', () => {
  it('are the contract\'s values exactly, at version 1', () => {
    expect(PRACTICE_FIELD_SLOTS_VERSION).toBe(1);
    expect(PRACTICE_FIELD_SLOTS).toEqual({
      B1_SLOT_CAP_SHARE: { short: 0.20, medium: 0.30, long: 0.40 },
      B2_CASH_FLOOR_SHARE: 0.10,
      B3_NAMES_PER_IDEA: { min: 1, max: 4 },
      B4_BAND_SHARE_OF_RESERVED: 0.0025,
      B5_LINE_DISTANCE: { short: { min: 0.03, max: 0.08 }, medium: { min: 0.06, max: 0.15 }, long: { min: 0.10, max: 0.25 } },
      B6_DRAFTS_PER_CALL: 3,
      B6_REFILL_ATTEMPTS_PER_SLOT_PER_SESSION: 1,
      B6_NOMINATION_EXPIRY_SESSIONS: 10,
      B7_RISK_BUDGET_SHARE: 0.08,
      B8_FOUNDER_BOOK_CAP: 4,
      B9_MONTHLY_SPEND_BOUND_USD: 3,
    });
    expect(Object.isFrozen(PRACTICE_FIELD_SLOTS)).toBe(true);
    expect(Object.isFrozen(PRACTICE_FIELD_SLOTS.B1_SLOT_CAP_SHARE)).toBe(true);
    expect(Object.isFrozen(PRACTICE_FIELD_SLOTS.B5_LINE_DISTANCE.long)).toBe(true);
  });

  it('three full slots and the cash floor are the whole book; three ideas of four names fit the engine\'s position cap', () => {
    const { short, medium, long } = PRACTICE_FIELD_SLOTS.B1_SLOT_CAP_SHARE;
    expect(Math.round((short + medium + long + PRACTICE_FIELD_SLOTS.B2_CASH_FLOOR_SHARE) * 1e6)).toBe(1e6);
    expect(PRACTICE_FIELD_SLOT_NAMES.length * PRACTICE_FIELD_SLOTS.B3_NAMES_PER_IDEA.max).toBeLessThanOrEqual(MANDATE_MAX_POSITIONS);
  });

  it('slot ↔ horizon (Amendment A F2), with the lengths READ from the idea record\'s window table: 10 / 30 / 60', () => {
    expect(PRACTICE_FIELD_SLOT_NAMES).toEqual(['short', 'medium', 'long']);
    expect(PRACTICE_FIELD_SLOT_HORIZON).toEqual({ short: 'swing', medium: 'positional', long: 'longterm' });
    expect(PRACTICE_FIELD_SLOT_NAMES.map(slotSessions)).toEqual([10, 30, 60]);
    for (const slot of PRACTICE_FIELD_SLOT_NAMES) expect(slotSessions(slot)).toBe(HORIZON_WINDOW_SESSIONS[PRACTICE_FIELD_SLOT_HORIZON[slot]]);
    expect(slotSessions('intraday')).toBeNull();
  });

  it('the origin vocabulary (direction note ruling 6; Amendment C §6)', () => {
    expect(PRACTICE_FIELD_ORIGIN_KINDS).toEqual(['signaldrop', 'conversation', 'game_moment', 'film_room_card', 'research', 'agent_prior_ideas', 'founder_fixture']);
    expect(PRACTICE_FIELD_INITIATED_BY).toEqual(['player', 'agent']);
    expect(PRACTICE_FIELD_SOURCELESS_ORIGIN).toBe('founder_fixture');
    expect(Object.isFrozen(PRACTICE_FIELD_ORIGIN_KINDS)).toBe(true);
  });
});

describe('the funds (build prompt §1)', () => {
  it('are SPY, QQQ, DIA, IWM and the eleven sector SPDRs, each an etf with an explicit friction tier', () => {
    expect(PRACTICE_FIELD_FUNDS_VERSION).toBe(1);
    expect(Object.keys(PRACTICE_FIELD_FUNDS)).toEqual(['SPY', 'QQQ', 'DIA', 'IWM', 'XLK', 'XLF', 'XLV', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLU', 'XLRE', 'XLC']);
    for (const fund of Object.values(PRACTICE_FIELD_FUNDS)) {
      expect(Object.keys(fund).sort()).toEqual(['assetClass', 'frictionTier', 'represents']);
      expect(fund.assetClass).toBe('etf');
      expect(Object.keys(PRACTICE_FIELD_FUND_FRICTION_TIERS)).toContain(fund.frictionTier);
    }
    expect(PRACTICE_FIELD_BENCHMARK_SYMBOL).toBe('SPY');
  });

  it('`represents` is broad_market or a sector in the MANDATE\'s vocabulary; every Mandate sector has exactly one fund', () => {
    const sectors = [];
    for (const [symbol, fund] of Object.entries(PRACTICE_FIELD_FUNDS)) {
      if (['SPY', 'QQQ', 'DIA', 'IWM'].includes(symbol)) expect(fund.represents).toBe(PRACTICE_FIELD_BROAD_MARKET);
      else { expect(MANDATE_SECTORS).toContain(fund.represents); sectors.push(fund.represents); }
    }
    expect(sectors.sort()).toEqual(MANDATE_SECTORS);
  });

  it('each sector fund is the HOUSE universe\'s own fund for that sector, through the bridge', () => {
    for (const [etf, sector] of Object.entries(STOCK_UNIVERSE)) {
      expect(sector.etf).toBe(etf);
      expect(PRACTICE_FIELD_FUNDS[etf].represents).toBe(PRACTICE_FIELD_SECTOR_BRIDGE[sector.name]);
    }
  });

  it('the fund tier is the friction model\'s LOWEST-COST tier, at the model version the module names — never the market-cap fallback', () => {
    expect(PRACTICE_FIELD_FUND_FRICTION_MODEL_VERSION).toBe(MANDATE_FRICTION_MODEL_VERSION);
    const cost = (t) => t.slippageBps + t.spreadProxyBps;
    const lowest = Object.values(MANDATE_FRICTION_TIERS).reduce((a, b) => (cost(b) < cost(a) ? b : a));
    expect(PRACTICE_FIELD_FUND_FRICTION_TIERS.liquid_fund).toEqual({ slippageBps: lowest.slippageBps, spreadProxyBps: lowest.spreadProxyBps });
    expect(lowest).toBe(MANDATE_FRICTION_TIERS.mega);
    // A fund with NO market cap in the snapshot still prices at its own tier; a stock with none prices at the widest.
    const snapshot = { symbols: { XLK: { marketCap: null }, AAPL: { marketCap: null } } };
    expect(frictionForSymbol('XLK', snapshot)).toEqual({ slippageBps: 1, spreadProxyBps: 2, capTier: 'fund:liquid_fund' });
    expect(frictionForSymbol('AAPL', snapshot).capTier).toBe('unknown');
    expect(frictionForSymbol('AAPL', { symbols: { AAPL: { marketCap: 3e12 } } })).toEqual({ slippageBps: 1, spreadProxyBps: 2, capTier: 'mega' });
  });

  it('the static classifications the daily layer uses for funds: the sector the fund represents, no market cap', () => {
    const cls = fundStaticClassifications();
    expect(Object.keys(cls)).toEqual(Object.keys(PRACTICE_FIELD_FUNDS));
    expect(cls.XLV).toEqual({ sector: 'Health Care', industry: 'etf', marketCap: null });
    expect(cls.SPY).toEqual({ sector: 'broad_market', industry: 'etf', marketCap: null });
  });
});

describe('the sector-vocabulary bridge (audit Q6)', () => {
  it('maps every house sector, one to one, onto the Mandate\'s list — "Healthcare" is "Health Care"', () => {
    expect(PRACTICE_FIELD_SECTOR_BRIDGE_VERSION).toBe(1);
    const house = Object.values(STOCK_UNIVERSE).map((s) => s.name).sort();
    expect(Object.keys(PRACTICE_FIELD_SECTOR_BRIDGE).sort()).toEqual(house);
    expect(Object.values(PRACTICE_FIELD_SECTOR_BRIDGE).sort()).toEqual(MANDATE_SECTORS);
    expect(PRACTICE_FIELD_SECTOR_BRIDGE.Healthcare).toBe('Health Care');
    expect(Object.isFrozen(PRACTICE_FIELD_SECTOR_BRIDGE)).toBe(true);
  });

  it('every pickable stock resolves to a Mandate sector; a fund, a retired stock and an unknown symbol resolve to none', () => {
    for (const ticker of ALL_TICKERS) expect(MANDATE_SECTORS, ticker).toContain(mandateSectorOf(ticker));
    expect(mandateSectorOf('LLY')).toBe('Health Care');
    expect(mandateSectorOf('XLV')).toBeNull();
    expect(mandateSectorOf('WBA')).toBeNull(); // retired (BR-3)
    expect(mandateSectorOf('ZZZZ')).toBeNull();
  });

  it('a stock the Mandate\'s own seed list also carries gets the SAME sector through the bridge (the two vocabularies agree where they overlap)', () => {
    const disagreements = Object.entries(CANDIDATE_SECTOR_SEED)
      .filter(([sym]) => ALL_TICKERS.includes(sym))
      .filter(([sym, sector]) => mandateSectorOf(sym) !== sector)
      .map(([sym, sector]) => `${sym}: seed ${sector}, bridge ${mandateSectorOf(sym)}`);
    expect(disagreements).toEqual([]);
  });
});
