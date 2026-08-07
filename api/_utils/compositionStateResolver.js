// api/_utils/compositionStateResolver.js
//
// Composition PR 2 — THE three-layer candidate-state resolver (R6-B2/R5-M1;
// design contract: docs/composition/PR2_RESOLVER_AND_EPOCH_DESIGN.md §1).
//
//   effective = resolve(base → immutable migration overlay → mutable
//               active-epoch overrides), highest-layer-wins.
//
// PURE — no I/O, no clock, no flag reads. Exactly ONE resolver defines the
// effective view; the residual scanner, migration planner, previews, and
// (later, PR 3/4) the candidate compiler and production reads all consume it.
// An implementer who "fixes" a failing scan by mutating a base record has
// defeated isolation and fails test A42.
//
// EPOCH SCOPING (A47/A49): overlay entries are written once by --apply and
// never after; post-activation saves land in the epoch layer, so a user's
// valid new value overrides a migrated one WITHOUT touching overlayContentHash
// (A47). Entries whose epochId is not the activeEpochId are retained but
// EXCLUDED from resolution — a rollback repoints activeEpochId and the
// abandoned epoch's overrides silently stop resolving; they are never deleted
// and never resurrect (A49).
//
// A36 structural posture (updated PR 3.5): no production path READS resolved
// candidate state pre-activation. Since PR 3.5 the compiler layer imports
// compositionMigration (for the projectHostedRuleDocs selection kernel), which
// imports THIS module — a transitive import EDGE exists from the endpoint/
// deploy path, but no resolver function is called outside migration/scan/
// loader/tests (the one-hop A36 sweep records compositionMigration as the
// sanctioned importer; the two-hop edge is inert and named in the PR-3.5
// audit).

import { canonicalContentHash } from './canonicalHash.js';

/** Deterministic entry key — the sort key for hashing and the dedupe key. */
export function buildEntryKey({ host, docPath, field }) {
  return `${host}|${docPath}|${field}`;
}

/**
 * Apply one dotted field path to a plain object, immutably. A segment shaped
 * `name[id]` selects the element of array `name` whose `.id === id` (the
 * ruleSnapshots addressing mode — array INDEXES are forbidden: they are not
 * stable identity). Missing intermediate → returns the object unchanged with
 * applied:false (a dangling entry is reported, never invented).
 */
export function applyFieldValue(doc, field, value) {
  const segs = field.split('.');
  const clone = (o) => (Array.isArray(o) ? [...o] : { ...o });

  function rec(node, i) {
    if (node === null || node === undefined || typeof node !== 'object') return { node, applied: false };
    const seg = segs[i];
    const m = seg.match(/^(\w+)\[(.+)\]$/);
    if (m) {
      const [, arrKey, id] = m;
      const arr = node[arrKey];
      if (!Array.isArray(arr)) return { node, applied: false };
      const idx = arr.findIndex((el) => el && el.id === id);
      if (idx === -1) return { node, applied: false };
      if (i === segs.length - 1) {
        const next = clone(node); const nextArr = [...arr]; nextArr[idx] = value; next[arrKey] = nextArr;
        return { node: next, applied: true };
      }
      const sub = rec(arr[idx], i + 1);
      if (!sub.applied) return { node, applied: false };
      const next = clone(node); const nextArr = [...arr]; nextArr[idx] = sub.node; next[arrKey] = nextArr;
      return { node: next, applied: true };
    }
    if (i === segs.length - 1) {
      const next = clone(node); next[seg] = value;
      return { node: next, applied: true };
    }
    if (!(seg in node)) return { node, applied: false };
    const sub = rec(node[seg], i + 1);
    if (!sub.applied) return { node, applied: false };
    const next = clone(node); next[seg] = sub.node;
    return { node: next, applied: true };
  }

  return rec(doc, 0);
}

