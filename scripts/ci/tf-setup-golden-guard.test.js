// scripts/ci/tf-setup-golden-guard.test.js
//
// The CI golden-baseline guard, exercised the way the Tests workflow runs it: `node
// scripts/ci/tf-setup-golden-guard.mjs` with the TF_GUARD_* environment, inside an ISOLATED
// temporary Git repository holding copies of the wrapper, the guard and the accepted evaluator
// files. The accepted repository fixtures are read, never written. Plus the workflow wiring itself
// (.github/workflows/tests.yml) and the wrapper's pure helpers.
//
// HERMETIC: everything is written under os.tmpdir() and removed afterwards; no network; git is
// the machine's own, run with argument arrays and a private identity.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { canonicalJson, canonicalSha256, checkBaselineIntegrity, PATHS } from '../experiments/tf-setup-golden-baseline-check.mjs';
import { interpretGuard, selectBase, preflightBase, main } from './tf-setup-golden-guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const WRAPPER_REL = 'scripts/ci/tf-setup-golden-guard.mjs';
const GUARD_REL = 'scripts/experiments/tf-setup-golden-baseline-check.mjs';
const ACCEPTED_GOLDEN_SHA = '767d22633672745d632cd7612e90d37c295b276692d60bdcd8f408f09105f32d';
const ROW_TIMEOUT = 60_000;

const accepted = {
  baseline: readFileSync(path.join(ROOT, PATHS.baseline), 'utf8').replace(/\r\n/g, '\n'),
  golden: readFileSync(path.join(ROOT, PATHS.golden), 'utf8').replace(/\r\n/g, '\n'),
  thresholds: readFileSync(path.join(ROOT, PATHS.thresholds), 'utf8').replace(/\r\n/g, '\n'),
};

// ---------------------------------------------------------------- the isolated repository

function makeRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tf-guard-ci-'));
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('TF_GUARD_') && !k.startsWith('GIT_') && k !== 'GITHUB_SHA'));
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=guard-test', '-c', 'user.email=guard-test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd: dir, encoding: 'utf8', env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (rel, text) => { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), text); };
  const remove = (rel) => unlinkSync(path.join(dir, rel));
  const commit = (message) => { git('add', '-A'); git('commit', '-q', '--allow-empty', '-m', message); return git('rev-parse', 'HEAD'); };
  const run = (env) => {
    const r = spawnSync(process.execPath, [path.join(dir, WRAPPER_REL)], { cwd: dir, encoding: 'utf8', env: { ...cleanEnv, ...env } });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  };
  git('init', '-q');
  write('package.json', '{ "type": "module" }\n');
  write(WRAPPER_REL, readFileSync(path.join(ROOT, WRAPPER_REL), 'utf8'));
  write(GUARD_REL, readFileSync(path.join(ROOT, GUARD_REL), 'utf8'));
  write('README.md', 'isolated guard fixture\n');
  return { dir, git, write, remove, commit, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const writeAccepted = (repo) => { repo.write(PATHS.baseline, accepted.baseline); repo.write(PATHS.golden, accepted.golden); repo.write(PATHS.thresholds, accepted.thresholds); };
/** A golden changed the way a scenario addition changes it, and its canonical sha. */
function changedGolden() {
  const g = JSON.parse(accepted.golden);
  const name = Object.keys(g.entry)[0];
  g.entry[`${name}_copy`] = g.entry[name];
  return { text: canonicalJson(g), sha: canonicalSha256(g), golden: g };
}
const dispatch = (baseRef) => ({ TF_GUARD_EVENT_NAME: 'workflow_dispatch', TF_GUARD_BASE_REF: baseRef });

describe('the CI golden guard on an isolated repository (the workflow\'s own command)', () => {
  let repo;
  const sha = {};

  beforeAll(() => {
    repo = makeRepo();
    sha.pre = repo.commit('pre-evaluator: no evaluator files');
    repo.write(PATHS.baseline, accepted.baseline);
    repo.write(PATHS.thresholds, accepted.thresholds);
    sha.incomplete = repo.commit('incomplete: baseline and thresholds, no golden');
    repo.write(PATHS.golden, accepted.golden);
    repo.write(PATHS.baseline, '{ not json');
    sha.corrupt = repo.commit('corrupt: the baseline is not JSON');
    writeAccepted(repo);
    sha.accepted = repo.commit('accepted: the evaluator baseline as merged in PR #1001');
    repo.git('branch', 'accepted-main', sha.accepted);

    repo.write('docs/unrelated.md', 'an unrelated change\n');
    sha.unchanged = repo.commit('unchanged evaluator files');

    const changed = changedGolden();
    repo.git('checkout', '-q', '--detach', sha.accepted);
    repo.write(PATHS.golden, changed.text);
    const rewritten = JSON.parse(accepted.baseline);
    rewritten[0] = { ...rewritten[0], goldenSha256: changed.sha };
    repo.write(PATHS.baseline, `${JSON.stringify(rewritten, null, 2)}\n`);
    sha.coordinated = repo.commit('coordinated rewrite: golden regenerated, entry 0 rewritten, sem-1 unchanged');

    repo.git('checkout', '-q', '--detach', sha.accepted);
    const noted = JSON.parse(accepted.baseline);
    noted[0] = { ...noted[0], note: `${noted[0].note} (edited)` };
    repo.write(PATHS.baseline, `${JSON.stringify(noted, null, 2)}\n`);
    sha.noteRewritten = repo.commit('history: entry 0 note rewritten');

    repo.git('checkout', '-q', '--detach', sha.accepted);
    repo.write(PATHS.baseline, '[]\n');
    sha.entryRemoved = repo.commit('history: the only entry removed');

    repo.git('checkout', '-q', '--detach', sha.accepted);
    const versioned = changedGolden();
    versioned.golden.semanticsId = 'tf-setup-v1/sem-2';
    repo.write(PATHS.golden, canonicalJson(versioned.golden));
    repo.write(PATHS.thresholds, accepted.thresholds.replace("export const SEMANTICS_ID = 'tf-setup-v1/sem-1';", "export const SEMANTICS_ID = 'tf-setup-v1/sem-2';"));
    const appended = [...JSON.parse(accepted.baseline), { semanticsId: 'tf-setup-v1/sem-2', goldenSha256: canonicalSha256(versioned.golden), recordedAt: '2026-10-29T12:00:00.000Z', note: 'isolated control: a versioned change, history preserved, one entry appended' }];
    repo.write(PATHS.baseline, `${JSON.stringify(appended, null, 2)}\n`);
    sha.versioned = repo.commit('versioned: sem-2 with an appended entry');

    repo.write(PATHS.baseline, `${JSON.stringify([appended[1]], null, 2)}\n`);
    sha.versionedEntryRemoved = repo.commit('history: entry 0 removed after a versioned change');

    repo.git('checkout', '-q', '--detach', sha.accepted);
    repo.write('docs/sibling.md', 'a sibling line of history\n');
    sha.sibling = repo.commit('sibling: diverges from the accepted commit');

    repo.git('checkout', '-q', '--orphan', 'unrelated');
    writeAccepted(repo);
    sha.unrelated = repo.commit('unrelated root carrying the same files');

    repo.git('checkout', '-q', '-B', 'feature', sha.accepted);
    repo.write('docs/feature.md', 'a feature change\n');
    sha.feature = repo.commit('feature: an unrelated PR change');
    repo.git('checkout', '-q', '--detach', sha.accepted);
    repo.git('merge', '-q', '--no-ff', 'feature', '-m', 'Merge feature into accepted (the PR merge ref)');
    sha.prMerge = repo.git('rev-parse', 'HEAD');
  }, ROW_TIMEOUT);

  afterAll(() => repo?.cleanup());

  const at = (commit) => repo.git('checkout', '-q', '--detach', '-f', commit);

  it('the copied evaluator files are the accepted ones: golden 767d2263…, one sem-1 entry', () => {
    expect(canonicalSha256(JSON.parse(accepted.golden))).toBe(ACCEPTED_GOLDEN_SHA);
    const baseline = JSON.parse(accepted.baseline);
    expect(baseline.map((e) => [e.semanticsId, e.goldenSha256])).toEqual([['tf-setup-v1/sem-1', ACCEPTED_GOLDEN_SHA]]);
    expect(accepted.thresholds).toMatch(/export const SEMANTICS_ID = 'tf-setup-v1\/sem-1';/);
  });

  it('unchanged evaluator files pass, in comparison mode', () => {
    at(sha.unchanged);
    const r = repo.run(dispatch(sha.accepted));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/guard: mode compare/);
    expect(r.out).toMatch(/note: golden and semantics unchanged against the base/);
    expect(r.out).toMatch(/result: PASS/);
  }, ROW_TIMEOUT);

  it('a coordinated golden/baseline rewrite under unchanged sem-1 fails, though the head is consistent with itself', () => {
    at(sha.coordinated);
    const changed = changedGolden();
    const head = JSON.parse(readFileSync(path.join(repo.dir, PATHS.baseline), 'utf8'));
    expect(checkBaselineIntegrity({ baseline: head, goldenSha: changed.sha, semanticsId: 'tf-setup-v1/sem-1' })).toEqual([]); // what the in-revision golden tests see: nothing wrong
    const r = repo.run(dispatch(sha.accepted));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/FAIL: golden: the golden bytes changed .* but SEMANTICS_ID is still tf-setup-v1\/sem-1/);
    expect(r.out).toMatch(/FAIL: history: entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
    expect(r.out).toMatch(/FAIL: golden: the golden bytes changed but no baseline entry was appended/);
    expect(r.out).toMatch(/::error title=tf-setup golden guard::/);
  }, ROW_TIMEOUT);

  it('rewriting an accepted history entry fails', () => {
    at(sha.noteRewritten);
    const r = repo.run(dispatch(sha.accepted));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/FAIL: history: entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
  }, ROW_TIMEOUT);

  it('removing an accepted history entry fails, alone or after a versioned change', () => {
    at(sha.entryRemoved);
    const alone = repo.run(dispatch(sha.accepted));
    expect(alone.code, alone.out).toBe(1);
    expect(alone.out).toMatch(/FAIL: history: 1 base entry was removed/);
    at(sha.versionedEntryRemoved);
    const after = repo.run(dispatch(sha.versioned));
    expect(after.code, after.out).toBe(1);
    expect(after.out).toMatch(/FAIL: history: 1 base entry was removed/);
    expect(after.out).toMatch(/FAIL: history: entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
  }, ROW_TIMEOUT);

  it('a properly versioned change (sem-2, history preserved, one entry appended) passes: the isolated control', () => {
    at(sha.versioned);
    const r = repo.run(dispatch(sha.accepted));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/note: golden changed under a new semantics id tf-setup-v1\/sem-2 with a new baseline entry/);
    expect(r.out).toMatch(/result: PASS/);
  }, ROW_TIMEOUT);

  it.each([
    ['missing', '', /the base_ref input is required/],
    ['unresolvable', 'no-such-branch', /does not resolve to a commit in this checkout/],
    ['option-shaped', '--upload-pack=x', /is not an acceptable ref/],
    ['shell-shaped', 'main; touch pwned', /is not an acceptable ref/],
  ])('a %s dispatch base fails closed', (label, baseRef, message) => {
    at(sha.unchanged);
    const r = repo.run(dispatch(baseRef));
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(message);
    expect(r.out).toMatch(/result: FAIL \(the comparison could not be set up; failing closed\)/);
    expect(existsSync(path.join(repo.dir, 'pwned'))).toBe(false);
  }, ROW_TIMEOUT);

  it('a self-comparison, an unrelated history and a non-ancestor fail closed', () => {
    at(sha.unchanged);
    const self = repo.run(dispatch(sha.unchanged));
    expect(self.code, self.out).toBe(2);
    expect(self.out).toMatch(/is the checked-out commit itself; a self-comparison proves nothing/);
    const selfByName = repo.run(dispatch('HEAD'));
    expect(selfByName.code, selfByName.out).toBe(2);
    expect(selfByName.out).toMatch(/self-comparison/);
    const unrelated = repo.run(dispatch(sha.unrelated));
    expect(unrelated.code, unrelated.out).toBe(2);
    expect(unrelated.out).toMatch(/shares no history with the checked-out commit .* \(unrelated history\)/);
    const sibling = repo.run(dispatch(sha.sibling));
    expect(sibling.code, sibling.out).toBe(2);
    expect(sibling.out).toMatch(/is not an ancestor of the checked-out commit .*not part of the tested history/);
  }, ROW_TIMEOUT);

  it('a valid ancestor that predates evaluator acceptance fails the preflight, never becoming an initial-baseline pass', () => {
    at(sha.unchanged);
    const r = repo.run(dispatch(sha.pre));
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/predates the accepted evaluator baseline: none of .* is present/);
    expect(r.out).not.toMatch(/mode initial|result: PASS/);
  }, ROW_TIMEOUT);

  it('incomplete or unparseable base files fail the preflight', () => {
    at(sha.unchanged);
    const incomplete = repo.run(dispatch(sha.incomplete));
    expect(incomplete.code, incomplete.out).toBe(2);
    expect(incomplete.out).toMatch(/is incomplete: api\/_utils\/setupEvaluator\/__fixtures__\/goldenVerdicts\.json is missing/);
    const corrupt = repo.run(dispatch(sha.corrupt));
    expect(corrupt.code, corrupt.out).toBe(2);
    expect(corrupt.out).toMatch(/goldenBaseline\.json is not valid JSON/);
  }, ROW_TIMEOUT);

  it('the pull_request path compares the PR merge result against the event\'s target-base SHA, and logs what it chose', () => {
    at(sha.prMerge);
    const r = repo.run({ TF_GUARD_EVENT_NAME: 'pull_request', TF_GUARD_PR_BASE_SHA: sha.accepted, TF_GUARD_PR_HEAD_SHA: sha.feature, TF_GUARD_BASE_REF: '' });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain(`event PR head: ${sha.feature}`);
    expect(r.out).toContain(`event target base: ${sha.accepted}`);
    expect(r.out).toContain(`checked-out commit (HEAD): ${sha.prMerge} (parents ${sha.accepted}, ${sha.feature})`);
    expect(r.out).toContain(`comparison base: ${sha.accepted} (the pull_request event's target-base SHA; an ancestor of HEAD)`);
    expect(r.out).toMatch(/guard: mode compare/);
  }, ROW_TIMEOUT);

  it.each([
    ['no target-base SHA', '', /the event carries no target-base SHA/],
    ['a branch name instead of a SHA', 'main', /is not a 40-hex commit id/],
    ['a SHA absent from the checkout', 'deadbeef'.repeat(5), /is not in this checkout; the history is incomplete \(the checkout step needs fetch-depth: 0\)/],
  ])('a pull_request event with %s fails closed', (label, base, message) => {
    at(sha.prMerge);
    const r = repo.run({ TF_GUARD_EVENT_NAME: 'pull_request', TF_GUARD_PR_BASE_SHA: base, TF_GUARD_PR_HEAD_SHA: sha.feature });
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(message);
  }, ROW_TIMEOUT);

  it('the workflow_dispatch path resolves an explicit branch name to its commit', () => {
    at(sha.unchanged);
    const r = repo.run(dispatch('accepted-main'));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('dispatch base_ref: "accepted-main"');
    expect(r.out).toContain(`comparison base: ${sha.accepted} (the workflow_dispatch input base_ref "accepted-main"; an ancestor of HEAD)`);
  }, ROW_TIMEOUT);

  it('an unsupported event fails closed', () => {
    at(sha.unchanged);
    const r = repo.run({ TF_GUARD_EVENT_NAME: 'push', TF_GUARD_BASE_REF: sha.accepted });
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/unsupported event "push"/);
  }, ROW_TIMEOUT);

  it('an evaluator object the base lists but the repository cannot read fails closed as unavailable, not absent', () => {
    // Last, because it damages the fixture repository: the base's golden blob is deleted from the object store.
    const blob = repo.git('rev-parse', `${sha.accepted}:${PATHS.golden}`);
    at(sha.unchanged);
    const head = repo.git('rev-parse', `HEAD:${PATHS.golden}`);
    expect(head).toBe(blob); // the head's working-tree file is already on disk
    unlinkSync(path.join(repo.dir, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
    const r = repo.run(dispatch(sha.accepted));
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/goldenVerdicts\.json is listed \(blob [0-9a-f]{40}\) but its object is unavailable; the history is incomplete/);
  }, ROW_TIMEOUT);
});

