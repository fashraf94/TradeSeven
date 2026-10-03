// api/_utils/callRecords/allowlist.test.js
//
// Cockpit Build 2a — THE SERVER-SIDE ALLOWLIST (spec S-5, ruling R2A-7; §11
// "the allowlist reader (env parsed at call time; no module-scope read;
// unreachable from src/)"). Empty by default, parsed per call, and no module
// under src/ can reach it — directly or through any import chain — so the
// client bundle never carries it.
//
// Dependency-surface guard (BUILD_RULES §4): the import of the reader is never mocked.

import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCockpitAllowlist, readCockpitAllowlist, COCKPIT_ALLOWLIST_ENV } from './allowlist.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const READER = path.join(HERE, 'allowlist.js');
const BEFORE = process.env.COCKPIT_ALLOWLIST_UIDS;

afterEach(() => {
  if (BEFORE === undefined) delete process.env.COCKPIT_ALLOWLIST_UIDS;
  else process.env.COCKPIT_ALLOWLIST_UIDS = BEFORE;
});

describe('parseCockpitAllowlist — comma-separated, trimmed, empty → []', () => {
  it.each([
    [undefined, []], [null, []], [42, []], [['a'], []], ['', []], ['   ', []], [',', []], [' , ,, ', []],
    ['uid-a', ['uid-a']], ['uid-a,uid-b', ['uid-a', 'uid-b']], [' uid-a , uid-b ,, uid-c ', ['uid-a', 'uid-b', 'uid-c']],
  ])('%j → %j', (raw, want) => {
    const out = parseCockpitAllowlist(raw);
    expect(out).toEqual(want);
    expect(Object.isFrozen(out)).toBe(true);
  });
});

describe('readCockpitAllowlist — the environment, read at CALL time', () => {
  it('the variable is COCKPIT_ALLOWLIST_UIDS, and unset reads as nobody (the shipped state)', () => {
    expect(COCKPIT_ALLOWLIST_ENV).toBe('COCKPIT_ALLOWLIST_UIDS');
    delete process.env.COCKPIT_ALLOWLIST_UIDS;
    expect(readCockpitAllowlist()).toEqual([]);
  });

  it('every call reads the variable anew: set, changed, removed — each visible on the next call (a rollback is immediate)', () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = 'uid-a';
    expect(readCockpitAllowlist()).toEqual(['uid-a']);
    process.env.COCKPIT_ALLOWLIST_UIDS = 'uid-a, uid-b';
    expect(readCockpitAllowlist()).toEqual(['uid-a', 'uid-b']);
    delete process.env.COCKPIT_ALLOWLIST_UIDS;
    expect(readCockpitAllowlist()).toEqual([]);
  });

  it('NO module-scope read: `process.env` appears only inside the reader function, never at the top level', () => {
    const src = readFileSync(READER, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const body = src.slice(src.indexOf('export function readCockpitAllowlist()'));
    const outside = src.slice(0, src.indexOf('export function readCockpitAllowlist()'));
    expect(outside).not.toMatch(/process\.env/);
    expect(body).toMatch(/process\.env/);
    // And the module keeps no cache: no top-level let / var holding a list.
    expect(src).not.toMatch(/^(let|var) /m);
  });

  it('never throws', () => {
    process.env.COCKPIT_ALLOWLIST_UIDS = ',,,';
    expect(() => readCockpitAllowlist()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Unreachable from src/: a static walk of every relative import, starting from
// every non-test module under src/. A client module that imports the reader —
// or imports anything that does (mode.js, say) — fails this row.

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
const SPEC_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm;
function importsOf(file) {
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return [...src.matchAll(SPEC_RE)].map((m) => m[1] || m[2] || m[3]).filter(Boolean);
}
function srcModules(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) srcModules(abs, out);
    else if (/\.(m?js|jsx)$/.test(ent.name) && !/\.test\.(m?js|jsx)$/.test(ent.name) && !/\.ARCHIVED\./.test(ent.name)) out.push(abs);
  }
  return out;
}

describe('the reader is unreachable from src/ (no client module can carry it)', () => {
  it('no import chain from any src/ module reaches api/_utils/callRecords/allowlist.js', () => {
    const roots = srcModules(path.join(REPO, 'src'));
    expect(roots.length).toBeGreaterThan(100);
    const seen = new Set();
    const parent = new Map();
    const stack = [...roots];
    for (const r of roots) seen.add(r);
    let reached = null;
    while (stack.length && !reached) {
      const file = stack.pop();
      for (const spec of importsOf(file)) {
        const next = resolveImport(file, spec);
        if (!next || seen.has(next)) continue;
        seen.add(next);
        parent.set(next, file);
        if (path.resolve(next) === path.resolve(READER)) { reached = next; break; }
        stack.push(next);
      }
    }
    const chain = [];
    for (let at = reached; at; at = parent.get(at)) chain.unshift(path.relative(REPO, at));
    expect(reached, `a client import chain reaches the allowlist reader: ${chain.join(' → ')}`).toBeNull();
  });

  it('the walk is not vacuous: it does reach the server modules the client legitimately imports (copy.js, answers.js)', () => {
    const roots = srcModules(path.join(REPO, 'src'));
    const seen = new Set(roots);
    const stack = [...roots];
    while (stack.length) {
      const file = stack.pop();
      for (const spec of importsOf(file)) {
        const next = resolveImport(file, spec);
        if (next && !seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
    const rel = new Set([...seen].map((f) => path.relative(REPO, f).split(path.sep).join('/')));
    expect(rel.has('api/_utils/callRecords/copy.js')).toBe(true);
    expect(rel.has('api/_utils/callRecords/answers.js')).toBe(true);
    expect(rel.has('api/_utils/callRecords/mode.js')).toBe(false);
  });
});
