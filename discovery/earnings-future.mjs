// Probe future earnings to see if scheduled-vs-reported is distinguishable
import fs from 'node:fs/promises';
const env = Object.fromEntries((await fs.readFile('.env','utf8')).split(/\r?\n/).filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
const KEY = env.VITE_EODHD_API_KEY || env.EODHD_API_KEY;
const url = `https://eodhd.com/api/calendar/earnings?api_token=${KEY}&symbols=AAPL.US,NVDA.US,TSLA.US&from=2026-07-11&to=2026-10-31&fmt=json`;
const res = await fetch(url);
const body = await res.text();
await fs.writeFile('fixtures/earnings/AAPL_NVDA_TSLA_future_2026Q3.json', body);
const parsed = JSON.parse(body);
console.log('Records:', parsed.earnings?.length ?? 0);
for (const e of parsed.earnings || []) console.log(JSON.stringify(e));
