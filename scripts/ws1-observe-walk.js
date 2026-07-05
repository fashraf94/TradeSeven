#!/usr/bin/env node
// scripts/ws1-observe-walk.js
//
// WS1 observe-walk — drives a known rule-vs-archetype conflict through every
// guarded service path against a REAL Trend Follower (momentum_chaser) test agent
// and confirms each observe event lands EXACTLY ONCE in the rule_compat stream.
// The Forge UI can't reach any guarded path yet (dark), so this is script-driven.
//
// Conventions mirror scripts/rule-compat-cleanup.js: .env.local admin creds,
// DRY-RUN by default (plan + expected events, zero writes/POSTs), `--live --yes`
// to execute, real test agent, reversible/idempotent, byte-exact report.
//
// The four guarded paths (RULE_COMPAT_MODE='observe' → classify + log, never block):
//   1. equip_bundle     — mean-reversion bundle (tech-rsi-oversold + tv-06) →
//                         one compat_conflict_equip each; tech-moving-average-trend
//                         (momentum-aligned/native) → SILENCE.
//   2. set_rule_hardness — promote tech-rsi-oversold to hard → one
//                         compat_promote_blocked (blocked:false in observe).
//   3. change-archetype — flip momentum_chaser→analyst→momentum_chaser → one
//                         server-emitted compat_archetype_change_rescan per flip;
//                         the arrival-at-momentum_chaser rescan carries conflictCount 2.
//   4. native rule      — ts-01 on Capital Preserver (guardian) → SILENCE (proves
//                         the classifier isn't over-firing).
//
// DECISION LAYER is faithful: it imports getRuleCompatInfo (the classification
// source of truth; zero-import, Node-clean) and builds events with the SAME field
// shape as src/services/ruleCompatGuard.js:106-119 (that module can't be imported —
// it pulls in the client fetchWithAuth → firebase client auth). The PERSISTENCE
// layer is real: it authenticates as the test agent's owner (admin custom token →
// Identity Toolkit exchange) and POSTs to the real /api/agent/log-rule-compat-event
// + /api/agent/change-archetype, then reads back the GCS signal_drops stream.
//
// CONFIRMATION: never the HTTP 200 (the rule_compat stream inherits the shadow
// logger's silent error-swallow — WS1_PRE_ENFORCE_BACKLOG.md). Confirmed by reading
// back gs://fantasytrades/shadow/signal_drops/<date>/; if GCS_CREDENTIALS are
// absent, persistence is reported UNCONFIRMED (loud) with the write-site-logging
// fallback instructions — an empty capture is NEVER read as a pass.
//
// USAGE (from project root):
//   node scripts/ws1-observe-walk.js                              # DRY-RUN: plan + expected events
//   node scripts/ws1-observe-walk.js --live --yes --create       # live: create a throwaway test agent
//   node scripts/ws1-observe-walk.js --live --yes --agent <id> --uid <ownerUid>
//   node scripts/ws1-observe-walk.js --live --yes --revert       # restore/remove the test agent only
// ENV (.env.local): FIREBASE_ADMIN_CREDENTIALS, VITE_FIREBASE_API_KEY, GCS_CREDENTIALS (read-back),
//   WS1_WALK_BASE_URL (deployed origin the endpoints are served from, e.g. https://<app>.vercel.app)

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRuleCompatInfo } from '../src/data/archetypeRuleCompatibility.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');
const GCS_BUCKET = 'fantasytrades';
const TREND_FOLLOWER = 'momentum_chaser';
const CAPITAL_PRESERVER = 'guardian';

function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function parseArgs(argv) {
  const f = { live: false, yes: false, create: false, revert: false, agent: null, uid: null, baseUrl: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') f.live = true;
    else if (a === '--yes') f.yes = true;
    else if (a === '--create') f.create = true;
    else if (a === '--revert') f.revert = true;
    else if (a === '--agent') f.agent = argv[++i];
    else if (a === '--uid') f.uid = argv[++i];
    else if (a === '--base-url') f.baseUrl = argv[++i];
    else if (a === '--out') f.out = argv[++i];
    else die(`Unknown flag: ${a}`);
  }
  return f;
}

