// api/_utils/mandatePromptAssembly.honesty.test.js
//
// Spec 1 §3.2 — the CLOSED PROMPT-INPUT ALLOWLIST tripwire. Two guards:
//   1. Every mandate-assembler local import is classified (contributor or
//      prose-free infra) — a new prose module cannot skip the honesty sweep.
//   2. The assembler imports NO live registry / model-config source — identity
//      comes from the PINNED vintage doc, never a live read (the §3.2 core guard).
// Plus a runtime check that assembly draws only from the declared source set and
// that identity text actually comes from the pinned vintage.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MANDATE_PROMPT_CONTRIBUTING_MODULES,
  MANDATE_PROMPT_CLASSIFIED_INFRA,
  MANDATE_FORBIDDEN_LIVE_SOURCES,
  MANDATE_PROMPT_INPUT_SOURCES,
} from './__fixtures__/mandatePromptRegistry.js';
import { assembleMandatePrompt } from './mandatePromptAssembly.js';

const DIR = resolve(import.meta.dirname);
const ASSEMBLERS = ['mandatePromptAssembly.js', 'mandateContextBlock.js'];

function localImports(src) {
  return [...src.matchAll(/from '\.\/([\w.-]+\.js)'/g)].map((m) => m[1]);
}

describe('§3.2 closed prompt-input allowlist — import classification', () => {
  it('every mandate-assembler local import is classified (no prose module skips the sweep)', () => {
    const classified = new Set([...MANDATE_PROMPT_CONTRIBUTING_MODULES, ...MANDATE_PROMPT_CLASSIFIED_INFRA]);
    let total = 0;
    for (const f of ASSEMBLERS) {
      const imps = localImports(readFileSync(resolve(DIR, f), 'utf8'));
      total += imps.length;
      for (const imp of imps) {
        expect(
          classified.has(imp),
          `${f} imports ./${imp}, classified in NEITHER mandate-prompt list — add it to `
          + 'MANDATE_PROMPT_CONTRIBUTING_MODULES (if it renders prompt text) or '
          + 'MANDATE_PROMPT_CLASSIFIED_INFRA, in the same commit (__fixtures__/mandatePromptRegistry.js).',
        ).toBe(true);
      }
    }
    expect(total, 'self-check: the assembler graph must have local imports to classify').toBeGreaterThan(0);
  });

  it('the assembler imports NO live registry / model-config source (identity from the pin only, §3.2)', () => {
    for (const f of ASSEMBLERS) {
      const imps = new Set(localImports(readFileSync(resolve(DIR, f), 'utf8')));
      for (const forbidden of MANDATE_FORBIDDEN_LIVE_SOURCES) {
        expect(imps.has(forbidden), `${f} imports ./${forbidden} — identity must come from the pinned vintage, not a live read`).toBe(false);
      }
    }
  });
});

describe('§3.2 assembly — draws only from the declared sources; identity from the pin', () => {
  const vintage = {
    codeId: 'analyst',
    displayVintage: 'Fundamental Investor v2',
    archetypeContent: {
      displayName: 'Fundamental Investor',
      identity: { disposition: 'd', reveal: 'You buy good businesses, not lottery tickets.', voice: 'I buy companies I would hold.' },
      character: { factors: { huntsFor: 'Quality first.', hardRule: 'A real quality floor.' } },
    },
    gateConfig: { cashFloorPct: 0.02, minPositions: 5, maxPositions: 15, maxSinglePositionWeightPct: 0.35, sectorConcentrationCap: 0.30, decisionVerbs: ['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD'] },
  };
  const book = { portfolio: { cash: 100000, positions: {}, totalValue: 100000, initialValue: 100000, quarterDrawdownFromPeak: 0 }, quarterStartAt: new Date('2026-07-01T00:00:00Z') };
  const snapshot = { tickKey: '2026-08-12_open30', symbols: { AAPL: { complete: true, price: 200, sector: 'Technology' }, XOM: { complete: true, price: 100, sector: 'Energy' } } };

  it('identity text comes from the pinned vintage', () => {
    const p = assembleMandatePrompt({ vintage, book, snapshot, now: new Date('2026-08-12T14:00:00Z') });
    expect(p.system).toContain('Fundamental Investor');
    expect(p.system).toContain('You buy good businesses');
    expect(p.system).toContain('IDEALIZED'); // friction honesty label survives
    expect(p.inputSources).toEqual(MANDATE_PROMPT_INPUT_SOURCES);
  });

  it('surfaces only snapshot candidates for BUY/ADD (no per-book fetch source)', () => {
    const p = assembleMandatePrompt({ vintage, book, snapshot, now: new Date('2026-08-12T14:00:00Z') });
    expect(p.messages[0].content).toContain('AAPL');
    expect(p.messages[0].content).toContain('XOM');
    expect(p.tools[0].input_schema.properties.verb.enum).toEqual(['BUY', 'SELL', 'TRIM', 'ADD', 'HOLD']);
  });

  it('enforces the token budget by trimming the candidate slate', () => {
    const bigSymbols = {};
    for (let i = 0; i < 200; i++) bigSymbols[`SYM${i}`] = { complete: true, price: 100 + i, sector: 'Technology' };
    const bigSnap = { tickKey: 't', symbols: bigSymbols };
    const p = assembleMandatePrompt({ vintage, book, snapshot: bigSnap, now: new Date('2026-08-12T14:00:00Z'), candidateCount: 200, tokenBudget: 400 });
    expect(p.tokenEstimate).toBeLessThanOrEqual(400);
    expect(p.candidateCount).toBeLessThan(200); // trimmed to fit
  });

  it('alerts (not blocks) when the base scaffold alone exceeds the budget (§6.3)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Budget too small even for the zero-candidate scaffold → alert + proceed, no throw.
    const p = assembleMandatePrompt({ vintage, book, snapshot, now: new Date('2026-08-12T14:00:00Z'), tokenBudget: 5 });
    expect(p.candidateCount).toBe(0);      // trimmed to nothing
    expect(p.messages).toHaveLength(1);    // still returns a usable prompt
    expect(spy.mock.calls.some((c) => String(c[0]).includes('MANDATE_PROMPT_BUDGET_EXCEEDED'))).toBe(true);
    spy.mockRestore();
  });
});
