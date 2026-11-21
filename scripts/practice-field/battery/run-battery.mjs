// scripts/practice-field/battery/run-battery.mjs
//
// THE FAST MUTATION BATTERY for the Practice Field idea book. Not shipped code; usage and the equivalence argument are
// in README.md beside this file. It replaces the session-scratchpad runner (every mutant against the whole ~1,400-row
// folder, one tree at a time — 2 to 4 hours a round) with:
//   1. N trees in parallel (default 4 × 4 workers), each an LF `git archive` of the commit under test with a
//      `node_modules` junction to the main checkout's install.
//   2. Per mutant, first only test files that can see the mutated file (importGraph.mjs). In the default `tiered` mode:
//      a FIRST tier of --first-files (default 6) related files — the cheapest file that killed this id before
//      (--prior), then the files with the most kills per second of cost so far — then the REST of the related files
//      up to --quick-fraction × the slowest file's baseline time. A file costs ~4 s of fork + import before its first
//      row, so a small well-chosen tier settles most kills in ~10–25 s where all related files take ~200 s.
//   3. A KILL in any tier is final: the same rows fail in the full run (vitest isolates each file). ANYTHING ELSE — survived,
//      broken, errored, timed out, or a kill resting only on timed-out rows — is decided by a run of the FULL row set
//      with the mutation still applied, judged exactly as the old runner judged, so the battery never reports a
//      survivor, or a broken mutant, the full folder would not. A full run whose only failures are timeouts is settled
//      by those files alone: in the tree at once, or in the QUIET PHASE once every tree is idle (the load can slow a
//      row past its limit, and "alone" is not alone while other trees run).
// Kept from the old runner: every `from` must occur exactly once (else BROKEN, never run, and printed); the files are
// restored and compared byte for byte after every mutant; defined ids are diffed against the ids that got a verdict.
// Offline: reads no env file and no credential; the vitest child gets the parent's environment with EODHD_API_KEY
// blanked, as the old runner did.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildGraph, relatedTests } from './importGraph.mjs';

const DEFAULT_ROWS = ['api/_utils/practiceField', 'api/practice-field', 'api/cron/practiceFieldIsolation.test.js', 'api/cron/practiceFieldNoBook.trace.test.js', 'api/_utils/compositionProtectedStores.scan.test.js'];
// A row that hit vitest's row/hook timeout. The JSON reporter writes the error's stack, which vitest 4 builds from an
// `Error('STACK_TRACE_ERROR')` made when the row starts (@vitest/runner makeTimeoutError), not the "timed out" message.
const TIMEOUT_SIGNATURE = /Test timed out in \d+ms|Hook timed out in \d+ms|^Error: STACK_TRACE_ERROR/m;
const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── arguments ────────────────────────────────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { sha: 'HEAD', trees: 4, workers: 4, mode: 'tiered', quickFraction: 0.35, first: 6, prior: [], only: [], verify: false, timeout: 900, rows: DEFAULT_ROWS, clean: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => { if (i + 1 >= argv.length) throw new Error(`${k} needs a value`); return argv[++i]; };
    if (k === '--mutants') a.mutants = v();
    else if (k === '--sha') a.sha = v();
    else if (k === '--out') a.out = v();
    else if (k === '--work') a.work = v();
    else if (k === '--trees') a.trees = Number(v());
    else if (k === '--workers') a.workers = Number(v());
    else if (k === '--mode') a.mode = v();
    else if (k === '--quick-fraction') a.quickFraction = Number(v());
    else if (k === '--first-files') a.first = Number(v());
    else if (k === '--prior') a.prior.push(v());
    else if (k === '--only') a.only.push(...v().split(',').filter(Boolean));
    else if (k === '--verify') a.verify = true;
    else if (k === '--timeout') a.timeout = Number(v());
    else if (k === '--rows') a.rows = v().split(',').filter(Boolean);
    else if (k === '--node-modules') a.nodeModules = v();
    else if (k === '--clean') a.clean = true;
    else throw new Error(`unknown argument ${k} (see README.md)`);
  }
  if (!['tiered', 'related', 'full'].includes(a.mode)) throw new Error('--mode is tiered, related or full');
  if (!a.clean && !a.mutants) throw new Error('--mutants <file.mjs> is required (see README.md)');
  if (!(a.trees >= 1 && a.workers >= 1 && a.quickFraction > 0 && a.quickFraction <= 1 && a.timeout > 0)) throw new Error('bad --trees/--workers/--quick-fraction/--timeout');
  if (!(Number.isInteger(a.first) && a.first >= 0)) throw new Error('bad --first-files');
  return a;
}

