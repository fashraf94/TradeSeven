// api/_utils/callRecords/callActions.test.js
//
// Cockpit Build 1a — THE CALL DIRECTIVE FAMILY'S REGISTRY (spec
// docs/COCKPIT_BUILD1A_SPEC_V1_2.md §6, §15.5): the three kinds and their
// canonical templates (Amendment B §12), the kind an answer files, the
// lifetime (next_check + 15 min), eligibility now, the answer identity — and
// the ordinary MENUS byte-identical (no call kind ever reaches getAllowlist or
// a menu projection).
//
// Dependency-surface guard (BUILD_RULES §4): the imports of ./callActions.js and
// src/data/archetypeAdjustments.js are never mocked.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALL_DIRECTIVE_FAMILY, CALL_ACTIONS_TEXT_VERSION, CALL_ACTION_KINDS, NEXT_CHECK_LIFETIME_GRACE_MS, CALL_DIRECTIVE_EXPIRY,
  untilText, callDirectiveExpiresAtMs, directiveKindFor, renderCallActionText, isCallActionEligible, buildCallDirectivePlan,
} from './callActions.js';
import { answerIdOf } from './events.js';
import { ARCHETYPE_KEYS, getAllowlist, isValidAdjustmentId, getCanonicalText } from '../../../src/data/archetypeAdjustments.js';
import { makeTickBattle } from '../__fixtures__/tickStampsHarness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const T = (iso) => Date.parse(iso);
const NOW = T('2026-09-09T15:00:00.000Z'); // Wed Sep 9 2026, 11:00 ET
const CLOSE = T('2026-09-09T20:00:00.000Z');
const SLOT = T('2026-09-09T15:15:00.000Z');

const shot = (over = {}) => ({
  callId: 'battle-tick-1:eval_001:call:0', kind: 'called_shot', symbol: 'AMD', direction: 'entry', slot: 'support', counterpart: 'KO',
  condition: { side: 'above', level: 161 }, horizon: { phrase: 'this_session', expiresAt: CLOSE, basis: 'this_session' },
  defaultAction: 'act', said: 'x', state: 'open', ...over,
});
const exitHold = (over = {}) => shot({ callId: 'battle-tick-1:eval_001:call:1', kind: 'called_shot', symbol: 'KO', direction: 'exit', counterpart: 'AMD', condition: { side: 'below', level: 62.5 }, defaultAction: 'hold', ...over });
const pick = (over = {}) => ({
  callId: 'battle-tick-1:eval_001:call:2', kind: 'pick', symbol: null, direction: null, slot: 'support', counterpart: null, swapOut: 'KO',
  options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }], condition: null,
  horizon: { phrase: 'next_check', expiresAt: SLOT, basis: 'next_check' }, defaultAction: null, said: 'x', state: 'open', ...over,
});
/** The tick fixture's book: NVDA TSLA | MSFT AMZN | KO PG BTC; bench AMD JPM. */
const battle = () => makeTickBattle();

describe('the registry (spec §6)', () => {
  it('three kinds, one text version, the until_ms expiry word, the 15-minute next_check grace', () => {
    expect(CALL_ACTION_KINDS).toEqual(['call_hold', 'call_go', 'call_pick']);
    expect(CALL_ACTIONS_TEXT_VERSION).toBe('callActions.v1');
    expect(CALL_DIRECTIVE_FAMILY).toBe('call');
    expect(CALL_DIRECTIVE_EXPIRY).toBe('until_ms');
    expect(NEXT_CHECK_LIFETIME_GRACE_MS).toBe(900_000);
  });

  it('the kind an answer files: hold on act-default → call_hold; go_now on hold-default → call_go; pick on a pick → call_pick; nothing else files', () => {
    expect(directiveKindFor(shot(), 'hold')).toBe('call_hold');
    expect(directiveKindFor(exitHold(), 'go_now')).toBe('call_go');
    expect(directiveKindFor(pick(), 'pick')).toBe('call_pick');
    // Acknowledgments and illegal pairings name no kind.
    expect(directiveKindFor(shot(), 'go')).toBeNull();
    expect(directiveKindFor(shot(), 'go_now')).toBeNull();
    expect(directiveKindFor(exitHold(), 'hold')).toBeNull();
    expect(directiveKindFor(exitHold(), 'go')).toBeNull();
    expect(directiveKindFor(pick(), 'hold')).toBeNull();
    expect(directiveKindFor(pick(), 'agree')).toBeNull();
    expect(directiveKindFor(shot(), 'ask')).toBeNull();
    expect(directiveKindFor(shot(), 'keep')).toBeNull();
    expect(directiveKindFor(null, 'hold')).toBeNull();
  });

  it('the lifetime: the horizon expiry, plus 15 minutes for next_check only (a bounded advisory lifetime, not an H2 guarantee)', () => {
    expect(callDirectiveExpiresAtMs(shot())).toBe(CLOSE);
    expect(callDirectiveExpiresAtMs(pick())).toBe(SLOT + 900_000);
    expect(callDirectiveExpiresAtMs(shot({ horizon: { phrase: 'this_battle', expiresAt: CLOSE + 1, basis: 'this_battle' } }))).toBe(CLOSE + 1);
    expect(callDirectiveExpiresAtMs(shot({ horizon: null }))).toBeNull();
  });

  it('the answer identity: ${callId}:answer:${answer}:${pickSymbol ?? ""}', () => {
    expect(answerIdOf('c1', 'hold')).toBe('c1:answer:hold:');
    expect(answerIdOf('c1', 'pick', 'JPM')).toBe('c1:answer:pick:JPM');
    expect(answerIdOf('c1', 'pick', 'JPM')).not.toBe(answerIdOf('c1', 'pick', 'AMD'));
  });
});

