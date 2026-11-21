// scripts/practice-field/battery/importGraph.mjs
//
// WHICH TEST FILES CAN SEE A MUTATED FILE. Built once per battery from the battery's own tree (an archive of the commit
// under test), then asked once per mutant. Not shipped code: the fast mutation battery's helper (README.md here).
//
// A test file is RELATED to a mutated file when the file is in the test's import closure: every static import and
// re-export, every `import()`/`require()` of a static string (read by the repo's own parser-based reader,
// api/_utils/filmRoom/__fixtures__/jsSource.js, the one the census walkers use), and every path a `vi.mock` /
// `vi.doMock` / `vi.importActual` / `vi.importMock` names (with the `__mocks__/` sibling vitest would load in its place).
//
// Some test files see code no import shows, so they are ALWAYS related, to every mutant:
//   - reads-files: a TEST-SIDE module in the closure (a test file, or one under __testsupport__ / __fixtures__ /
//     __mocks__) imports `fs` / `fs/promises` (statically or by `await import('node:fs')`), or ANY module in the
//     closure lists a directory (readdir, opendir, glob). Source-text guards (exits, spend, registryPresence,
//     firestoreIndexes, marks, results …) read modules as text. A product module that reads one data file by name
//     (archetypeRegistry.js reads its JSON snapshots) does not count: product code does not read JS source by name.
//   - spawns: a module in the closure imports `child_process`, `worker_threads` or `vm` — it can run code elsewhere.
//   - opaque: a module in the closure loads something no static reading follows (`import()` of a computed value,
//     `createRequire`, `import.meta.glob` …), or names a local path that resolves to no module.
// The list is deliberately wide. A test related by mistake only costs time; a test missed by mistake costs nothing in
// the verdict either (anything not killed by the related files gets a full-row-set run), but it would make the
// related run's failing rows a subset of the full run's, so the battery's --verify mode checks that containment.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { callNamesOf, importSpecifiersOf, opaqueImportsOf, resolveImport, stripComments } from '../../../api/_utils/filmRoom/__fixtures__/jsSource.js';

const FS_MODULES = new Set(['fs', 'node:fs', 'fs/promises', 'node:fs/promises']);
const DIRECTORY_CALLS = new Set(['readdir', 'readdirSync', 'opendir', 'opendirSync', 'glob', 'globSync']);
const TEST_SIDE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|\/__(?:testsupport|fixtures|mocks)__\/)/;
const SPAWN_MODULES = new Set(['child_process', 'node:child_process', 'worker_threads', 'node:worker_threads', 'vm', 'node:vm']);
const VI_PATH_CALL = /\bvi\s*\.\s*(?:mock|doMock|importActual|importMock)\s*\(\s*(['"`])([^'"`$]+)\1/g;
const MODULE_FILE = /\.(?:m?js|jsx)$/;

const toPosix = (p) => p.split(path.sep).join('/');

/** One module read: its local edges, and the reasons it makes every test that reaches it always-related. */
function readModule(root, abs) {
  const where = toPosix(path.relative(root, abs));
  const src = readFileSync(abs, 'utf8');
  const out = { edges: [], flags: [] };
  let specs;
  try {
    specs = importSpecifiersOf(src, where);
    for (const o of opaqueImportsOf(src, where)) out.flags.push(`opaque: ${where} (${o})`);
  } catch (e) {
    out.flags.push(`opaque: ${where} does not parse (${e.message.slice(0, 80)})`);
    return out;
  }
  for (const s of specs) {
    if (FS_MODULES.has(s) && TEST_SIDE.test(where)) out.flags.push(`reads-files: ${where}`);
    if (SPAWN_MODULES.has(s)) out.flags.push(`spawns: ${where}`);
  }
  if (callNamesOf(src, where).some((c) => DIRECTORY_CALLS.has(c.name))) out.flags.push(`reads-files: ${where} (lists a directory)`);
  const mockPaths = [];
  for (const m of stripComments(src, where).matchAll(VI_PATH_CALL)) mockPaths.push(m[2]);
  for (const spec of [...specs, ...mockPaths]) {
    let resolved;
    try {
      resolved = resolveImport(abs, spec, root);
    } catch {
      out.flags.push(`opaque: ${where} names ${spec}, which resolves to no module`);
      continue;
    }
    if (!resolved) continue;
    out.edges.push(resolved);
    if (mockPaths.includes(spec)) {
      const sibling = path.join(path.dirname(resolved), '__mocks__', path.basename(resolved));
      try { readFileSync(sibling); out.edges.push(sibling); } catch { /* no __mocks__ sibling */ }
    }
  }
  return out;
}

/**
 * The graph for `testFiles` (repo-relative paths) in the tree at `root`: each test's closure (repo-relative paths, the
 * test itself included) and the reasons, if any, it is always related.
 */
export function buildGraph(root, testFiles) {
  const modules = new Map();
  const moduleOf = (abs) => {
    let m = modules.get(abs);
    if (!m) { m = readModule(root, abs); modules.set(abs, m); }
    return m;
  };
  const tests = new Map();
  for (const rel of testFiles) {
    const start = path.resolve(root, rel);
    const seen = new Set([start]);
    const flags = new Set();
    const stack = [start];
    while (stack.length) {
      const abs = stack.pop();
      if (!MODULE_FILE.test(abs)) continue;
      const m = moduleOf(abs);
      for (const f of m.flags) flags.add(f);
      for (const e of m.edges) if (!seen.has(e)) { seen.add(e); stack.push(e); }
    }
    tests.set(toPosix(rel), {
      closure: new Set([...seen].map((a) => toPosix(path.relative(root, a)))),
      always: [...flags].sort(),
    });
  }
  return { root, tests, modulesRead: modules.size };
}

/**
 * The test files related to `mutatedFiles` (repo-relative): each with why. A mutated file that is not a JS module
 * (JSON, a config …) relates every test: the graph cannot see who reads it.
 */
export function relatedTests(graph, mutatedFiles) {
  const wanted = mutatedFiles.map(toPosix);
  const nonModule = wanted.filter((f) => !MODULE_FILE.test(f));
  const out = [];
  for (const [test, { closure, always }] of graph.tests) {
    if (nonModule.length > 0) { out.push({ test, why: `not a module: ${nonModule.join(', ')}` }); continue; }
    const hit = wanted.find((f) => closure.has(f));
    if (hit) out.push({ test, why: hit === test ? 'is the mutated file' : `imports ${hit}` });
    else if (always.length > 0) out.push({ test, why: always[0] + (always.length > 1 ? ` (+${always.length - 1})` : '') });
  }
  return out;
}
