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
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, r.body);
    manifest.push({ tag, urlRedacted: redact(url), fromCache: false, status: r.status, bytes: r.bytes, elapsedMs: r.elapsedMs, savedTo: cacheRel });
    if (!r.ok) log(`  ⚠ ${tag}: HTTP ${r.status}`);
    return { body: r.body, fromCache: false, status: r.status };
  }

  // ── Daily (whole response; S1 §9) ──────────────────────────────────────────
  async function fetchDaily(symbol, from, to) {
    const url = `${base}/api/eod/${symbol}${suffix}?api_token=${KEY}&from=${from}&to=${to}&fmt=json`;
    const { body } = await cachedFetch(`raw/${symbol}/daily/${from}_${to}.json`, url, `daily_${symbol}`);
    return JSON.parse(body);
  }

  // ── Intraday chunk (from/to = UNIX epoch; half-open [fromDate,toDate)) ──────
  async function fetchIntradayChunk(symbol, fromDate, toDate) {
    const fromE = dateToUtcEpoch(fromDate);
    const toE = dateToUtcEpoch(toDate);
    const url = `${base}/api/intraday/${symbol}${suffix}?api_token=${KEY}&interval=${CONFIG.fetch.intradayInterval}&from=${fromE}&to=${toE}&fmt=json`;
    const { body } = await cachedFetch(`raw/${symbol}/5m/${fromDate}_${toDate}.json`, url, `5m_${symbol}_${fromDate}`);
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
    // cache hit). The key captures every request parameter that changes the response.
    const symKey = symbols.join('-');
    const { body } = await cachedFetch(`raw/_earnings/${symKey}_${from}_${to}.json`, url, `earnings_${symKey}`);
    try { return JSON.parse(body); } catch { return null; }
  }

  /** Fetch a raw intraday chunk and ALSO write it to an explicit fixture path (committed). */
  async function fetchIntradayToFixture(symbol, fromDate, toDate, fixtureAbsPath) {
    const fromE = dateToUtcEpoch(fromDate);
    const toE = dateToUtcEpoch(toDate);
    const url = `${base}/api/intraday/${symbol}${suffix}?api_token=${KEY}&interval=${CONFIG.fetch.intradayInterval}&from=${fromE}&to=${toE}&fmt=json`;
    if (fs.existsSync(fixtureAbsPath)) {
      manifest.push({ tag: `fixture_${symbol}_${fromDate}`, urlRedacted: redact(url), fromCache: true, status: 200, bytes: Buffer.byteLength(await fsp.readFile(fixtureAbsPath, 'utf8')), savedTo: fixtureAbsPath });
      return JSON.parse(await fsp.readFile(fixtureAbsPath, 'utf8'));
    }
    const r = await fetchWithRetry(url);
    await fsp.mkdir(path.dirname(fixtureAbsPath), { recursive: true });
    await fsp.writeFile(fixtureAbsPath, r.body);
    manifest.push({ tag: `fixture_${symbol}_${fromDate}`, urlRedacted: redact(url), fromCache: false, status: r.status, bytes: r.bytes, elapsedMs: r.elapsedMs, savedTo: fixtureAbsPath });
    return JSON.parse(r.body);
  }

  return {
    fetchDaily, fetchIntradayChunk, fetchIntradayRange, planIntradayChunks,
    fetchEarnings, fetchIntradayToFixture,
    getManifest: () => manifest.slice(),
    paths: { STUDY_ROOT, REPO_ROOT, DATA_DIR },
  };
}
