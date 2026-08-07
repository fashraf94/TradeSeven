// api/_utils/compositionRunbookGates.test.js
//
// Composition PR 4 — B9 + B8-FINAL gate logic. The acceptance rows: the flip
// checklist FAILS without a deploy record naming the deployed rules SHA + a
// green smoke AT THAT TEXT; the committed template fails BY DESIGN; the
// preflight report is valid only at the pinned SHA on a clean tree with every
// suite green.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateRulesDeployRecord, validatePreflightReport } from './compositionRunbookGates.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = JSON.parse(readFileSync(resolve(HERE, '../../docs/composition/RULES_DEPLOY_RECORD.json'), 'utf8'));

const FILLED = {
  status: 'filled',
  deployedRulesSha: 'abc123',
  deployedAt: '2026-08-10T14:00:00Z',
  operator: 'founder',
  smoke: { suite: 'compositionEpochDenials', result: 'green', ranAt: '2026-08-10T14:05:00Z', rulesTextSha256: 'abc123' },
};

describe('B9 — the rules deploy-record gate', () => {
  it('the COMMITTED template is unfilled and FAILS the gate by design', () => {
    const { ok, failures } = validateRulesDeployRecord(TEMPLATE);
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
