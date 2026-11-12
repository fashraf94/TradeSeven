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

// Bomb mode refinement BD-7 (2026-11-10; review C8, 2026-11-11): the gated mounts render only behind
// SHADOW_CPU_QUOTE_INTEGRITY_ENABLED (dark), so the "See all levels ›" door's reach is pinned here at the source.
describe('BD-7 — the levels door reaches every mount, gated on bombModeOn, keyed to that mount\'s own symbol', () => {
  const DOOR = /\{\.\.\.\(bombModeOn && bombLevelsDoor === ([^?]+?) \? \{ opensOnBomb: true \} : \{\}\)\}/g;
  it.each([
    ['held (gated)', 0, 'heldResearch.asset.symbol'],
    ['non-held (gated)', 1, 'stableResearchAsset.symbol'],
    ['legacy', 2, 'stableResearchAsset.symbol'],
  ])('%s mount: one opensOnBomb spread, gated on bombModeOn, for its own symbol', (_, idx, sym) => {
    const spreads = [...mounts()[idx].matchAll(DOOR)];
    expect(spreads).toHaveLength(1);
    expect(spreads[0][1].trim()).toBe(sym);
  });
  it('the door opens research through the gated admission with the player\'s side on the gated path, the shipped door otherwise', () => {
    const start = SRC.indexOf('const handleSeeAllLevels');
    const fn = SRC.slice(start, SRC.indexOf('\n  };', start));
    expect(fn).toContain('setBombLevelsDoor(symbol);');
    expect(fn).toContain("if (gatedPath) handleGatedSymbolClick(asset, { side: 'player' });");
    expect(fn).toContain('else handleSymbolClick(asset);');
  });
  it('the row receives the door only when Bomb mode is on', () => {
    expect(SRC).toMatch(/\{\.\.\.\(bombModeOn && whyable \? \{ onSeeAllLevels: handleSeeAllLevels \} : \{\}\)\}/);
  });
});
