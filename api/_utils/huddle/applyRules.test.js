// api/_utils/huddle/applyRules.test.js
//
// Huddle S1 — the apply decision, pure (spec V1.1 §6.1, §9 "apply dispositions incl.
// skipped_newer_instruction"; B §B1; C §C15). The transaction itself is exercised
// against the emulator in test/rules/huddleApply.rules.mjs.

import { describe, it, expect } from 'vitest';
import {
  DISPOSITIONS, decideApplication, selectConfirmation, upsertReceipt, receiptOf, latestReceiptOf, statusReceiptOf,
  buildPlanSlot, buildPlanExchange, battleKindOf, isCpuBattle, isTerminal, GAME_PLAN_SOURCE,
  archetypesInPlayOf, missingArchetypesOf, battleInPlay,
} from './applyRules.js';
import { planThreadIdOf } from './planTemplates.js';
import { getSessionForDate } from '../marketSchedule.js';
import { COCKPIT_ALLOWLIST_ENV } from '../callRecords/allowlist.js';

const UID = 'owner-1';
const ET = '2026-11-09';
const SESSION = getSessionForDate(ET);
const OPEN = SESSION.openMs;
const conf = (archetype, revision, confirmedAtMs, text = 'GAME PLAN text') => ({
  current: { stances: [], lines: [] }, revision, archetype, renderedText: text, renderedTextHash: `h-${revision}`, confirmedAt: new Date(confirmedAtMs).toISOString(),
});
const record = (confirmations, applications = []) => ({
  session: { etDate: ET, isTradingDay: true, isEarlyClose: false, openMs: SESSION.openMs, closeMs: SESSION.closeMs },
  plan: { status: 'confirmed', confirmations, confirmed: confirmations[confirmations.length - 1], applications },
});
const battle = (over = {}) => ({
  id: 'b1', ownerId: UID, agentId: 'agent-1', status: 'active', gameMode: 'baggerbomb_agent',
  agentContext: { archetype: 'analyst' }, timing: { tradingDays: [ET] }, directive: null, controlEpochLog: [], ...over,
});
const decide = (b, rec, nowMs = OPEN + 60_000) => decideApplication({ battle: b, uid: UID, record: rec, nowMs, integrityMode: 'enforce' });

