// api/_utils/agentPromptAssembly.controls.test.js
//
// Release 2 PR-c — the control-render contract proven THROUGH the real fenced
// assemblies (called, never edited). This file reads the REAL (un-mocked) flags,
// so it is the §4 dependency-surface guard for the fenced → renderer/flags edges
// AND it pins production behavior under the LIVE flag values:
//   ARCHETYPE_INTEGRITY_MODE='enforce' (the directive gate) + STANDING_LEANS_ENABLED
//   =true (the leans gate). Under these ON flags a battle carrying an active
//   directive AND standing leans renders BOTH control blocks; a control-free
//   battle renders neither; and with-controls is byte-identical to control-free
//   PLUS exactly the two blocks (no stray artifact). The block BYTES are owned by
//   the renderer golden in controlPromptRenderer.test.js; here we prove the fenced
//   assemblies wire the flags + renderer correctly.
//
//   (Was the dark-rollout guard pinning the OFF/observe state. The founder-
//   intentional flag flips — ARCHETYPE_INTEGRITY_MODE observe→enforce and
//   STANDING_LEANS_ENABLED false→true — turned the rendering on, so this suite
//   was restored to the ON contract per the flag-flip-golden-restore.)
//
// buildStrategyUserPrompt is exercised directly (pure). The eval side is
// exercised through buildLiveContextBlock's CONTROL SECTION ONLY via a minimal
// fixture — heavy subsystems (institutional context, news, recent evals) receive
// empty inputs and degrade gracefully, so the control blocks are the trailing
// section (which lets the byte-identity check use control-free as an exact prefix).

import { describe, it, expect, vi } from 'vitest';
// Shared battle fixture (zero-import module — safe to load before the mocks).
import { DIRECTIVE_AT_REST, LEANS_AT_REST, makeEvalBattle, buildEvalWith } from './__fixtures__/controlsPromptFixtures.js';

// Infra seam only — fetchInstitutionalContext reaches for the Admin SDK when
// rules exist; the fixtures carry none, but the import must not boot Firebase.
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { buildStrategyUserPrompt } = await import('./agentPromptAssembly.js');
const { buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');

const buildEval = buildEvalWith(buildLiveContextBlock);

describe('PR-c controls — REAL flags (enforce / leans on): persisted controls render into the prompt', () => {
  it('a battle with an active directive AND leans renders BOTH control blocks', async () => {
    const out = await buildEval(makeEvalBattle({ directive: DIRECTIVE_AT_REST, standingLeans: LEANS_AT_REST }));
    expect(out).toContain('ACTIVE DIRECTIVE');
    expect(out).toContain(DIRECTIVE_AT_REST.text);
    expect(out).toContain('STANDING LEANS');
    expect(out).toContain(LEANS_AT_REST[0].text);
  });

  it('a control-free battle renders no control-shaped block', async () => {
    const out = await buildEval(makeEvalBattle());
    expect(out).not.toContain('ACTIVE DIRECTIVE');
    expect(out).not.toContain('STANDING LEANS');
  });

  it('BYTE-IDENTITY: the eval prompt with controls equals control-free PLUS exactly the two blocks', async () => {
    // Under live flags the prompts must differ by ONLY the two control blocks —
    // a marker check alone could miss a non-marker artifact (a blank part, a
    // suppression annotation). control-free is the exact PREFIX of with-controls
    // (the control section is the trailing block in this fixture), so the slice
    // after it is exactly the appended directive + leans blocks and nothing else.
    const withControls = await buildEval(makeEvalBattle({ directive: DIRECTIVE_AT_REST, standingLeans: LEANS_AT_REST }));
    const controlFree = await buildEval(makeEvalBattle());

    expect(withControls.startsWith(controlFree)).toBe(true);
    const delta = withControls.slice(controlFree.length);
    expect(delta).toContain('ACTIVE DIRECTIVE');
    expect(delta).toContain(DIRECTIVE_AT_REST.text);
    expect(delta).toContain('STANDING LEANS');
    expect(delta).toContain(LEANS_AT_REST[0].text);
    // control-free itself carries neither block.
    expect(controlFree).not.toContain('ACTIVE DIRECTIVE');
    expect(controlFree).not.toContain('STANDING LEANS');
  });

  it('the strategy prompt renders standing leans while STANDING_LEANS_ENABLED is true', () => {
    const withLeans = buildStrategyUserPrompt({
      name: 'Atlas',
      archetype: 'guardian',
      activeRules: [],
      standingLeans: [{ adjustmentId: 'CP-04', version: 1 }],
    });
    const without = buildStrategyUserPrompt({ name: 'Atlas', archetype: 'guardian', activeRules: [] });
    expect(withLeans).not.toBe(without);            // leans now change the prompt
    expect(withLeans).toContain('STANDING LEANS');
    expect(without).not.toContain('STANDING LEANS');
  });
});
