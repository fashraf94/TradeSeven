#!/usr/bin/env node
// scripts/experiments/setup-frequency/replay.mjs
//
// Setup frequency count — THE RECONSTRUCTION AND THE REPRODUCTION CHECK (prompt §2). Offline and deterministic once
// export.json and bars/ exist: no Firestore, no network.
//
//   1  Every planned symbol at every session of the window, through storeReplay.mjs (the store's acquireOnce and
//      classifyEvidence on a slice of the symbol's long series). One compact record per (symbol, session).
//   2  The compression inputs for the 228 ranked stocks (§6): calculateNR7 and calculateBollingerBands
//      (api/_utils/technicalCalculations.js:422 and :247) on the bars the rankings producer reads (mapDailyRows rows,
//      newest first), as api/cron/compute-index-intelligence.js:997–1000 calls them.
//   3  THE REPRODUCTION CHECK: every stored setupEvidence record inside the window under the current tf-setup-v1 rule
//      set, against the replay of the same (symbol, session): verdict, reason, pattern and patternsSatisfied. A record
//      that differs is written with its facts and its bars beside the replay's, so a provider revision can be shown.
//
// USAGE: node scripts/experiments/setup-frequency/replay.mjs [--run <dir>]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeRuleSet } from '../../../api/_utils/setupEvaluator/thresholds.js';
import { calculateBollingerBands, calculateNR7 } from '../../../api/_utils/technicalCalculations.js';
import { ALL_TICKERS } from '../../../api/_utils/rankingConfig.js';
import { compactOf, rankingBarsAt, replayOne } from './storeReplay.mjs';
import { die, readJson, runDirOf, windowSessions, writeJson, writeVerbGrep } from './lib.mjs';

const BAR_FIELDS = ['open', 'high', 'low', 'close', 'volume', 'adjustedClose'];
const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

/** What differs between two bar windows, date by date (stored record vs replay), field by field. */
function barDiffs(stored, replayed) {
  const byDate = {};
  for (const b of replayed || []) byDate[b.date] = b;
  const out = [];
  for (const s of stored || []) {
    const r = byDate[s.date];
    if (!r) { out.push({ date: s.date, field: 'row', stored: 'present', replay: 'absent' }); continue; }
    for (const f of BAR_FIELDS) if ((s[f] ?? null) !== (r[f] ?? null)) out.push({ date: s.date, field: f, stored: s[f] ?? null, replay: r[f] ?? null });
  }
  return out;
}

