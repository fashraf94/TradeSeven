// api/_utils/filmRoom/astraD2Findings.test.js
//
// Film Room D2 fix round — ASTRA'S D2 FINDINGS, REPRODUCED (docs/audits/20261123_ASTRA_REVIEW_FILM_ROOM_D2_WORDS.md §1;
// Build D Amendment F). Each row is the finding's reproduction, written before any fix and run at the reviewed head
// `1ef468b0`, where every row FAILED (the build report's §15 records each failure); each passes once its item is built.
// The rows read only what the reviewed head already exported, so a failure there is the finding, never a missing name.
// Everything is a fake: the tape's in-memory Firestore with the Sep 23 day written by the real close-pass writer, a fake
// model call, the handler's own seams. No real call, no key, no production read.
//
//   F1  a replacement owner can receive words from the previous owner's tape (DF-1)
//   F2  a player's sentence echoed in an evaluation reaches the model (DF-2)
//   F3  the identifier filter misses the tape's own keys (DF-3)
//   F4  an Arabic question mark escapes the sentence count (DF-4)
//   F5  a verdict and a claim of the rule's decision reach a written record (DF-5)
//   F6  the HTTP response carries battle ids (DF-6)
//   F7  the paid endpoint admits the cron header without its secret (DF-7)

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

const flags = vi.hoisted(() => ({ debrief: 'allowlist' }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_ROOM_DEBRIEF_MODE() { return flags.debrief; },
}));

import { runDebriefPass } from './debriefPass.js';
import { buildDayDigest, knownIdsOf } from './dayDigest.js';
import { buildDebriefPrompt } from './debriefPrompt.js';
import { checkDebriefLines } from './debriefChecks.js';
import handler from '../../cron/film-room-debrief.js';
import { runSample } from '../../../scripts/film-room-debrief-sample.mjs';
import { holdsIdentifier } from '../../../src/utils/promptBoundText.js';
import { sep23Day, SEP23_NIGHT } from '../filmTape/__fixtures__/screenFixtures.js';
import { seedDay, OWNER } from '../filmTape/__fixtures__/tapeFixtures.js';
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
import { writeTapeDay } from '../filmTape/writeTapeDay.js';

const D = '2026-09-23';
/** The run that reads Sep 23: 03:45 UTC on Sep 24 — 11:45 PM EDT on Sep 23. */
const RUN_MS = Date.parse('2026-09-24T03:45:00.000Z');
const clone = (v) => structuredClone(v);
let BASE; let BATTLE_ID; let SEP;

beforeAll(async () => {
  const fx = await sep23Day();
  const store = seedDay({}, fx);
  for (const v of fx.intradayViews || []) store[`agentBattles/${fx.battleId}/intradayViews/${v.id}`] = { evaluatedAt: v.evaluatedAt, ownerId: OWNER };
  const t = makeTapeDb(store);
  await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: SEP23_NIGHT });
  BASE = Object.fromEntries(t.store.entries());
  BATTLE_ID = fx.battleId;
  SEP = { tape: BASE[`agentBattles/${BATTLE_ID}/tape/${D}`], battle: { id: BATTLE_ID, ...BASE[`agentBattles/${BATTLE_ID}`] } };
});

const ENV = { allow: process.env.COCKPIT_ALLOWLIST_UIDS, secret: process.env.CRON_SECRET };
beforeEach(() => { flags.debrief = 'allowlist'; process.env.COCKPIT_ALLOWLIST_UIDS = OWNER; process.env.CRON_SECRET = 'cron-secret-for-test'; });
afterEach(() => {
  for (const [k, v] of [['COCKPIT_ALLOWLIST_UIDS', ENV.allow], ['CRON_SECRET', ENV.secret]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const tapePath = (id) => `agentBattles/${id}/tape/${D}`;
const recordPath = (id) => `agentBattles/${id}/debriefs/${D}`;
/** The Sep 23 world; `battle` and `tape` patch the parent and its tape. */
function world({ battle = {}, tape = {}, hooks } = {}) {
  const initial = clone(BASE);
  Object.assign(initial[`agentBattles/${BATTLE_ID}`], battle);
  Object.assign(initial[tapePath(BATTLE_ID)], tape);
  return makeTapeDb(initial, { hooks });
}
function fakeCall(lines = [{ swap: 's2', text: 'PLTR came in on my plan.' }]) {
  const f = { asked: [] };
  f.call = async (req) => { f.asked.push(req); return { ok: true, output: { lines }, usage: { input: 1500, output: 60 }, model: req.model, attempts: 1, costUsd: 0.0036, stopReason: 'end_turn', elapsedMs: 5 }; };
  return f;
}
const resolveAttribution = async (_db, b) => b.agentId;
const quiet = () => {};
const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const BEARER = { headers: { authorization: 'Bearer cron-secret-for-test' } };

describe('F1 — the record belongs to the tape\'s owner (DF-1)', () => {
  it('the parent\'s owner replaced after the close, only the replacement admitted: the previous owner\'s tape is never sent, and no record is filed under the replacement', async () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'owner-replacement';
    const t = world({ battle: { ownerId: 'owner-replacement' } });   // the tape keeps the owner who played the day
    const f = fakeCall();
    await runDebriefPass({ db: t.db, clock: () => RUN_MS, startMs: RUN_MS, mode: 'allowlist', call: f.call, resolveAttribution, log: quiet });
    expect([f.asked.length, t.store.has(recordPath(BATTLE_ID))]).toEqual([0, false]);
  });
  it('a tape naming another battle or another day: no call, no record', async () => {
    for (const tape of [{ battleId: 'b-elsewhere' }, { etDate: '2026-09-22' }]) {
      const t = world({ tape });
      const f = fakeCall();
      await runDebriefPass({ db: t.db, clock: () => RUN_MS, startMs: RUN_MS, mode: 'allowlist', call: f.call, resolveAttribution, log: quiet });
      expect([f.asked.length, t.store.has(recordPath(BATTLE_ID))], JSON.stringify(tape)).toEqual([0, false]);
    }
  });
  it('the sample pack: a tape whose owner is not the battle\'s is never sent', async () => {
    const t = world({ tape: { ownerId: 'owner-previous' } });
    const f = fakeCall();
    await runSample({ db: t.db, ownerId: OWNER, days: 1, nowMs: Date.parse('2026-09-24T12:00:00.000Z'), call: f.call, resolveAttribution, write: false, log: quiet });
    expect(f.asked).toHaveLength(0);
  });
});
