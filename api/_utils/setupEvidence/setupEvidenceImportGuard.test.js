// api/_utils/setupEvidence/setupEvidenceImportGuard.test.js
//
// ID-1 Build 1 — NOTHING CALLS THE STORE. A framework library with no cron, no
// endpoint, no flag and no consumer: slice 2, the ID-1 observer and the Practice
// Field will call it later, each behind its own gate, and each is meant to arrive
// here as a deliberate change to this one list.
//
// One scan over every source file in the code trees and at the repo root, on real
// text with the comments left in, because a mention in a comment is cheap to allow
// by name and a missed caller is not. A file counts when any string in it carries
// the library's folder or either collection as a path segment. That is every way to
// reach the store in writing: an import of any form (static, dynamic, require,
// vi.mock, glob, new URL), a direct `.collection('setupEvidence')` and a doc path.
// Only a name built at run time gets past it. One row per file found, never a
// hard-coded count, and "the guard bites" rows on a temporary tree with a planted
// caller of each form.

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const LIBRARY = 'api/_utils/setupEvidence';
const ROOTS = ['api', 'src', 'scripts', 'test', 'tester', 'tracer', 'discovery', 'research', 'fixtures', '__mocks__'];
const CODE_RE = /\.(js|jsx|mjs|cjs|mts|cts|ts|tsx)$/;
/** The folder or a collection as one path segment: a longer name that only starts the same is not it. */
const NAMES_LIBRARY_RE = /['"`/]setupEvidence(?:Claims)?['"`/]/;

/** The only files outside the library that may name it. */
const ALLOWED_OUTSIDE = new Set([
  'test/rules/setupEvidenceDenials.rules.mjs',
  'test/rules/setupEvidenceStore.rules.mjs',
]);
const isListed = (file) => ALLOWED_OUTSIDE.has(file);

function walk(repo, rel, out = []) {
  let entries;
  try { entries = readdirSync(join(repo, rel), { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const p = `${rel}/${entry.name}`;
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(repo, p, out); }
    else if (CODE_RE.test(entry.name)) out.push(p);
  }
  return out;
}

/** Every code file the scan reads: the trees, and the files at the repo root. */
function codeFiles(repo) {
  const atRoot = readdirSync(repo, { withFileTypes: true }).filter((e) => e.isFile() && CODE_RE.test(e.name)).map((e) => e.name);
  return [...atRoot, ...ROOTS.flatMap((root) => walk(repo, root))];
}

/** The files outside the library that name it. */
function findCallers(repo) {
  return codeFiles(repo).filter((file) => !file.startsWith(`${LIBRARY}/`) && NAMES_LIBRARY_RE.test(readFileSync(join(repo, file), 'utf8'))).sort();
}

/** The library's modules at any depth, tests aside. */
function libraryModules(repo) {
  return walk(repo, LIBRARY).filter((f) => !f.includes('.test.')).map((f) => f.slice(LIBRARY.length + 1)).sort();
}

const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"`]([^'"`]+)['"`]/g;
const specifiersOf = (text) => [...text.matchAll(SPECIFIER_RE)].map((m) => m[1]);
/** What the library must never reach. */
const FORBIDDEN_RE = /^api\/(cron|agent)\/|featureFlags/;
const resolvedOf = (file, specifier) => (specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), specifier)) : specifier);

const callers = findCallers(REPO);

describe('nothing calls the store', () => {
  it('the scan is alive: it reads the code trees and the root, and finds this build\'s own emulator suites', () => {
    const files = codeFiles(REPO);
    expect(files.length).toBeGreaterThan(1_500);
    expect(files).toEqual(expect.arrayContaining(['firestore.rules.emulator.test.js', 'vite.config.js', `${LIBRARY}/index.js`]));
    expect(callers).toEqual(expect.arrayContaining([...ALLOWED_OUTSIDE]));
  });
  it.each(callers.map((file) => [file]))('%s is on the list', (file) => {
    expect(isListed(file)).toBe(true);
  });
  it('no cron schedule names it', () => {
    expect(readFileSync(join(REPO, 'vercel.json'), 'utf8')).not.toMatch(/setupEvidence/i);
  });
  it('the library is its six modules, and reaches no flag and no handler: nothing from api/cron, api/agent or the flag module', () => {
    const modules = libraryModules(REPO);
    expect(modules).toEqual(['acquire.js', 'classify.js', 'index.js', 'key.js', 'sessionAt.js', 'store.js']);
    for (const name of modules) {
      const file = `${LIBRARY}/${name}`;
      for (const specifier of specifiersOf(readFileSync(join(REPO, file), 'utf8'))) {
        expect([file, resolvedOf(file, specifier)]).not.toEqual([file, expect.stringMatching(FORBIDDEN_RE)]);
      }
    }
  });
});

