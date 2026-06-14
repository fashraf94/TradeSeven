// src/constants/agentGameModes.test.js
//
// P4 — battery for the gameMode-keyed mode config (founder ruling D1/D3).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this test's real import of the
// module is the runtime guard for the fenced api/ consumers' import path —
// it explodes in the Node test env if a browser-only dep ever enters the
// transitive graph. Never mock it.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TIERED_GAME_MODE,
  FLAT6_GAME_MODE,
  MODE_CONFIGS,
  resolveModeConfig,
} from './agentGameModes.js';
import { TOURNAMENT_GAME_MODE } from './leagueTournament.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('agentGameModes — identity', () => {
  it('mode strings match the schema constants and the battle-doc literal of record', () => {
    expect(TIERED_GAME_MODE).toBe('baggerbomb_agent');
    expect(FLAT6_GAME_MODE).toBe(TOURNAMENT_GAME_MODE);
    expect(FLAT6_GAME_MODE).toBe('baggerbomb_tournament');
  });

  it('imports only the zero-import schema module (Node-clean by construction)', () => {
    const source = fs.readFileSync(path.join(here, 'agentGameModes.js'), 'utf8');
    const imports = [...source.matchAll(/^import .+ from '(.+)';$/gm)].map(m => m[1]);
    expect(imports).toEqual(['./leagueTournament.js']);
  });
});

describe('agentGameModes — resolution (the invariant default)', () => {
  it('unknown, absent, and legacy gameModes all resolve to tiered', () => {
    expect(resolveModeConfig(undefined)).toBe(MODE_CONFIGS[TIERED_GAME_MODE]);
    expect(resolveModeConfig(null)).toBe(MODE_CONFIGS[TIERED_GAME_MODE]);
    expect(resolveModeConfig('')).toBe(MODE_CONFIGS[TIERED_GAME_MODE]);
    expect(resolveModeConfig('something_else')).toBe(MODE_CONFIGS[TIERED_GAME_MODE]);
    expect(resolveModeConfig('baggerbomb_agent')).toBe(MODE_CONFIGS[TIERED_GAME_MODE]);
  });

  it('the tournament stamp resolves to flat6', () => {
    expect(resolveModeConfig(TOURNAMENT_GAME_MODE)).toBe(MODE_CONFIGS[FLAT6_GAME_MODE]);
  });
});

describe('agentGameModes — the two configs', () => {
  it('tiered carries today\'s shape exactly (2/2/3, crypto mandatory, bench 3+1, no flat multiplier)', () => {
    const tiered = MODE_CONFIGS[TIERED_GAME_MODE];
    expect(tiered.portfolioSize).toBe(7);
    expect(tiered.composition).toEqual({ star: 2, core: 2, support: 3 });
    expect(tiered.cryptoMandatory).toBe(true);
    expect(tiered.benchStocks).toBe(3);
    expect(tiered.benchCrypto).toBe(true);
    expect(tiered.flatMultiplier).toBeNull();
    expect(tiered.scoringSnapshotTierMultipliers).toEqual({ star: 2.0, core: 1.5, support: 1.0 });
    expect(tiered.promptVariant).toBe('tiered');
  });

  it('flat6 carries the ruled tournament shape (6 stocks, 2/2/2 labels, no crypto, empty bench, flat 1x)', () => {
    const flat6 = MODE_CONFIGS[FLAT6_GAME_MODE];
    expect(flat6.portfolioSize).toBe(6);
    expect(flat6.composition).toEqual({ star: 2, core: 2, support: 2 });
    expect(flat6.cryptoMandatory).toBe(false);
    expect(flat6.benchStocks).toBe(0);
    expect(flat6.benchCrypto).toBe(false);
    expect(flat6.flatMultiplier).toBe(1.0);
    expect(flat6.scoringSnapshotTierMultipliers).toEqual({ star: 1.0, core: 1.0, support: 1.0 });
    expect(flat6.promptVariant).toBe('flat6');
  });

  it('configs are frozen — nothing can drift them at runtime', () => {
    expect(Object.isFrozen(MODE_CONFIGS)).toBe(true);
    expect(Object.isFrozen(MODE_CONFIGS[TIERED_GAME_MODE])).toBe(true);
    expect(Object.isFrozen(MODE_CONFIGS[FLAT6_GAME_MODE])).toBe(true);
    expect(Object.isFrozen(MODE_CONFIGS[FLAT6_GAME_MODE].composition)).toBe(true);
  });
});
