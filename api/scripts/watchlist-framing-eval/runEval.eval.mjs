// api/scripts/watchlist-framing-eval/runEval.eval.mjs
//
// Release 2 PR-d (WS3, HELD) — the watchlist-framing CORPUS EVAL harness
// (spec §5.1: integrity-eval pattern, OpenRouter, founder-read distribution
// deltas vs the current prompt, no hard thresholds pre-launch).
//
// AUTHORED HERE, RUN BY FLASH (founder ruling D4): the build sandbox has no
// OPENROUTER_API_KEY and openrouter.ai is egress-blocked, so this harness
// has NEVER been live-run in CI — the numbers must come from Flash's local
// run. Excluded from the default suite by filename (no `.test.`). Run:
//
//     OPENROUTER_API_KEY=... npx vitest run --config vitest.watchlisteval.config.mjs
//
// WHAT IT DOES per corpus item (36 = 6 archetypes × 6 §5.1 scenarios), for
// EACH of two framings — A: the FROZEN pre-PR-d baseline copy; B: the
// canonical §5.1 text via the REAL builder (buildStrategyUserPrompt) — it
// asks the model for a shortlist JSON and extracts, per watched probe:
//   included?  rank band (top/middle/bottom third)?  reason line mentions it?
// The report is the A-vs-B distribution table per scenario × archetype —
// read it, don't threshold it.

import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { buildStrategyUserPrompt } = await import('../../_utils/agentPromptAssembly.js');
const { WATCHLIST_FRAMING_TEXT } = await import('../../_utils/controlPromptRenderer.js');
const { buildCorpus } = await import('./corpus.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.EVAL_MODEL || 'google/gemma-4-26b-a4b-it'; // the house OpenRouter default (gemmaClient.js)
const RUNS_PER_ITEM = Number(process.env.EVAL_RUNS_PER_ITEM || 1);
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY || 6));
const CALL_TIMEOUT_MS = 45000;

// The FROZEN pre-PR-d framing (baseline A) — copied verbatim from
// agentPromptAssembly.js @ d957f7c (the nudge block PR-d replaces). Never
// import this from production code: after PR-d merges the old copy exists
// only here, which is the point of a baseline.
const BASELINE_NUDGE = [
  'These are user-prioritized opportunities, not mandates. When building your shortlist:',
  '- Include every user-equipped ticker that has a plausible directional thesis — even',
  '  if it would not otherwise rank into your 25-35.',
  '- Where a user-equipped ticker is genuinely competitive, rank it accordingly high.',
  '- You may still omit a user-equipped ticker with a clearly poor setup; the user',
  '  trusts your judgment and does not want forced picks.',
  '- Some user-equipped tickers may not appear in the STOCK UNIVERSE table and will',
  '  show no FUND/TECH/BB_FIT/ATR/ARCH scores. Evaluate those on sector, thesis, and',
  '  market knowledge — absence from the table is not a negative signal.',
].join('\n');

function buildPromptVariant(item, variant) {
  // B = the REAL production builder (carries the canonical §5.1 text).
  const real = buildStrategyUserPrompt(
    { name: 'Atlas', archetype: item.archetype, activeRules: [] },
    item.watchlist,
  );
  // A = the same prompt with the canonical block swapped back to the frozen
  // baseline nudge (string surgery on the ONE framing region — the corpus
  // test pins that the canonical text appears exactly once).
  const user = variant === 'B'
    ? real
    : real.replace(WATCHLIST_FRAMING_TEXT, BASELINE_NUDGE);
  const held = item.heldNote ? `\n\n${item.heldNote}` : '';
  return `${user}\n\n${item.universeBlock}${held}\n\nReturn STRICT JSON only: {"shortlist":[{"ticker":"...","rank":1,"reason":"..."}]} with 10-15 entries, rank 1 = strongest.`;
}

async function callModel(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

function extractOutcomes(raw, item) {
  let shortlist = [];
  try {
    const jsonText = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    shortlist = JSON.parse(jsonText)?.shortlist ?? [];
  } catch {
    return { parseFailed: true, probes: [] };
  }
  const n = shortlist.length || 1;
  const probes = item.watched.map((ticker) => {
    const hit = shortlist.find((s) => s?.ticker === ticker);
    const rankBand = hit ? (hit.rank <= n / 3 ? 'top' : hit.rank <= (2 * n) / 3 ? 'middle' : 'bottom') : null;
    const reasonStated = !!hit && typeof hit.reason === 'string' && hit.reason.trim().length > 0;
    return { ticker, included: !!hit, rankBand, reasonStated };
  });
  return { parseFailed: false, probes };
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      if ((i + 1) % 6 === 0) console.log(`[watchlist-eval] ~${i + 1}/${items.length} slots done`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

describe('PR-d watchlist-framing corpus eval (LIVE — Flash runs this)', () => {
  it('runs the 36-item corpus under both framings and writes the distribution report', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not set — this harness must be run in an environment with the key + openrouter.ai egress (see README).');
    }
    const corpus = buildCorpus();
    const work = corpus.flatMap((item) =>
      ['A', 'B'].flatMap((variant) =>
        Array.from({ length: RUNS_PER_ITEM }, (_, run) => ({ item, variant, run }))),
    );
    const rows = await mapPool(work, CONCURRENCY, async ({ item, variant, run }) => {
      const raw = await callModel(buildPromptVariant(item, variant));
      return { id: item.id, archetype: item.archetype, scenario: item.scenario, variant, run, ...extractOutcomes(raw, item) };
    });

    // Aggregate: per scenario × variant — inclusion rate, top-band rate,
    // reason-stated rate, parse failures. Founder-read; NO thresholds.
    const agg = {};
    for (const row of rows) {
      const key = `${row.scenario}|${row.variant}`;
      const a = (agg[key] ??= { n: 0, included: 0, top: 0, reason: 0, parseFailed: 0 });
      a.n += 1;
      if (row.parseFailed) { a.parseFailed += 1; continue; }
      for (const p of row.probes) {
        if (p.included) a.included += 1;
        if (p.rankBand === 'top') a.top += 1;
        if (p.reasonStated) a.reason += 1;
      }
    }
    console.log('\nscenario | variant | slots | includedProbes | topBand | reasonStated | parseFailed');
    for (const [key, a] of Object.entries(agg).sort()) {
      console.log(`${key.padEnd(38)} | ${a.n} | ${a.included} | ${a.top} | ${a.reason} | ${a.parseFailed}`);
    }
    const reportPath = join(HERE, 'last-run-report.json');
    writeFileSync(reportPath, JSON.stringify({ model: MODEL, runsPerItem: RUNS_PER_ITEM, generatedAt: new Date().toISOString(), aggregate: agg, rows }, null, 2));
    console.log(`\n[watchlist-eval] report written: ${reportPath}`);
    console.log('[watchlist-eval] Read the A→B deltas per scenario (A = pre-PR-d nudge, B = §5.1). Expected direction: full_watchlist/off_style inclusion pressure DOWN under B; missing_data/off_style reason-stated UP under B. No hard thresholds pre-launch — founder reads.');
  });
});
