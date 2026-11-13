// api/_utils/sharedResearch/prompt.honesty.test.js
//
// Shared Research B1 — the prompt's honesty (spec §6.8, §6.11, K-5). The
// forbidden patterns on the system prompts' own text; stepPrompt.js in the
// prompt-honesty registry; the method text equal to the rulebook's §5 byte for
// byte; the nine rules equal to the rulebook's §4 lines.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildStepSystemPrompt, buildFrameSystemPrompt, WRITTEN_OPENING_RULES, renderStepUser, targetBlockOf } from './stepPrompt.js';
import { forbiddenIn } from './stepSchema.js';
import { METHOD, METHOD_SOURCE } from './method.js';
import { PROMPT_CONTRIBUTING_MODULES, FORBIDDEN_SIGNALS } from '../__fixtures__/promptHonestyRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULEBOOK = readFileSync(resolve(HERE, '../../../docs/design/SHADOW_VOICE_RULES_V1.md'), 'utf8').replace(/\r\n/g, '\n');
const section = (heading) => {
  const start = RULEBOOK.indexOf(`\n${heading}\n`);
  if (start < 0) return null;
  const body = RULEBOOK.slice(start + heading.length + 2);
  const end = body.search(/\n## /);
  return (end < 0 ? body : body.slice(0, end)).trim();
};

describe('the system prompts\' own text', () => {
  for (const [name, text] of [['step', buildStepSystemPrompt({ partnerName: 'Rook' })], ['frame', buildFrameSystemPrompt({ partnerName: 'Rook' })], ['step, no name', buildStepSystemPrompt({})]]) {
    it(`${name}: no forbidden pattern (spec §6.4 rule 7), no forbidden signal (the C-20 list)`, () => {
      expect(forbiddenIn(text)).toEqual([]);
      for (const [label, re] of FORBIDDEN_SIGNALS) expect(re.test(text), label).toBe(false);
      expect(text).not.toMatch(/\bShadow\b/);
    });
  }
  it('names the partner by the agent document\'s name, with a fallback that is not a name', () => {
    expect(buildStepSystemPrompt({ partnerName: 'Rook' })).toMatch(/^You are Rook, the player's research partner on FantasyTrades\./);
    expect(buildStepSystemPrompt({})).toMatch(/^You are the research partner, the player's research partner/);
  });
});

describe('the registry (BUILD_RULES §1 flag-split prose rule)', () => {
  it('stepPrompt.js is a prompt-contributing module', () => {
    expect(PROMPT_CONTRIBUTING_MODULES).toContain('sharedResearch/stepPrompt.js');
  });
});

describe('the rulebook (docs/design/SHADOW_VOICE_RULES_V1.md)', () => {
  it('§5 "Baseline method v0" equals METHOD.text byte for byte', () => {
    expect(section('## 5. Baseline method v0')).toBe(METHOD.text);
    expect(METHOD).toMatchObject({ id: 'baseline', version: 'v0' });
    expect(METHOD_SOURCE).toEqual({ recordKind: 'kb', recordId: 'baseline@v0', label: 'Baseline method v0' });
  });
  it('§4 "Written openings (Shared Research)" holds the nine lines the prompts render, in order, word for word', () => {
    const lines = section('## 4. Written openings (Shared Research)').split('\n').filter((l) => /^\d+\. /.test(l));
    expect(lines).toEqual(WRITTEN_OPENING_RULES.map((r, i) => `${i + 1}. ${r}`));
    const prompt = buildStepSystemPrompt({ partnerName: 'Rook' });
    for (const l of lines) expect(prompt).toContain(l);
    expect(prompt).toContain(METHOD.text);
  });
  it('§1–3 are still the Huddle\'s (the append changed nothing above §4)', () => {
    expect(RULEBOOK.indexOf('## 1. What Shadow may say')).toBeLessThan(RULEBOOK.indexOf('## 4. Written openings (Shared Research)'));
    expect(RULEBOOK.indexOf('## 3. Where each rule is enforced')).toBeLessThan(RULEBOOK.indexOf('## 4. Written openings (Shared Research)'));
  });
});

describe('Correction B in the prompt', () => {
  it('two companies → two different target blocks, each staying inside the question', () => {
    const q = 'Which company earns from it?';
    const a = targetBlockOf({ symbol: 'ETN', relationshipFact: 'Eaton sells switchgear.', openFact: 'Share of revenue not disclosed.', question: q });
    const b = targetBlockOf({ symbol: 'GEV', relationshipFact: 'GE Vernova sells turbines.', openFact: null, question: q });
    expect(a).not.toBe(b);
    expect(a).toBe("Investigate ETN's Eaton sells switchgear. Resolve: Share of revenue not disclosed. Stay inside the question: Which company earns from it.");
    const user = renderStepUser({ question: q, entryKind: 'item', intent: 'examine', target: a, stepsLeft: 3, findings: [], items: [], retrieval: 'none' });
    expect(user).toContain(a);
  });
});
