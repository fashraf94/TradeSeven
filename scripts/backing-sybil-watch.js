// scripts/backing-sybil-watch.js
//
// Backing Beta PR 5 — THE ADMIN SYBIL WATCH, READ-ONLY (spec V1.3 §8
// detective controls, §10; carry-in E1). Reads the backing book — the stake
// documents, their sealed `backingStakes/{id}/private/meta` fingerprints and
// the pools they name — and prints the report api/_utils/backingSybilWatch.js
// computes: accounts sharing an address, accounts sharing a device, a
// cluster's accounts piled onto ONE team in ONE pod, and the book's hygiene.
// Leads, not verdicts. Nothing in the product reads this; no exclusion,
// refund or settlement follows from it automatically.
//
// STRICTLY READ-ONLY, and mechanically so (the n1-stranded-precheck pattern):
// the Firestore handle is wrapped in a proxy that THROWS on set / update /
// delete / create / add / batch / runTransaction / commit and on the three
// write-capable escape hatches (parent / firestore / ref). It imports no
// writer, no settlement module and no apply script.
//
// Needs the same creds as the serverless functions — FIREBASE_PROJECT_ID /
// FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. Locally those come from
// .env.local in the repo root, loaded by ./loadLocalEnv.js (see that file for
// the exact format). CRON_SECRET (or BACKING_FINGERPRINT_SALT) must match the
// deployment's so the `unknown` address sentinel can be recognised; a mismatch
// only leaves that one count at zero. From the repo root:
//   node scripts/backing-sybil-watch.js                     # the whole book, newest 2000 stakes
//   node scripts/backing-sybil-watch.js --week=2026-W40     # one backing week
//   node scripts/backing-sybil-watch.js --since=2026-09-01  # stakes placed on or after a day
//   node scripts/backing-sybil-watch.js --limit=500 --min-accounts=3
//   node scripts/backing-sybil-watch.js --json              # the report object, for a file
//
// The runbook: docs/BACKING_SYBIL_WATCH_RUNBOOK.md.

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds } from './loadLocalEnv.js';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { BACKING_STAKES_COLLECTION, BACKING_POOLS_COLLECTION } from '../api/_utils/backingPools.js';
import { STAKE_PRIVATE_SUBCOLLECTION, STAKE_META_DOC } from '../api/_utils/backingStats.js';
import { hashFingerprint } from '../api/_utils/backingFingerprint.js';
import { analyzeSybil, formatSybilReport } from '../api/_utils/backingSybilWatch.js';

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 10000;
const META_READ_CHUNK = 50;

