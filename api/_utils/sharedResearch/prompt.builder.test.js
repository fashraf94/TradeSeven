// api/_utils/sharedResearch/prompt.builder.test.js
//
// Shared Research B3 — THE BUILDER'S PROMPT AND THE RULEBOOK §6 (Amendment B
// §B5; K-6). THESIS_BUILDER_RULES equals the rulebook's §6 byte for byte (the
// §4/§5 precedent); the builder's system prompt carries §4 without its line (7),
// §6 and the method block as today; its own text passes the forbidden patterns;
// §1–§5 are untouched by the append; the ledger's prompts are not changed (their
// byte pins live in prompt.honesty.test.js and session.kb1.test.js, unedited).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  THESIS_BUILDER_RULES, BUILDER_OPENING_RULES, WEAKEST_LINK_RULE_INDEX, WRITTEN_OPENING_RULES, buildBuildSystemPrompt, renderBuildUser, methodBlockOf,
} from './stepPrompt.js';
import { forbiddenIn, promisesService } from './stepSchema.js';
import { BASELINE } from './method.js';
import { FORBIDDEN_SIGNALS } from '../__fixtures__/promptHonestyRegistry.js';
import { emptyCard } from './thesis.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULEBOOK = readFileSync(resolve(HERE, '../../../docs/design/SHADOW_VOICE_RULES_V1.md'), 'utf8').replace(/\r\n/g, '\n');
const section = (heading) => {
  const start = RULEBOOK.indexOf(`\n${heading}\n`);
  if (start < 0) return null;
  const body = RULEBOOK.slice(start + heading.length + 2);
  const end = body.search(/\n## /);
  return (end < 0 ? body : body.slice(0, end)).trim();
};

describe('the rulebook §6 (K-6)', () => {
  it('"The thesis builder" equals THESIS_BUILDER_RULES byte for byte', () => {
    expect(section('## 6. The thesis builder')).toBe(THESIS_BUILDER_RULES);
  });
  it('is appended after §5: the six sections in order, §4\'s line (7) still the weakest-link line', () => {
    const order = ['## 1. What Shadow may say', '## 3. Where each rule is enforced', '## 4. Written openings (Shared Research)', '## 5. Baseline method v0', '## 6. The thesis builder'].map((h) => RULEBOOK.indexOf(h));
    expect(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1]))).toBe(true);
    expect(WRITTEN_OPENING_RULES[WEAKEST_LINK_RULE_INDEX]).toBe('One next action, aimed at the weakest link in the chain.');
  });
});

describe('the builder\'s system prompt (§B5)', () => {
  const p = buildBuildSystemPrompt({ partnerName: 'Atlas' });
  it('carries §4 without its line (7), renumbered, then §6, then the method block as today', () => {
    expect(BUILDER_OPENING_RULES).toEqual(WRITTEN_OPENING_RULES.filter((_, i) => i !== 6));
    BUILDER_OPENING_RULES.forEach((r, i) => expect(p).toContain(`${i + 1}. ${r}`));
    expect(p).not.toContain('weakest link');
    expect(p).toContain(`The thesis builder:\n${THESIS_BUILDER_RULES}`);
    expect(p).toContain(`Method:\n${methodBlockOf(BASELINE)}`);
    expect(p.indexOf('The thesis builder:')).toBeLessThan(p.indexOf('Method:'));
  });
  it('a KB method turn carries the KB wrapper, as the ledger\'s does', () => {
    const kb = { id: 'KB-X', version: '0.1', sha256: 'a'.repeat(64), source: 'kb', text: 'KB TEXT', title: 'T', acceptedAt: '2026-11-13' };
    expect(buildBuildSystemPrompt({ partnerName: 'Atlas', method: kb })).toContain(methodBlockOf(kb));
  });
  for (const [name, text] of [['Atlas', p], ['no name', buildBuildSystemPrompt({})], ['§6 alone', THESIS_BUILDER_RULES]]) {
    it(`${name}: no forbidden pattern, no forbidden signal, no service promise, no "Shadow"`, () => {
      expect(forbiddenIn(text)).toEqual([]);
      for (const [label, re] of FORBIDDEN_SIGNALS) expect(re.test(text), label).toBe(false);
      expect(promisesService(text, 'Atlas')).toBe(false);
      expect(text).not.toMatch(/\bShadow\b/);
    });
  }
});

describe('the builder\'s user turn', () => {
  const card = emptyCard();
  card.theme = { state: 'set', value: 'AI and QZXW', by: 'player_wrote', suggestion: null };
  const render = (over = {}) => renderBuildUser({
    question: 'Build a thesis on: AI', entryKind: 'observation', goal: 'map_segments', card, supported: [], stepsLeft: 8,
    findings: [], items: [], retrieval: 'items', ...over,
  });
  it('names the goal, carries the card, and masks a ticker the universe does not hold in the player\'s words (FQ-14)', () => {
    const u = render();
    expect(u).toContain('This step: map the theme into two to five segments');
    expect(u).toContain('Theme: AI and (symbol not in the app\'s records) (the player wrote it)');
    expect(u).not.toContain('QZXW');
  });
  it('a pick turn says it made no search', () => {
    expect(render({ goal: 'pick', part: 'segment', retrieval: 'none' })).toContain('Retrieved items: none (a pick makes no search)');
  });
  it('the direction is the player\'s, and steers only this step', () => {
    const u = render({ goal: 'direction', direction: 'look at power' });
    expect(u).toContain("The player's direction (their words): look at power");
    expect(u).toContain('it never changes the theme');
  });
});