describe('the canonical templates — Amendment B §12, rendered from the stored call only', () => {
  it("hold: `Hold off on the ${symbol} ${entry|exit} until ${deadline}` — the §4 deadline phrase after 'until', its preposition dropped", () => {
    expect(renderCallActionText('call_hold', shot(), { nowMs: NOW })).toBe("Hold off on the AMD entry until today's close.");
    expect(renderCallActionText('call_hold', shot({ direction: 'exit', symbol: 'KO' }), { nowMs: NOW })).toBe("Hold off on the KO exit until today's close.");
    expect(renderCallActionText('call_hold', shot({ horizon: { phrase: 'next_check', expiresAt: SLOT, basis: 'next_check' } }), { nowMs: NOW })).toBe('Hold off on the AMD entry until the next check.');
    expect(renderCallActionText('call_hold', shot({ horizon: { phrase: 'this_battle', expiresAt: CLOSE, basis: 'this_battle' } }), { nowMs: NOW })).toBe('Hold off on the AMD entry until the battle ends.');
    expect(renderCallActionText('call_hold', shot({ horizon: { phrase: 'explicit', expiresAt: T('2026-09-09T19:45:00.000Z'), basis: 'explicit' } }), { nowMs: NOW })).toBe('Hold off on the AMD entry until 15:45.');
    // A Friday-after-close call read on Friday names Monday.
    const monday = T('2026-09-14T20:00:00.000Z');
    expect(renderCallActionText('call_hold', shot({ horizon: { phrase: 'this_session', expiresAt: monday, basis: 'this_session' } }), { nowMs: T('2026-09-11T20:30:00.000Z') })).toBe("Hold off on the AMD entry until Monday's close.");
    expect(untilText({ basis: 'this_battle' })).toBe('the battle ends');
    expect(untilText(null)).toBeNull();
  });

  it('go_now: `If ${symbol} ${side} ${fmtPrice(level)} ${deadline}, go ahead and ${exit|bring it in}${ for counterpart}`', () => {
    expect(renderCallActionText('call_go', exitHold(), { nowMs: NOW })).toBe("If KO below $62.50 by today's close, go ahead and exit for AMD.");
    expect(renderCallActionText('call_go', exitHold({ counterpart: null }), { nowMs: NOW })).toBe("If KO below $62.50 by today's close, go ahead and exit.");
    expect(renderCallActionText('call_go', shot({ defaultAction: 'hold' }), { nowMs: NOW })).toBe("If AMD above $161.00 by today's close, go ahead and bring it in for KO.");
    expect(renderCallActionText('call_go', shot({ defaultAction: 'hold', counterpart: null }), { nowMs: NOW })).toBe("If AMD above $161.00 by today's close, go ahead and bring it in.");
    expect(renderCallActionText('call_go', shot({ defaultAction: 'hold', horizon: { phrase: 'next_check', expiresAt: SLOT, basis: 'next_check' } }), { nowMs: NOW })).toBe('If AMD above $161.00 by the next check, go ahead and bring it in for KO.');
  });

  it('pick: `Bring in ${pickSymbol} for ${swapOut} at the next check.` — from the SELECTED option; no player text anywhere', () => {
    expect(renderCallActionText('call_pick', pick(), { pickSymbol: 'JPM' })).toBe('Bring in JPM for KO at the next check.');
    expect(renderCallActionText('call_pick', pick(), { pickSymbol: null })).toBeNull();
    expect(renderCallActionText('call_pick', pick({ swapOut: null }), { pickSymbol: 'JPM' })).toBeNull();
  });

  it('a missing stored field renders nothing (never a guess); an unknown kind renders nothing', () => {
    expect(renderCallActionText('call_hold', shot({ symbol: null }), { nowMs: NOW })).toBeNull();
    expect(renderCallActionText('call_go', exitHold({ condition: null }), { nowMs: NOW })).toBeNull();
    expect(renderCallActionText('call_go', exitHold({ horizon: { basis: 'bogus' } }), { nowMs: NOW })).toBeNull();
    expect(renderCallActionText('call_ask', shot(), { nowMs: NOW })).toBeNull();
    expect(renderCallActionText('call_hold', null)).toBeNull();
  });

  it('no template claims enforcement, a held fact or causation (coaching, not enforcement)', () => {
    const src = readFileSync(resolve(HERE, 'callActions.js'), 'utf8');
    // The CODE (the templates), comments stripped — the header may name what the code must not say.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/must not|will not trade|is forbidden|In response to|heldOff|the agent held/);
    for (const [kind, call] of [['call_hold', shot()], ['call_go', exitHold()], ['call_pick', pick()]]) {
      const text = renderCallActionText(kind, call, { pickSymbol: 'JPM', nowMs: NOW });
      expect(text).not.toMatch(/must|forbidden|never|In response to|held off|you will/i);
    }
  });
});

