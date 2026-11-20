// scripts/beta-daily-readout.test.js
//
// The beta daily readout (scripts/beta-daily-readout.mjs; build prompt BUILD_PROMPT_COCKPIT_STAGED_SWITCH_ON_NOV20_2026,
// Parts B and E): every PAUSE and STOP rule on both sides of its line, the `no data` state of each (a null or a NaN is
// never read as `ok`), the default session against the market calendar, the read driven end to end through a fake
// Admin handle (no credential, no network) — a normal session, a session that trips every rule, a session with no
// battles and an empty one — that no id ever reaches the output, that the file is read-only, and the switch
// verification read at each control state. The script imports Firestore, the env loader, the allowlist and the sweep
// lazily inside main(), so these tests import nothing that reads a credential.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultSession, checkSession, windowSessions, isAgentReal, playersRead, summarize, evaluateRules, verdictOf, renderReadout, switchRead, renderSwitch,
  readControl, gatherReadout, gatherSwitch,
  PAUSE_COST_PER_BATTLE_DAY_USD, PAUSE_COST_PER_CHECK_USD, PAUSE_ANTHROPIC_INPUT_LEFT_SHARE, PAUSE_EODHD_UNITS, EODHD_INTRADAY_UNITS,
  STOP_TIMEOUT_RATE, STOP_TIMEOUT_MIN_CHECKS, TIMEOUT_WINDOW_SESSIONS, CHECK_SWEEP_LAG_MS, READ_AFTER_CLOSE_MS, SWITCH_KNOWN_SESSIONS,
} from './beta-daily-readout.mjs';
import { toMs } from './eval-capacity-read.mjs';
import { bucketOf, parseReleaseDocument, isInReleaseCohort } from '../api/_utils/callRecords/release.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIN = 60_000;

// ---------------------------------------------------------------- the thresholds

describe('the founder\'s thresholds (build prompt §3)', () => {
  it('are the table\'s numbers and the 20 Nov cockpit rulings', () => {
    expect(PAUSE_COST_PER_BATTLE_DAY_USD).toBe(0.65);
    expect(PAUSE_COST_PER_CHECK_USD).toBe(0.032);
    expect(PAUSE_ANTHROPIC_INPUT_LEFT_SHARE).toBe(0.2);
    expect(PAUSE_EODHD_UNITS).toBe(60_000);
    expect(EODHD_INTRADAY_UNITS).toBe(5);
    expect(STOP_TIMEOUT_RATE).toBe(0.02);
    expect(STOP_TIMEOUT_MIN_CHECKS).toBe(60);
    expect(TIMEOUT_WINDOW_SESSIONS).toBe(3);
    expect(CHECK_SWEEP_LAG_MS).toBe(30 * MIN);
    expect(READ_AFTER_CLOSE_MS).toBe(60 * MIN);
    expect(SWITCH_KNOWN_SESSIONS).toBe(10);
  });
});

// ---------------------------------------------------------------- the rules, on a summary that is ok everywhere

const BASE = () => ({
  session: '2026-11-19',
  players: { owners: 2, agentBattles: 2, peakBattlesInRun: 2 },
  cost: { modelChecks: 32, inputTokens: 550_000, outputTokens: 52_000, totalUsd: 0.81, battleDays: 2, perCheckUsd: 0.0253, perBattleDayUsd: 0.405, on: { checks: 32, usd: 0.81 }, off: { checks: 0, usd: 0 } },
  evaluator: { runs: 26, deferredRuns: 0, budgetSkippedRuns: 0, maxWallMs: 53_300, kSeen: [1], maxInFlight: 1 },
  anthropic: { runsWithBlocks: 26, requestsLimit: 10_000, inputTokensLimit: 10_000_000, outputTokensLimit: 2_000_000, minRequestsRemaining: 9_999, minInputTokensRemaining: 9_991_000, minOutputTokensRemaining: 1_999_000, responses429: 0 },
  eodhd: { requests: { eod: 1_098, realTime: 1_098, intraday: 182, other: 0 }, evaluatorUnits: 3_106, pollerUnits: 24_847, totalUnits: 27_953 },
  cockpit: {
    control: { status: 'ok', active: true, shareBp: 10_000, disabled: false }, cohortBattles: 1, cohortBasis: 'outside the allowlist',
    answers: { commands: 1, acknowledgments: 0, heard: 1, acted: 1, noMatchingTrade: 0 },
    on: { n: 16, timeout: 0, e400: 0, invalid: 0, other: 0 }, cohort: { n: 8, timeout: 0, e400: 0, invalid: 0, other: 0 }, off: { n: 4, timeout: 0, e400: 0, invalid: 0, other: 0 },
    window: { sessions: ['2026-11-17', '2026-11-18', '2026-11-19'], onChecks: 120, timeouts: 0 },
    sweep: { swept: 18, endedWithBattle: 0, medianMs: 0.7 * MIN, maxMs: 0.7 * MIN }, overdueQueueRows: 0,
  },
});
const S = (mutate = () => {}) => { const s = BASE(); mutate(s); return s; };
const status = (s, key) => evaluateRules(s).find((r) => r.key === key).status;

