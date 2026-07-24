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
// ── DR-13 mode (--dr13) ─────────────────────────────────────────────────
// The identity-block pre-flip validation (DR-13 arc, founder Flag F ruling
// 2026-07-24). Instead of live-vs-manifest, it pairs the SAME eval input
// under two system prompts: flag-off (production today) and flag-on (the
// identity block spliced via spliceEvalIdentityBlock — test-locked to the
// real fenced flag-on output, so candidate prompts cannot drift from
// production assembly). Emits per pair: sizes, the char/token delta, and
// proof the diff is EXACTLY the identity block; with an API key it also
// replays paired Haiku decisions (temperature 0) for decision-drift review.
//
// Input sources, per the ruling — real corpus preferred, synthetic floor:
//   default      the shadowDiffs corpus (LIVE-side texts are the base; the
//                archetype code-id is read from the parent battle doc),
//                capped at --n inputs per archetype
//   --synthetic  no Firestore: the six-archetype fixture battle × both
//                prompt variants (12 pairs). One replay per pair when live —
//                the N≥10-distinct-inputs leg needs the real corpus, since
//                repeating one fixture at temperature 0 adds nothing.
//
// Usage:
//   node scripts/paired-eval-harness.js [--battle <battleId>] [--limit 10]
//        [--model claude-haiku-4-5-20251001] [--dry-run] [--out report.jsonl]
//   node scripts/paired-eval-harness.js --dr13 [--synthetic] [--n 10]
//        [--battle <battleId>] [--dry-run] [--out report.jsonl]
//
//   --dry-run  assembles + measures inputs only (no API calls, no key needed)
//
// Import surface: the manifest mode touches firebaseAdmin +
// agentEvalToolSchema only; --dr13 additionally loads the eval assembly
// graph (agentEvalPromptAssembly + evalIdentityBlocks + the controls
// fixture) — all Node-clean with no extensionless imports, so plain `node`
// still runs this (unlike the registry graph; see archetypeRegistry.test.js
// header). Firestore is only dialed when a mode actually reads it.

import { writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { TRADE_DECISION_TOOL } from '../api/_utils/agentEvalToolSchema.js';
import {
  buildEvalSystemPrompt,
  buildAgentIdentityBlock,
  buildLiveContextBlock,
} from '../api/_utils/agentEvalPromptAssembly.js';
import {
  EVAL_IDENTITY_BLOCKS,
  renderEvalIdentityBlockForced,
  spliceEvalIdentityBlock,
} from '../api/_utils/evalIdentityBlocks.js';
import { makeEvalBattle, buildEvalWith } from '../api/_utils/__fixtures__/controlsPromptFixtures.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../src/constants/agentGameModes.js';

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
const DR13 = has('dr13');
const SYNTHETIC = has('synthetic');
const PER_ARCHETYPE = Number(flag('n', '10')); // dr13 corpus mode: inputs per archetype
const OUT = flag('out', `${DR13 ? 'dr13-' : ''}paired-eval-report-${Date.now()}.jsonl`);

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

// ==================== DR-13 MODE ====================

// The cron's display transform (agent-evaluate.js) — mirrored byte-exact so
// synthetic prompts carry the same label production interpolates.
const displayLabel = (key) =>
  (key || 'unknown').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const IDENTITY_BANNER = '━━━ ARCHETYPE IDENTITY ━━━';

/**
 * Build one DR-13 report row from a base (flag-off-shaped) system prompt +
 * the shared identity/context parts. Handles a post-flip run honestly: if
 * the base already carries the block (flag lit in this checkout), the ON
 * form is the base itself and the OFF form is recovered by excising the
 * block's exact bytes.
 *
 * The exactness proof is byte-level: nothing removed, and excising the
 * block's bytes from the ON prompt reproduces the OFF prompt — i.e. the
 * diff is the identity block and only the identity block.
 */
function buildDr13Row({ source, archetypeKey, variant, systemBase, identity, context }) {
  const block = renderEvalIdentityBlockForced(archetypeKey); // '' + warn on unknown keys
  const flagAlreadyOn = systemBase.includes(IDENTITY_BANNER);
  const systemOff = flagAlreadyOn && block ? systemBase.replace(block, '') : systemBase;
  const systemOn = flagAlreadyOn ? systemBase : spliceEvalIdentityBlock(systemBase, archetypeKey);

  const deltaChars = systemOn.length - systemOff.length;
  return {
    row: {
      mode: 'dr13',
      source,
      archetype: archetypeKey ?? null,
      variant,
      flagAlreadyOn,
      identityOmitted: block === '',
      sizes: {
        systemOff: systemOff.length,
        systemOn: systemOn.length,
        identity: identity.length,
        context: context.length,
      },
      deltaChars,
      deltaTokensEst: Math.round(deltaChars / 4), // chars/4 approximation; the
      // replay leg reports real per-side input_tokens when it runs
      blockChars: block.length,
      diffIsExactlyIdentityBlock:
        block !== '' && deltaChars === block.length && systemOn.replace(block, '') === systemOff,
    },
    systemOff,
    systemOn,
  };
}

async function replayDr13Pair(anthropic, { systemOff, systemOn, identity, context }) {
  const off = await replay(anthropic, { system: systemOff, identity, context });
  const on = await replay(anthropic, { system: systemOn, identity, context });
  return {
    off, on,
    tokenDelta: off.inputTokens != null && on.inputTokens != null ? on.inputTokens - off.inputTokens : null,
    actionDivergence: {
      decision: off.decision !== on.decision,
      symbols: off.symbolOut !== on.symbolOut || off.symbolIn !== on.symbolIn,
    },
    refusalCompliance: { offRefused: off.refused, onRefused: on.refused },
  };
}

// Synthetic floor (Flag F ruling): the six-archetype fixture battle × both
// prompt variants — 12 pairs, no Firestore. Firestore is never dialed here.
async function runDr13Synthetic(anthropic, rows) {
  const buildContext = buildEvalWith(buildLiveContextBlock);
  const variants = [
    ['tiered', TIERED_GAME_MODE],
    ['flat6', FLAT6_GAME_MODE],
  ];
  for (const archetypeKey of Object.keys(EVAL_IDENTITY_BLOCKS)) {
    for (const [variant, gameMode] of variants) {
      const battle = makeEvalBattle({ archetype: archetypeKey });
      battle.gameMode = gameMode;
      const systemBase = buildEvalSystemPrompt(
        battle.agentContext.agentName, displayLabel(archetypeKey), gameMode, archetypeKey
      );
      const identity = buildAgentIdentityBlock(battle);
      const context = await buildContext(battle);

      const { row, systemOff, systemOn } = buildDr13Row({
        source: 'synthetic', archetypeKey, variant, systemBase, identity, context,
      });
      if (!DRY_RUN) {
        row.replay = await replayDr13Pair(anthropic, { systemOff, systemOn, identity, context });
      }
      rows.push(row);
      console.log(`[paired-eval] DR13 ${archetypeKey}/${variant}: Δ${row.deltaChars} chars (~${row.deltaTokensEst} tok) ` +
        `exactBlockDiff=${row.diffIsExactlyIdentityBlock}` +
        (row.replay ? ` off=${row.replay.off.decision ?? 'REFUSED'} on=${row.replay.on.decision ?? 'REFUSED'} divergent=${row.replay.actionDivergence.decision || row.replay.actionDivergence.symbols}` : ''));
    }
  }
}

// Real-corpus mode (preferred when #671's flip has accumulated shadowDiffs):
// the LIVE-side captured texts are the base input; the archetype code-id
// comes from the parent battle doc (agentContext.archetype — the raw key,
// the same field the cron threads as the 4th arg).
async function runDr13Corpus(anthropic, rows) {
  const db = getFirebaseAdmin();
  let diffs = [];
  if (BATTLE_FILTER) {
    const snap = await db.collection('agentBattles').doc(BATTLE_FILTER)
      .collection('shadowDiffs').orderBy('envelope.evaluatedAt', 'desc').limit(PER_ARCHETYPE * 12).get();
    diffs = snap.docs.map((d) => ({ id: d.id, battleId: BATTLE_FILTER, ...d.data() }));
  } else {
    const snap = await db.collectionGroup('shadowDiffs').limit(PER_ARCHETYPE * 12).get();
    diffs = snap.docs.map((d) => ({ id: d.id, battleId: d.ref.parent.parent.id, ...d.data() }));
  }
  const withTexts = diffs.filter((d) => d.texts?.liveSystem && d.texts?.liveIdentity && d.texts?.liveContext);
  console.log(`[paired-eval] DR13 corpus: ${diffs.length} diffs read, ${withTexts.length} carry replayable texts ` +
    '(identical ticks are hash-only by design — payload discipline)');
  if (withTexts.length === 0) {
    console.log('[paired-eval] DR13: no replayable corpus — run with --synthetic, or let the #671 flip accumulate divergent diffs.');
    return;
  }

  const battleKeyCache = new Map();
  const perArchetypeCount = new Map();
  for (const diff of withTexts) {
    if (!battleKeyCache.has(diff.battleId)) {
      const doc = await db.collection('agentBattles').doc(diff.battleId).get();
      battleKeyCache.set(diff.battleId, doc.exists ? (doc.data().agentContext?.archetype ?? null) : null);
    }
    const archetypeKey = battleKeyCache.get(diff.battleId);
    const seen = perArchetypeCount.get(archetypeKey) ?? 0;
    if (seen >= PER_ARCHETYPE) continue;
    perArchetypeCount.set(archetypeKey, seen + 1);

    const { row, systemOff, systemOn } = buildDr13Row({
      source: { battleId: diff.battleId, tickId: diff.envelope?.tickId ?? diff.id },
      archetypeKey,
      variant: null, // the captured prompt already embeds the battle's real variant
      systemBase: diff.texts.liveSystem,
      identity: diff.texts.liveIdentity,
      context: diff.texts.liveContext,
    });
    if (!DRY_RUN) {
      row.replay = await replayDr13Pair(anthropic, {
        systemOff, systemOn, identity: diff.texts.liveIdentity, context: diff.texts.liveContext,
      });
    }
    rows.push(row);
    console.log(`[paired-eval] DR13 ${archetypeKey ?? 'UNKNOWN-KEY'} @ ${row.source.tickId}: Δ${row.deltaChars} chars ` +
      `exactBlockDiff=${row.diffIsExactlyIdentityBlock}` +
      (row.replay ? ` off=${row.replay.off.decision ?? 'REFUSED'} on=${row.replay.on.decision ?? 'REFUSED'}` : ''));
  }
}

async function runDr13() {
  const anthropic = DRY_RUN ? null : new Anthropic({ maxRetries: 0 });
  const rows = [];
  if (SYNTHETIC) {
    await runDr13Synthetic(anthropic, rows);
  } else {
    await runDr13Corpus(anthropic, rows);
  }
  if (rows.length === 0) return;

  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

  const exact = rows.filter((r) => r.diffIsExactlyIdentityBlock).length;
  const omitted = rows.filter((r) => r.identityOmitted).length;
  const archetypes = new Set(rows.map((r) => r.archetype).filter(Boolean));
  const meanDelta = Math.round(rows.reduce((s, r) => s + r.deltaTokensEst, 0) / rows.length);
  let replayLine = '';
  if (!DRY_RUN) {
    const replayed = rows.filter((r) => r.replay);
    const diverged = replayed.filter((r) => r.replay.actionDivergence.decision || r.replay.actionDivergence.symbols).length;
    const refusals = replayed.filter((r) => r.replay.refusalCompliance.offRefused || r.replay.refusalCompliance.onRefused).length;
    const truncations = replayed.filter((r) => r.replay.off.truncated || r.replay.on.truncated).length;
    replayLine = ` replayedPairs=${replayed.length} actionDivergence=${diverged} refusals=${refusals} truncations=${truncations}`;
  }
  console.log(`\n[paired-eval] DR13 SUMMARY: pairs=${rows.length} archetypesCovered=${archetypes.size}/6 ` +
    `exactBlockDiff=${exact}/${rows.length} identityOmitted=${omitted} meanDelta≈${meanDelta} tok${replayLine}`);
  console.log(`[paired-eval] report → ${OUT}`);
}

async function main() {
  if (DR13) {
    await runDr13();
    return;
  }
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
    // Per-side rendered rule ids recorded on the diff doc by the P2.6
    // assembly (review finding: this drives the citation measure — a cited
    // rule outside the rendered set is the non-compliance signal).
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
      live: { ...live, citation: summarizeCitation(live, diff.renderedRuleIds?.live ?? []) },
      candidate: { ...candidate, citation: summarizeCitation(candidate, diff.renderedRuleIds?.shadow ?? []) },
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
