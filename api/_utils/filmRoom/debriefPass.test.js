// api/_utils/filmRoom/debriefPass.test.js
//
// Film Room D2 item 5 — THE NIGHTLY PASS (D2 spec §6, §7; DW-6, DW-7). On the tape's in-memory Firestore
// (api/_utils/filmTape/__fixtures__/tapeFirestore.js — queries, `create` semantics, read and write logs) with the Sep 23
// day written by the real close-pass writer, and a FAKE model call (no real call, no key). The selection, 'off' with
// zero reads, 'allowlist''s owners only, create-only, every skip, status and reason, the bounds, the time floor, and a
// log of counts only.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ debrief: 'allowlist' }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_DEBRIEF_MODE() { return flags.debrief; },
}));

import { runDebriefPass, selectedForDebrief, debriefRecordOf, tapeIsFor, attributionOf, DEBRIEF_MAX_CALLS, DEBRIEF_MAX_CONCURRENT, DEBRIEF_TIME_FLOOR_MS, DEBRIEF_RECORD_VERSION } from './debriefPass.js';
import { buildDayDigest, digestHashOf } from './dayDigest.js';
import { sep23Day, SEP23_NIGHT } from '../filmTape/__fixtures__/screenFixtures.js';
import { seedDay, OWNER } from '../filmTape/__fixtures__/tapeFixtures.js';
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
import { writeTapeDay } from '../filmTape/writeTapeDay.js';
import { etDayBounds } from '../../../src/utils/tapeSchedule.js';

const D = '2026-09-23';
/** The run that reads Sep 23: 03:45 UTC on Sep 24 — 11:45 PM EDT on Sep 23. */
const RUN_MS = Date.parse('2026-09-24T03:45:00.000Z');
const clone = (v) => structuredClone(v);
let BASE;      // the store after the close pass wrote Sep 23: path → document
let BATTLE_ID;

beforeAll(async () => {
  const fx = await sep23Day();
  const store = seedDay({}, fx);
  for (const v of fx.intradayViews || []) store[`agentBattles/${fx.battleId}/intradayViews/${v.id}`] = { evaluatedAt: v.evaluatedAt, ownerId: OWNER };
  const t = makeTapeDb(store);
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT });
  BASE = Object.fromEntries(t.store.entries());
  BATTLE_ID = fx.battleId;
});

