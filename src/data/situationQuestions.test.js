// src/data/situationQuestions.test.js
//
// Film Room B2 item 2 — the question menu (spec §1, §10; Amendment G RG-8,
// founder slot S11). Zero-import and Node-clean like the registry, data only,
// and the three `stalled` questions word for word from spec §1 — read from the
// spec file, never retyped here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITUATION_QUESTIONS, SITUATION_QUESTIONS_VERSION } from './situationQuestions.js';
import { LIVE_SITUATION_IDS, SITUATION_REGISTRY_VERSION } from './situationRegistry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SOURCE = readFileSync(path.join(HERE, 'situationQuestions.js'), 'utf8');

function plainNodeLoad(rel) {
  const url = new URL(`file:///${path.join(REPO, rel).replace(/\\/g, '/')}`).href;
  const script = `import(${JSON.stringify(url)}).then(() => console.log('LOADED')).catch((e) => console.log(e.code || 'FAILED'))`;
  return execFileSync(globalThis.process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: REPO }).trim();
}

/** Spec §1's three questions, as the spec writes them: "- `id` — \"text\"". */
function specQuestions() {
  const doc = readFileSync(path.join(REPO, 'docs/specs/FILM_ROOM_BUILD_B_CARD_SPEC_V1_20261010.md'), 'utf8').replace(/\r\n/g, '\n');
  const out = [];
  for (const m of doc.matchAll(/^ {2}- `(stalled\.[a-z]+)` — "([^"\n]+)"$/gm)) out.push({ id: m[1], text: m[2] });
  return out;
}

describe('the menu module — zero-import, Node-clean, data only', () => {
  it('declares no imports', () => {
    expect(SOURCE).not.toMatch(/^\s*import\s/m);
    expect(SOURCE).not.toMatch(/\brequire\s*\(/);
  });
  it('loads under plain Node (api/ relies on it)', () => {
    expect(plainNodeLoad('src/data/situationQuestions.js')).toBe('LOADED');
  });
  it('holds data only: no function anywhere, every entry frozen', () => {
    const walk = (v) => (typeof v === 'function' ? false : v && typeof v === 'object' ? Object.values(v).every(walk) : true);
    expect(walk(SITUATION_QUESTIONS)).toBe(true);
    expect(Object.isFrozen(SITUATION_QUESTIONS)).toBe(true);
    for (const q of SITUATION_QUESTIONS) expect(Object.isFrozen(q), q.id).toBe(true);
  });
});

describe('S11 — the three stalled questions, word for word from spec §1', () => {
  it('ids, order and text equal the spec file\'s', () => {
    const spec = specQuestions();
    expect(spec.map((q) => q.id)).toEqual(['stalled.want', 'stalled.whose', 'stalled.ready']);
    expect(SITUATION_QUESTIONS.map((q) => ({ id: q.id, text: q.text }))).toEqual(spec);
  });
  it('every entry: { id, version, situationId, text } — version 1, for a live situation of the registry', () => {
    expect(SITUATION_QUESTIONS_VERSION).toBe(1);
    for (const q of SITUATION_QUESTIONS) {
      expect(Object.keys(q).sort(), q.id).toEqual(['id', 'situationId', 'text', 'version']);
      expect(q.version, q.id).toBe(1);
      expect(LIVE_SITUATION_IDS, q.id).toContain(q.situationId);
      expect(q.id.startsWith(`${q.situationId}.`), q.id).toBe(true);
      expect(typeof q.text === 'string' && q.text.length > 0, q.id).toBe(true);
    }
    expect(new Set(SITUATION_QUESTIONS.map((q) => q.id)).size).toBe(3);
  });
  it('RG-8: the menu lives apart from the registry — the registry\'s version did not move for it', () => {
    expect(SITUATION_REGISTRY_VERSION).toBe(2);
  });
});
