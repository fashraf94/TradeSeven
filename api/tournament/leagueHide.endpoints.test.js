// api/tournament/leagueHide.endpoints.test.js
//
// League hide (direction note BB-1; founder rulings Q1 and Q4, Nov 15, 2026) — the SERVER half: with
// LEAGUE_HIDE_ENABLED on, the league's seven ENTRY doors refuse with one typed 404, and nothing else changes.
//
//   Entry doors (close):   slot-claim, lobby-create, lobby-form, lobby-join, lobby-matchmake, lobby-quickplay,
//                          lobby-quickplay-training.
//   In-week and read-only (keep answering): slot-release, live-draft-pick, slot-schedule, training-pick, and
//                          activate-training-pod (internal: it answers the cron secret's gate, not a Bearer token).
//   Operator (keep answering): run-duty.
//
// "Answers" is judged by how far a request gets: an entry door must stop at the refusal, before auth and before the
// database; every other endpoint must still reach its own auth gate (the mock's 401 / the admin gate's 401), which is the
// first thing it does after its method and flag checks. The flag is read through a getter so one file holds both states.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this file's REAL import of the endpoint modules is the runtime guard for the
// api/ -> src/ edge that api/_utils/leagueHidden.js adds (src/config/featureFlags.js). It must never mock leagueHidden.js.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  hide: false,
  lobbyOn: true,
  liveDraftOn: true,
  authCalls: 0,
  adminCalls: 0,
  dbCalls: 0,
  user: null,
}));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get LEAGUE_HIDE_ENABLED() { return h.hide; },
    // The two flags whose own refusals sit beside this one are read through getters, so a row can turn them off.
    get LEAGUE_LOBBY_ENABLED() { return h.lobbyOn; },
    get LEAGUE_LIVE_DRAFT() { return h.liveDraftOn; },
  };
});
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => { h.dbCalls += 1; return {}; } }));
vi.mock('../_utils/authMiddleware.js', () => ({
  requireAuth: async (req, res) => {
    h.authCalls += 1;
    if (h.user) return h.user;
    res.status(401).json({ error: 'Authentication required' });
    return null;
  },
}));
vi.mock('../_utils/adminSecretAuth.js', () => ({
  requireAdminSecret: (req, res) => {
    h.adminCalls += 1;
    res.status(401).json({ error: 'admin secret required' });
    return false;
  },
}));

import slotClaim from './slot-claim.js';
import lobbyCreate from './lobby-create.js';
import lobbyForm from './lobby-form.js';
import lobbyJoin from './lobby-join.js';
import lobbyMatchmake from './lobby-matchmake.js';
import lobbyQuickplay from './lobby-quickplay.js';
import lobbyQuickplayTraining from './lobby-quickplay-training.js';
import slotRelease from './slot-release.js';
import liveDraftPick from './live-draft-pick.js';
import slotSchedule from './slot-schedule.js';
import trainingPick from './training-pick.js';
import activateTrainingPod from './activate-training-pod.js';
import runDuty from './run-duty.js';
import { LEAGUE_HIDDEN_ERROR, LEAGUE_HIDDEN_MESSAGE } from '../_utils/leagueHidden.js';

const ENTRY = [
  ['slot-claim', slotClaim, 'POST'],
  ['lobby-create', lobbyCreate, 'POST'],
  ['lobby-form', lobbyForm, 'POST'],
  ['lobby-join', lobbyJoin, 'POST'],
  ['lobby-matchmake', lobbyMatchmake, 'POST'],
  ['lobby-quickplay', lobbyQuickplay, 'POST'],
  ['lobby-quickplay-training', lobbyQuickplayTraining, 'POST'],
];
// In-week player actions and a read-only view: each must still reach the Bearer-token gate.
const IN_WEEK = [
  ['slot-release', slotRelease, 'POST'],
  ['live-draft-pick', liveDraftPick, 'POST'],
  ['slot-schedule', slotSchedule, 'GET'],
  ['training-pick', trainingPick, 'POST'],
];
// The internal in-week route: its first gate is the cron secret, so it answers 401 without touching requireAuth.
const INTERNAL = [['activate-training-pod', activateTrainingPod, 'POST']];
// An operator lever: it must still reach the admin-secret gate.
const OPERATOR = [['run-duty', runDuty, 'POST']];

function fakeRes() {
  return {
    code: null,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
const call = async (handler, method) => {
  const res = fakeRes();
  await handler({ method, headers: {}, body: {}, query: {} }, res);
  return res;
};

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  // A signed-in caller reaches a route's own logic, whose database here is `{}`: that logs its unhandled error, as expected.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  h.hide = false;
  h.lobbyOn = true;
  h.liveDraftOn = true;
  h.authCalls = 0;
  h.adminCalls = 0;
  h.dbCalls = 0;
  h.user = null;
});

