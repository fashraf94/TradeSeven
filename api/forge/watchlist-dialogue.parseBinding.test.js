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
//   · a drop record without a usable parse is refused as a missing drop is
//     (no model call) — never the global parse cache, keyed by content, not
//     by drop (review L3-6);
//   · an honest client whose stored parse is OUTSIDE the dialogue's caps and
//     enums (what Haiku may return) is still main's run, byte for byte — the
//     server parse is shaped exactly as the client envelope is (review L3-2);
//   · an envelope too deep to hash is a mismatch, never a failed request
//     (review L3-4);
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

describe('flag ON — where the stored parse comes from: the drop record, by dropId, alone', () => {
  it('a drop record without a usable parse → refused as a missing drop is (400 unknown_drop): no model call, no session — never the client\'s envelope, and never the parse cache, even when it holds one (review L3-6)', async () => {
    const s = scenario('paste_honest');
    const dropPath = Object.keys(s.docs).find((p) => p.includes('/signalDrops/'));
    const { parse, validation, ...thin } = s.docs[dropPath];
    s.docs[dropPath] = thin;
    // The global parse cache is keyed by content (not by drop, not by the note that steered the parse): it is not read.
    s.docs[`signalDropCache/${H.CONTENT_HASH}`] = { contentHash: H.CONTENT_HASH, parse, validation, shouldBailout: false, shouldHardCheckpoint: false };
    const cap = await runDialogue(s);
    expect(cap.response).toEqual({ status: 400, body: { error: 'unknown_drop', message: 'No signal drop found for this dropId. Call /api/forge/parse-signal first.' } });
    expect(cap.modelRequests).toEqual([]);
    expect(cap.store.writes).toEqual([]);
    expect(cap.store.reads.filter((p) => p.startsWith('signalDropCache/'))).toEqual([]);
  });
  it('serverParseOf shapes the stored parse exactly as the client envelope is shaped (validateParseResult): equal for an honest drop; nothing usable → null', () => {
    const shaped = serverParseOf(H.dropRecord());
    expect(shaped).toEqual(validateParseResult(H.honestEnvelope()));
    expect(shaped.contentHash).toBe(H.CONTENT_HASH);
    expect(serverParseOf({ ...H.dropRecord(), parse: undefined })).toBeNull();
    expect(serverParseOf(null)).toBeNull();
  });
});

describe('flag ON — an honest client whose stored parse is outside the dialogue\'s caps and enums (review L3-2)', () => {
  // What Haiku may hand back (after parse-signal's sanitizer): padded and over-cap text, lowercase tickers, an
  // off-enum label, a relative referencedDate (the tool schema's own example), 25 data points, an extra key.
  const haikuParse = () => ({
    extractedText: `  ${'Apple and Nvidia are racing to own AI inference. '.repeat(110)}  `,
    topic: '  AI inference race  ',
    tickers: ['aapl', 'nvda'],
    impliedTickers: ['tsm'],
    confidence: 1.4,
    contentType: 'Tweet',
    signalDirection: 'bullish',
    timeHorizon: 'positional',
    referencedDate: 'next week',
    dataPoints: Array.from({ length: 25 }, (_, i) => ` point ${i + 1} `),
    sentiment: 'an extra key the dialogue never reads',
    suspectedInjection: false,
  });
  const messy = () => {
    const s = scenario('paste_honest');
    const dropPath = Object.keys(s.docs).find((p) => p.includes('/signalDrops/'));
    s.docs[dropPath] = H.dropRecord({ parse: haikuParse(), validation: H.serverValidation() });
    s.req.body.parseResult = { ...H.honestEnvelope(), parse: haikuParse(), cached: false };
    return s;
  };
  it('flag ON is the flag-OFF run byte for byte — prompt, response, shadow logs, session — and records no mismatch', async () => {
    const off = await runDialogue(messy(), { serverParse: false });
    const on = await runDialogue(messy());
    expect(off.response.status).toBe(200);
    expect(off.modelRequests).toHaveLength(1);
    expect(serialized(on.modelRequests)).toBe(serialized(off.modelRequests));
    expect(serialized(on.response)).toBe(serialized(off.response));
    expect(serialized(on.shadow)).toBe(serialized(off.shadow));
    expect(serialized(on.docs[SESSION_PATH])).toBe(serialized(off.docs[SESSION_PATH]));
    expect('parseEnvelopeMismatch' in on.docs[SESSION_PATH]).toBe(false);
    // The caps really bit: the prompt holds the shaped parse, not the raw one.
    expect(on.modelRequests[0].systemPrompt).not.toContain('next week');
  });
});

