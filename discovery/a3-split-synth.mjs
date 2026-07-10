// Split-adjacent: check 20:00 UTC synthetic bar close vs daily raw close and adjusted close
import fs from 'node:fs/promises';
const load = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));

const intra = await load('fixtures/split-adjacent/NVDA_5m_2024-06-05_2024-06-14.json');
const daily = await load('fixtures/daily/NVDA_eod_2018-01-01_2026-07-10.json');
const dailyByDate = Object.fromEntries(daily.map(d => [d.date, d]));
const bySession = {};
for (const b of intra) {
  const date = b.datetime.slice(0,10);
  (bySession[date] ??= []).push(b);
}
console.log('date\t\tdaily_raw\tdaily_adj\t5m_20:00_close\tratio_raw\tratio_adj');
for (const [date, bars] of Object.entries(bySession)) {
  const d = dailyByDate[date];
  if (!d) continue;
  const synth = bars.find(b => b.datetime.endsWith('20:00:00'));
  if (!synth) continue;
  console.log(`${date}\t${d.close}\t\t${d.adjusted_close}\t\t${synth.close}\t\t${(synth.close/d.close).toFixed(4)}\t\t${(synth.close/d.adjusted_close).toFixed(4)}`);
}