// The walk's rule fixtures (real KB template ids → verified compat states).
const FIXTURES = {
  // mean-reversion buy-weakness (core_conflict for Trend Follower)
  rsi: { templateId: 'tech-rsi-oversold', category: 'technical', text: 'Prefer stocks with RSI below 30' },
  bollinger: { templateId: 'tv-06', category: 'technical', text: 'Buy near the lower Bollinger band' },
  // momentum-aligned (native for Trend Follower → silence)
  maTrend: { templateId: 'tech-moving-average-trend', category: 'technical', text: 'Prefer stocks above their moving average' },
  // native control on a Capital Preserver (silence)
  volCap: { templateId: 'ts-01', category: 'risk', text: 'Volatility-adjusted star cap' },
};

// category → resolved hardness (mirrors src/.../hardSoftHelper.js: risk|allocation = hard).
const HARD_CATEGORIES = new Set(['risk', 'allocation']);
const resolveHardness = (category, override) => override || (HARD_CATEGORIES.has(category) ? 'hard' : 'soft');

// Build a compat event for a conflict, mirroring ruleCompatGuard.js:106-119 exactly.
// Returns null when the rule is NOT core_conflict for the archetype (SILENCE).
function buildConflictEvent({ templateId, archetype, path: writePath, resolvedHardness, agentId, ruleDocId, mode = 'observe', ts }) {
  const info = getRuleCompatInfo(templateId, archetype);
  if (info.state !== 'core_conflict') return null; // silence — the guard emits nothing
  const wouldBeHard = resolvedHardness === 'hard';
  const enforcing = mode === 'enforce';
  return {
    type: wouldBeHard ? 'compat_promote_blocked' : 'compat_conflict_equip',
    ruleId: templateId,
    ruleDocId: ruleDocId || null,
    state: 'core_conflict',
    zone1Ref: info.zone1Ref,
    hardnessRequested: resolvedHardness,
    path: writePath,
    blocked: enforcing && wouldBeHard, // observe → always false
    ts,
  };
}

// The expected observe-stream contents for the walk (the plan + the read-back oracle).
function buildPlan(ts) {
  const equip = [FIXTURES.rsi, FIXTURES.bollinger, FIXTURES.maTrend]
    .map((r) => buildConflictEvent({ templateId: r.templateId, archetype: TREND_FOLLOWER, path: 'equip_bundle', resolvedHardness: resolveHardness(r.category), agentId: null, ruleDocId: r.templateId, ts }))
    .filter(Boolean); // maTrend → null (silence)
  const promote = buildConflictEvent({ templateId: FIXTURES.rsi.templateId, archetype: TREND_FOLLOWER, path: 'set_rule_hardness', resolvedHardness: 'hard', agentId: null, ruleDocId: FIXTURES.rsi.templateId, ts });
  const nativeControl = buildConflictEvent({ templateId: FIXTURES.volCap.templateId, archetype: CAPITAL_PRESERVER, path: 'set_rule_hardness', resolvedHardness: 'hard', agentId: null, ruleDocId: FIXTURES.volCap.templateId, ts });
  return {
    equip_bundle: { post: { events: equip }, expect: `${equip.length} compat_conflict_equip (tech-rsi-oversold, tv-06); SILENCE for tech-moving-average-trend (native)` },
    set_rule_hardness: { post: { events: [promote] }, expect: '1 compat_promote_blocked, blocked:false (observe never blocks)' },
    change_archetype: { flips: [[TREND_FOLLOWER, 'analyst'], ['analyst', TREND_FOLLOWER]], expect: '2 server-emitted compat_archetype_change_rescan; arrival at momentum_chaser carries conflictCount 2' },
    native_control: { event: nativeControl, expect: 'SILENCE — ts-01 on guardian is native (classifier not over-firing)' },
  };
}

