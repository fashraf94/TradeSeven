// api/_utils/compositionProtectedStoresScan.js
//
// Composition PR 3 — ledger item B3 (TEST FORM): the deny-by-default
// protected-store write scan. Parses every non-test .js under api/ + scripts/
// (acorn, real AST — not a token grep) and finds every Firestore-shaped WRITE
// call (set/update/create/delete/add, incl. tx.*/batch.* variants). A site is
// legal only if its key appears in compositionProtectedStoresAllowlist.json —
// a NEW write site against a protected store (or one the scan cannot resolve)
// fails CI until a human enumerates it. This INVERTS the census ratchet:
// before B3 a writer had to match a known token to be caught; now a write
// site is illegal until allowlisted.
//
// Scope ruling (founder, Aug 6): the test form ONLY — no capability-module
// refactor. The scanner is also the §8 runbook step-0 instrument (re-run at
// the deployed SHA).
//
// B3-EXT (PR 4, ledger row): ONE-LEVEL HELPER-PARAMETER DATA-FLOW. A function
// whose OWN parameter flows into a write method — `function f(ref){ ref.set(…) }`
// (callee-base form) or `function f(tx, r){ tx.set(r, …) }` (handle ref-argument
// form) — is itself a scanned WRITE-HELPER: its definition is a listed site
// (collection `param:<name>`, unless the same call is already visible to the
// direct pass), and EVERY call site of the helper is scanned — the argument at
// the flowing param index resolves through the same chain logic, and a call
// passing a protected-store or unresolvable ref must be allowlisted at its
// per-callsite count (`call:<helper>#<idx>` keys). Exactly one hop, per the
// ruling — NOT full data-flow analysis, NOT the capability refactor.
//
// RESOLUTION MODEL (documented so the allowlist reads honestly):
//   - The scan follows the callee chain (and, for tx/batch writes, the ref
//     ARGUMENT's chain) looking for a `.collection('<literal>')`. Identifier
//     refs resolve through same-file `const x = <chain>` declarations, up to
//     three hops.
//   - A write whose collection resolves to a PROTECTED name, OR cannot be
//     resolved statically ('unresolved'), must be allowlisted. Writes that
//     resolve to a NON-protected literal pass without listing.
//   - Firestore-shaped = the chain contains .collection()/.doc()/.batch()/
//     .runTransaction(), or the base identifier looks like a transaction/
//     batch handle. Map#set etc. never qualify.
//   - B3-EXT callee-base helper detection requires REF EVIDENCE: the param is
//     ref-named (/^(ref|doc)$|Ref$|Doc$/) or the chain between param and write
//     method steps through .doc()/.collection(). The handle ref-argument form
//     needs no name evidence (tx.set(<param>, …) is Firestore by construction).
//   - Helper call sites resolve by binding: a callee identifier defined in the
//     same file, or bound via an `import { x [as y] }` specifier whose imported
//     name is a registered helper. Namespace-member calls (`mod.helper()`) are
//     not resolved (documented limit).
//
// DOCUMENTED LIMITS (adversarial review, PR 3 + B3-EXT; the scan is one belt
// among four — the B8 behavioral suite, the A46 census chokepoints, and the
// firestore.rules layer are the others):
//   - A TWO-HOP chain (helper passes its param into a second helper that
//     writes) resolves the first helper's call-site argument to 'unresolved' —
//     visible and listed at the call site, but the intermediate hop is not
//     followed (the one-level fallback only).
//   - A callee-base param write with NO ref evidence (param named e.g.
//     `target`, bare `.set()` with no .doc()/.collection() step) is invisible
//     — the ref-naming convention is repo-wide, and the census chokepoints
//     cover the known helper surfaces.
//   - DESTRUCTURED/rest params (`function f({ref})`) do not register; a
//     DESTRUCTURED write method (`const {set} = ref`) is invisible; no repo
//     code writes Firestore either way.
//   - Allowlist keys count SITES per (file, fn, method, collection) — a new
//     write added inside an already-listed tuple changes the pinned COUNT and
//     fails CI (review F3a).

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'acorn';

