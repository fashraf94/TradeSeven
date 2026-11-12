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
  // The await is an UNCONDITIONAL statement on its own line with exactly `(db)`: a dead-branch ensure (`if (x) await …`) or an
  // argument that changes the view (`{ nowMs: 0 }`) would pass a text-order check and be a silent defect (RS-L2-3 / RS-L3-3).
  const exact = spec.ensure ? null : /^[ \t]*await ensureReleaseView\(db\);[ \t]*$/m.exec(c);
  if (!spec.ensure && !exact) out.push('the await is not an unconditional `await ensureReleaseView(db);` statement');
  const ensure = exact ? exact.index : idx(c, spec.ensure ?? ENSURE);
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

describe('the census: the files that use the resolver are exactly the wired ones', () => {
  /** Every non-test, non-fixture .js/.mjs under api/ and scripts/, with its comment-stripped code. */
  function sources() {
    const out = [];
    const roots = [API, resolve(API, '../scripts')];
    for (const root of roots) {
      (function walk(dir) {
        for (const name of readdirSync(dir)) {
          const p = resolve(dir, name);
          if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
          if (!/\.(js|mjs)$/.test(name) || /\.test\./.test(name) || p.includes(`${sep}__fixtures__${sep}`)) continue;
          out.push({ rel: relative(resolve(API, '..'), p).split(sep).join('/'), c: code(readFileSync(p, 'utf8')) });
        }
      })(root);
    }
    return out;
  }
  it('no new use of resolveCallRecordsMode / isReleaseCohortBattle — called, aliased or passed — appears without a decision about its view', () => {
    const files = sources().filter((s) => /\b(resolveCallRecordsMode|isReleaseCohortBattle)\b/.test(s.c)).map((s) => s.rel);
    expect(files.sort()).toEqual([
      'api/_utils/callRecords/mode.js', 'api/_utils/callRecords/sweep.js', 'api/_utils/huddle/applyPlan.js', 'api/_utils/huddle/applyRules.js',
      'api/agent/call-response.js', 'api/agent/chat.js', 'api/agent/cockpit-bench.js', 'api/agent/cockpit-status.js', 'api/agent/file-directive.js', 'api/cron/agent-evaluate.js',
    ]);
  });
  it('each wired file uses the resolver EXACTLY as often as today — a second resolver site inside a listed file (an export, a helper, a second call) is a new site that needs its own decision about its view (RS-L4-3 / S18, S19)', () => {
    // [resolveCallRecordsMode identifiers, isReleaseCohortBattle identifiers] — an import line and one call, per handler; the sweep has three calls.
    const EXPECTED = {
      'api/_utils/callRecords/mode.js': [1, 2], 'api/_utils/callRecords/sweep.js': [4, 0], 'api/_utils/huddle/applyPlan.js': [2, 0], 'api/_utils/huddle/applyRules.js': [2, 0],
      'api/agent/call-response.js': [2, 0], 'api/agent/chat.js': [2, 0], 'api/agent/cockpit-bench.js': [2, 0], 'api/agent/cockpit-status.js': [2, 0],
      'api/agent/file-directive.js': [2, 0], 'api/cron/agent-evaluate.js': [2, 0],
    };
    const count = (c, id) => (c.match(new RegExp(`\\b${id}\\b`, 'g')) || []).length;
    const got = Object.fromEntries(sources().filter((s) => EXPECTED[s.rel]).map((s) => [s.rel, [count(s.c, 'resolveCallRecordsMode'), count(s.c, 'isReleaseCohortBattle')]]));
    expect(got).toEqual(EXPECTED);
    // and the planted second site is seen: one more identifier in chat.js moves its count
    const chat = sources().find((s) => s.rel === 'api/agent/chat.js').c;
    expect(count(`${chat}\nexport const __probe = (b) => resolveCallRecordsMode(b);`, 'resolveCallRecordsMode')).toBe(EXPECTED['api/agent/chat.js'][0] + 1);
  });
  it('no namespace import of mode.js (a `mode["resolveCallRecordsMode"]` call would hide from the census), and no re-export of the resolver', () => {
    for (const s of sources()) {
      expect(s.c, s.rel).not.toMatch(/import \* as \w+ from '[^']*callRecords\/mode\.js'/);
      expect(s.c, s.rel).not.toMatch(/export \{[^}]*\b(resolveCallRecordsMode|isReleaseCohortBattle)\b[^}]*\} from/);
    }
  });
  it('the exported processAgentBattle (the evaluator\'s check, which resolves the mode) is called only by the evaluator handler — never by another route that has not read the view', () => {
    const callers = sources().filter((s) => /\bprocessAgentBattle\(/.test(s.c) && !/function processAgentBattle\b/.test(s.c)).map((s) => s.rel);
    expect(callers).toEqual([]);
    const own = sources().find((s) => s.rel === 'api/cron/agent-evaluate.js').c;
    expect(own.match(/\bprocessAgentBattle\(/g).length).toBe(2); // the definition and the one call in the handler's loop
  });
  it('Huddle: applyRules.js resolves the mode only inside rules that applyPlanToBattle alone calls — nobody else calls decideApplication or slotHoldsLiveCall', () => {
    const callers = sources().filter((s) => /\b(decideApplication|slotHoldsLiveCall)\(/.test(s.c) && !/function (decideApplication|slotHoldsLiveCall)\b/.test(s.c)).map((s) => s.rel);
    expect(callers.sort()).toEqual(['api/_utils/huddle/applyPlan.js']);
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
      // each check names its own problem (RS-L4-9): an anchor that is gone, a resolver that is gone, an ensure that sits inside the transaction
      expect(problemsOfHandler(src, { ...spec, resolver: 'noSuchResolver(' })).toContain('resolver anchor not found');
      if (spec.before) {
        expect(problemsOfHandler(src, { ...spec, before: 'db.noSuchTransaction(' })).toContain('transaction anchor not found');
        const lines = src.split('\n');
        const at = lines.findIndex((l) => l.includes('await ensureReleaseView(db'));
        const txi = lines.findIndex((l) => l.includes(spec.before));
        expect(txi).toBeGreaterThan(at);
        const inside = [...lines.slice(0, at), ...lines.slice(at + 1, txi + 1), lines[at], ...lines.slice(txi + 1)].join('\n');
        expect(problemsOfHandler(inside, spec)).toContain('awaits the view after the transaction opens');
      }
      if (!spec.ensure) {
        // a dead branch, and an argument that dates the view in 1970 (the resolver would then read it as stale)
        expect(problemsOfHandler(src.replace(/^(\s*)await ensureReleaseView\(db\);/m, '$1if (Date.now() < 0) await ensureReleaseView(db);'), spec).length).toBeGreaterThan(0);
        expect(problemsOfHandler(src.replace(/^(\s*)await ensureReleaseView\(db\);/m, '$1await ensureReleaseView(db, { nowMs: 0 });'), spec).length).toBeGreaterThan(0);
      }
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
    const after = src.replace(line, '').replace('  summary.phaseBefore = { ...state };', `${line}\n  summary.phaseBefore = { ...state };`);
    expect(problemsOfSweep(after)).not.toEqual([]);
    const before = src.replace(line, '').replace("const global = resolveGlobalCallRecordsMode();", `${line}\n  const global = resolveGlobalCallRecordsMode();`);
    expect(problemsOfSweep(before)).not.toEqual([]);
    expect(problemsOfSweep(src.replace('async function sweepBattle', 'export async function sweepBattle'))).not.toEqual([]);
    // each condition names its own defect (RS-L4-8 / RS-L4-9): the import dropped; a SECOND forced read; the one read outside runCallSweep
    expect(problemsOfSweep(src.replace(', ensureReleaseView }', ' }'))).toContain('does not import ensureReleaseView from mode.js');
    expect(problemsOfSweep(src.replace(line, `${line}\n${line}`))).toContain('2 ensureReleaseView calls (want exactly one)');
    const outside = src.replace(line, '').replace('export async function runCallSweep', `async function __readViewOutside(db, deadlineMs) {\n${line}\n}\nexport async function runCallSweep`);
    expect(problemsOfSweep(outside)).toEqual(['no forced read inside runCallSweep']);
  });
  it('the evaluator: the import dropped and each anchor gone are caught by name', () => {
    const src = read('cron/agent-evaluate.js');
    expect(problemsOfEvaluator(src.replace('resolveCallRecordsMode, ensureReleaseView, ', 'resolveCallRecordsMode, '))).toContain('does not import ensureReleaseView from mode.js');
    expect(problemsOfEvaluator(src.replace('activeBattles.length === 0', 'activeBattles.length === 99'))).toContain('anchors not found');
    expect(problemsOfEvaluator(src.replace('for (const [index, battle] of activeBattles.entries())', 'for (const [index, battle] of activeBattles.slice().entries())'))).toContain('anchors not found');
  });
});