/**
 * THE resolver. baseDocs: { [docPath]: plainDocData }. Entries carry the §1
 * design-note schema. Overlay entries always participate; epoch entries
 * participate iff their epochId === activeEpochId (null activeEpochId — the
 * pre-activation world — resolves overlay-over-base only when
 * includeOverlay is true, and pure base otherwise: the OLD identity's view).
 *
 * @returns {{ effectiveDocs, provenance, dangling }} — effectiveDocs is a NEW
 *   object graph (base is never mutated: verified by tests); provenance maps
 *   entryKey → the winning layer; dangling lists entries whose target path no
 *   longer exists (reported, never silently dropped).
 */
export function resolveEffectiveConfig({
  baseDocs,
  overlayEntries = [],
  epochOverrideEntries = [],
  activeEpochId = null,
  includeOverlay = true,
}) {
  const effectiveDocs = {};
  for (const [p, d] of Object.entries(baseDocs)) effectiveDocs[p] = d; // copy-on-write via applyFieldValue
  const provenance = {};
  const dangling = [];

  const applyLayer = (entries, layerName) => {
    for (const e of entries) {
      const key = e.entryKey ?? buildEntryKey(e);
      const doc = effectiveDocs[e.docPath];
      if (doc === undefined) { dangling.push({ entryKey: key, reason: 'doc_missing' }); continue; }
      const { node, applied } = applyFieldValue(doc, e.field, e.afterValue);
      if (!applied) { dangling.push({ entryKey: key, reason: 'path_missing' }); continue; }
      effectiveDocs[e.docPath] = node;
      provenance[key] = layerName;
    }
  };

  if (includeOverlay) applyLayer(overlayEntries, 'overlay');
  const activeEpoch = activeEpochId === null
    ? []
    : epochOverrideEntries.filter((e) => e.epochId === activeEpochId);
  applyLayer(activeEpoch, 'epoch'); // after overlay ⇒ highest layer wins

  return { effectiveDocs, provenance, dangling };
}

/**
 * The overlay content hash of record (§2 storage shape): canonical hash over
 * the entries sorted by entryKey. Set-like ordering is the CALLER's job (the
 * serializer preserves array order — spec §1 correction A7); sorting here
 * makes the hash insertion-order-independent by construction.
 *
 * M12 (PR 3, ledger): this is the RUN hash — it covers migrationRunId, so it
 * pins the specific apply the activation ratifies and can never match across
 * invocations. Cross-run reproducibility lives in computeOverlaySemanticHash.
 */
export function computeOverlayContentHash(entries) {
  const sorted = [...entries]
    .map((e) => ({ ...e, entryKey: e.entryKey ?? buildEntryKey(e) }))
    .sort((a, b) => (a.entryKey < b.entryKey ? -1 : a.entryKey > b.entryKey ? 1 : 0));
  return canonicalContentHash(sorted);
}

/** Alias with the M12 name of record: the run-pinning hash. */
export const computeOverlayRunHash = computeOverlayContentHash;

/**
 * M12 — the SEMANTIC hash: identical planner output over identical data yields
 * the same hash regardless of when or under which runId it was produced
 * (migrationRunId is the one clock-derived field; review P10). Two dry-runs
 * over the same fleet MUST agree here, and an apply MUST agree with the
 * dry-run that previewed it — that agreement is the founder's pre-apply check.
 */
export function computeOverlaySemanticHash(entries) {
  const sorted = [...entries]
    .map((e) => {
      const { migrationRunId, ...semantic } = e;
      return { ...semantic, entryKey: e.entryKey ?? buildEntryKey(e) };
    })
    .sort((a, b) => (a.entryKey < b.entryKey ? -1 : a.entryKey > b.entryKey ? 1 : 0));
  return canonicalContentHash(sorted);
}

/**
 * M12 — the Firestore doc id for an overlay entry: base64url(entryKey).
 * INJECTIVE (the PR-2 `'/'→'~'` substitution was not: a docPath containing
 * '~' or a '|' inside a path segment could collide two keys — review P2), and
 * always a legal Firestore id (no '/', never '.' or '..', bounded well under
 * the 1500-byte limit for real keys).
 */
export function entryDocId(entryKey) {
  return Buffer.from(entryKey, 'utf8').toString('base64url');
}
