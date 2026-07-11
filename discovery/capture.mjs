// THROWAWAY inspection script — LevelStory Session 1 fixture capture.
// Fetches raw EODHD responses for A1-A6 grading. Never prints or persists the key.

import fs from 'node:fs/promises';

const env = Object.fromEntries(
  (await fs.readFile('.env', 'utf8')).split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);
const KEY = env.VITE_EODHD_API_KEY || env.EODHD_API_KEY;
if (!KEY) { console.error('NO KEY'); process.exit(1); }

const REDACT = url => url.replace(KEY, 'REDACTED');
const toEpoch = iso => Math.floor(new Date(iso + 'T00:00:00Z').getTime() / 1000);

const PROBE = [
  'AAPL','NVDA','MSFT',
  'KO','PG','JNJ',
  'TSLA','AMD','COIN',
  'AFRM','HOOD','RKLB',
  'SPY','XLK','XLE','SPHB','SPLV',
];
const SAMPLE_5M = ['AAPL','TSLA','AFRM','XLK'];

for (const d of ['fixtures/depth-probe','fixtures/daily','fixtures/sample-5m','fixtures/split-adjacent','fixtures/earnings']) {
  await fs.mkdir(d, { recursive: true });
}

const jobs = [];
for (const sym of PROBE) {
  jobs.push({
    tag: `depth_${sym}`,
    url: `https://eodhd.com/api/intraday/${sym}.US?api_token=${KEY}&interval=5m&from=${toEpoch('2023-06-01')}&to=${toEpoch('2023-07-01')}&fmt=json`,
    save: `fixtures/depth-probe/${sym}_5m_2023-06.json`,
  });
  jobs.push({
    tag: `eod_${sym}`,
    url: `https://eodhd.com/api/eod/${sym}.US?api_token=${KEY}&from=2018-01-01&to=2026-07-10&fmt=json`,
    save: `fixtures/daily/${sym}_eod_2018-01-01_2026-07-10.json`,
  });
}
for (const sym of SAMPLE_5M) {
  jobs.push({
    tag: `sample_${sym}`,
    url: `https://eodhd.com/api/intraday/${sym}.US?api_token=${KEY}&interval=5m&from=${toEpoch('2026-06-01')}&to=${toEpoch('2026-07-01')}&fmt=json`,
    save: `fixtures/sample-5m/${sym}_5m_2026-06.json`,
  });
}
jobs.push({
  tag: 'split_NVDA_2024-06',
  url: `https://eodhd.com/api/intraday/NVDA.US?api_token=${KEY}&interval=5m&from=${toEpoch('2024-06-05')}&to=${toEpoch('2024-06-15')}&fmt=json`,
  save: `fixtures/split-adjacent/NVDA_5m_2024-06-05_2024-06-14.json`,
});

async function fetchOne(job) {
  const t0 = Date.now();
  const res = await fetch(job.url);
  const body = await res.text();
  const elapsedMs = Date.now() - t0;
  await fs.writeFile(job.save, body);
  let count = null, firstDate = null, lastDate = null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      count = parsed.length;
      firstDate = parsed[0]?.datetime || parsed[0]?.date || null;
      lastDate = parsed[count-1]?.datetime || parsed[count-1]?.date || null;
    }
  } catch {}
  return {
    tag: job.tag,
    urlRedacted: REDACT(job.url),
    status: res.status,
    elapsedMs,
    bodyBytes: Buffer.byteLength(body),
    count,
    firstDate,
    lastDate,
    savedTo: job.save,
  };
}

const results = await Promise.all(jobs.map(fetchOne));
await fs.writeFile('discovery/capture-log.json', JSON.stringify(results, null, 2));

console.log(`Captured ${results.length} responses. Non-200 count: ${results.filter(r=>r.status!==200).length}`);
console.log('---');
for (const r of results) {
  console.log(`${r.tag.padEnd(24)} ${String(r.status).padEnd(4)} ${String(r.count ?? '-').padStart(6)}rec ${(r.bodyBytes/1024).toFixed(1).padStart(8)}KB  ${r.firstDate || '-'} → ${r.lastDate || '-'}`);
}
