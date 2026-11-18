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
  // One paired session has no interval: its fixed label is shown as no evidence (review SP-L1-2).
  if (t.sessions < 2) return `one paired session, no interval: ${sg(t.est, d)}`;
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
  out.push('\n**Splits** (units; "small" where an arm has fewer than 100 observations; "sessions" = the paired sessions behind each table\'s own comparison, dev / conf / whole; archetype rules use today\'s scores, approximate).\n');
  const splitRows = (key, hk) => Object.entries(A.splits).map(([id, s]) => [`${s.group}: ${id}`, P.map((p) => s.counts[p].events).join(' / '), P.map((p) => s[key][p][hk].sessions).join(' / '), ...P.map((p) => cell(s[key][p][hk], 'u'))]);
  for (const [key, hk, title] of [['vsG2', '3u', 'three sessions against G2'], ['vsG2', '1u', 'one session against G2'], ['vsG1', '3u', 'three sessions against G1'], ['vsG1', '1u', 'one session against G1']]) {
    out.push(`\n*${title}*\n`);
    out.push(table(['Split', 'Events entered (dev / conf / whole)', 'Sessions', ...P.map((p) => PN[p])], splitRows(key, hk)));
  }
  return out.join('\n');
}

function postHoc(X) {
  const out = [`### Post hoc — the long window before the short window (${X.sessions} sessions, ${X.first} → ${X.last})`, '\nAdded after the first results were seen. Not one of the fixed labels; the same arms, test and words.\n'];
  out.push(table(['Comparison', '3-day units', '3-day %', '1-day units', '1-day %', 'n event / n group (3-day)'], Object.entries(X.tests).map(([k, t]) => [k.replace('validFirst_vs_', 'Event vs '), cell(t['3u'], 'u'), cell(t['3p'], 'p'), cell(t['1u'], 'u'), cell(t['1p'], 'p'), `${t['3u'].nA} / ${t['3u'].nB}`])));
  const m = X.measures;
  out.push(`\nMeans, three sessions (units / %): event ${sg(m.validFirst.h[3].meanUnits, 3)} / ${sg(m.validFirst.h[3].meanPct)} (n ${m.validFirst.h[3].n}); G1 ${sg(m.G1.h[3].meanUnits, 3)} / ${sg(m.G1.h[3].meanPct)}; G2 ${sg(m.G2.h[3].meanUnits, 3)} / ${sg(m.G2.h[3].meanPct)}.`);
  return out.join('\n');
}

function sensitivity(rows) {
  const out = ['### Post review — the overlap sensitivity', '\nAdjacent sessions\' three-session windows overlap, so resampling whole sessions can understate the interval. This re-draws the same per-session differences in blocks of 3 and 5 consecutive sessions (a circular block bootstrap, same seed and count). A sensitivity, not a label.\n'];
  out.push(table(['Comparison', 'Estimate', 'Whole-session interval (the test)', 'Label', 'Lag-1 correlation', 'Blocks of 3', 'Blocks of 5'], rows.map((r) => [r.label, sg(r.est, 3), `[${sg(r.wholeSession[0], 3)}, ${sg(r.wholeSession[1], 3)}]`, SHORT[r.label90], f(r.lag1), `[${sg(r.block3.lo, 3)}, ${sg(r.block3.hi, 3)}]`, `[${sg(r.block5.lo, 3)}, ${sg(r.block5.hi, 3)}]`])));
  return out.join('\n');
}

