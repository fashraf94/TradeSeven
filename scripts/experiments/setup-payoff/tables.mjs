#!/usr/bin/env node
// scripts/experiments/setup-payoff/tables.mjs
//
// Setup payoff check — THE REPORT'S TABLES, rendered from summary.json as Markdown (tables.md in the run folder), so
// every number in the report is copied from the analysis, never retyped. Formatting only: nothing is computed here
// beyond rounding for display.
//
// USAGE: node scripts/experiments/setup-payoff/tables.mjs [--run <dir>]

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { die, readJson, runDirOf, writeVerbGrep } from './lib.mjs';

const P = ['dev', 'conf', 'whole'];
const PN = { dev: 'Development', conf: 'Confirmation', whole: 'Whole window' };
const f = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d));
const sg = (v, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}`);
const pc = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const SHORT = { 'better than the comparison': 'better', worse: 'worse', 'no clear difference': 'no clear difference', 'no data': 'no data' };

/** "label (+0.123 [−0.01, +0.25])" for a units test; percent tests use 2 decimals. */
function cell(t, kind) {
  if (!t || t.est === null) return 'no data';
  const d = kind === 'u' ? 3 : 2;
  return `${SHORT[t.label]}${t.small ? ' · small' : ''}: ${sg(t.est, d)} [${sg(t.lo, d)}, ${sg(t.hi, d)}]`;
}

function table(head, rows) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function partA(A, name) {
  const out = [`### Part A — ${name} window (${A.sessions} sessions, ${A.first} → ${A.last}; development ${A.dev}, confirmation ${A.conf})`];
  for (const p of P) {
    const m = A.measures[p];
    const rows = [
      ['Valid · pullback, first day (the event)', 'validFirst'], ['Valid · pullback, every day (secondary)', 'validEvery'], ['Event, no entry filter', 'validFirst_unfiltered'],
      ['G1 every stock', 'G1'], ['G2 uptrend, no setup', 'G2'], ['G3 extended', 'G3'],
      ['G1, no entry filter', 'G1_unfiltered'], ['G2, no entry filter', 'G2_unfiltered'], ['G3, no entry filter', 'G3_unfiltered'],
    ].map(([label, k]) => {
      const x = m[k]; const h1 = x.h[1]; const h3 = x.h[3];
      return [label, x.events, x.removedByEntry, x.noNextOpen, h1.n, h3.n, `${h3.censored} / ${h3.split}`, sg(h1.meanPct), sg(h1.meanUnits, 3), sg(h3.meanPct), sg(h3.meanUnits, 3), sg(h3.medianUnits, 3), `${pc(h1.atOrAbovePlus1)} / ${pc(h1.atOrBelowMinus1)}`, `${pc(h3.atOrAbovePlus1)} / ${pc(h3.atOrBelowMinus1)}`, `${pc(h1.upFirst)} / ${pc(h1.downFirst)} / ${pc(h1.neither)} (${h1.bothSameSession})`, `${pc(h3.upFirst)} / ${pc(h3.downFirst)} / ${pc(h3.neither)} (${h3.bothSameSession})`, h3.div];
    });
    out.push(`\n**${PN[p]} — measurements.** Groups are measured on the sessions that have at least one event.\n`);
    out.push(table(['Arm', 'Stock-days', 'Removed by entry', 'No next open', 'n 1-day', 'n 3-day', '3-day censored / split', '1-day %', '1-day units', '3-day %', '3-day units', '3-day median units', '1-day ≥+1u / ≤−1u', '3-day ≥+1u / ≤−1u', '1-day barrier up / down / neither (both same session)', '3-day barrier up / down / neither (both)', '3-day dividend steps'], rows));
  }
  const tests = [
    ['Event vs G2 (headline)', 'validFirst_vs_G2'], ['Event vs G1', 'validFirst_vs_G1'], ['Event vs G3', 'validFirst_vs_G3'],
    ['Every valid day vs G2', 'validEvery_vs_G2'], ['Every valid day vs G1', 'validEvery_vs_G1'], ['Every valid day vs G3', 'validEvery_vs_G3'],
    ['Event vs G2, no entry filter', 'validFirst_vs_G2_unfiltered'], ['Event vs G1, no entry filter', 'validFirst_vs_G1_unfiltered'], ['Event vs G3, no entry filter', 'validFirst_vs_G3_unfiltered'],
    ['Event vs G2, dividend steps dropped', 'headline_exclDividendSteps'],
  ];
  for (const [h, kind, title] of [[3, 'u', 'three-session move, units'], [3, 'p', 'three-session move, percent'], [1, 'u', 'one-session move, units'], [1, 'p', 'one-session move, percent']]) {
    out.push(`\n**The test — ${title}.** Mean of per-session differences (valid arm minus group) [90% interval]; sessions paired.\n`);
    out.push(table(['Comparison', ...P.map((p) => PN[p]), 'Sessions (whole)', 'n event / n group (whole)'], tests.map(([label, k]) => {
      const T = A.tests[k];
      return [label, ...P.map((p) => cell(T[p][`${h}${kind}`], kind)), T.whole[`${h}${kind}`].sessions, `${T.whole[`${h}${kind}`].nA} / ${T.whole[`${h}${kind}`].nB}`];
    })));
  }
  out.push('\n**Splits against G2** (three-session units, then one-session units; "small" where an arm has fewer than 100).\n');
  out.push(table(['Split', 'Events entered (dev / conf / whole)', ...P.map((p) => `3-day · ${PN[p]}`), '1-day · whole', '3-day vs G1 · whole'], Object.entries(A.splits).map(([id, s]) => [
    `${s.group}: ${id}`, P.map((p) => s.counts[p].events).join(' / '), ...P.map((p) => cell(s.vsG2[p]['3u'], 'u')), cell(s.vsG2.whole['1u'], 'u'), cell(s.vsG1.whole['3u'], 'u'),
  ])));
  return out.join('\n');
}

