// src/components/AgentForm/agentForm.flagOffBundle.test.js
//
// Agent form build S1, review fix SR-3 (docs/audits/20261029_REVIEW_AGENT_FORM_S1.md). The flags are on since the flags-on
// build, and they stay as kill switches (founder ruling F2), so this guard's question is now the rollback's: set a flag
// false and the build is what it was before the forms shipped. Part of what holds that is tree-shaking: `/* @__PURE__ */`
// marks on module-level calls (agentFormSpec.js, HubAgentForm.jsx, battleAgentFormSlot.jsx), and Rollup's own
// knowledge of `Object.freeze` (hub/hubCopy.js's AGENT_FORM_COPY). Take one mark off and the call survives into a
// flag-off chunk, and no jsdom row can see it. So this file bundles each module the flag-off graph reaches, the way that
// graph reaches it, and reads what Rollup kept:
//   HubAgentForm.jsx         imported and unused (ShadowStage.jsx and CommandCenterHub.jsx read it only inside the
//                            AGENT_FORM_HUB_ENABLED ternaries) → nothing;
//   battleAgentFormSlot.jsx  imported and unused (the battle sites read it only inside AGENT_FORM_BATTLE_ENABLED's)
//                            → nothing;
//   leagueAgentFormSlot.jsx  imported and unused (the League's sites read it only inside AGENT_FORM_LEAGUE_ENABLED's;
//                            build S2) → nothing;
//   fuseFormLayout.js        imported and unused (FuseHero.jsx and ArenaMobile.jsx read it only inside those same
//                            ternaries; build S2's review, S2R-2) → nothing;
//   agentFormSpec.js        formForArchetype and hasWebGL used (HubAgentForm.jsx's import) → those two and the table
//                            they read (build A1: the armory's two looks are read inside AGENT_FORM_ARMORY_ENABLED's
//                            ternaries, so they fold away with it);
//   hub/hubCopy.js           HUB_COPY used (every hub view) → HUB_COPY alone (ARMORY_COPY, build A1, is dropped too).
// Build A1, the armory (AGENT_FORM_ARMORY_ENABLED; live since the armory flip of Nov 7, 2026, and a kill switch, so these
// rows read what each module leaves when it is set back to false):
//   Armory.jsx               imported and unused (LoadoutSheets.jsx, ShadowStage.jsx and CommandCenterHub.jsx read it
//                            only inside that flag's ternaries) → nothing (its context is marked pure);
//   hub/archetypeLines.js    archetypeLines used (the Loadout) → archetypeLines alone (armoryLines is dropped);
//   ShadowStage.jsx          its four exports used (the shells) → those, and not the phone armory's stage.
// The bundle is Vite's own build, in memory (`write: false`), with the production JSX transform @vitejs/plugin-react
// sets. Everything a module imports is external, but for the agent form flag module, bundled with every flag false so
// the literal ternaries fold as they would after a rollback. The check reads the output's top level, never where the
// marks sit: a mark moved, split or dropped is judged by what it leaves. The last row plants the review's mutants
// (RV-P, RV-P2) and the shapes a mark scan would pass (a `let` assigned later, a destructured binding, a mark on the
// inner call only), with a pristine control through the same path.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, parseAst } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const idOf = (rel) => path.join(REPO, rel).split(path.sep).join('/');
const read = (rel) => readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

