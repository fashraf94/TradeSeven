/**
 * POST /api/research/correlation-narrate — Correlation Intelligence V3 Phase 2,
 * the NARRATED LAB (Change 3). "Explain this read": renders a short, honest voice
 * over an EXISTING cached deep-dive contract. Strictly downstream — it loads the
 * cached contract and NEVER recomputes; no cached doc ⇒ 409 no_contract.
 *
 * Pipeline: recompute the deep-dive docId (shared helper) → load the cached
 * summaryContract → versioned narration cache (a third doc family in
 * `correlationIntelligence`, keyed by the contract hash + every version) with
 * every hit REVALIDATED under the ACTIVE conformance validator before serving →
 * on a miss, build the deterministic plan → the Gemma voice layer renders it →
 * conformance-validate → ONE retry carrying a closed-enum reason code → template
 * fallback (the deterministic verdict sentence). Template responses are NEVER
 * cached (a transient model outage must not pin the floor until a version bump).
 *
 * Dark behind CORRELATION_NARRATION_ENABLED (flag-404: no reads, no model call,
 * no cache writes while off). BUILD_RULES §1 fence: no decide.js / agent-scoring
 * / trading-brain contact of any kind. §4: every reused value has ONE source.
 */
import { createHash } from 'crypto';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { getFromCache, setInCache } from '../_utils/serverCache.js';
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { deepDiveDocId } from './correlationCacheKey.js';
import { buildNarrationPlan, PLAN_BUILDER_VERSION } from './narrationPlan.js';
import { validateNarration, VALIDATOR_VERSION, RETRY_REASONS } from './narrationConformance.js';
import {
  PHRASEBOOK, PHRASEBOOK_VERSION, PROMPT_VERSION, MODEL_VERSION, templateFor,
} from './narrationPhrasebook.js';
import { CORRELATION_DRIVERS } from './driverRegistry.js';
// The deterministic template floor (the "standard summary") — pure, Node-clean.
import { buildVerdictSentence } from '../../src/components/Research/correlationVerdict.js';
// api→src flag import (scouting-board / correlation.js precedent). Node-clean;
// the unmocked handler import in the boundary test is the dependency-surface guard.
import {
  CORRELATION_NARRATION_ENABLED,
  CORRELATION_LAB_ENABLED,
  CORRELATION_SYNTHESIS_ENABLED,
} from '../../src/config/featureFlags.js';

// LLM latency + a Firestore round-trip; matches the correlation endpoints.
export const config = { maxDuration: 30 };

// Mirrors of correlation.js's request canonicalization (a divergence only ever
// yields a 409 no_contract — a fail-safe lookup miss, never wrong data).
const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/;
const LOOKBACK = { DEFAULT: 504, MIN: 150, MAX: 1260 };
const RATE_LIMIT = { limit: 6, windowMs: 60000 };
const MODEL_TIMEOUT_MS = 25000;
const MODEL_TEMPERATURE = 0.2; // low — the model selects a frame, it does not author

/**
 * Flag dependency guard (mirrors summaryContract.js:synthesisActive). Narration
 * serves ONLY when its flag AND the Lab AND synthesis are all on — the contract
 * it reads exists only when synthesis is active. Misconfiguration short-circuits
 * dark with a single console.warn.
 */
export function narrationActive(narrationFlag, labFlag, synthesisFlag) {
  if (narrationFlag && (!labFlag || !synthesisFlag)) {
    console.warn('[narrate] CORRELATION_NARRATION_ENABLED requires CORRELATION_LAB_ENABLED && CORRELATION_SYNTHESIS_ENABLED; narration stays dark.');
    return false;
  }
  return Boolean(narrationFlag && labFlag && synthesisFlag);
}

// Recursive key-sorted stringify → a stable contract hash that a Firestore
// map-key reorder can never change (Rider 3 / §3.4).
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

export function contractHashOf(contract) {
  return createHash('sha1').update(stableStringify(contract)).digest('hex');
}

const VERSION_KEYS = ['planBuilderVersion', 'phrasebookVersion', 'validatorVersion', 'promptVersion', 'modelVersion'];
export function activeVersions() {
  return {
    planBuilderVersion: PLAN_BUILDER_VERSION,
    phrasebookVersion: PHRASEBOOK_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    promptVersion: PROMPT_VERSION,
    modelVersion: MODEL_VERSION,
  };
}
export function narrationDocIdOf(contractHash, versions) {
  return createHash('sha1')
    .update(['NARRATION', contractHash, ...VERSION_KEYS.map((k) => versions[k])].join('|'))
    .digest('hex');
}

