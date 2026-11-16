// api/_utils/filmRoom/jsSource.test.js
//
// Film Room C2 — the import reader the one-door census and the excerpt's write gate walk with (__fixtures__/jsSource.js):
// since the fix round a real parser, @babel/parser with JSX (Build C Amendment E, CE-2). Comments removed, never code;
// strings, templates, regular expressions and JSX read as the language reads them; every import form an edge; words
// that only look like an import are none; a module that does not parse throws.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripComments, importSpecifiersOf, opaqueImportsOf, callNamesOf, memberNamesOf, resolveImport, PARSE_OPTIONS } from './__fixtures__/jsSource.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

describe('stripComments — comments go, code stays', () => {
  it('a `/*` inside a line comment opens nothing: the import after it stays (the regex stripper\'s blind spot, §2 review L2-1)', () => {
    const src = "// every /api/huddle/* route\nimport { a } from './a.js';\n/** doc */\nexport const b = a;\n";
    expect(importSpecifiersOf(src)).toEqual(['./a.js']);
    const old = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(old(src)).not.toContain("from './a.js'");   // what the census read before
  });
  it('the real case: api/_utils/huddle/gate.js\'s one import is read', () => {
    expect(importSpecifiersOf(readFileSync(path.join(REPO, 'api/_utils/huddle/gate.js'), 'utf8'))).toEqual(['../../../src/config/huddleFlags.js']);
  });
  it('block comments go, their newlines kept; line comments go', () => {
    expect(stripComments('a /* x\ny */ b // z\nc')).toBe('a \n  b \nc');
  });
  it('strings, templates (with ${} code, nested) and regexes are kept whole — a `//` or `/*` inside them is no comment', () => {
    const src = "const u = 'https://x.y/*'; const t = `a ${ b ? `//c` : d } /* e */`; const r = /\\/\\/[/*]x/g; f(); // g";
    const out = stripComments(src);
    expect(out).toContain("'https://x.y/*'");
    expect(out).toContain('`a ${ b ? `//c` : d } /* e */`');
    expect(out).toContain('/\\/\\/[/*]x/g');
    expect(out).toContain('f();');
    expect(out).not.toContain('// g');
  });
  it('a division is not a regex: `a / b / c` keeps going; a regex after `return` is one', () => {
    expect(stripComments('x = a / b / c; // y')).toBe('x = a / b / c; ');
    expect(stripComments('function f(s) { return /a/.test(s) // y\n}')).toBe('function f(s) { return /a/.test(s) \n}');
  });
  it('ASTRA\'S TRAP (C2-F2): a regex after `if (…)` whose class holds `/*` is a regex — the import after it is read, and the stripped text keeps both', () => {
    const src = "if (true) /[/*]/.test('x');\nimport { excerptOf as astraExcerptProbe } from './momentExcerpt.js';\n";
    expect(importSpecifiersOf(src)).toEqual(['./momentExcerpt.js']);
    expect(stripComments(src)).toBe(src);
  });
  it('a regex after `while (…)`, `for (…)`, `else`, `return`, `typeof` and `=>` — each a regex, never a comment', () => {
    for (const prefix of ["while (false) /[/*]/.test('x');", "for (let i = 0; i < 0; i += 1) /[/*]/.test('x');", "if (false) {} else /[/*]/.test('x');", "export function f() { return /[/*]/.test('x'); }", 'export const t = typeof /[/*]/;', "export const g = () => /[/*]/.test('x');"]) {
      const src = `${prefix}\nimport './x.js';\n`;
      expect(importSpecifiersOf(src), prefix).toEqual(['./x.js']);
      expect(stripComments(src), prefix).toBe(src);
    }
  });
  it('JSX text holding a backtick or a `/*` is text (the hand lexer\'s stated limit, gone)', () => {
    const src = "import a from './a.js';\nexport const P = () => <p>a ` and /* not a comment</p>;\nimport b from './b.js';\nexport const x = [a, b];\n";
    expect(importSpecifiersOf(src)).toEqual(['./a.js', './b.js']);
    expect(stripComments(src)).toBe(src);
  });
});

