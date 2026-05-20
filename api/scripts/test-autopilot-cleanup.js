#!/usr/bin/env node
// api/scripts/test-autopilot-cleanup.js
//
// Read-only behavioral test harness for the auto-pilot cleanup PR
// (claude/autopilot-default-cleanup, PR #421).
//
// Confirms:
//   B1 — Newly created battles default to executionMode='autopilot'
//   B2 — No active battles remain in copilot/manual mode (post-migration)
//   B3 — No active battles carry a stale pendingProposal (post-migration)
//   B4 — Code-level default flip in agentBattleService.js
//   B5 — Zero `|| 'copilot'` fallbacks in agent-evaluate.js
//   B6 — Migration script is safe in dry-run (no writes)
//
// All Firestore queries are READ-ONLY. B6 invokes the migration script with
// no flags (the script's own default is dry-run; it writes nothing without
// `--execute`).
//
// Usage:
//   node --env-file=.env.local api/scripts/test-autopilot-cleanup.js
//
// Requires env:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// Exit code: 0 if no tests failed (passes + skips), 1 if any test failed.
//
// See AUTHORITY_MODE_POST_LAUNCH_BACKLOG.md.

import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

const execFileP = promisify(execFile);

const results = []; // { name, status: 'PASS' | 'FAIL' | 'SKIP' }

function record(name, status) {
  results.push({ name, status });
}

function header(title) {
  console.log(title);
}

