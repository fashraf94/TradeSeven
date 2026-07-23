// scripts/paired-eval-harness.js
//
// Archetype Architecture Phase 2 (P2.7) — the OFFLINE paired-evaluation
// harness (Spec DR-10 stage 2). Replays captured live contexts through
// candidate (manifest-derived) prompts via the API, OFF-TICK, and reports
// the divergence measures required before any behavior-affecting flip
// (manifest-read migration, identity block, preset freeze — R1 finding 28):
//
//   input size · truncation · latency · citation · refusal compliance ·
//   action divergence
//
// NO PRODUCTION WIRING (brief P2.7): this is a script, not a cron. It READS
// the shadowDiffs corpus the P2.6 assembly shadow accumulated (divergent
// docs carry both full prompt-part texts) and WRITES only a local JSONL
// report. It never touches battle docs, agents, or any production
// collection, and it spends API tokens only when run by a human.
//
// Prerequisites: preview/smoke flags on long enough to accumulate diffs
// (COMPILER_ENABLED + MANIFEST_WRITE_ENABLED + SHADOW_ASSEMBLY_ENABLED);
// GOOGLE_APPLICATION_CREDENTIALS (Admin SDK) + ANTHROPIC_API_KEY.
//
// Usage:
//   node scripts/paired-eval-harness.js [--battle <battleId>] [--limit 10]
//        [--model claude-haiku-4-5-20251001] [--dry-run] [--out report.jsonl]
//
//   --dry-run  assembles + measures inputs only (no API calls, no key needed)
//
// Import surface: firebaseAdmin + agentEvalToolSchema only — both Node-clean
// with no extensionless imports, so plain `node` runs this (unlike the
// registry graph; see archetypeRegistry.test.js header).

import { writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { TRADE_DECISION_TOOL } from '../api/_utils/agentEvalToolSchema.js';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const BATTLE_FILTER = flag('battle');
const LIMIT = Number(flag('limit', '10'));
const MODEL = flag('model', 'claude-haiku-4-5-20251001'); // the live tick's model
const DRY_RUN = has('dry-run');
const OUT = flag('out', `paired-eval-report-${Date.now()}.jsonl`);

function extractToolDecision(response) {
  const toolUse = (response.content ?? []).find((b) => b.type === 'tool_use');
  if (!toolUse) return { refused: true, decision: null };
  const input = toolUse.input ?? {};
  return {
    refused: false,
    decision: input.decision ?? null,
    symbolOut: input.symbol_out ?? input.symbolOut ?? null,
    symbolIn: input.symbol_in ?? input.symbolIn ?? null,
    conviction: input.conviction ?? null,
    citedForgeRules: input.cited_forge_rules ?? [],
    overriddenForgeRules: input.overridden_forge_rules ?? [],
  };
}

async function replay(anthropic, { system, identity, context }) {
  const startedAt = Date.now();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0, // determinism over parity with the live 0.4 — divergence
                    // must come from the PROMPTS, not sampling noise
    system,
    messages: [
      { role: 'user', content: identity },
      { role: 'assistant', content: 'I understand my identity and strategic context. Show me the live battle state.' },
      { role: 'user', content: context },
    ],
    tools: [TRADE_DECISION_TOOL],
    tool_choice: { type: 'tool', name: 'submit_trade_decision' },
  }, { timeout: 30_000 });
  return {
    latencyMs: Date.now() - startedAt,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    truncated: response.stop_reason === 'max_tokens',
    stopReason: response.stop_reason ?? null,
    ...extractToolDecision(response),
  };
}

function summarizeCitation(result, renderedRuleIds) {
  const cited = result.citedForgeRules ?? [];
  return {
    citedCount: cited.length,
    citedOutsideRendered: renderedRuleIds.length
      ? cited.filter((id) => !renderedRuleIds.includes(id)).length
      : null,
  };
}