function partB(B, name) {
  const out = [`### Part B — ${name} window`];
  out.push(`\nBase: ${B.base.uptrendBreakoutSatisfied} stock-days with the breakout pattern satisfied in an uptrend (${B.base.breakoutSatisfiedAnyRegime} in any regime). L0 check: agrees with the record's own extension result on ${B.l0Check.agree} of ${B.l0Check.base}; limit equal on ${B.l0Check.limitEqual}; valid under L0: ${B.l0Check.validUnderL0}.\n`);
  out.push(table(['Candidate', 'Per morning · dev (median, p10–p90, none)', 'Per morning · conf', 'Per morning · whole', 'Events (whole) / entered / removed', '3-day vs G2 · dev', '3-day vs G2 · conf', '3-day vs G2 · whole', '1-day vs G2 · whole', '3-day vs G1 · whole', '3-day mean units / ≥+1u / ≤−1u (whole)'], Object.entries(B.candidates).map(([id, c]) => {
    const pm = (p) => `${c.perMorning[p].median}, ${c.perMorning[p].p10}–${c.perMorning[p].p90}, ${pc(c.perMorning[p].noneShare)}`;
    const m = c.measures.whole;
    return [id, pm('dev'), pm('conf'), pm('whole'), `${m.events} / ${m.entered} / ${m.removedByEntry}`, cell(c.vsG2.dev['3u'], 'u'), cell(c.vsG2.conf['3u'], 'u'), cell(c.vsG2.whole['3u'], 'u'), cell(c.vsG2.whole['1u'], 'u'), cell(c.vsG1.whole['3u'], 'u'), `${sg(m.h[3].meanUnits, 3)} / ${pc(m.h[3].atOrAbovePlus1)} / ${pc(m.h[3].atOrBelowMinus1)}`];
  })));
  out.push(`\nTightness order (development stock-days): ${B.tightness.join(' < ')}. Recommendation (estimate reading): **${B.recommendation.estimateReading ?? 'none'}**; interval reading: ${B.recommendation.intervalReading ?? 'none'}.`);
  return out.join('\n');
}

function partC(C, windows) {
  const out = ['### Part C — the archetypes\' own rules (today\'s scores, approximate)'];
  out.push(`\nScores computed ${C.computedAt}; ${C.matched} of 228 matched. Fundamental score: min ${C.scoreSpread.min}, median ${C.scoreSpread.median}, max ${C.scoreSpread.max}; deciles (10th … 90th): ${C.scoreSpread.deciles.join(', ')}.\n`);
  out.push(table(['Score band', ...Object.keys(C.scoreSpread.bins).map((b) => `${b}–${Number(b) + 9}`)], [['Stocks', ...Object.values(C.scoreSpread.bins)]]));
  out.push('');
  out.push(table(['Rule', 'Stocks of 228', ...windows.flatMap((w) => P.map((p) => `${w} · ${PN[p]} (median, p10–p90, none)`))], Object.entries(C.gates).map(([id, g]) => [
    id, g.stocks, ...windows.flatMap((w) => P.map((p) => { const x = g.perMorningValid[w][p]; return `${x.median}, ${x.p10}–${x.p90}, ${pc(x.noneShare)}`; })),
  ])));
  return out.join('\n');
}

