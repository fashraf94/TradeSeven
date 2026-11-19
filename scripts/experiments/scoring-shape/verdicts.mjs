#!/usr/bin/env node
// scripts/experiments/scoring-shape/verdicts.mjs
//
// THE SNAP-EXIT VERDICT WORDS (review C1, C2, C5, A5). One stated rule, applied in code, so the report's labels are the
// script's output (BUILD_RULES §9), never a reading of two tables by hand.
//
// Per window (V2's 39 entry sessions; the long window's 174), from step4SnapExit.mjs's session-clustered bootstrap:
//   - SELL CLEARLY LOSES  when SELL is the best policy on average in at most 5% of the 2,000 resamples;
//   - SELL CLEARLY WINS   when it is the best in at least 95%;
//   - otherwise within noise.
// Across the two windows (V2's sessions are inside the long window, so they are not independent replications):
//   - clear in both, the same way            → "SELL loses" / "SELL wins";
//   - clear in one, within noise in the other, SELL's margin over the next-best policy of the SAME sign in both
//                                            → the same word with *;
//   - anything else (both within noise, or the two windows point opposite ways) → "even".
// † marks a cell whose best-on-average policy changes, in either window, when a gap through the line is sold at the open.
// Margins quoted are SELL minus the next-best policy (the prompt's "by how much"), per position.
//
// USAGE: node scripts/experiments/scoring-shape/verdicts.mjs [--out <dir>]

import path from 'node:path';
import { fx, mdTable, outDirOf, readJson, writeJson } from './lib.mjs';

const CLEAR_LOSS = 0.05;
const CLEAR_WIN = 0.95;

/** One window's reading of one row. */
function windowReading(r) {
  const s = r.boot.sellBestShare;
  return { share: s, margin: r.sellMargin, next: r.boot.sellMinusNext, clear: s <= CLEAR_LOSS ? 'loses' : s >= CLEAR_WIN ? 'wins' : null };
}

/** The two-window verdict. */
function combine(a, b) {
  const sign = (m) => Math.sign(m);
  if (a.clear && b.clear) return a.clear === b.clear ? `SELL ${a.clear}` : 'even';
  const clear = a.clear ? a : b.clear ? b : null;
  const other = a.clear ? b : a;
  if (!clear) return 'even';
  return sign(other.margin) === sign(clear.margin) ? `SELL ${clear.clear}*` : 'even';
}

function main() {
  const out = outDirOf(process.argv);
  const v2 = readJson(path.join(out, 'step4-snap-exit.json'));
  const lg = readJson(path.join(out, 'step4-snap-exit-long.json'));
  const rows = [];
  for (const r of v2.results) {
    const l = lg.results.find((x) => x.label === r.label && x.tier === r.tier);
    if (!l) continue;
    const a = windowReading(r), b = windowReading(l);
    const gapFlip = r.variants.gapFillAtOpen !== r.winner || l.variants.gapFillAtOpen !== l.winner;
    // The same rule on the check-priced sensitivity (review B1): sold at a 15-minute check past the line, weighted by
    // the chance a check sees it, gap-throughs at the open. Not defined for S5.
    const checkVerdict = r.checked && l.checked
      ? combine(windowReading({ boot: r.checked.checkPriced.boot, sellMargin: r.checked.checkPriced.sellMargin }), windowReading({ boot: l.checked.checkPriced.boot, sellMargin: l.checked.checkPriced.sellMargin }))
      : null;
    rows.push({ label: r.label, tier: r.tier, verdict: combine(a, b) + (gapFlip ? '†' : ''), checkVerdict, v2: a, long: b, winners: [r.winner, l.winner],
      checkV2: r.checked ? windowReading({ boot: r.checked.checkPriced.boot, sellMargin: r.checked.checkPriced.sellMargin }) : null,
      checkLong: l.checked ? windowReading({ boot: l.checked.checkPriced.boot, sellMargin: l.checked.checkPriced.sellMargin }) : null });
  }
  writeJson(path.join(out, 'verdicts.json'), { rule: { clearLoss: CLEAR_LOSS, clearWin: CLEAR_WIN }, rows });
  const P = (x) => `${(100 * x).toFixed(1)}%`;
  for (const tier of ['support', 'star']) {
    console.log(`\n## Snap-exit verdicts, ${tier}\n`);
    console.log(mdTable(['Shape-unit', "V2: SELL − next best [90%] · SELL best", 'Long: SELL − next best [90%] · SELL best', 'Best on average (V2 / long)', 'Verdict', 'Check-priced: V2 · long · verdict'],
      rows.filter((x) => x.tier === tier).map((x) => [x.label, `${fx(x.v2.margin, 1)} [${fx(x.v2.next[0], 1)}, ${fx(x.v2.next[1], 1)}] · ${P(x.v2.share)}`,
        `${fx(x.long.margin, 1)} [${fx(x.long.next[0], 1)}, ${fx(x.long.next[1], 1)}] · ${P(x.long.share)}`, x.winners.join(' / '), x.verdict,
        x.checkVerdict ? `${fx(x.checkV2.margin, 1)} · ${P(x.checkV2.share)} | ${fx(x.checkLong.margin, 1)} · ${P(x.checkLong.share)} → ${x.checkVerdict}` : '—'])));
  }
}

main();
