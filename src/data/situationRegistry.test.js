// src/data/situationRegistry.test.js
//
// Film Room B1 item 1 — the situation registry (spec §1, contract §2). The
// module must be zero-import and load under plain Node, because the tape
// writer imports it from api/ (BUILD_RULES §4); and it holds definitions and
// slot values only — no arithmetic.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITUATIONS, SITUATION_IDS, LIVE_SITUATION_IDS, SITUATION_REGISTRY_VERSION } from './situationRegistry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SOURCE = readFileSync(path.join(HERE, 'situationRegistry.js'), 'utf8');

function plainNodeLoad(rel) {
  const url = new URL(`file:///${path.join(REPO, rel).replace(/\\/g, '/')}`).href;
  const script = `import(${JSON.stringify(url)}).then(() => console.log('LOADED')).catch((e) => console.log(e.code || 'FAILED'))`;
  return execFileSync(globalThis.process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: REPO }).trim();
}

describe('the registry module — zero-import, Node-clean', () => {
  it('declares no imports', () => {
    expect(SOURCE).not.toMatch(/^\s*import\s/m);
    expect(SOURCE).not.toMatch(/\brequire\s*\(/);
  });

  it('loads under plain Node (the property api/ relies on)', () => {
    expect(plainNodeLoad('src/data/situationRegistry.js')).toBe('LOADED');
  });

  it('holds data only: no function anywhere in an entry (definitions and slots, never arithmetic)', () => {
    const walk = (v) => {
      if (typeof v === 'function') return false;
      if (v && typeof v === 'object') return Object.values(v).every(walk);
      return true;
    };
    expect(walk(SITUATIONS)).toBe(true);
  });
});

describe('the V1 entries (contract §2)', () => {
  it('stalled v1 is live; down and good_lead are reserved, with no version, definition or slots', () => {
    expect(SITUATION_IDS).toEqual(['stalled', 'down', 'good_lead']);
    expect(LIVE_SITUATION_IDS).toEqual(['stalled']);
    expect(SITUATION_REGISTRY_VERSION).toBe(1);
    for (const id of SITUATION_IDS) {
      expect(Object.keys(SITUATIONS[id]).sort(), id).toEqual(['definition', 'id', 'playerCallable', 'slots', 'title', 'version']);
      expect(SITUATIONS[id].id).toBe(id);
    }
    expect(SITUATIONS.stalled.version).toBe(1);
    expect(typeof SITUATIONS.stalled.definition).toBe('string');
    for (const id of ['down', 'good_lead']) {
      expect(SITUATIONS[id].version, id).toBeNull();
      expect(SITUATIONS[id].definition, id).toBeNull();
      expect(SITUATIONS[id].slots, id).toEqual({});
    }
  });

  it('playerCallable: stalled no; down and good_lead yes (ruling 3)', () => {
    expect(SITUATIONS.stalled.playerCallable).toBe(false);
    expect(SITUATIONS.down.playerCallable).toBe(true);
    expect(SITUATIONS.good_lead.playerCallable).toBe(true);
  });

  it('the founder slots: S1 = 2 checks; S2 = 6 checks at 0.30%', () => {
    expect(SITUATIONS.stalled.slots).toEqual({ S1: { checksBeforeRule: 2 }, S2: { checks: 6, pctThreshold: 0.003 } });
  });

  it('every entry is frozen, down to the slots', () => {
    expect(Object.isFrozen(SITUATIONS)).toBe(true);
    for (const id of SITUATION_IDS) {
      expect(Object.isFrozen(SITUATIONS[id])).toBe(true);
      expect(Object.isFrozen(SITUATIONS[id].slots)).toBe(true);
      for (const s of Object.values(SITUATIONS[id].slots)) expect(Object.isFrozen(s)).toBe(true);
    }
  });
});