// ── Model prompts (the model RENDERS: it picks one approved frame + connective
//    per claim and substitutes the provided values; it authors nothing) ──
function buildRenderSystemPrompt() {
  return [
    'You render a short, factual summary from a fixed PLAN. You do NOT write new claims.',
    'Rules:',
    '1. Output STRICT JSON: {"sentences":[{"claimId":"...","variantId":"...","text":"..."}]}.',
    '2. Exactly one sentence per plan claim, in the SAME order as the plan.',
    '3. For each claim, choose ONE of its approved variant templates and fill every {slot} with the EXACT value the plan gives — never invent, round, negate, or reword a value.',
    '4. Output ONLY the chosen template with its slots filled — no connective, no prefix, no extra words. Do not add clauses, causes, forecasts, advice, or certainty language.',
  ].join('\n');
}
function buildRenderUserMessage(plan) {
  const claims = plan.claims.map((c, i) => ({
    order: i + 1,
    claimId: c.claimId,
    values: c.spans,
    variants: c.allowedVariants.map((vid) => ({ variantId: vid, template: templateFor(c.claimId, vid) })),
  }));
  return JSON.stringify({ claims }, null, 2);
}

function retryHint(conf) {
  // Rider 2: the retry carries ONLY a closed-enum code (+ a claim number) — never
  // the validator's free-text detail, never any model-derived string.
  const code = RETRY_REASONS.includes(conf.code) ? conf.code : 'E_NO_VARIANT_MATCH';
  const where = Number.isInteger(conf.claimIndex) ? ` at claim ${conf.claimIndex + 1}` : '';
  return `Your previous attempt failed the check ${code}${where}. Reproduce each approved variant template EXACTLY, substituting only the provided values, in plan order.`;
}

function logMetric(fields) {
  // Never logs the API key or raw model text — only counts/codes.
  console.log('[narrate] metric', JSON.stringify(fields));
}

async function callModel(systemPrompt, userMessage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    return await callGemmaVoiceWithRetry({ systemPrompt, userMessage, signal: controller.signal, temperature: MODEL_TEMPERATURE, maxTokens: 600 });
  } finally {
    clearTimeout(timer);
  }
}

// Build → model → validate → ONE reason-carrying retry. Returns a servable
// success or a fallback reason (model_unavailable / a conformance code).
async function generateNarration(plan) {
  const systemPrompt = buildRenderSystemPrompt();
  const userMessage = buildRenderUserMessage(plan);

  let conf = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const sys = attempt === 0 ? systemPrompt : `${systemPrompt}\n${retryHint(conf)}`;
    const m = await callModel(sys, userMessage);
    if (!m.success) return { ok: false, reason: 'model_unavailable', retries: attempt };
    const out = parseVoiceLayerResponse(m.content);
    conf = validateNarration(out, plan);
    if (conf.valid) return { ok: true, narration: conf.narration, modelOutput: out, retries: attempt };
  }
  return { ok: false, reason: conf?.code ?? 'E_NO_VARIANT_MATCH', retries: 1 };
}

function serveTemplate(res, payload, driverLabel, versions, meta, debug) {
  const narration = buildVerdictSentence(payload, driverLabel);
  logMetric({ source: 'template', ...meta });
  return res.status(200).json({ narration, source: 'template', versions, cached: false, ...(debug ? { plan: null, fallback: meta } : {}) });
}