function partD(Dd) {
  const out = ['### Part D — squeeze against each stock\'s own history (a precondition only)'];
  for (const [name, k] of [['short window, stored bars', 'short'], ['long window, fetched bars', 'long']]) {
    const x = Dd[k];
    out.push(`\n**${name}:** ${x.sessionsWithFullHistory} sessions counted (all 228 with 120 trailing sessions); ${x.sessionsWithoutFullHistory} not counted; eligible names per session ${x.eligibleRange.join('–')}.\n`);
    out.push(table(['Period', 'Sessions', 'Median', 'p10–p90', 'Min–max'], P.map((p) => [PN[p], x.byPeriod[p].sessions, x.byPeriod[p].median, `${x.byPeriod[p].p10}–${x.byPeriod[p].p90}`, `${x.byPeriod[p].min}–${x.byPeriod[p].max}`])));
    out.push('');
    out.push(table(['Week of', 'Sessions', 'Median', 'Range'], x.weekly.map((w) => [w.week, w.sessions, w.median, `${w.min}–${w.max}`])));
  }
  out.push(`\nLong-window figures on the short window's sessions: ${Dd.longOnShortSessions.sessions} sessions, median ${Dd.longOnShortSessions.median}, ${Dd.longOnShortSessions.min}–${Dd.longOnShortSessions.max}.`);
  return out.join('\n');
}

function partE(E, name) {
  const out = [`### Part E — ${name} window (${E.mornings} mornings)`];
  for (const [rd, title] of [['literal', 'valid at the prior close (the prompt\'s words)'], ['firstDay', 'turned valid at the prior close'], ['shelf3', 'three-session shelf life']]) {
    out.push(`\n**${title}.** Slots of seven a valid, enterable setup could fill: median; share of mornings filling all seven, at least four, none.\n`);
    out.push(table(['Archetype (gate)', ...P.map((p) => PN[p])], Object.entries(E.readings[rd]).map(([g, x]) => [g, ...P.map((p) => `${x[p].median} · ${pc(x[p].all7)} · ${pc(x[p].atLeast4)} · ${pc(x[p].none)}`)])));
  }
  out.push('\nContrarian: not applicable (no detector).');
  return out.join('\n');
}

function main() {
  writeVerbGrep();
  const runDir = runDirOf(process.argv);
  const s = readJson(path.join(runDir, 'summary.json'));
  const z = s.step0;
  const parts = [
    '## Step 0',
    table(['Check', 'Expected', 'Re-run'], [
      ['Median valid names a morning', s.definitions.reproduce.medianValid, z.medianValid],
      ['Valid Trend Breakout stock-days', s.definitions.reproduce.validBreakout, `${z.validBreakout} of ${z.stockDays}`],
      ['Stored records matching', `${s.definitions.reproduce.storedRecords} of ${s.definitions.reproduce.storedRecords}`, `${z.storedMatched} of ${z.storedRecords}`],
      ['Compact records equal to the frequency run\'s replay.json', 'all', `${z.compactEqual.compared - z.compactEqual.mismatches} of ${z.compactEqual.compared}`],
    ]),
    `\nOverlap (long-window replay on the fetched bars vs the stored run, ${s.overlap.compared} stock-days, all 241 symbols): verdict fields differ on ${s.overlap.verdictFieldsDiffer} (universe ${s.overlap.universeDiffs}); facts differ on ${s.overlap.factsDiffer}; limit differs on ${s.overlap.limitDiffer}.`,
    s.overlap.diffs.length ? table(['Symbol', 'Session', 'Fields', 'Stored', 'Fetched'], s.overlap.diffs.map((d) => [d.symbol, d.session, d.differing.join(', '), `${d.stored.v} ${d.stored.r ?? ''} ${d.stored.p ?? ''} ${d.stored.rf ?? ''}`, `${d.fetched.v} ${d.fetched.r ?? ''} ${d.fetched.p ?? ''} ${d.fetched.rf ?? ''}`])) : '',
    `\nLong window: ${s.longWindow.sessions} sessions ${s.longWindow.first} → ${s.longWindow.last}; ${s.longWindow.fetchedSessions} from the fetch; refusals before the overlap: ${JSON.stringify(s.longWindow.refusalsBeforeOverlap)}; sessions whose 55-bar window reaches 2025 bars: ${s.longWindow.sessionsWhoseBarsReach2025}.`,
    `\nRequests: ${s.requests.made} of ${s.requests.cap}, failed ${s.requests.failed}; ${s.requests.first} → ${s.requests.last}; ${JSON.stringify(s.requests.rowCounts)}.`,
    `\nCited at HEAD: ${Object.entries(s.cites).map(([k, v]) => `${k} ${v}`).join('; ')}.`,
    '\n## Part A', partA(s.partA.short, 'short'), partA(s.partA.long, 'long'),
    '\n## Part B', partB(s.partB.short, 'short'), partB(s.partB.long, 'long'),
    '\n## Part C', partC(s.partC, ['short', 'long']),
    '\n## Part D', partD(s.partD),
    '\n## Part E', partE(s.partE.short, 'short'), partE(s.partE.long, 'long'),
  ];
  const file = path.join(runDir, 'tables.md');
  writeFileSync(file, `${parts.join('\n')}\n`);
  console.log(`wrote ${file}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { main(); } catch (err) { die(err?.stack || err?.message); }
}
