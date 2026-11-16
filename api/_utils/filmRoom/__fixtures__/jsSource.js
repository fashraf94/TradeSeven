// api/_utils/filmRoom/__fixtures__/jsSource.js
//
// Film Room C2 (the §2 review's L2-1) — READING A MODULE'S IMPORTS, for the one-door census and the moment excerpt's
// write gate. The walkers before this stripped comments with two regular expressions, and a `/*` inside a line comment
// ("every /api/huddle/* route") opened a "block comment" that ate live code up to the next `*/` — real imports vanished
// from the census (api/_utils/huddle/gate.js's only import, among others). This is a small lexer instead:
//   comments      `//` to the end of the line, and `/* … */` (its newlines kept, so line numbers hold) — never inside
//                 a string, a template literal or a regular expression literal;
//   strings       '…' and "…", kept verbatim (a `plays` read by name stays visible), ending at their quote or the line;
//   templates     `…`, kept verbatim, with `${ … }` read as code, nested to any depth;
//   regexes       a `/` where an expression may start (after an operator, a bracket, a comma, a keyword such as
//                 `return`) begins a regular expression literal, kept verbatim; elsewhere it is division.
// Its stated limits: JSX text holding a backtick or a `/*` is read as code (no model path's module holds one today);
// `require()` is not read (the census's modules are ES modules).
//
// importSpecifiersOf: every static import and re-export's specifier, every `import('…')` with a static string or
// template, and every bare `import '…'`. resolveImport: a relative specifier, or the app's `@/` alias (vite.config.js:
// `@` → src/), to a file of the tree.

import { existsSync } from 'node:fs';
import path from 'node:path';

const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORD = /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)\s*$/;

/** `src` with every comment removed (a block comment's newlines kept), strings, templates and regexes untouched. */
export function stripComments(src) {
  const s = String(src);
  const n = s.length;
  let out = '';
  let i = 0;
  let depth = 0;           // `{` depth in code
  const resume = [];       // the depths at which a `}` closes a template's `${`
  let last = '';           // the last significant character emitted in code
  const lastSigOf = (t) => { const tr = t.replace(/\s+$/, ''); return tr ? tr[tr.length - 1] : null; };
  const emit = (t) => { out += t; const l = lastSigOf(t); if (l !== null) last = l; };
  /** Read template text from `j` (just after its opening backtick, or after a `}` that resumed it). */
  const template = (j) => {
    let k = j;
    while (k < n) {
      const ch = s[k];
      if (ch === '\\') { k += 2; continue; }
      if (ch === '`') { emit(s.slice(i, k + 1)); i = k + 1; return; }
      if (ch === '$' && s[k + 1] === '{') { emit(s.slice(i, k + 2)); i = k + 2; resume.push(depth); depth += 1; return; }
      k += 1;
    }
    emit(s.slice(i)); i = n;
  };
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '/') { while (i < n && s[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') {
      const end = s.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out += `${s.slice(i, stop).replace(/[^\n]/g, '')} `;
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      let k = i + 1;
      while (k < n && s[k] !== c && s[k] !== '\n') k += s[k] === '\\' ? 2 : 1;
      emit(s.slice(i, k + 1)); i = k + 1;
      continue;
    }
    if (c === '`') { template(i + 1); continue; }
    if (c === '{') { depth += 1; emit(c); i += 1; continue; }
    if (c === '}') {
      if (resume.length && resume[resume.length - 1] === depth - 1) { resume.pop(); depth -= 1; out += c; i += 1; template(i); continue; }
      depth -= 1; emit(c); i += 1; continue;
    }
    if (c === '/' && (REGEX_AFTER.has(last) || REGEX_KEYWORD.test(out))) {
      let k = i + 1;
      let inClass = false;
      let ok = false;
      while (k < n && s[k] !== '\n') {
        const ch = s[k];
        if (ch === '\\') { k += 2; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { ok = true; break; }
        k += 1;
      }
      if (ok) {
        k += 1;
        while (k < n && /[a-z]/i.test(s[k])) k += 1;
        emit(s.slice(i, k)); i = k;
        continue;
      }
    }
    emit(c); i += 1;
  }
  return out;
}

/** Every import specifier a module's source names (comments stripped first). */
const SPEC_RE = /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*(?:'([^']+)'|"([^"]+)"|`([^`$]+)`)\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;
export function importSpecifiersOf(src) {
  return [...stripComments(src).matchAll(SPEC_RE)].map((m) => m[1] || m[2] || m[3] || m[4] || m[5]).filter(Boolean);
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
