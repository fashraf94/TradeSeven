// api/_utils/evalIdentityBlocks.flagOn.test.js
//
// DR-13 Commit 1 — the ON-state shape of renderEvalIdentityBlock, with
// EVAL_IDENTITY_BLOCK_ENABLED forced true via the vi.mock getter pattern
// (release2ControlsMatrix.test.js precedent; on-file/off-file split per the
// ensure-opener.test.js / ensure-opener.flagoff.test.js precedent — the
// sibling evalIdentityBlocks.test.js keeps the flags module REAL and is the
// BUILD_RULES §4 dependency-surface guard, so this file may mock it).
//
// What this locks ahead of the Commit-2 fenced splice:
//   1. The exact block shape — leading newline, ARCHETYPE IDENTITY banner,
//      render, subordination clause, trailing newline — for all six keys.
//   2. Omit-and-log on unknown keys: '' plus one console.warn, never a
//      substituted default identity (founder-ruled; a wrong identity is
//      worse than none).
//   3. The STOP-A regression pin: a display-cased LABEL is not a key. The
//      cron must thread the raw agentContext.archetype code-id (Phase 0
//      STOP-A ruling A1) — if a label ever reaches the renderer it omits,
//      it does not guess.
//   4. Call-time flag resolution: flipping the flag between calls flips the
//      output (module-scope snapshotting would defeat both the mock and a
//      production flip).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { flagState } = vi.hoisted(() => ({ flagState: { identity: true } }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get EVAL_IDENTITY_BLOCK_ENABLED() {
    return flagState.identity;
  },
  // Exit-Behavior Ask 2 (rescoped): this file locks the DR-13 shape, so it is
  // pinned to the Ask-2-DARK branch (the subordination clause below); the
  // yield-clause shape is locked in evalIdentityBlocks.ask2.test.js. Keeps
  // this suite flip-proof (the Ask 1 §3 A8+B4 precedent).
  get EQUIPPED_RULE_PRECEDENCE_ENABLED() {
    return false;
  },
}));

const {
  EVAL_IDENTITY_BLOCKS,
  EVAL_IDENTITY_SUBORDINATION_CLAUSE,
  renderEvalIdentityBlock,
} = await import('./evalIdentityBlocks.js');

const KEYS = Object.keys(EVAL_IDENTITY_BLOCKS);

let warnSpy;
beforeEach(() => {
  flagState.identity = true;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('on-state block shape (the Commit-2 splice contract)', () => {
  it.each(KEYS)('%s: exact self-delimiting block — banner, render, clause', (key) => {
    const block = renderEvalIdentityBlock(key);
    expect(block).toBe(
      `\n━━━ ARCHETYPE IDENTITY ━━━\n\n${EVAL_IDENTITY_BLOCKS[key].render}\n\n${EVAL_IDENTITY_SUBORDINATION_CLAUSE}\n`
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('spliced between a preamble line and the first banner, the block reads as a full section', () => {
    // Mirrors the Commit-2 edit shape: `preamble\n${block}\n━━━ SCORING RULES ━━━`.
    const spliced = `maximize your score.\n${renderEvalIdentityBlock('analyst')}\n━━━ SCORING RULES ━━━`;
    expect(spliced).toContain('score.\n\n━━━ ARCHETYPE IDENTITY ━━━\n\nIDENTITY — Fundamental Investor.');
    expect(spliced).toContain(`${EVAL_IDENTITY_SUBORDINATION_CLAUSE}\n\n━━━ SCORING RULES ━━━`);
  });
});

describe('omit-and-log on unknown keys — never a substituted identity', () => {
  it("the persisted 'unknown' value omits and warns once", () => {
    expect(renderEvalIdentityBlock('unknown')).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('"unknown"');
  });

  it('a display-cased label is NOT a key (STOP-A regression pin — the cron threads the raw code-id)', () => {
    expect(renderEvalIdentityBlock('Momentum chaser')).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('undefined / prototype-chain names omit safely', () => {
    expect(renderEvalIdentityBlock(undefined)).toBe('');
    expect(renderEvalIdentityBlock('constructor')).toBe('');
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

describe('call-time flag resolution', () => {
  it('flipping the flag between calls flips the output', () => {
    expect(renderEvalIdentityBlock('guardian')).not.toBe('');
    flagState.identity = false;
    expect(renderEvalIdentityBlock('guardian')).toBe('');
    flagState.identity = true;
    expect(renderEvalIdentityBlock('guardian')).not.toBe('');
  });
});