describe('league hide, server — the flag ON closes the seven entry doors with one typed refusal', () => {
  for (const [name, handler, method] of ENTRY) {
    it(`${name}: 404 league_hidden, before auth and before the database`, async () => {
      h.hide = true;
      const res = await call(handler, method);
      expect(res.code).toBe(404);
      expect(res.body).toEqual({ error: LEAGUE_HIDDEN_ERROR, message: LEAGUE_HIDDEN_MESSAGE });
      expect(h.authCalls, 'the refusal must come before auth').toBe(0);
      expect(h.dbCalls, 'the refusal must come before any database handle').toBe(0);
    });
  }

  it('the refusal is ONE typed answer: the same status, key and words from all seven doors', async () => {
    h.hide = true;
    const answers = [];
    for (const [, handler, method] of ENTRY) {
      const res = await call(handler, method);
      answers.push(JSON.stringify([res.code, res.body]));
    }
    expect(new Set(answers).size).toBe(1);
    expect(LEAGUE_HIDDEN_ERROR).toBe('league_hidden');
    // The words are pinned as a literal too: the refusal is user-facing in a stale tab, and an empty message would pass a test
    // that compared the constant with itself.
    expect(LEAGUE_HIDDEN_MESSAGE).toBe('The league is not available right now.');
    // It is not the lobby's own "disabled" key and not the live draft's: a caller can tell the three apart.
    expect(LEAGUE_HIDDEN_ERROR).not.toBe('lobby_disabled');
    expect(LEAGUE_HIDDEN_ERROR).not.toBe('live_draft_disabled');
  });

  it('the method guard still comes first: the wrong verb on an entry door is a 405, not the refusal', async () => {
    h.hide = true;
    for (const [name, handler] of ENTRY) {
      const res = await call(handler, 'GET');
      expect(res.code, name).toBe(405);
      expect(res.body?.error, name).toBe('method_not_allowed');
    }
  });

  it('the hide answers FIRST: with the lobby and the live draft flags off too, every entry door still says league_hidden (not lobby_disabled / live_draft_disabled)', async () => {
    h.hide = true;
    h.lobbyOn = false;
    h.liveDraftOn = false;
    for (const [name, handler, method] of ENTRY) {
      const res = await call(handler, method);
      expect(res.body?.error, name).toBe(LEAGUE_HIDDEN_ERROR);
    }
    // The control: hide off, those flags off — the doors answer their own refusals, as before.
    h.hide = false;
    expect((await call(lobbyCreate, 'POST')).body?.error).toBe('lobby_disabled');
    expect((await call(slotClaim, 'POST')).body?.error).toBe('live_draft_disabled');
  });

  it('with a signed-in caller the refusal is the same (it never needs the caller)', async () => {
    h.hide = true;
    h.user = { uid: 'caller-1', name: 'Caller' };
    for (const [name, handler, method] of ENTRY) {
      const res = await call(handler, method);
      expect(res.body?.error, name).toBe(LEAGUE_HIDDEN_ERROR);
    }
    expect(h.authCalls).toBe(0);
  });
});

describe('league hide, server — everything else keeps answering with the flag ON', () => {
  for (const [name, handler, method] of IN_WEEK) {
    it(`${name} (in-week / read-only): still reaches its own auth gate, never the refusal`, async () => {
      h.hide = true;
      const res = await call(handler, method);
      expect(res.body?.error).not.toBe(LEAGUE_HIDDEN_ERROR);
      expect(res.code).toBe(401);
      expect(h.authCalls, 'it must reach requireAuth').toBe(1);
    });
  }

  it('with a SIGNED-IN caller the in-week and read-only routes still go past auth into their own logic (a refusal added after auth would show here)', async () => {
    h.hide = true;
    h.user = { uid: 'caller-1', name: 'Caller' };
    for (const [name, handler, method] of IN_WEEK) {
      const res = await call(handler, method);
      expect(res.body?.error, name).not.toBe(LEAGUE_HIDDEN_ERROR);
      expect(h.authCalls, name).toBeGreaterThan(0);
      h.authCalls = 0;
    }
  });

  for (const [name, handler, method] of INTERNAL) {
    it(`${name} (in-week, internal): still reaches the cron-secret gate, never the refusal`, async () => {
      h.hide = true;
      const res = await call(handler, method);
      expect(res.body?.error).not.toBe(LEAGUE_HIDDEN_ERROR);
      expect(res.code).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });
  }

  for (const [name, handler, method] of OPERATOR) {
    it(`${name} (operator): still reaches the admin-secret gate, never the refusal`, async () => {
      h.hide = true;
      const res = await call(handler, method);
      expect(res.body?.error).not.toBe(LEAGUE_HIDDEN_ERROR);
      expect(res.code).toBe(401);
      expect(h.adminCalls, 'it must reach requireAdminSecret').toBe(1);
    });
  }
});

describe('league hide, server — the flag OFF (as shipped): every door is as it was', () => {
  for (const [name, handler, method] of ENTRY) {
    it(`${name}: no refusal; the request reaches its own auth gate`, async () => {
      h.hide = false;
      const res = await call(handler, method);
      expect(res.body?.error).not.toBe(LEAGUE_HIDDEN_ERROR);
      expect(res.code).toBe(401);
      expect(h.authCalls).toBe(1);
    });
  }

  it('the flag is read at call time: turning it on after import closes the door, and off reopens it', async () => {
    h.hide = true;
    expect((await call(slotClaim, 'POST')).body?.error).toBe(LEAGUE_HIDDEN_ERROR);
    h.hide = false;
    expect((await call(slotClaim, 'POST')).body?.error).not.toBe(LEAGUE_HIDDEN_ERROR);
  });
});
