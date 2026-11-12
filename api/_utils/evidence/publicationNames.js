// api/_utils/evidence/publicationNames.js
//
// Huddle S1.1 — PUBLICATIONS BY NAME, NOT HOST (Amendment E §E3 e; docs/design/SHADOW_VOICE_RULES_V1.md §1.5). EODHD's
// /news carries no `source` key, so an item's source is its link's host (eodhdNews.js); Shadow said "finance.yahoo.com
// reported" on Nov 9. This small map turns a known host into the publication's name; an unknown host is said without its
// `www.`. It is applied where a headline becomes a pack item (packItem.headlineItem: the fact AND the source label), so the
// model only ever sees the name — for a morning's fresh items and for evidence records cached before this map existed.
// The hosts: the two the committed /news capture shows (api/_utils/__fixtures__/eodhdNewsCapture.js), the press wires the
// news fetcher already knows (eodhdNews.js PRESS_WIRE_HOSTS), and a few common EODHD coverage hosts. Pure; ZERO imports.

export const PUBLICATION_NAMES = Object.freeze({
  'finance.yahoo.com': 'Yahoo Finance',
  'seekingalpha.com': 'Seeking Alpha',
  'globenewswire.com': 'GlobeNewswire',
  'businesswire.com': 'Business Wire',
  'prnewswire.com': 'PR Newswire',
  'accessnewswire.com': 'ACCESS Newswire',
  'accesswire.com': 'ACCESSWIRE',
  'newsfilecorp.com': 'Newsfile',
  'fool.com': 'The Motley Fool',
  'zacks.com': 'Zacks',
  'benzinga.com': 'Benzinga',
  'marketwatch.com': 'MarketWatch',
  'reuters.com': 'Reuters',
  'cnbc.com': 'CNBC',
});

const looksLikeHost = (s) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s);

/** A source as said: a known host's publication name; an unknown host without `www.`; any other name unchanged. */
export function publicationNameOf(source) {
  if (typeof source !== 'string') return null;
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (!looksLikeHost(trimmed)) return trimmed;
  const host = trimmed.toLowerCase().replace(/^www\./, '');
  if (Object.prototype.hasOwnProperty.call(PUBLICATION_NAMES, host)) return PUBLICATION_NAMES[host];
  return host;
}
