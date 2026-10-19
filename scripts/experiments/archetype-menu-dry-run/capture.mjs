// Stage A: Firestore reads only. No handler, price provider, or model imports.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const BATTLE_FIELDS = [
  'status', 'gameMode', 'expiresAt', 'portfolio', 'opponent.portfolio',
  'agentContext.archetype', 'agentContext.equippedWatchlist.tickers',
  'watchlist', 'cronState.lastHotBenchComputedAt', 'cronState.lastEvalTradingDay',
];
export const SOURCE_FILES = [
  'api/_utils/archetypeCandidateMenu.js', 'api/_utils/archetypeScoring.js',
  'api/_utils/watchlistEquip.js', 'api/_utils/agentScoring.js',
  'api/_utils/archetypeRegistry.js', 'api/cron/agent-evaluate.js',
  'api/cron/compute-index-intelligence.js', 'src/config/featureFlags.js',
  ...['capture.mjs', 'comparison.mjs', 'run.mjs', 'replay.test.js'].map(f => `scripts/experiments/archetype-menu-dry-run/${f}`),
];
export const digest = value => createHash('sha256').update(
  typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value),
).digest('hex');

export function timeMs(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  if (value && typeof value.seconds === 'number') return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  return typeof value === 'string' ? Date.parse(value) : NaN;
}

export function plain(value) {
  if (typeof value?.toMillis === 'function') return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, plain(v)]),
  );
  return value;
}

export function provenance() {
  return {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim()),
    sourceHashes: Object.fromEntries(SOURCE_FILES.map(f => [f, digest(readFileSync(path.join(ROOT, f)))])),
  };
}

// Check the real, on-disk exports before any isolated counterfactual runs.
export function assertDarkSource() {
  const source = readFileSync(path.join(ROOT, 'src/config/featureFlags.js'), 'utf8');
  for (const name of ['ARCHETYPE_REFRESH_MENU_ENABLED', 'ARCHETYPE_VECTORS_V2_ENABLED']) {
    if (!source.includes(`export const ${name} = false;`)) throw new Error('Stage A requires both real flags to remain false.');
  }
}

// Resolve symlinks, including an existing ancestor of a new output directory.
export function outsideDirectory(dir) {
  const target = path.resolve(dir);
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const resolved = path.resolve(realpathSync(ancestor), path.relative(ancestor, target));
  const root = realpathSync(ROOT);
  const relative = path.relative(root, resolved);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Use an output directory outside this checkout; captures contain private battle data.');
  }
  for (let parent = resolved; ; parent = path.dirname(parent)) {
    if (existsSync(path.join(parent, '.git'))) throw new Error('Use an output directory outside all git checkouts.');
    if (path.dirname(parent) === parent) break;
  }
  mkdirSync(resolved, { recursive: true, mode: 0o700 });
  return resolved;
}

function docRecord(snap) {
  if (!snap.exists) throw new Error('A required indexIntelligence document is missing.');
  return { data: plain(snap.data()), updateTime: plain(snap.updateTime), readTime: plain(snap.readTime) };
}

export function makeReader(db) {
  const rankRef = db.collection('indexIntelligence').doc('stockRankings');
  const contextRef = db.collection('indexIntelligence').doc('marketContext');
  return {
    async heads() {
      const [rankings, context] = await db.getAll(rankRef, contextRef);
      return { rankings: docRecord(rankings), context: docRecord(context) };
    },
    async battles() {
      const query = await db.collection('agentBattles').where('status', '==', 'active')
        .select(...BATTLE_FIELDS).get();
      return {
        readTime: plain(query.readTime),
        docs: query.docs.map(d => ({ id: d.id, updateTime: plain(d.updateTime), data: plain(d.data()) })),
      };
    },
  };
}