const ENV_BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;
beforeEach(() => { flags.debrief = 'allowlist'; process.env.COCKPIT_ALLOWLIST_UIDS = OWNER; });
afterEach(() => { if (ENV_BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS; else process.env.COCKPIT_ALLOWLIST_UIDS = ENV_BEFORE; });

const tapePath = (id) => `agentBattles/${id}/tape/${D}`;
const recordPath = (id) => `agentBattles/${id}/debriefs/${D}`;
/** The Sep 23 world, plus copies of its battle under other ids/owners (`extra`: { id, owner, battle?, tape? | null }). */
function world(extra = [], { hooks } = {}) {
  const initial = clone(BASE);
  for (const e of extra) {
    initial[`agentBattles/${e.id}`] = { ...clone(BASE[`agentBattles/${BATTLE_ID}`]), ownerId: e.owner, ...(e.battle || {}) };
    if (e.tape !== null) initial[tapePath(e.id)] = { ...clone(BASE[tapePath(BATTLE_ID)]), battleId: e.id, ownerId: e.owner, ...(e.tape || {}) };
  }
  return makeTapeDb(initial, { hooks });
}
/** A fake model call: answers `lines` (or `answer`), records what it was asked and its concurrency. */
function fakeCall({ lines = [{ swap: 's1', text: "That wasn't my call." }, { swap: 's2', text: 'PLTR came in on my plan.' }], answer = null, delayMs = 0 } = {}) {
  const f = { asked: [], inFlight: 0, maxInFlight: 0 };
  f.call = async (req) => {
    f.asked.push(req);
    f.inFlight += 1; f.maxInFlight = Math.max(f.maxInFlight, f.inFlight);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    f.inFlight -= 1;
    return answer ?? { ok: true, output: { lines }, usage: { input: 1500, output: 60 }, model: req.model, attempts: 1, costUsd: 0.0036, stopReason: 'end_turn', elapsedMs: 5 };
  };
  return f;
}
const resolveAttribution = async (_db, battle) => battle.agentId;
const quiet = () => {};
const run = (t, over = {}) => runDebriefPass({ db: t.db, clock: () => RUN_MS, startMs: RUN_MS, resolveAttribution, log: quiet, ...over });

describe("the gate: 'off' reads, calls and writes nothing", () => {
  it("'off' handed in: skipped — zero reads, zero calls, zero writes", async () => {
    const t = world();
    const f = fakeCall();
    expect(await run(t, { mode: 'off', call: f.call })).toEqual({ skipped: true, reason: 'off' });
    expect([t.readLog, t.writeLog, f.asked]).toEqual([[], [], []]);
  });
  it("'off' read at CALL time (no mode handed in): the same", async () => {
    flags.debrief = 'off';
    const t = world();
    const f = fakeCall();
    expect(await runDebriefPass({ db: t.db, clock: () => RUN_MS, startMs: RUN_MS, call: f.call, resolveAttribution, log: quiet })).toEqual({ skipped: true, reason: 'off' });
    expect([t.readLog, t.writeLog, f.asked]).toEqual([[], [], []]);
  });
});

describe('the selection (§7)', () => {
  it("'allowlist': only the owners the allowlist admits — another owner's battle day is never read, never called for, never written", async () => {
    const t = world([{ id: 'b-other', owner: 'owner-2' }]);
    const f = fakeCall();
    const s = await run(t, { mode: 'allowlist', call: f.call });
    expect([s.selected, s.written, f.asked.length]).toEqual([1, 1, 1]);
    expect(t.store.has(recordPath(BATTLE_ID))).toBe(true);
    expect(t.store.has(recordPath('b-other'))).toBe(false);
    expect(t.readLog.filter((p) => p.includes('b-other'))).toEqual([]);
  });
  it("'on': every owner's tiered battle day", async () => {
    const t = world([{ id: 'b-other', owner: 'owner-2' }]);
    const s = await run(t, { mode: 'on', call: fakeCall().call });
    expect([s.selected, s.written]).toEqual([2, 2]);
    expect(t.store.get(recordPath('b-other')).ownerId).toBe('owner-2');
  });
  it('the two candidate queries — active, and completed on or after the day\'s start — and no collection-group query', async () => {
    const t = world([{ id: 'b-active', owner: OWNER, battle: { status: 'active', completedAt: null } }]);
    await run(t, { mode: 'allowlist', call: fakeCall().call });
    const queries = t.readLog.filter((l) => !l.startsWith('agentBattles/'));
    expect(queries.every((l) => !l.startsWith('group:'))).toBe(true);
    expect(t.store.has(recordPath('b-active'))).toBe(true);
    expect(t.store.has(recordPath(BATTLE_ID))).toBe(true);
  });
  it('a battle completed before the day\'s start is not a candidate; a non-tiered battle and a day not its battle day are not selected', async () => {
    const t = world([
      { id: 'b-old', owner: OWNER, battle: { status: 'completed', completedAt: '2026-09-22T20:00:00.000Z' } },
      { id: 'b-flat', owner: OWNER, battle: { gameMode: 'baggerbomb_tournament' } },
      { id: 'b-later', owner: OWNER, battle: { timing: { tradingDays: ['2026-09-24'] } } },
    ]);
    const s = await run(t, { mode: 'on', call: fakeCall().call });
    expect(s.selected).toBe(1);
    for (const id of ['b-old', 'b-flat', 'b-later']) expect(t.store.has(recordPath(id)), id).toBe(false);
  });
  it('selectedForDebrief: tiered, a battle day, and admitted — each one alone refuses', () => {
    const b = { ...clone(BASE[`agentBattles/${BATTLE_ID}`]), id: BATTLE_ID };
    expect(selectedForDebrief(b, D, 'on')).toBe(true);
    expect(selectedForDebrief({ ...b, gameMode: 'baggerbomb_tournament' }, D, 'on')).toBe(false);
    expect(selectedForDebrief(b, '2026-09-24', 'on')).toBe(false);
    expect(selectedForDebrief({ ...b, ownerId: 'owner-2' }, D, 'allowlist')).toBe(false);
    expect(selectedForDebrief(b, D, 'off')).toBe(false);
  });
  it('exactly ONE get of the tape and ONE of the record per selected battle', async () => {
    const t = world();
    await run(t, { mode: 'allowlist', call: fakeCall().call });
    expect(t.readLog.filter((p) => p === tapePath(BATTLE_ID))).toHaveLength(1);
    expect(t.readLog.filter((p) => p === recordPath(BATTLE_ID))).toHaveLength(1);
  });
  it('the day is the ET date of the run; a run whose ET date is no session reads no battle at all', async () => {
    const t = world();
    const sat = Date.parse('2026-09-27T03:45:00.000Z');   // 11:45 PM EDT on Saturday the 26th
    const s = await run(t, { mode: 'on', call: fakeCall().call, clock: () => sat, startMs: sat });
    expect([s.etDate, s.notSession, s.selected]).toEqual(['2026-09-26', true, 0]);
    expect(t.readLog).toEqual([]);
  });
});

describe('per battle day: the skips', () => {
  it('no tape: skipped, no call, no record', async () => {
    const t = world([{ id: 'b-notape', owner: OWNER, tape: null }]);
    const f = fakeCall();
    const s = await run(t, { mode: 'on', call: f.call });
    expect(s.skipped.noTape).toBe(1);
    expect(t.store.has(recordPath('b-notape'))).toBe(false);
    expect(f.asked).toHaveLength(1);   // the Sep 23 battle only
  });
  it('a tape the close pass did not write (its own status, or no checks): skipped', async () => {
    const t = world([
      { id: 'b-failed', owner: OWNER, tape: { passes: { close: { status: 'failed' } } } },
      { id: 'b-nochecks', owner: OWNER, tape: { checks: null } },
    ]);
    const s = await run(t, { mode: 'on', call: fakeCall().call });
    expect(s.skipped.notWritten).toBe(2);
    expect(t.store.has(recordPath('b-failed'))).toBe(false);
    expect(t.store.has(recordPath('b-nochecks'))).toBe(false);
  });
  it('a record already there: skipped — no call, and the record is never touched (create-only)', async () => {
    const t = world();
    t.store.set(recordPath(BATTLE_ID), { version: 1, status: 'written', marker: 'first' });
    const f = fakeCall();
    const s = await run(t, { mode: 'allowlist', call: f.call });
    expect([s.skipped.exists, s.written, f.asked.length]).toEqual([1, 0, 0]);
    expect(t.store.get(recordPath(BATTLE_ID)).marker).toBe('first');
    expect(t.writeLog).toEqual([]);
  });
  it('a record created by another run between the read and the write: `create` refuses — never overwritten', async () => {
    const t = world();
    const f = fakeCall();
    f.call = async (req) => { t.store.set(recordPath(BATTLE_ID), { marker: 'other run' }); return fakeCall().call(req); };
    const s = await run(t, { mode: 'allowlist', call: f.call });
    expect([s.written, s.skipped.exists]).toEqual([0, 1]);
    expect(t.store.get(recordPath(BATTLE_ID)).marker).toBe('other run');
  });
  it('a second run: everything already recorded — no call, no write', async () => {
    const t = world();
    await run(t, { mode: 'allowlist', call: fakeCall().call });
    const before = clone(t.store.get(recordPath(BATTLE_ID)));
    const writes = t.writeLog.length;
    const f = fakeCall();
    await run(t, { mode: 'allowlist', call: f.call });
    expect([f.asked.length, t.writeLog.length]).toEqual([0, writes]);
    expect(t.store.get(recordPath(BATTLE_ID))).toEqual(before);
  });
  it('the record is written with `create` only — never set or update', async () => {
    const t = world();
    await run(t, { mode: 'allowlist', call: fakeCall().call });
    expect(t.writeLog).toEqual([{ op: 'create', path: recordPath(BATTLE_ID) }]);
  });
});

describe('the record (§6): every status and reason', () => {
  it('written: the lines bound to their tape row keys, the dropped beside them, every field stamped', async () => {
    const t = world();
    const f = fakeCall({ lines: [{ swap: 's1', text: "  That wasn't my call.  " }, { swap: 's2', text: 'Out at 4.' }, { swap: 's9', text: 'Nope.' }] });
    await run(t, { mode: 'allowlist', call: f.call });
    const tape = BASE[tapePath(BATTLE_ID)];
    const battle = BASE[`agentBattles/${BATTLE_ID}`];
    const { digest } = buildDayDigest({ tape, battle: { id: BATTLE_ID, ...battle } });
    expect(t.store.get(recordPath(BATTLE_ID))).toEqual({
      version: DEBRIEF_RECORD_VERSION,
      battleId: BATTLE_ID,
      etDate: D,
      ownerId: OWNER,
      attributionAgentId: battle.agentId,
      archetype: battle.agentContext.archetype,
      status: 'written',
      reason: null,
      writtenAt: new Date(RUN_MS).toISOString(),
      digestVersion: 1,
      digestHash: digestHashOf(digest),
      tapeWrittenAt: tape.writtenAt,
      model: 'claude-sonnet-5-5',
      usage: { input: 1500, output: 60 },
      costUsd: 0.0036,
      attempts: 1,
      lines: [{ key: tape.actions[0].key, label: 's1', text: "That wasn't my call." }],
      dropped: [{ label: 's2', reason: 'digit' }, { label: null, reason: 'label' }],
    });
  });
  it('the prompt the call is handed is the digest\'s — its user text the canonical digest the hash is taken over', async () => {
    const t = world();
    const f = fakeCall();
    await run(t, { mode: 'allowlist', call: f.call });
    const rec = t.store.get(recordPath(BATTLE_ID));
    expect(digestHashOf(JSON.parse(f.asked[0].user))).toBe(rec.digestHash);
    expect(f.asked[0].model).toBe('claude-sonnet-5-5');
    expect(Number.isFinite(f.asked[0].deadlineAt)).toBe(true);
  });
  it('a day with NO swap: `nothing` / `no_swaps` — and no call; model, usage, cost and attempts null', async () => {
    const t = world([{ id: 'b-quiet', owner: OWNER, tape: { actions: [] } }]);
    const f = fakeCall();
    await run(t, { mode: 'on', call: f.call });
    expect(f.asked.map((r) => JSON.parse(r.user).swaps.length)).toEqual([3]);   // only Sep 23's battle was called for
    const rec = t.store.get(recordPath('b-quiet'));
    expect([rec.status, rec.reason, rec.model, rec.usage, rec.costUsd, rec.attempts, rec.lines, rec.dropped]).toEqual(['nothing', 'no_swaps', null, null, null, null, [], []]);
  });
  it('every line dropped: `nothing` / `no_lines`, the dropped kept', async () => {
    const t = world();
    await run(t, { mode: 'allowlist', call: fakeCall({ lines: [{ swap: 's1', text: 'The best exit.' }] }).call });
    const rec = t.store.get(recordPath(BATTLE_ID));
    expect([rec.status, rec.reason, rec.lines, rec.dropped]).toEqual(['nothing', 'no_lines', [], [{ label: 's1', reason: 'forbidden' }]]);
  });
  it('the model failed: `failed` with the call\'s reason — its attempts kept, no lines', async () => {
    const t = world();
    await run(t, { mode: 'allowlist', call: fakeCall({ answer: { ok: false, reason: 'model_error_500', usage: null, model: 'claude-sonnet-5-5', attempts: 1, costUsd: null } }).call });
    const rec = t.store.get(recordPath(BATTLE_ID));
    expect([rec.status, rec.reason, rec.attempts, rec.usage, rec.lines]).toEqual(['failed', 'model_error_500', 1, null, []]);
  });
  it('an answer of the wrong shape: `failed` / `parse`', async () => {
    const t = world();
    await run(t, { mode: 'allowlist', call: fakeCall({ answer: { ok: true, output: { notLines: [] }, usage: { input: 1, output: 1 }, model: 'claude-sonnet-5-5', attempts: 1, costUsd: 0.000012 } }).call });
    expect(t.store.get(recordPath(BATTLE_ID))).toMatchObject({ status: 'failed', reason: 'parse', costUsd: 0.000012 });
  });
  it('debriefRecordOf: a written record carries no reason; a failed one carries its own', () => {
    const args = { battle: { id: 'b', ownerId: 'o', agentContext: { archetype: 'x' } }, etDate: D, attributionAgentId: 'a', digest: { swaps: [] }, tape: { writtenAt: 'w' }, nowIso: 'n' };
    expect(debriefRecordOf({ ...args, status: 'written', reason: 'ignored' }).reason).toBeNull();
    expect(debriefRecordOf({ ...args, status: 'failed', reason: 'deadline' }).reason).toBe('deadline');
  });
});

describe('Amendment F DF-1 (Astra\'s F1): the tape names this battle, this day and this battle\'s owner — the record is the tape\'s owner\'s', () => {
  const battle = () => ({ id: BATTLE_ID, ...clone(BASE[`agentBattles/${BATTLE_ID}`]) });
  it('debriefRecordOf stamps the TAPE\'s owner, never the battle snapshot\'s', () => {
    const args = { battle: { id: 'b', ownerId: 'owner-now', agentContext: {} }, etDate: D, attributionAgentId: null, digest: { swaps: [] }, tape: { ownerId: 'owner-who-played', writtenAt: 'w' }, nowIso: 'n', status: 'nothing', reason: 'no_swaps' };
    expect(debriefRecordOf(args).ownerId).toBe('owner-who-played');
    expect(debriefRecordOf({ ...args, tape: { writtenAt: 'w' } }).ownerId).toBeNull();
  });
  it('tapeIsFor: the battle\'s id, the run\'s date, the battle\'s owner — each mismatch alone refuses, and so does an owner that is no string', () => {
    const tape = BASE[tapePath(BATTLE_ID)];
    const b = battle();
    expect(tapeIsFor(tape, b, D)).toBe(true);
    expect(tapeIsFor({ ...tape, battleId: 'b-elsewhere' }, b, D)).toBe(false);
    expect(tapeIsFor({ ...tape, etDate: '2026-09-22' }, b, D)).toBe(false);
    expect(tapeIsFor(tape, b, '2026-09-22')).toBe(false);
    expect(tapeIsFor({ ...tape, ownerId: 'owner-previous' }, b, D)).toBe(false);
    expect(tapeIsFor(tape, { ...b, ownerId: 'owner-replacement' }, D)).toBe(false);
    expect(tapeIsFor({ ...tape, ownerId: null }, { ...b, ownerId: null }, D)).toBe(false);
    expect(tapeIsFor({ ...tape, ownerId: '' }, { ...b, ownerId: '' }, D)).toBe(false);
    expect(tapeIsFor(null, b, D)).toBe(false);
  });
  it('a mismatch is counted `ownerMismatch` and skipped before anything else is read or built — no attribution read, no call, no record; the other battle proceeds', async () => {
    const t = world([{ id: 'b-other', owner: OWNER }]);
    t.store.set(`agentBattles/${BATTLE_ID}`, { ...t.store.get(`agentBattles/${BATTLE_ID}`), ownerId: 'owner-replacement' });
    process.env.COCKPIT_ALLOWLIST_UIDS = `${OWNER},owner-replacement`;
    const f = fakeCall();
    const asked = [];
    const s = await run(t, { mode: 'allowlist', call: f.call, resolveAttribution: async (_db, b) => { asked.push(b.id); return b.agentId; } });
    expect([s.selected, s.skipped.ownerMismatch, s.written, f.asked.length]).toEqual([2, 1, 1, 1]);
    expect(asked).toEqual(['b-other']);
    expect(t.store.has(recordPath(BATTLE_ID))).toBe(false);
    expect(t.store.get(recordPath('b-other')).ownerId).toBe(OWNER);
  });
});

describe('the bounds (§7)', () => {
  /** n more battles, each a copy of Sep 23 under its own id, all the allowlisted owner's. */
  const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `b-${String(i).padStart(4, '0')}`, owner: OWNER }));
  it(`at most ${DEBRIEF_MAX_CONCURRENT} calls at once`, async () => {
    const t = world(many(9));
    const f = fakeCall({ delayMs: 5 });
    const s = await run(t, { mode: 'allowlist', call: f.call });
    expect(s.written).toBe(10);
    expect(DEBRIEF_MAX_CONCURRENT).toBe(4);
    expect(f.maxInFlight).toBe(4);
  });
  it(`at most ${DEBRIEF_MAX_CALLS} calls per run: the days past it keep no record and are named in the summary`, async () => {
    const t = world(many(DEBRIEF_MAX_CALLS + 1));
    const f = fakeCall();
    const s = await run(t, { mode: 'allowlist', call: f.call });
    expect(DEBRIEF_MAX_CALLS).toBe(200);
    expect([f.asked.length, s.written, s.notReached.length, s.complete]).toEqual([200, 200, 2, false]);
    for (const { battleId } of s.notReached) expect(t.store.has(recordPath(battleId)), battleId).toBe(false);
  });
  it('a day with no swap costs no call, so the cap never counts it', async () => {
    const still = many(3).map((e) => ({ ...e, tape: { actions: [] } }));
    const t = world(still);
    const f = fakeCall();
    const s = await run(t, { mode: 'allowlist', call: f.call });
    expect([s.calls, f.asked.length, s.nothing, s.written]).toEqual([1, 1, 3, 1]);
  });
  it('the time floor: once less than the floor remains, no battle is begun — each named, none recorded', async () => {
    const t = world(many(3));
    let now = RUN_MS;
    const f = fakeCall();
    const call = async (req) => { now += 100_000; return f.call(req); };   // each call takes 100 s of a 300 s budget
    const s = await runDebriefPass({ db: t.db, clock: () => now, startMs: RUN_MS, budgetMs: 300_000, mode: 'allowlist', call, resolveAttribution, log: quiet });
    expect(DEBRIEF_TIME_FLOOR_MS).toBe(30_000);
    expect(s.complete).toBe(false);
    expect(s.written + s.notReached.length).toBe(4);
    expect(s.notReached.length).toBeGreaterThan(0);
    for (const { battleId } of s.notReached) expect(t.store.has(recordPath(battleId))).toBe(false);
  });
});