describe('the wrapper\'s verdict on the guard\'s report', () => {
  const ids = { base: 'a'.repeat(40), head: 'b'.repeat(40) };
  const report = (over) => JSON.stringify({ mode: 'compare', ok: true, failures: [], notes: [], base: { sha: ids.base }, head: { sha: ids.head }, ...over });
  it('an initial-baseline result fails here, though the standalone checker accepts it', () => {
    expect(() => interpretGuard({ status: 0, stdout: report({ mode: 'initial' }) }, ids)).toThrow(/ran in "initial" mode; CI requires comparison mode/);
  });
  it('a comparison of other commits, a crashed guard or unreadable output fails; exit codes are kept', () => {
    expect(() => interpretGuard({ status: 0, stdout: report({ base: { sha: 'c'.repeat(40) } }) }, ids)).toThrow(/not the selected/);
    expect(() => interpretGuard({ status: 2, stdout: '', stderr: 'STOP: base ref x does not resolve' }, ids)).toThrow(/the guard could not run \(exit 2\)/);
    expect(() => interpretGuard({ status: null, stdout: '' }, ids)).toThrow(/the guard could not run/);
    expect(() => interpretGuard({ status: 0, stdout: 'not json' }, ids)).toThrow(/not its JSON report/);
    expect(interpretGuard({ status: 0, stdout: report({}) }, ids).code).toBe(0);
    expect(interpretGuard({ status: 1, stdout: report({ ok: false, failures: ['x'] }) }, ids).code).toBe(1);
    expect(interpretGuard({ status: 0, stdout: report({ ok: false }) }, ids).code).toBe(1); // ok must be true as well
  });
  it('a failed read of a listed base file fails closed with git\'s reason, and main maps a setup failure to exit 2', () => {
    const git = (args) => {
      if (args[0] === 'ls-tree') return { status: 0, stdout: `100644 blob ${'d'.repeat(40)}\t${args[4]}\n`, stderr: '' };
      if (args[0] === 'cat-file') return { status: 0, stdout: '', stderr: '' };
      return { status: 128, stdout: '', stderr: 'fatal: unable to read' };
    };
    expect(() => preflightBase(ids.base, git)).toThrow(/could not be read \(git show exited 128\): fatal: unable to read/);
    const lines = [];
    const code = main({ env: { TF_GUARD_EVENT_NAME: 'workflow_dispatch', TF_GUARD_BASE_REF: '' }, git: () => ({ status: 0, stdout: `${ids.head}\n`, stderr: '' }), log: (l) => lines.push(l) });
    expect(code).toBe(2);
    expect(lines.join('\n')).toMatch(/STOP: workflow_dispatch: the base_ref input is required/);
  });
  it('selectBase never falls back: an unreadable HEAD or an ancestry error is a failure', () => {
    expect(() => selectBase({ eventName: 'workflow_dispatch', baseRef: 'main' }, () => ({ status: 128, stdout: '', stderr: '' }))).toThrow(/HEAD\) does not resolve/);
    const git = (args) => (args[0] === 'rev-parse' ? { status: 0, stdout: `${args[3] === 'HEAD^{commit}' ? ids.head : ids.base}\n`, stderr: '' } : { status: 128, stdout: '', stderr: 'fatal: bad object' });
    expect(() => selectBase({ eventName: 'workflow_dispatch', baseRef: 'main' }, git)).toThrow(/could not establish whether .* is an ancestor .*exited 128/);
  });
});

