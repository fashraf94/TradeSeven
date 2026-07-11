// THROWAWAY inspection script — LevelStory Session 1 §13 recon.
// Runs 3 EODHD calls to measure A7 empirical inputs (S, D, calendar shape).
// Reads VITE_EODHD_API_KEY (fallback EODHD_API_KEY) from .env. Never prints it.
// Saves raw responses to fixtures/_recon/ and a log to discovery/recon-log.json.

import fs from 'node:fs/promises';

const env = Object.fromEntries(
  (await fs.readFile('.env', 'utf8')).split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);
const KEY = env.VITE_EODHD_API_KEY || env.EODHD_API_KEY;
if (!KEY) { console.error('NO KEY'); process.exit(1); }

const REDACT = url => url.replace(KEY, 'REDACTED');
const OUT = 'fixtures/_recon';
await fs.mkdir(OUT, { recursive: true });

async function fetchWithMeta(tag, url, savePath) {
  const t0 = Date.now();
  const res = await fetch(url);
  const body = await res.text();
  const elapsedMs = Date.now() - t0;
  const headers = Object.fromEntries(res.headers);
  await fs.writeFile(savePath, body);
  let parsed = null, count = null;
  try {
    parsed = JSON.parse(body);
    count = Array.isArray(parsed) ? parsed.length
      : parsed?.earnings ? parsed.earnings.length
      : null;
  } catch {}
  return {
    tag,
    urlRedacted: REDACT(url),
    status: res.status,
    ok: res.ok,
    headers,
    elapsedMs,
    bodyBytes: Buffer.byteLength(body),
    count,
    savedTo: savePath,
    firstRecord: Array.isArray(parsed) && parsed[0] ? parsed[0] : (parsed?.earnings?.[0] ?? null),
    lastRecord: Array.isArray(parsed) && parsed[parsed.length-1] ? parsed[parsed.length-1] : (parsed?.earnings?.[parsed.earnings.length-1] ?? null)
  };
}

// R1: intraday 5m AAPL over 6.5-year window — measure max span (S)
const R1_FROM = Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000);
const R1_TO   = Math.floor(new Date('2026-07-10T23:59:59Z').getTime() / 1000);
const r1Url = `https://eodhd.com/api/intraday/AAPL.US?api_token=${KEY}&interval=5m&from=${R1_FROM}&to=${R1_TO}&fmt=json`;

// R2: EOD AAPL over ~5.4-year window — confirm daily returns whole
const r2Url = `https://eodhd.com/api/eod/AAPL.US?api_token=${KEY}&from=2021-02-01&to=2026-07-10&fmt=json`;

// R3: earnings calendar for AAPL,NVDA,TSLA trailing 24 months
const r3Url = `https://eodhd.com/api/calendar/earnings?api_token=${KEY}&symbols=AAPL.US,NVDA.US,TSLA.US&from=2024-07-10&to=2026-07-10&fmt=json`;

const results = await Promise.all([
  fetchWithMeta('R1_intraday_5m_AAPL_6.5yr', r1Url, `${OUT}/R1_intraday_5m_AAPL_2020-01-01_2026-07-10.json`),
  fetchWithMeta('R2_eod_AAPL_5.4yr',        r2Url, `${OUT}/R2_eod_AAPL_2021-02-01_2026-07-10.json`),
  fetchWithMeta('R3_earnings_3sym_24mo',    r3Url, `${OUT}/R3_earnings_AAPL_NVDA_TSLA_24mo.json`),
]);

// Redact any accidental key in headers just in case, and log
await fs.writeFile('discovery/recon-log.json', JSON.stringify(results, null, 2));
for (const r of results) {
  const { body, ...rest } = r; // never log body
  console.log(JSON.stringify(rest, null, 2));
}
