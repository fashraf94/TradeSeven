// api/_utils/compositionRunbookGates.js
//
// Composition PR 4 — the RUNBOOK-CHECKABLE gates (ledger items B9, B8-FINAL).
// Pure validation logic, imported by the CLI instruments under
// scripts/composition/ and unit-tested directly — the runbook never trusts an
// operator's memory where a predicate can check an artifact.
//
//   B9  — validateRulesDeployRecord: the §8 flip checklist item for
//         COMPOSITION_EPOCH_FENCE_ENABLED fails unless the deploy record
//         names the deployed firestore.rules SHA + timestamp + operator AND a
//         GREEN compositionEpochDenials emulator smoke recorded against that
//         same text (smoke.rulesTextSha256 === deployedRulesSha — the suite
//         reads COMPOSITION_RULES_TEXT_PATH, so the smoke provably ran the
//         DEPLOYED text, not the repo text).
//   B8-FINAL — validatePreflightReport: the census+scan re-run harness
//         (preflight-at-sha.js) is pinned to a SHA argument; its report is
//         valid only when the recorded SHA matches the SHA the runbook step
//         declares AND every suite it ran is green.

/** @returns {{ok: boolean, failures: string[]}} */
export function validateRulesDeployRecord(record, { repoRulesSha256 = null } = {}) {
  const failures = [];
  if (!record || typeof record !== 'object') return { ok: false, failures: ['no record'] };
  if (record.status !== 'filled') failures.push(`status must be 'filled' (found ${JSON.stringify(record.status)}) — the committed template is UNFILLED by design`);
  for (const f of ['deployedRulesSha', 'deployedAt', 'operator']) {
    if (typeof record[f] !== 'string' || record[f].length === 0) failures.push(`deploy record field missing: ${f}`);
  }
  const smoke = record.smoke;
  if (!smoke || typeof smoke !== 'object') {
    failures.push('smoke record missing');
  } else {
    if (smoke.suite !== 'compositionEpochDenials') failures.push(`smoke.suite must be 'compositionEpochDenials' (found ${JSON.stringify(smoke.suite)})`);
    if (smoke.result !== 'green') failures.push(`smoke.result must be 'green' (found ${JSON.stringify(smoke.result)})`);
    if (typeof smoke.ranAt !== 'string' || !smoke.ranAt) failures.push('smoke.ranAt missing');
    if (typeof smoke.rulesTextSha256 !== 'string' || !smoke.rulesTextSha256) failures.push('smoke.rulesTextSha256 missing');
    if (smoke.rulesTextSha256 && record.deployedRulesSha && smoke.rulesTextSha256 !== record.deployedRulesSha) {
      failures.push(`smoke ran DIFFERENT text than the recorded deploy (smoke ${smoke.rulesTextSha256} ≠ deployed ${record.deployedRulesSha}) — re-fetch the deployed text and re-run`);
    }
    // Informational, never a pass condition: matching the repo text is NOT
    // the gate (the deployed text is) — but a mismatch is worth surfacing.
    if (repoRulesSha256 && smoke.rulesTextSha256 && smoke.rulesTextSha256 !== repoRulesSha256) {
      failures.push(`NOTE (non-blocking if intended): deployed text differs from the repo's firestore.rules (${repoRulesSha256}) — confirm the deploy is the version the runbook expects`);
    }
  }
  const blocking = failures.filter((f) => !f.startsWith('NOTE'));
  return { ok: blocking.length === 0, failures };
}

/**
 * R6 — did the suite actually execute? `did-not-run` is what the harness
 * records today; `exit null` is the legacy string it wrote when spawnSync
 * returned a null status (the child never started). A missing/blank result is
 * equally inconclusive. None of these are test failures.
 * @returns {boolean}
 */
export function isNeverExecuted(result) {
  if (result === undefined || result === null) return true;
  const r = String(result).trim().toLowerCase();
  return r === '' || r === 'did-not-run' || r === 'exit null' || r === 'null';
}

/** @returns {{ok: boolean, failures: string[]}} */
export function validatePreflightReport(report, { expectedSha } = {}) {
  const failures = [];
  if (!report || typeof report !== 'object') return { ok: false, failures: ['no report'] };
  if (typeof report.sha !== 'string' || report.sha.length < 7) failures.push('report.sha missing');
  if (expectedSha && report.sha !== expectedSha) failures.push(`report SHA ${report.sha} ≠ the declared deploy SHA ${expectedSha} — re-run the harness at the deployed SHA`);
  if (typeof report.ranAt !== 'string' || !report.ranAt) failures.push('report.ranAt missing');
  if (report.treeClean !== true) failures.push('the harness must run on a CLEAN tree (report.treeClean !== true) — uncommitted edits make the SHA claim meaningless');
  const suites = report.suites;
  if (!Array.isArray(suites) || suites.length === 0) {
    failures.push('report.suites missing');
  } else {
    for (const s of suites) {
      if (s.result === 'green') continue;
      // R6 (closed 2026-08-15) — "did this actually run" is a DISTINCT
      // rejection from "this ran and failed". A gate artifact must never be
      // ambiguous about whether it executed: a suite that never started
      // proves nothing about the SHA in either direction, whereas a suite
      // that ran and failed is a finding. Collapsing them into one "NOT
      // green" message is what let a five-suite ENOENT (spawnSync returning
      // status null, recorded as the string "exit null") read as five failing
      // suites at the deployed SHA. Both the current `did-not-run` form and
      // the legacy `exit null` form are treated as never-executed, so old
      // artifacts on disk are classified correctly too.
      if (isNeverExecuted(s.result)) {
        failures.push(`suite NEVER EXECUTED at the pinned SHA: ${s.name} (${s.result}${s.spawnError ? `: ${s.spawnError}` : ''}) — this is NOT a test failure and NOT evidence about the SHA; the harness did not start the child process. Fix the runner and re-run.`);
      } else {
        failures.push(`suite RAN AND FAILED at the pinned SHA: ${s.name} (${s.result})`);
      }
    }
    for (const required of ['compositionWriterCensus', 'compositionProtectedStores.scan']) {
      if (!suites.some((s) => String(s.name).includes(required))) failures.push(`required suite missing from the report: ${required}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
