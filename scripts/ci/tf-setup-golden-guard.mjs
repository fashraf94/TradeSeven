#!/usr/bin/env node
// scripts/ci/tf-setup-golden-guard.mjs
//
// The Tests workflow's blocking golden-baseline step (.github/workflows/tests.yml).
// It wraps the cross-revision guard, scripts/experiments/tf-setup-golden-baseline-check.mjs,
// which stays the only authority on the versioning rules. This file decides WHICH commit
// the guard compares against, proves that commit can be compared, and makes CI fail closed.
//
// WHY. golden.test.js checks one revision against itself. A golden regenerated under an
// unchanged SEMANTICS_ID, with the baseline's entry rewritten to match, passes it. Only a
// comparison with an earlier revision rejects that, and before this step it ran by hand.
//
// BASE SELECTION. It is never the working tree and never a computed merge-base.
//   pull_request       the event's immutable target-base SHA (github.event.pull_request.base.sha).
//   workflow_dispatch  the required base_ref input, resolved to a commit SHA.
// The base must be a commit present in the checkout, must differ from the checked-out commit,
// and must be its ancestor, so it belongs to the tested history.
//
// FAIL CLOSED. The evaluator baseline is accepted (PR #1001, merged as 148a3fa1), so CI requires
// comparison mode. Before the guard runs, the base must carry readable, parseable versions of all
// three evaluator files. An absent file, an unavailable object, a failed read or an incomplete set
// is an actionable failure. A guard result in initial mode is a failure here as well; the
// standalone checker keeps its initial mode for first creation.
//
// INPUTS come only from environment variables the workflow sets (TF_GUARD_*), never from text
// interpolated into a shell program. git and the guard run with argument arrays.
//
// EXIT CODES: 0 pass; 1 the guard rejected the change; 2 the comparison could not be set up
// (event, base, history or files). Both nonzero codes fail the step.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATHS } from '../experiments/tf-setup-golden-baseline-check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..', '..');
export const GUARD_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'experiments', 'tf-setup-golden-baseline-check.mjs');

const SHA_RE = /^[0-9a-f]{40}$/;
/** A dispatch base_ref: a branch, tag, SHA or rev expression such as main~3. No leading '-', no spaces, colons or shell characters. */
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9._/@^~{}-]{0,199}$/;

export class SetupError extends Error {}
const fail = (message) => { throw new SetupError(message); };

/** A git runner bound to a directory: argument arrays only, never a shell. */
export function makeGit(cwd = PROJECT_ROOT) {
  return (args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { status: r.status, stdout: r.stdout ?? '', stderr: `${r.stderr ?? ''}${r.error ? r.error.message : ''}` };
  };
}

function resolveCommit(git, ref) {
  const r = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  const sha = r.stdout.trim();
  return r.status === 0 && SHA_RE.test(sha) ? sha : null;
}

