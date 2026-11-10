#!/usr/bin/env node
import { readFile, stat, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createExperiment, verifyExperiment, digest } from './experiment.mjs';
import { demoInput } from './demo.mjs';
import { renderReport } from './report.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HERE = 'scripts/experiments/agent-workspace/';
const LIMIT = 5 * 1024 * 1024;

export async function readJson(file) {
  const size = (await stat(file)).size;
  if (size > LIMIT) throw new Error('Input exceeds the 5 MiB limit');
  const bytes = await readFile(file);
  if (bytes.length > LIMIT) throw new Error('Input exceeds the 5 MiB limit');
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('Input must be valid JSON. File contents were not printed.'); }
}

export async function sourceProvenance() {
  // Walk local static imports, including transitive helpers. Package-lock pins external dependencies.
  const pending = [HERE + 'run.mjs', 'src/theme/tokens.css', 'package-lock.json'];
  const seen = new Set();
  const files = [];
  while (pending.length) {
    const relative = pending.pop();
    if (seen.has(relative)) continue;
    seen.add(relative);
    const absolute = path.resolve(ROOT, relative);
    const bytes = await readFile(absolute);
    files.push({ path: relative, sha256: createHash('sha256').update(bytes).digest('hex') });
    if (!/\.(?:mjs|js)$/.test(relative)) continue;
    for (const match of bytes.toString('utf8').matchAll(/(?:import|export)\s[^;]*?\bfrom\s*['"](\.[^'"]+)['"]/g)) {
      const dependency = path.resolve(path.dirname(absolute), match[1]);
      const name = path.relative(ROOT, dependency).split(path.sep).join('/');
      if (name.startsWith('../')) throw new Error('Source import escapes the repository');
      pending.push(name);
    }
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return { gitCommit: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])), nodeVersion: process.version, sourceDigest: digest(files), files };
}

export function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (!['--demo', '--input', '--candidate', '--out', '--verify', '--help'].includes(name) || Object.hasOwn(out, name)) throw new Error(`Unknown or duplicate option: ${name}`);
    if (name === '--demo' || name === '--help') out[name] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
      out[name] = args[++i];
    }
  }
  if (out['--help']) return out;
  if (out['--verify']) {
    if (Object.keys(out).length !== 1) throw new Error('--verify is a standalone command');
  } else if (Number(Boolean(out['--demo'])) + Number(Boolean(out['--input'])) !== 1) {
    throw new Error('Choose exactly one of --demo or --input FILE');
  }
  return out;
}

export async function main(args = process.argv.slice(2)) {
  const opts = parseArgs(args);
  if (opts['--help']) {
    console.log('Offline agent workspace\n  node scripts/experiments/agent-workspace/run.mjs --demo [--candidate baseline-control-v1] [--out DIRECTORY]\n  node scripts/experiments/agent-workspace/run.mjs --input FILE [--candidate breakout-only-v1] [--out DIRECTORY]\n  node scripts/experiments/agent-workspace/run.mjs --verify RUN_JSON\nOpen the generated report.html manually. No server or browser opener runs.');
    return;
  }
  const provenance = await sourceProvenance();
  if (opts['--verify']) {
    const run = verifyExperiment(await readJson(opts['--verify']), provenance);
    console.log(`Verified ${run.runId}: integrity and deterministic replay match.`);
    return;
  }
  const input = opts['--demo'] ? demoInput() : await readJson(opts['--input']);
  const run = createExperiment({ input, candidate: opts['--candidate'], provenance, createdAt: new Date().toISOString() });
  verifyExperiment(run, provenance);
  const html = renderReport(run, await readFile(path.join(ROOT, 'src/theme/tokens.css'), 'utf8'));
  const output = path.resolve(opts['--out'] || path.join(ROOT, 'scripts/output/agent-workspace'));
  await mkdir(output, { recursive: true, mode: 0o700 });
  const folder = await mkdtemp(path.join(output, `${run.runId}-`));
  try {
    await writeFile(path.join(folder, 'run.json'), JSON.stringify(run, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await writeFile(path.join(folder, 'report.html'), html, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    await rm(folder, { recursive: true, force: true });
    throw error;
  }
  console.log(`Completed ${run.summary.total} saved cases. ${run.summary.changed} admission decisions changed.\nReport: ${path.join(folder, 'report.html')}\nRecord: ${path.join(folder, 'run.json')}\nNo model requests, market requests, or database writes.`);
  return { run, folder };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
