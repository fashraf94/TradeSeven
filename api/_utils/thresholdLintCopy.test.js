// api/_utils/thresholdLintCopy.test.js
//
// THE TWO NON-FENCED COPY CORRECTIONS (row D-1).
//
// Both are sentences that describe a state the platform no longer produces, or
// a signal it never carried. Neither is fenced; both are named in Phase 0's
// "found outside the six questions" list (findings 4 and 5).
//
//   1. voiceLayerPrompt.js — DATA_CONFIDENCE_RULE told Gemma that intraday
//      signals describe "the latest available session — typically today during
//      market hours, or the prior session when EODHD's data hasn't refreshed."
//      The CAUSAL half is false: under the June 12 freshness gate
//      (agentVwapFloor.js isVwapSessionUsable, `sessionDate === todayET`) a
//      stale session is DISCARDED, not carried, so EODHD's refresh never
//      explains a Prior-session line.
//
//      The first pass DELETED the prior-session half and asserted, flatly,
//      "describe the current trading session" — which over-corrected: the
//      shipped renderer still has the branch (`buildIntradayLine`'s prefix is
//      `isToday ? "Today's session" : 'Prior session'`, false for a null or
//      legacy sessionDate as well as for any cross-date read), so the rule
//      could be contradicted by the very line it describes. It now binds to
//      that LABEL instead — the §9 display-agreement shape — and drops only
//      the false causal clause. Reworded, not deleted.
//
//   2. agentEvalToolSchema.js — the `threshold` field's own example, "If it
//      holds above the 20-day on the next test", names a level no prompt
//      renders for any symbol class: the bench trend line carries short /
//      intermediate / long LABELS and `sma200_position`, never a 20-day number
//      (Phase 0 §5, "not in the data (as a level)"). The schema was teaching
//      the decider to promise on a signal it cannot see — and the lint this
//      arc ships would then reject the model for following it.
//
// The FENCED twin of the schema example lives at agentEvalPromptAssembly.js:501
// and :704 (both variants). It is NOT edited here — it is listed for the fenced
// follow-up, and the row below pins that it is still there, so the follow-up
// cannot be quietly forgotten.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRADE_DECISION_TOOL } from './agentEvalToolSchema.js';
// Fenced (BUILD_RULES §1): READ to cite, never edited.
import { buildEvalSystemPrompt } from './agentEvalPromptAssembly.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(resolve(HERE, f), 'utf8');
const PROMPT_SRC = read('voiceLayerPrompt.js');
const FENCED_SRC = read('agentEvalPromptAssembly.js');

const thresholdField = TRADE_DECISION_TOOL.input_schema.properties.anticipationCandidates.items.properties.threshold;

describe('D-1a — DATA_CONFIDENCE_RULE is bound to the line\'s own label, and drops only the false clause', () => {
  const RULE = (() => {
    const from = PROMPT_SRC.slice(PROMPT_SRC.indexOf('const DATA_CONFIDENCE_RULE'));
    return from.slice(0, from.indexOf('`;'));
  })();

  it('the rule names the session the LINE names, not a session it assumes', () => {
    expect(RULE).toContain('Intraday signals (session VWAP, 5-min SMA20) describe the session named on the line');
    // …and it quotes the renderer's label verbatim, so the instruction is actionable
    expect(RULE).toContain('a line marked "Prior session" is yesterday\'s, not today\'s');
  });

  it('only the FALSE clause is gone — the prior-session allowance is kept, reworded', () => {
    // The causal claim is what the gate abolished: a stale session is
    // discarded, not carried, so EODHD's refresh state never explains the line.
    expect(RULE).not.toContain("EODHD's data hasn't refreshed");
    expect(RULE).not.toContain('the latest available session');
    // The ALLOWANCE itself survives — deleting it left an unconditional claim
    // the renderer can contradict.
    expect(RULE).toMatch(/prior session/i);
    expect(RULE).not.toContain('describe the current trading session');
  });

  it("the rule AGREES WITH THE RENDERER — it quotes the prefix buildIntradayLine actually emits (§9)", () => {
    // The point of the rewording: the prose is derived from what is rendered,
    // not from what the producer is currently expected to emit. If the branch
    // is ever renamed, this row reds and the prose moves with it.
    const fn = PROMPT_SRC.slice(PROMPT_SRC.indexOf('export function buildIntradayLine'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toContain("const prefix = isToday ? \"Today's session\" : 'Prior session';");
    expect(RULE).toContain('"Prior session"');
  });
});

describe('D-1b — the schema threshold example is built on an observable', () => {
  it('names the ATR band it renders for every held row, and no 20-day level', () => {
    expect(thresholdField.description).toContain('If it holds above +0.5x ATR through the next check');
    expect(thresholdField.description).not.toContain('20-day');
  });

  it('keeps the field doing its job — "Must be specific" and the too-vague counter-example', () => {
    expect(thresholdField.description).toContain('Must be specific');
    expect(thresholdField.description).toContain('"If conditions improve" is too vague');
    expect(thresholdField.type).toBe('string');
  });

  it('no 20-day level anywhere in the tool schema', () => {
    expect(read('agentEvalToolSchema.js')).not.toContain('20-day');
  });
});

describe('D-1c — the FENCED twin is untouched, and stays on the follow-up list', () => {
  it('agentEvalPromptAssembly.js still carries the 20-day example in BOTH prompt variants', () => {
    // NOT a claim that the copy is right — a claim that this build did not
    // reach into the fence. When the fenced follow-up lands it moves this row.
    const hits = [...FENCED_SRC.matchAll(/"If it holds above the 20-day on the next test" is specific/g)];
    expect(hits, 'the fenced twin at :501 and :704 — the follow-up, not this build').toHaveLength(2);
  });

  it('the C-20 honesty pin still holds: the word VWAP survives in every eval system prompt', () => {
    // agentEvalPromptAssembly.honesty.test.js:74-78 requires it. This build
    // removes the word from no fenced assembler; asserted here too so the D
    // commit carries its own proof rather than relying on a suite it did not
    // touch.
    // The honesty suite's own matrix (its ARCHETYPES × GAME_MODES), so this
    // row cannot pass on a narrower set than the pin it mirrors.
    for (const mode of ['baggerbomb_agent', 'baggerbomb_tournament']) {
      for (const archetype of ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian']) {
        expect(buildEvalSystemPrompt('TestAgent', archetype, mode, archetype), `VWAP lost from ${mode}/${archetype}`).toContain('VWAP');
      }
    }
  });
});