describe('eligibility NOW (spec §5 row 7) — a dead slot or a moved symbol never gets text implying an available trade', () => {
  it('call_hold / call_go on an EXIT: the symbol must still be held in the stored slot', () => {
    expect(isCallActionEligible('call_hold', exitHold(), battle())).toEqual({ ok: true }); // KO is in support
    expect(isCallActionEligible('call_go', exitHold(), battle())).toEqual({ ok: true });
    expect(isCallActionEligible('call_hold', exitHold({ symbol: 'NVDA' }), battle())).toEqual({ ok: false, reason: 'symbol_not_held' }); // NVDA is in star, not support
    const moved = battle(); moved.portfolio.support = moved.portfolio.support.filter((r) => r.symbol !== 'KO');
    expect(isCallActionEligible('call_hold', exitHold(), moved)).toEqual({ ok: false, reason: 'symbol_not_held' });
  });

  it('call_hold / call_go on an ENTRY: the slot tier must exist; a declared counterpart must still be held there', () => {
    expect(isCallActionEligible('call_hold', shot(), battle())).toEqual({ ok: true }); // for KO, held in support
    expect(isCallActionEligible('call_go', shot({ defaultAction: 'hold' }), battle())).toEqual({ ok: true });
    expect(isCallActionEligible('call_hold', shot({ counterpart: null }), battle())).toEqual({ ok: true });
    expect(isCallActionEligible('call_hold', shot({ counterpart: 'NVDA' }), battle())).toEqual({ ok: false, reason: 'counterpart_not_held' });
    expect(isCallActionEligible('call_hold', shot({ slot: 'bench' }), battle())).toEqual({ ok: false, reason: 'slot_unknown' });
    const noTier = battle(); delete noTier.portfolio.support;
    expect(isCallActionEligible('call_hold', shot(), noTier)).toEqual({ ok: false, reason: 'slot_missing' });
    expect(isCallActionEligible('call_hold', shot({ direction: 'sideways' }), battle())).toEqual({ ok: false, reason: 'direction_unknown' });
  });

  it('call_pick: the selected option must be stored, in the universe, not held; the swap-out still held in the slot', () => {
    expect(isCallActionEligible('call_pick', pick(), battle(), { pickSymbol: 'JPM' })).toEqual({ ok: true });
    expect(isCallActionEligible('call_pick', pick(), battle(), { pickSymbol: 'AMD' })).toEqual({ ok: true });
    expect(isCallActionEligible('call_pick', pick(), battle(), { pickSymbol: 'MSFT' })).toEqual({ ok: false, reason: 'pick_not_an_option' }); // not an option
    expect(isCallActionEligible('call_pick', pick(), battle(), { pickSymbol: null })).toEqual({ ok: false, reason: 'pick_not_an_option' });
    expect(isCallActionEligible('call_pick', pick({ options: [{ symbol: 'ZZZZ' }] }), battle(), { pickSymbol: 'ZZZZ' })).toEqual({ ok: false, reason: 'pick_outside_universe' });
    const held = battle(); held.portfolio.core.push({ symbol: 'JPM', name: 'JPMorgan' });
    expect(isCallActionEligible('call_pick', pick(), held, { pickSymbol: 'JPM' })).toEqual({ ok: false, reason: 'pick_already_held' });
    expect(isCallActionEligible('call_pick', pick({ swapOut: 'PG' }), battle(), { pickSymbol: 'JPM' })).toEqual({ ok: true });
    expect(isCallActionEligible('call_pick', pick({ swapOut: 'NVDA' }), battle(), { pickSymbol: 'JPM' })).toEqual({ ok: false, reason: 'swap_out_not_held' });
    expect(isCallActionEligible('call_x', pick(), battle(), { pickSymbol: 'JPM' })).toEqual({ ok: false, reason: 'unknown_kind' });
  });
});

