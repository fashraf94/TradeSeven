#!/usr/bin/env node
// scripts/sharedResearch/probeBuilder.mjs
//
// Shared Research B3 — THE TWO RECORDED PROBES (build prompt K-8, SQ-1). Two live
// thesis builder turns on `claude-sonnet-5-5`: one `map_segments`, one
// `build_why`, each against an authored fixture
// (api/_utils/sharedResearch/__fixtures__/probeBuilder.js), with the real builder
// system prompt (Atlas, the baseline method), the real user turn and the builder
// schema. Each answer is written to test/fixtures/sharedResearch/build.<goal>.recorded.json
// with its usage and costUsd; thesisSchema.recorded.test.js validates them.
//
// The key: CLAUDE_API_KEY, loaded into THIS process only —
//   node --env-file=<parent checkout>/.env.local scripts/sharedResearch/probeBuilder.mjs
// It is never printed, logged or written. Two calls: the script refuses to run
// when either fixture already exists (pass --force to replace them on purpose).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTurn, MODELS } from '../../api/_utils/sharedResearch/modelTurn.js';
import { buildBuildSystemPrompt, renderBuildUser } from '../../api/_utils/sharedResearch/stepPrompt.js';
import { BUILD_SCHEMA, validateBuildTurn } from '../../api/_utils/sharedResearch/thesisSchema.js';
import { BASELINE } from '../../api/_utils/sharedResearch/method.js';
import { currentFindingsOf } from '../../api/_utils/researchRecords/model.js';
import { mapProbe, whyProbe, PROBE_B_READ_AT, PROBE_B_NOW, PROBE_B_EXCHANGE_ID, PROBE_B_NAMES } from '../../api/_utils/sharedResearch/__fixtures__/probeBuilder.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const outOf = (goal) => resolve(HERE, `../../test/fixtures/sharedResearch/build.${goal}.recorded.json`);
const PROBES = [mapProbe(), whyProbe()];

if (PROBES.some((p) => existsSync(outOf(p.goal))) && !process.argv.includes('--force')) {
  console.error('probeBuilder: a recorded fixture exists — two calls only; pass --force to replace them on purpose.');
  process.exit(2);
}
if (!process.env.CLAUDE_API_KEY) {
  console.error('probeBuilder: CLAUDE_API_KEY is not set in this process (load it with --env-file); nothing was called.');
  process.exit(2);
}

const system = buildBuildSystemPrompt({ partnerName: 'Atlas', method: BASELINE });
const summary = [];
for (const p of PROBES) {
  const user = renderBuildUser({
    question: p.record.question, entryKind: p.entryKind, goal: p.goal, part: p.part, card: p.card, supported: p.supported,
    stepsLeft: 7, findings: currentFindingsOf(p.record), items: p.items, retrieval: 'items', room: 90,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  const turn = await runTurn({ kind: 'step', system, user, schema: BUILD_SCHEMA, signal: controller.signal });
  clearTimeout(timer);
  const recorded = {
    recordedAt: new Date().toISOString(), goal: p.goal,
    model: turn.model, modelIds: MODELS,
    ok: turn.ok, reason: turn.reason ?? null, stopReason: turn.stopReason, category: turn.category ?? null,
    attempts: turn.attempts, elapsedMs: turn.elapsedMs, usage: turn.usage, costUsd: turn.costUsd,
    readAt: PROBE_B_READ_AT,
    output: turn.output ?? null,
  };
  mkdirSync(dirname(outOf(p.goal)), { recursive: true });
  writeFileSync(outOf(p.goal), `${JSON.stringify(recorded, null, 2)}\n`);
  let validation = null;
  if (turn.ok) {
    let n = 0;
    const v = validateBuildTurn(turn.output, {
      record: p.record, items: p.items, readAt: PROBE_B_READ_AT, partnerExchangeId: PROBE_B_EXCHANGE_ID, partnerAt: PROBE_B_NOW, nowIso: PROBE_B_NOW,
      mintFindingId: () => `f_7b000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, names: PROBE_B_NAMES, partnerName: 'Atlas', method: BASELINE,
      card: p.card, goal: p.goal, part: p.part,
    });
    validation = v.ok ? { ok: true, findings: v.findings.length, notes: v.notes, landed: Object.entries(v.proposals).filter(([k, x]) => !['goal', 'part'].includes(k) && x).map(([k]) => k) } : { ok: false, rule: v.rule, detail: v.detail };
  }
  summary.push({ goal: p.goal, model: recorded.model, ok: recorded.ok, reason: recorded.reason, stopReason: recorded.stopReason, attempts: recorded.attempts, elapsedMs: recorded.elapsedMs, usage: recorded.usage, costUsd: recorded.costUsd, validation });
}
console.log(JSON.stringify(summary, null, 2));