describe('decideApplication — §6.1 in order', () => {
  const rec = record([conf('analyst', 'r1', OPEN - 3_600_000)]);

  it('a clean active battle of this session under the confirmed archetype is written', () => {
    expect(decide(battle(), rec)).toMatchObject({ disposition: DISPOSITIONS.WRITTEN, confirmation: { revision: 'r1' } });
  });

  it('identity comes from the battle: another owner, a missing battle or an unconfirmed plan write nothing', () => {
    expect(decide(battle({ ownerId: 'someone-else' }), rec)).toEqual({ disposition: null, outcome: 'not_owner' });
    expect(decide(null, rec)).toEqual({ disposition: null, outcome: 'battle_missing' });
    expect(decide(battle(), { ...rec, plan: { ...rec.plan, status: 'proposed' } }).outcome).toBe('not_confirmed');
  });

  it('a CPU seat is skipped_cpu; an unbound agent is retry_error; an archetype with no dissent row is archetype_unsupported', () => {
    expect(decide(battle({ isCpu: true }), rec).disposition).toBe(DISPOSITIONS.SKIPPED_CPU);
    expect(decide(battle({ ownerId: 'cpu-3' }), { ...rec }).outcome).toBe('not_owner');
    expect(decide(battle({ agentId: '' }), rec).disposition).toBe(DISPOSITIONS.RETRY_ERROR);
    expect(decide(battle({ agentContext: { archetype: 'unknown' } }), rec).disposition).toBe(DISPOSITIONS.ARCHETYPE_UNSUPPORTED);
  });

  it('an inactive battle is retry_inactive; another session\'s battle is skipped_session; after the close nothing is decided', () => {
    expect(decide(battle({ status: 'completed' }), rec).disposition).toBe(DISPOSITIONS.RETRY_INACTIVE);
    expect(decide(battle({ timing: { tradingDays: ['2026-11-10'] } }), rec).disposition).toBe(DISPOSITIONS.SKIPPED_SESSION);
    expect(decide(battle(), rec, SESSION.closeMs)).toEqual({ disposition: null, outcome: 'expired' });
  });

  it('a live cockpit command in the slot is retry_live_call — and once it expires the plan is written', () => {
    // resolveCallRecordsMode(battle) is 'on' only for a cockpit-allowlisted owner (read from the env at each call)
    const before = process.env[COCKPIT_ALLOWLIST_ENV];
    process.env[COCKPIT_ALLOWLIST_ENV] = UID;
    try {
      // created before the confirmation, so only the live predicate can hold it back
      const live = { text: 'cmd', directiveThreadId: 't-call', family: 'call', expiresAtMs: OPEN + 120_000, createdAt: new Date(OPEN - 7_200_000).toISOString(), callId: 'c1' };
      expect(decide(battle({ directive: live }), rec, OPEN + 60_000).disposition).toBe(DISPOSITIONS.RETRY_LIVE_CALL);
      expect(decide(battle({ directive: live }), rec, OPEN + 180_000).disposition).toBe(DISPOSITIONS.WRITTEN);
      // a killed thread is not live either
      expect(decide(battle({ directive: live, controlEpochLog: [{ suppressedDirectiveIds: ['t-call'] }] }), rec, OPEN + 60_000).disposition).toBe(DISPOSITIONS.WRITTEN);
    } finally {
      if (before === undefined) delete process.env[COCKPIT_ALLOWLIST_ENV]; else process.env[COCKPIT_ALLOWLIST_ENV] = before;
    }
    // an owner off the list never has a live call
    const live = { text: 'cmd', directiveThreadId: 't-call', family: 'call', expiresAtMs: OPEN + 120_000, createdAt: new Date(OPEN - 7_200_000).toISOString(), callId: 'c1' };
    expect(decide(battle({ directive: live }), rec, OPEN + 60_000).disposition).toBe(DISPOSITIONS.WRITTEN);
  });

  it('a directive created after the confirmation is skipped_newer_instruction; an earlier one is replaced', () => {
    const newer = { text: 'chat says hold', directiveThreadId: 't-chat', createdAt: new Date(OPEN).toISOString() };
    expect(decide(battle({ directive: newer }), rec).disposition).toBe(DISPOSITIONS.SKIPPED_NEWER_INSTRUCTION);
    const older = { ...newer, createdAt: new Date(OPEN - 7_200_000).toISOString() };
    expect(decide(battle({ directive: older }), rec).disposition).toBe(DISPOSITIONS.WRITTEN);
  });

  it('at most once: a written receipt for (battle, revision) is a no-op', () => {
    const done = record([conf('analyst', 'r1', OPEN - 3_600_000)], [{ battleId: 'b1', revision: 'r1', disposition: 'written', at: new Date(OPEN).toISOString() }]);
    expect(decide(battle(), done)).toMatchObject({ disposition: null, outcome: 'already_written' });
  });
});

describe('C §C15 — a plan belongs to the archetype it was confirmed under', () => {
  it('a battle under another archetype is stale_approach (retryable) and never receives the other confirmation', () => {
    const rec = record([conf('analyst', 'r1', OPEN - 3_600_000)]);
    const d = decide(battle({ agentContext: { archetype: 'contrarian' } }), rec);
    expect(d.disposition).toBe(DISPOSITIONS.STALE_APPROACH);
    expect(isTerminal(d.disposition)).toBe(false);
  });

  it('after a reconfirm under the new archetype, each battle takes the newest confirmation of ITS archetype', () => {
    const rec = record([conf('analyst', 'r1', OPEN - 3_600_000, 'A text'), conf('contrarian', 'r2', OPEN - 1_800_000, 'B text')]);
    expect(decide(battle({ agentContext: { archetype: 'contrarian' } }), rec).confirmation.renderedText).toBe('B text');
    expect(decide(battle({ agentContext: { archetype: 'analyst' } }), rec).confirmation.renderedText).toBe('A text');
    expect(selectConfirmation(rec.plan, 'guardian')).toBeNull();
  });
});

