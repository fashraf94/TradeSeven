#!/usr/bin/env node
// scripts/sharedResearch/probe.mjs
//
// Shared Research B1 — THE ONE RECORDED PROBE (build prompt K-3, SQ-1; spec §15
// S-6). One live step turn on `claude-sonnet-5-5`: the real system prompt, the
// step schema, and as the user turn the data-center fixture
// (api/_utils/sharedResearch/__fixtures__/records.js, step 1) with three
// authored retrieval items. The answer is written to
// test/fixtures/sharedResearch/step.recorded.json with its usage and costUsd;
// stepSchema.recorded.test.js runs the validator on it.
//
// The key: CLAUDE_API_KEY, loaded into THIS process only —
//   node --env-file=<parent checkout>/.env.local scripts/sharedResearch/probe.mjs
// It is never printed, logged or written. One call: the script refuses to run
// when the fixture already exists (pass --force to replace it on purpose).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTurn, MODELS } from '../../api/_utils/sharedResearch/modelTurn.js';
import { buildStepSystemPrompt, renderStepUser } from '../../api/_utils/sharedResearch/stepPrompt.js';
import { STEP_SCHEMA, validateStepTurn } from '../../api/_utils/sharedResearch/stepSchema.js';
import { currentFindingsOf } from '../../api/_utils/researchRecords/model.js';
import { dataCenterRecord } from '../../api/_utils/sharedResearch/__fixtures__/records.js';
import { PROBE_ITEMS, PROBE_NEXT_ACTION, PROBE_READ_AT } from '../../api/_utils/sharedResearch/__fixtures__/probe.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../../test/fixtures/sharedResearch/step.recorded.json');

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`probe: ${OUT} exists — one call only; pass --force to replace it on purpose.`);
  process.exit(2);
}
if (!process.env.CLAUDE_API_KEY) {
  console.error('probe: CLAUDE_API_KEY is not set in this process (load it with --env-file); nothing was called.');
  process.exit(2);
}

const record = dataCenterRecord('step1');
const system = buildStepSystemPrompt({});
const user = renderStepUser({
  question: record.question, entryKind: 'observation', intent: 'next', nextAction: PROBE_NEXT_ACTION, summary: null, stepsLeft: 8,
  findings: currentFindingsOf(record), items: PROBE_ITEMS, retrieval: 'items', firstStep: false,
});

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 60_000);
const turn = await runTurn({ kind: 'step', system, user, schema: STEP_SCHEMA, signal: controller.signal });
clearTimeout(timer);

const recorded = {
  recordedAt: new Date().toISOString(),
  model: turn.model, modelIds: MODELS,
  ok: turn.ok, reason: turn.reason ?? null, stopReason: turn.stopReason, category: turn.category ?? null,
  attempts: turn.attempts, elapsedMs: turn.elapsedMs, usage: turn.usage, costUsd: turn.costUsd,
  readAt: PROBE_READ_AT,
  output: turn.output ?? null,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(recorded, null, 2)}\n`);

let validation = null;
if (turn.ok) {
  let n = 0;
  const v = validateStepTurn(turn.output, {
    record, items: PROBE_ITEMS, readAt: PROBE_READ_AT, partnerExchangeId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    partnerAt: '2026-11-12T15:00:05.000Z', nowIso: '2026-11-12T15:00:05.000Z', mintFindingId: () => `f_50000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  });
  validation = v.ok ? { ok: true, findings: v.findings.length, notes: v.notes } : { ok: false, rule: v.rule, detail: v.detail };
}
console.log(JSON.stringify({ model: recorded.model, ok: recorded.ok, reason: recorded.reason, stopReason: recorded.stopReason, attempts: recorded.attempts, elapsedMs: recorded.elapsedMs, usage: recorded.usage, costUsd: recorded.costUsd, validation }, null, 2));
