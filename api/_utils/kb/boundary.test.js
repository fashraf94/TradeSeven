// api/_utils/kb/boundary.test.js
//
// KB-0 — THE IMPORT BOUNDARIES (Shared Research spec V1.2, Amendment A §A3.3,
// §A3.5, §A5). The loader is pure (node:crypto, its packages, its list); the
// audience module reads one predicate; no KB module reaches Shared Research;
// and KB-0 SHIPS DARK BY CONSTRUCTION: nothing outside api/_utils/kb/ and
// scripts/kb/ imports the module, and nothing under src/ does. KB-1 will move
// the last row, to admit its Shared Research consumer.
//
// Each scanner is a function over (path, text), proven here against planted
// files before it is trusted on the real tree.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const KB_DIR = HERE;
const SCRIPTS_KB = path.join(REPO, 'scripts', 'kb');
const read = (file) => readFileSync(file, 'utf8');

/** Code without its comments (block comments, and line comments not inside a URL). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/** Every module specifier in the text: static, side-effect, re-export, dynamic and require forms. */
function specifiersOf(text) {
  const out = [];
  const forms = [
    /\bimport\s+[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*[,)]/g,
    /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ];
  for (const re of forms) for (const m of text.matchAll(re)) out.push(m[1]);
  return out;
}

