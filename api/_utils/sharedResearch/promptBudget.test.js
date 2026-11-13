// api/_utils/sharedResearch/promptBudget.test.js
//
// Shared Research B1 — the input budget (spec §6.12 control 2). Over the soft
// cap: retrieval items go first (from the last), then the oldest findings that
// are not protected; never the question or the target. Over the hard cap after
// that: prompt_too_large, before any model call.

import { describe, it, expect } from 'vitest';
import { fitPrompt, tokensOf, SOFT_CAP_TOKENS, HARD_CAP_TOKENS, FINDINGS_RENDER_MAX, FACT_PROMPT_CHARS } from './promptBudget.js';

const finding = (i, fact = `fact ${i}`) => ({ findingId: `f${i}`, kind: 'coverage', symbol: null, status: 'verified', fact });
const item = (i, size) => ({ index: i, host: 'h', title: `t${i}`, highlights: ['x'.repeat(size), 'y'.repeat(size), 'z'.repeat(size)] });
const QUESTION = 'Q: which company earns?';
const TARGET = 'TARGET: examine ETN';
const render = ({ findings, items }) => [QUESTION, TARGET, ...findings.map((f) => `${f.findingId} ${f.fact}`), ...items.flatMap((it) => [it.title, ...it.highlights])].join('\n');

describe('fitPrompt', () => {
  it('under the soft cap nothing is trimmed; at most 40 findings, each fact cut to 200 characters in the prompt only', () => {
    const fs = Array.from({ length: 45 }, (_, i) => finding(i, 'w'.repeat(300)));
    const out = fitPrompt({ system: 'sys', findings: fs, items: [], protectedIds: [], render });
    expect(out.ok).toBe(true);
    const lines = out.user.split('\n').filter((l) => /^f\d+ /.test(l));
    expect(lines).toHaveLength(FINDINGS_RENDER_MAX);
    expect(lines[0].startsWith('f5 ')).toBe(true); // the newest 40
    expect(lines.every((l) => l.length <= `f00 `.length + FACT_PROMPT_CHARS)).toBe(true);
    expect(fs[0].fact).toHaveLength(300); // the record is untouched
  });

  it('over the soft cap: retrieval items are dropped from the last first, then the oldest unprotected findings', () => {
    const fs = Array.from({ length: 40 }, (_, i) => finding(i, 'w'.repeat(190)));
    const items = Array.from({ length: 5 }, (_, i) => item(i, 4000));
    const out = fitPrompt({ system: 's'.repeat(8000), findings: fs, items, protectedIds: ['f0', 'f1'], render });
    expect(out.ok).toBe(true);
    expect(out.tokens).toBeLessThanOrEqual(SOFT_CAP_TOKENS);
    expect(out.trimmed.items).toBeGreaterThan(0);
    expect(out.user).toContain('t0'); // the first-ranked item kept longest
    expect(out.user).not.toContain('t4');
    // Items go before any finding is dropped:
    if (out.trimmed.findings > 0) expect(out.items).toHaveLength(0);
  });

  it('protected findings (the target\'s, the summary\'s), the question and the target are never dropped', () => {
    const fs = Array.from({ length: 40 }, (_, i) => finding(i, 'w'.repeat(199)));
    const out = fitPrompt({ system: 's'.repeat(46_000), findings: fs, items: [item(0, 5000)], protectedIds: ['f0', 'f39'], render });
    expect(out.ok).toBe(true);
    expect(out.user).toContain(QUESTION);
    expect(out.user).toContain(TARGET);
    expect(out.user).toMatch(/^f0 /m);
    expect(out.user).toMatch(/^f39 /m);
    expect(out.trimmed.findings).toBeGreaterThan(0);
  });

  it('still over the hard cap after every trim → prompt_too_large (the caller makes no model call)', () => {
    const out = fitPrompt({ system: 's'.repeat(HARD_CAP_TOKENS * 4 + 4), findings: [finding(0)], items: [], protectedIds: [], render });
    expect(out).toEqual({ ok: false, error: 'prompt_too_large', tokens: expect.any(Number) });
    expect(tokensOf('abcd')).toBe(1);
  });
});
