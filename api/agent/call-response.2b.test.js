// api/agent/call-response.2b.test.js
//
// POST /api/agent/call-response — COCKPIT BUILD 2b (contract Amendment D,
// D-1 / D-2 / D-4 / D-7; spec docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-5, §11).
// With isCockpit2bOn() true: the v2 wire; the one sanctioned rewrite (replace
// after go); D-2's replace_unconfirmed (never persisted) for each live class;
// D-1's derived 7 (chatBudgetUsed untouched; the league day unchanged); each
// eligibility reason of a chosen name; the texts; both answered events; the
// identical repeat of either answer. With it false: HEAD's path —
// directive_pending persisted, chatBudgetUsed charged, `replace` refused at the
// wire — plus the from-merge counterpart_unavailable.
//
// The store is the general double (api/_utils/__fixtures__/callsFirestore.js).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCallsFirestore, stored, storedUnder } from '../_utils/__fixtures__/callsFirestore.js';
import { makeTickBattle, makeDirective } from '../_utils/__fixtures__/tickStampsHarness.js';

const state = vi.hoisted(() => ({ uid: 'owner-uid-1', callsMode: 'on', allow: ['owner-uid-1'], v2: true, integrity: 'enforce', resolveImpl: () => ({ groupId: 'group-xyz', dayN: 3 }) }));
vi.mock('../_utils/security.js', () => ({ applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', () => ({ requireAuth: async () => ({ uid: state.uid }) }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { arrayUnion: (...items) => ({ __op: 'arrayUnion', items }), increment: (n) => ({ __op: 'increment', n }) } }));
vi.mock('../_utils/callRecords/allowlist.js', async (importOriginal) => ({ ...(await importOriginal()), readCockpitAllowlist: () => state.allow }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CALL_RECORDS_MODE() { return state.callsMode; },
  get ARCHETYPE_INTEGRITY_MODE() { return state.integrity; },
  isCockpit2bOn: () => state.v2,
}));
vi.mock('../_utils/agentChatBudget.js', async (importOriginal) => ({ ...(await importOriginal()), resolveBudgetDay: async (_db, battle) => state.resolveImpl(battle) }));
let activeDb = null;
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => activeDb }));

// Dependency-surface guard (BUILD_RULES §4): the module under test is never mocked.
const { default: handler, resetCallResponseRateLimit, REFUSAL_REASONS, REFUSAL_REASONS_2B } = await import('./call-response.js');
const { TOURNAMENT_GAME_MODE } = await import('../../src/constants/leagueTournament.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:00:00.000Z'); // Wed Sep 9 2026, 11:00 ET
const CLOSE = T('2026-09-09T20:00:00.000Z');
const BATTLE_ID = 'battle-tick-1';
const B = `agentBattles/${BATTLE_ID}`;
const P = (sub, id) => `${B}/${sub}/${id}`;
const EXIT_ACT = `${BATTLE_ID}:eval_001:call:3`;  // TSLA exit, star, act-default, no counterpart (the Who comes in case)
const EXIT_HOLD = `${BATTLE_ID}:eval_001:call:4`; // TSLA exit, star, hold-default, no counterpart (Exit instead)
const KO_HOLD = `${BATTLE_ID}:eval_001:call:1`;   // KO exit, support, hold-default, counterpart AMD (the agent's own)
const OTHER = `${BATTLE_ID}:eval_001:call:9`;     // an AMD entry whose directive sits in the slot

const call = (callId, over = {}) => ({
  callId, kind: 'confirmation', battleId: BATTLE_ID, evalId: 'eval_001', evalSeq: 1, mintedAt: NOW - 60_000, mintedMode: 'on',
  symbol: 'TSLA', direction: 'exit', slot: 'star', counterpart: null, counterpartRaw: null, condition: { side: 'below', level: 240 },
  horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' }, defaultAction: 'act', said: 'x',
  evidence: { tickId: null, availability: 'off', priceAsOf: null }, hypothesisRef: null, origin: 'agent_initiative',
  state: 'open', stateChangedAt: NOW - 60_000, stateSource: 'mint', playerResponse: null, directiveThreadId: null, outcome: null, refused: null, ...over,
});
/** A live call-family slot belonging to OTHER (a hold on an AMD entry). */
const otherSlot = (over = {}) => ({
  text: "Hold off on the AMD entry until today's close.", expiry: 'until_ms', directiveThreadId: 'thread-other', createdAt: '2026-09-09T14:20:00.000Z',
  family: 'call', expiresAtMs: CLOSE, basis: 'this_session', callId: OTHER, kind: 'call_hold',
  action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' }, answerId: `${OTHER}:answer:hold:`, filedAt: '2026-09-09T14:20:00.000Z', textVersion: 'callActions.v1',
  ...over,
});
const cockpitEx = (n) => Array.from({ length: n }, (_, i) => ({ source: 'cockpit', hasDirective: true, directiveThreadId: `spent-${i}` }));

