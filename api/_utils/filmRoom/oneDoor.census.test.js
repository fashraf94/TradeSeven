// api/_utils/filmRoom/oneDoor.census.test.js
//
// Film Room B2 item 7 — ONE DOOR, the census (shared contract §7; Build B
// spec §4 "One door"; Amendment E RE-5): a static walk of every relative
// import — static and dynamic — from each MODEL PATH's root modules, failing
// if any module it can reach imports the plays ledger (the store, the
// counter, the request boundary, either route) or reads `plays`. The model
// paths, each with its roots:
//   the trading evaluator and its prompt assemblers
//   the deploy path
//   the chat and voice prompts, the cockpit's chat sheet included
//   the reflection and batch-review calls
// Every path is proven NON-VACUOUS (its walk reaches a module it is known to
// use), so a path left out of the roots cannot pass by being skipped — the
// mutant this suite is built against — and the walker is proven to bite on a
// synthetic graph whose root reaches the store through a middle module.
// The reader-side half of the claim (the prompt bytes) is
// oneDoor.acceptanceC.test.js.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

/** The ledger: no model path may reach any of these. */
export const LEDGER_MODULES = Object.freeze([
  'api/_utils/filmRoom/cardStore.js',
  'api/_utils/filmRoom/cardCounter.js',
  'api/_utils/filmRoom/cardRequest.js',
  'api/film-room/card.js',
  'api/film-room/counter.js',
]);

/** The model paths and their roots — pinned here, by hand; a new model path is added here or it is not covered. */
export const MODEL_PATHS = Object.freeze({
  evaluator: Object.freeze(['api/cron/agent-evaluate.js', 'api/_utils/agentEvalPromptAssembly.js', 'api/_utils/agentPromptAssembly.js']),
  deploy: Object.freeze(['api/agent/decide.js']),
  chat: Object.freeze(['api/agent/chat.js', 'api/agent/call-response.js', 'src/screens/battleView/ChatSheet.jsx', 'src/components/Agent/AgentChat.jsx']),
  voice: Object.freeze(['api/_utils/voiceLayerPrompt.js', 'api/_utils/voiceLayerGrounding.js', 'api/cron/voice-layer-cache.js', 'api/agent/ensure-opener.js']),
  reflection: Object.freeze(['api/agent/reflect.js', 'api/cron/process-pending-reflections.js']),
  batchReview: Object.freeze(['api/cron/agent-batch-review.js']),
});

/** What each path's walk must reach — the non-vacuity oracle (a module the path is known to use). */
const KNOWN_REACH = Object.freeze({
  evaluator: ['api/_utils/agentRiskManager.js', 'api/_utils/agentEvalPromptAssembly.js', 'api/_utils/agentEvalToolSchema.js'],
  deploy: ['api/_utils/agentPromptAssembly.js', 'api/_utils/agentBattleService.js', 'api/_utils/hypothesisRecords/carriage.js'],
  chat: ['api/_utils/voiceLayerPrompt.js', 'api/_utils/directiveWriter.js'],
  voice: ['api/_utils/voiceLayerGrounding.js', 'api/_utils/voiceLayerPrompt.js'],
  reflection: ['api/_utils/agentReflectionUtils.js', 'api/agent/reflect.js'],
  batchReview: ['api/_utils/voiceLayerPrompt.js', 'api/_utils/agentEvalPromptAssembly.js'],
});

