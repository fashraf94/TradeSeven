// api/forge/watchlist-dialogue.parseBindingOffGolden.test.js
//
// Pilot P1c — THE DIALOGUE'S OFF GOLDEN (pilot spec §2.8; founder decision E4;
// build prompt acceptance row 5). The watchlist dialogue's first and
// continuing turns, photographed from `main`'s own code BEFORE any P1c source
// existed: the response, every model request (the prompt bytes the agent is
// shown), every store read, query and write in order, every shadow log and
// the final documents — compared as SERIALIZED TEXT, so key order counts.
//
// The fixture (api/_utils/__fixtures__/dialogueParseBindingGolden.json) was
// captured by running THIS file with GENERATE_DIALOGUE_PARSE_GOLDEN=1 in a
// private Linux clone detached at `origin/main` ff6248d1, with no P1c source
// present; its SHA-256 is pinned below. Here the server-parse flag is OFF
// (mocked off, so a flip of DIALOGUE_SERVER_PARSE_ENABLED never moves these
// rows): every scenario must equal main's capture byte for byte. The flag-ON
// rows — an honest client still byte-identical, a differing envelope bound to
// the server's parse — live in watchlist-dialogue.parseBinding.test.js.
//
// The research-record gate is off for the owner (no allowlist), so a new
// session is the plain `set` main always made; the binding never depends on it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ db: null, modelCalls: [], shadow: [], serverParse: false }));

vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', async (importOriginal) => ({ ...(await importOriginal()), applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', async (importOriginal) => {
  const { OWNER } = await import('../_utils/__fixtures__/dialogueHarness.js');
  return { ...(await importOriginal()), requireAuth: async () => ({ uid: OWNER }) };
});
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({
  ...(await importOriginal()),
  logSignalDrops: async (record) => { state.shadow.push(JSON.parse(JSON.stringify(record))); },
}));
vi.mock('@vercel/functions', () => ({ waitUntil: (p) => p }));
vi.mock('../_utils/gemmaClient.js', async (importOriginal) => {
  const { MODEL_REPLY } = await import('../_utils/__fixtures__/dialogueHarness.js');
  return {
    ...(await importOriginal()),
    callGemmaVoiceWithRetry: async (args) => {
      state.modelCalls.push(args);
      return { success: true, content: JSON.stringify(MODEL_REPLY) };
    },
  };
});
vi.mock('firebase-admin/firestore', async () => {
  const { FieldValueDouble } = await import('../_utils/__fixtures__/callsFirestore.js');
  return { FieldValue: FieldValueDouble };
});
// The server-parse flag, held OFF here (on `main` nothing reads it; the getter is inert).
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get DIALOGUE_SERVER_PARSE_ENABLED() { return state.serverParse; } };
});

const H = await import('../_utils/__fixtures__/dialogueHarness.js');
const { default: handler } = await import('./watchlist-dialogue.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../_utils/__fixtures__/dialogueParseBindingGolden.json');
// SHA-256 of the fixture as captured on main (LF). A recapture must come from a main checkout.
const FIXTURE_SHA256 = '079c1bbd4aa59a15b6910a7a213c721492e5a2ee1e970b4216e744cb50681bb0';
const GENERATE = process.env.GENERATE_DIALOGUE_PARSE_GOLDEN === '1';
const ALLOWLIST_ENV = 'COCKPIT_ALLOWLIST_UIDS';
const serialized = (v) => JSON.stringify(v, null, 2);

/** Run one scenario through the real handler and capture it. */
async function runDialogue(name, { serverParse = false } = {}) {
  const { docs, req } = H.SCENARIOS[name]();
  state.db = H.makeDialogueDb(docs);
  state.modelCalls = [];
  state.shadow = [];
  state.serverParse = serverParse;
  const res = H.makeRes();
  await handler(req, res);
  return H.captureDialogue({ db: state.db, res, modelCalls: state.modelCalls, shadow: state.shadow });
}

let savedAllow;
beforeEach(() => {
  savedAllow = process.env[ALLOWLIST_ENV];
  process.env[ALLOWLIST_ENV] = '';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(H.FROZEN_NOW));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedAllow === undefined) delete process.env[ALLOWLIST_ENV]; else process.env[ALLOWLIST_ENV] = savedAllow;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const NAMES = Object.keys(H.SCENARIOS);

describe('the dialogue\'s off golden — main\'s own capture (acceptance row 5: flag off → everything byte-identical)', () => {
  if (GENERATE) {
    it('GENERATE: captures every scenario from this tree into the fixture', async () => {
      const scenarios = {};
      for (const name of NAMES) scenarios[name] = await runDialogue(name);
      writeFileSync(FIXTURE, `${serialized({ capturedFrom: 'origin/main ff6248d1 (no P1c source present)', scenarios })}\n`);
    }, 60_000);
    return;
  }

  const raw = readFileSync(FIXTURE, 'utf8').replace(/\r\n/g, '\n');
  const GOLDEN = JSON.parse(raw);

  it('the fixture is the pinned capture from main (its SHA-256, LF)', () => {
    expect(createHash('sha256').update(raw, 'utf8').digest('hex')).toBe(FIXTURE_SHA256);
    expect(Object.keys(GOLDEN.scenarios)).toEqual(NAMES);
  });

  for (const name of NAMES) {
    it(`${name}: equal to main's capture, serialized (response, model requests, store sequence, shadow logs, documents)`, async () => {
      const cap = await runDialogue(name);
      expect(serialized(cap)).toBe(serialized(GOLDEN.scenarios[name]));
    }, 20_000);
  }

  it('non-vacuous: the honest paste and the theme turn each made exactly one model request; the refusals made none', () => {
    const calls = (n) => GOLDEN.scenarios[n].modelRequests.length;
    expect([calls('paste_honest'), calls('theme_first_turn'), calls('continuing_turn')]).toEqual([1, 1, 1]);
    expect([calls('paste_unknown_drop'), calls('paste_hash_mismatch'), calls('paste_malformed_envelope')]).toEqual([0, 0, 0]);
    // On main the CLIENT's envelope reaches the prompt — the spec §2.8 hole this build closes behind its flag.
    expect(GOLDEN.scenarios.paste_differing_envelope.modelRequests[0].systemPrompt).toContain('TSLA squeeze');
    expect(GOLDEN.scenarios.paste_differing_envelope.modelRequests[0].systemPrompt).not.toContain('AI inference race');
    expect(GOLDEN.scenarios.paste_honest.modelRequests[0].systemPrompt).toContain('AI inference race');
  });
});
