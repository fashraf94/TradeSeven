// api/_utils/evidence/eodhdNews.js
//
// Huddle S1, evidence layer (b) — the EODHD /news fetcher, written against the committed
// capture (api/_utils/__fixtures__/eodhdNewsCapture.js; Amendment C V1.2 §C13). It reads
// ONLY keys the capture shows: `date`, `title`, `link`, `symbols` (never `source`, which
// the payload does not carry, never an item id, which it does not have).
//
// One news item (C1):
//   newsId        the first 16 hex characters of a SHA-256 of the normalized url (EODHD
//                 carries no id; the app's `news-${Date.now()}-${index}` id at
//                 api/news/stock.js:61 changes on every fetch and is never used)
//   publishedAt   the vendor's `date`, never the fetch instant (api/news/stock.js:66
//                 substitutes the fetch time; this does not): an item with no parseable
//                 date is dropped `no_publication_time`
//   url           `link`, required for EODHD kinds: an item without one is dropped `no_url`
//   sourceKind    'press_wire' for a known press-wire host, else 'coverage'. S1 assigns
//                 'primary_release' to nothing: no issuer-domain map exists, and the
//                 capture carried no press-wire item (the host list is unproven by data)
//   source        the link's host (the payload has no `source` key)
//   eventId       best effort (C1): symbol + normalized title + the 24 h window
// RELEVANCE (a capture finding): an item tagged with a symbol is often about another
// company (AAPL's three captured items are about MRVL, GIL and CSCO). An item is kept for
// a symbol only when its title names the ticker, or its US listings are at most two
// (the symbol and one other); otherwise it is dropped `not_about_symbol`.

import { createHash } from 'node:crypto';

export const PRESS_WIRE_HOSTS = Object.freeze([
  'globenewswire.com', 'businesswire.com', 'prnewswire.com', 'accessnewswire.com', 'accesswire.com', 'newsfilecorp.com',
]);
export const NEWS_LIMIT = 10;
export const NEWS_DROP_REASONS = Object.freeze({ NO_URL: 'no_url', NO_PUBLICATION_TIME: 'no_publication_time', NO_TITLE: 'no_title', NOT_ABOUT_SYMBOL: 'not_about_symbol', BEFORE_WINDOW: 'before_window' });

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/** The url as identity: scheme and host lower-cased, no fragment, no utm_* parameters. Null for a non-http(s) url. */
export function normalizeUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let u;
  try { u = new URL(url.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k);
  return u.toString();
}

export const newsIdOf = (normalizedUrl) => sha256(normalizedUrl).slice(0, 16);

const normalizeTitle = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** C1's best-effort dedupe key: symbol + normalized title + the 24 h window it fell in. */
export function bestEffortEventId(symbol, title, publishedMs) {
  return `news:${symbol}:${sha256(`${normalizeTitle(title)}|${Math.floor(publishedMs / 86_400_000)}`).slice(0, 12)}`;
}

const hostOf = (url) => {
  try { return new URL(url).host.toLowerCase().replace(/^www\./, ''); } catch { return null; }
};
export const sourceKindOfHost = (host) => (PRESS_WIRE_HOSTS.some((h) => host === h || host?.endsWith(`.${h}`)) ? 'press_wire' : 'coverage');

/** 'BRK.B' → 'BRK-B' (the EODHD form api/news/stock.js uses). */
export const eodhdTickerOf = (symbol) => `${symbol.replace(/\./g, '-')}.US`;

function usListingsOf(symbols) {
  return new Set((Array.isArray(symbols) ? symbols : [])
    .filter((s) => typeof s === 'string' && /^[A-Z0-9-]+\.US$/.test(s))
    .map((s) => s.slice(0, -3).replace(/-/g, '.')));
}

/**
 * Is this item about `symbol`? Its title names the ticker, or it lists at most two US names (one of them this one). A
 * ticker of one or two letters is also an ordinary word ("A Look at…", "Why AI chip stocks fell"), so the title names it
 * only in a ticker form — "(AI)", "NYSE: A", "NASDAQ:AI", "$AI" (review L2-9).
 */
