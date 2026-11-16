// api/_utils/mandateRationale.imports.test.js
//
// T0b — NO READER. The manager's stored reason (decisions/{id}.rationale and
// its sibling fields) is written and never read back into a model's input:
// not a prompt, not memory, not consolidation (concept V6.1 §9 and rulings
// 16–17). Source scans, the *.imports.test.js precedent; the runtime half is
// the CANARY rows in mandate-evaluate.test.js and mandateBatchTransport.test.js
// (a unique reason lands on the decision record only, and the next Mandate
// prompt does not carry it).
//
//   1. Prompt assemblers under api/ — every module in the battle C-20 registry
//      (PROMPT_CONTRIBUTING_MODULES) and the Mandate registry
//      (MANDATE_PROMPT_CONTRIBUTING_MODULES), plus every api/ module whose path
//      says "prompt" (agentConsolidationPrompt.js, seasonPrompts/*) — and the
//      TRANSITIVE local-import closure of each: none names the decisions
//      store, none names a T0b record field, none reaches a decision writer.
//      Two pure SHAPE modules are reached: mandatePromptAssembly →
//      mandateUniverseSnapshot → mandateCorporateActions → mandateSchema (for
//      CORPORATE_ACTION_TYPES, pre-T0b) → mandateRationale. They name the
//      fields because they BUILD the record. The exemption is an import EDGE,
//      not a file: inside the closure only those two edges may import them,
//      with exactly the pinned names, and their own closure stays I/O-free.
//   2. Repo-wide (api/ and src/): every mention of the decisions store is
//      COUNT-pinned per file (the money-rounding BASELINE idiom), and the
//      T0b-only field names appear in the writer set only. A new reader — a
//      screen, a memory pass, a helper inside a writer whose result a handler
//      feeds to a prompt — moves a pinned count: a deliberate review event.
//
// STATED BLIND SPOTS:
//   • `rationale` is an ordinary word (the tool asks the model for one; battle
//     prompts use it), so it cannot be banned by name. A reader is caught by
//     its store mention, a T0b-only field name, or the canary rows — not by
//     `.rationale`.
//   • "Prompt assembler" means the two registries plus a path heuristic.
//     Prompt text built inline elsewhere (api/agent/reflect.js and
//     agentConsolidationApply.js build their requests in place; a grep finds
//     some 34 such api/ modules) is not a scan-1 root: for the Mandate path
//     the canary rows cover it, for the rest scan 2's pins do.
//   • executeDecision returns the record in-process (its callers drop it);
//     the canary rows check what leaves the handler and the harvest.
//   • The closure walker follows static `import … from` / `export … from`
//     with relative specifiers only: not a side-effect `import './x.js'`, a
//     `require()`, a dynamic `import()` or a bare-package import.
//   • A store name built at run time (string concatenation) evades the literal.
//   • Scan 2 covers api/ and src/ (not scripts/).
//   • The walker's paths are POSIX on Linux (CI). On Windows, path.relative
//     returns backslashes and the walker stops early (pre-existing, reported
//     with T0b); the three-hop self-check below then fails loudly rather than
//     passing on a truncated closure.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative, dirname, sep } from 'node:path';
import { evalPathClosure, REPO_ROOT } from './__fixtures__/mandateEvalPathClosure.js';
import { PROMPT_CONTRIBUTING_MODULES } from './__fixtures__/promptHonestyRegistry.js';
import { MANDATE_PROMPT_CONTRIBUTING_MODULES } from './__fixtures__/mandatePromptRegistry.js';

const posix = (p) => p.split(sep).join('/');
const SOURCE_CACHE = new Map(); // each file is read once (scan 2 reads ~2,000 files; rows stay well inside their timeout)
const read = (rel) => {
  if (!SOURCE_CACHE.has(rel)) SOURCE_CACHE.set(rel, readFileSync(resolve(REPO_ROOT, rel), 'utf-8'));
  return SOURCE_CACHE.get(rel);
};
const SCAN_TIMEOUT_MS = 30_000;

function listSources(dirRel) {
  const out = [];
  const walk = (abs) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) {
        if (!['node_modules', '__fixtures__', '__testsupport__', '__mocks__'].includes(name)) walk(p);
      } else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(name) && !/\.test\.(js|jsx|ts|tsx|mjs|cjs)$/.test(name)) {
        out.push(posix(relative(REPO_ROOT, p)));
      }
    }
  };
  walk(resolve(REPO_ROOT, dirRel));
  return out;
}

