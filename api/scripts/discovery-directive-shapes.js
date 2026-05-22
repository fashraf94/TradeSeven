#!/usr/bin/env node
// api/scripts/discovery-directive-shapes.js
//
// Read-only discovery: samples recent battle.directive shapes from
// production to inform the Fix #4 (directive expiry gate) design.
// Mirrors the read-only pattern used by test-voice-layer-phase-*.js —
// no writes, no API calls.
//
// Usage (requires Firebase admin credentials in env):
//   node --env-file=.env.local api/scripts/discovery-directive-shapes.js

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

async function main() {
  const HR = '='.repeat(72);
  console.log(HR);
  console.log('Directive Shape Discovery — production sampling');
  console.log('Read-only. Safe to run anytime.');
  console.log(HR);
  console.log();

  const db = getFirebaseAdmin();

  // Fetch a wide window: 40 most-recent battles, filter to those with
  // a non-null directive. This covers both active and completed battles
  // — completed battles may have stale directives we never cleared.
  const snap = await db
    .collection('agentBattles')
    .orderBy('createdAt', 'desc')
    .limit(40)
    .get();

  const samples = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (data.directive && typeof data.directive === 'object') {
      samples.push({
        id: doc.id,
        status: data.status,
        directive: data.directive,
        tradingDays: data.timing?.tradingDays || null,
        tradingDayCount: (data.timing?.tradingDays || []).length,
      });
    }
  });

  console.log(`Sampled ${snap.size} most-recent battles. ${samples.length} have a non-null directive.\n`);

  if (samples.length === 0) {
    console.log('No directives found in the sampled window.');
    process.exit(0);
  }

  // Report each shape
  samples.forEach((s, i) => {
    const d = s.directive;
    console.log(`--- Battle ${i + 1}: ${s.id} (status=${s.status}) ---`);
    console.log(`  text:               ${typeof d.text === 'string' ? `"${d.text.slice(0, 60)}..."` : d.text}`);
    console.log(`  expiry:             ${JSON.stringify(d.expiry)}`);
    console.log(`  directiveThreadId:  ${JSON.stringify(d.directiveThreadId)}`);
    console.log(`  createdAt:          ${JSON.stringify(d.createdAt)}`);
    console.log(`  tradingDayCount:    ${s.tradingDayCount}`);
    // List any unexpected fields
    const knownFields = new Set(['text', 'expiry', 'directiveThreadId', 'createdAt']);
    const extras = Object.keys(d).filter((k) => !knownFields.has(k));
    if (extras.length > 0) {
      console.log(`  UNEXPECTED FIELDS:  ${extras.join(', ')}`);
      extras.forEach((k) => console.log(`    ${k} = ${JSON.stringify(d[k]).slice(0, 100)}`));
    }
    console.log();
  });

  // Aggregate: distribution of expiry values
  const expiryCounts = {};
  samples.forEach((s) => {
    const e = s.directive.expiry ?? '(missing)';
    expiryCounts[e] = (expiryCounts[e] || 0) + 1;
  });
  console.log('Expiry value distribution:');
  Object.entries(expiryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([e, n]) => console.log(`  ${JSON.stringify(e)}: ${n}`));
  console.log();

  // Check: any directives on completed battles? (stale-directive evidence)
  const onCompleted = samples.filter((s) => s.status === 'completed');
  console.log(`Directives on completed battles: ${onCompleted.length} / ${samples.length}`);
  if (onCompleted.length > 0) {
    console.log('  (these are dormant — cron skips status!=active — but confirm none re-activate)');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
