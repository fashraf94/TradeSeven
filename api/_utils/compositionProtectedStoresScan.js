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
//
// DOCUMENTED LIMITS (adversarial review, PR 3 — the scan is one belt among
// four; the B8 behavioral suite, the A46 census chokepoints, and the
// firestore.rules layer are the others):
//   - A write through a ref received as a FUNCTION PARAMETER
//     (`function f(ref){ ref.set(d) }`) is invisible to the static chain —
//     the helper's CALLERS are visible instead, and the census chokepoint
//     scans cover the known helper surfaces (txUpdateAgentSettings,
//     writeCompiledBuildsInTx, copyAgentSubcollections).
//   - A DESTRUCTURED write method (`const {set} = ref; set(d)`) is invisible;
//     no repo code writes Firestore this way.
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

/** Scan one parsed file; returns write-site records. */
function scanSource(relPath, src) {
  let ast;
  try {
    ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  } catch (e) {
    return [{ file: relPath, fn: '<parse-error>', method: 'parse', collection: `parse_error:${e.message.slice(0, 60)}` }];
  }
  // Same-file const/let single-assignment map (identifier → init expression).
  const consts = new Map();
  for (const n of astWalk(ast)) {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init) consts.set(n.id.name, n.init);
  }
  // Enclosing-function naming via a positioned pass.
  const fnRanges = [];
  for (const n of astWalk(ast)) {
    if (n.type === 'FunctionDeclaration' && n.id) fnRanges.push({ start: n.start, end: n.end, name: n.id.name });
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier'
      && (n.init?.type === 'ArrowFunctionExpression' || n.init?.type === 'FunctionExpression')) {
      fnRanges.push({ start: n.init.start, end: n.init.end, name: n.id.name });
    }
    if (n.type === 'ExportDefaultDeclaration' && (n.declaration?.type === 'FunctionDeclaration' || n.declaration?.type === 'ArrowFunctionExpression')) {
      fnRanges.push({ start: n.declaration.start, end: n.declaration.end, name: n.declaration.id?.name ?? 'default' });
    }
  }
  const enclosing = (pos) => {
    let best = null;
    for (const r of fnRanges) if (pos >= r.start && pos <= r.end && (!best || r.end - r.start < best.end - best.start)) best = r;
    return best?.name ?? '<top>';
  };

  const sites = [];
  for (const n of astWalk(ast)) {
    if (n.type !== 'CallExpression') continue;
    const cal = n.callee;
    if (cal?.type !== 'MemberExpression') continue;
    // review F3(c)/design-F1: ref['set'](...) — a computed member whose
    // property is a string literal counts exactly like ref.set(...).
    const method = !cal.computed && cal.property?.type === 'Identifier' ? cal.property.name
      : cal.computed && cal.property?.type === 'Literal' && typeof cal.property.value === 'string' ? cal.property.value
      : null;
    if (!method || !WRITE_METHODS.has(method)) continue;
    const target = chainInfo(cal.object, consts);
    const viaArg = !target.firestoreShaped && n.arguments[0] ? chainInfo(n.arguments[0], consts) : null;
    const shaped = target.firestoreShaped || viaArg?.firestoreShaped;
    if (!shaped) continue;
    const collection = target.collection ?? viaArg?.collection ?? null;
    sites.push({ file: relPath, fn: enclosing(n.start), method, collection });
  }
  return sites;
}

export function siteKey(s) {
  return `${s.file}::${s.fn}::${s.method}::${s.collection ?? 'unresolved'}`;
}

/**
 * The full scan: every Firestore-shaped write site under api/ + scripts/.
 * `needsListing` = protected-or-unresolved sites (the deny-by-default set).
 */
export function scanProtectedStoreWrites(repoRoot) {
  const files = [...walkFiles(repoRoot, 'api', []), ...walkFiles(repoRoot, 'scripts', [])];
  const all = [];
  for (const f of files) all.push(...scanSource(f, readFileSync(resolve(repoRoot, f), 'utf8')));
  const needsListing = all.filter((s) => s.collection === null || PROTECTED_COLLECTIONS.has(s.collection) || String(s.collection).startsWith('parse_error:'));
  return { all, needsListing };
}
