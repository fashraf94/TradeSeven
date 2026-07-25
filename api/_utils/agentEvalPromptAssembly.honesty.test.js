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
// F2 (PR-A review, founder-ruled Jul 25 2026): the signal lists and the
// module registry live in ONE fixture so this file and the flag-on render
// tests cannot drift apart on what "honest" means.
import {
  FORBIDDEN_SIGNALS as FORBIDDEN,
  REQUIRED_SIGNALS as REQUIRED,
  PROMPT_CONTRIBUTING_MODULES,
  CLASSIFIED_NON_REGISTRY_IMPORTS,
} from './__fixtures__/promptHonestyRegistry.js';

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

describe('source-level sweep across every PROMPT_CONTRIBUTING_MODULE (F2)', () => {
  // buildEvalSystemPrompt only covers the eval file's system prompt. The
  // sweep is source-level so the whole registry is guarded regardless of
  // which builder or flag state renders it: both fenced assemblers PLUS the
  // flag-split prose modules the DR-13 pattern moves out of them.
  it('no registry module source contains a forbidden signal name', async () => {
    const { readFileSync } = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const f of PROMPT_CONTRIBUTING_MODULES) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      for (const [label, re] of FORBIDDEN) {
        expect(re.test(src), `${label} present in ${f}`).toBe(false);
      }
    }
  });

  // THE TRIPWIRE (F2, founder-ruled; BUILD_RULES §1 flag-split prose rule):
  // every same-directory module either fenced assembler imports must be
  // classified — swept (PROMPT_CONTRIBUTING_MODULES) or explicitly known
  // (CLASSIFIED_NON_REGISTRY_IMPORTS). A new flag-split render module added
  // to a fenced file without registry membership fails HERE, not silently.
  it('every fenced-assembler local import is classified — a new prose module cannot skip the sweep', async () => {
    const { readFileSync } = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const classified = new Set([...PROMPT_CONTRIBUTING_MODULES, ...CLASSIFIED_NON_REGISTRY_IMPORTS]);
    for (const f of ['agentEvalPromptAssembly.js', 'agentPromptAssembly.js']) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      const locals = [...src.matchAll(/from '\.\/([\w.-]+\.js)'/g)].map((m) => m[1]);
      expect(locals.length).toBeGreaterThan(0);
      for (const imp of locals) {
        expect(
          classified.has(imp),
          `${f} imports ./${imp}, which is classified in NEITHER honesty-registry list. `
          + 'If it renders prompt prose (any flag-split module does), add it to '
          + 'PROMPT_CONTRIBUTING_MODULES; otherwise add it to '
          + 'CLASSIFIED_NON_REGISTRY_IMPORTS — in the SAME commit '
          + '(__fixtures__/promptHonestyRegistry.js; BUILD_RULES §1).'
        ).toBe(true);
      }
    }
  });
});