describe('the log: counts only (§7)', () => {
  it('one line of counts — never a line\'s words, an id or a key', async () => {
    const t = world([{ id: 'b-other', owner: 'owner-2' }]);
    const lines = [];
    await run(t, { mode: 'on', call: fakeCall({ lines: [{ swap: 's1', text: 'Distinctive words here.' }] }).call, log: (...a) => lines.push(a.join(' ')) });
    expect(lines).toHaveLength(1);
    const [prefix, json] = [lines[0].slice(0, lines[0].indexOf(' ')), JSON.parse(lines[0].slice(lines[0].indexOf(' ') + 1))];
    expect(prefix).toBe('[film-room-debrief]');
    expect(Object.keys(json).sort()).toEqual(['attributionUnresolved', 'calls', 'errors', 'failed', 'notReached', 'nothing', 'selected', 'skipped', 'totalCostUsd', 'writeFailed', 'written']);
    for (const v of Object.values(json)) expect(typeof v).toBe('number');
    for (const s of [BATTLE_ID, 'b-other', OWNER, 'owner-2', 'Distinctive', D, BASE[tapePath(BATTLE_ID)].actions[0].key]) expect(lines[0].includes(s), s).toBe(false);
  });
  it('a read that fails with a message naming the battle: counted as an error, never printed — the next battle proceeds', async () => {
    const t = world([{ id: 'b-other', owner: OWNER }], { hooks: { beforeRead: (label) => { if (label === tapePath(BATTLE_ID)) throw new Error(`PERMISSION_DENIED at ${tapePath(BATTLE_ID)}`); } } });
    const lines = [];
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = await run(t, { mode: 'allowlist', call: fakeCall().call, log: (...a) => lines.push(a.join(' ')) });
      expect([s.errors, s.written]).toEqual([1, 1]);
      expect(t.store.has(recordPath('b-other'))).toBe(true);
      expect(lines.join('\n').includes(BATTLE_ID)).toBe(false);
      expect(err).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally { err.mockRestore(); warn.mockRestore(); }
  });
});