export function isAboutSymbol(item, symbol) {
  const title = typeof item?.title === 'string' ? item.title : '';
  const escaped = symbol.replace('.', '\\.');
  const named = symbol.replace(/\..*$/, '').length <= 2
    ? new RegExp(`\\(${escaped}\\)|\\b(?:NYSE|NASDAQ|NYSEARCA|NYSEAMERICAN|AMEX|CBOE)\\s*:\\s*${escaped}(?![A-Z])|\\$${escaped}(?![A-Z])`)
    : new RegExp(`(^|[^A-Z])${escaped}([^A-Z]|$)`);
  if (named.test(title)) return true;
  const us = usListingsOf(item?.symbols);
  return us.has(symbol) && us.size <= 2;
}

/**
 * One payload item → a C1 news item, or the reason it was dropped.
 * @returns {{ item: object } | { drop: string }}
 */
export function parseEodhdNewsItem(raw, { symbol, sinceMs = null }) {
  const url = normalizeUrl(raw?.link);
  if (!url) return { drop: NEWS_DROP_REASONS.NO_URL };
  const publishedMs = typeof raw?.date === 'string' ? Date.parse(raw.date) : NaN;
  if (!Number.isFinite(publishedMs)) return { drop: NEWS_DROP_REASONS.NO_PUBLICATION_TIME };
  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  if (!title) return { drop: NEWS_DROP_REASONS.NO_TITLE };
  if (sinceMs !== null && publishedMs < sinceMs) return { drop: NEWS_DROP_REASONS.BEFORE_WINDOW };
  if (!isAboutSymbol(raw, symbol)) return { drop: NEWS_DROP_REASONS.NOT_ABOUT_SYMBOL };
  const host = hostOf(url);
  return {
    item: {
      newsId: newsIdOf(url),
      eventId: bestEffortEventId(symbol, title, publishedMs),
      publishedAt: new Date(publishedMs).toISOString(),
      eventTime: null,
      sourceKind: sourceKindOfHost(host),
      source: host,
      title,
      url,
      primaryReleaseUrl: null,
    },
  };
}

/** Parse a whole payload: kept items (deduped by newsId, newest first, at most NEWS_LIMIT) and drops. */
export function parseEodhdNews(payload, { symbol, sinceMs = null }) {
  const items = [];
  const drops = [];
  const seen = new Set();
  for (const raw of Array.isArray(payload) ? payload : []) {
    const r = parseEodhdNewsItem(raw, { symbol, sinceMs });
    if (r.drop) { drops.push({ source: 'eodhd', reason: r.drop }); continue; }
    if (seen.has(r.item.newsId)) continue;
    seen.add(r.item.newsId);
    items.push(r.item);
  }
  items.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  return { items: items.slice(0, NEWS_LIMIT), drops };
}

/**
 * Fetch one symbol's news since a date (one call, abortable). Never throws.
 * @returns {Promise<{ status: 'ok'|'error'|'skipped', items: object[], drops: object[], reason?: string }>}
 */
export async function fetchEodhdNews({ symbol, sinceMs, fromDate, signal, apiKey = process.env.EODHD_API_KEY, fetchImpl = fetch }) {
  if (!apiKey) return { status: 'skipped', items: [], drops: [], reason: 'no_api_key' };
  const url = `https://eodhd.com/api/news?s=${encodeURIComponent(eodhdTickerOf(symbol))}&limit=${NEWS_LIMIT}&fmt=json${fromDate ? `&from=${fromDate}` : ''}&api_token=${apiKey}`;
  try {
    const res = await fetchImpl(url, { signal });
    if (!res.ok) return { status: 'error', items: [], drops: [], reason: `http_${res.status}` };
    const payload = await res.json();
    if (!Array.isArray(payload)) return { status: 'error', items: [], drops: [], reason: 'not_an_array' };
    return { status: 'ok', ...parseEodhdNews(payload, { symbol, sinceMs }) };
  } catch (err) {
    return { status: 'error', items: [], drops: [], reason: err?.name === 'AbortError' ? 'aborted' : 'request_failed' };
  }
}