/** Code-level uses the pure KB modules must not make. */
function forbiddenUses(code) {
  const rules = [
    ['fs', /['"](?:node:)?fs(?:\/promises)?['"]/],
    ['network client', /\bfetch\s*\(|['"](?:node:)?(?:https?|http2|net|tls|dgram)['"]|\baxios\b|\bundici\b|\bXMLHttpRequest\b|\bWebSocket\b/],
    ['database', /firebase|firestore|@google-cloud|\bgetDb\b|\bmongo/i],
    ['process.env', /\bprocess\s*(?:\.\s*env\b|\[)/],
    ['dynamic import', /\bimport\s*\(/],
    ['require', /\brequire\s*\(/],
  ];
  return rules.filter(([, re]) => re.test(code)).map(([name]) => name);
}

const isInside = (file, dir) => file === dir || file.startsWith(dir + path.sep);

/** The files (path, text) in this list that import anything under api/_utils/kb/. */
function kbImportersIn(files, repoRoot) {
  const kbDir = path.join(repoRoot, 'api', '_utils', 'kb');
  const hits = [];
  for (const { file, text } of files) {
    for (const spec of specifiersOf(text)) {
      let target = null;
      if (spec.startsWith('.')) target = path.resolve(path.dirname(file), spec);
      else if (spec.startsWith('/')) target = path.join(repoRoot, ...spec.split('/'));
      else if (spec.startsWith('@/')) target = path.join(repoRoot, 'src', ...spec.slice(2).split('/'));
      const named = /(^|\/)api\/_utils\/kb(\/|$)/.test(spec);
      if (named || (target && isInside(target, kbDir))) hits.push({ file, spec });
    }
  }
  return hits;
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'dist', 'coverage', '.vercel', '.vite', '.firebase']);
const CODE = /\.(?:js|jsx|mjs|cjs|ts|tsx)$/;

function walk(dir, out = []) {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) walk(path.join(dir, d.name), out);
    } else if (d.isFile() && CODE.test(d.name)) {
      out.push(path.join(dir, d.name));
    }
  }
  return out;
}

const KB_MODULES = ['loader.js', 'authorizations.js', 'audience.js', path.join('packages', 'index.js')].map((f) => path.join(KB_DIR, f));

describe('the scanners, proven on planted text', () => {
  it('specifiersOf finds every import form', () => {
    const planted = [
      "import a from './a.js';",
      "import { b,\n  c } from './bc.js'",
      "import * as d from 'node:d'",
      "import './side.js';",
      "export * from './re.js';",
      "export { e } from './e.js';",
      "const f = await import('./dyn.js');",
      "const g = require('./req.cjs');",
      "import h from './h.json' with { type: 'json' };",
    ].join('\n');
    expect(specifiersOf(planted).sort()).toEqual(['./a.js', './bc.js', './dyn.js', './e.js', './h.json', './re.js', './req.cjs', './side.js', 'node:d'].sort());
  });

  it.each([
    ['fs', "import { readFileSync } from 'node:fs';"],
    ['fs', "import fs from 'fs/promises';"],
    ['network client', 'const r = await fetch(url);'],
    ['network client', "import https from 'node:https';"],
    ['database', "import { getFirestore } from 'firebase-admin/firestore';"],
    ['process.env', 'const k = process.env.KEY;'],
    ['process.env', "const k = process['env'];"],
    ['dynamic import', "await import('./x.js')"],
    ['require', "require('./x.cjs')"],
  ])('forbiddenUses finds %s in a planted line', (name, line) => {
    expect(forbiddenUses(line)).toContain(name);
  });

  it('stripComments drops comments but keeps code and URLs', () => {
    expect(stripComments("// process.env.X\n/* fetch(a) */ const u = 'https://x.y'; // fs")).toBe("\n const u = 'https://x.y'; ");
  });

  it('kbImportersIn finds planted importers of every form, resolves relative paths, and respects the directory boundary', () => {
    const at = (...p) => path.join(REPO, ...p);
    const planted = [
      { file: at('src', 'screens', 'X.jsx'), text: "import { verifyPackage } from '../../api/_utils/kb/loader.js';" },
      { file: at('api', 'forge', 'route.js'), text: "const m = await import('../_utils/kb/loader.js');" },
      { file: at('scripts', 'other.mjs'), text: "export * from '../api/_utils/kb/audience.js';" },
      { file: at('api', 'cron', 'job.cjs'), text: "const kb = require('../_utils/kb');" },
      { file: at('src', 'y.js'), text: "import x from '/api/_utils/kb/packages/index.js';" },
      { file: at('api', '_utils', 'near.js'), text: "import k from './kbx/loader.js'; import j from './kb-notes.js';" },
      { file: at('api', '_utils', 'kb', 'loader.test.js'), text: "import { a } from './loader.js';" },
    ];
    const hits = kbImportersIn(planted, REPO).map((h) => path.relative(REPO, h.file).split(path.sep).join('/'));
    expect(hits).toEqual(['src/screens/X.jsx', 'api/forge/route.js', 'scripts/other.mjs', 'api/cron/job.cjs', 'src/y.js', 'api/_utils/kb/loader.test.js']);
  });
});

describe('the KB modules', () => {
  it("loader.js imports exactly node:crypto, ./packages/index.js and ./authorizations.js", () => {
    expect(specifiersOf(stripComments(read(path.join(KB_DIR, 'loader.js')))).sort()).toEqual(['./authorizations.js', './packages/index.js', 'node:crypto']);
  });

  it('packages/index.js imports only its JSON files; authorizations.js imports nothing', () => {
    const specs = specifiersOf(stripComments(read(path.join(KB_DIR, 'packages', 'index.js'))));
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) expect(s).toMatch(/^\.\/[A-Za-z0-9.-]+\.json$/);
    expect(specifiersOf(stripComments(read(path.join(KB_DIR, 'authorizations.js'))))).toEqual([]);
  });

  it.each(['loader.js', 'authorizations.js', path.join('packages', 'index.js')])('%s: no fs, no network client, no database, no process.env (code only)', (f) => {
    expect(forbiddenUses(stripComments(read(path.join(KB_DIR, f))))).toEqual([]);
  });

  it("audience.js's only import is ../callRecords/mode.js", () => {
    expect(specifiersOf(stripComments(read(path.join(KB_DIR, 'audience.js'))))).toEqual(['../callRecords/mode.js']);
  });

  it('no KB module imports a Shared Research module or names its mode flag', () => {
    const flag = ['SHARED', 'RESEARCH', 'MODE'].join('_');
    for (const file of KB_MODULES) {
      const text = read(file);
      expect(text).not.toContain(flag);
      for (const spec of specifiersOf(text)) expect(spec).not.toMatch(/shared-?research|forge/i);
    }
  });
});

describe('dark by construction', () => {
  const files = walk(REPO).map((file) => ({ file, text: read(file) }));
  const hits = kbImportersIn(files, REPO);
  const rel = (f) => path.relative(REPO, f).split(path.sep).join('/');

  it('the walk is not vacuous: it reaches src/, api/ and scripts/, and sees the known importers', () => {
    expect(files.some((f) => isInside(f.file, path.join(REPO, 'src')))).toBe(true);
    expect(files.length).toBeGreaterThan(1000);
    const seen = hits.map((h) => rel(h.file));
    expect(seen).toContain('scripts/kb/import-release.mjs');
    expect(seen).toContain('api/_utils/kb/loader.test.js');
  });

  it('no file under src/ imports api/_utils/kb/', () => {
    expect(hits.filter((h) => isInside(h.file, path.join(REPO, 'src'))).map((h) => `${rel(h.file)} → ${h.spec}`)).toEqual([]);
  });

  it('nothing outside api/_utils/kb/ and scripts/kb/ imports it (KB-1 moves this row)', () => {
    const outside = hits.filter((h) => !isInside(h.file, KB_DIR) && !isInside(h.file, SCRIPTS_KB));
    expect(outside.map((h) => `${rel(h.file)} → ${h.spec}`)).toEqual([]);
  });
});
