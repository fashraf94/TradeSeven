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
//   The entry ADMITS ONE MODEL PATH, `drafting` (contract V2 §9: only the
//   drafting call reads Film Room cards; exit criterion 16: "a model path
//   other than the named exception"), which T1b + T1d adds.
//   THE RULE: the admitted path is walked again WITHOUT the named edge
//   (importer → excerpt); if that walk still reaches the excerpt, it reaches
//   it some other way and fails. Its `plays` check reads that walk — the
//   excerpt and its one `plays` read are the exception's — while its LEDGER
//   check reads the whole closure, as every path's does: nothing reaches the
//   ledger, the excerpt included. Every other model path — the eight existing
//   ones and THE MANDATE MANAGER'S (CC-1: its roots, its known reach) — is
//   held to its whole closure: it reaches neither the ledger, nor `plays`,
//   nor the excerpt, nor the named importer, by any route.
//   Proven on synthetic graphs: a planted import of the excerpt from each
//   existing root fails; the named importer passes for the admitted path and
//   fails for any other; an import routed around it fails, in either import
//   order; the ledger reached through the excerpt fails.
//   THE WALKER READS IMPORTS WITH A REAL PARSER (__fixtures__/jsSource.js,
//   @babel/parser — Build C Amendment E, CE-2): a `/*` inside a line comment
//   once hid live imports from the regex stripper this file used before (§2
//   review L2-1), and a regex literal after an `if (…)` hid one from the
//   hand lexer that replaced it (Astra's C2-F2). Twenty roots on nine paths.
//
// FILM ROOM D2 (D2 spec §10; DW-11): THE `debrief` MODEL PATH — the nightly job and its prompt builder — joins the
// census, held to its whole closure like every other: no ledger, no `plays`, no excerpt, no named importer. Its known
// reach is the model call, the day digest and the checks. THE RULE: no module reachable from any OTHER model path reads
// a `debriefs` collection or path (DEBRIEFS_READ), proved on a synthetic graph as the `plays` rule is. And for the
// `debrief` path, FAIL-CLOSED LOADS (Build C CF-11's cheap step, taken here first): a module of its closure that names
// `eval`, calls `Function` (with or without `new`), or loads `node:vm` or `node:worker_threads` (either spelling) makes
// the walk throw. Twenty-two roots on ten paths.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// C2 (CE-2): imports read by @babel/parser, and the `@/` alias resolved, as vite resolves it
import { stripComments, importSpecifiersOf, opaqueImportsOf, resolveImport, PARSE_OPTIONS } from './__fixtures__/jsSource.js';
// D2 (D2 spec §10): the debrief path's fail-closed loads are read with the same parser the census reads imports with
import { parse } from '@babel/parser';

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
  // Film Room D2 (D2 spec §10, DW-11): the agent's words — the nightly job and its prompt builder
  debrief: Object.freeze(['api/cron/film-room-debrief.js', 'api/_utils/filmRoom/debriefPrompt.js']),
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
  debrief: ['api/cron/film-room-debrief.js', 'api/_utils/filmRoom/debriefPrompt.js'],
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
  // D2 (D2 spec §10): the model call, the day digest and the checks — none a root of the path
  debrief: ['api/_utils/filmRoom/debriefModelCall.js', 'api/_utils/filmRoom/dayDigest.js', 'api/_utils/filmRoom/debriefChecks.js'],
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
  // D2: the job alone reaches its pass; the prompt builder is covered whole by the job
  'api/cron/film-room-debrief.js': 'api/_utils/filmRoom/debriefPass.js',
  'api/_utils/filmRoom/debriefPrompt.js': { coveredBy: ['api/cron/film-room-debrief.js'] },
});

// ── Film Room C2: the moment excerpt and its one named exception (Amendment C CC-1) ──────────────────────────────

/** The moment excerpt: the bounded projection the drafting call reads (spec §6) — reached by no model path but through the named exception. */
export const EXCERPT_MODULE = 'api/_utils/filmRoom/momentExcerpt.js';

/**
 * THE NAMED EXCEPTION TABLE (CC-1) — each entry one import edge into the excerpt, the ONE model path it admits, and
 * the sections it rests on. One entry. Its importer is the Practice Field's drafting assembler, which DOES NOT EXIST
 * YET: the Practice Field's T1b + T1d writes it (contract V2 Amendment B item 6) and adds the `drafting` model path
 * above with its roots; until then the exception is latent — no path is admitted, and no path's walk meets it.
 */
