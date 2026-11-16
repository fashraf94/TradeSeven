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
import { fileURLToPath } from 'node:url';
import { stripComments, importSpecifiersOf, resolveImport, PARSE_OPTIONS } from './__fixtures__/jsSource.js';

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
  it('a computed specifier is not read — the stated limit, as before: only static strings and `${}`-free templates are edges', () => {
    expect(importSpecifiersOf("const where = './w.js';\nexport const l = () => import(where);\n")).toEqual([]);
  });
  it('a module that does not parse throws — a census never passes a file it could not read', () => {
    expect(() => importSpecifiersOf('export const x = (;\n')).toThrow();
    expect(() => stripComments('export const x = (;\n')).toThrow();
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
  it('the `@/` alias resolves under <repo>/src, as vite.config.js maps it; a package resolves to nothing', () => {
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject.js', REPO)).toBe(path.join(REPO, 'src/utils/filmRoomSubject.js'));
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject', REPO)).toBe(path.join(REPO, 'src/utils/filmRoomSubject.js'));
    expect(resolveImport(path.join(REPO, 'x.js'), 'react', REPO)).toBeNull();
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject.js')).toBeNull();
  });
});