// Any mention of the decisions store: the collection name as a string literal
// (an Admin `.collection('decisions')`, a client `collection(db, …, 'decisions')`,
// a constant `const DECISIONS = 'decisions'`), or a path literal through
// `/decisions/`. Counted per file.
const DECISIONS_MENTION = /['"`]decisions['"`]|['"`][^'"`\n]*\/decisions(?:\/|['"`])/g;
const mentions = (src) => (src.match(DECISIONS_MENTION) || []).length;
// The record fields only T0b writes (`rationale` and `modelId` are ordinary words — see the blind spots).
const T0B_FIELD = /\b(?:rationaleStatus|convictionDiagnostic|rationaleAt\w*|generationConfigVersion\w*|DECISION_RATIONALE_FIELDS)\b/;

// file → { count, note }. Every mention was READ and classified at T0b.
const STORE_BASELINE = {
  'api/_utils/compositionProtectedStoresScan.js': { count: 1, note: 'NOT a reader and NOT a writer (Practice Field T1a-2a, Astra T1A-07): the protected-store scan names the subcollection in its money-store inventory, so that a write to it anywhere in api/ or scripts/ is listed. The module parses source files; it never opens Firestore and names no T0b field.' },
  'api/_utils/mandateClosePass.js': { count: 2, note: 'writer: close-pass expiry claim + corporate-action forced-exit record' },
  'api/_utils/mandateEscape.js': { count: 1, note: 'writer: escape-hatch cancel record' },
  'api/_utils/mandateExecution.js': { count: 2, note: 'writer: disposeSubmission + executeDecision claims (direct and batch)' },
  'api/_utils/mandateRollover.js': { count: 1, note: 'writer: rollover cancel record' },
  'api/_utils/practiceField/entry.js': { count: 1, note: 'writer (Practice Field T1a-1): one basket-entry fill receipt per filled name, built by buildDecision with no reason — code decided, so the record says rationale null / rationaleStatus absent by the defaults of the builder. It reads no decision record and names no T0b field' },
  'api/_utils/practiceField/exits.js': { count: 1, note: 'writer (Practice Field T1a-2a): one sale receipt per holding that code sells (a line exit or a settlement sale), built by buildDecision with no reason, as the basket entry receipts are: code decided, so the record carries no reason by the defaults of the builder. It reads no decision record and names no T0b field' },
  'api/_utils/shadowLogger.js': { count: 1, note: 'NOT the store: the Cloud Storage training-log stream name (logDecision); reached by battle prompt modules through injectionGuard.js' },
};
// Mentions a prompt assembler's closure may hold: the non-store entries only.
const CLOSURE_MENTION_ALLOWED = { 'api/_utils/shadowLogger.js': 1 };

// The shape modules and the only import edges into them allowed inside the closure.
const SHAPE_MODULES = ['api/_utils/mandateSchema.js', 'api/_utils/mandateRationale.js'];
const SHAPE_EDGES = {
  'api/_utils/mandateCorporateActions.js -> api/_utils/mandateSchema.js': ['CORPORATE_ACTION_TYPES'],
  'api/_utils/mandateSchema.js -> api/_utils/mandateRationale.js': ['RATIONALE_AT_BASES', 'boundRationale', 'capStoredString', 'convictionDiagnosticOf'],
};
const SHAPE_CLOSURE_ALLOWED = [...SHAPE_MODULES, 'api/_utils/mandateConfig.js', 'api/_utils/canonicalHash.js'].sort();

// Every module that writes decision records.
const DECISION_WRITERS = [
  'api/_utils/mandateExecution.js',
  'api/_utils/mandateBatchTransport.js',
  'api/_utils/mandateClosePass.js',
  'api/_utils/mandateRollover.js',
  'api/_utils/mandateEscape.js',
  'api/cron/mandate-evaluate.js',
];

/**
 * Static import/export-from statements with a relative specifier:
 * [{ kind, clause, target }]. clause is the text between the keyword and
 * `from` (`{ a, b as c }`, `* as ns`, `*`, `def`, `def, { a }`).
 */
const EDGE = /\b(import|export)\s+(\*\s*(?:as\s+[\w$]+)?|[\w$]+\s*,\s*\{[^}]*\}|[\w$]+\s*,\s*\*\s*as\s+[\w$]+|\{[^}]*\}|[\w$]+)\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/g;
function edgesOf(rel) {
  const out = [];
  for (const m of read(rel).matchAll(EDGE)) {
    let target = posix(join(dirname(rel), m[3]));
    if (!target.endsWith('.js')) target += '.js';
    out.push({ kind: m[1], clause: m[2].trim(), target });
  }
  return out;
}
/** Named-only clause → the source-side names; anything else → null (not allowed into a shape module). */
function namedOnly(clause) {
  if (!clause.startsWith('{')) return null;
  return clause.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.split(/\s+as\s+/)[0].trim()).sort();
}

