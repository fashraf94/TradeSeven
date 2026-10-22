// api/film-room/card.test.js
//
// Film Room B2 item 5 — POST /api/film-room/card through the handler (Build B
// spec §4; Amendment G RG-8, RG-10), over a tape day the REAL close pass wrote
// (the B1 acceptance day: ACN stalled at checks 4 and 5 on the recorded
// basis), in the tape suites' in-memory Firestore. Every named refusal, the
// gate, the cap, the note, the question, and the moment matched against the
// day's STORED tags.items (the mutant: a moment the items do not hold).
//
// Dependency-surface guard (BUILD_RULES §4): the route, the request boundary,
// the store, the moments helper and the tape writer are the real modules;
// only the security middleware, the auth middleware, the Admin SDK handle and
// the two flags are doubled.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'on', uid: 'owner-1', authFails: false, middlewareHandles: false, db: null, middlewareCalls: [] }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_CARDS_MODE() { return state.mode; },
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: (_req, _res, opts) => { state.middlewareCalls.push(opts); return state.middlewareHandles; } }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (_req, res) => {
    if (state.authFails) { res.status(401).json({ error: 'Authentication required' }); return null; }
    return { uid: state.uid };
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));

const { default: handler, CARD_RATE_LIMIT } = await import('./card.js');
const { writeTapeDay } = await import('../_utils/filmTape/writeTapeDay.js');
const { makeTapeDb } = await import('../_utils/filmTape/__fixtures__/tapeFirestore.js');
const { seedDay, OWNER, AGENT } = await import('../_utils/filmTape/__fixtures__/tapeFixtures.js');
const { stalledDay } = await import('../_utils/filmTape/__fixtures__/tagFixtures.js');
const { momentsOf } = await import('../../src/utils/filmRoomMoments.js');

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const BATTLE = 'b-card';
const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const ENV_BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;

/** The day, written once by the real close pass; each row starts from a fresh copy of the store. */
let fixture;
beforeAll(async () => {
  const fx = await stalledDay({ battleId: BATTLE, noTriggerSeqs: [3, 4], meetingSeqs: [5], exitSeq: 6, recordStagnation: true, etDate: D });
  const t = makeTapeDb(seedDay({}, fx));
  await writeTapeDay(BATTLE, D, { db: t.db, now: NIGHT });
  const tape = t.store.get(`agentBattles/${BATTLE}/tape/${D}`);
  expect(tape.tags.items.map((i) => [i.symbol, i.tickSeq])).toEqual([['ACN', 4], ['ACN', 5]]);
  fixture = { store: Object.fromEntries([...t.store.entries()]), battle: fx.battle };
});

const mkRes = () => ({
  statusCode: null, body: null, headers: {},
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});
const post = async (body, method = 'POST') => { const res = mkRes(); await handler({ method, headers: {}, body }, res); return res; };
const MOMENT = { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 };
const create = (over = {}) => ({ op: 'create', opId: 'op_1', battleId: BATTLE, etDate: D, agentId: AGENT, moment: MOMENT, questionId: 'stalled.want', note: 'Let it go sooner.', route: 'watch', ...over });

let t;
beforeEach(() => {
  state.mode = 'on'; state.uid = OWNER; state.authFails = false; state.middlewareHandles = false; state.middlewareCalls = [];
  process.env.COCKPIT_ALLOWLIST_UIDS = OWNER;
  t = makeTapeDb({
    ...fixture.store,
    [`agents/${AGENT}`]: { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' },
    'agentBattles/b-other': { ...fixture.battle, ownerId: 'someone-else', agentId: 'agent-9' },
    'agentBattles/b-tourn': { ...fixture.battle, gameMode: 'baggerbomb_tournament' },
    'agentBattles/b-noday': { ...fixture.battle },
  });
  state.db = t.db;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE;
});
const playWrites = () => t.writeLog.filter((w) => w.path.includes('/plays/'));

describe('the gate (Build B spec §7)', () => {
  it("mode 'off': 404 { error: 'disabled' } with no read and no write — before auth", async () => {
    state.mode = 'off'; state.authFails = true;
    const res = await post(create());
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'disabled' });
    expect(t.readLog).toEqual([]);
    expect(t.writeLog).toEqual([]);
  });
  it("mode 'allowlist': an owner the list does not admit gets the same 404; an admitted one proceeds", async () => {
    state.mode = 'allowlist'; process.env.COCKPIT_ALLOWLIST_UIDS = 'someone-else';
    expect((await post(create())).statusCode).toBe(404);
    expect(t.readLog).toEqual([]);
    process.env.COCKPIT_ALLOWLIST_UIDS = OWNER;
    expect((await post(create())).statusCode).toBe(200);
  });
  it('no verified token → 401; GET → 405; the rate limit rides the shared middleware (applyRateLimit) with the route\'s window', async () => {
    state.authFails = true;
    expect((await post(create())).statusCode).toBe(401);
    state.authFails = false;
    expect((await post(create(), 'GET')).statusCode).toBe(405);
    expect(state.middlewareCalls.every((o) => o.rateLimit === CARD_RATE_LIMIT)).toBe(true);
    expect(CARD_RATE_LIMIT).toEqual({ limit: 10, windowMs: 60_000 });
  });
});

