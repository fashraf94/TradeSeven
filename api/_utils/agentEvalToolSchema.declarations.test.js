// api/_utils/agentEvalToolSchema.declarations.test.js
//
// Cockpit Build 0 — the flag-conditional `declarations` property (spec
// docs/design/COCKPIT_SPEC_V1_3.md §3.1; contract §2). Reviewed as
// fenced-class: it is model-visible at shadow/on.
//
//   · declarations OFF: the tool IS the frozen constant — the same object, and
//     byte-identical to the pre-change fixture captured before this build;
//   · declarations ON: exactly one more top-level property, last, typed
//     ['object','null'], never required — every other byte unchanged;
//   · the trade validator is UNTOUCHED: it still reads the declarations-off
//     schema, so no declarations block — however malformed — can alter a trade
//     result;
//   · THE OUTPUT MEASUREMENT (the input-budget test proves nothing about
//     output): the serialized block's size at the caps, against the 2,048
//     output ceiling. The numbers pinned here are the ones the build report
//     states; shadow counts `stop_reason === 'max_tokens'` as truncation events.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRADE_DECISION_TOOL, buildTradeDecisionTool, DECLARATIONS_PROPERTY } from './agentEvalToolSchema.js';
import { validateTradeToolResult } from './agentEvalToolResultValidation.js';
import { EVAL_MAX_OUTPUT_TOKENS } from './agentEvalTransport.js';
import { makeHoldResult, makeSwapResult, makeDeclarations, makeMaximalDeclarations } from './__fixtures__/tickStampsHarness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(HERE, 'agentEvalToolSchema.js'), 'utf8');
const FROZEN = JSON.parse(readFileSync(resolve(HERE, '__fixtures__/callRecordsOffGolden.json'), 'utf8')).toolSchema;
/** The repo's measurement convention (composition.m7e2eBudget.test.js): chars/4. */
const tokens4 = (s) => Math.ceil(String(s).length / 4);
/** A conservative second reading for dense JSON. */
const tokens3 = (s) => Math.ceil(String(s).length / 3);

describe('buildTradeDecisionTool — declarations OFF is the frozen constant', () => {
  it('returns the SAME object as TRADE_DECISION_TOOL (identity), for false and for every non-true value', () => {
    for (const v of [false, undefined, null, 0, 1, 'shadow', 'on', {}]) {
      expect(buildTradeDecisionTool({ declarations: v }), String(v)).toBe(TRADE_DECISION_TOOL);
    }
    expect(buildTradeDecisionTool()).toBe(TRADE_DECISION_TOOL);
  });

  it('is byte-identical to the tool captured from the pre-change tree', () => {
    expect(JSON.stringify(TRADE_DECISION_TOOL)).toBe(JSON.stringify(FROZEN));
    expect(TRADE_DECISION_TOOL.input_schema.properties).not.toHaveProperty('declarations');
  });
});

