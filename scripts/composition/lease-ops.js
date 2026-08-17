#!/usr/bin/env node
// scripts/composition/lease-ops.js
//
// Composition §8 runbook — the PROVISIONER-LEASE OPERATIONS the run needs at
// step 1.9 (drain to the watermark) and step 8B (purge released). Written
// BEFORE step 1.2 on purpose: 1.2 pins THE ACTIVATION SHA and forbids any
// commit after it, so drain tooling authored later would re-open step 1 from
// 1.1. (Review finding R2: the runbook named these two calls and nothing in
// the repo invoked either — at the close the operator had no command to run.)
//
// DRY-RUN BY DEFAULT. Nothing is written without --apply. `list` and `drain`
// perform no writes in ANY mode — the drain only polls the registry — so the
// only writing subcommands are `purge` and `resolve`, and both refuse without
// --operator.
//
// WORKS WITH THE EPOCH CLOSED, which is when 1.9 runs. None of the underlying
// helpers consults the write-epoch fence; proven by
// api/_utils/compositionLeaseOps.test.js, which runs every
// subcommand against a seeded {state:'closed'} epoch.
//
//   node scripts/composition/lease-ops.js list
//       Every unreleased lease: holder, leaseId, acquiredAt, expiresAt, and
//       whether it is STUCK by the drain's own definition.
//
//   node scripts/composition/lease-ops.js drain
//       Dry run — ONE classification pass, no polling. Reports what a real
//       drain would do right now (drain / wait / refuse).
//
//   node scripts/composition/lease-ops.js drain --apply
//       THE STEP-1.9 CALL. Polls until nothing is active. On refusal it names
//       every stuck holder and prints a ready-to-run `resolve` command for each.
//
//   node scripts/composition/lease-ops.js resolve --lease-id <id> \
//       --operator "<name>" --reason "<why the holder is known dead>" --apply
//       #3's explicit act: declares a DEAD holder's lease resolved, attributed.
//       Refuses on a lease that has not expired — a live holder may still write.
//
//   node scripts/composition/lease-ops.js purge --operator "<name>" --apply
//       THE STEP-8B CALL. Deletes ONLY released leases; an expired-unreleased
//       lease is never purged (that would destroy the signal the drain refuses
//       on — Sol review #3).
//
// Every run writes a JSON artifact to scripts/composition/out/ for the runbook
// log to cite. Requires Firestore Admin credentials.

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect
// and turns a missing credential into a one-line instruction (the
// migration-scan.js precedent).
import { requireFirebaseCreds } from '../loadLocalEnv.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFirebaseAdmin } from '../../api/_utils/firebaseAdmin.js';
import {
  listLeases, previewDrain, runDrain, runPurge, runResolve,
} from '../../api/_utils/compositionLeaseOps.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, 'out');

const args = process.argv.slice(2);
const SUB = args.find((a) => !a.startsWith('--')) ?? null;
const APPLY = args.includes('--apply');
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const USAGE = `usage:
  lease-ops.js list
  lease-ops.js drain [--apply]
  lease-ops.js resolve --lease-id <id> --operator "<name>" --reason "<why>" --apply
  lease-ops.js purge --operator "<name>" --apply`;

function bail(msg, code = 2) { console.error(`✗ ${msg}\n\n${USAGE}`); process.exit(code); }

function emit(report) {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = report.ranAt.replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `lease-ops-${report.subcommand}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nreport: ${path.relative(path.join(HERE, '../..'), file).split(path.sep).join('/')}`);
}

function printRows(rows) {
  if (rows.length === 0) { console.log('  (none)'); return; }
  for (const r of rows) {
    console.log(`  ${r.stuck ? 'STUCK ' : 'active'}  ${r.leaseId}`);
    console.log(`          holder=${r.holder}  epoch=${r.epochId ?? 'none'}`);
    console.log(`          acquired=${r.acquiredAt}  expires=${r.expiresAt}`);
  }
}

if (!SUB || !['list', 'drain', 'resolve', 'purge'].includes(SUB)) bail(`unknown or missing subcommand${SUB ? `: ${SUB}` : ''}`);

requireFirebaseCreds();
const db = getFirebaseAdmin();
const ranAt = new Date().toISOString();
let report;