describe('E1 — the archetypes in play: the equipped one and every in-play game\'s frozen one, with a dissent row', () => {
  const game = (archetype, over = {}) => battle({ id: `g-${archetype}`, agentContext: { archetype }, ...over });
  it('equipped plus each in-play game, sorted, with the count of games; the equipped one counts with no game', () => {
    const out = archetypesInPlayOf({ equipped: 'contrarian', battles: [game('diversifier'), game('diversifier', { id: 'g2' }), game('contrarian')], uid: UID, etDate: ET });
    expect(out).toEqual({ inPlay: ['contrarian', 'diversifier'], games: { contrarian: 1, diversifier: 2 }, unsupported: [] });
    expect(archetypesInPlayOf({ equipped: 'analyst', battles: [], uid: UID, etDate: ET })).toEqual({ inPlay: ['analyst'], games: { analyst: 0 }, unsupported: [] });
  });
  it("a game of another session, another owner, a CPU seat or a game that is not active is not in play (decideApplication's own checks)", () => {
    const out = archetypesInPlayOf({
      equipped: null,
      battles: [game('degen', { timing: { tradingDays: ['2026-11-06'] } }), game('analyst', { ownerId: 'someone' }), game('guardian', { isCpu: true }), game('momentum_chaser', { status: 'pending' })],
      uid: UID, etDate: ET,
    });
    expect(out.inPlay).toEqual([]);
    for (const b of [game('degen', { timing: {} }), game('degen', { ownerId: 'cpu-1' })]) expect(battleInPlay(b, { uid: UID, etDate: ET })).toBe(false);
    expect(battleInPlay(game('degen'), { uid: UID, etDate: ET })).toBe(true);
  });
  it('an archetype with no dissent row is never in play (it gets no confirmation); it is reported apart', () => {
    const out = archetypesInPlayOf({ equipped: 'unknown_one', battles: [game('constructor'), game('degen')], uid: UID, etDate: ET });
    expect(out.inPlay).toEqual(['degen']);
    expect(out.unsupported).toEqual(['constructor', 'unknown_one']);
  });
  it('missing: the archetypes in play with no confirmation yet', () => {
    const plan = { confirmations: [{ archetype: 'contrarian', revision: 'r' }] };
    expect(missingArchetypesOf(plan, ['contrarian', 'diversifier'])).toEqual(['diversifier']);
    expect(missingArchetypesOf(plan, ['contrarian'])).toEqual([]);
    expect(missingArchetypesOf({}, ['analyst'])).toEqual(['analyst']);
  });
  it("a shared revision (two archetypes, one current): a receipt of the battle's OWN archetype is never hidden; another archetype's still is", () => {
    // contrarian and diversifier confirmed at the same revision r1 (no row changed anything); analyst at r2
    const confirmations = [{ revision: 'r1', archetype: 'contrarian' }, { revision: 'r1', archetype: 'diversifier' }, { revision: 'r2', archetype: 'analyst' }];
    const written = { battleId: 'b1', revision: 'r1', archetype: 'diversifier', disposition: 'written', at: '2026-11-09T14:00:00.000Z' };
    const ownRetry = { battleId: 'b1', revision: 'r1x', archetype: 'diversifier', disposition: 'retry_live_call', at: '2026-11-09T16:00:00.000Z' };
    const stray = { battleId: 'b1', revision: 'r2', archetype: 'diversifier', disposition: 'retry_error', at: '2026-11-09T15:00:00.000Z' };
    expect(statusReceiptOf([written, stray], 'b1', confirmations)).toBe(written);
    // r1 is under BOTH contrarian and diversifier: with the battle's own archetype in that set, a newer receipt there shows
    const ownShared = { battleId: 'b1', revision: 'r1', archetype: 'diversifier', disposition: 'retry_live_call', at: '2026-11-09T17:00:00.000Z' };
    expect(statusReceiptOf([written, stray, { ...ownShared, revision: 'r1' }], 'b1', [...confirmations, { revision: 'r1', archetype: 'diversifier' }]).disposition).toBe('retry_live_call');
    expect(statusReceiptOf([written, ownRetry], 'b1', confirmations)).toBe(ownRetry); // no confirmation names r1x: not hidden
  });
});

