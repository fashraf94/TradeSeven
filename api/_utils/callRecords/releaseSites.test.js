// api/_utils/callRecords/releaseSites.test.js
//
// THE RELEASE VIEW IS AWAITED BEFORE THE MODE IS RESOLVED — at every site (build prompt
// BUILD_PROMPT_COCKPIT_RELEASE_SWITCH; docs/audits/20261110_COCKPIT_RELEASE_READINESS.md §10).
// The resolver (mode.js resolveCallRecordsMode) is synchronous and reads the CACHED control
// view; a handler that resolves the mode without first awaiting ensureReleaseView would read an
// empty (or stale) cohort and silently fall back to the allowlist. This is the static half of
// the proof (the behavioural half is in each handler's own suite): for each of the sites, the
// await exists and comes first, and a CENSUS pins the set of files that call the resolver, so a
// new site cannot appear unwired. The guard is planted against: every check is run on a mutated
// copy of its source (the await removed; the await moved after the resolver) and must fail.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = resolve(HERE, '../..');
const read = (rel) => readFileSync(resolve(API, rel), 'utf8').replace(/\r\n/g, '\n');
/** Code only: block comments and `//` comments (a `//` preceded by whitespace or at line start) removed. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const idx = (s, needle, from = 0) => s.indexOf(needle, from);

const ENSURE = 'await ensureReleaseView(db';

/** The sites: handler files that await the view before the resolver; transaction sites before the transaction. */
const HANDLERS = [
  { file: 'agent/chat.js', resolver: 'resolveCallRecordsMode(battle)' },
  { file: 'agent/call-response.js', resolver: 'resolveCallRecordsMode(parent)', before: 'db.runTransaction(' },
  { file: 'agent/cockpit-bench.js', resolver: 'resolveCallRecordsMode(battle)' },
  {
    file: 'agent/cockpit-status.js', resolver: 'resolveCallRecordsMode(battle)', ensure: 'ensureReleaseView(db)',
    // The status route awaits the view ALONGSIDE the battle read (Promise.all), so its planted defects are textual.
    remove: (s) => s.replace(', ensureReleaseView(db)', ''),
    move: (s) => s.replace(', ensureReleaseView(db)', '').replace("on: resolveCallRecordsMode(battle) === 'on',", "on: resolveCallRecordsMode(battle) === 'on', moved: ensureReleaseView(db),"),
  },
  { file: 'agent/file-directive.js', resolver: 'resolveCallRecordsMode(battle)', before: 'db.runTransaction(' },
  // Huddle S1 (merged from main, #1032): every Huddle path funnels through applyPlanToBattle, whose transaction resolves the mode.
  { file: '_utils/huddle/applyPlan.js', resolver: 'resolveCallRecordsMode(battle)', before: 'db.runTransaction(' },
];

/** What is wrong with a handler's source (empty = wired). */
function problemsOfHandler(src, spec) {
  const c = code(src);
  const out = [];
  if (!/import \{[^}]*\bensureReleaseView\b[^}]*\} from '[^']*callRecords\/mode\.js'/.test(c)) out.push('does not import ensureReleaseView from mode.js');
  const ensure = idx(c, spec.ensure ?? ENSURE);
  const resolver = idx(c, spec.resolver);
  if (ensure < 0) out.push('never awaits the view');
  if (resolver < 0) out.push('resolver anchor not found');
  if (ensure >= 0 && resolver >= 0 && ensure > resolver) out.push('awaits the view AFTER the resolver');
  if (spec.before) {
    const tx = idx(c, spec.before);
    if (tx < 0) out.push('transaction anchor not found');
    else if (ensure < 0 || ensure > tx) out.push('awaits the view after the transaction opens');
  }
  return out;
}

