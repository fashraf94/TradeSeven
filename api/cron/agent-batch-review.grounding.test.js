// api/cron/agent-batch-review.grounding.test.js
//
// Voice-layer grounding §3.4 (M3) — the post-market auto-debrief is the fifth
// agent-initiated writer (Phase 0 §2 item 4, discrepancy 9); under 'on' for
// the battle's owner it stamps the top-level `groundingVersion: 1` marker
// like the others (rulings §3: "review mode, harmless, consistent").
//
// SOURCE ROWS, stated as such. processBattleReview drives a Haiku review and
// a Gemma debrief behind two live clients and the batch-review suite exercises
// only its queue logic; a behavioural row here would mean standing up both
// clients for one spread. The rows below pin the three facts the stamp needs
// — the accessor is imported, the marker constant is imported (never a
// literal), and the exchange literal spreads the stamp under the owner's
// mode — so a reworded writer reds rather than silently dropping the marker.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'agent-batch-review.js'), 'utf8');

describe('agent-batch-review — the auto-debrief stamps the grounding marker under the flag (source rows)', () => {
  it('imports the per-caller accessor and the marker constant', () => {
    expect(SRC).toContain("import { getVoiceGroundingMode } from '../../src/config/featureFlags.js';");
    expect(SRC).toContain("import { GROUNDING_VERSION } from '../_utils/voiceLayerGrounding.js';");
  });

  it("the auto_debrief exchange spreads the marker under the OWNER's mode, at call time, and nowhere else", () => {
    const exchangeStart = SRC.indexOf("messageType: 'auto_debrief',");
    expect(exchangeStart).toBeGreaterThan(0);
    const literal = SRC.slice(exchangeStart, SRC.indexOf('};', exchangeStart));
    expect(literal).toContain("...(getVoiceGroundingMode(battle.ownerId) === 'on' ? { groundingVersion: GROUNDING_VERSION } : {}),");
    expect(SRC.split('groundingVersion').length - 1).toBe(1);
    // Never a module-scope read of the mode.
    expect(SRC).not.toMatch(/^const .*getVoiceGroundingMode\(/m);
  });
});