export const NAMED_EXCEPTIONS = Object.freeze([
  Object.freeze({
    path: 'drafting',
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

/** The exceptions that admit model path `name` — [] for every path the table does not name. */
const exceptionsFor = (name, exceptions = NAMED_EXCEPTIONS) => exceptions.filter((e) => e.path === name);

// ── the walker (the callRecords/allowlist.test.js precedent) ────────────────
// C2 (CE-2): imports are read by a real parser (__fixtures__/jsSource.js, @babel/parser with JSX) — comments, strings,
// templates, regex literals and JSX told apart as the language tells them — and the app's `@/` alias resolves as vite
// resolves it. The regex stripper this file used before let a `/*` inside a line comment swallow live imports (§2
// review L2-1); the hand lexer after it let a regex literal after an `if (…)` hide one (Astra's C2-F2).
const readSource = (file) => readFileSync(file, 'utf8');
/** Each file's specifiers and comment-stripped source, read ONCE for the suite (the tree does not change under it); a planted reader is never cached here (jsSource.js's parse cache, keyed by the source itself, still parses each distinct source once). */
const specCache = new Map();
const strippedCache = new Map();
function importsOf(file, read = readSource) {
  if (read !== readSource) return importSpecifiersOf(read(file), file);
  if (!specCache.has(file)) specCache.set(file, importSpecifiersOf(readSource(file), file));
  return specCache.get(file);
}
const strippedOf = (file, read = readSource) => {
  if (read !== readSource) return stripComments(read(file), file);
  if (!strippedCache.has(file)) strippedCache.set(file, stripComments(readSource(file), file));
  return strippedCache.get(file);
};
/**
 * The fix round's review, CX2-2 — FAIL CLOSED on what no static reading follows: a walked module that loads anything by
 * a computed `import()` or `require()`, a `createRequire`, or an `import.meta.glob` throws, naming it. No module any
 * model path reaches holds one today.
 */
const assertReadable = (file, read) => {
  const opaque = opaqueImportsOf(read(file), file);
  if (opaque.length) throw Object.assign(new Error(`one door: ${file} loads by ${opaque.join(', ')} — an edge the census cannot follow`), { code: 'OPAQUE_IMPORT' });
};
/**
 * Every module reachable from `roots` (absolute paths), the roots included, with the parent that first reached each.
 * C2: `skip` — import EDGES (`{ from, to }`, absolute paths) the walk does not follow (the named exceptions); `read` —
 * a module's source (the planted-root proofs hand in one that adds an import to a real root); `repo` — the tree the
 * `@/` alias resolves in (a synthetic proof hands in its own).
 */
export function closureOf(roots, { skip = [], read = readSource, repo = REPO } = {}) {
  const seen = new Set(roots);
  const parent = new Map();
  const stack = [...roots];
  const skipped = (from, to) => skip.some((e) => path.resolve(e.from) === path.resolve(from) && path.resolve(e.to) === path.resolve(to));
  while (stack.length) {
    const file = stack.pop();
    assertReadable(file, read);
    for (const spec of importsOf(file, read)) {
      // CX2-1: a query, a fragment or percent-encoding is read through, and a local specifier naming no module throws
      const next = resolveImport(file, spec, repo);
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
// the refuter's C2: a path that STARTS with the segment — `doc(ref, 'plays/' + id)`, `doc(ref, \`plays/${id}\`)` — reads true too
const PLAYS_READ = /\b(?:collection|collectionGroup|doc)\s*\(\s*['"`]plays['"`]|['"`]plays['"`/]|\/plays(?:\/|['"`]|$)/m;

const abs = (rel) => path.join(REPO, rel);
const isModule = (name) => /\.(m?js|jsx)$/.test(name) && !/\.test\.(m?js|jsx)$/.test(name) && !/\.ARCHIVED\./.test(name);

/** C2 — the named exceptions' import edges, absolute under `repo` (the synthetic proofs hand in their own table and root). */
const exceptionEdgesOf = (exceptions, repo) => exceptions.map((e) => ({ from: path.join(repo, e.importer), to: path.join(repo, e.imports) }));
/**
 * C2 — THE WALK THE CENSUS JUDGES for model path `name` (CC-1): its whole closure, but without the edges of the
 * exceptions that ADMIT `name`. For every path the table does not name, it is the whole closure.
 */
export const walkOf = (name, roots, { exceptions = NAMED_EXCEPTIONS, repo = REPO, read } = {}) => closureOf(roots, { skip: exceptionEdgesOf(exceptionsFor(name, exceptions), repo), repo, ...(read ? { read } : {}) });
/**
 * C2 — THE RULE (CC-1; exit criterion 16): every route by which path `name` reaches an excerpt module other than
 * through a named importer that admits it — the excerpt modules its judged walk still reaches, each with its chain. A
 * path the table does not name fails on ANY route to the excerpt. [] when none.
 */
export function excerptRoutesAround(name, roots, { exceptions = NAMED_EXCEPTIONS, repo = REPO, read } = {}) {
  const { seen, parent } = walkOf(name, roots, { exceptions, repo, read });
  const out = [];
  for (const target of new Set(exceptions.map((e) => path.join(repo, e.imports)))) {
    const hit = [...seen].find((f) => path.resolve(f) === path.resolve(target));
    if (hit) out.push(chainTo(parent, hit, repo));
  }
  return out;
}

/**
 * C2 — ONE DOOR, JUDGED for model path `name` (one function: the per-path rows and the synthetic proofs both call it):
 *   ledger     no module of the path's WHOLE closure is a ledger module — through the excerpt neither (§2 review L2-2:
 *              the exception admits the excerpt and its `plays` read, never the ledger);
 *   plays      no module of its judged walk reads `plays` by name (the excerpt's own read, behind the named edge, is the
 *              exception's);
 *   excerpt    no route to the excerpt but through a named importer that admits the path (excerptRoutesAround);
 *   importer   a path no exception admits never meets a named importer at all (§2 review L2-3, L2-5: contract V2 §9, only
 *              the drafting call reads cards — the Mandate manager among the others).
 * Returns every defect, each with its chain; [] when the path passes.
 */
export function oneDoorDefectsOf(name, roots, { exceptions = NAMED_EXCEPTIONS, repo = REPO, read = readSource, ledger = LEDGER_MODULES } = {}) {
  const defects = [];
  const whole = closureOf(roots, { read, repo });
  const judged = walkOf(name, roots, { exceptions, repo, read });
  const at = (set, rel) => [...set.seen].find((f) => path.resolve(f) === path.resolve(path.join(repo, rel)));
  for (const m of ledger) { const hit = at(whole, m); if (hit) defects.push(`ledger: ${chainTo(whole.parent, hit, repo)}`); }
  for (const f of judged.seen) if (PLAYS_READ.test(strippedOf(f, read))) defects.push(`plays: ${chainTo(judged.parent, f, repo)}`);
  for (const chain of excerptRoutesAround(name, roots, { exceptions, repo, read })) defects.push(`excerpt: ${chain}`);
  if (!exceptionsFor(name, exceptions).length) for (const e of exceptions) { const hit = at(whole, e.importer); if (hit) defects.push(`importer: ${chainTo(whole.parent, hit, repo)}`); }
  return defects;
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
    // C2 (CC-1): the ledger check reads the WHOLE closure (as on main); `plays` the path's judged walk — the whole
    // closure for every path the exception table does not admit, which is every path today
    it(`${name}: no module reachable from its roots imports the ledger`, () => {
      const { seen, parent } = closureOf(roots.map(abs));
      for (const m of LEDGER_MODULES) {
        const hit = [...seen].find((f) => path.resolve(f) === path.resolve(abs(m)));
        expect(hit, `${name} reaches ${m}: ${hit ? chainTo(parent, hit, REPO) : ''}`).toBeUndefined();
      }
    });
    it(`${name}: no module reachable from its roots reads plays by name`, () => {
      const { seen, parent } = walkOf(name, roots.map(abs));
      const readers = [...seen].filter((f) => PLAYS_READ.test(strippedOf(f)));
      expect(readers.map((f) => `${path.relative(REPO, f)} (via ${chainTo(parent, f, REPO)})`)).toEqual([]);
    });
    it(`${name}: ONE DOOR, judged — no ledger, no plays, no excerpt but through an importer that admits it, no importer it is not admitted to (C2, CC-1 — exit criterion 16)`, () => {
      expect(oneDoorDefectsOf(name, roots.map(abs))).toEqual([]);
    });
    it(`${name}: the exception table admits no existing path — its judged walk is its whole closure, and it never meets a named importer`, () => {
      expect(exceptionsFor(name)).toEqual([]);
      const whole = closureOf(roots.map(abs)).seen;
      const judged = walkOf(name, roots.map(abs)).seen;
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
    expect(Object.keys(MODEL_PATHS).sort()).toEqual(['batchReview', 'chat', 'debate', 'debrief', 'deploy', 'evaluator', 'mandate', 'reflection', 'tournament', 'voice']);
    expect(MODEL_PATHS.mandate).toEqual(['api/cron/mandate-evaluate.js', 'api/_utils/mandatePromptAssembly.js']);
    // Film Room D2 (D2 spec §10, DW-11): the `debrief` path's two roots
    expect(MODEL_PATHS.debrief).toEqual(['api/cron/film-room-debrief.js', 'api/_utils/filmRoom/debriefPrompt.js']);
    // CE-6: twenty-two roots on ten paths (twenty on nine before D2), as every record of this census states it
    expect(Object.keys(MODEL_PATHS)).toHaveLength(10);
    expect(Object.values(MODEL_PATHS).flat()).toHaveLength(22);
    expect(new Set(Object.values(MODEL_PATHS).flat()).size).toBe(22);
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

/** Every non-test module under api/ and src/ (the whole-tree rows' scan). */
const treeModules = () => {
  const files = [];
  const walk = (dir) => { for (const ent of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, ent.name); if (ent.isDirectory()) { if (ent.name !== 'node_modules') walk(p); } else if (isModule(ent.name)) files.push(p); } };
  walk(abs('api'));
  walk(abs('src'));
  return files;
};
/** The fix round's review, CX2-3: the modules each file's imports RESOLVE to — never a match on the specifier's text. */
const importedBy = (f, read = readSource) => importsOf(f, read).map((spec) => resolveImport(f, spec, REPO)).filter(Boolean).map((r) => path.resolve(r));
/**
 * The one module under api/ and src/ that loads something no static reading follows (CX2-2): the discover screen's
 * thematic list, by a glob of JSON files. None is on a model path. A new one fails the row below until it is reviewed.
 */
const OPAQUE_LOADERS = Object.freeze({ 'src/components/discover/themesDkb.js': ['import.meta.glob'] });

describe('the whole api/ tree — only the two routes import the ledger store (the door is one)', () => {
  // CE-2: the whole-tree rows parse every module under api/ and src/ once (the parse cache serves the second of them) —
  // given room beyond vitest's 5 s default, as a parse of the whole tree takes seconds on a loaded host
  it('every non-test module under api/ that imports cardStore.js, cardCounter.js or cardRequest.js is a film-room route or a filmRoom module — by the module each import RESOLVES to (CX2-3: an extensionless, queried or index spelling hides nothing)', { timeout: 60_000 }, () => {
    const ledgerStores = new Set(['api/_utils/filmRoom/cardStore.js', 'api/_utils/filmRoom/cardCounter.js', 'api/_utils/filmRoom/cardRequest.js'].map((m) => path.resolve(abs(m))));
    const importers = treeModules().filter((f) => importedBy(f).some((r) => ledgerStores.has(r))).map((f) => path.relative(REPO, f).replace(/\\/g, '/')).sort();
    expect(importers).toEqual(['api/_utils/filmRoom/cardCounter.js', 'api/_utils/filmRoom/cardRequest.js', 'api/film-room/card.js', 'api/film-room/counter.js']);
  });
  it('THE WHOLE-TREE ROWS READ WHAT A SPELLING HIDES (CX2-3): an extensionless, a queried, a fragment, a percent-encoded and a parent-relative spelling of the ledger store each resolve to it; a directory with no index names no module and throws', () => {
    const at = abs('api/_utils/filmRoom/zz_planted.js');   // never written: its source is handed in
    const store = path.resolve(abs('api/_utils/filmRoom/cardStore.js'));
    for (const spec of ['./cardStore', './cardStore.js?v=1', './cardStore.js#f', './card%53tore.js', '../filmRoom/cardStore']) {
      expect(importedBy(at, () => `import '${spec}';\n`), spec).toEqual([store]);
    }
    expect(() => importedBy(abs('api/film-room/zz_planted.js'), () => "import '../_utils/filmRoom';\n")).toThrow(/names no module/);   // a directory with no index
  });
  it('every module under api/ and src/ that loads something no static reading follows is pinned — today one, on no model path (CX2-2)', { timeout: 60_000 }, () => {
    const found = Object.fromEntries(treeModules().map((f) => [path.relative(REPO, f).replace(/\\/g, '/'), opaqueImportsOf(readSource(f), f)]).filter(([, o]) => o.length));
    expect(found).toEqual(OPAQUE_LOADERS);
    for (const roots of Object.values(MODEL_PATHS)) {
      const { seen } = closureOf(roots.map(abs));
      for (const f of Object.keys(OPAQUE_LOADERS)) expect([...seen].some((s) => path.resolve(s) === path.resolve(abs(f))), f).toBe(false);
    }
  });
});

describe('C2 — the moment excerpt\'s one named exception, and the Mandate manager\'s path (Amendment C CC-1, acceptance C-DOOR)', () => {
  it('the exception table holds ONE entry: the drafting assembler may import the excerpt, with the sections it rests on', () => {
    expect(NAMED_EXCEPTIONS).toHaveLength(1);
    expect(NAMED_EXCEPTIONS[0].path).toBe('drafting');   // the one model path it admits (§2 review L2-3)
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
  it('only a named importer may import the excerpt — today no module under api/ or src/ imports it at all', { timeout: 60_000 }, () => {
    // every import RESOLVED (CX2-3: no name prefilter a query could slip past)
    const excerpt = path.resolve(abs(EXCERPT_MODULE));
    const importers = treeModules().filter((f) => importedBy(f).includes(excerpt)).map((f) => path.relative(REPO, f).replace(/\\/g, '/'));
    for (const f of importers) expect(NAMED_EXCEPTIONS.map((e) => e.importer), f).toContain(f);
    expect(importers).toEqual([]);
  });
  it('the Mandate manager reaches neither the ledger, nor the excerpt, nor the named importer — not even through the exception (contract V2 §9: the manager never reads Film Room cards)', () => {
    expect(exceptionsFor('mandate')).toEqual([]);
    expect(oneDoorDefectsOf('mandate', MODEL_PATHS.mandate.map(abs))).toEqual([]);
    const { seen, parent } = closureOf(MODEL_PATHS.mandate.map(abs));
    for (const m of [...LEDGER_MODULES, EXCERPT_MODULE, ...NAMED_EXCEPTIONS.map((e) => e.importer)]) {
      const hit = [...seen].find((f) => path.resolve(f) === path.resolve(abs(m)));
      expect(hit, `mandate reaches ${m}: ${hit ? chainTo(parent, hit, REPO) : ''}`).toBeUndefined();
    }
    expect([...seen].filter((f) => PLAYS_READ.test(strippedOf(f))).map((f) => path.relative(REPO, f))).toEqual([]);
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
          const around = excerptRoutesAround(name, roots.map(abs), { read: plantedRead(abs(root), { dynamic }) });
          expect(around, `${root} dynamic=${dynamic}`).toHaveLength(1);
          expect(around[0].split(/[\\/]/).pop()).toBe('momentExcerpt.js');
        }
      });
    }
  }

  /**
   * ASTRA'S ATTACK (C2-F2), exactly: valid module code appended to a real root — a regex literal after an `if (…)`
   * whose character class holds `/*`, then a real static import of the excerpt by its relative path. The hand lexer
   * read the `/` as division and the `/*` as a comment, and lost the import from every one of the twenty roots.
   */
  const astraRead = (rootAbs) => {
    let spec = path.relative(path.dirname(rootAbs), abs(EXCERPT_MODULE)).split(path.sep).join('/');
    if (!spec.startsWith('.')) spec = `./${spec}`;
    const suffix = `if (true) /[/*]/.test('x');\nimport { excerptOf as astraExcerptProbe } from '${spec}';\n`;
    return (f) => (path.resolve(f) === path.resolve(rootAbs) ? `${readSource(f)}\n${suffix}` : readSource(f));
  };
  for (const [name, roots] of Object.entries(MODEL_PATHS)) {
    for (const root of roots) {
      it(`${name}: ASTRA'S ATTACK — \`if (true) /[/*]/.test('x');\` then a real import of the excerpt, appended to ${root}, fails the rule (C2-F2, CE-2)`, () => {
        const read = astraRead(abs(root));
        const defects = oneDoorDefectsOf(name, roots.map(abs), { read });
        const routes = defects.filter((d) => d.startsWith('excerpt: '));
        expect(routes, root).toHaveLength(1);
        expect(routes[0].split(/[\\/]/).pop()).toBe('momentExcerpt.js');
        // the root's own imports are all still read, the planted one last: the suffix hides nothing before it either
        expect(importSpecifiersOf(read(abs(root))).slice(0, -1)).toEqual(importSpecifiersOf(readSource(abs(root))));
      });
      it(`${name}: A QUERY, A FRAGMENT OR PERCENT-ENCODING HIDES NOTHING — \`?v=1\`, \`#f\` and \`moment%45xcerpt.js\` on an import of the excerpt from ${root} each fail the rule (the fix round's review, CX2-1)`, () => {
        let spec = path.relative(path.dirname(abs(root)), abs(EXCERPT_MODULE)).split(path.sep).join('/');
        if (!spec.startsWith('.')) spec = `./${spec}`;
        for (const planted of [`${spec}?v=1`, `${spec}#f`, spec.replace('momentExcerpt', 'moment%45xcerpt')]) {
          const read = (f) => (path.resolve(f) === path.resolve(abs(root)) ? `${readSource(f)}\nimport '${planted}';\n` : readSource(f));
          const around = excerptRoutesAround(name, roots.map(abs), { read });
          expect(around, planted).toHaveLength(1);
          expect(around[0].split(/[\\/]/).pop()).toBe('momentExcerpt.js');
        }
      });
      it(`${name}: A LOAD BY A STRING KEY OR A SCHEME FAILS CLOSED — the module loader by \`process['getBuiltinModule']\`/\`['createRequire']\`, and a \`data:\` module importing the excerpt by its \`file:\` URL, appended to ${root}, each throw (the refuter's CXV-6, CXV-7)`, () => {
        let spec = path.relative(path.dirname(abs(root)), abs(EXCERPT_MODULE)).split(path.sep).join('/');
        if (!spec.startsWith('.')) spec = `./${spec}`;
        for (const [planted, code] of [
          [`export const zzKey = process['getBuiltinModule']('node:module')['createRequire'](import.meta.url)('${spec}');`, 'OPAQUE_IMPORT'],
          [`export * as zzData from 'data:text/javascript,export * from "${pathToFileURL(abs(EXCERPT_MODULE)).href}"';`, 'UNRESOLVED_IMPORT'],
        ]) {
          const read = (f) => (path.resolve(f) === path.resolve(abs(root)) ? `${readSource(f)}\n${planted}\n` : readSource(f));
          let err = null;
          try { oneDoorDefectsOf(name, roots.map(abs), { read }); } catch (e) { err = e; }
          expect(err?.code, planted).toBe(code);
        }
      });
    }
  }

  /** A synthetic tree: the files given (path → source) under a fresh directory, with a one-entry exception table admitting `drafting`. */
  const tree = (files) => {
    const root = mkdtempSync(path.join(tmpdir(), 'one-door-c2-'));
    for (const [rel, src] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), src);
    }
    return { root, at: (rel) => path.join(root, rel), exceptions: [{ path: 'drafting', importer: 'pf/drafting.js', imports: 'fr/excerpt.js' }] };
  };
  /** The synthetic tree judged as the census judges a path (oneDoorDefectsOf), its ledger the tree's own store. */
  const judge = (t, name, extra = {}) => oneDoorDefectsOf(name, [t.at('root.js')], { exceptions: t.exceptions, repo: t.root, ledger: ['ledger/store.js'], ...extra });
  const kinds = (defects) => [...new Set(defects.map((d) => d.slice(0, d.indexOf(':'))))].sort();
  const withTree = (files, fn) => { const t = tree(files); try { return fn(t); } finally { rmSync(t.root, { recursive: true, force: true }); } };
  /** The excerpt as the exception admits it: it reads `plays` itself, and imports no ledger module. */
  const EXCERPT_SRC = "export const read = (db, a, id) => db.collection('agents').doc(a).collection('plays').doc(id).get();\n";
  /** An excerpt that imports the ledger's store — never admitted, through the exception or not (§2 review L2-2). */
  const EXCERPT_WITH_LEDGER = "import { playsColOf } from '../ledger/store.js';\nexport const x = playsColOf;\n";
  const STORE_SRC = "export const playsColOf = (db, id) => db.collection('agents').doc(id).collection('plays');\n";
  const NAMED = { 'root.js': "import { draft } from './pf/drafting.js';\nexport const run = draft;\n", 'pf/drafting.js': "import { read } from '../fr/excerpt.js';\nexport const draft = read;\n", 'fr/excerpt.js': EXCERPT_SRC, 'ledger/store.js': STORE_SRC };

  it('THE NAMED IMPORTER PASSES for the path it admits: root → drafting → excerpt, the excerpt\'s own `plays` read the exception\'s', () => withTree(NAMED, (t) => {
    expect(judge(t, 'drafting')).toEqual([]);
    const judged = walkOf('drafting', [t.at('root.js')], { exceptions: t.exceptions, repo: t.root }).seen;
    expect([...judged].map((f) => path.relative(t.root, f).replace(/\\/g, '/')).sort()).toEqual(['pf/drafting.js', 'root.js']);
    // the whole closure does reach the excerpt and its plays read — the exception, not a blind walker, is what passes it
    expect([...closureOf([t.at('root.js')], { repo: t.root }).seen].map((f) => path.relative(t.root, f).replace(/\\/g, '/')).sort()).toEqual(['fr/excerpt.js', 'pf/drafting.js', 'root.js']);
  }));
  it('THE SAME GRAPH FAILS FOR ANY PATH THE EXCEPTION DOES NOT ADMIT — the evaluator, the Mandate manager: the excerpt, its plays read and the importer each a defect (§2 review L2-3, L2-5: contract V2 §9)', () => withTree(NAMED, (t) => {
    for (const name of ['evaluator', 'mandate']) expect(kinds(judge(t, name)), name).toEqual(['excerpt', 'importer', 'plays']);
  }));
  it('THE LEDGER IS NEVER THE EXCEPTION\'S: an excerpt importing the ledger\'s store fails the admitted path too, while its plays read stays the exception\'s (§2 review L2-2)', () => withTree({ ...NAMED, 'fr/excerpt.js': EXCERPT_WITH_LEDGER }, (t) => {
    expect(kinds(judge(t, 'drafting'))).toEqual(['ledger']);
  }));
  it('AN IMPORT ROUTED AROUND THE NAMED IMPORTER FAILS — through a middle module, beside the named route IN EITHER IMPORT ORDER, from the importer through a helper, by a dynamic import (§2 review L2-4)', () => {
    const cases = {
      'root → mid → excerpt': { 'root.js': "import './mid.js';\n", 'mid.js': "import './fr/excerpt.js';\n" },
      'the named route, then a route around it': { 'root.js': "import './pf/drafting.js';\nimport './mid.js';\n", 'pf/drafting.js': "import '../fr/excerpt.js';\n", 'mid.js': "import './fr/excerpt.js';\n" },
      'a route around it, then the named route': { 'root.js': "import './mid.js';\nimport './pf/drafting.js';\n", 'pf/drafting.js': "import '../fr/excerpt.js';\n", 'mid.js': "import './fr/excerpt.js';\n" },
      'the importer through a helper': { 'root.js': "import './pf/drafting.js';\n", 'pf/drafting.js': "import './helper.js';\n", 'pf/helper.js': "import '../fr/excerpt.js';\n" },
      'a dynamic import from the root': { 'root.js': "export const later = () => import('./fr/excerpt.js');\n" },
    };
    for (const [name, files] of Object.entries(cases)) {
      withTree({ ...files, 'fr/excerpt.js': EXCERPT_SRC, 'ledger/store.js': STORE_SRC }, (t) => {
        const around = excerptRoutesAround('drafting', [t.at('root.js')], { exceptions: t.exceptions, repo: t.root });
        expect(around, name).toHaveLength(1);
        expect(around[0].replace(/\\/g, '/').endsWith('fr/excerpt.js'), name).toBe(true);
        // and the plays read beside it is no longer the exception's
        expect(kinds(judge(t, 'drafting')), name).toEqual(['excerpt', 'plays']);
      });
    }
  });
  it('with no exception for the path at all, even the named route fails (the table is what admits it)', () => withTree(NAMED, (t) => {
    expect(excerptRoutesAround('drafting', [t.at('root.js')], { exceptions: [{ path: 'drafting', importer: 'pf/other.js', imports: 'fr/excerpt.js' }], repo: t.root })).toHaveLength(1);
    expect(excerptRoutesAround('drafting', [t.at('root.js')], { exceptions: [{ ...t.exceptions[0], path: 'other' }], repo: t.root })).toHaveLength(1);
  }));
  it('THE WALKER READS WHAT A REGEX STRIPPER MISSED (§2 review L2-1): an import after a line comment holding `/*`, a backtick dynamic import, an `@/` alias — each reached, and each fails an unadmitted path', () => {
    const cases = {
      'a `/*` inside a line comment': { 'root.js': "// every /api/film-room/* route reads this\nimport { read } from './fr/excerpt.js';\n/** and a doc comment after it */\nexport const r = read;\n" },
      'a backtick dynamic import': { 'root.js': 'export const later = () => import(`./fr/excerpt.js`);\n' },
      'the @/ alias': { 'root.js': "import { read } from '@/fr/excerpt.js';\nexport const r = read;\n", 'src/fr/excerpt.js': EXCERPT_SRC },
      'a string holding `//` before it': { 'root.js': "const url = 'https://example.com/a';\nimport { read } from './fr/excerpt.js';\nexport const r = [url, read];\n" },
      'a regex holding `/*` before it': { 'root.js': "const re = /a\\/*b/g;\nimport { read } from './fr/excerpt.js';\nexport const r = [re, read];\n/* a closing note */\n" },
    };
    for (const [name, files] of Object.entries(cases)) {
      withTree({ 'fr/excerpt.js': EXCERPT_SRC, ...files }, (t) => {
        const ex = name === 'the @/ alias' ? [{ path: 'drafting', importer: 'pf/drafting.js', imports: 'src/fr/excerpt.js' }] : t.exceptions;
        expect(excerptRoutesAround('evaluator', [t.at('root.js')], { exceptions: ex, repo: t.root }), name).toHaveLength(1);
      });
    }
  });

  /** One synthetic root's source judged for the unadmitted `evaluator`: the routes to the excerpt it opens (`alias`: the excerpt named under src/). */
  const routesFrom = (rootSrc, { alias = false } = {}) => withTree({ 'fr/excerpt.js': EXCERPT_SRC, 'src/fr/excerpt.js': EXCERPT_SRC, 'root.js': rootSrc }, (t) => {
    const ex = alias ? [{ path: 'drafting', importer: 'pf/drafting.js', imports: 'src/fr/excerpt.js' }] : t.exceptions;
    return excerptRoutesAround('evaluator', [t.at('root.js')], { exceptions: ex, repo: t.root });
  });
  const IMPORT_AFTER = "\nimport { read } from './fr/excerpt.js';\nexport const r = read;\n";
  it('A REGEX AFTER ANY CONTROL STATEMENT HIDES NOTHING (CE-2): after `if (…)`, `while (…)`, `for (…)`, `else`, `return`, `typeof` and `=>`, a regex whose class holds `/*` — the import after it is reached', () => {
    const cases = {
      'if (…)': "if (true) /[/*]/.test('x');",
      'while (…)': "while (false) /[/*]/.test('x');",
      'for (…)': "for (let i = 0; i < 0; i += 1) /[/*]/.test('x');",
      'else': "if (false) {} else /[/*]/.test('x');",
      'return': "export function f() { return /[/*]/.test('x'); }",
      'typeof': 'export const t = typeof /[/*]/;',
      '=>': "export const g = () => /[/*]/.test('x');",
    };
    for (const [name, prefix] of Object.entries(cases)) expect(routesFrom(prefix + IMPORT_AFTER), name).toHaveLength(1);
  });
  it('EVERY IMPORT FORM IS AN EDGE (CE-2): static, re-export, export-all, bare, a bare import on the same line as a statement, dynamic, a static template, `import()` with an options argument, the `@/` alias', () => {
    const cases = {
      static: ["import { read } from './fr/excerpt.js';\nexport const r = read;\n"],
      'a re-export': ["export { read } from './fr/excerpt.js';\n"],
      'export-all': ["export * from './fr/excerpt.js';\n"],
      bare: ["import './fr/excerpt.js';\n"],
      'same line, after a statement': ["const a = 1; import './fr/excerpt.js';\nexport const b = a;\n"],
      dynamic: ["export const later = () => import('./fr/excerpt.js');\n"],
      'a static template': ['export const later = () => import(`./fr/excerpt.js`);\n'],
      'import() with an options argument': ["export const later = () => import('./fr/excerpt.js', { with: { type: 'javascript' } });\n"],
      'the @/ alias': ["import { read } from '@/fr/excerpt.js';\nexport const r = read;\n", { alias: true }],
    };
    for (const [name, [src, opts]] of Object.entries(cases)) expect(routesFrom(src, opts), name).toHaveLength(1);
  });
  it('NO FALSE EDGE (CE-2): words that only look like an import — in a string, a template, JSX text or a comment — open no route', () => {
    const cases = {
      'a string': "const s = \"import './fr/excerpt.js'\";\nexport const t = s;\n",
      'a string holding a from clause': "const s = \"import { read } from './fr/excerpt.js'\";\nexport const t = s;\n",
      'a template': "const s = `import('./fr/excerpt.js')`;\nexport const t = s;\n",
      'a template holding an export-all': 'const s = `export * from "./fr/excerpt.js"`;\nexport const t = s;\n',
      'JSX text': "export const P = () => <p>import './fr/excerpt.js' and import('./fr/excerpt.js')</p>;\n",
      comments: "// import './fr/excerpt.js'\n/* import { read } from './fr/excerpt.js'; */\nexport const t = 1;\n",
    };
    for (const [name, src] of Object.entries(cases)) expect(routesFrom(src), name).toEqual([]);
  });
  it('A MODULE THE PARSER CANNOT READ FAILS — never passed as a module with no imports, and the failure names the module (CE-2; the fix round\'s review, CX2-5)', () => {
    let err = null;
    try { routesFrom("import { read } from './fr/excerpt.js';\nexport const r = read(;\n"); } catch (e) { err = e; }
    expect(err?.code).toBe('BABEL_PARSER_SYNTAX_ERROR');
    expect(err.message).toMatch(/root\.js does not parse/);
  });
  it('EVERY LOCAL FORM RESOLVES OR FAILS (CX2-1; CXV-7): a query, a fragment, percent-encoding, a root-absolute path and a `file:` URL each reach the excerpt; a local specifier naming no module throws, and so does a `data:`, `https:`, `virtual:` or protocol-relative one; an asset or a builtin is no edge', () => {
    for (const spec of ['./fr/excerpt.js?v=1', './fr/excerpt.js#f', './fr/%65xcerpt.js', '/fr/excerpt.js']) expect(routesFrom(`import '${spec}';\n`), spec).toHaveLength(1);
    withTree({ 'fr/excerpt.js': EXCERPT_SRC, 'root.js': '' }, (t) => {
      const url = pathToFileURL(t.at('fr/excerpt.js')).href;
      writeFileSync(t.at('root.js'), `import '${url}';\n`);
      expect(excerptRoutesAround('evaluator', [t.at('root.js')], { exceptions: t.exceptions, repo: t.root }), 'file:').toHaveLength(1);
    });
    let err = null;
    try { routesFrom("import './fr/missing.js';\n"); } catch (e) { err = e; }
    expect(err?.code).toBe('UNRESOLVED_IMPORT');
    expect(routesFrom("import './theme.css';\nimport data from './data.json';\nexport const d = data;\n")).toEqual([]);
    // the refuter's CXV-7: a specifier with any other scheme, or a protocol-relative one, throws; a builtin is no edge
    withTree({ 'fr/excerpt.js': EXCERPT_SRC, 'root.js': '' }, (t) => {
      const url = pathToFileURL(t.at('fr/excerpt.js')).href;
      for (const spec of [`data:text/javascript,export * from "${url}"`, 'https://example.com/x.js', 'virtual:film-room', '//cdn.example.com/x.js']) {
        writeFileSync(t.at('root.js'), `export * as zz from '${spec}';\n`);
        let thrown = null;
        try { excerptRoutesAround('evaluator', [t.at('root.js')], { exceptions: t.exceptions, repo: t.root }); } catch (e) { thrown = e; }
        expect(thrown?.code, spec).toBe('UNRESOLVED_IMPORT');
      }
    });
    expect(routesFrom("import { readFileSync } from 'node:fs';\nexport const r = readFileSync;\n")).toEqual([]);
  });
  it('WHAT NO STATIC READING FOLLOWS FAILS CLOSED (CX2-2; CXV-4, CXV-6): a `require` of a string is an edge; a computed `import()` or `require()`, an `import.meta.glob`, and the module loader by name or by a static key — `createRequire` plain, aliased, as a member or by a string key, `getBuiltinModule`, an import of `module` — throw', () => {
    expect(routesFrom("const m = require('./fr/excerpt.js');\nexport const r = m;\n")).toHaveLength(1);
    for (const src of [
      "const w = './fr/excerpt.js';\nexport const later = () => import(w);\n",
      "const w = './fr/excerpt.js';\nexport const m = require(w);\n",
      "import { createRequire } from 'node:module';\nconst req = createRequire(import.meta.url);\nexport const m = req('./fr/excerpt.js');\n",
      "export const all = import.meta.glob('./fr/*.js', { eager: true });\n",
      // the refuter's CXV-4: the module loader reached by an alias, as a member, or through process
      "import { createRequire as zz } from 'node:module';\nexport const m = zz(import.meta.url)('./fr/excerpt.js');\n",
      "import mod from 'node:module';\nexport const m = mod.createRequire(import.meta.url)('./fr/excerpt.js');\n",
      "export const m = process.getBuiltinModule('node:module').createRequire(import.meta.url)('./fr/excerpt.js');\n",
      "export const m = async () => (await import('module')).default.createRequire(import.meta.url)('./fr/excerpt.js');\n",
      "const { getBuiltinModule: g } = process;\nexport const m = g('node:module').createRequire(import.meta.url)('./fr/excerpt.js');\n",
      // the refuter's CXV-6: the module loader by a string key
      "export const m = process['getBuiltinModule']('node:module')['createRequire'](import.meta.url)('./fr/excerpt.js');\n",
      "export const m = (mod) => mod['createRequire'](import.meta.url)('./fr/excerpt.js');\n",
    ]) {
      let err = null;
      try { routesFrom(src); } catch (e) { err = e; }
      expect(err?.code, src).toBe('OPAQUE_IMPORT');
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

// ── Film Room D2 (D2 spec §10; DW-11): the `debriefs` rule and the debrief path's fail-closed loads ──────────────────

/** A read of the agent's words by name: a `debriefs` collection, a collection group, a path segment — in code, comments stripped. */
// the review's C2: a path that STARTS with the segment — `doc(battleRef, 'debriefs/' + d)`, `doc(ref, \`debriefs/${d}\`)` — reads true too
const DEBRIEFS_READ = /\b(?:collection|collectionGroup|doc)\s*\(\s*['"`]debriefs['"`]|['"`]debriefs['"`/]|\/debriefs(?:\/|['"`]|$)/m;
/**
 * The specifiers that hand a module a second interpreter: the debrief path fails closed on each (either spelling) —
 * §10's two, a child process (the review's census Q1: `node -e` is one more interpreter), the inspector (the refuter's
 * N5: its Runtime.evaluate) and the REPL.
 */
const DEBRIEF_FORBIDDEN_SPECIFIERS = Object.freeze(['node:vm', 'vm', 'node:worker_threads', 'worker_threads', 'node:child_process', 'child_process', 'node:inspector', 'inspector', 'node:inspector/promises', 'inspector/promises', 'node:repl', 'repl']);
const isMember = (n) => n?.type === 'MemberExpression' || n?.type === 'OptionalMemberExpression';
/** A key written as a static string: a string literal, or a template with no `${}` (the review's C3: `globalThis[\`eval\`]`). */
const staticKey = (k) => (k?.type === 'StringLiteral' ? k.value : k?.type === 'TemplateLiteral' && k.expressions.length === 0 ? k.quasis[0]?.value?.cooked ?? null : null);
/** `n` names `name`: the identifier itself, or a member by that static key (`x.name`, `x['name']`, ``x[`name`]``). */
const namesIt = (n, name) => (n?.type === 'Identifier' && n.name === name)
  || (isMember(n) && ((!n.computed && n.property?.name === name) || (n.computed && staticKey(n.property) === name)));
/**
 * What the debrief path's walk fails closed on, in one module's source: `eval` named anywhere in code (a call, an alias, a
 * member — `globalThis.eval`), `Function` called or taken as a value (with or without `new`, bare or as a member, aliased,
 * destructured), and a load of `node:vm`, `node:worker_threads` or `node:child_process`. Read with the census's own parser:
 * a string or a comment that says "eval" is no load.
 */
export function debriefLoadsOf(src, where) {
  const found = new Set();
  for (const spec of importSpecifiersOf(src, where)) if (DEBRIEF_FORBIDDEN_SPECIFIERS.includes(spec)) found.add(spec.startsWith('node:') ? spec : `node:${spec}`);
  const ast = parse(String(src), { ...PARSE_OPTIONS, plugins: [...PARSE_OPTIONS.plugins] });
  // each node with its parent, the key it sits under, and the parent's parent — so `Function` named as a VALUE can be
  // told from an object literal's key or a typeof
  const stack = [[ast.program, null, null, null]];
  while (stack.length) {
    const [n, parent, key, grand] = stack.pop();
    if (Array.isArray(n)) { for (const x of n) if (x && typeof x === 'object') stack.push([x, parent, key, grand]); continue; }
    if (n.type === 'Identifier' && n.name === 'eval') found.add('eval');
    if (isMember(n) && namesIt(n, 'eval')) found.add('eval');
    if ((n.type === 'NewExpression' || n.type === 'CallExpression' || n.type === 'OptionalCallExpression') && namesIt(n.callee, 'Function')) found.add('new Function');
    // the review's C3: the Function constructor taken as a VALUE, not only called where it is named — a member that names
    // it (`globalThis.Function`, `x['Function']`, ``x[`Function`]``), aliased (`const F = Function`), handed on
    // (`Reflect.construct(Function, …)`), its prototype's constructor reached, or destructured (`{ Function: F } = globalThis`).
    // Not a value: an object LITERAL's static key (`{ Function: 1 }`), or `typeof Function`
    if (isMember(n) && namesIt(n, 'Function')) found.add('new Function');
    if (n.type === 'Identifier' && n.name === 'Function') {
      const asProperty = isMember(parent) && key === 'property' && !parent.computed;   // the member row above judges it
      const asLiteralKey = (parent?.type === 'ObjectProperty' || parent?.type === 'ObjectMethod') && key === 'key' && !parent.computed && grand?.type !== 'ObjectPattern';
      const asTypeof = parent?.type === 'UnaryExpression' && parent.operator === 'typeof';
      if (!asProperty && !asLiteralKey && !asTypeof) found.add('new Function');
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'extra' || k === 'comments' || k.endsWith('Comments')) continue;
      const v = n[k];
      if (v && typeof v === 'object') stack.push([v, n, k, parent]);
    }
  }
  return [...found].sort();
}
/** The debrief path's walk: its closure, every module of it read for the fail-closed loads — the first found throws, naming it. */
export function debriefClosureOf(roots, { read = readSource, repo = REPO } = {}) {
  const walk = closureOf(roots, { read, repo });
  for (const f of walk.seen) {
    const loads = debriefLoadsOf(read(f), f);
    if (loads.length) throw Object.assign(new Error(`one door (debrief): ${path.relative(repo, f)} loads by ${loads.join(', ')} — fails closed (${chainTo(walk.parent, f, repo)})`), { code: 'OPAQUE_LOAD', loads });
  }
  return walk;
}

describe('D2 — the `debrief` model path (D2 spec §10, DW-11)', () => {
  it('reaches what it is known to use — the call, the digest, the checks — and the pass and the record\'s collection', () => {
    const { seen } = closureOf(MODEL_PATHS.debrief.map(abs));
    for (const known of [...KNOWN_REACH.debrief, 'api/_utils/filmRoom/debriefPass.js', 'src/utils/debriefSchedule.js']) expect([...seen].some((f) => path.resolve(f) === path.resolve(abs(known))), known).toBe(true);
  });
  it('the prompt builder\'s own closure reads the digest and the copy table — never the call, the pass or the record', () => {
    const { seen } = closureOf([abs('api/_utils/filmRoom/debriefPrompt.js')]);
    for (const not of ['api/_utils/filmRoom/debriefModelCall.js', 'api/_utils/filmRoom/debriefPass.js', 'src/utils/debriefSchedule.js']) expect([...seen].some((f) => path.resolve(f) === path.resolve(abs(not))), not).toBe(false);
  });
  it('it reaches neither the ledger, `plays`, the moment excerpt nor its named importer (its row in the loop above, stated by name)', () => {
    expect(oneDoorDefectsOf('debrief', MODEL_PATHS.debrief.map(abs))).toEqual([]);
    const { seen } = closureOf(MODEL_PATHS.debrief.map(abs));
    for (const not of [...LEDGER_MODULES, EXCERPT_MODULE, NAMED_EXCEPTIONS[0].importer]) expect([...seen].some((f) => path.resolve(f) === path.resolve(abs(not))), not).toBe(false);
  });
});

describe('D2 — THE RULE: no module reachable from any other model path reads `debriefs` (D2 spec §10)', () => {
  for (const [name, roots] of Object.entries(MODEL_PATHS)) {
    if (name === 'debrief') continue;
    it(`${name}: no module reachable from its roots reads debriefs by name`, () => {
      const { seen, parent } = closureOf(roots.map(abs));
      const readers = [...seen].filter((f) => DEBRIEFS_READ.test(strippedOf(f)));
      expect(readers.map((f) => `${path.relative(REPO, f)} (via ${chainTo(parent, f, REPO)})`)).toEqual([]);
    });
  }
  it('the rule is not vacuous: the debrief path itself reads `debriefs` (the record\'s collection, src/utils/debriefSchedule.js)', () => {
    const { seen } = closureOf(MODEL_PATHS.debrief.map(abs));
    expect([...seen].filter((f) => DEBRIEFS_READ.test(strippedOf(f))).map((f) => path.relative(REPO, f).replace(/\\/g, '/'))).toContain('src/utils/debriefSchedule.js');
  });
  it('the walker bites: a synthetic graph whose root reaches a `debriefs` reader through a middle module; a comment is no read', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'one-door-d2-'));
    try {
      writeFileSync(path.join(root, 'reader.js'), "export const recordOf = (db, id, d) => db.collection('agentBattles').doc(id).collection('debriefs').doc(d).get();\n");
      writeFileSync(path.join(root, 'mid.js'), "import { recordOf } from './reader.js';\nexport const x = recordOf;\n");
      writeFileSync(path.join(root, 'root.js'), "export async function run() { const m = await import('./mid.js'); return m.x; }\n");
      writeFileSync(path.join(root, 'clean.js'), "export const y = 1; // debriefs, in a comment only\n");
      const { seen, parent } = closureOf([path.join(root, 'root.js')], { repo: root });
      const readers = [...seen].filter((f) => DEBRIEFS_READ.test(stripComments(readFileSync(f, 'utf8'))));
      expect(readers.map((f) => chainTo(parent, f, root))).toEqual(['root.js → mid.js → reader.js']);
      expect(DEBRIEFS_READ.test(stripComments(readFileSync(path.join(root, 'clean.js'), 'utf8')))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('every spelling of a `debriefs` read reads true — a template, the Admin path form, a concatenated path, the client\'s doc(), the name as a constant — and a neighbour name does not', () => {
    for (const r of ['db.collection(`debriefs`)', 'db.collection(`agentBattles/${id}/debriefs`)', "db.collection('agentBattles/' + id + '/debriefs')", "doc(db, 'agentBattles', id, 'debriefs', etDate)", "db.collectionGroup('debriefs')", "export const DEBRIEFS_SUBCOLLECTION = 'debriefs';"]) expect(DEBRIEFS_READ.test(r), r).toBe(true);
    for (const c of ["db.collection('debriefsArchive')", "db.collection('debrief')", 'const debriefs = 3;', "db.collection('reviews')"]) expect(DEBRIEFS_READ.test(c), c).toBe(false);
  });
});

describe('D2 — the debrief path\'s FAIL-CLOSED LOADS: eval, new Function, node:vm, node:worker_threads, node:child_process (Build C CF-11\'s cheap step)', () => {
  it('the real debrief path walks clean — none of its modules loads by any of them', () => {
    expect(() => debriefClosureOf(MODEL_PATHS.debrief.map(abs))).not.toThrow();
  });
  /** A synthetic root reaching `bad` through a middle module: the error the walk throws, or null. */
  const walkErrorOf = (bad) => {
    const root = mkdtempSync(path.join(tmpdir(), 'one-door-d2-load-'));
    try {
      writeFileSync(path.join(root, 'bad.js'), bad);
      writeFileSync(path.join(root, 'mid.js'), "export { z } from './bad.js';\n");
      writeFileSync(path.join(root, 'root.js'), "import { z } from './mid.js';\nexport const run = () => z;\n");
      let err = null;
      try { debriefClosureOf([path.join(root, 'root.js')], { repo: root }); } catch (e) { err = e; }
      return err;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  it('each load, planted two modules down, makes the walk throw — naming it and its module', () => {
    const plants = {
      eval: ['export const z = (s) => eval(s);\n', 'export const z = (s) => globalThis.eval(s);\n', 'export const z = (s) => (0, eval)(s);\n', 'const e = eval; export const z = e;\n', "export const z = (s) => globalThis['eval'](s);\n"],
      'new Function': ["export const z = new Function('return 1');\n", "export const z = Function('return 1');\n", "export const z = new globalThis.Function('return 1');\n"],
      'node:vm': ["import vm from 'node:vm';\nexport const z = vm;\n", "import vm from 'vm';\nexport const z = vm;\n", "export const z = () => import('node:vm');\n"],
      'node:worker_threads': ["import { Worker } from 'node:worker_threads';\nexport const z = Worker;\n", "export const z = () => import('worker_threads');\n"],
    };
    for (const [load, sources] of Object.entries(plants)) {
      for (const src of sources) {
        const err = walkErrorOf(src);
        expect(err?.code, src).toBe('OPAQUE_LOAD');
        expect(err.loads, src).toContain(load);
        expect(err.message, src).toContain('bad.js');
      }
    }
  });
  it('a clean module that only SAYS "eval" or "Function" — in a string, a comment, a longer name, a typeof — passes', () => {
    for (const src of ["export const z = 'eval';\n", '// eval(x) here\nexport const z = 1;\n', 'export const z = (evaluation) => evaluation;\n', "export const z = { kind: 'Function' };\n", 'export const z = typeof Function;\n', 'export const z = { Function: 1 };\n', 'export const z = (x) => typeof x === "function";\n']) {
      expect(walkErrorOf(src), src).toBeNull();
    }
  });
  it('the review\'s C3 and census Q1: the constructor taken as a value, a template-literal key, a child process — each throws', () => {
    const plants = {
      eval: ['export const z = (s) => globalThis[`eval`](s);\n'],
      'new Function': [
        "const F = Function; export const z = new F('return 1');\n",
        "export const z = Reflect.construct(Function, ['return 1']);\n",
        "export const z = new Function.prototype.constructor('return 1');\n",
        "const { Function: F } = globalThis; export const z = new F('return 1');\n",
        "const { Function } = globalThis; export const z = Function;\n",
        "const F = globalThis.Function; export const z = new F('return 1');\n",
        "export const z = new globalThis[`Function`]('return 1');\n",
        'export const z = { make: Function };\n',
      ],
      'node:child_process': ["import { execFileSync } from 'node:child_process';\nexport const z = execFileSync;\n", "export const z = () => import('child_process');\n"],
    };
    for (const [load, sources] of Object.entries(plants)) {
      for (const src of sources) {
        const err = walkErrorOf(src);
        expect(err?.code, src).toBe('OPAQUE_LOAD');
        expect(err.loads, src).toContain(load);
      }
    }
  });
  it('the review\'s C2: a `debriefs` path that starts the string — concatenated or a template — reads true', () => {
    for (const r of ["doc(battleRef, 'debriefs/' + etDate)", 'doc(ref, `debriefs/${etDate}`)', "db.doc('debriefs/' + id)"]) expect(DEBRIEFS_READ.test(r), r).toBe(true);
    for (const c of ["const kind = 'debriefsArchive/' + x;", "db.collection('debrief/' + d)"]) expect(DEBRIEFS_READ.test(c), c).toBe(false);
  });
});

describe("D2 — the refuter's round (§2 review)", () => {
  const walkErrorOf = (bad) => {
    const root = mkdtempSync(path.join(tmpdir(), 'one-door-d2-refuter-'));
    try {
      writeFileSync(path.join(root, 'bad.js'), bad);
      writeFileSync(path.join(root, 'root.js'), "import { z } from './bad.js';\nexport const run = () => z;\n");
      let err = null;
      try { debriefClosureOf([path.join(root, 'root.js')], { repo: root }); } catch (e) { err = e; }
      return err;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  it('N5: the inspector and the REPL fail the debrief walk closed, either spelling', () => {
    const plants = {
      'node:inspector': ["import { Session } from 'node:inspector';\nexport const z = Session;\n", "export const z = () => import('inspector');\n"],
      'node:inspector/promises': ["import { Session } from 'node:inspector/promises';\nexport const z = Session;\n"],
      'node:repl': ["import repl from 'repl';\nexport const z = repl;\n"],
    };
    for (const [load, sources] of Object.entries(plants)) {
      for (const src of sources) {
        const err = walkErrorOf(src);
        expect(err?.code, src).toBe('OPAQUE_LOAD');
        expect(err.loads, src).toContain(load);
      }
    }
  });
  it("C2 (the inherited half): a `plays` path that starts the string — concatenated or a template — reads true; a neighbour name does not", () => {
    for (const r of ["doc(battleRef, 'plays/' + id)", 'doc(ref, `plays/${id}`)', "db.doc('plays/' + id)"]) expect(PLAYS_READ.test(r), r).toBe(true);
    for (const c of ["const kind = 'playsheets/' + x;", "db.collection('play/' + d)", "db.collection('replays/' + d)"]) expect(PLAYS_READ.test(c), c).toBe(false);
  });
});
