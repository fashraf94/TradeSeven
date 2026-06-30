// api/scripts/archetype-integrity-eval/runEval.eval.mjs
//
// Archetype-Integrity / "Third Path" — Phase H, the OBSERVE reliability HARNESS.
//
// This is the one file that makes REAL Gemma calls. It runs the FIXED corpus
// (./corpus.js) through the REAL production voice layer + gate in OBSERVE mode and
// aggregates the gate outcomes (./aggregate.js) into the metrics table + the two
// hard zeros that gate the ENFORCE flip.
//
// It is NOT part of the default test suite — the filename has no `.test.`/`.spec.`
// so `vitest run` skips it. Run it explicitly (needs OPENROUTER_API_KEY + network
// access to openrouter.ai):
//
//     npx vitest run --config vitest.eval.config.mjs
//
// OBSERVE is forced here via vi.mock (the committed flag stays 'off'); the gate
// evaluates + reports, writes nothing, and the Diversifier cap stays passive.

import { describe, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Force OBSERVE for the whole run (production const stays 'off').
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ARCHETYPE_INTEGRITY_MODE: 'observe',
}));

const { buildVoiceLayerPrompt } = await import('../../_utils/voiceLayerPrompt.js');
const { callGemmaVoice, parseVoiceLayerResponse } = await import('../../_utils/gemmaClient.js');
const { gateDirective, renderDirectiveStatus } = await import('../../_utils/directiveGate.js');
const { getEffectiveArchetype } = await import('../../_utils/directiveIdentity.js');
const { buildCorpus } = await import('./corpus.js');
const { aggregate, proseAssertsChange, collectHardZeroBreaches } = await import('./aggregate.js');

const RUNS_PER_ITEM = Number(process.env.EVAL_RUNS_PER_ITEM || 1);
const CALL_TIMEOUT_MS = 30000;
// Bounded concurrency: run a small pool of items in parallel (fast) WITHOUT
// firing all 140 at once (which would trip OpenRouter rate limits → 429s).
// Each item is independent and aggregate() is order-independent, so the pool is a
// pure speed optimization — the metrics are identical to a sequential run.
const CONCURRENCY = Math.max(1, Number(process.env.EVAL_CONCURRENCY || 6));
const HERE = dirname(fileURLToPath(import.meta.url));