function printDryRun(plan) {
  const L = [];
  L.push('# WS1 observe-walk — DRY-RUN (no writes, no POSTs). Expected rule_compat stream:');
  L.push(`# RULE_COMPAT_MODE must be 'observe' at the deployed endpoint (preflight enforces non-404).`);
  L.push('');
  L.push('1. equip_bundle  → ' + plan.equip_bundle.expect);
  for (const e of plan.equip_bundle.post.events) L.push(`     • ${e.type} ruleId=${e.ruleId} zone1=${e.zone1Ref} hardness=${e.hardnessRequested} blocked=${e.blocked}`);
  L.push('2. set_rule_hardness → ' + plan.set_rule_hardness.expect);
  for (const e of plan.set_rule_hardness.post.events) L.push(`     • ${e.type} ruleId=${e.ruleId} hardness=${e.hardnessRequested} blocked=${e.blocked}`);
  L.push('3. change_archetype → ' + plan.change_archetype.expect);
  for (const [from, to] of plan.change_archetype.flips) L.push(`     • flip ${from} → ${to} (server emits compat_archetype_change_rescan)`);
  L.push('4. native_control → ' + plan.native_control.expect);
  L.push(`     • ${plan.native_control.event === null ? 'SILENCE (no event built — correct)' : 'UNEXPECTED EVENT: ' + JSON.stringify(plan.native_control.event)}`);
  L.push('');
  const records = 1 /* equip POST */ + 1 /* promote POST */ + plan.change_archetype.flips.length; /* one rescan record per flip */
  const nEquip = plan.equip_bundle.post.events.length;
  L.push(`# Expected stream RECORDS: ${records} (equip POST + promote POST + ${plan.change_archetype.flips.length} rescans).`);
  L.push(`# Expected EVENTS: compat_conflict_equip ×${nEquip}, compat_promote_blocked ×1, compat_archetype_change_rescan ×${plan.change_archetype.flips.length}. Silences: tech-moving-average-trend, ts-01/guardian.`);
  L.push('# Run with `--live --yes --create` to drive the real endpoints and read back GCS.');
  return L.join('\n');
}