export const PROTECTED_COLLECTIONS = new Set([
  'agents', 'rules', 'bundles', 'compiledBuilds',
  'composition', 'compositionCandidateState', 'compositionEpochOverrides',
]);
export const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete', 'add']);
const HANDLE_RE = /^(tx|txn|transaction|batch|writeBatch)$/;
const REF_PARAM_RE = /^(ref|doc)$|Ref$|Doc$/;

// PR-1 transcription FRAGMENTS: bare object-literal data snippets consumed by
// the PR-1 registry-generation pipeline — not parseable JS modules, and they
// contain no executable code. Excluded BY NAME so any NEW unparseable file
// still fails the no-parse-failures row (deny-by-default preserved).
const KNOWN_NON_MODULE_FRAGMENTS = new Set([
  'scripts/composition/cells_C5.js',
  'scripts/composition/cells_C7.js',
]);

function walkFiles(repoRoot, rel, out) {
  for (const entry of readdirSync(resolve(repoRoot, rel), { withFileTypes: true })) {
    const p = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      // 'scripts/composition/out' is the gitignored report dir; nothing else named 'out' is excluded.
      if (entry.name !== 'node_modules' && p !== 'scripts/composition/out') walkFiles(repoRoot, p, out);
    }
    else if (/\.(js|mjs)$/.test(entry.name) && !entry.name.includes('.test.') && !KNOWN_NON_MODULE_FRAGMENTS.has(p)) out.push(p);
  }
  return out;
}

function* astWalk(node) {
  yield node;
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') yield* astWalk(c); }
    else if (v && typeof v.type === 'string') yield* astWalk(v);
  }
}

// Descend a callee/argument chain; report {firestoreShaped, collection}.
function chainInfo(node, consts, depth = 0) {
  let shaped = false; let collection = null;
  let cur = node;
  while (cur) {
    if (cur.type === 'CallExpression') {
      const cal = cur.callee;
      if (cal?.type === 'MemberExpression' && !cal.computed && cal.property?.type === 'Identifier') {
        const n = cal.property.name;
        if (n === 'collection' || n === 'doc' || n === 'batch' || n === 'runTransaction') shaped = true;
        if (n === 'collection' && cur.arguments[0]?.type === 'Literal' && typeof cur.arguments[0].value === 'string' && collection === null) {
          collection = cur.arguments[0].value;
        }
        cur = cal.object; continue;
      }
      cur = cal; continue;
    }
    if (cur.type === 'MemberExpression') { cur = cur.object; continue; }
    if (cur.type === 'AwaitExpression' || cur.type === 'ParenthesizedExpression') { cur = cur.argument ?? cur.expression; continue; }
    if (cur.type === 'Identifier') {
      if (HANDLE_RE.test(cur.name)) shaped = true;
      if (collection === null && depth < 3 && consts.has(cur.name)) {
        const sub = chainInfo(consts.get(cur.name), consts, depth + 1);
        shaped = shaped || sub.firestoreShaped;
        collection = sub.collection;
      }
      break;
    }
    break;
  }
  return { firestoreShaped: shaped, collection };
}

// B3-EXT: the terminal base Identifier of a member/call chain (no const hops —
// used to test whether a chain roots at a function PARAMETER).
function chainBaseName(node) {
  let cur = node;
  while (cur) {
    if (cur.type === 'CallExpression') { cur = cur.callee; continue; }
    if (cur.type === 'MemberExpression') { cur = cur.object; continue; }
    if (cur.type === 'AwaitExpression' || cur.type === 'ParenthesizedExpression') { cur = cur.argument ?? cur.expression; continue; }
    if (cur.type === 'Identifier') return cur.name;
    break;
  }
  return null;
}

// B3-EXT: does the chain step through .doc()/.collection() between its base
// and the write method? (Ref evidence for a non-ref-named param.)
function chainHasRefStep(node) {
  let cur = node; let has = false;
  while (cur) {
    if (cur.type === 'CallExpression') {
      const cal = cur.callee;
      if (cal?.type === 'MemberExpression' && !cal.computed
        && (cal.property?.name === 'doc' || cal.property?.name === 'collection')) has = true;
      cur = cal?.type === 'MemberExpression' ? cal.object : cal; continue;
    }
    if (cur.type === 'MemberExpression') { cur = cur.object; continue; }
    if (cur.type === 'AwaitExpression' || cur.type === 'ParenthesizedExpression') { cur = cur.argument ?? cur.expression; continue; }
    break;
  }
  return has;
}

