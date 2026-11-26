// api/_utils/explore/__fixtures__/fixtureFetch.js
//
// TEST SUPPORT for the publish step (never imported by a production path). The tests make no network call: they hand
// the REAL fetchDocument (fetchSource.js) a transport that answers from committed documents and a resolver that
// answers from a table. The transport asks the request's `lookup` for the host first, exactly as the production
// transport's socket does, so the address checks run on every request, redirects included.
//
//   routes   { [url]: answer }, an answer being one of
//              { file, type }              200 with that committed document (__fixtures__/docs/) and content type
//              { html } | { body, type }   200 with that text
//              { status }                  that status, no body
//              { redirect, status? }       a redirect (302 unless given) to that link
//              { hang: true }              never answers (the fetcher's time limit ends it)
//              { error: 'ECONNRESET' }     the connection fails
//   hosts    { [hostname]: address | [addresses] } — any other host resolves to a public address

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchDocument } from '../fetchSource.js';

export const DOCS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'docs');
export const docBytes = (name) => readFileSync(path.join(DOCS_DIR, name));
export const PUBLIC_ADDRESS = '93.184.216.34';
export const TEST_CONTACT = 'publish-tests@example.com';

/** A resolver answering from `hosts` (every other host: one public address). Records each host asked. */
export function fixtureResolver(hosts = {}, asked = []) {
  return async (host) => {
    asked.push(host);
    const a = Object.hasOwn(hosts, host) ? hosts[host] : PUBLIC_ADDRESS;
    return (Array.isArray(a) ? a : [a]).map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  };
}

/** A transport answering from `routes` (see the header). Records each request in `calls`. */
export function fixtureTransport(routes, calls = []) {
  return async (url, { headers, lookup, signal }) => {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    await new Promise((resolve, reject) => lookup(host, { all: true }, (err) => (err ? reject(err) : resolve())));
    calls.push({ url, headers });
    const r = routes[url];
    if (!r) return { status: 404, headers: {}, body: null };
    if (r.hang) {
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    }
    if (r.error) throw Object.assign(new Error(`socket ${r.error}`), { code: r.error });
    if (r.redirect) return { status: r.status ?? 302, headers: { location: r.redirect }, body: null };
    if (r.status && !r.file && !r.html && !r.body) return { status: r.status, headers: {}, body: null };
    if (r.file) return { status: 200, headers: { 'content-type': r.type }, body: docBytes(r.file) };
    if (r.html !== undefined) return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: Buffer.from(r.html, 'utf8') };
    return { status: 200, headers: { 'content-type': r.type ?? 'text/plain' }, body: Buffer.isBuffer(r.body) ? r.body : Buffer.from(String(r.body), 'utf8') };
  };
}

/**
 * The real fetchDocument over the fixture transport and resolver: what matchStories and the command are handed.
 * `fetched` records each link the matcher asked for.
 */
export function fixtureFetcher(routes, { hosts = {}, calls = [], fetched = [], timeoutMs = 300, maxBytes, now = () => new Date('2026-11-25T16:00:00.000Z') } = {}) {
  const transport = fixtureTransport(routes, calls);
  const resolve = fixtureResolver(hosts);
  return (url, { contact }) => {
    fetched.push(url);
    return fetchDocument(url, { contact, transport, resolve, now, timeoutMs, ...(maxBytes ? { maxBytes } : {}) });
  };
}

/** An HTML page whose visible text is these sentences, one paragraph each. */
export const pageOf = (sentences, { date = null } = {}) => `<!doctype html><html><head>${date ? `<meta property="article:published_time" content="${date}">` : ''}<title>t</title></head><body>${sentences.map((s) => `<p>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}</body></html>`;

/**
 * Routes under which every quote of these records is found: one page per link, holding the source's own excerpt and
 * every cell's and input's excerpt that cites a source at that link.
 */
export function allFoundRoutes(records) {
  const byUrl = new Map();
  const put = (url, text) => { if (typeof url === 'string' && typeof text === 'string') { if (!byUrl.has(url)) byUrl.set(url, []); byUrl.get(url).push(text); } };
  for (const r of records) {
    const urlOf = new Map((r.sources || []).map((s) => [s.id, s.url]));
    for (const s of r.sources || []) put(s.url, s.excerpt);
    for (const q of r.questions || []) for (const m of q.measures || []) for (const c of m.cells || []) {
      put(urlOf.get(c.sourceId), c.excerpt);
      for (const i of c.inputs || []) put(urlOf.get(i.sourceId), i.excerpt);
    }
  }
  return Object.fromEntries([...byUrl].map(([url, texts]) => [url, { html: pageOf(texts, { date: '2026-10-29T20:05:00Z' }) }]));
}