function partB(B, name) {
  const out = [`### Part B — ${name} window`];
  out.push(`\nBase: ${B.base.uptrendBreakoutSatisfied} stock-days (development ${B.baseByPeriod.dev}, confirmation ${B.baseByPeriod.conf}) with the breakout pattern satisfied in an uptrend (${B.base.breakoutSatisfiedAnyRegime} in any regime). L0 check: agrees with the record's own extension result on ${B.l0Check.agree} of ${B.l0Check.base}; limit equal on ${B.l0Check.limitEqual}; valid under L0: ${B.l0Check.validUnderL0}.\n`);
  out.push(table(['Candidate', 'Per morning · dev (median, p10–p90, none)', 'Per morning · conf', 'Per morning · whole', 'Events (whole) / entered / removed', '3-day vs G2 · dev', '3-day vs G2 · conf', '3-day vs G2 · whole', '1-day vs G2 · whole', '3-day vs G1 · whole', '3-day mean units / ≥+1u / ≤−1u (whole)'], Object.entries(B.candidates).map(([id, c]) => {
    const pm = (p) => `${c.perMorning[p].median}, ${c.perMorning[p].p10}–${c.perMorning[p].p90}, ${pc(c.perMorning[p].noneShare)}`;
    const m = c.measures.whole;
    return [id, pm('dev'), pm('conf'), pm('whole'), `${m.events} / ${m.entered} / ${m.removedByEntry}`, cell(c.vsG2.dev['3u'], 'u'), cell(c.vsG2.conf['3u'], 'u'), cell(c.vsG2.whole['3u'], 'u'), cell(c.vsG2.whole['1u'], 'u'), cell(c.vsG1.whole['3u'], 'u'), `${sg(m.h[3].meanUnits, 3)} / ${pc(m.h[3].atOrAbovePlus1)} / ${pc(m.h[3].atOrBelowMinus1)}`];
  })));
  out.push(`\nTightness order (development stock-days): ${B.tightness.join(' < ')}. Recommendation (estimate reading): **${B.recommendation.estimateReading ?? 'none'}**; interval reading: ${B.recommendation.intervalReading ?? 'none'}.`);
  out.push('\n<details><summary>Every candidate by period: tests and measurements</summary>\n');
  for (const [key, hk, title] of [['vsG2', '1u', 'one session against G2, units'], ['vsG1', '3u', 'three sessions against G1, units'], ['vsG1', '1u', 'one session against G1, units'], ['vsG2', '3p', 'three sessions against G2, percent'], ['vsG2', '1p', 'one session against G2, percent'], ['vsG1', '3p', 'three sessions against G1, percent'], ['vsG1', '1p', 'one session against G1, percent']]) {
    out.push(`\n*${title}*\n`);
    out.push(table(['Candidate', ...P.map((p) => PN[p])], Object.entries(B.candidates).map(([id, c]) => [id, ...P.map((p) => cell(c[key][p][hk], hk.endsWith('u') ? 'u' : 'p'))])));
  }
  out.push('\n*Measurements, one session (mean units / mean %; ≥+1u / ≤−1u; barrier up / down / neither)*\n');
  out.push(table(['Candidate', ...P.map((p) => PN[p])], Object.entries(B.candidates).map(([id, c]) => [id, ...P.map((p) => { const h1 = c.measures[p].h[1]; return `${sg(h1.meanUnits, 3)} / ${sg(h1.meanPct)}; ${pc(h1.atOrAbovePlus1)} / ${pc(h1.atOrBelowMinus1)}; ${pc(h1.upFirst)} / ${pc(h1.downFirst)} / ${pc(h1.neither)}`; })])));
  out.push('\n*Measurements, three sessions (events / entered / removed by entry; mean units; ≥+1u / ≤−1u; barrier up / down / neither)*\n');
  out.push(table(['Candidate', ...P.map((p) => PN[p])], Object.entries(B.candidates).map(([id, c]) => [id, ...P.map((p) => { const m = c.measures[p]; const h3 = m.h[3]; return `${m.events} / ${m.entered} / ${m.removedByEntry}; ${sg(h3.meanUnits, 3)}; ${pc(h3.atOrAbovePlus1)} / ${pc(h3.atOrBelowMinus1)}; ${pc(h3.upFirst)} / ${pc(h3.downFirst)} / ${pc(h3.neither)}`; })])));
  out.push('\n</details>');
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
  const z = Dd.sameSessions;
  out.push(`\nThe two sources on the same ${z.sessions} sessions: stored median ${z.stored.median} (${z.stored.min}–${z.stored.max}), fetched median ${z.fetched.median} (${z.fetched.min}–${z.fetched.max}); ${z.sessionsDiffering} sessions differ, by at most ${z.largestDifference} names.`);
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
    `\n2025 rows (no missing-bar check there): ${s.longWindow.gaps2025.from} → ${s.longWindow.gaps2025.to}, ${s.longWindow.gaps2025.spyRows} SPY rows; universe rows missing against SPY ${s.longWindow.gaps2025.missingAgainstSpy}, extra ${s.longWindow.gaps2025.extraAgainstSpy}; symbols with a gap: ${s.longWindow.gaps2025.symbolsWithGap.join(', ') || 'none'}.`,
    `\nRequests: ${s.requests.made} of ${s.requests.cap}, failed ${s.requests.failed}; ${s.requests.first} → ${s.requests.last}; ${JSON.stringify(s.requests.rowCounts)}.`,
    `\nCited at HEAD: ${Object.entries(s.cites).map(([k, v]) => `${k} ${v}`).join('; ')}.`,
    '\n## Part A', partA(s.partA.short, 'short'), partA(s.partA.long, 'long'), postHoc(s.postHocJanToMay), sensitivity(s.overlapSensitivity),
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
