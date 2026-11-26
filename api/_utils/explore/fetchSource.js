// api/_utils/explore/fetchSource.js
//
// Explore publish step — THE FETCHER (build prompt K-5; SQ-2, SQ-3). Server code, run only by the founder's command
// (scripts/explore-publish.mjs); no route imports it, and nothing in the app calls it.
//
//   • https only, on the first link and on every redirect; a link that carries a user name or password is refused.
//   • Every host is resolved by THIS code, and the connection is made to the address that was checked (the request's
//     own `lookup` is the checked one, so a second answer from DNS cannot slip in): a link that resolves to any
//     address that is not public — private, loopback, link-local, unspecified, shared, multicast, reserved or for
//     documentation, in IPv4 or IPv6, an IPv4 address mapped into IPv6 included — is never fetched. A host written as
//     an address is checked the same way.
//   • Redirects are followed, MAX_REDIRECTS at most, each one checked again as above.
//   • One time limit for the whole document (FETCH_TIMEOUT_MS, redirects included) and one size limit
//     (MAX_DOCUMENT_BYTES, on the bytes received and on the bytes once decompressed).
//   • A plain user agent naming the app and a contact address read from the environment (CONTACT_ENV). Without a
//     contact address nothing is fetched (SQ-2).
//   • No cookie is sent or kept, no credential is sent, nothing is run.
//
// A refusal, an error, a time-out or a status other than 2xx is not a failure of the run: the answer is
// `{ ok: false, reason }`, and the source is recorded `by: 'read'` with that reason in the report.

import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';

