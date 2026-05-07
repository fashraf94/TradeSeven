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
import { logSignalDrops } from './shadowLogger.js';

// Wraps untrusted text in delimiter tags so the LLM treats the content as
// data, not instructions. Default tag name preserves the existing
// USER_SIGNAL_CONTENT contract for parse-signal / expand-signal callers.
//
// Phase 2.5 Fix 3 (audit C1): the tag name is now a parameter so the
// dialogue endpoint and signal_expansion mode can wrap each parse
// metadata field in its own <PARSED_*> envelope (e.g. <PARSED_TOPIC>).
// The defensive prompt instruction in WATCHLIST_PHASE_RULES tells Gemma
// to treat content inside any <PARSED_*> tag as untrusted user data.
export function wrapWithDelimiters(text, tagName = 'USER_SIGNAL_CONTENT') {
  const safe = typeof text === 'string' ? text : '';
  return `<${tagName}>\n${safe}\n</${tagName}>`;
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

// Validation contract: warning + passthrough by default, hard-rejection only
// for the "complete hallucination" case (every expansion ticker has zero
// relationship to any parsed ticker — neither literal nor sector-adjacent).
//
// Cross-sector incongruities (e.g., AAPL anchor + GOOGL/META expansion, where
// XLK and XLC are technically different sectors but conceptually one cluster)
// surface as a warning rather than a rejection. The expand endpoint passes
// these through with `validationWarning` attached so the harness summary.json
// and quality review can spot patterns. Phase 2 polish will likely add a
// thematic-cluster whitelist (Big Tech → [XLK, XLC, XLY], AI Infra → [XLK,
// XLI, XLU], etc.) once we've seen what Gemma actually produces.
//
// Return shape:
//   { valid: boolean, hardRejection: boolean, reason: string|null, warning: string|null }
export function validateExpansionOutput(expansion, parsedSignal) {
  if (!expansion || typeof expansion !== 'object') {
    return {
      valid: false,
      hardRejection: true,
      reason: 'expansion is missing or not an object',
      warning: null,
    };
  }

  const related = Array.isArray(expansion.relatedTickers) ? expansion.relatedTickers : [];
  if (related.length === 0) {
    return { valid: true, hardRejection: false, reason: null, warning: null };
  }

  const parsedTickers = [
    ...(Array.isArray(parsedSignal?.tickers) ? parsedSignal.tickers : []),
    ...(Array.isArray(parsedSignal?.impliedTickers) ? parsedSignal.impliedTickers : []),
  ]
    .map(normalizeTicker)
    .filter(Boolean);

  const parsedTickerSet = new Set(parsedTickers);
  const parsedSectors = new Set();
  for (const t of parsedTickers) {
    const sector = TICKER_TO_SECTOR[t];
    if (sector) parsedSectors.add(sector);
  }

  // Off-universe guard: parsed tickers exist but none are in our universe.
  // Sector congruity check is mathematically meaningless against an empty
  // baseline. Skip the check, log the off-universe tickers for future
  // Universe Intelligence sprint to consume, and pass the expansion through.
  // Closes both Mode A (latent hard-rejection) and Mode B (spurious warning)
  // from Sprint A audit D2.3.
  if (parsedSectors.size === 0) {
    // Fire-and-forget: capture off-universe tickers for future universe expansion.
    // Failure here must NEVER block validation — wrap in catch.
    logSignalDrops({
      event: 'off_universe_ticker_seen',
      tickers: parsedTickers,
      contentType: parsedSignal?.contentType || 'unknown',
      signalDirection: parsedSignal?.signalDirection || 'uncertain',
      topic: parsedSignal?.topic || '',
      capturedAt: new Date().toISOString(),
    }).catch(() => {});

    return {
      valid: true,
      hardRejection: false,
      reason: null,
      warning: 'sector congruity check skipped: parsed tickers outside supported universe',
    };
  }

  // Defensive passthrough: if the parsed signal has zero anchor tickers, we
  // can't do any congruity check. Parse-side bailout should have caught the
  // junk-input case already; we don't second-guess it here.
  if (parsedTickerSet.size === 0) {
    return { valid: true, hardRejection: false, reason: null, warning: null };
  }

  const directOverlap = [];
  const sectorMatches = [];
  const crossSectorOrUnknown = [];

  for (const item of related) {
    const symbol = normalizeTicker(item?.symbol);
    if (!symbol) {
      // A missing symbol is malformed expansion output, not a hallucination —
      // treat as a warning and let downstream filter the bad row.
      crossSectorOrUnknown.push('(missing-symbol)');
      continue;
    }
    if (parsedTickerSet.has(symbol)) {
      directOverlap.push(symbol);
      continue;
    }
    const sector = TICKER_TO_SECTOR[symbol];
    if (sector && parsedSectors.has(sector)) {
      sectorMatches.push(symbol);
    } else {
      crossSectorOrUnknown.push(symbol);
    }
  }

  // Hard rejection: every expansion ticker missed both the literal-overlap and
  // the sector-overlap check, AND we had parsed tickers to anchor against.
  // This is the "Gemma recommended JNJ + KO when the signal was about
  // semis" case — a complete topical disconnect.
  if (directOverlap.length === 0 && sectorMatches.length === 0) {
    return {
      valid: false,
      hardRejection: true,
      reason: `expansion tickers [${crossSectorOrUnknown.join(', ')}] have no literal or sector overlap with parsed tickers [${parsedTickers.join(', ')}]`,
      warning: null,
    };
  }

  // Some matched, some didn't — surface the cross-sector ones as a warning
  // but pass the expansion through. Quality review uses these to spot
  // legitimate cross-sector clusters (Big Tech, AI infra, energy transition).
  if (crossSectorOrUnknown.length > 0) {
    const parsedSectorList = [...parsedSectors].sort().join(', ') || '(no sector for parsed tickers)';
    return {
      valid: true,
      hardRejection: false,
      reason: null,
      warning: `cross-sector or unknown tickers in expansion: ${crossSectorOrUnknown.join(', ')} (parsed sectors: ${parsedSectorList})`,
    };
  }

  return { valid: true, hardRejection: false, reason: null, warning: null };
}
