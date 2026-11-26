// api/_utils/practiceField/playerList.test.js
//
// Practice Field build B4 — THE IDEA BOOK'S OWN PLAYER LIST (ruling B4-1) and the one parser of the founder list (B4-5):
// parsed at call time, never cached, never throws, no module-scope read, and unreachable from src/ (no client module can
// carry it). And the Film Room's seam module stays import-light: bookStore.js reaches the mode gate, this zero-import
// reader, the book-kind test and the two flag modules — never the founder controls.
//
// Dependency-surface guard (BUILD_RULES §4): the import of the reader is never mocked.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseUidList, readPracticeFieldPlayerList, readPracticeFieldFounderList, PRACTICE_FIELD_PLAYER_ENV, PRACTICE_FIELD_FOUNDER_ENV,
} from './playerList.js';
import { founderAllowlist } from './founderControls.js';
import { parseCockpitAllowlist } from '../callRecords/allowlist.js';
import { importSpecifiersOf } from '../filmRoom/__fixtures__/jsSource.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const READER = path.join(HERE, 'playerList.js');

afterEach(() => { vi.unstubAllEnvs(); });

describe('parseUidList — comma-separated, trimmed, empty → [] (the cockpit reader\'s rule)', () => {
  it.each([
    [undefined, []], [null, []], [42, []], [['a'], []], ['', []], ['   ', []], [',', []], [' , ,, ', []],
    ['uid-a', ['uid-a']], ['uid-a,uid-b', ['uid-a', 'uid-b']], [' uid-a , uid-b ,, uid-c ', ['uid-a', 'uid-b', 'uid-c']], ['\ta\n,b', ['a', 'b']],
  ])('%j → %j, frozen, and exactly as the cockpit\'s parser reads it', (raw, want) => {
    const out = parseUidList(raw);
    expect(out).toEqual(want);
    expect(Object.isFrozen(out)).toBe(true);
    expect(out).toEqual(parseCockpitAllowlist(raw));
  });
});

