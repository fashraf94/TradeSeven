// api/_utils/compositionRunbookGates.test.js
//
// Composition PR 4 — B9 + B8-FINAL gate logic. The acceptance rows: the flip
// checklist FAILS without a deploy record naming the deployed rules SHA + a
// green smoke AT THAT TEXT; an unfilled record fails BY DESIGN; the
// preflight report is valid only at the pinned SHA on a clean tree with every
// suite green.
//
// NOTE on the unfilled case: it asserts against the PRISTINE FIXTURE, never
// against docs/composition/RULES_DEPLOY_RECORD.json. That live file is filled
// IN PLACE and committed at runbook step −1 (ACTIVATION_RUNBOOK.md:44) and
// re-verified at step 4 (:69) — it must be committed, since B8-FINAL requires
// a CLEAN tree at the activation SHA. So its unfilled-ness is a fact about the
// pre-run repo, not an invariant of this validator. The anti-fabrication guard
// is smoke.rulesTextSha256 === deployedRulesSha over the FETCHED deployed text
// (compositionRunbookGates.js:36-38) — not the unfilled-template check.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateRulesDeployRecord, validatePreflightReport } from './compositionRunbookGates.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const UNFILLED = JSON.parse(readFileSync(resolve(HERE, '__fixtures__/rulesDeployRecord.unfilled.json'), 'utf8'));

const FILLED = {
  status: 'filled',
  deployedRulesSha: 'abc123',
  deployedAt: '2026-08-10T14:00:00Z',
  operator: 'founder',
  smoke: { suite: 'compositionEpochDenials', result: 'green', ranAt: '2026-08-10T14:05:00Z', rulesTextSha256: 'abc123' },
};

describe('B9 — the rules deploy-record gate', () => {
  it('an UNFILLED record (the pristine template) FAILS the gate by design', () => {
    const { ok, failures } = validateRulesDeployRecord(UNFILLED);
    expect(ok).toBe(false);
    expect(failures.some((f) => f.includes("status must be 'filled'"))).toBe(true);
  });

  it('a complete record with a green smoke at the SAME text PASSES', () => {
    expect(validateRulesDeployRecord(FILLED).ok).toBe(true);
  });

  it('a smoke recorded against DIFFERENT text than the deploy FAILS (the deployed-text-not-repo-text requirement)', () => {
    const r = validateRulesDeployRecord({ ...FILLED, smoke: { ...FILLED.smoke, rulesTextSha256: 'zzz999' } });
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes('DIFFERENT text'))).toBe(true);
  });

  it('a red smoke, a missing operator, or a missing SHA each FAIL', () => {
    expect(validateRulesDeployRecord({ ...FILLED, smoke: { ...FILLED.smoke, result: 'red' } }).ok).toBe(false);
    expect(validateRulesDeployRecord({ ...FILLED, operator: '' }).ok).toBe(false);
    expect(validateRulesDeployRecord({ ...FILLED, deployedRulesSha: '' }).ok).toBe(false);
  });

  it('deployed-text ≠ repo-text is a NOTE, never a blocker (the deployed text is the gate, the repo text is context)', () => {
    const r = validateRulesDeployRecord(FILLED, { repoRulesSha256: 'different-repo-hash' });
    expect(r.ok).toBe(true);
    expect(r.failures.some((f) => f.startsWith('NOTE'))).toBe(true);
  });
});

const GOOD_REPORT = {
  sha: 'deadbeef1234',
  treeClean: true,
  ranAt: '2026-08-10T13:00:00Z',
  suites: [
    { name: 'compositionWriterCensus', result: 'green' },
    { name: 'compositionProtectedStores.scan', result: 'green' },
    { name: 'composition battery', result: 'green' },
  ],
};