async function main() {
  writeVerbGrep();
  const runDir = runDirOf(process.argv);
  const plan = readJson(path.join(runDir, 'plan.json'));
  const exp = readJson(path.join(runDir, 'export.json'));
  const sessions = windowSessions(plan.window.last);
  if (sessions[0] !== plan.window.first) die('the plan and the calendar disagree on the window');
  const ruleSet = describeRuleSet();

  const bySymbol = {};
  const compression = {};
  const series = {};
  const received = {};
  const full = {}; // `${symbol}|${session}` → the full replay, kept only for stored-record pairs
  const wanted = {};
  for (const r of exp.records) wanted[`${r.symbol}|${r.session}`] = true;

  for (const symbol of plan.all) {
    const file = readJson(path.join(runDir, 'bars', `${symbol}.json`));
    if (!Array.isArray(file.payload)) die(`${symbol}: the stored payload is not an array`);
    series[symbol] = file.payload;
    received[symbol] = file.receivedAt;
    const receivedAtMs = Date.parse(file.receivedAt);
    bySymbol[symbol] = {};
    for (const session of sessions) {
      const out = await replayOne({ series: file.payload, symbol, session, receivedAtMs });
      bySymbol[symbol][session] = compactOf(out);
      if (wanted[`${symbol}|${session}`]) full[`${symbol}|${session}`] = out;
    }
    if (ALL_TICKERS.includes(symbol)) {
      compression[symbol] = {};
      for (const session of sessions) {
        const from = new Date(Date.parse(`${session}T12:00:00Z`) - 130 * 86_400_000).toISOString().slice(0, 10);
        const rows = rankingBarsAt(file.payload, session, from);
        const nr7 = rows.length >= 7 ? calculateNR7(rows.map((r) => r.high), rows.map((r) => r.low)) : null;
        const bb = rows.length >= 20 ? calculateBollingerBands(rows.map((r) => r.close), 20, 2) : null;
        compression[symbol][session] = { nr7: nr7 ? nr7.nr7 : null, bw: bb && Number.isFinite(bb.bandwidth) ? bb.bandwidth : null };
      }
    }
  }

  // The reproduction check.
  const inWindow = exp.records.filter((r) => sessions.includes(r.session));
  const sameRule = inWindow.filter((r) => r.ruleSet?.setupVersion === ruleSet.setupVersion && r.ruleSet?.thresholdsHash === ruleSet.thresholdsHash && r.ruleSet?.semanticsId === ruleSet.semanticsId);
  const diffs = [];
  let matched = 0;
  for (const rec of sameRule) {
    const out = full[`${rec.symbol}|${rec.session}`];
    if (!out) { diffs.push({ symbol: rec.symbol, session: rec.session, why: 'not_replayed' }); continue; }
    if (out.acquired.failure) { diffs.push({ symbol: rec.symbol, session: rec.session, why: `replay_failure:${out.acquired.failure}` }); continue; }
    const e = out.acquired.entry;
    const fields = { verdict: [rec.verdict, e.verdict], reason: [rec.reason, e.reason ?? null], pattern: [rec.pattern, e.pattern ?? null], patternsSatisfied: [rec.patternsSatisfied, e.patternsSatisfied] };
    const differing = Object.entries(fields).filter(([k, [a, b]]) => (k === 'patternsSatisfied' ? !sameList(a, b) : a !== b)).map(([k]) => k);
    if (differing.length === 0) { matched += 1; continue; }
    const replayFacts = {};
    for (const [k, f] of Object.entries(e.factsUsed || {})) replayFacts[k] = f?.value ?? null;
    diffs.push({
      symbol: rec.symbol, session: rec.session, why: 'verdict_fields', differing,
      stored: { verdict: rec.verdict, reason: rec.reason, pattern: rec.pattern, patternsSatisfied: rec.patternsSatisfied, facts: rec.facts, capturedAt: rec.capturedAt },
      replay: { verdict: e.verdict, reason: e.reason ?? null, pattern: e.pattern ?? null, patternsSatisfied: e.patternsSatisfied, facts: replayFacts, disposition: out.disposition.disposition },
      bars: barDiffs(rec.bars, out.acquired.evidence?.bars),
    });
  }
  // Facts that differ even where the verdict fields agree: a provider revision the verdict happened to survive.
  let factDrift = 0;
  const driftFacts = {};
  for (const rec of sameRule) {
    const out = full[`${rec.symbol}|${rec.session}`];
    if (!out || out.acquired.failure) continue;
    const e = out.acquired.entry;
    let drift = false;
    for (const [k, v] of Object.entries(rec.facts || {})) {
      if ((e.factsUsed?.[k]?.value ?? null) !== v) { drift = true; driftFacts[k] = (driftFacts[k] || 0) + 1; }
    }
    if (drift) factDrift += 1;
  }

  const reproduction = {
    storedTotal: exp.records.length,
    inWindow: inWindow.length,
    otherRuleSet: inWindow.length - sameRule.length,
    compared: sameRule.length,
    matched,
    differing: diffs.length,
    recordsWithFactDrift: factDrift,
    driftFacts,
    diffs,
  };
  writeJson(path.join(runDir, 'replay.json'), { window: { first: sessions[0], last: sessions[sessions.length - 1], sessions }, received, bySymbol, compression });
  writeJson(path.join(runDir, 'reproduction.json'), reproduction);
  console.log(`replayed ${plan.all.length} symbols × ${sessions.length} sessions`);
  console.log(`reproduction: ${reproduction.compared} compared, ${matched} match, ${diffs.length} differ; facts drifted on ${factDrift} (verdict fields unchanged where they match)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => die(err?.stack || err?.message));
}
