/**
 * correlationGroup — pure group primitives for the Correlation Lab (V2 Build 6).
 *
 * Home for the group validators (`SYMBOL_RE`, `parseGroup`) and the Agent-Book /
 * URL-prefill sourcing helpers. Extracted OUT of CorrelationLab.jsx so the new
 * source hooks (useWatchlistGroup / useAgentBookGroup) can import the SAME
 * pre-validation without an ESM import cycle (the hooks are imported BY the Lab).
 * CorrelationLab.jsx re-exports `parseGroup` / `SYMBOL_RE` from here, so the
 * validators keep one definition and the smoke-test/in-file surfaces are stable.
 *
 * Pure — no React, no Firebase. Its only import is `isCrypto` (the Lab's own
 * equity/crypto classifier), which keeps agent-book sourcing decoupled from the
 * fenced battle-doc's `isCrypto` flag: sourced groups are equities-only by the
 * Lab's own determination, never by trusting a scoring-adjacent doc field.
 */
import { isCrypto } from '../../utils/stockHelpers';
import { CRYPTO_POOL_SYMBOLS } from '../../constants/cryptoPool';

// A symbol is non-equity if the Lab's own classifier flags it OR it is in the
// agent crypto pool. The union matters: stockHelpers.isCrypto omits BNB, which
// IS a valid agent support-crypto pick (cryptoPool.js) — without the pool check
// a BNB book position would leak into an "equities only" sourced group. Both
// sources use the same rule, and neither reads the fenced doc's isCrypto flag.
function isNonEquitySymbol(s) {
  return isCrypto(s) || CRYPTO_POOL_SYMBOLS.has(s);
}

// Mirrors the endpoint's pinned regex: start with an uppercase letter, then 0–9
// more of [A-Z0-9.-] (max length 10). Moved verbatim from CorrelationLab.jsx.
export const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;

// Shared group parsing/validation for both run kinds (one rule, no drift). Pure
// over its argument. Moved from CorrelationLab.jsx (behavior-preserving; the only
// addition is a String(source ?? '') null-guard) — the RUN-path validator: it
// REJECTS (never truncates) a group outside 1–10.
export function parseGroup(source) {
  const group = [...new Set(String(source ?? '').split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (group.length < 1 || group.length > 10) {
    return { error: 'Enter 1–10 ticker symbols (comma-separated). A single ETF proxy works too.' };
  }
  const bad = group.filter((s) => !SYMBOL_RE.test(s));
  if (bad.length) return { error: `Not a valid ticker: ${bad.join(', ')}` };
  return { group };
}

/**
 * The SOURCE normalizer — for discrete symbol lists arriving from a watchlist or
 * an agent book (not a free-text field). Trim + uppercase + dedupe (insertion
 * order preserved), then partition by SYMBOL_RE. Unlike parseGroup it does NOT
 * reject a > 10 list — sources TRUNCATE (see buildSourceGroup), never reject.
 * @param {Array<string>} rawSymbols
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function normalizeGroupSymbols(rawSymbols) {
  const seen = new Set();
  const valid = [];
  const invalid = [];
  for (const raw of Array.isArray(rawSymbols) ? rawSymbols : []) {
    const s = String(raw ?? '').trim().toUpperCase();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (SYMBOL_RE.test(s)) valid.push(s);
    else invalid.push(s);
  }
  return { valid, invalid };
}

/**
 * Shared shaper for BOTH sources. Pipeline: normalize → drop invalid → drop
 * crypto (surfaced, never silent) → take the first 10 EQUITIES (callers pass the
 * symbols in the order they want truncated: watchlists in doc order, books in
 * star→core→support slot order). Returns null when nothing valid survives (a
 * chip renders ONLY with ≥ 1 valid equity — never a disabled mystery button).
 *
 * The returned `truncatedFrom` / `excludedCrypto` are NON-scoring provenance
 * metadata (symbol counts + names) that ride alongside the spec's
 * {symbols,label,asOf}; they never leave the client and are never sent to any
 * endpoint (run() forwards only the parsed group).
 * @returns {{symbols:string[], label:string, asOf:(number|null), truncatedFrom:number, excludedCrypto:string[], agentName?:string} | null}
 */
export function buildSourceGroup(orderedSymbols, { label, asOf = null, agentName } = {}) {
  const { valid } = normalizeGroupSymbols(orderedSymbols);
  const excludedCrypto = valid.filter(isNonEquitySymbol);
  const equities = valid.filter((s) => !isNonEquitySymbol(s));
  const symbols = equities.slice(0, 10);
  if (symbols.length === 0) return null;
  return {
    symbols,
    label,
    asOf,
    truncatedFrom: equities.length,
    excludedCrypto,
    ...(agentName !== undefined ? { agentName } : {}),
  };
}

/**
 * Normalize a variety of stored timestamps to ms epoch (or null). Handles a
 * Firestore Timestamp (toMillis / .seconds), an ISO string, a Date, or a raw
 * number — so the readers can hand fmtAsOf a plain number and stay mock-free.
 */
export function tsToMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v.toMillis === 'function') return v.toMillis(); // Firestore Timestamp
  if (typeof v.seconds === 'number') return v.seconds * 1000; // Timestamp-like
  if (typeof v._seconds === 'number') return v._seconds * 1000; // serialized Admin-SDK Timestamp
  if (v instanceof Date) return v.getTime();
  return null;
}

