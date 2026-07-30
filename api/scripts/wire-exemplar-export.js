// api/scripts/wire-exemplar-export.js
// Phase 2 N2.2 — the founder-slate EXPORT for exemplar qualification
// (Spec V1.2 N2.1/N2.2; partial-exemplar ruling Jul 29 2026: four types
// now — kai market_pulse · alex market_mover · doug earnings_preview ·
// kim sector_column; neta recap/preview + doug recap deferred post-gate).
//
// WHY THIS EXISTS. The build container has no production Firebase access
// (the credential wall), so qualification is a round trip: you run this
// READ-ONLY script locally against production, it writes ONE JSON file
// with everything N2.1 needs for the 20 slated stories, and you send the
// file back. The qualification harness then runs the locked gate over it:
//   model-generated typed-facts companion → current tool schema →
//   validation → deterministic digest render → prose↔facts agreement on
//   gate-bearing dimensions,
// records exemplarVersion + source storyId, and embeds the survivors
// (primaries first; a group falls back to its alternate only when the
// gate rejects a primary — selection stays yours, eligibility stays the
// gate's).
//
// WHAT IT EXPORTS per story: the FULL story document (body untruncated —
// the companion generator and the agreement check both need whole prose)
// plus the story's GENERATING-DAY fantasyTimesConsensus bucket, joined by
// the writers' own UTC-date expression (publishedAt →
// toISOString().split('T')[0] — the Addendum §3 join rule), which the
// agreement check needs for catalyst/earnings operands.
//
// READ-ONLY: this script writes nothing to Firestore — only the local
// output file.
//
// Credentials + env self-load: identical to wire-exemplar-shortlist.js
// (the sibling). Run from the REPO ROOT:
//   node api/scripts/wire-exemplar-export.js
//   node api/scripts/wire-exemplar-export.js --out my-export.json
//   # explicit-flag equivalent:
//   node --env-file=.env.local api/scripts/wire-exemplar-export.js

import { existsSync, writeFileSync } from 'node:fs';

// ── Env self-load + pre-flight (the shortlist-script pattern) ────────────
if (!process.env.FIREBASE_PROJECT_ID) {
  for (const envFile of ['.env.local', '.env']) {
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
      break;
    }
  }
}

const REQUIRED_ENV = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(
    `[ExemplarExport] missing required Firebase Admin env: ${missingEnv.join(', ')}\n` +
    'Add them to .env.local at the repo root (format in .env.example:40-42; ' +
    'FIREBASE_PRIVATE_KEY must be double-quoted with literal \\n escapes), then run ' +
    'from the repo root:\n' +
    '  node api/scripts/wire-exemplar-export.js',
  );
  process.exit(1);
}

const { getFirebaseAdmin } = await import('../_utils/firebaseAdmin.js');

// ── The founder slate (Jul 30 2026) — primaries + one alternate per group.
// The alternate qualifies ONLY if the N2.1 gate rejects a primary.
const SLATE = [
  { group: 'kai_market_pulse', reporter: 'kai', type: 'market_pulse', role: 'primary', ids: [
    'GYLp3Uwk4aCOmmb2ADnx', 'aW5WyH3zrxoXwPyBAQXp', 'oNNylvdfilPSPzsvJBKV', 'ubvi4lVNvdsQq5BfQe4t',
  ] },
  { group: 'kai_market_pulse', reporter: 'kai', type: 'market_pulse', role: 'alternate', ids: ['YJy2LDshZqDrraLzw00v'] },
  { group: 'alex_market_mover', reporter: 'alex', type: 'market_mover', role: 'primary', ids: [
    'sZx9qteVDWNzcACxbJ2S', 'f9BnH825q1kLx4FFPMVd', 'mgFSjOxnoePTFfAu2JXU', 'fzp43ZTAhbEnSxsJHaiT',
  ] },
  { group: 'alex_market_mover', reporter: 'alex', type: 'market_mover', role: 'alternate', ids: ['om3lWDpdBazUlEfnRo4a'] },
  { group: 'doug_earnings_preview', reporter: 'doug', type: 'earnings_preview', role: 'primary', ids: [
    '6kcO5ZgkOOyg0C8LvGXo', 'xvXdcTQO1WUufhuxFnJX', 'J6cLaezUeI8R4bMHTcto', 'ChiKvnwXfnzx2a7vCpKW',
  ] },
  { group: 'doug_earnings_preview', reporter: 'doug', type: 'earnings_preview', role: 'alternate', ids: ['ZwIf659TYSTs6cn392nA'] },
  { group: 'kim_sector_column', reporter: 'kim', type: 'sector_column', role: 'primary', ids: [
    'IzNXnZEDHJP40thlJyJR', 'UFGRE1ABuSJSEdFJvw2D', '6GlrIzArqBTPaR1V6s5W', '8X3OVZAMB5DTN0DfKpT6',
  ] },
  { group: 'kim_sector_column', reporter: 'kim', type: 'sector_column', role: 'alternate', ids: ['HeGyKorqYMKqy5nc33ng'] },
];

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT_PATH = outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : 'wire-exemplar-export.json';