describe('the guard bites: a planted caller of each form is found, and is not on the list', () => {
  const trees = [];
  afterAll(() => { for (const t of trees) rmSync(t, { recursive: true, force: true }); });
  const plant = (rel, text) => {
    const repo = mkdtempSync(join(tmpdir(), 'setup-evidence-guard-'));
    trees.push(repo);
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), text);
    return repo;
  };

  it.each([
    ['a named import from a cron', 'api/cron/x.js', "import { getOrAcquireSnapshot } from '../_utils/setupEvidence/index.js';"],
    ['an import over several lines', 'api/cron/x.js', "import {\n  readSnapshot,\n} from '../_utils/setupEvidence/index.js';"],
    ['an import of one module from a sibling', 'api/_utils/x.js', "import { snapshotIdOf } from './setupEvidence/key.js';"],
    ['the folder alone', 'api/_utils/x.js', "import lib from './setupEvidence';"],
    ['a re-export', 'api/_utils/x.js', "export { readSnapshot } from './setupEvidence/index.js';"],
    ['a dynamic import', 'api/cron/x.js', "const m = await import('../_utils/setupEvidence/index.js');"],
    ['a dynamic import with a bundler comment', 'api/cron/x.js', "const m = await import(/* @vite-ignore */ '../_utils/setupEvidence/index.js');"],
    ['a require', 'scripts/x.cjs', "const m = require('../api/_utils/setupEvidence/index.js');"],
    ['createRequire', 'scripts/x.mjs', "const m = createRequire(import.meta.url)('../api/_utils/setupEvidence/index.js');"],
    ['a specifier held in a variable', 'scripts/x.mjs', "const spec = '../api/_utils/setupEvidence/index.js'; await import(spec);"],
    ['new URL', 'scripts/x.mjs', "await import(new URL('../api/_utils/setupEvidence/index.js', import.meta.url));"],
    ['a bare side-effect import', 'api/_utils/x.js', "import './setupEvidence/index.js';"],
    ['from src', 'src/utils/x.js', "import { readSnapshot } from '../../api/_utils/setupEvidence/index.js';"],
    ['a mock in a test elsewhere', 'api/cron/x.test.js', "vi.mock('../_utils/setupEvidence/index.js');"],
    ['a suite elsewhere', 'test/rules/other.rules.mjs', "import { readSnapshot } from '../../api/_utils/setupEvidence/index.js';"],
    ['a .mts file', 'scripts/x.mts', "import { readSnapshot } from '../api/_utils/setupEvidence/index.js';"],
    ['a test at the repo root', 'x.test.js', "import { readSnapshot } from './api/_utils/setupEvidence/index.js';"],
    ['a file in __mocks__', '__mocks__/x.js', "export * from '../api/_utils/setupEvidence/index.js';"],
    ['a file in tester', 'tester/x.js', "import '../api/_utils/setupEvidence/index.js';"],
    ['a file in tracer', 'tracer/x.js', "import '../api/_utils/setupEvidence/index.js';"],
    ['a file in discovery', 'discovery/x.mjs', "import '../api/_utils/setupEvidence/index.js';"],
    ['a file in research', 'research/x.js', "import '../api/_utils/setupEvidence/index.js';"],
    ['a file in fixtures', 'fixtures/x.js', "import '../api/_utils/setupEvidence/index.js';"],
    ['a .jsx file', 'src/x.jsx', "import '../api/_utils/setupEvidence/index.js';"],
    ['a .ts file', 'src/x.ts', "import '../api/_utils/setupEvidence/index.js';"],
    ['a .tsx file', 'src/x.tsx', "import '../api/_utils/setupEvidence/index.js';"],
    ['a .cts file', 'scripts/x.cts', "import '../api/_utils/setupEvidence/index.js';"],
    ['a direct write to the snapshots', 'api/cron/x.js', "await db.collection('setupEvidence').doc(id).set(x);"],
    ['a direct read of the claims', 'scripts/x.mjs', 'await db.collection("setupEvidenceClaims").get();'],
    ['a collection name held in a constant', 'api/cron/x.js', "const C = 'setupEvidence'; await db.collection(C).get();"],
    ['a path-style doc reference', 'scripts/x.mjs', 'await db.doc(`setupEvidence/${id}`).get();'],
    ['a doc path with a leading slash', 'scripts/x.mjs', "await db.doc('/setupEvidenceClaims/x').get();"],
  ])('%s', (_label, file, text) => {
    expect(findCallers(plant(file, text)).filter((f) => !isListed(f))).toEqual([file]);
  });

  it('a library file that imports a cron, a handler or the flag module is seen', () => {
    const file = `${LIBRARY}/x.js`;
    const text = "import a from '../../cron/x.js';\nimport b from '../../agent/y.js';\nimport c from '../../../src/config/featureFlags.js';\n";
    const resolved = specifiersOf(text).map((s) => resolvedOf(file, s));
    expect(resolved).toEqual(['api/cron/x.js', 'api/agent/y.js', 'src/config/featureFlags.js']);
    for (const r of resolved) expect(r).toMatch(FORBIDDEN_RE);
  });
  it('a module added anywhere under the library shows in its list, at any depth', () => {
    expect(libraryModules(plant(`${LIBRARY}/sub/cron.js`, "import '../../cron/x.js';"))).toEqual(['sub/cron.js']);
  });
  it('the library\'s own files, and a name that only starts the same, are not callers', () => {
    const repo = plant(`${LIBRARY}/x.js`, "import './key.js'; const c = 'setupEvidence';");
    mkdirSync(join(repo, 'api/_utils/other'), { recursive: true });
    writeFileSync(join(repo, 'api/_utils/other/y.js'), "import { a } from './setupEvidenceHelpers.js'; const c = 'setupEvidenceLog';");
    expect(findCallers(repo)).toEqual([]);
  });
});