describe('buildCallDirectivePlan — the validated plan the shared writer takes (spec §6)', () => {
  it('a hold: the slot fields, the canonical text, the lifetime, the answer identity', () => {
    const plan = buildCallDirectivePlan({ call: shot(), answer: 'hold', nowMs: NOW, filedAt: '2026-09-09T15:00:00.000Z' });
    expect(plan.kind).toBe('call_hold');
    expect(plan.text).toBe("Hold off on the AMD entry until today's close.");
    expect(plan.normalized).toEqual({
      text: "Hold off on the AMD entry until today's close.",
      expiry: 'until_ms',
      family: 'call',
      expiresAtMs: CLOSE,
      basis: 'this_session',
      callId: 'battle-tick-1:eval_001:call:0',
      kind: 'call_hold',
      action: { direction: 'entry', symbol: 'AMD', slot: 'support', counterpart: 'KO' },
      answerId: 'battle-tick-1:eval_001:call:0:answer:hold:',
      filedAt: '2026-09-09T15:00:00.000Z',
      textVersion: 'callActions.v1',
    });
  });

  it('a pick: the selected option and the swap-out ride the action; the lifetime is the slot plus 15 minutes', () => {
    const plan = buildCallDirectivePlan({ call: pick(), answer: 'pick', pickSymbol: 'JPM', nowMs: NOW, filedAt: 'f' });
    expect(plan.kind).toBe('call_pick');
    expect(plan.normalized.action).toEqual({ direction: null, symbol: null, slot: 'support', pickSymbol: 'JPM', swapOut: 'KO' });
    expect(plan.normalized.expiresAtMs).toBe(SLOT + 900_000);
    expect(plan.normalized.basis).toBe('next_check');
    expect(plan.normalized.answerId).toBe('battle-tick-1:eval_001:call:2:answer:pick:JPM');
  });

  it('an acknowledgment, an illegal pairing or an unrenderable call yields no plan', () => {
    expect(buildCallDirectivePlan({ call: shot(), answer: 'go', nowMs: NOW, filedAt: 'f' })).toBeNull();
    expect(buildCallDirectivePlan({ call: exitHold(), answer: 'hold', nowMs: NOW, filedAt: 'f' })).toBeNull();
    expect(buildCallDirectivePlan({ call: shot({ horizon: null }), answer: 'hold', nowMs: NOW, filedAt: 'f' })).toBeNull();
    expect(buildCallDirectivePlan({ call: pick(), answer: 'pick', pickSymbol: null, nowMs: NOW, filedAt: 'f' })).toBeNull();
  });
});

describe('the ordinary menus are untouched — byte-identical, and no call kind ever reaches them (spec §6, §15.5)', () => {
  /** The six archetypes' allowlists as JSON, at the Build 1a baseline (9dfbea21). A deliberate menu edit moves this pin. */
  const MENU_SHA256 = 'f483df91ceac0189c0ede43b825ac08d30117c831ae782a2e8cb721f2ec4ae60';

  it('getAllowlist for every archetype serializes to the pinned bytes', () => {
    const menu = Object.fromEntries(ARCHETYPE_KEYS.map((c) => [c, getAllowlist(c)]));
    const s = JSON.stringify(menu);
    expect(createHash('sha256').update(s).digest('hex')).toBe(MENU_SHA256);
    expect(s.length).toBe(13608);
  });

  it('no menu id or canonical text names a call kind; call kinds are never valid adjustment ids and have no canonical text there', () => {
    for (const code of ARCHETYPE_KEYS) {
      for (const a of getAllowlist(code)) {
        expect(a.id).not.toMatch(/^call_/);
        expect(a.canonical).not.toMatch(/Hold off on the|go ahead and|at the next check\./);
      }
      for (const kind of CALL_ACTION_KINDS) {
        expect(isValidAdjustmentId(code, kind)).toBe(false);
        expect(getCanonicalText(code, kind)).toBeNull();
      }
    }
  });

  it('the registry imports nothing from the menu module, and the menu module imports nothing from the registry', () => {
    const registry = readFileSync(resolve(HERE, 'callActions.js'), 'utf8');
    const menu = readFileSync(resolve(HERE, '../../../src/data/archetypeAdjustments.js'), 'utf8');
    expect(registry).not.toMatch(/from '[^']*archetypeAdjustments\.js'/);
    expect(menu).not.toMatch(/callActions|call_hold|call_go|call_pick/);
  });
});
