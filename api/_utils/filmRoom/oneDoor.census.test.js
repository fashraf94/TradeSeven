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
  // review L2-1: two more model paths — the debate (the agent document → a system prompt → the model) and the
  // tournament's agent board production (api/_utils/tournamentAgentBoards.js, reached from the orchestrator and its route)
  debate: Object.freeze(['api/agent/debate.js']),
  tournament: Object.freeze(['api/cron/tournament-orchestrator.js', 'api/tournament/produce-agent-boards.js']),
});

/** Every root list, pinned whole (review L4-1): a root dropped from any path reds this, whatever the walk still reaches. */
export const MODEL_PATH_ROOTS = Object.freeze({
  evaluator: ['api/cron/agent-evaluate.js', 'api/_utils/agentEvalPromptAssembly.js', 'api/_utils/agentPromptAssembly.js'],
  deploy: ['api/agent/decide.js'],
  chat: ['api/agent/chat.js', 'api/agent/call-response.js', 'src/screens/battleView/ChatSheet.jsx', 'src/components/Agent/AgentChat.jsx'],
  voice: ['api/_utils/voiceLayerPrompt.js', 'api/_utils/voiceLayerGrounding.js', 'api/cron/voice-layer-cache.js', 'api/agent/ensure-opener.js'],
  reflection: ['api/agent/reflect.js', 'api/cron/process-pending-reflections.js'],
  batchReview: ['api/cron/agent-batch-review.js'],
  debate: ['api/agent/debate.js'],
  tournament: ['api/cron/tournament-orchestrator.js', 'api/tournament/produce-agent-boards.js'],
});

/** What each path's walk must reach — the non-vacuity oracle: modules the path is known to use, none of them a root of that path (review L2-3). */
const KNOWN_REACH = Object.freeze({
  evaluator: ['api/_utils/agentRiskManager.js', 'api/_utils/agentEvalToolSchema.js', 'api/_utils/agentEvalTransport.js'],
  deploy: ['api/_utils/agentPromptAssembly.js', 'api/_utils/agentBattleService.js', 'api/_utils/deployBuildValidation.js'],
  chat: ['api/_utils/directiveWriter.js', 'api/_utils/callRecords/callsBlock.js', 'api/_utils/callRecords/answers.js'],
  voice: ['api/_utils/wireReader.js', 'api/_utils/openerTemplateFloor.js', 'api/_utils/gemmaClient.js'],
  reflection: ['api/_utils/agentReflectionUtils.js', 'api/_utils/callRecords/sweep.js'],
  batchReview: ['api/_utils/voiceLayerPrompt.js', 'api/_utils/agentEvalPromptAssembly.js', 'api/_utils/gemmaClient.js'],
  debate: ['api/_utils/legacyDirectiveSanitize.js', 'api/_utils/tournamentPrices.js'],
  tournament: ['api/_utils/tournamentAgentBoards.js', 'api/_utils/tournamentAgentDraft.js'],
});
/**
 * Per ROOT (review L2-3 / L4-1): a module ONLY that root reaches — dropping the root loses it from the whole census — or,
 * for a root whose closure other roots cover whole, the roots that together cover it (dropping it then loses nothing
 * from the census, and the whole-list pin above is what catches the drop).
 */
