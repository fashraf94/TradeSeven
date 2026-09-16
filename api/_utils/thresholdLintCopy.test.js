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
//      Since the June 12 freshness gate (agentVwapFloor.js isVwapSessionUsable,
//      `sessionDate === todayET`) a prior session is never PUBLISHED: the entry
//      is discarded, not carried. The sentence described an abolished regime.
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

describe('D-1a — DATA_CONFIDENCE_RULE no longer describes the abolished prior-session regime', () => {
  it('the source carries the current-session sentence and not the prior-session one', () => {
    expect(PROMPT_SRC).toContain('Intraday signals (session VWAP, 5-min SMA20) describe the current trading session.');
    expect(PROMPT_SRC).not.toContain("the prior session when EODHD's data hasn't refreshed");
  });

  it("the phrase 'prior session' survives ONLY in buildIntradayLine's own label, which the cron path cannot reach", () => {
    // Phase 0 finding 5 names both sites. The label at buildIntradayLine is a
    // RENDER branch on a `sessionDate` the cron no longer publishes, not a
    // sentence in the shipped prose — a separate retirement, reported not fixed
    // (BUILD_RULES §3). What this row locks is that DATA_CONFIDENCE_RULE is not
    // one of them any more.
    const rule = PROMPT_SRC.slice(PROMPT_SRC.indexOf('const DATA_CONFIDENCE_RULE'));
    expect(rule.slice(0, rule.indexOf('`;'))).not.toMatch(/prior session/i);
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