/** The comparison base for this run, from the event alone, and proof that it belongs to the tested history. */
export function selectBase({ eventName, prBaseSha, prHeadSha, baseRef }, git) {
  const head = resolveCommit(git, 'HEAD');
  if (!head) fail('the checked-out revision (HEAD) does not resolve to a commit');
  let base;
  let source;
  if (eventName === 'pull_request') {
    if (!prBaseSha) fail('pull_request: the event carries no target-base SHA (github.event.pull_request.base.sha is empty)');
    if (!SHA_RE.test(prBaseSha)) fail(`pull_request: the target-base SHA ${JSON.stringify(prBaseSha)} is not a 40-hex commit id`);
    base = resolveCommit(git, prBaseSha);
    if (base !== prBaseSha) fail(`pull_request: the target-base commit ${prBaseSha} is not in this checkout; the history is incomplete (the checkout step needs fetch-depth: 0)`);
    source = 'the pull_request event\'s target-base SHA';
  } else if (eventName === 'workflow_dispatch') {
    if (!baseRef) fail('workflow_dispatch: the base_ref input is required: a branch, tag or SHA that is an earlier ancestor of the ref this run checks out');
    if (!REF_RE.test(baseRef)) fail(`workflow_dispatch: base_ref ${JSON.stringify(baseRef)} is not an acceptable ref (letters, digits and . _ / @ ^ ~ { } -, not starting with -)`);
    base = resolveCommit(git, baseRef);
    if (!base) fail(`workflow_dispatch: base_ref ${JSON.stringify(baseRef)} does not resolve to a commit in this checkout`);
    source = `the workflow_dispatch input base_ref ${JSON.stringify(baseRef)}`;
  } else {
    fail(`unsupported event ${JSON.stringify(eventName ?? '')}: this guard runs on pull_request and workflow_dispatch only`);
  }
  if (base === head) fail(`the comparison base ${base} is the checked-out commit itself; a self-comparison proves nothing`);
  const ancestor = git(['merge-base', '--is-ancestor', base, head]);
  if (ancestor.status === 1) {
    const mergeBase = git(['merge-base', base, head]);
    if (mergeBase.status !== 0 || !mergeBase.stdout.trim()) fail(`the comparison base ${base} shares no history with the checked-out commit ${head} (unrelated history)`);
    fail(`the comparison base ${base} is not an ancestor of the checked-out commit ${head}, so it is not part of the tested history`);
  }
  if (ancestor.status !== 0) fail(`could not establish whether ${base} is an ancestor of ${head} (git merge-base exited ${ancestor.status}): ${ancestor.stderr.trim()}`);
  return { base, head, source };
}

/**
 * Proof that the base carries the accepted baseline before the guard reads it. This
 * distinguishes a file that is absent from the base tree from an object that is in the tree
 * but cannot be read. The guard's own reader returns null for both.
 */
export function preflightBase(base, git) {
  const absent = [];
  const texts = {};
  for (const [key, rel] of Object.entries(PATHS)) {
    const listed = git(['ls-tree', '--full-tree', base, '--', rel]);
    if (listed.status !== 0) fail(`base ${base}: its tree could not be read (git ls-tree exited ${listed.status}); the history or objects are unavailable: ${listed.stderr.trim()}`);
    const entry = /^\d+ blob ([0-9a-f]{40})\t/.exec(listed.stdout);
    if (!entry) { absent.push(rel); continue; }
    if (git(['cat-file', '-e', entry[1]]).status !== 0) fail(`base ${base}: ${rel} is listed (blob ${entry[1]}) but its object is unavailable; the history is incomplete`);
    const shown = git(['show', `${base}:${rel}`]);
    if (shown.status !== 0) fail(`base ${base}: ${rel} could not be read (git show exited ${shown.status}): ${shown.stderr.trim()}`);
    texts[key] = shown.stdout;
  }
  const all = Object.values(PATHS);
  if (absent.length === all.length) fail(`base ${base} predates the accepted evaluator baseline: none of ${all.join(', ')} is present. CI requires comparison mode against a base that carries the accepted baseline; choose a later base`);
  if (absent.length) fail(`base ${base} is incomplete: ${absent.join(', ')} ${absent.length === 1 ? 'is' : 'are'} missing beside ${all.filter((p) => !absent.includes(p)).join(', ')}`);
  let baseline;
  try { baseline = JSON.parse(texts.baseline); } catch (err) { fail(`base ${base}: ${PATHS.baseline} is not valid JSON (${err.message})`); }
  if (!Array.isArray(baseline) || baseline.length === 0) fail(`base ${base}: ${PATHS.baseline} is not a non-empty baseline history`);
  let golden;
  try { golden = JSON.parse(texts.golden); } catch (err) { fail(`base ${base}: ${PATHS.golden} is not valid JSON (${err.message})`); }
  if (!golden || typeof golden !== 'object' || Array.isArray(golden)) fail(`base ${base}: ${PATHS.golden} is not a golden object`);
  for (const name of ['SETUP_VERSION', 'THRESHOLDS_HASH', 'SEMANTICS_ID']) {
    if (!new RegExp(`export const ${name}\\b`).test(texts.thresholds)) fail(`base ${base}: ${PATHS.thresholds} does not export ${name}`);
  }
  return { entries: baseline.length };
}

