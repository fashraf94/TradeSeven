// src/data/intradayDiagnosticCopy.test.js — contract §9.1: the one copy table.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INTRADAY_DIAGNOSTIC_HEADER, INTRADAY_REASON_COPY, INTRADAY_INDICATOR_LABELS,
  renderIntradayDiagnosticLines, renderIntradayDiagnosticBlock,
} from './intradayDiagnosticCopy.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const T = Date.UTC(2026, 8, 17, 17, 52, 0);
const timeText = (ms) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

// Reasons the producer emits that are deliberately NOT copy: the structural
// silences renderIntradayDiagnosticLines drops before it ever asks for a
// phrase, plus the by-definition fallback, which is a code, not a line.
const SILENT_IN_COPY = new Set(['not_actionable', 'no_buckets', 'ineligible_by_definition']);

const rec = (over = {}) => ({
  price: { value: 493.9, priceAsOf: T },
  indicators: {
    vwap: { status: 'ready', value: 493.12, experimental: true, estimateCutoff: null, verdict: { state: 'display_only', reason: 'cutoff_unconfirmed', consumer: 'display' } },
    sessionHL: { status: 'ready', value: { high: 495, low: 490, open: 491 }, cutoff: null, verdict: { state: 'display_only', reason: 'cutoff_unconfirmed', consumer: 'display' } },
    volume: { status: 'ready', value: 12_345_678, cutoff: null, verdict: { state: 'display_only', reason: 'cutoff_unconfirmed', consumer: 'display' } },
    volumePace: { status: 'absent', value: null, verdict: { state: 'ineligible', reason: 'cutoff_unconfirmed', consumer: 'display' } },
    sma20_5m: { status: 'absent', value: null, cutoff: null, verdict: { state: 'ineligible', reason: 'warmup', consumer: 'display' } },
    macd5m: { status: 'completed', value: { line: 0.4, signal: 0.09, hist: 0.31, event: false, eventBarKey: null }, cutoff: T + 8 * 60_000, verdict: { state: 'eligible', reason: null, consumer: 'display' } },
    rsi5m: { status: 'completed', value: 61.234, cutoff: T + 8 * 60_000, verdict: { state: 'eligible', reason: null, consumer: 'display' } },
    ...over,
  },
});

