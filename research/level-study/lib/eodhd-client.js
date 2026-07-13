// research/level-study/lib/eodhd-client.js
//
// EODHD client for the LevelStory study. Node native fetch (Undici) — no schannel,
// no product imports, zero dependencies. Responsibilities:
//   - load the key from the repo-root .env (VITE_EODHD_API_KEY); NEVER print/log/commit it
//   - disk cache under data/raw/{symbol}/{grain}/ — never refetch what's cached (S2 §4)
//   - gentle pacing + retry-with-backoff on transient failures
//   - intraday chunking ≤ 600 calendar days, with the API 422 span-error as a guard (S1 §9)
//   - a per-run manifest (calls, ranges, byte counts) with every URL redacted
//
// Call pattern matches S1 discovery/capture.mjs exactly (intraday from/to = UNIX epoch;
// daily from/to = ISO date; earnings accepts a symbols= list).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';
import { dateToUtcEpoch, addDays, diffDays } from './session-time.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));       // .../research/level-study/lib
const STUDY_ROOT = path.resolve(HERE, '..');                    // .../research/level-study
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');         // repo root
const DATA_DIR = path.join(STUDY_ROOT, 'data');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Atomic cache write: temp file + rename, so a crash mid-write can never leave a
// truncated/partial file that a later `existsSync` check would then trust as valid.
async function atomicWrite(full, body) {
  const tmp = `${full}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, body);
  await fsp.rename(tmp, full);
}

// djb2 hash → short, filesystem-safe, injective-enough cache-key component. Used for the
// earnings symbol set: a join('-') key collides on tickers containing '-' (BRK-B) and a
// join of 150–200 names would blow past the filename length limit; a hash avoids both.
function hashKey(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function loadKey() {
  if (process.env.VITE_EODHD_API_KEY) return process.env.VITE_EODHD_API_KEY.trim();
  const envPath = path.join(REPO_ROOT, '.env');
  const txt = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  const key = env.VITE_EODHD_API_KEY || env.EODHD_API_KEY;
  if (!key) throw new Error('VITE_EODHD_API_KEY not found in process.env or repo-root .env');
  return key;
}

/**
 * @param {object} [opts]
 * @param {number} [opts.pacingMs]  inter-network-call delay
 * @param {object} [opts.retry]     { maxAttempts, baseBackoffMs, backoffFactor, retryOnStatus }
 * @param {(msg:string)=>void} [opts.log]  progress logger (default console.log)
 */
export function createClient(opts = {}) {
  const KEY = loadKey();
  const pacingMs = opts.pacingMs ?? CONFIG.fetch.pacingMs;
  const retry = opts.retry ?? CONFIG.fetch.retry;
  const log = opts.log ?? ((m) => console.log(m));
  const base = CONFIG.fetch.baseUrl;
  const suffix = CONFIG.fetch.exchangeSuffix;
  const redact = (url) => url.split(KEY).join('REDACTED'); // key NEVER leaves this module un-redacted
  const manifest = [];

  async function fetchWithRetry(url) {
    let attempt = 0, lastErr = null;
    while (attempt < retry.maxAttempts) {
      attempt += 1;
      try {
        await sleep(pacingMs); // gentle pacing before each network call
        const t0 = Date.now();
        const res = await fetch(url);
        const body = await res.text();
        const elapsedMs = Date.now() - t0;
        if (!res.ok && retry.retryOnStatus.includes(res.status) && attempt < retry.maxAttempts) {
          log(`  transient ${res.status} (attempt ${attempt}) — backing off`);
          await sleep(retry.baseBackoffMs * retry.backoffFactor ** (attempt - 1));
          continue;
        }
        return { status: res.status, ok: res.ok, body, elapsedMs, bytes: Buffer.byteLength(body) };
      } catch (e) {
        lastErr = e;
        if (attempt < retry.maxAttempts) {
          log(`  network error (attempt ${attempt}): ${e.code || e.name} — backing off`);
          await sleep(retry.baseBackoffMs * retry.backoffFactor ** (attempt - 1));
          continue;
        }
      }
    }
    throw lastErr || new Error('fetch failed after retries');
  }

  /** Disk-cached fetch. Never refetches a present cache file (cache key = the path). */
  async function cachedFetch(cacheRel, url, tag) {
    const full = path.join(DATA_DIR, cacheRel);
    if (fs.existsSync(full)) {
      const body = await fsp.readFile(full, 'utf8');
      manifest.push({ tag, urlRedacted: redact(url), fromCache: true, status: 200, bytes: Buffer.byteLength(body), savedTo: cacheRel });
      return { body, fromCache: true };
    }
    const r = await fetchWithRetry(url);
    if (!r.ok) {
      // NEVER cache an error body. cachedFetch's hit-branch reports `status: 200`, so a cached
      // error would be served as a success FOREVER (existsSync short-circuits the network; it
      // never self-heals) — silently corrupting the dataset. Fail loudly; the orchestrator
      // records the symbol as failed and continues. (Review F1.)
      manifest.push({ tag, urlRedacted: redact(url), fromCache: false, status: r.status, bytes: r.bytes, elapsedMs: r.elapsedMs, savedTo: null, error: true });
      throw new Error(`FETCH_FAILED ${tag}: HTTP ${r.status} (not cached)`);
    }
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await atomicWrite(full, r.body); // temp+rename — a crash mid-write can't leave a trusted partial file
    manifest.push({ tag, urlRedacted: redact(url), fromCache: false, status: r.status, bytes: r.bytes, elapsedMs: r.elapsedMs, savedTo: cacheRel });
    return { body: r.body, fromCache: false, status: r.status };
  }

  // ── Daily (whole response; S1 §9) ──────────────────────────────────────────
  async function fetchDaily(symbol, from, to) {
    const url = `${base}/api/eod/${symbol}${suffix}?api_token=${KEY}&from=${from}&to=${to}&fmt=json`;
    const { body } = await cachedFetch(`raw/${symbol}/daily/${from}_${to}.json`, url, `daily_${symbol}`);
    // Guard parse + shape like the sibling fetchers (fetchIntradayChunk/fetchEarnings). A bad
    // daily body (non-JSON, or a JSON error object) must not flow into normalizeDaily's
    // rawDaily.map and crash the run with an opaque TypeError. (Review F2.)
    let parsed;
    try { parsed = JSON.parse(body); } catch { throw new Error(`DAILY_PARSE_FAILED ${symbol}: non-JSON body`); }
    if (parsed && !Array.isArray(parsed)) {
      throw new Error(`DAILY_ERROR ${symbol}: ${parsed.errors ? JSON.stringify(parsed.errors) : JSON.stringify(parsed).slice(0, 200)}`);
    }
    return Array.isArray(parsed) ? parsed : [];
  }

  // ── Intraday chunk (from/to = UNIX epoch; half-open [fromDate,toDate)) ──────
  async function fetchIntradayChunk(symbol, fromDate, toDate) {
    const fromE = dateToUtcEpoch(fromDate);
    const toE = dateToUtcEpoch(toDate);
    const iv = CONFIG.fetch.intradayInterval;
    const url = `${base}/api/intraday/${symbol}${suffix}?api_token=${KEY}&interval=${iv}&from=${fromE}&to=${toE}&fmt=json`;
    // Cache path uses the SAME interval as the URL — else changing the interval would silently
    // read/write the wrong-grain cache under a hardcoded '5m/' segment. (Review F5.)
    const { body } = await cachedFetch(`raw/${symbol}/${iv}/${fromDate}_${toDate}.json`, url, `${iv}_${symbol}_${fromDate}`);
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    // API 422 span guard (S1 §9): explicit "Max period length is 600 days" error
    if (parsed && !Array.isArray(parsed) && parsed.errors) {
      const msg = JSON.stringify(parsed.errors);
      if (/Max period length/i.test(msg)) throw new Error(`INTRADAY_SPAN_EXCEEDED ${symbol} ${fromDate}..${toDate}: ${msg}`);
      throw new Error(`INTRADAY_ERROR ${symbol} ${fromDate}..${toDate}: ${msg}`);
    }
    return Array.isArray(parsed) ? parsed : [];
  }

  /** Plan half-open chunks [start,endExclusive) each ≤ chunkDays calendar days. */
  function planIntradayChunks(startDate, endExclusive, chunkDays) {
    const chunks = [];
    let cur = startDate;
    while (cur < endExclusive) {
      let next = addDays(cur, chunkDays);
      if (next > endExclusive) next = endExclusive;
      chunks.push([cur, next]);
      cur = next;
    }
    return chunks;
  }

  /** Fetch a full intraday date range, chunked; halves-and-retries a chunk if the 422 guard fires. */
  async function fetchIntradayRange(symbol, startDate, endExclusive, chunkDays) {
    const maxSpan = CONFIG.fetch.intradayMaxSpanDays; // 600
    const safeChunk = Math.min(chunkDays, maxSpan - 20); // conservative default under the API limit
    const chunks = planIntradayChunks(startDate, endExclusive, safeChunk);
    const all = [];
    for (const [from, to] of chunks) {
      if (diffDays(from, to) > maxSpan) { // defensive: should never happen with safeChunk
        const mid = addDays(from, Math.floor(diffDays(from, to) / 2));
        all.push(...await fetchIntradayChunk(symbol, from, mid));
        all.push(...await fetchIntradayChunk(symbol, mid, to));
        continue;
      }
      try {
        all.push(...await fetchIntradayChunk(symbol, from, to));
      } catch (e) {
        if (/INTRADAY_SPAN_EXCEEDED/.test(e.message)) { // guard fired — split once and retry
          const mid = addDays(from, Math.floor(diffDays(from, to) / 2));
          log(`  span guard fired for ${symbol} ${from}..${to}; splitting at ${mid}`);
          all.push(...await fetchIntradayChunk(symbol, from, mid));
          all.push(...await fetchIntradayChunk(symbol, mid, to));
        } else throw e;
      }
    }
    return all;
  }

  // ── Earnings (bulk symbol list; S1 §8) ─────────────────────────────────────
  async function fetchEarnings(symbols, from, to) {
    const codes = symbols.map((s) => `${s}${suffix}`).join(',');
    const url = `${base}/api/calendar/earnings?api_token=${KEY}&symbols=${codes}&from=${from}&to=${to}&fmt=json`;
    // Cache key MUST include the symbol set — otherwise a later call with a different symbol
    // list is silently served the earlier response (S2 bug: 9-equity call returned an AAPL-only
    // cache hit). Use a hash, not join('-'): '-' collides on tickers like BRK-B, and a raw join
    // of 150–200 names would exceed the filename length limit. (Review F6.)
    const symKey = `${symbols.length}sym-${hashKey(codes)}`;
    const { body } = await cachedFetch(`raw/_earnings/${symKey}_${from}_${to}.json`, url, `earnings_${symKey}`);
    try { return JSON.parse(body); } catch { return null; }
  }

  // ── Fundamentals (S5.6 §4.2: the sector map is DERIVED FROM DATA, not inherited) ──
  //
  // The product's sector map has at least one known error (BE → XLK; Bloom Energy is Industrials),
  // and peer features depend on ECONOMIC similarity — a wrong sector silently corrupts every peer
  // rate and RS feature for that name. So the study pulls sector per symbol from the vendor and
  // cross-checks the product map against it.
  //
  // `filter` keeps the response tiny (a full fundamentals doc is ~MB; we need 4 fields).
  async function fetchFundamentals(symbol, fields = 'General::Sector,General::Industry,General::IPODate,General::Type') {
    const url = `${base}/api/fundamentals/${symbol}${suffix}?api_token=${KEY}&filter=${encodeURIComponent(fields)}&fmt=json`;
    const { body } = await cachedFetch(`raw/_fundamentals/${symbol}_${hashKey(fields)}.json`, url, `fundamentals_${symbol}`);
    try { return JSON.parse(body); } catch { throw new Error(`FUNDAMENTALS_PARSE_FAILED ${symbol}: non-JSON body`); }
  }

  /** Fetch a raw intraday chunk and ALSO write it to an explicit fixture path (committed). */
  async function fetchIntradayToFixture(symbol, fromDate, toDate, fixtureAbsPath) {
    const fromE = dateToUtcEpoch(fromDate);
    const toE = dateToUtcEpoch(toDate);
    const url = `${base}/api/intraday/${symbol}${suffix}?api_token=${KEY}&interval=${CONFIG.fetch.intradayInterval}&from=${fromE}&to=${toE}&fmt=json`;
    if (fs.existsSync(fixtureAbsPath)) {
      const body = await fsp.readFile(fixtureAbsPath, 'utf8'); // read once (Review F7)
      manifest.push({ tag: `fixture_${symbol}_${fromDate}`, urlRedacted: redact(url), fromCache: true, status: 200, bytes: Buffer.byteLength(body), savedTo: fixtureAbsPath });
      return JSON.parse(body);
    }
    const r = await fetchWithRetry(url);
    if (!r.ok) throw new Error(`FIXTURE_FETCH_FAILED ${symbol} ${fromDate}: HTTP ${r.status} (not written)`); // don't write an error body (Review F1)
    await fsp.mkdir(path.dirname(fixtureAbsPath), { recursive: true });
    await atomicWrite(fixtureAbsPath, r.body);
    manifest.push({ tag: `fixture_${symbol}_${fromDate}`, urlRedacted: redact(url), fromCache: false, status: r.status, bytes: r.bytes, elapsedMs: r.elapsedMs, savedTo: fixtureAbsPath });
    return JSON.parse(r.body);
  }

  return {
    fetchDaily, fetchIntradayChunk, fetchIntradayRange, planIntradayChunks,
    fetchEarnings, fetchIntradayToFixture, fetchFundamentals,
    getManifest: () => manifest.slice(),
    paths: { STUDY_ROOT, REPO_ROOT, DATA_DIR },
  };
}