// ---------- LIVE ----------
async function mintIdToken(admin, uid, webApiKey) {
  const customToken = await admin.auth().createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok || !body.idToken) die(`custom-token exchange failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  return body.idToken;
}

const api = (baseUrl, endpoint, idToken, payload) =>
  fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });

async function preflight(baseUrl, idToken, agentId) {
  // A well-authed POST with an empty events array → 400 invalid_events (NOT 404),
  // proving the endpoint is serving observe/enforce. Logs nothing.
  const res = await api(baseUrl, '/api/agent/log-rule-compat-event', idToken, { agentId, archetype: TREND_FOLLOWER, mode: 'observe', events: [] });
  if (res.status === 404) {
    die("preflight: /api/agent/log-rule-compat-event returned 404 — the deployed endpoint is NOT serving observe. The flag did not land where the script hits. STOP; do not read empty capture as a pass. (Founder A-note.)");
  }
  return res.status; // expect 400 (empty events) or similar non-404
}

async function setupTestAgent(db, admin, agentId, uid, ledger) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const agentRef = db.collection('agents').doc(agentId);
  ledger.push({ op: 'delete', ref: `agents/${agentId}` });
  await agentRef.set({ ownerId: uid, archetype: TREND_FOLLOWER, activeBattleId: null, equippedTraits: [], stats: { gamesPlayed: 0 }, equippedBundleIds: [], activeRules: [], _ws1WalkTest: true });
  const ruleDocs = {};
  for (const key of ['rsi', 'bollinger', 'maTrend']) {
    const r = FIXTURES[key];
    const ref = agentRef.collection('rules').doc();
    ruleDocs[key] = ref.id;
    await ref.set({ text: r.text, source: 'forge_discover', sourceRef: r.templateId, category: r.category, status: 'active', priority: 0, traitId: null, provenance: 'user_equipped', isRefined: false, isDeleted: false, bundleIds: [], createdAt: now, updatedAt: now });
  }
  const bundleRef = agentRef.collection('bundles').doc();
  await bundleRef.set({
    name: 'WS1 Walk Mean-Reversion Kit', version: 1, previousVersionId: null, status: 'forged',
    ruleIds: [ruleDocs.rsi, ruleDocs.bollinger, ruleDocs.maTrend],
    ruleHardness: {},
    ruleSnapshots: ['rsi', 'bollinger', 'maTrend'].map((k) => ({ id: ruleDocs[k], text: FIXTURES[k].text, textTemplate: null, params: null, paramValues: null, category: FIXTURES[k].category, visibility: 'private', sourceRef: FIXTURES[k].templateId, provenance: 'user_equipped' })),
    conflictCheckResult: null, createdAt: now, forgedAt: new Date().toISOString(), equippedAt: new Date().toISOString(), archivedAt: null,
    performanceData: { battlesEquipped: 0, totalCitations: 0, successfulCitations: 0 },
  });
  await agentRef.update({ equippedBundleIds: [bundleRef.id], activeRules: [ruleDocs.rsi, ruleDocs.bollinger, ruleDocs.maTrend] });
  return { ruleDocs, bundleId: bundleRef.id };
}

async function readBackGcs(gcs, agentId, sinceIso) {
  const bucket = gcs.bucket(GCS_BUCKET);
  const dateKey = sinceIso.slice(0, 10);
  const [files] = await bucket.getFiles({ prefix: `shadow/signal_drops/${dateKey}/` });
  const records = [];
  for (const file of files) {
    const [buf] = await file.download();
    for (const line of buf.toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch { continue; }
      if (rec.stage === 'rule_compat' && rec.agentId === agentId && (rec._loggedAt || '') >= sinceIso) records.push(rec);
    }
  }
  return records;
}

function tallyEvents(records) {
  const byType = {};
  for (const rec of records) for (const e of rec.events || []) byType[e.type] = (byType[e.type] || 0) + 1;
  return byType;
}

async function main() {
  const f = parseArgs(process.argv);
  const ts = new Date().toISOString();
  const plan = buildPlan(ts);

  if (!f.live) {
    console.log(printDryRun(plan));
    return;
  }
  if (!f.yes) die('live run requires --yes (safety).');

  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const creds = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  const webApiKey = env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  const baseUrl = (f.baseUrl || env.WS1_WALK_BASE_URL || process.env.WS1_WALK_BASE_URL || '').replace(/\/$/, '');
  const gcsCreds = env.GCS_CREDENTIALS || process.env.GCS_CREDENTIALS;
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS missing (.env.local).');
  if (!webApiKey) die('VITE_FIREBASE_API_KEY missing — needed to mint a user ID token for the test owner.');
  if (!baseUrl) die('base URL missing — pass --base-url or set WS1_WALK_BASE_URL to the deployed origin.');

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const adminApp = await import('firebase-admin');
  if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(creds)) });
  const admin = adminApp.default;
  const db = admin.firestore();

  const uid = f.uid || (f.create ? `ws1_walk_uid_${Date.now()}` : die('--agent runs need --uid (the agent ownerId).'));
  const agentId = f.agent || (f.create ? `ws1walk${Date.now()}` : die('pass --agent <id> or --create.'));
  const ledger = [];
  const runStart = new Date().toISOString();

  try {
    const idToken = await mintIdToken(admin, uid, webApiKey);
    const pf = await preflight(baseUrl, idToken, agentId);
    console.log(`[preflight] log endpoint live (status ${pf}, non-404). observe confirmed at the deployed origin.`);

    if (f.revert) { /* revert-only handled in finally */ throw { __revertOnly: true }; }

    let refs = null;
    if (f.create) refs = await setupTestAgent(db, admin, agentId, uid, ledger);
    else console.log('[setup] --agent mode: assuming the agent already carries the mean-reversion bundle + rules.');

    // 1. equip_bundle
    const equipEvents = plan.equip_bundle.post.events.map((e) => ({ ...e, ruleDocId: refs ? refs.ruleDocs[e.ruleId === 'tech-rsi-oversold' ? 'rsi' : 'bollinger'] : e.ruleId }));
    const r1 = await api(baseUrl, '/api/agent/log-rule-compat-event', idToken, { agentId, archetype: TREND_FOLLOWER, mode: 'observe', events: equipEvents });
    console.log(`[equip_bundle] POST → ${r1.status} ${JSON.stringify(await r1.json())}`);
    // 2. set_rule_hardness
    const r2 = await api(baseUrl, '/api/agent/log-rule-compat-event', idToken, { agentId, archetype: TREND_FOLLOWER, mode: 'observe', events: plan.set_rule_hardness.post.events });
    console.log(`[set_rule_hardness] POST → ${r2.status} ${JSON.stringify(await r2.json())}`);
    // 3. change_archetype (two flips; arrival at momentum_chaser carries the conflict count)
    for (const [, to] of plan.change_archetype.flips) {
      const rc = await api(baseUrl, '/api/agent/change-archetype', idToken, { agentId, archetype: to });
      console.log(`[change_archetype → ${to}] ${rc.status} ${JSON.stringify(await rc.json())}`);
    }

    // 4. confirm via GCS read-back (NEVER the HTTP 200 — silent-swallow finding)
    let confirmation;
    if (gcsCreds) {
      const { Storage } = await import('@google-cloud/storage');
      const gcs = new Storage({ credentials: JSON.parse(gcsCreds) });
      const records = await readBackGcs(gcs, agentId, runStart);
      const byType = tallyEvents(records);
      const rescan = records.reduce((n, r) => n + (r.events || []).filter((e) => e.type === 'compat_archetype_change_rescan').length, 0);
      confirmation = {
        source: 'gcs_read_back',
        streamRecords: records.length,
        eventCountsByType: byType,
        exactlyOnce: {
          compat_conflict_equip: byType.compat_conflict_equip === 2,
          compat_promote_blocked: byType.compat_promote_blocked === 1,
          compat_archetype_change_rescan: rescan === plan.change_archetype.flips.length,
        },
      };
    } else {
      confirmation = {
        source: 'UNCONFIRMED',
        warning: 'GCS_CREDENTIALS absent — cannot read back the stream. The endpoint 200 is NOT proof (rule_compat inherits the shadow-logger silent-swallow; WS1_PRE_ENFORCE_BACKLOG.md). Persistence UNCONFIRMED — do NOT read this as a pass.',
        writeSiteLoggingFallback: 'To confirm without GCS: run the endpoint locally with a temporary log at api/_utils/shadowLogger.js appendToStream (after `await bucket.file(...).save(...)` log "persisted", and in the catch log "THREW"), re-drive, and read the local server logs.',
      };
    }

    const report = { runStart, agentId, uid, baseUrl, mode: 'observe', plan, confirmation };
    const outPath = f.out || path.join(process.cwd(), `ws1-observe-walk-${runStart.replace(/[:.]/g, '-')}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nReport → ${outPath}`);
    console.log(confirmation.source === 'gcs_read_back' ? `Exactly-once: ${JSON.stringify(confirmation.exactlyOnce)}` : confirmation.warning);
  } catch (err) {
    if (!err?.__revertOnly) console.error(`\n[walk] error: ${err?.stack || err?.message || err}`);
  } finally {
    // Reversible: remove the throwaway test agent's docs (created ones only).
    if (f.create || f.revert) {
      const agentRef = db.collection('agents').doc(agentId);
      for (const sub of ['rules', 'bundles']) {
        const snap = await agentRef.collection(sub).get();
        for (const d of snap.docs) await d.ref.delete();
      }
      await agentRef.delete().catch(() => {});
      console.log(`[revert] removed test agent ${agentId} (+ rules/bundles).`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => die(err?.stack || err?.message || String(err)));
}

export { buildConflictEvent, buildPlan, resolveHardness, FIXTURES };