// Firestore Timestamps → ISO strings, recursively (JSON.stringify would
// emit {_seconds,_nanoseconds} blobs the harness would have to guess at).
function normalize(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

/** The writers' consensus join key (Addendum §3): UTC date of publishedAt. */
function consensusJoinDate(publishedAtIso) {
  if (!publishedAtIso) return null;
  const d = new Date(publishedAtIso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

const db = getFirebaseAdmin();

const stories = [];
const problems = [];
const bucketCache = new Map();

for (const entry of SLATE) {
  for (const id of entry.ids) {
    const snap = await db.collection('fantasyTimesStories').doc(id).get();
    if (!snap.exists) {
      problems.push(`${entry.group}/${entry.role} ${id}: NOT FOUND (retention-deleted or wrong id)`);
      stories.push({ id, group: entry.group, role: entry.role, exists: false, story: null, consensusBucketDate: null, consensusBucket: null });
      continue;
    }
    const story = normalize(snap.data());
    if (story.reporter !== entry.reporter || story.type !== entry.type) {
      problems.push(
        `${entry.group}/${entry.role} ${id}: expected ${entry.reporter}/${entry.type}, ` +
        `found ${story.reporter}/${story.type} — exported anyway, flagged for your call`,
      );
    }

    const bucketDate = consensusJoinDate(story.publishedAt);
    let bucket = null;
    if (bucketDate) {
      if (!bucketCache.has(bucketDate)) {
        const bSnap = await db.collection('fantasyTimesConsensus').doc(bucketDate).get();
        bucketCache.set(bucketDate, bSnap.exists ? normalize(bSnap.data()) : null);
      }
      bucket = bucketCache.get(bucketDate);
    }

    stories.push({
      id,
      group: entry.group,
      role: entry.role,
      exists: true,
      story, // FULL doc: headline, subheadline, body (untruncated), dataSnapshot, tickers, sentiment, generatedBy, publishedAt, …
      consensusBucketDate: bucketDate,
      consensusBucket: bucket,
    });
    console.log(
      `[ExemplarExport] ${entry.group} ${entry.role} ${id}: ok — ` +
      `${story.type} · body ${String(story.body ?? '').length} chars · published ${story.publishedAt ?? '?'}` +
      `${bucket ? ` · bucket ${bucketDate}` : ' · bucket MISSING'}`,
    );
  }
}

const payload = {
  exportedAt: new Date().toISOString(),
  projectId: process.env.FIREBASE_PROJECT_ID,
  slateVersion: '2026-07-30',
  counts: {
    requested: SLATE.reduce((n, e) => n + e.ids.length, 0),
    found: stories.filter((s) => s.exists).length,
    missing: stories.filter((s) => !s.exists).length,
  },
  problems,
  stories,
};

writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));

console.log('\n[ExemplarExport] ──────────────────────────────────────────');
console.log(`[ExemplarExport] wrote ${OUT_PATH}: ${payload.counts.found}/${payload.counts.requested} stories found`);
if (problems.length) {
  console.log(`[ExemplarExport] ${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
} else {
  console.log('[ExemplarExport] no problems — every slated id resolved cleanly');
}
console.log('[ExemplarExport] next: send the JSON file back; the N2.1 qualification harness consumes it as-is.');
