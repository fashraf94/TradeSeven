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
//
// FILM ROOM C2 (Build C spec §6 "One door, stated"; Amendment C CC-1;
// acceptance C-DOOR; exit criterion 16):
//   THE NAMED EXCEPTION TABLE holds one entry: the Practice Field's drafting
//   assembler, api/_utils/practiceField/draftingPrompt.js, may import the
//   moment excerpt (api/_utils/filmRoom/momentExcerpt.js), with the contract
//   sections it rests on. THE IMPORTER DOES NOT EXIST YET: the Practice
//   Field's T1b + T1d writes it, and adds its `drafting` model path here.
//   THE RULE: every model path is walked again WITHOUT the named edge
//   (importer → excerpt); a path whose walk still reaches the excerpt reaches
//   it some other way and fails. The ledger and `plays` checks read that same
//   walk, so what is reached only through the named edge — the excerpt and
//   its one `plays` read — is the exception's; anything else stays forbidden.
//   THE MANDATE MANAGER'S PATH joins the census (CC-1): its roots, its known
//   reach, and — stricter than the rule — it reaches neither the ledger, nor
//   the excerpt, nor the named importer at all (contract V2 §9: only the
//   drafting call reads Film Room cards; the manager never does).
//   Proven on synthetic graphs: a planted import of the excerpt from each
//   existing root fails; the named importer passes; an import routed around
//   it fails.

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
  // Film Room C2 (Amendment C CC-1): the Mandate manager — its evaluation cron and its prompt assembler
  mandate: Object.freeze(['api/cron/mandate-evaluate.js', 'api/_utils/mandatePromptAssembly.js']),
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
  mandate: ['api/cron/mandate-evaluate.js', 'api/_utils/mandatePromptAssembly.js'],
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
  // C2: the manager's model call, its decision schema and its context block — none a root of the path
  mandate: ['api/_utils/mandateModelCall.js', 'api/_utils/mandateSchema.js', 'api/_utils/mandateContextBlock.js'],
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
  // answers.js, not callActions.js: since #986 (51d7c926, retire on exit) the evaluator reaches callActions.js through
  // callRecords/retire.js, so it is no longer this root's alone (the merge with main, build report §12).
  // commands.js, not answers.js: Amendment E rev 2 puts the one any-tier held test beside the legality table in
  // answers.js and the MINT (candidate.js, which the evaluator reaches) asks it too, so the evaluator now reaches
  // answers.js (docs/audits/20261029_COCKPIT_EXIT_NOT_HELD.md). commands.js — the cockpit's seven-command count,
  // imported by the answer endpoint and by the cockpit's client model (cockpit2bModel.js, which no census root
  // reaches) — is this root's alone. This is the non-vacuity oracle only; the ledger and plays assertions above
  // are untouched.
  'api/agent/call-response.js': 'api/_utils/callRecords/commands.js',
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
  // C2: the manager's cron alone reaches its batch transport; the prompt assembler is covered whole by the cron
  'api/cron/mandate-evaluate.js': 'api/_utils/mandateBatchTransport.js',
  'api/_utils/mandatePromptAssembly.js': { coveredBy: ['api/cron/mandate-evaluate.js'] },
});

// ── Film Room C2: the moment excerpt and its one named exception (Amendment C CC-1) ──────────────────────────────

/** The moment excerpt: the bounded projection the drafting call reads (spec §6) — reached by no model path but through the named exception. */
export const EXCERPT_MODULE = 'api/_utils/filmRoom/momentExcerpt.js';

/**
 * THE NAMED EXCEPTION TABLE (CC-1) — each entry one import edge a model path may take into the excerpt, and the
 * sections it rests on. One entry. Its importer is the Practice Field's drafting assembler, which DOES NOT EXIST YET:
 * the Practice Field's T1b + T1d writes it (contract V2 Amendment B item 6) and adds a `drafting` model path above
 * with its roots; until then the exception is latent — no path's walk meets it.
 */
export const NAMED_EXCEPTIONS = Object.freeze([
  Object.freeze({
    importer: 'api/_utils/practiceField/draftingPrompt.js',
    imports: EXCERPT_MODULE,
    restsOn: Object.freeze([
      'Practice Field shared contract V2 §9 (the one-door exception: only the drafting call reads Film Room cards into a prompt)',
      'Practice Field shared contract V2 §5.1 (the sources the drafting call may read; opaque labels resolved server-side)',
      'Practice Field shared contract V2 Amendment B item 6 (the drafting assembler\'s path, the excerpt\'s one importer)',
      'Film Room Build C spec V1 §6 (the moment excerpt; "One door, stated")',
      'Film Room Build C spec V1 Amendment C CC-1 (the exception table and the rule)',
    ]),
    builtBy: 'Practice Field T1b + T1d',
  }),
]);

