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
// AUTH BRIDGE is verified in ISOLATION before any path runs: it mints a Firebase
// ID token for the test owner (admin custom token → Identity Toolkit exchange) and
// POSTs a probe — a broken bridge STOPs at the top (404 = flag not serving observe;
// 401 = token not accepted), never firing four bare (headerless) POSTs.
//   node scripts/ws1-observe-walk.js --live --yes --mint-only   # verify the auth bridge alone
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
//   4. native rule      — ts-01 on Capital Preserver (guardian) → SILENCE.
//
// DECISION LAYER is faithful: it imports getRuleCompatInfo (the classification
// source of truth; zero-import, Node-clean) and builds events with the SAME field
// shape as src/services/ruleCompatGuard.js:106-119 (that module can't be imported —
// it pulls in the client fetchWithAuth → firebase client auth).
//
// CONFIRMATION: never the HTTP 200 (the rule_compat stream inherits the shadow
// logger's silent error-swallow — WS1_PRE_ENFORCE_BACKLOG.md). Confirmed by reading
// back gs://fantasytrades/shadow/signal_drops/<date>/; if GCS_CREDENTIALS are
// absent, persistence is reported UNCONFIRMED (loud) — an empty capture is NEVER a pass.
//
// USAGE (from project root):
//   node scripts/ws1-observe-walk.js                              # DRY-RUN
//   node scripts/ws1-observe-walk.js --live --yes --mint-only     # verify auth bridge only
//   node scripts/ws1-observe-walk.js --live --yes --create        # full walk, throwaway agent
//   node scripts/ws1-observe-walk.js --live --yes --agent <id> --uid <ownerUid>
//   node scripts/ws1-observe-walk.js --live --yes --revert --create --agent <id>  # cleanup only
// ENV (.env.local): FIREBASE_ADMIN_CREDENTIALS, a web API key (VITE_FIREBASE_API_KEY /
//   FIREBASE_API_KEY / FIREBASE_WEB_API_KEY — must match the admin project),
//   GCS_CREDENTIALS (read-back), WS1_WALK_BASE_URL (deployed origin).

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getRuleCompatInfo } from '../src/data/archetypeRuleCompatibility.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');
const GCS_BUCKET = 'fantasytrades';
const TREND_FOLLOWER = 'momentum_chaser';
const CAPITAL_PRESERVER = 'guardian';
const WEB_API_KEY_CANDIDATES = ['VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY', 'FIREBASE_WEB_API_KEY'];

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
  const f = { live: false, yes: false, create: false, revert: false, mintOnly: false, agent: null, uid: null, baseUrl: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') f.live = true;
    else if (a === '--yes') f.yes = true;
    else if (a === '--create') f.create = true;
    else if (a === '--revert') f.revert = true;
    else if (a === '--mint-only') f.mintOnly = true;
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
  rsi: { templateId: 'tech-rsi-oversold', category: 'technical', text: 'Prefer stocks with RSI below 30' },
  bollinger: { templateId: 'tv-06', category: 'technical', text: 'Buy near the lower Bollinger band' },
  maTrend: { templateId: 'tech-moving-average-trend', category: 'technical', text: 'Prefer stocks above their moving average' },
  volCap: { templateId: 'ts-01', category: 'risk', text: 'Volatility-adjusted star cap' },
};

const HARD_CATEGORIES = new Set(['risk', 'allocation']);
const resolveHardness = (category, override) => override || (HARD_CATEGORIES.has(category) ? 'hard' : 'soft');

// Build a compat event for a conflict, mirroring ruleCompatGuard.js:106-119 exactly.
// Returns null when the rule is NOT core_conflict for the archetype (SILENCE).
function buildConflictEvent({ templateId, archetype, path: writePath, resolvedHardness, ruleDocId, mode = 'observe', ts }) {
  const info = getRuleCompatInfo(templateId, archetype);
  if (info.state !== 'core_conflict') return null;
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

function buildPlan(ts) {
  const equip = [FIXTURES.rsi, FIXTURES.bollinger, FIXTURES.maTrend]
    .map((r) => buildConflictEvent({ templateId: r.templateId, archetype: TREND_FOLLOWER, path: 'equip_bundle', resolvedHardness: resolveHardness(r.category), ruleDocId: r.templateId, ts }))
    .filter(Boolean);
  const promote = buildConflictEvent({ templateId: FIXTURES.rsi.templateId, archetype: TREND_FOLLOWER, path: 'set_rule_hardness', resolvedHardness: 'hard', ruleDocId: FIXTURES.rsi.templateId, ts });
  const nativeControl = buildConflictEvent({ templateId: FIXTURES.volCap.templateId, archetype: CAPITAL_PRESERVER, path: 'set_rule_hardness', resolvedHardness: 'hard', ruleDocId: FIXTURES.volCap.templateId, ts });
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
  L.push(`# RULE_COMPAT_MODE must be 'observe' at the deployed endpoint (preflight enforces non-404 + token accepted).`);
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
  const records = 1 + 1 + plan.change_archetype.flips.length;
  const nEquip = plan.equip_bundle.post.events.length;
  L.push(`# Expected stream RECORDS: ${records} (equip POST + promote POST + ${plan.change_archetype.flips.length} rescans).`);
  L.push(`# Expected EVENTS: compat_conflict_equip ×${nEquip}, compat_promote_blocked ×1, compat_archetype_change_rescan ×${plan.change_archetype.flips.length}. Silences: tech-moving-average-trend, ts-01/guardian.`);
  L.push('# Run with `--live --yes --create` to drive the real endpoints and read back GCS.');
  return L.join('\n');
}

// ---------- LIVE ----------

// Read a response body safely — NEVER throw on non-JSON (a platform 401/HTML page
// must not crash the walk). Returns { status, ok, json, text }.
async function readResponse(res) {
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, ok: res.ok, json, text };
}