const HUB_VIEW = 'src/components/CommandCenter/HubAgentForm.jsx';
const SLOT = 'src/screens/battleView/battleAgentFormSlot.jsx';
const LEAGUE_SLOT = 'src/components/League/battleArena/leagueAgentFormSlot.jsx';
const FUSE_LAYOUT = 'src/components/League/battleArena/fuseFormLayout.js';
const SPEC ='src/components/AgentForm/agentFormSpec.js';
const HUB_COPY_FILE = 'src/components/CommandCenter/hub/hubCopy.js';
const FLAGS = 'src/config/agentFormFlags.js';
const ARMORY = 'src/components/CommandCenter/Armory.jsx';
const LINES = 'src/components/CommandCenter/hub/archetypeLines.js';
const STAGE = 'src/components/CommandCenter/ShadowStage.jsx';
const STAGE_USED = ['PhoneStage', 'ShadowStage', 'StatusLine', 'connectorPath'];
// Build A2 (per-game loadouts, PER_GAME_LOADOUT_ENABLED; live since the armory flip of Nov 7, 2026, and a kill switch, so
// these rows read what each module leaves when it is set back to false): the flag's own module, rewritten false as the agent form
// flags are, and the A2 modules the flag-off graph reaches — each imported and unused (every read of it sits inside a
// `PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED` ternary), so each bundles to nothing.
const PER_GAME_FLAGS = 'src/config/perGameLoadoutFlags.js';
const A2_UNUSED = Object.freeze([
  'src/components/CommandCenter/LoadoutCards.jsx',
  'src/components/CommandCenter/LoadoutBookSheet.jsx',
  'src/components/CommandCenter/PerGameLoadoutScope.jsx',
  'src/components/CommandCenter/hub/perGameLoadoutContext.js',
  'src/components/CommandCenter/hub/perGameLoadoutModel.js',
  'src/components/CommandCenter/hub/useLeagueLoadoutLock.js',
  'src/components/AgentForm/LoadoutStill.jsx',
  'src/components/League/leagueLoadoutSlot.jsx',
  'src/constants/perGameLoadout.js',
  'src/constants/loadoutCopy.js',
]);
const A2_CONTEXT = 'src/components/CommandCenter/hub/perGameLoadoutContext.js';
const A2_SLOT = 'src/components/League/leagueLoadoutSlot.jsx';

/** Each module the flag-off graph reaches, with the exports that graph reads from it. */
const REACHED = [
  [HUB_VIEW, []],
  [SLOT, []],
  [LEAGUE_SLOT, []],
  [FUSE_LAYOUT, []],
  [SPEC, ['formForArchetype', 'hasWebGL']],
  [HUB_COPY_FILE, ['HUB_COPY']],
  [ARMORY, []],
  [LINES, ['archetypeLines']],
  [STAGE, STAGE_USED],
  ...A2_UNUSED.map((rel) => [rel, []]),
];

const ENTRY = '\0agent-form-flag-off-entry';

/** The flag module as the flag-off graph reads it: every flag false, whatever the file ships. */
const flagOff = (code) => code.replace(/^(export const \w+_ENABLED = )true;$/gm, '$1false;');

/**
 * One module bundled as the flag-off graph reaches it, `used` its exports read ([] for imported and unused); `source`
 * replaces its text. Returns the output and every module the build loaded (an empty one renders no code, so the chunk
 * does not list it).
 */
async function bundle(rel, used, source) {
  const target = idOf(rel), flags = idOf(FLAGS), perGame = idOf(PER_GAME_FLAGS);
  const entry = used.length ? `export { ${used.join(', ')} } from ${JSON.stringify(target)};` : `import ${JSON.stringify(target)};`;
  const loaded = [];
  const result = await build({
    configFile: false, envFile: false, publicDir: false, logLevel: 'silent', root: REPO,
    css: { postcss: {} }, // no search for the repo's PostCSS config, which loads Tailwind
    // The production transform: the test environment's NODE_ENV would otherwise give jsxDEV.
    define: { 'process.env.NODE_ENV': '"production"' },
    esbuild: { jsx: 'automatic', jsxDev: false },
    plugins: [{
      name: 'agent-form-flag-off-graph',
      enforce: 'pre',
      resolveId(spec, importer) {
        if (spec === ENTRY) return ENTRY;
        if (importer === ENTRY) return target;
        if (importer !== target) return null;
        if (/(^|\/)perGameLoadoutFlags(\.js)?$/.test(spec)) return perGame; // build A2: the second flag module, internal too
        return /(^|\/)agentFormFlags(\.js)?$/.test(spec) ? flags : { id: spec, external: true };
      },
      load(id) {
        loaded.push(id);
        if (id === ENTRY) return entry;
        if (id === flags) return flagOff(read(FLAGS));
        if (id === perGame) return flagOff(read(PER_GAME_FLAGS));
        if (id === target && source != null) return source;
        return null;
      },
    }],
    build: {
      write: false, minify: false, sourcemap: false, modulePreload: false, copyPublicDir: false, reportCompressedSize: false, emptyOutDir: false,
      // 'strict' keeps the entry's exports, which an app build would drop; externals carry no side effects of their own.
      rollupOptions: { input: ENTRY, preserveEntrySignatures: 'strict', treeshake: { moduleSideEffects: 'no-external' }, onwarn() {} },
    },
  });
  const [chunk] = (Array.isArray(result) ? result[0] : result).output;
  return { code: chunk.code, loaded };
}