describe('importSpecifiersOf and resolveImport', () => {
  it('static, re-export, export-all, bare, dynamic with quotes or a static template — a `${}` template is not a specifier', () => {
    const src = "import a from './a.js';\nexport { b } from \"./b.js\";\nimport './c.js';\nconst d = () => import('./d.js');\nconst e = () => import(`./e.js`);\nconst f = (x) => import(`./${x}.js`);\nexport * from './g.js';\n";
    expect(importSpecifiersOf(src)).toEqual(['./a.js', './b.js', './c.js', './d.js', './e.js', './g.js']);
  });
  it('the pre-existing gaps close (CE-2): a bare import on the same line as a statement, and `import()` with an options argument', () => {
    expect(importSpecifiersOf("const a = 1; import './same-line.js';\n")).toEqual(['./same-line.js']);
    expect(importSpecifiersOf("export const l = () => import('./opts.js', { with: { type: 'javascript' } });\n")).toEqual(['./opts.js']);
    expect(importSpecifiersOf("import data from './d.json' with { type: 'json' };\n")).toEqual(['./d.json']);
  });
  it('no false positives: a string, a template, JSX text or a comment that only looks like an import is none', () => {
    const src = [
      "const s = \"import './s.js'\";",
      "const s2 = 'export * from \"./s2.js\"';",
      "const t = `import('./t.js')`;",
      "export const P = () => <p>import './jsx.js'</p>;",
      "// import './line.js'",
      "/* import { x } from './block.js'; */",
      'export const all = [s, s2, t];',
    ].join('\n');
    expect(importSpecifiersOf(src)).toEqual([]);
  });
  it('a computed specifier is no edge — it is OPAQUE, named, so the census fails closed on it (the fix round\'s review, CX2-2); a `require` of a string is an edge', () => {
    expect(importSpecifiersOf("const where = './w.js';\nexport const l = () => import(where);\n")).toEqual([]);
    expect(opaqueImportsOf("const where = './w.js';\nexport const l = () => import(where);\n")).toEqual(['import() of a computed value']);
    expect(importSpecifiersOf("const m = require('./r.js');\nexport const x = m;\n")).toEqual(['./r.js']);
    expect(opaqueImportsOf("const w = './r.js';\nexport const m = require(w);\n")).toEqual(['require() of a computed value']);
    expect(opaqueImportsOf("import { createRequire } from 'node:module';\nexport const r = createRequire(import.meta.url);\n").sort()).toEqual(['createRequire', 'the module loader (node:module)']);
    expect(opaqueImportsOf("export const g = import.meta.glob('./*.json', { eager: true });\n")).toEqual(['import.meta.glob']);
    expect(opaqueImportsOf("import a from './a.js';\nexport const u = import.meta.url;\nexport const l = () => import('./b.js');\n")).toEqual([]);
    // the refuter's CXV-4: the module loader however reached
    expect(opaqueImportsOf("import { createRequire as zz } from 'node:module';\nexport const r = zz;\n").sort()).toEqual(['createRequire', 'the module loader (node:module)']);
    expect(opaqueImportsOf('export const r = process.getBuiltinModule;\n')).toEqual(['getBuiltinModule']);
    expect(opaqueImportsOf("export const l = () => import('module');\n")).toEqual(['the module loader (module)']);
  });
  it('a module that does not parse throws, naming the module, with the parser\'s code (CX2-5) — a census never passes a file it could not read', () => {
    for (const read of [importSpecifiersOf, stripComments, opaqueImportsOf, callNamesOf]) {
      let err = null;
      try { read('export const x = (;\n', 'api/x.js'); } catch (e) { err = e; }
      expect(err?.code).toBe('BABEL_PARSER_SYNTAX_ERROR');
      expect(err.message).toMatch(/api\/x\.js does not parse/);
    }
  });
  it('callNamesOf: every call\'s name — a member call split across lines, after a comment, by a computed string key — and every FieldValue (CX2-4)', () => {
    const names = callNamesOf("ref.\n  set({});\nref./**/update({});\nref['delete']();\nfoo();\nexport const f = admin.firestore.FieldValue;\n").map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['set', 'update', 'delete', 'foo', 'FieldValue']));
    // the refuter's CXV-5: a call by a key no static reading names; every member named, called or not
    expect(callNamesOf('export const w = (ref, k) => ref[k]({});\n').map((c) => c.name)).toContain('[computed]');
    expect(memberNamesOf('export const w = (ref) => Reflect.apply(ref.set, ref, []);\n').map((c) => c.name)).toEqual(expect.arrayContaining(['apply', 'set']));
  });
  it('the parser is the declared devDependency at the locked version, with JSX on (CE-2)', () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(path.join(REPO, 'package-lock.json'), 'utf8'));
    expect(pkg.devDependencies['@babel/parser']).toBe(lock.packages['node_modules/@babel/parser'].version);
    expect(lock.packages[''].devDependencies['@babel/parser']).toBe(pkg.devDependencies['@babel/parser']);
    expect(createRequire(import.meta.url)('@babel/parser/package.json').version).toBe(pkg.devDependencies['@babel/parser']);
    expect(PARSE_OPTIONS.sourceType).toBe('module');
    expect(PARSE_OPTIONS.plugins).toEqual(['jsx']);
  });
  it('a query, a fragment and percent-encoding are read through; a root-absolute path and a `file:` URL resolve; a local specifier naming no module THROWS; an asset or a URL is no edge (CX2-1)', () => {
    const from = path.join(REPO, 'src/utils/x.js');
    const target = path.join(REPO, 'src/utils/filmRoomSubject.js');
    for (const spec of ['./filmRoomSubject.js?v=1', './filmRoomSubject.js#f', './film%52oomSubject.js', './filmRoomSubject?raw', '/src/utils/filmRoomSubject.js', pathToFileURL(target).href]) {
      expect(resolveImport(from, spec, REPO), spec).toBe(target);
    }
    for (const spec of ['./noSuchModule.js', './noSuchModule', '../nowhere/x.js?v=1']) {
      let err = null;
      try { resolveImport(from, spec, REPO); } catch (e) { err = e; }
      expect(err?.code, spec).toBe('UNRESOLVED_IMPORT');
    }
    for (const spec of ['./theme.css', './data.json?url', './logo.svg?react', '//cdn.example.com/x.js', 'https://example.com/x.js']) expect(resolveImport(from, spec, REPO), spec).toBeNull();
  });
  it('the `@/` alias resolves under <repo>/src, as vite.config.js maps it; a package resolves to nothing', () => {
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject.js', REPO)).toBe(path.join(REPO, 'src/utils/filmRoomSubject.js'));
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject', REPO)).toBe(path.join(REPO, 'src/utils/filmRoomSubject.js'));
    expect(resolveImport(path.join(REPO, 'x.js'), 'react', REPO)).toBeNull();
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject.js')).toBeNull();
  });
});
