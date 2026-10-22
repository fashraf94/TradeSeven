// api/_utils/callRecords/build2b.answers.test.js
//
// Cockpit Build 2b — the v2 answer table, callActions.v2 and the model-visible
// texts (contract Amendment D, D-1 / D-4 / D-7; spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md S-4, S-12, §11 "D-1", "D-4", "D-7"):
//   · answers.js — the two v2 rows behind `{ v2 }`; the flag-off table is
//     Build 2a's exactly; answerTakesPick; the one second answer;
//     replacementStepFor's three states.
//   · callActions.js — the kind, the plan's slot shape, answerId and
//     textVersion; every eligibility reason; counterpart_unavailable (from merge).
//   · S-12 — THE FROZEN TEXTS (fenced-class reviewed, the build report's L2):
//     call_replace on every horizon basis; the chosen-name call_go, equal to
//     v1's counterpart form BY CONSTRUCTION; the chat calls block's two lines,
//     beside v1's go_now unchanged.
//   · commands.js — the derived count (D-1).
//
// BUILD_RULES §4: the modules under test are imported unmocked (answers.js and
// commands.js are client-imported too: these imports are their guards).

import { describe, it, expect } from 'vitest';
import {
  classifyAnswer, tileAnswersFor, answerTakesPick, isGoAcknowledgment, replacementStepFor, wireAnswers, ANSWERS_1A, ANSWER_REPLACE,
} from './answers.js';
import {
  directiveKindFor, renderCallActionText, isCallActionEligible, buildCallDirectivePlan, CALL_ACTIONS_TEXT_VERSION, CALL_ACTIONS_TEXT_VERSION_V2, CALL_ACTION_KINDS, CALL_ACTION_KINDS_V2,
} from './callActions.js';
import { answerWithPick, renderAnsweredEvent, ANSWER_WORDS } from './copy.js';
import { buildCallsBlock } from './callsBlock.js';
import { cockpitCommandsUsed, cockpitCommandsLeft, COCKPIT_COMMANDS_LIMIT, COMMAND_SOURCE } from './commands.js';
import { COCKPIT_SOURCE } from '../chatHistoryWindow.js';
import { makeTickBattle } from '../__fixtures__/tickStampsHarness.js';