/** The guard's own verdict, required to be a comparison of exactly these two commits. */
export function interpretGuard({ status, stdout, stderr }, { base, head }) {
  if (status !== 0 && status !== 1) fail(`the guard could not run (exit ${status}): ${String(stderr || stdout).trim().split('\n').slice(-3).join(' / ')}`);
  let out;
  try { out = JSON.parse(stdout); } catch { fail(`the guard's output is not its JSON report (exit ${status}): ${String(stdout).trim().slice(0, 200)}`); }
  if (out.mode !== 'compare') fail(`the guard ran in ${JSON.stringify(out.mode)} mode; CI requires comparison mode against an accepted baseline (an initial-baseline run is a failure here)`);
  if (out.base?.sha !== base || out.head?.sha !== head) fail(`the guard compared ${out.base?.sha} → ${out.head?.sha}, not the selected ${base} → ${head}`);
  const ok = status === 0 && out.ok === true;
  return { code: ok ? 0 : 1, out };
}

const sideText = (s) => `${s.semanticsId}, golden ${String(s.goldenSha256).slice(0, 12)}…, thresholds ${s.setupVersion}/${s.thresholdsHash}, ${s.entries} entr${s.entries === 1 ? 'y' : 'ies'}`;
const annotate = (message) => `::error title=tf-setup golden guard::${String(message).replace(/\r?\n/g, ' ')}`;

export function main({ env = process.env, git = makeGit(), runGuard, log = console.log } = {}) {
  const input = {
    eventName: env.TF_GUARD_EVENT_NAME || '',
    prBaseSha: env.TF_GUARD_PR_BASE_SHA || '',
    prHeadSha: env.TF_GUARD_PR_HEAD_SHA || '',
    baseRef: env.TF_GUARD_BASE_REF || '',
  };
  const guard = runGuard ?? ((base) => spawnSync(process.execPath, [GUARD_SCRIPT, '--base', base, '--json'], { cwd: PROJECT_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  log('tf-setup golden guard (CI, comparison mode required)');
  log(`  event: ${input.eventName || '(none)'}`);
  log(`  event PR head: ${input.prHeadSha || 'n/a'}`);
  log(`  event target base: ${input.prBaseSha || 'n/a'}`);
  log(`  dispatch base_ref: ${input.baseRef ? JSON.stringify(input.baseRef) : 'n/a'}`);
  if (env.GITHUB_SHA) log(`  GITHUB_SHA: ${env.GITHUB_SHA}`);
  try {
    const { base, head, source } = selectBase(input, git);
    const parents = git(['rev-list', '--parents', '-n', '1', head]).stdout.trim().split(/\s+/).slice(1);
    log(`  checked-out commit (HEAD): ${head}${parents.length ? ` (parents ${parents.join(', ')})` : ''}`);
    log(`  comparison base: ${base} (${source}; an ancestor of HEAD)`);
    const { entries } = preflightBase(base, git);
    log(`  base preflight: all three evaluator files present, readable and parseable; baseline history of ${entries} entr${entries === 1 ? 'y' : 'ies'}`);
    const run = guard(base);
    const { code, out } = interpretGuard({ status: run.status, stdout: run.stdout, stderr: run.stderr }, { base, head });
    log(`  guard: mode ${out.mode}`);
    log(`    base ${base}: ${sideText(out.base)}`);
    log(`    head ${head}: ${sideText(out.head)}`);
    for (const n of out.notes || []) log(`  note: ${n}`);
    for (const f of out.failures || []) { log(`  FAIL: ${f}`); log(annotate(f)); }
    log(`  result: ${code === 0 ? 'PASS' : 'FAIL (the guard rejected the change)'}`);
    return code;
  } catch (err) {
    if (!(err instanceof SetupError)) throw err;
    log(`  STOP: ${err.message}`);
    log(annotate(err.message));
    log('  result: FAIL (the comparison could not be set up; failing closed)');
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  let code;
  try { code = main(); } catch (err) { console.log(annotate(`unexpected error: ${err?.message || err}`)); code = 2; }
  process.exit(code);
}