describe('evaluateRules — every rule on both sides of its line', () => {
  it('the base summary is ok on every line, and the verdict is ok', () => {
    const rules = evaluateRules(S());
    expect(rules.map((r) => r.key)).toEqual(['costPerBattleDay', 'costPerCheck', 'evaluator', 'anthropic', 'eodhd', 'cockpitTimeouts', 'cockpitInvalid', 'cockpit400', 'sweepLag']);
    expect(rules.map((r) => r.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    expect(verdictOf(rules)).toBe('ok');
  });

  it('cost per battle-day: PAUSE strictly above $0.65 — 0.649 and 0.65 are ok, 0.651 pauses', () => {
    expect(status(S((s) => { s.cost.perBattleDayUsd = 0.649; }), 'costPerBattleDay')).toBe('ok');
    expect(status(S((s) => { s.cost.perBattleDayUsd = 0.65; }), 'costPerBattleDay')).toBe('ok');
    expect(status(S((s) => { s.cost.perBattleDayUsd = 0.651; }), 'costPerBattleDay')).toBe('PAUSE');
  });
  it('cost per battle-day: no battle-day, or a NaN mean, is `no data` — never ok', () => {
    expect(status(S((s) => { s.cost.battleDays = 0; s.cost.perBattleDayUsd = null; }), 'costPerBattleDay')).toBe('no data');
    expect(status(S((s) => { s.cost.perBattleDayUsd = Number.NaN; }), 'costPerBattleDay')).toBe('no data');
  });

  it('cost per model check: PAUSE strictly above $0.032 — 0.0319 and 0.032 are ok, 0.0321 pauses', () => {
    expect(status(S((s) => { s.cost.perCheckUsd = 0.0319; }), 'costPerCheck')).toBe('ok');
    expect(status(S((s) => { s.cost.perCheckUsd = 0.032; }), 'costPerCheck')).toBe('ok');
    expect(status(S((s) => { s.cost.perCheckUsd = 0.0321; }), 'costPerCheck')).toBe('PAUSE');
  });
  it('cost per model check: no check, or a NaN, is `no data`', () => {
    expect(status(S((s) => { s.cost.modelChecks = 0; s.cost.perCheckUsd = null; }), 'costPerCheck')).toBe('no data');
    expect(status(S((s) => { s.cost.perCheckUsd = Number.NaN; }), 'costPerCheck')).toBe('no data');
  });

  it('evaluator capacity: one run with a deferred battle pauses, one with a budget-skipped battle pauses, none is ok', () => {
    expect(status(S((s) => { s.evaluator.deferredRuns = 1; }), 'evaluator')).toBe('PAUSE');
    expect(status(S((s) => { s.evaluator.budgetSkippedRuns = 1; }), 'evaluator')).toBe('PAUSE');
    expect(status(S(), 'evaluator')).toBe('ok');
    expect(evaluateRules(S((s) => { s.evaluator.deferredRuns = 2; })).find((r) => r.key === 'evaluator').reason).toContain('until K is raised');
  });
  it('evaluator capacity: no run record is `no data`', () => {
    expect(status(S((s) => { s.evaluator.runs = 0; }), 'evaluator')).toBe('no data');
  });

  it('Anthropic: a single 429 pauses; none is ok', () => {
    expect(status(S((s) => { s.anthropic.responses429 = 1; }), 'anthropic')).toBe('PAUSE');
    expect(status(S((s) => { s.anthropic.responses429 = 0; }), 'anthropic')).toBe('ok');
  });
  it('Anthropic: PAUSE strictly under 20 % of the input limit left — 2,000,001 and 2,000,000 of 10,000,000 are ok, 1,999,999 pauses', () => {
    expect(status(S((s) => { s.anthropic.minInputTokensRemaining = 2_000_001; }), 'anthropic')).toBe('ok');
    expect(status(S((s) => { s.anthropic.minInputTokensRemaining = 2_000_000; }), 'anthropic')).toBe('ok');
    expect(status(S((s) => { s.anthropic.minInputTokensRemaining = 1_999_999; }), 'anthropic')).toBe('PAUSE');
  });
  it('Anthropic: the 20 % line, not 15 or 25 — 17 % pauses, 24 % does not', () => {
    expect(status(S((s) => { s.anthropic.minInputTokensRemaining = 1_700_000; }), 'anthropic')).toBe('PAUSE');
    expect(status(S((s) => { s.anthropic.minInputTokensRemaining = 2_400_000; }), 'anthropic')).toBe('ok');
  });
  it('Anthropic: no limit, or no remaining, on record is `no data` (a null is never compared) — but a 429 still pauses', () => {
    expect(status(S((s) => { s.anthropic.inputTokensLimit = null; s.anthropic.minInputTokensRemaining = null; }), 'anthropic')).toBe('no data');
    expect(status(S((s) => { s.anthropic.minInputTokensRemaining = null; }), 'anthropic')).toBe('no data');
    expect(status(S((s) => { s.anthropic.inputTokensLimit = null; s.anthropic.responses429 = 3; }), 'anthropic')).toBe('PAUSE');
  });

  it('EODHD: PAUSE strictly above 60,000 units (evaluator + poller) — 59,999 and 60,000 are ok, 60,001 pauses', () => {
    const at = (poller) => status(S((s) => { s.eodhd.evaluatorUnits = 10_000; s.eodhd.pollerUnits = poller; }), 'eodhd');
    expect(at(49_999)).toBe('ok');
    expect(at(50_000)).toBe('ok');
    expect(at(50_001)).toBe('PAUSE');
  });
  it('EODHD: the 60,000 line, not 55,000 or 65,000', () => {
    const at = (poller) => status(S((s) => { s.eodhd.evaluatorUnits = 2_000; s.eodhd.pollerUnits = poller; }), 'eodhd');
    expect(at(55_000)).toBe('ok'); // 57,000
    expect(at(61_000)).toBe('PAUSE'); // 63,000
  });
  it('EODHD: a missing part is a gap (`no data`), never a zero — but a known part above the line already pauses', () => {
    expect(status(S((s) => { s.eodhd.pollerUnits = null; }), 'eodhd')).toBe('no data');
    expect(status(S((s) => { s.eodhd.evaluatorUnits = null; }), 'eodhd')).toBe('no data');
    expect(status(S((s) => { s.eodhd.pollerUnits = null; s.eodhd.evaluatorUnits = 60_001; }), 'eodhd')).toBe('PAUSE');
    expect(status(S((s) => { s.eodhd.evaluatorUnits = null; s.eodhd.pollerUnits = 60_001; }), 'eodhd')).toBe('PAUSE');
  });

  // The cockpit's lines (founder rulings of 20 Nov 2026 on Q-1 / Q-2): absolute limits, only for what the cockpit can cause.
  const W = (onChecks, timeouts) => (s) => { s.cockpit.window = { sessions: ['2026-11-17', '2026-11-18', '2026-11-19'], onChecks, timeouts }; };
  it('cockpit timeouts: STOP strictly above 2 % over the three sessions — 2 in 100 is ok, 3 in 100 stops (set disabled: true)', () => {
    expect(status(S(W(100, 2)), 'cockpitTimeouts')).toBe('ok');
    const r = evaluateRules(S(W(100, 3)));
    expect(r.find((x) => x.key === 'cockpitTimeouts').status).toBe('STOP');
    expect(r.find((x) => x.key === 'cockpitTimeouts').reason).toContain('set disabled: true — 3 timeout(s) in 100 `on` checks over the last 3 sessions');
    expect(verdictOf(r)).toBe('STOP');
  });
  it('cockpit timeouts: the 2 % line, not 1 % or 3 % — 3 in 150 is ok, 4 in 100 stops', () => {
    expect(status(S(W(150, 3)), 'cockpitTimeouts')).toBe('ok');
    expect(status(S(W(100, 4)), 'cockpitTimeouts')).toBe('STOP');
  });
  it('cockpit timeouts: STOP needs at least 60 `on` checks — 2 in 60 stops, 2 in 59 is CHECK with the counts', () => {
    expect(status(S(W(60, 2)), 'cockpitTimeouts')).toBe('STOP');
    const r = evaluateRules(S(W(59, 2))).find((x) => x.key === 'cockpitTimeouts');
    expect(r.status).toBe('CHECK');
    expect(r.reason).toContain('2 timeout(s) in 59 `on` checks over the last 3 sessions = 3.4 %');
    expect(status(S(W(50, 2)), 'cockpitTimeouts')).toBe('CHECK');
    expect(status(S(W(69, 2)), 'cockpitTimeouts')).toBe('STOP');
  });
  it('cockpit timeouts: under 60 checks at or below 2 % is ok; the window, not the session, is what counts', () => {
    expect(status(S(W(59, 1)), 'cockpitTimeouts')).toBe('ok');
    expect(status(S(W(32, 0)), 'cockpitTimeouts')).toBe('ok');
    expect(status(S((s) => { W(100, 3)(s); s.cockpit.on.timeout = 0; }), 'cockpitTimeouts')).toBe('STOP');
    expect(status(S((s) => { W(100, 0)(s); s.cockpit.on.timeout = 5; }), 'cockpitTimeouts')).toBe('ok');
  });
  it('cockpit timeouts: no `on` check in the window is `no data`', () => {
    expect(status(S(W(0, 0)), 'cockpitTimeouts')).toBe('no data');
  });
  it('invalid_tool_result: CHECK, never STOP — even every check failing', () => {
    expect(status(S((s) => { s.cockpit.on.invalid = 1; }), 'cockpitInvalid')).toBe('CHECK');
    const all = evaluateRules(S((s) => { s.cockpit.on.invalid = 16; }));
    expect(all.find((x) => x.key === 'cockpitInvalid').status).toBe('CHECK');
    expect(verdictOf(all)).toBe('CHECK');
    expect(all.find((x) => x.key === 'cockpitInvalid').reason).toContain('16 in 16 `on` checks this session (100.0 %); not caused by the cockpit');
    expect(status(S(), 'cockpitInvalid')).toBe('ok');
    expect(status(S((s) => { s.cockpit.on.n = 0; }), 'cockpitInvalid')).toBe('no data');
  });
  it('400s: CHECK, never STOP; none is ok; no `on` check is `no data`', () => {
    const r = evaluateRules(S((s) => { s.cockpit.on.e400 = 1; })).find((x) => x.key === 'cockpit400');
    expect(r.status).toBe('CHECK');
    expect(r.reason).toContain('often account-level');
    expect(status(S((s) => { s.cockpit.on.e400 = 16; }), 'cockpit400')).toBe('CHECK');
    expect(status(S(), 'cockpit400')).toBe('ok');
    expect(status(S((s) => { s.cockpit.on.n = 0; }), 'cockpit400')).toBe('no data');
  });
  it('the `off` arm and the `other` class no longer drive any line', () => {
    const r = evaluateRules(S((s) => { s.cockpit.off = { n: 0, timeout: 0, e400: 0, invalid: 0, other: 0 }; s.cockpit.on.other = 9; }));
    expect(r.map((x) => x.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  });
  it('sweep lag: CHECK (never STOP) strictly past 30 min — 29.9 and 30 are ok, 30 min + 1 ms is CHECK', () => {
    expect(status(S((s) => { s.cockpit.sweep.maxMs = 29.9 * MIN; }), 'sweepLag')).toBe('ok');
    expect(status(S((s) => { s.cockpit.sweep.maxMs = 30 * MIN; }), 'sweepLag')).toBe('ok');
    const r = evaluateRules(S((s) => { s.cockpit.sweep.maxMs = 30 * MIN + 1; }));
    expect(r.find((x) => x.key === 'sweepLag').status).toBe('CHECK');
    expect(verdictOf(r)).toBe('CHECK');
    expect(status(S((s) => { s.cockpit.sweep.maxMs = 240 * MIN; }), 'sweepLag')).toBe('CHECK');
  });
  it('sweep lag: the 30-minute line, not 15 or 45 — 20 min is ok, 40 min is CHECK', () => {
    expect(status(S((s) => { s.cockpit.sweep.maxMs = 20 * MIN; }), 'sweepLag')).toBe('ok');
    expect(status(S((s) => { s.cockpit.sweep.maxMs = 40 * MIN; }), 'sweepLag')).toBe('CHECK');
  });
  it('sweep lag: no swept call, or a missing lag, is `no data`', () => {
    expect(status(S((s) => { s.cockpit.sweep.swept = 0; s.cockpit.sweep.maxMs = null; }), 'sweepLag')).toBe('no data');
    expect(status(S((s) => { s.cockpit.sweep.maxMs = null; }), 'sweepLag')).toBe('no data');
  });
});

describe('verdictOf', () => {
  const r = (...st) => st.map((status, i) => ({ key: `k${i}`, label: '', status, reason: '' }));
  it('STOP over PAUSE over CHECK over ok; `no data` only when every line has none', () => {
    expect(verdictOf(r('ok', 'PAUSE', 'STOP'))).toBe('STOP');
    expect(verdictOf(r('STOP', 'PAUSE', 'ok'))).toBe('STOP');
    expect(verdictOf(r('ok', 'CHECK', 'PAUSE'))).toBe('PAUSE');
    expect(verdictOf(r('ok', 'CHECK', 'no data'))).toBe('CHECK');
    expect(verdictOf(r('no data', 'no data'))).toBe('no data');
    expect(verdictOf(r('ok', 'no data'))).toBe('ok');
  });
});

// ---------------------------------------------------------------- the session

describe('defaultSession — the market calendar, an hour after the close', () => {
  // Late November 2026 is EST (UTC−5): a 4 PM close is 21:00Z, the early close (1 PM) 18:00Z.
  it('a regular day counts from 5 PM ET: 4:59:59.999 PM Monday reads Friday, 5 PM reads Monday', () => {
    expect(defaultSession(Date.parse('2026-11-23T21:59:59.999Z'))).toBe('2026-11-20');
    expect(defaultSession(Date.parse('2026-11-23T22:00:00.000Z'))).toBe('2026-11-23');
    expect(defaultSession(Date.parse('2026-11-23T21:30:00.000Z'))).toBe('2026-11-20'); // 4:30 PM: the last run has not finished
    expect(defaultSession(Date.parse('2026-11-23T14:00:00.000Z'))).toBe('2026-11-20'); // before the open
  });
  it('Thanksgiving is skipped: Thursday evening reads Wednesday', () => {
    expect(defaultSession(Date.parse('2026-11-26T23:00:00.000Z'))).toBe('2026-11-25');
  });
  it('the early close counts from 2 PM ET the day after Thanksgiving', () => {
    expect(defaultSession(Date.parse('2026-11-27T18:59:00.000Z'))).toBe('2026-11-25');
    expect(defaultSession(Date.parse('2026-11-27T19:00:00.000Z'))).toBe('2026-11-27');
  });
  it('a weekend reads Friday', () => {
    expect(defaultSession(Date.parse('2026-11-21T15:00:00.000Z'))).toBe('2026-11-20');
    expect(defaultSession(Date.parse('2026-11-22T23:00:00.000Z'))).toBe('2026-11-20');
  });
  it('the timeout window is the session and the two trading sessions before it, holidays skipped', () => {
    expect(windowSessions('2026-11-19')).toEqual(['2026-11-17', '2026-11-18', '2026-11-19']);
    expect(windowSessions('2026-11-23')).toEqual(['2026-11-19', '2026-11-20', '2026-11-23']);
    expect(windowSessions('2026-11-27')).toEqual(['2026-11-24', '2026-11-25', '2026-11-27']);
  });
  it('--session must be a trading session the calendar covers', () => {
    expect(checkSession('2026-11-19')).toBe('2026-11-19');
    expect(() => checkSession('2026-11-26')).toThrow(/closed/);
    expect(() => checkSession('2026-11-21')).toThrow(/closed/);
    expect(() => checkSession('2025-11-19')).toThrow(/not a date the market calendar covers/);
    expect(() => checkSession('Nov 19')).toThrow(/not a date the market calendar covers/);
  });
});

describe('players', () => {
  it('a real agent-mode battle: not a CPU seat by flag or by owner id, a non-empty owner', () => {
    expect(isAgentReal({ gameMode: 'baggerbomb_agent', ownerId: 'u1' })).toBe(true);
    expect(isAgentReal({ gameMode: 'baggerbomb_agent', ownerId: 'u1', isCpu: true })).toBe(false);
    expect(isAgentReal({ gameMode: 'baggerbomb_agent', ownerId: 'cpu-3' })).toBe(false);
    expect(isAgentReal({ gameMode: 'baggerbomb_agent', ownerId: '' })).toBe(false);
    expect(isAgentReal({ gameMode: 'baggerbomb_tournament', ownerId: 'u1' })).toBe(false);
  });
  it('counts the session\'s battles and distinct owners only (another session\'s battle is not counted); returns no id', () => {
    const r = playersRead([
      { gameMode: 'baggerbomb_agent', ownerId: 'zzA', expiresAt: '2026-11-19T21:00:00.000Z' },
      { gameMode: 'baggerbomb_agent', ownerId: 'zzA', expiresAt: '2026-11-20T01:00:00.000Z' }, // a night game: 8 PM ET the same day
      { gameMode: 'baggerbomb_agent', ownerId: 'zzB', expiresAt: '2026-11-19T21:00:00.000Z' },
      { gameMode: 'baggerbomb_agent', ownerId: 'zzC', expiresAt: '2026-11-18T21:00:00.000Z' },
      { gameMode: 'baggerbomb_agent', ownerId: 'cpu-2', expiresAt: '2026-11-19T21:00:00.000Z' },
    ], '2026-11-19');
    expect(r).toEqual({ agentBattles: 3, owners: 2 });
  });
});

// ---------------------------------------------------------------- end to end, through a fake Admin handle

const D = '2026-11-19';
const CLOSE = '2026-11-19T21:00:00.000Z';
const at = (hhmm) => `2026-11-19T${hhmm}:00.000Z`;
const PILOT = 'zzOWNpilotA1';
const COHORT_OWNER = 'zzOWNcohortB2';
const LEAGUE_OWNER = 'zzOWNleagueC3';
const ELSE_OWNER = 'zzOWNelseD4';
const IDS = [PILOT, COHORT_OWNER, LEAGUE_OWNER, ELSE_OWNER, 'cpu-7', 'zzBATpilot', 'zzBATcohort', 'zzBATcohort2', 'zzBATleague', 'zzBATcpu', 'zzBATelse',
  'zzAGTpilot', 'zzAGTcohort', 'zzAGTleague', 'zzCALL1', 'zzEVAL'];
const CONTROL_DOC = { shareBp: 10_000, disabled: false, salt: 'beta-1' };

const mtick = (hhmm, { v = 2, inputTokens, outputTokens, outcome = 'ok', failureClass = null, evalId = 'zzEVAL-1' }) => ({
  schemaVersion: v, capturedAt: at(hhmm), evalId, exitReason: 'completed', universeSize: 31,
  model: { dispatched: true, outcome, failureClass }, callEnvelope: { inputTokens, outputTokens, callMs: 17_600 },
});
const quiet = (hhmm) => ({ schemaVersion: 2, capturedAt: at(hhmm), evalId: 'zzEVAL-q', exitReason: 'no_trigger', model: { dispatched: false } });

const run = (hhmm, { battlesTotal, evaluated, modelCalls, wallMs, deferredBattleIds = [], budgetSkipped = 0, requests, anthropic = {} }) => ({
  startedAt: at(hhmm), battlesTotal, evaluated, triggered: modelCalls, modelCalls, wallMs, budgetSkipped, deferredBattleIds, deferred: deferredBattleIds.length, lockSkipped: 0, dormant: 0,
  pool: { k: 1, startCutoffMs: 290_000, maxInFlight: 1, dispatched: evaluated },
  anthropic: { requestsLimit: 10_000, inputTokensLimit: 10_000_000, outputTokensLimit: 2_000_000, minRequestsRemaining: 9_997, minInputTokensRemaining: 9_950_000, minOutputTokensRemaining: 1_990_000, responses429: 0, ...anthropic },
  eodhd: { requests, timeouts: null, non2xx: {} },
});

/** The session's records. `trips` turns on a failure, a deferral and a budget skip, a 429, a late sweep and a heavy poller. */
function fixture({ trips = false } = {}) {
  const battles = [
    ['zzBATpilot', { ownerId: PILOT, agentId: 'zzAGTpilot', gameMode: 'baggerbomb_agent', status: 'completed', expiresAt: CLOSE }],
    ['zzBATcohort', { ownerId: COHORT_OWNER, agentId: 'zzAGTcohort', gameMode: 'baggerbomb_agent', status: 'completed', expiresAt: CLOSE }],
    ['zzBATcohort2', { ownerId: COHORT_OWNER, agentId: 'zzAGTcohort', gameMode: 'baggerbomb_agent', status: 'completed', expiresAt: CLOSE }],
    ['zzBATleague', { ownerId: LEAGUE_OWNER, agentId: 'zzAGTleague', gameMode: 'baggerbomb_tournament', status: 'completed', expiresAt: CLOSE }],
    ['zzBATcpu', { ownerId: 'cpu-7', gameMode: 'baggerbomb_tournament', isCpu: true, status: 'completed', expiresAt: CLOSE }],
    ['zzBATelse', { ownerId: ELSE_OWNER, gameMode: 'baggerbomb_agent', status: 'completed', expiresAt: '2026-11-18T21:00:00.000Z' }],
  ];
  const ticks = {
    zzBATpilot: [mtick('15:00', { inputTokens: 17_197, outputTokens: 1_674 }), mtick('15:15', { inputTokens: 17_854, outputTokens: 1_950, ...(trips ? { outcome: 'failed', failureClass: '400' } : {}) }), mtick('15:30', { inputTokens: 16_420, outputTokens: 1_500 }), quiet('15:45'),
      // Two sessions back (Nov 17): in the timeout window, never in the session's cost.
      ...(trips ? Array.from({ length: 60 }, (_, i) => ({ ...mtick('15:00', { inputTokens: 1, outputTokens: 1, ...(i < 2 ? { outcome: 'failed', failureClass: 'timeout' } : {}) }), capturedAt: '2026-11-17T15:00:00.000Z' })) : [])],
    zzBATcohort: [mtick('15:00', { inputTokens: 16_003, outputTokens: 2_091, ...(trips ? { outcome: 'failed', failureClass: 'invalid_tool_result' } : {}) })],
    zzBATcohort2: [quiet('15:15')],
    zzBATleague: [mtick('15:00', { v: 1, inputTokens: 9_001, outputTokens: 777 })],
    zzBATelse: [{ ...mtick('15:00', { inputTokens: 1, outputTokens: 1 }), capturedAt: '2026-11-18T15:00:00.000Z' }], // another session: never counted
  };
  const calls = { zzBATcohort: [{ callId: 'zzCALL1', playerResponse: { kind: 'directive' }, stateSource: 'sweep', state: 'expired_unresolved', horizon: { expiresAt: at('16:00') }, stateChangedAt: trips ? at('16:31') : '2026-11-19T16:00:42.000Z' }] };
  const events = { zzBATcohort: [{ kind: 'answered', at: at('15:05'), callIds: ['zzCALL1'] }, { kind: 'heard', at: at('15:15') }, { kind: 'acted', at: at('15:15') }] };
  const runs = [
    run('15:00', { battlesTotal: 4, evaluated: 4, modelCalls: 2, wallMs: 61_234, requests: { eod: 300, realTime: 310, intraday: 41, other: 2 } }),
    run('15:15', { battlesTotal: 5, evaluated: 3, modelCalls: 2, wallMs: 48_765, requests: { eod: 290, realTime: 300, intraday: 39, other: 0 },
      ...(trips ? { deferredBattleIds: ['zzBATcohort2'], budgetSkipped: 1, anthropic: { responses429: 2 } } : { anthropic: { minInputTokensRemaining: 9_960_000 } }) }),
  ];
  return { battles, ticks, calls, events, runs, budget: { [D]: { unitsRequested: trips ? 70_000 : 24_847, sweeps: 420 } }, control: CONTROL_DOC };
}

/** A fake Admin handle: queries record what they were asked and answer from the fixtures. It has no write method at all. */
function fakeDb({ battles = [], ticks = {}, calls = {}, events = {}, runs = [], budget = {}, control, queue = [] } = {}) {
  const log = [];
  const snap = (pairs) => ({ docs: pairs.map(([id, data]) => ({ id, data: () => data })) });
  const query = (path, pairs) => {
    const q = {
      wheres: [], mask: null,
      where(f, op, v) { q.wheres.push([f, op, v]); return q; },
      select(...f) { q.mask = f; return q; },
      orderBy() { return q; },
      async get() { log.push({ path, wheres: q.wheres, mask: q.mask }); return snap(pairs); },
    };
    return q;
  };
  const sub = (id, name) => {
    const src = { ticks, calls, callEvents: events }[name] || {};
    return query(`agentBattles/${id}/${name}`, (src[id] || []).map((d, i) => [`${name}${i}`, d]));
  };
  return {
    log,
    collection(name) {
      if (name === 'agentBattles') { const q = query(name, battles); q.doc = (id) => ({ collection: (s) => sub(id, s) }); return q; }
      if (name === 'agentEvalRuns') return query(name, runs.map((r, i) => [`run${i}`, r]));
      if (name === 'callSweepQueue') return query(name, queue.map((r, i) => [`q${i}`, r]));
      if (name === 'intradayBudget') { const q = query(name, []); q.doc = (id) => ({ budgetDay: id }); return q; }
      if (name === 'cockpitConfig') {
        const q = query(name, []);
        q.doc = (id) => ({ async get() { log.push({ path: `${name}/${id}` }); return control === undefined ? { exists: false, data: () => undefined } : { exists: true, data: () => control }; } });
        return q;
      }
      return query(name, []);
    },
    async getAll(...refs) { log.push({ path: 'getAll', days: refs.map((r) => r.budgetDay) }); return refs.map((r) => (budget[r.budgetDay] ? { exists: true, data: () => budget[r.budgetDay] } : { exists: false, data: () => undefined })); },
  };
}

const readoutOf = (fx, extra = {}) => gatherReadout(fakeDb(fx), {
  session: D, readAtMs: Date.parse('2026-11-19T22:30:00Z'), allowlistList: [PILOT, LEAGUE_OWNER], deadlineOf: (c) => toMs(c?.horizon?.expiresAt), ...extra,
});

describe('gatherReadout — a normal session through a fake handle', () => {
  it('the block\'s numbers: players, cost and its split, evaluator, limits, EODHD units, cockpit', async () => {
    const read = await readoutOf(fixture());
    const s = read.summary;
    expect(s.players).toEqual({ owners: 2, agentBattles: 3, peakBattlesInRun: 5 });
    // tokens: on 17,197 + 17,854 + 16,420 + 16,003 = 67,474 in, 1,674 + 1,950 + 1,500 + 2,091 = 7,215 out; off 9,001 / 777.
    expect(s.cost.modelChecks).toBe(5);
    expect(s.cost.inputTokens).toBe(76_475);
    expect(s.cost.outputTokens).toBe(7_992);
    expect(s.cost.totalUsd).toBeCloseTo(0.116435, 12);
    expect(s.cost.battleDays).toBe(4); // the pilot, both cohort battles (one never called the model) and the League battle — not the CPU seat
    expect(s.cost.perCheckUsd).toBeCloseTo(0.116435 / 5, 12);
    expect(s.cost.perBattleDayUsd).toBeCloseTo(0.116435 / 4, 12);
    expect(s.cost.on.checks).toBe(4);
    expect(s.cost.on.usd).toBeCloseTo(0.103549, 12);
    expect(s.cost.off.checks).toBe(1);
    expect(s.cost.off.usd).toBeCloseTo(0.012886, 12);
    expect(s.evaluator).toEqual({ runs: 2, deferredRuns: 0, budgetSkippedRuns: 0, maxWallMs: 61_234, kSeen: [1], maxInFlight: 1 });
    expect(s.anthropic).toMatchObject({ runsWithBlocks: 2, inputTokensLimit: 10_000_000, minInputTokensRemaining: 9_950_000, minRequestsRemaining: 9_997, responses429: 0 });
    // units: end-of-day 590 + real-time 610 + 5 × intraday 80 = 1,600; `other` (2) is not counted.
    expect(s.eodhd).toMatchObject({ evaluatorUnits: 1_600, pollerUnits: 24_847, totalUnits: 26_447 });
    expect(s.cockpit.control).toEqual({ status: 'ok', active: true, shareBp: 10_000, disabled: false });
    expect(s.cockpit.cohortBattles).toBe(1); // the cohort battle with an `on` check; the pilot is allowlisted
    expect(s.cockpit.cohortBasis).toBe('outside the allowlist');
    expect(s.cockpit.answers).toMatchObject({ commands: 1, heard: 1, acted: 1 });
    expect(s.cockpit.sweep.maxMs).toBe(42_000);
    // The window holds the session's 4 `on` checks and the other battle's Nov 18 check (outside the session, inside the window).
    expect(s.cockpit.window).toEqual({ sessions: ['2026-11-17', '2026-11-18', '2026-11-19'], onChecks: 5, timeouts: 0 });
    expect(read.rules.map((r) => r.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    expect(read.verdict).toBe('ok');
  });

  it('the block reads in plain words and ends in the rule lines; --detail adds the two reads\' own tables', async () => {
    const read = await readoutOf(fixture());
    const text = renderReadout(read);
    expect(text).toContain('## Beta daily readout — Thu 2026-11-19 (ET)');
    expect(text).toContain('**ok — every line is ok or has no data; you may invite more players.**');
    expect(text).toContain('- Players with an agent-mode battle: 2');
    expect(text).toContain('- Cost per battle-day: $0.0291 (4 battle-days)');
    expect(text).toContain('- Cockpit split: `on` 4 checks, $0.10 · `off` 1 checks, $0.0129');
    expect(text).toContain("The Anthropic Console's usage page holds the account-wide total");
    expect(text).toContain('- Evaluator: 1,600 units (590 end-of-day, 610 real-time, 80 intraday, 2 other, not counted requests)');
    expect(text).toContain('The app-wide total is on the EODHD dashboard');
    expect(text).toContain('- Switch (cockpitConfig/release, as read now): ok · shareBp 10000 · disabled false');
    expect(text).toContain('- Cost per battle-day: ok ($0.0291; pauses above $0.65)');
    expect(text).not.toContain('### Detail');
    const detail = renderReadout(read, { detail: true });
    expect(detail).toContain('## Cockpit release stage read');
    expect(detail).toContain('### L. The limits on record');
  });

  it('what it asks for: the control document, the session window, a masked battle read; the tallies\' own reads unchanged', async () => {
    const db = fakeDb(fixture());
    await gatherReadout(db, { session: D, readAtMs: Date.parse('2026-11-19T22:30:00Z'), allowlistList: [PILOT], deadlineOf: () => null });
    expect(db.log[0]).toEqual({ path: 'cockpitConfig/release' });
    const own = db.log.filter((e) => e.path === 'agentBattles' && JSON.stringify(e.mask) === JSON.stringify(['ownerId', 'gameMode', 'isCpu', 'status', 'expiresAt']));
    // gatherStage's battle read and the readout's own share the mask; the readout's is the last battle query.
    expect(own.at(-1)).toEqual({ path: 'agentBattles', wheres: [['expiresAt', '>=', '2026-11-18T00:00:00.000Z'], ['expiresAt', '<=', '2026-11-21T00:00:00.000Z']], mask: ['ownerId', 'gameMode', 'isCpu', 'status', 'expiresAt'] });
    expect(db.log.filter((e) => e.path === 'getAll')).toEqual([{ path: 'getAll', days: [D] }]);
    // The stage read covers the three-session timeout window (Nov 17 → 19): its run read starts a day before Nov 17.
    expect(db.log.filter((e) => e.path === 'agentEvalRuns').map((e) => e.wheres[0][2])).toContain('2026-11-16T00:00:00.000Z');
  });

  it('a disabled switch is read as disabled, and the block says so', async () => {
    const read = await readoutOf({ ...fixture(), control: { shareBp: 10_000, disabled: true, salt: 'beta-1' } });
    expect(read.summary.cockpit.control).toEqual({ status: 'disabled', active: false, shareBp: 10_000, disabled: true });
    const absent = await readoutOf({ ...fixture(), control: undefined });
    expect(absent.summary.cockpit.control).toEqual({ status: 'absent', active: false, shareBp: null, disabled: null });
    expect(renderReadout(absent)).toContain('absent — the two pilot accounts only');
  });
});

describe('gatherReadout — a session that trips every rule', () => {
  it('the evaluator, Anthropic and EODHD pause; timeouts over the window STOP; invalid_tool_result, a 400 and a late sweep are CHECK; the verdict is STOP', async () => {
    const read = await readoutOf(fixture({ trips: true }));
    const by = Object.fromEntries(read.rules.map((r) => [r.key, r]));
    expect(by.costPerBattleDay.status).toBe('ok');
    expect(by.costPerCheck.status).toBe('ok');
    expect(by.evaluator.status).toBe('PAUSE');
    expect(by.anthropic.status).toBe('PAUSE');
    expect(by.eodhd.status).toBe('PAUSE');
    expect(read.summary.cockpit.window).toEqual({ sessions: ['2026-11-17', '2026-11-18', '2026-11-19'], onChecks: 65, timeouts: 2 });
    expect(read.summary.cost.modelChecks).toBe(5); // the Nov 17 checks are in the window, never in the session's cost
    expect(by.cockpitTimeouts.status).toBe('STOP');
    expect(by.cockpitTimeouts.reason).toContain('set disabled: true — 2 timeout(s) in 65 `on` checks over the last 3 sessions = 3.1 %');
    expect(by.cockpitInvalid.status).toBe('CHECK');
    expect(by.cockpit400.status).toBe('CHECK');
    expect(by.sweepLag.status).toBe('CHECK');
    expect(by.sweepLag.reason).toContain('31.0 min, past 30.0 min');
    expect(read.verdict).toBe('STOP');
    expect(renderReadout(read)).toContain('**STOP — set `disabled: true` in cockpitConfig/release now (save this readout first).**');
    expect(renderReadout(read)).toContain('- Evaluator capacity: PAUSE: 1 run(s) deferred a battle and 1 budget-skipped one');
  });
});

describe('no id ever reaches the output', () => {
  it('the block, the detail and the --json object carry no owner, battle, agent, CPU, call or eval id', async () => {
    for (const fx of [fixture(), fixture({ trips: true })]) {
      const read = await readoutOf(fx);
      const out = renderReadout(read, { detail: true }) + JSON.stringify(read);
      for (const id of IDS) expect(out, id).not.toContain(id);
    }
  });
  it('the switch read and its --json carry none either', async () => {
    const db = fakeDb({ battles: fixture().battles.map(([id, b]) => [id, { ...b, status: 'active', expiresAt: '2026-11-23T21:00:00.000Z' }]), control: CONTROL_DOC });
    const read = await gatherSwitch(db, { nowMs: Date.parse('2026-11-23T13:00:00Z'), allowlistList: [PILOT, LEAGUE_OWNER] });
    const out = renderSwitch(read) + JSON.stringify(read);
    for (const id of IDS) expect(out, id).not.toContain(id);
  });
});

describe('gatherReadout — a session with no battles, and an empty one', () => {
  const quietRun = (hhmm) => ({ startedAt: at(hhmm), battlesTotal: 0, evaluated: 0, modelCalls: 0, wallMs: 700, budgetSkipped: 0, deferred: 0, pool: { k: 1, maxInFlight: 0, dispatched: 0 }, anthropic: { requestsLimit: null, inputTokensLimit: null, outputTokensLimit: null, minRequestsRemaining: null, minInputTokensRemaining: null, minOutputTokensRemaining: null, responses429: 0 }, eodhd: { requests: { eod: 0, realTime: 0, intraday: 0, other: 0 }, timeouts: null, non2xx: {} } });

  it('no battles, the runs and the poller present: costs and the cockpit have no data, the evaluator and EODHD are ok', async () => {
    const read = await readoutOf({ runs: [quietRun('15:00'), quietRun('15:15')], budget: { [D]: { unitsRequested: 20_541 } }, control: CONTROL_DOC });
    const by = Object.fromEntries(read.rules.map((r) => [r.key, r.status]));
    expect(by).toEqual({ costPerBattleDay: 'no data', costPerCheck: 'no data', evaluator: 'ok', anthropic: 'no data', eodhd: 'ok', cockpitTimeouts: 'no data', cockpitInvalid: 'no data', cockpit400: 'no data', sweepLag: 'no data' });
    expect(read.summary.players).toEqual({ owners: 0, agentBattles: 0, peakBattlesInRun: 0 });
    expect(read.summary.eodhd).toMatchObject({ evaluatorUnits: 0, pollerUnits: 20_541, totalUnits: 20_541 });
    const text = renderReadout(read, { detail: true });
    expect(text).toContain('- Cost per model check: —');
    expect(text).toContain('- No model call reported the limits this session.');
    expect(text).toContain('- Cost per battle-day: no data (no battle was checked this session)');
  });

  it('no run record (a ledger only): the evaluator is `no data` and EODHD is a gap, not a zero', async () => {
    const read = await readoutOf({ budget: { [D]: { unitsRequested: 20_541 } } });
    const by = Object.fromEntries(read.rules.map((r) => [r.key, r.status]));
    expect(by.evaluator).toBe('no data');
    expect(by.eodhd).toBe('no data');
    expect(read.summary.eodhd.evaluatorUnits).toBeNull();
  });

  it('nothing at all: every line is `no data`, the verdict is `no data`, and the block still prints', async () => {
    const read = await readoutOf({});
    expect(read.rules.map((r) => r.status)).toEqual(Array(9).fill('no data'));
    expect(read.verdict).toBe('no data');
    expect(renderReadout(read, { detail: true })).toContain('**no data — the session holds nothing to judge');
  });
});

// ---------------------------------------------------------------- the switch verification read (Part E)

describe('switchRead — the cohort test on today\'s and upcoming battles', () => {
  const NOW = Date.parse('2026-11-23T13:00:00Z'); // Monday, 8 AM ET, before the open
  const MON = '2026-11-23T21:00:00.000Z';
  const SALT = 'beta-1';
  const taken = new Set();
  const owner = (pred) => { for (let i = 0; i < 100_000; i += 1) { const id = `zzown-${i}`; if (!taken.has(id) && pred(bucketOf(id, SALT))) { taken.add(id); return id; } } throw new Error('no owner'); };
  const UNDER = owner((x) => x < 5_000);
  const OVER = owner((x) => x >= 5_000);
  const STALE = owner((x) => x < 5_000);
  const OLD = owner((x) => x >= 5_000);
  const B = (o, extra = {}) => ({ gameMode: 'baggerbomb_agent', ownerId: o, status: 'active', expiresAt: MON, ...extra });
  const BATTLES = [
    B(PILOT),
    B(UNDER),
    B(OVER),
    B(STALE, { expiresAt: '2026-11-20T21:00:00.000Z' }), // a Friday battle still marked active: the evaluator still checks it
    B(LEAGUE_OWNER, { gameMode: 'baggerbomb_tournament', expiresAt: '2026-11-27T21:00:00.000Z' }),
    B('cpu-3', { gameMode: 'baggerbomb_tournament', isCpu: true }),
    B(ELSE_OWNER, { gameMode: 'snake_draft' }),
    B(UNDER, { status: 'cancelled' }),
    B(OLD, { status: 'completed', expiresAt: '2026-11-18T21:00:00.000Z' }), // not live: a known owner only
  ];
  const ALLOW = [PILOT, LEAGUE_OWNER];
  const view = (doc) => parseReleaseDocument(doc, NOW);
  const read = (doc, extra = {}) => switchRead({ battles: BATTLES, view: view(doc), allowlist: ALLOW, nowMs: NOW, ...extra });

  it('no control document: nothing is in the cohort; every real agent-mode battle is out because the switch is not active', () => {
    const r = read(null);
    expect(r).toMatchObject({ live: 8, inCohort: 0, agentRealActive: 4, viaAllowlistOnly: 2, knownOwners: 5, knownOwnersIn: 0, knownExpected: 0, asExpected: true, nothingToTest: false });
    expect(r.reasons).toEqual({ notActive: 1, league: 1, cpu: 1, otherMode: 1, switchOff: 4, overShare: 0 });
    expect(r.expected.cohort).toBe(0);
  });
  it('shareBp 0: nothing is in the cohort; the real agent-mode battles are over the share', () => {
    const r = read({ shareBp: 0, disabled: false, salt: SALT });
    expect(r).toMatchObject({ inCohort: 0, asExpected: true });
    expect(r.reasons).toMatchObject({ switchOff: 0, overShare: 4 });
  });
  it('shareBp 10000: every active real agent-mode battle is in (the pilot\'s too, counted apart); League, CPU, other mode and not-active are out', () => {
    const r = read({ shareBp: 10_000, disabled: false, salt: SALT });
    expect(r).toMatchObject({ inCohort: 4, inCohortAllowlisted: 1, viaAllowlistOnly: 1, knownOwnersIn: 5, knownExpected: 5, asExpected: true });
    expect(r.expected.cohort).toBe(4);
    expect(r.reasons).toEqual({ notActive: 1, league: 1, cpu: 1, otherMode: 1, switchOff: 0, overShare: 0 });
    expect(renderSwitch({ readAtMs: NOW, control: { view: view({ shareBp: 10_000, disabled: false, salt: SALT }), disabled: false }, battlesRead: BATTLES.length, window: { from: 'a', to: 'b', knownFrom: '2026-11-09' }, result: r }))
      .toContain('- Result: **as expected**.');
  });
  it('disabled: nothing is in the cohort, whatever the share', () => {
    const r = read({ shareBp: 10_000, disabled: true, salt: SALT });
    expect(r).toMatchObject({ inCohort: 0, knownOwnersIn: 0, asExpected: true });
    expect(r.reasons.switchOff).toBe(4);
  });
  it('a partial share admits by the owner\'s bucket and has no fixed expectation', () => {
    const r = read({ shareBp: 5_000, disabled: false, salt: SALT });
    expect(r.inCohort).toBe(2 + (bucketOf(PILOT, SALT) < 5_000 ? 1 : 0)); // UNDER and STALE, and the pilot by its own bucket
    expect(r.expected.cohort).toBeNull();
    expect(r.asExpected).toBeNull();
  });
  it('a cohort test that disagrees with the expectation reads NOT AS EXPECTED', () => {
    const r = read({ shareBp: 10_000, disabled: false, salt: SALT }, { isInCohort: (b, v) => b.ownerId !== UNDER && isInReleaseCohort(b, v) });
    expect(r.asExpected).toBe(false);
    const text = renderSwitch({ readAtMs: NOW, control: { view: view({ shareBp: 10_000, disabled: false, salt: SALT }), disabled: false }, battlesRead: 9, window: { from: 'a', to: 'b', knownFrom: 'c' }, result: r });
    expect(text).toContain('**NOT AS EXPECTED**');
  });
  it('no live agent-mode battle yet: "nothing to test yet", and the known owners carry the check', () => {
    const r = switchRead({ battles: [BATTLES.at(-1)], view: view({ shareBp: 10_000, disabled: false, salt: SALT }), allowlist: ALLOW, nowMs: NOW });
    expect(r).toMatchObject({ live: 0, nothingToTest: true, knownOwners: 1, knownOwnersIn: 1, asExpected: true });
    const text = renderSwitch({ readAtMs: NOW, control: { view: view({ shareBp: 10_000, disabled: false, salt: SALT }), disabled: false }, battlesRead: 1, window: { from: 'a', to: 'b', knownFrom: 'c' }, result: r });
    expect(text).toContain('there is no active agent-mode battle to test yet (the known-owner line is the check)');
  });
});

describe('gatherSwitch / readControl — what they ask for', () => {
  it('one control read, then one masked battle read from ten sessions back to eight days ahead', async () => {
    const db = fakeDb({ battles: [], control: CONTROL_DOC });
    const NOW = Date.parse('2026-11-23T13:00:00Z');
    const read = await gatherSwitch(db, { nowMs: NOW, allowlistList: [] });
    expect(db.log).toEqual([
      { path: 'cockpitConfig/release' },
      { path: 'agentBattles', wheres: [['expiresAt', '>=', '2026-11-09T00:00:00.000Z'], ['expiresAt', '<=', new Date(NOW + 8 * 86_400_000).toISOString()]], mask: ['ownerId', 'gameMode', 'isCpu', 'status', 'expiresAt'] },
    ]);
    expect(read.window.knownFrom).toBe('2026-11-09');
    expect(read.control.view).toMatchObject({ status: 'ok', active: true, shareBp: 10_000 });
  });
  it('readControl parses with release.js and keeps the raw disabled only when it is a boolean', async () => {
    expect((await readControl(fakeDb({ control: { shareBp: 0, disabled: false, salt: 'beta-1' } }), 1)).disabled).toBe(false);
    expect((await readControl(fakeDb({ control: { shareBp: 0, disabled: 'no', salt: 'beta-1' } }), 1))).toMatchObject({ disabled: null, view: { status: 'malformed', active: false } });
    expect((await readControl(fakeDb({}), 1))).toMatchObject({ disabled: null, view: { status: 'absent' } });
  });
});

describe('read-only by construction', () => {
  it('the script names no Firestore write: no set, update, delete, create, collection add, transaction, batch or bulk writer', () => {
    const src = readFileSync(resolve(HERE, 'beta-daily-readout.mjs'), 'utf8');
    expect(src).not.toMatch(/\.(set|update|delete|create)\(|\)\s*\.add\(|runTransaction|\.batch\(|bulkWriter|FieldValue/);
  });
  it('main() hands the server\'s own sweep deadline and the allowlist to the read', () => {
    const src = readFileSync(resolve(HERE, 'beta-daily-readout.mjs'), 'utf8').replace(/\r\n/g, '\n');
    expect(src).toContain("const { callDeadlineMs } = await import('../api/_utils/callRecords/sweep.js');");
    expect(src).toContain('gatherReadout(db, { session, readAtMs: nowMs, allowlistList: readCockpitAllowlist(), deadlineOf: callDeadlineMs })');
    expect(src).toContain('gatherSwitch(db, { nowMs, allowlistList: readCockpitAllowlist() })');
  });
  it('summarize keeps no owner list: the players block is two counts', () => {
    const p = playersRead([{ gameMode: 'baggerbomb_agent', ownerId: 'zzX', expiresAt: CLOSE }], D);
    expect(Object.keys(p).sort()).toEqual(['agentBattles', 'owners']);
    expect(typeof p.owners).toBe('number');
    expect(typeof summarize).toBe('function');
  });
});
