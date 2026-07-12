/**
 * Narrate endpoint — flag-dark 404, method/auth/409(no + stale contract),
 * miss→generate→cache, cached-hit REVALIDATION (the stale-validator defence),
 * template fallback on plan/model/conformance failure (never cached), the
 * reason-carrying single retry, and the narrationActive truth table.
 *
 * The Gemma call is mocked at the module boundary; the rest of the pipeline
 * (plan builder, conformance validator, phrasebook, verdict floor) runs for real
 * — the real unmocked handler import is the BUILD_RULES §4 dependency-surface
 * guard (a browser-only dep entering narrationPlan/conformance/phrasebook would
 * explode here).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildNarrationPlan, PLAN_BUILDER_VERSION } from './narrationPlan.js';
import { VALIDATOR_VERSION } from './narrationConformance.js';
import { templateFor, fillSlots } from './narrationPhrasebook.js';
import { deepDiveDocId } from './correlationCacheKey.js';
import { CLASSES, DRIVER_LABEL } from './narrationCorpus.js';

// ── hoisted mock state ───────────────────────────────────────────────────────
const { auth, flags, gemma, l1 } = vi.hoisted(() => ({
  auth: { current: { uid: 'u1' } },
  flags: { narration: true, lab: true, synth: true },
  gemma: { current: async () => ({ success: false, error: 'unset' }), calls: 0 },
  l1: { store: new Map() },
}));
let firestore = null;

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => firestore }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    if (auth.current === null) { res.status(401).json({ error: 'auth' }); return null; }
    return auth.current;
  },
}));
vi.mock('../_utils/serverCache.js', () => ({
  getFromCache: (k) => l1.store.get(k),
  setInCache: (k, v) => l1.store.set(k, v),
}));
vi.mock('../_utils/gemmaClient.js', async (importOriginal) => ({
  ...(await importOriginal()), // real parseVoiceLayerResponse
  callGemmaVoiceWithRetry: (opts) => { gemma.calls += 1; return gemma.current(opts); },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CORRELATION_NARRATION_ENABLED() { return flags.narration; },
  get CORRELATION_LAB_ENABLED() { return flags.lab; },
  get CORRELATION_SYNTHESIS_ENABLED() { return flags.synth; },
}));

// §4 dependency-surface guard: the REAL handler (+ helpers) — never mock it.
const { default: handler, narrationActive, contractHashOf, narrationDocIdOf, activeVersions } = await import('./correlation-narrate.js');
const narrationKeyFor = (contract) => narrationDocIdOf(contractHashOf(contract), activeVersions());

// ── fixtures / helpers ───────────────────────────────────────────────────────
const FUTURE = 9999999999999;
const REQ = { group: ['XLE', 'CVX', 'XOM'], driver: 'TNX', lookbackDays: 504 };
const DOC_ID = deepDiveDocId({ group: REQ.group, driverKey: REQ.driver, customSymbol: '', lookbackDays: 504 });

function makeFirestore(seed = new Map()) {
  return {
    _docs: seed,
    collection: () => ({
      doc: (id) => ({
        get: async () => ({ exists: seed.has(id), data: () => seed.get(id) }),
        set: async (v) => { seed.set(id, v); },
      }),
    }),
  };
}
function makePayload(contract) {
  return { meta: { driverLabel: DRIVER_LABEL }, byWindow: { corr20: { value: 0.62 }, corr60: { value: 0.55 } }, summaryContract: contract };
}
function seed(contract) {
  firestore = makeFirestore(new Map([[DOC_ID, { payload: makePayload(contract), expiresAt: FUTURE }]]));
}
function res() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}
const call = (body = REQ, method = 'POST') => { const r = res(); return handler({ method, body }, r).then(() => r); };

// A faithful model rendering of a plan (variant[0], no connective).
function goodContent(contract) {
  const plan = buildNarrationPlan(contract, { driverLabel: DRIVER_LABEL }).plan;
  return JSON.stringify({
    sentences: plan.claims.map((c) => ({ claimId: c.claimId, variantId: c.allowedVariants[0], text: fillSlots(templateFor(c.claimId, c.allowedVariants[0]), c.spans) })),
  });
}
const ok = (content) => async () => ({ success: true, content });
const queue = (arr) => { let i = 0; return async () => arr[i++] ?? { success: false, error: 'exhausted' }; };

beforeEach(() => {
  auth.current = { uid: 'u1' };
  flags.narration = true; flags.lab = true; flags.synth = true;
  gemma.current = async () => ({ success: false, error: 'unset' }); gemma.calls = 0;
  l1.store.clear();
  seed(CLASSES.solidStandard());
});

// ── guards ───────────────────────────────────────────────────────────────────
describe('narrate — guards', () => {
  it('flag dark → 404 (no reads, no model call)', async () => {
    flags.narration = false;
    const r = await call();
    expect(r.code).toBe(404);
    expect(gemma.calls).toBe(0);
  });
  it('wrong method → 405; missing auth → 401', async () => {
    expect((await call(REQ, 'GET')).code).toBe(405);
    auth.current = null;
    expect((await call()).code).toBe(401);
  });
  it('no cached contract → 409 no_contract', async () => {
    firestore = makeFirestore(); // empty
    const r = await call();
    expect(r.code).toBe(409);
    expect(r.body).toEqual({ error: 'no_contract' });
  });
  it('stale (expired) contract doc → 409', async () => {
    firestore = makeFirestore(new Map([[DOC_ID, { payload: makePayload(CLASSES.solidStandard()), expiresAt: 1 }]]));
    expect((await call()).code).toBe(409);
  });
  it('invalid request body → 400', async () => {
    expect((await call({ ...REQ, group: [] })).code).toBe(400);
    expect((await call({ ...REQ, driver: 123 })).code).toBe(400);
  });
});

// ── generate + cache ─────────────────────────────────────────────────────────
describe('narrate — generate, cache, revalidate', () => {
  it('miss → generate → 200 generated/cached:false, then cached:true on re-call', async () => {
    gemma.current = ok(goodContent(CLASSES.solidStandard()));
    const r1 = await call();
    expect(r1.code).toBe(200);
    expect(r1.body).toMatchObject({ source: 'generated', cached: false });
    expect(r1.body.narration).toContain('10Y Yield');
    expect(r1.body.versions).toMatchObject({ planBuilderVersion: PLAN_BUILDER_VERSION, validatorVersion: VALIDATOR_VERSION });

    gemma.calls = 0; // a served cache hit must not call the model
    const r2 = await call();
    expect(r2.body).toMatchObject({ source: 'generated', cached: true });
    expect(gemma.calls).toBe(0);
  });

  it('a stale-validator cached doc is DISCARDED and regenerated (adversarial #16)', async () => {
    // pre-seed a narration doc at the CURRENT key but stamped with an old validator
    const contract = CLASSES.solidStandard();
    const narrationDocId = narrationKeyFor(contract);
    firestore._docs.set(narrationDocId, {
      narration: 'STALE', modelOutput: { sentences: [] }, plan: { claims: [] },
      versions: { validatorVersion: '0' }, expiresAt: FUTURE,
    });
    gemma.current = ok(goodContent(contract));
    const r = await call();
    expect(r.body).toMatchObject({ source: 'generated', cached: false });
    expect(r.body.narration).not.toBe('STALE');
    expect(gemma.calls).toBe(1);
  });

  it('a cached doc that fails the ACTIVE validator is discarded (not trusted blindly)', async () => {
    const contract = CLASSES.solidStandard();
    const narrationDocId = narrationKeyFor(contract);
    firestore._docs.set(narrationDocId, {
      narration: 'stale but current-versioned', modelOutput: { sentences: [{ claimId: 'headline_link', text: 'nope' }] },
      plan: buildNarrationPlan(contract, { driverLabel: DRIVER_LABEL }).plan,
      versions: { validatorVersion: VALIDATOR_VERSION }, expiresAt: FUTURE,
    });
    gemma.current = ok(goodContent(contract));
    const r = await call();
    expect(r.body).toMatchObject({ source: 'generated', cached: false });
    expect(r.body.narration).not.toContain('stale');
  });
});

// ── fallbacks ────────────────────────────────────────────────────────────────
describe('narrate — template fallback (never cached)', () => {
  it('plan-level omission (thin solid) → template, model NOT called', async () => {
    seed(CLASSES.thinSolidStandard());
    const r = await call();
    expect(r.body).toMatchObject({ source: 'template', cached: false });
    expect(gemma.calls).toBe(0);
    // template responses are never cached
    expect([...l1.store.keys()].some((k) => k.startsWith('narration:'))).toBe(false);
  });

  it('model unavailable → template', async () => {
    gemma.current = async () => ({ success: false, error: 'openrouter down' });
    const r = await call();
    expect(r.body).toMatchObject({ source: 'template', cached: false });
  });

  it('conformance fails twice → template after exactly ONE retry (2 calls)', async () => {
    const bad = JSON.stringify({ sentences: [{ claimId: 'headline_link', text: 'garbage' }, { claimId: 'capture_asymmetry', text: 'x' }, { claimId: 'tail_comovement', text: 'y' }] });
    gemma.current = queue([{ success: true, content: bad }, { success: true, content: bad }]);
    const r = await call();
    expect(r.body).toMatchObject({ source: 'template' });
    expect(gemma.calls).toBe(2);
  });

  it('retry recovers: first attempt invalid, second valid → generated (2 calls)', async () => {
    const bad = JSON.stringify({ sentences: [{ claimId: 'headline_link', text: 'garbage' }, { claimId: 'capture_asymmetry', text: 'x' }, { claimId: 'tail_comovement', text: 'y' }] });
    gemma.current = queue([{ success: true, content: bad }, { success: true, content: goodContent(CLASSES.solidStandard()) }]);
    const r = await call();
    expect(r.body).toMatchObject({ source: 'generated', cached: false });
    expect(gemma.calls).toBe(2);
  });
});

// ── flag dependency guard ────────────────────────────────────────────────────
describe('narrate — narrationActive truth table (four combinations)', () => {
  it('true only when narration && lab && synthesis', () => {
    expect(narrationActive(true, true, true)).toBe(true);
    expect(narrationActive(false, true, true)).toBe(false);
    expect(narrationActive(true, false, true)).toBe(false); // lab off → dark (warn)
    expect(narrationActive(true, true, false)).toBe(false); // synthesis off → dark (warn)
  });
});