describe('the review round (§2 review, the record lens)', () => {
  const CLONE = `casual-agent-${OWNER}`;
  const cloneWorld = (cloneDoc, { hooks } = {}) => {
    const t = world([{ id: 'b-clone', owner: OWNER, battle: { agentId: CLONE }, tape: { agentId: CLONE } }], { hooks });
    if (cloneDoc !== undefined) t.store.set(`agents/${CLONE}`, cloneDoc);
    return t;
  };
  const quietConsole = () => { const spies = ['log', 'info', 'warn', 'error', 'debug'].map((k) => vi.spyOn(console, k).mockImplementation(() => {})); return { spies, restore: () => spies.forEach((s) => s.mockRestore()) }; };
  it('R2/R3: attributionOf — the battle\'s own agent with no read; a clone\'s parent through a read of the owner\'s own clone document and of the owner\'s own parent; never the clone; nothing printed', async () => {
    const c = quietConsole();
    try {
      const plain = world();
      expect(await attributionOf(plain.db, { id: BATTLE_ID, ownerId: OWNER, agentId: 'agent-1' })).toBe('agent-1');
      expect(plain.readLog).toEqual([]);
      const b = { id: 'b-clone', ownerId: OWNER, agentId: CLONE };
      const own = cloneWorld({ ownerId: OWNER, rankedAgentId: 'parent-agent-1' });
      own.store.set('agents/parent-agent-1', { ownerId: OWNER });
      expect(await attributionOf(own.db, b)).toBe('parent-agent-1');
      expect(own.readLog).toEqual([`agents/${CLONE}`, 'agents/parent-agent-1']);
      expect(await attributionOf(cloneWorld({ ownerId: 'owner-2', rankedAgentId: 'victim-agent-9' }).db, b)).toBeNull();   // another owner's
      expect(await attributionOf(cloneWorld({ ownerId: OWNER }).db, b)).toBeNull();                                         // no parent named
      expect(await attributionOf(cloneWorld(undefined).db, b)).toBeNull();                                                  // no clone document
      const failing = cloneWorld({ ownerId: OWNER, rankedAgentId: 'parent-agent-1' }, { hooks: { beforeRead: (l) => { if (l === `agents/${CLONE}`) throw new Error(`PERMISSION_DENIED at agents/${CLONE}`); } } });
      expect(await attributionOf(failing.db, b)).toBeNull();                                                                // a failed read
      for (const s of c.spies) expect(s).not.toHaveBeenCalled();
    } finally { c.restore(); }
  });
  it('R3: a clone battle the attribution cannot resolve — the record says null (never the clone), the run counts it, the log names nothing', async () => {
    const c = quietConsole();
    try {
      const t = cloneWorld({ ownerId: 'owner-2', rankedAgentId: 'victim-agent-9' });
      const lines = [];
      const s = await runDebriefPass({ db: t.db, clock: () => RUN_MS, startMs: RUN_MS, mode: 'allowlist', call: fakeCall().call, log: (...a) => lines.push(a.join(' ')) });
      expect(t.store.get(recordPath('b-clone')).attributionAgentId).toBeNull();
      expect(s.attributionUnresolved).toBe(1);
      for (const id of [CLONE, 'victim-agent-9', 'b-clone']) expect(lines.join('\n').includes(id), id).toBe(false);
      for (const sp of c.spies) expect(sp).not.toHaveBeenCalled();
    } finally { c.restore(); }
  });
  it('R4: a write that fails (not ALREADY_EXISTS) after the call — no record, the day NAMED in the summary, the call\'s cost in the total, nothing printed', async () => {
    const t = world([], { hooks: { beforeWrite: (op, p) => { if (p === recordPath(BATTLE_ID)) throw Object.assign(new Error(`DEADLINE_EXCEEDED at ${p}`), { code: 4 }); } } });
    const lines = [];
    const s = await run(t, { mode: 'allowlist', call: fakeCall().call, log: (...a) => lines.push(a.join(' ')) });
    expect([s.written, s.errors, s.writeFailed, s.totalCostUsd]).toEqual([0, 1, [{ battleId: BATTLE_ID, etDate: D }], 0.0036]);
    expect(t.store.has(recordPath(BATTLE_ID))).toBe(false);
    expect(lines.join('\n').includes(BATTLE_ID)).toBe(false);
  });
});

