// scripts/ci/tf-setup-golden-guard.test.js
//
// The CI golden-baseline guard, exercised the way the Tests workflow runs it: `node
// scripts/ci/tf-setup-golden-guard.mjs` with the TF_GUARD_* environment, inside an ISOLATED
// temporary Git repository holding copies of the wrapper and the guard. Plus the workflow wiring
// itself (.github/workflows/tests.yml) and the wrapper's pure helpers.
//
// THE EVALUATOR FILES IN THESE REPOSITORIES ARE TEST-ONLY FIXTURES, built below: a small golden,
// its baseline history and a three-constant thresholds module, at controlled versions sem-1, sem-2
// and sem-3. Nothing here reads or pins the production evaluator, so a later, properly versioned
// production change (a new SEMANTICS_ID with an appended entry) cannot break these rows. The
// production identity is the golden tests' and the guard's own business. (PR #1004 correction:
// the first version copied the production files and pinned them to sem-1.)
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
const ROW_TIMEOUT = 60_000;

// ---------------------------------------------------------------- test-only evaluator fixtures

const FIXTURE_SETUP_VERSION = 'tf-setup-v1';
const FIXTURE_THRESHOLDS_HASH = 'abcdef012345'; // a 12-hex stand-in, deliberately not production's
const sem = (n) => `tf-setup-v1/sem-${n}`;

/** A three-constant module in the shape the guard imports; nothing else. */
const thresholdsFixture = (semanticsId) => `// test-only thresholds fixture (scripts/ci/tf-setup-golden-guard.test.js)\nexport const SETUP_VERSION = '${FIXTURE_SETUP_VERSION}';\nexport const THRESHOLDS_HASH = '${FIXTURE_THRESHOLDS_HASH}';\nexport const SEMANTICS_ID = '${semanticsId}';\n`;
/** A small golden: one record per named scenario. */
const goldenFixture = (semanticsId, names) => ({
  semanticsId,
  setupVersion: FIXTURE_SETUP_VERSION,
  thresholdsHash: FIXTURE_THRESHOLDS_HASH,
  entry: Object.fromEntries(names.map((name, i) => [name, { verdict: i % 2 ? 'invalid' : 'valid', checks: [{ id: 'fixture_check', result: i % 2 === 0 }] }])),
  holding: {},
});
const entryFor = (semanticsId, golden, recordedAt, note) => ({ semanticsId, goldenSha256: canonicalSha256(golden), recordedAt, note });

/** The controlled states: sem-1, then two properly versioned changes, each preserving the history and appending one entry. */
const G1 = goldenFixture(sem(1), ['alpha']);
const G2 = goldenFixture(sem(2), ['alpha', 'beta']);
const G3 = goldenFixture(sem(3), ['alpha', 'beta', 'gamma']);
const E1 = entryFor(sem(1), G1, '2026-10-01T12:00:00.000Z', 'fixture: the first accepted entry');
const E2 = entryFor(sem(2), G2, '2026-10-02T12:00:00.000Z', 'fixture: a versioned change, one scenario added');
const E3 = entryFor(sem(3), G3, '2026-10-03T12:00:00.000Z', 'fixture: a second versioned change, one scenario added');
const STATES = {
  sem1: { semanticsId: sem(1), golden: G1, history: [E1] },
  sem2: { semanticsId: sem(2), golden: G2, history: [E1, E2] },
  sem3: { semanticsId: sem(3), golden: G3, history: [E1, E2, E3] },
};
/** A golden regenerated under an unchanged id, with the history's last entry rewritten to its hash: consistent with itself. */
function coordinatedRewrite(state) {
  const golden = goldenFixture(state.semanticsId, [...Object.keys(state.golden.entry), 'rewritten']);
  const history = state.history.map((e, i) => (i === state.history.length - 1 ? { ...e, goldenSha256: canonicalSha256(golden) } : e));
  return { semanticsId: state.semanticsId, golden, history };
}

// ---------------------------------------------------------------- the isolated repository

