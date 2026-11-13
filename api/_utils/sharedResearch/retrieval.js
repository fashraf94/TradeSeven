// api/_utils/sharedResearch/retrieval.js
//
// Shared Research — THE RETRIEVAL ADAPTER (spec §6.5, R5). One web search per
// step at most, over the generic Exa transport (api/helpers/exaClient.js
// queryExa); the mover query layer is not reused — only its excluded-domain
// list and host helper (api/_utils/exaCatalystFetch.js). Providers stay
// replaceable behind this one function.
//
// NEVER THROWS: a failed search answers `{ error }` and the step proceeds
// WITHOUT retrieval — the prompt says so, and the validator cannot write a
// `verified` fact with no item to cite.

import { queryExa } from '../../helpers/exaClient.js';
import { EXCLUDED_DOMAINS, hostOf } from '../exaCatalystFetch.js';
import { isSourceUrl, SOURCE_URL_MAX_LEN } from '../researchRecords/model.js';
import { instantOf } from './stepSchema.js';

export const RETRIEVAL_TIMEOUT_MS = 8000;
export const NUM_RESULTS = 5;
export const QUERY_MAX = 400;

/** The search text: the step's focus (the next action, the target, the direction) or the question, and up to three names. */
export function queryOf({ question, focus = null, direction = null, symbols = [] }) {
  const parts = [focus || question];
  if (direction) parts.push(direction);
  const names = (Array.isArray(symbols) ? symbols : []).slice(0, 3);
  if (names.length) parts.push(names.join(' '));
  return parts.map((p) => String(p ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' — ').slice(0, QUERY_MAX);
}

/** The Exa /search body (spec §6.5). */
export function exaBodyOf({ query, numResults = NUM_RESULTS }) {
  return {
    query,
    type: 'auto',
    numResults,
    contents: { highlights: { numSentences: 3, highlightsPerUrl: 2 }, text: false },
    excludeDomains: [...EXCLUDED_DOMAINS],
  };
}

/** The usable items, numbered in rank order: an http(s) url of at most 1,024 characters, else dropped. */
export function itemsOf(results) {
  const out = [];
  for (const r of Array.isArray(results) ? results : []) {
    const url = typeof r?.url === 'string' ? r.url.trim() : '';
    if (!url || url.length > SOURCE_URL_MAX_LEN || !isSourceUrl(url)) continue;
    const host = hostOf(url);
    out.push({
      index: out.length,
      url,
      title: typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 300) : host,
      host,
      publishedDate: instantOf(r.publishedDate),
      highlights: (Array.isArray(r.highlights) ? r.highlights : []).filter((h) => typeof h === 'string' && h.trim()).map((h) => h.trim().slice(0, 600)).slice(0, 2),
    });
  }
  return out;
}

/** Exa's own cost figure for the call (its `costDollars.total`), or null. */
export const costOf = (costDollars) => (Number.isFinite(costDollars?.total) ? costDollars.total : (Number.isFinite(costDollars) ? costDollars : null));

/**
 * One retrieval.
 * @returns {Promise<{ items: object[], costDollars: number|null, elapsedMs: number, readAt: string } | { error: string, elapsedMs: number }>}
 */
export async function retrieve({ question, focus = null, direction = null, symbols = [], numResults = NUM_RESULTS, search = queryExa, now = Date.now }) {
  const started = now();
  try {
    const query = queryOf({ question, focus, direction, symbols });
    const res = await search(exaBodyOf({ query, numResults }), { timeoutMs: RETRIEVAL_TIMEOUT_MS });
    const readAt = new Date(now()).toISOString();
    return { items: itemsOf(res?.results), costDollars: costOf(res?.costDollars), elapsedMs: now() - started, readAt };
  } catch (err) {
    return { error: /timeout/i.test(String(err?.message)) ? 'retrieval_timeout' : 'retrieval_failed', elapsedMs: now() - started };
  }
}
