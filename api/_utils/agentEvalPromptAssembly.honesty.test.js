// api/_utils/agentEvalPromptAssembly.honesty.test.js
//
// C-20 PROSE HONESTY — the eval and draft prompts may only name signals the
// model is actually given.
//
// The defect this guards is subtle and was live in production: the system
// prompt instructed the model to reason from "5min RSI", "1 std below VWAP",
// "intraday range position" and "within 5% of 52W high" — none of which are
// ever supplied. buildMomentumSnapshot renders VWAP for HELD positions only,
// no indicator is computed on any intraday timeframe except sma20_5m (a
// risk-layer trail reference), and no renderer supplies 52-week-high
// proximity. A model told to use evidence it cannot see will confabulate it.
//
// BOTH DIRECTIONS ARE ASSERTED. Absence-only assertions would be satisfied by
// deleting the strategy blocks outright, which would lose real guidance — so
// the honest references are asserted to SURVIVE alongside.
//
// Dependency-surface guard (BUILD_RULES §4): this file's import of the
// assemblers is the runtime guard that they stay Node-clean. Never mock it.

import { describe, it, expect } from 'vitest';
import { buildEvalSystemPrompt } from './agentEvalPromptAssembly.js';

const ARCHETYPES = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];
// Both prompt variants: the tiered builder and the flat6 builder.
const GAME_MODES = ['baggerbomb_agent', 'baggerbomb_tournament'];

function allPrompts() {
  const out = [];
  for (const mode of GAME_MODES) {
    for (const a of ARCHETYPES) {
      out.push({ mode, archetype: a, text: buildEvalSystemPrompt('TestAgent', a, mode, a) });
    }
  }
  return out;
}

// Signals that do not exist on any running path (Signal Inventory V2 §3B).
const FORBIDDEN = [
  ['5min RSI', /5-?min\s+RSI/i],
  ['5-minute MACD', /5-?min(ute)?\s+MACD/i],
  ['VWAP sigma-band', /std\s+below\s+VWAP|standard deviation.*VWAP/i],
  ['BB width 5th pctl (of-history implication)', /BB width 5th pctl/i],
  ['intraday range position', /intraday range\s*\n?\s*position|range position/i],
  ['52-week-high proximity', /within \d+% of 52W high/i],
  ['5-min price breakout', /5-?min price breaks/i],
];

// Signals that ARE supplied and must keep appearing — the guard against
// "fixing" the prose by deleting it.
const REQUIRED = [
  ['cross-sectional BB width squeeze', /20th pctl/],
  ['rsPercentile', /rsPercentile/],
  ['NR7', /NR7/],
  ['stock regime', /directional_expansion/],
  ['RSI-14', /RSI-14/],
  ['BB %B', /BB %B/],
];

describe('C-20 prose honesty — no prompt names an absent signal', () => {
  for (const [label, re] of FORBIDDEN) {
    it(`never mentions ${label}`, () => {
      for (const { mode, archetype, text } of allPrompts()) {
        expect(re.test(text), `${label} leaked into ${mode}/${archetype}`).toBe(false);
      }
    });
  }
});

describe('C-20 prose honesty — real signals survive the fix', () => {
  for (const [label, re] of REQUIRED) {
    it(`still cites ${label}`, () => {
      for (const { mode, archetype, text } of allPrompts()) {
        expect(re.test(text), `${label} was lost from ${mode}/${archetype}`).toBe(true);
      }
    });
  }

  it('keeps all four regime strategies (S1–S4) and the cross-regime S5', () => {
    for (const { mode, archetype, text } of allPrompts()) {
      for (const s of ['S1 ', 'S2 ', 'S3 ', 'S4 ', 'S5 ']) {
        expect(text.includes(s), `${s.trim()} missing from ${mode}/${archetype}`).toBe(true);
      }
    }
  });

  it('keeps VWAP guidance, which is real for HELD positions', () => {
    for (const { mode, archetype, text } of allPrompts()) {
      expect(text.includes('VWAP'), `VWAP guidance lost from ${mode}/${archetype}`).toBe(true);
    }
  });
});

describe('source-level sweep across BOTH fenced assemblers', () => {
  // buildEvalSystemPrompt only covers the eval file. The draft/portfolio
  // assembler carried the identical institutional caveat and is fixed too;
  // assert at source level so neither file regresses.
  it('neither assembler source contains a forbidden signal name', async () => {
    const { readFileSync } = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const f of ['agentEvalPromptAssembly.js', 'agentPromptAssembly.js']) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      for (const [label, re] of FORBIDDEN) {
        expect(re.test(src), `${label} present in ${f}`).toBe(false);
      }
    }
  });
});