function makeRepo() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tf-guard-ci-'));
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('TF_GUARD_') && !k.startsWith('GIT_') && k !== 'GITHUB_SHA'));
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=guard-test', '-c', 'user.email=guard-test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', ...args], { cwd: dir, encoding: 'utf8', env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (rel, text) => { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), text); };
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
  return { dir, git, write, commit, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Write one evaluator state's three files: golden, baseline history, thresholds. */
function writeState(repo, { semanticsId, golden, history }) {
  repo.write(PATHS.golden, canonicalJson(golden));
  repo.write(PATHS.baseline, `${JSON.stringify(history, null, 2)}\n`);
  repo.write(PATHS.thresholds, thresholdsFixture(semanticsId));
}
const dispatch = (baseRef) => ({ TF_GUARD_EVENT_NAME: 'workflow_dispatch', TF_GUARD_BASE_REF: baseRef });

describe('the CI golden guard on an isolated repository with test-only evaluator fixtures (the workflow\'s own command)', () => {
  let repo;
  const sha = {};

  beforeAll(() => {
    repo = makeRepo();
    sha.pre = repo.commit('pre-evaluator: no evaluator files');
    repo.write(PATHS.baseline, `${JSON.stringify(STATES.sem1.history, null, 2)}\n`);
    repo.write(PATHS.thresholds, thresholdsFixture(sem(1)));
    sha.incomplete = repo.commit('incomplete: baseline and thresholds, no golden');
    repo.write(PATHS.golden, canonicalJson(G1));
    repo.write(PATHS.baseline, '{ not json');
    sha.corrupt = repo.commit('corrupt: the baseline is not JSON');
    writeState(repo, STATES.sem1);
    sha.sem1 = repo.commit('fixture sem-1: the first accepted state');
    repo.git('branch', 'accepted-main', sha.sem1);

    repo.write('docs/unrelated.md', 'an unrelated change\n');
    sha.unchanged = repo.commit('unchanged evaluator files');

    const branchFrom = (from) => repo.git('checkout', '-q', '--detach', '-f', from);

    branchFrom(sha.sem1);
    writeState(repo, coordinatedRewrite(STATES.sem1));
    sha.coordinated1 = repo.commit('coordinated rewrite under sem-1: golden regenerated, entry 0 rewritten');

    branchFrom(sha.sem1);
    writeState(repo, { ...STATES.sem1, history: [{ ...E1, note: `${E1.note} (edited)` }] });
    sha.noteRewritten = repo.commit('history: entry 0 note rewritten');

    branchFrom(sha.sem1);
    writeState(repo, STATES.sem1);
    repo.write(PATHS.baseline, '[]\n');
    sha.entryRemoved = repo.commit('history: the only entry removed');

    branchFrom(sha.sem1);
    writeState(repo, STATES.sem2);
    sha.sem2 = repo.commit('versioned sem-1 -> sem-2: history preserved, one entry appended');

    writeState(repo, STATES.sem3);
    sha.sem3 = repo.commit('versioned sem-2 -> sem-3: history preserved, one entry appended');

    branchFrom(sha.sem2);
    writeState(repo, coordinatedRewrite(STATES.sem2));
    sha.coordinated2 = repo.commit('coordinated rewrite under sem-2: golden regenerated, entry 1 rewritten');

    branchFrom(sha.sem2);
    writeState(repo, { ...STATES.sem2, history: [E2] });
    sha.sem2EntryRemoved = repo.commit('history: entry 0 removed after a versioned change');

    branchFrom(sha.sem1);
    repo.write('docs/sibling.md', 'a sibling line of history\n');
    sha.sibling = repo.commit('sibling: diverges from the sem-1 commit');

    repo.git('checkout', '-q', '--orphan', 'unrelated');
    writeState(repo, STATES.sem1);
    sha.unrelated = repo.commit('unrelated root carrying the same files');

    repo.git('checkout', '-q', '-f', '-B', 'feature', sha.sem1);
    repo.write('docs/feature.md', 'a feature change\n');
    sha.feature = repo.commit('feature: an unrelated PR change');
    branchFrom(sha.sem1);
    repo.git('merge', '-q', '--no-ff', 'feature', '-m', 'Merge feature into sem-1 (the PR merge ref)');
    sha.prMerge = repo.git('rev-parse', 'HEAD');
  }, ROW_TIMEOUT);

  afterAll(() => repo?.cleanup());

  const at = (commit) => repo.git('checkout', '-q', '--detach', '-f', commit);

  it('the test-only fixtures are what they claim: each state is consistent with itself, and each later state keeps the earlier history and appends one entry', () => {
    for (const state of Object.values(STATES)) {
      expect(checkBaselineIntegrity({ baseline: state.history, goldenSha: canonicalSha256(state.golden), semanticsId: state.semanticsId })).toEqual([]);
    }
    expect(STATES.sem2.history.slice(0, 1)).toEqual(STATES.sem1.history);
    expect(STATES.sem3.history.slice(0, 2)).toEqual(STATES.sem2.history);
    expect(new Set([G1, G2, G3].map(canonicalSha256)).size).toBe(3);
    expect(FIXTURE_THRESHOLDS_HASH).toMatch(/^[0-9a-f]{12}$/);
  });

  it('unchanged evaluator files pass, in comparison mode', () => {
    at(sha.unchanged);
    const r = repo.run(dispatch(sha.sem1));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/guard: mode compare/);
    expect(r.out).toMatch(/note: golden and semantics unchanged against the base/);
    expect(r.out).toMatch(/result: PASS/);
  }, ROW_TIMEOUT);

  it('a coordinated golden/baseline rewrite under unchanged sem-1 fails, though the head is consistent with itself', () => {
    at(sha.coordinated1);
    const rewritten = coordinatedRewrite(STATES.sem1);
    expect(checkBaselineIntegrity({ baseline: rewritten.history, goldenSha: canonicalSha256(rewritten.golden), semanticsId: sem(1) })).toEqual([]); // what the in-revision golden tests see: nothing wrong
    const r = repo.run(dispatch(sha.sem1));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/FAIL: golden: the golden bytes changed .* but SEMANTICS_ID is still tf-setup-v1\/sem-1/);
    expect(r.out).toMatch(/FAIL: history: entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
    expect(r.out).toMatch(/FAIL: golden: the golden bytes changed but no baseline entry was appended/);
    expect(r.out).toMatch(/::error title=tf-setup golden guard::/);
  }, ROW_TIMEOUT);

  it('a coordinated rewrite under an unchanged later id (sem-2) fails the same way', () => {
    at(sha.coordinated2);
    const r = repo.run(dispatch(sha.sem2));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/FAIL: golden: the golden bytes changed .* but SEMANTICS_ID is still tf-setup-v1\/sem-2/);
    expect(r.out).toMatch(/FAIL: history: entry 1 \(tf-setup-v1\/sem-2\) was rewritten/);
    expect(r.out).toMatch(/FAIL: golden: the golden bytes changed but no baseline entry was appended/);
  }, ROW_TIMEOUT);

  it('rewriting an accepted history entry fails', () => {
    at(sha.noteRewritten);
    const r = repo.run(dispatch(sha.sem1));
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/FAIL: history: entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
  }, ROW_TIMEOUT);

  it('removing an accepted history entry fails, alone or after a versioned change', () => {
    at(sha.entryRemoved);
    const alone = repo.run(dispatch(sha.sem1));
    expect(alone.code, alone.out).toBe(1);
    expect(alone.out).toMatch(/FAIL: history: 1 base entry was removed/);
    at(sha.sem2EntryRemoved);
    const after = repo.run(dispatch(sha.sem2));
    expect(after.code, after.out).toBe(1);
    expect(after.out).toMatch(/FAIL: history: 1 base entry was removed/);
    expect(after.out).toMatch(/FAIL: history: entry 0 \(tf-setup-v1\/sem-1\) was rewritten/);
  }, ROW_TIMEOUT);

  it('a properly versioned change sem-1 -> sem-2 (history preserved, one entry appended) passes: the isolated control', () => {
    at(sha.sem2);
    const r = repo.run(dispatch(sha.sem1));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/note: golden changed under a new semantics id tf-setup-v1\/sem-2 with a new baseline entry/);
    expect(r.out).toMatch(/result: PASS/);
  }, ROW_TIMEOUT);

  it('the next versioned change sem-2 -> sem-3 passes too, and so does sem-1 -> sem-3 across both appended entries', () => {
    at(sha.sem3);
    const next = repo.run(dispatch(sha.sem2));
    expect(next.code, next.out).toBe(0);
    expect(next.out).toMatch(/note: golden changed under a new semantics id tf-setup-v1\/sem-3 with a new baseline entry/);
    expect(next.out).toContain('3 entries');
    const across = repo.run(dispatch(sha.sem1));
    expect(across.code, across.out).toBe(0);
    expect(across.out).toMatch(/result: PASS/);
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
    const r = repo.run({ TF_GUARD_EVENT_NAME: 'pull_request', TF_GUARD_PR_BASE_SHA: sha.sem1, TF_GUARD_PR_HEAD_SHA: sha.feature, TF_GUARD_BASE_REF: '' });
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain(`event PR head: ${sha.feature}`);
    expect(r.out).toContain(`event target base: ${sha.sem1}`);
    expect(r.out).toContain(`checked-out commit (HEAD): ${sha.prMerge} (parents ${sha.sem1}, ${sha.feature})`);
    expect(r.out).toContain(`comparison base: ${sha.sem1} (the pull_request event's target-base SHA; an ancestor of HEAD)`);
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
    expect(r.out).toContain(`comparison base: ${sha.sem1} (the workflow_dispatch input base_ref "accepted-main"; an ancestor of HEAD)`);
  }, ROW_TIMEOUT);

  it('an unsupported event fails closed', () => {
    at(sha.unchanged);
    const r = repo.run({ TF_GUARD_EVENT_NAME: 'push', TF_GUARD_BASE_REF: sha.sem1 });
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/unsupported event "push"/);
  }, ROW_TIMEOUT);

  it('an evaluator object the base lists but the repository cannot read fails closed as unavailable, not absent', () => {
    // Last, because it damages the fixture repository: the base's golden blob is deleted from the object store.
    const blob = repo.git('rev-parse', `${sha.sem1}:${PATHS.golden}`);
    at(sha.unchanged);
    const head = repo.git('rev-parse', `HEAD:${PATHS.golden}`);
    expect(head).toBe(blob); // the head's working-tree file is already on disk
    unlinkSync(path.join(repo.dir, '.git', 'objects', blob.slice(0, 2), blob.slice(2)));
    const r = repo.run(dispatch(sha.sem1));
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