describe('the review round (§2 review, the census lens)', () => {
  const many = (n, tape) => Array.from({ length: n }, (_, i) => ({ id: `b-c4-${i}`, owner: OWNER, ...(tape ? { tape } : {}) }));
  it('C4: the per-battle floor holds for a day with NO swap too — begun with less than the floor left, nothing is read or written', async () => {
    const t = world(many(6, { actions: [] }));
    const s = await run(t, { mode: 'allowlist', call: fakeCall().call, clock: () => RUN_MS + 300_000 - 20_000, budgetMs: 300_000 });
    expect([s.selected, s.notReached.length, s.nothing, s.written, s.calls, s.complete]).toEqual([7, 7, 0, 0, 0, false]);
    expect(t.readLog.filter((l) => l.includes('/tape/') || l.includes('/debriefs/'))).toEqual([]);
    expect(t.writeLog).toEqual([]);
  });
  it('C4: a call\'s deadline never passes the run\'s — at most start + budget − 15 s; at the start, the call\'s own 60 s', async () => {
    const late = fakeCall();
    await run(world(), { mode: 'allowlist', call: late.call, clock: () => RUN_MS + 300_000 - 40_000, budgetMs: 300_000 });
    expect(late.asked.map((r) => r.deadlineAt)).toEqual([RUN_MS + 300_000 - DEBRIEF_TIME_FLOOR_MS / 2]);
    expect(RUN_MS + 300_000 - DEBRIEF_TIME_FLOOR_MS / 2).toBe(RUN_MS + 285_000);
    const early = fakeCall();
    await run(world(), { mode: 'allowlist', call: early.call, budgetMs: 300_000 });
    expect(early.asked.map((r) => r.deadlineAt)).toEqual([RUN_MS + 60_000]);
  });
  it('C4: a battle completed exactly at the day\'s start is a candidate; a millisecond before it is not', async () => {
    const { startIso, startMs } = etDayBounds(D);
    const t = world([
      { id: 'b-at-start', owner: OWNER, battle: { status: 'completed', completedAt: startIso } },
      { id: 'b-just-before', owner: OWNER, battle: { status: 'completed', completedAt: new Date(startMs - 1).toISOString() } },
    ]);
    await run(t, { mode: 'allowlist', call: fakeCall().call });
    expect(t.store.has(recordPath('b-at-start'))).toBe(true);
    expect(t.store.has(recordPath('b-just-before'))).toBe(false);
  });
});

