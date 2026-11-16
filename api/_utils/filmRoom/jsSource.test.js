// api/_utils/filmRoom/jsSource.test.js
//
// Film Room C2 (the §2 review's L2-1) — the import reader the one-door census and the excerpt's write gate walk with
// (__fixtures__/jsSource.js): comments removed, never code; strings, templates and regular expressions read as such.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments, importSpecifiersOf, resolveImport } from './__fixtures__/jsSource.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

describe('stripComments — comments go, code stays', () => {
  it('a `/*` inside a line comment opens nothing: the import after it stays (the regex stripper\'s blind spot)', () => {
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
  it('a division is not a regex: `a / b / c` keeps going', () => {
    expect(stripComments('x = a / b / c; // y')).toBe('x = a / b / c; ');
    expect(stripComments('return /a/.test(s) // y')).toBe('return /a/.test(s) ');
  });
});

describe('importSpecifiersOf and resolveImport', () => {
  it('static, re-export, bare, dynamic with quotes or a static template — a `${}` template is not a specifier', () => {
    const src = "import a from './a.js';\nexport { b } from \"./b.js\";\nimport './c.js';\nconst d = () => import('./d.js');\nconst e = () => import(`./e.js`);\nconst f = (x) => import(`./${x}.js`);\n";
    expect(importSpecifiersOf(src)).toEqual(['./a.js', './b.js', './c.js', './d.js', './e.js']);
  });
  it('the `@/` alias resolves under <repo>/src, as vite.config.js maps it; a package resolves to nothing', () => {
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject.js', REPO)).toBe(path.join(REPO, 'src/utils/filmRoomSubject.js'));
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject', REPO)).toBe(path.join(REPO, 'src/utils/filmRoomSubject.js'));
    expect(resolveImport(path.join(REPO, 'x.js'), 'react', REPO)).toBeNull();
    expect(resolveImport(path.join(REPO, 'x.js'), '@/utils/filmRoomSubject.js')).toBeNull();
  });
});
