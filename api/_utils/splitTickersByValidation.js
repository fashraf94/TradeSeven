// api/_utils/splitTickersByValidation.js
//
// Sprint 6 Phase 4.5a — pure helper for the Signal Read confirmation UI.
// Projects the parse-signal response envelope into the three string-array
// buckets the ConfirmView needs to render:
//
//   - validated:   symbols from parse.tickers that passed universe validation
//   - implied:     symbols from parse.impliedTickers (raw passthrough)
//   - unsupported: symbols from parse.tickers that failed universe validation
//
// Returns string arrays (not the {symbol, sectorId} validated-entry shape) so
// the UI can render chips without re-projecting. Defensive against malformed
// inputs — every missing field defaults to empty array, never throws.

export function splitTickersByValidation(parseResult) {
  const parse = parseResult && typeof parseResult === 'object' && parseResult.parse
    ? parseResult.parse
    : {};
  const validation = parseResult && typeof parseResult === 'object' && parseResult.validation
    ? parseResult.validation
    : {};

  const validated = Array.isArray(validation.validated)
    ? validation.validated
        .map((entry) => (entry && typeof entry.symbol === 'string' ? entry.symbol : null))
        .filter(Boolean)
    : [];

  const unsupported = Array.isArray(validation.unsupported)
    ? validation.unsupported.filter((sym) => typeof sym === 'string' && sym.length > 0)
    : [];

  const implied = Array.isArray(parse.impliedTickers)
    ? parse.impliedTickers.filter((sym) => typeof sym === 'string' && sym.length > 0)
    : [];

  return { validated, implied, unsupported };
}
