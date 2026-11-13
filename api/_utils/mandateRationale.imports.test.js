// api/_utils/mandateRationale.imports.test.js
//
// T0b — NO READER. The manager's stored reason (decisions/{id}.rationale and
// its sibling fields) is written and never read back into a model's input:
// not a prompt, not memory, not consolidation (concept V6.1 §9 and rulings
// 16–17). Source scans, the *.imports.test.js precedent:
//
//   1. Every prompt assembler under api/ — each module in the battle C-20
//      registry (PROMPT_CONTRIBUTING_MODULES) and the Mandate registry
//      (MANDATE_PROMPT_CONTRIBUTING_MODULES), plus every api/ module whose file
//      name says "prompt" (the consolidation prompt among them) — and the
//      TRANSITIVE local-import closure of each: none touches the decisions
//      store, none names a T0b record field, none reaches a decision writer.
//      Two pure SHAPE modules are reached and exempt from the field-name
//      check: mandatePromptAssembly → mandateUniverseSnapshot →
//      mandateCorporateActions → mandateSchema (for CORPORATE_ACTION_TYPES,
//      pre-T0b) → mandateRationale. They name the fields because they BUILD
//      the record; the exemption holds only while their own import closure
//      stays I/O-free, which is asserted.
//   2. Repo-wide (api/ and src/): decisions-store access and the T0b-only
//      field names appear in the sanctioned writer modules and nowhere else.
//      A future reader (a screen, a memory pass, a handler feeding a prompt)
//      must register here: a deliberate review event.
//
// STATED BLIND SPOTS: `rationale` itself is an ordinary word (the decision
// tool asks the model for one; battle prompts use it), so it cannot be banned
// by name — a reader is caught by its store access or a T0b-only field name,
// not by `.rationale`. The closures follow static relative imports only; a
// dynamic import() or a bare-package import is not followed.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { evalPathClosure, REPO_ROOT } from './__fixtures__/mandateEvalPathClosure.js';
import { PROMPT_CONTRIBUTING_MODULES } from './__fixtures__/promptHonestyRegistry.js';
import { MANDATE_PROMPT_CONTRIBUTING_MODULES } from './__fixtures__/mandatePromptRegistry.js';

const posix = (p) => p.split(sep).join('/');
const read = (rel) => readFileSync(resolve(REPO_ROOT, rel), 'utf-8');

function listSources(dirRel) {
  const out = [];
  const walk = (abs) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) {
        if (!['node_modules', '__fixtures__', '__testsupport__', '__mocks__'].includes(name)) walk(p);
      } else if (/\.(js|jsx|ts|tsx|mjs)$/.test(name) && !/\.test\.(js|jsx|ts|tsx|mjs)$/.test(name)) {
        out.push(posix(relative(REPO_ROOT, p)));
      }
    }
  };
  walk(resolve(REPO_ROOT, dirRel));
  return out;
}