export function validateRankings(rankings) {
  if (!Number.isFinite(timeMs(rankings?.computedAt)) || !Array.isArray(rankings.stocks) || !rankings.stocks.length) {
    throw new Error('Rankings need a valid computedAt and a nonempty stocks array.');
  }
  const seen = new Set();
  for (const s of rankings.stocks) {
    if (typeof s?.symbol !== 'string' || !s.symbol || seen.has(s.symbol)) throw new Error('Invalid or duplicate ranking symbol.');
    seen.add(s.symbol);
    for (const field of ['fundamentalScore', 'technicalScore', 'baggerBombFit', 'compositeScore', 'atrPercentile']) {
      if (s[field] != null && !Number.isFinite(s[field])) throw new Error('A ranking input is non-numeric.');
    }
  }
}

export async function collectSnapshot(reader, { projectId, code = provenance(), now = Date.now } = {}) {
  if (!projectId) throw new Error('An explicit project id is required.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const startedAt = new Date(now()).toISOString();
    const before = await reader.heads();
    const battles = await reader.battles();
    const after = await reader.heads();
    // This is a bounded observation window, not an atomic multi-doc snapshot.
    // Retry if either feed changed while the battle query was in flight.
    if (digest(before.rankings.updateTime) !== digest(after.rankings.updateTime)
      || digest(before.context.updateTime) !== digest(after.context.updateTime)) continue;
    validateRankings(before.rankings.data);
    if (!before.rankings.updateTime || !before.context.updateTime) throw new Error('Missing source update times.');
    const endedAt = new Date(now()).toISOString();
    const payload = {
      schemaVersion: 1, projectId, startedAt, endedAt, code,
      rankings: before.rankings, marketContext: before.context,
      battleReadTime: battles.readTime,
      battles: battles.docs.filter(d => d.data.status === 'active'
        && (d.data.gameMode == null || d.data.gameMode === 'baggerbomb_agent')),
      excludedOtherModeCount: battles.docs.filter(d => d.data.gameMode != null && d.data.gameMode !== 'baggerbomb_agent').length,
    };
    return { payload, sha256: digest(payload) };
  }
  throw new Error('Feeds changed during all three capture attempts; retry capture.');
}

export function saveSnapshot(envelope, directory) {
  verifySnapshot(envelope);
  const p = envelope.payload;
  const key = digest([p.projectId, p.rankings.updateTime, p.rankings.data]).slice(0, 32);
  const file = path.join(outsideDirectory(directory), `snapshot-${key}.json`);
  try {
    writeFileSync(file, `${JSON.stringify(envelope, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return { file, saved: true };
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Never overwrite the first contemporaneous book with a later observation.
    const existing = JSON.parse(readFileSync(file, 'utf8'));
    verifySnapshot(existing);
    if (digest(existing.payload.rankings) !== digest(p.rankings)) {
      // readTime normally changes on a repeat; compare the immutable feed only.
      if (digest(existing.payload.rankings.data) !== digest(p.rankings.data)) throw new Error('Snapshot key collision.');
    }
    return { file, saved: false };
  }
}

export function verifySnapshot(envelope) {
  if (envelope?.payload?.schemaVersion !== 1 || digest(envelope.payload) !== envelope.sha256) throw new Error('Snapshot checksum/schema mismatch.');
  validateRankings(envelope.payload.rankings.data);
}

export function readEnvironment(file) {
  const result = {};
  if (file) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[2];
      if (value.startsWith('"') && value.endsWith('"')) {
        try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
      } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      result[match[1]] = value;
    }
  }
  return { ...result, ...process.env };
}

export function serviceAccount(env) {
  try {
    if (env.FIREBASE_ADMIN_CREDENTIALS) return JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS);
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) return {
      project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL,
      private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    if (env.GOOGLE_APPLICATION_CREDENTIALS) return JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  } catch { throw new Error('Firebase credential configuration is unreadable; values are not logged.'); }
  return null;
}

export async function connectReadOnly(env, projectId) {
  const account = serviceAccount(env);
  if (!account) throw new Error('Firebase credentials are absent. Supply --env-file or the documented environment variables.');
  if (!projectId || account.project_id !== projectId) throw new Error('Explicit --project must match the credential project_id.');
  if (process.env.FIRESTORE_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator settings are not accepted for a production observation.');
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ credential: cert(account), projectId }, `menu-dry-run-${Date.now()}`);
  return { reader: makeReader(getFirestore(app)), close: () => deleteApp(app) };
}