describe("the refuter's round (§2 review)", () => {
  const CLONE = 'casual-agent-' + OWNER;
  const b = { id: 'b-clone', ownerId: OWNER, agentId: CLONE };
  const quietConsole = () => { const spies = ['log', 'info', 'warn', 'error', 'debug'].map((k) => vi.spyOn(console, k).mockImplementation(() => {})); return { spies, restore: () => spies.forEach((sp) => sp.mockRestore()) }; };
  it("N3: the owner's own clone naming a parent another owner holds, or no parent document, or a parent that cannot be read — null, never that agent; nothing printed", async () => {
    const c = quietConsole();
    try {
      const at = (parentDoc, hooks) => { const t = makeTapeDb({ ['agents/' + CLONE]: { ownerId: OWNER, rankedAgentId: 'victim-agent-9' }, ...(parentDoc ? { 'agents/victim-agent-9': parentDoc } : {}) }, { hooks }); return attributionOf(t.db, b); };
      expect(await at({ ownerId: 'owner-2' })).toBeNull();          // a parent another owner holds
      expect(await at(null)).toBeNull();                            // no parent document
      expect(await at({ ownerId: OWNER }, { beforeRead: (l) => { if (l === 'agents/victim-agent-9') throw new Error('UNAVAILABLE at agents/victim-agent-9'); } })).toBeNull();   // a failed read
      expect(await at({ ownerId: OWNER })).toBe('victim-agent-9');  // the control: the owner's own parent
      for (const sp of c.spies) expect(sp).not.toHaveBeenCalled();
    } finally { c.restore(); }
  });
  it("the battery's Y-R3own: a clone document another owner holds is refused even when the parent it names is the owner's own — the platform resolver compares the parent with the CLONE's owner", async () => {
    const c = quietConsole();
    try {
      const t = makeTapeDb({ ['agents/' + CLONE]: { ownerId: 'owner-2', rankedAgentId: 'parent-agent-1' }, 'agents/parent-agent-1': { ownerId: OWNER } });
      expect(await attributionOf(t.db, b)).toBeNull();
      expect(t.readLog).toEqual(['agents/' + CLONE]);   // refused at the clone: the parent is never read
      for (const sp of c.spies) expect(sp).not.toHaveBeenCalled();
    } finally { c.restore(); }
  });
});
