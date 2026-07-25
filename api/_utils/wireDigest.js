// api/_utils/wireDigest.js
// FantasyTimes Wire — deterministic digest renderer (Spec V1.5 §4.1, P2).
//
// The MODEL NEVER WRITES THE DIGEST. This pure function renders it from
// validated typed fields via per-eventType templates, so a digest cannot
// assert an undeclared number or an unapproved claim — "Add on pullbacks" is
// unrepresentable by construction (B4).
//
// Locked exemplar (Spec §4.1 — the §9 fixture asserts this EXACT string):
//   earnings_recap, magnitude {8.2, pct, eps_vs_consensus}, direction up,
//   qualifiers [guidance_raised], figures [{5.2, pct, gap_vs_prior_close}],
//   keyLevel {148.50, prior_high}, primaryTicker NVDA →
//   "NVDA earnings: EPS +8.2% vs consensus; guidance raised; gap +5.2% vs prior close; above prior high 148.50."
//
// Clause order: magnitude; qualifiers; figures (in order); keyLevel.
// Every clause maps 1:1 to a typed field. SALVAGE entries (missing optional
// fields) render a shorter digest from the survivors; an entry with only
// eventType+tickers renders the minimal "SUBJECT label." form.

import { EVENT_CONTRACTS } from './wireContracts.js';

// Per-basis clause shape: `${prefix}${formattedValue} ${suffix}`.
// `level: true` bases are absolute levels (consensus/prior prints) and render
// unsigned; everything else is a signed change.
const BASIS_CLAUSES = {
  price_vs_level: { prefix: 'price ', suffix: ' vs level' },
  volume_vs_avg: { prefix: 'volume ', suffix: ' vs avg' },
  range_vs_atr: { prefix: 'range ', suffix: ' vs ATR' },
  index_vs_prior_close: { prefix: '', suffix: ' vs prior close' },
  price_vs_prior_close: { prefix: '', suffix: ' vs prior close' },
  gap_vs_prior_close: { prefix: 'gap ', suffix: ' vs prior close' },
  print_vs_expected: { prefix: '', suffix: ' vs expected' },
  consensus_estimate: { prefix: 'consensus ', suffix: '', level: true },
  prior_print: { prefix: 'prior ', suffix: '', level: true },
  eps_vs_consensus: { prefix: 'EPS ', suffix: ' vs consensus' },
  revenue_vs_consensus: { prefix: 'revenue ', suffix: ' vs consensus' },
  sector_vs_spy: { prefix: '', suffix: ' vs SPY' },
  rs_vs_peers: { prefix: 'RS ', suffix: ' vs peers' },
};

const KEY_LEVEL_LABELS = {
  prior_high: 'prior high',
  prior_low: 'prior low',
  resistance: 'resistance',
  support: 'support',
  sma50: '50-day MA',
  sma200: '200-day MA',
  open: 'open',
  prior_close: 'prior close',
  vwap: 'VWAP',
};

/**
 * Render the agent digest for a validated facts object.
 *
 * @param {object} facts — validated survivors (wireValidator output `facts`)
 *   plus a `primaryTicker` hint resolved server-side (may be null).
 * @returns {string|null} the digest, or null when no template applies.
 */
export function renderWireDigest(facts) {
  if (!facts || !facts.eventType || !EVENT_CONTRACTS[facts.eventType]) return null;
  const contract = EVENT_CONTRACTS[facts.eventType];

  // Subject: the server-canonical primary ticker when present, else the
  // first validated ticker, else the contract's zero-ticker subject noun.
  const subject =
    facts.primaryTicker ||
    (Array.isArray(facts.tickers) && facts.tickers[0]) ||
    contract.zeroTickerSubject ||
    'Market';

  const clauses = [];

  if (facts.magnitude) {
    const clause = basisClause(facts.magnitude);
    if (clause) clauses.push(clause);
  }

  for (const q of facts.qualifiers || []) {
    clauses.push(String(q).replace(/_/g, ' '));
  }

  for (const f of facts.figures || []) {
    const clause = basisClause(f);
    if (clause) clauses.push(clause);
  }

  if (facts.keyLevel) {
    const rel = facts.direction === 'down' ? 'below' : facts.direction === 'up' ? 'above' : 'near';
    const label = KEY_LEVEL_LABELS[facts.keyLevel.type] || facts.keyLevel.type;
    clauses.push(`${rel} ${label} ${facts.keyLevel.price.toFixed(2)}`);
  }

  const head = `${subject} ${contract.label}`;
  return clauses.length > 0 ? `${head}: ${clauses.join('; ')}.` : `${head}.`;
}

function basisClause({ value, unit, basis }) {
  const shape = BASIS_CLAUSES[basis];
  if (!shape || !Number.isFinite(value)) return null;
  return `${shape.prefix}${formatValue(value, unit, shape.level === true)}${shape.suffix}`;
}

/**
 * Deterministic value formatting. Signed changes carry an explicit sign
 * ('+8.2%'); level bases render unsigned ('consensus 2.45'). Trailing zeros
 * trimmed to at most 2 decimals ('8.20' → '8.2'; '148.00' → '148').
 */
function formatValue(value, unit, isLevel) {
  const abs = trimDecimals(Math.abs(value));
  // A magnitude that rounds to zero carries no direction — emitting "+0%" or
  // "-0%" would assert one the data does not support.
  const sign = abs === '0' ? '' : isLevel ? (value < 0 ? '-' : '') : value < 0 ? '-' : '+';
  switch (unit) {
    case 'pct': return `${sign}${abs}%`;
    case 'pp': return `${sign}${abs}pp`;
    case 'x': return `${sign}${abs}x`;
    case 'usd': return `${sign}$${abs}`;
    case 'pts': return `${sign}${abs}pts`;
    case 'count':
    default: return `${sign}${abs}`;
  }
}

function trimDecimals(n) {
  return String(Number(n.toFixed(2)));
}