describe('the Tests workflow wiring (.github/workflows/tests.yml)', () => {
  const text = readFileSync(path.join(ROOT, '.github', 'workflows', 'tests.yml'), 'utf8');
  const wf = yaml.load(text);
  const job = wf.jobs.unit;
  const names = job.steps.map((s) => s.name);
  const guard = job.steps.find((s) => s.name === 'Golden baseline guard (tf-setup, cross-revision)');

  it('keeps the triggers, the job identity, Node 20 and concurrency; adds a required base_ref to workflow_dispatch', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['pull_request', 'workflow_dispatch']);
    expect(wf.on.pull_request).toEqual({ branches: ['main'] }); // no paths filter that could skip the guard
    expect(wf.on.workflow_dispatch.inputs.base_ref).toMatchObject({ required: true, type: 'string' });
    expect(text).not.toMatch(/pull_request_target/);
    expect(wf.permissions).toBeUndefined();
    expect(job.permissions).toBeUndefined();
    expect(Object.keys(wf.jobs)).toEqual(['unit']);
    expect(job.name).toBe('vitest (unit)');
    expect(wf.concurrency).toEqual({ group: 'tests-${{ github.ref }}', 'cancel-in-progress': true });
    expect(job.steps.find((s) => s.name === 'Set up Node').with['node-version']).toBe('20');
  });

  it('checks out full history and places the guard after Node setup, before the dependencies, the lint gate and the unit suite', () => {
    expect(job.steps[0]).toMatchObject({ name: 'Checkout', uses: 'actions/checkout@v4', with: { 'fetch-depth': 0 } });
    expect(names).toEqual(['Checkout', 'Set up Node', 'Golden baseline guard (tf-setup, cross-revision)', 'Install dependencies', 'Lint gate (crash-class rules only)', 'Run unit tests']);
  });

  it('the guard step blocks: no continue-on-error, no condition, the plain command, and event values only through env', () => {
    expect(guard['continue-on-error']).toBeUndefined();
    expect(guard.if).toBeUndefined();
    expect(guard.run).toBe('node scripts/ci/tf-setup-golden-guard.mjs');
    expect(guard.run).not.toMatch(/\$\{\{/);
    expect(guard.env).toEqual({
      TF_GUARD_EVENT_NAME: '${{ github.event_name }}',
      TF_GUARD_PR_BASE_SHA: '${{ github.event.pull_request.base.sha }}',
      TF_GUARD_PR_HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
      TF_GUARD_BASE_REF: '${{ inputs.base_ref }}',
    });
    for (const step of job.steps) expect(step['continue-on-error'], step.name).toBeUndefined();
    expect(text).not.toMatch(/secrets\./);
  });
});
