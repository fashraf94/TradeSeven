// src/components/AgentForm/agentForm.flagOffBundle.test.js
//
// Agent form build S1, review fix SR-3 (docs/audits/20261029_REVIEW_AGENT_FORM_S1.md). With both flags off the build
// is byte-identical to main's but for one line, and part of what holds it there is tree-shaking: `/* @__PURE__ */`
// marks on module-level calls (agentFormSpec.js, HubAgentForm.jsx, battleAgentFormSlot.jsx), and Rollup's own
// knowledge of `Object.freeze` (hub/hubCopy.js's AGENT_FORM_COPY). Take one mark off and the call survives into a
// flag-off chunk, and no jsdom row can see it. So this file bundles each module the flag-off graph reaches, the way that
// graph reaches it, and reads what Rollup kept:
//   HubAgentForm.jsx         imported and unused (ShadowStage.jsx and CommandCenterHub.jsx read it only inside the
//                            AGENT_FORM_HUB_ENABLED ternaries) → nothing;
//   battleAgentFormSlot.jsx  imported and unused (the battle sites read it only inside AGENT_FORM_BATTLE_ENABLED's)
//                            → nothing;
//   agentFormSpec.js         formForArchetype and hasWebGL used (HubAgentForm.jsx's import) → those two and the table
//                            they read;
//   hub/hubCopy.js           HUB_COPY used (every hub view) → HUB_COPY alone.
// The bundle is Vite's own build, in memory (`write: false`), with the production JSX transform @vitejs/plugin-react
// sets. Everything a module imports is external, but for the agent form flag module, bundled with every flag false so
// the literal ternaries fold as they do in the shipped build. The check reads the output's top level, never where the
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
const SPEC = 'src/components/AgentForm/agentFormSpec.js';
const HUB_COPY_FILE = 'src/components/CommandCenter/hub/hubCopy.js';
const FLAGS = 'src/config/agentFormFlags.js';

/** Each module the flag-off graph reaches, with the exports that graph reads from it. */
const REACHED = [
  [HUB_VIEW, []],
  [SLOT, []],
  [SPEC, ['formForArchetype', 'hasWebGL']],
  [HUB_COPY_FILE, ['HUB_COPY']],
];

const ENTRY = '\0agent-form-flag-off-entry';

/** The flag module as the flag-off graph reads it: every flag false (today's values, so today it is the file as it stands). */
const flagOff = (code) => code.replace(/^(export const \w+_ENABLED = )true;$/gm, '$1false;');

/**
 * One module bundled as the flag-off graph reaches it, `used` its exports read ([] for imported and unused); `source`
 * replaces its text. Returns the output and every module the build loaded (an empty one renders no code, so the chunk
 * does not list it).
 */
async function bundle(rel, used, source) {
  const target = idOf(rel), flags = idOf(FLAGS);
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
        return /(^|\/)agentFormFlags(\.js)?$/.test(spec) ? flags : { id: spec, external: true };
      },
      load(id) {
        loaded.push(id);
        if (id === ENTRY) return entry;
        if (id === flags) return flagOff(read(FLAGS));
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
      ['a frozen copy key list nothing reads', HUB_COPY_FILE, ['HUB_COPY'], `${read(HUB_COPY_FILE)}\nexport const AGENT_FORM_COPY_KEYS = Object.freeze(Object.keys(AGENT_FORM_COPY));\n`],
    ];
    for (const [what, rel, used, source] of plants) expect(leftovers((await bundle(rel, used, source)).code), what).not.toEqual([]);
    for (const [rel, used] of REACHED) expect(leftovers((await bundle(rel, used, read(rel))).code), rel).toEqual([]);
  }, 30000);
});