describe('buildTradeDecisionTool — declarations ON adds exactly one property', () => {
  const on = buildTradeDecisionTool({ declarations: true });

  it('every byte but the new property is the frozen constant; the property is the LAST key', () => {
    const keys = Object.keys(on.input_schema.properties);
    expect(keys[keys.length - 1]).toBe('declarations');
    expect(keys.slice(0, -1)).toEqual(Object.keys(TRADE_DECISION_TOOL.input_schema.properties));
    const stripped = { ...on, input_schema: { ...on.input_schema, properties: { ...on.input_schema.properties } } };
    delete stripped.input_schema.properties.declarations;
    expect(JSON.stringify(stripped)).toBe(JSON.stringify(TRADE_DECISION_TOOL));
    expect(on.input_schema.properties.declarations).toBe(DECLARATIONS_PROPERTY);
  });

  it("is ['object','null'] and never in required (a required block would reject every HOLD that declares nothing)", () => {
    expect(DECLARATIONS_PROPERTY.type).toEqual(['object', 'null']);
    expect(on.input_schema.required).toEqual(TRADE_DECISION_TOOL.input_schema.required);
    expect(on.input_schema.required).not.toContain('declarations');
  });

  it('carries the contract §2 shape — calledShots / watching / playerAsk / fork — with the typed enums', () => {
    const p = DECLARATIONS_PROPERTY.properties;
    expect(Object.keys(p)).toEqual(['calledShots', 'watching', 'playerAsk', 'fork']);
    const shot = p.calledShots.items;
    expect(shot.required).toEqual(['symbol', 'direction', 'slot', 'condition', 'horizonPhrase', 'defaultAction', 'said']);
    expect(Object.keys(shot.properties)).toEqual(['symbol', 'direction', 'slot', 'counterpart', 'condition', 'horizonPhrase', 'expiresAtMs', 'defaultAction', 'said']);
    expect(shot.properties.direction.enum).toEqual(['entry', 'exit']);
    expect(shot.properties.slot.enum).toEqual(['star', 'core', 'support']);
    expect(shot.properties.condition.properties.side.enum).toEqual(['above', 'below']);
    expect(shot.properties.condition.properties.level.type).toBe('number');
    expect(shot.properties.horizonPhrase.enum).toEqual(['next_check', 'this_session', 'this_battle', 'explicit']);
    expect(shot.properties.defaultAction.enum).toEqual(['act', 'hold']);
    expect(p.playerAsk.type).toEqual(['object', 'null']);
    expect(p.fork.type).toEqual(['object', 'null']);
    expect(p.fork.required).toEqual(['slot', 'swapOut', 'options', 'said']);
  });

  it('the descriptions ask for at most 6 shots and state every cap; no description names a 20-day level', () => {
    expect(DECLARATIONS_PROPERTY.description).toMatch(/At most 6 calledShots/);
    expect(DECLARATIONS_PROPERTY.properties.calledShots.description).toMatch(/^At most 6\./);
    expect(DECLARATIONS_PROPERTY.properties.watching.description).toMatch(/At most 6/);
    expect(JSON.stringify(DECLARATIONS_PROPERTY)).toMatch(/at most 280 characters/);
    expect(JSON.stringify(DECLARATIONS_PROPERTY)).toMatch(/At most 140 characters/);
    expect(JSON.stringify(DECLARATIONS_PROPERTY)).toMatch(/At most 200 characters/);
    expect(JSON.stringify(DECLARATIONS_PROPERTY)).toMatch(/each at most 60 characters/);
    expect(SRC).not.toContain('20-day');
  });

  it('the property is DEEP-frozen, and the on-tool shares no object with the off tool (review C-6)', () => {
    const frozenAll = (v) => !(v && typeof v === 'object') || (Object.isFrozen(v) && Object.values(v).every(frozenAll));
    expect(frozenAll(DECLARATIONS_PROPERTY)).toBe(true);
    const on = buildTradeDecisionTool({ declarations: true });
    expect(frozenAll(on)).toBe(true);
    // No aliasing: the on-tool's arrays/objects are never the off tool's own.
    expect(on.input_schema.required).not.toBe(TRADE_DECISION_TOOL.input_schema.required);
    expect(on.input_schema.required).toEqual(TRADE_DECISION_TOOL.input_schema.required);
    for (const key of Object.keys(TRADE_DECISION_TOOL.input_schema.properties)) {
      expect(on.input_schema.properties[key], key).not.toBe(TRADE_DECISION_TOOL.input_schema.properties[key]);
      expect(on.input_schema.properties[key], key).toEqual(TRADE_DECISION_TOOL.input_schema.properties[key]);
    }
    // A write attempted through the on-tool can never reach the off tool the validator captured.
    expect(() => { on.input_schema.required.push('declarations'); }).toThrow();
    expect(TRADE_DECISION_TOOL.input_schema.required).not.toContain('declarations');
  });

  it('the wording states intent only: nothing executes, and the block never replaces the decision or anticipationCandidates (review C-4)', () => {
    const text = JSON.stringify(DECLARATIONS_PROPERTY);
    expect(DECLARATIONS_PROPERTY.description).toMatch(/^Optional record of conditional intent from this check\./);
    expect(DECLARATIONS_PROPERTY.description).toMatch(/do not execute or schedule a trade/);
    expect(DECLARATIONS_PROPERTY.description).toMatch(/They do not change this check's decision or anticipationCandidates\./);
    expect(DECLARATIONS_PROPERTY.properties.watching.description).toMatch(/Separate from anticipationCandidates/);
    // No promise of follow-through the build cannot keep.
    expect(text).not.toMatch(/you will act|make the trade when|you intend to trade/);
  });

  it('the wording names the recipient Build 0 really has: stored only, never shown to the player, no response requested, nothing scheduled, not supplied to a later check (review BR-3)', () => {
    const p = DECLARATIONS_PROPERTY.properties;
    const shot = p.calledShots.items.properties;
    // The block: every clause of the review's suggested text.
    expect(DECLARATIONS_PROPERTY.description).toMatch(
      /^Optional record of conditional intent from this check\. These fields are stored only; they are not shown to the player, do not request a response, do not execute or schedule a trade, and are not supplied to a later check\. They do not change this check's decision or anticipationCandidates\. /,
    );
    // The omission, cap and quote-source guidance survives the rewording.
    expect(DECLARATIONS_PROPERTY.description).toMatch(/Most checks declare nothing: omit this or send null\. At most 6 calledShots\. A level is a price in the symbol's own quote, read from what you were shown this check\.$/);
    // Every field that once addressed the player is now a conditional, stored-only record.
    expect(shot.defaultAction.description).toBe('Intent recorded at declaration time if the condition is met: act = would favor a trade; hold = would favor holding. This records an intention, not an instruction or promise of execution.');
    expect(p.playerAsk.description).toBe('Optional record of an unresolved research question and 2 to 4 possible answers. Stored only; no question is delivered and no answer is expected.');
    expect(p.fork.description).toBe('Optional record of an unresolved choice for one slot: 2 to 4 names from this battle that could replace swapOut. Stored only; no selection is requested or acted on.');
    for (const said of [shot.said, p.fork.properties.said]) {
      expect(said.description).toMatch(/^The (?:call|choice) as one conditional sentence, in your voice, at most 280 characters\. Stored only; not shown to the player\./);
    }
    // Nothing addresses the player as someone who will read or answer this.
    // Nothing tells the model to wait, withhold a trade, repeat itself in
    // narration or seek permission.
    const text = JSON.stringify(DECLARATIONS_PROPERTY);
    expect(text).not.toMatch(/player says|without the player|for the player|want the player|ask the player|the player (?:should|must|will|can|may)\b/i);
    expect(text).not.toMatch(/\bwait\b|suppress|withhold|narrat|permission|approv|confirm/i);
  });
});

describe('the trade validator is untouched — a declarations block never alters the trade result', () => {
  const garbage = [
    'not an object', 42, [], [1, 2], { calledShots: 'x' }, { calledShots: [{ symbol: 7 }] },
    { fork: { options: 'x' } }, makeMaximalDeclarations(), makeDeclarations(),
  ];

  it('a valid HOLD stays valid with ANY declarations value attached', () => {
    for (const block of garbage) {
      expect(validateTradeToolResult({ ...makeHoldResult(), declarations: block }), JSON.stringify(block).slice(0, 40)).toEqual(validateTradeToolResult(makeHoldResult()));
    }
    expect(validateTradeToolResult(makeHoldResult()).valid).toBe(true);
  });

  it('a valid SWAP stays valid, and an invalid result stays invalid for the SAME field', () => {
    for (const block of garbage) {
      expect(validateTradeToolResult({ ...makeSwapResult(), declarations: block }).valid).toBe(true);
      const bad = validateTradeToolResult({ ...makeHoldResult({ decision: 'MAYBE' }), declarations: block });
      expect(bad.valid).toBe(false);
      expect(bad.invalidField).toBe('decision');
    }
  });

  it('the validator module still captures the declarations-off constant (source pin)', () => {
    const v = readFileSync(resolve(HERE, 'agentEvalToolResultValidation.js'), 'utf8');
    expect(v).toContain("import { TRADE_DECISION_TOOL } from './agentEvalToolSchema.js';");
    expect(v).toContain('const INPUT_SCHEMA = TRADE_DECISION_TOOL.input_schema;');
    expect(v).not.toContain('buildTradeDecisionTool');
    expect(v).not.toContain('declarations');
  });
});

describe('THE MEASUREMENT — output headroom and input cost (stated in the build report)', () => {
  // The observed distribution the ceiling was sized from (agentEvalTransport.js
  // :50-58, the DR-13 truncation baseline): mean ~907, p99 ~1,240, max ~1,421.
  const OBSERVED_MEAN = 907;
  const OBSERVED_P99 = 1240;

  it('the block at the caps serializes to 4,338 chars — 1,085 tokens at chars/4, 1,446 at chars/3', () => {
    const max = JSON.stringify(makeMaximalDeclarations());
    expect(max.length).toBe(4338);
    expect(tokens4(max)).toBe(1085);
    expect(tokens3(max)).toBe(1446);
  });

  it('a typical block (two shots, one watched name) serializes to 498 chars — 125 tokens at chars/4', () => {
    const typical = JSON.stringify(makeDeclarations());
    expect(typical.length).toBe(498);
    expect(tokens4(typical)).toBe(125);
  });

  it('THE MARGINS: typical fits with ~1,000 tokens to spare on a mean response; the maximal block can truncate a p99 response', () => {
    const max = tokens4(JSON.stringify(makeMaximalDeclarations()));
    const typical = tokens4(JSON.stringify(makeDeclarations()));
    expect(EVAL_MAX_OUTPUT_TOKENS).toBe(2048);
    expect(EVAL_MAX_OUTPUT_TOKENS - OBSERVED_MEAN - typical).toBe(1016);
    expect(EVAL_MAX_OUTPUT_TOKENS - OBSERVED_P99 - typical).toBe(683);
    expect(EVAL_MAX_OUTPUT_TOKENS - OBSERVED_MEAN - max).toBe(56);
    // NEGATIVE, stated rather than hidden: a p99 response carrying a maximal
    // block exceeds the ceiling. `declarations` is the LAST property, so a
    // truncation cuts it (and the calls validator sees a partial block) before
    // any earlier field; shadow reports each such tick as a truncation event.
    expect(EVAL_MAX_OUTPUT_TOKENS - OBSERVED_P99 - max).toBe(-277);
  });

  it('the input cost at shadow/on: +4,154 chars of tool schema ≈ 1,039 tokens at chars/4, 1,385 at chars/3, per model call; zero at off', () => {
    const delta = JSON.stringify(buildTradeDecisionTool({ declarations: true })).length - JSON.stringify(TRADE_DECISION_TOOL).length;
    // Branch review BR-3's stored-only wording: +280 chars over the C-4 text (3,874).
    expect(delta).toBe(4154);
    expect(tokens4('x'.repeat(delta))).toBe(1039);
    expect(tokens3('x'.repeat(delta))).toBe(1385);
    expect(JSON.stringify(buildTradeDecisionTool({ declarations: false })).length - JSON.stringify(TRADE_DECISION_TOOL).length).toBe(0);
  });
});
