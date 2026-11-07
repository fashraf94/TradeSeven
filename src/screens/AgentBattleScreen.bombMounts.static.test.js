// Research Modal Build A — the Battle View's three research mounts, at the
// source (spec §4.2; review lens C finding C1). Two of the three mounts — the
// gated held view and the gated non-held view — only render behind
// SHADOW_CPU_QUOTE_INTEGRITY_ENABLED, which ships false, so no jsdom harness of
// this build reaches them. This guard reads the screen's source (comments
// stripped) and pins, PER MOUNT, that bombContext is passed only through a
// spread gated on the per-battle Bomb mode answer, with the right identity:
// the held view by its posKey, the other two by the asset's positionId.
// The behaviour of the identity rules is agentBombContext's own rows
// (BombMode/selectBombRecord.test.js).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'AgentBattleScreen.jsx'), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

/** Each `<AssetResearchModal … />` element's text, in source order. */
const mounts = () => {
  const out = [];
  let i = SRC.indexOf('<AssetResearchModal');
  while (i !== -1) {
    const end = SRC.indexOf('/>', i);
    out.push(SRC.slice(i, end + 2));
    i = SRC.indexOf('<AssetResearchModal', end);
  }
  return out;
};

describe('the Battle View passes bombContext only when Bomb mode resolves on (§4.2)', () => {
  it('there are exactly three research mounts: held (gated), non-held (gated), legacy', () => {
    const m = mounts();
    expect(m).toHaveLength(3);
    expect(m[0]).toContain('controlledQuote={heldResearch.controlledQuote}');
    expect(m[1]).toContain('onNavigateAdmission={handleNavigateAdmission}');
    expect(m[2]).not.toContain('controlledQuote');
  });

  const SPREAD = /\{\.\.\.\(bombModeOn \? \{ bombContext: bombContextFor\(([^)]*)\) \} : \{\}\)\}/g;
  it.each([
    ['held (gated)', 0, 'heldResearch.asset.symbol, { posKey: heldResearch.controlledQuote.posKey }'],
    ['non-held (gated)', 1, 'stableResearchAsset.symbol, { positionId: stableResearchAsset.positionId ?? null }'],
    ['legacy', 2, 'stableResearchAsset.symbol, { positionId: stableResearchAsset.positionId ?? null }'],
  ])('%s mount: one spread, gated on bombModeOn, with its row identity', (_, idx, args) => {
    const m = mounts()[idx];
    const spreads = [...m.matchAll(SPREAD)];
    expect(spreads).toHaveLength(1);
    expect(spreads[0][1]).toBe(args);
    expect(m.match(/\bbombContext\b/g)).toHaveLength(1); // no ungated second path (bombContextFor is the helper's name)
  });

  it('bombModeOn is the per-battle answer (owner-keyed allowlist), and the helper builds the agent context', () => {
    expect(SRC).toMatch(/const bombModeOn = useBombModeForBattle\(agentBattleId, agentBattle\?\.ownerId \?\? null\);/);
    expect(SRC).toMatch(/const bombContextFor = \(symbol, ids = \{\}\) => agentBombContext\(agentBattle, symbol, Date\.now\(\), \{ battleId: agentBattleId, \.\.\.ids \}\);/);
  });
});
