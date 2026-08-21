// api/_utils/exaCatalystFetch.js
// Alex Catalyst Confirmation mini-arc (spec V1.1) — F2, DOWNGRADED per the C9
// ruling. EXA is SUPPLEMENTARY CONTEXT, not a catalyst oracle.
//
// Ground truth (Aug 6): fast movers ride PRIMARY sources — the Aug-6 GOOGL
// break moved on Hassabis's own X post, hours ahead of the wire — so general
// web/semantic retrieval is STRUCTURALLY LATE for this class. Two consequences,
// both enforced here rather than instructed:
//   1. Attribution is gated to a CONCRETE, TRIGGER-DAY-DATED occurrence from a
//      non-mirror host (event-shaped query + hard window + domain exclusions +
//      a date-laundering guard against clone domains that stamp fake dates).
//   2. Each surviving result is TAGGED into two channels — ATTRIBUTION vs
//      CONTEXT. The tag is the STRUCTURAL signal the prompt's headline rule
//      keys off (bind by construction, not instruction). An empty attribution
//      channel is the EXPECTED outcome on a fast mover, not a failure (C2).
//
// This is the mover QUERY/tag layer over the generic exaClient (platform
// bookmark: client transport vs domain logic stay separate).

import { queryExa } from '../helpers/exaClient.js';

const EXA_TIMEOUT_MS = 8000;

// Payload cap (Alex scan-movers incident, 2026-08-20). C9 keeps EXA
// SUPPLEMENTARY; this bounds how much EXA volume reaches Alex's prompt. Eight
// full trigger-day results inflated the mover prompt several-fold — cost plus
// token pressure that worsens the SDK's rate-limit backoff. Three is ample
// supplementary color, and each rendered snippet is capped below. This changes
// only the VOLUME injected, not the [ATTRIBUTION]/[CONTEXT] tagging (which is
// working-as-designed per C9: a concrete trigger-day-dated item is
// attribution-grade by definition).
const EXA_NUM_RESULTS = 3;
const MAX_RENDERED_SNIPPET_CHARS = 240;

// Edge-clone / syndication / mirror hosts observed date-laundering stale
// stories (the C9 capture surfaced a Sept-2025 antitrust piece stamped
// 2026-07-30 from such a host). Starter denylist — a FRESHNESS guard, not a
// moderation system; extend from production observation (register per C8).
export const EXCLUDED_DOMAINS = [
  'menafn.com',
  'marketscreener.com',
  'news-pravda.com',
  'newsbreak.com',
  'finanznachrichten.de',
];

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function withinWindow(publishedDate, fromMs, toMs) {
  if (!publishedDate) return false;                 // no date → never attribution-grade
  const t = Date.parse(publishedDate);
  return Number.isFinite(t) && t >= fromMs && t <= toMs;
}

/**
 * Fetch EXA catalyst evidence for a confirmed mover, tagged into channels.
 * Never throws — on any failure it degrades to empty channels (the honesty
 * floor holds under errors, not only empty results).
 *
 * @returns {Promise<{ attribution: object[], context: object[], costDollars: any, degraded: boolean }>}
 */
export async function fetchExaCatalystChannels({ symbol, companyName, direction, marketDate, numResults = EXA_NUM_RESULTS }) {
  const nameStr = companyName ? `${companyName} (${symbol})` : symbol;
  const move = direction === 'down' ? '(decline OR selloff OR drop OR plunge)' : '(surge OR rally OR jump OR pop)';
  // EVENT-shaped, NOT "why is X down Y%": name the event classes and let EXA
  // find the dated occurrence, instead of biasing toward after-the-fact
  // analysis pieces.
  const query =
    `${nameStr} stock ${move}: breaking company news — executive or leadership changes, ` +
    `court or regulatory decision, M&A, guidance change, product or analyst action`;

  const from = `${marketDate}T00:00:00.000Z`;
  const to = `${marketDate}T23:59:59.999Z`;
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);

  let raw;
  try {
    raw = await queryExa({
      query,
      type: 'auto',
      category: 'news',
      numResults,
      startPublishedDate: from,
      endPublishedDate: to,                          // hard trigger-day window
      excludeDomains: EXCLUDED_DOMAINS,
      contents: { text: { maxCharacters: 800 }, highlights: { numSentences: 2, highlightsPerUrl: 2 } },
    }, { timeoutMs: EXA_TIMEOUT_MS });
  } catch (err) {
    console.warn(`[ExaCatalyst] fetch failed for ${symbol}: ${err.message}`);
    return { attribution: [], context: [], costDollars: null, degraded: true };
  }

  const attribution = [];
  const context = [];
  for (const r of raw.results || []) {
    const host = hostOf(r.url);
    if (EXCLUDED_DOMAINS.includes(host)) continue;   // belt-and-suspenders vs excludeDomains
    const snippet = (Array.isArray(r.highlights) && r.highlights.join(' ').trim())
      || (typeof r.text === 'string' ? r.text.slice(0, 300).trim() : '');
    const item = { source: 'exa', title: r.title || '', url: r.url || '', host, publishedDate: r.publishedDate || null, snippet };
    // Concrete-dated-occurrence + date-laundering guard: attribution-grade only
    // if the CLAIMED publishedDate truly lands on the trigger day.
    if (withinWindow(r.publishedDate, fromMs, toMs)) attribution.push(item);
    else context.push(item);
  }
  return { attribution, context, costDollars: raw.costDollars, degraded: false };
}