function makeDb({ battle = makeTickBattle({ directive: null }), calls = {}, agent = { archetype: 'analyst', name: 'Photo Agent' }, extra = {} } = {}) {
  const docs = {
    [B]: battle,
    'agents/agent-1': agent,
    [P('calls', EXIT_ACT)]: call(EXIT_ACT),
    [P('calls', EXIT_HOLD)]: call(EXIT_HOLD, { kind: 'called_shot', defaultAction: 'hold' }),
    [P('calls', KO_HOLD)]: call(KO_HOLD, { kind: 'called_shot', symbol: 'KO', slot: 'support', counterpart: 'AMD', condition: { side: 'below', level: 62.5 }, defaultAction: 'hold' }),
    [P('calls', OTHER)]: call(OTHER, { kind: 'called_shot', symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 161 } }),
    ...Object.fromEntries(Object.entries(calls).map(([id, c]) => [P('calls', id), c])),
    ...extra,
  };
  return makeCallsFirestore({ docs });
}
const mkRes = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const post = async (body) => { const res = mkRes(); await handler({ method: 'POST', body }, res); return res; };
const body = (over = {}) => ({ battleId: BATTLE_ID, callId: EXIT_ACT, answer: 'replace', pickSymbol: 'AMD', expectedDirectiveThreadId: null, ...over });
const writesOn = (db, pred) => db.__access.writes.filter((w) => pred(w.path || ''));
const callWrites = (db) => writesOn(db, (p) => p.includes('/calls/'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  Object.assign(state, { uid: 'owner-uid-1', callsMode: 'on', allow: ['owner-uid-1'], v2: true, integrity: 'enforce', resolveImpl: () => ({ groupId: 'group-xyz', dayN: 3 }) });
  resetCallResponseRateLimit();
  activeDb = makeDb();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the wire, flag on (S-5)', () => {
  it('replace requires pickSymbol; pickSymbol on hold / go / agree is 400 invalid_request; confirmReplace must be a boolean — before any read', async () => {
    for (const b of [body({ pickSymbol: undefined }), body({ pickSymbol: '' }), body({ answer: 'hold' }), body({ answer: 'go' }), body({ answer: 'agree' }), body({ confirmReplace: 'yes' })]) {
      expect((await post(b)).statusCode, JSON.stringify(b)).toBe(400);
    }
    expect(activeDb.__access.reads).toEqual([]);
  });
  it('the reasons lists: HEAD\'s unchanged; the 2b list swaps directive_pending for replace_unconfirmed', () => {
    expect(REFUSAL_REASONS).toEqual(['directive_pending', 'already_answered', 'expired', 'belief_mismatch', 'budget', 'parent_not_active']);
    expect(REFUSAL_REASONS_2B).toEqual(['already_answered', 'expired', 'belief_mismatch', 'budget', 'parent_not_active', 'replace_unconfirmed']);
  });
});

