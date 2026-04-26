// Phase 1 prompt-injection / output-validation guard for Signal Drop.
//
// The parse-expand pipeline ingests untrusted user content (tweets, URLs,
// pasted text). We protect against two failure modes:
//
//   1. Prompt injection — the user content tries to override system rules.
//      We wrap parsed text in <USER_SIGNAL_CONTENT> delimiters so the LLM
//      treats it as data, and we flag suspicious patterns for the UI.
//
//   2. Hallucinated tickers in expansion — Gemma occasionally suggests
//      tickers that have nothing to do with the parsed signal. We reject
//      expansions whose related tickers don't share a sector with any
//      parsed/implied ticker, so a fintech tweet can't suddenly recommend
//      gold miners.

import { TICKER_TO_SECTOR } from './rankingConfig.js';
import { normalizeTicker } from './tickerValidation.js';

export function wrapWithDelimiters(text) {
  const safe = typeof text === 'string' ? text : '';
  return `<USER_SIGNAL_CONTENT>\n${safe}\n</USER_SIGNAL_CONTENT>`;
}

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+instructions/i,
  /system\s*:/i,
  /you\s+are\s+now\s+/i,
  /new\s+instructions\s*:/i,
  /disregard\s+(your|the)\s+(prior|previous|above)/i,
];

export function detectInjectionAttempts(text) {
  if (typeof text !== 'string' || !text) return false;
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

// Conservative congruity check: every related ticker in the expansion must
// either appear in the parsed signal's tickers/impliedTickers OR share a
// sector with one of them. Anything outside that set is treated as a
// hallucination and the expansion is rejected.
export function validateExpansionOutput(expansion, parsedSignal) {
  if (!expansion || typeof expansion !== 'object') {
    return { valid: false, reason: 'expansion is missing or not an object' };
  }

  const related = Array.isArray(expansion.relatedTickers) ? expansion.relatedTickers : [];
  if (related.length === 0) {
    return { valid: true };
  }

  const parsedTickers = [
    ...(Array.isArray(parsedSignal?.tickers) ? parsedSignal.tickers : []),
    ...(Array.isArray(parsedSignal?.impliedTickers) ? parsedSignal.impliedTickers : []),
  ]
    .map(normalizeTicker)
    .filter(Boolean);

  const allowedSectors = new Set();
  const allowedTickers = new Set(parsedTickers);
  for (const t of parsedTickers) {
    const sector = TICKER_TO_SECTOR[t];
    if (sector) allowedSectors.add(sector);
  }

  // If the parsed signal has zero anchor tickers, we cannot do a sector check.
  // Fall back to allowing the expansion through — the parse-side bailout
  // logic should already have caught zero-ticker junk.
  if (allowedTickers.size === 0) {
    return { valid: true };
  }

  for (const item of related) {
    const symbol = normalizeTicker(item?.symbol);
    if (!symbol) {
      return { valid: false, reason: `expansion.relatedTickers contains invalid symbol` };
    }
    if (allowedTickers.has(symbol)) continue;
    const sector = TICKER_TO_SECTOR[symbol];
    if (sector && allowedSectors.has(sector)) continue;
    return {
      valid: false,
      reason: `relatedTicker ${symbol} is not in parsed signal and not in any anchored sector`,
    };
  }

  return { valid: true };
}
