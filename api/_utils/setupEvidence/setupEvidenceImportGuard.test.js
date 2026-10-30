// api/_utils/setupEvidence/setupEvidenceImportGuard.test.js
//
// ID-1 Build 1 — NOTHING CALLS THE STORE. A framework library with no cron, no
// endpoint, no flag and no consumer: slice 2, the ID-1 observer and the Practice
// Field will call it later, each behind its own gate, and each is meant to arrive
// here as a deliberate change to this one list.
//
// Two scans over every source file in the code trees, each on real text with the
// comments left in, because a mention in a comment is cheap to allow by name and a
// missed caller is not:
//   · who IMPORTS the library (import, re-export, dynamic import, require), resolved
//     to a real path, so a sibling's `./setupEvidence/index.js` and a test's
//     `../../api/_utils/setupEvidence/key.js` read the same;
//   · who names either COLLECTION as a string, so a caller that skipped the library
//     and wrote to Firestore directly is seen too.
// One row per file found, never a hard-coded count, and "the guard bites" rows on a
// temporary tree with a planted caller of each form.

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix, relative, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const LIBRARY = 'api/_utils/setupEvidence/';
const ROOTS = ['api', 'src', 'scripts', 'test', 'tester', 'tracer', 'discovery', 'research', 'fixtures'];
const CODE_RE = /\.(js|jsx|mjs|cjs|ts|tsx)$/;

/** The only files outside the library that may import it or name its collections. */
const ALLOWED_OUTSIDE = new Set([
  'test/rules/setupEvidenceDenials.rules.mjs',
  'test/rules/setupEvidenceStore.rules.mjs',
]);

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

const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"`]([^'"`]+)['"`]/g;

/** Every module specifier in a file's text, comments included. */
function specifiersOf(text) {
  return [...text.matchAll(SPECIFIER_RE)].map((m) => m[1]);
}

/** The specifier resolved against its file, as a repo-relative path. */
const resolvedOf = (file, specifier) => (specifier.startsWith('.') ? posix.normalize(posix.join(posix.dirname(file), specifier)) : specifier);

const reachesLibrary = (file, specifier) => {
  const target = resolvedOf(file, specifier);
  return target === LIBRARY.slice(0, -1) || target.startsWith(LIBRARY);
};

/** The two collections as string literals, on their own: a substring of a longer name is not one. */
const NAMES_COLLECTION_RE = /['"`]setupEvidence(?:Claims)?['"`/]/;

/** The files outside the library that import it or name its collections. */
function findCallers(repo, roots = ROOTS) {
  const found = [];
  for (const root of roots) {
    for (const file of walk(repo, root)) {
      if (file.startsWith(LIBRARY)) continue;
      const text = readFileSync(join(repo, file), 'utf8');
      const imports = specifiersOf(text).some((s) => reachesLibrary(file, s));
      if (imports || NAMES_COLLECTION_RE.test(text)) found.push(file);
    }
  }
  return found.sort();
}

const callers = findCallers(REPO);

describe('nothing calls the store', () => {
  it('the scan is alive: it reads the code trees and finds this build\'s own emulator suites', () => {
    expect(walk(REPO, 'api').length).toBeGreaterThan(500);
    expect(walk(REPO, 'src').length).toBeGreaterThan(500);
    expect(callers).toEqual(expect.arrayContaining([...ALLOWED_OUTSIDE]));
  });
  it.each(callers.map((file) => [file]))('%s is on the list', (file) => {
    expect(ALLOWED_OUTSIDE.has(file)).toBe(true);
  });
  it('no cron schedule names it', () => {
    expect(readFileSync(join(REPO, 'vercel.json'), 'utf8')).not.toMatch(/setupEvidence/i);
  });
  it('the library reaches no flag and no handler: it imports nothing from api/cron, api/agent or the flag module', () => {
    const library = readdirSync(join(REPO, LIBRARY)).filter((f) => CODE_RE.test(f) && !f.includes('.test.'));
    expect(library.sort()).toEqual(['acquire.js', 'classify.js', 'index.js', 'key.js', 'sessionAt.js', 'store.js']);
    for (const name of library) {
      const file = `${LIBRARY}${name}`;
      for (const specifier of specifiersOf(readFileSync(join(REPO, file), 'utf8'))) {
        expect([file, resolvedOf(file, specifier)]).not.toEqual([file, expect.stringMatching(/^api\/(cron|agent)\/|featureFlags/)]);
      }
    }
  });
});

describe('the guard bites: a planted caller of each form is found', () => {
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
    ['an import of one module from a sibling', 'api/_utils/x.js', "import { snapshotIdOf } from './setupEvidence/key.js';"],
    ['the folder alone', 'api/_utils/x.js', "import lib from './setupEvidence';"],
    ['a re-export', 'api/_utils/x.js', "export { readSnapshot } from './setupEvidence/index.js';"],
    ['a dynamic import', 'api/cron/x.js', "const m = await import('../_utils/setupEvidence/index.js');"],
    ['a require', 'scripts/x.cjs', "const m = require('../api/_utils/setupEvidence/index.js');"],
    ['a bare side-effect import', 'api/_utils/x.js', "import './setupEvidence/index.js';"],
    ['from src', 'src/utils/x.js', "import { readSnapshot } from '../../api/_utils/setupEvidence/index.js';"],
    ['a test elsewhere', 'test/rules/other.rules.mjs', "import { readSnapshot } from '../../api/_utils/setupEvidence/index.js';"],
    ['a direct write to the snapshots', 'api/cron/x.js', "await db.collection('setupEvidence').doc(id).set(x);"],
    ['a direct read of the claims', 'scripts/x.mjs', 'await db.collection("setupEvidenceClaims").get();'],
    ['a path-style doc reference', 'scripts/x.mjs', 'await db.doc(`setupEvidence/${id}`).get();'],
  ])('%s', (_label, file, text) => {
    expect(findCallers(plant(file, text))).toEqual([file]);
  });

  it('the library\'s own files, and a name that only starts the same, are not callers', () => {
    const repo = plant(`${LIBRARY}x.js`, "import './key.js'; const c = 'setupEvidence';");
    mkdirSync(join(repo, 'api/_utils/other'), { recursive: true });
    writeFileSync(join(repo, 'api/_utils/other/y.js'), "import { a } from './setupEvidenceHelpers.js'; const c = 'setupEvidenceLog';");
    expect(findCallers(repo)).toEqual([]);
  });

  it('a planted caller is not on the list, so the per-file row would fail', () => {
    expect(ALLOWED_OUTSIDE.has('api/cron/x.js')).toBe(false);
  });
  it('resolves through relative() the way the walk spells paths', () => {
    expect(relative(REPO, HERE).split(/[\\/]/).join('/')).toBe(LIBRARY.slice(0, -1));
  });
});
