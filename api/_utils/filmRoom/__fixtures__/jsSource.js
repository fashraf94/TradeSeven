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
// the way the language does — no context is guessed. A module the parser cannot read FAILS (it throws, naming the
// module): a census that cannot read a file never passes it.
//   importSpecifiersOf  every static import and re-export (`export … from`, `export * from`), every bare `import '…'`
//                       wherever it stands on its line, every dynamic `import(…)` whose first argument is a string or a
//                       template with no `${}` — an options argument after it included — and every `require('…')` with
//                       a static string (the fix round's review, CX2-2: Node loads ES modules through require too).
//                       Words in a string, a template or a comment that only look like an import are not imports.
//   opaqueImportsOf     what a module loads that no static reading can follow — an `import()` or `require()` of a
//                       computed value, any `createRequire` call, any `import.meta.glob` — each named. The census and
//                       the write gate FAIL on a walked module that holds one (CX2-2): an edge they cannot see is never
//                       passed as no edge.
//   stripComments       the source with every comment the parser found removed — a line comment to its end, a block
//                       comment to its newlines and one space (so line numbers hold) — strings, templates, regex
//                       literals and JSX untouched. The census's `plays` scan and the write gate read it.
//   callNamesOf         every call's method or function name, with its line — a member call's property, a computed
//                       string key included (`ref['set'](…)`), however the call is split across lines or comments —
//                       and every reference to `FieldValue`. The write gate's second reading (CX2-4).
//   resolveImport       a local specifier — relative, the app's `@/` alias (vite.config.js: `@` → src/), root-absolute
//                       or `file:` — to a module file. A query, a fragment and percent-encoding never hide a module
//                       (CX2-1: Node and Vite load `./x.js?v=1`, `./x.js#f`, `./%78.js`): they are read through. A local
//                       specifier that names NO module throws — fail closed — unless it names an asset the census does
//                       not walk (a stylesheet, JSON, an image, a font, a media file). A package resolves to nothing.
// THE PARSE CACHE: each distinct source is parsed once per process (keyed by a SHA-1 of its UTF-16 code units, so no two
// strings share an entry), so the census's walks and its whole-tree scans read the tree in about one parse of it.

import { parse } from '@babel/parser';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The parser's options: an ES module, JSX on; comments collected but never attached to nodes (only their ranges are read). */
export const PARSE_OPTIONS = Object.freeze({ sourceType: 'module', plugins: Object.freeze(['jsx']), attachComment: false });

/** Each distinct source's reading, by a hash of the source. */
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
/** A member's static name: `a.b` → 'b', `a['b']` → 'b', or null for a computed one. */
const memberName = (m) => (m.computed ? staticText(m.property) : (m.property?.type === 'Identifier' || m.property?.type === 'PrivateName' ? (m.property.name ?? m.property.id?.name) : null));

