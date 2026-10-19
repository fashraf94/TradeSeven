#!/usr/bin/env node
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  ROOT, assertDarkSource, collectSnapshot, connectReadOnly, digest, outsideDirectory,
  provenance, readEnvironment, saveSnapshot, serviceAccount, verifySnapshot,
} from './capture.mjs';

const USAGE = `Stage A menu dry run (run from the checkout root):
  node scripts/experiments/archetype-menu-dry-run/run.mjs status [--env-file FILE]
  node scripts/experiments/archetype-menu-dry-run/run.mjs capture --project ID --out DIR [--env-file FILE]
  node scripts/experiments/archetype-menu-dry-run/run.mjs watch --project ID --out DIR [--hours 12] [--poll-seconds 60] [--env-file FILE]
  node scripts/experiments/archetype-menu-dry-run/run.mjs analyze --input DIR --out DIR [--control FILE]

Capture/watch only read Firestore. Watch requires this computer/process to remain running.
Analyze uses local snapshots and an isolated Vitest worker; no model or provider calls.
Use output folders outside all git checkouts. Do not publish raw snapshots.
Control JSON: {"heldSymbols":[],"benchSymbols":[],"equippedTickers":[],"hotBench":[]}
Without --control the fixed control book is empty. Both real flags must remain dark.
Environment: FIREBASE_ADMIN_CREDENTIALS (service-account JSON), or FIREBASE_PROJECT_ID +
FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS (service-account file).
Existing process variables override --env-file. Credentials are never printed.
`;

async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  if (command === 'help' || command === '--help') { console.log(USAGE); return; }
  const allowed = {
    status: ['env-file'], capture: ['project', 'out', 'env-file'],
    watch: ['project', 'out', 'env-file', 'hours', 'poll-seconds'], analyze: ['input', 'out', 'control'],
  };
  if (!allowed[command]) throw new Error('Unknown command; run with help.');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].slice(2);
    if (!args[i].startsWith('--') || !allowed[command].includes(key) || !args[i + 1] || args[i + 1].startsWith('--') || Object.hasOwn(options, key)) {
      throw new Error('Invalid or duplicate option; run with help.');
    }
    options[key] = args[i + 1];
  }
  assertDarkSource();
  if (command === 'status') {
    const account = serviceAccount(readEnvironment(options['env-file']));
    console.log(JSON.stringify({ code: provenance(), flags: 'both dark', credentialsAvailable: Boolean(account), projectId: account?.project_id ?? null }, null, 2));
    return;
  }
  if (!options.out) throw new Error('--out is required.');
  const output = outsideDirectory(options.out);
  if (command === 'analyze') {
    if (!options.input) throw new Error('--input is required.');
    const input = path.resolve(options.input);
    const files = readdirSync(input).filter(f => /^snapshot-[a-f0-9]{32}\.json$/.test(f)).sort();
    if (!files.length) throw new Error('No snapshot files found in --input.');
    const jobDirectory = mkdtempSync(path.join(os.tmpdir(), 'archetype-menu-job-'));
    try {
      const job = path.join(jobDirectory, 'job.json');
      const reportBase = path.join(output, `comparison-${Date.now()}`);
      writeFileSync(job, JSON.stringify({ files: files.map(f => path.join(input, f)),
        controlFile: options.control ? path.resolve(options.control) : null, reportBase, code: provenance() }), { mode: 0o600 });
      const require = createRequire(import.meta.url);
      const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
      // Only this explicitly selected worker gets the temporary flag mock.
      const child = spawnSync(process.execPath, [vitest, 'run', 'scripts/experiments/archetype-menu-dry-run/replay.test.js'], {
        cwd: ROOT, env: { ...process.env, TZ: 'UTC', MENU_DRY_RUN_JOB: job }, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
      });
      if (child.status !== 0) {
        rmSync(`${reportBase}.json`, { force: true });
        rmSync(`${reportBase}.md`, { force: true });
        writeFileSync(`${reportBase}-error.log`, `${child.stdout || ''}\n${child.stderr || ''}`, { flag: 'wx', mode: 0o600 });
        throw new Error(`Offline replay failed validation. Private diagnostics: ${reportBase}-error.log`);
      }
      console.log(`Comparison: ${reportBase}.md\nDetailed data: ${reportBase}.json`);
    } finally { rmSync(jobDirectory, { recursive: true, force: true }); }
    return;
  }
  if (!options.project) throw new Error('--project is required.');
  const hours = Number(options.hours ?? 12), seconds = Number(options['poll-seconds'] ?? 60);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168 || !Number.isFinite(seconds) || seconds < 15 || seconds > 3600) {
    throw new Error('Use 0 < --hours <= 168 and 15 <= --poll-seconds <= 3600.');
  }
  const connection = await connectReadOnly(readEnvironment(options['env-file']), options.project);
  try {
    if (command === 'capture') {
      const result = saveSnapshot(await collectSnapshot(connection.reader, { projectId: options.project }), output);
      console.log(`${result.saved ? 'Saved' : 'Already preserved'}: ${result.file}`);
      return;
    }
    const seen = new Set();
    for (const file of readdirSync(output).filter(f => /^snapshot-[a-f0-9]{32}\.json$/.test(f))) {
      const envelope = JSON.parse(readFileSync(path.join(output, file), 'utf8'));
      verifySnapshot(envelope);
      if (envelope.payload.projectId !== options.project) throw new Error('Output folder contains another project; choose a separate folder.');
      seen.add(digest([envelope.payload.rankings.updateTime, envelope.payload.rankings.data]));
    }
    const until = Date.now() + hours * 3600_000;
    console.log(`Reading project ${options.project} every ${seconds}s for up to ${hours}h. Ctrl+C stops collection. Standard Firestore read charges apply.`);
    let stopping = false, wake;
    const stop = () => { stopping = true; wake?.(); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    try {
      while (!stopping && Date.now() < until) {
        const heads = await connection.reader.heads();
        const key = digest([heads.rankings.updateTime, heads.rankings.data]);
        if (!seen.has(key)) {
          const envelope = await collectSnapshot(connection.reader, { projectId: options.project });
          const result = saveSnapshot(envelope, output);
          seen.add(digest([envelope.payload.rankings.updateTime, envelope.payload.rankings.data]));
          console.log(`${new Date().toISOString()} ${result.saved ? 'saved' : 'already preserved'} ${path.basename(result.file)}`);
        }
        if (!stopping) await new Promise(resolve => {
          const timer = setTimeout(resolve, Math.max(0, Math.min(seconds * 1000, until - Date.now())));
          wake = () => { clearTimeout(timer); resolve(); };
        });
      }
    } finally {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
    }
  } finally { await connection.close(); }
}

main().catch(error => {
  // SDK errors are opaque here: never echo credentials or server payloads.
  const local = error?.constructor === Error && !error.code && !/firebase|google-cloud|grpc/i.test(error.stack || '');
  console.error(local ? error.message : 'Capture/file operation failed. Check credentials, IAM read permission, network and local paths; no values logged.');
  process.exitCode = 1;
});
