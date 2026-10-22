// api/forge/watchlist-dialogue.parseBinding.test.js
//
// Pilot P1c — THE PARSE BINDING WITH THE FLAG ON (pilot spec §2.8; founder
// decision E4; build prompt acceptance row 5). The same scenarios and harness
// as the off golden (watchlist-dialogue.parseBindingOffGolden.test.js, whose
// fixture was captured from `main`), now with DIALOGUE_SERVER_PARSE_ENABLED
// on (mocked here, so a flip never moves these rows):
//   · an HONEST client — its envelope is the stored parse — is byte-identical
//     to main: the prompt the model sees, the response, the session written,
//     every store access and shadow log;
//   · the same when Firestore hands the stored parse back with its map keys
//     alphabetized: the prompt, response and shadow logs are main's byte for
//     byte, and the session holds the same parse (its validation map in
//     Firestore's key order — Firestore itself keeps no order);
//   · a DIFFERING envelope under the right hash: the SERVER's thesis and
//     horizon reach the prompt — the run is the honest run, byte for byte,
//     but for `parseEnvelopeMismatch: true` on the session — never a refusal;
//   · the parse cache stands in for a drop record without a parse; with
//     neither, the request is refused as a missing drop is (no model call);
//   · theme sessions, continuing turns and every pre-parse refusal: main's.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ db: null, modelCalls: [], shadow: [], serverParse: true }));

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
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get DIALOGUE_SERVER_PARSE_ENABLED() { return state.serverParse; } };
});