/** The time limit for one document, redirects included. */
export const FETCH_TIMEOUT_MS = 20_000;
/** The size limit for one document: bytes received, and bytes once decompressed. */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
/** Redirects followed at most. */
export const MAX_REDIRECTS = 5;
/** The environment variable holding the contact address the user agent names (SQ-2). */
export const CONTACT_ENV = 'EXPLORE_PUBLISH_CONTACT';
export const USER_AGENT_PRODUCT = 'FantasyTrades-ExplorePublish/1';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** The contact address from the environment: an email address or an https link, one line — else null. */
export function contactOf(env = process.env) {
  const v = typeof env?.[CONTACT_ENV] === 'string' ? env[CONTACT_ENV].trim() : '';
  if (!v || v.length > 200 || /[\s<>"\\]/.test(v) || /[^\x21-\x7e]/.test(v)) return null;
  if (/^[^@]+@[^@]+\.[^@]+$/.test(v)) return v;
  try { return new URL(v).protocol === 'https:' ? v : null; } catch { return null; }
}

/** The user agent: the app, and how to reach whoever runs it. */
export const userAgentOf = (contact) => `${USER_AGENT_PRODUCT} (+${contact})`;

// ── addresses ────────────────────────────────────────────────────────────────────────────────────────────────────

function ipv4Octets(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return null;
  return parts.map(Number);
}

/** Is this IPv4 address public? Every non-global range is refused. */
function isPublicIPv4(ip) {
  const o = ipv4Octets(ip);
  if (!o) return false;
  const [a, b, c] = o;
  if (a === 0 || a === 10 || a === 127) return false; // "this network", private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // shared address space
  if (a === 169 && b === 254) return false; // link-local
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // protocol assignments, documentation
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

/** An IPv6 address as eight 16-bit groups, or null. An embedded IPv4 tail is read as two groups. */
function ipv6Groups(ip) {
  let s = ip.toLowerCase().split('%')[0];
  const v4 = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const o = ipv4Octets(v4[2]);
    if (!o) return null;
    s = `${v4[1]}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/** Is this IPv6 address public? Global unicast (2000::/3) only, less documentation, 6to4 and Teredo; mapped IPv4 as IPv4. */
function isPublicIPv6(ip) {
  const g = ipv6Groups(ip);
  if (!g) return false;
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isPublicIPv4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  if ((g[0] & 0xe000) !== 0x2000) return false; // not global unicast: ::, ::1, fc00::/7, fe80::/10, ff00::/8 …
  if (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) return false; // documentation, Teredo
  if (g[0] === 0x2002) return false; // 6to4 (it carries an IPv4 address of any kind)
  return true;
}

/** Is `ip` a public address? Anything that is not an address is not. */
export function isPublicAddress(ip) {
  if (typeof ip !== 'string') return false;
  if (net.isIPv4(ip)) return isPublicIPv4(ip);
  if (net.isIPv6(ip)) return isPublicIPv6(ip);
  return false;
}

/**
 * A `lookup` for the request that resolves the host itself and answers only when EVERY address it resolves to is
 * public (one bad address refuses the host: no address is picked around it). `resolve(host)` → `[{ address, family }]`.
 */
export function vettedLookup(resolve = (host) => dns.promises.lookup(host, { all: true, verbatim: true })) {
  return (hostname, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const all = typeof options === 'object' && options?.all === true;
    Promise.resolve()
      .then(() => resolve(hostname))
      .then((addresses) => {
        const list = Array.isArray(addresses) ? addresses : [];
        if (list.length === 0) throw Object.assign(new Error(`${hostname} resolves to no address`), { code: 'EXPLORE_NO_ADDRESS' });
        const bad = list.find((a) => !isPublicAddress(a?.address));
        if (bad) throw Object.assign(new Error(`${hostname} resolves to ${bad.address}, which is not a public address`), { code: 'EXPLORE_NOT_PUBLIC' });
        if (all) cb(null, list.map((a) => ({ address: a.address, family: a.family })));
        else cb(null, list[0].address, list[0].family);
      })
      .catch((err) => cb(err));
  };
}

// ── the request ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The production transport: one GET over https with the checked lookup. Resolves `{ status, headers, body }`. */
export function httpsTransport(url, { headers, lookup, signal, maxBytes }) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers, lookup, signal, agent: false }, (res) => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status >= 300) { res.resume(); resolve({ status, headers: res.headers, body: null }); return; }
      const declared = Number(res.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) { res.destroy(); reject(Object.assign(new Error('the document is larger than the size limit'), { code: 'EXPLORE_TOO_LARGE' })); return; }
      const enc = String(res.headers['content-encoding'] ?? '').trim().toLowerCase();
      const decoder = enc === 'gzip' || enc === 'x-gzip' ? zlib.createGunzip() : enc === 'deflate' ? zlib.createInflate() : enc === 'br' ? zlib.createBrotliDecompress() : null;
      let raw = 0;
      let out = 0;
      const chunks = [];
      const tooLarge = () => { res.destroy(); decoder?.destroy(); reject(Object.assign(new Error('the document is larger than the size limit'), { code: 'EXPLORE_TOO_LARGE' })); };
      res.on('data', (c) => { raw += c.length; if (raw > maxBytes) tooLarge(); });
      res.on('error', reject);
      const sink = decoder ? res.pipe(decoder) : res;
      sink.on('data', (c) => { out += c.length; if (out > maxBytes) tooLarge(); else chunks.push(c); });
      sink.on('error', reject);
      sink.on('end', () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

/** Why a link may not be fetched as it stands, or null: not https, or carrying a credential. */
function linkRefusalOf(href) {
  let u;
  try { u = new URL(href); } catch { return 'the link is not a valid URL'; }
  if (u.protocol !== 'https:') return `the link is not https (${u.protocol.replace(':', '')})`;
  if (u.username || u.password) return 'the link carries a user name or password';
  return null;
}

/** A host written as an address is checked here: the request's lookup is never asked about it. */
function literalRefusalOf(href) {
  const host = new URL(href).hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isPublicAddress(host)) return `the link's host ${host} is not a public address`;
  return null;
}

/**
 * Fetch one document (see the header). `transport(url, { headers, lookup, signal, maxBytes })` makes one request; the
 * tests hand in their own, which answers from committed documents. Answers
 * `{ ok: true, url, finalUrl, redirects, status, contentType, bytes, fetchedAt }` or
 * `{ ok: false, url, finalUrl, redirects, status, reason }`.
 */
export async function fetchDocument(url, {
  contact,
  transport = httpsTransport,
  resolve = undefined,
  now = () => new Date(),
  timeoutMs = FETCH_TIMEOUT_MS,
  maxBytes = MAX_DOCUMENT_BYTES,
  maxRedirects = MAX_REDIRECTS,
} = {}) {
  const redirects = [];
  const fail = (reason, current, status = null) => ({ ok: false, url, finalUrl: current, redirects, status, reason });
  if (!contactOf({ [CONTACT_ENV]: contact })) return fail(`not fetched: no contact address (${CONTACT_ENV})`, url);
  const headers = {
    'user-agent': userAgentOf(contact),
    accept: 'text/html, application/xhtml+xml, application/pdf;q=0.9, */*;q=0.1',
    'accept-encoding': 'gzip, deflate, br',
  };
  const lookup = vettedLookup(resolve);
  const controller = new AbortController();
  let timer = null;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('timeout'), { code: 'EXPLORE_TIMEOUT' })); }, timeoutMs);
  });
  let current = url;
  try {
    for (let hop = 0; ; hop += 1) {
      const refusal = linkRefusalOf(current) ?? literalRefusalOf(current);
      if (refusal) return fail(hop === 0 ? refusal : `a redirect was refused: ${refusal}`, current);
      const res = await Promise.race([transport(current, { headers: { ...headers }, lookup, signal: controller.signal, maxBytes }), deadline]);
      const status = res?.status ?? 0;
      if (REDIRECT_STATUSES.has(status)) {
        const location = res.headers?.location;
        if (typeof location !== 'string' || !location) return fail(`the server answered ${status} with no place to go`, current, status);
        if (hop >= maxRedirects) return fail(`more than ${maxRedirects} redirects`, current, status);
        let next;
        try { next = new URL(location, current).href; } catch { return fail('a redirect named no valid URL', current, status); }
        redirects.push(next);
        current = next;
        continue;
      }
      if (status < 200 || status >= 300) return fail(`the server answered ${status}`, current, status);
      const body = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body ?? []);
      if (body.length > maxBytes) return fail('the document is larger than the size limit', current, status);
      const ct = res.headers?.['content-type'];
      return { ok: true, url, finalUrl: current, redirects, status, contentType: typeof ct === 'string' ? ct : null, bytes: body, fetchedAt: now().toISOString() };
    }
  } catch (err) {
    const code = err?.code;
    if (code === 'EXPLORE_TIMEOUT' || err?.name === 'AbortError') return fail(`no answer within ${timeoutMs / 1000} seconds`, current);
    if (code === 'EXPLORE_NOT_PUBLIC' || code === 'EXPLORE_NO_ADDRESS' || code === 'EXPLORE_TOO_LARGE') return fail(err.message, current);
    return fail(`the request failed (${code ?? err?.name ?? 'error'}: ${err?.message ?? String(err)})`, current);
  } finally {
    clearTimeout(timer);
  }
}