async function main() {
  const db = getFirebaseAdmin();

  // Collection-group over shadowDiffs; divergent docs only (they carry the
  // full texts needed for replay). Per-battle filter avoids the CG index
  // when a battle id is given.
  let diffs = [];
  if (BATTLE_FILTER) {
    const snap = await db.collection('agentBattles').doc(BATTLE_FILTER)
      .collection('shadowDiffs').orderBy('envelope.evaluatedAt', 'desc').limit(LIMIT * 3).get();
    diffs = snap.docs.map((d) => ({ id: d.id, battleId: BATTLE_FILTER, ...d.data() }));
  } else {
    const snap = await db.collectionGroup('shadowDiffs').limit(LIMIT * 3).get();
    diffs = snap.docs.map((d) => ({ id: d.id, battleId: d.ref.parent.parent.id, ...d.data() }));
  }

  const divergent = diffs.filter((d) => d.identical === false && d.texts).slice(0, LIMIT);
  console.log(`[paired-eval] ${diffs.length} diffs read, ${divergent.length} divergent-with-texts selected (limit ${LIMIT})`);
  if (divergent.length === 0) {
    console.log('[paired-eval] nothing to replay — accumulate divergent diffs first (SHADOW_ASSEMBLY_ENABLED preview smoke).');
    return;
  }

  const anthropic = DRY_RUN ? null : new Anthropic({ maxRetries: 0 });
  const rows = [];

  for (const diff of divergent) {
    const renderedRuleIds = [];
    const base = {
      battleId: diff.battleId,
      tickId: diff.envelope?.tickId ?? diff.id,
      manifestId: diff.envelope?.manifestId ?? null,
      inputSizes: diff.sizes ?? null,
      hunkCounts: {
        system: (diff.systemHunks ?? []).length,
        identity: (diff.identityHunks ?? []).length,
        context: (diff.contextHunks ?? []).length,
      },
    };
    if (DRY_RUN) {
      rows.push({ ...base, dryRun: true });
      console.log(`[paired-eval] DRY ${base.tickId}: sizes=${JSON.stringify(base.inputSizes)} hunks=${JSON.stringify(base.hunkCounts)}`);
      continue;
    }

    const live = await replay(anthropic, {
      system: diff.texts.liveSystem, identity: diff.texts.liveIdentity, context: diff.texts.liveContext,
    });
    const candidate = await replay(anthropic, {
      system: diff.texts.shadowSystem, identity: diff.texts.shadowIdentity, context: diff.texts.shadowContext,
    });

    const row = {
      ...base,
      live: { ...live, citation: summarizeCitation(live, renderedRuleIds) },
      candidate: { ...candidate, citation: summarizeCitation(candidate, renderedRuleIds) },
      actionDivergence: {
        decision: live.decision !== candidate.decision,
        symbols: live.symbolOut !== candidate.symbolOut || live.symbolIn !== candidate.symbolIn,
      },
      refusalCompliance: { liveRefused: live.refused, candidateRefused: candidate.refused },
    };
    rows.push(row);
    console.log(`[paired-eval] ${base.tickId}: live=${live.decision ?? 'REFUSED'} candidate=${candidate.decision ?? 'REFUSED'} ` +
      `divergent=${row.actionDivergence.decision || row.actionDivergence.symbols} ` +
      `latency=${live.latencyMs}/${candidate.latencyMs}ms trunc=${live.truncated}/${candidate.truncated}`);
  }

  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  if (!DRY_RUN && rows.length > 0) {
    const divergedActions = rows.filter((r) => r.actionDivergence.decision || r.actionDivergence.symbols).length;
    const refusals = rows.filter((r) => r.refusalCompliance.liveRefused || r.refusalCompliance.candidateRefused).length;
    const truncations = rows.filter((r) => r.live.truncated || r.candidate.truncated).length;
    console.log(`\n[paired-eval] SUMMARY: pairs=${rows.length} actionDivergence=${divergedActions} refusals=${refusals} truncations=${truncations}`);
  }
  console.log(`[paired-eval] report → ${OUT}`);
}

main().catch((err) => {
  console.error('[paired-eval] FAILED:', err);
  process.exit(1);
});
