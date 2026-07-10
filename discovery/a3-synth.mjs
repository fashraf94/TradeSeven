// Check whether the 20:00 UTC synthetic bar close matches daily.close
import fs from 'node:fs/promises';
const SAMPLE_5M = ['AAPL','TSLA','AFRM','XLK'];
const TOL = 0.001;
const load = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

for (const sym of SAMPLE_5M) {
  const intraday = await load(`fixtures/sample-5m/${sym}_5m_2026-06.json`);
  const daily = await load(`fixtures/daily/${sym}_eod_2018-01-01_2026-07-10.json`);
  const dailyByDate = Object.fromEntries(daily.map(d => [d.date, d]));
  const bySession = {};
  for (const b of intraday) {
    const date = b.datetime.slice(0,10);
    (bySession[date] ??= []).push(b);
  }
  let matches = 0, total = 0;
  const bad = [];
  for (const [date, bars] of Object.entries(bySession)) {
    const d = dailyByDate[date];
    if (!d) continue;
    const synth = bars.find(b => b.datetime.endsWith('20:00:00'));
    if (!synth) continue;
    total++;
    const rel = (synth.close - d.close) / d.close;
    if (Math.abs(rel) <= TOL) matches++;
    else bad.push({ date, daily_close: d.close, synth_close: synth.close, diff_pct: (rel*100).toFixed(4) });
  }
  console.log(`${sym.padEnd(6)} synthetic-bar match: ${matches}/${total} within 0.1%${bad.length ? ' — outliers: ' + JSON.stringify(bad) : ''}`);
}
