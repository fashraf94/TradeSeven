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
// files before it is trusted on the real tree. Every scan reads the raw text
// AND the comment-stripped text (each misses something the other sees).
//
// KNOWN LIMITS, stated on purpose (refuter KLV4, KL4-11): no static scan sees a
// specifier built at run time (`import(p)` with a variable, a computed
// `require`, `eval`), an entry point reached through an assignment alias
// (`const f = loadAuthorizedMethod; f(a, b)`), or a glob whose pattern names
// neither `api/` nor the module's directories. The text belts (NAMES_KB,
// NAMES_KB_DATA, the src/ glob row) and the import-graph walk narrow these;
// review covers the rest.

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

/** The specifiers of a file's code: raw and comment-stripped, de-duplicated, in order. */
const specsOfCode = (text) => [...new Set([...specifiersOf(text), ...specifiersOf(stripComments(text))])];

/**
 * Uses the pure KB modules must not make, in the raw or the comment-stripped
 * text. `process` and `fetch` are refused at any mention (destructuring,
 * `.call`), not only as `process.env` or `fetch(` (refuter KLV4).
 */
function forbiddenUses(text) {
  const rules = [
    ['fs', /['"](?:node:)?fs(?:\/promises)?['"]/],
    ['network client', /\bfetch\b|['"](?:node:)?(?:https?|http2|net|tls|dgram)['"]|\baxios\b|\bundici\b|\bXMLHttpRequest\b|\bWebSocket\b/],
    ['database', /firebase|firestore|@google-cloud|\bgetDb\b|\bmongo/i],
    ['process', /\bprocess\b/],
    ['dynamic import', /\bimport\s*\(/],
    ['require', /\brequire\s*\(/],
  ];
  const code = stripComments(text);
  return rules.filter(([, re]) => re.test(code) || re.test(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))).map(([name]) => name);
}

const isInside = (file, dir) => file === dir || file.startsWith(dir + path.sep);

/** The files (path, text) in this list that import anything under api/_utils/kb/. */
function kbImportersIn(files, repoRoot) {
  const kbDir = path.join(repoRoot, 'api', '_utils', 'kb');
  const hits = [];
  for (const { file, text } of files) {
    // Raw AND comment-stripped: a quote or `;` in a comment inside a multi-line
    // import list hides the specifier from the raw scan (review KL4-2).
    // Backslashes read as separators: Node resolves `..\\_utils\\kb` on every platform (refuter KLV3 N2).
    const specs = new Set([...specifiersOf(text), ...specifiersOf(stripComments(text))].map((s) => s.replace(/\\/g, '/')));
    for (const spec of specs) {
      let target = null;
      if (spec.startsWith('.')) target = path.resolve(path.dirname(file), spec);
      else if (spec.startsWith('/')) target = path.join(repoRoot, ...spec.split('/'));
      else if (spec.startsWith('@/')) target = path.join(repoRoot, 'src', ...spec.slice(2).split('/'));
      const named = /(^|\/)api\/_utils\/kb(\/|$)/.test(spec);
      if (named || (target && isInside(target, kbDir))) hits.push({ file, spec, target });
    }
  }
  return hits;
}

/** Text naming the module's directory in any form (a glob, a URL, a script src, a path string). */
const NAMES_KB = /_utils(?:\/|\\{1,2})kb(?![A-Za-z0-9_-])/;

/**
 * The argument count of every call to one of `names` in the code (strings,
 * template literals and nested brackets skipped). Not seen: a call through an
 * alias (`const f = loadAuthorizedMethod; f(a, b)`) or a spread.
 */
function callArgCounts(code, names) {
  const out = [];
  const re = new RegExp(`\\b(${names.join('|')})\\s*\\(`, 'g');
  for (const m of code.matchAll(re)) {
    let depth = 0;
    let commas = 0;
    let sawArg = false;
    let quote = null;
    for (let i = m.index + m[0].length; i < code.length; i += 1) {
      const c = code[i];
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; sawArg = true; continue; }
      if (c === '(' || c === '[' || c === '{') { depth += 1; sawArg = true; continue; }
      if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) { out.push({ name: m[1], args: sawArg ? commas + 1 : 0 }); break; }
        depth -= 1;
        continue;
      }
      if (c === ',' && depth === 0) { commas += 1; continue; }
      if (!/\s/.test(c)) sawArg = true;
    }
  }
  return out;
}

/** Text naming the module's packages or its authorization list, in any form. */
const NAMES_KB_DATA = /kb(?:\/|\\{1,2})(?:packages|authorizations)(?![A-Za-z0-9_-])/;

/** The entry points used other than by a direct call: `.call/.apply/.bind`, `?.(`, or a renamed import. */
const INDIRECT_ENTRY = /\b(?:loadAuthorizedMethod|authorizedMethodFor)\s*(?:\?\.\s*\(|\.\s*(?:call|apply|bind)\b)|\b(?:loadAuthorizedMethod|authorizedMethodFor)\s+as\s+[A-Za-z_$]/;

/** The pattern argument of every import.meta.glob(...) and new URL(...) in the text. */
function globAndUrlPatternsOf(text) {
  const out = [];
  for (const m of text.matchAll(/import\.meta\.glob\s*\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*"|`[^`]*`)/g)) out.push(m[1]);
  for (const m of text.matchAll(/new\s+URL\s*\(\s*('[^']*'|"[^"]*"|`[^`]*`)/g)) out.push(m[1]);
  // A template dynamic import (Vite's dynamic-import-vars) is a pattern too (refuter KLV4).
  for (const m of text.matchAll(/\bimport\s*\(\s*(`[^`]*\$\{[^`]*`)/g)) out.push(m[1]);
  return out;
}

/**
 * Every file reachable from `roots` through relative (and root-absolute, and
 * `@/`) imports, resolved against the files given (exact, then .js/.jsx/.mjs,
 * then /index.js).
 */
function reachableFrom(roots, files, repoRoot) {
  const byPath = new Map(files.map((f) => [f.file, f]));
  const resolve = (from, spec) => {
    const s = spec.replace(/\\/g, '/').split('?')[0];
    let base = null;
    if (s.startsWith('.')) base = path.resolve(path.dirname(from), s);
    else if (s.startsWith('/')) base = path.join(repoRoot, ...s.split('/'));
    else if (s.startsWith('@/')) base = path.join(repoRoot, 'src', ...s.slice(2).split('/'));
    if (base === null) return null;
    for (const c of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) if (byPath.has(c)) return c;
    return base;
  };
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const f = byPath.get(file);
    if (!f) continue;
    const specs = new Set([...specifiersOf(f.text), ...specifiersOf(stripComments(f.text))]);
    for (const spec of specs) {
      const target = resolve(file, spec);
      if (target !== null && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
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

// Every non-test code module under api/_utils/kb/, found, not listed (review KL4-8).
const KB_MODULES = walk(KB_DIR).filter((f) => !/\.test\.[cm]?jsx?$/.test(f));

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
    ['process', 'const k = process.env.KEY;'],
    ['process', "const k = process['env'];"],
    ['process', 'const { env } = process;'],
    ['network client', 'export const ping = (u) => fetch.call(globalThis, u);'],
    ['fs', "const SEP = 'a//b'; import { readFileSync } from 'node:fs';"],
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
      { file: at('src', 'z.js'), text: "import {\n  KB_REFUSALS, // don't render these\n} from '../api/_utils/kb/loader.js';" },
      { file: at('src', 'w.js'), text: "import {\n  KB_REFUSALS, // the ten; in order\n} from '../api/_utils/kb/loader.js';" },
    ];
    const hits = kbImportersIn(planted, REPO).map((h) => path.relative(REPO, h.file).split(path.sep).join('/'));
    expect(hits).toEqual(['src/screens/X.jsx', 'api/forge/route.js', 'scripts/other.mjs', 'api/cron/job.cjs', 'src/y.js', 'api/_utils/kb/loader.test.js', 'src/z.js', 'src/w.js']);
  });

  it('NAMES_KB catches the client forms no import statement shows (review KL3-3)', () => {
    for (const planted of [
      "const all = import.meta.glob('../api/_utils/kb/packages/*.json', { eager: true });",
      "const g = import.meta.glob('/api/_utils/kb/**');",
      "const u = new URL('../api/_utils/kb/packages/x.json', import.meta.url);",
      '<script type="module" src="/api/_utils/kb/loader.js"></script>',
      'const p = "..\\\\api\\\\_utils\\\\kb\\\\loader.js";',
    ]) expect(planted).toMatch(NAMES_KB);
    expect("import x from './_utils/kbx/y.js'; const kb = 'kb-notes';").not.toMatch(NAMES_KB);
  });

  it('the belts and the graph walk catch their planted forms (refuter KLV3)', () => {
    expect("const p = '../api/_utils/kb/packages/x.json';").toMatch(NAMES_KB_DATA);
    expect('fs.readFileSync(new URL("./_utils/kb/authorizations.js", import.meta.url))').toMatch(NAMES_KB_DATA);
    expect("import { loader } from '../kb/loader.js'").not.toMatch(NAMES_KB_DATA);
    for (const s of ['authorizedMethodFor.call(null, r, d)', 'loadAuthorizedMethod.apply(null, [r, d])', 'authorizedMethodFor?.(r, d)',
      "import { loadAuthorizedMethod as lam } from '../kb/loader.js'"]) expect(s).toMatch(INDIRECT_ENTRY);
    expect('authorizedMethodFor({ consumer })').not.toMatch(INDIRECT_ENTRY);
    expect(globAndUrlPatternsOf("import.meta.glob('../api/_utils/{kb,none}/packages/*.json', { eager: true }); new URL('../api/x.json', import.meta.url)"))
      .toEqual(["'../api/_utils/{kb,none}/packages/*.json'", "'../api/x.json'"]);
    const at = (...p) => path.join(REPO, ...p);
    const planted = [
      { file: at('src', 'zzSheet.js'), text: "import { pick } from '../api/_utils/sharedResearch/zzMethodKb.js';" },
      { file: at('api', '_utils', 'sharedResearch', 'zzMethodKb.js'), text: "import { authorizedMethodFor } from '../kb/loader';\nexport const pick = (c) => authorizedMethodFor(c);" },
      { file: at('api', '_utils', 'kb', 'loader.js'), text: '' },
      { file: at('src', 'clean.js'), text: "import x from './other';" },
    ];
    const reached = [...reachableFrom([at('src', 'zzSheet.js'), at('src', 'clean.js')], planted, REPO)];
    expect(reached).toContain(at('api', '_utils', 'kb', 'loader.js'));
    expect(reachableFrom([at('src', 'clean.js')], planted, REPO).has(at('api', '_utils', 'kb', 'loader.js'))).toBe(false);
    // A backslash specifier is an importer too.
    expect(kbImportersIn([{ file: at('api', 'forge', 'r.js'), text: "import x from './..\\\\_utils\\\\kb\\\\loader.js';" }], REPO)).toHaveLength(1);
    // The RAW half of the union: a '//' inside a string makes the stripper eat the rest of the line.
    expect(stripComments("const SEP = 'a//b'; import x from '../kb/loader.js';")).not.toContain('import');
    expect(kbImportersIn([{ file: at('api', '_utils', 'near.js'), text: "const SEP = 'a//b'; import x from './kb/loader.js';" }], REPO)).toHaveLength(1);
    expect(specsOfCode("const SEP = 'a//b'; import x from './kb/loader.js';\nimport {\n  y, // don't\n} from './z.js';")).toEqual(['./kb/loader.js', './z.js']);
    // A template dynamic import is a pattern the src/ belt reads.
    expect(globAndUrlPatternsOf('const m = (d) => import(`../api/_utils/${d}/loader.js`);')).toEqual(['`../api/_utils/${d}/loader.js`']);
  });

  it('callArgCounts counts top-level arguments (review KL3-1)', () => {
    const code = [
      'authorizedMethodFor({ consumer: c, inAudience: f });',
      'loadAuthorizedMethod({ id, version, consumer, inAudience }, { authorizations: [e] });',
      "authorizedMethodFor(req, deps)",
      "loadAuthorizedMethod(make('a, b'), [1, 2].length)",
      'authorizedMethodFor()',
    ].join('\n');
    expect(callArgCounts(code, ['loadAuthorizedMethod', 'authorizedMethodFor']).map((c) => c.args)).toEqual([1, 2, 2, 2, 0]);
  });
});

describe('the KB modules', () => {
  it("loader.js imports exactly node:crypto, ./packages/index.js and ./authorizations.js", () => {
    expect(specsOfCode(read(path.join(KB_DIR, 'loader.js'))).sort()).toEqual(['./authorizations.js', './packages/index.js', 'node:crypto']);
  });

  it('packages/index.js imports only its JSON files; authorizations.js imports nothing', () => {
    const specs = specsOfCode(read(path.join(KB_DIR, 'packages', 'index.js')));
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) expect(s).toMatch(/^\.\/[A-Za-z0-9.-]+\.json$/);
    expect(specsOfCode(read(path.join(KB_DIR, 'authorizations.js')))).toEqual([]);
  });

  it.each(['loader.js', 'authorizations.js', path.join('packages', 'index.js')])('%s: no fs, no network client, no database, no process (raw and comment-stripped text)', (f) => {
    expect(forbiddenUses(read(path.join(KB_DIR, f)))).toEqual([]);
  });

  it("audience.js's only import is ../callRecords/mode.js", () => {
    expect(specsOfCode(read(path.join(KB_DIR, 'audience.js')))).toEqual(['../callRecords/mode.js']);
  });

  it('no KB module imports a Shared Research module or names its mode flag', () => {
    expect(KB_MODULES.map((f) => path.relative(KB_DIR, f).split(path.sep).join('/')).sort()).toEqual(expect.arrayContaining(['audience.js', 'authorizations.js', 'loader.js', 'packages/index.js']));
    const flag = ['SHARED', 'RESEARCH', 'MODE'].join('_');
    for (const file of KB_MODULES) {
      const text = read(file);
      expect(text).not.toContain(flag);
      for (const spec of specsOfCode(text)) expect(spec).not.toMatch(/shared-?research|forge/i);
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

  // KB-1 moves THIS row only, and admits named imports of the authorized entry
  // points only (authorizedMethodFor, loadAuthorizedMethod, inAudienceFor, and
  // KB_REFUSALS if needed) — never verifyPackage, verifyParts, KB_PACKAGES or
  // KB_APP_USE, which answer the method text or the package without an
  // authorization. The two rows below it are permanent.
  it('nothing outside api/_utils/kb/ and scripts/kb/ imports it, or names it in any form (KB-1 moves this row)', () => {
    const outside = hits.filter((h) => !isInside(h.file, KB_DIR) && !isInside(h.file, SCRIPTS_KB));
    expect(outside.map((h) => `${rel(h.file)} → ${h.spec}`)).toEqual([]);
    // The belt: no code file outside names the directory at all — a glob, a URL,
    // a template, a ?raw import (review KL4-2).
    const naming = files.filter((f) => !isInside(f.file, KB_DIR) && !isInside(f.file, SCRIPTS_KB) && NAMES_KB.test(f.text));
    expect(naming.map((f) => rel(f.file))).toEqual([]);
  });

  it('PERMANENT: nothing outside api/_utils/kb/ imports its packages or its authorization list (review KL3-2)', () => {
    const PACKAGES_DIR = path.join(KB_DIR, 'packages');
    const AUTH = path.join(KB_DIR, 'authorizations.js');
    const reached = hits.filter((h) => !isInside(h.file, KB_DIR)
      && (h.target === null || isInside(h.target, PACKAGES_DIR) || h.target === AUTH || h.target === KB_DIR));
    expect(reached.map((h) => `${rel(h.file)} → ${h.spec}`)).toEqual([]);
    // Proven on planted importers.
    const planted = [
      { file: path.join(REPO, 'api', 'x.js'), text: "import { KB_PACKAGES } from './_utils/kb/packages/index.js';" },
      { file: path.join(REPO, 'api', 'y.js'), text: "import { KB_APP_USE } from './_utils/kb/authorizations.js';" },
    ];
    expect(kbImportersIn(planted, REPO).filter((h) => isInside(h.target, PACKAGES_DIR) || h.target === AUTH)).toHaveLength(2);
    // The belt: no code file outside names the packages or the list in any form — a
    // fs read through new URL, createRequire, a glob (refuter KLV3, KL3-2 residual).
    const naming = files.filter((f) => !isInside(f.file, KB_DIR) && !isInside(f.file, SCRIPTS_KB) && NAMES_KB_DATA.test(f.text));
    expect(naming.map((f) => rel(f.file))).toEqual([]);
  });

  it('PERMANENT: no production file under src/ reaches api/_utils/kb/ through any chain of imports (refuter KLV3 N1)', () => {
    const roots = files.filter((f) => isInside(f.file, path.join(REPO, 'src')) && !/\.test\.[cm]?jsx?$/.test(f.file)).map((f) => f.file);
    expect(roots.length).toBeGreaterThan(500);
    const reached = [...reachableFrom(roots, files, REPO)];
    // Not vacuous: src/ does reach into api/ today.
    expect(reached.some((f) => isInside(f, path.join(REPO, 'api')))).toBe(true);
    expect(reached.filter((f) => isInside(f, KB_DIR)).map(rel)).toEqual([]);
  });

  // Production files only: tests read server source through new URL(…, import.meta.url), and tests are never bundled.
  it('PERMANENT: no glob or URL pattern in a production file under src/ reaches into api/ (refuter KLV3, KL3-3 residual)', () => {
    const offending = files
      .filter((f) => isInside(f.file, path.join(REPO, 'src')) && !/\.test\.[cm]?jsx?$/.test(f.file))
      .flatMap((f) => globAndUrlPatternsOf(f.text).filter((p) => /(^|[/'"`{,\s])api[/}]/.test(p)).map((p) => `${rel(f.file)}: ${p}`));
    expect(offending).toEqual([]);
  });

  it('PERMANENT: no file under src/ (any type) and not index.html names api/_utils/kb (review KL3-3)', () => {
    const clientFiles = [];
    const all = (dir) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        if (d.isDirectory()) { if (!SKIP_DIRS.has(d.name)) all(path.join(dir, d.name)); } else if (d.isFile()) clientFiles.push(path.join(dir, d.name));
      }
    };
    all(path.join(REPO, 'src'));
    clientFiles.push(path.join(REPO, 'index.html'));
    expect(clientFiles.length).toBeGreaterThan(500);
    const naming = clientFiles.filter((f) => NAMES_KB.test(readFileSync(f, 'latin1')));
    expect(naming.map(rel)).toEqual([]);
  });

  it('PERMANENT: every call to an authorized entry point outside api/_utils/kb/ passes no deps — one argument, called directly (review KL3-1)', () => {
    const outside = files.filter((f) => !isInside(f.file, KB_DIR) && !/\.test\.[cm]?jsx?$/.test(f.file));
    // Raw and comment-stripped (a '//' inside a string can make the stripper eat a call).
    const calls = outside.flatMap((f) => [...callArgCounts(f.text, ['loadAuthorizedMethod', 'authorizedMethodFor']), ...callArgCounts(stripComments(f.text), ['loadAuthorizedMethod', 'authorizedMethodFor'])]
      .map((c) => ({ ...c, file: rel(f.file) })));
    expect(calls.filter((c) => c.args !== 1)).toEqual([]);
    // No renamed import, no .call / .apply / .bind, no optional call (refuter KLV3).
    expect(outside.filter((f) => INDIRECT_ENTRY.test(f.text)).map((f) => rel(f.file))).toEqual([]);
  });
});