// The web API key must belong to the SAME Firebase project as the admin service
// account (the custom-token exchange rejects a cross-project key). Try the known
// candidate env names — VITE_ vars are read here directly from .env.local (there is
// no Vite bundler in this Node context), so the VITE_ prefix is fine.
function resolveWebApiKey(env) {
  for (const name of WEB_API_KEY_CANDIDATES) {
    const v = env[name] || process.env[name];
    if (v) return { key: v, name };
  }
  return { key: null, name: null };
}

// Mint a Firebase ID token: admin custom token → Identity Toolkit exchange.
// ROBUST: checks the exchange status/body BEFORE parsing, prints the raw body and
// STOPs loudly on any failure, and asserts the result is a real JWT — it never
// returns an empty token that would fire a bare (headerless) POST.
async function mintIdToken(getAuth, uid, webApiKey) {
  let customToken;
  try {
    customToken = await getAuth().createCustomToken(uid);
  } catch (err) {
    die(`createCustomToken failed for uid=${uid}: ${err?.message || err}. (The admin service account needs the Service Account Token Creator role / a valid private key.)`);
  }
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const r = await readResponse(res);
  if (!r.ok || !r.json?.idToken) {
    die(
      `custom-token exchange failed (HTTP ${r.status}). Raw body:\n${r.text.slice(0, 500)}\n` +
        `Likely: the web API key is for a DIFFERENT Firebase project than the admin service account, or the key is wrong. ` +
        `STOP — not proceeding to POST with no auth.`,
    );
  }
  const idToken = r.json.idToken;
  if (typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    die(`exchange returned a non-JWT idToken (${JSON.stringify(idToken).slice(0, 80)}). STOP.`);
  }
  return idToken;
}

// Authed POST — asserts the token is present before sending (fail fast so a broken
// auth bridge never fires a bare POST).
function api(baseUrl, endpoint, idToken, payload) {
  if (!idToken || typeof idToken !== 'string' || idToken.length < 20) {
    die(`refusing to POST ${endpoint} with an empty/invalid Authorization token — auth bridge broken.`);
  }
  return fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
}

// Auth + endpoint preflight: POST an empty-events probe with the minted token and
// distinguish 404 (flag not serving observe) / 401 (token not accepted — auth bridge
// broken) / else (live + token accepted). STOPs loudly on 404 or 401.
async function authPreflight(baseUrl, idToken, agentId) {
  const r = await readResponse(await api(baseUrl, '/api/agent/log-rule-compat-event', idToken, { agentId, archetype: TREND_FOLLOWER, mode: 'observe', events: [] }));
  if (r.status === 404) {
    die("preflight: log endpoint returned 404 — the deployed origin is NOT serving observe. Resolve the repo-vs-deployed flag mismatch; do NOT read empty capture as a pass. (Founder A-note.)");
  }
  if (r.status === 401) {
    die(`preflight: log endpoint returned 401 (${r.json?.message || r.json?.error || r.text.slice(0, 120)}) — the minted token was NOT accepted. Auth bridge broken; STOP before firing any path POST.`);
  }
  return r.status; // expect 400 (authed; empty events invalid) → endpoint live + token accepted
}