// Access to the Mandate decisions store, in every Firestore shape: an Admin
// SDK `.collection('decisions')` / `collectionGroup('decisions')`, a client
// `collection(db, 'mandates', id, 'decisions')` / `doc(db, …, 'decisions', d)`,
// or a path literal through `/decisions/`. A bare 'decisions' argument to a
// non-Firestore call is not store access (shadowLogger's training-log stream
// to Cloud Storage is the standing example — asserted below).
const DECISIONS_STORE = /\b(?:collection|collectionGroup|doc)\s*\([^)]*['"`]decisions['"`]|['"`][^'"`\n]*\/decisions(?:\/|['"`])/;
// The record fields only T0b writes (`rationale` and `modelId` are ordinary words — see the blind spots).
const T0B_FIELD = /\b(?:rationaleStatus|convictionDiagnostic|rationaleAt\w*|generationConfigVersion\w*|DECISION_RATIONALE_FIELDS)\b/;

// The pure shape modules a prompt assembler reaches (header), and the only
// modules their closure may contain.
const SHAPE_MODULES = ['api/_utils/mandateSchema.js', 'api/_utils/mandateRationale.js'];
const SHAPE_CLOSURE_ALLOWED = [...SHAPE_MODULES, 'api/_utils/mandateConfig.js', 'api/_utils/canonicalHash.js'].sort();

// Every module that writes decision records (store access or the T0b fields).
const DECISION_WRITERS = [
  'api/_utils/mandateExecution.js',
  'api/_utils/mandateBatchTransport.js',
  'api/_utils/mandateClosePass.js',
  'api/_utils/mandateRollover.js',
  'api/_utils/mandateEscape.js',
  'api/cron/mandate-evaluate.js',
];

// ── Scan 1: prompt assemblers and their import closures ──────────────────────

const API_SOURCES = listSources('api');
const NAMED_ASSEMBLERS = API_SOURCES.filter((rel) => /prompt/i.test(rel.split('/').pop()));
const REGISTERED = [...PROMPT_CONTRIBUTING_MODULES, ...MANDATE_PROMPT_CONTRIBUTING_MODULES].map((m) => `api/_utils/${m}`);
const ROOTS = [...new Set([...NAMED_ASSEMBLERS, ...REGISTERED])].sort();
const CLOSURE = [...new Set(ROOTS.flatMap((root) => evalPathClosure(root, []).map(posix)))]
  .filter((rel) => rel.startsWith('api/'))
  .sort();

describe('T0b no reader: prompt assemblers under api/ never read the stored reason', () => {
  it('the scan set is real: both registries resolve, the known assemblers and their helpers are in it (self-check)', () => {
    for (const rel of REGISTERED) expect(existsSync(resolve(REPO_ROOT, rel)), `registry module missing: ${rel}`).toBe(true);
    for (const rel of [
      'api/_utils/mandatePromptAssembly.js',
      'api/_utils/mandateContextBlock.js',
      'api/_utils/mandateDecisionTool.js',
      'api/_utils/agentPromptAssembly.js',
      'api/_utils/agentEvalPromptAssembly.js',
      'api/_utils/agentConsolidationPrompt.js',
      'api/_utils/mandateUniverseSnapshot.js', // a helper two hops down — the closure is followed
    ]) expect(CLOSURE, `${rel} should be in the scan set`).toContain(rel);
    expect(CLOSURE.length).toBeGreaterThan(ROOTS.length);
  });

  it('no module in the scan set touches the decisions store', () => {
    const offenders = CLOSURE.filter((rel) => DECISIONS_STORE.test(read(rel)));
    expect(offenders, `decisions-store access inside a prompt assembler's graph: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no module in the scan set names a T0b record field, except the pure shape modules', () => {
    const offenders = CLOSURE.filter((rel) => !SHAPE_MODULES.includes(rel) && T0B_FIELD.test(read(rel)));
    expect(offenders, `T0b record field named inside a prompt assembler's graph: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the shape modules stay pure: their own import closure is I/O-free config and hashing', () => {
    for (const shape of SHAPE_MODULES) {
      const own = evalPathClosure(shape, []).map(posix).filter((rel) => rel.startsWith('api/'));
      for (const rel of own) {
        expect(SHAPE_CLOSURE_ALLOWED, `${shape} reaches ${rel} — the shape modules sit in a prompt's graph and must stay pure`).toContain(rel);
      }
      expect(DECISIONS_STORE.test(read(shape)), `${shape} touches the decisions store`).toBe(false);
      expect(/firebase|getFirestore|runTransaction/.test(read(shape)), `${shape} references Firestore`).toBe(false);
    }
  });

  it('no prompt assembler reaches a decision writer', () => {
    const reached = DECISION_WRITERS.filter((rel) => CLOSURE.includes(rel));
    expect(reached, `a prompt assembler's graph reaches a decision writer: ${reached.join(', ')}`).toEqual([]);
  });

  it('the patterns are not vacuous, and the store pattern is not over-broad', () => {
    expect(DECISIONS_STORE.test(read('api/_utils/mandateExecution.js'))).toBe(true);
    expect(DECISIONS_STORE.test("collection(db, 'mandates', id, 'decisions')")).toBe(true);
    expect(DECISIONS_STORE.test("doc(db, 'mandates', id, 'decisions', d)")).toBe(true);
    expect(DECISIONS_STORE.test('db.doc(`mandates/${id}/decisions/${d}`)')).toBe(true);
    expect(DECISIONS_STORE.test("db.collectionGroup('decisions')")).toBe(true);
    expect(read('api/_utils/shadowLogger.js')).toContain("appendToStream('decisions'");
    expect(DECISIONS_STORE.test(read('api/_utils/shadowLogger.js'))).toBe(false); // a GCS log stream, not the store
    expect(T0B_FIELD.test(read('api/_utils/mandateSchema.js'))).toBe(true);
    expect(T0B_FIELD.test('const s = dec.rationaleStatus;')).toBe(true);
    expect(T0B_FIELD.test('MANDATE_RATIONALE_MAX_CHARS')).toBe(false); // the bound may sit on the prompt path (mandateConfig.js)
  });
});

// ── Scan 2: repo-wide (api/ and src/) ────────────────────────────────────────

// Decision-store access: the record writers, nothing else.
const STORE_SANCTIONED = [
  'api/_utils/mandateClosePass.js',   // close-pass expiry + corporate-action forced exits
  'api/_utils/mandateEscape.js',      // escape-hatch cancel
  'api/_utils/mandateExecution.js',   // the §3.5 terminals (direct and batch)
  'api/_utils/mandateRollover.js',    // rollover cancel
];
// T0b field names: the writers of the reason, nothing else.
const FIELD_SANCTIONED = [
  'api/_utils/mandateRationale.js',      // the bound, the diagnostic, the attribution
  'api/_utils/mandateSchema.js',         // buildDecision: the record shape
  'api/_utils/mandateExecution.js',      // the §3.5 terminals (direct and batch)
  'api/_utils/mandateBatchTransport.js', // harvest attribution
  'api/cron/mandate-evaluate.js',        // direct-transport attribution
];

describe('T0b no reader: decisions-store access and the record field names stay in the writer set (api/ and src/)', () => {
  const sources = [...API_SOURCES, ...listSources('src')];

  it('scans real source trees (self-check)', () => {
    expect(sources.length).toBeGreaterThan(500);
    expect(sources).toContain('src/App.jsx');
    expect(sources).toContain('api/cron/mandate-evaluate.js');
  });

  it('only the record writers touch the decisions store', () => {
    const touching = sources.filter((rel) => DECISIONS_STORE.test(read(rel))).sort();
    expect(touching, 'decisions-store access outside the writer set — a reader needs review against concept V6.1 §9').toEqual([...STORE_SANCTIONED].sort());
  });

  it('only the writers of the reason name a T0b field', () => {
    const naming = sources.filter((rel) => T0B_FIELD.test(read(rel))).sort();
    expect(naming, 'T0b record field named outside the writer set — a reader needs review against concept V6.1 §9').toEqual([...FIELD_SANCTIONED].sort());
  });
});