describe('create — the happy path over the real tape day', () => {
  it('files the card from the day\'s stored moment: the source, the situation and its version, the archetype from tags.inputs, the question and its version, the note verbatim, the stage from the route', async () => {
    const res = await post(create());
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ idempotent: false, open: 1, cap: 5 });
    expect(res.body.card).toMatchObject({
      entryId: 'op_1', ownerId: OWNER, agentId: AGENT, archetypeCodeId: 'momentum_chaser', situationId: 'stalled', situationVersion: 2,
      source: { battleId: BATTLE, etDate: D, symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 }, questionId: 'stalled.want', questionVersion: 1,
      note: 'Let it go sooner.', route: 'watch', stage: 'card', version: 1,
    });
    expect(t.store.get(`agents/${AGENT}/plays/op_1`)).toEqual(res.body.card);
    expect(res.headers['cache-control']).toBe('no-store');
    // Practice nominates; Set files a card; a replay is idempotent
    expect((await post(create({ opId: 'op_2', route: 'drill' }))).body.card.stage).toBe('nominated');
    expect((await post(create({ opId: 'op_3', route: 'set' }))).body.card.stage).toBe('card');
    const again = await post(create());
    expect(again.body).toMatchObject({ idempotent: true, card: res.body.card });
    expect(playWrites()).toHaveLength(3);
  });
  it('the moment the client sends is the one the screen lists: the helper\'s own moment of the stored items, no more and no less', async () => {
    const tape = t.store.get(`agentBattles/${BATTLE}/tape/${D}`);
    const [m] = momentsOf(tape.tags.items);
    const res = await post(create({ moment: { situationId: m.situationId, symbol: m.symbol, fromTickSeq: m.fromTickSeq, toTickSeq: m.toTickSeq } }));
    expect(res.statusCode).toBe(200);
  });
});