async function testB1(db) {
  const NAME = 'TEST B1: Default mode for newly created battles';
  header(NAME);
  try {
    const snap = await db
      .collection('agentBattles')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (snap.empty) {
      console.log('  No battles found in the collection.');
      console.log('RESULT: SKIP (no battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    let allAutopilot = true;
    snap.forEach((doc) => {
      const data = doc.data();
      const mode = data.executionMode || '(unset)';
      const created = data.createdAt || '(unknown)';
      const marker = mode === 'autopilot' ? 'OK' : 'FAIL';
      if (mode !== 'autopilot') allAutopilot = false;
      console.log(`  Battle ${doc.id} (created ${created}): executionMode = '${mode}' [${marker}]`);
    });

    console.log('  Note: this test is only meaningful AFTER the PR has merged and');
    console.log('  at least one new battle has been created post-deploy. Before that,');
    console.log('  the five most-recent battles may still be pre-cleanup copilot battles.');
    const status = allAutopilot ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

async function testB2(db) {
  const NAME = 'TEST B2: No active battles in non-autopilot mode';
  header(NAME);
  try {
    const snap = await db
      .collection('agentBattles')
      .where('status', '==', 'active')
      .get();

    if (snap.empty) {
      console.log('  No active battles found.');
      console.log('RESULT: SKIP (no active battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    const counts = { autopilot: 0, copilot: 0, manual: 0, unset: 0, other: 0 };
    snap.forEach((doc) => {
      const mode = doc.data().executionMode;
      if (mode === 'autopilot') counts.autopilot += 1;
      else if (mode === 'copilot') counts.copilot += 1;
      else if (mode === 'manual') counts.manual += 1;
      else if (mode == null) counts.unset += 1;
      else counts.other += 1;
    });

    console.log(`  Total active battles: ${snap.size}`);
    console.log(`  In autopilot:         ${counts.autopilot}`);
    console.log(`  In copilot:           ${counts.copilot}`);
    console.log(`  In manual:            ${counts.manual}`);
    if (counts.unset) console.log(`  Unset:                ${counts.unset}`);
    if (counts.other) console.log(`  Other:                ${counts.other}`);

    console.log('  Note: this test is only meaningful AFTER the migration script');
    console.log('  has been run with --execute. Before that, copilot/manual counts');
    console.log('  may be non-zero — that is a pre-migration state, not a regression.');

    const offenders = counts.copilot + counts.manual + counts.other + counts.unset;
    const status = offenders === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

async function testB3(db) {
  const NAME = 'TEST B3: No active battles with pending proposals';
  header(NAME);
  try {
    const snap = await db
      .collection('agentBattles')
      .where('status', '==', 'active')
      .get();

    if (snap.empty) {
      console.log('  No active battles found.');
      console.log('RESULT: SKIP (no active battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    let nullCount = 0;
    let withProposal = 0;
    const offenders = [];
    snap.forEach((doc) => {
      if (doc.data().pendingProposal == null) {
        nullCount += 1;
      } else {
        withProposal += 1;
        offenders.push(doc.id);
      }
    });

    console.log(`  Total active battles:          ${snap.size}`);
    console.log(`  With pendingProposal == null:  ${nullCount}`);
    console.log(`  With non-null pendingProposal: ${withProposal}`);
    if (offenders.length > 0) {
      console.log('  Offending battle IDs:');
      offenders.forEach((id) => console.log(`    ${id}`));
    }
    console.log('  Note: this test is only meaningful AFTER the migration script');
    console.log('  has been run with --execute. Before that, stale pendingProposals');
    console.log('  may remain — that is a pre-migration state, not a regression.');

    const status = withProposal === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

function testB4() {
  const NAME = 'TEST B4: Code-level default in agentBattleService.js';
  header(NAME);
  try {
    const src = readFileSync(new URL('../_utils/agentBattleService.js', import.meta.url), 'utf8');
    const m = src.match(/executionMode:\s*'([^']+)'/);
    if (!m) {
      console.log('  Could not find executionMode: assignment in the file.');
      console.log('RESULT: FAIL (assignment not found)');
      record(NAME, 'FAIL');
      return;
    }
    console.log(`  Line found:    ${m[0]}`);
    console.log(`  Default value: '${m[1]}'`);
    const status = m[1] === 'autopilot' ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (could not read file)');
    record(NAME, 'FAIL');
  }
}

function testB5() {
  const NAME = "TEST B5: Zero || 'copilot' fallbacks in agent-evaluate.js";
  header(NAME);
  try {
    const src = readFileSync(new URL('../cron/agent-evaluate.js', import.meta.url), 'utf8');
    const matches = src.match(/\|\| 'copilot'/g) || [];
    console.log(`  Occurrences found: ${matches.length}`);
    const status = matches.length === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (passes if count == 0)`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (could not read file)');
    record(NAME, 'FAIL');
  }
}

async function testB6() {
  const NAME = 'TEST B6: Migration script dry-run safety';
  header(NAME);
  try {
    const { stdout, stderr } = await execFileP(
      process.execPath,
      [
        '--env-file=.env.local',
        'api/scripts/migrate-existing-battles-to-autopilot.js',
      ],
      { cwd: process.cwd(), timeout: 120_000 },
    );
    const out = `${stdout}\n${stderr}`;

    const dryRunMarkers = [/Mode: DRY RUN/, /would migrate/i, /Dry run complete/i, /Pass --execute/i];
    const writeMarkers = [/\bupdated\b/i, /\bapplied\b/i, /\bpersisted\b/i, /\bwrote\b/i];

    const matchedDryRun = dryRunMarkers.filter((re) => re.test(out));
    const matchedWrites = writeMarkers.filter((re) => re.test(out));

    console.log(`  Script output contained dry-run language: ${matchedDryRun.length > 0}`);
    if (matchedDryRun.length > 0) {
      console.log(`    Matched: ${matchedDryRun.map((re) => re.source).join(', ')}`);
    }
    console.log(`  Script output contained write-suggesting phrases: ${matchedWrites.length > 0}`);
    if (matchedWrites.length > 0) {
      console.log(`    Matched: ${matchedWrites.map((re) => re.source).join(', ')}`);
    }

    const status = matchedDryRun.length > 0 && matchedWrites.length === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR running migration script: ${err.message}`);
    console.log('RESULT: FAIL (could not invoke migration script in dry-run)');
    record(NAME, 'FAIL');
  }
}

async function main() {
  const HR = '='.repeat(72);
  console.log(HR);
  console.log('Auto-Pilot Cleanup Behavioral Test Harness');
  console.log('Read-only against Firestore + local files. Safe to run anytime.');
  console.log(HR);
  console.log();

  const db = getFirebaseAdmin();

  await testB1(db); console.log();
  await testB2(db); console.log();
  await testB3(db); console.log();
  testB4();         console.log();
  testB5();         console.log();
  await testB6();   console.log();

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;

  console.log(HR);
  console.log(`OVERALL: ${passed}/${total} tests passed  (failed: ${failed}, skipped: ${skipped})`);
  console.log(HR);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
