// Phase 1 utility for Signal Drop. Validates parsed-signal tickers against the
// 232-symbol Stock Universe defined in rankingConfig.js, returning a clean
// split of supported vs. unsupported tickers so downstream prompts and UI
// can decide between expansion and fork-to-Workshop.

import { TICKER_TO_SECTOR, isRetiredStock } from './rankingConfig.js';

function normalizeTicker(symbol) {
  if (typeof symbol !== 'string') return null;
  const trimmed = symbol.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase().replace(/\./g, '-');
}

export function validateTickers(tickers) {
  const validated = [];
  const unsupported = [];
  const seen = new Set();

  if (!Array.isArray(tickers)) {
    return { validated, unsupported };
  }

  for (const raw of tickers) {
    const normalized = normalizeTicker(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    // BR-3: a retired stock keeps its sector label for existing data, but is
    // never a new pick (rankingConfig.js RETIRED_STOCKS).
    const sectorId = isRetiredStock(normalized) ? null : TICKER_TO_SECTOR[normalized];
    if (sectorId) {
      validated.push({ symbol: normalized, sectorId });
    } else {
      unsupported.push(normalized);
    }
  }

  return { validated, unsupported };
}

export { normalizeTicker };