// ── Scan 1: prompt assemblers and their import closures ──────────────────────

const API_SOURCES = listSources('api');
// "prompt" anywhere in the path: file names (agentConsolidationPrompt.js) and folders (seasonPrompts/).
const NAMED_ASSEMBLERS = API_SOURCES.filter((rel) => /prompt/i.test(rel));
const REGISTERED = [...PROMPT_CONTRIBUTING_MODULES, ...MANDATE_PROMPT_CONTRIBUTING_MODULES].map((m) => `api/_utils/${m}`);
const ROOTS = [...new Set([...NAMED_ASSEMBLERS, ...REGISTERED])].sort();
const CLOSURE = [...new Set(ROOTS.flatMap((root) => evalPathClosure(root, []).map(posix)))]
  .filter((rel) => rel.startsWith('api/'))
  .sort();

describe('T0b no reader: prompt assemblers under api/ never read the stored reason', () => {
  it('the scan set is real: both registries resolve, and the walk reaches three hops down (self-check)', () => {
    for (const rel of REGISTERED) expect(existsSync(resolve(REPO_ROOT, rel)), `registry module missing: ${rel}`).toBe(true);
    for (const rel of [
      'api/_utils/mandatePromptAssembly.js',
      'api/_utils/mandateContextBlock.js',
      'api/_utils/mandateDecisionTool.js',
      'api/_utils/agentPromptAssembly.js',
      'api/_utils/agentEvalPromptAssembly.js',
      'api/_utils/agentConsolidationPrompt.js',
      'api/_utils/seasonPrompts/pitStopDebrief.js', // a root by its folder name
      'api/_utils/mandateUniverseSnapshot.js',  // one hop: imported by mandatePromptAssembly
      'api/_utils/mandateCorporateActions.js',  // two hops
      'api/_utils/mandateSchema.js',            // three hops — a truncated walk fails here
    ]) expect(CLOSURE, `${rel} should be in the scan set`).toContain(rel);
    expect(CLOSURE.length).toBeGreaterThan(ROOTS.length);
  });

  it('no module in the scan set mentions the decisions store (beyond the pinned non-store use)', () => {
    const offenders = CLOSURE
      .filter((rel) => mentions(read(rel)) !== (CLOSURE_MENTION_ALLOWED[rel] ?? 0))
      .map((rel) => `${rel} (${mentions(read(rel))})`);
    expect(offenders, `decisions-store mention inside a prompt assembler's graph: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no module in the scan set names a T0b record field, except the pure shape modules', () => {
    const offenders = CLOSURE.filter((rel) => !SHAPE_MODULES.includes(rel) && T0B_FIELD.test(read(rel)));
    expect(offenders, `T0b record field named inside a prompt assembler's graph: ${offenders.join(', ')}`).toEqual([]);
  });

  it('inside the scan set, the shape modules are imported only through the two pinned edges, with exactly the pinned names', () => {
    const seen = {};
    const violations = [];
    for (const rel of CLOSURE) {
      for (const e of edgesOf(rel)) {
        if (!SHAPE_MODULES.includes(e.target)) continue;
        const key = `${rel} -> ${e.target}`;
        const names = namedOnly(e.clause);
        const allowed = SHAPE_EDGES[key];
        if (!allowed || !names || names.some((n) => !allowed.includes(n))) violations.push(`${key}: ${e.kind} ${e.clause}`);
        else seen[key] = [...new Set([...(seen[key] || []), ...names])].sort();
      }
    }
    expect(violations, 'a new path into a shape module from a prompt assembler\'s graph — a formatter or reader must not ride the exemption').toEqual([]);
    expect(seen).toEqual(SHAPE_EDGES); // both edges exist, exactly as pinned (the parser is not vacuous)
  });

  it('the shape modules stay pure: their own import closure is I/O-free config and hashing', () => {
    for (const shape of SHAPE_MODULES) {
      const own = evalPathClosure(shape, []).map(posix).filter((rel) => rel.startsWith('api/'));
      for (const rel of own) {
        expect(SHAPE_CLOSURE_ALLOWED, `${shape} reaches ${rel} — the shape modules sit in a prompt's graph and must stay pure`).toContain(rel);
      }
      expect(mentions(read(shape)), `${shape} mentions the decisions store`).toBe(0);
      expect(/firebase|getFirestore|runTransaction/.test(read(shape)), `${shape} references Firestore`).toBe(false);
    }
  });

  it('no prompt assembler reaches a decision writer', () => {
    const reached = DECISION_WRITERS.filter((rel) => CLOSURE.includes(rel));
    expect(reached, `a prompt assembler's graph reaches a decision writer: ${reached.join(', ')}`).toEqual([]);
  });

  it('the patterns are not vacuous', () => {
    expect(mentions("db.collection('mandates').doc(id).collection('decisions')")).toBe(1);
    expect(mentions("collection(db, 'mandates', id, 'decisions')")).toBe(1);
    expect(mentions("getDoc(doc(db, 'mandates', String(id), 'decisions', d))")).toBe(1);
    expect(mentions("const DECISIONS = 'decisions'; collection(db, 'mandates', id, DECISIONS)")).toBe(1);
    expect(mentions('db.doc(`mandates/${id}/decisions/${d}`)')).toBe(1);
    expect(mentions('// decisions/{decisionId} is written here')).toBe(0); // prose is not a mention
    expect(T0B_FIELD.test('const s = dec.rationaleStatus;')).toBe(true);
    expect(T0B_FIELD.test('MANDATE_RATIONALE_MAX_CHARS')).toBe(false); // the bound may sit on the prompt path (mandateConfig.js)
    expect(edgesOf('api/_utils/mandateCorporateActions.js').some((e) => e.target === 'api/_utils/mandateSchema.js')).toBe(true);
  });
});

// ── Scan 2: repo-wide (api/ and src/) ────────────────────────────────────────

// T0b field names: the writers of the reason, nothing else.
const FIELD_SANCTIONED = [
  'api/_utils/mandateRationale.js',      // the bound, the diagnostic, the attribution
  'api/_utils/mandateSchema.js',         // buildDecision: the record shape
  'api/_utils/mandateExecution.js',      // the §3.5 terminals (direct and batch)
  'api/_utils/mandateBatchTransport.js', // harvest attribution
  'api/cron/mandate-evaluate.js',        // direct-transport attribution
];

describe('T0b no reader: decisions-store mentions and the record field names are pinned (api/ and src/)', () => {
  const sources = [...API_SOURCES, ...listSources('src')];

  it('scans real source trees (self-check)', () => {
    expect(sources.length).toBeGreaterThan(500);
    expect(sources).toContain('src/App.jsx');
    expect(sources).toContain('api/cron/mandate-evaluate.js');
  });

  it('every decisions-store mention is pinned at its reviewed per-file count', () => {
    const found = {};
    for (const rel of sources) {
      const n = mentions(read(rel));
      if (n > 0) found[rel] = n;
    }
    const pinned = Object.fromEntries(Object.entries(STORE_BASELINE).map(([f, v]) => [f, v.count]));
    expect(found, 'a decisions-store mention moved — a new reader (or writer) needs review against concept V6.1 §9, then a re-pin with a note').toEqual(pinned);
  }, SCAN_TIMEOUT_MS);

  it('only the writers of the reason name a T0b field', () => {
    const naming = sources.filter((rel) => T0B_FIELD.test(read(rel))).sort();
    const unsanctioned = naming.filter((rel) => !FIELD_SANCTIONED.includes(rel));
    expect(unsanctioned, 'T0b record field named outside the writer set — a reader needs review against concept V6.1 §9').toEqual([]);
    // Subset, not equality: a writer may name the fields in comments only
    // (mandateExecution.js does), and a comment edit must not red this row.
    // Non-vacuous: the builder and the bound name them.
    expect(naming).toEqual(expect.arrayContaining(['api/_utils/mandateRationale.js', 'api/_utils/mandateSchema.js']));
  }, SCAN_TIMEOUT_MS);
});