const NOW = Date.parse('2026-10-15T15:00:00.000Z'); // Thu Oct 15 2026, 11:00 ET
const CLOSE = Date.parse('2026-10-15T20:00:00.000Z');
const HZ = Object.freeze({
  this_session: { phrase: 'this_session', basis: 'this_session', expiresAt: CLOSE },
  next_check: { phrase: 'next_check', basis: 'next_check', expiresAt: NOW + 900_000 },
  this_battle: { phrase: 'this_battle', basis: 'this_battle', expiresAt: CLOSE + 86_400_000 },
  explicit: { phrase: 'explicit', basis: 'explicit', expiresAt: Date.parse('2026-10-15T18:30:00.000Z') },
});
/** An exit on the tick book: TSLA in star, the bench AMD JPM. */
const exitCall = (over = {}) => ({
  callId: 'battle-tick-1:eval_001:call:1', kind: 'confirmation', symbol: 'TSLA', direction: 'exit', slot: 'star', counterpart: null,
  condition: { side: 'below', level: 240 }, horizon: HZ.this_session, defaultAction: 'act', state: 'open', playerResponse: null, ...over,
});
const entryCall = (over = {}) => exitCall({ callId: 'battle-tick-1:eval_001:call:0', kind: 'called_shot', symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO', condition: { side: 'above', level: 163.5 }, ...over });
const goAck = { answer: 'go', kind: 'ack', callId: 'c', filedAt: new Date(NOW - 60_000).toISOString() };

describe('answers.js — the v2 rows (D-4)', () => {
  it('flag off: the table is Build 2a\'s exactly — replace is no answer, a pickSymbol rides only a pick', () => {
    for (const call of [exitCall(), exitCall({ defaultAction: 'hold' }), entryCall()]) {
      expect(classifyAnswer(call, 'replace')).toBeNull();
      for (const a of ANSWERS_1A) expect(answerTakesPick(call, a)).toBeNull();
    }
    expect(wireAnswers()).toEqual([...ANSWERS_1A]);
    expect(ANSWERS_1A).toEqual(['go', 'hold', 'go_now', 'pick', 'agree', 'disagree']);
  });

  it('flag on: replace on an exit · act · counterpart null · not upside → directive; nowhere else', () => {
    const v2 = { v2: true };
    expect(classifyAnswer(exitCall(), 'replace', v2)).toBe('directive');
    expect(classifyAnswer(exitCall({ kind: 'called_shot' }), 'replace', v2)).toBe('directive');
    expect(classifyAnswer(exitCall({ counterpart: 'JPM' }), 'replace', v2)).toBeNull();
    expect(classifyAnswer(exitCall({ defaultAction: 'hold' }), 'replace', v2)).toBeNull();
    expect(classifyAnswer(entryCall(), 'replace', v2)).toBeNull();
    expect(classifyAnswer(entryCall({ heldAtMint: true }), 'replace', v2)).toBeNull();
    expect(classifyAnswer({ kind: 'pick', options: [] }, 'replace', v2)).toBeNull();
    expect(wireAnswers(v2)).toEqual([...ANSWERS_1A, ANSWER_REPLACE]);
  });

  it('flag on: the existing rows are unchanged', () => {
    const v2 = { v2: true };
    expect(classifyAnswer(exitCall(), 'go', v2)).toBe('ack');
    expect(classifyAnswer(exitCall(), 'hold', v2)).toBe('directive');
    expect(classifyAnswer(exitCall({ defaultAction: 'hold' }), 'go_now', v2)).toBe('directive');
    expect(classifyAnswer(exitCall({ defaultAction: 'hold' }), 'hold', v2)).toBe('ack');
    expect(tileAnswersFor(exitCall(), v2)).toEqual(tileAnswersFor(exitCall()));
  });

  it('answerTakesPick: required for replace, optional for go_now on a hold-default exit with no counterpart, null for every other pairing', () => {
    const v2 = { v2: true };
    expect(answerTakesPick(exitCall(), 'replace', v2)).toBe('required');
    expect(answerTakesPick(exitCall({ defaultAction: 'hold' }), 'go_now', v2)).toBe('optional');
    expect(answerTakesPick(exitCall({ defaultAction: 'hold', counterpart: 'JPM' }), 'go_now', v2)).toBeNull();
    expect(answerTakesPick(entryCall({ defaultAction: 'hold' }), 'go_now', v2)).toBeNull();
    expect(answerTakesPick(exitCall(), 'hold', v2)).toBeNull();
    expect(answerTakesPick(exitCall(), 'go', v2)).toBeNull();
    expect(answerTakesPick({ kind: 'pick' }, 'pick', v2)).toBe('required');
    expect(answerTakesPick({ kind: 'pick' }, 'pick')).toBe('required');
  });

  it('the one second answer: a go acknowledgment, and nothing else', () => {
    expect(isGoAcknowledgment(goAck)).toBe(true);
    expect(isGoAcknowledgment({ ...goAck, answer: 'hold' })).toBe(false);
    expect(isGoAcknowledgment({ answer: 'go', kind: 'directive' })).toBe(false);
    expect(isGoAcknowledgment(null)).toBe(false);
  });

  it('replacementStepFor: on_card for an open exit + act with no counterpart, before or after Confirm exit; after_exit_instead for an unanswered exit + hold; null otherwise and always without v2', () => {
    const v2 = { v2: true };
    expect(replacementStepFor(exitCall(), v2)).toBe('on_card');
    expect(replacementStepFor(exitCall({ playerResponse: goAck }), v2)).toBe('on_card');
    expect(replacementStepFor(exitCall({ playerResponse: { answer: 'hold', kind: 'directive' } }), v2)).toBeNull();
    expect(replacementStepFor(exitCall({ playerResponse: { answer: 'replace', kind: 'directive' } }), v2)).toBeNull();
    expect(replacementStepFor(exitCall({ state: 'hit' }), v2)).toBeNull();
    expect(replacementStepFor(exitCall({ counterpart: 'JPM' }), v2)).toBeNull();
    expect(replacementStepFor(exitCall({ defaultAction: 'hold' }), v2)).toBe('after_exit_instead');
    expect(replacementStepFor(exitCall({ defaultAction: 'hold', playerResponse: { answer: 'hold', kind: 'ack' } }), v2)).toBeNull();
    expect(replacementStepFor(entryCall(), v2)).toBeNull();
    expect(replacementStepFor(exitCall())).toBeNull();
  });
});

describe('S-12 — THE FROZEN MODEL-VISIBLE TEXTS (fenced-class reviewed; L2)', () => {
  it('call_replace, one literal per horizon basis — D-4\'s template word for word', () => {
    const want = {
      this_session: "If you exit TSLA by today's close, bring in DHR.",
      next_check: 'If you exit TSLA by the next check, bring in DHR.',
      this_battle: 'If you exit TSLA before the battle ends, bring in DHR.',
      explicit: 'If you exit TSLA by 14:30, bring in DHR.',
    };
    for (const [basis, text] of Object.entries(want)) {
      expect(renderCallActionText('call_replace', exitCall({ horizon: HZ[basis] }), { pickSymbol: 'DHR', nowMs: NOW }), basis).toBe(text);
    }
    // Never a half sentence: no name, no text.
    expect(renderCallActionText('call_replace', exitCall(), { pickSymbol: null, nowMs: NOW })).toBeNull();
    expect(renderCallActionText('call_replace', exitCall({ symbol: null }), { pickSymbol: 'DHR', nowMs: NOW })).toBeNull();
  });

  it('the chosen-name call_go IS v1\'s counterpart form with IN substituted — byte for byte, by construction, on every basis', () => {
    const want = {
      this_session: "If TSLA below $240.00 by today's close, go ahead and exit for DHR.",
      next_check: 'If TSLA below $240.00 by the next check, go ahead and exit for DHR.',
      this_battle: 'If TSLA below $240.00 before the battle ends, go ahead and exit for DHR.',
      explicit: 'If TSLA below $240.00 by 14:30, go ahead and exit for DHR.',
    };
    for (const [basis, text] of Object.entries(want)) {
      const call = exitCall({ defaultAction: 'hold', horizon: HZ[basis] });
      const named = renderCallActionText('call_go', call, { pickSymbol: 'DHR', nowMs: NOW });
      expect(named, basis).toBe(text);
      // THE D-4 CLAIM: the same words the agent reads when it names its own replacement.
      expect(named, basis).toBe(renderCallActionText('call_go', { ...call, counterpart: 'DHR' }, { nowMs: NOW }));
    }
    // v1's call_go without a name is untouched: "…go ahead and exit."
    expect(renderCallActionText('call_go', exitCall({ defaultAction: 'hold' }), { nowMs: NOW })).toBe("If TSLA below $240.00 by today's close, go ahead and exit.");
  });

  it('the chat calls block: `answered: Bring in DHR` and `answered: Go now, bring in DHR` — the name from the DIRECTIVE RECORD; v1\'s go_now byte for byte', () => {
    const battle = {
      directive: null,
      chatExchanges: [
        { directiveThreadId: 't-replace', directive: { action: { direction: 'exit', symbol: 'TSLA', slot: 'star', pickSymbol: 'DHR' } } },
        { directiveThreadId: 't-named', directive: { action: { direction: 'exit', symbol: 'KO', slot: 'support', pickSymbol: 'DHR' } } },
        { directiveThreadId: 't-v1', directive: { action: { direction: 'exit', symbol: 'PG', slot: 'support' } } },
      ],
    };
    const pr = (answer, thread) => ({ answer, kind: 'directive', directiveThreadId: thread, callId: 'x', filedAt: new Date(NOW).toISOString(), heardEvalId: null });
    const open = [
      exitCall({ callId: 'c-1', mintedAt: NOW - 1, playerResponse: { ...pr('replace', 't-replace'), after: { answer: 'go', filedAt: goAck.filedAt } } }),
      exitCall({ callId: 'c-2', symbol: 'KO', slot: 'support', defaultAction: 'hold', mintedAt: NOW - 2, playerResponse: pr('go_now', 't-named') }),
      exitCall({ callId: 'c-3', symbol: 'PG', slot: 'support', defaultAction: 'hold', mintedAt: NOW - 3, playerResponse: pr('go_now', 't-v1') }),
    ];
    const block = buildCallsBlock({ open, history: [] }, { nowMs: NOW, evaluations: [], battle });
    const rows = block.split('\n');
    expect(rows[1]).toBe("- c-1 · TSLA below $240.00 by today's close · open · answered: Bring in DHR · not confirmed heard");
    expect(rows[2]).toBe("- c-2 · KO below $240.00 by today's close · open · answered: Go now, bring in DHR · not confirmed heard");
    expect(rows[3]).toBe("- c-3 · PG below $240.00 by today's close · open · answered: Go now · not confirmed heard");
    // The name is never read off playerResponse: a playerResponse that carries one is ignored.
    const planted = buildCallsBlock({ open: [exitCall({ callId: 'c-4', defaultAction: 'hold', mintedAt: NOW, playerResponse: { ...pr('go_now', 't-v1'), pickSymbol: 'EVIL' } })], history: [] }, { nowMs: NOW, battle });
    expect(planted).not.toContain('EVIL');
  });

  it('the answered EVENT (player-facing; one reading, recorded in L2): a named go_now mirrors the block line', () => {
    expect(renderAnsweredEvent({ answer: 'replace', pickSymbol: 'DHR', canonicalText: "If you exit TSLA by today's close, bring in DHR." }))
      .toBe("Answered: Bring in DHR — If you exit TSLA by today's close, bring in DHR.");
    expect(renderAnsweredEvent({ answer: 'go_now', pickSymbol: 'DHR', canonicalText: 'T.' })).toBe('Answered: Go now, bring in DHR — T.');
    expect(renderAnsweredEvent({ answer: 'go_now', canonicalText: 'T.' })).toBe('Answered: Go now — T.');
    expect(renderAnsweredEvent({ answer: 'pick', pickSymbol: 'AMD' })).toBe('Answered: Pick AMD');
    expect(ANSWER_WORDS.replace).toBe('Bring in');
    expect(answerWithPick('hold', 'DHR')).toBe('Hold off');
    expect(answerWithPick('nope')).toBeNull();
  });
});

describe('callActions.v2 — kind, plan, answerId, textVersion (D-4)', () => {
  it('the registry: v1\'s three kinds unchanged, v2 adds call_replace; replace files call_replace only with { v2 }', () => {
    expect(CALL_ACTION_KINDS).toEqual(['call_hold', 'call_go', 'call_pick']);
    expect(CALL_ACTION_KINDS_V2).toEqual(['call_hold', 'call_go', 'call_pick', 'call_replace']);
    expect(directiveKindFor(exitCall(), 'replace')).toBeNull();
    expect(directiveKindFor(exitCall(), 'replace', { v2: true })).toBe('call_replace');
    expect(directiveKindFor(exitCall({ defaultAction: 'hold' }), 'go_now', { v2: true })).toBe('call_go');
  });

  it('a call_replace plan: the slot\'s action carries OUT and IN, the answerId names IN, textVersion v2', () => {
    const plan = buildCallDirectivePlan({ call: exitCall(), answer: 'replace', pickSymbol: 'DHR', nowMs: NOW, filedAt: 'F', v2: true });
    expect(plan.kind).toBe('call_replace');
    expect(plan.text).toBe("If you exit TSLA by today's close, bring in DHR.");
    expect(plan.normalized).toMatchObject({
      family: 'call', kind: 'call_replace', callId: exitCall().callId, expiresAtMs: CLOSE, expiry: 'until_ms',
      action: { direction: 'exit', symbol: 'TSLA', slot: 'star', pickSymbol: 'DHR' },
      answerId: `${exitCall().callId}:answer:replace:DHR`, textVersion: CALL_ACTIONS_TEXT_VERSION_V2,
    });
    expect(Object.keys(plan.normalized.action)).toEqual(['direction', 'symbol', 'slot', 'pickSymbol']);
  });

  it('a named call_go plan: the same slot shape; without a name it is v1\'s call_go with textVersion v2 (flag on)', () => {
    const named = buildCallDirectivePlan({ call: exitCall({ defaultAction: 'hold' }), answer: 'go_now', pickSymbol: 'DHR', nowMs: NOW, filedAt: 'F', v2: true });
    expect(named.normalized).toMatchObject({ kind: 'call_go', action: { direction: 'exit', symbol: 'TSLA', slot: 'star', pickSymbol: 'DHR' }, answerId: `${exitCall().callId}:answer:go_now:DHR`, textVersion: 'callActions.v2' });
    const bare = buildCallDirectivePlan({ call: exitCall({ defaultAction: 'hold' }), answer: 'go_now', nowMs: NOW, filedAt: 'F', v2: true });
    expect(bare.normalized.action).toEqual({ direction: 'exit', symbol: 'TSLA', slot: 'star' });
    expect(bare.normalized.answerId).toBe(`${exitCall().callId}:answer:go_now:`);
  });

  it('flag off: every plan is v1\'s exactly — a pickSymbol on go_now is ignored, textVersion v1', () => {
    const v1 = buildCallDirectivePlan({ call: exitCall({ defaultAction: 'hold' }), answer: 'go_now', pickSymbol: 'DHR', nowMs: NOW, filedAt: 'F' });
    expect(v1.text).toBe("If TSLA below $240.00 by today's close, go ahead and exit.");
    expect(v1.normalized.action).toEqual({ direction: 'exit', symbol: 'TSLA', slot: 'star' });
    expect(v1.normalized.answerId).toBe(`${exitCall().callId}:answer:go_now:`);
    expect(v1.normalized.textVersion).toBe(CALL_ACTIONS_TEXT_VERSION);
    expect(CALL_ACTIONS_TEXT_VERSION).toBe('callActions.v1');
    expect(buildCallDirectivePlan({ call: exitCall(), answer: 'replace', pickSymbol: 'DHR', nowMs: NOW, filedAt: 'F' })).toBeNull();
  });

  it('a chosen name is never bound on an entry, even with v2 (unreachable through the endpoint; pinned here too)', () => {
    const plan = buildCallDirectivePlan({ call: entryCall({ defaultAction: 'hold', counterpart: null }), answer: 'go_now', pickSymbol: 'DHR', nowMs: NOW, filedAt: 'F', v2: true });
    expect(plan.normalized.action).not.toHaveProperty('pickSymbol');
    expect(plan.text).toMatch(/bring it in\.$/);
  });
});

describe('eligibility at filing (D-4 / D-7)', () => {
  const book = () => {
    const b = makeTickBattle();
    b.portfolio = { ...b.portfolio, bench: { stocks: [{ symbol: 'AMD', isCrypto: false }, { symbol: 'JPM', isCrypto: false, cooldownUntil: new Date(NOW + 3_600_000).toISOString() }], crypto: { symbol: 'ETH-USD.CC', isCrypto: true } } };
    b.watchlist = { hotBench: ['PLTR'] };
    b.agentContext = { ...b.agentContext, equippedWatchlist: { watchlistId: 'w', tickers: ['SHOP'] } };
    return b;
  };
  const elig = (kind, call, pickSymbol) => isCallActionEligible(kind, call, book(), { pickSymbol, atMs: NOW });

  it('call_replace: OUT still held in the slot first, then each pick_* reason of the chosen name', () => {
    expect(elig('call_replace', exitCall(), 'AMD')).toEqual({ ok: true });
    expect(elig('call_replace', exitCall(), 'PLTR')).toEqual({ ok: true });
    expect(elig('call_replace', exitCall({ symbol: 'GONE' }), 'AMD')).toEqual({ ok: false, reason: 'symbol_not_held' });
    expect(elig('call_replace', exitCall(), 'SHOP')).toEqual({ ok: false, reason: 'pick_not_on_bench' });
    expect(elig('call_replace', exitCall(), 'MSFT')).toEqual({ ok: false, reason: 'pick_already_held' });
    expect(elig('call_replace', exitCall(), 'JPM')).toEqual({ ok: false, reason: 'pick_locked' });
    expect(elig('call_replace', exitCall(), 'ETH-USD.CC')).toEqual({ ok: false, reason: 'pick_wrong_class' });
    expect(elig('call_replace', exitCall(), 'TSLA')).toEqual({ ok: false, reason: 'pick_is_symbol' });
    expect(elig('call_replace', exitCall(), null)).toEqual({ ok: false, reason: 'pick_not_on_bench' });
    expect(elig('call_replace', entryCall(), 'AMD')).toEqual({ ok: false, reason: 'direction_unknown' });
  });

  it('a named call_go: the same reasons; an unnamed one keeps v1\'s rules', () => {
    const hold = exitCall({ defaultAction: 'hold' });
    expect(elig('call_go', hold, 'AMD')).toEqual({ ok: true });
    expect(elig('call_go', hold, 'JPM')).toEqual({ ok: false, reason: 'pick_locked' });
    expect(elig('call_go', hold, null)).toEqual({ ok: true });
  });

  it('FROM MERGE — counterpart_unavailable: the agent\'s own exit counterpart on a call_go that no longer passes canComeIn', () => {
    const hold = (counterpart) => exitCall({ defaultAction: 'hold', counterpart });
    expect(elig('call_go', hold('AMD'), null)).toEqual({ ok: true });
    for (const cp of ['JPM', 'MSFT', 'SHOP', 'ETH-USD.CC']) expect(elig('call_go', hold(cp), null), cp).toEqual({ ok: false, reason: 'counterpart_unavailable' });
    // call_hold never reads the counterpart; an entry keeps counterpart_not_held.
    expect(elig('call_hold', exitCall({ counterpart: 'JPM' }), null)).toEqual({ ok: true });
    expect(elig('call_go', entryCall({ defaultAction: 'hold', counterpart: 'NVDA' }), null)).toEqual({ ok: false, reason: 'counterpart_not_held' });
  });
});

describe('commands.js — the derived count (D-1)', () => {
  const ex = (source, hasDirective) => ({ source, hasDirective });
  it('counts cockpit exchanges that carry a directive — never chat, chip or an acknowledgment', () => {
    const list = [ex('cockpit', true), ex('cockpit', true), ex('cockpit', false), ex('chat', true), ex('chip', true), ex(undefined, true), null, 'x', ex('cockpit', 'true')];
    expect(cockpitCommandsUsed(list)).toBe(2);
    expect(cockpitCommandsLeft(list)).toBe(5);
    expect(cockpitCommandsUsed(undefined)).toBe(0);
    expect(cockpitCommandsLeft(Array.from({ length: 9 }, () => ex('cockpit', true)))).toBe(0);
    expect(COCKPIT_COMMANDS_LIMIT).toBe(7);
  });
  it('the source literal is chatHistoryWindow.js COCKPIT_SOURCE', () => {
    expect(COMMAND_SOURCE).toBe(COCKPIT_SOURCE);
  });
});
