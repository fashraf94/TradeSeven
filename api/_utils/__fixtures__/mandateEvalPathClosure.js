// api/_utils/__fixtures__/mandateEvalPathClosure.js
//
// Spec 1 §3.0 / §3.3 — the mandate book eval path, derived as the TRANSITIVE
// IMPORT CLOSURE of the handler entry point, NOT a filename glob. The sole-importer
// invariants ("no eval-path module imports a market-fetch client except
// mandateUniverseSnapshot.js"; "…the Anthropic client except mandateModelCall.js")
// are about the eval PATH, which is not the naming convention — a non-`mandate*`
// helper pulled onto the path (or a route through a shared seam like wireModelCall)
// would evade a glob-based scan (Risk #2, the biggest scaling risk). Walking the
// real import graph closes that hole.
//
// The walk starts at `api/cron/mandate-evaluate.js`, follows LOCAL (relative)
// imports, and STOPS at each sole importer (collecting it as a boundary leaf but
// not traversing its imports) so the sanctioned client subtrees the sole importer
// legitimately pulls in are not themselves flagged. Traversal is bounded to files
// under `api/` (non-`api/` config leaves like featureFlags are collected but not
// traversed — they carry no fetch/model client).
//
// Zero non-node imports (the __fixtures__ precedent) so this never joins a mocked
// graph.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';

// This file lives in api/_utils/__fixtures__, so repo root is three levels up.
const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/** Resolve a relative import spec from an importer (both repo-relative) to a repo-relative .js file, or null. */
function resolveSpec(importerRel, spec) {
  if (!spec.startsWith('.')) return null; // bare module (node_modules) — not a file to traverse
  let target = join(dirname(importerRel), spec);
  if (!target.endsWith('.js')) target += '.js';
  const abs = resolve(REPO_ROOT, target);
  return existsSync(abs) ? relative(REPO_ROOT, abs) : null;
}

/**
 * The transitive local-import closure of `entryRel`, stopping at (but including)
 * every path in `stopLeaves`. Returns a sorted array of repo-relative .js paths.
 */
export function evalPathClosure(entryRel, stopLeaves = []) {
  const stop = new Set(stopLeaves);
  const seen = new Set();
  const stack = [entryRel];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (stop.has(rel)) continue;                 // boundary leaf: collected, not traversed
    if (!rel.startsWith('api/')) continue;        // config leaf outside api/: collected, not traversed
    const src = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const next = resolveSpec(rel, m[1]);
      if (next && !next.endsWith('.test.js')) stack.push(next);
    }
  }
  return [...seen].sort();
}

export { REPO_ROOT };