function argVal(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length).replace(/^(['"])([\s\S]*)\1$/, '$2');
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const WEEK = argVal('week');
const SINCE = argVal('since');
const LIMIT = Math.min(MAX_LIMIT, Math.max(1, Number(argVal('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
const MIN_ACCOUNTS = Math.max(2, Number(argVal('min-accounts') ?? 2) || 2);
const AS_JSON = hasFlag('json');

if (WEEK !== null && !/^\d{4}-W\d{2}$/.test(WEEK)) {
  console.error(`--week must be a week key (YYYY-Www), got ${WEEK}`);
  process.exit(2);
}
if (SINCE !== null && Number.isNaN(Date.parse(SINCE))) {
  console.error(`--since must be an ISO date or instant, got ${SINCE}`);
  process.exit(2);
}

// Fail with a one-line instruction rather than firebase-admin's opaque
// `app/invalid-credential` stack trace.
requireFirebaseCreds();

// ==================== THE READ-ONLY GUARANTEE ====================

const MUTATORS = new Set([
  'set', 'update', 'delete', 'create', 'add', 'commit',
  'batch', 'bulkWriter', 'runTransaction', 'recursiveDelete', 'withConverter',
]);

// ESCAPE HATCHES: getters that hand back a live, unwrapped SDK object from
// which `.set()` is reachable again. Blocked on access; this script needs none.
const ESCAPES = new Set(['parent', 'firestore', 'ref']);

/** Wrap a Firestore handle so any write path THROWS instead of writing.
 *
 *  Every mutator NAME in MUTATORS and every escape-hatch GETTER in ESCAPES
 *  throws on access, on the handle and on every ref/query/collection reachable
 *  from it by chaining. A Promise result passes through unwrapped (a snapshot
 *  is inert data); this script reads only `.exists` / `.data()` / `.id` /
 *  `.docs` / `.size` off a snapshot, so there is no live write path. */
function readOnly(target, path = 'db') {
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'string' && MUTATORS.has(prop)) {
        throw new Error(`READ-ONLY VIOLATION: ${path}.${prop}() — backing-sybil-watch must never write.`);
      }
      if (typeof prop === 'string' && ESCAPES.has(prop)) {
        throw new Error(`READ-ONLY VIOLATION: ${path}.${prop} is a write-capable escape hatch — backing-sybil-watch must never reach it.`);
      }
      // No receiver: Firestore classes use private fields, and forwarding the
      // proxy as `this` to a getter would throw.
      const value = Reflect.get(t, prop);
      if (typeof value !== 'function') return value;
      return (...args) => {
        const result = value.apply(t, args);
        const chainable = result && typeof result === 'object' && typeof result.then !== 'function';
        return chainable ? readOnly(result, `${path}.${prop}`) : result;
      };
    },
  });
}

// ==================== READS ====================

/**
 * The stakes in scope — ONE server-side dimension per query, so no composite
 * index is ever needed: `--week` is an equality on `weekKey` (the week's book
 * is small; sorted and bounded in memory), `--since` is a single-field range
 * on `placedAt` (ordered by the same field), and the default is the newest
 * `--limit` by `placedAt`. With both flags the week is the query and the
 * instant is applied in memory.
 */
async function readStakes(db) {
  const col = db.collection(BACKING_STAKES_COLLECTION);
  const sinceIso = SINCE !== null ? new Date(SINCE).toISOString() : null;
  let docs;
  if (WEEK !== null) {
    const snap = await col.where('weekKey', '==', WEEK).get();
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => sinceIso === null || (typeof s.placedAt === 'string' && s.placedAt >= sinceIso))
      .sort((a, b) => String(b.placedAt ?? '').localeCompare(String(a.placedAt ?? '')))
      .slice(0, LIMIT);
  } else if (sinceIso !== null) {
    const snap = await col.where('placedAt', '>=', sinceIso).orderBy('placedAt', 'desc').limit(LIMIT).get();
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } else {
    const snap = await col.orderBy('placedAt', 'desc').limit(LIMIT).get();
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return docs;
}

/** Each stake's sealed meta, read in bounded chunks; absent docs stay absent. */
async function readMetas(db, stakes) {
  const out = {};
  for (let i = 0; i < stakes.length; i += META_READ_CHUNK) {
    const chunk = stakes.slice(i, i + META_READ_CHUNK);
    const snaps = await Promise.all(chunk.map((s) => db.collection(BACKING_STAKES_COLLECTION).doc(s.id).collection(STAKE_PRIVATE_SUBCOLLECTION).doc(STAKE_META_DOC).get()));
    snaps.forEach((snap, j) => { if (snap.exists) out[chunk[j].id] = snap.data(); });
  }
  return out;
}

/** The pools the stakes name (for the dev flag), read once each. */
async function readPools(db, stakes) {
  const ids = [...new Set(stakes.map((s) => s.groupId).filter((g) => typeof g === 'string' && g.length > 0))];
  const out = {};
  for (let i = 0; i < ids.length; i += META_READ_CHUNK) {
    const chunk = ids.slice(i, i + META_READ_CHUNK);
    const snaps = await Promise.all(chunk.map((id) => db.collection(BACKING_POOLS_COLLECTION).doc(id).get()));
    snaps.forEach((snap, j) => { if (snap.exists) out[chunk[j]] = snap.data(); });
  }
  return out;
}

// ==================== MAIN ====================

async function main() {
  const db = readOnly(getFirebaseAdmin());
  const startedAt = Date.now();
  const stakes = await readStakes(db);
  const [metaByStakeId, poolsByGroupId] = await Promise.all([readMetas(db, stakes), readPools(db, stakes)]);
  const report = analyzeSybil({ stakes, metaByStakeId, poolsByGroupId }, {
    minAccounts: MIN_ACCOUNTS,
    unknownIpHash: hashFingerprint('unknown'),
  });
  report.scope = { week: WEEK, since: SINCE, limit: LIMIT, truncated: stakes.length >= LIMIT, readMs: Date.now() - startedAt };
  if (AS_JSON) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(formatSybilReport(report));
    console.log('');
    console.log(`Scope — week: ${WEEK ?? 'all'} · since: ${SINCE ?? 'the beginning'} · limit: ${LIMIT}${report.scope.truncated ? ' (REACHED — narrow with --week or --since)' : ''} · read in ${report.scope.readMs} ms`);
  }
}

main().catch((err) => {
  console.error('backing-sybil-watch failed:', err?.message ?? err);
  process.exit(1);
});