describe('§9.1 copy table', () => {
  it('renders the contract\'s example lines from verdict state and reason', () => {
    const lines = renderIntradayDiagnosticLines(rec(), { timeText });
    expect(lines).toContain('VWAP est. 493.12 · cutoff unconfirmed · quote as of 1:52 PM · experimental');
    expect(lines).toContain('5m MACD hist +0.31 · completed bars · as of 2:00 PM');
    expect(lines).toContain('VWAP unavailable · warming up'.replace('VWAP', '5m SMA20'));
    expect(lines).toContain('5m RSI 61.2 · completed bars · as of 2:00 PM');
    expect(lines).toContain('Session H/L 495.00/490.00 · cutoff unconfirmed · quote as of 1:52 PM');
    expect(lines).toContain('Session volume 12,345,678 · cutoff unconfirmed · quote as of 1:52 PM');
    expect(lines).toContain('Volume pace unavailable · cutoff unconfirmed');
    expect(lines).toHaveLength(7);
  });
  it('an unavailable VWAP says why; a warming-up VWAP renders the contract phrase', () => {
    const lines = renderIntradayDiagnosticLines(rec({ vwap: { status: 'absent', value: null, verdict: { state: 'ineligible', reason: 'warmup', consumer: 'display' } } }), { timeText });
    expect(lines[0]).toBe('VWAP unavailable · warming up');
  });
  it('the block is headed by the fixed header and is empty when there is nothing to say', () => {
    const block = renderIntradayDiagnosticBlock(rec(), { timeText });
    expect(block[0]).toBe('Diagnostic · recorded at the check · not seen by the agent');
    expect(INTRADAY_DIAGNOSTIC_HEADER).toBe(block[0]);
    expect(renderIntradayDiagnosticBlock({ indicators: {} }, { timeText })).toEqual([]);
    expect(renderIntradayDiagnosticBlock(null, { timeText })).toEqual([]);
  });
  it('structurally-absent indicators (crypto buckets, non-actionable) render nothing; unknown reasons render the generic phrase', () => {
    const lines = renderIntradayDiagnosticLines(rec({ sma20_5m: { status: 'absent', value: null, verdict: { state: 'ineligible', reason: 'no_buckets' } }, rsi5m: { status: 'absent', verdict: { state: 'ineligible', reason: 'not_actionable' } }, macd5m: { status: 'absent', verdict: { state: 'ineligible', reason: 'mystery' } } }), { timeText });
    expect(lines.some((l) => l.startsWith('5m SMA20'))).toBe(false);
    expect(lines.some((l) => l.startsWith('5m RSI'))).toBe(false);
    expect(lines).toContain('5m MACD hist unavailable · unavailable');
  });
  it('overriding verdicts (the replay) re-keys the same table', () => {
    const lines = renderIntradayDiagnosticLines(rec(), { timeText, verdicts: { macd5m: { state: 'ineligible', reason: 'stale' } } });
    expect(lines).toContain('5m MACD hist unavailable · too old at the check');
  });
  it('EVERY REASON THE VERDICT PRODUCER CAN EMIT HAS COPY — no player line falls back to the generic phrase', () => {
    // `reasonPhrase` returns 'unavailable' for an unknown reason, so a reason
    // added to eligibility.js without a row here degrades silently: the line
    // renders, it just stops saying anything. This reads the reason slot of
    // every `v(state, reason, …)` call in the verdict producer and requires a
    // row for each literal it finds. Scoped to eligibility.js on purpose — the
    // reasons facts.js and accumulator.js stamp reach a verdict only through
    // its `f.reason || …` fallbacks, which this same scan picks up.
    const src = readFileSync(path.join(REPO, 'api/_utils/intraday/eligibility.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const emitted = new Set();
    // arg 1 is a VERDICT expression (never contains a comma); arg 2 is the
    // reason slot, which may be `null`, a literal, or a ternary/`||` of them.
    for (const m of src.matchAll(/\bv\(\s*[^,]+,\s*([^,)]*)/g)) {
      for (const lit of m[1].matchAll(/'([a-z0-9_]+)'/g)) emitted.add(lit[1]);
    }
    const missing = [...emitted].filter((r) => !(r in INTRADAY_REASON_COPY) && !SILENT_IN_COPY.has(r));
    expect(missing, `reasons emitted by eligibility.js with no copy row: ${missing.join(', ')}`).toEqual([]);
    // ANTI-VACUOUS: the scan actually found the reasons, including the newest.
    expect(emitted.size).toBeGreaterThanOrEqual(10);
    expect(emitted).toContain('cutoff_future');
    expect(emitted).toContain('stale');
    expect(emitted).toContain('cutoff_unconfirmed');
    // …and it would notice a missing row: a reason not in the table is caught.
    expect('not_a_real_reason' in INTRADAY_REASON_COPY).toBe(false);
  });

  it('is the ONE table: no other src/ or api/ module carries the header or a reason phrase literal', () => {
    // Phrases identical to their reason CODE (e.g. 'experimental') are codes,
    // not copy, wherever else they appear; comments are stripped before matching.
    const phrases = [
      INTRADAY_DIAGNOSTIC_HEADER,
      ...Object.entries(INTRADAY_REASON_COPY).filter(([code, p]) => p.length > 8 && p !== code).map(([, p]) => p),
      ...Object.values(INTRADAY_INDICATOR_LABELS),
    ];
    const offenders = [];
    const walk = (dir) => {
      for (const ent of readdirSync(dir)) {
        const abs = path.join(dir, ent);
        if (ent === 'node_modules' || ent.startsWith('.')) continue;
        if (statSync(abs).isDirectory()) { walk(abs); continue; }
        if (!/\.(js|jsx)$/.test(ent) || /\.test\.(js|jsx)$/.test(ent)) continue;
        if (abs.endsWith('intradayDiagnosticCopy.js')) continue;
        const src = readFileSync(abs, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        for (const p of phrases) if (src.includes(`'${p}'`) || src.includes(`"${p}"`) || src.includes(`\`${p}\``)) offenders.push(`${path.relative(REPO, abs)}: ${p}`);
      }
    };
    walk(path.join(REPO, 'src'));
    walk(path.join(REPO, 'api'));
    expect(offenders).toEqual([]);
  });
});