describe('the two readers — the environment, read at CALL time', () => {
  it('the variables are PRACTICE_FIELD_PLAYER_UIDS and MANDATE_FOUNDER_UIDS; unset reads as nobody', () => {
    expect(PRACTICE_FIELD_PLAYER_ENV).toBe('PRACTICE_FIELD_PLAYER_UIDS');
    expect(PRACTICE_FIELD_FOUNDER_ENV).toBe('MANDATE_FOUNDER_UIDS');
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, undefined);
    vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, undefined);
    expect(readPracticeFieldPlayerList()).toEqual([]);
    expect(readPracticeFieldFounderList()).toEqual([]);
  });

  it('every call reads the variable anew: set, changed, removed — each visible on the next call (no cache)', () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, 'p-1');
    expect(readPracticeFieldPlayerList()).toEqual(['p-1']);
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, 'p-1, p-2');
    expect(readPracticeFieldPlayerList()).toEqual(['p-1', 'p-2']);
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, '');
    expect(readPracticeFieldPlayerList()).toEqual([]);
  });

  it('the founder list has ONE parser: founderControls.js founderAllowlist reads it through here, for every value', () => {
    for (const raw of [undefined, '', ' , ', 'a', ' a , b ,, c ', 'a,a', '\ta\n,b']) {
      vi.stubEnv(PRACTICE_FIELD_FOUNDER_ENV, raw);
      expect(founderAllowlist(), String(raw)).toEqual([...readPracticeFieldFounderList()]);
    }
    expect(readFileSync(path.join(HERE, 'founderControls.js'), 'utf8')).not.toMatch(/process\.env/);
  });

  it('NO module-scope read and no cache: `process.env` appears only inside the two reader functions', () => {
    const src = readFileSync(READER, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const first = src.indexOf('export function readPracticeFieldPlayerList()');
    expect(first).toBeGreaterThan(0);
    expect(src.slice(0, first)).not.toMatch(/process\.env/);
    expect(src.slice(first)).toMatch(/process\.env/);
    expect(src).not.toMatch(/^(let|var) /m);
    expect(importSpecifiersOf(readFileSync(READER, 'utf8'), 'api/_utils/practiceField/playerList.js')).toEqual([]); // zero imports
  });

  it('never throws', () => {
    vi.stubEnv(PRACTICE_FIELD_PLAYER_ENV, ',,,');
    expect(() => readPracticeFieldPlayerList()).not.toThrow();
    expect(() => readPracticeFieldFounderList()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unreachable from src/: a static walk of every relative import, starting from every non-test module under src/ (the
// api/_utils/callRecords/allowlist.test.js walk).

const RESOLVE_EXT = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of RESOLVE_EXT) {
    const candidate = base + ext;
    if (existsSync(candidate) && !candidate.endsWith(path.sep) && /\.(m?js|jsx)$/.test(candidate)) return candidate;
  }
  return null;
}
const importsOf = (file) => importSpecifiersOf(readFileSync(file, 'utf8'), file).filter((s) => typeof s === 'string');
function srcModules(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) srcModules(abs, out);
    else if (/\.(m?js|jsx)$/.test(ent.name) && !/\.test\.(m?js|jsx)$/.test(ent.name) && !/\.ARCHIVED\./.test(ent.name)) out.push(abs);
  }
  return out;
}
function reachFromSrc() {
  const roots = srcModules(path.join(REPO, 'src'));
  const seen = new Set(roots);
  const parent = new Map();
  const stack = [...roots];
  while (stack.length) {
    const file = stack.pop();
    for (const spec of importsOf(file)) {
      const next = resolveImport(file, spec);
      if (!next || seen.has(next)) continue;
      seen.add(next);
      parent.set(next, file);
      stack.push(next);
    }
  }
  return { roots, seen, parent };
}

describe('the reader is unreachable from src/ (no client module can carry the player list)', () => {
  // (The walk reads every src/ module with the repo's own import parser — about 16 s on Windows: its own timeout.)
  it('no import chain from any src/ module reaches api/_utils/practiceField/playerList.js (nor mode.js, which imports it)', { timeout: 120_000 }, () => {
    const { roots, seen, parent } = reachFromSrc();
    expect(roots.length).toBeGreaterThan(100);
    const rel = new Set([...seen].map((f) => path.relative(REPO, f).split(path.sep).join('/')));
    const chain = [];
    for (let at = [...seen].find((f) => path.resolve(f) === path.resolve(READER)); at; at = parent.get(at)) chain.unshift(path.relative(REPO, at));
    expect(rel.has('api/_utils/practiceField/playerList.js'), `a client import chain reaches the player list: ${chain.join(' → ')}`).toBe(false);
    expect(rel.has('api/_utils/practiceField/mode.js')).toBe(false);
    // Not vacuous: the walk does reach the server modules the client legitimately imports.
    expect(rel.has('api/_utils/callRecords/copy.js')).toBe(true);
  });
});

describe('B4-5 — the Film Room\'s seam module stays import-light', () => {
  /** The local-import closure of `entry` (repo-relative, posix), by the repo's own import parser. */
  function closure(entry) {
    const seen = new Set();
    const stack = [entry];
    while (stack.length) {
      const rel = stack.pop();
      if (seen.has(rel)) continue;
      seen.add(rel);
      for (const spec of importSpecifiersOf(readFileSync(path.join(REPO, rel), 'utf8'), rel)) {
        if (typeof spec !== 'string' || !spec.startsWith('.')) continue;
        let target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
        if (!target.endsWith('.js') && !target.endsWith('.mjs')) target += '.js';
        if (existsSync(path.join(REPO, target))) stack.push(target);
      }
    }
    return [...seen].sort();
  }

  it('bookStore.js reaches the mode gate, the zero-import list reader, the book-kind test and the two flag modules — and never the founder controls', () => {
    expect(closure('api/_utils/practiceField/bookStore.js')).toEqual([
      'api/_utils/mandateBookKind.js',
      'api/_utils/practiceField/bookStore.js',
      'api/_utils/practiceField/mode.js',
      'api/_utils/practiceField/playerList.js',
      'src/config/practiceFieldFlags.js',
      'src/config/practiceFieldScreenFlags.js',
    ]);
  });
});