describe('receipts', () => {
  it('upsert by (battleId, revision): a written receipt is never replaced; a waiting one is the latest attempt', () => {
    let list = upsertReceipt([], { battleId: 'b1', revision: 'r1', disposition: 'retry_inactive', at: 'a' });
    list = upsertReceipt(list, { battleId: 'b1', revision: 'r1', disposition: 'retry_live_call', at: 'b' });
    expect(list).toHaveLength(1);
    expect(list[0].disposition).toBe('retry_live_call');
    list = upsertReceipt(list, { battleId: 'b1', revision: 'r1', disposition: 'written', at: 'c' });
    list = upsertReceipt(list, { battleId: 'b1', revision: 'r1', disposition: 'retry_error', at: 'd' });
    expect(receiptOf(list, 'b1', 'r1').disposition).toBe('written');
    list = upsertReceipt(list, { battleId: 'b1', revision: 'r2', disposition: 'stale_approach', at: '2026-11-09T16:00:00.000Z' });
    expect(latestReceiptOf(list, 'b1').revision).toBe('r2');
  });

  it('review L2-4: a newer receipt under ANOTHER archetype\'s confirmation never hides the plan a battle holds; one under its own does', () => {
    const confirmations = [{ revision: 'rA', archetype: 'contrarian' }, { revision: 'rB', archetype: 'analyst' }, { revision: 'rA2', archetype: 'contrarian' }];
    const written = { battleId: 'b1', revision: 'rA', disposition: 'written', at: '2026-11-09T14:00:00.000Z', heardAt: '2026-11-09T14:05:00.000Z' };
    const stray = { battleId: 'b1', revision: 'rB', disposition: 'retry_error', at: '2026-11-09T15:00:00.000Z' };
    expect(statusReceiptOf([written, stray], 'b1', confirmations)).toBe(written);
    const ownNewer = { battleId: 'b1', revision: 'rA2', disposition: 'retry_live_call', at: '2026-11-09T16:00:00.000Z' };
    expect(statusReceiptOf([written, stray, ownNewer], 'b1', confirmations)).toBe(ownNewer);
    expect(statusReceiptOf([stray], 'b1', confirmations)).toBe(stray);
    expect(statusReceiptOf([], 'b1', confirmations)).toBeNull();
  });

  it('the slot is the existing shape plus textVersion, the thread id carries the revision, the row is labelled a game plan', () => {
    const c = conf('analyst', 'r9', OPEN, 'GAME PLAN for x');
    const slot = buildPlanSlot({ uid: UID, etDate: ET, confirmation: c, createdAt: '2026-11-09T15:00:00.000Z' });
    expect(Object.keys(slot).sort()).toEqual(['createdAt', 'directiveThreadId', 'expiry', 'text', 'textVersion']);
    expect(slot).toMatchObject({ text: 'GAME PLAN for x', expiry: 'end_of_battle', directiveThreadId: planThreadIdOf({ uid: UID, etDate: ET, revision: 'r9' }), textVersion: 'plan.v1' });
    const ex = buildPlanExchange({ slot, battle: battle({ gameMode: 'baggerbomb_tournament', groupId: 'g1' }) });
    expect(ex).toMatchObject({ userMessage: null, source: GAME_PLAN_SOURCE, directiveThreadId: slot.directiveThreadId, groupId: 'g1', messageType: 'directive_filed' });
  });

  it('battle kinds: ranked, casual clone, training clone; CPU by its marker or its owner id', () => {
    expect(battleKindOf({ agentId: 'a1', gameMode: 'baggerbomb_tournament' })).toBe('ranked');
    expect(battleKindOf({ agentId: 'casual-agent-u1', gameMode: 'baggerbomb_agent' })).toBe('casual');
    expect(battleKindOf({ agentId: 'training-agent-u1-g1', gameMode: 'baggerbomb_tournament' })).toBe('training');
    expect(isCpuBattle({ isCpu: true })).toBe(true);
    expect(isCpuBattle({ ownerId: 'cpu-2' })).toBe(true);
    expect(isCpuBattle({ ownerId: UID })).toBe(false);
  });
});