/** Every identifier a node names, anywhere inside it. Scopes are not told apart, so a reach is over-counted, never missed. */
function namesIn(node, out = new Set()) {
  if (Array.isArray(node)) { for (const n of node) namesIn(n, out); return out; }
  if (!node || typeof node.type !== 'string') return out;
  if (node.type === 'Identifier') out.add(node.name);
  for (const [key, value] of Object.entries(node)) if (key !== 'type' && value && typeof value === 'object') namesIn(value, out);
  return out;
}

const exportListOf = (body) => body.filter((node) => node.type === 'ExportNamedDeclaration' && !node.declaration && !node.source);

/** The names a bundle exports. */
const exportsOf = (code) => exportListOf(parseAst(code).body).flatMap((node) => node.specifiers.map((s) => s.exported.name ?? s.exported.value));

/**
 * What a bundle holds besides its exports and what they reach, as the code reads: any top-level statement but an import,
 * a function, class or plain-identifier declaration the export list reaches, and that list. A bare call, an assignment
 * and a destructured binding (Rollup keeps each whenever it may have an effect) are reported whatever they reach.
 */
function leftovers(code) {
  const body = parseAst(code).body;
  const text = (node) => code.slice(node.start, node.end);
  const decls = new Map();
  const odd = [];
  for (const node of body) {
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') decls.set(node.id.name, node);
    else if (node.type === 'VariableDeclaration' && node.declarations.every((d) => d.id.type === 'Identifier')) for (const d of node.declarations) decls.set(d.id.name, d);
    else if (!(node.type === 'ImportDeclaration' && node.specifiers.length) && !exportListOf([node]).length) odd.push(text(node));
  }
  const reached = new Set();
  const queue = exportListOf(body).flatMap((node) => node.specifiers.map((s) => s.local.name));
  while (queue.length) {
    const name = queue.pop();
    if (reached.has(name) || !decls.has(name)) continue;
    reached.add(name);
    queue.push(...namesIn(decls.get(name)));
  }
  return [...odd, ...[...decls].filter(([name]) => !reached.has(name)).map(([, node]) => text(node))];
}

