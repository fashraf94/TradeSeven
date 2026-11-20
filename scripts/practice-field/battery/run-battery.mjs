// scripts/practice-field/battery/run-battery.mjs
//
// THE FAST MUTATION BATTERY for the Practice Field idea book. Not shipped code; usage and the equivalence argument are
// in README.md beside this file. It replaces the session-scratchpad runner (every mutant against the whole ~1,400-row
// folder, one tree at a time — 2 to 4 hours a round) with:
//   1. N trees in parallel (default 4 × 4 workers), each an LF `git archive` of the commit under test with a
//      `node_modules` junction to the main checkout's install.
//   2. Per mutant, first only the test files that can see the mutated file (importGraph.mjs). In the default `tiered`
//      mode, only the related files that are QUICK (baseline time ≤ --quick-fraction × the slowest file's).
//   3. A KILL there is final: the same rows fail in the full run (vitest isolates each file). ANYTHING ELSE — survived,
//      broken, errored, timed out — is decided by a run of the FULL row set with the mutation still applied, judged
//      exactly as the old runner judged, so the battery never reports a survivor, or a broken mutant, the full folder
//      would not.
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
  const a = { sha: 'HEAD', trees: 4, workers: 4, mode: 'tiered', quickFraction: 0.125, only: [], verify: false, timeout: 900, rows: DEFAULT_ROWS, clean: false };
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
      const out = { exit, timedOut, seconds: Math.round((Date.now() - started) / 100) / 10, hasJson: existsSync(json), failed: [], loadFailures: [], ranFiles: [], timeoutOnly: false, total: 0, tail };
      if (out.hasJson) {
        let j = null;
        try { j = JSON.parse(readFileSync(json, 'utf8')); } catch { out.hasJson = false; }
        if (j) {
          out.total = j.numTotalTests;
          const msgs = [];
          for (const f of j.testResults || []) {
            const name = relName(tree, f.name);
            out.ranFiles.push(name);
            if ((f.assertionResults || []).length === 0 && f.status === 'failed') out.loadFailures.push(name);
            for (const a of f.assertionResults || []) if (a.status === 'failed') { out.failed.push(`${name} > ${a.fullName}`); msgs.push((a.failureMessages || []).join('\n')); }
          }
          out.timeoutOnly = out.failed.length > 0 && msgs.every((m) => TIMEOUT_SIGNATURE.test(m));
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

  // baselines: the full row set on every tree at once (the battery's own load), all green and alike
  const baselines = await Promise.all(trees.map((t, i) => runVitest({ tree: t.dir, vitest, files: args.rows, workers: args.workers, json: path.join(out, 'runs', `baseline-t${i}.json`), timeout: args.timeout })));
  for (const [i, b] of baselines.entries()) log(`baseline t${i}: exit ${b.exit}, ${b.total} rows, ${b.ranFiles.length} files, failing ${b.failed.length}, load failures ${b.loadFailures.length}, ${b.seconds} s`);
  if (baselines.some((b) => judge(b) !== 'SURVIVED' || b.total !== baselines[0].total)) {
    log('a baseline is not green (or the trees disagree) — nothing was mutated. Under load, try fewer --trees or --workers.');
    for (const b of baselines) if (b.failed.length) log(`  ${b.failed.slice(0, 5).join('\n  ')}`);
    process.exit(2);
  }
  const fullFiles = baselines[0].ranFiles;
  const durations = new Map();
  for (const [i, b] of baselines.entries()) {
    const j = JSON.parse(readFileSync(path.join(out, 'runs', `baseline-t${i}.json`), 'utf8'));
    for (const f of j.testResults) { const n = relName(trees[i].dir, f.name); durations.set(n, (durations.get(n) ?? 0) + (f.endTime - f.startTime) / 1000 / baselines.length); }
  }
  const slowest = Math.max(...durations.values());
  const quickCut = slowest * args.quickFraction;
  const graph = buildGraph(trees[0].dir, fullFiles);
  log(`graph: ${fullFiles.length} test files, ${graph.modulesRead} modules; slowest file ${slowest.toFixed(1)} s, quick cut ${quickCut.toFixed(1)} s · ${clock()}`);

  const stage1Files = (m) => {
    const related = relatedTests(graph, [...new Set(m.edits.map((e) => e.file))]).map((r) => r.test);
    if (args.mode === 'full') return { related, files: null };
    const files = args.mode === 'tiered' ? related.filter((f) => (durations.get(f) ?? Infinity) <= quickCut) : related;
    return { related, files: files.length > 0 ? files : null };
  };
  const summarize = (r) => ({ verdict: judge(r), exit: r.exit, seconds: r.seconds, failing: r.failed.length, first: r.failed.slice(0, 3), failedRows: r.failed, loadFailures: r.loadFailures, timeoutOnly: r.timeoutOnly, files: r.ranFiles.length });
  const save = () => {
    const tmp = path.join(out, 'results.json.tmp');
    writeFileSync(tmp, JSON.stringify({ sha, mutants: mutantsPath, mode: args.mode, verify: args.verify, trees: args.trees, workers: args.workers, baseline: { rows: baselines[0].total, files: fullFiles.length, slowest, quickCut }, results }, null, 1));
    renameSync(tmp, path.join(out, 'results.json'));
  };

  async function runMutant(t, i, { m, plan }) {
    const rec = { id: m.id, item: m.item ?? null, named: m.named ?? null, tree: `t${i}`, stages: [] };
    for (const [f, text] of plan.mutated) writeFileSync(path.join(t.dir, f), text);
    const run = async (label, files, workers = args.workers) => {
      const r = await runVitest({ tree: t.dir, vitest, files, workers, json: path.join(out, 'runs', `${m.id}.${label}.json`), timeout: args.timeout });
      const s = { stage: label, ...summarize(r) };
      rec.stages.push(s);
      return { r, s };
    };
    try {
      const { related, files } = stage1Files(m);
      rec.related = related.length;
      let decided = null;
      if (files) {
        const { r, s } = await run(args.mode, files);
        const inFull = r.ranFiles.every((f) => fullFiles.includes(f)) && files.every((f) => r.ranFiles.includes(f));
        if (!inFull) s.note = 'ran files differ from those asked for — not decisive';
        else if (s.verdict === 'KILLED' && r.timeoutOnly) {
          const alone = await run(`${args.mode}-alone`, [...new Set(r.failed.map((x) => x.split(' > ')[0]))], 1);
          if (alone.s.verdict === 'KILLED' && !alone.r.timeoutOnly) decided = { verdict: 'KILLED', by: `${args.mode} (timeouts confirmed alone)` };
        } else if (s.verdict === 'KILLED') decided = { verdict: 'KILLED', by: args.mode };
      }
      if (!decided || args.verify) {
        const { r, s } = await run('full', args.rows);
        if (!decided) {
          decided = { verdict: s.verdict, by: 'full' };
          if (s.verdict === 'KILLED' && r.timeoutOnly) {
            const alone = await run('full-alone', [...new Set(r.failed.map((x) => x.split(' > ')[0]))], 1);
            if (alone.s.verdict !== 'KILLED') rec.warning = 'killed only by timed-out rows, which pass alone — look before trusting this kill';
          }
        }
        if (args.verify) rec.verify = verifyOne(rec, related, files, r);
      }
      Object.assign(rec, decided);
    } finally {
      for (const [f, text] of plan.originals) writeFileSync(path.join(t.dir, f), text);
      for (const [f, text] of plan.originals) if (sha256(readFileSync(path.join(t.dir, f))) !== sha256(Buffer.from(text))) throw new Error(`restore failed: ${t.dir} ${f}`);
    }
    return rec;
  }

  function verifyOne(rec, related, files, full) {
    const s1 = rec.stages.find((s) => s.stage === args.mode);
    const fullVerdict = judge(full);
    const s1Verdict = s1 ? s1.verdict : null;
    const failingFiles = [...new Set([...full.failed.map((x) => x.split(' > ')[0]), ...full.loadFailures])];
    const scoped = s1 ? full.failed.filter((x) => files.includes(x.split(' > ')[0])).sort() : [];
    return {
      fullVerdict,
      stage1Verdict: s1Verdict,
      batteryVerdict: s1Verdict === 'KILLED' ? 'KILLED' : fullVerdict,
      verdictsAgree: (s1Verdict === 'KILLED' ? 'KILLED' : fullVerdict) === fullVerdict,
      rowsAgree: s1 ? JSON.stringify([...s1.failedRows].sort()) === JSON.stringify(scoped) : null,
      contained: failingFiles.every((f) => related.includes(f)),
      missedFiles: failingFiles.filter((f) => !related.includes(f)),
    };
  }

  // the trees pull from one queue
  let next = 0;
  await Promise.all(trees.map(async (t, i) => {
    while (next < queue.length) {
      const job = queue[next++];
      const rec = await runMutant(t, i, job);
      results.push(rec);
      const st = rec.stages.map((s) => `${s.stage} ${s.files}f ${s.seconds}s`).join(' → ');
      log(`[t${i} ${clock()}] ${rec.id}: ${rec.verdict} by ${rec.by} (${st}; ${rec.stages.at(-1).failing} failing) ${rec.stages.find((s) => s.verdict === 'KILLED')?.first[0] ?? ''}${rec.warning ? ` ⚠ ${rec.warning}` : ''}${rec.verify ? ` · verify: agree ${rec.verify.verdictsAgree}, rows ${rec.verify.rowsAgree}, contained ${rec.verify.contained}` : ''}`.slice(0, 600));
      save();
    }
  }));

  // the tally, and every defined id accounted for
  const tally = (v) => results.filter((r) => r.verdict === v).length;
  const got = new Set(results.map((r) => r.id));
  const missing = defined.filter((m) => !got.has(m.id)).map((m) => m.id);
  log(`defined ${defined.length}, ran ${results.filter((r) => r.stages).length}, broken ${tally('BROKEN')}, killed ${tally('KILLED')} (${results.filter((r) => r.by && r.by !== 'full').length} decided before the full row set), survived ${tally('SURVIVED')}, errored ${tally('ERRORED')}, timeout ${tally('TIMEOUT')} · ${clock()}`);
  if (missing.length) log(`NO VERDICT for ${missing.length}: ${missing.join(' ')}`);
  for (const r of results.filter((x) => x.verdict === 'SURVIVED' || x.verdict === 'ERRORED' || x.verdict === 'TIMEOUT' || x.warning)) log(`  look: ${r.id} ${r.verdict}${r.warning ? ` ⚠ ${r.warning}` : ''}`);
  if (args.verify) {
    const v = results.filter((r) => r.verify);
    log(`verify: ${v.length} mutants · verdicts agree ${v.filter((r) => r.verify.verdictsAgree).length} · stage-1 rows = full rows on those files ${v.filter((r) => r.verify.rowsAgree !== false).length} · failing files inside the related set ${v.filter((r) => r.verify.contained).length}`);
  }
  save();
  for (const t of trees) for (const f of targets) if (!readFileSync(path.join(t.dir, f)).equals(git(repo, ['cat-file', 'blob', `${sha}:${f}`]))) throw new Error(`${t.dir} ${f} is not the commit's bytes at the end`);
  log(`every target file in every tree is the commit's bytes · results ${path.join(out, 'results.json')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(HERE, 'run-battery.mjs')) {
  main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