// ── the walker (the callRecords/allowlist.test.js precedent) ────────────────
const RESOLVE_EXT = ['', '.js', '.jsx', '.mjs', '/index.js', '/index.jsx'];
function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of RESOLVE_EXT) {
    const candidate = base + ext;
    if (existsSync(candidate) && !candidate.endsWith(path.sep) && /\.(m?js|jsx)$/.test(candidate)) return candidate;
  }
  return null;
}
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SPEC_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm;
function importsOf(file) {
  return [...stripComments(readFileSync(file, 'utf8')).matchAll(SPEC_RE)].map((m) => m[1] || m[2] || m[3]).filter(Boolean);
}
/** Every module reachable from `roots` (absolute paths), the roots included, with the parent that first reached each. */
export function closureOf(roots) {
  const seen = new Set(roots);
  const parent = new Map();
  const stack = [...roots];
  while (stack.length) {
    const file = stack.pop();
    for (const spec of importsOf(file)) {
      const next = resolveImport(file, spec);
      if (!next || seen.has(next)) continue;
      seen.add(next);
      parent.set(next, file);
      stack.push(next);
    }
  }
  return { seen, parent };
}
const chainTo = (parent, file, repo) => { const out = []; for (let at = file; at; at = parent.get(at)) out.unshift(path.relative(repo, at)); return out.join(' → '); };
/** A read of the ledger by name: a `plays` collection, a collection group, a path segment — in code, comments stripped. */
const PLAYS_READ = /\b(?:collection|collectionGroup|doc)\s*\(\s*['"]plays['"]|['"]plays['"]|\/plays\//;

const abs = (rel) => path.join(REPO, rel);
const isModule = (name) => /\.(m?js|jsx)$/.test(name) && !/\.test\.(m?js|jsx)$/.test(name) && !/\.ARCHIVED\./.test(name);

describe('the roots exist and the ledger modules exist (the census walks real files)', () => {
  it('every root and every ledger module is a file in this tree', () => {
    for (const roots of Object.values(MODEL_PATHS)) for (const r of roots) expect(existsSync(abs(r)), r).toBe(true);
    for (const m of LEDGER_MODULES) expect(existsSync(abs(m)), m).toBe(true);
  });
  it('the ledger modules themselves read plays (the token the scan looks for is real)', () => {
    const store = stripComments(readFileSync(abs('api/_utils/filmRoom/cardStore.js'), 'utf8'));
    expect(PLAYS_READ.test(store)).toBe(true);
  });
});

describe('ONE DOOR — no model path reaches the ledger or reads plays', () => {
  for (const [name, roots] of Object.entries(MODEL_PATHS)) {
    it(`${name}: no module reachable from its roots imports the ledger`, () => {
      const { seen, parent } = closureOf(roots.map(abs));
      for (const m of LEDGER_MODULES) {
        const hit = [...seen].find((f) => path.resolve(f) === path.resolve(abs(m)));
        expect(hit, `${name} reaches ${m}: ${hit ? chainTo(parent, hit, REPO) : ''}`).toBeUndefined();
      }
    });
    it(`${name}: no module reachable from its roots reads plays by name`, () => {
      const { seen, parent } = closureOf(roots.map(abs));
      const readers = [...seen].filter((f) => PLAYS_READ.test(stripComments(readFileSync(f, 'utf8'))));
      expect(readers.map((f) => `${path.relative(REPO, f)} (via ${chainTo(parent, f, REPO)})`)).toEqual([]);
    });
    it(`${name}: the walk is not vacuous — it reaches what the path is known to use`, () => {
      const { seen } = closureOf(roots.map(abs));
      expect(seen.size).toBeGreaterThan(roots.length);
      for (const known of KNOWN_REACH[name]) expect([...seen].some((f) => path.resolve(f) === path.resolve(abs(known))), `${name} → ${known}`).toBe(true);
    });
  }

  it('the cockpit\'s chat sheet speaks to the chat route (the mobile sheet hosts the agent chat, which posts to /api/agent/chat)', () => {
    expect(readFileSync(abs('src/components/Agent/AgentChat.jsx'), 'utf8')).toContain("'/api/agent/chat'");
    const sheet = readFileSync(abs('src/screens/battleView/ChatSheet.jsx'), 'utf8');
    expect(sheet.length).toBeGreaterThan(1000);
  });

  it('the deploy and chat paths are in the roots by name (the mutant: a census that skips either)', () => {
    expect(MODEL_PATHS.deploy).toContain('api/agent/decide.js');
    expect(MODEL_PATHS.chat).toContain('api/agent/chat.js');
    expect(MODEL_PATHS.evaluator).toContain('api/cron/agent-evaluate.js');
    expect(MODEL_PATHS.reflection).toContain('api/agent/reflect.js');
    expect(MODEL_PATHS.batchReview).toContain('api/cron/agent-batch-review.js');
    expect(Object.keys(MODEL_PATHS).sort()).toEqual(['batchReview', 'chat', 'deploy', 'evaluator', 'reflection', 'voice']);
  });
});

describe('the whole api/ tree — only the two routes import the ledger store (the door is one)', () => {
  it('every non-test module under api/ that imports cardStore.js, cardCounter.js or cardRequest.js is a film-room route or a filmRoom module', () => {
    const files = [];
    const walk = (dir) => { for (const ent of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, ent.name); if (ent.isDirectory()) { if (ent.name !== 'node_modules') walk(p); } else if (isModule(ent.name)) files.push(p); } };
    walk(abs('api'));
    walk(abs('src'));
    const importers = files.filter((f) => importsOf(f).some((spec) => /(^|\/)(cardStore|cardCounter|cardRequest)\.js$/.test(spec))).map((f) => path.relative(REPO, f).replace(/\\/g, '/')).sort();
    expect(importers).toEqual(['api/_utils/filmRoom/cardCounter.js', 'api/_utils/filmRoom/cardRequest.js', 'api/film-room/card.js', 'api/film-room/counter.js']);
  });
});

describe('the walker bites (a guard that cannot fail guards nothing)', () => {
  it('a synthetic graph whose root reaches the store through a middle module, and one that reads plays by name', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'one-door-'));
    try {
      mkdirSync(path.join(root, 'ledger'));
      writeFileSync(path.join(root, 'ledger', 'store.js'), "export const playsColOf = (db, id) => db.collection('agents').doc(id).collection('plays');\n");
      writeFileSync(path.join(root, 'mid.js'), "import { playsColOf } from './ledger/store.js';\nexport const x = playsColOf;\n");
      writeFileSync(path.join(root, 'root.js'), "// a comment: import './nothing.js'\nexport async function run() { const m = await import('./mid.js'); return m.x; }\n");
      writeFileSync(path.join(root, 'reader.js'), "export const q = (db) => db.collectionGroup('plays');\n");
      writeFileSync(path.join(root, 'clean.js'), "export const y = 1; // plays, in a comment only\n");
      const { seen, parent } = closureOf([path.join(root, 'root.js')]);
      expect([...seen].map((f) => path.basename(f)).sort()).toEqual(['mid.js', 'root.js', 'store.js']);
      expect(chainTo(parent, path.join(root, 'ledger', 'store.js'), root)).toBe('root.js → mid.js → ledger\\store.js'.replace(/\\/g, path.sep));
      expect(PLAYS_READ.test(stripComments(readFileSync(path.join(root, 'reader.js'), 'utf8')))).toBe(true);
      expect(PLAYS_READ.test(stripComments(readFileSync(path.join(root, 'clean.js'), 'utf8')))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