// ── git and the trees ────────────────────────────────────────────────────────────────────────────────────────────────
const git = (repo, args, opts = {}) => {
  const r = spawnSync('git', args, { cwd: repo, maxBuffer: 1 << 30, ...opts });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${String(r.stderr).trim()}`);
  return r.stdout;
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';

function extract(repo, sha, dir) {
  return new Promise((resolve, reject) => {
    const g = spawn('git', ['-c', 'core.autocrlf=false', 'archive', sha], { cwd: repo });
    const t = spawn(TAR, ['-x', '-f', '-', '-C', dir]);
    g.stdout.pipe(t.stdin);
    let err = '';
    g.stderr.on('data', (d) => { err += d; });
    t.stderr.on('data', (d) => { err += d; });
    let done = 0;
    const codes = [];
    const fin = (c) => { codes.push(c); if (++done === 2) (codes.every((x) => x === 0) ? resolve() : reject(new Error(`archive|tar failed (${codes}): ${err}`))); };
    g.on('close', fin);
    t.on('close', fin);
  });
}

/** Files under `dir`, links (the node_modules junction) not followed. */
function countFiles(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n++;
  }
  return n;
}

/** Remove a tree: the node_modules junction is UNLINKED first (never followed), and the shared install is re-checked. */
export function removeTree(tree, nodeModules) {
  const link = path.join(tree, 'node_modules');
  let st = null;
  try { st = lstatSync(link); } catch { /* no link */ }
  if (st) {
    if (!st.isSymbolicLink()) throw new Error(`${link} is not a link — refusing to delete the tree`);
    unlinkSync(link);
  }
  if (existsSync(link)) throw new Error(`${link} still exists after unlinking — refusing to delete the tree`);
  if (!existsSync(path.join(nodeModules, 'vitest', 'vitest.mjs'))) throw new Error(`the shared install at ${nodeModules} lost vitest — stop and check`);
  rmSync(tree, { recursive: true, force: true });
  if (!existsSync(path.join(nodeModules, 'vitest', 'vitest.mjs'))) throw new Error(`the shared install at ${nodeModules} lost vitest — stop and check`);
}

/** A verified tree of `sha` at `dir` (reused when its marker matches; any target file that differs is restored). */
async function prepareTree({ repo, sha, dir, nodeModules, targets, fileCount, log }) {
  const marker = `${dir}.json`;
  let reuse = false;
  if (existsSync(marker) && existsSync(dir)) {
    try { reuse = JSON.parse(readFileSync(marker, 'utf8')).sha === sha; } catch { reuse = false; }
    if (reuse && countFiles(dir) !== fileCount) { log(`  ${path.basename(dir)}: file count changed since it was made — rebuilding`); reuse = false; }
  }
  if (!reuse) {
    if (existsSync(dir)) removeTree(dir, nodeModules);
    if (existsSync(marker)) rmSync(marker);
    mkdirSync(dir, { recursive: true });
    await extract(repo, sha, dir);
    const n = countFiles(dir);
    if (n !== fileCount) throw new Error(`${dir}: ${n} files extracted, the commit has ${fileCount}`);
  }
  const link = path.join(dir, 'node_modules');
  if (!existsSync(link)) symlinkSync(nodeModules, link, 'junction');
  for (const rel of targets) {
    const want = git(repo, ['cat-file', 'blob', `${sha}:${rel}`]);
    const file = path.join(dir, rel);
    if (!existsSync(file) || !readFileSync(file).equals(want)) {
      if (reuse) log(`  ${path.basename(dir)}: ${rel} differed from the commit — restored (a run was interrupted mid-mutant)`);
      else throw new Error(`${dir}: ${rel} is not byte-identical to ${sha}:${rel} after extraction`);
      writeFileSync(file, want);
    }
  }
  if (!reuse) writeFileSync(marker, JSON.stringify({ sha, files: fileCount }));
  return { dir, reused: reuse };
}

// ── one vitest run ───────────────────────────────────────────────────────────────────────────────────────────────────
const relName = (tree, n) => path.relative(tree, n).split(path.sep).join('/');

function runVitest({ tree, vitest, files, workers, json, timeout }) {
  return new Promise((resolve) => {
    if (existsSync(json)) rmSync(json);
    const started = Date.now();
    const args = [vitest, 'run', ...files, `--maxWorkers=${workers}`, '--no-cache', '--reporter=json', `--outputFile=${json}`];
    const child = spawn(process.execPath, args, { cwd: tree, env: { ...process.env, EODHD_API_KEY: '' }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (d) => { tail = (tail + d).slice(-4000); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
      else try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
    }, timeout * 1000);
    child.on('close', (exit) => {
      clearTimeout(timer);
      const out = { exit, timedOut, seconds: Math.round((Date.now() - started) / 100) / 10, hasJson: existsSync(json), failed: [], timedOutRows: [], loadFailures: [], ranFiles: [], timeoutOnly: false, total: 0, tail };
      if (out.hasJson) {
        let j = null;
        try { j = JSON.parse(readFileSync(json, 'utf8')); } catch { out.hasJson = false; }
        if (j) {
          out.total = j.numTotalTests;
          for (const f of j.testResults || []) {
            const name = relName(tree, f.name);
            out.ranFiles.push(name);
            if ((f.assertionResults || []).length === 0 && f.status === 'failed') out.loadFailures.push(name);
            for (const a of f.assertionResults || []) {
              if (a.status !== 'failed') continue;
              const row = `${name} > ${a.fullName}`;
              out.failed.push(row);
              if (TIMEOUT_SIGNATURE.test((a.failureMessages || []).join('\n'))) out.timedOutRows.push(row);
            }
          }
          out.timeoutOnly = out.failed.length > 0 && out.timedOutRows.length === out.failed.length;
        }
      }
      resolve(out);
    });
  });
}

/** The old runner's judge, with its two silent cases named: a killed run (TIMEOUT) and a non-zero exit with no failing row (ERRORED — the old runner said SURVIVED). */
export function judge(run) {
  if (run.timedOut) return 'TIMEOUT';
  if (!run.hasJson) return 'BROKEN';
  if (run.failed.length > 0 && run.exit !== 0) return 'KILLED';
  if (run.loadFailures.length > 0) return 'BROKEN';
  if (run.exit !== 0) return 'ERRORED';
  return 'SURVIVED';
}

// ── mutants ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Every edit's `from` must occur exactly once in the commit's text (and, applied in order, in the text so far). */
export function planMutation(mutant, readText) {
  const originals = new Map();
  const mutated = new Map();
  for (const e of mutant.edits) {
    if (typeof e.file !== 'string' || path.isAbsolute(e.file) || e.file.split(/[\\/]/).includes('..')) return { broken: `bad file ${e.file}` };
    if (!originals.has(e.file)) originals.set(e.file, readText(e.file));
    const n = originals.get(e.file).split(e.from).length - 1;
    if (n !== 1) return { broken: `anchor occurs ${n} times in ${e.file}: ${e.from.slice(0, 80)}` };
    const cur = mutated.get(e.file) ?? originals.get(e.file);
    const at = cur.indexOf(e.from);
    if (at < 0 || cur.indexOf(e.from, at + 1) >= 0) return { broken: `anchor no longer occurs exactly once after this mutant's earlier edits in ${e.file}: ${e.from.slice(0, 80)}` };
    mutated.set(e.file, cur.slice(0, at) + e.to + cur.slice(at + e.from.length));   // a splice: `$&`, `$$` in `to` stay literal
  }
  return { originals, mutated };
}