describe('B8-FINAL — the SHA-pinned preflight report gate', () => {
  it('a green report at the declared SHA passes', () => {
    expect(validatePreflightReport(GOOD_REPORT, { expectedSha: 'deadbeef1234' }).ok).toBe(true);
  });

  it('a report at the WRONG SHA fails (the pin is the point)', () => {
    const r = validatePreflightReport(GOOD_REPORT, { expectedSha: 'cafebabe5678' });
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.includes('≠ the declared deploy SHA'))).toBe(true);
  });

  it('a dirty tree, a red suite, or a missing required suite each fail', () => {
    expect(validatePreflightReport({ ...GOOD_REPORT, treeClean: false }, {}).ok).toBe(false);
    expect(validatePreflightReport({
      ...GOOD_REPORT,
      suites: [{ name: 'compositionWriterCensus', result: 'exit 1' }, { name: 'compositionProtectedStores.scan', result: 'green' }],
    }, {}).ok).toBe(false);
    expect(validatePreflightReport({
      ...GOOD_REPORT,
      suites: [{ name: 'compositionWriterCensus', result: 'green' }],
    }, {}).ok).toBe(false);
  });
});

describe("Sol's guard (final pre-activation fold) — NO raw composition/writeEpoch state mutation outside transitionWriteEpoch", () => {
  // The ABA has now appeared four times in this build; the incarnation
  // counter only holds if EVERY state transition routes through the helper
  // that computes it. Two halves: executable code and runbook code blocks.
  const { readdirSync } = require('node:fs');
  const REPO = resolve(HERE, '../..');
  const walk = (rel, out = []) => {
    for (const e of readdirSync(resolve(REPO, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__fixtures__' && p !== 'scripts/composition/out') walk(p, out); }
      else if (/\.(js|mjs)$/.test(e.name) && !e.name.includes('.test.')) out.push(p);
    }
    return out;
  };
  const WRITE_ON_EPOCH_REF = [
    /(?:tx|txn|transaction|batch)\s*\.\s*(?:set|update|create|delete)\s*\(\s*writeEpochRef\s*\(/,
    /writeEpochRef\s*\([^)]*\)\s*\.\s*(?:set|update|create|delete)\s*\(/,
    /doc\(\s*['"]writeEpoch['"]\s*\)\s*\.\s*(?:set|update|create|delete)\s*\(/,
    /doc\(\s*WRITE_EPOCH_DOC_ID\s*\)\s*\.\s*(?:set|update|create|delete)\s*\(/,
  ];

  it('EXECUTABLE CODE: the only epoch-doc write site in api/ + scripts/ lives INSIDE transitionWriteEpoch', () => {
    const offenders = [];
    for (const f of [...walk('api'), ...walk('scripts')]) {
      const src = readFileSync(resolve(REPO, f), 'utf8');
      if (!WRITE_ON_EPOCH_REF.some((re) => re.test(src))) continue;
      if (f !== 'api/_utils/compositionWriteEpoch.js') { offenders.push(f); continue; }
      // Inside the module, the write must sit within transitionWriteEpoch's body.
      const fnStart = src.indexOf('export async function transitionWriteEpoch');
      const fnEnd = src.indexOf('\nexport ', fnStart + 1);
      const body = src.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
      const outside = src.slice(0, fnStart) + src.slice(fnEnd === -1 ? src.length : fnEnd);
      expect(fnStart, 'transitionWriteEpoch missing from compositionWriteEpoch.js').toBeGreaterThan(-1);
      expect(WRITE_ON_EPOCH_REF.some((re) => re.test(body)), 'the helper itself must contain the one write').toBe(true);
      if (WRITE_ON_EPOCH_REF.some((re) => re.test(outside))) offenders.push(`${f} (outside transitionWriteEpoch)`);
    }
    expect(offenders, 'raw composition/writeEpoch state mutation outside transitionWriteEpoch — the incarnation counter only holds through the helper').toEqual([]);
  });

  it('RUNBOOK CODE BLOCKS: every epoch-state mutation instruction routes through transitionWriteEpoch (no raw {state:...} write survives)', () => {
    const runbook = readFileSync(resolve(REPO, 'docs/composition/ACTIVATION_RUNBOOK.md'), 'utf8');
    const offending = runbook.split('\n').filter((line) =>
      /\{\s*state\s*:/.test(line) && !line.includes('transitionWriteEpoch'));
    expect(offending, 'runbook line instructs a raw epoch-state mutation (or displays a state shape) without transitionWriteEpoch on the line').toEqual([]);
    // The helper is genuinely present throughout (non-vacuity):
    expect((runbook.match(/transitionWriteEpoch\(/g) || []).length).toBeGreaterThanOrEqual(9);
  });
});