// Shared write-method extraction (review F3(c)/design-F1: ref['set'](...) —
// a computed member whose property is a string literal counts like ref.set()).
function writeMethodOf(cal) {
  if (cal?.type !== 'MemberExpression') return null;
  const method = !cal.computed && cal.property?.type === 'Identifier' ? cal.property.name
    : cal.computed && cal.property?.type === 'Literal' && typeof cal.property.value === 'string' ? cal.property.value
    : null;
  return method && WRITE_METHODS.has(method) ? method : null;
}

/** Parse + per-file analysis: direct sites, helper defs, import bindings. */
function scanFile(relPath, src) {
  let ast;
  try {
    ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  } catch (e) {
    return {
      sites: [{ file: relPath, fn: '<parse-error>', method: 'parse', collection: `parse_error:${e.message.slice(0, 60)}` }],
      helpers: [], imports: new Map(), ast: null, consts: new Map(), enclosing: () => '<top>',
    };
  }
  // Same-file const/let single-assignment map (identifier → init expression).
  const consts = new Map();
  for (const n of astWalk(ast)) {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init) consts.set(n.id.name, n.init);
  }
  // Named function-like nodes: enclosing-fn attribution + B3-EXT param lists.
  const fnRanges = [];
  for (const n of astWalk(ast)) {
    if (n.type === 'FunctionDeclaration' && n.id) fnRanges.push({ start: n.start, end: n.end, name: n.id.name, node: n });
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier'
      && (n.init?.type === 'ArrowFunctionExpression' || n.init?.type === 'FunctionExpression')) {
      fnRanges.push({ start: n.init.start, end: n.init.end, name: n.id.name, node: n.init });
    }
    if (n.type === 'ExportDefaultDeclaration' && (n.declaration?.type === 'FunctionDeclaration' || n.declaration?.type === 'ArrowFunctionExpression')) {
      fnRanges.push({ start: n.declaration.start, end: n.declaration.end, name: n.declaration.id?.name ?? 'default', node: n.declaration });
    }
  }
  const enclosing = (pos) => {
    let best = null;
    for (const r of fnRanges) if (pos >= r.start && pos <= r.end && (!best || r.end - r.start < best.end - best.start)) best = r;
    return best?.name ?? '<top>';
  };

  // Import bindings: local name → imported name (aliases resolved).
  const imports = new Map();
  for (const n of astWalk(ast)) {
    if (n.type !== 'ImportDeclaration') continue;
    for (const s of n.specifiers) {
      if (s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier') imports.set(s.local.name, s.imported.name);
    }
  }

  const sites = [];
  for (const n of astWalk(ast)) {
    if (n.type !== 'CallExpression') continue;
    const method = writeMethodOf(n.callee);
    if (!method) continue;
    const target = chainInfo(n.callee.object, consts);
    const viaArg = !target.firestoreShaped && n.arguments[0] ? chainInfo(n.arguments[0], consts) : null;
    const shaped = target.firestoreShaped || viaArg?.firestoreShaped;
    if (!shaped) continue;
    const collection = target.collection ?? viaArg?.collection ?? null;
    sites.push({ file: relPath, fn: enclosing(n.start), method, collection });
  }

  // B3-EXT: param-write helper detection, per named function-like node. A
  // nested function checks its OWN params on its own row; walking the full
  // subtree can only over-report (deny-by-default: over is safe, under is not).
  const helpers = [];
  const seen = new Set();
  for (const r of fnRanges) {
    const params = (r.node.params || []).map((p) => (p.type === 'Identifier' ? p.name : null));
    if (!params.some(Boolean)) continue;
    for (const n of astWalk(r.node)) {
      if (n.type !== 'CallExpression') continue;
      const method = writeMethodOf(n.callee);
      if (!method) continue;
      const target = chainInfo(n.callee.object, consts);
      const argInfo = n.arguments[0] ? chainInfo(n.arguments[0], consts) : null;
      // When the chain (or ref argument) already resolves a LITERAL collection,
      // the write target is statically known and the direct pass governs — the
      // param supplies only the handle, not the target. Register a helper ONLY
      // when the collection genuinely flows through the param (unresolved here).
      if (target.collection !== null || argInfo?.collection != null) continue;
      let paramIndex = -1; let paramName = null;
      // Callee-base form: <param>[.doc(x)].set(…) with ref evidence.
      const base = chainBaseName(n.callee.object);
      const bi = base === null ? -1 : params.indexOf(base);
      if (bi >= 0 && (REF_PARAM_RE.test(base) || chainHasRefStep(n.callee.object))) {
        paramIndex = bi; paramName = base;
      }
      // Handle ref-argument form: tx.set(<param>, …) — Firestore by construction.
      if (paramIndex === -1 && target.firestoreShaped && n.arguments[0]) {
        const ab = chainBaseName(n.arguments[0]);
        const ai = ab === null ? -1 : params.indexOf(ab);
        if (ai >= 0) { paramIndex = ai; paramName = ab; }
      }
      if (paramIndex === -1) continue;
      const key = `${r.name}#${paramIndex}#${method}`;
      if (seen.has(key)) continue;
      seen.add(key);
      helpers.push({ file: relPath, name: r.name, paramIndex, paramName, method });
      // The helper's own write is a listed site UNLESS the direct pass above
      // already captured this call (handle-shaped or const-resolved chains).
      const viaArg = !target.firestoreShaped && n.arguments[0] ? chainInfo(n.arguments[0], consts) : null;
      if (!(target.firestoreShaped || viaArg?.firestoreShaped)) {
        sites.push({ file: relPath, fn: r.name, method, collection: `param:${paramName}` });
      }
    }
  }

  return { sites, helpers, imports, ast, consts, enclosing };
}

