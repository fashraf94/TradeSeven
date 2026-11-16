// api/_utils/filmRoom/__fixtures__/jsSource.js
//
// Film Room C2 — READING A MODULE'S IMPORTS, for the one-door census and the moment excerpt's write gate.
//
// THE HISTORY. The walkers first stripped comments with two regular expressions, and a `/*` inside a line comment
// ("every /api/huddle/* route") opened a "block comment" that ate live code — real imports vanished from the census
// (the §2 review's L2-1). A hand lexer replaced them, and Astra's C2 review (C2-F2) hid a real import behind a regex
// literal after an `if (…)`: `if (true) /[/*]/.test('x');` — the lexer read that `/` as division, the `/*` in the
// character class as a comment, and the import after it vanished, from every one of the twenty roots.
//
// NOW A REAL PARSER (Build C Amendment E, CE-2): `@babel/parser`, JSX on, declared as a devDependency at the version
// the lockfile already holds. It tells a regex literal from division, a comment from a string, a template or JSX text,
// the way the language does — no context is guessed. A module the parser cannot read FAILS (it throws): a census that
// cannot read a file never passes it.
//   importSpecifiersOf  every static import and re-export (`export … from`, `export * from`), every bare `import '…'`
//                       wherever it stands on its line, and every dynamic `import(…)` whose first argument is a string
//                       or a template with no `${}` — an options argument after it included. Words in a string, a
//                       template or a comment that only look like an import are not imports. `require()` is not read
//                       (the census's modules are ES modules).
//   stripComments       the source with every comment the parser found removed — a line comment to its end, a block
//                       comment to its newlines and one space (so line numbers hold) — strings, templates, regex
//                       literals and JSX untouched. The census's `plays` scan and the write gate read it.
//   resolveImport       a relative specifier, or the app's `@/` alias (vite.config.js: `@` → src/), to a file.
// THE PARSE CACHE: each distinct source is parsed once per process (keyed by its SHA-1), so the census's walks and its
// whole-tree scans read the tree in about one parse of it.

import { parse } from '@babel/parser';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** The parser's options: an ES module, JSX on; comments collected but never attached to nodes (only their ranges are read). */
export const PARSE_OPTIONS = Object.freeze({ sourceType: 'module', plugins: Object.freeze(['jsx']), attachComment: false });

/** Each distinct source's specifiers and comment ranges, by the source's SHA-1. */
const parses = new Map();

/** A specifier written as a static string: a string literal, or a template with no `${}`. */
const staticText = (node) => {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0]?.value?.cooked ?? null;
  return null;
};
/** Keys of a node that hold no code. */
const NOT_CODE = new Set(['loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments', 'start', 'end', 'range']);

/** Every import specifier in a program, in source order. */
function specifiersIn(program) {
  const found = [];
  const stack = [program];
  while (stack.length) {
    const n = stack.pop();
    if (Array.isArray(n)) { for (const x of n) if (x && typeof x === 'object') stack.push(x); continue; }
    switch (n.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'ExportNamedDeclaration': { const v = n.source ? staticText(n.source) : null; if (v) found.push([n.start, v]); break; }
      case 'ImportExpression': { const v = staticText(n.source); if (v) found.push([n.start, v]); break; }
      case 'CallExpression': if (n.callee?.type === 'Import') { const v = staticText(n.arguments[0]); if (v) found.push([n.start, v]); } break;
      default: break;
    }
    for (const k of Object.keys(n)) {
      if (NOT_CODE.has(k)) continue;
      const v = n[k];
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

/** The source parsed once: `{ specifiers, comments }` (each comment `[start, end, isBlock]`). Throws when it does not parse. */
function parsedOf(src) {
  const s = String(src);
  const key = createHash('sha1').update(s).digest('hex');
  let hit = parses.get(key);
  if (!hit) {
    const ast = parse(s, { ...PARSE_OPTIONS, plugins: [...PARSE_OPTIONS.plugins] });
    hit = { specifiers: specifiersIn(ast.program), comments: ast.comments.map((c) => [c.start, c.end, c.type === 'CommentBlock']) };
    parses.set(key, hit);
  }
  return hit;
}

/** Every import specifier a module's source names, in source order (CE-2). */
export function importSpecifiersOf(src) {
  return [...parsedOf(src).specifiers];
}

/** `src` with every comment removed (a block comment's newlines kept, and one space), everything else untouched. */
export function stripComments(src) {
  const s = String(src);
  let out = '';
  let at = 0;
  for (const [start, end, block] of parsedOf(s).comments) {
    out += s.slice(at, start);
    if (block) out += `${s.slice(start, end).replace(/[^\n]/g, '')} `;
    at = end;
  }
  return out + s.slice(at);
}

const RESOLVE_EXT = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
/** A relative specifier, or the `@/` alias (`@` → `<repo>/src`), resolved to a module file; null for a package or nothing. */
export function resolveImport(fromFile, spec, repo) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else if (spec.startsWith('@/') && repo) base = path.join(repo, 'src', spec.slice(2));
  else return null;
  for (const ext of RESOLVE_EXT) {
    const candidate = base + ext;
    if (existsSync(candidate) && !candidate.endsWith(path.sep) && /\.(m?js|jsx)$/.test(candidate)) return candidate;
  }
  return null;
}