// Bounded-concurrency map. Assigns results[i] exactly once (the `next++` index
// claim is synchronous, so no two workers ever take the same index — no dropped or
// duplicated results). Returns results in INPUT order regardless of finish order.
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      done += 1;
      if (done % 10 === 0 || done === items.length) {
        console.log(`[eval] ${done}/${items.length} items done`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const ELICIT = { dimension: 'risk_appetite', instruction: 'probe risk appetite' };

function fixtureFor(archetype) {
  const agent = { name: 'EvalAgent', archetype, partnerProfile: {}, stats: { gamesPlayed: 5, wins: 2, losses: 3 } };
  const battle = {
    gameMode: 'standard', status: 'active',
    portfolio: { star: [], core: [], support: [] },
    scoreState: { currentScore: 0, opponentScore: 0 },
    agentContext: { archetype },
    dailyReviews: [], dailyGrades: [],
  };
  return { agent, battle };
}

const VALID_CLASSIFICATIONS = new Set(['in_archetype', 'flex', 'core_conflict', 'user_lever', 'research_only']);

// What classification the corpus says Gemma SHOULD emit per category (diagnostic
// label only — drives no scoring; multi_intent/follow_up are core-reversing asks).
const EXPECTED_CLASSIFICATION = {
  valid_flex: 'in_archetype|flex',
  core_conflict: 'core_conflict',
  user_lever: 'user_lever',
  research_only: 'research_only',
  multi_intent: 'core_conflict',
  follow_up_pressure: 'core_conflict',
};

async function withTimeout(fn) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try { return await fn(controller.signal); } finally { clearTimeout(t); }
}

// Run ONE corpus item through the real voice layer + gate. Returns a record for
// aggregate() + the diagnostic fields collectHardZeroBreaches() surfaces.
async function evalItem(item, index, runIndex) {
  // Diagnostic fields carried on EVERY record (ignored by aggregate, used by the
  // breach collector). corpusItemId/subtype/userMessage make a breach traceable.
  const diag = {
    corpusItemId: item.itemId, index, runIndex,
    subtype: item.subtype ?? null, userMessage: item.message,
    expectedCommit: item.expectedCommit,
    expectedHardOutcome: item.expectedHardOutcome ?? null,
    expectedClassification: EXPECTED_CLASSIFICATION[item.category] ?? null,
  };
  const { agent, battle } = fixtureFor(item.archetype);
  const systemPrompt = buildVoiceLayerPrompt({
    agent, battle, elicitationTarget: ELICIT,
    conversationHistory: item.conversationHistory, anchorContext: null,
    marketSnapshot: null, mode: 'battle', dailyReviews: [], dailyGrades: [],
    capabilitiesManifest: null,
  });

  try {
    const gate = await withTimeout(async (signal) => {
      const raw = await callGemmaVoice({
        systemPrompt, conversationHistory: item.conversationHistory,
        userMessage: item.message, signal,
      });
      const parsed = parseVoiceLayerResponse(raw);
      const g = await gateDirective({
        parsed, effectiveArchetype: getEffectiveArchetype(battle, agent), mode: 'battle',
        callGemmaVoice, systemPrompt, conversationHistory: item.conversationHistory,
        userMessage: item.message, signal, deadlineMs: Date.now() + 24000,
      });
      return { parsed, g };
    });

    const prop = gate.parsed?._archetypeProposal;
    const proposalPresent = !!prop && typeof prop === 'object';
    return {
      ...diag,
      itemId: item.itemId, archetype: item.archetype, category: item.category,
      expectedAdjustmentId: item.expectedAdjustmentId, callFailed: false,
      proposalPresent,
      schemaValid: proposalPresent && VALID_CLASSIFICATIONS.has(prop.classification),
      committed: !!gate.g.hasDirective,
      // The AUTHORITATIVE truth-of-record chat.js renders from the gate outcome
      // (hasDirective) — the channel hard-zero-2 now measures. Same renderer as prod.
      directiveStatus: renderDirectiveStatus(gate.g.hasDirective).directiveStatus,
      selectedId: gate.g.outcome?.selectedAdjustmentId ?? null,
      repairUsed: !!gate.g.outcome?.repairUsed,
      proseAssertsChange: proseAssertsChange(gate.parsed?.response || ''), // informational drift
      proposal: proposalPresent ? prop : null,                 // full _archetypeProposal Gemma emitted
      committedDirectiveText: gate.g.directive?.text ?? null,  // canonical text that got minted (if any)
    };
  } catch (err) {
    return {
      ...diag,
      itemId: item.itemId, archetype: item.archetype, category: item.category,
      callFailed: true, error: String(err?.message || err),
    };
  }
}

const fmtPct = (r) => (r === null ? ' n/a ' : `${(r * 100).toFixed(1)}%`);

function formatReport(agg, meta) {
  const lines = [];
  lines.push('================ ARCHETYPE-INTEGRITY OBSERVE EVAL ================');
  lines.push(`corpus items: ${meta.itemCount} · runs/item: ${meta.runsPerItem} · concurrency: ${meta.concurrency} · records: ${meta.records} · gemma calls (approx): ${meta.approxCalls}`);
  lines.push(`call failures: ${agg.overall.counts.callFailed}`);
  lines.push('');
  lines.push('### HARD ZEROS (both STRUCTURAL — 0 by construction; must be 0 to recommend ENFORCE)');
  lines.push(`  core-OPPOSING directives             : ${agg.hardZeros.coreReversingDirectives}`);
  lines.push(`  null-write status NOT 'no_change'    : ${agg.hardZeros.claimedButNull}`);
  lines.push(`  → both zero: ${agg.hardZeros.bothZero ? 'YES' : 'NO'}`);
  lines.push(`  (informational: ${agg.overall.counts.proseAssertsChange} prose-overclaim turn(s) — backstopped by the authoritative status)`);
  lines.push('');
  const tp = agg.overall.thirdPathCommit;
  lines.push('### THIRD-PATH COMMITS (informational — Ruling A; NOT a breach)');
  lines.push(`  total ${tp.total} · multi-intent-half ${tp.multiIntentHalf} · pure-conflict-redirect ${tp.pureConflictRedirect}`);
  lines.push('');
  const row = (label, b) => {
    const r = b.rates;
    lines.push(
      `  ${label.padEnd(16)} present ${fmtPct(r.proposalPresentRate)} · schema ${fmtPct(r.schemaValidRate)} · ` +
      `flex-accept ${fmtPct(r.validFlexAcceptanceRate)} · false-refusal ${fmtPct(r.falseRefusalRate)} · ` +
      `wrong-id ${fmtPct(r.wrongIdRate)} · core-held ${fmtPct(r.coreHeldRate)} · 3rd-path ${b.thirdPathCommit.total} · ` +
      `repair ${fmtPct(r.repairRetryRate)} · prose-overclaim ${fmtPct(r.proseOverclaimRate)}`,
    );
  };
  lines.push('### RATES (per archetype + overall)');
  for (const [a, b] of Object.entries(agg.byArchetype)) row(a, b);
  row('OVERALL', agg.overall);
  lines.push('=================================================================');
  return lines.join('\n');
}

describe('Archetype-Integrity OBSERVE reliability eval', () => {
  it('runs the fixed corpus through the real voice layer + gate and reports metrics', async () => {
    const corpus = buildCorpus();

    // Preflight: one real probe. If Gemma is unreachable/uncredentialed, fail fast
    // with a clear diagnostic instead of hammering the whole corpus.
    try {
      await withTimeout((signal) => callGemmaVoice({
        systemPrompt: 'Reply with JSON {"response":"ok"}.', conversationHistory: [],
        userMessage: 'ping', signal,
      }));
    } catch (err) {
      throw new Error(
        `[eval] Gemma preflight FAILED: ${err?.message || err}\n` +
        `This harness needs OPENROUTER_API_KEY set AND outbound access to openrouter.ai.\n` +
        `Run it where both are available (local machine / a configured preview), not a locked-down sandbox.`,
      );
    }

    const records = [];
    for (let run = 0; run < RUNS_PER_ITEM; run++) {
      if (RUNS_PER_ITEM > 1) console.log(`[eval] pass ${run + 1}/${RUNS_PER_ITEM}`);
      // evalItem never throws (it catches per-item → callFailed record), so one
      // rate-limited 429 is excluded, never fatal to the pool.
      const runRecords = await mapPool(corpus, CONCURRENCY, (item, i) => evalItem(item, i, run + 1));
      records.push(...runRecords);
    }

    const agg = aggregate(records);
    const hardZeroBreaches = collectHardZeroBreaches(records);
    const meta = {
      itemCount: corpus.length, runsPerItem: RUNS_PER_ITEM, concurrency: CONCURRENCY,
      records: records.length,
      approxCalls: records.length + agg.overall.counts.repairUsed, // base + repairs
    };
    const report = formatReport(agg, meta);
    console.log('\n' + report + '\n');

    // Surface each breach inline so a nonzero hard zero is diagnosable at a glance.
    const summarize = (label, arr) => {
      if (!arr.length) return;
      console.log(`### ${label} breaches (${arr.length}):`);
      for (const b of arr) {
        console.log(`  - ${b.archetype}/${b.subtype ?? b.category} [run ${b.runIndex}] classified="${b.proposal?.classification ?? 'none'}" minted="${b.committedDirectiveText ?? ''}"`);
        console.log(`      user: "${b.userMessage}"`);
      }
    };
    summarize('core-reversing', hardZeroBreaches.coreReversingCommitted);
    summarize('claimed-but-null', hardZeroBreaches.claimedButNull);

    writeFileSync(
      join(HERE, 'last-run-report.json'),
      JSON.stringify({ meta, agg, hardZeroBreaches, ts: new Date().toISOString() }, null, 2),
    );
    // Measurement, not a gate: the run passes; the FOUNDER reads the numbers and
    // decides. (The hard zeros are reported, not asserted.)
  }, 2 * 60 * 60 * 1000); // 2h ceiling — generous headroom for slow-network / rate-limit backoff
});
