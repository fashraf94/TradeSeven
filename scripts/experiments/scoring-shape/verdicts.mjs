#!/usr/bin/env node
// scripts/experiments/scoring-shape/verdicts.mjs
//
// THE SNAP-EXIT VERDICT WORDS (review C1, C2, C5, A5). One stated rule, applied in code, so the report's labels are the
// script's output (BUILD_RULES §9), never a reading of two tables by hand.
//
// Per window (V2's 39 entry sessions; the long window's 174), from step4SnapExit.mjs's session-clustered block bootstrap:
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
// DISCLOSED (post hoc): this rule and the 5% / 95% lines were fixed AFTER the first results were seen (in review). The
// script therefore re-applies the rule at 3% / 97% and at 10% / 90% and lists every cell whose verdict changes.
//
// USAGE: node scripts/experiments/scoring-shape/verdicts.mjs [--out <dir>]

import path from 'node:path';
import { fx, mdTable, outDirOf, readJson, writeJson } from './lib.mjs';

const RULE = { loss: 0.05, win: 0.95 };
const ALTERNATES = [{ loss: 0.03, win: 0.97 }, { loss: 0.10, win: 0.90 }];

/** One window's reading of one row (a primary row, or a variant's { boot, sellMargin }). */
function windowReading(r, rule = RULE) {
  const s = r.boot.sellBestShare;
  return { share: s, margin: r.sellMargin, next: r.boot.sellMinusNext, clear: s <= rule.loss ? 'loses' : s >= rule.win ? 'wins' : null };
}

/** The two-window verdict. */
function combine(a, b) {
  if (a.clear && b.clear) return a.clear === b.clear ? `SELL ${a.clear}` : 'even';
  const clear = a.clear ? a : b.clear ? b : null;
  const other = a.clear ? b : a;
  if (!clear) return 'even';
  return Math.sign(other.margin) === Math.sign(clear.margin) ? `SELL ${clear.clear}*` : 'even';
}

const verdictOf = (r, l, rule = RULE) => combine(windowReading(r, rule), windowReading(l, rule));

function main() {
  const out = outDirOf(process.argv);
  const v2 = readJson(path.join(out, 'step4-snap-exit.json'));
  const lg = readJson(path.join(out, 'step4-snap-exit-long.json'));
  const rows = [];
  for (const r of v2.results) {
    const l = lg.results.find((x) => x.label === r.label && x.tier === r.tier);
    if (!l) continue;
    const gapFlip = r.variants.gapFillAtOpen !== r.winner || l.variants.gapFillAtOpen !== l.winner;
    const views = {
      primary: [r, l],
      // Gap-throughs sold at the open, everything else at the line (no visibility weighting).
      gapAtOpen: r.gapAtOpen && l.gapAtOpen ? [r.gapAtOpen, l.gapAtOpen] : null,
      // Check-priced (review B1): visibility-weighted, sold past the line, gap-throughs at the open. Not defined for S5.
      checkPriced: r.checked && l.checked ? [r.checked.checkPriced, l.checked.checkPriced] : null,
    };
    const row = { label: r.label, tier: r.tier, winners: [r.winner, l.winner], gapFlip };
    for (const [k, pair] of Object.entries(views)) {
      if (!pair) { row[k] = null; continue; }
      row[k] = { verdict: verdictOf(pair[0], pair[1]), v2: windowReading(pair[0]), long: windowReading(pair[1]),
        alternates: ALTERNATES.map((rule) => ({ rule, verdict: verdictOf(pair[0], pair[1], rule) })) };
    }
    rows.push(row);
  }
  const flips = rows.flatMap((x) => Object.entries(x).filter(([k, v]) => ['primary', 'gapAtOpen', 'checkPriced'].includes(k) && v)
    .flatMap(([k, v]) => v.alternates.filter((a) => a.verdict !== v.verdict).map((a) => ({ label: x.label, tier: x.tier, view: k, at: `${a.rule.loss * 100}%/${a.rule.win * 100}%`, from: v.verdict, to: a.verdict }))));
  writeJson(path.join(out, 'verdicts.json'), { rule: RULE, alternates: ALTERNATES, rows, thresholdFlips: flips });

  const P = (x) => `${(100 * x).toFixed(1)}%`;
  const cell = (v) => (v ? `${fx(v.v2.margin, 1)} · ${P(v.v2.share)} / ${fx(v.long.margin, 1)} · ${P(v.long.share)} → ${v.verdict}` : '—');
  for (const tier of ['support', 'star']) {
    console.log(`\n## Snap-exit verdicts, ${tier}\n`);
    console.log(mdTable(['Shape-unit', 'V2: SELL − next best [90%] · SELL best', 'Long: SELL − next best [90%] · SELL best', 'Best on average (V2 / long)', 'Verdict',
      'Gap-throughs at the open: V2 / long → verdict', 'Check-priced: V2 / long → verdict'],
      rows.filter((x) => x.tier === tier).map((x) => [x.label, `${fx(x.primary.v2.margin, 1)} [${fx(x.primary.v2.next[0], 1)}, ${fx(x.primary.v2.next[1], 1)}] · ${P(x.primary.v2.share)}`,
        `${fx(x.primary.long.margin, 1)} [${fx(x.primary.long.next[0], 1)}, ${fx(x.primary.long.next[1], 1)}] · ${P(x.primary.long.share)}`, x.winners.join(' / '),
        x.primary.verdict + (x.gapFlip ? '†' : ''), cell(x.gapAtOpen), cell(x.checkPriced)])));
  }
  console.log(`\n## The rule at 3%/97% and 10%/90% (post-hoc check): ${flips.length} cell-views change\n`);
  if (flips.length) console.log(mdTable(['Shape-unit', 'Tier', 'View', 'Rule', 'At 5%/95%', 'There'], flips.map((f) => [f.label, f.tier, f.view, f.at, f.from, f.to])));
}

main();
