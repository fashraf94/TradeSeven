// api/_utils/mandateRationale.imports.test.js
//
// T0b — NO READER. The manager's stored reason (decisions/{id}.rationale and
// its sibling fields) is written and never read back into a model's input:
// not a prompt, not memory, not consolidation (concept V6.1 §9 and rulings
// 16–17). Two source scans, the *.imports.test.js precedent:
//
//   1. Every prompt assembler under api/ — each module in the battle C-20
//      registry (PROMPT_CONTRIBUTING_MODULES) and the Mandate registry
//      (MANDATE_PROMPT_CONTRIBUTING_MODULES), plus every api/ module whose file
//      name says "prompt" (consolidation and memory prompts among them) — and
//      the TRANSITIVE local-import closure of each: none reads the decisions
//      store, names a T0b record field, or reaches a decision-record module.
//   2. Repo-wide (api/ and src/): the T0b-only field names appear in the
//      sanctioned writer modules and nowhere else. A future reader (a screen,
//      a memory pass) must register here — a deliberate review event.
//
// STATED BLIND SPOT: `rationale` itself is an ordinary word (the decision tool
// asks the model for one, battle prompts use it), so it cannot be banned by
// name. A reader that fetched decision docs through a helper outside these
// closures and read only `.rationale` would pass scan 1; scan 2 catches it
// only if it also names a T0b-only field. The closures are import-based: a
// dynamic import() is not followed.

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

// A read of the Mandate decisions store: any string literal naming the
// collection (collection('decisions'), collectionGroup('decisions'), a client
// collection(db, 'mandates', id, 'decisions')) or a path literal through it.
const DECISIONS_STORE = /['"`]decisions['"`]|['"`][^'"`\n]*\/decisions(?:\/|['"`])/;
// The record fields only T0b writes (rationale/modelId are ordinary words — see the blind spot).
const T0B_FIELD = /\b(?:rationaleStatus|convictionDiagnostic|rationaleAt\w*|generationConfigVersion\w*|DECISION_RATIONALE_FIELDS)\b/;
// The decision-record modules: reaching one puts the record's writer in a prompt's graph.
const RECORD_MODULES = [
  'api/_utils/mandateRationale.js',
  'api/_utils/mandateSchema.js',
  'api/_utils/mandateExecution.js',
  'api/_utils/mandateBatchTransport.js',
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
      'api/_utils/mandateConfig.js', // reached through the Mandate assembler — the closure is followed
    ]) expect(CLOSURE, `${rel} should be in the scan set`).toContain(rel);
    expect(CLOSURE.length).toBeGreaterThan(ROOTS.length);
  });

  it('no module in the scan set reads the decisions store', () => {
    const offenders = CLOSURE.filter((rel) => DECISIONS_STORE.test(read(rel)));
    expect(offenders, `decisions-store read inside a prompt assembler's graph: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no module in the scan set names a T0b record field', () => {
    const offenders = CLOSURE.filter((rel) => T0B_FIELD.test(read(rel)));
    expect(offenders, `T0b record field named inside a prompt assembler's graph: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no prompt assembler reaches a decision-record module', () => {
    const reached = RECORD_MODULES.filter((rel) => CLOSURE.includes(rel));
    expect(reached, `a prompt assembler imports the decision record's writer: ${reached.join(', ')}`).toEqual([]);
  });

  it('the patterns are not vacuous: the writers they must not meet do match', () => {
    expect(DECISIONS_STORE.test(read('api/_utils/mandateExecution.js'))).toBe(true);
    expect(DECISIONS_STORE.test("collection(db, 'mandates', id, 'decisions')")).toBe(true);
    expect(DECISIONS_STORE.test('doc(`mandates/${id}/decisions/${d}`)')).toBe(true);
    expect(T0B_FIELD.test(read('api/_utils/mandateSchema.js'))).toBe(true);
    expect(T0B_FIELD.test('const s = dec.rationaleStatus;')).toBe(true);
    expect(T0B_FIELD.test('MANDATE_RATIONALE_MAX_CHARS')).toBe(false); // the bound may sit on the prompt path (mandateConfig.js)
  });
});

// ── Scan 2: the T0b field names, repo-wide ───────────────────────────────────

// The writer set. A new entry is a reader or writer of the stored reason and
// needs review against concept V6.1 §9 (no prompt, memory or consolidation).
const SANCTIONED = [
  'api/_utils/mandateRationale.js',   // the bound, the diagnostic, the attribution
  'api/_utils/mandateSchema.js',      // buildDecision: the record shape
  'api/_utils/mandateExecution.js',   // the §3.5 terminals (direct and batch)
  'api/_utils/mandateBatchTransport.js', // harvest attribution
  'api/cron/mandate-evaluate.js',     // direct-transport attribution
];

describe('T0b no reader: the record field names appear only in the writer set (api/ and src/)', () => {
  const sources = [...API_SOURCES, ...listSources('src')];
  const naming = sources.filter((rel) => T0B_FIELD.test(read(rel))).sort();

  it('scans real source trees (self-check)', () => {
    expect(sources.length).toBeGreaterThan(500);
    expect(sources).toContain('src/App.jsx');
  });

  it('only the sanctioned writers name a T0b field', () => {
    const unsanctioned = naming.filter((rel) => !SANCTIONED.includes(rel));
    expect(unsanctioned, `T0b record field named outside the writer set (a reader needs review): ${unsanctioned.join(', ')}`).toEqual([]);
  });

  it('every sanctioned writer still names one (the list stays tight)', () => {
    expect(naming).toEqual([...SANCTIONED].sort());
  });
});