describe('D-4 — replace and the named go_now', () => {
  it('replace on an unanswered exit + act: call_replace filed — the canonical text, the slot\'s action with IN, textVersion v2; IN never on playerResponse', async () => {
    const res = await post(body());
    expect(res.statusCode).toBe(200);
    expect(res.body.directive).toMatchObject({ kind: 'call_replace', text: "If you exit TSLA by today's close, bring in AMD.", action: { direction: 'exit', symbol: 'TSLA', slot: 'star', pickSymbol: 'AMD' }, textVersion: 'callActions.v2', answerId: `${EXIT_ACT}:answer:replace:AMD` });
    const pr = stored(activeDb, P('calls', EXIT_ACT)).playerResponse;
    expect(pr).toMatchObject({ answer: 'replace', kind: 'directive', heardEvalId: null });
    expect(pr).not.toHaveProperty('pickSymbol');
    expect(pr).not.toHaveProperty('after');
    expect(JSON.stringify(pr)).not.toContain('AMD');
    expect(storedUnder(activeDb, `${B}/callEvents`)[`${EXIT_ACT}:answered:${EXIT_ACT}:answer:replace:AMD`]).toMatchObject({ kind: 'answered', text: "Answered: Bring in AMD — If you exit TSLA by today's close, bring in AMD." });
  });

  it('THE ONE SANCTIONED REWRITE: replace after the go acknowledgment keeps the ack in `after`; both answered events stand; an identical repeat of either returns the stored response', async () => {
    expect((await post(body({ answer: 'go', pickSymbol: undefined }))).statusCode).toBe(200);
    const ack = stored(activeDb, P('calls', EXIT_ACT)).playerResponse;
    expect(ack).toMatchObject({ answer: 'go', kind: 'ack' });
    vi.setSystemTime(new Date(NOW + 60_000));
    const res = await post(body());
    expect(res.statusCode).toBe(200);
    const pr = stored(activeDb, P('calls', EXIT_ACT)).playerResponse;
    expect(pr).toMatchObject({ answer: 'replace', kind: 'directive', after: { answer: 'go', filedAt: ack.filedAt } });
    const events = storedUnder(activeDb, `${B}/callEvents`);
    expect(Object.keys(events).filter((k) => k.includes(':answered:')).sort()).toEqual([`${EXIT_ACT}:answered:${EXIT_ACT}:answer:go:`, `${EXIT_ACT}:answered:${EXIT_ACT}:answer:replace:AMD`]);
    const repeatReplace = await post(body());
    expect(repeatReplace.body).toMatchObject({ repeat: true, playerResponse: pr });
    const repeatGo = await post(body({ answer: 'go', pickSymbol: undefined }));
    expect(repeatGo.body).toMatchObject({ repeat: true, playerResponse: pr });
  });

  it('every other second answer stays 409 already_answered: replace after a hold directive, a second replace with another name', async () => {
    expect((await post(body({ answer: 'hold', pickSymbol: undefined }))).statusCode).toBe(200);
    expect((await post(body())).body).toMatchObject({ error: 'refused', reason: 'already_answered' });
    activeDb = makeDb();
    resetCallResponseRateLimit();
    expect((await post(body())).statusCode).toBe(200);
    expect((await post(body({ pickSymbol: 'JPM' }))).body).toMatchObject({ reason: 'already_answered' });
  });

  it('pairings that take no name: replace on a hold-default exit or on an exit with a counterpart → 400 illegal_answer; a named go_now on an exit WITH a counterpart → 400 illegal_answer', async () => {
    expect((await post(body({ callId: EXIT_HOLD }))).body).toMatchObject({ error: 'illegal_answer' });
    expect((await post(body({ callId: KO_HOLD, answer: 'go_now', pickSymbol: 'JPM' }))).body).toMatchObject({ error: 'illegal_answer' });
    expect((await post(body({ callId: OTHER, answer: 'replace' }))).body).toMatchObject({ error: 'illegal_answer' });
    expect(callWrites(activeDb)).toEqual([]);
  });

  it('a named go_now on a hold-default exit: v1\'s template with IN in the counterpart clause; without a name, v1\'s go_now (textVersion v2)', async () => {
    const named = await post(body({ callId: EXIT_HOLD, answer: 'go_now', pickSymbol: 'JPM' }));
    expect(named.statusCode).toBe(200);
    expect(named.body.directive).toMatchObject({ kind: 'call_go', text: "If TSLA below $240.00 by today's close, go ahead and exit for JPM.", action: { pickSymbol: 'JPM' } });
    expect(storedUnder(activeDb, `${B}/callEvents`)[`${EXIT_HOLD}:answered:${EXIT_HOLD}:answer:go_now:JPM`].text).toBe("Answered: Go now, bring in JPM — If TSLA below $240.00 by today's close, go ahead and exit for JPM.");
    activeDb = makeDb();
    resetCallResponseRateLimit();
    const bare = await post(body({ callId: EXIT_HOLD, answer: 'go_now', pickSymbol: undefined }));
    expect(bare.body.directive).toMatchObject({ kind: 'call_go', text: "If TSLA below $240.00 by today's close, go ahead and exit.", textVersion: 'callActions.v2' });
    expect(bare.body.directive.action).not.toHaveProperty('pickSymbol');
  });

  it('the chosen name is canonicalized through the battle\'s universe ("amd" → AMD)', async () => {
    const res = await post(body({ pickSymbol: ' amd ' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.directive.action.pickSymbol).toBe('AMD');
  });
});

describe('D-7 — eligibility of a chosen name at filing (400 ineligible_action, nothing written)', () => {
  const lockedBattle = () => {
    const b = makeTickBattle({ directive: null });
    b.portfolio = { ...b.portfolio, bench: { stocks: [{ symbol: 'AMD', isCrypto: false }, { symbol: 'JPM', isCrypto: false, cooldownUntil: new Date(NOW + 3_600_000).toISOString() }], crypto: { symbol: 'ETH-USD.CC', isCrypto: true } } };
    b.agentContext = { ...b.agentContext, equippedWatchlist: { watchlistId: 'w', tickers: ['SHOP'] } };
    return b;
  };
  it.each([
    ['outside the universe', 'ZZZZ', 'pick_not_on_bench'],
    ['on the equipped watchlist only (in the universe, not on the swap\'s lists) — the same reason', 'SHOP', 'pick_not_on_bench'],
    ['already held', 'MSFT', 'pick_already_held'],
    ['cooldown-locked', 'JPM', 'pick_locked'],
    ['another asset class', 'ETH-USD.CC', 'pick_wrong_class'],
    ['the call\'s own symbol', 'TSLA', 'pick_is_symbol'],
  ])('%s → %s', async (_label, pickSymbol, reason) => {
    activeDb = makeDb({ battle: lockedBattle() });
    const res = await post(body({ pickSymbol }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'ineligible_action', reason });
    expect(callWrites(activeDb)).toEqual([]);
  });
  it('OUT no longer held in the slot → symbol_not_held', async () => {
    const b = makeTickBattle({ directive: null });
    b.portfolio = { ...b.portfolio, star: [{ symbol: 'NVDA', isCrypto: false }] };
    activeDb = makeDb({ battle: b });
    expect((await post(body())).body).toEqual({ error: 'ineligible_action', reason: 'symbol_not_held' });
  });
});

describe('D-2 — one live command: replace after one confirmation, never refuse (never persisted)', () => {
  const withSlot = (slot, over = {}) => makeDb({ battle: makeTickBattle({ directive: slot, chatExchanges: [{ directiveThreadId: slot.directiveThreadId, directive: slot, source: 'cockpit', hasDirective: true }], ...over }) });

  it('a live CALL-FAMILY slot without confirmReplace → 409 replace_unconfirmed with the current command — nothing written, `refused` untouched', async () => {
    activeDb = withSlot(otherSlot());
    const res = await post(body({ expectedDirectiveThreadId: 'thread-other' }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: 'refused', reason: 'replace_unconfirmed', currentDirectiveThreadId: 'thread-other', currentText: "Hold off on the AMD entry until today's close.", currentCallId: OTHER });
    expect(activeDb.__access.writes).toEqual([]);
    expect(stored(activeDb, P('calls', EXIT_ACT)).refused).toBeNull();
  });

  it('confirmed: the filing replaces it — the supersedes stamp on the new exchange and the superseded event, in the same transaction', async () => {
    activeDb = withSlot(otherSlot());
    const res = await post(body({ expectedDirectiveThreadId: 'thread-other', confirmReplace: true }));
    expect(res.statusCode).toBe(200);
    const battle = stored(activeDb, B);
    expect(battle.directive.kind).toBe('call_replace');
    expect(battle.chatExchanges.at(-1).supersedes).toEqual({ directiveThreadId: 'thread-other', at: expect.any(String) });
    expect(storedUnder(activeDb, `${B}/callEvents`)['thread-other:superseded']).toMatchObject({ kind: 'superseded', callIds: [OTHER], supersededBy: res.body.directiveThreadId });
    // The replaced call's playerResponse is never rewritten (D-2).
    expect(stored(activeDb, P('calls', OTHER)).playerResponse).toBeNull();
  });

  it('a live ORDINARY (chat) directive → replace_unconfirmed with currentCallId null; confirmed, it files (an ordinary prior gets no supersedes stamp)', async () => {
    const chat = makeDirective();
    activeDb = makeDb({ battle: makeTickBattle({ directive: chat }) });
    const res = await post(body({ expectedDirectiveThreadId: chat.directiveThreadId }));
    expect(res.body).toEqual({ error: 'refused', reason: 'replace_unconfirmed', currentDirectiveThreadId: chat.directiveThreadId, currentText: chat.text, currentCallId: null });
    const ok = await post(body({ expectedDirectiveThreadId: chat.directiveThreadId, confirmReplace: true }));
    expect(ok.statusCode).toBe(200);
    expect(stored(activeDb, B).chatExchanges.at(-1)).not.toHaveProperty('supersedes');
  });

  it('NOT live — killed, suppressed, expired: no confirmation needed', async () => {
    const chat = makeDirective();
    activeDb = makeDb({ battle: makeTickBattle({ directive: chat, controlEpochLog: [{ suppressedDirectiveIds: [chat.directiveThreadId] }] }) });
    expect((await post(body({ expectedDirectiveThreadId: chat.directiveThreadId }))).statusCode).toBe(200);
    state.integrity = 'shadow';
    activeDb = withSlot(otherSlot());
    resetCallResponseRateLimit();
    expect((await post(body({ expectedDirectiveThreadId: 'thread-other' }))).statusCode).toBe(200);
    state.integrity = 'enforce';
    activeDb = withSlot(otherSlot({ expiresAtMs: NOW - 1 }));
    resetCallResponseRateLimit();
    expect((await post(body({ expectedDirectiveThreadId: 'thread-other' }))).statusCode).toBe(200);
  });

  it('the belief is still enforced, before the confirmation: a stale belief is belief_mismatch even with confirmReplace', async () => {
    activeDb = withSlot(otherSlot());
    expect((await post(body({ expectedDirectiveThreadId: null, confirmReplace: true }))).body).toMatchObject({ reason: 'belief_mismatch', currentDirectiveThreadId: 'thread-other' });
  });

  it('flag off → HEAD: directive_pending, persisted as `refused` on the call', async () => {
    state.v2 = false;
    activeDb = withSlot(otherSlot());
    const res = await post(body({ answer: 'hold', pickSymbol: undefined, expectedDirectiveThreadId: 'thread-other' }));
    expect(res.body).toMatchObject({ error: 'refused', reason: 'directive_pending', pendingDirectiveThreadId: 'thread-other', pendingCallId: OTHER });
    expect(stored(activeDb, P('calls', EXIT_ACT)).refused).toMatchObject({ reason: 'directive_pending' });
  });
});

describe('D-1 — the cockpit\'s own 7, derived', () => {
  const battleWithEx = (exchanges, over = {}) => makeTickBattle({ directive: null, chatExchanges: exchanges, chatBudgetUsed: 4, ...over });

  it('the count reads cockpit filings that carry a directive — never chat, chip or an acknowledgment; remaining = 7 − (count + 1); chatBudgetUsed untouched', async () => {
    const mixed = [...cockpitEx(3), { source: 'cockpit', hasDirective: false }, { source: 'chat', hasDirective: true }, { source: 'chip', hasDirective: true }, { hasDirective: true }];
    activeDb = makeDb({ battle: battleWithEx(mixed) });
    const res = await post(body());
    expect(res.statusCode).toBe(200);
    expect(res.body.remaining).toBe(3);
    expect(stored(activeDb, B).chatBudgetUsed).toBe(4);
    expect(writesOn(activeDb, (p) => p === B).every((w) => !Object.prototype.hasOwnProperty.call(w.data || {}, 'chatBudgetUsed'))).toBe(true);
  });

  it('the 7th is accepted (remaining 0) and the 8th refused (409 budget, nothing written)', async () => {
    activeDb = makeDb({ battle: battleWithEx(cockpitEx(6)) });
    const seventh = await post(body());
    expect(seventh.statusCode).toBe(200);
    expect(seventh.body.remaining).toBe(0);
    activeDb = makeDb({ battle: battleWithEx(cockpitEx(7)) });
    resetCallResponseRateLimit();
    const eighth = await post(body());
    expect(eighth.body).toEqual({ error: 'refused', reason: 'budget' });
    expect(activeDb.__access.writes).toEqual([]);
  });

  it('an acknowledgment is never counted and never refused for budget', async () => {
    activeDb = makeDb({ battle: battleWithEx(cockpitEx(7)) });
    const res = await post(body({ answer: 'go', pickSymbol: undefined }));
    expect(res.statusCode).toBe(200);
    expect(stored(activeDb, B).chatExchanges).toHaveLength(7);
  });

  it('flag off: chatBudgetUsed charged exactly as HEAD (10 per battle)', async () => {
    state.v2 = false;
    activeDb = makeDb({ battle: battleWithEx(cockpitEx(7)) });
    const res = await post(body({ answer: 'hold', pickSymbol: undefined }));
    expect(res.statusCode).toBe(200);
    expect(res.body.remaining).toBe(5);
    expect(stored(activeDb, B).chatBudgetUsed).toBe(5);
  });

  it('the league branch is unchanged with the flag on: the per-day document is charged, the 7 not read', async () => {
    activeDb = makeDb({ battle: battleWithEx(cockpitEx(7), { gameMode: TOURNAMENT_GAME_MODE, groupId: 'group-xyz' }) });
    const res = await post(body());
    expect(res.statusCode).toBe(200);
    expect(writesOn(activeDb, (p) => p.startsWith('agentChatBudget') || p.includes('ChatBudget')).length).toBeGreaterThan(0);
  });
});

describe('flag off — HEAD\'s endpoint, plus D-7\'s counterpart_unavailable (from merge)', () => {
  beforeEach(() => { state.v2 = false; });

  it('replace is no answer (400 invalid_request); a pickSymbol on go_now is dropped — v1\'s call_go, textVersion v1', async () => {
    expect((await post(body())).statusCode).toBe(400);
    const res = await post(body({ callId: EXIT_HOLD, answer: 'go_now', pickSymbol: 'JPM' }));
    expect(res.statusCode).toBe(200);
    expect(res.body.directive).toMatchObject({ kind: 'call_go', text: "If TSLA below $240.00 by today's close, go ahead and exit.", textVersion: 'callActions.v1', answerId: `${EXIT_HOLD}:answer:go_now:` });
    expect(res.body.directive.action).not.toHaveProperty('pickSymbol');
  });

  it('counterpart_unavailable: a go_now on an exit whose agent counterpart can no longer come in — 400, nothing written; one that can, files', async () => {
    activeDb = makeDb({ calls: { [KO_HOLD]: call(KO_HOLD, { kind: 'called_shot', symbol: 'KO', slot: 'support', counterpart: 'MSFT', defaultAction: 'hold' }) } });
    const res = await post(body({ callId: KO_HOLD, answer: 'go_now', pickSymbol: undefined }));
    expect(res.body).toEqual({ error: 'ineligible_action', reason: 'counterpart_unavailable' });
    expect(callWrites(activeDb)).toEqual([]);
    activeDb = makeDb();
    resetCallResponseRateLimit();
    expect((await post(body({ callId: KO_HOLD, answer: 'go_now', pickSymbol: undefined }))).statusCode).toBe(200);
  });
});

describe('the sanctioned rewrite is the only one (D-4 rev 2) — source-pinned', () => {
  it('in api/, a whole playerResponse is written only by the answer endpoint; every other writer touches only playerResponse.heardEvalId', () => {
    const files = [];
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, ent.name);
        if (ent.isDirectory()) { if (!ent.name.startsWith('__') && ent.name !== 'node_modules') walk(abs); continue; }
        if (/\.js$/.test(ent.name) && !/\.test\.js$/.test(ent.name)) files.push(abs);
      }
    };
    walk(resolve(HERE, '..'));
    const whole = [];
    for (const abs of files) {
      const code = readFileSync(abs, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      // Every write call's argument text (to its statement's end): playerResponse as a KEY in ANY position — after
      // other keys, after a spread, shorthand, in create() — never only as the first key (review CB1-4). The dotted
      // 'playerResponse.heardEvalId' key is the one partial write, and does not match (a '.' follows the name).
      for (const m of code.matchAll(/\b(?:update|set|create)\(/g)) {
        const end = code.indexOf(';', m.index);
        const stmt = code.slice(m.index, end === -1 ? m.index + 2000 : end);
        if (/[{,]\s*['"]?playerResponse['"]?\s*[:,}]/.test(stmt)) whole.push(`${relative(resolve(HERE, '..'), abs).replace(/\\/g, '/')}:${m.index}`);
      }
    }
    expect(whole.map((w) => w.split(':')[0])).toEqual(['agent/call-response.js', 'agent/call-response.js']);
    const src = readFileSync(resolve(HERE, 'call-response.js'), 'utf8');
    // The directive write is reached only with no answer standing, or the go ack (secondAnswer).
    expect(src).toContain("if (call.playerResponse && !secondAnswer) return refused('already_answered');");
    expect(src).toContain('const secondAnswer = v2 && answer === ANSWER_REPLACE && isGoAcknowledgment(call.playerResponse);');
  });
});
