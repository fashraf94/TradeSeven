// src/components/starfield.importguard.test.js
//
// Acceptance row A6 — THE STARFIELD ADDS NO DATA READ.
// Delight Layer arc, Task 2 (Phase 3). Spec V2 §6, ruling R-T2-S1.
//
// The whole live-wiring design rests on one promise: the sky is a PROJECTION of
// state App.jsx already polls for the "No battle live" card, never a second
// source. If the starfield ever grew a listener or poll of its own, two things
// break at once — the zero-new-reads guarantee, and the §9 display-agreement
// property that keeps the sky and that card from contradicting each other.
//
// This is a TRANSITIVE guard, not a grep of three files. It walks the real
// import graph from each entry point and checks every module it can reach, so a
// read smuggled in one hop away (a helper that imports firebase, say) still
// fails. A flat text check over the entry files would miss exactly that.
//
// Pure node env: reads source from disk, imports nothing under test.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Everything the starfield is allowed to pull in, transitively. */
const ENTRY_POINTS = [
  'StarfieldBackground.jsx',
  'warpBattleAdapter.js',
  'warpStateMachine.js',
].map((f) => path.join(HERE, f));

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Static + dynamic import specifiers. */
function importSpecifiers(code) {
  const specs = [];
  const patterns = [
    /(?:^|\n)\s*import\s+[^'"]*?from\s+['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m = re.exec(code);
    while (m !== null) {
      specs.push(m[1]);
      m = re.exec(code);
    }
  }
  return specs;
}

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`,
    path.join(base, 'index.js'), path.join(base, 'index.jsx'),
  ];
  return candidates.find((c) => existsSync(c) && !c.endsWith(path.sep)) || null;
}

/** Transitive closure of first-party modules reachable from the entry points. */
function reachableModules() {
  const seen = new Map();      // absolute path -> stripped source
  const bareImports = new Set(); // non-relative specifiers, e.g. 'react'
  const queue = [...ENTRY_POINTS];

  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    const code = stripComments(readFileSync(file, 'utf8'));
    seen.set(file, code);

    for (const spec of importSpecifiers(code)) {
      if (spec.startsWith('.')) {
        const resolved = resolveRelative(file, spec);
        expect(resolved, `unresolvable import ${spec} from ${file}`).not.toBeNull();
        if (!seen.has(resolved)) queue.push(resolved);
      } else {
        bareImports.add(spec);
      }
    }
  }
  return { seen, bareImports };
}

const rel = (p) => path.relative(path.join(HERE, '..', '..'), p);

describe('A6 — no Firestore anywhere in the starfield import graph', () => {
  const { seen, bareImports } = reachableModules();

  it('reaches a non-trivial graph (the guard is actually walking something)', () => {
    // Guards against a silently-empty scan making every row below vacuous.
    expect(seen.size).toBeGreaterThanOrEqual(ENTRY_POINTS.length);
    for (const entry of ENTRY_POINTS) expect(seen.has(entry)).toBe(true);
  });

  it('imports no firebase package, at any depth', () => {
    const offenders = [...bareImports].filter((s) => /^firebase(\/|$)/.test(s));
    expect(
      offenders,
      'R-T2-S1: the starfield consumes the EXISTING poll as a prop and must add no read of its own'
    ).toEqual([]);
  });

  it('imports the app firebase config from no module in the graph', () => {
    const offenders = [];
    for (const [file, code] of seen) {
      if (/firebase\/config/.test(code)) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('calls no Firestore read API, at any depth', () => {
    const banned = ['onSnapshot', 'getDocs', 'getDoc(', 'collection(', 'query(', 'where('];
    const offenders = [];
    for (const [file, code] of seen) {
      for (const api of banned) {
        if (code.includes(api)) offenders.push(`${rel(file)} -> ${api}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('starts no poll of its own', () => {
    // setTimeout IS allowed: the 200ms resize debounce, cleared on unmount.
    // setInterval is not — a repeating timer is a poll by another name.
    const offenders = [];
    for (const [file, code] of seen) {
      if (code.includes('setInterval')) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('pulls in only the expected third-party packages', () => {
    // A tight allowlist so a new heavyweight dependency in the background layer
    // has to be a deliberate, reviewed choice rather than an accident.
    const allowed = new Set(['react', 'react-dom', 'react-dom/client']);
    const unexpected = [...bareImports].filter((s) => !allowed.has(s));
    expect(unexpected, `unexpected third-party imports: ${unexpected.join(', ')}`).toEqual([]);
  });

  it('the adapter reads the poll result only as an argument', () => {
    // It must not reach for App state, storage, or a global of its own.
    const adapter = seen.get(path.join(HERE, 'warpBattleAdapter.js'));
    for (const forbidden of ['window.', 'document.', 'localStorage', 'sessionStorage', 'fetch(']) {
      expect(adapter, `adapter must stay pure — found ${forbidden}`).not.toContain(forbidden);
    }
  });
});