describe('the flag-off pure marks (agent form S1 review SR-3): each module the flag-off graph reaches bundles to what it uses, and nothing else', () => {
  it('the flag module read here is the rollback\'s: whatever the file ships, the rewrite turns every flag false', () => {
    const planted = read(FLAGS).replace('export const AGENT_FORM_LAB_ENABLED = false;', 'export const AGENT_FORM_LAB_ENABLED = true;');
    for (const code of [read(FLAGS), planted]) {
      expect(flagOff(code).match(/^export const \w+_ENABLED = true;$/gm)).toBeNull();
      expect(flagOff(code).match(/^export const \w+_ENABLED = false;$/gm)).toHaveLength(5);
    }
  });

  it('HubAgentForm.jsx, imported and unused: nothing (its context is marked pure)', async () => {
    const { code } = await bundle(HUB_VIEW, []);
    expect(leftovers(code)).toEqual([]);
    expect(code.trim()).toBe('');
  }, 30000);

  it('battleAgentFormSlot.jsx, imported and unused: nothing (its context is marked pure; the lazy form folds away with the flag)', async () => {
    const { code, loaded } = await bundle(SLOT, []);
    expect(leftovers(code)).toEqual([]);
    expect(code.trim()).toBe('');
    // The flag module was bundled, so the ternary folded on the flag's value, as in the shipped build; nothing else was.
    expect([...loaded].sort()).toEqual([ENTRY, idOf(SLOT), idOf(FLAGS)].sort());
  }, 30000);

  it('leagueAgentFormSlot.jsx, imported and unused: nothing (its contexts are marked pure; the lazy form folds away with the flag)', async () => {
    const { code, loaded } = await bundle(LEAGUE_SLOT, []);
    expect(leftovers(code)).toEqual([]);
    expect(code.trim()).toBe('');
    expect([...loaded].sort()).toEqual([ENTRY, idOf(LEAGUE_SLOT), idOf(FLAGS)].sort());
  }, 30000);

  it('fuseFormLayout.js, imported and unused: nothing (no module-level call survives, so none of it ships with the flag off)', async () => {
    const { code, loaded } = await bundle(FUSE_LAYOUT, []);
    expect(leftovers(code)).toEqual([]);
    expect(code.trim()).toBe('');
    // It never reads the flag, and ./fuseGeometry is external: the entry and the module are all that loaded.
    expect([...loaded].sort()).toEqual([ENTRY, idOf(FUSE_LAYOUT)].sort());
  }, 30000);

  it('agentFormSpec.js, with formForArchetype and hasWebGL used: those two and the code-id table they read', async () => {
    const { code } = await bundle(SPEC, ['formForArchetype', 'hasWebGL']);
    expect(exportsOf(code)).toEqual(['formForArchetype', 'hasWebGL']);
    expect(leftovers(code)).toEqual([]);
    expect(code).toMatch(/\bconst FORM_BY_CODE_ID = /);
  }, 30000);

  it('hub/hubCopy.js, with HUB_COPY used: HUB_COPY alone (AGENT_FORM_COPY is dropped)', async () => {
    const { code } = await bundle(HUB_COPY_FILE, ['HUB_COPY']);
    expect(exportsOf(code)).toEqual(['HUB_COPY']);
    expect(leftovers(code)).toEqual([]);
    expect(code).not.toMatch(/\bAGENT_FORM_COPY\b/);
  }, 30000);

  it('kill switch, the armory off (build A1): Armory.jsx, imported and unused: nothing (its context is marked pure; every read of it is inside the flag\'s ternaries)', async () => {
    const { code } = await bundle(ARMORY, []);
    expect(leftovers(code)).toEqual([]);
    expect(code.trim()).toBe('');
  }, 30000);

  it.each(A2_UNUSED)('kill switch, per-game loadouts off (build A2): %s, imported and unused: nothing (its module-level calls are literals or marked pure)', async (rel) => {
    const { code } = await bundle(rel, []);
    expect(leftovers(code)).toEqual([]);
    expect(code.trim()).toBe('');
  }, 30000);

  it('kill switch, per-game loadouts off (build A2): the shipped hub modules that read the per-game flag bundle with nothing of A2', async () => {
    for (const [rel, used, gone] of [
      ['src/components/CommandCenter/panels/LoadoutPanel.jsx', ['default'], /\bLoadoutCards\b|\bAdjustmentsCard\b/],
      ['src/components/CommandCenter/sections/DeploySection.jsx', ['default', 'PhoneDeployCard'], /\bDeployLoadoutLine\b/],
      ['src/components/CommandCenter/LoadoutSheets.jsx', ['default'], /\bLoadoutBookSheet\b/],
      ['src/components/CommandCenter/hub/useHubRuntime.js', ['useHubRuntime'], /\bscopeSummary\b|\bPerGameLoadoutContext\b/],
      ['src/adapters/baggerbombAdapter.js', ['buildBaggerbombAdapter'], /\bPER_GAME_LOADOUT_ENABLED\b/],
    ]) {
      const { code } = await bundle(rel, used);
      expect(code, rel).not.toMatch(gone);
      expect(code, rel).not.toMatch(/\bperGameLoadout|\bloadoutService\b|\bleagueLockService\b/);
    }
  }, 60000);

  it('kill switch, the armory off (build A1): hub/archetypeLines.js, with archetypeLines used: archetypeLines alone (armoryLines is dropped)', async () => {
    const { code } = await bundle(LINES, ['archetypeLines']);
    expect(exportsOf(code)).toEqual(['archetypeLines']);
    expect(leftovers(code)).toEqual([]);
    expect(code).not.toMatch(/\barmoryLines\b/);
  }, 30000);

  it('kill switch, the armory off (build A1): ShadowStage.jsx, with its four exports used: those, and nothing of the phone armory\'s stage', async () => {
    const { code } = await bundle(STAGE, STAGE_USED);
    expect(exportsOf(code).sort()).toEqual([...STAGE_USED].sort());
    expect(leftovers(code)).toEqual([]);
    expect(code).not.toMatch(/\bPhoneArmoryStage\b|\bPhoneSummaries\b|\bArmoryStageContext\b/);
  }, 30000);

  it('kill switch, the armory off (build A1): agentFormSpec.js reads neither armory look, so the module bundles as before A1', async () => {
    const { code } = await bundle(SPEC, ['formForArchetype', 'hasWebGL', 'agentFormSpec']);
    expect(code).not.toMatch(/\bunlit\b|\bSET_ALONE\b|\bsetAloneKeys\b|\bbrain\b/);
    expect(code).toMatch(/pal: opponent \? "copper" : "teal"|pal: opponent \? 'copper' : 'teal'/);
  }, 30000);

  // The A1 fix pass (founder rulings D-B, D-C): the engine reads the flag for the core's level and its breath. Flag off,
  // each read folds to main's expression, so the engine modules bundle as they did, with nothing of the breath in them.
  it('kill switch, the armory off (A1 fix pass, D-B and D-C): nothing of the core\'s level or breath bundles; each site is the expression before A1', async () => {
    const ENGINE = 'src/components/AgentForm/engine/';
    const core = (await bundle(`${ENGINE}core.js`, ['buildBrain'])).code;
    expect(core).not.toMatch(/\bS\.level\b|multiplyScalar\(S\./);
    // (Rollup writes `.95` as `0.95` and may rename a local, as the app's build does: `hot2`.)
    expect(core).toMatch(/\bcoreMesh\.material\.color\.set\(pal\.core\);/);
    expect(core).toMatch(/\bglow\.material\.opacity = clamp\(0?\.95 \* S\.bright \* hot\d*, 0, 1\);/);
    expect(core).toMatch(/\bhalo\.material\.opacity = clamp\(0?\.18 \* S\.bright \* hot\d*, 0, 1\);/);
    const form = (await bundle(`${ENGINE}form.js`, ['poseForm'])).code;
    expect(form).not.toMatch(/\bcoreLevel\b|\.held\b/);
    expect(form).toMatch(/F\.brain\.update\(t, coreLift === 1 \? S : \{ \.\.\.S, bright: S\.bright \* coreLift, lifted: coreLift \}, pal, camDir\d*\);/);
    const engine = (await bundle(`${ENGINE}engine.js`, ['createAgentFormEngine'])).code;
    expect(engine).not.toMatch(/\bheld:|\.held\b/); // (a JSDoc in it says "held while the view does not draw", as main's does)
    expect(engine).toMatch(/poseForm\(F, spec, t, C\d*, palette\);/);
    const vocab = (await bundle(`${ENGINE}vocab.js`, ['STATES', 'responseLift'])).code;
    expect(vocab).not.toMatch(/\bbreath\b|\bCORE_LEVEL\b|\bBREATH_S\b|\bBREATH_DEPTH\b|\bcoreLevel\b/);
  }, 30000);

  it('the check bites: each mark off, and each shape a mark scan would pass, leaves a statement it reports; a pristine copy leaves none', async () => {
    const plant = (rel, from, to) => {
      const code = read(rel);
      expect(code.split(from), `${rel} no longer holds: ${from}`).toHaveLength(2);
      return code.replace(from, to);
    };
    const CODE_IDS = 'export const ARCHETYPE_CODE_IDS = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.keys(FORM_BY_CODE_ID));';
    const SPEC_USED = ['formForArchetype', 'hasWebGL'];
    const plants = [
      ['RV-P: the two marks off agentFormSpec.js:24', SPEC, SPEC_USED, plant(SPEC, CODE_IDS, 'export const ARCHETYPE_CODE_IDS = Object.freeze(Object.keys(FORM_BY_CODE_ID));')],
      ['a let assigned later', SPEC, SPEC_USED, plant(SPEC, CODE_IDS, 'export let ARCHETYPE_CODE_IDS;\nARCHETYPE_CODE_IDS = Object.freeze(Object.keys(FORM_BY_CODE_ID));')],
      ['a destructured binding, marked', SPEC, SPEC_USED, plant(SPEC, CODE_IDS, 'export const [FIRST_CODE_ID] = /* @__PURE__ */ Object.keys(FORM_BY_CODE_ID);')],
      ['a mark on the inner call only', SPEC, SPEC_USED, plant(SPEC, CODE_IDS, 'export const ARCHETYPE_CODE_IDS = Object.freeze(/* @__PURE__ */ Object.keys(FORM_BY_CODE_ID));')],
      ['RV-P2: the mark off HubAgentForm.jsx:34', HUB_VIEW, [], plant(HUB_VIEW, '/* @__PURE__ */ createContext(null)', 'createContext(null)')],
      ['the mark off battleAgentFormSlot.jsx:23', SLOT, [], plant(SLOT, '/* @__PURE__ */ createContext(null)', 'createContext(null)')],
      ['the lazy form declared without its flag', SLOT, [], plant(SLOT, "AGENT_FORM_BATTLE_ENABLED ? lazy(() => import('./BattleAgentForm')) : null", "lazy(() => import('./BattleAgentForm'))")],
      ['a mark off the League slot\'s first context', LEAGUE_SLOT, [], plant(LEAGUE_SLOT, 'LeagueAgentFormContext = /* @__PURE__ */ createContext(null)', 'LeagueAgentFormContext = createContext(null)')],
      ['a mark off the League slot\'s second context', LEAGUE_SLOT, [], plant(LEAGUE_SLOT, 'LeagueStandingContext = /* @__PURE__ */ createContext(null)', 'LeagueStandingContext = createContext(null)')],
      ['the League\'s lazy form declared without its flag', LEAGUE_SLOT, [], plant(LEAGUE_SLOT, "AGENT_FORM_LEAGUE_ENABLED ? lazy(() => import('./LeagueAgentForm')) : null", "lazy(() => import('./LeagueAgentForm'))")],
      ['a frozen copy key list nothing reads', HUB_COPY_FILE, ['HUB_COPY'], `${read(HUB_COPY_FILE)}\nexport const AGENT_FORM_COPY_KEYS = Object.freeze(Object.keys(AGENT_FORM_COPY));\n`],
      ['S2R-2: a frozen key list nothing reads, in fuseFormLayout.js', FUSE_LAYOUT, [], `${read(FUSE_LAYOUT)}\nexport const FUSE_FORM_KEYS = Object.freeze(Object.keys(FUSE_FORM_PX));\n`],
      ['A1: the mark off the armory\'s context', ARMORY, [], plant(ARMORY, 'ArmoryStageContext = /* @__PURE__ */ createContext(null)', 'ArmoryStageContext = createContext(null)')],
      ['A2: the mark off the loadout context', A2_CONTEXT, [], plant(A2_CONTEXT, 'PerGameLoadoutContext = /* @__PURE__ */ createContext(null)', 'PerGameLoadoutContext = createContext(null)')],
      ['A2: the League line declared without its flags', A2_SLOT, [], plant(A2_SLOT, 'const LazyLeagueLine = PER_GAME_LOADOUT_ENABLED && AGENT_FORM_ARMORY_ENABLED\n  ? lazy', 'const LazyLeagueLine = true\n  ? lazy')],
      ['A2: a model constant that reads another binding\'s property', 'src/constants/perGameLoadout.js', [], plant('src/constants/perGameLoadout.js', "Object.freeze(['baggerbomb', 'league'])", 'Object.freeze([LOADOUT_KINDS.BAGGERBOMB, LOADOUT_KINDS.LEAGUE])')],
    ];
    for (const [what, rel, used, source] of plants) expect(leftovers((await bundle(rel, used, source)).code), what).not.toEqual([]);
    for (const [rel, used] of REACHED) expect(leftovers((await bundle(rel, used, read(rel))).code), rel).toEqual([]);
  }, 30000);
});