/**
 * Merge the validated Sonar/EODHD catalyst with the EXA channels into ONE
 * tagged channel set. Pure. The validated catalyst is attribution-grade ONLY at
 * HIGH confidence (a corroborated, concrete narrative); otherwise it is context
 * — so a confident-but-uncorroborated Sonar narrative can never reach the
 * headline (the exact confident-wrong failure the C9 capture surfaced).
 *
 * @returns {{ attribution: object[], context: object[] }}
 */
export function buildRetrievalChannels({ validatedCatalyst = null, validatedConfidence = null, exaChannels = null } = {}) {
  const attribution = [];
  const context = [];

  if (validatedCatalyst && String(validatedCatalyst).trim()) {
    const item = { source: 'sonar', snippet: String(validatedCatalyst).trim(), confidence: validatedConfidence };
    if (validatedConfidence === 'high') attribution.push(item);
    else context.push(item);
  }
  if (exaChannels) {
    for (const a of exaChannels.attribution || []) attribution.push(a);
    for (const c of exaChannels.context || []) context.push(c);
  }
  return { attribution, context };
}

function renderItem(it, i) {
  const cite = it.url ? ` (${it.host || it.url}${it.publishedDate ? `, ${String(it.publishedDate).slice(0, 10)}` : ''})` : '';
  const head = it.title ? `${it.title} — ` : '';
  // Deterministic snippet cap (no word-boundary heuristic) so the same inputs
  // always render identical prompt text — the generation-surface baseline hash
  // depends on it. EXA highlights are otherwise uncapped and were the bulk of
  // the prompt inflation.
  const raw = it.snippet || '';
  const snippet = raw.length > MAX_RENDERED_SNIPPET_CHARS ? `${raw.slice(0, MAX_RENDERED_SNIPPET_CHARS)}…` : raw;
  return `${i + 1}. ${head}${snippet}${cite}`.trim();
}

/**
 * Render the two-channel retrieval block for Alex's prompt. The tags are
 * BINDING and named so the headline rule keys off them structurally. An empty
 * attribution channel renders the honest no-catalyst instruction (C2 is the
 * expected outcome on a fast mover). Pure.
 */
export function renderRetrievalChannelsBlock({ attribution = [], context = [] } = {}) {
  const lines = ['NEWS RETRIEVAL — TWO CHANNELS (the [ATTRIBUTION]/[CONTEXT] tags are BINDING):', ''];

  if (attribution.length > 0) {
    lines.push('[ATTRIBUTION] — concrete, trigger-day-dated occurrences. You MAY name one of these as the catalyst in the headline and body. Cite the specific event.');
    attribution.forEach((it, i) => lines.push(renderItem(it, i)));
  } else {
    lines.push('[ATTRIBUTION] — none. No concrete, trigger-day-dated catalyst was retrieved. Keep the honest "no clear catalyst identified" framing and lead with the technicals. This is the CORRECT outcome for a fast move, not a gap to paper over.');
  }
  lines.push('');
  if (context.length > 0) {
    lines.push('[CONTEXT] — background / undated / off-day / lower-confidence. Use for color ONLY. NEVER attribute the move to a [CONTEXT] item and NEVER put a [CONTEXT] claim in the headline.');
    context.forEach((it, i) => lines.push(renderItem(it, i)));
  } else {
    lines.push('[CONTEXT] — none.');
  }
  return lines.join('\n');
}
