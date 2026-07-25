// api/_utils/evalIdentityBlock.injection.test.js
//
// DR-13 Commit 2 — the §7-signed fenced injection, tested ON. The flag is
// forced true via the vi.mock getter pattern (release2ControlsMatrix.test.js
// precedent; the fenced module is imported dynamically so the mock binds).
//
// What this locks:
//   1. The 12 on-state goldens (STOP-D ruling): one full system-prompt file
//      snapshot per archetype per variant (6 × tiered + 6 × flat6) under
//      __dr13_snapshots__/ — the flag-on texts of record.
//   2. Placement: the block sits between the preamble sentence and the
//      first ━━━ SCORING RULES ━━━ banner, in BOTH variants, byte-shaped as
//      renderEvalIdentityBlock emits it.
//   3. Harness equivalence: spliceEvalIdentityBlock(offOutput, key) ===
//      onOutput for all 12 — the offline paired-eval harness constructs
//      candidate prompts through that helper, so this is what keeps harness
//      prompts from drifting off production assembly.
//   4. Unknown-key omission + log (founder-ruled): 'unknown' (a persisted
//      value), a display-cased label (the STOP-A pin), and a missing key
//      all omit the block — output byte-identical to flag-off — and warn.
//   5. Flag-off with a valid key === flag-off without one. The committed
//      off-state texts stay locked by the P4 battery's REAL-flag snapshots
//      (p4Equivalence.battery.test.js:368-396) — deliberately not
//      re-snapshotted here.
//
// The firebaseAdmin vi.mock is the established infra seam (the fenced module
// imports it at top level; nothing here calls into Firestore).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { flagState } = vi.hoisted(() => ({ flagState: { identity: true } }));

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get EVAL_IDENTITY_BLOCK_ENABLED() {
    return flagState.identity;
  },
}));
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { buildEvalSystemPrompt } = await import('./agentEvalPromptAssembly.js');
const {
  EVAL_IDENTITY_BLOCKS,
  renderEvalIdentityBlock,
  spliceEvalIdentityBlock,
} = await import('./evalIdentityBlocks.js');
const { TIERED_GAME_MODE, FLAT6_GAME_MODE } = await import('../../src/constants/agentGameModes.js');

const KEYS = Object.keys(EVAL_IDENTITY_BLOCKS);
const VARIANTS = [
  ['tiered', TIERED_GAME_MODE, ''],
  ['flat6', FLAT6_GAME_MODE, 'flat6.'],
];
const GRID = VARIANTS.flatMap(([variant, mode, snapInfix]) =>
  KEYS.map((key) => [variant, key, mode, snapInfix])
);

// Mirrors the cron's display transform (agent-evaluate.js) — the label that
// flows through the 2nd parameter in production.
const displayLabel = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

let warnSpy;
beforeEach(() => {
  flagState.identity = true;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('DR-13 on-state goldens — 12 full prompt snapshots (6 archetypes × 2 variants)', () => {
  it.each(GRID)('%s / %s: flag-on system prompt matches its golden snapshot', async (variant, key, mode, snapInfix) => {
    const out = buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
    await expect(out).toMatchFileSnapshot(
      `./__dr13_snapshots__/buildEvalSystemPrompt.identityOn.${snapInfix}${key}.snap.txt`
    );
  });
});

describe('placement + shape — the block frames the rules in BOTH variants', () => {
  it.each(GRID)('%s / %s: block sits between the preamble and the first banner', (variant, key, mode) => {
    const out = buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
    const block = renderEvalIdentityBlock(key);

    expect(block).not.toBe('');
    // Exactly the renderer's bytes, spliced where the blank line was:
    // preamble line, then the self-delimiting block, then the first banner.
    expect(out).toContain(`maximize your score.\n${block}\n━━━ SCORING RULES ━━━`);
    // The block precedes every banner — identity frames rules.
    expect(out.indexOf('━━━ ARCHETYPE IDENTITY ━━━')).toBeLessThan(out.indexOf('━━━ SCORING RULES ━━━'));
    // One block, no duplicates.
    expect(out.split('━━━ ARCHETYPE IDENTITY ━━━')).toHaveLength(2);
  });

  it('both variants carry the identical block for the same key (STOP-D)', () => {
    for (const key of KEYS) {
      const tiered = buildEvalSystemPrompt('TestAgent', displayLabel(key), TIERED_GAME_MODE, key);
      const flat6 = buildEvalSystemPrompt('TestAgent', displayLabel(key), FLAT6_GAME_MODE, key);
      const block = renderEvalIdentityBlock(key);
      expect(tiered).toContain(block);
      expect(flat6).toContain(block);
    }
  });
});

describe('harness equivalence — spliceEvalIdentityBlock reproduces the fenced splice', () => {
  it.each(GRID)('%s / %s: splice(flag-off output) === flag-on output', (variant, key, mode) => {
    const on = buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
    flagState.identity = false;
    const off = buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
    flagState.identity = true;

    expect(spliceEvalIdentityBlock(off, key)).toBe(on);
  });
});

describe('unknown-key omission + log — never a substituted identity', () => {
  it.each(VARIANTS)("%s: the persisted 'unknown' value omits the block and warns", (variant, mode) => {
    const out = buildEvalSystemPrompt('TestAgent', 'Unknown', mode, 'unknown');
    expect(out).not.toContain('━━━ ARCHETYPE IDENTITY ━━━');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('"unknown"');
  });

  it('a display-cased label in the key slot omits (STOP-A pin — labels are not keys)', () => {
    const out = buildEvalSystemPrompt('TestAgent', 'Momentum chaser', TIERED_GAME_MODE, 'Momentum chaser');
    expect(out).not.toContain('━━━ ARCHETYPE IDENTITY ━━━');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a missing key (legacy caller shape) omits and equals the omitted-arg output', () => {
    const withUndefined = buildEvalSystemPrompt('TestAgent', 'Analyst', TIERED_GAME_MODE, undefined);
    const withoutArg = buildEvalSystemPrompt('TestAgent', 'Analyst', TIERED_GAME_MODE);
    expect(withUndefined).not.toContain('━━━ ARCHETYPE IDENTITY ━━━');
    expect(withUndefined).toBe(withoutArg);
  });
});

describe('flag-off — key threading is inert while dark', () => {
  it('flag-off with a valid key is byte-identical to flag-off without one, both variants', () => {
    flagState.identity = false;
    for (const [, mode] of VARIANTS) {
      const withKey = buildEvalSystemPrompt('TestAgent', 'Analyst', mode, 'analyst');
      const withoutKey = buildEvalSystemPrompt('TestAgent', 'Analyst', mode);
      expect(withKey).toBe(withoutKey);
      expect(withKey).not.toContain('━━━ ARCHETYPE IDENTITY ━━━');
    }
    expect(warnSpy).not.toHaveBeenCalled();
    // The off-state text of record itself stays locked by the P4 battery's
    // real-flag file snapshots — not duplicated here.
  });
});
