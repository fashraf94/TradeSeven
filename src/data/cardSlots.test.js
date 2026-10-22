// src/data/cardSlots.test.js
//
// Film Room B2 item 2 — the card's founder slots S9 and S10 (spec §10;
// Amendment G RG-8), in their own zero-import, versioned module — never in the
// situation registry, whose version every tape stores.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_SLOTS, CARD_SLOTS_VERSION } from './cardSlots.js';
import { SITUATIONS, SITUATION_REGISTRY_VERSION } from './situationRegistry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SOURCE = readFileSync(path.join(HERE, 'cardSlots.js'), 'utf8');
const REGISTRY_SOURCE = readFileSync(path.join(HERE, 'situationRegistry.js'), 'utf8');

function plainNodeLoad(rel) {
  const url = new URL(`file:///${path.join(REPO, rel).replace(/\\/g, '/')}`).href;
  const script = `import(${JSON.stringify(url)}).then(() => console.log('LOADED')).catch((e) => console.log(e.code || 'FAILED'))`;
  return execFileSync(globalThis.process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: REPO }).trim();
}

describe('the slots module — zero-import, Node-clean, data only', () => {
  it('declares no imports and loads under plain Node', () => {
    expect(SOURCE).not.toMatch(/^\s*import\s/m);
    expect(SOURCE).not.toMatch(/\brequire\s*\(/);
    expect(plainNodeLoad('src/data/cardSlots.js')).toBe('LOADED');
  });
  it('holds data only, frozen down to each slot', () => {
    const walk = (v) => (typeof v === 'function' ? false : v && typeof v === 'object' ? Object.values(v).every(walk) : true);
    expect(walk(CARD_SLOTS)).toBe(true);
    expect(Object.isFrozen(CARD_SLOTS)).toBe(true);
    expect(Object.isFrozen(CARD_SLOTS.S9)).toBe(true);
    expect(Object.isFrozen(CARD_SLOTS.S10)).toBe(true);
  });
});

describe('RG-8 — the values, the version, and where they do not live', () => {
  it('S9 = 5 open cards per agent; S10 = 280 characters; version 1', () => {
    expect(CARD_SLOTS).toEqual({ S9: { openCardsPerAgent: 5 }, S10: { noteMaxChars: 280 } });
    expect(CARD_SLOTS_VERSION).toBe(1);
  });
  it('the situation registry holds neither slot and its version did not move (every tape stores it)', () => {
    expect(SITUATIONS.stalled.slots).toEqual({ S1: { checksBeforeRule: 2 }, S2: { checks: 6, pctThreshold: 0.003 } });
    expect(REGISTRY_SOURCE).not.toMatch(/\bS9\b|\bS10\b/);
    expect(SITUATION_REGISTRY_VERSION).toBe(2);
  });
});
