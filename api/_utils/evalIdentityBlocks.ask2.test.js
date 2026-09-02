// api/_utils/evalIdentityBlocks.ask2.test.js
// Exit-Behavior Rebalance Tier 2, Ask 2 (rescoped) — the R8 yield clause.
//
// evalIdentityBlocks.js:58 shipped a falsehood: "Your equipped rules refine
// how you apply these principles but never reverse them" — while the engine's
// own reconciler ranks user_equipped (1) over archetype_default (2) and drops
// the losing archetype rule at decide.js:262. Founder decision 1 (2026-09-02)
// byte-locks the corrected clause below, with "exit" deliberately dropped: the
// falsehood is about ALL equipped rules, and an exit-only clause would leave
// the general falsehood standing with an exception carved out of it.
//
// Honesty fix, NOT a behavioral claim (the A9 tension, stated in the build
// record): the DR-13 harness measured decision + symbols only, so nothing here
// asserts the clause changes a decision.
//
// FLAG OFF: the pre-edit constant stays byte-locked and every render is
// byte-identical to the pre-edit goldens (ask2PromptGoldens.json @ de4113fd).
// FLAG ON: the yield clause renders after every archetype render, in both
// fenced prompt variants, and the harness splice equivalence still holds.
//
// RED-FIRST: written before the edit; watched fail against the untouched module.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { flagState } = vi.hoisted(() => ({ flagState: { precedence: false, identity: true } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get EQUIPPED_RULE_PRECEDENCE_ENABLED() { return flagState.precedence; },
  get EVAL_IDENTITY_BLOCK_ENABLED() { return flagState.identity; },
}));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const {
  EVAL_IDENTITY_BLOCKS,
  EVAL_IDENTITY_SUBORDINATION_CLAUSE,
  EVAL_IDENTITY_YIELD_CLAUSE,
  renderEvalIdentityBlock,
  spliceEvalIdentityBlock,
} = await import('./evalIdentityBlocks.js');
const { buildEvalSystemPrompt } = await import('./agentEvalPromptAssembly.js');
const { TIERED_GAME_MODE, FLAT6_GAME_MODE } = await import('../../src/constants/agentGameModes.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDENS = JSON.parse(readFileSync(join(HERE, '__fixtures__/ask2PromptGoldens.json'), 'utf8'));
const KEYS = Object.keys(EVAL_IDENTITY_BLOCKS);
const displayLabel = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const OLD_CLAUSE = 'Platform limits and enforced values override this identity. Your equipped rules refine how you apply these principles but never reverse them.';
const YIELD_CLAUSE = 'Platform limits and enforced values override this identity. Equipped rules outrank my instinct: your equipped rules decide WHETHER a trade happens; this identity shapes only HOW.';

let warnSpy;
beforeEach(() => {
  flagState.precedence = false;
  flagState.identity = true;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { warnSpy.mockRestore(); });

describe('the ruled clause text — byte-locked (founder decision 1, 2026-09-02)', () => {
  it('EVAL_IDENTITY_YIELD_CLAUSE is the approved wording verbatim', () => {
    expect(EVAL_IDENTITY_YIELD_CLAUSE).toBe(YIELD_CLAUSE);
  });

  it('carries the R8 phrase and the Ask 1 HOW/WHETHER vocabulary, and no exit-only carve-out', () => {
    expect(EVAL_IDENTITY_YIELD_CLAUSE).toContain('Equipped rules outrank my instinct');
    expect(EVAL_IDENTITY_YIELD_CLAUSE).toMatch(/WHETHER[\s\S]*only HOW/);
    expect(EVAL_IDENTITY_YIELD_CLAUSE).not.toMatch(/exit rules/i);
    expect(EVAL_IDENTITY_YIELD_CLAUSE).not.toContain('never reverse');
  });

  it('the flag-off constant stays byte-locked to the pre-edit wording (the deliberate-revert path)', () => {
    expect(EVAL_IDENTITY_SUBORDINATION_CLAUSE).toBe(OLD_CLAUSE);
  });
});

describe('FLAG OFF — byte-identical renders (goldens @ de4113fd)', () => {
  it.each(KEYS)('%s: renderEvalIdentityBlock matches the pre-edit golden and carries the old clause', (key) => {
    expect(renderEvalIdentityBlock(key)).toBe(GOLDENS.identityBlockRender[key]);
    expect(renderEvalIdentityBlock(key)).toContain(OLD_CLAUSE);
    expect(renderEvalIdentityBlock(key)).not.toContain(YIELD_CLAUSE);
  });

  it.each(KEYS)('%s: both fenced prompt variants match the pre-edit goldens', (key) => {
    expect(buildEvalSystemPrompt('TestAgent', displayLabel(key), TIERED_GAME_MODE, key)).toBe(GOLDENS.systemTiered[key]);
    expect(buildEvalSystemPrompt('TestAgent', displayLabel(key), FLAT6_GAME_MODE, key)).toBe(GOLDENS.systemFlat6[key]);
  });
});

describe('FLAG ON — the yield clause renders in every identity block (red-first)', () => {
  it.each(KEYS)('%s: exact self-delimiting block — banner, render, YIELD clause', (key) => {
    flagState.precedence = true;
    expect(renderEvalIdentityBlock(key)).toBe(
      `\n━━━ ARCHETYPE IDENTITY ━━━\n\n${EVAL_IDENTITY_BLOCKS[key].render}\n\n${YIELD_CLAUSE}\n`,
    );
    expect(renderEvalIdentityBlock(key)).not.toContain('never reverse them');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each(KEYS)('%s: both fenced prompt variants carry the clause exactly once, the old clause nowhere', (key) => {
    flagState.precedence = true;
    for (const mode of [TIERED_GAME_MODE, FLAT6_GAME_MODE]) {
      const out = buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
      expect(out.split(YIELD_CLAUSE)).toHaveLength(2);
      expect(out).not.toContain(OLD_CLAUSE);
      expect(out).toContain(`${YIELD_CLAUSE}\n\n━━━ SCORING RULES ━━━`);
    }
  });

  it('the six renders themselves are untouched — only the archetype-invariant clause changes', () => {
    flagState.precedence = true;
    for (const key of KEYS) {
      const block = renderEvalIdentityBlock(key);
      expect(block).toContain(EVAL_IDENTITY_BLOCKS[key].render);
      expect(GOLDENS.identityBlockRender[key]).toContain(EVAL_IDENTITY_BLOCKS[key].render);
    }
  });

  it.each(KEYS)('%s: harness equivalence holds under the lit clause — splice(identity-off) === identity-on', (key) => {
    flagState.precedence = true;
    for (const mode of [TIERED_GAME_MODE, FLAT6_GAME_MODE]) {
      const on = buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
      flagState.identity = false;
      const off = buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
      flagState.identity = true;
      expect(spliceEvalIdentityBlock(off, key)).toBe(on);
    }
  });

  it('unknown keys still omit the block — the omit rule is clause-independent', () => {
    flagState.precedence = true;
    expect(renderEvalIdentityBlock('unknown')).toBe('');
    expect(renderEvalIdentityBlock(undefined)).toBe('');
  });

  it('call-time resolution: the clause follows the flag between calls', () => {
    flagState.precedence = true;
    expect(renderEvalIdentityBlock('guardian')).toContain(YIELD_CLAUSE);
    flagState.precedence = false;
    expect(renderEvalIdentityBlock('guardian')).toContain(OLD_CLAUSE);
  });
});
