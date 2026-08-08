#!/usr/bin/env node
// scripts/composition/check-rules-deploy-gate.js
//
// Composition PR 4 — B9: the §8 runbook's fence-flip gate. Validates
// docs/composition/RULES_DEPLOY_RECORD.json (see its _howToFill) and exits
// non-zero unless the record proves a deployed-rules SHA + operator +
// timestamp AND a green compositionEpochDenials smoke recorded against that
// SAME text. Run BEFORE flipping COMPOSITION_EPOCH_FENCE_ENABLED.
//
//   node scripts/composition/check-rules-deploy-gate.js

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateRulesDeployRecord } from '../../api/_utils/compositionRunbookGates.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const record = JSON.parse(readFileSync(resolve(REPO, 'docs/composition/RULES_DEPLOY_RECORD.json'), 'utf8'));
const repoRulesSha256 = createHash('sha256').update(readFileSync(resolve(REPO, 'firestore.rules'))).digest('hex');

const { ok, failures } = validateRulesDeployRecord(record, { repoRulesSha256 });
for (const f of failures) console.log(`${f.startsWith('NOTE') ? '⚠' : '✗'} ${f}`);
if (!ok) {
  console.error('\nB9 GATE: FAIL — do NOT flip COMPOSITION_EPOCH_FENCE_ENABLED.');
  process.exit(1);
}
console.log('B9 GATE: PASS — deploy record + green smoke at the deployed rules text.');