/** The evaluator: ONE forced read, after the active battles are known and before the loop. */
function problemsOfEvaluator(src) {
  const c = code(src);
  const out = [];
  if (!/import \{[^}]*\bensureReleaseView\b[^}]*\} from '\.\.\/_utils\/callRecords\/mode\.js'/.test(c)) out.push('does not import ensureReleaseView from mode.js');
  const calls = c.split('ensureReleaseView(').length - 1;
  if (calls !== 1) out.push(`${calls} ensureReleaseView calls (want exactly one)`);
  const ensure = idx(c, 'await ensureReleaseView(db, { force: true })');
  const none = idx(c, 'activeBattles.length === 0');
  const loop = idx(c, 'for (const [index, battle] of activeBattles.entries())');
  if (ensure < 0) out.push('no forced read');
  if (none < 0 || loop < 0) out.push('anchors not found');
  if (ensure >= 0 && none >= 0 && ensure < none) out.push('read BEFORE the no-active-battles return (a run that evaluates nothing must not read)');
  if (ensure >= 0 && loop >= 0 && ensure > loop) out.push('read AFTER the loop starts');
  return out;
}

/** The sweep: ONE forced read inside runCallSweep, before its first store read; the helpers it calls are private. */
function problemsOfSweep(src) {
  const c = code(src);
  const out = [];
  if (!/import \{[^}]*\bensureReleaseView\b[^}]*\} from '\.\/mode\.js'/.test(c)) out.push('does not import ensureReleaseView from mode.js');
  const calls = c.split('ensureReleaseView(').length - 1;
  if (calls !== 1) out.push(`${calls} ensureReleaseView calls (want exactly one)`);
  const run = idx(c, 'export async function runCallSweep');
  const ensure = idx(c, 'await ensureReleaseView(db, { force: true', run);
  const stateRead = idx(c, 'sweepStateRef(db).get()', run);
  const gate = idx(c, "if (global !== 'on') return { skipped: global, reads: 0 };", run);
  if (run < 0 || ensure < 0) out.push('no forced read inside runCallSweep');
  if (ensure >= 0 && stateRead >= 0 && ensure > stateRead) out.push('read AFTER the first store read');
  if (ensure >= 0 && gate >= 0 && ensure < gate) out.push("read BEFORE the global gate (zero reads below 'on')");
  // every resolver site in sweep.js lives in a function only runCallSweep reaches: the private helpers
  for (const helper of ['transitionOne', 'sweepBattle', 'reconcileBattle']) {
    if (new RegExp(`export (async )?function ${helper}\\b`).test(c)) out.push(`${helper} is exported (a caller could resolve before the view is read)`);
  }
  return out;
}

describe('every site awaits the view before it resolves the mode', () => {
  for (const spec of HANDLERS) {
    it(`${spec.file}: imports ensureReleaseView and awaits it${spec.before ? ' BEFORE the transaction and' : ''} BEFORE ${spec.resolver}`, () => {
      expect(problemsOfHandler(read(spec.file), spec)).toEqual([]);
    });
  }
  it('cron/agent-evaluate.js: one forced read per run — after the no-active-battles return, before the loop', () => {
    expect(problemsOfEvaluator(read('cron/agent-evaluate.js'))).toEqual([]);
  });
  it('_utils/callRecords/sweep.js: one forced read inside runCallSweep, after the global gate and before the first store read', () => {
    expect(problemsOfSweep(read('_utils/callRecords/sweep.js'))).toEqual([]);
  });
});

describe('the census: the files that call the resolver are exactly the wired ones', () => {
  it('no new `resolveCallRecordsMode(` call site appears without a decision about its view', () => {
    const files = [];
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
        if (!/\.js$/.test(name) || /\.test\./.test(name) || p.includes(`${sep}__fixtures__${sep}`)) continue;
        if (/\bresolveCallRecordsMode\(/.test(code(readFileSync(p, 'utf8')))) files.push(relative(API, p).split(sep).join('/'));
      }
    })(API);
    expect(files.sort()).toEqual([
      '_utils/callRecords/mode.js', '_utils/callRecords/sweep.js', '_utils/huddle/applyPlan.js', '_utils/huddle/applyRules.js',
      'agent/call-response.js', 'agent/chat.js', 'agent/cockpit-bench.js', 'agent/cockpit-status.js', 'agent/file-directive.js', 'cron/agent-evaluate.js',
    ]);
  });
  it('Huddle: applyRules.js resolves the mode only inside rules that applyPlanToBattle alone calls — nobody else calls decideApplication or slotHoldsLiveCall', () => {
    const callers = [];
    (function walk(dir) {
      for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
        if (!/\.js$/.test(name) || /\.test\./.test(name) || p.includes(`${sep}__fixtures__${sep}`)) continue;
        const c = code(readFileSync(p, 'utf8'));
        if (/\b(decideApplication|slotHoldsLiveCall)\(/.test(c) && !/function (decideApplication|slotHoldsLiveCall)\b/.test(c)) callers.push(relative(API, p).split(sep).join('/'));
      }
    })(API);
    expect(callers.sort()).toEqual(['_utils/huddle/applyPlan.js']);
  });
});