/**
 * The PURE URL-prefill parser (Change 2). Reads labGroup + labDriver from a
 * query string and returns { groupInput, driverKey } ONLY when EVERYTHING is
 * valid — otherwise null (the whole param set is ignored; never a partial fill).
 * Guards (pinned): same SYMBOL_RE per symbol + 1–10 cap (via parseGroup), the
 * driver must be a registry key, and CUSTOM is hard-excluded from URL prefill.
 * @param {string} search - window.location.search
 * @param {Record<string,unknown>} validDriverKeys - the driver registry (DRIVER_LABELS)
 * @returns {{ groupInput: string, driverKey: string } | null}
 */
export function parseLabPrefill(search, validDriverKeys) {
  let labGroup;
  let labDriver;
  try {
    const params = new URLSearchParams(search || '');
    labGroup = params.get('labGroup');
    labDriver = params.get('labDriver');
  } catch {
    return null; // malformed encoding — ignore entirely
  }
  if (!labGroup || !labDriver) return null;
  // Driver must be a registry key and never CUSTOM (own-prototype check so a
  // key like 'toString' can't sneak through the registry object).
  if (labDriver === 'CUSTOM') return null;
  if (!validDriverKeys || !Object.prototype.hasOwnProperty.call(validDriverKeys, labDriver)) return null;
  // Group: the SAME validation the run path uses (1–10, SYMBOL_RE per symbol).
  const parsed = parseGroup(labGroup);
  if (parsed.error) return null;
  return { groupInput: parsed.group.join(', '), driverKey: labDriver };
}

// The §9 display-agreement guard: a provenance line renders only while it still
// describes EXACTLY the group in the box. Any manual edit changes groupInput and
// the line disappears by construction (also cleared imperatively in onChange).
export function shouldShowProvenance(provenance, groupInput) {
  return !!provenance && provenance.groupString === groupInput;
}

// Short "as of" stamp in market time (America/New_York) — fixed TZ so it is
// deterministic (mirrors useDailyRegimeBrief's market-time idiom) and testable.
export function fmtAsOf(asOf) {
  if (asOf == null) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(asOf));
  } catch {
    return '';
  }
}

/**
 * Deterministic provenance-line copy from a provenance object. Sources:
 *   watchlist → "Group: your equipped watchlist · {n} tickers · as of {time}"
 *   book      → "Group: {Agent}'s current book · {n} tickers · as of {time}"
 *   url       → "Group: linked from elsewhere"
 * Honesty additions (appended, when applicable):
 *   "(showing the 10 largest of {N})"  — books (slot-order proxy)
 *   "(showing the first 10 of {N})"    — watchlists (doc order)
 *   "({k} non-equity positions excluded — equities only for now)"
 */
export function provenanceLineText(provenance) {
  if (!provenance) return '';
  if (provenance.source === 'url') return 'Group: linked from elsewhere';

  const parts = [`Group: ${provenance.label}`];
  if (provenance.count != null) {
    parts.push(`${provenance.count} ticker${provenance.count === 1 ? '' : 's'}`);
  }
  if (provenance.asOf != null) {
    // Only append the freshness clause when the stamp actually formatted — a
    // failed/absent format must not leave a dangling "· as of ".
    const when = fmtAsOf(provenance.asOf);
    if (when) parts.push(`as of ${when}`);
  }
  let text = parts.join(' · ');

  const extras = [];
  if (provenance.truncatedFrom != null && provenance.count != null && provenance.truncatedFrom > provenance.count) {
    const how = provenance.source === 'book' ? '10 largest' : 'first 10';
    extras.push(`showing the ${how} of ${provenance.truncatedFrom}`);
  }
  if (Array.isArray(provenance.excludedCrypto) && provenance.excludedCrypto.length) {
    const k = provenance.excludedCrypto.length;
    extras.push(`${k} non-equity position${k === 1 ? '' : 's'} excluded — equities only for now`);
  }
  if (extras.length) text += ' ' + extras.map((e) => `(${e})`).join(' ');
  return text;
}