/** One walk of a program: its specifiers (source order), its opaque loads, and its calls' names. */
function readProgram(program) {
  const found = [];
  const opaque = [];
  const calls = [];
  const stack = [program];
  while (stack.length) {
    const n = stack.pop();
    if (Array.isArray(n)) { for (const x of n) if (x && typeof x === 'object') stack.push(x); continue; }
    switch (n.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'ExportNamedDeclaration': { const v = n.source ? staticText(n.source) : null; if (v) found.push([n.start, v]); break; }
      case 'ImportExpression': { const v = staticText(n.source); if (v) found.push([n.start, v]); else opaque.push('import() of a computed value'); break; }
      case 'CallExpression':
      case 'OptionalCallExpression': {
        const c = n.callee;
        if (c?.type === 'Import') { const v = staticText(n.arguments[0]); if (v) found.push([n.start, v]); else opaque.push('import() of a computed value'); }
        else if (c?.type === 'Identifier' && c.name === 'require') { const v = staticText(n.arguments[0]); if (v) found.push([n.start, v]); else opaque.push('require() of a computed value'); }
        else if (c?.type === 'Identifier' && c.name === 'createRequire') opaque.push('createRequire');
        if (c?.type === 'Identifier') calls.push({ name: c.name, line: n.loc?.start.line ?? null });
        else if (c && (c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression')) { const name = memberName(c); if (name) calls.push({ name, line: n.loc?.start.line ?? null }); }
        break;
      }
      case 'MemberExpression':
      case 'OptionalMemberExpression':
        if (n.object?.type === 'MetaProperty' && n.object.meta?.name === 'import' && memberName(n) === 'glob') opaque.push('import.meta.glob');
        break;
      case 'Identifier':
        if (n.name === 'FieldValue') calls.push({ name: 'FieldValue', line: n.loc?.start.line ?? null });
        break;
      default: break;
    }
    for (const k of Object.keys(n)) {
      if (NOT_CODE.has(k)) continue;
      const v = n[k];
      if (v && typeof v === 'object') stack.push(v);
    }
  }
  return { specifiers: found.sort((a, b) => a[0] - b[0]).map(([, v]) => v), opaque, calls };
}

/** The source read once: `{ specifiers, opaque, calls, comments }`. Throws — naming `where` — when it does not parse. */
function parsedOf(src, where = null) {
  const s = String(src);
  const key = createHash('sha1').update(Buffer.from(s, 'utf16le')).digest('hex');
  let hit = parses.get(key);
  if (!hit) {
    let ast;
    try {
      ast = parse(s, { ...PARSE_OPTIONS, plugins: [...PARSE_OPTIONS.plugins] });
    } catch (e) {
      throw Object.assign(new Error(`jsSource: ${where ?? 'a module'} does not parse: ${e.message}`), { code: e.code ?? 'BABEL_PARSER_SYNTAX_ERROR', cause: e });
    }
    hit = { ...readProgram(ast.program), comments: ast.comments.map((c) => [c.start, c.end, c.type === 'CommentBlock']) };
    parses.set(key, hit);
  }
  return hit;
}

/** Every import specifier a module's source names, in source order (CE-2). `where`: the module, named in a parse failure. */
export function importSpecifiersOf(src, where) {
  return [...parsedOf(src, where).specifiers];
}

/** What a module loads that no static reading can follow (CX2-2) — [] for every module the census walks today. */
export function opaqueImportsOf(src, where) {
  return [...parsedOf(src, where).opaque];
}

/** Every call's name with its line, and every `FieldValue` reference (CX2-4). */
export function callNamesOf(src, where) {
  return parsedOf(src, where).calls.map((c) => ({ ...c }));
}

/** `src` with every comment removed (a block comment's newlines kept, and one space), everything else untouched. */
export function stripComments(src, where) {
  const s = String(src);
  let out = '';
  let at = 0;
  for (const [start, end, block] of parsedOf(s, where).comments) {
    out += s.slice(at, start);
    if (block) out += `${s.slice(start, end).replace(/[^\n]/g, '')} `;
    at = end;
  }
  return out + s.slice(at);
}

const RESOLVE_EXT = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
/** The files a local specifier may name that are no module the census walks. */
export const ASSET_EXTENSIONS = /\.(?:css|scss|sass|less|json|svg|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp3|mp4|wav|ogg|webm|txt|md|html|csv|wasm)$/i;
const isLocal = (spec) => spec.startsWith('.') || (spec.startsWith('/') && !spec.startsWith('//')) || spec.startsWith('@/') || spec.startsWith('file:');
const moduleAt = (base) => {
  for (const ext of RESOLVE_EXT) {
    const candidate = base + ext;
    if (existsSync(candidate) && !candidate.endsWith(path.sep) && /\.(m?js|jsx)$/.test(candidate)) return candidate;
  }
  return null;
};
/**
 * A local specifier resolved to a module file — relative, the `@/` alias (`@` → `<repo>/src`), root-absolute (under the
 * repo first, as Vite reads it, then the file system), or `file:`; null for a package, for an asset, or for the alias
 * when no repo is given. A query, a fragment and percent-encoding are read through (CX2-1). A local specifier that names
 * no module and no asset THROWS: the census never passes an edge it cannot follow.
 */
export function resolveImport(fromFile, spec, repo) {
  if (typeof spec !== 'string' || !isLocal(spec)) return null;
  if (spec.startsWith('@/') && !repo) return null;
  const bare = spec.replace(/[?#].*$/s, '');
  let base;
  try {
    if (bare.startsWith('file:')) base = fileURLToPath(bare);
    else {
      const decoded = decodeURIComponent(bare);
      if (decoded.startsWith('.')) base = path.resolve(path.dirname(fromFile), decoded);
      else if (decoded.startsWith('@/')) base = path.join(repo, 'src', decoded.slice(2));
      else base = decoded;   // root-absolute: tried under the repo, then as written
    }
  } catch (e) {
    throw Object.assign(new Error(`jsSource: ${spec} (from ${fromFile}) cannot be read as a path: ${e.message}`), { code: 'UNRESOLVED_IMPORT' });
  }
  const found = bare.startsWith('/') && repo ? (moduleAt(path.join(repo, base)) ?? moduleAt(base)) : moduleAt(base);
  if (found) return found;
  if (ASSET_EXTENSIONS.test(base)) return null;
  throw Object.assign(new Error(`jsSource: ${spec} (from ${fromFile}) names no module — the census never passes an edge it cannot follow`), { code: 'UNRESOLVED_IMPORT' });
}
