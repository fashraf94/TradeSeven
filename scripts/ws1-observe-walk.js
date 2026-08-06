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
// POSTs a probe with redirect:'manual' — a broken bridge STOPs at the top with the
// PRECISE cause and never fires four bare (headerless) POSTs:
//   3xx    = origin redirects → Node fetch strips Authorization across the hop; the
//            preflight names the final canonical origin to set WS1_WALK_BASE_URL to.
//   404    = deployed build not serving observe (flag mismatch).
//   401 (non-JSON) = platform auth wall (Vercel deployment protection / SSO) upstream.
//   401 'Missing header'      = header stripped in transit (edge/proxy/rewrite).
//   401 'Invalid/expired token' = token rejected (cross-project key or expiry).
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
//   WS1_WALK_BASE_URL (deployed origin), and the GCS read-back creds — PREFERRED
//   GCS_CREDENTIALS_PATH=<path to a gitignored service-account .json> (sidesteps all
//   multi-line/quoting pain); FALLBACK inline GCS_CREDENTIALS (multi-line tolerated
//   only if SINGLE-quoted). Missing/unparseable creds → loud UNCONFIRMED, never a crash.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertWriteEpochOpen } from '../api/_utils/compositionWriteEpoch.js';
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

// Parse a .env file. Single-line values keep the exact legacy behavior (strip one
// surrounding quote pair). A QUOTED value whose opening quote does not close on the
// same line is accumulated across physical lines until the matching close quote — so a
// multi-line, single-quoted service-account JSON blob loads intact instead of being
// truncated at the first newline. (Preferred over inline blobs: GCS_CREDENTIALS_PATH.)
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  const lines = readFileSync(filePath, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const rawVal = m[2];
    const q = rawVal[0];
    if ((q === '"' || q === "'") && rawVal.indexOf(q, 1) === -1) {
      // Multi-line quoted value: accumulate until the closing quote (or EOF).
      const acc = [rawVal.slice(1)];
      for (i++; i < lines.length; i++) {
        const ci = lines[i].indexOf(q);
        if (ci !== -1) { acc.push(lines[i].slice(0, ci)); break; }
        acc.push(lines[i]);
      }
      out[key] = acc.join('\n');
    } else {
      out[key] = rawVal.replace(/^["']|["']$/g, '');
    }
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
  return { status: res.status, ok: res.ok, json, text, location: res.headers?.get?.('location') ?? null, redirected: res.redirected ?? false };
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

// Resolve the GCS service-account creds for the read-back. PREFERRED: GCS_CREDENTIALS_PATH
// → a gitignored .json file (sidesteps all multi-line/quoting pain). FALLBACK: the inline
// GCS_CREDENTIALS blob (now multi-line-tolerant if single-quoted; see parseEnvFile).
// Returns the raw JSON STRING (parsed safely downstream) + a source label + a load error.
function resolveGcsCreds(env) {
  const p = env.GCS_CREDENTIALS_PATH || process.env.GCS_CREDENTIALS_PATH;
  if (p) {
    const abs = path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);
    if (!existsSync(abs)) {
      return { credsJson: null, source: `path:${abs}`, error: `GCS_CREDENTIALS_PATH points to a missing file: ${abs}.` };
    }
    try {
      return { credsJson: readFileSync(abs, 'utf8'), source: `path:${abs}` };
    } catch (err) {
      return { credsJson: null, source: `path:${abs}`, error: `could not read GCS_CREDENTIALS_PATH file ${abs}: ${err?.message || err}.` };
    }
  }
  const inline = env.GCS_CREDENTIALS || process.env.GCS_CREDENTIALS;
  if (inline) return { credsJson: inline, source: 'inline:GCS_CREDENTIALS' };
  return { credsJson: null, source: null };
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
// auth bridge never fires a bare POST). redirect:'manual' is deliberate: Node's fetch
// DROPS the Authorization header across a cross-origin redirect (WHATWG fetch spec),
// so a silently-followed 3xx would deliver a headerless request to the endpoint and
// produce a spurious 'Missing Authorization header' 401. Surfacing the 3xx lets the
// preflight name the final origin instead of misreporting a stripped header as a bad token.
function api(baseUrl, endpoint, idToken, payload) {
  if (!idToken || typeof idToken !== 'string' || idToken.length < 20) {
    die(`refusing to POST ${endpoint} with an empty/invalid Authorization token — auth bridge broken.`);
  }
  return fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
}

// Auth + endpoint preflight: POST an empty-events probe with the minted token and
// classify the response BEFORE any path fires. Each failure signature STOPs loudly
// with its precise cause — an empty capture is NEVER read as a pass:
//   • 3xx / opaqueredirect  — the origin redirects; Node's fetch DROPS Authorization
//       across a cross-origin hop (WHATWG fetch spec), so a followed redirect delivers
//       a HEADERLESS request and the endpoint answers 401 'Missing header' — NOT a
//       token problem. Name the final origin from Location so WS1_WALK_BASE_URL can
//       point straight at it. (This is the signature the founder's mint-only run hit:
//       a valid 790-char JWT, yet 'Missing or invalid Authorization header'.)
//   • non-JSON 401/403      — a platform auth wall (Vercel deployment protection / SSO)
//       intercepts BEFORE the endpoint; the request never reaches it.
//   • 404                   — the deployed build isn't serving observe (flag mismatch).
//   • JSON 401              — the endpoint answered; disambiguate by its message
//       (authMiddleware.js): 'Missing or invalid Authorization header' = header stripped
//       in transit; 'Invalid or expired token' = token rejected (cross-project/expired).
// Expected PASS: 400 (authed; the empty-events probe is rejected on content, not auth).
async function authPreflight(baseUrl, idToken, agentId) {
  const r = await readResponse(await api(baseUrl, '/api/agent/log-rule-compat-event', idToken, { agentId, archetype: TREND_FOLLOWER, mode: 'observe', events: [] }));

  if (r.status === 0 || (r.status >= 300 && r.status < 400)) {
    let finalOrigin = r.location || '(opaque)';
    try { finalOrigin = new URL(r.location).origin; } catch { /* opaque / relative */ }
    const loc = r.location || `(opaque — run \`curl -sI ${baseUrl}/api/agent/log-rule-compat-event\` to read Location)`;
    die(
      `preflight: the origin returned a ${r.status || '3xx'} redirect → ${loc}\n` +
        `Node's fetch STRIPS the Authorization header across a cross-origin redirect (WHATWG fetch spec), so ` +
        `following it delivers a HEADERLESS request and the endpoint answers 401 'Missing Authorization header' — ` +
        `NOT a token problem. Point WS1_WALK_BASE_URL at the FINAL canonical origin (${finalOrigin}) and re-run.`,
    );
  }

  if (r.json === null && (r.status === 401 || r.status === 403)) {
    die(
      `preflight: ${r.status} with a NON-JSON body — a platform auth wall (Vercel deployment protection / SSO) ` +
        `is intercepting BEFORE the endpoint; the request never reaches log-rule-compat-event.\n` +
        `Body: ${r.text.slice(0, 160).replace(/\s+/g, ' ')}\n` +
        `Disable deployment protection for this deployment, or set WS1_WALK_BASE_URL to the public production origin.`,
    );
  }

  if (r.status === 404) {
    die("preflight: log endpoint returned 404 — the deployed origin is NOT serving observe. Resolve the repo-vs-deployed flag mismatch; do NOT read empty capture as a pass. (Founder A-note.)");
  }

  if (r.status === 401) {
    const msg = r.json?.message || r.text.slice(0, 120);
    if (/Missing or invalid Authorization header/i.test(msg)) {
      die(
        `preflight: 401 'Missing or invalid Authorization header' — the endpoint answered but saw NO header, though ` +
          `the script sent 'Authorization: Bearer <token>' (mirrors fetchWithAuth exactly) and no redirect was followed. ` +
          `An edge/proxy/rewrite in front of the function stripped it. Confirm WS1_WALK_BASE_URL is the DIRECT canonical ` +
          `origin (no proxy/rewrite) and re-run. STOP — the auth bridge is broken in transit, not in the script.`,
      );
    }
    die(
      `preflight: 401 '${msg}' — the header arrived but the TOKEN was rejected (expired, revoked, or the web API key ` +
        `is for a DIFFERENT Firebase project than the admin service account). Verify the web API key and admin creds ` +
        `are the SAME project. Auth bridge broken; STOP before firing any path POST.`,
    );
  }

  return r.status; // expect 400 (authed; empty events invalid) → endpoint live + observe + token accepted
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

const WRITE_SITE_FALLBACK =
  'To confirm without GCS: run the endpoint locally with a temporary log at api/_utils/shadowLogger.js ' +
  'appendToStream (after the bucket.file(...).save(...) log "persisted", in the catch log "THREW"), re-drive, ' +
  'and read the local server logs.';

// Confirm persistence via the GCS read-back — and NEVER throw. Every failure mode
// (creds path missing, creds absent, creds present-but-unparseable, GCS auth/network
// error, an error/XML body, an empty/garbage listing) degrades to UNCONFIRMED-with-
// fallback carrying the raw reason, so the walk always completes and writes its report.
// This is the same safe-parse discipline readResponse() applies to HTTP bodies, extended
// to the creds string + the read-back. The endpoint 200 is NEVER proof (silent-swallow).
async function buildGcsConfirmation({ credsJson, credsSource, credsError, agentId, runStart, expectedRescans }) {
  const unconfirmed = (reason, warning, extra = {}) => ({
    source: 'UNCONFIRMED',
    reason,
    credsSource: credsSource || null,
    warning: `${warning} Persistence UNCONFIRMED; the endpoint 200 is NOT proof (rule_compat inherits the shadow-logger silent-swallow; WS1_PRE_ENFORCE_BACKLOG.md) — do NOT read this as a pass.`,
    writeSiteLoggingFallback: WRITE_SITE_FALLBACK,
    ...extra,
  });

  if (credsError) {
    return unconfirmed('GCS creds not loadable', credsError);
  }
  if (!credsJson) {
    return unconfirmed(
      'GCS credentials absent',
      'No GCS_CREDENTIALS_PATH or GCS_CREDENTIALS set — cannot read back the stream.',
    );
  }
  let credentials;
  try {
    credentials = JSON.parse(credsJson);
  } catch (err) {
    return unconfirmed(
      'GCS credentials present but not valid JSON',
      `GCS credentials (${credsSource}) did not parse as JSON (${err?.message || err}). PREFERRED fix: use ` +
        `GCS_CREDENTIALS_PATH → a gitignored .json file. If kept inline, a multi-line blob must be SINGLE-quoted.`,
      { rawCredsHead: String(credsJson).slice(0, 120) },
    );
  }
  try {
    const { Storage } = await import('@google-cloud/storage');
    const gcs = new Storage({ credentials });
    const records = await readBackGcs(gcs, agentId, runStart);
    const byType = tallyEvents(records);
    const rescan = byType.compat_archetype_change_rescan || 0;
    return {
      source: 'gcs_read_back',
      credsSource: credsSource || null,
      streamRecords: records.length,
      eventCountsByType: byType,
      exactlyOnce: {
        compat_conflict_equip: byType.compat_conflict_equip === 2,
        compat_promote_blocked: byType.compat_promote_blocked === 1,
        compat_archetype_change_rescan: rescan === expectedRescans,
      },
    };
  } catch (err) {
    return unconfirmed(
      'GCS read-back failed',
      `GCS read-back threw (${err?.message || err}) — creds scope, bucket access, or an error/XML body from GCS.`,
      { rawError: String(err?.stack || err?.message || err).slice(0, 300) },
    );
  }
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
  const { credsJson: gcsCredsJson, source: gcsCredsSource, error: gcsCredsError } = resolveGcsCreds(env);
  if (!creds) die('FIREBASE_ADMIN_CREDENTIALS missing (.env.local).');
  if (!webApiKey) die(`web API key missing — set one of ${WEB_API_KEY_CANDIDATES.join(' / ')} in .env.local (must match the admin service account's Firebase project).`);
  if (!baseUrl) die('base URL missing — pass --base-url or set WS1_WALK_BASE_URL to the deployed origin.');

  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(creds)) });
  const db = getFirestore();
  // Composition write-epoch fence (admin-CLI class): entry guard (A46 census row).
  await assertWriteEpochOpen(db);

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

    // 4. confirm via GCS read-back (NEVER the HTTP 200 — silent-swallow finding).
    // buildGcsConfirmation never throws: a bad/absent cred or a failed read degrades
    // to UNCONFIRMED so the report below ALWAYS writes, even when nothing is parseable.
    console.log(`[gcs] read-back creds source: ${gcsCredsSource || 'none (UNCONFIRMED)'}${gcsCredsError ? ` — ${gcsCredsError}` : ''}`);
    const confirmation = await buildGcsConfirmation({ credsJson: gcsCredsJson, credsSource: gcsCredsSource, credsError: gcsCredsError, agentId, runStart, expectedRescans: plan.change_archetype.flips.length });

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

export { buildConflictEvent, buildPlan, resolveHardness, resolveWebApiKey, resolveGcsCreds, parseEnvFile, readResponse, buildGcsConfirmation, FIXTURES };