if (SUB === 'list') {
  const r = await listLeases(db);
  console.log(`UNRELEASED LEASES — ${r.activeCount} active, ${r.stuckCount} STUCK`);
  printRows(r.rows);
  if (r.stuckCount > 0) console.log('\n⚠ a STUCK lease REFUSES the step-1.9 drain until explicitly resolved (#3).');
  report = { subcommand: 'list', ranAt, applied: false, ...r };
} else if (SUB === 'drain') {
  if (!APPLY) {
    const r = await previewDrain(db);
    console.log(`DRAIN (dry run) — ${r.verdict}${r.reason ? `: ${r.reason}` : ''}`);
    if (r.stuck.length) { console.log('\nSTUCK:'); printRows(r.stuck); }
    if (r.active.length) { console.log('\nACTIVE:'); printRows(r.active); }
    if (r.resolveCommands.length) {
      console.log('\nRun ONE of these per stuck lease (operator + reason are yours to supply):');
      for (const c of r.resolveCommands) console.log(`  ${c}`);
    }
    console.log('\nThis was a DRY RUN — no polling, nothing written. Re-run with --apply for the step-1.9 drain.');
    report = { subcommand: 'drain', ranAt, applied: false, ...r };
  } else {
    console.log('DRAIN — polling until no lease is active (step 1.9)…');
    const r = await runDrain(db);
    console.log(`\n${r.verdict}${r.message ? `: ${r.message}` : ''}`);
    if (r.verdict === 'DRAINED') console.log(`  waitedMs=${r.waitedMs} polls=${r.polls}`);
    if (r.stuck?.length) { console.log('\nREFUSED — stuck holders:'); printRows(r.stuck); }
    if (r.resolveCommands?.length) {
      console.log('\nResolve each (operator + reason are yours to supply), then re-run the drain:');
      for (const c of r.resolveCommands) console.log(`  ${c}`);
    }
    report = { subcommand: 'drain', ranAt, applied: true, ...r };
    emit(report);
    process.exit(r.verdict === 'DRAINED' ? 0 : 1);
  }
} else if (SUB === 'resolve') {
  const leaseId = flag('lease-id'); const operator = flag('operator'); const reason = flag('reason');
  if (!leaseId) bail('--lease-id required');
  if (!operator) bail('--operator required (#3: a named human declares the holder dead)');
  if (!reason) bail('--reason required (#3: the log records WHY)');
  if (!APPLY) {
    console.log(`RESOLVE (dry run) — would mark ${leaseId} released, attributed to "${operator}".`);
    console.log(`  reason: ${reason}`);
    console.log('\nNothing written. Re-run with --apply.');
    report = { subcommand: 'resolve', ranAt, applied: false, leaseId, operator, reason };
  } else {
    const r = await runResolve(db, leaseId, { operator, reason });
    console.log(`RESOLVED ${r.leaseId} (holder=${r.holder}) — attributed to "${operator}".`);
    report = { subcommand: 'resolve', ranAt, applied: true, ...r };
  }
} else { // purge
  const operator = flag('operator');
  // Attribution gates the WRITE, not the preview — a dry run changes nothing,
  // so it should not demand a name to look.
  if (APPLY && !operator) bail('--operator required with --apply (a delete leaves no stamp; attribution lives in the run report)');
  if (!APPLY) {
    const r = await listLeases(db);
    console.log(`PURGE (dry run) — would delete every RELEASED lease. ${r.activeCount} active and ${r.stuckCount} stuck lease(s) are NEVER purged.`);
    if (r.stuckCount > 0) console.log('⚠ stuck leases present — purging never removes them; resolve them for the drain instead.');
    console.log('\nNothing written. Re-run with --apply.');
    report = { subcommand: 'purge', ranAt, applied: false, operator: operator ?? null, ...r };
  } else {
    const r = await runPurge(db, { operator });
    console.log(`PURGED ${r.purged} released lease(s) — attributed to "${operator}".`);
    console.log(`  unreleased population unchanged: ${r.unreleasedBefore} → ${r.unreleasedAfter}`);
    report = { subcommand: 'purge', ranAt, applied: true, ...r };
  }
}

emit(report);
