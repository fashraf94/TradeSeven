// Research Modal Build C — the Battle View's three research mounts and the
// cockpit bench door, at the source (spec §4.2, BC-11). Two of the three mounts
// render only behind SHADOW_CPU_QUOTE_INTEGRITY_ENABLED (ships false), so no
// jsdom harness reaches them (Build A's AgentBattleScreen.bombMounts.static.test.js
// says the same). This guard reads the screen's source (comments stripped) and
// pins, PER MOUNT, that sheetContext is passed only through a spread gated on
// the per-battle sheet answer, with the right row identity; and that the bench
// door — and only the bench door — carries the incumbent.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'AgentBattleScreen.jsx'), 'utf8').replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

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

describe('the Battle View passes sheetContext only when the sheet resolves on (§4.2)', () => {
  const SPREAD = /\{\.\.\.\(sheetModeOn \? \{ sheetContext: sheetContextFor\(([^)]*\)?)\) \} : \{\}\)\}/g;
  it.each([
    ['held (gated)', 0, 'heldResearch.asset.symbol, { posKey: heldResearch.controlledQuote.posKey }, true'],
    ['non-held (gated)', 1, 'stableResearchAsset.symbol, { positionId: stableResearchAsset.positionId ?? null }'],
    ['legacy', 2, 'stableResearchAsset.symbol, { positionId: stableResearchAsset.positionId ?? null }'],
  ])('%s mount: one spread, gated on sheetModeOn, with its row identity', (_, idx, args) => {
    const m = mounts()[idx];
    const spreads = [...m.matchAll(SPREAD)];
    expect(spreads).toHaveLength(1);
    expect(spreads[0][1]).toBe(args);
    expect(m.match(/\bsheetContext\b/g)).toHaveLength(1);
  });
  it('sheetModeOn is the per-battle answer (owner-keyed allowlist)', () => {
    expect(SRC).toMatch(/const sheetModeOn = useSheetModeForBattle\(agentBattleId, agentBattle\?\.ownerId \?\? null\);/);
  });
  it('the context is the screen\'s own: the subscribed battle, the header\'s pair, THIS TURN\'s directive, the cockpit door only when on', () => {
    const helper = SRC.slice(SRC.indexOf('const sheetContextFor = '), SRC.indexOf('});', SRC.indexOf('const sheetContextFor = ')) + 3);
    expect(helper).toContain('battle: agentBattle,');
    expect(helper).toContain('directive: thisTurnDirective,');
    expect(helper).toContain('{ player: comparison.pair[0], opponent: comparison.pair[1], digits: comparison.fractionDigits ?? 0 }');
    expect(helper).toContain('{ player: displayPlayerScore, opponent: displayOpponentScore, digits: 0 }');
    expect(helper).toContain("...(sheetCockpitDoor ? { onOpenCockpit: sheetCockpitDoor } : {}),");
    expect(helper).toContain('...(sheetIncumbent && sheetIncumbent.symbol === symbol ? { incumbent: sheetIncumbent.incumbent } : {}),');
    expect(SRC).toMatch(/const sheetCockpitDoor = cockpitOn && \(isDesktop \|\| phoneCockpit\)/);
  });
});

describe('every other mount is unchanged: no file but the Battle View hands the modal a sheetContext', () => {
  it('a walk of src/ (tests and fixtures excluded) finds `sheetContext=` on a research mount in AgentBattleScreen.jsx alone', async () => {
    const { readdirSync } = await import('node:fs');
    const SRC_ROOT = path.join(HERE, '..');
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__fixtures__' && e.name !== 'smoke') walk(p); } else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
      }
    };
    walk(SRC_ROOT);
    expect(files.length).toBeGreaterThan(500);
    const passing = files.filter((f) => /sheetContext:\s*sheetContextFor|sheetContext=\{/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(SRC_ROOT, f).replace(/\\/g, '/'));
    expect(passing).toEqual(['screens/AgentBattleScreen.jsx']);
  });
});

describe('BC-11 — the bench door, and only the bench door, carries the incumbent', () => {
  it('the bench sheet\'s research door is the incumbent handler when the sheet is on, the shared door otherwise', () => {
    expect(SRC).toContain('onResearch={sheetModeOn ? handleCockpitBenchResearch : handleCockpitSymbol}');
    expect((SRC.match(/onResearch=\{/g) || []).filter(Boolean).length).toBeGreaterThan(0);
  });
  it('the Monitoring onSymbolClick doors keep the shared door', () => {
    const doors = SRC.match(/onSymbolClick=\{handleCockpitSymbol\}/g) || [];
    expect(doors.length).toBe(2);
    expect(SRC).not.toMatch(/onSymbolClick=\{handleCockpitBenchResearch\}/);
  });
  it('the handler takes the incumbent from the bench call through incumbentOfCall, then opens research as the shared door does', () => {
    const h = SRC.slice(SRC.indexOf('const handleCockpitBenchResearch = '), SRC.indexOf('};', SRC.indexOf('const handleCockpitBenchResearch = ')) + 2);
    expect(h).toContain('incumbentOfCall(cockpitBenchCall, symbol)');
    expect(h).toContain('handleCockpitSymbol(symbol);');
    expect(SRC).toMatch(/if \(!cockpitResearchOpen && sheetIncumbent\) setSheetIncumbent\(null\);/);
  });
});
