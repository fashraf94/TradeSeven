// EODHD symbol normalization helpers.
// EODHD uses hyphens for share classes (BRK-B.US), but the app uses dots (BRK.B).

/**
 * Normalize a symbol for EODHD API URLs.
 * BRK.B → BRK-B (EODHD uses hyphens for class shares)
 */
export function normalizeSymbolForEODHD(symbol) {
  return symbol.replace(/\./g, '-');
}

/**
 * Convert an EODHD-format symbol back to internal app format.
 * BRK-B → BRK.B (internal app uses dots for class shares)
 * Only converts known share-class patterns to avoid false positives.
 */
export function denormalizeSymbolFromEODHD(symbol) {
  return symbol.replace(/^(BRK)-([AB])$/i, '$1.$2');
}