describe('create — every named refusal, in the documented order, with no other owner\'s data in the body', () => {
  const onlyCodeAndMessage = (body) => expect(Object.keys(body).sort()).toEqual(['error', 'message']);
  it('a battle that does not exist → 404 not_found', async () => {
    const res = await post(create({ battleId: 'b-missing' }));
    expect(res.statusCode).toBe(404); expect(res.body.error).toBe('not_found'); onlyCodeAndMessage(res.body);
  });
  it('a battle the caller does not own → 403 forbidden — and nothing of that battle in the answer', async () => {
    const res = await post(create({ battleId: 'b-other', agentId: 'agent-9' }));
    expect(res.statusCode).toBe(403); expect(res.body.error).toBe('forbidden'); onlyCodeAndMessage(res.body);
    expect(JSON.stringify(res.body)).not.toContain('someone-else');
    expect(playWrites()).toEqual([]);
  });
  it('an agent that is not the battle\'s → 403 forbidden', async () => {
    const res = await post(create({ agentId: 'agent-9' }));
    expect(res.statusCode).toBe(403); expect(res.body.error).toBe('forbidden');
  });
  it('a tournament battle (RB-5, RG-10 criterion 10) → 409 untaped, before any tape read', async () => {
    const res = await post(create({ battleId: 'b-tourn' }));
    expect(res.statusCode).toBe(409); expect(res.body.error).toBe('untaped');
    expect(t.readLog.some((r) => r.includes('/tape/'))).toBe(false);
  });
  it('a day with no tape → 404 tape_not_found; a day whose tape stores no tags → 409 tags_unavailable', async () => {
    expect((await post(create({ etDate: '2026-09-23' }))).body).toMatchObject({ error: 'tape_not_found' });
    const path = `agentBattles/${BATTLE}/tape/${D}`;
    t.store.set(path, { ...t.store.get(path), tags: { ...t.store.get(path).tags, items: null } });
    const res = await post(create());
    expect(res.statusCode).toBe(409); expect(res.body.error).toBe('tags_unavailable');
  });
  it('THE MUTANT: a moment the stored items do not hold — a sub-range, a superset, the whole day, another symbol, another situation — → 409 moment_not_found, nothing written', async () => {
    for (const moment of [
      { ...MOMENT, toTickSeq: 4 }, { ...MOMENT, fromTickSeq: 5 }, { ...MOMENT, fromTickSeq: 3 }, { ...MOMENT, fromTickSeq: 1, toTickSeq: 26 },
      { ...MOMENT, symbol: 'MSFT' }, { ...MOMENT, situationId: 'down' }, { ...MOMENT, fromTickSeq: null, toTickSeq: null },
    ]) {
      const res = await post(create({ moment }));
      expect(res.statusCode, JSON.stringify(moment)).toBe(409);
      expect(res.body.error, JSON.stringify(moment)).toBe('moment_not_found');
    }
    expect(playWrites()).toEqual([]);
  });
  it('a question not on the menu for the situation, or at another version → 400 question_not_on_menu', async () => {
    expect((await post(create({ questionId: 'stalled.nope' }))).body).toMatchObject({ error: 'question_not_on_menu' });
    expect((await post(create({ questionVersion: 2 }))).body).toMatchObject({ error: 'question_not_on_menu' });
    expect((await post(create({ questionVersion: 1 }))).statusCode).toBe(200);
  });
  it('the note: longer than S10 after trimming → 400 note_too_long; a control character → 400 note_control_char, refused, never stripped; a note of exactly 280 files', async () => {
    expect((await post(create({ note: 'x'.repeat(281) }))).body).toMatchObject({ error: 'note_too_long' });
    expect((await post(create({ note: 'two\nlines' }))).body).toMatchObject({ error: 'note_control_char' });
    expect((await post(create({ note: 'a\u0000b' }))).body).toMatchObject({ error: 'note_control_char' });
    expect(playWrites()).toEqual([]);
    const ok = await post(create({ note: `  ${'y'.repeat(280)}  ` }));
    expect(ok.statusCode).toBe(200);
    expect(ok.body.card.note).toBe('y'.repeat(280));
  });
  it('the archetype: a day whose inputs record none → 409 archetype_unknown', async () => {
    const path = `agentBattles/${BATTLE}/tape/${D}`;
    const tape = t.store.get(path);
    t.store.set(path, { ...tape, tags: { ...tape.tags, inputs: { ...tape.tags.inputs, archetypeCodeId: null } } });
    expect((await post(create())).body).toMatchObject({ error: 'archetype_unknown' });
  });
  it('the open-card cap (S9): the sixth open card → 409 cap_reached naming the cap; a retired card frees a place (a shelved one is the store suite\'s row)', async () => {
    for (let i = 0; i < 5; i += 1) expect((await post(create({ opId: `fill_${i}` }))).statusCode).toBe(200);
    const res = await post(create({ opId: 'op_6' }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ error: 'cap_reached', cap: 5, open: 5 });
    expect((await post({ op: 'retire', opId: 'r_0', agentId: AGENT, entryId: 'fill_0', expectedVersion: 1 })).statusCode).toBe(200);
    expect((await post(create({ opId: 'op_6' }))).statusCode).toBe(200);
  });
  it('a malformed body → 400 with the field\'s code; an unknown op → 400 invalid_op', async () => {
    expect((await post(create({ opId: 'a/b' }))).body).toMatchObject({ error: 'invalid_op_id' });
    expect((await post(create({ route: 'practice' }))).body).toMatchObject({ error: 'invalid_route' });
    expect((await post({ op: 'nope' })).body).toMatchObject({ error: 'invalid_op' });
    expect((await post(null)).body).toMatchObject({ error: 'invalid_op' });
  });
});

describe('retire', () => {
  it('moves the card to retired on the version the caller saw; a stale version → 409 version_conflict; a shelved card → 409 shelved', async () => {
    expect((await post(create())).statusCode).toBe(200);
    const stale = await post({ op: 'retire', opId: 'r1', agentId: AGENT, entryId: 'op_1', expectedVersion: 2 });
    expect(stale.statusCode).toBe(409); expect(stale.body).toMatchObject({ error: 'version_conflict', currentVersion: 1 });
    t.store.set(`agents/${AGENT}`, { ownerId: OWNER, archetype: 'guardian' });
    const shelved = await post({ op: 'retire', opId: 'r1', agentId: AGENT, entryId: 'op_1', expectedVersion: 1 });
    expect(shelved.statusCode).toBe(409); expect(shelved.body.error).toBe('shelved');
    t.store.set(`agents/${AGENT}`, { ownerId: OWNER, archetype: 'momentum_chaser' });
    const ok = await post({ op: 'retire', opId: 'r1', agentId: AGENT, entryId: 'op_1', expectedVersion: 1 });
    expect(ok.statusCode).toBe(200);
    expect(ok.body.card).toMatchObject({ stage: 'retired', version: 2 });
    expect(t.store.get(`agents/${AGENT}/plays/op_1`).stage).toBe('retired');
  });
  it('an entry that does not exist → 404 not_found; another user\'s agent → 403 forbidden', async () => {
    expect((await post({ op: 'retire', opId: 'r1', agentId: AGENT, entryId: 'nope', expectedVersion: 1 })).statusCode).toBe(404);
    state.uid = 'someone-else';
    const res = await post({ op: 'retire', opId: 'r1', agentId: AGENT, entryId: 'op_1', expectedVersion: 1 });
    expect(res.statusCode).toBe(403);
    expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
  });
});

