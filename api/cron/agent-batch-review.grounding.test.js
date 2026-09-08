// api/cron/agent-batch-review.grounding.test.js
//
// Voice-layer grounding §3.4 (M3) — the post-market auto-debrief is the fifth
// agent-initiated writer (Phase 0 §2 item 4, discrepancy 9); under 'on' for
// the battle's owner it stamps the top-level `groundingVersion: 1` marker
// like the others (rulings §3: "review mode, harmless, consistent").
//
// The exchange is built by the exported, pure `buildDebriefExchange`, so the
// stamp is proved by BEHAVIOUR under each mode (review R-32 — the earlier
// source rows could not fail under a writer that stripped the marker before
// the write); one source row pins that the handler calls it with the OWNER.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { grounding } = vi.hoisted(() => ({ grounding: { mode: 'off', calls: [] } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getVoiceGroundingMode: (uid) => { grounding.calls.push(uid); return grounding.mode; },
}));

// Dependency-surface guard (BUILD_RULES §4): this file's import of the module under test is the runtime guard that its api → src imports stay Node-clean. Never mock it.
const { buildDebriefExchange } = await import('./agent-batch-review.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'agent-batch-review.js'), 'utf8');
const ARGS = { agentMessage: 'The day in review.', scratchpad: 'clean', suggestedActions: null, ownerId: 'owner-1' };

beforeEach(() => { grounding.mode = 'off'; grounding.calls = []; });

describe('agent-batch-review — the auto-debrief exchange (writer 5)', () => {
  it("'on' for the OWNER: the exchange carries the top-level marker", () => {
    grounding.mode = 'on';
    const ex = buildDebriefExchange(ARGS);
    expect(ex.groundingVersion).toBe(1);
    expect(grounding.calls).toEqual(['owner-1']);
    expect(ex).toMatchObject({ userMessage: null, agentResponse: 'The day in review.', messageType: 'auto_debrief', isAutoDebrief: true, mode: 'review', hasDirective: false, directive: null });
  });

  it.each(['off', 'shadow'])("'%s': the shipped shape — no marker key at all", (mode) => {
    grounding.mode = mode;
    const ex = buildDebriefExchange(ARGS);
    expect('groundingVersion' in ex).toBe(false);
    expect(Object.keys(ex).sort()).toEqual(['agentResponse', 'directive', 'elicitationTarget', 'hasDirective', 'isAutoDebrief', 'messageType', 'mode', 'scratchpad', 'suggestedActions', 'timestamp', 'userMessage']);
  });

  it('the handler builds the written exchange through it, with the battle OWNER, and no other marker literal exists (source row)', () => {
    expect(SRC).toContain("import { getVoiceGroundingMode } from '../../src/config/featureFlags.js';");
    expect(SRC).toContain("import { GROUNDING_VERSION } from '../_utils/voiceLayerGrounding.js';");
    // ONE call site (the definition is the other occurrence of the name).
    expect(SRC.split('const exchange = buildDebriefExchange({').length - 1).toBe(1);
    expect(SRC).toMatch(/buildDebriefExchange\(\{[^}]*ownerId: battle\.ownerId,/s);
    // The marker is written in ONE place, from the constant — never a literal `1`.
    expect(SRC.split('groundingVersion: GROUNDING_VERSION').length - 1).toBe(1);
    expect(SRC).not.toMatch(/groundingVersion:\s*1\b/);
    expect(SRC).not.toMatch(/^const .*getVoiceGroundingMode\(/m);
  });
});
