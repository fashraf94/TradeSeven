// api/_utils/anticipationThresholdLint.intraday.test.js — contract §9.3.
import { describe, it, expect } from 'vitest';
import { buildPresentSignals, intradaySignalsFor, namedSignals, lintThreshold, NEVER_PRESENT_SIGNALS, SIGNAL_NAMES } from './anticipationThresholdLint.js';

const verdict = (state) => ({ state, reason: state === 'eligible' ? null : 'x', consumer: 'display' });
const view = (states) => ({ symbols: { NVDA: { indicators: Object.fromEntries(Object.entries(states).map(([k, st]) => [k, { verdict: verdict(st) }])) } } });
const ALL_ELIGIBLE = { vwap: 'eligible', macd5m: 'eligible', rsi5m: 'eligible', sma20_5m: 'eligible' };

describe('§9.3 the five intraday names are conditional on the view AND INTRADAY_AGENT_USE_ENABLED', () => {
  it('flag false (build 1): never present for any symbol, even with a fully eligible view — today\'s behaviour', () => {
    const present = buildPresentSignals({ momentumData: { vwap: { NVDA: { vwapDeviation: 1 } } }, heldSymbols: ['NVDA'], benchSymbols: ['AMD'], intradayView: view(ALL_ELIGIBLE), intradayAgentUseEnabled: false });
    for (const [, set] of present) for (const never of NEVER_PRESENT_SIGNALS) expect(set.has(never)).toBe(false);
    expect(intradaySignalsFor(view(ALL_ELIGIBLE).symbols.NVDA, false)).toEqual(new Set());
    // Default argument: the flag is not read by this module; absent → false.
    const dflt = buildPresentSignals({ heldSymbols: ['NVDA'], intradayView: view(ALL_ELIGIBLE) });
    for (const never of NEVER_PRESENT_SIGNALS) expect(dflt.get('NVDA').has(never)).toBe(false);
  });
  it('flag true (stage 2): eligible verdicts make the names present, held or bench; display_only / ineligible add nothing', () => {
    const present = buildPresentSignals({ heldSymbols: ['NVDA'], benchSymbols: ['AMD'], intradayView: { symbols: { NVDA: view(ALL_ELIGIBLE).symbols.NVDA, AMD: view({ vwap: 'display_only', macd5m: 'ineligible', rsi5m: 'eligible', sma20_5m: 'eligible' }).symbols.NVDA } }, intradayAgentUseEnabled: true });
    expect([...present.get('NVDA')].filter((n) => NEVER_PRESENT_SIGNALS.includes(n)).sort()).toEqual(['MACD_5M', 'MACD_HISTOGRAM', 'RSI_5M', 'SMA_20_LEVEL', 'VWAP_5M']);
    expect([...present.get('AMD')].filter((n) => NEVER_PRESENT_SIGNALS.includes(n)).sort()).toEqual(['RSI_5M', 'SMA_20_LEVEL']);
    expect(intradaySignalsFor(null, true)).toEqual(new Set());
    // With the flag true and an eligible 5-minute MACD, a 5-minute-MACD threshold passes the lint.
    expect(lintThreshold({ threshold: 'if the 5-minute MACD turns positive', symbol: 'NVDA', present })).toEqual({ ok: true });
    expect(lintThreshold({ threshold: 'if the 5-minute MACD turns positive', symbol: 'AMD', present })).toEqual({ ok: false, absent: ['MACD_5M'] });
  });
  it('vocabulary rows: the view\'s indicator keys macd5m / rsi5m / sma20_5m name the intraday signals, matched before the general rows', () => {
    expect(namedSignals('watch macd5m for a cross')).toEqual(['MACD_5M']);
    expect(namedSignals('rsi5m back above 50')).toEqual(['RSI_5M']);
    expect(namedSignals('holds the sma20_5m level')).toEqual(['SMA_20_LEVEL']);
    expect(namedSignals('MACD_5M and RSI-5M and SMA20-5m')).toEqual(['MACD_5M', 'RSI_5M', 'SMA_20_LEVEL']);
    expect(namedSignals('the daily MACD')).toEqual([SIGNAL_NAMES.MACD_CROSS]);
  });
});