const EXCLUSIVE_REACH = Object.freeze({
  'api/cron/agent-evaluate.js': 'api/_utils/agentCronState.js',
  'api/_utils/agentEvalPromptAssembly.js': { coveredBy: ['api/cron/agent-evaluate.js'] },
  'api/_utils/agentPromptAssembly.js': { coveredBy: ['api/agent/decide.js'] },
  'api/agent/decide.js': 'api/_utils/cpuOpponentGenerator.js',
  'api/agent/chat.js': 'api/_utils/agentCapabilitiesManifest.js',
  'api/agent/call-response.js': 'api/_utils/callRecords/callActions.js',
  'src/screens/battleView/ChatSheet.jsx': 'src/screens/battleView/useChatSheet.js',
  'src/components/Agent/AgentChat.jsx': 'src/components/Agent/TradeTickerCard.jsx',
  'api/_utils/voiceLayerPrompt.js': { coveredBy: ['api/agent/chat.js'] },
  'api/_utils/voiceLayerGrounding.js': { coveredBy: ['api/agent/chat.js'] },
  'api/cron/voice-layer-cache.js': 'api/_utils/wireReader.js',
  'api/agent/ensure-opener.js': 'api/_utils/openerTemplateFloor.js',
  'api/agent/reflect.js': { coveredBy: ['api/cron/process-pending-reflections.js'] },
  'api/cron/process-pending-reflections.js': 'api/_utils/callRecords/sweep.js',
  'api/cron/agent-batch-review.js': { coveredBy: ['api/cron/agent-evaluate.js', 'api/agent/debate.js'] },
  'api/agent/debate.js': { coveredBy: ['api/agent/decide.js', 'api/cron/agent-batch-review.js'] },
  'api/cron/tournament-orchestrator.js': 'api/_utils/tournamentAdvancement.js',
  'api/tournament/produce-agent-boards.js': { coveredBy: ['api/cron/tournament-orchestrator.js'] },
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
// review L2-4: a template-literal name and a path template ending in `plays` read true too
const PLAYS_READ = /\b(?:collection|collectionGroup|doc)\s*\(\s*['"`]plays['"`]|['"`]plays['"`]|\/plays(?:\/|['"`]|$)/m;

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

  it('every root list is pinned WHOLE (the mutant: a census that skips the deploy path, the chat path, or any one root — review L4-1)', () => {
    expect(Object.fromEntries(Object.entries(MODEL_PATHS).map(([k, v]) => [k, [...v]]))).toEqual(MODEL_PATH_ROOTS);
    expect(MODEL_PATHS.deploy).toContain('api/agent/decide.js');
    expect(MODEL_PATHS.chat).toContain('api/agent/chat.js');
    expect(MODEL_PATHS.chat).toContain('api/agent/call-response.js');
    expect(Object.keys(MODEL_PATHS).sort()).toEqual(['batchReview', 'chat', 'debate', 'deploy', 'evaluator', 'reflection', 'tournament', 'voice']);
  });

  it('no non-vacuity oracle entry is a root of its own path (review L2-3), and every root either reaches a module no other root reaches, or is covered whole by another root', () => {
    const allRoots = Object.values(MODEL_PATHS).flat();
    for (const [name, known] of Object.entries(KNOWN_REACH)) for (const k of known) expect(MODEL_PATHS[name], `${name}: ${k}`).not.toContain(k);
    expect(Object.keys(EXCLUSIVE_REACH).sort()).toEqual([...allRoots].sort());
    const closures = new Map(allRoots.map((r) => [r, closureOf([abs(r)]).seen]));
    const has = (root, rel) => [...closures.get(root)].some((f) => path.resolve(f) === path.resolve(abs(rel)));
    for (const [root, rule] of Object.entries(EXCLUSIVE_REACH)) {
      if (typeof rule === 'string') {
        expect(has(root, rule), `${root} reaches ${rule}`).toBe(true);
        for (const other of allRoots) if (other !== root) expect(has(other, rule), `${other} must not reach ${rule} (exclusive to ${root})`).toBe(false);
      } else {
        for (const by of rule.coveredBy) expect(allRoots, `${by} is a root`).toContain(by);
        for (const f of closures.get(root)) if (path.resolve(f) !== path.resolve(abs(root))) expect(rule.coveredBy.some((by) => closures.get(by).has(f)), `${rule.coveredBy.join(' + ')} must cover ${path.relative(REPO, f)}`).toBe(true);
      }
    }
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
  it('every spelling of a plays read reads true — a template-literal name, the Admin path form with nothing after plays, a concatenated path (review L2-4) — and a neighbour name does not', () => {
    const reads = [
      'db.collection(`plays`)',
      'db.collection(`agents/${id}/plays`)',
      "db.collection('agents/' + id + '/plays')",
      "doc(db, `agents/${id}/plays/${entryId}`)",
      "db.collectionGroup('plays')",
      'db.collection("plays")',
      "collection(db, 'agents', id, 'plays')",
    ];
    for (const r of reads) expect(PLAYS_READ.test(r), r).toBe(true);
    const clean = ["db.collection('playsheets')", "db.collection('replays')", 'const plays = 3;', "db.collection('agents').doc(id).collection('battlePatterns')"];
    for (const c of clean) expect(PLAYS_READ.test(c), c).toBe(false);
  });
});
