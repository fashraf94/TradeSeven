import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep, join } from 'node:path';

const missionId = 'BACKING-OFFLINE-001';
const testFiles = ['scripts/backingSmokeLib.test.js', 'api/_utils/backingSmoke.test.js'];
const timeoutMs = 180_000;
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const outputArg = option('--output');
const sourceCommit = option('--commit');

if (!outputArg || !/^[0-9a-f]{40}$/.test(sourceCommit ?? '')) {
  process.stderr.write('Usage: node tester/run-backing-offline.mjs --output <directory> --commit <40-character SHA>\n');
  process.exit(2);
}

const output = resolve(outputArg);
const withinCheckout = relative(process.cwd(), output);
if (withinCheckout === '' || (withinCheckout !== '..' && !withinCheckout.startsWith(`..${sep}`) && !isAbsolute(withinCheckout))) {
  process.stderr.write('Evidence directory must be outside the checkout.\n');
  process.exit(2);
}

mkdirSync(output, { recursive: true });
const startedAt = new Date();
const logPath = join(output, 'run.log');
const resultPath = join(output, 'result.json');
const command = ['node', 'node_modules/vitest/vitest.mjs', 'run', ...testFiles];

function finish(outcome, reason, execution = {}) {
  const finishedAt = new Date();
  const result = {
    missionId, outcome, reason, sourceCommit,
    startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt - startedAt, command, testFiles,
    exitCode: execution.exitCode ?? null, testsPassed: execution.testsPassed ?? null,
    testFilesPassed: execution.testFilesPassed ?? null, logPath: 'run.log',
  };
  writeFileSync(logPath, execution.log ?? `${reason}\n`);
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${missionId}: ${outcome}${reason ? ` (${reason})` : ''}\nEvidence: ${output}\n`);
  process.exit(outcome === 'PASS' ? 0 : outcome === 'FAIL' ? 1 : 2);
}

for (const file of [...testFiles, 'node_modules/vitest/vitest.mjs']) {
  if (!existsSync(resolve(file))) finish('BLOCKED', `Missing input: ${file}`);
}

// Give the test process only these values, even when an operator's shell has credentials.
const env = {
  PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
  HOME: '/tmp', CI: '1', TZ: 'UTC', NODE_ENV: 'test',
};
const run = spawnSync(process.execPath, command.slice(1), {
  cwd: process.cwd(), env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024,
});
const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;
if (run.error) finish('BLOCKED', run.error.code === 'ETIMEDOUT' ? 'Timeout after 180 seconds' : `Runner error: ${run.error.code ?? run.error.message}`, { log, exitCode: run.status });
if (run.signal) finish('BLOCKED', `Test process ended with signal ${run.signal}`, { log, exitCode: run.status });
if (run.status !== 0) finish('FAIL', `Vitest exited ${run.status}`, { log, exitCode: run.status });

// A zero exit without both selected files in the summary is not evidence of a pass.
const plain = log.replace(/\x1b\[[0-9;]*m/g, '');
const files = plain.match(/Test Files\s+(\d+) passed\s+\((\d+)\)/);
const tests = plain.match(/Tests\s+(\d+) passed\s+\((\d+)\)/);
if (!files || !tests || Number(files[1]) !== 2 || Number(files[2]) !== 2 || Number(tests[1]) < 1 || tests[1] !== tests[2]) {
  finish('BLOCKED', 'Vitest did not confirm both selected files and all tests passed', { log, exitCode: run.status });
}
finish('PASS', 'Both selected suites passed', {
  log, exitCode: run.status, testFilesPassed: Number(files[1]), testsPassed: Number(tests[1]),
});
