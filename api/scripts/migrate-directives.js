#!/usr/bin/env node
// api/scripts/migrate-directives.js
// One-time migration: classifies each agent's legacy directives[] by source,
// moves them to their new homes, and clears the source field.
//
// Classification (per COMMAND_CENTER_FILM_ROOM_REDESIGN_QUICK_REFERENCE_V2.md):
//   source === 'voice_layer'   → agent.archivedDirectives[]
//   source === 'batch_review'  → agent.lessons[]   (reshaped to lesson schema)
//   any other source           → agent.archivedDirectives[] (source preserved)
//
// Dry-run is default. Pass --execute to actually write.
//
// Usage:
//   node --env-file=.env.local api/scripts/migrate-directives.js
//   node --env-file=.env.local api/scripts/migrate-directives.js --execute
//
// Requires env:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

const EXECUTE = process.argv.includes('--execute');
const MODE = EXECUTE ? 'EXECUTE' : 'DRY RUN';

function toLesson(d) {
  return {
    id: d.id || `migrated_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: d.text || '',
    source: 'batch_review',
    sourceGameId: d.sourceGameId || null,
    sourceTrade: d.sourceTrade || null,
    createdAt: d.createdAt || new Date().toISOString(),
    consumed: false,
    consumedInConsolidation: null,
  };
}

function classify(directives) {
  const lessons = [];
  const archived = [];
  const otherSources = new Set();

  for (const d of directives) {
    if (!d || typeof d !== 'object') continue;
    const source = d.source || 'unknown';
    if (source === 'batch_review') {
      lessons.push(toLesson(d));
    } else if (source === 'voice_layer') {
      archived.push(d);
    } else {
      archived.push(d);
      otherSources.add(source);
    }
  }

  return { lessons, archived, otherSources: Array.from(otherSources) };
}

async function migrateAgent(db, doc) {
  const agent = doc.data();
  const directives = Array.isArray(agent.directives) ? agent.directives : [];

  if (directives.length === 0) {
    return { agentId: doc.id, name: agent.name || null, skipped: true, reason: 'no directives' };
  }

  const { lessons, archived, otherSources } = classify(directives);
  const voiceLayerCount = directives.filter(d => d?.source === 'voice_layer').length;
  const batchReviewCount = lessons.length;
  const otherCount = archived.length - voiceLayerCount;

  const result = {
    agentId: doc.id,
    name: agent.name || null,
    totalDirectives: directives.length,
    voiceLayerCount,
    batchReviewCount,
    otherCount,
    otherSources,
    skipped: false,
  };

  if (!EXECUTE) return result;

  const update = { directives: [] };
  if (archived.length > 0) {
    update.archivedDirectives = FieldValue.arrayUnion(...archived);
  }
  if (lessons.length > 0) {
    update.lessons = FieldValue.arrayUnion(...lessons);
  }

  await doc.ref.update(update);
  result.wrote = true;
  return result;
}

async function main() {
  console.log(`[migrate-directives] Mode: ${MODE}`);
  if (!EXECUTE) {
    console.log('[migrate-directives] Pass --execute to persist changes.\n');
  }

  const db = getFirebaseAdmin();
  const snap = await db.collection('agents').get();

  console.log(`[migrate-directives] Scanning ${snap.size} agents...\n`);

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let errored = 0;
  let totalDirectives = 0;
  let totalVoiceLayer = 0;
  let totalBatchReview = 0;
  let totalOther = 0;

  for (const doc of snap.docs) {
    scanned += 1;
    try {
      const r = await migrateAgent(db, doc);
      if (r.skipped) {
        skipped += 1;
        continue;
      }
      migrated += 1;
      totalDirectives += r.totalDirectives;
      totalVoiceLayer += r.voiceLayerCount;
      totalBatchReview += r.batchReviewCount;
      totalOther += r.otherCount;

      const otherNote = r.otherSources.length > 0
        ? ` other=[${r.otherSources.join(',')}]`
        : '';
      const verb = EXECUTE ? 'migrated' : 'would migrate';
      console.log(
        `  [${r.agentId}] ${r.name || '(unnamed)'} — ${verb} ${r.totalDirectives} directives: ` +
        `voice_layer=${r.voiceLayerCount} batch_review=${r.batchReviewCount} other=${r.otherCount}${otherNote}`
      );
    } catch (err) {
      errored += 1;
      console.error(`  [${doc.id}] ERROR: ${err.message}`);
    }
  }

  console.log('\n[migrate-directives] Summary');
  console.log(`  Mode:               ${MODE}`);
  console.log(`  Agents scanned:     ${scanned}`);
  console.log(`  Agents migrated:    ${migrated}${EXECUTE ? '' : ' (would migrate)'}`);
  console.log(`  Agents skipped:     ${skipped} (no directives)`);
  console.log(`  Agents errored:     ${errored}`);
  console.log(`  Directives total:   ${totalDirectives}`);
  console.log(`    voice_layer  →  archivedDirectives: ${totalVoiceLayer}`);
  console.log(`    batch_review →  lessons:            ${totalBatchReview}`);
  console.log(`    other        →  archivedDirectives: ${totalOther}`);

  if (!EXECUTE) {
    console.log('\n[migrate-directives] Dry run complete. Re-run with --execute to persist.');
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('[migrate-directives] Fatal:', err);
    process.exit(1);
  }
);