export default async function handler(req, res) {
  if (applySecurityMiddleware(req, res, { rateLimit: RATE_LIMIT })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!narrationActive(CORRELATION_NARRATION_ENABLED, CORRELATION_LAB_ENABLED, CORRELATION_SYNTHESIS_ENABLED)) {
    return res.status(404).json({ error: 'not_found' });
  }
  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    // ── Canonicalize the request → recompute the SAME deep-dive docId ──
    const body = req.body || {};
    const driverKey = typeof body.driver === 'string' && body.driver ? body.driver : null;
    if (!driverKey) return res.status(400).json({ error: 'invalid_driver' });
    if (!Array.isArray(body.group) || body.group.length < 1 || body.group.length > 10) {
      return res.status(400).json({ error: 'invalid_group' });
    }
    const group = [...new Set(body.group.map((s) => String(s).trim().toUpperCase().replace(/\.US$/, '')))];
    if (!group.every((s) => SYMBOL_RE.test(s))) return res.status(400).json({ error: 'invalid_symbol' });
    const customSymbol = driverKey === 'CUSTOM'
      ? String(body.customSymbol || '').trim().toUpperCase().replace(/\.US$/, '')
      : '';
    let lookbackDays = LOOKBACK.DEFAULT;
    if (body.lookbackDays !== undefined) {
      if (typeof body.lookbackDays !== 'number' || !Number.isFinite(body.lookbackDays)) {
        return res.status(400).json({ error: 'invalid_lookback' });
      }
      lookbackDays = Math.min(LOOKBACK.MAX, Math.max(LOOKBACK.MIN, Math.round(body.lookbackDays)));
    }
    const docId = deepDiveDocId({ group, driverKey, customSymbol, lookbackDays });

    const db = getFirebaseAdmin();

    // ── Load the CACHED deep-dive contract only (never recompute) ──
    const snap = await db.collection('correlationIntelligence').doc(docId).get();
    if (!snap.exists) return res.status(409).json({ error: 'no_contract' });
    const doc = snap.data();
    if (!doc?.payload || typeof doc.expiresAt !== 'number' || Date.now() >= doc.expiresAt) {
      return res.status(409).json({ error: 'no_contract' });
    }
    const contract = doc.payload.summaryContract;
    if (!contract || contract.kind !== 'deepDive') return res.status(409).json({ error: 'no_contract' });
    const driverLabel = doc.payload.meta?.driverLabel || driverKey;
    // returnMode drives diff-mode (yield) unit phrasing; CUSTOM/unknown → 'pct'.
    const driverReturnMode = CORRELATION_DRIVERS[driverKey]?.returnMode || 'pct';
    const debug = body.debug === true; // ?narrationDebug=1 dev affordance (endpoint is 404 when dark)

    // ── Versioned narration cache identity ──
    const versions = activeVersions();
    const narrationDocId = narrationDocIdOf(contractHashOf(contract), versions);
    const narrationCacheKey = `narration:${narrationDocId}`;

    // ── Cache lookup — REVALIDATE every hit under the ACTIVE validator ──
    let hit = getFromCache(narrationCacheKey);
    if (!hit) {
      const hitSnap = await db.collection('correlationIntelligence').doc(narrationDocId).get();
      if (hitSnap.exists) hit = hitSnap.data();
    }
    if (hit
      && typeof hit.expiresAt === 'number' && Date.now() < hit.expiresAt
      && hit.versions?.validatorVersion === VALIDATOR_VERSION
      && validateNarration(hit.modelOutput, hit.plan).valid) {
      logMetric({ source: 'generated', cached: true, retries: 0 });
      return res.status(200).json({ narration: hit.narration, source: 'generated', versions, cached: true, ...(debug ? { plan: hit.plan } : {}) });
    }

    // ── Miss → build the deterministic plan ──
    const planResult = buildNarrationPlan(contract, { driverLabel, driverReturnMode });
    if (!planResult.ok) {
      return serveTemplate(res, doc.payload, driverLabel, versions, { fallback: 'plan', reason: planResult.code }, debug);
    }

    // ── Model render → conformance → ONE reason-carrying retry ──
    const gen = await generateNarration(planResult.plan);
    if (!gen.ok) {
      return serveTemplate(res, doc.payload, driverLabel, versions, { fallback: 'conformance', reason: gen.reason, retries: gen.retries }, debug);
    }

    // ── Success → cache (expiry MIRRORS the underlying doc); NEVER cache template ──
    const narrationDoc = { narration: gen.narration, modelOutput: gen.modelOutput, plan: planResult.plan, versions, expiresAt: doc.expiresAt, computedAt: Date.now() };
    try {
      await db.collection('correlationIntelligence').doc(narrationDocId).set(narrationDoc);
      setInCache(narrationCacheKey, narrationDoc, Math.max(1, Math.floor((doc.expiresAt - Date.now()) / 1000)));
    } catch (cacheErr) {
      console.warn('[narrate] cache write failed:', cacheErr?.message);
    }
    logMetric({ source: 'generated', cached: false, retries: gen.retries });
    return res.status(200).json({ narration: gen.narration, source: 'generated', versions, cached: false, ...(debug ? { plan: planResult.plan } : {}) });
  } catch (err) {
    console.error('[narrate] unexpected error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

// Exposed for tests (the phrasebook claim set the prompts reference).
export const NARRATION_CLAIM_IDS = Object.keys(PHRASEBOOK);