describe('RE-5 — meetings are never proof: no card path reads a meeting row', () => {
  it('a meeting planted on the battle and on the tape changes nothing about a create or a retire', async () => {
    const battlePath = `agentBattles/${BATTLE}`;
    const tapePath = `agentBattles/${BATTLE}/tape/${D}`;
    t.store.set(battlePath, { ...t.store.get(battlePath), gameplanMeetingHistory: [{ id: 'gpm_planted', status: 'approved', createdAt: `${D}T17:20:00.000Z`, suggestedSwaps: [{ symbolOut: 'ACN', symbolIn: 'XOM' }] }] });
    t.store.set(tapePath, { ...t.store.get(tapePath), meetings: [{ key: 'gpm_planted', status: 'approved', legs: [{ symbolOut: 'ACN', symbolIn: 'XOM' }] }] });
    const res = await post(create());
    expect(res.statusCode).toBe(200);
    expect(res.body.card.stage).toBe('card');
    expect(JSON.stringify(res.body)).not.toContain('gpm_planted');
  });
  it('the card modules name no meeting field in their code (comments stripped)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    for (const rel of ['card.js', 'counter.js', '../_utils/filmRoom/cardStore.js', '../_utils/filmRoom/cardRequest.js', '../_utils/filmRoom/cardCounter.js', '../_utils/filmRoom/cardsGate.js']) {
      const code = readFileSync(resolve(here, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, rel).not.toMatch(/meeting|gameplan/i);
    }
  });
});

// ── the review's rows (docs/audits/20261021_BUILD_FILM_ROOM_B2_CARD.md §9) ──
describe('review L1-1 / L5-1 — a born-shelved card is never filed: the day\'s archetype must be the agent\'s current one', () => {
  it('the agent on another archetype than the tape day records: six creates → six 409 archetype_changed, nothing written; the counter shows no card, open 0', async () => {
    t.store.set(`agents/${AGENT}`, { ownerId: OWNER, name: 'Aurora', archetype: 'contrarian' });
    for (let i = 0; i < 6; i += 1) {
      const res = await post(create({ opId: `born_${i}` }));
      expect(res.statusCode, String(i)).toBe(409);
      expect(res.body, String(i)).toMatchObject({ error: 'archetype_changed', archetypeCodeId: 'momentum_chaser', current: 'contrarian' });
    }
    expect(playWrites()).toEqual([]);
    t.store.set(`agents/${AGENT}`, { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' });
    expect((await post(create({ opId: 'born_0' }))).statusCode).toBe(200);
  });
});

describe('review L1-4 / L1-9 / L2-5 / L2-6 — through the handler', () => {
  it('L1-4: the same body replayed after the stored day\'s version labels moved is the idempotent success', async () => {
    expect((await post(create())).body.idempotent).toBe(false);
    const path = `agentBattles/${BATTLE}/tape/${D}`;
    const tape = t.store.get(path);
    t.store.set(path, { ...tape, tags: { ...tape.tags, items: tape.tags.items.map((i) => ({ ...i, version: 3 })) } });
    const again = await post(create());
    expect(again.statusCode).toBe(200);
    expect(again.body).toMatchObject({ idempotent: true });
    expect(again.body.card.situationVersion).toBe(2);
    expect(playWrites()).toHaveLength(1);
  });
  it('L1-9: a tape the read cannot reach is 503 tape_unreadable, never "no tape for this day"', async () => {
    t = makeTapeDb({ ...fixture.store, [`agents/${AGENT}`]: { ownerId: OWNER, name: 'Aurora', archetype: 'momentum_chaser' } }, { hooks: { beforeRead: (label) => { if (label.includes('/tape/')) throw new Error('firestore down'); } } });
    state.db = t.db;
    const res = await post(create());
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ error: 'tape_unreadable' });
    expect(Object.keys(res.body).sort()).toEqual(['error', 'message']);
  });
  it('L2-5: a C1 control character in the note → 400 note_control_char; L2-6: a reserved __id__ op id → 400 invalid_op_id, never a 500', async () => {
    expect((await post(create({ note: 'a\u0085b' }))).body).toMatchObject({ error: 'note_control_char' });
    const res = await post(create({ opId: '__op__' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid_op_id' });
    expect(playWrites()).toEqual([]);
  });
});
