// api/eligibility/attest.dark.test.js
//
// Backing Beta PR 0 — DARK BY DESIGN, proved end to end.
//
// The flag's whole promise, in one place: with ELIGIBILITY_ATTESTATION_ENABLED
// false the route does not exist, no read and no transaction is opened, and
// nothing else in the tree reaches the primitive. Named in the flag's own FLIP
// MAP docstring as the suite that does NOT move when the flag is flipped — it
// mocks the flag to an explicit false throughout.
//
// The flip PR moves eligibilityFlags.test.js's pin and drops the
// DARK_BY_DESIGN entry; nothing here changes, because everything here is about
// the OFF state. (No bare `expect(FLAG).toBe(false)` row lives here on
// purpose: it would read the MOCKED value, and the flag-pin guard would report
// it as a stale pin on the day of the flip.)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8');

const state = vi.hoisted(() => ({ uid: 'owner-1', reads: 0, transactions: 0 }));

vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (!state.uid) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid };
  },
}));
// EXPLICIT FALSE, not the ambient value: this suite asserts the OFF state, and
// it must keep asserting it after the founder's flip PR flips the real one.
// Unlike SHOW_IT_ENABLED there is no accessor to override — the route reads
// the bare constant at call time and PR 0 ships no client gate — so the
// spread + override is the whole mock (the research.dark.test.js `isShowItOn`
// trap does not apply; the "no accessor" row below keeps that claim honest).
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ELIGIBILITY_ATTESTATION_ENABLED: false,
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({
  getFirebaseAdmin: () => ({
    collection: () => ({ doc: () => ({ get: async () => { state.reads += 1; return { exists: false, data: () => undefined }; } }) }),
    runTransaction: async () => { state.transactions += 1; throw new Error('a dark route must never open a transaction'); },
  }),
}));

// Dependency-surface guard (BUILD_RULES §4). Never mock it.
const { default: handler } = await import('./attest.js');
const { TERMS_VERSION } = await import('../../src/constants/eligibility.js');

const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const post = async (body) => { const res = mkRes(); await handler({ method: 'POST', headers: {}, body }, res); return res; };
const VALID = Object.freeze({ adultAttested: true, termsVersion: TERMS_VERSION });

beforeEach(() => { state.uid = 'owner-1'; state.reads = 0; state.transactions = 0; });

describe('the route does not exist', () => {
  it('404s a well-formed, authenticated request — before any read, any transaction', async () => {
    const res = await post(VALID);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(state.reads).toBe(0);
    expect(state.transactions).toBe(0);
  });

  it('404s every shape — valid, malformed, empty, absent', async () => {
    for (const body of [VALID, { adultAttested: false }, {}, undefined, null, { termsVersion: 'stale' }, 'text']) {
      const res = await post(body);
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    }
    expect(state.reads).toBe(0);
    expect(state.transactions).toBe(0);
  });

  it('still 401s an anonymous caller — auth answers BEFORE the flag, so darkness is not an oracle', async () => {
    state.uid = null;
    const res = await post(VALID);
    expect(res.statusCode).toBe(401);
    expect(state.reads).toBe(0);
  });
});