describe('flag ON — an envelope too deep to hash is a mismatch, never a failed request (review L3-4)', () => {
  it('a validation map nested 20,000 deep under the right hash: 200, the SERVER\'s parse, the marker set', async () => {
    const deep = JSON.parse(`${'{"a":'.repeat(20_000)}{}${'}'.repeat(20_000)}`);
    const s = scenario('paste_honest');
    s.req.body.parseResult = { ...H.honestEnvelope(), validation: deep };
    const cap = await runDialogue(s);
    expect(cap.response.status).toBe(200);
    expect(cap.modelRequests).toHaveLength(1);
    const session = cap.docs[SESSION_PATH];
    expect(session.parseEnvelopeMismatch).toBe(true);
    expect(session.parseResult.validation).toEqual(H.serverValidation());
  });
});


// ── L5d mutation-lens rows (proposed additions to api/forge/watchlist-dialogue.parseBinding.test.js) ──

describe('flag ON — an honest client whose drop carries a bailout / hard-checkpoint bit (L5d-1)', () => {
  // parse-signal's classifyBailout sets at most one of the two bits; the drop record and the honest envelope carry the
  // same pair. serverParseOf must copy both, each from its own field.
  for (const [shouldBailout, shouldHardCheckpoint] of [[true, false], [false, true]]) {
    it(`L5d-1 shouldBailout ${shouldBailout} / shouldHardCheckpoint ${shouldHardCheckpoint}: the flag-OFF session byte for byte, no mismatch, the bits kept`, async () => {
      const flagged = () => {
        const s = scenario('paste_honest');
        const dropPath = Object.keys(s.docs).find((p) => p.includes('/signalDrops/'));
        s.docs[dropPath] = { ...H.dropRecord(), shouldBailout, shouldHardCheckpoint };
        s.req.body.parseResult = { ...H.honestEnvelope(), shouldBailout, shouldHardCheckpoint };
        return s;
      };
      const off = await runDialogue(flagged(), { serverParse: false });
      const on = await runDialogue(flagged());
      expect(off.response.status).toBe(200);
      expect(serialized(on.docs[SESSION_PATH])).toBe(serialized(off.docs[SESSION_PATH]));
      expect('parseEnvelopeMismatch' in on.docs[SESSION_PATH]).toBe(false);
      expect(on.docs[SESSION_PATH].parseResult).toMatchObject({ shouldBailout, shouldHardCheckpoint });
    });
  }
});

describe('flag ON — the mismatch is logged as well as recorded (L5d-2)', () => {
  it('L5d-2 a differing envelope warns once, naming the drop; an honest client warns nothing', async () => {
    const differs = () => vi.mocked(console.warn).mock.calls.filter(([m]) => String(m).includes('parse envelope differs'));
    await runDialogue(scenario('paste_differing_envelope'));
    expect(differs()).toHaveLength(1);
    expect(differs()[0][0]).toContain(H.DROP_ID);
    vi.mocked(console.warn).mockClear();
    await runDialogue(scenario('paste_honest'));
    expect(differs()).toHaveLength(0);
  });
});

describe('serverParseOf — the stored parse is SHAPED, not passed through (L5d-3)', () => {
  it('L5d-3 trimmed, upper-cased and capped like the client envelope; a non-object validation is dropped', () => {
    const raw = {
      ...H.serverParse(),
      topic: '  AI inference race  ',
      tickers: [' aapl ', 'nvda'],
      impliedTickers: Array.from({ length: 25 }, (_, i) => `t${i}`),
      dataPoints: ['  Nvidia guided data-centre revenue up 40%  '],
    };
    const shaped = serverParseOf(H.dropRecord({ parse: raw }));
    expect(shaped.parse.topic).toBe('AI inference race');
    expect(shaped.parse.tickers).toEqual(['AAPL', 'NVDA']);
    expect(shaped.parse.impliedTickers).toEqual(Array.from({ length: 20 }, (_, i) => `T${i}`));
    expect(shaped.parse.dataPoints).toEqual(['Nvidia guided data-centre revenue up 40%']);
    expect(serverParseOf(H.dropRecord({ validation: [{ symbol: 'AAPL', sectorId: 'tech' }] })).validation).toBeNull();
  });
});

describe('the contentHash check still guards, flag off and on (L5d-4)', () => {
  for (const serverParse of [false, true]) {
    it(`L5d-4 flag ${serverParse ? 'ON' : 'OFF'}: a drop record without a string contentHash is refused even when the envelope carries none`, async () => {
      const s = scenario('paste_honest');
      const dropPath = Object.keys(s.docs).find((p) => p.includes('/signalDrops/'));
      s.docs[dropPath] = { ...H.dropRecord(), contentHash: null };
      const noHash = H.honestEnvelope();
      delete noHash.contentHash;
      s.req.body.parseResult = noHash;
      const cap = await runDialogue(s, { serverParse });
      expect(cap.response.status).toBe(400);
      expect(cap.response.body.error).toBe('parse_result_mismatch');
      expect(cap.modelRequests).toEqual([]);
      expect(cap.store.writes).toEqual([]);
    });
  }
});