const H = await import('../_utils/__fixtures__/dialogueHarness.js');
const { default: handler, serverParseOf, validateParseResult } = await import('./watchlist-dialogue.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(resolve(HERE, '../_utils/__fixtures__/dialogueParseBindingGolden.json'), 'utf8').replace(/\r\n/g, '\n'));
const ALLOWLIST_ENV = 'COCKPIT_ALLOWLIST_UIDS';
const serialized = (v) => JSON.stringify(v, null, 2);
const SESSION_PATH = 'watchlistSessions/auto-watchlistSessions-1';

async function runDialogue({ docs, req }, { serverParse = true } = {}) {
  state.db = H.makeDialogueDb(docs);
  state.modelCalls = [];
  state.shadow = [];
  state.serverParse = serverParse;
  const res = H.makeRes();
  await handler(req, res);
  return H.captureDialogue({ db: state.db, res, modelCalls: state.modelCalls, shadow: state.shadow });
}
const scenario = (name) => H.SCENARIOS[name]();

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

describe('flag ON — an honest client, a theme, a continuing turn and every refusal are main\'s, byte for byte', () => {
  for (const name of ['paste_honest', 'paste_honest_url_drop', 'paste_honest_advance_request', 'theme_first_turn', 'continuing_turn', 'paste_unknown_drop', 'paste_hash_mismatch', 'paste_malformed_envelope']) {
    it(`${name}: equal to main's capture (prompt bytes, response, store sequence, shadow logs, documents)`, async () => {
      const cap = await runDialogue(scenario(name));
      expect(serialized(cap)).toBe(serialized(GOLDEN.scenarios[name]));
    }, 20_000);
  }
  it('the honest paste reads nothing more than main did: no parse cache read when the drop holds its parse', async () => {
    const cap = await runDialogue(scenario('paste_honest'));
    expect(cap.store.reads.filter((p) => p.startsWith('signalDropCache/'))).toEqual([]);
  });
  it('Firestore\'s alphabetized keys: the prompt, response and shadow logs are main\'s byte for byte; the session holds the same parse', async () => {
    const cap = await runDialogue(scenario('paste_honest_sorted_drop'));
    const main = GOLDEN.scenarios.paste_honest_sorted_drop;
    expect(serialized(cap.modelRequests)).toBe(serialized(main.modelRequests));
    expect(serialized(cap.response)).toBe(serialized(main.response));
    expect(serialized(cap.shadow)).toBe(serialized(main.shadow));
    expect(cap.docs[SESSION_PATH]).toEqual(main.docs[SESSION_PATH]); // the same content; key order is Firestore's
    expect('parseEnvelopeMismatch' in cap.docs[SESSION_PATH]).toBe(false);
  });
});

describe('flag ON — a DIFFERING envelope under the right hash: the server\'s parse reaches the prompt, the mismatch is recorded', () => {
  it('the SERVER\'s thesis and horizon reach the prompt, not the client\'s; the request succeeds', async () => {
    const cap = await runDialogue(scenario('paste_differing_envelope'));
    expect(cap.response.status).toBe(200);
    const prompt = cap.modelRequests[0].systemPrompt;
    expect(prompt).toContain('AI inference race');
    expect(prompt).toContain('<PARSED_TIME_HORIZON>\npositional\n</PARSED_TIME_HORIZON>');
    expect(prompt).toContain('Apple and Nvidia are both racing to own on-device and data-centre AI inference this year.');
    expect(prompt).not.toContain('TSLA squeeze');
    expect(prompt).not.toContain('intraday');
    expect(prompt).not.toContain('Tesla is about to squeeze');
    // On main the client's words reached it (the hole): the off golden says so.
    expect(GOLDEN.scenarios.paste_differing_envelope.modelRequests[0].systemPrompt).toContain('TSLA squeeze');
  });
  it('the run is the HONEST run byte for byte, but for parseEnvelopeMismatch: true on the session (its stored parseResult is the server\'s)', async () => {
    const cap = await runDialogue(scenario('paste_differing_envelope'));
    const honest = GOLDEN.scenarios.paste_honest;
    expect(serialized(cap.modelRequests)).toBe(serialized(honest.modelRequests));
    expect(serialized(cap.response)).toBe(serialized(honest.response));
    expect(serialized(cap.shadow)).toBe(serialized(honest.shadow));
    const session = cap.docs[SESSION_PATH];
    expect(session.parseEnvelopeMismatch).toBe(true);
    const { parseEnvelopeMismatch, ...rest } = session;
    expect(serialized(rest)).toBe(serialized(honest.docs[SESSION_PATH]));
    expect(session.parseResult.parse.timeHorizon).toBe('positional');
  });
  it('flag OFF, the same request: main\'s behaviour (the client\'s parse) and no marker — the off golden', async () => {
    const cap = await runDialogue(scenario('paste_differing_envelope'), { serverParse: false });
    expect(serialized(cap)).toBe(serialized(GOLDEN.scenarios.paste_differing_envelope));
    expect('parseEnvelopeMismatch' in cap.docs[SESSION_PATH]).toBe(false);
  });
});

describe('flag ON — where the stored parse comes from', () => {
  it('a drop record without a usable parse: the parse cache it points to (by contentHash) stands in, and an honest client is still main\'s prompt', async () => {
    const s = scenario('paste_honest');
    const dropPath = Object.keys(s.docs).find((p) => p.includes('/signalDrops/'));
    const { parse, validation, ...thin } = s.docs[dropPath];
    s.docs[dropPath] = thin;
    s.docs[`signalDropCache/${H.CONTENT_HASH}`] = { contentHash: H.CONTENT_HASH, parse, validation, shouldBailout: false, shouldHardCheckpoint: false };
    const cap = await runDialogue(s);
    expect(cap.store.reads).toContain(`signalDropCache/${H.CONTENT_HASH}`);
    expect(serialized(cap.modelRequests)).toBe(serialized(GOLDEN.scenarios.paste_honest.modelRequests));
    expect('parseEnvelopeMismatch' in cap.docs[SESSION_PATH]).toBe(false);
  });
  it('neither the drop nor the cache holds a parse → refused as a missing drop is (400 unknown_drop): no model call, no session — never the client\'s envelope', async () => {
    const s = scenario('paste_honest');
    const dropPath = Object.keys(s.docs).find((p) => p.includes('/signalDrops/'));
    const { parse, ...thin } = s.docs[dropPath];
    s.docs[dropPath] = thin;
    const cap = await runDialogue(s);
    expect(cap.response).toEqual({ status: 400, body: { error: 'unknown_drop', message: 'No signal drop found for this dropId. Call /api/forge/parse-signal first.' } });
    expect(cap.modelRequests).toEqual([]);
    expect(cap.store.writes).toEqual([]);
  });
  it('serverParseOf shapes the stored parse exactly as the client envelope is shaped (validateParseResult): equal for an honest drop', async () => {
    const db = H.makeDialogueDb({});
    const shaped = await serverParseOf(db, H.dropRecord());
    expect(shaped).toEqual(validateParseResult(H.honestEnvelope()));
    expect(shaped.contentHash).toBe(H.CONTENT_HASH);
  });
});