// Non-test sources under api/ and src/ (the flag-pin guard's walker, inverted
// to sources), so the "nothing else reaches it" rows are read off the tree.
function listSources(dirRel) {
  const out = [];
  const walk = (abs) => {
    for (const ent of readdirSync(abs, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const childAbs = path.join(abs, ent.name);
      if (ent.isDirectory()) walk(childAbs);
      else if (/\.(js|jsx|mjs)$/.test(ent.name) && !/\.test\.(js|jsx)$/.test(ent.name)) {
        out.push(path.relative(REPO, childAbs).split(path.sep).join('/'));
      }
    }
  };
  walk(path.join(REPO, dirRel));
  return out;
}
const SOURCES = [...listSources('api'), ...listSources('src')];

// Every non-test source that imports `targetRel`, with each import specifier
// RESOLVED against the importing file's own directory — so PR 2's sibling
// `./eligibility.js` inside api/_utils/ counts exactly like the route's
// `../_utils/eligibility.js` (review F-A1: a path-substring regex could not
// see the sibling spelling, so the row could not fail under the case it names).
const IMPORT_FROM_RE = /\bfrom\s+['"]([^'"]+)['"]/g;
const IMPORT_CALL_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
function importersOf(targetRel) {
  const target = path.join(REPO, targetRel);
  return SOURCES.filter((rel) => {
    const src = read(rel);
    const dir = path.dirname(path.join(REPO, rel));
    for (const re of [IMPORT_FROM_RE, IMPORT_CALL_RE]) {
      for (const m of src.matchAll(re)) {
        if (m[1].startsWith('.') && path.resolve(dir, m[1]) === target) return true;
      }
    }
    return false;
  }).sort();
}

describe('nothing else reaches it (PR 0)', () => {
  it("no route calls the read side — the route imports only eligibilityRef; requireEligibility's first caller is PR 2", () => {
    // The writer is the helper's only importer, and it takes the ref builder
    // alone. PR 2 (backingEligibility.js → requireEligibility) adds the second
    // importer and moves this row deliberately; until then the gate is
    // reachable through no door.
    expect(importersOf('api/_utils/eligibility.js')).toEqual(['api/eligibility/attest.js']);
    const code = read('api/eligibility/attest.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).toContain("import { eligibilityRef } from '../_utils/eligibility.js';");
    expect(code).not.toMatch(/requireEligibility|getEligibility/);
  });

  it('the route is the only importer of the constants — no UI ships in PR 0 (the AttestationStep is PR 4)', () => {
    expect(importersOf('src/constants/eligibility.js')).toEqual(['api/eligibility/attest.js']);
  });

  it('the importer walk is not vacuous — it resolves a sibling `./x.js` and a parent `../_utils/x.js` spelling alike', () => {
    // firebaseAdmin.js is imported as `./firebaseAdmin.js` by authMiddleware.js
    // (sibling) and as `../_utils/firebaseAdmin.js` by the route (parent); a
    // walker blind to either spelling fails here before it can pass vacuously above.
    const importers = importersOf('api/_utils/firebaseAdmin.js');
    expect(importers).toContain('api/_utils/authMiddleware.js');
    expect(importers).toContain('api/eligibility/attest.js');
  });

  it('the route reads the flag at CALL time, never at module scope, and there is no accessor to miss', () => {
    const src = read('api/eligibility/attest.js');
    expect(src).toContain('if (!ELIGIBILITY_ATTESTATION_ENABLED) return res.status(404)');
    // Comments stripped (the deskHonesty rule): the header names the flag to
    // explain it, which is documentation, not a read.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code.match(/ELIGIBILITY_ATTESTATION_ENABLED/g)).toHaveLength(2); // the import and the one call-time read
    // No `isEligibilityAttestationOn`-style accessor exists for this flag, so a
    // hermetic mock of the constant is the whole story (the SHOW_IT trap).
    expect(read('src/config/featureFlags.js')).not.toMatch(/export function \w*[Ee]ligibility\w*\(/);
  });

  it('adds no cron entry (spec §7: zero new crons)', () => {
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.crons.some((c) => /eligib|attest/i.test(c.path))).toBe(false);
  });
});

describe('the rules ship in this PR — inert until deployed via the Console', () => {
  it('firestore.rules carries the owner-read, write-false eligibility block (the tournamentRanks pattern)', () => {
    const rules = read('firestore.rules');
    const m = /match \/eligibility\/\{userId\} \{\n([^}]*)\n\s*\}/.exec(rules);
    expect(m, 'the eligibility block').not.toBeNull();
    const block = m[1];
    expect(block).toContain('allow read: if request.auth != null && request.auth.uid == userId;');
    expect(block).toContain('allow create, update, delete: if false;');
    expect(block).not.toMatch(/allow (write|create|update|delete):\s*if\s*(true|request)/);
    // Behaviour against the real engine: test/rules/eligibilityDenials.rules.mjs (npm run test:rules).
  });
});