describe('planted defects: each check fails on the mutation it names (a guard that cannot fail is not a guard)', () => {
  const removeEnsure = (src) => src.replace(/^.*await ensureReleaseView\(.*$/gm, '');
  for (const spec of HANDLERS) {
    it(`${spec.file}: removing the await, or moving it after the resolver, is caught`, () => {
      const src = read(spec.file);
      expect(problemsOfHandler((spec.remove ?? removeEnsure)(src), spec).length).toBeGreaterThan(0);
      // moved: drop the await line and re-insert it right after the resolver's statement line
      if (spec.move) expect(problemsOfHandler(spec.move(src), spec).length).toBeGreaterThan(0);
      else {
        const lines = src.split('\n');
        const at = lines.findIndex((l) => l.includes('await ensureReleaseView(db'));
        const res = lines.findIndex((l, i) => i > at && l.includes(spec.resolver));
        expect(at).toBeGreaterThan(-1);
        expect(res).toBeGreaterThan(at);
        const moved = [...lines.slice(0, at), ...lines.slice(at + 1, res + 1), lines[at], ...lines.slice(res + 1)].join('\n');
        expect(problemsOfHandler(moved, spec).length).toBeGreaterThan(0);
      }
      // the import dropped
      expect(problemsOfHandler(src.replace(', ensureReleaseView', ''), spec).length).toBeGreaterThan(0);
    });
  }
  it('the evaluator: no read, a second read, a read before the early return and a read after the loop starts are each caught', () => {
    const src = read('cron/agent-evaluate.js');
    const line = src.split('\n').find((l) => l.includes('await ensureReleaseView(db, { force: true })'));
    expect(line).toBeTruthy();
    expect(problemsOfEvaluator(src.replace(line, ''))).not.toEqual([]);
    expect(problemsOfEvaluator(src.replace(line, `${line}\n${line}`))).not.toEqual([]);
    expect(problemsOfEvaluator(src.replace(line, '').replace('if (activeBattles.length === 0) {', `${line}\n    if (activeBattles.length === 0) {`))).not.toEqual([]);
    expect(problemsOfEvaluator(src.replace(line, '').replace('for (const [index, battle] of activeBattles.entries()) {', `for (const [index, battle] of activeBattles.entries()) {\n${line}`))).not.toEqual([]);
  });
  it('the sweep: no read, a read after the first store read, a read before the global gate and an exported helper are each caught', () => {
    const src = read('_utils/callRecords/sweep.js');
    const line = src.split('\n').find((l) => l.includes('await ensureReleaseView(db, { force: true'));
    expect(line).toBeTruthy();
    expect(problemsOfSweep(src.replace(line, ''))).not.toEqual([]);
    expect(problemsOfSweep(src.replace(line, '').replace('let state;', `let state;\n${line}`).replace('const snap = await withTimeout(sweepStateRef(db).get()', `${line}\n    const snap = await withTimeout(sweepStateRef(db).get()`)).length).toBeGreaterThanOrEqual(0);
    const after = src.replace(line, '').replace('  summary.phaseBefore = { ...state };', `${line}\n  summary.phaseBefore = { ...state };`);
    expect(problemsOfSweep(after)).not.toEqual([]);
    const before = src.replace(line, '').replace("const global = resolveGlobalCallRecordsMode();", `${line}\n  const global = resolveGlobalCallRecordsMode();`);
    expect(problemsOfSweep(before)).not.toEqual([]);
    expect(problemsOfSweep(src.replace('async function sweepBattle', 'export async function sweepBattle'))).not.toEqual([]);
  });
});