export function siteKey(s) {
  return `${s.file}::${s.fn}::${s.method}::${s.collection ?? 'unresolved'}`;
}

function needsListingFilter(s) {
  return s.collection === null
    || PROTECTED_COLLECTIONS.has(s.collection)
    || String(s.collection).startsWith('parse_error:')
    || String(s.collection).startsWith('param:');
}

/**
 * The full scan: every Firestore-shaped write site under api/ + scripts/,
 * PLUS (B3-EXT) every param-write helper definition and every call site of a
 * registered helper. `needsListing` = protected-or-unresolved sites (the
 * deny-by-default set).
 */
export function scanProtectedStoreWrites(repoRoot) {
  const files = [...walkFiles(repoRoot, 'api', []), ...walkFiles(repoRoot, 'scripts', [])];
  const perFile = files.map((f) => ({ file: f, ...scanFile(f, readFileSync(resolve(repoRoot, f), 'utf8')) }));

  // Global helper registry: name → merged param indexes (cross-file by name,
  // bound at call sites through import specifiers or same-file definition).
  const registry = new Map();
  for (const pf of perFile) {
    for (const h of pf.helpers) {
      if (!registry.has(h.name)) registry.set(h.name, new Set());
      registry.get(h.name).add(h.paramIndex);
    }
  }

  const all = [];
  for (const pf of perFile) {
    all.push(...pf.sites);
    if (!pf.ast) continue;
    const localNames = new Set(pf.helpers.map((h) => h.name));
    for (const n of astWalk(pf.ast)) {
      if (n.type !== 'CallExpression' || n.callee?.type !== 'Identifier') continue;
      const local = n.callee.name;
      const bound = localNames.has(local) ? local
        : (pf.imports.has(local) && registry.has(pf.imports.get(local)) ? pf.imports.get(local) : null);
      if (!bound || !registry.has(bound)) continue;
      for (const paramIndex of registry.get(bound)) {
        const arg = n.arguments[paramIndex];
        const info = arg ? chainInfo(arg, pf.consts) : { collection: null };
        all.push({ file: pf.file, fn: pf.enclosing(n.start), method: `call:${bound}#${paramIndex}`, collection: info.collection });
      }
    }
  }

  const needsListing = all.filter(needsListingFilter);
  return { all, needsListing };
}