/** The excerpt modules the exception table names (the rule's targets). */
const EXCERPT_TARGETS = [...new Set(NAMED_EXCEPTIONS.map((e) => e.imports))];

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
const readSource = (file) => readFileSync(file, 'utf8');
function importsOf(file, read = readSource) {
  return [...stripComments(read(file)).matchAll(SPEC_RE)].map((m) => m[1] || m[2] || m[3]).filter(Boolean);
}
/**
 * Every module reachable from `roots` (absolute paths), the roots included, with the parent that first reached each.
 * C2: `skip` — import EDGES (`{ from, to }`, absolute paths) the walk does not follow (the named exceptions); `read` —
 * a module's source (the planted-root proofs hand in one that adds an import to a real root).
 */
export function closureOf(roots, { skip = [], read = readSource } = {}) {
  const seen = new Set(roots);
  const parent = new Map();
  const stack = [...roots];
  const skipped = (from, to) => skip.some((e) => path.resolve(e.from) === path.resolve(from) && path.resolve(e.to) === path.resolve(to));
  while (stack.length) {
    const file = stack.pop();
    for (const spec of importsOf(file, read)) {
      const next = resolveImport(file, spec);
      if (!next || seen.has(next) || skipped(file, next)) continue;
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

/** C2 — the named exceptions' import edges, absolute under `repo` (the synthetic proofs hand in their own table and root). */
const exceptionEdgesOf = (exceptions, repo) => exceptions.map((e) => ({ from: path.join(repo, e.importer), to: path.join(repo, e.imports) }));
/** C2 — THE WALK THE CENSUS JUDGES: every import edge but the named exceptions' (CC-1). */
export const walkOf = (roots, { exceptions = NAMED_EXCEPTIONS, repo = REPO, read } = {}) => closureOf(roots, { skip: exceptionEdgesOf(exceptions, repo), ...(read ? { read } : {}) });
/**
 * C2 — THE RULE (CC-1): every route by which `roots` reach an excerpt module other than through its named importer —
 * the excerpt modules the walk still reaches with the named edges removed, each with its chain. [] when every route to
 * the excerpt is the named one, or none exists.
 */
export function excerptRoutesAround(roots, { exceptions = NAMED_EXCEPTIONS, repo = REPO, read } = {}) {
  const { seen, parent } = walkOf(roots, { exceptions, repo, read });
  const out = [];
  for (const target of new Set(exceptions.map((e) => path.join(repo, e.imports)))) {
    const hit = [...seen].find((f) => path.resolve(f) === path.resolve(target));
    if (hit) out.push(chainTo(parent, hit, repo));
  }
  return out;
}

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
    // C2 (CC-1): the ledger and plays checks read the walk WITHOUT the named exceptions' edges — what is reached only
    // through the named importer is the exception's; today no path meets it, so this walk is the whole closure (pinned below)
    it(`${name}: no module reachable from its roots imports the ledger`, () => {
      const { seen, parent } = walkOf(roots.map(abs));
      for (const m of LEDGER_MODULES) {
        const hit = [...seen].find((f) => path.resolve(f) === path.resolve(abs(m)));
        expect(hit, `${name} reaches ${m}: ${hit ? chainTo(parent, hit, REPO) : ''}`).toBeUndefined();
      }
    });
    it(`${name}: no module reachable from its roots reads plays by name`, () => {
      const { seen, parent } = walkOf(roots.map(abs));
      const readers = [...seen].filter((f) => PLAYS_READ.test(stripComments(readFileSync(f, 'utf8'))));
      expect(readers.map((f) => `${path.relative(REPO, f)} (via ${chainTo(parent, f, REPO)})`)).toEqual([]);
    });
    it(`${name}: reaches the moment excerpt only through the named importer (C2, CC-1 — exit criterion 16)`, () => {
      expect(excerptRoutesAround(roots.map(abs))).toEqual([]);
    });
    it(`${name}: the exception is latent — its walk never meets a named importer, so the judged walk is the whole closure`, () => {
      const whole = closureOf(roots.map(abs)).seen;
      const judged = walkOf(roots.map(abs)).seen;
      expect([...judged].sort()).toEqual([...whole].sort());
      for (const e of NAMED_EXCEPTIONS) expect([...whole].some((f) => path.resolve(f) === path.resolve(abs(e.importer))), e.importer).toBe(false);
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
    // C2 (CC-1): the Mandate manager's path joins the list — the one key added to this pin
    expect(Object.keys(MODEL_PATHS).sort()).toEqual(['batchReview', 'chat', 'debate', 'deploy', 'evaluator', 'mandate', 'reflection', 'tournament', 'voice']);
    expect(MODEL_PATHS.mandate).toEqual(['api/cron/mandate-evaluate.js', 'api/_utils/mandatePromptAssembly.js']);
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

describe('C2 — the moment excerpt\'s one named exception, and the Mandate manager\'s path (Amendment C CC-1, acceptance C-DOOR)', () => {
  it('the exception table holds ONE entry: the drafting assembler may import the excerpt, with the sections it rests on', () => {
    expect(NAMED_EXCEPTIONS).toHaveLength(1);
    expect(NAMED_EXCEPTIONS[0].importer).toBe('api/_utils/practiceField/draftingPrompt.js');
    expect(NAMED_EXCEPTIONS[0].imports).toBe('api/_utils/filmRoom/momentExcerpt.js');
    expect(NAMED_EXCEPTIONS[0].restsOn.join(' | ')).toMatch(/shared contract V2 §9/);
    expect(NAMED_EXCEPTIONS[0].restsOn.join(' | ')).toMatch(/Build C spec V1 §6/);
    expect(existsSync(abs(EXCERPT_MODULE))).toBe(true);
  });
  it('THE IMPORTER DOES NOT EXIST YET: the Practice Field\'s T1b + T1d writes draftingPrompt.js and adds its `drafting` model path here; until then the exception is latent', () => {
    expect(existsSync(abs(NAMED_EXCEPTIONS[0].importer))).toBe(false);
    expect(NAMED_EXCEPTIONS[0].builtBy).toBe('Practice Field T1b + T1d');
    expect(Object.keys(MODEL_PATHS)).not.toContain('drafting');
  });
  it('only a named importer may import the excerpt — today no module under api/ or src/ imports it at all', () => {
    const files = [];
    const walk = (dir) => { for (const ent of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, ent.name); if (ent.isDirectory()) { if (ent.name !== 'node_modules') walk(p); } else if (isModule(ent.name)) files.push(p); } };
    walk(abs('api'));
    walk(abs('src'));
    // a specifier naming the excerpt's file, resolved — the name first, so the walk stays a cheap scan
    const namesExcerpt = (f, spec) => /(^|\/)momentExcerpt(\.js)?$/.test(spec) && path.resolve(resolveImport(f, spec) ?? '') === path.resolve(abs(EXCERPT_MODULE));
    const importers = files.filter((f) => importsOf(f).some((spec) => namesExcerpt(f, spec))).map((f) => path.relative(REPO, f).replace(/\\/g, '/'));
    for (const f of importers) expect(NAMED_EXCEPTIONS.map((e) => e.importer), f).toContain(f);
    expect(importers).toEqual([]);
  });
  it('the Mandate manager reaches neither the ledger, nor the excerpt, nor the named importer — not even through the exception (contract V2 §9: the manager never reads Film Room cards)', () => {
    const { seen, parent } = closureOf(MODEL_PATHS.mandate.map(abs));
    for (const m of [...LEDGER_MODULES, EXCERPT_MODULE, ...NAMED_EXCEPTIONS.map((e) => e.importer)]) {
      const hit = [...seen].find((f) => path.resolve(f) === path.resolve(abs(m)));
      expect(hit, `mandate reaches ${m}: ${hit ? chainTo(parent, hit, REPO) : ''}`).toBeUndefined();
    }
    expect([...seen].filter((f) => PLAYS_READ.test(stripComments(readFileSync(f, 'utf8')))).map((f) => path.relative(REPO, f))).toEqual([]);
    // it is a real walk: the manager's model call, schema and context block, and the Practice Field modules it settles through
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe('C2 — the rule bites (a planted excerpt import from every root fails; the named importer passes; a route around it fails)', () => {
  /** `root`'s source with one more import — of the excerpt, by its relative path from the root (static or dynamic). */
  const plantedRead = (rootAbs, { dynamic = false } = {}) => {
    let spec = path.relative(path.dirname(rootAbs), abs(EXCERPT_MODULE)).split(path.sep).join('/');
    if (!spec.startsWith('.')) spec = `./${spec}`;
    const line = dynamic ? `export const planted = () => import('${spec}');` : `import '${spec}';`;
    return (f) => (path.resolve(f) === path.resolve(rootAbs) ? `${readSource(f)}\n${line}\n` : readSource(f));
  };
  for (const [name, roots] of Object.entries(MODEL_PATHS)) {
    for (const root of roots) {
      it(`${name}: a planted import of the excerpt from ${root} fails the rule (static and dynamic)`, () => {
        for (const dynamic of [false, true]) {
          const around = excerptRoutesAround(roots.map(abs), { read: plantedRead(abs(root), { dynamic }) });
          expect(around, `${root} dynamic=${dynamic}`).toHaveLength(1);
          expect(around[0].split(/[\\/]/).pop()).toBe('momentExcerpt.js');
        }
      });
    }
  }

  /** A synthetic tree: the files given (path → source) under a fresh directory, with a one-entry exception table for it. */
  const tree = (files) => {
    const root = mkdtempSync(path.join(tmpdir(), 'one-door-c2-'));
    for (const [rel, src] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), src);
    }
    return { root, at: (rel) => path.join(root, rel), exceptions: [{ importer: 'pf/drafting.js', imports: 'fr/excerpt.js' }] };
  };
  const EXCERPT_SRC = "import { playsColOf } from '../ledger/store.js';\nexport const read = (db, a, id) => db.collection('agents').doc(a).collection('plays').doc(id).get();\nexport const x = playsColOf;\n";
  const STORE_SRC = "export const playsColOf = (db, id) => db.collection('agents').doc(id).collection('plays');\n";

  it('THE NAMED IMPORTER PASSES: root → drafting → excerpt is the exception, and what it reaches through the excerpt (plays, the ledger) is the exception\'s', () => {
    const t = tree({ 'root.js': "import { draft } from './pf/drafting.js';\nexport const run = draft;\n", 'pf/drafting.js': "import { read } from '../fr/excerpt.js';\nexport const draft = read;\n", 'fr/excerpt.js': EXCERPT_SRC, 'ledger/store.js': STORE_SRC });
    try {
      const roots = [t.at('root.js')];
      expect(excerptRoutesAround(roots, { exceptions: t.exceptions, repo: t.root })).toEqual([]);
      const judged = walkOf(roots, { exceptions: t.exceptions, repo: t.root }).seen;
      expect([...judged].map((f) => path.relative(t.root, f).replace(/\\/g, '/')).sort()).toEqual(['pf/drafting.js', 'root.js']);
      expect([...judged].filter((f) => PLAYS_READ.test(stripComments(readFileSync(f, 'utf8'))))).toEqual([]);
      // the whole closure does reach them — the exception, not a blind walker, is what passes it
      const whole = closureOf(roots).seen;
      expect([...whole].map((f) => path.relative(t.root, f).replace(/\\/g, '/')).sort()).toEqual(['fr/excerpt.js', 'ledger/store.js', 'pf/drafting.js', 'root.js']);
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
  });
  it('AN IMPORT ROUTED AROUND THE NAMED IMPORTER FAILS — through a middle module, beside the named route, from the importer through another module, or by a dynamic import', () => {
    const cases = {
      'root → mid → excerpt': { 'root.js': "import './mid.js';\n", 'mid.js': "import './fr/excerpt.js';\n" },
      'the named route AND a route around it': { 'root.js': "import './pf/drafting.js';\nimport './mid.js';\n", 'pf/drafting.js': "import '../fr/excerpt.js';\n", 'mid.js': "import './fr/excerpt.js';\n" },
      'the importer through another module': { 'root.js': "import './pf/drafting.js';\n", 'pf/drafting.js': "import './helper.js';\n", 'pf/helper.js': "import '../fr/excerpt.js';\n" },
      'a dynamic import from the root': { 'root.js': "export const later = () => import('./fr/excerpt.js');\n" },
    };
    for (const [name, files] of Object.entries(cases)) {
      const t = tree({ ...files, 'fr/excerpt.js': EXCERPT_SRC, 'ledger/store.js': STORE_SRC });
      try {
        const around = excerptRoutesAround([t.at('root.js')], { exceptions: t.exceptions, repo: t.root });
        expect(around, name).toHaveLength(1);
        expect(around[0].replace(/\\/g, '/').endsWith('fr/excerpt.js'), name).toBe(true);
        // and the plays read beside it is no longer the exception's
        expect([...walkOf([t.at('root.js')], { exceptions: t.exceptions, repo: t.root }).seen].some((f) => PLAYS_READ.test(stripComments(readFileSync(f, 'utf8')))), name).toBe(true);
      } finally {
        rmSync(t.root, { recursive: true, force: true });
      }
    }
  });
  it('with no exception at all, even the named route fails (the table is what admits it)', () => {
    const t = tree({ 'root.js': "import './pf/drafting.js';\n", 'pf/drafting.js': "import '../fr/excerpt.js';\n", 'fr/excerpt.js': EXCERPT_SRC, 'ledger/store.js': STORE_SRC });
    try {
      expect(excerptRoutesAround([t.at('root.js')], { exceptions: [{ importer: 'pf/other.js', imports: 'fr/excerpt.js' }], repo: t.root })).toHaveLength(1);
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
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