// ── the battery ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = String(git(HERE, ['rev-parse', '--show-toplevel'])).trim();
  const common = path.resolve(repo, String(git(repo, ['rev-parse', '--git-common-dir'])).trim());
  const nodeModules = path.resolve(args.nodeModules ?? path.join(path.dirname(common), 'node_modules'));
  const vitest = path.join(nodeModules, 'vitest', 'vitest.mjs');
  if (!existsSync(vitest)) throw new Error(`no vitest at ${vitest} (pass --node-modules)`);
  const sha = String(git(repo, ['rev-parse', '--verify', `${args.sha}^{commit}`])).trim();
  const work = path.resolve(args.work ?? path.join(os.tmpdir(), 'pf-battery'), sha.slice(0, 12));
  const treeDirs = Array.from({ length: args.trees }, (_, i) => path.join(work, `t${i}`));

  if (args.clean) {
    for (const d of treeDirs.concat(existsSync(work) ? readdirSync(work).filter((n) => /^t\d+$/.test(n)).map((n) => path.join(work, n)) : [])) {
      if (existsSync(d)) { removeTree(d, nodeModules); console.log(`removed ${d}`); }
      if (existsSync(`${d}.json`)) rmSync(`${d}.json`);
    }
    return;
  }

  const out = path.resolve(args.out ?? path.join(work, `out-${new Date().toISOString().replace(/[:.]/g, '-')}`));
  mkdirSync(path.join(out, 'runs'), { recursive: true });
  const logFile = path.join(out, 'battery.log');
  const log = (s) => { console.log(s); writeFileSync(logFile, `${s}\n`, { flag: 'a' }); };
  const t0 = Date.now();
  const clock = () => `${((Date.now() - t0) / 60000).toFixed(1)} min`;

  const mutantsPath = path.resolve(args.mutants);
  const { MUTANTS } = await import(pathToFileURL(mutantsPath).href);
  const ids = new Set(MUTANTS.map((m) => m.id));
  if (ids.size !== MUTANTS.length) throw new Error('duplicate mutant ids');
  for (const id of args.only) if (!ids.has(id)) log(`SKIPPED ${id}: no such mutant in ${mutantsPath}`);
  const defined = MUTANTS.filter((m) => args.only.length === 0 || args.only.includes(m.id));
  const targets = [...new Set(defined.flatMap((m) => m.edits.map((e) => e.file)))].filter((f) => typeof f === 'string' && !path.isAbsolute(f) && !f.split(/[\\/]/).includes('..'));
  const fileCount = String(git(repo, ['ls-tree', '-r', '--name-only', '-z', sha])).split('\0').filter(Boolean).length;
  log(`battery: ${sha} · mutants ${mutantsPath} (sha256 ${sha256(readFileSync(mutantsPath)).slice(0, 16)}…, ${defined.length} defined) · mode ${args.mode}${args.verify ? ' + verify' : ''} · ${args.trees} trees × ${args.workers} workers · out ${out}`);

  // trees, in parallel
  const trees = await Promise.all(treeDirs.map((dir) => prepareTree({ repo, sha, dir, nodeModules, targets, fileCount, log })));
  log(`trees ready (${trees.filter((t) => t.reused).length} reused) at ${clock()}`);

  // anchors, against the commit's bytes — broken mutants are never run
  const blob = new Map();
  const readText = (f) => { if (!blob.has(f)) blob.set(f, String(git(repo, ['cat-file', 'blob', `${sha}:${f}`]))); return blob.get(f); };
  const results = [];
  const queue = [];
  for (const m of defined) {
    let plan;
    try { plan = planMutation(m, readText); } catch (e) { plan = { broken: e.message.split('\n')[0] }; }
    if (plan.broken) { results.push({ id: m.id, item: m.item ?? null, named: m.named ?? null, verdict: 'BROKEN', why: plan.broken }); log(`BROKEN MUTANT ${m.id}: ${plan.broken}`); }
    else queue.push({ m, plan });
  }

  // the baseline: the full row set ONCE, sharded across the trees (tree i runs shard i+1 of N, all at once — the
  // battery's own load). Every shard green; together they are one full run, and give each file's time.
  const shard = (i) => (args.trees > 1 ? [...args.rows, `--shard=${i + 1}/${args.trees}`] : args.rows);
  const baselines = await Promise.all(trees.map((t, i) => runVitest({ tree: t.dir, vitest, files: shard(i), workers: args.workers, json: path.join(out, 'runs', `baseline-t${i}.json`), timeout: args.timeout })));
  for (const [i, b] of baselines.entries()) {
    log(`baseline shard ${i + 1}/${args.trees} on t${i}: exit ${b.exit}, ${b.total} rows, ${b.ranFiles.length} files, failing ${b.failed.length}, load failures ${b.loadFailures.length}, ${b.seconds} s`);
    // a row that only timed out under the battery's own load: green if its files pass alone
    if (judge(b) === 'KILLED' && b.timeoutOnly && b.loadFailures.length === 0) {
      const alone = await runVitest({ tree: trees[i].dir, vitest, files: [...new Set(b.failed.map((x) => x.split(' > ')[0]))], workers: 1, json: path.join(out, 'runs', `baseline-t${i}-alone.json`), timeout: args.timeout });
      if (judge(alone) === 'SURVIVED') {
        log(`  ⚠ t${i}: ${b.failed.length} row(s) timed out under load and pass alone — load-sensitive: ${b.failed.join(' | ').slice(0, 300)}`);
        b.loadSensitive = b.failed;
        b.exit = 0;
        b.failed = [];
      }
    }
  }
  const fullFiles = baselines.flatMap((b) => b.ranFiles);
  const fullRows = baselines.reduce((s, b) => s + b.total, 0);
  if (baselines.some((b) => judge(b) !== 'SURVIVED') || new Set(fullFiles).size !== fullFiles.length || fullFiles.length === 0) {
    log('the baseline is not green (or its shards overlap) — nothing was mutated. Under load, try fewer --trees or --workers.');
    for (const b of baselines) if (b.failed.length) log(`  ${b.failed.slice(0, 5).join('\n  ')}`);
    process.exit(2);
  }
  const durations = new Map();
  for (const [i] of baselines.entries()) {
    const j = JSON.parse(readFileSync(path.join(out, 'runs', `baseline-t${i}.json`), 'utf8'));
    for (const f of j.testResults) durations.set(relName(trees[i].dir, f.name), (f.endTime - f.startTime) / 1000);
  }
  const slowest = Math.max(...durations.values());
  const quickCut = slowest * args.quickFraction;
  const graph = buildGraph(trees[0].dir, fullFiles);
  log(`baseline green: ${fullRows} rows in ${fullFiles.length} files · graph: ${graph.modulesRead} modules · slowest file ${slowest.toFixed(1)} s, quick cut ${quickCut.toFixed(1)} s · ${clock()}`);

  // kill history: which files killed which ids before (--prior results, the old runner's or this one's), and which
  // files have killed most in this run so far. It only ORDERS the first tier; it never decides a verdict.
  const priorKillers = new Map();
  const killCount = new Map();
  const countKill = (files) => { for (const f of files) killCount.set(f, (killCount.get(f) ?? 0) + 1); };
  for (const p of args.prior) {
    const j = JSON.parse(readFileSync(path.resolve(p), 'utf8'));
    for (const r of j.results || []) {
      if (r.verdict !== 'KILLED') continue;
      const rows = r.stages ? r.stages.filter((s) => s.verdict === 'KILLED').flatMap((s) => s.failedRows) : (r.first || []);
      const files = new Set(rows.map((x) => x.split(' > ')[0]).filter((f) => fullFiles.includes(f)));
      if (files.size) { priorKillers.set(r.id, new Set([...(priorKillers.get(r.id) ?? []), ...files])); countKill(files); }
    }
  }
  if (args.prior.length) log(`prior: killing files known for ${priorKillers.size} ids`);

  /** The stages before the full row set: [label, files] each. */
  const tiersFor = (m) => {
    const related = relatedTests(graph, [...new Set(m.edits.map((e) => e.file))]).map((r) => r.test);
    if (args.mode === 'full') return { related, tiers: [] };
    if (args.mode === 'related') return { related, tiers: related.length ? [['related', related]] : [] };
    const dur = (f) => durations.get(f) ?? slowest;
    const first = [];
    if (args.first > 0) {
      // the cheapest file that killed this id before, then the files with the most kills per second of cost (a file
      // costs ~4 s before its first row) — no slower than that anchor; with no kills yet, the cheapest files
      const anchor = [...(priorKillers.get(m.id) ?? [])].sort((a, b) => dur(a) - dur(b))[0];
      if (anchor) first.push(anchor);
      const cap = anchor ? Math.max(dur(anchor), 2) : Infinity;
      const score = (f) => ((killCount.get(f) ?? 0) + 0.01) / (4 + dur(f));
      for (const f of [...related].sort((a, b) => score(b) - score(a))) if (first.length < args.first && !first.includes(f) && dur(f) <= cap) first.push(f);
    }
    const rest = related.filter((f) => dur(f) <= quickCut && !first.includes(f));
    return { related, tiers: [first.length ? ['first', first] : null, rest.length ? ['quick', rest] : null].filter(Boolean) };
  };
  const summarize = (r) => ({ verdict: judge(r), exit: r.exit, seconds: r.seconds, failing: r.failed.length, first: r.failed.slice(0, 3), failedRows: r.failed, timedOutRows: r.timedOutRows, loadFailures: r.loadFailures, timeoutOnly: r.timeoutOnly, files: r.ranFiles.length });
  const filesOf = (rows) => [...new Set(rows.map((x) => x.split(' > ')[0]))];
  const applyMutation = (t, plan) => { for (const [f, text] of plan.mutated) writeFileSync(path.join(t.dir, f), text); };
  const restoreMutation = (t, plan) => {
    for (const [f, text] of plan.originals) writeFileSync(path.join(t.dir, f), text);
    for (const [f, text] of plan.originals) if (sha256(readFileSync(path.join(t.dir, f))) !== sha256(Buffer.from(text))) throw new Error(`restore failed: ${t.dir} ${f}`);
  };
  // a full stage whose only failures are timeouts that also time out alone while other trees run waits here for the
  // quiet phase; --verify's inputs wait with it
  const quiet = [];
  const verifyInputs = new Map();
  const save = () => {
    const tmp = path.join(out, 'results.json.tmp');
    writeFileSync(tmp, JSON.stringify({ sha, mutants: mutantsPath, mode: args.mode, verify: args.verify, trees: args.trees, workers: args.workers, baseline: { rows: fullRows, files: fullFiles.length, slowest, quickCut, durations: Object.fromEntries(durations) }, results }, null, 1));
    renameSync(tmp, path.join(out, 'results.json'));
  };

  async function runMutant(t, i, { m, plan }) {
    const rec = { id: m.id, item: m.item ?? null, named: m.named ?? null, tree: `t${i}`, stages: [] };
    applyMutation(t, plan);
    const run = async (label, files, workers = args.workers) => {
      const r = await runVitest({ tree: t.dir, vitest, files, workers, json: path.join(out, 'runs', `${m.id}.${label}.json`), timeout: args.timeout });
      const s = { stage: label, asked: files, ...summarize(r) };
      rec.stages.push(s);
      return { r, s };
    };
    try {
      const { related, tiers } = tiersFor(m);
      rec.related = related.length;
      let decided = null;
      for (const [label, files] of tiers) {
        const { r, s } = await run(label, files);
        const inFull = r.ranFiles.every((f) => fullFiles.includes(f)) && files.every((f) => r.ranFiles.includes(f));
        if (!inFull) s.note = 'ran files differ from those asked for — not decisive';
        // a kill resting only on timed-out rows may be the load, and a re-run "alone" is not alone while other trees
        // run: never decisive here — the full stage, and if need be the quiet phase, settles it
        else if (s.verdict === 'KILLED' && r.timeoutOnly) s.note = 'its only failures are timeouts — not decisive';
        else if (s.verdict === 'KILLED') decided = { verdict: 'KILLED', by: label };
        if (decided) break;
      }
      if (!decided || args.verify) {
        const { r, s } = await run('full', args.rows);
        let full = { verdict: s.verdict, by: 'full' };
        if (s.verdict === 'KILLED' && r.timeoutOnly) {
          // every other row passed with the mutation in place. The timed-out files again, alone, one worker: a pass
          // settles it, and so does a real failing row; another timeout waits for the quiet phase
          const alone = await run('full-alone', filesOf(r.failed), 1);
          if (alone.s.verdict === 'SURVIVED') full = { verdict: 'SURVIVED', by: 'full (its only failures were timeouts under load, which pass alone)' };
          else if (alone.s.verdict === 'KILLED' && !alone.r.timeoutOnly) full = { verdict: 'KILLED', by: 'full (a timed-out file fails alone)' };
          else {
            full = { verdict: 'PENDING', by: 'quiet' };
            quiet.push({ rec, plan, files: filesOf(r.failed) });
          }
        }
        if (!decided) decided = full;
        if (args.verify) verifyInputs.set(m.id, { related, full: r, fullVerdict: full.verdict });
      }
      Object.assign(rec, decided);
      rec.seconds = Math.round(rec.stages.reduce((s, x) => s + x.seconds, 0));
      if (rec.verdict === 'KILLED') countKill(new Set(rec.stages.filter((s) => s.verdict === 'KILLED').flatMap((s) => filesOf(s.failedRows))));
      const vi = verifyInputs.get(m.id);
      if (vi && vi.fullVerdict !== 'PENDING') rec.verify = verifyOne(rec, vi);
    } finally {
      restoreMutation(t, plan);
    }
    return rec;
  }

  /** --verify: the battery's verdict against the full row set's, each early stage's failing rows against the full
   *  run's rows on the same files, and every file that failed in the full run inside the related set. Timed-out
   *  rows are left out of the row check on both sides (the load decides them), and counted. */
  function verifyOne(rec, { related, full, fullVerdict }) {
    const early = rec.stages.filter((s) => s.stage !== 'full' && s.stage !== 'quiet' && !s.stage.endsWith('-alone'));
    const failingFiles = [...new Set([...filesOf(full.failed), ...full.loadFailures])];
    const timedOut = new Set([...full.timedOutRows, ...early.flatMap((s) => s.timedOutRows)]);
    const mine = (s) => s.failedRows.filter((x) => !timedOut.has(x)).sort();
    const rowsOf = (s) => full.failed.filter((x) => s.asked.includes(x.split(' > ')[0]) && !timedOut.has(x)).sort();
    const rowDiffs = early.filter((s) => JSON.stringify(mine(s)) !== JSON.stringify(rowsOf(s))).map((s) => s.stage);
    return {
      fullVerdict,
      batteryVerdict: rec.verdict,
      verdictsAgree: rec.verdict === fullVerdict,
      rowsAgree: rowDiffs.length === 0,
      rowDiffs,
      timedOutRowsLeftOut: [...timedOut],
      contained: failingFiles.every((f) => related.includes(f)),
      missedFiles: failingFiles.filter((f) => !related.includes(f)),
    };
  }
  const logRec = (rec, where) => {
    const st = rec.stages.map((s) => `${s.stage} ${s.files}f ${s.seconds}s`).join(' → ');
    log(`[${where} ${clock()}] ${rec.id}: ${rec.verdict} by ${rec.by} (${st}; ${rec.stages.at(-1).failing} failing) ${rec.stages.find((s) => s.verdict === 'KILLED')?.first[0] ?? ''}${rec.warning ? ` ⚠ ${rec.warning}` : ''}${rec.verify ? ` · verify: agree ${rec.verify.verdictsAgree}, rows ${rec.verify.rowsAgree}, contained ${rec.verify.contained}` : ''}`.slice(0, 600));
  };

  // the trees pull from one queue
  let next = 0;
  await Promise.all(trees.map(async (t, i) => {
    while (next < queue.length) {
      const job = queue[next++];
      const rec = await runMutant(t, i, job);
      results.push(rec);
      logRec(rec, `t${i}`);
      save();
    }
  }));

  // the quiet phase: every tree is idle now. Each waiting mutant is re-applied in t0 and its timed-out files run
  // alone, one worker, with nothing else of the battery's running. A pass: SURVIVED. A real failing row, or a timeout
  // again: KILLED (a timeout again means the mutation hangs or slows a row past its limit — flagged to look at).
  // The row timeouts are the suite's own; they are never raised.
  if (quiet.length) log(`quiet phase: ${quiet.length} mutant(s) whose only failures timed out, and timed out again alone while other trees ran · ${clock()}`);
  for (const q of quiet) {
    const t = trees[0];
    applyMutation(t, q.plan);
    let s;
    try {
      const r = await runVitest({ tree: t.dir, vitest, files: q.files, workers: 1, json: path.join(out, 'runs', `${q.rec.id}.quiet.json`), timeout: args.timeout });
      s = { stage: 'quiet', asked: q.files, ...summarize(r) };
      q.rec.stages.push(s);
    } finally {
      restoreMutation(t, q.plan);
    }
    const settled = s.verdict === 'SURVIVED' ? { verdict: 'SURVIVED', by: 'quiet (its only failures were timeouts under load, which pass alone with the battery idle)' } : { verdict: s.verdict, by: 'quiet' };
    if (q.rec.verdict === 'PENDING') {
      Object.assign(q.rec, settled);
      if (s.verdict === 'KILLED' && s.timeoutOnly) q.rec.warning = 'killed only by rows that time out alone with the battery idle (a hang, or a row slowed past its limit) — look';
    }
    q.rec.seconds = Math.round(q.rec.stages.reduce((sum, x) => sum + x.seconds, 0));
    const v = verifyInputs.get(q.rec.id);
    if (v) { v.fullVerdict = settled.verdict; q.rec.verify = verifyOne(q.rec, v); }
    logRec(q.rec, 'quiet');
    save();
  }

  // the tally, and every defined id accounted for
  const tally = (v) => results.filter((r) => r.verdict === v).length;
  const got = new Set(results.map((r) => r.id));
  const missing = defined.filter((m) => !got.has(m.id)).map((m) => m.id);
  const byStage = {};
  for (const r of results) if (r.by) { const k = r.by.split(' ')[0]; byStage[k] = (byStage[k] ?? 0) + 1; }
  log(`defined ${defined.length}, ran ${results.filter((r) => r.stages).length}, broken ${tally('BROKEN')}, killed ${tally('KILLED')}, survived ${tally('SURVIVED')}, errored ${tally('ERRORED')}, timeout ${tally('TIMEOUT')} · decided by ${Object.entries(byStage).map(([k, n]) => `${k} ${n}`).join(', ')} · ${clock()}`);
  if (missing.length) log(`NO VERDICT for ${missing.length}: ${missing.join(' ')}`);
  for (const r of results.filter((x) => ['SURVIVED', 'ERRORED', 'TIMEOUT', 'PENDING'].includes(x.verdict) || x.warning)) log(`  look: ${r.id} ${r.verdict}${r.warning ? ` ⚠ ${r.warning}` : ''}`);
  if (args.verify) {
    const v = results.filter((r) => r.verify);
    const leftOut = v.reduce((n, r) => n + r.verify.timedOutRowsLeftOut.length, 0);
    log(`verify: ${v.length} mutants · verdicts agree ${v.filter((r) => r.verify.verdictsAgree).length} · early-stage rows = full rows on those files ${v.filter((r) => r.verify.rowsAgree).length} (timed-out rows left out: ${leftOut}) · failing files inside the related set ${v.filter((r) => r.verify.contained).length}`);
  }
  save();
  for (const t of trees) for (const f of targets) if (!readFileSync(path.join(t.dir, f)).equals(git(repo, ['cat-file', 'blob', `${sha}:${f}`]))) throw new Error(`${t.dir} ${f} is not the commit's bytes at the end`);
  log(`every target file in every tree is the commit's bytes · results ${path.join(out, 'results.json')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(HERE, 'run-battery.mjs')) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