async function setupTestAgent(db, FieldValue, agentId, uid) {
  const now = FieldValue.serverTimestamp();
  const agentRef = db.collection('agents').doc(agentId);
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

async function removeTestAgent(db, agentId) {
  const agentRef = db.collection('agents').doc(agentId);
  for (const sub of ['rules', 'bundles']) {
    const snap = await agentRef.collection(sub).get();
    for (const d of snap.docs) await d.ref.delete();
  }
  await agentRef.delete().catch(() => {});
}

async function main() {
  const f = parseArgs(process.argv);
  const ts = new Date().toISOString();
  const plan = buildPlan(ts);

  if (!f.live && !f.mintOnly) {
    console.log(printDryRun(plan));
    return;
  }
  if (!f.yes) die('live/mint runs require --yes (safety).');

  const env = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const creds = env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
  const { key: webApiKey, name: webApiKeyName } = resolveWebApiKey(env);
  const baseUrl = (f.baseUrl || env.WS1_WALK_BASE_URL || process.env.WS1_WALK_BASE_URL || '').replace(/\/$/, '');
  const gcsCreds = env.GCS_CREDENTIALS || process.env.GCS_CREDENTIALS;
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS missing (.env.local).');
  if (!webApiKey) die(`web API key missing — set one of ${WEB_API_KEY_CANDIDATES.join(' / ')} in .env.local (must match the admin service account's Firebase project).`);
  if (!baseUrl) die('base URL missing — pass --base-url or set WS1_WALK_BASE_URL to the deployed origin.');

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(creds)) });
  const db = getFirestore();

  const uid = f.uid || (f.create || f.mintOnly ? `ws1_walk_uid_${Date.now()}` : die('--agent runs need --uid (the agent ownerId).'));
  const agentId = f.agent || (f.create || f.mintOnly ? `ws1walk${Date.now()}` : die('pass --agent <id> or --create.'));

  // ── AUTH BRIDGE — minted + validated BEFORE any path runs ──
  console.log(`[auth] minting ID token (uid=${uid}, web key from ${webApiKeyName})…`);
  const idToken = await mintIdToken(getAuth, uid, webApiKey);
  console.log(`[auth] token minted OK (JWT, ${idToken.length} chars, prefix ${idToken.slice(0, 10)}…).`);
  const pf = await authPreflight(baseUrl, idToken, agentId);
  console.log(`[preflight] endpoint live + token accepted (status ${pf}, non-404/401). observe confirmed at the deployed origin.`);
  if (f.mintOnly) {
    console.log('\n--mint-only: auth bridge VERIFIED. Re-run with `--live --yes --create` for the full walk.');
    return;
  }

  const runStart = new Date().toISOString();
  let created = false;
  try {
    if (f.revert) throw { __revertOnly: true };
    let refs = null;
    if (f.create) { refs = await setupTestAgent(db, FieldValue, agentId, uid); created = true; }
    else console.log('[setup] --agent mode: assuming the agent already carries the mean-reversion bundle + rules.');

    // 1. equip_bundle
    const equipEvents = plan.equip_bundle.post.events.map((e) => ({ ...e, ruleDocId: refs ? refs.ruleDocs[e.ruleId === 'tech-rsi-oversold' ? 'rsi' : 'bollinger'] : e.ruleId }));
    const r1 = await readResponse(await api(baseUrl, '/api/agent/log-rule-compat-event', idToken, { agentId, archetype: TREND_FOLLOWER, mode: 'observe', events: equipEvents }));
    console.log(`[equip_bundle] → ${r1.status} ${r1.text.slice(0, 120)}`);
    // 2. set_rule_hardness
    const r2 = await readResponse(await api(baseUrl, '/api/agent/log-rule-compat-event', idToken, { agentId, archetype: TREND_FOLLOWER, mode: 'observe', events: plan.set_rule_hardness.post.events }));
    console.log(`[set_rule_hardness] → ${r2.status} ${r2.text.slice(0, 120)}`);
    // 3. change_archetype (two flips; arrival at momentum_chaser carries the conflict count)
    for (const [, to] of plan.change_archetype.flips) {
      const rc = await readResponse(await api(baseUrl, '/api/agent/change-archetype', idToken, { agentId, archetype: to }));
      console.log(`[change_archetype → ${to}] ${rc.status} ${rc.text.slice(0, 160)}`);
    }

    // 4. confirm via GCS read-back (NEVER the HTTP 200 — silent-swallow finding)
    let confirmation;
    if (gcsCreds) {
      const { Storage } = await import('@google-cloud/storage');
      const gcs = new Storage({ credentials: JSON.parse(gcsCreds) });
      const records = await readBackGcs(gcs, agentId, runStart);
      const byType = tallyEvents(records);
      const rescan = byType.compat_archetype_change_rescan || 0;
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
        writeSiteLoggingFallback: 'To confirm without GCS: run the endpoint locally with a temporary log at api/_utils/shadowLogger.js appendToStream (after the bucket.file(...).save(...) log "persisted", in the catch log "THREW"), re-drive, and read the local server logs.',
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
    if (created || f.revert) {
      await removeTestAgent(db, agentId);
      console.log(`[revert] removed test agent ${agentId} (+ rules/bundles).`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => die(err?.stack || err?.message || String(err)));
}

export { buildConflictEvent, buildPlan, resolveHardness, resolveWebApiKey, readResponse, FIXTURES };
